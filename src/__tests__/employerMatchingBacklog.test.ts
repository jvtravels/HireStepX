import { describe, it, expect, vi } from "vitest";
import {
  HIRED_ELSEWHERE_WINDOW_DAYS,
  loadHiredElsewhere,
  planHiredElsewhereRemovals,
  type ExistingMatchRow,
} from "../../server-handlers/_employer-matching-helpers";
import {
  REMATCH_MAX_AGE_MS,
  fetchLatestMatchingInputChange,
  isRematchDue,
} from "../../server-handlers/_incremental-rematch-helpers";
import { requiredSkillsCoverage } from "../../server-handlers/_requirement-match-helpers";

const NOW = Date.parse("2026-10-20T00:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString();
const row = (over: Partial<ExistingMatchRow> & { id: string; candidate_user_id: string }): ExistingMatchRow =>
  ({ match_score: 60, unlocked: false, ...over }) as ExistingMatchRow;

describe("loadHiredElsewhere", () => {
  it("reads only hires inside the window (or with no stamp) on other requirements", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => [{ candidate_user_id: "a" }] }));
    const out = await loadHiredElsewhere("https://x.supabase.co", {}, "req-1", ["a", "b"], fetchImpl as unknown as typeof fetch, NOW);
    expect([...out]).toEqual(["a"]);
    const url = decodeURIComponent(String((fetchImpl.mock.calls[0] as unknown[])[0]));
    expect(url).toContain("candidate_status=eq.hired");
    expect(url).toContain("requirement_id=neq.req-1");
    expect(url).toContain(`candidate_status_updated_at.gte.${iso(NOW - HIRED_ELSEWHERE_WINDOW_DAYS * 86_400_000)}`);
    expect(url).toContain("candidate_status_updated_at.is.null");
  });

  it("never throws and returns what it has when a read fails", async () => {
    const fetchImpl = vi.fn(async () => { throw new Error("network"); });
    const out = await loadHiredElsewhere("https://x.supabase.co", {}, "req-1", ["a"], fetchImpl as unknown as typeof fetch, NOW);
    expect(out.size).toBe(0);
  });
});

describe("planHiredElsewhereRemovals", () => {
  const rows = [
    row({ id: "m1", candidate_user_id: "hired" }),
    row({ id: "m2", candidate_user_id: "free" }),
    row({ id: "m3", candidate_user_id: "hired", unlocked: true }),
  ];

  it("removes untouched locked rows for hired candidates and keeps the rest", () => {
    const plan = planHiredElsewhereRemovals(rows, new Set(["hired"]));
    expect(plan.removeIds).toEqual(["m1"]);
    expect(plan.untouched.map((r) => r.id)).toEqual(["m2", "m3"]);
  });

  it("is a no-op when nobody was hired elsewhere", () => {
    const plan = planHiredElsewhereRemovals(rows, new Set());
    expect(plan.removeIds).toEqual([]);
    expect(plan.untouched).toHaveLength(3);
  });
});

describe("fetchLatestMatchingInputChange", () => {
  const respond = (ok: boolean, body: unknown) => vi.fn(async () => ({ ok, json: async () => body })) as unknown as typeof fetch;
  const params = (fetchImpl: typeof fetch) => ({ supabaseUrl: "https://x.supabase.co", headers: {}, fetchImpl });

  it("returns the newest stamp as epoch ms", async () => {
    const f = respond(true, [{ matching_inputs_changed_at: "2026-10-19T10:00:00Z" }]);
    expect(await fetchLatestMatchingInputChange(params(f))).toBe(Date.parse("2026-10-19T10:00:00Z"));
    expect(decodeURIComponent(String((vi.mocked(f).mock.calls[0] as unknown[])[0]))).toContain("order=matching_inputs_changed_at.desc&limit=1");
  });

  it("returns null when no profile has changed yet", async () => {
    expect(await fetchLatestMatchingInputChange(params(respond(true, [])))).toBeNull();
  });

  it("is unknown when the column is not migrated or the read fails", async () => {
    expect(await fetchLatestMatchingInputChange(params(respond(false, { code: "42703" })))).toBe("unknown");
    expect(await fetchLatestMatchingInputChange(params(vi.fn(async () => { throw new Error("down"); }) as unknown as typeof fetch))).toBe("unknown");
    expect(await fetchLatestMatchingInputChange(params(respond(true, { message: "not an array" })))).toBe("unknown");
  });
});

describe("isRematchDue", () => {
  const matchedAt = NOW - 2 * 86_400_000;

  it("is always due when the change probe is unavailable", () => {
    expect(isRematchDue({ last_matched_at: iso(NOW - 1000) }, "unknown", NOW)).toBe(true);
  });

  it("is due when never matched", () => {
    expect(isRematchDue({ last_matched_at: null }, null, NOW)).toBe(true);
  });

  it("is skipped when nothing changed since the last pass", () => {
    expect(isRematchDue({ last_matched_at: iso(matchedAt) }, matchedAt - 1000, NOW)).toBe(false);
    expect(isRematchDue({ last_matched_at: iso(matchedAt) }, null, NOW)).toBe(false);
  });

  it("is due when a candidate input changed after the last pass", () => {
    expect(isRematchDue({ last_matched_at: iso(matchedAt) }, matchedAt + 1000, NOW)).toBe(true);
  });

  it("is due once older than the max age even with no change", () => {
    const old = NOW - REMATCH_MAX_AGE_MS - 1000;
    expect(isRematchDue({ last_matched_at: iso(old) }, null, NOW)).toBe(true);
    expect(isRematchDue({ last_matched_at: iso(NOW - REMATCH_MAX_AGE_MS + 60_000) }, null, NOW)).toBe(false);
  });

  it("measures a change against the start of the last attempt, so an edit made mid-scan is not lost", () => {
    const attempt = matchedAt - 60_000;
    expect(isRematchDue({ last_matched_at: iso(matchedAt), last_rematch_attempt_at: iso(attempt) }, attempt + 1000, NOW)).toBe(true);
    expect(isRematchDue({ last_matched_at: iso(matchedAt), last_rematch_attempt_at: iso(attempt) }, attempt - 1000, NOW)).toBe(false);
  });

  it("a failed attempt after the last success does not hide a change the success never saw", () => {
    const failedAttempt = matchedAt + 3_600_000;
    expect(isRematchDue({ last_matched_at: iso(matchedAt), last_rematch_attempt_at: iso(failedAttempt) }, matchedAt + 1000, NOW)).toBe(true);
  });
});

describe("requiredSkillsCoverage", () => {
  const cand = (skills: string[]) => ({ target_role: "Frontend Developer", resume_data: { skills } as unknown });

  it("reports zero met for a candidate with none of the listed skills", () => {
    expect(requiredSkillsCoverage(cand(["Photoshop"]), ["React", "TypeScript"])).toEqual({ met: 0, total: 2 });
  });

  it("counts the skills the resume covers", () => {
    expect(requiredSkillsCoverage(cand(["React", "TypeScript"]), ["React", "TypeScript"])).toEqual({ met: 2, total: 2 });
    expect(requiredSkillsCoverage(cand(["React"]), ["React", "TypeScript"])).toEqual({ met: 1, total: 2 });
  });

  it("has no total (so no label) when the job lists no skills", () => {
    expect(requiredSkillsCoverage(cand(["React"]), [])).toEqual({ met: 0, total: 0 });
    expect(requiredSkillsCoverage(cand(["React"]), undefined)).toEqual({ met: 0, total: 0 });
    expect(requiredSkillsCoverage(cand(["React"]), ["  "])).toEqual({ met: 0, total: 0 });
  });
});
