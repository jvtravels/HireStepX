/**
 * Audit-side classification of curator-vs-imported drift cells. The
 * accept-ab decision is delegated to shouldFlipToImported() — the same
 * predicate the runtime calls — so audit recommendations cannot drift
 * from runtime behavior.
 */
import type { ExperienceLevel } from "./salaries";
import { getCompanyTier } from "./company-tiers";
import {
  LEAD_EXEC_LEVELS,
  NON_ENTRY_LEVELS,
  isMisbinnedScrape,
  isResearchSourced,
  shouldFlipToImported,
} from "./_salary-source-helpers";

const RESEARCH_VERIFIED_RE = /verified|disclosure|drhp|glassdoor.+ambitionbox/i;
const LEVELS_FYI_RE = /levels\.fyi/i;

export type Recommendation = "keep-curator" | "accept-ab" | "manual-review";

export interface DriftInput {
  company: string;
  role: string;
  level: ExperienceLevel;
  curatorSource: string | undefined;
  scrapedNotes: string | undefined;
}

export function classifyDrift(d: DriftInput): { rec: Recommendation; why: string } {
  if (shouldFlipToImported({
    curatorSource: d.curatorSource,
    scrapedNotes: d.scrapedNotes,
    company: d.company,
    role: d.role,
    level: d.level,
  })) {
    return { rec: "accept-ab", why: "Runtime flips to AB scrape (shouldFlipToImported())." };
  }

  const src = d.curatorSource;
  const lvl = d.level;
  const tier = getCompanyTier(d.company);
  const isLevelsFyi = src ? LEVELS_FYI_RE.test(src) : false;
  const isResearchVerified = src ? RESEARCH_VERIFIED_RE.test(src) : false;

  if (isMisbinnedScrape(d.scrapedNotes, lvl)) {
    return { rec: "keep-curator", why: "Scrape YOE bucket mis-binned for level; curator more credible." };
  }
  if (isLevelsFyi && (lvl === "senior" || LEAD_EXEC_LEVELS.has(lvl))) {
    return { rec: "keep-curator", why: "Levels.fyi-verified senior comp; AB sample sparse at this level." };
  }
  if (isResearchVerified) {
    return { rec: "keep-curator", why: "Research-verified curator source (DRHP / official disclosure / cross-source)." };
  }
  if (isResearchSourced(src)) {
    return { rec: "keep-curator", why: "Independently sourced curator (Levels.fyi / Glassdoor / curated research); AB drift is noise." };
  }
  if ((tier === "faang" || tier === "big-tech" || tier === "gcc") && NON_ENTRY_LEVELS.has(lvl)) {
    return { rec: "keep-curator", why: "FAANG / Big Tech / GCC mid+: AB undercounts (median earners don't post); trust curator." };
  }
  if (tier === "bfsi-global" && NON_ENTRY_LEVELS.has(lvl)) {
    return { rec: "keep-curator", why: "BFSI-global mid+: AB undercounts (senior bankers don't self-report); trust curator." };
  }
  return { rec: "manual-review", why: "No clear heuristic match, eyeball the cell." };
}
