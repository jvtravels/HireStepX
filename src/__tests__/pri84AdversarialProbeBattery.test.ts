/* PRI-84 (2026-07-10) — a fresh ADVERSARIAL PROBE of the acceptance-classifier
 * (a new hostile-accept × genuine-accept matrix, distinct from pri73-83)
 * surfaced two false-close LEAKS, each fixed at the pattern that already owned
 * its class — no new gate, single source of truth:
 *
 *   LEAK 1 — "I'm in no mood to accept this." The bare "I'm in" fired the
 *     performative-commit idiom while "no mood to accept" negated it. Added
 *     "no mood" to IM_IN_HEDGE_PATTERN, the home for "I'm in <hedge>" hijacks
 *     (alongside "no rush" / "two minds" / "talks").
 *
 *   LEAK 2 — "I accept zero excuses for this number." The accept verb fired but
 *     the object is "excuses" under a no/zero quantifier — the fixed idiom "I
 *     will TOLERATE no excuses" (a hostile demand), never a close.
 *     WRONG_OBJECT_ACCEPT's determiner set can't carry no/zero, so a focused
 *     sibling ACCEPT_NO_EXCUSES_PATTERN owns it.
 *
 * Pins both polarities so neither fix can drift into re-opening a genuine
 * accept. */
import { describe, it, expect } from "vitest";
import { classifyAcceptance } from "../../server-handlers/_acceptance-classifier";

const ctx = { offerLpa: 40, offerOnTable: true, phase: "counter" };
const acc = (t: string) => classifyAcceptance(t, ctx).accepted;

const HOSTILE_MUST_VETO: string[] = [
  // LEAK 1 — "I'm in <refusal>" hijack of the performative commit
  "I'm in no mood to accept this.",
  "I'm in no mood to sign.",
  // LEAK 2 — "accept no/zero excuses" tolerate-no-excuses idiom
  "I accept zero excuses for this number.",
  "I'll accept no excuses.",
  "I accept no more excuses from you.",
];

const GENUINE_MUST_ACCEPT: string[] = [
  // "I'm in" with no hedge/refusal tail still closes
  "I'm in.",
  "Sounds good, I'm in!",
  // genuine closes whose object is the offer — untouched by the excuses veto
  "I accept the offer.",
  "Okay, I'll take it.",
  "You've got a deal.",
];

describe("PRI-84 — adversarial-probe leaks stay vetoed", () => {
  for (const t of HOSTILE_MUST_VETO) {
    it(`does NOT accept: "${t}"`, () => expect(acc(t)).toBe(false));
  }
});

describe("PRI-84 — genuine accepts still close", () => {
  for (const t of GENUINE_MUST_ACCEPT) {
    it(`accepts: "${t}"`, () => expect(acc(t)).toBe(true));
  }
});
