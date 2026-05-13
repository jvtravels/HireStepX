import { describe, it, expect } from "vitest";
import {
  extractSalesOTE,
  extractContractRate,
  mergeSalesOTE,
  mergeContractRate,
  EMPTY_SALES_OTE,
  EMPTY_CONTRACT_RATE,
} from "../../server-handlers/_comp-structure";
import { initState, applyCandidateAnswer } from "../../server-handlers/_negotiation-kernel";

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

describe("Phase 24c — comp-structure merge semantics", () => {
  it("mergeSalesOTE last-stated-wins for numeric fields", () => {
    const prior = mergeSalesOTE(null, extractSalesOTE("OTE ₹35L"));
    const next = extractSalesOTE("OTE ₹40L");
    const merged = mergeSalesOTE(prior, next);
    expect(merged.oteAmount).toBe(40);
  });

  it("mergeSalesOTE retains prior numeric when next has none", () => {
    const prior = mergeSalesOTE(null, extractSalesOTE("OTE ₹40L"));
    const next = extractSalesOTE("just thinking about this");
    const merged = mergeSalesOTE(prior, next);
    expect(merged.oteAmount).toBe(40);
  });

  it("mergeSalesOTE quotesOteAsGuaranteed is sticky", () => {
    const prior = mergeSalesOTE(null, extractSalesOTE("my package is ₹40L OTE"));
    expect(prior.quotesOteAsGuaranteed).toBe(true);
    /* Even after candidate adds base, the prior breach stays on the record. */
    const next = extractSalesOTE("base is ₹25L by the way");
    const merged = mergeSalesOTE(prior, next);
    expect(merged.quotesOteAsGuaranteed).toBe(true);
  });

  it("mergeContractRate confusion flag is monotone-up", () => {
    const prior = mergeContractRate(
      null,
      extractContractRate("₹10K/day, so ₹25L per year"),
    );
    expect(prior.dayRateAsAnnualConfusion).toBe(true);
    const next = extractContractRate("at 85% utilization that becomes ₹21L");
    const merged = mergeContractRate(prior, next);
    /* Flag stays — recruiter would remember the earlier confusion. */
    expect(merged.dayRateAsAnnualConfusion).toBe(true);
    /* Utilization NOW arrives — fresh fact wins. */
    expect(merged.utilizationPct).toBe(85);
  });

  it("merge handles null prior", () => {
    const fresh = extractSalesOTE("OTE ₹40L");
    expect(mergeSalesOTE(null, fresh).oteAmount).toBe(40);
  });

  it("EMPTY constants are well-formed", () => {
    expect(EMPTY_SALES_OTE.hasAny).toBe(false);
    expect(EMPTY_CONTRACT_RATE.hasAny).toBe(false);
  });

  it("kernel applyCandidateAnswer merges salesOTE across turns", () => {
    const s0 = initState({
      sessionId: "s1",
      role: "ae",
      company: "Acme",
      band: { initialOffer: 30, maxStretch: 45, walkAway: 26, hasEquity: false },
    });
    expect(s0.salesOTE.hasAny).toBe(false);

    const s1 = applyCandidateAnswer(s0, "My package is ₹40L OTE.");
    expect(s1.salesOTE.oteAmount).toBe(40);
    expect(s1.salesOTE.quotesOteAsGuaranteed).toBe(true);

    /* Subsequent turn adds base + attainment (re-stating OTE context
     * so the parser can scope safely — see _comp-structure.ts comment).
     * OTE persists across turns; the earlier "as-guaranteed" breach
     * stays sticky even though the candidate now provides context. */
    const s2 = applyCandidateAnswer(
      s1,
      "Sorry — that OTE of ₹40L breaks down as ₹25L base, and I hit 105% attainment last year.",
    );
    expect(s2.salesOTE.oteAmount).toBe(40);
    expect(s2.salesOTE.baseAmount).toBe(25);
    expect(s2.salesOTE.attainmentPct).toBe(105);
    expect(s2.salesOTE.quotesOteAsGuaranteed).toBe(true);
  });

  it("kernel applyCandidateAnswer merges contractRate across turns", () => {
    const s0 = initState({
      sessionId: "s1",
      role: "swe",
      company: "Acme",
      band: { initialOffer: 22, maxStretch: 30, walkAway: 18, hasEquity: false },
    });
    const s1 = applyCandidateAnswer(s0, "I charge ₹10K/day, makes ₹25L per year.");
    expect(s1.contractRate.dayRate).toBe(10000);
    expect(s1.contractRate.dayRateAsAnnualConfusion).toBe(true);

    const s2 = applyCandidateAnswer(s1, "I run at about 85% utilization.");
    expect(s2.contractRate.dayRate).toBe(10000);
    expect(s2.contractRate.utilizationPct).toBe(85);
    /* Breach is sticky. */
    expect(s2.contractRate.dayRateAsAnnualConfusion).toBe(true);
  });
});
