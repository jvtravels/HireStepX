/* Crack 3 (2026-05-17) — defensive-lever ladder determinism.
 *
 * Locks the band-defense triad as a strict step ladder keyed off the
 * reactiveFollowupsFired ledger. Step N fires only if step N-1 is in
 * the ledger:
 *
 *   step 0 → comparative-anchoring
 *   step 1 → panel-approval-stall
 *   step 2 → internal-equity-defense
 *
 * Reactive interrupts (anchor-defense-hike-strong, fake-leverage-
 * challenge) intercept ABOVE the triad and never shuffle its order:
 * when an interrupt clears, the ladder resumes at exactly the step
 * dictated by the ledger — not restart, not skip.
 */
import { describe, it, expect, expectTypeOf } from "vitest";
import {
  initState,
  type NegotiationBand,
  type NegotiationState,
} from "../../../server-handlers/_negotiation-kernel";
import {
  defensiveLadderStep,
  planNextAction,
} from "../../../server-handlers/_next-action-planner";

const BAND: NegotiationBand = {
  initialOffer: 22,
  maxStretch: 30,
  walkAway: 18,
  hasEquity: false,
};

const mk = (overrides: Partial<NegotiationState> = {}): NegotiationState => ({
  ...initState({
    sessionId: "defensive-ladder",
    role: "Backend Engineer",
    company: "Flipkart",
    band: BAND,
  }),
  phase: "counter-offer",
  counterRound: 1,
  turnIndex: 4,
  highestOfferMade: 24,
  candidateTarget: 28,
  candidateCurrentCtc: 20,
  /* The triad lives after the first counter-base has shipped; record
   * it here so probe-justification (which gates on !leversUsed.counter-
   * base) doesn't intercept the planner before the ladder runs. */
  leversUsed: ["counter-base"],
  ...overrides,
});

describe("Crack 3 — defensiveLadderStep step gating", () => {
  it("invariant 1: empty fired + counterRound=1 → step 0 (comparative-anchoring)", () => {
    const s = mk({ reactiveFollowupsFired: [] });
    expect(defensiveLadderStep(s)).toBe(0);
    expect(planNextAction(s).kind).toBe("comparative-anchoring");
  });

  it("invariant 2: after comparative-anchoring fired + counterRound=1 STILL → step 1 (panel-approval-stall, before counterRound bumps)", () => {
    const s = mk({
      counterRound: 1,
      reactiveFollowupsFired: ["comparative-anchoring"],
    });
    expect(defensiveLadderStep(s)).toBe(1);
    expect(planNextAction(s).kind).toBe("panel-approval-stall");
  });

  it("invariant 3: after step 0 + step 1 fired → step 2 (internal-equity-defense)", () => {
    const s = mk({
      counterRound: 1,
      reactiveFollowupsFired: ["comparative-anchoring", "panel-approval-stall"],
    });
    expect(defensiveLadderStep(s)).toBe(2);
    expect(planNextAction(s).kind).toBe("internal-equity-defense");
  });

  it("invariant 4: counterRound=0 → null (triad not yet armed)", () => {
    const s = mk({ counterRound: 0, reactiveFollowupsFired: [] });
    expect(defensiveLadderStep(s)).toBeNull();
  });

  it("invariant 4b: wrong phase → null (triad not yet armed)", () => {
    const s = mk({ phase: "opening", counterRound: 1, reactiveFollowupsFired: [] });
    expect(defensiveLadderStep(s)).toBeNull();
  });

  it("invariant 5: all three fired → null (triad exhausted)", () => {
    const s = mk({
      counterRound: 2,
      reactiveFollowupsFired: [
        "comparative-anchoring",
        "panel-approval-stall",
        "internal-equity-defense",
      ],
    });
    expect(defensiveLadderStep(s)).toBeNull();
    /* Falls through to other counter-offer branches — must NOT re-emit
     * any of the three. */
    const action = planNextAction(s);
    expect(action.kind).not.toBe("comparative-anchoring");
    expect(action.kind).not.toBe("panel-approval-stall");
    expect(action.kind).not.toBe("internal-equity-defense");
  });

  it("invariant 6: anchor-defense-hike-strong intercepts at step 1; once it clears, the ladder resumes at step 1 — not step 0, not step 2", () => {
    /* Step 0 already fired. Candidate now complains about hike% — the
     * hoisted interception block emits anchor-defense-hike-strong,
     * which sits ABOVE the triad and pushes nothing onto the
     * reactiveFollowupsFired ledger. The triad's "next step" must
     * remain 1 throughout. */
    const beforeInterrupt = mk({
      counterRound: 1,
      candidateCurrentCtc: 20,
      reactiveFollowupsFired: ["comparative-anchoring"],
      candidateStance: {
        flexibilityPosture: null,
        marketReferenceVague: false,
        salaryOnlyFactor: false,
        badmouthsCurrent: false,
        confidentialOvershare: false,
        soundsDesperate: false,
        treatsEquityAsCash: false,
        avoidsAnchor: false,
        personalExpenseJustification: false,
        offerShoppingDemand: false,
        dismissesVariableRisk: false,
        overpromisesJoining: false,
        complainedAboutHikePercent: true,
        stallSignal: null,
        hasAny: true,
      },
    });
    /* Ladder step is still 1 (interrupt doesn't shuffle it). */
    expect(defensiveLadderStep(beforeInterrupt)).toBe(1);
    /* Planner emits the interrupt, NOT the triad step. */
    const intercepted = planNextAction(beforeInterrupt);
    expect(intercepted.kind).toBe("anchor-defense-hike-strong");

    /* Interrupt clears: hikeStrongDefenseFiredAtTurn is stamped by
     * applyAiMove. Ledger is untouched. Ladder must resume at step 1. */
    const afterInterrupt: NegotiationState = {
      ...beforeInterrupt,
      hikeStrongDefenseFiredAtTurn: beforeInterrupt.turnIndex,
      candidateStance: {
        ...beforeInterrupt.candidateStance,
        complainedAboutHikePercent: false,
        hasAny: false,
      },
    };
    expect(defensiveLadderStep(afterInterrupt)).toBe(1);
    expect(planNextAction(afterInterrupt).kind).toBe("panel-approval-stall");
  });

  it("invariant 7: defensiveLadderStep return type is `0 | 1 | 2 | null` (no widening)", () => {
    expectTypeOf(defensiveLadderStep).returns.toEqualTypeOf<0 | 1 | 2 | null>();
  });
});
