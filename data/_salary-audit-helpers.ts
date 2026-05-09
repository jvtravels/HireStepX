/**
 * Audit-side classification of curator-vs-imported drift cells. Lives
 * in /data so the audit script (.mts), the runtime, and unit tests can
 * all import from the same module — keeping audit recommendations and
 * runtime flip behavior in lockstep (see _salary-source-helpers.ts).
 */
import type { ExperienceLevel } from "./salaries";
import { getCompanyTier } from "./company-tiers";
import {
  IT_NON_ENG_ROLES,
  LEAD_EXEC_LEVELS,
  MID_OR_SENIOR_LEVELS,
  NON_ENTRY_LEVELS,
  extractSampleSize,
  isAbOnlyCuratorSource,
  isMisbinnedScrape,
  isPass2YoeBucket,
  isResearchSourced,
  isSeedSource,
} from "./_salary-source-helpers";

const RESEARCH_VERIFIED_RE = /verified|disclosure|drhp|glassdoor.+ambitionbox/i;
const LEVELS_FYI_RE = /levels\.fyi/i;
const UNICORN_BLENDED_RE = /levels\.fyi|glassdoor|curated research/i;

export type Recommendation = "keep-curator" | "accept-ab" | "manual-review";

export interface DriftInput {
  company: string;
  role: string;
  level: ExperienceLevel;
  curatorSource: string | undefined;
  scrapedNotes: string | undefined;
}

/**
 * Heuristics distilled across audit rounds. Predicates are shared with
 * the runtime override (_salary-source-helpers.ts) so audit
 * recommendations match what runtime actually does:
 *   - Levels.fyi / Glassdoor / DRHP / disclosure / curated-research
 *     curator entries are independently sourced — trust them at any
 *     level (AB drift is noise, not signal).
 *   - "Seed dataset" curator entries are tier × multiplier guesses.
 *     When pass-2 AB has a dense yoe-bucket sample, scrape wins; the
 *     n-floor varies by tier/role to mirror runtime's threshold.
 *   - Mis-binned scrapes (junior YOE bucket on a senior cell, etc.) are
 *     keep-curator regardless of source.
 */
export function classifyDrift(d: DriftInput): { rec: Recommendation; why: string } {
  const src = d.curatorSource;
  const notes = d.scrapedNotes;
  const lvl = d.level;
  const isPass2 = isPass2YoeBucket(notes);
  const isSeed = isSeedSource(src);
  const isLevelsFyi = src ? LEVELS_FYI_RE.test(src) : false;
  const isResearchVerified = src ? RESEARCH_VERIFIED_RE.test(src) : false;
  const curatorIsAbOnly = isAbOnlyCuratorSource(src);
  const n = extractSampleSize(notes);
  const tier = getCompanyTier(d.company);
  const isItNonEngRole = IT_NON_ENG_ROLES.has(d.role);

  if (isLevelsFyi && (lvl === "senior" || LEAD_EXEC_LEVELS.has(lvl))) {
    return { rec: "keep-curator", why: "Levels.fyi-verified senior comp; AB sample sparse at this level." };
  }
  if (isSeed && isPass2 && tier === "it-services" && (lvl === "entry" || lvl === "mid")) {
    return { rec: "accept-ab", why: "IT-services seed-multiplier vs pass-2 yoe-bucket AB; AB has dense entry/mid sample." };
  }
  if (
    isSeed && isPass2 &&
    (
      (tier === "it-services" && lvl === "senior") ||
      ((tier === "bfsi-domestic" || tier === "saas-product" || tier === "edtech") &&
        (lvl === "entry" || lvl === "mid" || lvl === "senior" || lvl === "lead")) ||
      (tier === "indian-unicorn" &&
        (lvl === "entry" || MID_OR_SENIOR_LEVELS.has(lvl)) &&
        n >= 50)
    )
  ) {
    return { rec: "accept-ab", why: `${tier} seed-multiplier vs pass-2 yoe-bucket AB; AB has dense ${lvl} sample.` };
  }
  if (isResearchVerified) {
    return { rec: "keep-curator", why: "Research-verified curator source (DRHP / official disclosure / cross-source)." };
  }
  if (isResearchSourced(src)) {
    return { rec: "keep-curator", why: "Independently sourced curator (Levels.fyi / Glassdoor / curated research); AB drift is noise." };
  }
  if (isSeed && isPass2 && tier === "it-services" && isItNonEngRole && LEAD_EXEC_LEVELS.has(lvl)) {
    return { rec: "accept-ab", why: "IT-services lead/exec PM/BA/QA: AB title-cohort n is dense; seed-multiplier diverges." };
  }
  if (isSeed && !isPass2 && tier === "it-services" && lvl === "executive" &&
      isItNonEngRole && n >= 1000) {
    return { rec: "accept-ab", why: "IT-services exec PM/BA/QA pass-1: AB n>=1000, role unambiguous at exec." };
  }
  if (isMisbinnedScrape(notes, lvl)) {
    return { rec: "keep-curator", why: "Scrape YOE bucket mis-binned for level; curator more credible." };
  }
  if ((tier === "faang" || tier === "big-tech" || tier === "gcc") && NON_ENTRY_LEVELS.has(lvl)) {
    return { rec: "keep-curator", why: "FAANG / Big Tech / GCC mid+: AB undercounts (median earners don't post); trust curator." };
  }
  if (tier === "bfsi-global" && NON_ENTRY_LEVELS.has(lvl)) {
    return { rec: "keep-curator", why: "BFSI-global mid+: AB undercounts (senior bankers don't self-report); trust curator." };
  }
  if (tier === "indian-unicorn" && NON_ENTRY_LEVELS.has(lvl) &&
      src && UNICORN_BLENDED_RE.test(src)) {
    return { rec: "keep-curator", why: "Indian-unicorn mid+: curator anchored on Levels.fyi/Glassdoor/research; AB undercounts." };
  }
  if (curatorIsAbOnly && isPass2) {
    return { rec: "accept-ab", why: "Both curator and scrape are AB-sourced; pass-2 yoe-bucket is strictly finer-grained." };
  }
  if (d.company === "zoho" && curatorIsAbOnly) {
    return { rec: "accept-ab", why: "Zoho on regardless-flip list (curator AB-tagged but 3× inflated); fresh AB wins." };
  }
  if (isSeed && isPass2 && tier === "it-services" &&
      d.role === "software-engineer" && lvl === "lead") {
    return { rec: "accept-ab", why: "IT-services SE lead seed-multiplier; AB pass-2 9-12y cohort is real." };
  }
  const lowNPass2 = isPass2 && n > 0 && n < 100;
  if (lowNPass2 && LEAD_EXEC_LEVELS.has(lvl)) {
    return { rec: "keep-curator", why: "Pass-2 AB sample n<100 at lead/exec; cohort too thin to displace curator." };
  }
  if (isPass2 && n > 0 && n < 50 && tier === "indian-unicorn") {
    return { rec: "keep-curator", why: "Indian-unicorn pass-2 cohort n<50; below the flip-threshold floor." };
  }
  if (isSeed && tier === "indian-unicorn" && lvl === "mid" &&
      (d.role === "product-manager" || d.role === "business-analyst") &&
      n >= 50) {
    return { rec: "accept-ab", why: "Indian-unicorn seed-multiplier PM/BA mid; AB title cohort dense." };
  }
  if (curatorIsAbOnly && tier === "edtech" && lvl === "entry" && n >= 10) {
    return { rec: "accept-ab", why: "Edtech entry AB-only curator vs fresh AB scrape; prefer fresh." };
  }
  return { rec: "manual-review", why: "No clear heuristic match — eyeball the cell." };
}
