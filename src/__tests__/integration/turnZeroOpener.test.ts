/* F1 (PDF#19 2026-05-15) — turn 0 opens with discovery, never an anchor.
 *
 * Previously _next-action-planner.ts:306 gated the discovery-probe
 * branch behind `turnIndex >= 1`, so turn 0 always fell through to
 * `open-with-offer` (anchor). Real recruiters never name a specific
 * number first; they ask a discovery question.
 *
 * This test drives the planner from a freshly-initialized turn-0 state
 * and asserts the planned action is a discovery-probe, not open-with-
 * offer.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  type NegotiationBand,
} from "../../../server-handlers/_negotiation-kernel";
import { planNextAction } from "../../../server-handlers/_next-action-planner";

const BAND: NegotiationBand = { initialOffer: 22, maxStretch: 30, walkAway: 18, hasEquity: false };

describe("F1 — turn 0 opens with discovery, never an anchor", () => {
  it("turn 0 plans ordered-discovery, not open-with-offer", () => {
    const state = initState({
      sessionId: "s-f1",
      role: "Software Engineer",
      company: "Google",
      band: BAND,
    });
    /* Sanity — fresh state should be turnIndex 0 and opening phase. */
    expect(state.turnIndex).toBe(0);
    expect(state.phase).toBe("opening");

    const action = planNextAction(state);
    /* F1 invariant: NOT an anchor on turn 0. */
    expect(action.kind).not.toBe("open-with-offer");
    /* F1 invariant: a discovery probe (or a higher-priority branch
     * like reactive-followup that doesn't anchor either). */
    expect(["discovery-probe", "reactive-followup", "probe-mismatch"]).toContain(action.kind);
  });
});
