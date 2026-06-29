import { describe, it, expect } from "vitest";
import { extractCandidateAskLpa } from "../negotiationDealSummary";

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
});
