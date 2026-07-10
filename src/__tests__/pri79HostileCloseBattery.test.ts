/* PRI-79 (2026-07-10, round-11 offline hostile accept/close probe against the
 * acceptance-classifier single source of truth) — eight false-closes surfaced by
 * an adversarial sweep, each a member of a real semantic class (not a one-off
 * hack), fixed at the shared FALSE_CLOSE_VETO_PATTERNS so BOTH gates reject:
 *
 *   A. "I'll take it up with your competitor." — the phrasal verb "take it UP
 *      WITH <someone>" (raise a matter), not "take it" = accept. TAKE_IT_HEDGE
 *      widened with "up with".
 *   B. "I accept, and monkeys might fly out of my ass." — the "when monkeys fly"
 *      impossibility idiom, sibling of "when pigs fly" already in
 *      SARCASTIC_REFUSAL. Idiom bank widened.
 *   C. "I accept defeat — I'm walking." / "I accept my resignation…" — an accept
 *      verb whose object is a GIVING-UP/WALK noun. WRONG_OBJECT_ACCEPT needs an
 *      article and lacks "defeat/resignation/loss"; new ACCEPT_WALK_OBJECT.
 *   D. "I accept the offer to disagree." — the "(offer/agree) to disagree/differ"
 *      idiom; "the offer" satisfied the accept core but the idiom is a refusal.
 *      New OFFER_TO_DISAGREE.
 *   E. "You have yourself a deal with nobody." / "Consider it accepted — by
 *      someone else." — a close idiom attributing the deal to a NON-PARTY. New
 *      NON_PARTY_ATTRIBUTION.
 *   F. "Fine, deal — NOT." — the clause-final "— NOT" sarcasm negation. New
 *      TRAILING_NOT_NEGATION, scoped to a dash/ellipsis-preceded clause-final
 *      "not" so mid-sentence "I'm not sure" is spared.
 *   G. "I'll sign when you offer something worth signing." — a commit gated on
 *      the offer first becoming "worth" it. New WORTH_SIGNING_CONDITIONAL, scoped
 *      to the when/once/until … worth <verb> frame.
 *
 * Each fix is scoped so a genuine accept is untouched: "accept the offer / at 40"
 * names no wrong object, carries no impossibility tag, no non-party attribution,
 * no trailing NOT, and no worth-conditional frame. */
import { describe, it, expect } from "vitest";
import { classifyAcceptance } from "../../server-handlers/_acceptance-classifier";

const ctx = { offerLpa: 40, offerOnTable: true, phase: "counter" };
const acc = (t: string) => classifyAcceptance(t, ctx).accepted;

const SHOULD_NOT_ACCEPT: string[] = [
  "I'll take it up with your competitor.",
  "I'll take it up with my lawyer.",
  "I accept, and monkeys might fly out of my ass.",
  "Sure, deal — when monkeys fly.",
  "I accept defeat — I'm walking.",
  "I accept my resignation from this conversation.",
  "I accept the loss and move on.",
  "I accept the offer to disagree.",
  "You have yourself a deal with nobody.",
  "Consider it accepted — by someone else.",
  "Fine, deal — NOT.",
  "I'll take it... not.",
  "I'll sign when you offer something worth signing.",
  "I'll take it once it's worth taking.",
];

const GENUINE_ACCEPT: string[] = [
  "Yes, I accept the offer.",
  "Okay, I'll take it.",
  "Sold. Let's do it.",
  "Great, count me in — I accept at 40.",
  "Deal. Send the paperwork.",
  "You've got a deal.",
  "Yes — I accept the offer at 40.",
  "Perfect, I'll take the offer.",
];

describe("PRI-79 — round-11 hostile accept/close no longer false-closes", () => {
  for (const t of SHOULD_NOT_ACCEPT) {
    it(`does NOT accept: "${t}"`, () => expect(acc(t)).toBe(false));
  }
});

describe("PRI-79 — genuine closes still fire", () => {
  for (const t of GENUINE_ACCEPT) {
    it(`accepts: "${t}"`, () => expect(acc(t)).toBe(true));
  }
});
