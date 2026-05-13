/* Bug-report 12 (2026-05-14) — close-floor invariant + restricted
 * auto-accept gate.
 *
 * Session 12 catastrophic bug: AI opened at ₹49 LPA. Candidate intake
 * target had been ₹22.4L (sticky on state.candidateTarget). On the
 * candidate's next turn the auto-accept gate fired because the
 * (sticky) candidateTarget was ≤ highestOfferMade, and the AI closed
 * at ₹22.4L. Hard invariant violation: the kernel must NEVER close
 * below state.highestOfferMade.
 *
 * Two fixes verified here:
 *   1. The auto-accept gate now fires only on an explicit numeric
 *      counter parsed in the CURRENT turn (lastCandidateCounterLpa),
 *      NOT on the sticky intake target.
 *   2. Every close-acceptance return clamps newTotalLpa to ≥
 *      highestOfferMade via clampToCloseFloor().
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  clampToCloseFloor,
  pickAiMove,
  applyCandidateAnswer,
  applyAiMove,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";

const BAND: NegotiationBand = { initialOffer: 40, maxStretch: 55, walkAway: 30, hasEquity: true };
const init = (overrides: Partial<NegotiationState> = {}): NegotiationState => ({
  ...initState({ sessionId: "s12", role: "swe", company: "acme", band: BAND }),
  ...overrides,
});

describe("clampToCloseFloor", () => {
  it("returns highestOfferMade when value is below floor", () => {
    const s = init({ highestOfferMade: 49 });
    expect(clampToCloseFloor(s, 22.4)).toBe(49);
  });

  it("returns value when value is above floor", () => {
    const s = init({ highestOfferMade: 49 });
    expect(clampToCloseFloor(s, 52)).toBe(52);
  });

  it("falls back to band.initialOffer when AI hasn't opened yet", () => {
    const s = init({ highestOfferMade: 0 });
    expect(clampToCloseFloor(s, 10)).toBe(BAND.initialOffer);
  });
});

describe("close-floor invariant — session 12 reproduction", () => {
  it("NEVER closes below highestOfferMade even with sticky candidateTarget far below", () => {
    /* Session 12 exact: AI opened at ₹49L, intake target sticky at
     * ₹22.4L, candidate utters acceptance / silence without a fresh
     * in-turn counter. */
    const s = init({
      phase: "counter-offer",
      highestOfferMade: 49,
      candidateTarget: 22.4,        // sticky from intake
      lastCandidateCounterLpa: null, // NO fresh counter this turn
    });
    const move = pickAiMove(s);
    /* If the gate misfires it would route to close-acceptance at 22.4
     * — the catastrophic bug. The restricted gate doesn't fire, so
     * the move-picker continues to the counter-offer path (or
     * lever-explore on no headroom). Either way, if it IS a
     * close-acceptance, the floor invariant must hold. */
    if (move.lever === "close-acceptance") {
      expect(move.newTotalLpa).not.toBeNull();
      expect(move.newTotalLpa!).toBeGreaterThanOrEqual(49);
    } else {
      expect(move.lever).not.toBe("close-acceptance");
    }
  });

  it("terminal accepted-phase close still respects floor", () => {
    /* If state ever entered accepted with a bad highestOfferMade
     * computation, the terminal close path also clamps. */
    const s = init({
      phase: "accepted",
      highestOfferMade: 49,
    });
    const move = pickAiMove(s);
    expect(move.lever).toBe("close-acceptance");
    expect(move.newTotalLpa).toBe(49);
  });
});

describe("auto-accept gate — restricted to current-turn counters", () => {
  it("does NOT fire when only a sticky intake target is present (no fresh counter)", () => {
    const s = init({
      phase: "counter-offer",
      highestOfferMade: 49,
      candidateTarget: 22.4,         // sticky from intake
      lastCandidateCounterLpa: null, // critical: nothing parsed this turn
    });
    const move = pickAiMove(s);
    expect(move.lever).not.toBe("close-acceptance");
  });

  it("DOES fire when candidate explicitly counters below current offer THIS turn, but close clamps to floor", () => {
    /* Spec: candidate counters DOWN to ₹20L when current offer is
     * ₹25L. Gate fires (this is the legitimate close-below-offer
     * intent), but the close-floor invariant says we never close
     * below highestOfferMade — so close at ₹25L, not ₹20L. The
     * candidate already had ₹25L on the table; they don't need to
     * take less than what was offered. */
    const s = init({
      phase: "counter-offer",
      highestOfferMade: 25,
      candidateTarget: 20,
      lastCandidateCounterLpa: 20, // fresh counter this turn
    });
    const move = pickAiMove(s);
    expect(move.lever).toBe("close-acceptance");
    expect(move.newTotalLpa).toBe(25);
  });

  it("fires and closes at floor even when fresh counter equals 0.05L below offer", () => {
    const s = init({
      phase: "counter-offer",
      highestOfferMade: 30,
      candidateTarget: 29.95,
      lastCandidateCounterLpa: 29.95,
    });
    const move = pickAiMove(s);
    expect(move.lever).toBe("close-acceptance");
    expect(move.newTotalLpa).toBe(30);
  });
});

describe("lastCandidateCounterLpa lifecycle", () => {
  it("is set when candidate states a fresh target distinct from prior sticky", () => {
    const s0 = init({
      phase: "probe-expectations",
      highestOfferMade: 25,
      candidateTarget: null,
      lastAiText: "What range are you targeting?",
    });
    const s1 = applyCandidateAnswer(s0, "I'm looking for around 20 LPA.");
    expect(s1.lastCandidateCounterLpa).toBe(20);
    expect(s1.candidateTarget).toBe(20);
  });

  it("is cleared after the AI's next move so it doesn't bleed into the next turn", () => {
    const s0 = init({
      phase: "counter-offer",
      highestOfferMade: 25,
      candidateTarget: 20,
      lastCandidateCounterLpa: 20,
    });
    const move = pickAiMove(s0);
    const s1 = applyAiMove(s0, move, "Let's close at ₹25L.");
    expect(s1.lastCandidateCounterLpa).toBeNull();
  });

  it("does NOT re-fire on subsequent turn when sticky target unchanged and no fresh counter", () => {
    /* Direct session 12 sequence emulation. */
    let s = init({
      phase: "counter-offer",
      highestOfferMade: 49,
      candidateTarget: 22.4,
      lastCandidateCounterLpa: null,
    });
    /* Turn N: candidate says something non-numeric. */
    s = applyCandidateAnswer(s, "Could you tell me about the benefits?");
    expect(s.lastCandidateCounterLpa).toBeNull();
    const move = pickAiMove(s);
    if (move.lever === "close-acceptance") {
      expect(move.newTotalLpa!).toBeGreaterThanOrEqual(49);
    } else {
      expect(move.lever).not.toBe("close-acceptance");
    }
  });
});
