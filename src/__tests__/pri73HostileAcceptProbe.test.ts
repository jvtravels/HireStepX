/* PRI-73 (2026-07-08, round-5 offline hostile accept/close probe against the
 * acceptance-classifier single source of truth) — three defects, all fixed
 * structurally at the shared patterns so the medium gate (classifyAcceptance)
 * and strict gate (detectExplicitAcceptance) move in lockstep:
 *
 *   A. FALSE-NEGATIVE (the dangerous class — a real accept dropped, so a live
 *      negotiation the candidate is closing would NOT close): "Alright, let's
 *      do this." The COMMITMENT_IDIOM close arm carried `do it` but not
 *      `do this`, so a genuine casual close was lost. Widened to
 *      `do\s+(?:it|this)`; DO_IT_REDIRECT_PATTERN widened in lockstep so
 *      "let's do this differently/later/your way" stays vetoed.
 *   B. FALSE-POSITIVE: "Consider it done the moment the base hits 55." — a
 *      close idiom gated on the base REACHING a number is a conditional
 *      deferral, not a same-turn commit at the un-bumped offer.
 *      CONDITIONAL_DEFERRAL_PATTERN matched the temporal frame ("the moment
 *      the base …") but its settlement-verb list lacked reach-a-number verbs;
 *      added `hits?|reach(?:es|ed)?`.
 *   C. FALSE-POSITIVE: "I'll accept your apology, not the offer." — the accept
 *      object is a non-offer proposition, explicitly "not the offer".
 *      ACCEPT_PROPOSITION_PATTERN excludes stance/reality/position accepts;
 *      added `apology|apologies` to its excluded-noun list.
 *
 * The GENUINE closes in the second block must all still fire — the fixes are
 * scoped (redirect tails still veto B's sibling; the conditional verb list only
 * adds reach-a-number; the proposition veto only adds apology). */
import { describe, it, expect } from "vitest";
import { classifyAcceptance } from "../../server-handlers/_acceptance-classifier";

const ctx = { offerLpa: 40, offerOnTable: true, phase: "counter" };
const acc = (t: string) => classifyAcceptance(t, ctx).accepted;

const SHOULD_NOT_ACCEPT: string[] = [
  "If the number were right, I'd say yes.",
  "I almost want to accept, but not at this number.",
  "Say yes? Give me a reason to.",
  "I'll accept your apology, not the offer.",
  "Everyone tells me to just accept and move on, but I won't.",
  "Deal or no deal — I need to think about it.",
  "You've got yourself a candidate, once we fix the base.",
  "Consider it done the moment the base hits 55.",
  "I'm sold on the team, not the comp.",
  "Where do I sign... just kidding, the base is too low.",
  "I would accept if I were desperate, which I'm not.",
  "Let's call it a deal — no, actually, I can't.",
  "Tempting enough that I'd almost sign.",
  "I'm ready to accept a fair offer, and this isn't one.",
];

const GENUINE_ACCEPT: string[] = [
  "Alright, let's do this.",
  "You've got a deal.",
  "Send the paperwork, I'm in.",
  "Okay, I'll take it.",
  "That works for me, let's proceed.",
  "Fine, I accept.",
  "Deal. Send the letter.",
];

describe("PRI-73 — hostile accept/close no longer false-closes", () => {
  for (const t of SHOULD_NOT_ACCEPT) {
    it(`does NOT accept: "${t}"`, () => expect(acc(t)).toBe(false));
  }
});

describe("PRI-73 — genuine closes still fire", () => {
  for (const t of GENUINE_ACCEPT) {
    it(`accepts: "${t}"`, () => expect(acc(t)).toBe(true));
  }
});
