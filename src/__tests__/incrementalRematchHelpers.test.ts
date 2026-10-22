import { describe, it, expect, vi } from "vitest";
import { isOpenForRematch, isLongOverdue, pickRequirementsToRematch, buildRematchQuery, fetchRematchBacklog, OVERDUE_REMATCH_GRACE_DAYS, type RematchableRequirement } from "../../server-handlers/_incremental-rematch-helpers";

function req(over: Partial<RematchableRequirement> & { id: string }): RematchableRequirement {
  return { stage: "ai_matching", status: "ready", last_matched_at: null, ...over };
}

describe("isOpenForRematch", () => {
  it("is open for ai_matching and ready_for_review stages", () => {
    expect(isOpenForRematch({ stage: "ai_matching", status: "ready" })).toBe(true);
    expect(isOpenForRematch({ stage: "ready_for_review", status: "partial" })).toBe(true);
  });

  it("is not open once stage has moved to interviewing or hired", () => {
    expect(isOpenForRematch({ stage: "interviewing", status: "ready" })).toBe(false);
    expect(isOpenForRematch({ stage: "hired", status: "ready" })).toBe(false);
  });

  it("is not open when the requirement has been archived (status closed)", () => {
    expect(isOpenForRematch({ stage: "ai_matching", status: "closed" })).toBe(false);
  });
});

describe("pickRequirementsToRematch", () => {
  it("excludes closed and interviewing/hired requirements", () => {
    const rows = [
      req({ id: "a", stage: "ai_matching", status: "ready" }),
      req({ id: "b", stage: "ai_matching", status: "closed" }),
      req({ id: "c", stage: "hired", status: "ready" }),
    ];
    expect(pickRequirementsToRematch(rows, 10).map((r) => r.id)).toEqual(["a"]);
  });

  it("sorts never-matched (null) requirements ahead of any timestamped one", () => {
    const rows = [
      req({ id: "stale", last_matched_at: "2026-01-01T00:00:00Z" }),
      req({ id: "never", last_matched_at: null }),
    ];
    expect(pickRequirementsToRematch(rows, 10).map((r) => r.id)).toEqual(["never", "stale"]);
  });

  it("orders by last_matched_at ascending — the longest-stale requirement first", () => {
    const rows = [
      req({ id: "recent", last_matched_at: "2026-03-01T00:00:00Z" }),
      req({ id: "oldest", last_matched_at: "2026-01-01T00:00:00Z" }),
      req({ id: "middle", last_matched_at: "2026-02-01T00:00:00Z" }),
    ];
    expect(pickRequirementsToRematch(rows, 10).map((r) => r.id)).toEqual(["oldest", "middle", "recent"]);
  });

  it("caps the result at the given limit", () => {
    const rows = [req({ id: "a" }), req({ id: "b" }), req({ id: "c" })];
    expect(pickRequirementsToRematch(rows, 2)).toHaveLength(2);
  });

  it("returns an empty array when nothing is open", () => {
    expect(pickRequirementsToRematch([], 10)).toEqual([]);
  });
});

describe("isLongOverdue", () => {
  const now = Date.parse("2026-10-17T00:00:00Z");
  const daysAgo = (d: number) => new Date(now - d * 86_400_000).toISOString();

  it("is false without a due date, with an unparseable one, or inside the grace window", () => {
    expect(isLongOverdue(null, now)).toBe(false);
    expect(isLongOverdue(undefined, now)).toBe(false);
    expect(isLongOverdue("not-a-date", now)).toBe(false);
    expect(isLongOverdue(daysAgo(OVERDUE_REMATCH_GRACE_DAYS - 1), now)).toBe(false);
  });

  it("is false for a future deadline", () => {
    expect(isLongOverdue(new Date(now + 86_400_000).toISOString(), now)).toBe(false);
  });

  it("is true once the deadline passed more than the grace period ago", () => {
    expect(isLongOverdue(daysAgo(OVERDUE_REMATCH_GRACE_DAYS + 1), now)).toBe(true);
  });
});

describe("pickRequirementsToRematch overdue skip", () => {
  const now = Date.parse("2026-10-17T00:00:00Z");
  it("drops a long-overdue requirement but keeps a recently overdue one", () => {
    const rows = [
      req({ id: "abandoned", due_date: "2026-01-01" }),
      req({ id: "recent", due_date: "2026-10-10" }),
      req({ id: "nodate" }),
    ];
    expect(pickRequirementsToRematch(rows, 10, now).map((r) => r.id).sort()).toEqual(["nodate", "recent"]);
  });
});

describe("rematch starvation ordering", () => {
  it("ranks requirements by last attempt, so one that keeps failing (never matched) cannot pin the front", () => {
    const rows = [
      req({ id: "failing", last_matched_at: null, last_rematch_attempt_at: "2026-10-16T00:00:00Z" }),
      req({ id: "live", last_matched_at: "2026-10-01T00:00:00Z", last_rematch_attempt_at: "2026-10-10T00:00:00Z" }),
      req({ id: "fresh", last_matched_at: null, last_rematch_attempt_at: null }),
    ];
    expect(pickRequirementsToRematch(rows, 10).map((r) => r.id)).toEqual(["fresh", "live", "failing"]);
    expect(pickRequirementsToRematch(rows, 2).map((r) => r.id)).toEqual(["fresh", "live"]);
  });

  it("falls back to last_matched_at when attempts tie or the column is absent", () => {
    const rows = [
      req({ id: "newer", last_matched_at: "2026-10-05T00:00:00Z" }),
      req({ id: "older", last_matched_at: "2026-10-01T00:00:00Z" }),
    ];
    expect(pickRequirementsToRematch(rows, 10).map((r) => r.id)).toEqual(["older", "newer"]);
  });

  it("filters long-overdue rows in SQL and orders by attempt first", () => {
    const q = buildRematchQuery({ limit: 1000, withAttemptColumn: true, nowMs: Date.parse("2026-10-17T00:00:00Z") });
    expect(q).toContain("or=(due_date.is.null,due_date.gte.2026-09-17)");
    expect(q).toContain("order=last_rematch_attempt_at.asc.nullsfirst,last_matched_at.asc.nullsfirst");
    expect(q).toContain("last_matched_at,last_rematch_attempt_at,");
    expect(q).toContain("employers.suspended_at=is.null");
    expect(q).toContain("limit=1000");
  });

  it("the legacy query never mentions the attempt column", () => {
    const q = buildRematchQuery({ limit: 5, withAttemptColumn: false });
    expect(q).not.toContain("last_rematch_attempt_at");
    expect(q).toContain("order=last_matched_at.asc.nullsfirst");
  });

  it("retries without the attempt column when the first read fails, and is null when both fail", async () => {
    const good = { ok: true, status: 200 } as Response;
    const bad = { ok: false, status: 400 } as Response;
    const f = vi.fn().mockResolvedValueOnce(bad).mockResolvedValueOnce(good);
    expect(await fetchRematchBacklog({ supabaseUrl: "https://x", headers: {}, limit: 10, fetchImpl: f as unknown as typeof fetch })).toBe(good);
    expect(String(f.mock.calls[0][0])).toContain("last_rematch_attempt_at");
    expect(String(f.mock.calls[1][0])).not.toContain("last_rematch_attempt_at");
    const g = vi.fn().mockResolvedValue(bad);
    expect(await fetchRematchBacklog({ supabaseUrl: "https://x", headers: {}, limit: 10, fetchImpl: g as unknown as typeof fetch })).toBeNull();
  });
});
