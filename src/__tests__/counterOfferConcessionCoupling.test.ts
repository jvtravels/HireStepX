/* F4 (2026-05-15) — counter-offer-risk concession coupling.
 *
 * When the candidate's profile flags retention-counter risk, every
 * concession we make has elevated renege probability. The move-picker
 * tightens the counter-base split: high → ×0.8, medium → ×0.9,
 * low → unchanged. Market-mode multiplier composes on top.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  pickAiMove,
  type AiMove,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";

const BAND: NegotiationBand = { initialOffer: 20, maxStretch: 32, walkAway: 15, hasEquity: false };

function makeCounterState(overrides: Partial<NegotiationState> = {}): NegotiationState {
  const base = initState({ sessionId: "s", role: "swe", company: "Acme", band: BAND });
  return {
    ...base,
    phase: "counter-offer",
    turnIndex: 2,
    highestOfferMade: 22,
    candidateTarget: 28,
    candidateCurrentCtc: 24, // hike target = (28-24)/24 = 16.7% — sweet spot
    ...overrides,
  };
}

function newTotal(move: AiMove): number {
  expect(move.newTotalLpa).not.toBeNull();
  return move.newTotalLpa as number;
}

describe("F4 — counter-offer risk × concession curve", () => {
  it("low-risk baseline produces a baseline counter total", () => {
    /* No tenure / employer / vague-competing signals → low risk. */
    const s = makeCounterState();
    const move = pickAiMove(s);
    expect(move.lever).toBe("counter-base");
    /* Sanity: it's a real concession, not a hold-firm. */
    expect(newTotal(move)).toBeGreaterThan(22);
  });

  it("high-risk profile (short tenure + well-funded current + vague competing) concedes LESS than low-risk", () => {
    const low = pickAiMove(makeCounterState());
    const high = pickAiMove(
      makeCounterState({
        currentEmployer: "Infosys",
        candidateProfile: {
          ...makeCounterState().candidateProfile,
          tenureSignal: "12 months",
        } as never,
        competingOffer: 30, // vague — no detail, no letter share
      }),
    );
    expect(newTotal(high)).toBeLessThan(newTotal(low));
  });

  it("letter-in-hand competing offer LOWERS counter-offer risk vs. vague (subtracts 0.5)", () => {
    /* letter-in-hand reduces the credibility risk score; for an otherwise
     * identical profile this should land in the LOW (not HIGH) bucket. */
    const vagueHigh = pickAiMove(
      makeCounterState({
        currentEmployer: "Wipro",
        candidateProfile: {
          ...makeCounterState().candidateProfile,
          tenureSignal: "18 months",
        } as never,
        competingOffer: 30,
      }),
    );
    const letterInHand = pickAiMove(
      makeCounterState({
        currentEmployer: "Wipro",
        candidateProfile: {
          ...makeCounterState().candidateProfile,
          tenureSignal: "18 months",
        } as never,
        competingOffer: 30,
        competingOfferDetail: {
          company: "Acme Competitor",
          status: "letter",
          stage: "received",
          letterShareOffered: true,
          onHold: false,
          hasAny: true,
        } as never,
      }),
    );
    /* letter-in-hand should concede AT LEAST AS MUCH as the vague case. */
    expect(newTotal(letterInHand)).toBeGreaterThanOrEqual(newTotal(vagueHigh));
  });

  it("market-mode multiplier composes on top of risk multiplier", () => {
    /* Same high-risk profile in soft vs hot markets: hot should still
     * concede more than soft. The risk multiplier doesn't override
     * market mode — it stacks. */
    const high = {
      currentEmployer: "Infosys",
      candidateProfile: {
        ...makeCounterState().candidateProfile,
        tenureSignal: "12 months",
      } as never,
      competingOffer: 30,
    };
    const soft = pickAiMove(makeCounterState({ ...high, marketMode: "soft" }));
    const hot = pickAiMove(makeCounterState({ ...high, marketMode: "hot" }));
    expect(newTotal(hot)).toBeGreaterThan(newTotal(soft));
  });

  it("no-target state takes the lever-explore branch, risk math doesn't crash", () => {
    /* Guard: the risk coupling must not throw on partially-specified state. */
    const s = makeCounterState({
      candidateTarget: null,
      candidateCurrentCtc: null,
    });
    expect(() => pickAiMove(s)).not.toThrow();
  });
});
