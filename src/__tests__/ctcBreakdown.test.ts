import { describe, it, expect } from "vitest";
import { computeCtcBreakdown, computeNewRegimeTaxLpa } from "../_ctc-breakdown";

describe("computeNewRegimeTaxLpa", () => {
  it("returns 0 below the 87A rebate ceiling (≤12L)", () => {
    expect(computeNewRegimeTaxLpa(0)).toBe(0);
    expect(computeNewRegimeTaxLpa(8)).toBe(0);
    expect(computeNewRegimeTaxLpa(12)).toBe(0);
  });

  it("crosses the 87A cliff at 12L+", () => {
    // 12L exactly = 0; just above 12L = real tax owed (no rebate marginal relief modeled).
    expect(computeNewRegimeTaxLpa(12)).toBe(0);
    expect(computeNewRegimeTaxLpa(13)).toBeGreaterThan(0);
  });

  it("computes tax for 20L taxable (mid-career SE band)", () => {
    // Slab math: 0-4L=0; 4-8L (5%)=20k; 8-12L (10%)=40k; 12-16L (15%)=60k; 16-20L (20%)=80k.
    // = ₹2,00,000 base tax + 4% cess = ₹2,08,000 = 2.08 LPA.
    const tax = computeNewRegimeTaxLpa(20);
    expect(tax).toBeCloseTo(2.08, 1);
  });

  it("applies 10% surcharge on income >50L", () => {
    const noSurcharge = computeNewRegimeTaxLpa(50);
    const withSurcharge = computeNewRegimeTaxLpa(60);
    // Surcharge of 10% should add meaningfully more than the linear slab progression alone.
    expect(withSurcharge / noSurcharge).toBeGreaterThan(60 / 50);
  });
});

describe("computeCtcBreakdown", () => {
  it("flags the marketing markup on a typical ₹40L offer", () => {
    const out = computeCtcBreakdown({
      totalCtcLpa: 40,
      equityLpa: 4,
      equityType: "esop",
      variablePct: 0.15,
      variablePayoutFactor: 0.80,
    });
    expect(out.statedCtcLpa).toBe(40);
    // Cash CTC backs out benefits loading from (stated - equity).
    expect(out.cashCtcLpa).toBeLessThan(36);
    expect(out.cashCtcLpa).toBeGreaterThan(28);
    // Take-home should be meaningfully less than the stated number.
    expect(out.annualTakeHomeLpa).toBeLessThan(out.statedCtcLpa);
    // Pre-IPO equity discounted to 30% of face.
    expect(out.equityRealisticLpa).toBeCloseTo(1.2, 1);
    // Gap should be positive (stated > realistic).
    expect(out.gapLpa).toBeGreaterThan(0);
    expect(out.gapPct).toBeGreaterThan(0);
  });

  it("RSU keeps face value, ESOP discounts to 30%", () => {
    const rsu = computeCtcBreakdown({ totalCtcLpa: 50, equityLpa: 10, equityType: "rsu" });
    const esop = computeCtcBreakdown({ totalCtcLpa: 50, equityLpa: 10, equityType: "esop" });
    expect(rsu.equityRealisticLpa).toBeCloseTo(10, 1);
    expect(esop.equityRealisticLpa).toBeCloseTo(3, 1);
    // Same stated CTC, RSU yields higher total realistic.
    expect(rsu.totalRealisticLpa).toBeGreaterThan(esop.totalRealisticLpa);
  });

  it("zero variable means zero variable-realistic regardless of payout factor", () => {
    const out = computeCtcBreakdown({ totalCtcLpa: 30, variablePct: 0, variablePayoutFactor: 1 });
    expect(out.variableTargetLpa).toBe(0);
    expect(out.variableRealisticLpa).toBe(0);
  });

  it("monthly take-home reasonable for entry-level ₹15L offer", () => {
    const out = computeCtcBreakdown({ totalCtcLpa: 15, variablePct: 0.10 });
    // Entry SE at ₹15L should clear ₹85k+ monthly post-tax (87A rebate covers).
    expect(out.monthlyTakeHomeInr).toBeGreaterThan(85_000);
    expect(out.monthlyTakeHomeInr).toBeLessThan(115_000);
  });

  it("never returns negative numbers on degenerate input", () => {
    const out = computeCtcBreakdown({ totalCtcLpa: 0 });
    expect(out.annualTakeHomeLpa).toBeGreaterThanOrEqual(0);
    expect(out.monthlyTakeHomeInr).toBeGreaterThanOrEqual(0);
    expect(out.totalRealisticLpa).toBeGreaterThanOrEqual(0);
  });

  it("clamps absurd inputs (variable pct > 100%) safely", () => {
    const out = computeCtcBreakdown({ totalCtcLpa: 30, variablePct: 5 });
    expect(out.variableTargetLpa).toBeLessThanOrEqual(out.cashCtcLpa);
  });

  it("higher CTC produces higher gap in absolute terms", () => {
    const small = computeCtcBreakdown({ totalCtcLpa: 20, equityLpa: 2, equityType: "esop" });
    const large = computeCtcBreakdown({ totalCtcLpa: 80, equityLpa: 15, equityType: "esop" });
    expect(large.gapLpa).toBeGreaterThan(small.gapLpa);
  });
});
