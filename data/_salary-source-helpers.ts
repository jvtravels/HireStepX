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

const CSV_PREFIX = "CSV research dataset";
function isCsvSource(source: string | undefined): boolean {
  return source?.startsWith(CSV_PREFIX) ?? false;
}

/** User-facing label for a salary band's provenance. Curator sources
 *  ("Curated research 2026-05-08 — Glassdoor + AmbitionBox aggregation")
 *  are already written for readers and pass through unchanged. Seed and
 *  CSV sources embed internal shorthand for auditing (company/role
 *  slugs, tier multipliers like "1.05x", "n=NNN") that isn't meant for
 *  a candidate reading a FAQ answer — collapse those to a plain
 *  human sentence keyed off the same confidence tier the LLM
 *  negotiation prompt already uses, so the visible label and the
 *  underlying confidence never contradict each other. */
export function humanizeSalarySource(
  source: string | undefined,
  tier: "high" | "medium" | "low" | undefined,
): string {
  if (isSeedSource(source) || isCsvSource(source)) {
    if (tier === "low") return "Directional estimate derived from market benchmarks, confirm with a recruiter";
    return "Aggregated compensation research (AmbitionBox, Glassdoor)";
  }
  return source ?? "HireStepX compensation research";
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
/** Anything past entry, used by tier-aware "AB undercounts seniors" rules. */
export const NON_ENTRY_LEVELS: ReadonlySet<ExperienceLevel> = new Set([
  "mid", "senior", "lead", "executive",
]);

/** Indian-unicorn companies whose seed-multiplier cells were proven
 *  3×-off in dense AB pass-2 cohorts. Subset of
 *  PREFER_IMPORTED_OVER_SEED_COMPANIES — kept separate because the
 *  unicorn cohort gets a looser n-floor (50 vs 150) for PM/BA roles
 *  given AB's denser title cohorts there. */
export const UNICORN_SEED_FLIP_COMPANIES: ReadonlySet<string> = new Set([
  "paytm",
  "zomato",
  "meesho",
]);

/** Companies whose curator entries are proven inflated by 2-3× and where
 *  even fresh AB scrape (n>=50) is preferable. Used by both runtime and
 *  the audit; kept here so the prefer-list lives in one place. */
export const PREFER_IMPORTED_REGARDLESS_COMPANIES: ReadonlySet<string> = new Set([
  "zoho",
]);

/** Companies whose curator entries either (a) have seed-multiplier guesses
 *  for some cells, or (b) are unambiguously AmbitionBox-derived (no
 *  research blend). For these, runtime prefers a fresh AB scrape provided
 *  the sample size clears the role/level-tiered n-floor — see
 *  shouldFlipToImported() for the threshold logic. */
export const PREFER_IMPORTED_OVER_SEED_COMPANIES: ReadonlySet<string> = new Set([
  "tcs", "infosys", "wipro", "cognizant", "accenture", "hcl", "hcl technologies",
  "tech mahindra", "ltimindtree", "capgemini", "ibm india", "ibm",
  "hdfc bank", "icici", "axis", "sbi", "kotak", "idfc",
  "paytm", "zomato", "meesho",
]);

/** Should the runtime displace this curator cell with a fresh AmbitionBox
 *  scrape? Single predicate so audit and runtime stay in lockstep. */
export function shouldFlipToImported(opts: {
  curatorSource: string | undefined;
  scrapedNotes: string | undefined;
  company: string;
  role: string;
  level: ExperienceLevel;
}): boolean {
  if (PREFER_IMPORTED_REGARDLESS_COMPANIES.has(opts.company)) {
    return extractSampleSize(opts.scrapedNotes) >= 50;
  }
  if (!PREFER_IMPORTED_OVER_SEED_COMPANIES.has(opts.company)) return false;
  const curatorIsSeed = isSeedSource(opts.curatorSource);
  const curatorIsAbOnly = isAbOnlyCuratorSource(opts.curatorSource);
  if (!curatorIsSeed && !curatorIsAbOnly) return false;
  const n = extractSampleSize(opts.scrapedNotes);
  const isPass2 = isPass2YoeBucket(opts.scrapedNotes);
  if (curatorIsAbOnly && !curatorIsSeed && !isPass2) return false;
  const isEng = ENGINEERING_TRACK_ROLES.has(opts.role);
  const isItNonEng = IT_NON_ENG_ROLES.has(opts.role);
  const isItNonEngLeadExec =
    isItNonEng && LEAD_EXEC_LEVELS.has(opts.level) && curatorIsSeed;
  const isItEngLead =
    isEng && opts.level === "lead" && curatorIsSeed;
  const isUnicornPmBaSeed =
    (opts.role === "product-manager" || opts.role === "business-analyst") &&
    (opts.level === "entry" || MID_OR_SENIOR_LEVELS.has(opts.level)) &&
    curatorIsSeed &&
    UNICORN_SEED_FLIP_COMPANIES.has(opts.company);
  const isEngJuniorOrMidSenior =
    isEng && (JUNIOR_LEVELS.has(opts.level) || MID_OR_SENIOR_LEVELS.has(opts.level));
  const looseThresholdEligible =
    (isPass2 && (isEngJuniorOrMidSenior || isItNonEngLeadExec || isItEngLead)) ||
    isUnicornPmBaSeed;
  const threshold = !looseThresholdEligible ? 1000
    : isUnicornPmBaSeed ? 50
    : isItNonEngLeadExec ? 100
    : 150;
  return n >= threshold;
}

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
