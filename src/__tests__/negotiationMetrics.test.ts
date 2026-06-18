import { describe, it, expect } from "vitest";
import {
  computeNegotiationMetrics,
  scoreNegotiationBehaviour,
  scoreNegotiationBehaviourDetailed,
  type KernelTurnSummary,
} from "../../server-handlers/_negotiation-metrics";
import type { NegotiationState, NegotiationBand } from "../../server-handlers/_negotiation-kernel";
import { effectiveTargetCtcLpa } from "../../server-handlers/_negotiation-kernel";
import { EMPTY_CANDIDATE_PROFILE } from "../../server-handlers/_candidate-profile";

const BAND: NegotiationBand = { initialOffer: 20, maxStretch: 30, walkAway: 16, hasEquity: false };

function makeState(over: Partial<NegotiationState>): NegotiationState {
  return {
    sessionId: "s1",
    role: "swe",
    company: "Acme",
    band: BAND,
    phase: "opening",
    turnIndex: 0,
    maxTurns: 8,
    candidateTarget: null,
    lastCandidateCounterLpa: null,
    firstAnchoredTarget: null,
    candidateCurrentCtc: null,
    competingOffer: null,
    candidateAskedAsRange: false,
    highestOfferMade: 0,
    leversUsed: [],
    lastAiText: "",
    lastJoiningBonusOffered: null,
    conversationLog: [],
    finalOfferAssertedCount: 0,
    vossTacticsUsed: [],
    infoAsked: [],
    verbalAcceptanceTurn: null,
    postVerbalRenegotiationCount: 0,
    counterRound: 0,
    recentRecoveryActive: false,
    walkAwayReturned: false,
    hardBandCap: false,
    marketMode: "neutral",
    recruiterPersona: "consultative",
    acceptedAtTurn: null,
    walkedAwayAtTurn: null,
    candidateComponentBreakdown: { base: null, variable: null, equity: null, hasAny: false },
    hikePercent: null,
    rationale: null,
    noticeJoining: {
      noticePeriodDays: null,
      buyoutRequested: false,
      joiningBonusAsk: null,
      earlyJoinPreferred: false,
      joiningBonusClawbackDiscussed: false,
      lastWorkingDayText: null,
      hasAny: false,
    },
    equityVesting: {
      vestingYears: null,
      cliffMonths: null,
      preference: null,
      familiarity: null,
      strikePriceDiscussed: false,
      valuationDiscussed: false,
      liquidityDiscussed: false,
      equityExists: null,
      hasAny: false,
    },
    locationMode: {
      workMode: null,
      locationCity: null,
      relocationRequested: false,
      relocationRefused: false,
      hasAny: false,
    },
    competingOfferDetail: {
      company: null,
      status: null,
      stage: null,
      letterShareOffered: false,
      onHold: false,
      proofRequestedAtTurn: null,
      proofProvided: false,
      hasAny: false,
    },
    decisionDeadline: {
      deadlineDays: null,
      deadlineExplicit: false,
      conditionalAcceptance: false,
      conditionalEvidence: null,
      hasAny: false,
    },
    candidateProfile: { ...EMPTY_CANDIDATE_PROFILE },
    miscSignals: {
      candidateFloor: null,
      salaryReviewMonths: null,
      proofOfCtcShareable: null,
      internalCounterRisk: null,
      hasAny: false,
    },
    retentionCounter: { amountLpa: null, declined: false, hasAny: false },
    candidateTotalYoe: null,
    candidateApplicableYoe: null,
    candidatePrimaryDomain: null,
    freshGradDisclosed: false,
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
      hasAny: false,
    },
    salesOTE: {
      oteAmount: null,
      baseAmount: null,
      attainmentPct: null,
      quotesOteAsGuaranteed: false,
      hasAny: false,
    },
    contractRate: {
      dayRate: null,
      monthlyRetainer: null,
      utilizationPct: null,
      dayRateAsAnnualConfusion: false,
      hasAny: false,
    },
    recruiterFactsAlreadySaid: [],
    promptInjectionAttempts: [],
    ...over,
  };
}

const move = (over: Partial<KernelTurnSummary>): KernelTurnSummary => ({
  lever: "open-with-offer",
  newTotalLpa: null,
  turnIndex: 0,
  candidateTargetAtTurn: null,
  ...over,
});

describe("computeNegotiationMetrics", () => {
  it("classifies accepted outcome", () => {
    const m = computeNegotiationMetrics({
      finalState: makeState({ phase: "accepted", highestOfferMade: 25, acceptedAtTurn: 4 }),
      moves: [move({ lever: "open-with-offer", newTotalLpa: 20 }), move({ lever: "counter-base", newTotalLpa: 25, turnIndex: 2 })],
    });
    expect(m.outcome).toBe("accepted");
    expect(m.lpaGained).toBe(5);
    expect(m.bandTraversal).toBe(0.5);
    /* Authoritative offer/ask numbers — the report adopts these instead
       of re-parsing the transcript. */
    expect(m.initialOfferLpa).toBe(20);
    expect(m.finalOfferLpa).toBe(25);
    expect(m.offerTrajectoryLpa).toEqual([20, 25]);
    /* New fields surface kernel signals to the report layer. */
    expect(m.vossTacticsUsed).toEqual([]);
    expect(m.infoAsked).toEqual([]);
    expect(m.walkAwayReturned).toBe(false);
    expect(m.hardBandCap).toBe(false);
    expect(m.marketMode).toBe("neutral");
  });

  it("captures the candidate's effective ask + offer trajectory (cash turns only)", () => {
    const m = computeNegotiationMetrics({
      finalState: makeState({ phase: "accepted", highestOfferMade: 27, candidateTarget: 30 }),
      moves: [
        move({ lever: "open-with-offer", newTotalLpa: 20 }),
        move({ lever: "benefits-summary", newTotalLpa: null, turnIndex: 1 }), // non-cash → excluded
        move({ lever: "counter-base", newTotalLpa: 24, turnIndex: 2 }),
        move({ lever: "hold-firm", newTotalLpa: 27, turnIndex: 3 }),
      ],
    });
    expect(m.candidateAskLpa).toBe(30);
    expect(m.offerTrajectoryLpa).toEqual([20, 24, 27]); // null turn dropped
    expect(m.initialOfferLpa).toBe(20);
    expect(m.finalOfferLpa).toBe(27);
  });

  it("reports a null ask when the candidate never anchored", () => {
    const m = computeNegotiationMetrics({
      finalState: makeState({ phase: "stalemate", candidateTarget: null }),
      moves: [move({ lever: "open-with-offer", newTotalLpa: 20 })],
    });
    expect(m.candidateAskLpa).toBeNull();
  });

  it("candidateAskLpa stays in lockstep with the kernel's effectiveTargetCtcLpa", () => {
    /* The metrics module inlines effectiveTargetCtcLpa (it must not take a
       runtime import on the 5000-line kernel — that breaks the client
       bundle). This parity test fails loudly if the inlined fold drifts
       from the real kernel implementation across these shapes. */
    const shapes: Partial<NegotiationState>[] = [
      { candidateTarget: 30 },
      { candidateTarget: null, candidateTargetFixed: 26 },
      { candidateTarget: null, candidateTargetFixed: null },
      { candidateTarget: 22, candidateTargetIsInHand: true, candidateTargetCtcEquivalentLpa: 28 },
    ];
    for (const shape of shapes) {
      const state = makeState({ phase: "accepted", highestOfferMade: 25, ...shape });
      const m = computeNegotiationMetrics({ finalState: state, moves: [move({ newTotalLpa: 20 })] });
      expect(m.candidateAskLpa).toBe(effectiveTargetCtcLpa(state));
    }
  });

  it("surfaces voss tactics and info intents from final state", () => {
    const m = computeNegotiationMetrics({
      finalState: makeState({
        phase: "accepted",
        highestOfferMade: 26,
        vossTacticsUsed: ["calibrated", "label"],
        infoAsked: ["clawback-period", "vest-schedule"],
        walkAwayReturned: true,
        hardBandCap: true,
        marketMode: "hot",
      }),
      moves: [move({ lever: "counter-base", newTotalLpa: 26 })],
    });
    expect(m.vossTacticsUsed).toEqual(["calibrated", "label"]);
    expect(m.infoAsked).toEqual(["clawback-period", "vest-schedule"]);
    expect(m.walkAwayReturned).toBe(true);
    expect(m.hardBandCap).toBe(true);
    expect(m.marketMode).toBe("hot");
  });

  it("detects anchor turn (first non-null candidateTarget)", () => {
    const m = computeNegotiationMetrics({
      finalState: makeState({ phase: "stalemate" }),
      moves: [
        move({ turnIndex: 0, candidateTargetAtTurn: null }),
        move({ turnIndex: 2, candidateTargetAtTurn: 28 }),
        move({ turnIndex: 4, candidateTargetAtTurn: 28 }),
      ],
    });
    expect(m.anchorTurn).toBe(2);
  });

  it("anchor null when candidate never stated target", () => {
    const m = computeNegotiationMetrics({
      finalState: makeState({ phase: "stalemate" }),
      moves: [move({ turnIndex: 0 }), move({ turnIndex: 2 })],
    });
    expect(m.anchorTurn).toBe(null);
  });

  it("lever diversity counts distinct levers only", () => {
    const m = computeNegotiationMetrics({
      finalState: makeState({}),
      moves: [
        move({ lever: "open-with-offer" }),
        move({ lever: "counter-base" }),
        move({ lever: "counter-base" }),
        move({ lever: "joining-bonus" }),
      ],
    });
    expect(m.leverDiversity).toBe(3);
  });

  it("flags overBandViolation when an offer exceeds maxStretch", () => {
    const m = computeNegotiationMetrics({
      finalState: makeState({ highestOfferMade: 32 }),
      moves: [
        move({ lever: "counter-base", newTotalLpa: 32 }), // > band.maxStretch (30)
      ],
    });
    expect(m.overBandViolation).toBe(true);
  });

  it("bandTraversal null when band is degenerate", () => {
    const degenerateBand: NegotiationBand = { initialOffer: 20, maxStretch: 20, walkAway: 16, hasEquity: false };
    const m = computeNegotiationMetrics({
      finalState: makeState({ band: degenerateBand, highestOfferMade: 20 }),
      moves: [],
    });
    expect(m.bandTraversal).toBe(null);
  });

  it("lpaPerTurn = lpaGained / cashTurns only", () => {
    const m = computeNegotiationMetrics({
      finalState: makeState({ highestOfferMade: 28 }),
      moves: [
        move({ lever: "open-with-offer", newTotalLpa: 20 }),
        move({ lever: "probe", newTotalLpa: null }),
        move({ lever: "counter-base", newTotalLpa: 24 }),
        move({ lever: "counter-base", newTotalLpa: 28 }),
      ],
    });
    // gained 8 over 3 cash turns
    expect(m.lpaPerTurn).toBe(2.67);
  });
});

describe("scoreNegotiationBehaviour", () => {
  it("strong session: early anchor + ceiling + diverse levers + acceptance → high score", () => {
    const score = scoreNegotiationBehaviour({
      outcome: "accepted",
      anchorTurn: 1,
      leverDiversity: 4,
      lpaGained: 10,
      lpaPerTurn: 2,
      bandTraversal: 1,
      overBandViolation: false,
      totalTurns: 6,
    });
    // 30 (anchor) + 30 (traversal) + 20 (diversity capped) + 20 (accepted) = 100
    expect(score).toBe(100);
  });

  it("never-anchored, never-pushed walkaway → low score", () => {
    const score = scoreNegotiationBehaviour({
      outcome: "walked-away",
      anchorTurn: null,
      leverDiversity: 1,
      lpaGained: 0,
      lpaPerTurn: 0,
      bandTraversal: 0,
      overBandViolation: false,
      totalTurns: 3,
    });
    // 0 + 0 + 5 + 10 = 15
    expect(score).toBe(15);
  });

  it("overBandViolation penalty applies", () => {
    const base = {
      outcome: "accepted" as const,
      anchorTurn: 1,
      leverDiversity: 2,
      lpaGained: 12,
      lpaPerTurn: 4,
      bandTraversal: 1,
      totalTurns: 4,
    };
    const clean = scoreNegotiationBehaviour({ ...base, overBandViolation: false });
    const dirty = scoreNegotiationBehaviour({ ...base, overBandViolation: true });
    expect(dirty).toBe(Math.max(0, clean - 25));
  });
});

describe("scoreNegotiationBehaviourDetailed — Phase 20 breakdown", () => {
  it("returns score + per-component breakdown summing to total (clean session)", () => {
    const result = scoreNegotiationBehaviourDetailed({
      outcome: "accepted",
      anchorTurn: 1,
      leverDiversity: 4,
      lpaGained: 10,
      lpaPerTurn: 2,
      bandTraversal: 1,
      overBandViolation: false,
      totalTurns: 6,
    });
    expect(result.score).toBe(100);
    /* 4 components: anchoring + traversal + diversity + outcome.
     * No penalty component when overBandViolation is false. */
    expect(result.breakdown).toHaveLength(4);
    const sum = result.breakdown.reduce((a, c) => a + c.points, 0);
    expect(sum).toBe(result.score);
    /* Every component has a non-empty explanation. */
    for (const c of result.breakdown) {
      expect(c.explanation.length).toBeGreaterThan(20);
    }
  });

  it("never-anchored breakdown explains the zero-anchor penalty", () => {
    const result = scoreNegotiationBehaviourDetailed({
      outcome: "walked-away",
      anchorTurn: null,
      leverDiversity: 1,
      lpaGained: 0,
      lpaPerTurn: 0,
      bandTraversal: 0,
      overBandViolation: false,
      totalTurns: 3,
    });
    const anchor = result.breakdown.find((c) => c.key === "anchoring");
    expect(anchor).toBeDefined();
    expect(anchor!.points).toBe(0);
    expect(anchor!.explanation).toMatch(/never anchored/i);
  });

  it("over-band violation appears as a negative component", () => {
    const result = scoreNegotiationBehaviourDetailed({
      outcome: "accepted",
      anchorTurn: 1,
      leverDiversity: 2,
      lpaGained: 12,
      lpaPerTurn: 4,
      bandTraversal: 1,
      overBandViolation: true,
      totalTurns: 4,
    });
    const penalty = result.breakdown.find((c) => c.key === "over-band-penalty");
    expect(penalty).toBeDefined();
    expect(penalty!.points).toBe(-25);
    expect(penalty!.max).toBe(0);
  });

  it("legacy scoreNegotiationBehaviour returns the same number as detailed.score", () => {
    const input = {
      outcome: "stalemate" as const,
      anchorTurn: 4,
      leverDiversity: 2,
      lpaGained: 3,
      lpaPerTurn: 1,
      bandTraversal: 0.3,
      overBandViolation: false,
      totalTurns: 5,
    };
    expect(scoreNegotiationBehaviour(input)).toBe(scoreNegotiationBehaviourDetailed(input).score);
  });
});
