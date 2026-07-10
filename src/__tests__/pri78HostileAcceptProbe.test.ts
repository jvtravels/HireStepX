/* PRI-78 (2026-07-10, round-10 offline hostile accept/close probe against the
 * acceptance-classifier single source of truth) — four false-closes (the
 * unrecoverable class: the bot finalizes a deal the candidate is refusing):
 *
 *   A. "I'm happy to accept a counteroffer, not this." / "I accept your
 *      invitation to keep talking." — an accept verb applied to a NON-offer
 *      object (a counteroffer, an invitation). ACCEPT_PROPOSITION requires the
 *      verb to abut the subject ("happy to accept" detaches it) and its object
 *      list is abstractions, so these slipped. New verb-fronted
 *      WRONG_OBJECT_ACCEPT_PATTERN, scoped to objects that are definitionally
 *      not the on-table offer.
 *   B. "I accept on the condition you never do this again." — a close idiom
 *      FOLLOWED by a hard condition. CONDITIONAL_ACCEPT keys on the reverse
 *      order (condition-before-close), so this slipped. New
 *      CLOSE_THEN_CONDITIONAL_PATTERN, scoped to strong condition markers only
 *      (not bare "if", so politeness tails are spared).
 *   C. "Yeah I'll take it... said no engineer ever." — the "said no <noun>
 *      ever" sarcasm idiom generalizes past PRI-74's fixed one/body head.
 *      SARCASTIC_REFUSAL widened to "said no <noun> ever".
 *
 * Each fix is scoped so a genuine accept is untouched: "accept the offer/at 40"
 * names no wrong object and carries no condition/sarcasm tail. */
import { describe, it, expect } from "vitest";
import { classifyAcceptance } from "../../server-handlers/_acceptance-classifier";

const ctx = { offerLpa: 40, offerOnTable: true, phase: "counter" };
const acc = (t: string) => classifyAcceptance(t, ctx).accepted;

const SHOULD_NOT_ACCEPT: string[] = [
  "I'm happy to accept a counteroffer, not this.",
  "I accept your invitation to keep talking, nothing more.",
  "Yeah I'll take it... said no engineer ever.",
  "I accept on the condition you never do this again.",
  "I accept the challenge of finding a better offer.",
  "I'll take it, provided the base moves.",
];

const GENUINE_ACCEPT: string[] = [
  "Yes, I accept the offer.",
  "Okay, I'll take it.",
  "Sold. Let's do it.",
  "Great, count me in — I accept at 40.",
  "Deal. Send the paperwork.",
  "You've got a deal.",
];

describe("PRI-78 — hostile accept/close no longer false-closes", () => {
  for (const t of SHOULD_NOT_ACCEPT) {
    it(`does NOT accept: "${t}"`, () => expect(acc(t)).toBe(false));
  }
});

describe("PRI-78 — genuine closes still fire", () => {
  for (const t of GENUINE_ACCEPT) {
    it(`accepts: "${t}"`, () => expect(acc(t)).toBe(true));
  }
});
