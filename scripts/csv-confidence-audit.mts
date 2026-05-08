/**
 * CSV confidence audit. Two outputs:
 *
 *   1. Calibration: where curator overrides AND CSV both have a cell,
 *      what % agree within ±15%? This is our trust signal for the
 *      scrape itself — no external sources needed.
 *
 *   2. Plausibility: every CSV cell run through band-shape and
 *      monotonicity invariants. Flag cells that violate them.
 *
 * Output: docs/csv-confidence-report.md + JSON dump to stdout.
 *
 *   npx tsx scripts/csv-confidence-audit.mts
 */
import {
  CSV_COMPANY_ROLE_BANDS,
  type CsvLevel,
  type CsvRoleBand,
} from "../data/csv-company-role-bands";
import { COMPANY_SALARY_OVERRIDES } from "../data/company-salary-overrides";
import { matchRoleKey } from "../data/salaries";
import { writeFileSync } from "node:fs";

const AGREEMENT_TOLERANCE = 0.15; // ±15% counts as agreement

function normalizeCompanyKey(name: string): string {
  let k = name.toLowerCase().trim();
  k = k.replace(/[.,;:!?]+$/g, "").trim();
  if (k.endsWith(" india")) k = k.slice(0, -" india".length).trim();
  return k;
}

function csvLevelToExp(
  l: CsvLevel,
): "entry" | "mid" | "senior" | "lead" | "executive" {
  switch (l) {
    case "fresher":
    case "junior":
      return "entry";
    case "mid":
      return "mid";
    case "senior":
      return "senior";
    case "lead":
      return "lead";
    case "manager":
      return "executive";
  }
}

const LEVEL_ORDER: Record<CsvLevel, number> = {
  fresher: 0,
  junior: 1,
  mid: 2,
  senior: 3,
  lead: 4,
  manager: 5,
};

interface PlausibilityFlag {
  company: string;
  role: string;
  level: CsvLevel;
  reason: string;
  values?: Record<string, number>;
}

interface CalibrationCell {
  company: string;
  role: string;
  level: string;
  csvMedian: number;
  curatorMid: number;
  driftPct: number;
  agrees: boolean;
}

const flags: PlausibilityFlag[] = [];
const calibration: CalibrationCell[] = [];

function checkBandShape(
  band: CsvRoleBand,
  company: string,
  role: string,
  level: CsvLevel,
) {
  const { totalMinLpa, totalMedianLpa, totalMaxLpa } = band;
  if (totalMinLpa > totalMaxLpa) {
    flags.push({
      company,
      role,
      level,
      reason: "totalMin > totalMax",
      values: { totalMinLpa, totalMaxLpa },
    });
  }
  if (totalMedianLpa > 0 && (totalMedianLpa < totalMinLpa || totalMedianLpa > totalMaxLpa)) {
    flags.push({
      company,
      role,
      level,
      reason: "median outside [min, max]",
      values: { totalMinLpa, totalMedianLpa, totalMaxLpa },
    });
  }
  if (band.fixedMaxLpa > totalMaxLpa) {
    flags.push({
      company,
      role,
      level,
      reason: "fixedMax > totalMax",
      values: { fixedMaxLpa: band.fixedMaxLpa, totalMaxLpa },
    });
  }
  if (band.equityMaxLpa > totalMaxLpa) {
    flags.push({
      company,
      role,
      level,
      reason: "equityMax > totalMax",
      values: { equityMaxLpa: band.equityMaxLpa, totalMaxLpa },
    });
  }
  // Joining bonus > 50% of fixed base is suspicious
  if (band.fixedMaxLpa > 0 && band.joiningBonusMaxLpa > band.fixedMaxLpa * 0.5) {
    flags.push({
      company,
      role,
      level,
      reason: "joiningBonus > 50% of fixed",
      values: {
        joiningBonusMaxLpa: band.joiningBonusMaxLpa,
        fixedMaxLpa: band.fixedMaxLpa,
      },
    });
  }
}

// Per-company per-role: junior median should be < mid < senior. Flag inversions.
function checkMonotonicity(companyName: string, role: string, levels: Record<CsvLevel, CsvRoleBand | undefined>) {
  const ordered = (Object.keys(levels) as CsvLevel[])
    .filter((l) => levels[l] && levels[l]!.totalMedianLpa > 0)
    .sort((a, b) => LEVEL_ORDER[a] - LEVEL_ORDER[b]);
  for (let i = 1; i < ordered.length; i++) {
    const prev = levels[ordered[i - 1]]!;
    const curr = levels[ordered[i]]!;
    if (curr.totalMedianLpa < prev.totalMedianLpa) {
      flags.push({
        company: companyName,
        role,
        level: ordered[i],
        reason: `non-monotonic: ${ordered[i]} median (${curr.totalMedianLpa}) < ${ordered[i - 1]} median (${prev.totalMedianLpa})`,
      });
    }
  }
}

let totalCsvCells = 0;
for (const csvKey of Object.keys(CSV_COMPANY_ROLE_BANDS)) {
  const co = CSV_COMPANY_ROLE_BANDS[csvKey];
  const overrideKey = normalizeCompanyKey(co.companyName);
  const ovr = COMPANY_SALARY_OVERRIDES[overrideKey];

  for (const csvRole of Object.keys(co.roles)) {
    const roleKey = matchRoleKey(csvRole);
    const levels = co.roles[csvRole];

    checkMonotonicity(co.companyName, csvRole, levels);

    for (const lvl of Object.keys(levels) as CsvLevel[]) {
      const band = levels[lvl];
      if (!band) continue;
      totalCsvCells++;
      checkBandShape(band, co.companyName, csvRole, lvl);

      // Calibration: do we have a curator number to compare against?
      const exp = csvLevelToExp(lvl);
      const ovrCell = ovr?.[roleKey]?.[exp];
      if (ovrCell && band.totalMedianLpa > 0) {
        const curatorMid = (ovrCell.totalMin + ovrCell.totalMax) / 2;
        const drift = Math.abs(band.totalMedianLpa - curatorMid) / Math.max(curatorMid, 1);
        calibration.push({
          company: co.companyName,
          role: roleKey,
          level: exp,
          csvMedian: band.totalMedianLpa,
          curatorMid: Math.round(curatorMid * 10) / 10,
          driftPct: Math.round(drift * 100),
          agrees: drift <= AGREEMENT_TOLERANCE,
        });
      }
    }
  }
}

const overlapCount = calibration.length;
const agreementCount = calibration.filter((c) => c.agrees).length;
const agreementPct = overlapCount > 0 ? Math.round((agreementCount / overlapCount) * 100) : 0;

// Bucket drift
const driftBuckets = { "0-15%": 0, "15-30%": 0, "30-50%": 0, ">50%": 0 };
for (const c of calibration) {
  if (c.driftPct <= 15) driftBuckets["0-15%"]++;
  else if (c.driftPct <= 30) driftBuckets["15-30%"]++;
  else if (c.driftPct <= 50) driftBuckets["30-50%"]++;
  else driftBuckets[">50%"]++;
}

// Worst offenders
const worstDrift = [...calibration]
  .sort((a, b) => b.driftPct - a.driftPct)
  .slice(0, 20);

const flagsByReason: Record<string, number> = {};
for (const f of flags) flagsByReason[f.reason] = (flagsByReason[f.reason] ?? 0) + 1;

// Build report
const lines: string[] = [];
lines.push(`# CSV Confidence Audit\n`);
lines.push(`Generated: ${new Date().toISOString().slice(0, 10)}\n`);
lines.push(`## Headline\n`);
lines.push(`- **Total CSV cells:** ${totalCsvCells}`);
lines.push(`- **Cells with curator overlap:** ${overlapCount}`);
lines.push(`- **Agreement (±15%):** ${agreementCount}/${overlapCount} = **${agreementPct}%**`);
lines.push(`- **Plausibility flags:** ${flags.length} cells\n`);

lines.push(`## Calibration: drift distribution (CSV vs curator)\n`);
lines.push(`| Drift bucket | Cells |`);
lines.push(`|---|---|`);
for (const [k, v] of Object.entries(driftBuckets)) lines.push(`| ${k} | ${v} |`);

lines.push(`\n## Plausibility flags by reason\n`);
lines.push(`| Reason | Count |`);
lines.push(`|---|---|`);
for (const [k, v] of Object.entries(flagsByReason).sort((a, b) => b[1] - a[1])) {
  lines.push(`| ${k} | ${v} |`);
}

lines.push(`\n## Top 20 worst CSV-vs-curator drifts\n`);
lines.push(`| Company | Role | Level | CSV median | Curator mid | Drift |`);
lines.push(`|---|---|---|---:|---:|---:|`);
for (const c of worstDrift) {
  lines.push(`| ${c.company} | ${c.role} | ${c.level} | ${c.csvMedian} | ${c.curatorMid} | ${c.driftPct}% |`);
}

lines.push(`\n## All plausibility flags\n`);
const flagsByCo: Record<string, PlausibilityFlag[]> = {};
for (const f of flags) (flagsByCo[f.company] ??= []).push(f);
for (const co of Object.keys(flagsByCo).sort()) {
  lines.push(`\n### ${co}\n`);
  for (const f of flagsByCo[co]) {
    const vals = f.values ? ` (${Object.entries(f.values).map(([k, v]) => `${k}=${v}`).join(", ")})` : "";
    lines.push(`- ${f.role} / ${f.level}: ${f.reason}${vals}`);
  }
}

writeFileSync("docs/csv-confidence-report.md", lines.join("\n"));

console.error(`CONFIDENCE AUDIT
  Total CSV cells:              ${totalCsvCells}
  Curator overlap:              ${overlapCount}
  Agreement within ±15%:        ${agreementCount} (${agreementPct}%)
  Plausibility flags:           ${flags.length}
  Report written:               docs/csv-confidence-report.md
`);

console.log(JSON.stringify({
  totalCsvCells,
  overlapCount,
  agreementCount,
  agreementPct,
  driftBuckets,
  flagsByReason,
  worstDrift,
}, null, 2));
