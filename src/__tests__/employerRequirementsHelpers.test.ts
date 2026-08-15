import { describe, it, expect } from "vitest";
import {
  asBoundedString,
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
    { id: "req_1", title: "SDE II", location: "Bengaluru", notice_period_pref: "30 days", status: "ready", created_at: "2026-08-01T10:00:00Z" },
    { id: "req_2", title: "PM", location: "Remote", notice_period_pref: "Any", status: "zero", created_at: "2026-08-02T10:00:00Z" },
  ];

  it("joins requirement rows with their match counts", () => {
    const counts = new Map([["req_1", 4]]);
    expect(buildRequirementsListResponse(rows, counts)).toEqual([
      { id: "req_1", title: "SDE II", location: "Bengaluru", noticePeriodPref: "30 days", status: "ready", createdAt: "2026-08-01", candidateCount: 4 },
      { id: "req_2", title: "PM", location: "Remote", noticePeriodPref: "Any", status: "zero", createdAt: "2026-08-02", candidateCount: 0 },
    ]);
  });

  it("defaults candidateCount to 0 when the map is empty", () => {
    expect(buildRequirementsListResponse(rows, new Map())[0].candidateCount).toBe(0);
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
