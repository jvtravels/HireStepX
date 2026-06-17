import { describe, it, expect } from "vitest";
import {
  initState,
  EMPTY_TURN_DELTA,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import { planNextAction } from "../../server-handlers/_next-action-planner";

/**
 * Planner-level regression for the THIRD completion sink (live-staging
 * finding, 2026-06-17).
 *
 * The bug: after the recruiter has anchored an offer, a candidate who
 * counters on the FIXED axis but phrases it as a question
 * ("I was targeting ₹50 LPA fixed. Can we get closer?") got swallowed by
 * the generic `answer-direct` reactive branch and shipped a content-free
 * "let me note that and come back to you" deflection — the recruiter never
 * engaged the counter, so the negotiation could never close.
 *
 * Root cause: TOTAL-scoped counters above the standing offer get early
 * counter-engagement force-routes (branches (c)/PDF#44), but FIXED-scoped
 * counters are excluded by `totalScopedCounter()` and fell through to
 * `answer-direct`, which has highest reactive priority and pre-empts the
 * native counter-offer handling.
 *
 * After the fix, a post-anchor fixed-scoped counter-as-question must route
 * to a real counter-engagement move (counter-base / hold-firm / lever-
 * explore / probe-justification), NEVER a reactive-followup deflection.
 */

const BAND: NegotiationBand = {
  initialOffer: 38.4,
  maxStretch: 48.8,
  walkAway: 29.5,
  hasEquity: true,
};

const fixedCounterState = (): NegotiationState =>
  initState({ sessionId: "fixed-counter-fixture", role: "swe", company: "acme", band: BAND });

describe("planNextAction — post-anchor fixed counter-as-question engages, never deflects", () => {
  it("a fixed-scoped counter phrased as a question routes to counter-engagement (not answer-direct)", () => {
    const s: NegotiationState = {
      ...fixedCounterState(),
      phase: "probe-expectations",
      turnIndex: 2,
      highestOfferMade: 38.4,
      candidateTargetFixed: 50,
      lastCandidateCounterLpa: 50,
      lastCounterComponent: "fixed",
      lastTurnDelta: { ...EMPTY_TURN_DELTA, askedQuestion: true },
    };

    const action = planNextAction(s);

    // The whole point: the recruiter must engage the counter, not deflect.
    expect(action.kind).not.toBe("reactive-followup");

    // It should be a genuine counter-engagement move.
    const engagementKinds = ["counter-offer", "hold-firm", "lever-explore", "probe-justification"];
    expect(engagementKinds).toContain(action.kind);
  });
});
