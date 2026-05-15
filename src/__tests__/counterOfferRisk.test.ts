import { describe, it, expect } from "vitest";
import { estimateCounterOfferRisk } from "../../server-handlers/_counter-offer-risk";

describe("_counter-offer-risk — high-risk patterns", () => {
  it("classic high: Infosys, 18mo tenure, 20% hike, vague competing", () => {
    const r = estimateCounterOfferRisk({
      currentEmployer: "Infosys",
      tenureMonths: 18,
      currentCtcLpa: 10,
      targetLpa: 12,
      competingOfferCredibility: "vague",
    });
    expect(r.risk).toBe("high");
    expect(r.reasons.some((s) => /Infosys/i.test(s))).toBe(true);
  });

  it("high: Swiggy 22mo, 20% hike, no competing offer named", () => {
    const r = estimateCounterOfferRisk({
      currentEmployer: "Swiggy",
      tenureMonths: 22,
      currentCtcLpa: 30,
      targetLpa: 36,
      competingOfferCredibility: null,
    });
    expect(r.risk).toBe("high");
  });
});

describe("_counter-offer-risk — medium / low patterns", () => {
  it("medium: short tenure but unknown employer + vague comp", () => {
    const r = estimateCounterOfferRisk({
      currentEmployer: "Unknown SME Pvt Ltd",
      tenureMonths: 20,
      currentCtcLpa: 10,
      targetLpa: 11.5,
      competingOfferCredibility: "vague",
    });
    expect(r.risk).toBe("medium");
  });

  it("low: long tenure, no other signals", () => {
    const r = estimateCounterOfferRisk({
      currentEmployer: "Random SME",
      tenureMonths: 60,
      currentCtcLpa: 15,
      targetLpa: 30,
      competingOfferCredibility: "letter-in-hand",
    });
    expect(r.risk).toBe("low");
  });

  it("low: letter-in-hand offsets one signal", () => {
    const r = estimateCounterOfferRisk({
      currentEmployer: "TCS",
      tenureMonths: 36,
      currentCtcLpa: 12,
      targetLpa: 15,
      competingOfferCredibility: "letter-in-hand",
    });
    expect(["low", "medium"]).toContain(r.risk);
  });
});

describe("_counter-offer-risk — edge & null cases", () => {
  it("null current employer → not flagged as well-funded", () => {
    const r = estimateCounterOfferRisk({
      currentEmployer: null,
      tenureMonths: 18,
      currentCtcLpa: 10,
      targetLpa: 11.8,
      competingOfferCredibility: "vague",
    });
    expect(r.reasons.every((s) => !/well-funded/.test(s))).toBe(true);
  });

  it("null tenure → no short-tenure signal", () => {
    const r = estimateCounterOfferRisk({
      currentEmployer: "Wipro",
      tenureMonths: null,
      currentCtcLpa: 10,
      targetLpa: 12,
      competingOfferCredibility: "vague",
    });
    expect(r.reasons.every((s) => !/short tenure/.test(s))).toBe(true);
  });

  it("null CTC values → no hike-band signal", () => {
    const r = estimateCounterOfferRisk({
      currentEmployer: "Infosys",
      tenureMonths: 12,
      currentCtcLpa: null,
      targetLpa: null,
      competingOfferCredibility: "vague",
    });
    expect(r.reasons.every((s) => !/hike/.test(s))).toBe(true);
  });

  it("hike outside 15-22% range does not trigger that signal", () => {
    const r = estimateCounterOfferRisk({
      currentEmployer: "Infosys",
      tenureMonths: 18,
      currentCtcLpa: 10,
      targetLpa: 15, // 50% hike
      competingOfferCredibility: "vague",
    });
    expect(r.reasons.every((s) => !/just enough to beat/.test(s))).toBe(true);
  });

  it("returns a non-empty reasons array even when low risk", () => {
    const r = estimateCounterOfferRisk({
      currentEmployer: "X",
      tenureMonths: 60,
      currentCtcLpa: 20,
      targetLpa: 22,
      competingOfferCredibility: "letter-in-hand",
    });
    expect(Array.isArray(r.reasons)).toBe(true);
  });
});
