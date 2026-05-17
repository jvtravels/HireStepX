/* Data-freshness metadata for the campus-placement analyzer.
 *
 * The college-tier list, company-tier classifier, CGPA cutoffs and
 * salary bands are all hardcoded constants. They go stale: a college
 * climbs NIRF, a company changes its fresher band, a tier becomes
 * obsolete. Without a `last-verified-at` stamp, no-one knows when
 * any of them was last reviewed — Wave-9 audit identified this as
 * the highest data-staleness risk in the surface.
 *
 * This module is the single source of truth for "when was this band
 * last reviewed against real Indian recruiter data?". The analyzer
 * exposes the values in its rubric so the candidate-facing report
 * (and the admin dashboard) can render a "verified MMM YYYY" hint
 * and the cron can emit a `tier_data_stale` PostHog event when the
 * age crosses STALENESS_THRESHOLD_DAYS.
 *
 * Update protocol when reviewing tier data:
 *   1. Read the linked source (NIRF rankings, recruiter salary
 *      reports, current placement-cell data).
 *   2. Update the constant.
 *   3. Bump the matching LAST_VERIFIED_AT below to today's ISO date.
 *
 * Pure — no DB, no fetch. Unit-tested in `dataFreshness.test.ts`.
 */

/* When each data source was last reviewed against ground truth.
 * ISO 8601 date strings (YYYY-MM-DD). Update the date on the same
 * commit that updates the underlying constants — the date IS the
 * audit trail. A stale date with up-to-date data is worse than the
 * other way around because it triggers a spurious staleness event.
 *
 * Initial dates: backdated to the audit that established them
 * (Wave-9, May 2026). Reviewer should refresh each on next pass. */
export const LAST_VERIFIED_AT = {
  /* College tier patterns in `_college-tier.ts` — IIT/NIT/BITS lists
   * derived from NIRF Engineering 2024-25. Re-verify against NIRF 2026
   * release in Aug-Sep. */
  collegeTier: "2026-05-01",

  /* Company tier classifier in `_company-tier.ts` — buckets companies
   * into product-global / product-india / service. Re-verify when a
   * major IT-services or product company changes its fresher pipeline. */
  companyTier: "2026-05-01",

  /* CGPA cutoffs in `analyzers/campus-placement.ts` (~line 441) —
   * 6.5 (service) / 7.0 (product-india) / 7.5 (product-global). Re-verify
   * against current placement-cell guidance each placement season. */
  cgpaCutoffs: "2026-05-01",

  /* Salary bands in `analyzers/campus-placement.ts` (~line 676 + line 1286) —
   * service ₹3.5-4.5L, product-india ₹6-15L, product-global ₹15-30L.
   * These move fastest of all four — re-verify quarterly. */
  salaryBands: "2026-05-01",
} as const;

export type FreshnessKey = keyof typeof LAST_VERIFIED_AT;

/* Anything older than 90 days is "stale" — surfaces a warning in the
 * admin dashboard + emits a PostHog `tier_data_stale` event from the
 * analyzer cron. 90 days picked because Indian placement seasons run
 * Aug-Feb and salary bands shift quarterly; a stamp older than that
 * means the data has missed a major refresh window. */
export const STALENESS_THRESHOLD_DAYS = 90;

/* Age in days of a freshness stamp, measured from `now` (defaults to
 * current wall clock — injectable for tests). Returns a non-negative
 * integer; a future-dated stamp clamps to 0. */
export function getDataAgeDays(key: FreshnessKey, now: Date = new Date()): number {
  const stamp = LAST_VERIFIED_AT[key];
  const stampMs = Date.parse(stamp);
  if (Number.isNaN(stampMs)) return Number.POSITIVE_INFINITY;
  const ageMs = now.getTime() - stampMs;
  return Math.max(0, Math.floor(ageMs / 86_400_000));
}

/* True when the stamp is older than STALENESS_THRESHOLD_DAYS — the
 * single predicate the cron checks before firing `tier_data_stale`. */
export function isStale(key: FreshnessKey, now: Date = new Date()): boolean {
  return getDataAgeDays(key, now) > STALENESS_THRESHOLD_DAYS;
}

/* Snapshot for telemetry / admin: all freshness keys with their age
 * and staleness flag in one call. Drives the dispute-aggregation
 * endpoint and any future "data health" panel. */
export function freshnessSnapshot(now: Date = new Date()): Array<{
  key: FreshnessKey;
  verifiedOn: string;
  ageDays: number;
  stale: boolean;
}> {
  return (Object.keys(LAST_VERIFIED_AT) as FreshnessKey[]).map((key) => ({
    key,
    verifiedOn: LAST_VERIFIED_AT[key],
    ageDays: getDataAgeDays(key, now),
    stale: isStale(key, now),
  }));
}
