/* PRI-74 (2026-07-10, round-6 offline hostile accept/close probe against the
 * acceptance-classifier single source of truth) — five defects, all fixed
 * structurally at the shared patterns so the medium gate (classifyAcceptance)
 * and the strict gate (detectExplicitAcceptance, via HEDGE_VETO_PATTERNS /
 * CLOSE_CONSENT_IDIOM_PATTERNS) move in lockstep:
 *
 *   A. FALSE-POSITIVE (the worst class — an unrecoverable false close on a
 *      refusal): "Don't expect me to sign today." The disbelief-frame veto
 *      needed a "you … expect …" subject; the NEGATED-IMPERATIVE form ("DON'T
 *      expect me to …") has none, so the embedded "sign" false-closed. New
 *      negated-imperative arm in RHETORICAL_ACCEPT_VETO_PATTERNS.
 *   B. FALSE-POSITIVE: "Were I you, I'd accept — but I'm not you." — a
 *      counterfactual subjunctive inversion is a hypothetical about the OTHER
 *      party, never the speaker's own commit. New inverted-subjunctive arm in
 *      RHETORICAL_ACCEPT_VETO_PATTERNS.
 *   C. FALSE-POSITIVE: "I'll sign, said no one looking at this base." — the
 *      "…, said no one" sarcasm idiom without the fixed trailing "ever".
 *      SARCASTIC_REFUSAL_PATTERN widened: "ever" optional, "nobody" too.
 *   D. FALSE-POSITIVE: "I'd accept a coffee, not this offer." — accept-object
 *      contrasted AWAY from the offer. ACCEPT_PROPOSITION excludes a fixed noun
 *      list; the arbitrary object ("a coffee") is disambiguated only by the
 *      "not (this/the) offer" tail. New ACCEPT_NOT_THE_OFFER_PATTERN.
 *   E. FALSE-NEGATIVE: "Ship the offer letter." — the send-the-paperwork close
 *      hardcoded the verb "send", dropping the synonymous "ship". Verb widened
 *      to send|ship in the shared CLOSE_CONSENT arm and both strict arms.
 *
 * Deliberately NOT fixed: "Okay you've convinced me, let's go." — "convinced
 * me" is a soft commit signal whose accept-pattern would risk false-closing
 * "you haven't/almost convinced me". Per the safe-default contract a dropped
 * soft accept costs one recoverable turn; a false-close is unrecoverable — so
 * the safe direction is to leave it un-accepted.
 *
 * The GENUINE closes must all still fire; each fix is scoped so the genuine
 * sibling ("I accept the offer", "send the offer letter") is untouched. */
import { describe, it, expect } from "vitest";
import { classifyAcceptance } from "../../server-handlers/_acceptance-classifier";

const ctx = { offerLpa: 40, offerOnTable: true, phase: "counter" };
const acc = (t: string) => classifyAcceptance(t, ctx).accepted;

const SHOULD_NOT_ACCEPT: string[] = [
  "Don't expect me to sign today.",
  "Were I you, I'd accept — but I'm not you.",
  "I'll sign, said no one looking at this base.",
  "I'd accept a coffee, not this offer.",
  "Were I in your shoes, I'd take it.",
  "Don't count on me to accept this.",
  "I accept the challenge, not the number.",
  "Sign this? Said nobody.",
];

const GENUINE_ACCEPT: string[] = [
  "Ship the offer letter.",
  "Ship me the offer letter.",
  "Send the offer letter.",
  "I accept the offer.",
  "You've got a deal.",
  "Okay, I'll take it.",
];

describe("PRI-74 — hostile accept/close no longer false-closes", () => {
  for (const t of SHOULD_NOT_ACCEPT) {
    it(`does NOT accept: "${t}"`, () => expect(acc(t)).toBe(false));
  }
});

describe("PRI-74 — genuine closes still fire", () => {
  for (const t of GENUINE_ACCEPT) {
    it(`accepts: "${t}"`, () => expect(acc(t)).toBe(true));
  }
});
