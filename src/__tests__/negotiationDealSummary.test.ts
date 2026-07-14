import { describe, it, expect } from "vitest";
import { extractCandidateAskLpa, resolveCandidateAskLpa } from "../negotiationDealSummary";

/* Deal Summary "Your Ask" extraction (live Flipkart-EM regression, 2026-06-30).
 *
 * The immediate post-session card has no kernel access, so it infers the
 * candidate's STATED ask from their transcript turns. The previous logic took
 * the max of EVERY salary-suffixed number in the candidate's text, which:
 *   - over-counted the candidate's CURRENT CTC ("currently at 46L"),
 *   - over-counted echoed OFFER figures ("if you close at 52.3, that works"),
 *   - missed unit-less asks ("closer to 65").
 * In the live session the real ask was ₹65 but the card showed ₹52.3 (the
 * echoed offer). These lock the corrected ask-context extraction. */

describe("extractCandidateAskLpa", () => {
  it("captures an explicit suffixed ask", () => {
    expect(extractCandidateAskLpa(["I'm looking for 65 LPA total."])).toBe(65);
  });

  it("captures a unit-less ask after a cue", () => {
    expect(extractCandidateAskLpa(["Honestly I was hoping for something closer to 65."])).toBe(65);
  });

  it("excludes current CTC (no ask cue) and keeps the ask in the same sentence", () => {
    // "currently at 46" has no ask cue → ignored; "looking for 65" wins.
    expect(
      extractCandidateAskLpa(["I'm currently at 46 fixed, but I'm looking for 65."]),
    ).toBe(65);
  });

  it("excludes echoed-offer clauses (does not read the company number back as an ask)", () => {
    // The live false positive: candidate restates the offer; not their ask.
    expect(
      extractCandidateAskLpa(["If you can close at 52.3 fixed, that works for me."]),
    ).toBe(0);
  });

  it("returns the upper bound of a hyphenated range ask", () => {
    expect(extractCandidateAskLpa(["I'd be comfortable somewhere around 56-57."])).toBe(57);
  });

  it("takes the max across multiple ask turns", () => {
    expect(
      extractCandidateAskLpa([
        "Currently at 46.",
        "I'm targeting 56.",
        "Ideally push to 65 total.",
      ]),
    ).toBe(65);
  });

  it("returns 0 when no genuine ask is present (card hides the tile)", () => {
    expect(extractCandidateAskLpa(["Thanks for walking me through the structure."])).toBe(0);
    // Bare CTC disclosure with no ask cue must not surface as an ask.
    expect(extractCandidateAskLpa(["I'm currently drawing 48 LPA fixed."])).toBe(0);
  });

  it("does not mistake years/experience for an ask", () => {
    // "want 10 years" has a cue + number but is implausible as LPA only if it
    // slips the 1..500 window — here 10 is plausible, so guard via no suffix +
    // realistic intent: the figure after a genuine money cue still wins. This
    // asserts the realistic case where a YoE mention without a money cue is
    // ignored.
    expect(extractCandidateAskLpa(["I have 12 years of experience as an EM."])).toBe(0);
  });

  it("handles raw rupee amounts (Indian format) as LPA", () => {
    expect(extractCandidateAskLpa(["My ask is 56,00,000."])).toBe(56);
  });

  it("handles crore-denominated asks", () => {
    expect(extractCandidateAskLpa(["I'm looking for 1.2 crore."])).toBe(120);
  });

  /* Adversarial hardening (2026-06-30) — common ask phrasings beyond the
   * core cue set, plus the comma-joined echo+ask defect. */
  describe("adversarial ask phrasings", () => {
    it.each([
      ["I'd like 65 ideally.", 65],
      ["Can you do 68?", 68],
      ["My number is 70.", 70],
      ["I want at least 55, but ideally 65.", 65],
      ["Looking for around 1.5cr.", 150],
      ["I'd be comfortable at 60.", 60],
      ["Hoping to land at 62.", 62],
      ["I make 50 now and want 65.", 65],
    ])("captures the ask in %s → %d", (input, expected) => {
      expect(extractCandidateAskLpa([input])).toBe(expected);
    });

    it("recovers a sibling ask from a comma-joined echo-offer sentence", () => {
      // The echo cue ("your offer") and the real ask ("I want 65") share one
      // comma-joined sentence; clause-splitting on commas (but not inside the
      // Indian-format number) keeps the ask while dropping the echo clause.
      expect(
        extractCandidateAskLpa(["Currently drawing 48, your offer of 52 is low, I want 65."]),
      ).toBe(65);
    });

    it.each([
      "I'd like to understand the 4 year vesting.",
      "Can you do a recap of the package?",
      "I have 12 years of experience.",
      "My current CTC is 48 LPA.",
      "The notice period is 3 months.",
      "Land at the Bangalore office works for me.",
    ])("does NOT read a non-ask number as an ask: %s", (input) => {
      expect(extractCandidateAskLpa([input])).toBe(0);
    });
  });
});

/* resolveCandidateAskLpa — single source of truth for the card's "Your Ask"
 * tile (I-10 cross-surface fix, live Flipkart 2026-07-14). When the kernel
 * value is available it MUST win over transcript regex, so the transient Deal
 * Summary and the durable SessionReport never disagree. The live defect: the
 * report showed the kernel final target (₹42 after a 48→44→42 climb-down) while
 * the card's regex surfaced the MAX stated ask (₹48). */
describe("resolveCandidateAskLpa", () => {
  it("prefers the kernel ask over the transcript-extracted max", () => {
    // Regex would surface 48 ("targeting 48"); the kernel tracked the final
    // target 42 (un-cued "meet me at 44" / "bring it to 42" the regex misses).
    expect(
      resolveCandidateAskLpa(42, ["I'm targeting 48 lakhs fixed for this role."]),
    ).toBe(42);
  });

  it("rounds the kernel ask to one decimal place", () => {
    expect(resolveCandidateAskLpa(41.96, ["I want 65."])).toBe(42);
    expect(resolveCandidateAskLpa(38.34, [])).toBe(38.3);
  });

  it("falls back to transcript extraction when the kernel ask is null", () => {
    expect(resolveCandidateAskLpa(null, ["I'm looking for 65 LPA."])).toBe(65);
    expect(resolveCandidateAskLpa(undefined, ["I'm looking for 65 LPA."])).toBe(65);
  });

  it("falls back to transcript extraction for a non-positive kernel ask", () => {
    // 0 / negative are not real asks — legacy sessions without a tracked target.
    expect(resolveCandidateAskLpa(0, ["Hoping for 62."])).toBe(62);
    expect(resolveCandidateAskLpa(-5, ["Hoping for 62."])).toBe(62);
  });

  it("returns 0 (tile hidden) when neither kernel nor transcript has an ask", () => {
    expect(resolveCandidateAskLpa(null, ["Thanks for the recap."])).toBe(0);
  });
});
