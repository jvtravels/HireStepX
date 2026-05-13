/**
 * Session B (2026-05-14) — Area 6 audit.
 *
 * Close-path invariant: every kernel return site that emits
 * lever="close-acceptance" MUST clamp newTotalLpa to
 * clampToCloseFloor(state, _), so close >= highestOfferMade.
 *
 * Two close-acceptance return sites exist in pickAiMove
 * (server-handlers/_negotiation-kernel.ts):
 *   1. state.phase === "accepted" path (line ~1579)
 *   2. candidate-counter-below-offer auto-accept gate (line ~1634)
 *
 * Plus a third "terminal-restate" path (line ~1564) that also emits a
 * newTotalLpa clamped to the floor — included here to lock its
 * invariant too.
 *
 * Strategy: synthesise NegotiationState directly via initState +
 * overrides, drive pickAiMove through each close path with a
 * candidateCounter / highestOffer combo that would, absent the clamp,
 * close below floor. Assert newTotalLpa >= highestOfferMade in every
 * path.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  pickAiMove,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";

const BAND: NegotiationBand = { initialOffer: 40, maxStretch: 55, walkAway: 30, hasEquity: true };

function mkState(overrides: Partial<NegotiationState> = {}): NegotiationState {
  return {
    ...initState({ sessionId: "audit", role: "swe", company: "acme", band: BAND }),
    ...overrides,
  };
}

describe("close-path invariant audit — every close-acceptance respects clampToCloseFloor", () => {
  it("[Path 1] phase=accepted: close at highestOfferMade even when highestOfferMade > band.initialOffer", () => {
    const s = mkState({ phase: "accepted", highestOfferMade: 52, acceptedAtTurn: 5, turnIndex: 5 });
    const move = pickAiMove(s);
    expect(move.lever).toBe("close-acceptance");
    expect(move.newTotalLpa!).toBeGreaterThanOrEqual(s.highestOfferMade);
  });

  it("[Path 1] phase=accepted: falls back to band.initialOffer when AI hasn't opened", () => {
    const s = mkState({ phase: "accepted", highestOfferMade: 0, acceptedAtTurn: 1, turnIndex: 1 });
    const move = pickAiMove(s);
    expect(move.lever).toBe("close-acceptance");
    expect(move.newTotalLpa!).toBeGreaterThanOrEqual(BAND.initialOffer);
  });

  it("[Path 2] auto-accept gate: candidate counters DOWN below current offer — close at higher number", () => {
    const s = mkState({
      phase: "counter-offer",
      highestOfferMade: 49,
      lastCandidateCounterLpa: 22.4,
      candidateTarget: 22.4,
      turnIndex: 3,
    });
    const move = pickAiMove(s);
    expect(move.lever).toBe("close-acceptance");
    expect(move.newTotalLpa!).toBeGreaterThanOrEqual(49);
  });

  it("[Path 2] auto-accept gate: candidate counter equals offer — close at the offer", () => {
    const s = mkState({
      phase: "counter-offer",
      highestOfferMade: 40,
      lastCandidateCounterLpa: 40,
      turnIndex: 3,
    });
    const move = pickAiMove(s);
    expect(move.lever).toBe("close-acceptance");
    expect(move.newTotalLpa!).toBeGreaterThanOrEqual(40);
  });

  it("[Path 3] terminal-restate after accepted: still respects floor on subsequent restate turns", () => {
    /* acceptedAtTurn < turnIndex triggers the terminal-restate branch. */
    const s = mkState({
      phase: "accepted",
      highestOfferMade: 60,
      acceptedAtTurn: 4,
      turnIndex: 6,
    });
    const move = pickAiMove(s);
    expect(move.lever).toBe("terminal-restate");
    expect(move.newTotalLpa!).toBeGreaterThanOrEqual(60);
  });

  it("Property: across 100 random (highestOffer ∈ [30..80], counter ∈ [10..highestOffer]) close >= highestOfferMade", () => {
    let prng = 1n;
    const rnd = () => {
      prng = (prng * 6364136223846793005n + 1442695040888963407n) & ((1n << 64n) - 1n);
      return Number(prng >> 32n) / 0x1_0000_0000;
    };
    for (let i = 0; i < 100; i++) {
      const hi = 30 + Math.floor(rnd() * 51); // 30..80
      const counter = 10 + Math.floor(rnd() * (hi - 9)); // 10..hi
      const s = mkState({
        phase: "counter-offer",
        highestOfferMade: hi,
        lastCandidateCounterLpa: counter,
        turnIndex: 4,
      });
      const move = pickAiMove(s);
      expect(move.lever).toBe("close-acceptance");
      expect(move.newTotalLpa!, `randomised case hi=${hi} counter=${counter}`).toBeGreaterThanOrEqual(hi);
    }
  });
});
