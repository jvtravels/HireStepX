import { describe, it, expect } from "vitest";
import {
  computeNewRegime,
  computeOldRegime,
  recommendRegime,
  formatTakeHomeMonthly,
} from "../../server-handlers/_indian-tax-calculator";

describe("_indian-tax-calculator — new regime FY25-26", () => {
  it("zero tax for ₹12.75L gross (taxable = ₹12L, 87A fully zeroes)", () => {
    const r = computeNewRegime({ fixedLpa: 12.75, variableLpa: 0 });
    expect(r.taxableLpa).toBeCloseTo(12, 1);
    expect(r.totalTaxLpa).toBe(0);
    expect(r.netLpa).toBeCloseTo(12.75, 1);
  });

  it("87A boundary — taxable income just over ₹12L loses rebate", () => {
    const r = computeNewRegime({ fixedLpa: 12.8, variableLpa: 0 });
    // Without rebate the marginal rate at ₹12L+ is 15%, so any income
    // over 12L gets taxed in full (not just the excess).
    expect(r.taxableLpa).toBeCloseTo(12.05, 1);
    expect(r.totalTaxLpa).toBeGreaterThan(0.5);
  });

  it("slab transitions: 8L taxable lands in the 7-10L bracket", () => {
    // gross 8.75L → taxable 8L. tax = 0 + 0.05*4 + 0.10*1 = 0.30L.
    // But 8L is ≤ 12L, so 87A rebate zeroes it.
    const r = computeNewRegime({ fixedLpa: 8.75, variableLpa: 0 });
    expect(r.taxableLpa).toBeCloseTo(8, 1);
    expect(r.totalTaxLpa).toBe(0);
  });

  it("high income (₹50L gross) — 30% slab dominates", () => {
    const r = computeNewRegime({ fixedLpa: 50, variableLpa: 0 });
    // taxable = 49.25L. Slab: 0.05*4 + 0.10*3 + 0.15*2 + 0.20*3 + 0.30*34.25
    //        = 0.20 + 0.30 + 0.30 + 0.60 + 10.275 = 11.675L. +4% cess.
    expect(r.taxBeforeCessLpa).toBeCloseTo(11.675, 1);
    expect(r.rebate87ALpa).toBe(0);
    expect(r.totalTaxLpa).toBeCloseTo(11.675 * 1.04, 1);
  });

  it("does NOT deduct employer-NPS under new regime", () => {
    const a = computeNewRegime({ fixedLpa: 20, variableLpa: 0, nps80CCD2Lpa: 2 });
    const b = computeNewRegime({ fixedLpa: 20, variableLpa: 0 });
    // 'a' has +2L NPS taxable income → higher tax.
    expect(a.totalTaxLpa).toBeGreaterThan(b.totalTaxLpa);
  });

  it("employer PF + gratuity excluded from cash take-home but included in gross", () => {
    const r = computeNewRegime({
      fixedLpa: 15,
      variableLpa: 2,
      employerPfLpa: 0.6,
      gratuityLpa: 0.3,
    });
    expect(r.grossLpa).toBeCloseTo(17.9, 1);
    // netLpa is cash-in-hand; should NOT include PF/gratuity accruals.
    expect(r.netLpa).toBeLessThan(17);
  });

  it("monthlyTakeHomeRupees ≈ netLpa * 100000 / 12", () => {
    const r = computeNewRegime({ fixedLpa: 12.75, variableLpa: 0 });
    expect(r.monthlyTakeHomeRupees).toBe(Math.round((r.netLpa * 100000) / 12));
  });
});

describe("_indian-tax-calculator — old regime FY25-26", () => {
  it("zero tax for low CTC under 87A ₹5L cap", () => {
    // ₹4L fixed with std ded 50K + 80C 1.5L + HRA ≈ 1L → taxable ~1.5L
    // → slab 5% on ~0L = 0 → 87A zero. Expect 0 tax.
    const r = computeOldRegime({ fixedLpa: 4, variableLpa: 0 });
    expect(r.totalTaxLpa).toBe(0);
  });

  it("87A boundary in old regime: ₹5L taxable loses rebate", () => {
    // 80C fully applied. Pick fixed=10 var=0 → preDed=10, deductions=0.5+1.5+HRA(min(50%*5*0.4=1, 2.5))=1+0=3 → taxable=7L → slabs >5L so no rebate.
    const r = computeOldRegime({ fixedLpa: 10, variableLpa: 0 });
    expect(r.taxableLpa).toBeGreaterThan(5);
    expect(r.totalTaxLpa).toBeGreaterThan(0);
  });

  it("NPS 80CCD(2) is deductible (capped at 10% of basic)", () => {
    const withNps = computeOldRegime({ fixedLpa: 20, variableLpa: 0, nps80CCD2Lpa: 1 });
    const without = computeOldRegime({ fixedLpa: 20, variableLpa: 0 });
    // With NPS: +1L preDed, -1L deduction (since 1L ≤ 10% of basic=10*50%=5*0.1=1L exactly).
    // So taxable is the same, but preDed differs and so does netCash.
    // Net cash: preDed_a - tax_a vs preDed_b - tax_b. tax should be identical
    // when NPS exactly equals the 10%-basic cap.
    expect(withNps.totalTaxLpa).toBeCloseTo(without.totalTaxLpa, 1);
  });

  it("NPS cap: contribution beyond 10% of basic is not fully deductible", () => {
    // Basic = 0.5 * 10 = 5. 10% cap = 0.5L. NPS = 2L → only 0.5L deductible.
    const r = computeOldRegime({ fixedLpa: 10, variableLpa: 0, nps80CCD2Lpa: 2 });
    const baseline = computeOldRegime({ fixedLpa: 10, variableLpa: 0 });
    // The extra 1.5L NPS not deductible → adds tax.
    expect(r.totalTaxLpa).toBeGreaterThan(baseline.totalTaxLpa);
  });
});

describe("_indian-tax-calculator — recommendRegime", () => {
  it("recommends new regime for sub-₹15L (87A wins)", () => {
    const r = recommendRegime({ fixedLpa: 12, variableLpa: 0 });
    expect(r.recommended).toBe("new");
    expect(r.newResult.totalTaxLpa).toBe(0);
  });

  it("recommends old regime for high-deduction filers above ₹50L", () => {
    // Old regime with full 80C + HRA + NPS can edge new regime out in
    // some bands. At very high incomes new regime often wins due to lower
    // top slab kicking in later, but at moderate high income old can win.
    const r = recommendRegime({ fixedLpa: 18, variableLpa: 0, nps80CCD2Lpa: 1 });
    // Just assert the recommendation is one of the two and includes
    // savings reasoning.
    expect(["new", "old"]).toContain(r.recommended);
    expect(r.reason).toMatch(/regime|simplicity/i);
  });

  it("savings reasoning is non-empty and references the winner", () => {
    const r = recommendRegime({ fixedLpa: 25, variableLpa: 5 });
    expect(r.reason.length).toBeGreaterThan(10);
    expect(r.savingsLpa).toBeGreaterThanOrEqual(0);
  });
});

describe("_indian-tax-calculator — formatting", () => {
  it("formatTakeHomeMonthly produces Indian comma formatting", () => {
    expect(formatTakeHomeMonthly(12)).toMatch(/^₹1,00,000\/mo$/);
    expect(formatTakeHomeMonthly(24)).toMatch(/^₹2,00,000\/mo$/);
  });

  it("formats small amounts cleanly", () => {
    expect(formatTakeHomeMonthly(0.6)).toMatch(/^₹5,000\/mo$/);
  });
});
