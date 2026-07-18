/* S4S5-B3 / S4S5-B4 (2026-07-18) — offer-composition / finalTotal invariant.
 *
 * The report's Deal Summary renders `finalTotal` = the kernel's
 * `finalOfferLpa`, which is the max of the offer trajectory built from each
 * move's `newTotalLpa` (the RECURRING annual CTC). A joining bonus is a
 * one-time cash lever tracked separately on `lastJoiningBonusOffered` /
 * `joiningBonusAmount` (see the AiMove.joiningBonusAmount field doc) and must
 * NEVER be folded into the recurring total — doing so would inflate the
 * headline CTC by a one-off payment.
 *
 * The audit rows S4S5-B3/B4 suspected the final total was mis-composed (a
 * one-time bonus leaking into the recurring number, or a component split not
 * summing to the stated total). These tests drive the real kernel move-apply
 * boundary and assert the invariant holds:
 *   1. A `joining-bonus` move (one-time cash) does NOT raise highestOfferMade.
 *   2. A `newTotalLpa` move sets highestOfferMade to EXACTLY that number —
 *      no bonus, no component, added on top.
 *   3. highestOfferMade is monotone-up (close-floor invariant): a lower
 *      subsequent numeric move never drops the standing total.
 *
 * Verdict: composition is correct by design; these lock it (REMOVABLE).
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  applyAiMove,
  type NegotiationBand,
  type NegotiationState,
  type AiMove,
} from "../../server-handlers/_negotiation-kernel";

const BAND: NegotiationBand = {
  initialOffer: 28,
  maxStretch: 40,
  walkAway: 25,
  hasEquity: true,
};

const baseState = (sessionId: string): NegotiationState => {
  const s = initState({ sessionId, role: "Senior Engineer", company: "acme", band: BAND });
  return { ...s, turnIndex: 4, phase: "counter-offer" };
};

const mkMove = (over: Partial<AiMove>): AiMove => ({
  lever: "hold-firm",
  newTotalLpa: null,
  rationale: "test",
  ...over,
});

describe("offer composition / finalTotal invariant (S4S5-B3/B4)", () => {
  it("a numeric offer sets highestOfferMade to EXACTLY newTotalLpa", () => {
    const s = applyAiMove(
      baseState("oc-exact"),
      mkMove({ lever: "counter-base", newTotalLpa: 34 }),
      "We can do 34 LPA all-in.",
    );
    expect(s.highestOfferMade).toBe(34);
  });

  it("a one-time joining bonus does NOT inflate the recurring highestOfferMade", () => {
    // Establish a recurring offer of 34, then grant a 4 LPA one-time joining
    // bonus. The recurring total must stay 34 — the bonus is tracked apart.
    let s = applyAiMove(
      baseState("oc-jb"),
      mkMove({ lever: "counter-base", newTotalLpa: 34 }),
      "We can do 34 LPA all-in.",
    );
    expect(s.highestOfferMade).toBe(34);
    s = applyAiMove(
      s,
      mkMove({ lever: "joining-bonus", newTotalLpa: null, joiningBonusAmount: 4 }),
      "Plus a one-time joining bonus of 4 lakhs.",
    );
    // The recurring CTC is unchanged (NOT 34 + 4 = 38)...
    expect(s.highestOfferMade).toBe(34);
    // ...and the bonus is recorded on its own separate field.
    expect(s.lastJoiningBonusOffered).toBe(4);
  });

  it("highestOfferMade is monotone-up: a lower later numeric move never lowers it", () => {
    let s = applyAiMove(
      baseState("oc-monotone"),
      mkMove({ lever: "counter-base", newTotalLpa: 36 }),
      "36 LPA.",
    );
    expect(s.highestOfferMade).toBe(36);
    s = applyAiMove(
      s,
      mkMove({ lever: "hold-firm", newTotalLpa: 33 }),
      "Holding at 33.",
    );
    // Close-floor invariant: the standing best offer never regresses.
    expect(s.highestOfferMade).toBe(36);
  });
});
