import { describe, it, expect } from "vitest";
import {
  rankAndCap,
  locationsOverlap,
  explainMatch,
  scoreCandidateMatch,
  requirementCriteriaFingerprint,
  blendDeterministicWithLlm,
  capUnsupportedStrong,
  type CandidatePoolRow,
  type RequirementInput,
  type ScoredCandidate,
} from "../../server-handlers/_requirement-match-helpers";
import {
  llmBudgetMs,
  resolveLlmScores,
  isModelSourceFlip,
  isLiveMatch,
  parseRestoreMatches,
  previousStatusOf,
  requirementNeedsRematch,
  LLM_MAX_BUDGET_MS,
  LLM_MIN_REMAINING_MS,
  LLM_SCORE_MAX_AGE_MS,
  type MatchingInputs,
} from "../../server-handlers/_employer-matching-helpers";

const scored = (candidateId: string, matchScore: number): ScoredCandidate => ({
  candidateId, matchScore, rosterScore: 0, hasRelevance: true, hasEvidence: true, meetsQualityBar: true, skillsSupportStrong: true,
});

describe("rankAndCap tiebreak", () => {
  it("orders equal scores by candidate id, regardless of input order", () => {
    const a = rankAndCap([scored("c", 60), scored("a", 60), scored("b", 60)]).ranked.map((r) => r.candidateId);
    const b = rankAndCap([scored("b", 60), scored("c", 60), scored("a", 60)]).ranked.map((r) => r.candidateId);
    expect(a).toEqual(["a", "b", "c"]);
    expect(b).toEqual(a);
  });

  it("sorts by score first, so a higher score beats a lower id", () => {
    expect(rankAndCap([scored("a", 50), scored("z", 70)]).ranked.map((r) => r.candidateId)).toEqual(["z", "a"]);
  });

  it("picks the same people at the cap boundary on every scan", () => {
    const pool = ["e", "d", "c", "b", "a"].map((id) => scored(id, 55));
    const { ranked, totalMatched } = rankAndCap(pool, 3);
    expect(ranked.map((r) => r.candidateId)).toEqual(["a", "b", "c"]);
    expect(totalMatched).toBe(5);
  });
});

describe("llmBudgetMs", () => {
  it("skips the model below the minimum remaining time", () => {
    expect(llmBudgetMs(LLM_MIN_REMAINING_MS - 1)).toBe(0);
    expect(llmBudgetMs(0)).toBe(0);
    expect(llmBudgetMs(-100)).toBe(0);
    expect(llmBudgetMs(Number.NaN)).toBe(0);
  });
  it("leaves a write reserve and caps at the max budget", () => {
    expect(llmBudgetMs(LLM_MIN_REMAINING_MS)).toBe(LLM_MIN_REMAINING_MS - 2_000);
    expect(llmBudgetMs(60_000)).toBe(LLM_MAX_BUDGET_MS);
  });
});

describe("resolveLlmScores", () => {
  const now = Date.parse("2026-10-18T00:00:00Z");
  const at = (ms: number) => new Date(now - ms).toISOString();
  const guard = { criteriaFingerprint: "fp", profileStamps: new Map([["a", "st"]]) };
  const stored = (over: Record<string, unknown> = {}) => new Map([["a", {
    llm_score: 80, llm_scored_at: at(86_400_000), llm_criteria_fingerprint: "fp", llm_profile_stamp: "st", ...over,
  }]]);

  it("prefers a fresh score and stamps it now", () => {
    const out = resolveLlmScores(["a"], new Map([["a", 55]]), stored(), now, guard);
    expect(out.get("a")).toEqual({ score: 55, scoredAt: new Date(now).toISOString(), reused: false });
  });
  it("reuses a recent stored score when none came back and the provenance matches", () => {
    expect(resolveLlmScores(["a"], new Map(), stored(), now, guard).get("a")).toMatchObject({ score: 80, reused: true });
  });
  it("drops a stored score past the max age, with a missing stamp, or from the future", () => {
    expect(resolveLlmScores(["a"], new Map(), stored({ llm_scored_at: at(LLM_SCORE_MAX_AGE_MS + 1000) }), now, guard).size).toBe(0);
    expect(resolveLlmScores(["a"], new Map(), stored({ llm_scored_at: null }), now, guard).size).toBe(0);
    expect(resolveLlmScores(["a"], new Map(), stored({ llm_scored_at: new Date(now + 3_600_000).toISOString() }), now, guard).size).toBe(0);
  });
  it("drops a stored score when the criteria or the candidate profile changed since it was scored", () => {
    expect(resolveLlmScores(["a"], new Map(), stored({ llm_criteria_fingerprint: "other" }), now, guard).size).toBe(0);
    expect(resolveLlmScores(["a"], new Map(), stored({ llm_profile_stamp: "other" }), now, guard).size).toBe(0);
  });
  it("drops a stored score that has no provenance, or whose candidate has no current stamp", () => {
    expect(resolveLlmScores(["a"], new Map(), stored({ llm_criteria_fingerprint: null, llm_profile_stamp: null }), now, guard).size).toBe(0);
    expect(resolveLlmScores(["a"], new Map(), stored(), now, { criteriaFingerprint: "fp", profileStamps: new Map() }).size).toBe(0);
  });
});

describe("isModelSourceFlip", () => {
  const base = { strongThreshold: 40 };
  it("is a flip when the model opinion appeared or vanished under a weak deterministic score", () => {
    expect(isModelSourceFlip({ ...base, previousHadModelScore: false, nowHasModelScore: true, deterministicScore: 30 })).toBe(true);
    expect(isModelSourceFlip({ ...base, previousHadModelScore: true, nowHasModelScore: false, deterministicScore: 30 })).toBe(true);
  });
  it("is not a flip when the model source is unchanged, or the evidence alone is strong", () => {
    expect(isModelSourceFlip({ ...base, previousHadModelScore: true, nowHasModelScore: true, deterministicScore: 30 })).toBe(false);
    expect(isModelSourceFlip({ ...base, previousHadModelScore: false, nowHasModelScore: true, deterministicScore: 45 })).toBe(false);
  });
});

describe("isLiveMatch", () => {
  it("excludes rejected, not_a_fit and declined rows", () => {
    expect(isLiveMatch({ candidate_status: "rejected", candidate_response: null })).toBe(false);
    expect(isLiveMatch({ candidate_status: "not_a_fit", candidate_response: null })).toBe(false);
    expect(isLiveMatch({ candidate_status: "shortlisted", candidate_response: "declined" })).toBe(false);
  });
  it("keeps everything else", () => {
    expect(isLiveMatch({ candidate_status: null, candidate_response: null })).toBe(true);
    expect(isLiveMatch({ candidate_status: "interviewing", candidate_response: "interested" })).toBe(true);
  });
});

describe("locationsOverlap token boundaries", () => {
  it("does not match a substring inside another word", () => {
    expect(locationsOverlap("New Delhi", "Renewable Energy Park, Pune")).toBe(false);
    expect(locationsOverlap("Pune", "Punekar Wadi")).toBe(false);
  });
  it("does not let the generic word 'new' tie New Delhi to New York", () => {
    expect(locationsOverlap("New Delhi", "New York")).toBe(false);
    expect(locationsOverlap("New Delhi", "Delhi NCR")).toBe(true);
  });
  it("matches whole tokens, case-insensitively", () => {
    expect(locationsOverlap("Bengaluru", "bengaluru, karnataka")).toBe(true);
    expect(locationsOverlap("Mumbai, Pune", "Pune")).toBe(true);
  });
  it("falls back to the generic tokens when they are all the requirement names", () => {
    expect(locationsOverlap("India", "Pune, India")).toBe(true);
    expect(locationsOverlap("", "Pune")).toBe(false);
  });
});

describe("requirementNeedsRematch", () => {
  const before: MatchingInputs = {
    title: "Dev", description: "d", skills: ["React"], customSkillSets: [], locations: ["Pune"], workMode: null,
    experienceMin: null, experienceMax: null, minReadinessBand: null, minStarCompleteness: null, employmentType: "internship",
    durationWeeks: 8, hoursPerWeek: 20,
  };
  it("treats a contract duration or weekly hours change as a rematch", () => {
    expect(requirementNeedsRematch(before, { ...before, durationWeeks: 12 })).toBe(true);
    expect(requirementNeedsRematch(before, { ...before, hoursPerWeek: 30 })).toBe(true);
    expect(requirementNeedsRematch(before, { ...before, durationWeeks: null })).toBe(true);
  });
  it("does not rematch when nothing matching reads has changed", () => {
    expect(requirementNeedsRematch(before, { ...before })).toBe(false);
    expect(requirementNeedsRematch(before, { ...before, skills: ["react"] })).toBe(false);
  });
  it("treats an absent value like null", () => {
    const { durationWeeks: _d, hoursPerWeek: _h, ...legacy } = before;
    expect(requirementNeedsRematch({ ...legacy, durationWeeks: null, hoursPerWeek: null }, legacy)).toBe(false);
  });
});

describe("requirementCriteriaFingerprint", () => {
  const r: RequirementInput = { title: "Dev", location: "Pune", description: "d", skills: ["React", "Node"] };
  it("ignores cosmetic differences", () => {
    expect(requirementCriteriaFingerprint({ ...r, title: " Dev ", skills: ["node", "react"] })).toBe(requirementCriteriaFingerprint(r));
  });
  it("changes with any matching field, including contract shape", () => {
    expect(requirementCriteriaFingerprint({ ...r, title: "Lead Dev" })).not.toBe(requirementCriteriaFingerprint(r));
    expect(requirementCriteriaFingerprint({ ...r, durationWeeks: 8 })).not.toBe(requirementCriteriaFingerprint(r));
    expect(requirementCriteriaFingerprint({ ...r, hoursPerWeek: 20 })).not.toBe(requirementCriteriaFingerprint(r));
  });
});

describe("explainMatch parity with scoring", () => {
  const pool = (over: Partial<CandidatePoolRow> = {}): CandidatePoolRow => ({
    id: "c1", name: "C", target_role: "Frontend Developer", industry: null,
    resume_data: { skills: ["React", "TypeScript", "Redux"], location: "Pune" },
    avg_score: 72, sessions_completed: 3, last_active_days_ago: 12, years_experience: 4, ...over,
  });
  const reqs: RequirementInput[] = [
    { title: "Frontend Developer", location: "Pune", description: "x", skills: ["React", "TypeScript"] },
    { title: "Frontend Developer", location: "Delhi", description: "x", skills: ["React"], customSkills: ["Redux"], experienceMin: 2, experienceMax: 6 },
    { title: "Backend Engineer", location: "Pune", description: "x", skills: ["Go", "React"], experienceMin: 8 },
    { title: "Frontend Developer", location: "Remote", description: "x", skills: ["React", "TypeScript"], workMode: "remote" },
  ];

  it("reproduces the stored deterministic score from its components", () => {
    for (const req of reqs) {
      for (const p of [pool(), pool({ last_active_days_ago: 200, sessions_completed: 0, avg_score: null }), pool({ years_experience: null })]) {
        const stored = scoreCandidateMatch(p, req).matchScore;
        const c = explainMatch(p, req, { pool: p, yearsExperience: p.years_experience }).components!;
        expect(c.deterministicScore).toBe(stored);
        const rebuilt = Math.round(Math.min(100, Math.max(0, c.fitPoints + c.rosterCredit + c.customBoost)) * c.recencyMultiplier * c.experienceMultiplier);
        // The components are rounded to a tenth for display, so allow a point.
        expect(Math.abs(rebuilt - stored)).toBeLessThanOrEqual(1);
      }
    }
  });

  it("blends the persisted model score exactly as the stored score was blended", () => {
    const p = pool();
    const req = reqs[0];
    const det = scoreCandidateMatch(p, req);
    const c = explainMatch(p, req, { pool: p, llmScore: 90 }).components!;
    expect(c.llmScore).toBe(90);
    expect(c.blendedScore).toBe(capUnsupportedStrong(blendDeterministicWithLlm(det.matchScore, 90), det.skillsSupportStrong));
  });

  it("leaves the blend equal to the deterministic score when there is no model opinion", () => {
    const p = pool();
    const c = explainMatch(p, reqs[0], { pool: p }).components!;
    expect(c.llmScore).toBeNull();
    expect(c.blendedScore).toBe(c.deterministicScore);
  });

  it("omits components when the caller supplies no pool row", () => {
    expect(explainMatch(pool(), reqs[0]).components).toBeUndefined();
  });
});

describe("archive undo payload", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  it("accepts well-formed records and dedupes by id", () => {
    expect(parseRestoreMatches([{ id, previousStatus: "interviewing" }, { id, previousStatus: "shortlisted" }])).toEqual([{ id, previousStatus: "interviewing" }]);
  });
  it("rejects anything that could write an unexpected status or id", () => {
    expect(parseRestoreMatches([{ id, previousStatus: "hired" }])).toBeNull();
    expect(parseRestoreMatches([{ id: "x'; drop", previousStatus: "shortlisted" }])).toBeNull();
    expect(parseRestoreMatches([])).toBeNull();
    expect(parseRestoreMatches("nope")).toBeNull();
  });
  it("maps a null or unknown status back to shortlisted", () => {
    expect(previousStatusOf(null)).toBe("shortlisted");
    expect(previousStatusOf("weird")).toBe("shortlisted");
    expect(previousStatusOf("interviewing")).toBe("interviewing");
  });
});
