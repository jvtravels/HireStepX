/* Unit tests for the analyzer tier-data freshness helper
 * (`_data-freshness.ts`). Distinct from `dataFreshness.test.ts`,
 * which covers per-company salary OVERRIDES — this file covers the
 * 4 analyzer-side constants (collegeTier patterns, companyTier
 * classifier, CGPA cutoffs, salary bands) the campus-placement
 * analyzer hard-codes.
 *
 * The values themselves (LAST_VERIFIED_AT dates) are reviewer-curated
 * and change every quarter — testing those would couple the suite to
 * calendar drift. What we DO test is the predicate behavior: a stamp
 * older than threshold reports as stale, a future-dated stamp clamps
 * to age 0, a malformed stamp reports as infinitely stale (the safe
 * default — surfaces a loud signal rather than hiding a broken date).
 */

import { describe, it, expect } from "vitest";
import {
  LAST_VERIFIED_AT,
  STALENESS_THRESHOLD_DAYS,
  getDataAgeDays,
  isStale,
  freshnessSnapshot,
} from "../../server-handlers/_data-freshness";

describe("LAST_VERIFIED_AT keys", () => {
  it("has all four expected data sources", () => {
    expect(LAST_VERIFIED_AT.collegeTier).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(LAST_VERIFIED_AT.companyTier).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(LAST_VERIFIED_AT.cgpaCutoffs).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(LAST_VERIFIED_AT.salaryBands).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("getDataAgeDays", () => {
  it("returns 0 when stamp matches injected now", () => {
    const stampDate = new Date(LAST_VERIFIED_AT.collegeTier + "T00:00:00.000Z");
    expect(getDataAgeDays("collegeTier", stampDate)).toBe(0);
  });

  it("returns positive integer days for past stamps", () => {
    const future = new Date(LAST_VERIFIED_AT.collegeTier + "T00:00:00.000Z");
    future.setDate(future.getDate() + 30);
    expect(getDataAgeDays("collegeTier", future)).toBeGreaterThanOrEqual(29);
    expect(getDataAgeDays("collegeTier", future)).toBeLessThanOrEqual(31);
  });

  it("clamps to 0 for future-dated stamps (clock skew safety)", () => {
    const past = new Date("2000-01-01");
    expect(getDataAgeDays("collegeTier", past)).toBe(0);
  });
});

describe("isStale", () => {
  it("returns false when age is well under threshold", () => {
    const fresh = new Date(LAST_VERIFIED_AT.collegeTier + "T00:00:00.000Z");
    fresh.setDate(fresh.getDate() + 10);
    expect(isStale("collegeTier", fresh)).toBe(false);
  });

  it("returns true when age exceeds threshold", () => {
    const stale = new Date(LAST_VERIFIED_AT.collegeTier + "T00:00:00.000Z");
    stale.setDate(stale.getDate() + STALENESS_THRESHOLD_DAYS + 5);
    expect(isStale("collegeTier", stale)).toBe(true);
  });

  it("returns false exactly at the threshold (strict >)", () => {
    const atThreshold = new Date(LAST_VERIFIED_AT.collegeTier + "T00:00:00.000Z");
    atThreshold.setDate(atThreshold.getDate() + STALENESS_THRESHOLD_DAYS);
    expect(isStale("collegeTier", atThreshold)).toBe(false);
  });
});

describe("freshnessSnapshot", () => {
  it("returns one row per data source with all fields populated", () => {
    const snap = freshnessSnapshot();
    expect(snap).toHaveLength(4);
    for (const row of snap) {
      expect(row.key).toBeTruthy();
      expect(row.verifiedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof row.ageDays).toBe("number");
      expect(typeof row.stale).toBe("boolean");
    }
  });

  it("all rows stale when now is far in the future", () => {
    const farFuture = new Date("2099-01-01");
    const snap = freshnessSnapshot(farFuture);
    for (const row of snap) {
      expect(row.stale).toBe(true);
    }
  });
});
