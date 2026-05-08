import { describe, it, expect } from "vitest";
import { COMPANY_META } from "../../data/company-salary-overrides";
import { getCompanyTier } from "../../data/company-tiers";

/* Typo guard for COMPANY_META keys.
 *
 * COMPANY_META is matched against the user's typed company name via
 * loose containment (lookupCompanyMeta in salary-lookup.ts). A typo in
 * the key here ("razorpaay" instead of "razorpay") would silently
 * disable the metadata for that company — no test failure, no runtime
 * error, just wrong notice/bond data quoted to the candidate.
 *
 * This test asserts each COMPANY_META key resolves to a known company
 * tier via getCompanyTier(). If the company isn't in COMPANY_TIER_MAP
 * (which is hand-curated) the metadata can't be applied, so flag it. */

describe("COMPANY_META consistency", () => {
  it("every COMPANY_META key resolves to a known tier", () => {
    const orphans: string[] = [];
    for (const key of Object.keys(COMPANY_META)) {
      const tier = getCompanyTier(key);
      if (!tier) orphans.push(key);
    }
    expect(orphans, `Orphan COMPANY_META keys (typo? add to company-tiers.ts):\n  ${orphans.join("\n  ")}`).toEqual([]);
  });

  it("every COMPANY_META entry has at least one populated field", () => {
    const empties: string[] = [];
    for (const [key, meta] of Object.entries(COMPANY_META)) {
      const hasField = meta.noticePeriodDays !== undefined
        || meta.bondPenaltyLpa !== undefined
        || meta.hasDeputation !== undefined;
      if (!hasField) empties.push(key);
    }
    expect(empties, `COMPANY_META entries with no facts:\n  ${empties.join("\n  ")}`).toEqual([]);
  });

  it("every COMPANY_META entry declares a metaSource", () => {
    const noSource: string[] = [];
    for (const [key, meta] of Object.entries(COMPANY_META)) {
      if (!meta.metaSource || meta.metaSource.trim().length === 0) {
        noSource.push(key);
      }
    }
    expect(noSource, `COMPANY_META entries without metaSource attribution:\n  ${noSource.join("\n  ")}`).toEqual([]);
  });

  it("notice-period values are realistic (15-180 days)", () => {
    const outliers: string[] = [];
    for (const [key, meta] of Object.entries(COMPANY_META)) {
      if (meta.noticePeriodDays !== undefined) {
        if (meta.noticePeriodDays < 15 || meta.noticePeriodDays > 180) {
          outliers.push(`${key}: ${meta.noticePeriodDays}d`);
        }
      }
    }
    expect(outliers, `Notice-period outliers:\n  ${outliers.join("\n  ")}`).toEqual([]);
  });

  it("bond penalties are realistic (0-15 LPA)", () => {
    const outliers: string[] = [];
    for (const [key, meta] of Object.entries(COMPANY_META)) {
      if (meta.bondPenaltyLpa !== undefined) {
        if (meta.bondPenaltyLpa < 0 || meta.bondPenaltyLpa > 15) {
          outliers.push(`${key}: ₹${meta.bondPenaltyLpa} LPA`);
        }
      }
    }
    expect(outliers, `Bond-penalty outliers:\n  ${outliers.join("\n  ")}`).toEqual([]);
  });
});
