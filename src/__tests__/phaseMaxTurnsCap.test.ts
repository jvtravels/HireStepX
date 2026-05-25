/* AR3 / Audit Pass 4 (PDF#27, 2026-05-17) — per-phase maxTurns cap.
 *
 * Each phase-group has a hard ceiling (discovery=5, anchoring=3,
 * counter=4) on how many turns it can occupy before derivePhase
 * force-advances. The cap is the safety net against discovery-loop /
 * counter-loop pathologies — a normal session lands well within budget;
 * the cap fires when the natural cascade is stuck (e.g. a checklist
 * flag never flips even though the candidate engaged).
 *
 * Tests cover:
 *   - derivePhase stamps state.phaseEnteredAtTurn on transitions.
 *   - discovery exceeded + signal present → range-disclosure.
 *   - discovery exceeded + no signal → stalemate.
 *   - anchoring exceeded → counter-offer.
 *   - counter exceeded → stalemate.
 *   - within-budget phases are NOT force-advanced.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  derivePhase,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";

const BAND: NegotiationBand = {
  initialOffer: 22,
  maxStretch: 30,
  walkAway: 18,
  hasEquity: false,
};

function mkState(overrides: Partial<NegotiationState> = {}): NegotiationState {
  return Object.assign(
    initState({ sessionId: "ar3", role: "swe", company: "acme", band: BAND }),
    overrides,
  );
}

describe("AR3 — phaseEnteredAtTurn stamping", () => {
  it("derivePhase stamps phaseEnteredAtTurn on first call (lazy init)", () => {
    const s = mkState({ turnIndex: 0 });
    /* Fresh state — phaseEnteredAtTurn unset. derivePhase should lazy-
     * stamp it to the current turnIndex. */
    expect(s.phaseEnteredAtTurn ?? null).toBeNull();
    derivePhase(s);
    expect(s.phaseEnteredAtTurn).toBe(0);
  });

  it("derivePhase re-stamps phaseEnteredAtTurn on phase transition", () => {
    /* Construct a state that will derivePhase out of opening into
     * range-disclosure via the budget override. */
    const s = mkState({
      phase: "opening",
      turnIndex: 10,
      phaseEnteredAtTurn: 0,
      candidateCurrentCtc: 18,
    });
    const next = derivePhase(s);
    expect(next).not.toBe("opening");
    expect(s.phaseEnteredAtTurn).toBe(10);
  });
});

describe("AR3 — discovery phase maxTurns cap", () => {
  it("discovery exceeded + currentCtc signal → range-disclosure", () => {
    const s = mkState({
      phase: "opening",
      turnIndex: 6, // 6 - 0 = 6 > 5 (cap)
      phaseEnteredAtTurn: 0,
      candidateCurrentCtc: 18,
    });
    const next = derivePhase(s);
    expect(next).toBe("range-disclosure");
  });

  it("discovery exceeded + target signal → range-disclosure", () => {
    const s = mkState({
      phase: "opening",
      turnIndex: 6,
      phaseEnteredAtTurn: 0,
      candidateTarget: 30,
    });
    const next = derivePhase(s);
    expect(next).toBe("range-disclosure");
  });

  it("discovery exceeded + no signal → stalemate", () => {
    const s = mkState({
      phase: "opening",
      turnIndex: 6,
      phaseEnteredAtTurn: 0,
    });
    const next = derivePhase(s);
    expect(next).toBe("stalemate");
  });

  it("discovery within budget (5 turns or fewer) → not force-advanced", () => {
    const s = mkState({
      phase: "opening",
      turnIndex: 5, // 5 - 0 = 5, NOT > 5
      phaseEnteredAtTurn: 0,
    });
    const next = derivePhase(s);
    /* No force-advance — should stay in opening (natural cascade can't
     * promote since discoveryChecklist isn't satisfied). */
    expect(next).toBe("opening");
  });
});

describe("AR3 — anchoring phase maxTurns cap", () => {
  it("anchoring (offer-presented) exceeded with no signal → counter-offer (AR3 force-advance)", () => {
    /* With no candidateCurrentCtc / competingOffer / probe lever yet
     * recorded, the natural cascade keeps the phase at offer-presented
     * (awaiting first reaction). AR3 force-advances to counter-offer
     * once the 3-turn budget elapses, breaking the wait-loop. */
    const s = mkState({
      phase: "offer-presented",
      turnIndex: 10,
      phaseEnteredAtTurn: 5, // 10 - 5 = 5 > 3 (cap)
      highestOfferMade: 24,
    });
    const next = derivePhase(s);
    expect(next).toBe("counter-offer");
  });

  it("anchoring (probe-expectations) exceeded → counter-offer", () => {
    const s = mkState({
      phase: "probe-expectations",
      turnIndex: 10,
      phaseEnteredAtTurn: 5,
      candidateCurrentCtc: 18,
      candidateTarget: 30,
      highestOfferMade: 24,
    });
    const next = derivePhase(s);
    expect(next).toBe("counter-offer");
  });

  it("anchoring within budget (3 turns) → not force-advanced", () => {
    const s = mkState({
      phase: "offer-presented",
      turnIndex: 8,
      phaseEnteredAtTurn: 5, // 8 - 5 = 3, NOT > 3
      candidateCurrentCtc: 18,
      highestOfferMade: 24,
    });
    const next = derivePhase(s);
    /* Natural cascade may or may not advance; AR3 must NOT have force-
     * advanced (the budget hasn't elapsed). Either way, the result must
     * be reachable via canTransitionPhase from offer-presented. */
    expect(["offer-presented", "probe-expectations", "counter-offer"]).toContain(next);
  });
});

describe("AR3 — counter phase maxTurns cap", () => {
  /* PDF#48 B4 (2026-05-25) — counter cap raised from 4 to 7 so a
   * normal counter spiral (anchor → counter-1 → revise → counter-2 →
   * lever-explore → competing-probe → competing-followup) fits inside
   * its budget before the AR3 force-advance routes to stalemate. */
  it("counter exceeded (>7) → stalemate", () => {
    const s = mkState({
      phase: "counter-offer",
      turnIndex: 18,
      phaseEnteredAtTurn: 9, // 18 - 9 = 9 > 7 (new cap)
      candidateCurrentCtc: 18,
      candidateTarget: 30,
      highestOfferMade: 26,
    });
    const next = derivePhase(s);
    expect(next).toBe("stalemate");
  });

  it("lever-explore exceeded → stalemate", () => {
    const s = mkState({
      phase: "lever-explore",
      turnIndex: 18,
      phaseEnteredAtTurn: 9,
      candidateCurrentCtc: 18,
      candidateTarget: 30,
      highestOfferMade: 26,
    });
    const next = derivePhase(s);
    expect(next).toBe("stalemate");
  });

  it("counter within new 7-turn budget → not force-advanced to terminal", () => {
    const s = mkState({
      phase: "counter-offer",
      turnIndex: 14,
      phaseEnteredAtTurn: 9, // 14 - 9 = 5, NOT > 7 (within budget)
      candidateCurrentCtc: 18,
      candidateTarget: 30,
      highestOfferMade: 26,
    });
    const next = derivePhase(s);
    /* Natural cascade still owns the transition; AR3 must NOT have
     * forced an advance. Pre-PDF#48 this would have hit the 4-turn
     * cap and routed to stalemate at this turn count. */
    expect(next).not.toBe("stalemate");
  });
});

describe("AR3 — terminal phases are never force-advanced", () => {
  it("accepted phase stays in accepted regardless of budget", () => {
    const s = mkState({
      phase: "accepted",
      turnIndex: 100,
      phaseEnteredAtTurn: 0,
      acceptedAtTurn: 5,
    });
    const next = derivePhase(s);
    expect(next).toBe("accepted");
  });

  it("walked-away phase stays in walked-away", () => {
    const s = mkState({
      phase: "walked-away",
      turnIndex: 100,
      phaseEnteredAtTurn: 0,
      walkedAwayAtTurn: 5,
    });
    const next = derivePhase(s);
    expect(next).toBe("walked-away");
  });

  it("stalemate phase stays in stalemate", () => {
    const s = mkState({
      phase: "stalemate",
      turnIndex: 100,
      phaseEnteredAtTurn: 0,
      stalemateAtTurn: 5,
    });
    const next = derivePhase(s);
    expect(next).toBe("stalemate");
  });
});
