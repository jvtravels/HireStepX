/* Sprint B.1 (2026-05-15) — recommendWalkAway live in move-picker.
 * Conservative detector; should not fire on normal flows. */
import { describe, it, expect } from "vitest";
import {
  initState,
  pickAiMove,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";

const BAND: NegotiationBand = { initialOffer: 15, maxStretch: 22, walkAway: 12, hasEquity: false };

function makeState(overrides: Partial<NegotiationState> = {}): NegotiationState {
  return { ...initState({ sessionId: "s", role: "swe", company: "acme", band: BAND }), ...overrides };
}

describe("Sprint B.1 — live walk-away routing", () => {
  it("normal opening turn does not fire walk-away", () => {
    const s = makeState();
    const move = pickAiMove(s);
    expect(move.lever).not.toBe("close-walkaway");
  });

  it("normal counter-offer flow does not fire walk-away", () => {
    const s = makeState({
      phase: "counter-offer",
      highestOfferMade: 16,
      candidateTarget: 18,
      turnIndex: 2,
    });
    const move = pickAiMove(s);
    expect(move.lever).not.toBe("close-walkaway");
  });

  it("target >20% above ceiling after 3+ turns fires walk-away (past min-turns floor)", () => {
    const s = makeState({
      phase: "counter-offer",
      highestOfferMade: 20,
      candidateTarget: 30, // ceiling 22 × 1.2 = 26.4; 30 > 26.4
      turnIndex: 9, // past minTurnsBeforeClose=8 (F1 turn-gate)
    });
    const move = pickAiMove(s);
    expect(move.lever).toBe("close-walkaway");
  });

  it("final-offer asserted 3x without convergence fires walk-away (past min-turns floor)", () => {
    const s = makeState({
      phase: "counter-offer",
      highestOfferMade: 20,
      finalOfferAssertedCount: 3,
      turnIndex: 9, // past minTurnsBeforeClose=8 (F1 turn-gate)
    });
    const move = pickAiMove(s);
    expect(move.lever).toBe("close-walkaway");
  });

  it("at ceiling after 8+ turns fires walk-away", () => {
    const s = makeState({
      phase: "counter-offer",
      highestOfferMade: 22, // = maxStretch
      turnIndex: 9,
    });
    const move = pickAiMove(s);
    expect(move.lever).toBe("close-walkaway");
  });

  it("rationale carries the walk-away reason", () => {
    const s = makeState({
      phase: "counter-offer",
      highestOfferMade: 20,
      candidateTarget: 30,
      turnIndex: 9, // past minTurnsBeforeClose=8 (F1 turn-gate)
    });
    const move = pickAiMove(s);
    expect(move.lever).toBe("close-walkaway");
    expect(move.rationale).toMatch(/walk-away/i);
  });
});
