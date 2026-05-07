/**
 * Data-freshness CI guard.
 *
 * Salary-band research has a 6-month half-life — Indian-market
 * comp shifts meaningfully each quarter (post-IPO ESOP conversions,
 * GCC pay step-ups, AI/ML premium compression, etc.). Every entry
 * in COMPANY_SALARY_OVERRIDES carries a `lastVerified` ISO date.
 * This test asserts:
 *   1. Every entry HAS a lastVerified date in valid YYYY-MM-DD format.
 *   2. No entry is older than the configured staleness threshold.
 *
 * When CI fails on staleness, the actionable response is to re-verify
 * the entry against current Levels.fyi / Glassdoor / AmbitionBox data
 * and bump the date.
 */

import { describe, it, expect } from "vitest";
import { COMPANY_SALARY_OVERRIDES } from "../../data/company-salary-overrides";
import { COMPANY_KNOWN_FACTS } from "../../data/company-known-facts";

/* Threshold: warn at 6 months, fail at 12 months. */
const WARN_DAYS = 180;
const FAIL_DAYS = 365;

function ageInDays(isoDate: string): number {
  const verified = new Date(isoDate).getTime();
  if (isNaN(verified)) return Infinity;
  return Math.floor((Date.now() - verified) / (1000 * 60 * 60 * 24));
}

interface StaleEntry {
  path: string;
  lastVerified: string;
  ageDays: number;
}

describe("data freshness — lastVerified dates", () => {
  it("every salary-override entry has a valid YYYY-MM-DD lastVerified date", () => {
    const invalid: string[] = [];
    for (const [company, roleMap] of Object.entries(COMPANY_SALARY_OVERRIDES)) {
      for (const [role, levels] of Object.entries(roleMap ?? {})) {
        for (const [level, band] of Object.entries(levels ?? {})) {
          if (!band) continue;
          const path = `${company} > ${role} > ${level}`;
          if (!band.lastVerified) {
            invalid.push(`${path}: missing lastVerified`);
            continue;
          }
          if (!/^\d{4}-\d{2}-\d{2}$/.test(band.lastVerified)) {
            invalid.push(`${path}: invalid format "${band.lastVerified}"`);
          }
        }
      }
    }
    expect(invalid.length, `Invalid lastVerified entries:\n  ${invalid.slice(0, 10).join("\n  ")}`).toBe(0);
  });

  it("every KNOWN_FACTS entry has a valid YYYY-MM-DD lastVerified date", () => {
    for (const [company, facts] of Object.entries(COMPANY_KNOWN_FACTS)) {
      expect(facts.lastVerified, `${company} missing lastVerified`).toBeTruthy();
      expect(facts.lastVerified, `${company} has invalid lastVerified format`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("warns when entries are older than 6 months (soft signal)", () => {
    const stale: StaleEntry[] = [];
    for (const [company, roleMap] of Object.entries(COMPANY_SALARY_OVERRIDES)) {
      for (const [role, levels] of Object.entries(roleMap ?? {})) {
        for (const [level, band] of Object.entries(levels ?? {})) {
          if (!band?.lastVerified) continue;
          const days = ageInDays(band.lastVerified);
          if (days > WARN_DAYS) {
            stale.push({ path: `${company} > ${role} > ${level}`, lastVerified: band.lastVerified, ageDays: days });
          }
        }
      }
    }
    if (stale.length > 0) {
      const sample = stale.sort((a, b) => b.ageDays - a.ageDays).slice(0, 10);
      process.stderr.write(`\n⚠️  ${stale.length} salary entries older than ${WARN_DAYS} days:\n`);
      for (const s of sample) {
        process.stderr.write(`  ${s.path}: ${s.lastVerified} (${s.ageDays}d old)\n`);
      }
    }
    /* Soft assertion — surface for visibility, don't fail. */
    expect(true).toBe(true);
  });

  it("FAILS CI when entries are older than 12 months (hard signal)", () => {
    const ancient: StaleEntry[] = [];
    for (const [company, roleMap] of Object.entries(COMPANY_SALARY_OVERRIDES)) {
      for (const [role, levels] of Object.entries(roleMap ?? {})) {
        for (const [level, band] of Object.entries(levels ?? {})) {
          if (!band?.lastVerified) continue;
          const days = ageInDays(band.lastVerified);
          if (days > FAIL_DAYS) {
            ancient.push({ path: `${company} > ${role} > ${level}`, lastVerified: band.lastVerified, ageDays: days });
          }
        }
      }
    }
    if (ancient.length > 0) {
      const list = ancient.slice(0, 20).map(s => `  ${s.path}: ${s.lastVerified} (${s.ageDays}d old)`).join("\n");
      throw new Error(`${ancient.length} salary entries are >${FAIL_DAYS} days old. Re-verify against Levels.fyi / Glassdoor / AmbitionBox 2026-2027 data:\n${list}`);
    }
    expect(ancient.length).toBe(0);
  });
});
