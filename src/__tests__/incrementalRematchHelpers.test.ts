import { describe, it, expect } from "vitest";
import { isOpenForRematch, isLongOverdue, pickRequirementsToRematch, OVERDUE_REMATCH_GRACE_DAYS, type RematchableRequirement } from "../../server-handlers/_incremental-rematch-helpers";

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
