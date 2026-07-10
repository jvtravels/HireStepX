/* PRI-81 (2026-07-10) — surfaced by an ADVERSARIAL DIFFERENTIAL AUDIT of the
 * acceptance-classifier (combinatorial accept-core × modifier matrix measuring
 * both leak and overreach), not by a hand-picked example. The audit proved two
 * things at once:
 *
 *   1. OVERREACH = 0 — no genuine accept is over-rejected by the veto bank
 *      (the failure mode that hurts real candidates). Pinned by the sibling
 *      pri80 battery + the 100/100 genuine matrix.
 *   2. One REAL leak class: the worth-conditional veto (PRI-79) enumerated only
 *      the conjunction temporal heads (when/once/until/till) and missed the
 *      NOUN-PHRASE synonyms (the moment/second/minute/instant) — exact synonyms
 *      in the identical "<temporal> … worth <verb>" refusal frame. "Deal, the
 *      moment it's worth signing" leaked as a false-close.
 *
 * The fix COMPLETES the existing pattern's temporal alternation over its own
 * synonym set (a generalization of one veto, not a new bespoke rule). This test
 * pins the newly-covered synonyms AND the pre-existing conjunctions as controls,
 * so the head can't silently lose a synonym later. */
import { describe, it, expect } from "vitest";
import { classifyAcceptance } from "../../server-handlers/_acceptance-classifier";

const ctx = { offerLpa: 40, offerOnTable: true, phase: "counter" };
const acc = (t: string) => classifyAcceptance(t, ctx).accepted;

const WORTH_CONDITIONAL_REFUSALS: string[] = [
  // newly-covered noun-phrase temporal heads
  "Deal, the moment it's worth signing.",
  "I'll take it the second it's worth taking.",
  "Sure — the minute you make it worth signing, I'm in.",
  "I accept the instant it's worth accepting.",
  // pre-existing conjunction heads (controls — must stay vetoed)
  "I'll take it once it's worth taking.",
  "I'll sign when you offer something worth signing.",
  "I'll consider it until it's worth my time.",
];

const GENUINE_ACCEPTS: string[] = [
  // "worth" with NO temporal-conditional head is a real accept, untouched
  "This is worth signing, deal!",
  "Honestly it's worth taking, I accept the offer.",
  "Yes, I accept the offer at 40.",
  "Sold. Send the paperwork.",
];

describe("PRI-81 — worth-conditional veto covers its full temporal-synonym set", () => {
  for (const t of WORTH_CONDITIONAL_REFUSALS)
    it(`does NOT accept: "${t}"`, () => expect(acc(t)).toBe(false));
});

describe("PRI-81 — un-conditioned 'worth' praise still closes (no overreach)", () => {
  for (const t of GENUINE_ACCEPTS)
    it(`accepts: "${t}"`, () => expect(acc(t)).toBe(true));
});
