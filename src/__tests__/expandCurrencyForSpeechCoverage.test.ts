/* Audit Session C — Area 9: voice / TTS normalizer coverage corpus.
 *
 * Companion to expandCurrencyForSpeech.test.ts. The original file
 * exercises the happy-path Indian-currency expansions. This file is the
 * proactive-audit harness: it locks down the boundary behavior so a
 * future regex tightening cannot silently corrupt ordinary prose.
 *
 * Two failure modes audited here:
 *   1. Insufficient coverage — lowercase `l` (e.g. "₹1l") must expand
 *      identically to uppercase `L`. (Caught in Session C: the L-step
 *      regex used `/g` instead of `/gi`, leaving lowercase unhandled
 *      and producing "1 rupees l" via the ₹-fallback path. Fixed.)
 *   2. Over-broad matching — bare prose containing the letter `L`
 *      (LOL, "all in all", "Level 5") must pass through untouched.
 */
import { describe, it, expect } from "vitest";
import { expandCurrencyForSpeech } from "../tts";

describe("expandCurrencyForSpeech — coverage corpus (Session C audit)", () => {
  describe("lakh single-letter expansions", () => {
    it.each([
      ["₹1L", "1 lakh"],
      ["₹1 L", "1 lakh"],
      ["₹1l", "1 lakh"],           // lowercase l — was broken pre-fix
      ["₹1.5L", "1.5 lakhs"],
      ["₹10L", "10 lakhs"],
    ])("%s → %s", (input, expected) => {
      expect(expandCurrencyForSpeech(input)).toBe(expected);
    });
  });

  describe("crore expansions (both cases)", () => {
    it.each([
      ["₹1Cr", "1 crore"],
      ["₹1cr", "1 crore"],
      ["₹1 Cr", "1 crore"],
      ["₹1.2Cr", "1.2 crores"],
    ])("%s → %s", (input, expected) => {
      expect(expandCurrencyForSpeech(input)).toBe(expected);
    });
  });

  it("idempotent on already-expanded prose", () => {
    expect(expandCurrencyForSpeech("1 lakh")).toBe("1 lakh");
  });

  it("expands bare '1L bonus' (no ₹) — current documented behaviour", () => {
    /* Current regex makes ₹ optional, so "1L" without ₹ still expands.
     * This is intentional: candidates often say "1L joining bonus"
     * verbatim. The risk surface is letter-L-in-prose, audited below. */
    expect(expandCurrencyForSpeech("1L bonus")).toBe("1 lakh bonus");
  });

  it("expands LPA inside a sentence", () => {
    expect(expandCurrencyForSpeech("₹24.5 LPA package"))
      .toBe("24.5 lakhs per annum package");
  });

  it("expands mixed currency tokens in one sentence", () => {
    expect(expandCurrencyForSpeech("₹25 LPA plus ₹2L joining bonus"))
      .toBe("25 lakhs per annum plus 2 lakhs joining bonus");
  });

  it("handles parenthetical wrapping", () => {
    expect(expandCurrencyForSpeech("(₹1L)")).toBe("(1 lakh)");
  });

  it("handles comma-separated list", () => {
    expect(expandCurrencyForSpeech("₹1L, ₹2L, and ₹3L"))
      .toBe("1 lakh, 2 lakhs, and 3 lakhs");
  });

  describe("CRITICAL: ordinary prose containing letter L is untouched", () => {
    it.each([
      "LOL",
      "all in all",
      "Level 5 SDE",
      "a wholly owned subsidiary",
    ])("%s is unchanged", (input) => {
      expect(expandCurrencyForSpeech(input)).toBe(input);
    });
  });

  describe("non-lakh/crore unit suffixes are NOT munged", () => {
    it.each(["3M users", "5K likes"])("%s is unchanged", (input) => {
      expect(expandCurrencyForSpeech(input)).toBe(input);
    });
  });
});
