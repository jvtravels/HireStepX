/* Regression tests for the canonical walk-away detector.
 *
 * Anchored by a live-staging finding (2026-06-18): the candidate's very
 * first substantive answer — "I'm evaluating this move on the scope and
 * the market rate…" — tripped a bare `move on` alternative, the kernel
 * read it as a walk-away, and the fallback planner closed the whole
 * negotiation at turn 2 before any offer existed. "move on" now requires
 * a first-person DEPARTURE frame; topic-transition and noun uses must
 * NOT fire. Genuine walk-aways must still fire. */
import { describe, it, expect } from "vitest";
import { isWalkAway } from "../../server-handlers/_walkaway-detection";

describe("_walkaway-detection — genuine walk-aways fire", () => {
  const POSITIVES = [
    "Honestly I think I'll walk away from this.",
    "I'm walking away unless we get closer.",
    "I'm out, this isn't worth it.",
    "I'm just not interested at that number.",
    "Then I'll pass, thanks.",
    "There's no deal at 15.",
    "I'll have to withdraw my candidacy.",
    "I'm going to decline the offer.",
    "That won't work for me.",
    "This isn't going to work.",
    "I'll just move on then.",
    "I'm moving on to other opportunities.",
    "I'm going to move on if we can't close the gap.",
    "I have to move on, sorry.",
    "I'd rather move on than settle here.",
    "Guess I'll move on.",
    "I might pull out of the process.",
    "Mujhe nahi chahiye yeh offer.",
    "Nahi karna hai aage.",
  ];
  for (const text of POSITIVES) {
    it(`fires on: ${text}`, () => {
      expect(isWalkAway(text)).toBe(true);
    });
  }
});

describe("_walkaway-detection — innocent 'move' / 'move on' does NOT fire", () => {
  const NEGATIVES = [
    // The exact live-staging false positive that closed the negotiation.
    "I'm evaluating this move on the scope and the market rate, around 28-32 LPA, and that's where I'd like us to land.",
    "Let's move on to the next topic when you're ready.",
    "That was a smart move on their part.",
    "It was a great career move on its own merits.",
    "We can move on the joining bonus if base is fixed.",
    "Moving on to the timeline — my notice is 60 days.",
    "This move on the scope makes sense to me.",
    "I'm excited about the role and the team.",
    "Sounds good, let's keep going.",
  ];
  for (const text of NEGATIVES) {
    it(`does not fire on: ${text}`, () => {
      expect(isWalkAway(text)).toBe(false);
    });
  }

  it("returns false for empty / nullish input", () => {
    expect(isWalkAway("")).toBe(false);
    expect(isWalkAway(null)).toBe(false);
    expect(isWalkAway(undefined)).toBe(false);
  });
});

/* PRI-64 (2026-07-06, live staging) — a candidate REASSURING the recruiter
 * they are staying must not be scored as a walk-away. The bare alternation had
 * no negation awareness, so "I don't want to walk away" matched `walk away` and
 * terminated a live negotiation the candidate was actively trying to save. */
describe("_walkaway-detection — negated departures do NOT fire (re-engagement)", () => {
  const NEGATIVES = [
    "I don't want to walk away, let's close at 52 fixed.",
    "I really don't want to walk away from this — can we meet in the middle?",
    "I'm not going to walk away over 2 lakhs, let's find a number.",
    "Rather than walk away, I'd like to keep talking.",
    "Instead of walking away I'd rather we bridge the gap on base.",
    "No need to walk away — I'm still very interested.",
    "No reason for me to walk away if the joining bonus covers it.",
    "I'd prefer not to walk away, so what flexibility is there on base?",
    "I'm not going to pull out, let's just align on the fixed number.",
    "There's no need to withdraw my candidacy, I want to make this work.",
    "I'm not ready to walk away yet, give me your best number.",
  ];
  for (const text of NEGATIVES) {
    it(`does not fire on: ${text}`, () => {
      expect(isWalkAway(text)).toBe(false);
    });
  }

  /* A negated departure must NOT swallow a genuine, un-negated walk signal
   * elsewhere in the same utterance. */
  it("still fires when a negated departure is followed by a real walk signal", () => {
    expect(
      isWalkAway("I don't want to walk away, but if the base won't move I'll pass."),
    ).toBe(true);
  });

  it("still fires when the departure itself is not negated (distant negation)", () => {
    // "don't" governs "think the scope fits", not the far-away "walk away".
    expect(
      isWalkAway("I don't think the scope fits what I'm after, so I'll walk away."),
    ).toBe(true);
  });
});
