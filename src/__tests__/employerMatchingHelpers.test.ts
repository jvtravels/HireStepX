import { describe, it, expect, vi } from "vitest";
import {
  chunk,
  inList,
  isTouchedMatch,
  planExistingMatches,
  planStaleRemovals,
  isEligiblePoolProfile,
  isRelevantProfile,
  keepGradedSessions,
  computeTrustedSessionStats,
  fetchKeyset,
  loadBlockedCandidateIds,
  loadOptedOutCandidateIds,
  loadEvidenceFlags,
  selectNewStrongMatches,
  strongMatchAlertBody,
  canStartBatch,
  parsePagination,
  paginate,
  checkEmployerAllowance,
  openRequirementLimitAllowance,
  rematchLimitAllowance,
  scrubFreeText,
  scrubLockedResume,
  maskStrongMatches,
  maskedCandidateName,
  LOCKED_MASKED_FIELDS,
  type ExistingMatchRow,
  type PoolProfile,
} from "../../server-handlers/_employer-matching-helpers";
import { TIER_LIMITS } from "../../server-handlers/_employer-trust";

const H = { apikey: "k" };

function row(over: Partial<ExistingMatchRow> & { id: string; candidate_user_id: string }): ExistingMatchRow {
  return {
    match_score: 50, unlocked: false, candidate_status: "shortlisted", candidate_status_note: null, interview_scheduled_at: null,
    ...over,
  };
}

const profile = (over: Partial<PoolProfile> = {}): PoolProfile => ({
  id: "c1", name: "Asha Rao", target_role: "Frontend Developer", industry: null, resume_data: null, practice_timestamps: [], employer_visibility: "masked",
  ...over,
});

describe("chunk / inList", () => {
  it("splits into batches of at most `size`", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 3)).toEqual([]);
  });
  it("url-encodes ids", () => {
    expect(inList(["a b", "c,d"])).toBe("a%20b,c%2Cd");
  });
});

describe("pool eligibility", () => {
  const ctx = { ownerUserId: "owner", blockedCandidateIds: new Set(["blocked"]), excludedCandidateIds: new Set(["touched"]) };

  it("accepts a normal opted-in candidate", () => {
    expect(isEligiblePoolProfile(profile(), ctx)).toBe(true);
  });
  it("rejects candidates who switched employer visibility off", () => {
    expect(isEligiblePoolProfile(profile({ employer_visibility: "off" }), ctx)).toBe(false);
  });
  it("rejects candidates who blocked this employer", () => {
    expect(isEligiblePoolProfile(profile({ id: "blocked" }), ctx)).toBe(false);
  });
  it("rejects the employer's own profile (dual-role account)", () => {
    expect(isEligiblePoolProfile(profile({ id: "owner" }), ctx)).toBe(false);
  });
  it("rejects candidates already held as preserved (touched) rows", () => {
    expect(isEligiblePoolProfile(profile({ id: "touched" }), ctx)).toBe(false);
  });
  it("rejects a profile with neither target role nor resume", () => {
    expect(isEligiblePoolProfile(profile({ target_role: null, resume_data: null }), ctx)).toBe(false);
  });
  it("relevance prefilter keeps on-role and drops off-role candidates", () => {
    const req = { title: "Frontend Developer", location: "Bengaluru", description: "Build React user interfaces", skills: ["React"] };
    expect(isRelevantProfile(profile(), req)).toBe(true);
    expect(isRelevantProfile(profile({ target_role: "Chartered Accountant" }), req)).toBe(false);
  });
});

describe("graded-session trust", () => {
  it("drops sessions the server never graded", () => {
    const rows = [
      { user_id: "u", score: 90, created_at: "2026-01-01", report_generated_at: "2026-01-01T01:00:00Z", report_json: null },
      { user_id: "u", score: 100, created_at: "2026-01-02", report_generated_at: null, report_json: null },
    ];
    expect(keepGradedSessions(rows)).toHaveLength(1);
  });
  it("computes average and count from graded sessions only (ungraded 100s can't inflate it)", () => {
    const stats = computeTrustedSessionStats([
      { user_id: "u", score: 60, created_at: "2026-01-01", report_generated_at: "x", report_json: null },
      { user_id: "u", score: 80, created_at: "2026-01-02", report_generated_at: "x", report_json: null },
      { user_id: "u", score: 100, created_at: "2026-01-03", report_generated_at: null, report_json: null },
    ]);
    expect(stats.sessionCount.get("u")).toBe(2);
    expect(stats.avgScore.get("u")).toBe(70);
  });
});

describe("planExistingMatches", () => {
  const existing = [
    row({ id: "m1", candidate_user_id: "optout" }),
    row({ id: "m2", candidate_user_id: "optout-unlocked", unlocked: true }),
    row({ id: "m3", candidate_user_id: "blocked", candidate_status: "interviewing" }),
    row({ id: "m4", candidate_user_id: "touched", candidate_status_note: "call back" }),
    row({ id: "m5", candidate_user_id: "plain" }),
  ];
  const plan = planExistingMatches(existing, new Set(["optout", "optout-unlocked", "blocked"]));

  it("removes locked rows for ineligible candidates, even if pipeline-touched", () => {
    expect(plan.removeIneligibleIds.sort()).toEqual(["m1", "m3"]);
  });
  it("never removes an unlocked (paid) row, even when the candidate opted out", () => {
    expect(plan.removeIneligibleIds).not.toContain("m2");
    expect(plan.preserved.map((m) => m.id)).toContain("m2");
  });
  it("keeps touched rows as preserved and the rest as untouched", () => {
    expect(plan.preserved.map((m) => m.id).sort()).toEqual(["m2", "m4"]);
    expect(plan.untouched.map((m) => m.id)).toEqual(["m5"]);
  });
  it("isTouchedMatch covers unlock, status, note and scheduled interview", () => {
    expect(isTouchedMatch(row({ id: "a", candidate_user_id: "a" }))).toBe(false);
    expect(isTouchedMatch(row({ id: "a", candidate_user_id: "a", interview_scheduled_at: "2026-02-01" }))).toBe(true);
  });
});

describe("planStaleRemovals", () => {
  const untouched = [
    row({ id: "keep", candidate_user_id: "still-ranked" }),
    row({ id: "stale", candidate_user_id: "gone" }),
    row({ id: "paid", candidate_user_id: "paid-gone", unlocked: true }),
    row({ id: "noted", candidate_user_id: "noted-gone", candidate_status_note: "x" }),
  ];
  it("removes only locked, untouched rows that fell out of the ranking", () => {
    expect(planStaleRemovals(untouched, new Set(["still-ranked"]), true)).toEqual(["stale"]);
  });
  it("removes nothing when the pool scan was incomplete", () => {
    expect(planStaleRemovals(untouched, new Set(), false)).toEqual([]);
  });
});

describe("fetchKeyset", () => {
  const pageOf = (ids: string[]) => ({ ok: true, json: async () => ids.map((id) => ({ id })) });

  it("walks keyset pages until a short page", async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(pageOf(["a", "b"]))
      .mockResolvedValueOnce(pageOf(["c"]));
    const r = await fetchKeyset<{ id: string }>({ baseUrl: "https://x/rest/v1/t?select=id", headers: H, keyField: "id", pageSize: 2, fetchImpl: f as unknown as typeof fetch });
    expect(r.rows.map((x) => x.id)).toEqual(["a", "b", "c"]);
    expect(r.truncated).toBe(false);
    expect(String(f.mock.calls[0][0])).toContain("order=id.asc&limit=2");
    expect(String(f.mock.calls[1][0])).toContain("id=gt.b");
  });
  it("marks truncated when maxRows is hit", async () => {
    const f = vi.fn().mockResolvedValue(pageOf(["a", "b"]));
    const r = await fetchKeyset<{ id: string }>({ baseUrl: "https://x?select=id", headers: H, keyField: "id", pageSize: 2, maxRows: 2, fetchImpl: f as unknown as typeof fetch });
    expect(r.truncated).toBe(true);
    expect(r.failed).toBe(false);
  });
  it("stops at the deadline and reports truncated", async () => {
    const f = vi.fn();
    const r = await fetchKeyset<{ id: string }>({ baseUrl: "https://x?select=id", headers: H, keyField: "id", deadlineMs: Date.now() - 1, fetchImpl: f as unknown as typeof fetch });
    expect(r.truncated).toBe(true);
    expect(f).not.toHaveBeenCalled();
  });
  it("reports failure on a non-ok page and keeps what it had", async () => {
    const f = vi.fn().mockResolvedValueOnce(pageOf(["a", "b"])).mockResolvedValueOnce({ ok: false, json: async () => [] });
    const r = await fetchKeyset<{ id: string }>({ baseUrl: "https://x?select=id", headers: H, keyField: "id", pageSize: 2, fetchImpl: f as unknown as typeof fetch });
    expect(r.failed).toBe(true);
    expect(r.truncated).toBe(true);
    expect(r.seen).toBe(2);
  });
  it("streams to onPage without retaining rows", async () => {
    const f = vi.fn().mockResolvedValueOnce(pageOf(["a"]));
    const seen: string[] = [];
    const r = await fetchKeyset<{ id: string }>({ baseUrl: "https://x?select=id", headers: H, keyField: "id", pageSize: 5, fetchImpl: f as unknown as typeof fetch, onPage: (rows) => seen.push(...rows.map((x) => x.id)) });
    expect(seen).toEqual(["a"]);
    expect(r.rows).toEqual([]);
    expect(r.seen).toBe(1);
  });
});

describe("consent loaders", () => {
  it("loadBlockedCandidateIds returns null (fail closed) on a failed read", async () => {
    const f = vi.fn().mockResolvedValue({ ok: false, json: async () => [] });
    expect(await loadBlockedCandidateIds("https://x", H, "emp", f as unknown as typeof fetch)).toBeNull();
  });
  it("loadOptedOutCandidateIds flags 'off' profiles AND candidates whose profile is gone, in batches of 100", async () => {
    const ids = Array.from({ length: 150 }, (_, i) => `c${i}`);
    const f = vi.fn(async (url: string) => {
      const inPart = decodeURIComponent(String(url).match(/id=in\.\(([^)]*)\)/)?.[1] || "").split(",");
      expect(inPart.length).toBeLessThanOrEqual(100);
      return { ok: true, json: async () => inPart.filter((id) => id !== "c7").map((id) => ({ id, employer_visibility: id === "c3" ? "off" : "masked" })) };
    });
    const out = await loadOptedOutCandidateIds("https://x", H, ids, f as unknown as typeof fetch);
    expect(f).toHaveBeenCalledTimes(2);
    expect([...out!].sort()).toEqual(["c3", "c7"]);
  });
  it("loadOptedOutCandidateIds returns null on a failed read", async () => {
    const f = vi.fn().mockResolvedValue({ ok: false, json: async () => [] });
    expect(await loadOptedOutCandidateIds("https://x", H, ["a"], f as unknown as typeof fetch)).toBeNull();
  });
  it("loadEvidenceFlags: resume counts, a graded session counts, nothing does not", async () => {
    const f = vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes("/profiles?")) return { ok: true, json: async () => [{ id: "with-resume" }] };
      if (u.includes("/sessions?")) {
        expect(u).toContain("report_generated_at=not.is.null");
        return { ok: true, json: async () => [{ user_id: "with-graded", score: 70, created_at: "2026-01-01", report_generated_at: "x" }] };
      }
      return { ok: false, json: async () => [] };
    });
    const flags = await loadEvidenceFlags("https://x", H, ["with-resume", "with-graded", "nothing"], f as unknown as typeof fetch);
    expect(flags!.get("with-resume")).toBe(true);
    expect(flags!.get("with-graded")).toBe(true);
    expect(flags!.get("nothing")).toBe(false);
  });
});

describe("strong-match alerts", () => {
  const ranked = Array.from({ length: 8 }, (_, i) => ({ candidateId: `c${i}`, matchScore: 90 - i }));
  it("selects only newly strong candidates, best first, capped", () => {
    const prev = new Map([["c0", 95], ["c1", 10]]);
    const out = selectNewStrongMatches(ranked, prev, 40, 3);
    expect(out.map((m) => m.candidateId)).toEqual(["c1", "c2", "c3"]); // c0 was already strong
  });
  it("defaults to a per-run cap of 5", () => {
    expect(selectNewStrongMatches(ranked, new Map(), 40)).toHaveLength(5);
  });
  it("alert copy carries counts and score only — no candidate identifier", () => {
    const one = strongMatchAlertBody(1, 82, "Senior Designer");
    const many = strongMatchAlertBody(4, 82, "Senior Designer");
    expect(one).toContain("82%");
    expect(many).toContain("4 new strong matches");
    expect(`${one} ${many}`).not.toMatch(/Candidate #|@/);
  });
});

describe("canStartBatch (cron time budget)", () => {
  it("allows a batch while the slowest batch still fits in the budget", () => {
    expect(canStartBatch(100_000, 200_000, 30_000)).toBe(true);
  });
  it("refuses once elapsed + slowest batch would overrun", () => {
    expect(canStartBatch(180_000, 200_000, 30_000)).toBe(false);
  });
  it("allows the first batch (no timing yet)", () => {
    expect(canStartBatch(0, 200_000, 0)).toBe(true);
  });
});

describe("pagination", () => {
  it("defaults to page 1, limit 25", () => {
    expect(parsePagination(new URLSearchParams())).toEqual({ page: 1, limit: 25 });
  });
  it("clamps limit to 100 and sanitises garbage", () => {
    expect(parsePagination(new URLSearchParams("limit=500&page=3"))).toEqual({ page: 3, limit: 100 });
    expect(parsePagination(new URLSearchParams("limit=abc&page=-2"))).toEqual({ page: 1, limit: 25 });
  });
  it("returns the slice with total and nextPage", () => {
    const items = Array.from({ length: 60 }, (_, i) => i);
    const p1 = paginate(items, { page: 1, limit: 25 });
    expect(p1.items).toHaveLength(25);
    expect(p1).toMatchObject({ total: 60, page: 1, limit: 25, nextPage: 2 });
    const p3 = paginate(items, { page: 3, limit: 25 });
    expect(p3.items).toHaveLength(10);
    expect(p3.nextPage).toBeNull();
    expect(paginate(items, { page: 9, limit: 25 }).items).toEqual([]);
  });
});

describe("tier limits", () => {
  it("openRequirementLimitAllowance refuses at the tier cap with limit/tier fields", () => {
    const limit = TIER_LIMITS.basic.openRequirements;
    expect(openRequirementLimitAllowance("basic", limit - 1).ok).toBe(true);
    const denied = openRequirementLimitAllowance("basic", limit);
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.status).toBe(403);
      expect(denied.body).toMatchObject({ code: "requirement_limit", tier: "basic", limit });
    }
  });
  it("rematchLimitAllowance refuses with 429 and a retry hint", () => {
    const limit = TIER_LIMITS.email_verified.rematchesPerHour;
    const denied = rematchLimitAllowance("email_verified", limit);
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.status).toBe(429);
      expect(denied.retryAfterSeconds).toBe(3600);
      expect(denied.body).toMatchObject({ code: "rematch_limit", tier: "email_verified", limit });
    }
  });

  function gateFetch(opts: { identity?: { email: string; email_confirmed_at: string | null }; open?: number | null; recent?: number | null }) {
    const count = (n: number | null) => (n === null
      ? { ok: false, headers: { get: () => null }, json: async () => [] }
      : { ok: true, headers: { get: () => `0-0/${n}` }, json: async () => [] });
    return vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes("/auth/v1/admin/users/")) return { ok: true, json: async () => opts.identity ?? { email: "x@gmail.com", email_confirmed_at: "2026-01-01" } };
      if (u.includes("employer_requirement_activity")) return count(opts.recent === undefined ? 0 : opts.recent);
      return count(opts.open === undefined ? 0 : opts.open);
    }) as unknown as typeof fetch;
  }
  const base = { supabaseUrl: "https://x", headers: H, employerId: "emp", needsOpenSlot: true, needsRematch: true };

  it("refuses a suspended employer without any lookups", async () => {
    const f = gateFetch({});
    const r = await checkEmployerAllowance({ ...base, employer: { suspended_at: "2026-01-01" }, fetchImpl: f });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.body.code).toBe("suspended");
    expect(f).not.toHaveBeenCalled();
  });
  it("a company-domain confirmed email raises the open-requirement ceiling", async () => {
    const identity = { email: "hr@acme.com", email_confirmed_at: "2026-01-01" };
    const denied = await checkEmployerAllowance({ ...base, employer: { website: null }, fetchImpl: gateFetch({ open: 3 }) });
    const allowed = await checkEmployerAllowance({ ...base, employer: { website: null }, fetchImpl: gateFetch({ identity, open: 3 }) });
    expect(denied.ok).toBe(false);
    expect(allowed.ok).toBe(true);
  });
  it("fails closed with 503 when counts can't be read", async () => {
    const r1 = await checkEmployerAllowance({ ...base, employer: {}, fetchImpl: gateFetch({ open: null }) });
    const r2 = await checkEmployerAllowance({ ...base, needsOpenSlot: false, employer: {}, fetchImpl: gateFetch({ recent: null }) });
    for (const r of [r1, r2]) {
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.status).toBe(503);
    }
  });
  it("skips checks that weren't requested", async () => {
    const f = gateFetch({ open: 99, recent: 99 });
    const r = await checkEmployerAllowance({ ...base, needsOpenSlot: false, needsRematch: false, employer: {}, fetchImpl: f });
    expect(r.ok).toBe(true);
  });
});

describe("pre-unlock masking", () => {
  it("scrubFreeText removes entity names, emails, links and phone numbers but keeps year ranges", () => {
    const out = scrubFreeText(
      "Led payments at Infosys (2018 - 2021 - 2023). B.Tech IIT Madras. Mail me at a.b@corp.in, https://linkedin.com/in/asha or +91 98765 43210.",
      ["Infosys", "IIT Madras"],
    );
    expect(out).not.toMatch(/Infosys|IIT Madras|@|linkedin|98765/i);
    expect(out).toContain("2018 - 2021 - 2023");
  });
  it("scrubLockedResume scrubs institutions out of free text after structural redaction", () => {
    const original = {
      summary: "Ten years at Flipkart building checkout.", headline: "Engineer at Flipkart", keyAchievements: ["Cut Flipkart latency by 40%"],
      certifications: ["AWS"], experience: [{ company: "Flipkart", title: "SDE at Flipkart" }], education: [{ school: "BITS Pilani" }],
    } as never;
    const redacted = { ...(original as object), experience: [{ company: "", title: "SDE at Flipkart" }], education: [{ school: "" }] } as never;
    const out = scrubLockedResume(original, redacted);
    expect(JSON.stringify(out)).not.toMatch(/Flipkart|BITS/);
  });
  it("maskStrongMatches masks locked candidates and exposes the match id, not the user id", () => {
    const chips = [
      { id: "user-1", name: "Asha Rao", initials: "AR", yearsExperience: 3, skills: ["React"] },
      { id: "user-2", name: "Ravi K", initials: "RK", yearsExperience: 5, skills: [] },
      { id: "user-3", name: "No Lookup", initials: "NL", yearsExperience: null, skills: [] },
    ];
    const lookup = new Map([
      ["user-1", { matchId: "abc123-match", unlocked: false }],
      ["user-2", { matchId: "def456-match", unlocked: true }],
    ]);
    const out = maskStrongMatches(chips, lookup);
    expect(out[0]).toMatchObject({ id: "abc123-match", name: maskedCandidateName("abc123-match") });
    expect(out[0].initials).not.toBe("AR");
    expect(out[1].name).toBe("Ravi K");
    expect(out[2].name).not.toBe("No Lookup"); // unknown = mask, never leak
  });
  it("lists what is masked", () => {
    expect(LOCKED_MASKED_FIELDS).toEqual(expect.arrayContaining(["name", "email", "phone", "linkedin", "employerNames", "institutionNames"]));
  });
});
