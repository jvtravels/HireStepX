/**
 * Audit: role-coverage gaps inside curated companies.
 *
 * Different question from audit-csv-vs-overrides — that one asks "which
 * companies are missing entirely". This one asks "for the 99 companies
 * we already curated, which (role × level) cells are missing?". A
 * missing cell falls through to the CSV synthesizer or the tier
 * default, which is exactly the bug class behind TCS UX getting a
 * unicorn-grade ₹14L anchor.
 *
 *   npx tsx scripts/audit-role-coverage.mts                  # markdown table
 *   npx tsx scripts/audit-role-coverage.mts --json           # JSON
 *   npx tsx scripts/audit-role-coverage.mts --gaps-only      # only missing cells
 *
 * Output is sorted by company → role; cells are `entry | mid | senior |
 * lead | executive`, with `·` for missing and `✓` for present.
 */
import { COMPANY_SALARY_OVERRIDES } from "../data/company-salary-overrides";
import { classifyCompanyType } from "../data/company-guidance";

/* Per-bucket "roles a candidate plausibly applies to" filter. Without
 * this filter the audit penalizes McKinsey for missing software-engineer
 * cells and OpenAI for missing sales cells — neither is a real gap.
 * If a bucket is missing, we fall back to the full role list (treats
 * unknown sectors as "could hire anyone"). */
const ROLES_BY_BUCKET: Record<string, readonly string[]> = {
  consulting_strategy: ["consultant", "business-analyst"],
  ibank_bulgebracket: ["finance", "business-analyst"],
  quant_hft: ["software-engineer", "data-scientist", "ml-engineer"],
  psu_bank: ["software-engineer", "data-analyst", "business-analyst", "hr"],
  private_bank: ["software-engineer", "data-analyst", "business-analyst", "sales", "marketing", "hr"],
  small_finance_bank: ["software-engineer", "data-analyst", "sales", "hr"],
  indian_unicorn_fintech: ["software-engineer", "product-manager", "engineering-manager", "data-scientist", "data-analyst", "ml-engineer", "devops-sre", "ux-designer", "frontend-developer", "backend-developer", "qa-engineer", "marketing", "sales", "hr", "business-analyst"],
  indian_unicorn_consumer: ["software-engineer", "product-manager", "engineering-manager", "data-scientist", "data-analyst", "ml-engineer", "devops-sre", "ux-designer", "frontend-developer", "backend-developer", "qa-engineer", "marketing", "sales", "hr", "business-analyst"],
  indian_unicorn_edtech: ["software-engineer", "product-manager", "data-scientist", "ux-designer", "frontend-developer", "backend-developer", "qa-engineer", "marketing", "sales", "hr"],
  indian_unicorn_logistics: ["software-engineer", "product-manager", "data-scientist", "data-analyst", "frontend-developer", "backend-developer", "qa-engineer", "marketing", "sales", "hr", "business-analyst"],
  gcc_global_capability_centre: ["software-engineer", "product-manager", "engineering-manager", "data-scientist", "data-analyst", "ml-engineer", "devops-sre", "ux-designer", "frontend-developer", "backend-developer", "qa-engineer"],
  indian_it_services: ["software-engineer", "data-analyst", "devops-sre", "frontend-developer", "backend-developer", "qa-engineer", "business-analyst", "hr"],
  indian_pharma: ["data-analyst", "marketing", "sales", "hr", "business-analyst"],
  indian_fmcg: ["data-analyst", "marketing", "sales", "hr", "business-analyst"],
  ai_genai_startup: ["software-engineer", "ml-engineer", "data-scientist", "product-manager", "frontend-developer", "backend-developer"],
  academia_iit_iim: [],
  global_gaming: ["software-engineer", "product-manager", "ux-designer", "frontend-developer", "backend-developer", "qa-engineer"],
  indian_gaming_realmoney: ["software-engineer", "product-manager", "data-analyst", "frontend-developer", "backend-developer", "qa-engineer", "marketing"],
  indian_market_generic: ["software-engineer", "product-manager", "data-analyst", "marketing", "sales", "hr"],
};

const HIGH_TRAFFIC_ROLES = [
  "software-engineer",
  "product-manager",
  "engineering-manager",
  "data-scientist",
  "data-analyst",
  "ml-engineer",
  "devops-sre",
  "ux-designer",
  "frontend-developer",
  "backend-developer",
  "qa-engineer",
  "marketing",
  "sales",
  "hr",
  "business-analyst",
] as const;

const LEVELS = ["entry", "mid", "senior", "lead", "executive"] as const;

const flags = new Set(process.argv.slice(2));
const asJson = flags.has("--json");
const gapsOnly = flags.has("--gaps-only");

interface CellRow {
  company: string;
  role: string;
  coverage: Record<string, boolean>;
  missingCount: number;
  totalCount: number;
}

const rows: CellRow[] = [];
const companies = Object.keys(COMPANY_SALARY_OVERRIDES).sort();

for (const company of companies) {
  const companyEntry = COMPANY_SALARY_OVERRIDES[company] ?? {};
  const bucket = classifyCompanyType(company);
  const relevant = bucket && ROLES_BY_BUCKET[bucket.key] !== undefined
    ? new Set(ROLES_BY_BUCKET[bucket.key])
    : null; // null = no filter, score every role
  for (const role of HIGH_TRAFFIC_ROLES) {
    if (relevant && !relevant.has(role)) continue;
    const roleEntry = companyEntry[role];
    const coverage: Record<string, boolean> = {};
    let missing = 0;
    for (const level of LEVELS) {
      const has = !!(roleEntry && roleEntry[level]);
      coverage[level] = has;
      if (!has) missing++;
    }
    if (gapsOnly && missing === 0) continue;
    rows.push({ company, role, coverage, missingCount: missing, totalCount: LEVELS.length });
  }
}

if (asJson) {
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}

let totalCells = 0;
let missingCells = 0;
for (const r of rows) {
  totalCells += r.totalCount;
  missingCells += r.missingCount;
}

console.log(`# Role-coverage audit — ${companies.length} curated companies × ${HIGH_TRAFFIC_ROLES.length} high-traffic roles × ${LEVELS.length} levels`);
console.log("");
console.log(`Total cells: ${totalCells}  |  Missing: ${missingCells}  (${((missingCells / totalCells) * 100).toFixed(1)}%)`);
console.log("");
console.log("| Company | Role | entry | mid | senior | lead | executive | missing |");
console.log("|---------|------|:-----:|:---:|:------:|:----:|:---------:|--------:|");
for (const r of rows) {
  const cells = LEVELS.map((l) => (r.coverage[l] ? "✓" : "·")).join(" | ");
  console.log(`| ${r.company} | ${r.role} | ${cells} | ${r.missingCount}/${r.totalCount} |`);
}

console.log("");
console.log("## Worst-covered companies (by missing cells across all roles)");
const byCompany = new Map<string, number>();
for (const r of rows) byCompany.set(r.company, (byCompany.get(r.company) ?? 0) + r.missingCount);
const ranked = [...byCompany.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
for (const [company, missing] of ranked) {
  console.log(`- ${company}: ${missing} missing cells`);
}
