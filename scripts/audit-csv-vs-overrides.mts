/**
 * Audit script: for each of the 100 CSV companies, diff against the existing
 * COMPANY_SALARY_OVERRIDES + COMPANY_NEGOTIATION_CONTEXT and emit a per-
 * company report of (a) entirely missing companies, (b) numeric drift
 * cells, (c) missing roles/levels, (d) missing negotiation-context.
 *
 *   npx tsx scripts/audit-csv-vs-overrides.mts > audit-report.json
 */
import {
  CSV_COMPANY_ROLE_BANDS,
  type CsvLevel,
} from "../data/csv-company-role-bands";
import { COMPANY_SALARY_OVERRIDES } from "../data/company-salary-overrides";
import { COMPANY_NEGOTIATION_CONTEXT } from "../data/company-negotiation-context";
import { matchRoleKey } from "../data/salaries";

const DRIFT_THRESHOLD = 0.25; // >25% off counts as "wrong"

function normalizeCompanyKey(name: string): string {
  let k = name.toLowerCase().trim();
  k = k.replace(/[.,;:!?]+$/g, "").trim();
  if (k.endsWith(" india")) k = k.slice(0, -" india".length).trim();
  return k;
}

function csvLevelToExp(l: CsvLevel): "entry" | "mid" | "senior" | "lead" | "executive" {
  switch (l) {
    case "fresher":
    case "junior": return "entry";
    case "mid": return "mid";
    case "senior": return "senior";
    case "lead": return "lead";
    case "manager": return "executive";
  }
}

interface RoleLevelDiff {
  role: string;
  level: string;
  csv: { min: number; median: number; max: number };
  override?: { totalMin: number; totalMax: number };
  status: "missing" | "drift" | "ok";
  driftPct?: number;
}

interface CompanyAudit {
  companyKey: string;
  csvName: string;
  hasOverride: boolean;
  hasNegContext: boolean;
  roleLevelDiffs: RoleLevelDiff[];
  missingRolesInOverride: string[];
  driftCellCount: number;
  missingCellCount: number;
}

const reports: CompanyAudit[] = [];

for (const csvKey of Object.keys(CSV_COMPANY_ROLE_BANDS)) {
  const company = CSV_COMPANY_ROLE_BANDS[csvKey];
  const overrideKey = normalizeCompanyKey(company.companyName);
  const ovr = COMPANY_SALARY_OVERRIDES[overrideKey];
  const neg = COMPANY_NEGOTIATION_CONTEXT[overrideKey];
  const audit: CompanyAudit = {
    companyKey: overrideKey,
    csvName: company.companyName,
    hasOverride: !!ovr,
    hasNegContext: !!neg,
    roleLevelDiffs: [],
    missingRolesInOverride: [],
    driftCellCount: 0,
    missingCellCount: 0,
  };
  for (const csvRole of Object.keys(company.roles)) {
    const roleKey = matchRoleKey(csvRole);
    const ovrRole = ovr?.[roleKey];
    if (ovr && !ovrRole) audit.missingRolesInOverride.push(`${csvRole} → ${roleKey}`);
    for (const lvl of Object.keys(company.roles[csvRole]) as CsvLevel[]) {
      const csvBand = company.roles[csvRole][lvl];
      if (!csvBand) continue;
      const exp = csvLevelToExp(lvl);
      const ovrCell = ovrRole?.[exp];
      if (!ovrCell) {
        audit.roleLevelDiffs.push({
          role: roleKey,
          level: exp,
          csv: { min: csvBand.totalMinLpa, median: csvBand.totalMedianLpa, max: csvBand.totalMaxLpa },
          status: "missing",
        });
        audit.missingCellCount++;
        continue;
      }
      const ovrMid = (ovrCell.totalMin + ovrCell.totalMax) / 2;
      const drift = Math.abs(csvBand.totalMedianLpa - ovrMid) / Math.max(ovrMid, 1);
      if (drift > DRIFT_THRESHOLD) {
        audit.roleLevelDiffs.push({
          role: roleKey,
          level: exp,
          csv: { min: csvBand.totalMinLpa, median: csvBand.totalMedianLpa, max: csvBand.totalMaxLpa },
          override: { totalMin: ovrCell.totalMin, totalMax: ovrCell.totalMax },
          status: "drift",
          driftPct: Math.round(drift * 100),
        });
        audit.driftCellCount++;
      }
    }
  }
  reports.push(audit);
}

reports.sort((a, b) => a.companyKey.localeCompare(b.companyKey));
console.log(JSON.stringify(reports, null, 2));

// Summary to stderr so we can read it without polluting stdout
const totalCompanies = reports.length;
const missingOverride = reports.filter(r => !r.hasOverride).length;
const missingNeg = reports.filter(r => !r.hasNegContext).length;
const totalDrift = reports.reduce((s, r) => s + r.driftCellCount, 0);
const totalMissingCells = reports.reduce((s, r) => s + r.missingCellCount, 0);
console.error(`AUDIT SUMMARY:
  Total CSV companies: ${totalCompanies}
  Missing override entry entirely: ${missingOverride}
  Missing negotiation-context entry entirely: ${missingNeg}
  Total drifting cells (>25% off median): ${totalDrift}
  Total missing role×level cells: ${totalMissingCells}
`);
