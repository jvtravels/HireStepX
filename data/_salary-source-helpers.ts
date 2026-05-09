/**
 * Shared predicates and constants used by both the runtime
 * (data/company-salary-overrides.ts → maybePreferImportedOverSeed)
 * and the audit (scripts/audit-imported-vs-curator.mts → classifyDrift).
 *
 * Both sites make the same call: should AB scrape displace the curator
 * cell, given the source provenance and sample density? Centralizing the
 * source-classification + level-membership predicates ensures audit
 * recommendations match runtime behavior exactly.
 */
import type { ExperienceLevel } from "./salaries";

/** AB sample size embedded in scrape notes ("n=NNN"). 0 if absent. */
const N_RE = /n=(\d+)/;
export function extractSampleSize(notes: string | undefined): number {
  const m = notes?.match(N_RE);
  return m ? Number(m[1]) : 0;
}

const SEED_PREFIX = "Seed dataset";
export function isSeedSource(source: string | undefined): boolean {
  return source?.startsWith(SEED_PREFIX) ?? false;
}

const AB_PREFIX_RE = /^AmbitionBox/i;
const AB_BLEND_RE = /Levels\.fyi|DRHP|disclosure|verified/i;
/** Curator source is plain AmbitionBox with no Levels.fyi / DRHP /
 *  disclosure cross-source — i.e. AB-only, not AB-blended-with-research. */
export function isAbOnlyCuratorSource(source: string | undefined): boolean {
  if (!source) return false;
  return AB_PREFIX_RE.test(source) && !AB_BLEND_RE.test(source);
}

/** Imported scrape used the per-designation pass-2 yoe-bucket walker
 *  rather than the pass-1 single-cell collapse. Pass-2 is strictly
 *  finer-grained — same data source, narrower YOE window. */
export function isPass2YoeBucket(notes: string | undefined): boolean {
  return notes?.includes("yoe-bucket") ?? false;
}

/** Curator source includes an independently-sourced research signal
 *  (Levels.fyi / Glassdoor / curated worksheet / disclosure / DRHP /
 *  Indeed / Weekday / NLTH). Used to short-circuit "trust curator" at
 *  any level — these aren't derivable from AB so AB drift is noise. */
const RESEARCH_SOURCED_RE = /levels\.fyi|glassdoor|curated research|indeed|weekday|nlth|jpmc india analyst|drhp|disclosure|verified|p\d+ ₹/i;
export function isResearchSourced(source: string | undefined): boolean {
  if (!source) return false;
  return RESEARCH_SOURCED_RE.test(source);
}

/** Roles in the IT-services PM/QA/BA bucket. AB title-cohorts at
 *  lead/exec ("Project Manager 9-12y") are dense for these but
 *  curator's seed-multiplier is unreliable. */
export const IT_NON_ENG_ROLES: ReadonlySet<string> = new Set([
  "product-manager",
  "project-manager",
  "business-analyst",
  "qa-engineer",
]);

/** Engineering-track roles where AB pass-2 yoe-bucket cohorts
 *  match real fresher/junior comp; gets the looser n-floor. */
export const ENGINEERING_TRACK_ROLES: ReadonlySet<string> = new Set([
  "software-engineer",
  "qa-engineer",
  "data-engineer",
  "devops-engineer",
]);

export const JUNIOR_LEVELS: ReadonlySet<ExperienceLevel> = new Set(["entry", "mid"]);
export const LEAD_EXEC_LEVELS: ReadonlySet<ExperienceLevel> = new Set(["lead", "executive"]);
export const MID_OR_SENIOR_LEVELS: ReadonlySet<ExperienceLevel> = new Set(["mid", "senior"]);
/** Anything past entry — used by tier-aware "AB undercounts seniors" rules. */
export const NON_ENTRY_LEVELS: ReadonlySet<ExperienceLevel> = new Set([
  "mid", "senior", "lead", "executive",
]);

/** Indian-unicorn companies whose seed-multiplier cells were proven
 *  3×-off in dense AB pass-2 cohorts. Mirrored in
 *  PREFER_IMPORTED_OVER_SEED_COMPANIES at runtime; the audit references
 *  this so its recommendations match the runtime flip. */
export const UNICORN_SEED_FLIP_COMPANIES: ReadonlySet<string> = new Set([
  "paytm",
  "zomato",
  "meesho",
]);

/** YOE-bucket in scrape notes that's wildly mismatched with the cell's
 *  level — e.g. "12+y" bucket for an entry-level cell, or "0-1y" for
 *  executive. Indicates the scraper picked a junior/senior-titled
 *  designation that's not actually the right cohort. */
const HIGH_YOE_NOTE_RE = /9-12y|12\+y|6-9y/;
const LOW_YOE_NOTE_RE = /0-1y|1-3y/;
export function isMisbinnedScrape(
  notes: string | undefined,
  level: ExperienceLevel,
): boolean {
  if (!notes) return false;
  if (level === "entry" && HIGH_YOE_NOTE_RE.test(notes)) return true;
  if (LEAD_EXEC_LEVELS.has(level) && LOW_YOE_NOTE_RE.test(notes)) return true;
  return false;
}
