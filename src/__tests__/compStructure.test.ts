import { describe, it, expect } from "vitest";
import {
  extractSalesOTE,
  extractContractRate,
} from "../../server-handlers/_comp-structure";

describe("extractSalesOTE", () => {
  it("detects 'OTE of ₹40L'", () => {
    const r = extractSalesOTE("My OTE of ₹40L is competitive");
    expect(r.oteAmount).toBe(40);
    expect(r.hasAny).toBe(true);
  });

  it("detects reverse '40 LPA OTE'", () => {
    const r = extractSalesOTE("looking at 40 LPA OTE");
    expect(r.oteAmount).toBe(40);
  });

  it("detects OTI (On-Target Incentive)", () => {
    const r = extractSalesOTE("OTI 35 lakhs at my current firm");
    expect(r.oteAmount).toBe(35);
  });

  it("flags quotesOteAsGuaranteed when only OTE stated", () => {
    const r = extractSalesOTE("my package is ₹40L OTE");
    expect(r.quotesOteAsGuaranteed).toBe(true);
  });

  it("does NOT flag quotesOteAsGuaranteed when base also stated", () => {
    const r = extractSalesOTE("OTE of ₹40L with base of ₹25L");
    expect(r.oteAmount).toBe(40);
    expect(r.baseAmount).toBe(25);
    expect(r.quotesOteAsGuaranteed).toBe(false);
  });

  it("does NOT flag quotesOteAsGuaranteed when attainment also stated", () => {
    const r = extractSalesOTE("OTE of ₹40L and I hit 110% last year");
    expect(r.attainmentPct).toBe(110);
    expect(r.quotesOteAsGuaranteed).toBe(false);
  });

  it("parses attainment 'achieved 95% of quota'", () => {
    const r = extractSalesOTE("OTE ₹40L; achieved 95% of quota");
    expect(r.attainmentPct).toBe(95);
  });

  it("rejects out-of-range attainment", () => {
    const r = extractSalesOTE("OTE ₹40L; achieved 500% of quota");
    expect(r.attainmentPct).toBe(null);
  });

  it("ignores 'base' mention outside OTE conversation", () => {
    const r = extractSalesOTE("base of ₹25L as an SWE");
    expect(r.baseAmount).toBe(null);
    expect(r.hasAny).toBe(false);
  });

  it("empty text returns empty result", () => {
    const r = extractSalesOTE("");
    expect(r.hasAny).toBe(false);
    expect(r.quotesOteAsGuaranteed).toBe(false);
  });
});

describe("extractContractRate", () => {
  it("detects '₹10K/day'", () => {
    const r = extractContractRate("I charge ₹10K/day for consulting");
    expect(r.dayRate).toBe(10000);
    expect(r.hasAny).toBe(true);
  });

  it("detects '10,000 per day'", () => {
    const r = extractContractRate("rate is Rs 10,000 per day");
    expect(r.dayRate).toBe(10000);
  });

  it("detects monthly retainer '₹3L/month'", () => {
    const r = extractContractRate("monthly retainer of ₹3L");
    expect(r.monthlyRetainer).toBe(300000);
  });

  it("detects utilization '85% utilization'", () => {
    const r = extractContractRate("I run at 85% utilization typically");
    expect(r.utilizationPct).toBe(85);
  });

  it("detects 'bill 22 days/month' → ~100%", () => {
    const r = extractContractRate("I bill 22 days/month");
    expect(r.utilizationPct).toBe(100);
  });

  it("flags dayRateAsAnnualConfusion when day rate + matching annual + no utilization", () => {
    /* ₹10K/day × 250 = ₹25L annual */
    const r = extractContractRate("I charge ₹10K/day so that's ₹25L per year");
    expect(r.dayRate).toBe(10000);
    expect(r.dayRateAsAnnualConfusion).toBe(true);
  });

  it("does NOT flag dayRateAsAnnualConfusion when utilization mentioned", () => {
    const r = extractContractRate(
      "I charge ₹10K/day at 85% utilization, makes ₹25L per year",
    );
    expect(r.dayRateAsAnnualConfusion).toBe(false);
  });

  it("does NOT flag when annual figure inconsistent with day rate", () => {
    /* ₹10K/day × 250 = ₹25L, but candidate says ₹40L — not the confusion */
    const r = extractContractRate("I charge ₹10K/day, target ₹40L per annum");
    expect(r.dayRateAsAnnualConfusion).toBe(false);
  });

  it("empty text returns empty result", () => {
    const r = extractContractRate("");
    expect(r.hasAny).toBe(false);
    expect(r.dayRateAsAnnualConfusion).toBe(false);
  });

  it("ignores nonsense bare numbers below ₹500/day floor", () => {
    const r = extractContractRate("I charge 100 per day");
    expect(r.dayRate).toBe(null);
  });
});
