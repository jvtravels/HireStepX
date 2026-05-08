import { describe, it, expect } from "vitest";
import { computeEquityGrant } from "../_equity-literacy";

describe("computeEquityGrant", () => {
  it("RSU at face value with 100% liquidity preserves full-vest", () => {
    const out = computeEquityGrant({ totalGrantLpa: 40, equityType: "rsu", liquidityFactor: 1.0 });
    expect(out.fullVestRealisticLpa).toBeCloseTo(40, 1);
    expect(out.realisticPctOfFace).toBeCloseTo(100, 0);
  });

  it("pre-IPO ESOP at default 30% liquidity loses 70% of face", () => {
    const out = computeEquityGrant({ totalGrantLpa: 40, equityType: "esop" });
    expect(out.fullVestRealisticLpa).toBeCloseTo(12, 1);
    expect(out.realisticPctOfFace).toBeCloseTo(30, 0);
  });

  it("cliff value is 25% of face for default 4yr / 1yr cliff", () => {
    const out = computeEquityGrant({ totalGrantLpa: 100, equityType: "rsu", liquidityFactor: 1 });
    // 12-month cliff out of 48 = 25%.
    expect(out.cliffRealisticLpa).toBeCloseTo(25, 0);
  });

  it("perquisite tax is owed on full face at marginal rate", () => {
    const out = computeEquityGrant({
      totalGrantLpa: 40,
      equityType: "esop",
      strikePctOfFmv: 0,
      marginalTaxRate: 0.30,
    });
    // 40 × (1 - 0) × 0.30 = 12 LPA tax owed.
    expect(out.perquisiteTaxAtFullVestLpa).toBeCloseTo(12, 1);
  });

  it("net-after-tax goes negative-ish when perquisite tax > liquid value", () => {
    // Pre-IPO ESOP face ₹40L at 30% liquidity = ₹12L realistic.
    // Tax = ₹12L. Net = ~0. This is the "ESOP trap" the helper warns about.
    const out = computeEquityGrant({
      totalGrantLpa: 40,
      equityType: "esop",
      liquidityFactor: 0.30,
      marginalTaxRate: 0.30,
    });
    expect(out.netAfterTaxLpa).toBeLessThan(1);
  });

  it("strike at 50% of FMV halves realistic value", () => {
    const free = computeEquityGrant({ totalGrantLpa: 40, equityType: "esop", strikePctOfFmv: 0, liquidityFactor: 1 });
    const half = computeEquityGrant({ totalGrantLpa: 40, equityType: "esop", strikePctOfFmv: 0.5, liquidityFactor: 1 });
    expect(half.fullVestRealisticLpa).toBeCloseTo(free.fullVestRealisticLpa * 0.5, 1);
  });

  it("vest schedule has correct cumulative face at full vest", () => {
    const out = computeEquityGrant({ totalGrantLpa: 100, equityType: "rsu", vestYears: 4 });
    const last = out.vestSchedule[out.vestSchedule.length - 1]!;
    expect(last.monthsFromGrant).toBe(48);
    expect(last.cumulativeFaceLpa).toBeCloseTo(100, 0);
  });

  it("vest schedule cliff entry shows 25% at 12 months for 4yr/1yr cliff", () => {
    const out = computeEquityGrant({ totalGrantLpa: 100, equityType: "rsu" });
    const cliff = out.vestSchedule.find(v => v.monthsFromGrant === 12);
    expect(cliff).toBeDefined();
    expect(cliff!.cumulativeFaceLpa).toBeCloseTo(25, 0);
  });

  it("zero-cliff vest immediately shows full schedule from month 12", () => {
    const out = computeEquityGrant({ totalGrantLpa: 100, equityType: "rsu", cliffMonths: 0 });
    expect(out.vestSchedule[0]!.monthsFromGrant).toBe(12);
  });

  it("clamps absurd inputs safely (negative grant, >100% strike)", () => {
    const out1 = computeEquityGrant({ totalGrantLpa: -10, equityType: "rsu" });
    expect(out1.fullVestRealisticLpa).toBe(0);
    const out2 = computeEquityGrant({ totalGrantLpa: 40, equityType: "esop", strikePctOfFmv: 5 });
    // 5x strike clamps to 1 (100%); net realistic should be ~0.
    expect(out2.fullVestRealisticLpa).toBeCloseTo(0, 0);
  });
});
