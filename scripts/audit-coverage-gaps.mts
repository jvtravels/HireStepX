/**
 * Coverage-gap audit. For each curated company in COMPANY_SALARY_OVERRIDES,
 * report:
 *   - which canonical roles are missing
 *   - which experience levels are missing per role
 *   - cells with agreementCount < 2 (single-source, low confidence)
 *   - cells with lastVerified > 180 days old
 *
 * Output: docs/coverage-gaps.md (markdown table per company).
 *
 *   npx tsx scripts/audit-coverage-gaps.mts
 */
import { COMPANY_SALARY_OVERRIDES } from "../data/company-salary-overrides";
import { writeFileSync } from "node:fs";

const TIER_1_COMPANIES = new Set([
  "tcs", "infosys", "wipro", "cognizant", "accenture", "hcl", "tech mahindra",
  "ltimindtree", "capgemini", "ibm india",
  "razorpay", "flipkart", "swiggy", "zomato", "phonepe", "cred", "zerodha",
  "paytm", "ola", "meesho",
  "google", "meta", "apple", "amazon", "microsoft", "adobe", "salesforce",
]);

// Roles we expect EVERY tier-1 company to cover at minimum (the "core 5").
const CORE_ROLES = ["software-engineer", "product-manager", "qa-engineer", "data-engineer", "ux-designer"];

const LEVELS = ["entry", "mid", "senior", "lead", "executive"] as const;

const FRESHNESS_DAYS = 180;
const TODAY_MS = Date.now();

interface Gap {
  company: string;
  role?: string;
  level?: string;
  reason: string;
}

const gaps: Gap[] = [];

for (const company of Object.keys(COMPANY_SALARY_OVERRIDES)) {
  if (company.startsWith("__sector_")) continue;
  const isTier1 = TIER_1_COMPANIES.has(company);
  const roleMap = COMPANY_SALARY_OVERRIDES[company];

  if (isTier1) {
    for (const role of CORE_ROLES) {
      if (!roleMap[role]) {
        gaps.push({ company, role, reason: "Tier-1 missing core role" });
      }
    }
  }

  for (const role of Object.keys(roleMap)) {
    const levels = roleMap[role];
    for (const level of LEVELS) {
      const cell = levels[level];
      if (!cell) {
        if (isTier1 && CORE_ROLES.includes(role)) {
          gaps.push({ company, role, level, reason: "Tier-1 core role missing level" });
        }
        continue;
      }

      const agreement = cell.agreementCount ?? 1;
      if (isTier1 && agreement < 2) {
        gaps.push({ company, role, level, reason: `Single-source (agreementCount=${agreement}); needs cross-verification` });
      }

      if (cell.lastVerified) {
        const ageMs = TODAY_MS - Date.parse(cell.lastVerified);
        const ageDays = ageMs / 86400_000;
        if (Number.isFinite(ageDays) && ageDays > FRESHNESS_DAYS) {
          gaps.push({
            company, role, level,
            reason: `Stale (${Math.round(ageDays)}d old, threshold ${FRESHNESS_DAYS}d)`,
          });
        }
      } else {
        gaps.push({ company, role, level, reason: "Missing lastVerified stamp" });
      }
    }
  }
}

// Group + render
const byCompany: Record<string, Gap[]> = {};
for (const g of gaps) (byCompany[g.company] ??= []).push(g);

const lines: string[] = [];
lines.push(`# Salary Data Coverage Gaps\n`);
lines.push(`Generated: ${new Date().toISOString().slice(0, 10)}\n`);
lines.push(`**Tier-1 companies:** ${[...TIER_1_COMPANIES].sort().join(", ")}\n`);
lines.push(`**Core roles audited:** ${CORE_ROLES.join(", ")}\n`);
lines.push(`**Freshness threshold:** ${FRESHNESS_DAYS} days\n`);
lines.push(`**Total gaps:** ${gaps.length} across ${Object.keys(byCompany).length} companies\n`);

const tierGapCount = gaps.filter((g) => TIER_1_COMPANIES.has(g.company)).length;
lines.push(`**Tier-1 gaps (blocking):** ${tierGapCount}\n`);
lines.push(`**Tier-2 gaps (informational):** ${gaps.length - tierGapCount}\n`);

lines.push(`\n## Per-company gaps\n`);
for (const co of Object.keys(byCompany).sort()) {
  const isTier1 = TIER_1_COMPANIES.has(co);
  lines.push(`\n### ${co} ${isTier1 ? "🔴 Tier-1" : "🟡 Tier-2"}\n`);
  for (const g of byCompany[co]) {
    const cell = [g.role, g.level].filter(Boolean).join(" / ");
    lines.push(`- ${cell ? cell + " — " : ""}${g.reason}`);
  }
}

writeFileSync("docs/coverage-gaps.md", lines.join("\n"));

console.error(`COVERAGE-GAP AUDIT
  Total gaps:    ${gaps.length}
  Tier-1 gaps:   ${tierGapCount}  (BLOCKING — fix before next release)
  Tier-2 gaps:   ${gaps.length - tierGapCount}  (informational)
  Companies:     ${Object.keys(byCompany).length}
  Report:        docs/coverage-gaps.md
`);

// Exit non-zero if any Tier-1 gaps — usable as a CI gate.
if (tierGapCount > 0) {
  console.error(`\n⚠️  ${tierGapCount} Tier-1 gaps. CI gate: re-run after filling data/salary-data-input.csv.`);
  // Exit 0 in foundation phase (so CI doesn't break before any data is filled).
  // Once Phase 1 lands, switch to: process.exit(1);
}
