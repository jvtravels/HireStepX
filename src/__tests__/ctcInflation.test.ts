import { describe, it, expect } from "vitest";
import {
  CTC_INFLATION_MIX,
  buildCtcInflationBreakdown,
  renderCtcInflationAnchor,
  renderCtcInflationTruth,
} from "../../server-handlers/_ctc-inflation";

describe("CTC_INFLATION_MIX", () => {
  it("percentages sum to exactly 100", () => {
    const sum =
      CTC_INFLATION_MIX.fixedPct +
      CTC_INFLATION_MIX.variablePct +
      CTC_INFLATION_MIX.esopPaperPct +
      CTC_INFLATION_MIX.joiningBonusPct +
      CTC_INFLATION_MIX.benefitsPct;
    expect(sum).toBe(100);
  });

  it("fixed component is the largest (candidate's guaranteed cash)", () => {
    expect(CTC_INFLATION_MIX.fixedPct).toBeGreaterThan(CTC_INFLATION_MIX.variablePct);
    expect(CTC_INFLATION_MIX.fixedPct).toBeGreaterThan(CTC_INFLATION_MIX.esopPaperPct);
    expect(CTC_INFLATION_MIX.fixedPct).toBeGreaterThan(CTC_INFLATION_MIX.joiningBonusPct);
    expect(CTC_INFLATION_MIX.fixedPct).toBeGreaterThan(CTC_INFLATION_MIX.benefitsPct);
  });
});

describe("buildCtcInflationBreakdown", () => {
  it("all components sum to ≈ ctcLpa", () => {
    const br = buildCtcInflationBreakdown(30);
    const sum =
      br.fixedLpa +
      br.variableLpa +
      br.esopPaperLpa +
      br.joiningBonusLpa +
      br.benefitsLpa;
    // Rounding to 1 decimal can cause small delta
    expect(Math.abs(sum - br.ctcLpa)).toBeLessThanOrEqual(0.5);
  });

  it("returns all-zero breakdown for zero input", () => {
    const br = buildCtcInflationBreakdown(0);
    expect(br.ctcLpa).toBe(0);
    expect(br.fixedLpa).toBe(0);
    expect(br.variableLpa).toBe(0);
    expect(br.esopPaperLpa).toBe(0);
  });

  it("handles negative input gracefully (returns zero breakdown)", () => {
    const br = buildCtcInflationBreakdown(-10);
    expect(br.ctcLpa).toBe(0);
    expect(br.fixedLpa).toBe(0);
  });

  it("fixedLpa is always 60% of ctcLpa", () => {
    const br = buildCtcInflationBreakdown(25);
    expect(br.fixedLpa).toBeCloseTo(25 * 0.6, 0);
  });

  it("all components are non-negative", () => {
    const br = buildCtcInflationBreakdown(40);
    expect(br.fixedLpa).toBeGreaterThan(0);
    expect(br.variableLpa).toBeGreaterThan(0);
    expect(br.esopPaperLpa).toBeGreaterThan(0);
    expect(br.joiningBonusLpa).toBeGreaterThan(0);
    expect(br.benefitsLpa).toBeGreaterThan(0);
  });
});

describe("renderCtcInflationAnchor", () => {
  it("contains the CTC headline figure", () => {
    const br = buildCtcInflationBreakdown(30);
    const text = renderCtcInflationAnchor(br);
    expect(text).toContain("30L");
    expect(text).toContain("total package");
  });

  it("mentions all components in the anchor text", () => {
    const br = buildCtcInflationBreakdown(20);
    const text = renderCtcInflationAnchor(br);
    expect(text).toContain("fixed");
    expect(text).toContain("variable");
    expect(text).toContain("ESOP");
    expect(text).toContain("joining bonus");
  });

  it("does not expose the 'guaranteed cash' framing (that is the truth version)", () => {
    const br = buildCtcInflationBreakdown(20);
    const anchor = renderCtcInflationAnchor(br);
    const truth = renderCtcInflationTruth(br);
    // Truth response names what's guaranteed; anchor does not
    expect(truth).toContain("guaranteed");
    expect(anchor).not.toContain("guaranteed");
  });
});

describe("renderCtcInflationTruth", () => {
  it("explicitly names the guaranteed cash component", () => {
    const br = buildCtcInflationBreakdown(24);
    const text = renderCtcInflationTruth(br);
    expect(text).toContain("guaranteed cash");
    expect(text).toContain(`₹${br.fixedLpa}L fixed`);
  });

  it("warns that variable pay is at-risk", () => {
    const br = buildCtcInflationBreakdown(30);
    const text = renderCtcInflationTruth(br);
    expect(text).toContain("at-risk");
  });

  it("mentions ESOP vesting risk", () => {
    const br = buildCtcInflationBreakdown(50);
    const text = renderCtcInflationTruth(br);
    expect(text.toLowerCase()).toContain("esop");
    expect(text).toContain("vesting");
  });

  it("repeats the full CTC headline so the candidate can see the gap", () => {
    const br = buildCtcInflationBreakdown(35);
    const text = renderCtcInflationTruth(br);
    expect(text).toContain(`₹${br.ctcLpa}L`);
  });
});
