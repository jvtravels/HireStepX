/* PRI-62 (2026-07-06, live staging — Razorpay senior close) — regression
 * guard for the doubled "straight with you" hedge.
 *
 * On a frustrated candidate whose conditional close pins a FIXED figure
 * above the cash band, two independent hedges collided:
 *   - the "frustrated" sentiment prefix
 *       "I hear you — and I want to be straight with you here."
 *   - the above-band scopeReconcileAck body
 *       "On closing at ₹58L fixed — to be straight with you, …"
 * concatenating into one utterance with "straight with you" twice. The
 * fix drops the prefix's hedge tail (keeping the bare "I hear you —"
 * acknowledgement) whenever the body already carries the hedge, so it
 * fires exactly once — in the body, where the figure lives.
 */
import { describe, it, expect } from "vitest";
import { renderCanonicalProse } from "../../server-handlers/_canonical-prose";
import {
  initState,
  EMPTY_TURN_DELTA,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import type { NextAction } from "../../server-handlers/_next-action-planner";

const BAND_WITH_VARIABLE: NegotiationBand = {
  initialOffer: 44,
  maxStretch: 52.3,
  walkAway: 38,
  hasEquity: true,
  variableMax: 6,
};

const BAND_ALL_FIXED: NegotiationBand = {
  initialOffer: 40,
  maxStretch: 44,
  walkAway: 36,
  hasEquity: false,
};

function mkState(
  band: NegotiationBand,
  overrides: Partial<NegotiationState> = {},
): NegotiationState {
  return {
    ...initState({ sessionId: "s-pri62", role: "sr-swe", company: "razorpay", band }),
    lastTurnDelta: { ...EMPTY_TURN_DELTA, candidateSentiment: "frustrated" },
    highestOfferMade: 52.3,
    phase: "counter-offer",
    ...overrides,
  };
}

const aboveBandAsk = (fixed: number): NextAction =>
  ({ kind: "lever-explore", from: "default", fixedAskAboveBand: fixed } as unknown as NextAction);

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe("PRI-62 — doubled 'straight with you' hedge dedup", () => {
  it("emits the 'straight with you' hedge exactly once (variable band)", () => {
    const prose = renderCanonicalProse(aboveBandAsk(58), mkState(BAND_WITH_VARIABLE));
    expect(countOccurrences(prose.toLowerCase(), "straight with you")).toBe(1);
  });

  it("emits the hedge exactly once (all-fixed band)", () => {
    const prose = renderCanonicalProse(
      aboveBandAsk(50),
      mkState(BAND_ALL_FIXED, { highestOfferMade: 44 }),
    );
    expect(countOccurrences(prose.toLowerCase(), "straight with you")).toBe(1);
  });

  it("keeps the frustration acknowledgement head when the tail is dropped", () => {
    const prose = renderCanonicalProse(aboveBandAsk(58), mkState(BAND_WITH_VARIABLE));
    expect(prose).toContain("I hear you —");
    // the scope-reconcile body's hedge survives with its figures intact
    expect(prose).toContain("to be straight with you, ₹52.3L");
    expect(prose).toContain("₹58L as pure base is above the cash band");
  });

  it("still prepends the full frustrated prefix when the body has no hedge", () => {
    // A lever-explore with no above-band fixed ask → body carries no
    // "straight with you" hedge, so the full sentiment prefix stands.
    const genericLever: NextAction = { kind: "lever-explore", from: "default" } as NextAction;
    const prose = renderCanonicalProse(
      genericLever,
      mkState(BAND_WITH_VARIABLE, { lastCandidateCounterLpa: null }),
    );
    expect(prose).toContain("I hear you — and I want to be straight with you here.");
    expect(countOccurrences(prose.toLowerCase(), "straight with you")).toBe(1);
  });
});
