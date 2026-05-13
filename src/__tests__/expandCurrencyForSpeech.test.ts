import { describe, it, expect } from "vitest";
import { expandCurrencyForSpeech } from "../tts";

/**
 * Bug report 11 follow-up F (2026-05-14): Indian currency abbreviations
 * (₹1L, ₹24.5 LPA, ₹1Cr) were sent verbatim to TTS and pronounced as
 * letters ("one ell"). This expander runs ONLY on the TTS path; the
 * on-screen text stays compact.
 */
describe("expandCurrencyForSpeech", () => {
  it("expands ₹1L to '1 lakh' (singular)", () => {
    expect(expandCurrencyForSpeech("Joining bonus of ₹1L"))
      .toBe("Joining bonus of 1 lakh");
  });

  it("expands ₹2L to '2 lakhs' (plural)", () => {
    expect(expandCurrencyForSpeech("₹2L"))
      .toBe("2 lakhs");
  });

  it("expands ₹1.5L to '1.5 lakhs' (fractional → plural)", () => {
    expect(expandCurrencyForSpeech("₹1.5L"))
      .toBe("1.5 lakhs");
  });

  it("expands 1L without ₹", () => {
    expect(expandCurrencyForSpeech("a 1L joining bonus"))
      .toBe("a 1 lakh joining bonus");
  });

  it("expands ₹24.5 LPA to '24.5 lakhs per annum'", () => {
    expect(expandCurrencyForSpeech("Total CTC is ₹24.5 LPA."))
      .toBe("Total CTC is 24.5 lakhs per annum.");
  });

  it("expands ₹25 LPA to '25 lakhs per annum'", () => {
    expect(expandCurrencyForSpeech("offer at ₹25 LPA"))
      .toBe("offer at 25 lakhs per annum");
  });

  it("expands 25LPA (no spaces) to '25 lakhs per annum'", () => {
    expect(expandCurrencyForSpeech("25LPA fixed"))
      .toBe("25 lakhs per annum fixed");
  });

  it("expands 1 LPA to '1 lakh per annum' (singular)", () => {
    expect(expandCurrencyForSpeech("₹1 LPA stipend"))
      .toBe("1 lakh per annum stipend");
  });

  it("expands ₹1Cr to '1 crore' (singular)", () => {
    expect(expandCurrencyForSpeech("equity vests at ₹1Cr valuation"))
      .toBe("equity vests at 1 crore valuation");
  });

  it("expands ₹2.5 Cr to '2.5 crores'", () => {
    expect(expandCurrencyForSpeech("₹2.5 Cr"))
      .toBe("2.5 crores");
  });

  it("expands standalone LPA token", () => {
    expect(expandCurrencyForSpeech("base in LPA, variable separately"))
      .toBe("base in lakhs per annum, variable separately");
  });

  it("does NOT eat the letter L in ordinary prose", () => {
    // "L" embedded in a word — must not be expanded.
    expect(expandCurrencyForSpeech("ESOPs vest over 4 years; LinkedIn Learning included"))
      .toBe("ESOPs vest over 4 years; LinkedIn Learning included");
  });

  it("does NOT eat into LPA when expanding L (regex order)", () => {
    // "25LPA" must become "25 lakhs per annum", NOT "25 lakhsPA".
    const out = expandCurrencyForSpeech("offer 25LPA");
    expect(out).toContain("lakhs per annum");
    expect(out).not.toContain("lakhsPA");
    expect(out).not.toContain("lakh PA");
  });

  it("handles multiple amounts in one sentence", () => {
    expect(expandCurrencyForSpeech("₹25 LPA fixed plus ₹2L joining bonus"))
      .toBe("25 lakhs per annum fixed plus 2 lakhs joining bonus");
  });

  it("is idempotent — second pass is a no-op", () => {
    const once = expandCurrencyForSpeech("₹24.5 LPA + ₹1.5L JB");
    const twice = expandCurrencyForSpeech(once);
    expect(twice).toBe(once);
  });

  it("handles empty / falsy input", () => {
    expect(expandCurrencyForSpeech("")).toBe("");
  });

  it("leaves text with no currency tokens unchanged", () => {
    const plain = "We're targeting a hybrid work model with strong learning support.";
    expect(expandCurrencyForSpeech(plain)).toBe(plain);
  });
});
