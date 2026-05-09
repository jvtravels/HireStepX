/**
 * Synthetic-cell triage. Lists every cell in COMPANY_SALARY_OVERRIDES
 * whose source starts with "Seed dataset" AND has no AmbitionBox
 * scrape backing it — these are pure tier × multiplier guesses with
 * no empirical grounding (see Phase 7 commit 9801238 for the
 * low-confidence stamp that now hedges them at runtime).
 *
 * Goal: prioritize human/researcher backfill effort. Output sorts
 * companies by how many of their cells are synthetic, drilled down
 * by role/level so it's easy to grab a Levels.fyi or Glassdoor URL,
 * paste 5 numbers, and ship. The "sisterAbAnchor" column gives a
 * gut-check from a same-tier company's AB scrape so you don't have
 * to start from a blank page.
 *
 *   npx tsx scripts/audit-synthetic-cells.mts
 *   npx tsx scripts/audit-synthetic-cells.mts --top 30
 *   npx tsx scripts/audit-synthetic-cells.mts --company paytm
 *   npx tsx scripts/audit-synthetic-cells.mts --export-json
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { COMPANY_SALARY_OVERRIDES } from "../data/company-salary-overrides";
import { IMPORTED_SALARY_OVERRIDES } from "../data/_imported-salary-overrides.generated";
import { getCompanyTier } from "../data/company-tiers";

interface Cell {
  company: string;
  role: string;
  level: string;
  tier: string | null;
  curatorMid: number;
  totalMin: number;
  totalMax: number;
  multiplier: string | null;
  sisterAbAnchor: { company: string; mid: number; n: number } | null;
}

function extractMultiplier(src: string): string | null {
  const m = src.match(/(\d+(?:\.\d+)?)x/);
  return m ? m[1] : null;
}

function extractSampleSize(notes: string | undefined): number {
  if (!notes) return 0;
  const m = notes.match(/n=(\d+)/);
  return m ? Number(m[1]) : 0;
}

/** For a target (role, level, tier) find the largest-n AB scrape from
 *  any same-tier company. Used as a sanity-check anchor for the
 *  synthetic cell — the human can compare the multiplier-derived band
 *  to a real cohort from a peer. Falls back to a same-tier hand-curated
 *  (non-seed) entry when no AB scrape exists for the role/level/tier. */
function findSisterAbAnchor(
  role: string,
  level: string,
  tier: string | null,
  excludeCompany: string,
): Cell["sisterAbAnchor"] {
  if (!tier) return null;
  let best: { company: string; mid: number; n: number } | null = null;
  for (const company of Object.keys(IMPORTED_SALARY_OVERRIDES)) {
    if (company === excludeCompany) continue;
    if (getCompanyTier(company) !== tier) continue;
    const ent = IMPORTED_SALARY_OVERRIDES[company]?.[role]?.[level as "entry"];
    if (!ent) continue;
    const n = extractSampleSize(ent.notes);
    if (n < 30) continue;
    const mid = (ent.totalMin + ent.totalMax) / 2;
    if (!best || n > best.n) best = { company, mid: Math.round(mid * 10) / 10, n };
  }
  if (best) return best;
  // Fallback: same-tier hand-curated (non-seed) entry. n=0 sentinel
  // signals "curator-anchored, not AB". Better than nothing.
  for (const company of Object.keys(COMPANY_SALARY_OVERRIDES)) {
    if (company === excludeCompany || company.startsWith("__sector_")) continue;
    if (getCompanyTier(company) !== tier) continue;
    const ent = COMPANY_SALARY_OVERRIDES[company]?.[role]?.[level as "entry"];
    if (!ent || ent.source?.startsWith("Seed dataset")) continue;
    const mid = (ent.totalMin + ent.totalMax) / 2;
    return { company, mid: Math.round(mid * 10) / 10, n: 0 };
  }
  return null;
}

const args = process.argv.slice(2);
const topIdx = args.indexOf("--top");
const TOP = topIdx >= 0 ? Number(args[topIdx + 1]) : 20;
const companyIdx = args.indexOf("--company");
const COMPANY_FILTER = companyIdx >= 0 ? args[companyIdx + 1].toLowerCase() : null;

const synthetic: Cell[] = [];

for (const company of Object.keys(COMPANY_SALARY_OVERRIDES)) {
  if (company.startsWith("__sector_")) continue;
  if (COMPANY_FILTER && company !== COMPANY_FILTER) continue;
  const roles = COMPANY_SALARY_OVERRIDES[company];
  const tier = getCompanyTier(company);
  for (const role of Object.keys(roles)) {
    for (const level of Object.keys(roles[role])) {
      const ent = roles[role][level as "entry"];
      if (!ent?.source?.startsWith("Seed dataset")) continue;
      const importedHasIt = IMPORTED_SALARY_OVERRIDES[company]?.[role]?.[level as "entry"];
      if (importedHasIt) continue;
      synthetic.push({
        company,
        role,
        level,
        tier,
        curatorMid: Math.round((ent.totalMin + ent.totalMax) / 2 * 10) / 10,
        totalMin: ent.totalMin,
        totalMax: ent.totalMax,
        multiplier: extractMultiplier(ent.source),
        sisterAbAnchor: findSisterAbAnchor(role, level, tier, company),
      });
    }
  }
}

console.log(`SYNTHETIC-CELL TRIAGE  (Phase 7 stamps these as low-confidence at runtime)`);
console.log(`  Total synthetic cells (no AB scrape backing): ${synthetic.length}`);
console.log();

// Group by company.
const byCompany = synthetic.reduce<Record<string, Cell[]>>((acc, c) => {
  (acc[c.company] ??= []).push(c);
  return acc;
}, {});
const ranked = Object.entries(byCompany).sort((a, b) => b[1].length - a[1].length);

if (COMPANY_FILTER) {
  const cells = byCompany[COMPANY_FILTER] ?? [];
  console.log(`# ${COMPANY_FILTER} — ${cells.length} synthetic cells`);
  console.log(`| Role | Level | Curator (₹L) | Mult | Sister AB anchor |`);
  console.log(`|---|---|---|---|---|`);
  for (const c of cells) {
    const sis = c.sisterAbAnchor ? `${c.sisterAbAnchor.company} ₹${c.sisterAbAnchor.mid}L (n=${c.sisterAbAnchor.n})` : "—";
    console.log(`| ${c.role} | ${c.level} | ${c.totalMin}-${c.totalMax} (mid ${c.curatorMid}) | ${c.multiplier ?? "—"} | ${sis} |`);
  }
} else {
  console.log(`# Top ${Math.min(TOP, ranked.length)} companies by synthetic-cell count`);
  console.log(`| # | Company | Tier | Synth cells | Roles affected |`);
  console.log(`|---|---|---|---|---|`);
  ranked.slice(0, TOP).forEach(([company, cells], i) => {
    const tier = getCompanyTier(company) ?? "unknown";
    const roles = [...new Set(cells.map((c) => c.role))];
    console.log(`| ${i + 1} | ${company} | ${tier} | ${cells.length} | ${roles.join(", ")} |`);
  });

  // Tier rollup.
  const byTier = synthetic.reduce<Record<string, number>>((acc, c) => {
    acc[c.tier ?? "unknown"] = (acc[c.tier ?? "unknown"] ?? 0) + 1;
    return acc;
  }, {});
  console.log();
  console.log(`# Tier rollup`);
  for (const [t, n] of Object.entries(byTier).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${t}: ${n}`);
  }

  // Role rollup.
  const byRole = synthetic.reduce<Record<string, number>>((acc, c) => {
    acc[c.role] = (acc[c.role] ?? 0) + 1;
    return acc;
  }, {});
  console.log();
  console.log(`# Role rollup (which canonical roles are most under-anchored)`);
  for (const [r, n] of Object.entries(byRole).sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    console.log(`  ${r}: ${n}`);
  }
}

if (args.includes("--export-json")) {
  const outPath = resolve(process.cwd(), "data/_synthetic-cells-triage.generated.json");
  writeFileSync(outPath, JSON.stringify({
    total: synthetic.length,
    byCompany: Object.fromEntries(ranked.map(([k, v]) => [k, v.length])),
    cells: synthetic,
  }, null, 2));
  console.log(`\nWrote JSON triage → ${outPath}`);
}
