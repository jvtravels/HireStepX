/**
 * Audit AB-scraped IMPORTED_SALARY_OVERRIDES against curator's
 * COMPANY_SALARY_OVERRIDES wherever both have an entry for the same
 * (company, role, level). Reports drift in % terms; the highest-drift
 * cells should be eyeballed because either:
 *   (a) curator data is stale (action: refresh from AB number)
 *   (b) AB cohort is mis-binned (e.g. AB "Senior SE" YOE 1-11 collapses
 *       to senior but covers mid+senior+lead → action: leave curator)
 *   (c) curator is right, AB is just noisy → action: leave curator
 *
 * The runtime already prefers curator over IMPORTED, so this script is
 * a maintenance tool, not a CI gate.
 *
 *   npx tsx scripts/audit-imported-vs-curator.mts
 *   npx tsx scripts/audit-imported-vs-curator.mts --threshold 0.15
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { COMPANY_SALARY_OVERRIDES } from "../data/company-salary-overrides";
import { IMPORTED_SALARY_OVERRIDES } from "../data/_imported-salary-overrides.generated";
import { getCompanyTier } from "../data/company-tiers";
import type { ExperienceLevel } from "../data/salaries";
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
} from "../data/_salary-source-helpers";

const RESEARCH_VERIFIED_RE = /verified|disclosure|drhp|glassdoor.+ambitionbox/i;
const LEVELS_FYI_RE = /levels\.fyi/i;
const UNICORN_BLENDED_RE = /levels\.fyi|glassdoor|curated research/i;

interface Drift {
  company: string;
  role: string;
  level: ExperienceLevel;
  curatorMid: number;
  scrapedMid: number;
  driftPct: number;
  curatorSource: string | undefined;
  scrapedNotes: string | undefined;
  /** Auto-classified follow-up — see classifyDrift(). */
  recommendation: "keep-curator" | "accept-ab" | "manual-review";
  /** One-line rationale shown next to the recommendation. */
  rationale: string;
}

/**
 * Heuristics distilled across audit rounds. Predicates are shared with
 * the runtime override (data/_salary-source-helpers.ts) so audit
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
function classifyDrift(
  d: Pick<Drift, "company" | "role" | "level" | "curatorSource" | "scrapedNotes" | "driftPct">,
): { rec: Drift["recommendation"]; why: string } {
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
  // IT-services entry/mid: AB has dense cohort sample; FAANG/Big-Tech/GCC
  // at mid+ undercount on AB (median earner doesn't post) so they don't
  // flip even with seed+pass-2.
  if (isSeed && isPass2 && tier === "it-services" && (lvl === "entry" || lvl === "mid")) {
    return { rec: "accept-ab", why: "IT-services seed-multiplier vs pass-2 yoe-bucket AB; AB has dense entry/mid sample." };
  }
  // Extend seed→AB flip to it-services/bfsi-domestic/saas-product/edtech
  // senior, plus indian-unicorn entry/mid/senior gated by n≥50 to match
  // runtime's unicorn n-floor.
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
  // IT-services PM/BA/QA lead+exec: AB title-cohorts ("Project Manager
  // 9-12y", n in hundreds-to-thousands) match real delivery-manager comp
  // better than synthetic multipliers. Engineering-track is covered above.
  if (isSeed && isPass2 && tier === "it-services" && isItNonEngRole && LEAD_EXEC_LEVELS.has(lvl)) {
    return { rec: "accept-ab", why: "IT-services lead/exec PM/BA/QA: AB title-cohort n is dense; seed-multiplier diverges." };
  }
  // Pass-1 collapses YOE, but at exec level the role is unambiguous and
  // n≥1000 is statistically dominant.
  if (isSeed && !isPass2 && tier === "it-services" && lvl === "executive" &&
      isItNonEngRole && n >= 1000) {
    return { rec: "accept-ab", why: "IT-services exec PM/BA/QA pass-1: AB n>=1000, role unambiguous at exec." };
  }
  if (isMisbinnedScrape(notes, lvl)) {
    return { rec: "keep-curator", why: "Scrape YOE bucket mis-binned for level; curator more credible." };
  }
  // Tier-aware defaults: AB chronically undercounts senior/lead at
  // FAANG/big-tech/gcc and bfsi-global (median earners don't self-post).
  if ((tier === "faang" || tier === "big-tech" || tier === "gcc") && NON_ENTRY_LEVELS.has(lvl)) {
    return { rec: "keep-curator", why: "FAANG / Big Tech / GCC mid+: AB undercounts (median earners don't post); trust curator." };
  }
  if (tier === "bfsi-global" && NON_ENTRY_LEVELS.has(lvl)) {
    return { rec: "keep-curator", why: "BFSI-global mid+: AB undercounts (senior bankers don't self-report); trust curator." };
  }
  // Indian-unicorn mid+ with Levels.fyi/Glassdoor/research-blended curator:
  // AB underreports by 28-55% (skews early-career IC reporters); flipping
  // would coach lower than reality.
  if (tier === "indian-unicorn" && NON_ENTRY_LEVELS.has(lvl) &&
      src && UNICORN_BLENDED_RE.test(src)) {
    return { rec: "keep-curator", why: "Indian-unicorn mid+: curator anchored on Levels.fyi/Glassdoor/research; AB undercounts." };
  }
  // Both curator and scrape AB-sourced, but scrape is pass-2 yoe-bucket
  // (strictly finer-grained than pass-1's collapsed cell). Same data
  // source, narrower YOE window.
  if (curatorIsAbOnly && isPass2) {
    return { rec: "accept-ab", why: "Both curator and scrape are AB-sourced; pass-2 yoe-bucket is strictly finer-grained." };
  }
  // Zoho is on PREFER_IMPORTED_REGARDLESS at runtime: curator was AB-tagged
  // but 3× inflated, so even pass-1-vs-pass-1 flips.
  if (d.company === "zoho" && curatorIsAbOnly) {
    return { rec: "accept-ab", why: "Zoho on regardless-flip list (curator AB-tagged but 3× inflated); fresh AB wins." };
  }
  // IT-services SE lead: curator's multiplier extrapolation gives ₹60L+
  // (4× off); AB "Senior SE 9-12y" cohort is the right reference.
  if (isSeed && isPass2 && tier === "it-services" &&
      d.role === "software-engineer" && lvl === "lead") {
    return { rec: "accept-ab", why: "IT-services SE lead seed-multiplier; AB pass-2 9-12y cohort is real." };
  }
  // Low-n pass-2 sparse at lead/exec or for indian-unicorn — below the
  // flip-threshold floor (e.g. meesho BA entry n=31).
  const lowNPass2 = isPass2 && n > 0 && n < 100;
  if (lowNPass2 && LEAD_EXEC_LEVELS.has(lvl)) {
    return { rec: "keep-curator", why: "Pass-2 AB sample n<100 at lead/exec; cohort too thin to displace curator." };
  }
  if (isPass2 && n > 0 && n < 50 && tier === "indian-unicorn") {
    return { rec: "keep-curator", why: "Indian-unicorn pass-2 cohort n<50; below the flip-threshold floor." };
  }
  // Indian-unicorn seed PM/BA mid with pass-1 high-n (n≥50) AB: synthetic
  // 0.85-1.05x multiplier diverges from dense title-cohort.
  if (isSeed && tier === "indian-unicorn" && lvl === "mid" &&
      (d.role === "product-manager" || d.role === "business-analyst") &&
      n >= 50) {
    return { rec: "accept-ab", why: "Indian-unicorn seed-multiplier PM/BA mid; AB title cohort dense." };
  }
  // Edtech entry AB-only curator vs fresh AB scrape: prefer fresh.
  if (curatorIsAbOnly && tier === "edtech" && lvl === "entry" && n >= 10) {
    return { rec: "accept-ab", why: "Edtech entry AB-only curator vs fresh AB scrape; prefer fresh." };
  }
  return { rec: "manual-review", why: "No clear heuristic match — eyeball the cell." };
}

const args = process.argv.slice(2);
const threshIdx = args.indexOf("--threshold");
const THRESHOLD = threshIdx >= 0 ? Number(args[threshIdx + 1]) : 0.25;

const drifts: Drift[] = [];
let bothCount = 0;
let agreeCount = 0;

for (const company of Object.keys(IMPORTED_SALARY_OVERRIDES)) {
  const importedRoles = IMPORTED_SALARY_OVERRIDES[company];
  const curatorRoles = COMPANY_SALARY_OVERRIDES[company];
  if (!curatorRoles) continue;

  for (const role of Object.keys(importedRoles)) {
    const curatorLevels = curatorRoles[role];
    if (!curatorLevels) continue;
    for (const level of Object.keys(importedRoles[role])) {
      const lvl = level as "entry" | "mid" | "senior" | "lead" | "executive";
      const imp = importedRoles[role][lvl];
      const cur = curatorLevels[lvl];
      if (!imp || !cur) continue;
      bothCount++;
      const curMid = (cur.totalMin + cur.totalMax) / 2;
      const impMid = (imp.totalMin + imp.totalMax) / 2;
      if (curMid <= 0) continue;
      const drift = Math.abs(curMid - impMid) / curMid;
      if (drift <= 0.15) agreeCount++;
      if (drift >= THRESHOLD) {
        const { rec, why } = classifyDrift({
          company,
          role,
          level: lvl,
          curatorSource: cur.source,
          scrapedNotes: imp.notes,
          driftPct: Math.round(drift * 100),
        });
        drifts.push({
          company,
          role,
          level: lvl,
          curatorMid: Math.round(curMid * 10) / 10,
          scrapedMid: Math.round(impMid * 10) / 10,
          driftPct: Math.round(drift * 100),
          curatorSource: cur.source,
          scrapedNotes: imp.notes,
          recommendation: rec,
          rationale: why,
        });
      }
    }
  }
}

drifts.sort((a, b) => b.driftPct - a.driftPct);

console.log(`AB-vs-CURATOR DRIFT AUDIT  (threshold ${(THRESHOLD * 100).toFixed(0)}%)`);
console.log(`  Cells with both curator + scraped: ${bothCount}`);
console.log(`  Agree within 15%:                  ${agreeCount}  (${bothCount ? Math.round((agreeCount / bothCount) * 100) : 0}%)`);
console.log(`  Drift > ${(THRESHOLD * 100).toFixed(0)}%:                       ${drifts.length}`);
console.log();
console.log(`# Highest-drift cells (eyeball these — see column meanings in script header)`);
console.log(`# CURATOR / SCRAPED in LPA midpoint`);
console.log();
console.log(`| Drift | Company | Role | Level | Curator | Scraped | Recommendation | Curator source |`);
console.log(`|---|---|---|---|---|---|---|---|`);
for (const d of drifts.slice(0, 40)) {
  const src = (d.curatorSource ?? "—").slice(0, 40);
  console.log(`| ${d.driftPct}% | ${d.company} | ${d.role} | ${d.level} | ₹${d.curatorMid}L | ₹${d.scrapedMid}L | ${d.recommendation} | ${src} |`);
}

const buckets = drifts.reduce<Record<Drift["recommendation"], number>>(
  (acc, d) => { acc[d.recommendation] = (acc[d.recommendation] ?? 0) + 1; return acc; },
  { "keep-curator": 0, "accept-ab": 0, "manual-review": 0 },
);
console.log();
console.log(`# Auto-classified drift recommendations`);
console.log(`  keep-curator:  ${buckets["keep-curator"]}  (Levels.fyi / research-verified at senior tiers)`);
console.log(`  accept-ab:     ${buckets["accept-ab"]}  (seed-dataset curator + pass-2 yoe-bucket AB)`);
console.log(`  manual-review: ${buckets["manual-review"]}  (eyeball needed)`);

if (args.includes("--export-json")) {
  const outPath = resolve(process.cwd(), "data/_salary-audit-report.generated.json");
  writeFileSync(outPath, JSON.stringify({
    threshold: THRESHOLD,
    bothCount,
    agreeCount,
    driftCount: drifts.length,
    buckets,
    drifts,
  }, null, 2));
  console.log(`\nWrote JSON report → ${outPath}`);
}

console.error(`\nDONE — review the top ${Math.min(40, drifts.length)} cells above.`);
