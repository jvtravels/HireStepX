import { describe, it, expect } from "vitest";
import { classifyAcceptance } from "../../server-handlers/_acceptance-classifier";

/* Family C — closed-by-default acceptance gate (2026-07-17).
 *
 * Root cause (verified against ground truth, not the audit's prose): the
 * `offerOnTable === false` phase gate lived ONLY in the Step 4/5 idiom path, so
 * a strong performative ("Yes, I accept.") bypassed it entirely, and a bare
 * "Deal." rode the broad offer-reference upgrade (whose vocabulary includes the
 * idiom word "deal") straight to an accept. Both FALSE-CLOSED a session before
 * any offer existed. The gate is now hoisted once, applied uniformly, with a
 * NARROWED concrete-offer escape that no longer treats a lone "deal" as an
 * offer reference. */

const noOffer = { offerLpa: 0, offerOnTable: false, phase: "anchor" } as const;
const withOffer = { offerLpa: 40, offerOnTable: true, phase: "counter" } as const;
const acc = (t: string, c: any) => classifyAcceptance(t, c).accepted;

describe("Family C — no offer on table ⇒ premature accept is vetoed", () => {
  it.each([
    "Deal.",
    "Deal, done.",
    "Yes, I accept.",
    "I accept.",
    "Absolutely, let's do it.",
    "Sounds good, let's go ahead.",
    "let's close it",
    "Done. Let's move forward.",
  ])("VETOES pre-offer close: %s", (t) => {
    const r = classifyAcceptance(t, noOffer);
    expect(r.accepted).toBe(false);
    expect(r.reasons).toContain("phase-gate-no-offer-veto");
  });
});

describe("Family C — concrete offer reference escapes the gate (back-compat)", () => {
  it.each([
    "The offer works for me.",
    "40 LPA works, I'm in.",
    "₹40 lakh is fine, let's proceed.",
    "The package works for me.",
  ])("ACCEPTS when the utterance names a concrete offer: %s", (t) => {
    expect(acc(t, noOffer)).toBe(true);
  });
});

describe("Family C — genuine closes WITH an offer on table still accept", () => {
  it.each([
    "Deal, let's move forward.",
    "Yes, I accept.",
    "Done. Send the paperwork.",
    "Sounds good, let's go ahead.",
  ])("ACCEPTS with offer on table: %s", (t) => {
    expect(acc(t, withOffer)).toBe(true);
  });
});

describe("Family C — undefined offerOnTable stays permissive (legacy callers)", () => {
  it("accepts a strong close with no phase context", () => {
    expect(acc("Yes, I accept.", {})).toBe(true);
    expect(acc("Deal.", {})).toBe(true);
  });
});
