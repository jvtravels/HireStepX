/**
 * Pure aggregation for the "Indian Startup Engineer Salary Report 2026"
 * hub page (/salary-report-2026). Rolls the per-company software-engineer
 * bands in COMPANY_SALARY_OVERRIDES into a single citable dataset:
 * per-company entry/mid/senior rows + headline median statistics.
 *
 * Kept pure (no imports of the big data maps) so it's unit-testable and
 * so the aggregation logic can't silently drift from what the page shows.
 * The route file injects the real overrides map + label fn.
 */

import type { CompanyBandOverride } from "./company-salary-overrides";
import type { ExperienceLevel } from "./salaries";

/** Minimal shape the report needs from a salary SEO entry. */
export interface ReportPageRef {
  slug: string;
}

/** Nested overrides map: slug → role → level → band. Mirrors the public
 *  type of COMPANY_SALARY_OVERRIDES without re-importing the whole file. */
export type OverridesMap = Record<
  string,
  | Partial<Record<string, Partial<Record<ExperienceLevel, CompanyBandOverride>>>>
  | undefined
>;

export interface ReportRow {
  slug: string;
  label: string;
  entryMin?: number;
  entryMax?: number;
  midMin?: number;
  midMax?: number;
  seniorMin?: number;
  seniorMax?: number;
  equityType?: CompanyBandOverride["equityType"];
  lastVerified?: string;
  /** Emerging / new-economy company nobody else has comp data on — the
   *  newsworthy slice this report leads with. */
  emerging: boolean;
}

export interface BandMedian {
  min: number;
  max: number;
}

export interface ReportStats {
  companyCount: number;
  entryMedian: BandMedian | null;
  midMedian: BandMedian | null;
  seniorMedian: BandMedian | null;
  topPayer: { label: string; slug: string; seniorMax: number } | null;
  emergingCount: number;
  /** Most recent lastVerified across all cited bands (ISO date string). */
  lastVerified: string | null;
}

export interface SalaryReport {
  rows: ReportRow[];
  stats: ReportStats;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function bandMedian(mins: number[], maxes: number[]): BandMedian | null {
  const lo = median(mins);
  const hi = median(maxes);
  if (lo === null || hi === null) return null;
  return { min: Math.round(lo), max: Math.round(hi) };
}

/** Look up a company's override, tolerating the "kebab vs spaced" key
 *  mismatch the same way the /salary hub route does. */
function lookup(overrides: OverridesMap, slug: string) {
  return overrides[slug] ?? overrides[slug.replace(/-/g, " ")];
}

/**
 * Build the report dataset from the salary SEO page list + overrides map.
 *
 * @param labelOf    slug → display label (injected: data/salary-seo.salaryCompanyLabel)
 * @param emerging   slugs to flag as emerging/new-economy companies
 */
export function buildSalaryReport(
  pages: ReportPageRef[],
  overrides: OverridesMap,
  labelOf: (slug: string) => string,
  emerging: ReadonlySet<string>,
): SalaryReport {
  const rows: ReportRow[] = [];

  for (const page of pages) {
    const swe = lookup(overrides, page.slug)?.["software-engineer"];
    if (!swe) continue;
    const entry = swe.entry;
    const mid = swe.mid;
    const senior = swe.senior;
    // A row needs at least one usable band to be worth listing.
    if (!entry && !mid && !senior) continue;

    const verifiedDates = [entry, mid, senior]
      .map((b) => b?.lastVerified)
      .filter((d): d is string => Boolean(d));

    rows.push({
      slug: page.slug,
      label: labelOf(page.slug),
      entryMin: entry?.totalMin,
      entryMax: entry?.totalMax,
      midMin: mid?.totalMin,
      midMax: mid?.totalMax,
      seniorMin: senior?.totalMin,
      seniorMax: senior?.totalMax,
      equityType: [entry, mid, senior].find((b) => b?.equityType)?.equityType,
      lastVerified: verifiedDates.sort().at(-1),
      emerging: emerging.has(page.slug),
    });
  }

  const entryMedian = bandMedian(
    rows.map((r) => r.entryMin).filter((n): n is number => n != null),
    rows.map((r) => r.entryMax).filter((n): n is number => n != null),
  );
  const midMedian = bandMedian(
    rows.map((r) => r.midMin).filter((n): n is number => n != null),
    rows.map((r) => r.midMax).filter((n): n is number => n != null),
  );
  const seniorMedian = bandMedian(
    rows.map((r) => r.seniorMin).filter((n): n is number => n != null),
    rows.map((r) => r.seniorMax).filter((n): n is number => n != null),
  );

  let topPayer: ReportStats["topPayer"] = null;
  for (const r of rows) {
    if (r.seniorMax == null) continue;
    if (!topPayer || r.seniorMax > topPayer.seniorMax) {
      topPayer = { label: r.label, slug: r.slug, seniorMax: r.seniorMax };
    }
  }

  const allVerified = rows
    .map((r) => r.lastVerified)
    .filter((d): d is string => Boolean(d))
    .sort();

  return {
    rows,
    stats: {
      companyCount: rows.length,
      entryMedian,
      midMedian,
      seniorMedian,
      topPayer,
      emergingCount: rows.filter((r) => r.emerging).length,
      lastVerified: allVerified.at(-1) ?? null,
    },
  };
}

/** Emerging / new-economy companies this report leads with — AI-native
 *  startups + recent unicorns where public comp data barely exists. These
 *  are the entities HireStepX has unique salary + interview-process depth
 *  on (the digital-PR angle: "cite our data, no one else has it"). */
export const EMERGING_COMPANY_SLUGS: ReadonlySet<string> = new Set([
  "sarvam",
  "sarvam-ai",
  "krutrim",
  "perplexity",
  "moglix",
  "fibe",
  "navi",
  "shadowfax",
  "kreditbee",
  "clevertap",
  "khatabook",
  "policybazaar",
  "purplle",
  "plivo",
  "boat",
  "wakefit",
  "zepto",
  "databricks",
]);
