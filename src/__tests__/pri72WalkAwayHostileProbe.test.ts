/* PRI-72 (2026-07-08, round-4 hostile probe against the walk-away routing SoT
 * `_walkaway-detection.ts`) — eight FALSE-POSITIVES, each a CATASTROPHIC spurious
 * walk-away: `isWalkAway` gates whether the kernel terminates the negotiation, so
 * a false fire ends a live session the candidate is NOT ending and renders the
 * report as "You walked away". All fixed structurally at the single source of
 * truth (WALKAWAY_PATTERN + the negation guard), shared by every caller.
 *
 *   A. bare `decline` fired on positive / rhetorical / negated uses — "I can't
 *      decline an offer this strong", "This offer is hard to decline", "Who would
 *      decline that?". Replaced with committal-frame arms: decline must sit under
 *      a first-person commit ("I decline", "I'll decline", "I'm going to have to
 *      decline") or a settlement adverb ("respectfully/reluctantly decline").
 *   B. negated committal declines — "There's no way I'd decline this", "I'm not
 *      going to decline over 2 lakhs" — matched a committal arm, so `decline` was
 *      added to NEGATABLE_DEPARTURE and "no way" to DEPARTURE_NEGATOR; the
 *      negation guard now strips them.
 *   C. `no deal` fired on the reassurance "no deal-breaker(s)" — a breaker
 *      lookahead spares it (mirrors the accept classifier).
 *   D. `i'll pass` fired on the hand-off sense "I'll pass along my acceptance" —
 *      an "along" lookahead spares the hand-off.
 *
 * Every genuine walk-away in the second block MUST still fire — the fixes are
 * scoped (committal frame required; breaker/along lookaheads; negation-scope
 * strip), so none suppress a real departure. */
import { describe, it, expect } from "vitest";
import { isWalkAway } from "../../server-handlers/_walkaway-detection";

const SHOULD_NOT_WALK: string[] = [
  "I can't decline an offer this strong.",
  "This offer is hard to decline.",
  "Who would decline that?",
  "There's no way I'd decline this.",
  "I'm not going to decline over 2 lakhs.",
  "No deal breaker here, let's proceed.",
  "No deal-breakers on my end.",
  "I'll pass along my acceptance today.",
  "Let me pass this by my manager and revert.",
  "That's a smart move on their part.",
  "I don't want to walk away, let's find middle ground.",
  "Rather than pull out, I'd like to keep talking.",
  "No need to withdraw — I'm still very interested.",
];

const GENUINE_WALKAWAY: string[] = [
  "I'm going to have to respectfully decline.",
  "I'll pass, this isn't for me.",
  "No deal. I'm out.",
  "I'm walking away.",
  "I'll withdraw my candidacy.",
  "Not interested, thanks.",
  "I'm going to pull out of the process.",
  "I'll move on to other offers.",
  "mujhe nahi chahiye.",
];

describe("PRI-72 — walk-away routing SoT no longer false-fires", () => {
  for (const utter of SHOULD_NOT_WALK) {
    it(`does NOT walk on: "${utter}"`, () => {
      expect(isWalkAway(utter)).toBe(false);
    });
  }
});

describe("PRI-72 — genuine walk-aways still fire", () => {
  for (const utter of GENUINE_WALKAWAY) {
    it(`walks on: "${utter}"`, () => {
      expect(isWalkAway(utter)).toBe(true);
    });
  }
});
