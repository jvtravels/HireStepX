/**
 * Data-integrity invariants for COMPANY_SALARY_OVERRIDES (~4,200 cells
 * across ~360 companies).
 *
 * Session A (2026-05-14) — Area 1 of data-layer audit. The brief is to
 * encode invariants as tests so any new override or refresh that
 * violates them fails CI, rather than hand-editing data en masse.
 *
 * Invariants asserted:
 *   I1. Every cell has totalMin < totalMax.
 *   I2. Within a (company, role), the experience tiers present are
 *       monotonic: nextTier.totalMax >= prevTier.totalMax AND
 *       nextTier.totalMin >= prevTier.totalMin (small overlap is fine,
 *       inversion is not).
 *   I3. Source + lastVerified are present (already enforced by
 *       companySalaryOverrides.test.ts — left in place to avoid drift).
 *
 * The classic four-tier completeness (entry/mid/senior/lead present for
 * every role) is enforced at the lookup layer via
 * EXP_FALLBACK_WITHIN_OVERRIDE + sector fallback. Partial coverage is
 * by design — we therefore REPORT missing-tier tuples to stderr but
 * don't fail on them. The numeric realism / market-judgment calls are
 * surfaced in the report rather than auto-fixed.
 */

import { describe, it, expect } from "vitest";
import { COMPANY_SALARY_OVERRIDES, type CompanyBandOverride } from "../../data/company-salary-overrides";
import type { ExperienceLevel } from "../../data/salaries";

const TIERS: ExperienceLevel[] = ["entry", "mid", "senior", "lead", "executive"];

interface CellLocator {
  company: string;
  role: string;
  tier: ExperienceLevel;
  band: CompanyBandOverride;
}

function enumerateCells(): CellLocator[] {
  const out: CellLocator[] = [];
  for (const [company, roles] of Object.entries(COMPANY_SALARY_OVERRIDES)) {
    for (const [role, levels] of Object.entries(roles ?? {})) {
      if (!levels) continue;
      for (const tier of TIERS) {
        const b = (levels as Partial<Record<ExperienceLevel, CompanyBandOverride>>)[tier];
        if (b) out.push({ company, role, tier, band: b });
      }
    }
  }
  return out;
}

describe("company-salary-overrides — data integrity invariants", () => {
  const cells = enumerateCells();

  it("[I1] every cell has totalMin < totalMax (no zero-width or inverted ranges)", () => {
    const violations: string[] = [];
    for (const { company, role, tier, band } of cells) {
      if (!(band.totalMin < band.totalMax)) {
        violations.push(`${company}/${role}/${tier}: min=${band.totalMin} max=${band.totalMax}`);
      }
    }
    if (violations.length > 0) {
      process.stderr.write(`\nI1 violations (${violations.length}):\n${violations.join("\n")}\n`);
    }
    expect(violations).toEqual([]);
  });

  it("[I2] tiers within a (company,role) are monotonic — next.max >= prev.max, next.min >= prev.min", () => {
    const violations: string[] = [];
    for (const [company, roles] of Object.entries(COMPANY_SALARY_OVERRIDES)) {
      for (const [role, levels] of Object.entries(roles ?? {})) {
        if (!levels) continue;
        const present = TIERS.filter((t) => (levels as any)[t]);
        for (let i = 0; i < present.length - 1; i++) {
          const a = (levels as any)[present[i]] as CompanyBandOverride;
          const n = (levels as any)[present[i + 1]] as CompanyBandOverride;
          if (n.totalMax + 0.01 < a.totalMax || n.totalMin + 0.01 < a.totalMin) {
            violations.push(
              `${company}/${role}: ${present[i]}(${a.totalMin}-${a.totalMax}) → ${present[i + 1]}(${n.totalMin}-${n.totalMax})`,
            );
          }
        }
      }
    }
    if (violations.length > 0) {
      process.stderr.write(`\nI2 monotonicity violations (${violations.length}):\n${violations.join("\n")}\n`);
    }
    expect(violations).toEqual([]);
  });

  it("[I3] every cell has non-empty source + ISO-format lastVerified", () => {
    /* Already asserted by companySalaryOverrides.test.ts. Re-asserting
     * here keeps the invariant suite self-contained so it can be run
     * in isolation. */
    const violations: string[] = [];
    for (const { company, role, tier, band } of cells) {
      if (!band.source || band.source.trim() === "") {
        violations.push(`${company}/${role}/${tier}: missing source`);
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(band.lastVerified)) {
        violations.push(`${company}/${role}/${tier}: lastVerified="${band.lastVerified}" not ISO YYYY-MM-DD`);
      }
    }
    if (violations.length > 0) {
      process.stderr.write(`\nI3 violations (${violations.length}):\n${violations.slice(0, 30).join("\n")}\n`);
    }
    expect(violations).toEqual([]);
  });

  it("reports tiers-missing tuples to stderr (DEFERRED, not a failure — partial coverage is by design via EXP_FALLBACK_WITHIN_OVERRIDE)", () => {
    const required: ExperienceLevel[] = ["entry", "mid", "senior", "lead"];
    const missingByTuple: Array<{ co: string; role: string; missing: ExperienceLevel[] }> = [];
    for (const [company, roles] of Object.entries(COMPANY_SALARY_OVERRIDES)) {
      for (const [role, levels] of Object.entries(roles ?? {})) {
        if (!levels) continue;
        const missing = required.filter((t) => !(levels as any)[t]);
        if (missing.length > 0) missingByTuple.push({ co: company, role, missing });
      }
    }
    process.stderr.write(`\n[report] ${missingByTuple.length} (company,role) tuples have one or more of entry/mid/senior/lead missing.\n`);
    process.stderr.write(`  These fall through via EXP_FALLBACK_WITHIN_OVERRIDE → sector → tier band. Top 20:\n`);
    for (const m of missingByTuple.slice(0, 20)) {
      process.stderr.write(`    ${m.co}/${m.role} missing: ${m.missing.join(",")}\n`);
    }
    // not asserting, purely informational
    expect(missingByTuple.length).toBeGreaterThanOrEqual(0);
  });

  it("reports tier-count + cell-count snapshot", () => {
    process.stderr.write(`\n[snapshot] enumerated cells: ${cells.length}\n`);
    process.stderr.write(`[snapshot] companies: ${Object.keys(COMPANY_SALARY_OVERRIDES).length}\n`);
    expect(cells.length).toBeGreaterThan(4000);
  });
});
