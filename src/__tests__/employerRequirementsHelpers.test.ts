import { describe, it, expect } from "vitest";
import {
  asBoundedString,
  asBoundedStringArray,
  asBoundedExperience,
  asBoundedDueDate,
  asBoundedBudget,
  asBoundedOpenPositions,
  asBoundedWorkMode,
  isValidRequirementInput,
  buildRequirementsListResponse,
  countMatchesByRequirement,
  computeMatchStats,
  nameInitials,
  buildAiScreeningByRequirement,
  EMPTY_AI_SCREENING,
  averageScoresByUser,
  daysSinceLastActive,
} from "../../server-handlers/_employer-requirements-helpers";

describe("asBoundedString", () => {
  it("passes through a short string unchanged", () => {
    expect(asBoundedString("Backend Engineer", 200)).toBe("Backend Engineer");
  });

  it("truncates a string longer than max", () => {
    expect(asBoundedString("abcdefgh", 5)).toBe("abcde");
  });

  it("returns empty string for non-string input", () => {
    expect(asBoundedString(42, 200)).toBe("");
    expect(asBoundedString(null, 200)).toBe("");
    expect(asBoundedString(undefined, 200)).toBe("");
  });
});

describe("isValidRequirementInput", () => {
  const jd = "Own the checkout funnel end to end and mentor two juniors.";

  it("accepts a real title, at least one location, and a real JD", () => {
    expect(isValidRequirementInput("SDE II", ["Bengaluru"], jd)).toBe(true);
  });

  it("rejects a one-character title", () => {
    expect(isValidRequirementInput("S", ["Bengaluru"], jd)).toBe(false);
  });

  it("rejects an empty locations list", () => {
    expect(isValidRequirementInput("SDE II", [], jd)).toBe(false);
  });

  it("rejects a missing or too-short description", () => {
    expect(isValidRequirementInput("SDE II", ["Bengaluru"], "")).toBe(false);
    expect(isValidRequirementInput("SDE II", ["Bengaluru"], "Short JD")).toBe(false);
  });

  it("trims whitespace before checking description length", () => {
    expect(isValidRequirementInput("SDE II", ["Bengaluru"], `   ${jd}   `)).toBe(true);
  });
});

describe("asBoundedStringArray", () => {
  it("keeps non-empty trimmed strings", () => {
    expect(asBoundedStringArray(["Mumbai", " Bengaluru ", "Remote"], 20, 100)).toEqual(["Mumbai", "Bengaluru", "Remote"]);
  });

  it("drops empty and non-string entries", () => {
    expect(asBoundedStringArray(["Mumbai", "", "  ", 42, null], 20, 100)).toEqual(["Mumbai"]);
  });

  it("caps the list at maxItems", () => {
    expect(asBoundedStringArray(["a", "b", "c"], 2, 100)).toEqual(["a", "b"]);
  });

  it("caps each item at maxItemLen", () => {
    expect(asBoundedStringArray(["abcdef"], 20, 3)).toEqual(["abc"]);
  });

  it("returns an empty array for non-array input", () => {
    expect(asBoundedStringArray("Mumbai", 20, 100)).toEqual([]);
    expect(asBoundedStringArray(null, 20, 100)).toEqual([]);
    expect(asBoundedStringArray(undefined, 20, 100)).toEqual([]);
  });
});

describe("asBoundedOpenPositions", () => {
  it("accepts a valid whole number within range", () => {
    expect(asBoundedOpenPositions(1)).toBe(1);
    expect(asBoundedOpenPositions(500)).toBe(500);
  });

  it("rejects numbers out of the 1-500 range", () => {
    expect(asBoundedOpenPositions(0)).toBeNull();
    expect(asBoundedOpenPositions(501)).toBeNull();
  });

  it("rejects non-integers and non-numbers", () => {
    expect(asBoundedOpenPositions(2.5)).toBeNull();
    expect(asBoundedOpenPositions("3")).toBeNull();
    expect(asBoundedOpenPositions(null)).toBeNull();
  });
});

describe("asBoundedWorkMode", () => {
  it("accepts the three valid work modes", () => {
    expect(asBoundedWorkMode("remote")).toBe("remote");
    expect(asBoundedWorkMode("onsite")).toBe("onsite");
    expect(asBoundedWorkMode("hybrid")).toBe("hybrid");
  });

  it("rejects anything else", () => {
    expect(asBoundedWorkMode("flexible")).toBeNull();
    expect(asBoundedWorkMode(null)).toBeNull();
    expect(asBoundedWorkMode(undefined)).toBeNull();
  });
});

describe("buildRequirementsListResponse", () => {
  const rows = [
    { id: "req_1", title: "SDE II", location: "Bengaluru", notice_period_pref: "30 days", status: "ready", stage: "ai_matching", experience_min: 3, experience_max: 6, due_date: "2026-09-01", budget_min: 18, budget_max: 22, locations: ["Bengaluru"], open_positions: 2, work_mode: "hybrid", employment_type: "full-time", salary_type: "per-annum", preferred_domain: null, work_schedule: null, availability: null, relevant_experience: null, portfolio_required: false, custom_skill_sets: [], skills: ["React", "Node"], responsibilities: null, nice_to_have: null, preferred_industry: null, preferred_colleges: [], target_companies: [], perks_and_benefits: [], created_at: "2026-08-01T10:00:00Z", duration_weeks: null, hours_per_week: null },
    { id: "req_2", title: "PM", location: "Remote", notice_period_pref: "Any", status: "zero", stage: "ready_for_review", experience_min: null, experience_max: null, due_date: null, budget_min: null, budget_max: null, locations: [], open_positions: null, work_mode: null, employment_type: null, salary_type: null, preferred_domain: null, work_schedule: null, availability: null, relevant_experience: null, portfolio_required: false, custom_skill_sets: [], skills: [], responsibilities: null, nice_to_have: null, preferred_industry: null, preferred_colleges: [], target_companies: [], perks_and_benefits: [], created_at: "2026-08-02T10:00:00Z", duration_weeks: 12, hours_per_week: 20 },
  ];

  it("joins requirement rows with their match counts", () => {
    const counts = new Map([["req_1", 4]]);
    expect(buildRequirementsListResponse(rows, counts)).toEqual([
      { id: "req_1", title: "SDE II", location: "Bengaluru", noticePeriodPref: "30 days", status: "ready", stage: "ai_matching", experienceMin: 3, experienceMax: 6, dueDate: "2026-09-01", budgetMin: 18, budgetMax: 22, locations: ["Bengaluru"], openPositions: 2, workMode: "hybrid", employmentType: "full-time", salaryType: "per-annum", skills: ["React", "Node"], createdAt: "2026-08-01", candidateCount: 4, aiScreening: EMPTY_AI_SCREENING, durationWeeks: null, hoursPerWeek: null },
      { id: "req_2", title: "PM", location: "Remote", noticePeriodPref: "Any", status: "zero", stage: "ready_for_review", experienceMin: null, experienceMax: null, dueDate: null, budgetMin: null, budgetMax: null, locations: [], openPositions: null, workMode: null, employmentType: null, salaryType: null, skills: [], createdAt: "2026-08-02", candidateCount: 0, aiScreening: EMPTY_AI_SCREENING, durationWeeks: 12, hoursPerWeek: 20 },
    ]);
  });

  it("defaults candidateCount to 0 when the map is empty", () => {
    expect(buildRequirementsListResponse(rows, new Map())[0].candidateCount).toBe(0);
  });

  it("defaults aiScreening to the empty summary when no match summaries are given", () => {
    expect(buildRequirementsListResponse(rows, new Map())[0].aiScreening).toEqual(EMPTY_AI_SCREENING);
  });

  it("uses the given aiScreening summary for a requirement when present", () => {
    const summary = { evaluated: 5, scoreLow: 42, scoreHigh: 88, topMatches: 2, strongAvgScore: 80, strongMatchInitials: ["AK"], strongMatchExtra: 1, strongMatches: [{ id: "c1", name: "Aisha Khan", initials: "AK", yearsExperience: 4, skills: ["React"] }] };
    const result = buildRequirementsListResponse(rows, new Map(), new Map([["req_1", summary]]));
    expect(result[0].aiScreening).toEqual(summary);
    expect(result[1].aiScreening).toEqual(EMPTY_AI_SCREENING);
  });
});

describe("asBoundedExperience", () => {
  it("accepts a valid whole number within range", () => {
    expect(asBoundedExperience(5)).toBe(5);
    expect(asBoundedExperience(0)).toBe(0);
    expect(asBoundedExperience(40)).toBe(40);
  });

  it("rejects non-numbers", () => {
    expect(asBoundedExperience("5")).toBeNull();
    expect(asBoundedExperience(null)).toBeNull();
    expect(asBoundedExperience(undefined)).toBeNull();
  });

  it("rejects non-integer numbers", () => {
    expect(asBoundedExperience(2.5)).toBeNull();
  });

  it("rejects numbers out of the 0-40 range", () => {
    expect(asBoundedExperience(-1)).toBeNull();
    expect(asBoundedExperience(41)).toBeNull();
  });

  it("rejects non-finite numbers", () => {
    expect(asBoundedExperience(Infinity)).toBeNull();
    expect(asBoundedExperience(NaN)).toBeNull();
  });
});

describe("asBoundedBudget", () => {
  it("accepts a valid whole number within range", () => {
    expect(asBoundedBudget(18)).toBe(18);
    expect(asBoundedBudget(0)).toBe(0);
    expect(asBoundedBudget(1000)).toBe(1000);
  });

  it("rejects non-numbers", () => {
    expect(asBoundedBudget("18")).toBeNull();
    expect(asBoundedBudget(null)).toBeNull();
    expect(asBoundedBudget(undefined)).toBeNull();
  });

  it("rejects non-integer numbers", () => {
    expect(asBoundedBudget(18.5)).toBeNull();
  });

  it("rejects numbers out of the 0-1000 range", () => {
    expect(asBoundedBudget(-1)).toBeNull();
    expect(asBoundedBudget(1001)).toBeNull();
  });

  it("rejects non-finite numbers", () => {
    expect(asBoundedBudget(Infinity)).toBeNull();
    expect(asBoundedBudget(NaN)).toBeNull();
  });
});

describe("asBoundedDueDate", () => {
  it("accepts a strict YYYY-MM-DD date string", () => {
    expect(asBoundedDueDate("2026-09-01")).toBe("2026-09-01");
  });

  it("rejects non-string input", () => {
    expect(asBoundedDueDate(123)).toBeNull();
    expect(asBoundedDueDate(null)).toBeNull();
    expect(asBoundedDueDate(undefined)).toBeNull();
  });

  it("rejects malformed date strings", () => {
    expect(asBoundedDueDate("09/01/2026")).toBeNull();
    expect(asBoundedDueDate("2026-9-1")).toBeNull();
    expect(asBoundedDueDate("not-a-date")).toBeNull();
  });

  it("rejects a syntactically valid but impossible calendar date", () => {
    expect(asBoundedDueDate("2026-13-40")).toBeNull();
  });
});

describe("countMatchesByRequirement", () => {
  it("tallies matches per requirement id", () => {
    const counts = countMatchesByRequirement([
      { requirement_id: "req_1" },
      { requirement_id: "req_1" },
      { requirement_id: "req_2" },
    ]);
    expect(counts.get("req_1")).toBe(2);
    expect(counts.get("req_2")).toBe(1);
  });

  it("returns an empty map for no rows", () => {
    expect(countMatchesByRequirement([]).size).toBe(0);
  });
});

describe("computeMatchStats", () => {
  it("computes evaluated count, score range, and strong-match stats per requirement", () => {
    const stats = computeMatchStats(
      [
        { requirement_id: "req_1", candidate_user_id: "c1", match_score: 90 },
        { requirement_id: "req_1", candidate_user_id: "c2", match_score: 74 },
        { requirement_id: "req_1", candidate_user_id: "c3", match_score: 40 },
      ],
      60,
    );
    const s = stats.get("req_1")!;
    expect(s.evaluated).toBe(3);
    expect(s.scoreLow).toBe(40);
    expect(s.scoreHigh).toBe(90);
    expect(s.topMatches).toBe(2);
    expect(s.strongAvgScore).toBe(82);
    expect(s.topCandidateIds).toEqual(["c1", "c2"]);
    expect(s.strongMatchExtra).toBe(0);
  });

  it("caps topCandidateIds at 2 and reports the rest as overflow", () => {
    const stats = computeMatchStats(
      [
        { requirement_id: "req_1", candidate_user_id: "c1", match_score: 95 },
        { requirement_id: "req_1", candidate_user_id: "c2", match_score: 90 },
        { requirement_id: "req_1", candidate_user_id: "c3", match_score: 85 },
        { requirement_id: "req_1", candidate_user_id: "c4", match_score: 80 },
      ],
      60,
    );
    const s = stats.get("req_1")!;
    expect(s.topCandidateIds).toEqual(["c1", "c2"]);
    expect(s.strongMatchExtra).toBe(2);
  });

  it("reports null strongAvgScore and zero topMatches when nothing clears the threshold", () => {
    const stats = computeMatchStats([{ requirement_id: "req_1", candidate_user_id: "c1", match_score: 30 }], 60);
    const s = stats.get("req_1")!;
    expect(s.topMatches).toBe(0);
    expect(s.strongAvgScore).toBeNull();
    expect(s.topCandidateIds).toEqual([]);
  });

  it("keeps separate stats per requirement", () => {
    const stats = computeMatchStats(
      [
        { requirement_id: "req_1", candidate_user_id: "c1", match_score: 90 },
        { requirement_id: "req_2", candidate_user_id: "c2", match_score: 50 },
      ],
      60,
    );
    expect(stats.get("req_1")!.evaluated).toBe(1);
    expect(stats.get("req_2")!.evaluated).toBe(1);
    expect(stats.get("req_2")!.topMatches).toBe(0);
  });

  it("returns an empty map for no rows", () => {
    expect(computeMatchStats([], 60).size).toBe(0);
  });
});

describe("nameInitials", () => {
  it("takes the first letter of the first two words", () => {
    expect(nameInitials("Aisha Khan")).toBe("AK");
  });

  it("uppercases lowercase input", () => {
    expect(nameInitials("aisha khan")).toBe("AK");
  });

  it("handles a single-word name", () => {
    expect(nameInitials("Aisha")).toBe("A");
  });

  it("returns ? for a blank or empty name", () => {
    expect(nameInitials("")).toBe("?");
    expect(nameInitials("   ")).toBe("?");
  });

  it("ignores extra words beyond the first two", () => {
    expect(nameInitials("Aisha Rani Khan")).toBe("AR");
  });
});

describe("buildAiScreeningByRequirement", () => {
  it("resolves top candidate ids into initials and detail using the details map", () => {
    const stats = new Map([
      ["req_1", { evaluated: 5, scoreLow: 40, scoreHigh: 90, topMatches: 2, strongAvgScore: 82, topCandidateIds: ["c1", "c2"], strongMatchExtra: 0 }],
    ]);
    const details = new Map([
      ["c1", { name: "Aisha Khan", yearsExperience: 4, skills: ["React"] }],
      ["c2", { name: "Rahul Sharma", yearsExperience: 6, skills: ["Node"] }],
    ]);
    const result = buildAiScreeningByRequirement(stats, details);
    expect(result.get("req_1")).toEqual({
      evaluated: 5, scoreLow: 40, scoreHigh: 90, topMatches: 2, strongAvgScore: 82,
      strongMatchInitials: ["AK", "RS"], strongMatchExtra: 0,
      strongMatches: [
        { id: "c1", name: "Aisha Khan", initials: "AK", yearsExperience: 4, skills: ["React"] },
        { id: "c2", name: "Rahul Sharma", initials: "RS", yearsExperience: 6, skills: ["Node"] },
      ],
    });
  });

  it("falls back to ? initials and blank detail for candidates missing from the details map", () => {
    const stats = new Map([
      ["req_1", { evaluated: 1, scoreLow: 70, scoreHigh: 70, topMatches: 1, strongAvgScore: 70, topCandidateIds: ["c1"], strongMatchExtra: 0 }],
    ]);
    const result = buildAiScreeningByRequirement(stats, new Map());
    expect(result.get("req_1")!.strongMatchInitials).toEqual(["?"]);
    expect(result.get("req_1")!.strongMatches).toEqual([{ id: "c1", name: "", initials: "?", yearsExperience: null, skills: [] }]);
  });
});

describe("averageScoresByUser", () => {
  it("averages multiple session scores per user", () => {
    const averages = averageScoresByUser([
      { user_id: "u1", score: 80 },
      { user_id: "u1", score: 60 },
      { user_id: "u2", score: 90 },
    ]);
    expect(averages.get("u1")).toBe(70);
    expect(averages.get("u2")).toBe(90);
  });

  it("omits users with no sessions rather than defaulting to zero", () => {
    const averages = averageScoresByUser([{ user_id: "u1", score: 80 }]);
    expect(averages.has("u2")).toBe(false);
  });
});

describe("daysSinceLastActive", () => {
  it("returns 999 for a candidate with no practice timestamps", () => {
    expect(daysSinceLastActive([], Date.now())).toBe(999);
  });

  it("computes whole days since the last timestamp", () => {
    const now = new Date("2026-08-15T00:00:00Z").getTime();
    const tenDaysAgo = new Date("2026-08-05T00:00:00Z").toISOString();
    expect(daysSinceLastActive([tenDaysAgo], now)).toBe(10);
  });

  it("clamps to 0 for a timestamp in the future", () => {
    const now = new Date("2026-08-15T00:00:00Z").getTime();
    const future = new Date("2026-08-20T00:00:00Z").toISOString();
    expect(daysSinceLastActive([future], now)).toBe(0);
  });
});
