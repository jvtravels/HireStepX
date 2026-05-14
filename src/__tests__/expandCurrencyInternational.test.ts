/* Phase 33 (2026-05-14) — international-currency support in
 * expandCurrencyForSpeech.
 *
 * Pre-Phase-33 the speech expander only handled ₹ / LPA / Cr / L.
 * Anything else ($120K, €1.5M, £75,000, USD 200K) reached the TTS
 * engine raw, which reads "$" as literal "dollar sign" and ignores
 * the K/M/B magnitude suffix.
 *
 * Coverage:
 *   - all four supported symbols ($, €, £, ¥)
 *   - K/M/B magnitudes
 *   - decimals + comma-separated thousands
 *   - ISO codes (USD/EUR/GBP/JPY)
 *   - singular vs plural (1 dollar / 2 dollars; yen invariant)
 *   - existing ₹ behavior is not regressed
 *   - prose with letters K/M/B in non-currency contexts is untouched
 */
import { describe, it, expect } from "vitest";
import { expandCurrencyForSpeech } from "../tts";

describe("Phase 33 — expandCurrencyForSpeech: international currencies", () => {
  it("$ + K → dollars", () => {
    expect(expandCurrencyForSpeech("$120K")).toBe("120 thousand dollars");
  });

  it("$ alone (no magnitude)", () => {
    expect(expandCurrencyForSpeech("Offer is $75 hourly.")).toBe("Offer is 75 dollars hourly.");
  });

  it("€ + M → euros (plural)", () => {
    expect(expandCurrencyForSpeech("€1.5M base")).toBe("1.5 million euros base");
  });

  it("£ with comma-separated thousands", () => {
    expect(expandCurrencyForSpeech("£75,000 base")).toBe("75,000 pounds base");
  });

  it("¥ + M → yen (invariant plural)", () => {
    expect(expandCurrencyForSpeech("¥10M")).toBe("10 million yen");
  });

  it("USD ISO code → dollars", () => {
    expect(expandCurrencyForSpeech("USD 200K total")).toBe("200 thousand dollars total");
  });

  it("EUR ISO code with comma thousands", () => {
    expect(expandCurrencyForSpeech("EUR 80,000")).toBe("80,000 euros");
  });

  it("GBP ISO code with K suffix", () => {
    expect(expandCurrencyForSpeech("GBP 50K")).toBe("50 thousand pounds");
  });

  it("singular: $1 → 1 dollar (not 1 dollars)", () => {
    expect(expandCurrencyForSpeech("$1 per share")).toBe("1 dollar per share");
  });

  it("B (billion) magnitude", () => {
    expect(expandCurrencyForSpeech("$2B valuation")).toBe("2 billion dollars valuation");
  });

  it("does NOT regress existing ₹ / LPA / Cr / L behavior", () => {
    expect(expandCurrencyForSpeech("₹25 LPA")).toBe("25 lakhs per annum");
    expect(expandCurrencyForSpeech("₹1L joining bonus")).toBe("1 lakh joining bonus");
    expect(expandCurrencyForSpeech("₹2Cr ESOPs")).toBe("2 crores ESOPs");
  });

  it("leaves prose letters K/M/B alone when not adjacent to a currency", () => {
    expect(expandCurrencyForSpeech("The CTO is great.")).toBe("The CTO is great.");
    expect(expandCurrencyForSpeech("M&A team is hiring.")).toBe("M&A team is hiring.");
  });

  it("does not mangle ISO-looking prose ('USDA', 'EURope')", () => {
    expect(expandCurrencyForSpeech("USDA-approved facility")).toBe("USDA-approved facility");
    expect(expandCurrencyForSpeech("European market")).toBe("European market");
  });

  it("mixed sentence with INR + USD round-trips correctly", () => {
    const input = "Base is ₹25 LPA or USD 30K depending on location.";
    const output = expandCurrencyForSpeech(input);
    expect(output).toContain("25 lakhs per annum");
    expect(output).toContain("30 thousand dollars");
  });

  it("decimal with K magnitude: $1.25K", () => {
    expect(expandCurrencyForSpeech("$1.25K")).toBe("1.25 thousand dollars");
  });

  it("handles whitespace between symbol and number", () => {
    expect(expandCurrencyForSpeech("$ 120 K")).toBe("120 thousand dollars");
  });
});
