/* Audit fix 2026-05-21 — joining-bonus clawback scaling (Product Lie #2).
 *
 * The canonical-prose hard-coded "standard 12-month clawback" on every
 * joining-bonus mention. Real Indian clawbacks scale with amount AND
 * company tier: small-bonus 12mo, mid 18mo half-cliff, large 24mo two-
 * cliffs; IT-services 24mo SERVICE BOND; MNC India 24mo full-on-early.
 *
 * Tests pin the resolver behaviour. */
import { describe, it, expect } from "vitest";
import {
  clawbackForJoiningBonus,
  clawbackForCompany,
  SMALL_BONUS_CAP_LPA,
  MID_BONUS_CAP_LPA,
} from "../../../server-handlers/_joining-bonus-clawback";

describe("clawback scaling (audit fix #2)", () => {
  it("small bonus (<= 5 LPA) at a non-tiered company is 12-month pro-rata", () => {
    const cb = clawbackForJoiningBonus(3, "indian-unicorn");
    expect(cb.months).toBe(12);
    expect(cb.structure).toBe("standard-monthly-prorated");
    expect(cb.description).toMatch(/12-month/);
    expect(cb.description).toMatch(/pro-rated monthly/);
  });

  it("boundary at 5 LPA lands in the small tier", () => {
    expect(clawbackForJoiningBonus(SMALL_BONUS_CAP_LPA, "indian-unicorn").months).toBe(12);
  });

  it("mid bonus (5L-15L) at a non-tiered company is 18mo with 6mo half-cliff", () => {
    const cb = clawbackForJoiningBonus(10, "indian-unicorn");
    expect(cb.months).toBe(18);
    expect(cb.structure).toBe("half-cliff-then-prorated");
    expect(cb.description).toMatch(/18-month/);
    expect(cb.description).toMatch(/50% cliff at 6 months/);
  });

  it("boundary at 15 LPA lands in the mid tier", () => {
    expect(clawbackForJoiningBonus(MID_BONUS_CAP_LPA, "indian-unicorn").months).toBe(18);
  });

  it("large bonus (>15L) at a non-tiered company is 24mo two-cliffs", () => {
    const cb = clawbackForJoiningBonus(20, "indian-unicorn");
    expect(cb.months).toBe(24);
    expect(cb.structure).toBe("two-cliffs");
    expect(cb.description).toMatch(/24-month/);
    expect(cb.description).toMatch(/two cliffs/);
  });

  it("IT-services tier uses SERVICE BOND language regardless of amount", () => {
    const small = clawbackForJoiningBonus(2, "it-services");
    const large = clawbackForJoiningBonus(20, "it-services");
    expect(small.months).toBe(24);
    expect(large.months).toBe(24);
    expect(small.structure).toBe("it-services-service-bond");
    expect(large.structure).toBe("it-services-service-bond");
    expect(small.description).toMatch(/service bond/i);
  });

  it("MNC India tiers (FAANG / Big-Tech / GCC) standardise on 24mo full-on-early", () => {
    for (const tier of ["faang", "big-tech", "gcc", "bfsi-global"] as const) {
      const cb = clawbackForJoiningBonus(8, tier);
      expect(cb.months).toBe(24);
      expect(cb.structure).toBe("mnc-full-on-early-exit");
      expect(cb.description).toMatch(/full repayment/i);
    }
  });

  it("clawbackForCompany resolves the tier from a company name", () => {
    // TCS -> IT services -> service bond
    expect(clawbackForCompany(5, "TCS").structure).toBe("it-services-service-bond");
    // Google India -> FAANG -> MNC standard
    expect(clawbackForCompany(5, "Google").structure).toBe("mnc-full-on-early-exit");
    // Razorpay -> indian-unicorn -> amount-tier ladder (5L -> small)
    expect(clawbackForCompany(5, "Razorpay").months).toBe(12);
    expect(clawbackForCompany(10, "Razorpay").months).toBe(18);
    expect(clawbackForCompany(20, "Razorpay").months).toBe(24);
  });

  it("non-finite / non-positive amount lands safely in the small tier", () => {
    expect(clawbackForJoiningBonus(0, "indian-unicorn").months).toBe(12);
    expect(clawbackForJoiningBonus(-5, "indian-unicorn").months).toBe(12);
    expect(clawbackForJoiningBonus(NaN, "indian-unicorn").months).toBe(12);
    expect(clawbackForJoiningBonus(Infinity, "indian-unicorn").months).toBe(12);
  });

  it("null company tier falls through to amount ladder", () => {
    const cb = clawbackForJoiningBonus(7, null);
    expect(cb.months).toBe(18);
  });
});
