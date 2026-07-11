/* PRI-89 (2026-07-11) — a fresh ADVERSARIAL PROBE of the acceptance-classifier
 * (a new hostile-accept × genuine-accept matrix, distinct from pri73–88) surfaced
 * a CONCESSIVE-FRAME false-close LEAK, fixed with one arm in
 * RHETORICAL_ACCEPT_VETO_PATTERNS — the home of the rhetorical/inverted/negated
 * accept class — single source, shared by both gates:
 *
 *   LEAK — "(as) much as I <desire> to accept, <refusal>". The "(as) much as"
 *     subordinator means "although": the accept verb sits INSIDE the concession
 *     ("although I want to accept …"), so it is never the actual close, whatever
 *     the main clause says. "Much as I'd love to accept, I can't at 40" was caught
 *     only INCIDENTALLY by MONEY_REJECTION ("can't at 40"); its sibling "As much
 *     as I want to accept, this doesn't work." carries a NON-money refusal nothing
 *     owned, so the bare subordinated "accept" FALSE-CLOSED. The concessive frame
 *     itself is the structural root. New arm anchors "(as) much as I <desire-verb>
 *     to <accept-verb>" with the desire verb (want/love/like/long, incl. "'d"/
 *     "would" modals) DIRECTLY governing "to accept/take/sign".
 *
 * Pins both polarities. The overreach guards that keep genuine accepts intact:
 *   - "As much as I appreciate the offer, I accept it." — "appreciate" is not a
 *     desire verb and "accept" is in the MAIN clause → NOT vetoed;
 *   - "As much as I wanted a bigger raise, I accept." — "wanted" governs "a bigger
 *     raise", not "to accept" → NOT vetoed. */
import { describe, it, expect } from "vitest";
import { classifyAcceptance } from "../../server-handlers/_acceptance-classifier";

const ctx = { offerLpa: 40, offerOnTable: true, phase: "counter" };
const acc = (t: string) => classifyAcceptance(t, ctx).accepted;

const HOSTILE_MUST_VETO: string[] = [
  "As much as I want to accept, this doesn't work.",
  "Much as I'd love to accept, I can't at this number.",
  "As much as I would love to accept, the base is wrong.",
  "As much as I'd like to sign, this timing is bad.",
  "Much as I want to take it, I can't.",
  "As much as I long to accept, the equity story is fiction.",
];

const GENUINE_MUST_ACCEPT: string[] = [
  "I accept.",
  "I accept the offer.",
  "Okay, I accept — let's do it.",
  "You've got a deal.",
  "Sounds good, I accept.",
  // concessive head over a NON-desire verb + main-clause accept → genuine
  "As much as I appreciate the offer, I accept it.",
  // "wanted" governs an object, not "to accept" → genuine
  "As much as I wanted a bigger raise, I accept.",
];

describe("PRI-89 — concessive 'much as I want to accept' stays vetoed", () => {
  for (const t of HOSTILE_MUST_VETO) {
    it(`does NOT accept: "${t}"`, () => expect(acc(t)).toBe(false));
  }
});

describe("PRI-89 — genuine accepts still close", () => {
  for (const t of GENUINE_MUST_ACCEPT) {
    it(`accepts: "${t}"`, () => expect(acc(t)).toBe(true));
  }
});
