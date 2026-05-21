/* Realism-Audit Fix 3 (2026-05-22) — manager-consult stall.
 *
 * Asserts end-to-end:
 *   - candidate over-asks above band.maxStretch → planner picks
 *     manager-consult-stall (mode="open") when persona has high stall
 *     probability
 *   - applyAiMove on the open turn sets stallTurnsRemaining=1 and
 *     bumps stallsFiredCount
 *   - the NEXT planNextAction call returns mode="return-move" or
 *     mode="return-hold" (return-turn) with the stalled-ask context
 *     preserved
 *   - stall does NOT short-circuit on the first AI turn
 *   - stall session-cap holds: after 3 stalls, planner stops picking
 *     manager-consult-stall
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  applyAiMove,
  type NegotiationBand,
  type NegotiationState,
} from "../../../server-handlers/_negotiation-kernel";
import {
  planNextAction,
  actionToLever,
  STALL_SESSION_CAP,
} from "../../../server-handlers/_next-action-planner";

const BAND: NegotiationBand = {
  initialOffer: 22,
  maxStretch: 30,
  walkAway: 18,
  hasEquity: false,
};

function baseState(over: Partial<NegotiationState> = {}): NegotiationState {
  const base = initState({
    sessionId: "s-stall",
    role: "Backend Engineer",
    company: "PowerGrid",
    band: BAND,
  });
  return {
    ...base,
    /* PSU persona has stallProbability=0.65 — the planner gate fires. */
    recruiterSectorPersona: "psu",
    phase: "counter-offer",
    turnIndex: 3,
    counterRound: 1,
    highestOfferMade: 26,
    candidateTarget: 38,
    lastCandidateCounterLpa: 38, // over band.maxStretch (30)
    candidateCurrentCtc: 24,
    ...over,
  };
}

describe("Realism-Audit Fix 3 — open-turn gating", () => {
  it("does NOT fire on the first AI turn (turnIndex=0)", () => {
    const s = baseState({ turnIndex: 0, phase: "opening" });
    const action = planNextAction(s);
    expect(action.kind).not.toBe("manager-consult-stall");
  });

  it("fires when candidate over-asks above band.maxStretch on PSU persona", () => {
    const s = baseState();
    const action = planNextAction(s);
    expect(action.kind).toBe("manager-consult-stall");
    if (action.kind === "manager-consult-stall") {
      expect(action.mode).toBe("open");
      expect(action.stalledAskLpa).toBe(38);
      expect(action.returnConcessionLpa).toBeNull();
    }
  });

  it("does NOT fire when candidate ask is WITHIN band", () => {
    const s = baseState({ lastCandidateCounterLpa: 28 });
    const action = planNextAction(s);
    expect(action.kind).not.toBe("manager-consult-stall");
  });

  it("does NOT fire on low-stall personas (early-startup) even with over-ask", () => {
    const s = baseState({ recruiterSectorPersona: "early-startup" });
    const action = planNextAction(s);
    expect(action.kind).not.toBe("manager-consult-stall");
  });
});

describe("Realism-Audit Fix 3 — return-turn cycle", () => {
  it("after open fires, next turn ships return-move OR return-hold with stalled-ask context", () => {
    const s0 = baseState();
    const open = planNextAction(s0);
    expect(open.kind).toBe("manager-consult-stall");
    /* Ship the open move through applyAiMove to advance state. */
    const move = actionToLever(open, s0);
    const s1 = applyAiMove(s0, move, "stall opener");
    expect(s1.stallTurnsRemaining).toBe(1);
    expect(s1.stallsFiredCount).toBe(1);
    expect(s1.lastStallContext?.stalledAskLpa).toBe(38);

    /* Next planner turn picks the return. */
    const returnAction = planNextAction({ ...s1, lastCandidateCounterLpa: null });
    expect(returnAction.kind).toBe("manager-consult-stall");
    if (returnAction.kind === "manager-consult-stall") {
      expect(["return-move", "return-hold"]).toContain(returnAction.mode);
      /* The stalled-ask context is preserved verbatim. */
      expect(returnAction.stalledAskLpa).toBe(38);
    }
  });

  it("PSU return defaults to hold (cadre-pay-rigid)", () => {
    const s0 = baseState();
    const open = planNextAction(s0);
    const s1 = applyAiMove(s0, actionToLever(open, s0), "open");
    const ret = planNextAction({ ...s1, lastCandidateCounterLpa: null });
    expect(ret.kind).toBe("manager-consult-stall");
    if (ret.kind === "manager-consult-stall") {
      expect(ret.mode).toBe("return-hold");
      expect(ret.returnConcessionLpa).toBeNull();
    }
  });

  it("after return turn fires, stallTurnsRemaining decrements to 0 and lastStallContext clears", () => {
    const s0 = baseState();
    const open = planNextAction(s0);
    const s1 = applyAiMove(s0, actionToLever(open, s0), "open");
    const ret = planNextAction({ ...s1, lastCandidateCounterLpa: null });
    const s2 = applyAiMove(s1, actionToLever(ret, s1), "return");
    expect(s2.stallTurnsRemaining).toBe(0);
    expect(s2.lastStallContext).toBeNull();
    expect(s2.stallsFiredCount).toBe(1); // unchanged on return
  });
});

describe("Realism-Audit Fix 3 — session cap", () => {
  it(`stops opening new stalls after ${STALL_SESSION_CAP} stalls in one session`, () => {
    const s = baseState({ stallsFiredCount: STALL_SESSION_CAP });
    const action = planNextAction(s);
    expect(action.kind).not.toBe("manager-consult-stall");
  });
});
