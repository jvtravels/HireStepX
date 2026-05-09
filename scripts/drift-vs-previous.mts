/**
 * Compares two _imported-salary-overrides.generated.ts files cell-by-cell
 * and reports cells whose midpoint drifted by ≥ THRESHOLD. Used by the
 * monthly scrape workflow (.github/workflows/salary-drift-monthly.yml)
 * to decide whether the fresh scrape is "normal noise" (commit it) or
 * a structural shift that warrants human review (open an issue).
 *
 *   npx tsx scripts/drift-vs-previous.mts <oldFile> <newFile> [threshold]
 *
 * Exits 0 if no drift ≥ threshold, 1 if drift detected (workflow uses
 * the exit code to branch). Prints a markdown report to stdout that the
 * workflow pastes into the GitHub issue body.
 */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [, , oldPath, newPath, thresholdArg] = process.argv;
if (!oldPath || !newPath) {
  console.error("usage: drift-vs-previous.mts <oldFile> <newFile> [threshold=0.40]");
  process.exit(2);
}
const THRESHOLD = Number(thresholdArg ?? "0.40");

interface Band { totalMin: number; totalMax: number; notes?: string }
type Map3 = Record<string, Record<string, Partial<Record<string, Band>>>>;

const oldMod = (await import(pathToFileURL(resolve(oldPath)).href)) as { IMPORTED_SALARY_OVERRIDES: Map3 };
const newMod = (await import(pathToFileURL(resolve(newPath)).href)) as { IMPORTED_SALARY_OVERRIDES: Map3 };
const OLD = oldMod.IMPORTED_SALARY_OVERRIDES;
const NEW = newMod.IMPORTED_SALARY_OVERRIDES;

interface Drift {
  co: string; role: string; level: string;
  oldMid: number; newMid: number; pct: number;
  oldN: number; newN: number;
}

function n(notes: string | undefined): number {
  const m = notes?.match(/n=(\d+)/);
  return m ? Number(m[1]) : 0;
}

const drifts: Drift[] = [];
let bothCount = 0;
let addedCells = 0;
let removedCells = 0;

for (const co of Object.keys(NEW)) {
  for (const role of Object.keys(NEW[co])) {
    for (const lvl of Object.keys(NEW[co][role])) {
      const newBand = NEW[co][role][lvl];
      const oldBand = OLD[co]?.[role]?.[lvl];
      if (!newBand) continue;
      if (!oldBand) { addedCells++; continue; }
      bothCount++;
      const oM = (oldBand.totalMin + oldBand.totalMax) / 2;
      const nM = (newBand.totalMin + newBand.totalMax) / 2;
      if (oM <= 0) continue;
      const d = Math.abs(oM - nM) / oM;
      if (d >= THRESHOLD) {
        drifts.push({
          co, role, level: lvl,
          oldMid: Math.round(oM * 10) / 10,
          newMid: Math.round(nM * 10) / 10,
          pct: Math.round(d * 100),
          oldN: n(oldBand.notes), newN: n(newBand.notes),
        });
      }
    }
  }
}

for (const co of Object.keys(OLD)) {
  for (const role of Object.keys(OLD[co])) {
    for (const lvl of Object.keys(OLD[co][role])) {
      if (!NEW[co]?.[role]?.[lvl]) removedCells++;
    }
  }
}

drifts.sort((a, b) => b.pct - a.pct);

console.log(`# Monthly salary-data drift report (threshold ${(THRESHOLD * 100).toFixed(0)}%)`);
console.log();
console.log(`- Cells in both old + new: ${bothCount}`);
console.log(`- Cells added (new-only):  ${addedCells}`);
console.log(`- Cells removed (old-only): ${removedCells}`);
console.log(`- Cells drifted ≥ ${(THRESHOLD * 100).toFixed(0)}%: **${drifts.length}**`);
console.log();
if (drifts.length === 0) {
  console.log("✅ No drift above threshold. Safe to auto-commit the refreshed snapshot.");
} else {
  console.log("⚠️ Drift detected — review before committing. Possible causes:");
  console.log("- Real market shift (layoffs, hiring boom)");
  console.log("- AB cohort recomposition (new role profile, different YOE binning)");
  console.log("- Scraper bug (slug change, parsing regression)");
  console.log();
  console.log(`| Drift | Company | Role | Level | Old (n=) | New (n=) |`);
  console.log(`|---|---|---|---|---|---|`);
  for (const d of drifts.slice(0, 50)) {
    console.log(`| ${d.pct}% | ${d.co} | ${d.role} | ${d.level} | ₹${d.oldMid}L (n=${d.oldN}) | ₹${d.newMid}L (n=${d.newN}) |`);
  }
}

process.exit(drifts.length > 0 ? 1 : 0);
