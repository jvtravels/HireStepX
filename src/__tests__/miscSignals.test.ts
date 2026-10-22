import { describe, it, expect } from "vitest";
import {
  extractMiscSignals,
  mergeMiscSignals,
} from "../../server-handlers/_misc-signals";

describe("extractMiscSignals — candidateFloor", () => {
  it("parses 'my floor is 22 LPA'", () => {
    expect(extractMiscSignals("my floor is 22 LPA").candidateFloor).toBe(22);
  });

  it("parses 'won't go below 18'", () => {
    expect(extractMiscSignals("I won't go below 18 LPA").candidateFloor).toBe(18);
  });

  it("parses 'minimum 20 lakhs'", () => {
    expect(extractMiscSignals("minimum 20 lakhs").candidateFloor).toBe(20);
  });

  it("parses 'lowest I can do is 25 LPA'", () => {
    expect(extractMiscSignals("the lowest I can do is 25 LPA").candidateFloor).toBe(25);
  });

  it("returns null when not stated", () => {
    expect(extractMiscSignals("hello").candidateFloor).toBe(null);
  });

  /* OA-B16: "shouldn't" modal + "less than" comparator, incl. third-party relay. */
  it("parses 'shouldn't accept less than ₹70L' (relayed floor)", () => {
    expect(
      extractMiscSignals("my wife says I shouldn't accept less than ₹70L").candidateFloor,
    ).toBe(70);
  });

  it("parses 'should not take under 40 LPA'", () => {
    expect(extractMiscSignals("I should not take under 40 LPA").candidateFloor).toBe(40);
  });

  it("does NOT bind a digit-less hypothetical", () => {
    expect(
      extractMiscSignals("you shouldn't accept less than market").candidateFloor,
    ).toBe(null);
  });
});

describe("extractMiscSignals — salaryReviewMonths", () => {
  it("parses 'salary review after 6 months'", () => {
    expect(extractMiscSignals("salary review after 6 months").salaryReviewMonths).toBe(6);
  });

  it("parses 'review compensation in 12 months'", () => {
    expect(extractMiscSignals("review my compensation in 12 months").salaryReviewMonths).toBe(12);
  });

  it("parses '6-month review'", () => {
    expect(extractMiscSignals("a 6-month review").salaryReviewMonths).toBe(6);
  });

  it("rejects out-of-range", () => {
    expect(extractMiscSignals("review after 60 months").salaryReviewMonths).toBe(null);
  });
});

describe("extractMiscSignals — proofOfCtcShareable", () => {
  it("true on 'can share salary slips'", () => {
    expect(extractMiscSignals("I can share my salary slips").proofOfCtcShareable).toBe(true);
  });

  it("true on 'happy to share offer letter'", () => {
    expect(extractMiscSignals("happy to share the offer letter").proofOfCtcShareable).toBe(true);
  });

  it("false on 'prefer not to share slips'", () => {
    expect(extractMiscSignals("prefer not to share salary slips").proofOfCtcShareable).toBe(false);
  });

  it("null when unstated", () => {
    expect(extractMiscSignals("hello").proofOfCtcShareable).toBe(null);
  });
});

describe("extractMiscSignals — internalCounterRisk", () => {
  it("detects 'received' via 'they offered me a counter'", () => {
    expect(extractMiscSignals("they offered me a counter").internalCounterRisk).toBe("received");
  });

  it("detects 'rejected' via 'turned down the counter-offer'", () => {
    expect(extractMiscSignals("I already turned down the counter-offer").internalCounterRisk).toBe("rejected");
  });

  it("detects 'asked' via 'spoke to my manager about a raise'", () => {
    expect(extractMiscSignals("I spoke to my manager about a raise internally").internalCounterRisk).toBe("asked");
  });

  it("rejected takes precedence over received", () => {
    expect(
      extractMiscSignals("they offered me a counter but I turned down the counter-offer").internalCounterRisk,
    ).toBe("rejected");
  });
});

describe("extractMiscSignals — hasAny + merge", () => {
  it("false on empty", () => {
    expect(extractMiscSignals("").hasAny).toBe(false);
  });

  it("true when any field set", () => {
    expect(extractMiscSignals("my floor is 20 LPA").hasAny).toBe(true);
  });

  it("merge: non-null overrides prior", () => {
    const prior = extractMiscSignals("floor 20 LPA");
    const next = extractMiscSignals("floor 22 LPA");
    expect(mergeMiscSignals(prior, next).candidateFloor).toBe(22);
  });

  it("merge: null preserves prior", () => {
    const prior = extractMiscSignals("floor 20 LPA");
    const next = extractMiscSignals("review after 6 months");
    const m = mergeMiscSignals(prior, next);
    expect(m.candidateFloor).toBe(20);
    expect(m.salaryReviewMonths).toBe(6);
  });

  it("merge: handles null prior", () => {
    expect(mergeMiscSignals(null, extractMiscSignals("floor 20 LPA")).candidateFloor).toBe(20);
  });
});
