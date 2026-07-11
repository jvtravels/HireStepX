/* PRI-75 (2026-07-10, round-7 offline hostile accept/close probe against the
 * acceptance-classifier single source of truth) — four false-closes (the
 * unrecoverable class: the bot finalizes a deal the candidate is refusing),
 * all fixed at the shared patterns both gates consume:
 *
 *   A. "I'll accept the day pigs fly." — the "when pigs fly" impossibility
 *      idiom in its "the day pigs fly" form. SARCASTIC_REFUSAL_PATTERN widened
 *      to (?:when|the day) pigs fly.
 *   B. "Sure, I'll take it — in an alternate universe." — the "in your dreams"
 *      impossibility sibling. SARCASTIC_REFUSAL widened with
 *      in (an) alternate/another/parallel universe/reality/world/….
 *   C. "Deal? Only in your imagination." — same class. SARCASTIC_REFUSAL
 *      widened with in your imagination/fantasy.
 *   D. "I'd love to accept, truly, but I can't at 40." — a warm accept idiom
 *      welded to "can't at <number>", a money-refusal the "not/no way" head of
 *      MONEY_REJECTION_PATTERN missed (PARTIAL_ACCEPT's money-noun list
 *      excludes a bare digit). Refusal head widened to the can't/won't modals.
 *
 * Each fix is scoped so a genuine accept is untouched: an impossibility tag
 * never rides a real close, and `can'?t` requires the trailing t so "I can do
 * it at 40" (no negation) still accepts. */
import { describe, it, expect } from "vitest";
import { classifyAcceptance } from "../../server-handlers/_acceptance-classifier";

const ctx = { offerLpa: 40, offerOnTable: true, phase: "counter" };
const acc = (t: string) => classifyAcceptance(t, ctx).accepted;

const SHOULD_NOT_ACCEPT: string[] = [
  "I'll accept the day pigs fly.",
  "Sure, I'll take it — in an alternate universe.",
  "Deal? Only in your imagination.",
  "I'd love to accept, truly, but I can't at 40.",
  "I'll sign in another universe, maybe.",
  "I'd love to sign but I won't at this base.",
];

const GENUINE_ACCEPT: string[] = [
  "Yes, I accept the offer.",
  "Okay, I'll take it.",
  "Let's close it.",
  "Send me the offer letter, please.",
  "Fine, I'll sign today.",
  "Sure, I can do it at 40 — I accept.",
];

describe("PRI-75 — hostile accept/close no longer false-closes", () => {
  for (const t of SHOULD_NOT_ACCEPT) {
    it(`does NOT accept: "${t}"`, () => expect(acc(t)).toBe(false));
  }
});

describe("PRI-75 — genuine closes still fire", () => {
  for (const t of GENUINE_ACCEPT) {
    it(`accepts: "${t}"`, () => expect(acc(t)).toBe(true));
  }
});
