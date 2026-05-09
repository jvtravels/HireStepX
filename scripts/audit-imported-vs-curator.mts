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

interface Drift {
  company: string;
  role: string;
  level: string;
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
 * Heuristics distilled from the first round of cross-checks:
 *   - Curator sources tagged "Levels.fyi" are research-verified at the
 *     senior end where AB sample is too thin (most FAANG L5+ folks
 *     don't self-post on AB). Trust curator.
 *   - "Seed dataset" curator sources are tier-multiplier-derived, NOT
 *     ground-truth — they were placeholders. When pass-2 AB has a real
 *     YOE-bucket sample (notes prefixed "AB yoe-bucket scrape"), the
 *     scrape wins for entry/mid IT-services where AB sample is dense.
 *   - Otherwise the cell needs human eyes.
 */
function classifyDrift(
  d: Pick<Drift, "company" | "role" | "level" | "curatorSource" | "scrapedNotes" | "driftPct">,
): { rec: Drift["recommendation"]; why: string } {
  const src = (d.curatorSource ?? "").toLowerCase();
  const notes = (d.scrapedNotes ?? "").toLowerCase();
  const isPass2 = notes.includes("yoe-bucket");
  const isSeed = src.includes("seed dataset");
  const isLevelsFyi = src.includes("levels.fyi");
  const isResearchVerified = /verified|disclosure|drhp|glassdoor.+ambitionbox/.test(src);
  const tier = getCompanyTier(d.company);

  if (isLevelsFyi && (d.level === "lead" || d.level === "senior" || d.level === "executive")) {
    return { rec: "keep-curator", why: "Levels.fyi-verified senior comp; AB sample sparse at this level." };
  }
  // Auto-accept AB ONLY for IT-services entry/mid where AB has dense
  // cohort sample and curator was a tier-multiplier guess. FAANG /
  // Big Tech / GCC at mid+ commonly under-report on AB (median earner
  // doesn't post; outliers do), so even a "seed + pass-2" combo there
  // needs human eyes.
  if (isSeed && isPass2 && tier === "it-services" && (d.level === "entry" || d.level === "mid")) {
    return { rec: "accept-ab", why: "IT-services seed-multiplier vs pass-2 yoe-bucket AB; AB has dense entry/mid sample." };
  }
  /* Phase 4 expansion: extend the seed→AB flip to IT-services senior +
   * domestic-BFSI + saas-product + edtech entry/mid/senior. These are
   * tiers where AB has dense self-report cohorts and curator's multiplier
   * curve drifts noticeably from real disclosure. Lead/executive still
   * need eyeballs (AB sparse at the top of the curve). */
  if (
    isSeed && isPass2 &&
    (
      (tier === "it-services" && d.level === "senior") ||
      ((tier === "bfsi-domestic" || tier === "saas-product" || tier === "edtech") &&
        (d.level === "entry" || d.level === "mid" || d.level === "senior" || d.level === "lead")) ||
      /* Phase 6: indian-unicorn seed-multiplier (no Levels.fyi/Glassdoor
       * blend) at entry/mid/senior. The Levels.fyi-blended unicorn rule
       * elsewhere keeps curator; this catches the seed-only path where
       * AB pass-2 is closer to disclosure. */
      (tier === "indian-unicorn" &&
        (d.level === "entry" || d.level === "mid" || d.level === "senior"))
    )
  ) {
    return { rec: "accept-ab", why: `${tier} seed-multiplier vs pass-2 yoe-bucket AB; AB has dense ${d.level} sample.` };
  }
  if (isResearchVerified) {
    return { rec: "keep-curator", why: "Research-verified curator source (DRHP / official disclosure / cross-source)." };
  }
  /* Phase 6: broad research-sourced rule — Levels.fyi, Glassdoor,
   * Curated research worksheets, Indeed/Weekday aggregates, NLTH
   * (Wipro National Talent Hunt) and similar are independently sourced
   * from AB. Trust curator at any level; AB drift is noise, not signal. */
  const isResearchSourced =
    /levels\.fyi|glassdoor|curated research|indeed|weekday|nlth|jpmc india analyst|p\d+ ₹/.test(src);
  if (isResearchSourced) {
    return { rec: "keep-curator", why: "Independently sourced curator (Levels.fyi / Glassdoor / curated research); AB drift is noise." };
  }
  /* Phase 6: IT-services PM/BA/QA at lead/executive with seed-multiplier
   * curator. AB has dense title-based cohorts ("Project Manager 9-12y",
   * n in the hundreds-to-thousands) that match real delivery-manager
   * comp better than a synthetic multiplier curve. Engineering-track
   * already covered above; this catches the remaining roles. */
  const isItNonEngRole =
    /^(product-manager|project-manager|business-analyst|qa-engineer)$/.test(d.role);
  if (isSeed && isPass2 && tier === "it-services" && isItNonEngRole &&
      (d.level === "lead" || d.level === "executive")) {
    return { rec: "accept-ab", why: "IT-services lead/exec PM/BA/QA: AB title-cohort n is dense; seed-multiplier diverges." };
  }
  /* Phase 6: pass-1 high-n seed flips for IT-services PM at executive.
   * Pass-1 collapses YOE but at exec level the role is unambiguous and
   * AB n=2k-8k is statistically dominant. */
  if (isSeed && tier === "it-services" && d.level === "executive" &&
      isItNonEngRole && /n=\d{4,}/.test(notes)) {
    return { rec: "accept-ab", why: "IT-services exec PM/BA/QA pass-1: AB n>=1000, role unambiguous at exec." };
  }
  /* Phase 6: scraped cell whose notes show a YOE bucket far from the
   * level (e.g. "12+y" for entry, "0-1y" for executive) is mis-binned —
   * keep curator. */
  const scrapedYoeBucket = notes.match(/(\d+)\+?[-–](\d+)?y/);
  if (scrapedYoeBucket || /\d+\+y/.test(notes)) {
    const isHighYoeNote = /9-12y|12\+y|6-9y/.test(notes);
    const isLowYoeNote = /0-1y|1-3y/.test(notes);
    if ((d.level === "entry" && isHighYoeNote) ||
        ((d.level === "lead" || d.level === "executive") && isLowYoeNote)) {
      return { rec: "keep-curator", why: "Scrape YOE bucket mis-binned for level; curator more credible." };
    }
  }
  // Tier-aware defaults: at mid+ for FAANG / big-tech / gcc, AB
  // chronically undercounts. Surface a curator-leaning recommendation.
  if ((tier === "faang" || tier === "big-tech" || tier === "gcc") && d.level !== "entry") {
    return { rec: "keep-curator", why: "FAANG / Big Tech / GCC mid+: AB undercounts (median earners don't post); trust curator." };
  }
  /* Phase 5: bfsi-global mid+ (Goldman / Morgan Stanley / HSBC / Barclays /
   * JPMC / Wells Fargo / Citi / Deutsche) follows the same dynamic as FAANG —
   * AB self-reports skew to junior complaint-posters; senior bankers don't
   * post. Levels.fyi-anchored curator entries are closer to realized comp.
   * Keep curator for mid+. Entry can still flip if pass-2 has dense sample. */
  if (tier === "bfsi-global" && d.level !== "entry") {
    return { rec: "keep-curator", why: "BFSI-global mid+: AB undercounts (senior bankers don't self-report); trust curator." };
  }
  /* Phase 5: Indian-unicorn mid+ where curator was sourced from
   * Levels.fyi / Glassdoor / Curated research is empirically closer to
   * realized offer band than AB pass-2 (which skews to early-career
   * IC reporters). Flipkart, Paytm, PhonePe, Swiggy, Myntra, Lenskart,
   * Dream11, MakeMyTrip, Delhivery, etc. AB underreports by 28-55% on
   * these — flipping would coach lower than reality. Trust curator. */
  if (
    tier === "indian-unicorn" &&
    (d.level === "mid" || d.level === "senior" || d.level === "lead" || d.level === "executive") &&
    /levels\.fyi|glassdoor|curated research/.test(src)
  ) {
    return { rec: "keep-curator", why: "Indian-unicorn mid+: curator anchored on Levels.fyi/Glassdoor/research; AB undercounts." };
  }
  /* Phase 5: when both curator AND scrape are AmbitionBox-sourced but
   * scrape is pass-2 yoe-bucket (strictly more granular), prefer the
   * pass-2 scrape. Pass-1 collapses 0-8 YOE into one mid cell using
   * profile-level YOE midpoint; pass-2 walks the bucket table per
   * designation. Same data source, finer resolution. Applies to any
   * tier so long as curator is unambiguously AB-derived (no Levels.fyi
   * or research blend, since those are independent sources). */
  const curatorIsAbOnly = /^ambitionbox/.test(src) &&
    !/levels\.fyi|drhp|disclosure|verified/.test(src);
  if (curatorIsAbOnly && isPass2) {
    return { rec: "accept-ab", why: "Both curator and scrape are AB-sourced; pass-2 yoe-bucket is strictly finer-grained." };
  }
  /* Phase 6: zoho is on the PREFER_IMPORTED_REGARDLESS list at runtime —
   * even pass-1-vs-pass-1 AB scrapes flip because curator was 3× inflated.
   * Reflect that here so audit doesn't flag it as manual-review. */
  if (d.company === "zoho" && curatorIsAbOnly) {
    return { rec: "accept-ab", why: "Zoho on regardless-flip list (curator AB-tagged but 3× inflated); fresh AB wins." };
  }
  /* Phase 6: IT-services engineering-track lead with seed curator + pass-2.
   * AB "Senior SE 9-12y" is the correct cohort for SE-lead at TCS/Wipro/
   * Accenture-class IT-services. Curator's seed-multiplier extrapolated
   * from baseline gives ₹60L+ which is 4× off realized comp. */
  if (isSeed && isPass2 && tier === "it-services" &&
      d.role === "software-engineer" && d.level === "lead") {
    return { rec: "accept-ab", why: "IT-services SE lead seed-multiplier; AB pass-2 9-12y cohort is real." };
  }
  /* Phase 6 final: low-n pass-2 at lead/exec for any tier — too sparse to
   * trust over curator even when curator is seed-multiplier. */
  const lowNPass2 = isPass2 && /n=\d{1,2}\)/.test(notes);
  if (lowNPass2 && (d.level === "lead" || d.level === "executive")) {
    return { rec: "keep-curator", why: "Pass-2 AB sample n<100 at lead/exec; cohort too thin to displace curator." };
  }
  /* Phase 6 final: indian-unicorn seed at PM/BA mid with pass-1 high-n
   * (n>=50) AB scrape — synthetic 0.85-1.05x multiplier diverges from
   * dense title-cohort. */
  if (isSeed && tier === "indian-unicorn" && d.level === "mid" &&
      (d.role === "product-manager" || d.role === "business-analyst") &&
      /n=\d{2,}\)/.test(notes)) {
    return { rec: "accept-ab", why: "Indian-unicorn seed-multiplier PM/BA mid; AB title cohort dense." };
  }
  /* Phase 6 final: edtech AB-only curator at entry SE — fresh AB scrape
   * with n>=50 is preferable to stale single-snapshot curator. */
  if (curatorIsAbOnly && tier === "edtech" && d.level === "entry" &&
      /n=\d{2,}/.test(notes)) {
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
          level,
          curatorSource: cur.source,
          scrapedNotes: imp.notes,
          driftPct: Math.round(drift * 100),
        });
        drifts.push({
          company,
          role,
          level,
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
