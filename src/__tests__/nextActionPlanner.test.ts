/* NextAction planner tests — negotiation-flow redesign commit 3 (2026-05-15).
 *
 * Verifies the planner is the single source of truth for "what should the
 * bot do next?". Coverage:
 *   - each NextAction kind reachable from at least one state fixture
 *   - priority order (earlier kinds shadow later ones)
 *   - actionToLever round-trip: planNextAction → actionToLever produces
 *     the SAME AiMove as pickAiMove(state) — bit-identical behavior.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  pickAiMove,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import {
  planNextAction,
  actionToLever,
} from "../../server-handlers/_next-action-planner";

const BAND: NegotiationBand = { initialOffer: 20, maxStretch: 28, walkAway: 16, hasEquity: true };
const init = (overrides: Partial<NegotiationState> = {}): NegotiationState => ({
  ...initState({ sessionId: "s1", role: "swe", company: "acme", band: BAND }),
  ...overrides,
});

describe("planNextAction — kind reachability", () => {
  it("opening turn 0 → open-with-offer", () => {
    const s = init();
    const action = planNextAction(s);
    expect(action.kind).toBe("open-with-offer");
  });

  it("phase=accepted → close{accept}", () => {
    const s = init({ phase: "accepted", highestOfferMade: 22, acceptedAtTurn: 5, turnIndex: 5 });
    const action = planNextAction(s);
    expect(action.kind).toBe("close");
    if (action.kind === "close") expect(action.mode).toBe("accept");
  });

  it("phase=walked-away → close{walkaway}", () => {
    const s = init({ phase: "walked-away", walkedAwayAtTurn: 3, turnIndex: 3 });
    const action = planNextAction(s);
    expect(action.kind).toBe("close");
    if (action.kind === "close") expect(action.mode).toBe("walkaway");
  });

  it("phase=stalemate → close{stalemate}", () => {
    const s = init({ phase: "stalemate", turnIndex: 10 });
    const action = planNextAction(s);
    expect(action.kind).toBe("close");
    if (action.kind === "close") expect(action.mode).toBe("stalemate");
  });

  it("terminal-restate fires when accepted on an earlier turn", () => {
    const s = init({
      phase: "accepted",
      highestOfferMade: 22,
      acceptedAtTurn: 4,
      turnIndex: 6, // strictly greater → restate path
    });
    const action = planNextAction(s);
    expect(action.kind).toBe("terminal-restate");
  });

  it("candidate counter <= offer → auto-accept", () => {
    const s = init({
      phase: "counter-offer",
      highestOfferMade: 24,
      lastCandidateCounterLpa: 23,
      turnIndex: 3,
    });
    const action = planNextAction(s);
    expect(action.kind).toBe("auto-accept");
  });

  it("discoveryStage=probe-mismatch → probe-mismatch", () => {
    const s = init({
      phase: "opening",
      discoveryStage: "probe-mismatch",
      turnIndex: 1,
    });
    const action = planNextAction(s);
    expect(action.kind).toBe("probe-mismatch");
  });

  it("phase=range-disclosure → range-disclosure", () => {
    const s = init({ phase: "range-disclosure", turnIndex: 2 });
    const action = planNextAction(s);
    expect(action.kind).toBe("range-disclosure");
  });

  it("info-disclosure intents map to topic-tagged actions", () => {
    const s = init({
      phase: "counter-offer",
      highestOfferMade: 22,
      turnIndex: 3,
      infoAsked: ["benefits-overview"],
    });
    const action = planNextAction(s);
    expect(action.kind).toBe("info-disclosure");
    if (action.kind === "info-disclosure") expect(action.topic).toBe("benefits");
  });

  it("counter-offer phase with target above initial → counter-offer kind", () => {
    const s = init({
      phase: "counter-offer",
      highestOfferMade: 20,
      candidateTarget: 26,
      turnIndex: 4,
      /* satisfy probe-justification skip: provide current ctc context */
      candidateCurrentCtc: 18,
    });
    const action = planNextAction(s);
    expect(action.kind).toBe("counter-offer");
  });

  it("counter-offer with first big target + no context → probe-justification", () => {
    const s = init({
      phase: "counter-offer",
      candidateTarget: 26, // > 20 * 1.05 = 21
      turnIndex: 3,
    });
    const action = planNextAction(s);
    expect(action.kind).toBe("probe-justification");
  });

  it("lever-explore fallback fires from closing-push", () => {
    const s = init({ phase: "closing-push", highestOfferMade: 24, turnIndex: 8 });
    const action = planNextAction(s);
    expect(action.kind).toBe("lever-explore");
  });
});

describe("planNextAction — priority ordering", () => {
  it("terminal-restate beats close — terminal phase that already transitioned", () => {
    const s = init({
      phase: "accepted",
      acceptedAtTurn: 3,
      turnIndex: 5, // strict > → restate path takes precedence
      highestOfferMade: 22,
    });
    const action = planNextAction(s);
    expect(action.kind).toBe("terminal-restate");
  });

  it("auto-accept beats probe-mismatch when counter <= offer", () => {
    const s = init({
      phase: "counter-offer",
      highestOfferMade: 24,
      lastCandidateCounterLpa: 22,
      discoveryStage: "probe-mismatch",
      turnIndex: 3,
    });
    const action = planNextAction(s);
    expect(action.kind).toBe("auto-accept");
  });

  it("info-disclosure (breakdown) beats counter-offer in counter-offer phase", () => {
    const s = init({
      phase: "counter-offer",
      highestOfferMade: 22,
      candidateTarget: 26,
      candidateCurrentCtc: 18,
      turnIndex: 4,
      infoAsked: ["package-breakdown"],
    });
    const action = planNextAction(s);
    expect(action.kind).toBe("info-disclosure");
  });
});

describe("actionToLever — bit-identical round-trip vs pickAiMove", () => {
  /* For each fixture: pickAiMove(state) produces the AiMove that
   * applyAiMove will apply. The planner-then-lever path MUST produce
   * the same AiMove. This is the bit-identical contract: commit 3
   * restructures dispatch only, not behavior. */
  const fixtures: Array<{ name: string; state: NegotiationState }> = [
    { name: "opening turn 0", state: init() },
    {
      name: "accepted close",
      state: init({ phase: "accepted", highestOfferMade: 22, acceptedAtTurn: 5, turnIndex: 5 }),
    },
    {
      name: "walked-away",
      state: init({ phase: "walked-away", walkedAwayAtTurn: 3, turnIndex: 3 }),
    },
    {
      name: "stalemate",
      state: init({ phase: "stalemate", turnIndex: 10 }),
    },
    {
      name: "auto-accept",
      state: init({
        phase: "counter-offer",
        highestOfferMade: 24,
        lastCandidateCounterLpa: 23,
        turnIndex: 3,
      }),
    },
    {
      name: "probe-mismatch",
      state: init({
        phase: "opening",
        discoveryStage: "probe-mismatch",
        turnIndex: 1,
      }),
    },
    {
      name: "range-disclosure phase",
      state: init({ phase: "range-disclosure", turnIndex: 2 }),
    },
    {
      name: "counter-offer math",
      state: init({
        phase: "counter-offer",
        highestOfferMade: 20,
        candidateTarget: 26,
        candidateCurrentCtc: 18,
        turnIndex: 4,
      }),
    },
    {
      name: "lever-explore closing-push",
      state: init({ phase: "closing-push", highestOfferMade: 24, turnIndex: 8 }),
    },
    {
      name: "info-disclosure benefits",
      state: init({
        phase: "counter-offer",
        highestOfferMade: 22,
        turnIndex: 3,
        infoAsked: ["benefits-overview"],
      }),
    },
  ];

  for (const f of fixtures) {
    it(`bit-identical for: ${f.name}`, () => {
      /* Clear plannedNextAction so pickAiMove re-runs the planner;
       * we want to verify the through-the-planner pipeline. */
      const s: NegotiationState = { ...f.state, plannedNextAction: null };
      const action = planNextAction(s);
      const movePlanner = actionToLever(action, s);
      const movePicker = pickAiMove({ ...s, plannedNextAction: null });
      expect(movePlanner.lever).toBe(movePicker.lever);
      expect(movePlanner.newTotalLpa).toBe(movePicker.newTotalLpa);
      expect(movePlanner.rationale).toBe(movePicker.rationale);
      expect(movePlanner.joiningBonusAmount).toBe(movePicker.joiningBonusAmount);
      expect(movePlanner.marketModeHint).toBe(movePicker.marketModeHint);
    });
  }
});
