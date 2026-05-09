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
import type { ExperienceLevel } from "../data/salaries";
import { classifyDrift, type Recommendation } from "../data/_salary-audit-helpers";

interface Drift {
  company: string;
  role: string;
  level: ExperienceLevel;
  curatorMid: number;
  scrapedMid: number;
  driftPct: number;
  curatorSource: string | undefined;
  scrapedNotes: string | undefined;
  recommendation: Recommendation;
  rationale: string;
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
