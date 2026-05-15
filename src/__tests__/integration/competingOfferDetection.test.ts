/* F8 (PDF#20 2026-05-15) — Expanded competing-offer detection patterns.
 *
 * Problem: Candidate said "I'm also evaluating another opportunity" but
 * no competingOffersAnswered flag flipped because the regex only matched
 * narrow phrases. So the reactive competing-credibility probe never fired.
 *
 * Fix: expand the competing-offer detection regex in parseCandidateAnswer
 * to match all the common phrasings documented in the spec.
 *
 * This test: feeds each phrase and asserts parsed.signalsCompetingExistsWithoutNumber === true
 * (which is what triggers the TurnDelta.disclosedCompetingOffer path and
 * ultimately the competing-credibility reactive probe).
 */
import { describe, it, expect } from "vitest";
import { parseCandidateAnswer } from "../../../server-handlers/_negotiation-kernel";

/* parseCandidateAnswer is an internal function. Export it or use it through
 * the public surface. Actually it is exported — confirmed by grep. */

describe("F8 — expanded competing-offer detection patterns", () => {
  const phrases = [
    // Original spec phrases
    "I'm also evaluating another opportunity at the moment",
    "I have another offer I'm considering",
    "I'm evaluating other roles right now",
    "I'm evaluating other companies too",
    "I'm evaluating other options",
    "I'm in process with another company",
    "I'm in talks with another firm",
    "I'm interviewing with another company",
    "I'm interviewing at a startup",
    "I'm interviewing elsewhere as well",
    "I have another offer on the table",
    "There's an offer on the table from another company",
    "I have multiple offers to consider",
  ];

  for (const phrase of phrases) {
    it(`detects competing offer in: "${phrase.slice(0, 60)}..."`, () => {
      const parsed = parseCandidateAnswer(phrase, "", "opening", false);
      expect(
        parsed.signalsCompetingExistsWithoutNumber,
        `Expected signalsCompetingExistsWithoutNumber=true for: "${phrase}"`,
      ).toBe(true);
    });
  }

  it("does NOT flag a plain sentence with no competing-offer language", () => {
    const parsed = parseCandidateAnswer(
      "I am very interested in this role and the team.",
      "",
      "opening",
      false,
    );
    expect(parsed.signalsCompetingExistsWithoutNumber).toBe(false);
  });
});
