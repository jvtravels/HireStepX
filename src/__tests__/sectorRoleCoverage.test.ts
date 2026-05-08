import { describe, it, expect } from "vitest";
import { COMPANY_SALARY_OVERRIDES } from "../../data/company-salary-overrides";

/* Sector role-coverage gate. Long-tail companies (10k+ in the autocomplete)
 * resolve via classifyCompanyType() → __sector_* bucket. If a sector bucket
 * only defines `software-engineer`, every non-SE candidate at every long-tail
 * company falls through to the generic fallback band — silently producing
 * misleading negotiation guidance.
 *
 * This test fails the build if any sector is missing a band for one of the
 * canonical role keys, forcing a fix instead of a silent regression. */

const REQUIRED_ROLES = [
  "software-engineer",
  "product-manager",
  "ux-designer",
  "ml-engineer",
  "data-scientist",
  "devops-sre",
  "data-analyst",
  "business-analyst",
  "sales",
  "marketing",
  "finance",
  "operations",
  "customer-success",
  "hr",
] as const;

describe("sector role coverage", () => {
  const sectorKeys = Object.keys(COMPANY_SALARY_OVERRIDES).filter((k) =>
    k.startsWith("__sector_"),
  );

  it("has at least one __sector_* entry registered", () => {
    expect(sectorKeys.length).toBeGreaterThan(20);
  });

  it("every sector covers all canonical role keys", () => {
    const missing: Record<string, string[]> = {};
    for (const sector of sectorKeys) {
      const roleMap = COMPANY_SALARY_OVERRIDES[sector] ?? {};
      const gaps = REQUIRED_ROLES.filter((r) => !(r in roleMap));
      if (gaps.length) missing[sector] = gaps;
    }
    expect(missing).toEqual({});
  });
});
