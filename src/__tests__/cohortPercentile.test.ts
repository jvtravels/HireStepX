import { describe, it, expect } from "vitest";
import { bucketPercentile, type LiveCohort } from "../roleBenchmarks";

const baseCohort: LiveCohort = {
  byName: {
    Communication: { avg: 65, n: 100, p50: 65, p75: 78, p90: 88 },
    Structure: { avg: 60, n: 50, p50: 60, p75: 75, p90: 85 },
    Sparse: { avg: 50, n: 3, p50: 50, p75: 60, p90: 70 }, // below minSample
    Legacy: { avg: 55, n: 100 }, // no percentiles (older payload)
  },
  totalSessions: 200,
  lastUpdated: new Date().toISOString(),
};

describe("bucketPercentile", () => {
  it("returns Top 10% when user beats p90", () => {
    expect(bucketPercentile(baseCohort, "Communication", 90)).toBe("Top 10%");
    expect(bucketPercentile(baseCohort, "Communication", 95)).toBe("Top 10%");
  });

  it("returns Top 25% when user beats p75 but not p90", () => {
    expect(bucketPercentile(baseCohort, "Communication", 80)).toBe("Top 25%");
  });

  it("returns Top 50% when user beats p50 but not p75", () => {
    expect(bucketPercentile(baseCohort, "Communication", 70)).toBe("Top 50%");
  });

  it("returns null when user is at or below the median", () => {
    expect(bucketPercentile(baseCohort, "Communication", 60)).toBeNull();
    expect(bucketPercentile(baseCohort, "Communication", 50)).toBeNull();
  });

  it("returns null when the cohort sample is below the minSample threshold", () => {
    expect(bucketPercentile(baseCohort, "Sparse", 99)).toBeNull();
  });

  it("returns null when the live cohort lacks percentile data (older payload)", () => {
    expect(bucketPercentile(baseCohort, "Legacy", 99)).toBeNull();
  });

  it("returns null when the skill isn't in the cohort", () => {
    expect(bucketPercentile(baseCohort, "Unknown Skill", 90)).toBeNull();
  });

  it("returns null when the live cohort itself is null", () => {
    expect(bucketPercentile(null, "Communication", 90)).toBeNull();
  });

  it("respects a custom minSample threshold", () => {
    /* Sparse cohort has n=3; bumping threshold up from 25 to 200 also
       knocks out Communication at n=100. */
    expect(bucketPercentile(baseCohort, "Communication", 95, 200)).toBeNull();
  });

  /* Edge case: user exactly at p90 should land in Top 10% (>= compare). */
  it("places user exactly at p90 into Top 10%", () => {
    expect(bucketPercentile(baseCohort, "Communication", 88)).toBe("Top 10%");
  });
});
