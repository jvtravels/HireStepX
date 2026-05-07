/**
 * Data-recency CI guard.
 *
 * Imports CALIBRATION_DATE constants from each data file and asserts they
 * are not stale. Two thresholds:
 *   - WARN at >6 months: console.warn but pass (CI logs it)
 *   - FAIL at >12 months: test fails — forces an explicit refresh
 *
 * When this test fails the right action is to run a refresh sprint
 * (re-validate bands against AmbitionBox / Glassdoor / levels.fyi) and
 * bump the CALIBRATION_DATE constant. See:
 *   docs / "Salary Data Refresh — May 2026 Audit"
 *
 * Format: ISO YYYY-MM (no day component — months is the resolution we
 * track market data at).
 */
import { describe, it, expect } from "vitest";
import { CALIBRATION_DATE as SALARY_CAL_DATE } from "../../data/salaries";

const WARN_MONTHS = 6;
const FAIL_MONTHS = 12;

/** Returns whole months between an ISO YYYY-MM string and "now". */
function monthsSince(isoYearMonth: string, nowDate: Date = new Date()): number {
  const m = /^(\d{4})-(\d{2})$/.exec(isoYearMonth);
  if (!m) throw new Error(`Bad CALIBRATION_DATE format: ${isoYearMonth} (expected YYYY-MM)`);
  const calYear = parseInt(m[1], 10);
  const calMonth = parseInt(m[2], 10); // 1-12
  const nowYear = nowDate.getFullYear();
  const nowMonth = nowDate.getMonth() + 1; // getMonth() is 0-indexed
  return (nowYear - calYear) * 12 + (nowMonth - calMonth);
}

describe("data recency guard", () => {
  it("salaries.ts CALIBRATION_DATE is well-formed", () => {
    expect(SALARY_CAL_DATE).toMatch(/^\d{4}-\d{2}$/);
  });

  it("salaries.ts is not >12 months stale (FAIL threshold)", () => {
    const age = monthsSince(SALARY_CAL_DATE);
    if (age > FAIL_MONTHS) {
      throw new Error(
        `salaries.ts CALIBRATION_DATE is ${age} months stale (>${FAIL_MONTHS}). ` +
        `Run a refresh sprint: re-validate top 10 cells against ` +
        `levels.fyi / Glassdoor / AmbitionBox and bump CALIBRATION_DATE in data/salaries.ts.`
      );
    }
    expect(age).toBeLessThanOrEqual(FAIL_MONTHS);
  });

  it("salaries.ts WARNs if >6 months stale", () => {
    const age = monthsSince(SALARY_CAL_DATE);
    if (age > WARN_MONTHS) {
      // eslint-disable-next-line no-console
      console.warn(
        `[recency] salaries.ts CALIBRATION_DATE is ${age} months old. ` +
        `Schedule a refresh sprint within ${FAIL_MONTHS - age} months to avoid CI failure.`
      );
    }
    // Pass — this is informational only.
    expect(true).toBe(true);
  });
});
