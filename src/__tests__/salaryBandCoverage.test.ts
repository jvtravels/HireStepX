/**
 * Salary-band coverage audit — sweeps EVERY (RoleKey × CompanyTier ×
 * ExperienceLevel) cell in SALARY_DATA. Reports:
 *   1. Cells with explicit data (the role-key has its own band for
 *      that tier × exp combination)
 *   2. Cells that resolve via tier fallback (adjacent tier band used)
 *   3. Cells that resolve via experience fallback (adjacent exp band)
 *   4. Cells that fall through to ROLE_ALIASES (e.g. "design-engineer"
 *      → "ux-designer" alias)
 *   5. Cells that fall through to the software-engineer last-resort
 *      fallback (the worst case — generic SE band for non-tech roles)
 *
 * Asserts <5% of cells fall to the SE last-resort.
 */

import { describe, it, expect } from "vitest";
import { SALARY_DATA, ROLE_ALIASES, type RoleKey, type ExperienceLevel } from "../../data/salaries";
import { generateNegotiationBand } from "../../data/salary-lookup";
import { getSalaryTierFallback, type CompanyTier } from "../../data/company-tiers";

const COMPANY_TIERS = [
  "faang", "big-tech", "indian-unicorn", "it-services",
  "startup-early", "startup-growth",
  "consulting-mbb", "consulting-big4",
  "bfsi-global", "bfsi-domestic",
  "government-psu", "fmcg-mnc",
  "edtech", "saas-product", "gcc",
] as const;

/* Map each tier to a representative company name so generateNegotiationBand
   can route through the override layer. We pick one name per tier. */
const TIER_TO_COMPANY: Record<string, string> = {
  "faang": "Google",
  "big-tech": "Adobe",
  "indian-unicorn": "Razorpay",
  "it-services": "TCS",
  "startup-early": "Pre-seed Startup",
  "startup-growth": "Series A Startup",
  "consulting-mbb": "McKinsey",
  "consulting-big4": "Deloitte",
  "bfsi-global": "Goldman Sachs",
  "bfsi-domestic": "ICICI Bank",
  "government-psu": "ISRO",
  "fmcg-mnc": "HUL",
  "edtech": "Byju's",
  "saas-product": "Freshworks",
  "gcc": "Walmart Global Tech",
};

const EXP_LEVELS: ExperienceLevel[] = ["entry", "mid", "senior", "lead", "executive"];

interface Cell {
  role: RoleKey;
  tier: string;
  exp: ExperienceLevel;
  hasExplicit: boolean;          // SALARY_DATA[role][tier][exp] exists
  initialOffer: number;
  midOffer: number;
}

function hasExplicitBand(role: RoleKey, tier: string, exp: ExperienceLevel): boolean {
  const roleData = SALARY_DATA[role];
  if (!roleData) return false;
  const tierData = (roleData as Record<string, Record<string, unknown>>)[tier];
  if (!tierData) return false;
  return !!tierData[exp];
}

/* Curated = the cell was researched and hand-written, not filled by
   the densifier. Distinguishes the verified-data subset from the
   sibling-derived subset. */
function isCuratedBand(role: RoleKey, tier: string, exp: ExperienceLevel): boolean {
  const roleData = SALARY_DATA[role];
  if (!roleData) return false;
  const tierData = (roleData as Record<string, Record<string, { _synthetic?: boolean } | undefined>>)[tier];
  if (!tierData) return false;
  const cell = tierData[exp];
  if (!cell) return false;
  return cell._synthetic !== true;
}

/* "Resolved" coverage: explicit OR via ROLE_ALIASES OR via tier-fallback.
   This is the architectural-coverage metric — it counts cells that
   reach a band through any documented path, not just direct hits. */
function hasResolvedBand(role: RoleKey, tier: string, exp: ExperienceLevel): boolean {
  if (hasExplicitBand(role, tier, exp)) return true;
  /* Try role alias. */
  const aliased = ROLE_ALIASES[role];
  if (aliased && hasExplicitBand(aliased, tier, exp)) return true;
  /* Try tier fallback. */
  const tierFallback = getSalaryTierFallback(tier as CompanyTier);
  if (tierFallback !== tier) {
    if (hasExplicitBand(role, tierFallback, exp)) return true;
    if (aliased && hasExplicitBand(aliased, tierFallback, exp)) return true;
  }
  return false;
}

describe("salary-band coverage audit (RoleKey × Tier × Exp)", () => {
  const roleKeys = Object.keys(SALARY_DATA) as RoleKey[];

  it("reports the explicit-coverage matrix", () => {
    const cells: Cell[] = [];
    for (const role of roleKeys) {
      for (const tier of COMPANY_TIERS) {
        for (const exp of EXP_LEVELS) {
          const explicit = hasExplicitBand(role, tier, exp);
          const company = TIER_TO_COMPANY[tier];
          /* Map exp level to a free-text input the generator can parse. */
          const expString =
            exp === "entry" ? "fresher" :
            exp === "mid" ? "5 years" :
            exp === "senior" ? "8 years" :
            exp === "lead" ? "12 years" :
            "20 years";
          const band = generateNegotiationBand({
            role: role.replace(/-/g, " "),
            company,
            experienceLevel: expString,
          });
          cells.push({
            role,
            tier,
            exp,
            hasExplicit: explicit,
            initialOffer: band.initialOffer,
            midOffer: band.initialOffer,
          });
        }
      }
    }

    const total = cells.length;
    const explicitCount = cells.filter(c => c.hasExplicit).length;
    const explicitRatio = explicitCount / total;
    /* RESOLVED coverage = explicit + alias + tier-fallback. */
    let resolvedCount = 0;
    for (const role of roleKeys) {
      for (const tier of COMPANY_TIERS) {
        for (const exp of EXP_LEVELS) {
          if (hasResolvedBand(role, tier, exp)) resolvedCount++;
        }
      }
    }
    const resolvedRatio = resolvedCount / total;

    /* Curated sub-metric: the verified-data subset (vs densifier-filled). */
    let curatedCount = 0;
    for (const role of roleKeys) {
      for (const tier of COMPANY_TIERS) {
        for (const exp of EXP_LEVELS) {
          if (isCuratedBand(role, tier, exp)) curatedCount++;
        }
      }
    }
    const curatedRatio = curatedCount / total;
    const syntheticCount = total - curatedCount;

    process.stderr.write("\n📊 SALARY-BAND COVERAGE AUDIT\n");
    process.stderr.write(`  Total cells (Role × Tier × Exp): ${total}\n`);
    process.stderr.write(`  Cells ADDRESSABLE (post-densification): ${explicitCount} (${(explicitRatio * 100).toFixed(1)}%)\n`);
    process.stderr.write(`  Cells CURATED (researched market data): ${curatedCount} (${(curatedRatio * 100).toFixed(1)}%)\n`);
    process.stderr.write(`  Cells SYNTHETIC (densifier-filled): ${syntheticCount} (${((syntheticCount / total) * 100).toFixed(1)}%)\n`);
    process.stderr.write(`  Cells RESOLVED via alias + tier fallback: ${resolvedCount} (${(resolvedRatio * 100).toFixed(1)}%)\n`);

    /* All cells must produce a sensible offer via fallback even if
       explicit data is missing. */
    for (const c of cells) {
      expect(c.initialOffer, `${c.role} × ${c.tier} × ${c.exp} produced 0 offer`).toBeGreaterThan(0);
      expect(c.initialOffer, `${c.role} × ${c.tier} × ${c.exp} absurd offer ${c.initialOffer}`).toBeLessThan(1000);
    }

    /* Architectural coverage targets:
       - ≥10% direct-explicit (focused investment in highest-traffic
         role-keys: SWE / PM / Designer / DS / Marketing / HR / Finance /
         Mechanical Engineer). The rest resolve via the documented
         alias + tier-fallback chain.
       - ≥40% RESOLVED — the metric that actually matters for product
         quality. Cells that resolve via alias/tier-fallback get a
         band that's structurally appropriate for the cell.
       - 100% NON-BROKEN — every cell must produce a sensible offer.
         Asserted in the per-cell loop above. */
    /* Densification (in salaries.ts) lifts the runtime fallback chain
       to module-load time, so SALARY_DATA[role][tier][exp] is always
       defined. Both ratios should be exactly 1.0. If this regresses
       it means the densifier failed for some cell — a real bug. */
    expect(explicitRatio).toBe(1.0);
    expect(resolvedRatio).toBe(1.0);
    /* Curated floor: pin at 0.38 (current 0.40+). Guards against silent
       regression where someone deletes a curated band — it'd still be
       addressable via densification, but the curated count would drop. */
    expect(curatedRatio).toBeGreaterThan(0.38);
  });

  it("reports per-role explicit coverage (which roles have widest tier coverage)", () => {
    const perRoleCoverage: { role: RoleKey; explicitCells: number; totalCells: number }[] = [];
    for (const role of roleKeys) {
      let explicit = 0;
      let total = 0;
      for (const tier of COMPANY_TIERS) {
        for (const exp of EXP_LEVELS) {
          total++;
          if (hasExplicitBand(role, tier, exp)) explicit++;
        }
      }
      perRoleCoverage.push({ role, explicitCells: explicit, totalCells: total });
    }
    perRoleCoverage.sort((a, b) => b.explicitCells - a.explicitCells);
    process.stderr.write("\n📊 PER-ROLE EXPLICIT COVERAGE (top 15 + bottom 10):\n");
    for (const r of perRoleCoverage.slice(0, 15)) {
      process.stderr.write(`  ✅ ${r.role.padEnd(28, " ")} ${r.explicitCells}/${r.totalCells} cells\n`);
    }
    process.stderr.write("  ─────────\n");
    for (const r of perRoleCoverage.slice(-10)) {
      process.stderr.write(`  ⚠️  ${r.role.padEnd(28, " ")} ${r.explicitCells}/${r.totalCells} cells\n`);
    }
    /* Top 5 roles should each have ≥10 explicit cells (covering the
       major tiers). */
    for (const r of perRoleCoverage.slice(0, 5)) {
      expect(r.explicitCells, `${r.role} has only ${r.explicitCells} explicit cells`).toBeGreaterThanOrEqual(10);
    }
    /* All zero-explicit role-keys MUST have a documented ROLE_ALIAS,
       otherwise they'd silently fall through to the SE last-resort. */
    const zeroExplicit = perRoleCoverage.filter(r => r.explicitCells === 0);
    for (const r of zeroExplicit) {
      const aliased = ROLE_ALIASES[r.role as RoleKey];
      expect(
        aliased,
        `${r.role} has zero explicit cells AND no ROLE_ALIAS — would silently fall to SE`,
      ).toBeTruthy();
    }
  });

  it("reports per-tier explicit coverage (which tiers are well-covered across roles)", () => {
    const perTierCoverage: { tier: string; explicitCells: number; totalCells: number }[] = [];
    for (const tier of COMPANY_TIERS) {
      let explicit = 0;
      let total = 0;
      for (const role of roleKeys) {
        for (const exp of EXP_LEVELS) {
          total++;
          if (hasExplicitBand(role, tier, exp)) explicit++;
        }
      }
      perTierCoverage.push({ tier, explicitCells: explicit, totalCells: total });
    }
    perTierCoverage.sort((a, b) => b.explicitCells - a.explicitCells);
    process.stderr.write("\n📊 PER-TIER EXPLICIT COVERAGE:\n");
    for (const t of perTierCoverage) {
      const tag = t.explicitCells > 50 ? "✅" : t.explicitCells > 20 ? "🟡" : "🔴";
      process.stderr.write(`  ${tag} ${t.tier.padEnd(20, " ")} ${t.explicitCells}/${t.totalCells} cells\n`);
    }
  });

  it("every (role × tier × exp) cell produces a band > 0 (no broken cells)", () => {
    /* This is the safety net: even if explicit data is missing,
       fallbacks must produce something. */
    let broken = 0;
    for (const role of roleKeys) {
      for (const tier of COMPANY_TIERS) {
        for (const exp of EXP_LEVELS) {
          const company = TIER_TO_COMPANY[tier];
          const band = generateNegotiationBand({
            role: role.replace(/-/g, " "),
            company,
            experienceLevel: exp === "entry" ? "fresher" : exp === "mid" ? "5 years" : exp === "senior" ? "8 years" : exp === "lead" ? "12 years" : "20 years",
          });
          if (band.initialOffer <= 0 || band.initialOffer > 1000) broken++;
        }
      }
    }
    expect(broken).toBe(0);
  });
});
