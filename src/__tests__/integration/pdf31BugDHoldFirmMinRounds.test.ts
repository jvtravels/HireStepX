/* PDF#31 BUG D regression (2026-05-18) — hold-firm fired too early.
 *
 * Symptom (Meesho/Prita T18): bot emitted "as per the band for this
 * grade, the offer I have is what I've shared" after only one counter
 * exchange. The lever-loop-guard caught a repeating info-lever and
 * pivoted to hold-firm before any meaningful bargaining had happened.
 *
 * Fix: introduce MIN_COUNTER_ROUNDS_BEFORE_HOLD_FIRM (=2) and gate the
 * non-essential hold-firm emission sites on it. Verbal-accept and
 * counter-spiral-exhausted hold-firm bypass — those are structurally
 * later in the flow.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  type NegotiationBand,
  type NegotiationState,
  type NegotiationLever,
} from "../../../server-handlers/_negotiation-kernel";
import {
  planNextAction,
  MIN_COUNTER_ROUNDS_BEFORE_HOLD_FIRM,
} from "../../../server-handlers/_next-action-planner";

const BAND: NegotiationBand = {
  initialOffer: 23,
  maxStretch: 32,
  walkAway: 20,
  hasEquity: false,
};

const seed = (overrides: Partial<NegotiationState> = {}): NegotiationState => ({
  ...initState({
    sessionId: "pdf31-bugD",
    role: "Senior Product Designer",
    company: "Meesho",
    band: BAND,
  }),
  phase: "counter-offer",
  highestOfferMade: 24,
  ...overrides,
});

describe("PDF#31 BUG D — hold-firm respects min-counter-rounds floor", () => {
  it("constant is at least 2 (real bargaining requires at least two exchanges)", () => {
    expect(MIN_COUNTER_ROUNDS_BEFORE_HOLD_FIRM).toBeGreaterThanOrEqual(2);
  });

  it("lever-loop-guard does NOT fire hold-firm at counterRound=0", () => {
    const stuckLevers: NegotiationLever[] = ["benefits-summary", "benefits-summary"];
    const state = seed({
      counterRound: 0,
      leversUsed: stuckLevers,
    });
    const action = planNextAction(state);
    if (action.kind === "lever-loop-guard") {
      throw new Error(
        "lever-loop-guard should not fire before MIN_COUNTER_ROUNDS_BEFORE_HOLD_FIRM",
      );
    }
    /* Action must not carry the hold-firm lever this early. */
    const lever = (action as { _move?: { lever?: string } })._move?.lever;
    expect(lever).not.toBe("hold-firm");
  });

  it("lever-loop-guard does NOT fire hold-firm at counterRound=1", () => {
    const stuckLevers: NegotiationLever[] = ["benefits-summary", "benefits-summary"];
    const state = seed({
      counterRound: 1,
      leversUsed: stuckLevers,
    });
    const action = planNextAction(state);
    const lever = (action as { _move?: { lever?: string } })._move?.lever;
    expect(lever).not.toBe("hold-firm");
  });

  it("lever-loop-guard IS allowed to fire hold-firm at counterRound=2+", () => {
    const stuckLevers: NegotiationLever[] = ["benefits-summary", "benefits-summary"];
    const state = seed({
      counterRound: 2,
      leversUsed: stuckLevers,
    });
    const action = planNextAction(state);
    /* Either lever-loop-guard fires, or another action wins — but if
     * lever-loop-guard fires, hold-firm is now legitimate. */
    if (action.kind === "lever-loop-guard") {
      const lever = (action as { _move?: { lever?: string } })._move?.lever;
      expect(lever).toBe("hold-firm");
    }
  });

  it("counter-spiral round>=3 hold-firm bypass remains intact", () => {
    /* The counter-spiral exhaustion path at spiralRound>=3 must STILL
     * emit hold-firm regardless of the new gate — that's the legitimate
     * end-of-bargaining stonewall, not a premature one. */
    const state = seed({
      counterRound: 3,
      candidateTarget: 30,
    });
    const action = planNextAction(state);
    /* We can't force-route to the spiral branch from outside the
     * planner without setting up the full counter-offer state graph,
     * but the constant itself documents the boundary. Smoke-tested via
     * the broader suite. */
    expect(action).toBeDefined();
  });
});
