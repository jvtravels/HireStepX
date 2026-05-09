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
  d: Pick<Drift, "company" | "level" | "curatorSource" | "scrapedNotes" | "driftPct">,
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
  if (isResearchVerified) {
    return { rec: "keep-curator", why: "Research-verified curator source (DRHP / official disclosure / cross-source)." };
  }
  // Tier-aware defaults: at mid+ for FAANG / big-tech / gcc, AB
  // chronically undercounts. Surface a curator-leaning recommendation.
  if ((tier === "faang" || tier === "big-tech" || tier === "gcc") && d.level !== "entry") {
    return { rec: "keep-curator", why: "FAANG / Big Tech / GCC mid+: AB undercounts (median earners don't post); trust curator." };
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
