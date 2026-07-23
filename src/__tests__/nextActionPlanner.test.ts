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
  it("opening turn 0 → discovery-probe (F1)", () => {
    // FIX (F1, PDF#19 2026-05-15) — turn 0 used to anchor immediately
    // via open-with-offer. Real recruiters open with a discovery
    // question; F1 removes the `turnIndex >= 1` gate so turn 0 plans
    // ordered-discovery. open-with-offer is now reachable only after
    // discovery completes.
    const s = init();
    const action = planNextAction(s);
    expect(action.kind).toBe("discovery-probe");
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

  it("phase=range-disclosure → band-disclosure-deflect", () => {
    /* Phase 2 Indian-HR redesign (2026-05-17): the phase name is retained
     * as a state-machine marker, but the lever rendered at this phase is
     * `band-disclosure-deflect` — real Indian HR does not leak the band. */
    const s = init({ phase: "range-disclosure", turnIndex: 2 });
    const action = planNextAction(s);
    expect(action.kind).toBe("band-disclosure-deflect");
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

describe("S45-B1/B3 — plural 'lakhs' unit detection in candidateHasNewNumber", () => {
  /* Root cause: the offer-breakdown gate's candidateHasNewNumber regex
   * used `lakh\b` which failed on plural "lakhs" (word boundary fires
   * between 'h' and 's'). Fix: `lakhs?` in the unit alternation.
   *
   * When the candidate says "52 lakhs" and there is an open counter-offer
   * to pursue, the planner MUST return counter-offer, not offer-breakdown.
   * Before the fix, candidateHasNewNumber was false for plural form, so the
   * offer-breakdown branch fired and the offer never moved. */
  const BAND_S45: NegotiationBand = {
    initialOffer: 45.1,
    maxStretch: 60.2,
    walkAway: 35,
    hasEquity: true,
  };
  const base = (overrides: Partial<NegotiationState> = {}): NegotiationState => ({
    ...initState({ sessionId: "s45", role: "swe", company: "Razorpay", band: BAND_S45 }),
    phase: "counter-offer" as const,
    highestOfferMade: 45.1,
    candidateTarget: 52,
    lastCandidateCounterLpa: 52,
    candidateCurrentCtc: 28,
    turnIndex: 5,
    ...overrides,
  });

  it('"52 lakhs in total cash" → counter-offer, not offer-breakdown', () => {
    const s = base({
      conversationLog: [
        { speaker: "ai", text: "The fitment we can offer is ₹45.1 LPA." },
        {
          speaker: "candidate",
          text: "I was looking at something closer to 52 lakhs in total cash — base and bonus. Can we work toward that number?",
        },
      ],
    });
    const action = planNextAction(s);
    expect(action.kind).toBe("counter-offer");
  });

  it('"48 lakhs" counter → counter-offer, not offer-breakdown', () => {
    const s = base({
      candidateTarget: 48,
      lastCandidateCounterLpa: 48,
      conversationLog: [
        { speaker: "ai", text: "The fitment we can offer is ₹45.1 LPA." },
        {
          speaker: "candidate",
          text: "Would you be able to go to 48 lakhs? That's a number I could sign on quickly.",
        },
      ],
    });
    const action = planNextAction(s);
    expect(action.kind).toBe("counter-offer");
  });

  it("offer-breakdown does NOT repeat when lastAiText contains 'fully fixed'", () => {
    /* alreadyDisclosed must detect "fully fixed" so a second candidate
     * counter after a structural clarification routes to counter-offer. */
    const s = base({
      lastAiText: "The ₹45.1L is fully fixed cash, guaranteed and contractual, with no variable component on this grade.",
      conversationLog: [
        { speaker: "ai", text: "The fitment we can offer is ₹45.1 LPA." },
        {
          speaker: "candidate",
          text: "I was looking at something closer to 52 lakhs. Can we work toward that number?",
        },
        {
          speaker: "ai",
          text: "The ₹45.1L is fully fixed cash, guaranteed and contractual, with no variable component on this grade.",
        },
        {
          speaker: "candidate",
          text: "I understand — but can you go to 48 lakhs? That's my ask.",
        },
      ],
    });
    const action = planNextAction(s);
    /* alreadyDisclosed=true blocks re-fire; candidateHasNewNumber=true
     * (48 lakhs now matched) routes to counter-offer. */
    expect(action.kind).toBe("counter-offer");
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

describe("planNextAction — frustration recovery (PDF#29 Bug 7 / PDF#30)", () => {
  /* These tests cover the highest-priority calming/empathic branch:
   * acknowledge-and-recover. It fires either explicitly when the
   * candidate signals frustration (lastUserFrustrated=true) or
   * implicitly via the stalled-discovery cap (4 consecutive probes
   * with no salary disclosure). */
  it("lastUserFrustrated=true → acknowledge-and-recover (calming response)", () => {
    const s = init({
      phase: "counter-offer",
      turnIndex: 4,
      highestOfferMade: 22,
      lastUserFrustrated: true,
    });
    const action = planNextAction(s);
    expect(action.kind).toBe("acknowledge-and-recover");
  });

  it("frustration recovery beats counter-offer math even mid-negotiation", () => {
    const s = init({
      phase: "counter-offer",
      turnIndex: 5,
      highestOfferMade: 22,
      candidateTarget: 26,
      candidateCurrentCtc: 18,
      lastUserFrustrated: true,
    });
    const action = planNextAction(s);
    expect(action.kind).toBe("acknowledge-and-recover");
  });

  it("frustration recovery fires from opening phase too (no phase gate)", () => {
    const s = init({
      phase: "opening",
      turnIndex: 2,
      lastUserFrustrated: true,
    });
    const action = planNextAction(s);
    expect(action.kind).toBe("acknowledge-and-recover");
  });

  it("4 consecutive probes + no salary disclosure → stalled-discovery acknowledge-and-recover (implicit frustration)", () => {
    const s = init({
      phase: "opening",
      turnIndex: 5,
      leversUsed: ["probe", "probe", "probe", "probe"],
      /* no candidateCurrentCtc / candidateTarget set → no disclosure */
    });
    const action = planNextAction(s);
    expect(action.kind).toBe("acknowledge-and-recover");
  });

  it("3 probes (below cap) → does NOT fire stalled-discovery recovery", () => {
    const s = init({
      phase: "opening",
      turnIndex: 4,
      leversUsed: ["probe", "probe", "probe"],
    });
    const action = planNextAction(s);
    expect(action.kind).not.toBe("acknowledge-and-recover");
  });

  it("4 consecutive probes but candidate disclosed CTC → no stalled-discovery cap (progress)", () => {
    const s = init({
      phase: "opening",
      turnIndex: 5,
      leversUsed: ["probe", "probe", "probe", "probe"],
      candidateCurrentCtc: 18,
    });
    const action = planNextAction(s);
    expect(action.kind).not.toBe("acknowledge-and-recover");
  });
});

describe("planNextAction — stall-turn loop escalation (manager-consult-stall)", () => {
  /* Real Indian recruiters' #1 leverage tactic is the multi-turn stall.
   * The planner must (a) open a stall when the candidate over-asks,
   * (b) ship a deterministic return turn while one is in flight,
   * (c) cap stalls at STALL_SESSION_CAP=3 so it doesn't loop forever. */
  it("PSU persona + over-band ask → opens manager-consult-stall", () => {
    const s = init({
      phase: "counter-offer",
      turnIndex: 3,
      counterRound: 1,
      highestOfferMade: 24,
      lastCandidateCounterLpa: 32, // > band.maxStretch (28)
      recruiterSectorPersona: "psu",
    });
    const action = planNextAction(s);
    expect(action.kind).toBe("manager-consult-stall");
    if (action.kind === "manager-consult-stall") {
      expect(action.mode).toBe("open");
      expect(action.stalledAskLpa).toBe(32);
    }
  });

  it("stall already in flight → planner ships return-turn (loop-break)", () => {
    const s = init({
      phase: "counter-offer",
      turnIndex: 4,
      counterRound: 1,
      highestOfferMade: 24,
      lastCandidateCounterLpa: 32,
      recruiterSectorPersona: "psu",
      stallTurnsRemaining: 1,
      stallsFiredCount: 1,
      lastStallContext: { stalledAskLpa: 32, openedAtTurn: 3 },
    });
    const action = planNextAction(s);
    expect(action.kind).toBe("manager-consult-stall");
    if (action.kind === "manager-consult-stall") {
      expect(action.mode === "return-move" || action.mode === "return-hold").toBe(true);
      expect(action.stalledAskLpa).toBe(32);
    }
  });

  it("session-cap reached (stallsFiredCount=3) → planner escalates past stall, does not loop", () => {
    const s = init({
      phase: "counter-offer",
      turnIndex: 6,
      counterRound: 2,
      highestOfferMade: 24,
      lastCandidateCounterLpa: 32,
      recruiterSectorPersona: "psu",
      stallsFiredCount: 3, // at cap
    });
    const action = planNextAction(s);
    expect(action.kind).not.toBe("manager-consult-stall");
  });

  it("candidate ask within band (no over-ask) → no stall opened even on high-stall persona", () => {
    const s = init({
      phase: "counter-offer",
      turnIndex: 3,
      counterRound: 1,
      highestOfferMade: 24,
      lastCandidateCounterLpa: 26, // within band.maxStretch (28)
      recruiterSectorPersona: "psu",
    });
    const action = planNextAction(s);
    expect(action.kind).not.toBe("manager-consult-stall");
  });

  it("stall cannot fire on first AI turn (turnIndex=0) even if persona is high-stall", () => {
    const s = init({
      phase: "counter-offer",
      turnIndex: 0,
      lastCandidateCounterLpa: 32,
      recruiterSectorPersona: "psu",
    });
    const action = planNextAction(s);
    expect(action.kind).not.toBe("manager-consult-stall");
  });
});

describe("planNextAction — discovery topic skip / exhaustion", () => {
  /* When discovery items are explicitly refused or exhausted, the
   * planner must advance past them rather than re-grinding. The cascade
   * routes through buildSkipRecord (refused-items + recently-asked) and
   * isDiscoveryComplete (role-family-aware satisfaction). */
  it("when discovery is fully satisfied → planner exits discovery cascade (no discovery-probe)", () => {
    const s = init({
      phase: "opening",
      turnIndex: 3,
      discoveryStage: "discovery",
      discoveryChecklist: {
        currentCtcAsked: true,
        currentCtcAnswered: true,
        fixedVariableSplitAsked: true,
        fixedVariableSplitAnswered: true,
        noticePeriodAsked: true,
        noticePeriodAnswered: true,
        competingOffersAsked: true,
        competingOffersAnswered: true,
        valueProofAsked: true,
        valueProofAnswered: true,
        targetAsked: true,
        targetAnswered: true,
        variableComfortTested: true,
        commitmentValidationAsked: true,
        currentCtcFixedVariableSplitDisclosed: true,
        expectedCtcFixedVariableSplitDisclosed: true,
      },
      candidateCurrentCtc: 18,
      candidateTarget: 26,
    });
    const action = planNextAction(s);
    expect(action.kind).not.toBe("discovery-probe");
  });

  it("explicit discoveryRefusedItems are skipped — planner advances to next topic", () => {
    /* Mark currentCtcAsked as refused; the cascade must pick another
     * un-satisfied topic instead of re-asking currentCtc. */
    const s = init({
      phase: "opening",
      turnIndex: 2,
      discoveryStage: "discovery",
      discoveryRefusedItems: { currentCtcAsked: true },
    });
    const action = planNextAction(s);
    if (action.kind === "discovery-probe") {
      expect(action.item).not.toBe("currentCtcAsked");
    }
  });

  it("repetition-complaint forces skip of the last-asked topic", () => {
    const s = init({
      phase: "opening",
      turnIndex: 3,
      discoveryStage: "discovery",
      askedTopics: [{ topic: "currentCtcAsked", atTurn: 2 }],
      repetitionComplaintAtTurn: 2,
    });
    const action = planNextAction(s);
    if (action.kind === "discovery-probe") {
      expect(action.item).not.toBe("currentCtcAsked");
    }
  });

  it("post-recovery (last lever was acknowledge-and-recover) force-advances past last-asked topic", () => {
    const s = init({
      phase: "opening",
      turnIndex: 4,
      discoveryStage: "discovery",
      askedTopics: [{ topic: "currentCtcAsked", atTurn: 3 }],
      leversUsed: ["probe", "probe", "probe", "acknowledge-and-recover"],
    });
    const action = planNextAction(s);
    if (action.kind === "discovery-probe") {
      expect(action.item).not.toBe("currentCtcAsked");
    }
  });

  it("probe-expectations with discovery complete + no offer → band-anchor-with-rationale bridge", () => {
    /* Bridge fix (Audit Pass 2 Fix B): once discovery is complete and
     * no anchor on the table, planner anchors the band instead of
     * looping on probes. */
    const s = init({
      phase: "probe-expectations",
      turnIndex: 3,
      highestOfferMade: 0,
      discoveryStage: "discovery",
      discoveryChecklist: {
        currentCtcAsked: true,
        currentCtcAnswered: true,
        fixedVariableSplitAsked: true,
        fixedVariableSplitAnswered: true,
        noticePeriodAsked: true,
        noticePeriodAnswered: true,
        competingOffersAsked: true,
        competingOffersAnswered: true,
        valueProofAsked: true,
        valueProofAnswered: true,
        targetAsked: true,
        targetAnswered: true,
        variableComfortTested: true,
        commitmentValidationAsked: true,
        currentCtcFixedVariableSplitDisclosed: true,
        expectedCtcFixedVariableSplitDisclosed: true,
      },
      candidateCurrentCtc: 18,
      candidateTarget: 24,
    });
    const action = planNextAction(s);
    expect(action.kind).toBe("band-anchor-with-rationale");
  });
});

describe("planNextAction — anchor-ask discloses a number (Crack 9, 2026-06-17)", () => {
  /* Regression: a candidate explicitly asking for the offer must get a
   * NUMBER, not a no-number probe. The legacy preemption returned
   * `open-with-offer` (numberPolicy:"forbidden"), so the figure was
   * gagged and the recruiter dodged forever. The preemption now emits
   * `anchor-with-offer` (numberPolicy:"required"), which carries the
   * band initial through the response pipeline. */
  const anchorAsk = (text: string, overrides: Partial<NegotiationState> = {}) =>
    init({
      phase: "opening",
      turnIndex: 1,
      highestOfferMade: 0,
      conversationLog: [
        { speaker: "ai", text: "what's your current CTC?" },
        { speaker: "candidate", text },
      ],
      ...overrides,
    });

  it("'what can you put on the table?' → anchor-with-offer carrying band initial", () => {
    const action = planNextAction(anchorAsk("What can you put on the table?"));
    expect(action.kind).toBe("anchor-with-offer");
    if (action.kind === "anchor-with-offer") {
      // Candidate hasn't disclosed CTC → discloses the band initial as-is.
      expect(action.initialOffer).toBe(BAND.initialOffer);
      expect(action.bandIncomplete).toBe(false);
    }
  });

  it("'what are you offering for this role?' → anchor-with-offer", () => {
    const action = planNextAction(anchorAsk("So what are you offering for this role?"));
    expect(action.kind).toBe("anchor-with-offer");
  });

  it("anchor floors above a disclosed current CTC rather than under-cutting it", () => {
    // Disclosed current 18 with a 25%+ senior hike floor pushes the anchor
    // above the band initial (20) but stays within maxStretch (28).
    const action = planNextAction(
      anchorAsk("I need a concrete number, please.", { candidateCurrentCtc: 18 }),
    );
    expect(action.kind).toBe("anchor-with-offer");
    if (action.kind === "anchor-with-offer") {
      expect(action.initialOffer).toBeGreaterThanOrEqual(BAND.initialOffer);
      expect(action.initialOffer).toBeLessThanOrEqual(BAND.maxStretch);
    }
  });

  it("a passing reference ('thanks for the offer') does NOT trigger disclosure", () => {
    const action = planNextAction(anchorAsk("Thanks for the offer."));
    expect(action.kind).not.toBe("anchor-with-offer");
  });
});
