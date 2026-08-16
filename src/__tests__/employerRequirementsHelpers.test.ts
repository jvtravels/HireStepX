import { describe, it, expect } from "vitest";
import {
  asBoundedString,
  asBoundedExperience,
  asBoundedDueDate,
  asBoundedBudget,
  isValidRequirementInput,
  buildRequirementsListResponse,
  countMatchesByRequirement,
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
  it("accepts a real title and location", () => {
    expect(isValidRequirementInput("SDE II", "Bengaluru")).toBe(true);
  });

  it("rejects a one-character title", () => {
    expect(isValidRequirementInput("S", "Bengaluru")).toBe(false);
  });

  it("rejects an empty location", () => {
    expect(isValidRequirementInput("SDE II", "")).toBe(false);
  });
});

describe("buildRequirementsListResponse", () => {
  const rows = [
    { id: "req_1", title: "SDE II", location: "Bengaluru", notice_period_pref: "30 days", status: "ready", experience_min: 3, experience_max: 6, due_date: "2026-09-01", budget_min: 18, budget_max: 22, created_at: "2026-08-01T10:00:00Z" },
    { id: "req_2", title: "PM", location: "Remote", notice_period_pref: "Any", status: "zero", experience_min: null, experience_max: null, due_date: null, budget_min: null, budget_max: null, created_at: "2026-08-02T10:00:00Z" },
  ];

  it("joins requirement rows with their match counts", () => {
    const counts = new Map([["req_1", 4]]);
    expect(buildRequirementsListResponse(rows, counts)).toEqual([
      { id: "req_1", title: "SDE II", location: "Bengaluru", noticePeriodPref: "30 days", status: "ready", experienceMin: 3, experienceMax: 6, dueDate: "2026-09-01", budgetMin: 18, budgetMax: 22, createdAt: "2026-08-01", candidateCount: 4 },
      { id: "req_2", title: "PM", location: "Remote", noticePeriodPref: "Any", status: "zero", experienceMin: null, experienceMax: null, dueDate: null, budgetMin: null, budgetMax: null, createdAt: "2026-08-02", candidateCount: 0 },
    ]);
  });

  it("defaults candidateCount to 0 when the map is empty", () => {
    expect(buildRequirementsListResponse(rows, new Map())[0].candidateCount).toBe(0);
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
