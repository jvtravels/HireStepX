import { describe, it, expect } from "vitest";
import { displaySessionCount, MIN_PUBLIC_SESSION_COUNT } from "../../server-handlers/_platform-stats-helpers";

describe("displaySessionCount", () => {
  it("hides small real counts instead of flooring them up", () => {
    expect(displaySessionCount(0)).toBeNull();
    expect(displaySessionCount(3)).toBeNull();
    expect(displaySessionCount(MIN_PUBLIC_SESSION_COUNT - 1)).toBeNull();
  });
  it("floors to the nearest 10 once past the threshold", () => {
    expect(displaySessionCount(100)).toBe(100);
    expect(displaySessionCount(1234)).toBe(1230);
  });
  it("rejects non-finite input", () => {
    expect(displaySessionCount(NaN)).toBeNull();
  });
});

import { displayCount, parseRawCounts, toPublicStats } from "../../server-handlers/_platform-stats-helpers";

describe("toPublicStats", () => {
  it("floors each stat against its own display bar", () => {
    expect(toPublicStats({ users: 131, sessions: 192, companies: 2, jobs: 8 })).toEqual({
      userCount: 130, sessionCount: 190, companyCount: null, jobCount: null,
    });
    expect(toPublicStats({ users: 1234, sessions: 5678, companies: 47, jobs: 312 })).toEqual({
      userCount: 1230, sessionCount: 5670, companyCount: 40, jobCount: 310,
    });
  });
  it("displayCount never inflates and rejects bad input", () => {
    expect(displayCount(9, 10)).toBeNull();
    expect(displayCount(10, 10)).toBe(10);
    expect(displayCount(NaN, 10)).toBeNull();
  });
});

describe("parseRawCounts", () => {
  it("round-trips valid JSON and rejects anything malformed", () => {
    const raw = { users: 1, sessions: 2, companies: 3, jobs: 4 };
    expect(parseRawCounts(JSON.stringify(raw))).toEqual(raw);
    expect(parseRawCounts(null)).toBeNull();
    expect(parseRawCounts("131")).toBeNull();
    expect(parseRawCounts("not json")).toBeNull();
    expect(parseRawCounts(JSON.stringify({ users: 1 }))).toBeNull();
  });
});
