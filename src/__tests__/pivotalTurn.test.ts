import { describe, it, expect } from "vitest";
import {
  analyzePivotalTurn,
  type PivotalTurn,
} from "../../server-handlers/_pivotal-turn";
import type { KernelTurnSummary } from "../../server-handlers/_negotiation-metrics";
import type {
  NegotiationState,
  NegotiationBand,
} from "../../server-handlers/_negotiation-kernel";
import type { CandidateStanceResult } from "../../server-handlers/_candidate-stance";

const BAND: NegotiationBand = { initialOffer: 20, maxStretch: 30, walkAway: 16, hasEquity: false };

function makeState(over: Partial<NegotiationState> = {}): NegotiationState {
  /* Minimal — analyzePivotalTurn touches only band + candidateStance + moves. */
  return {
    sessionId: "s1",
    role: "swe",
    company: "Acme",
    band: BAND,
    phase: "opening",
    turnIndex: 0,
    maxTurns: 8,
    candidateTarget: null,
    firstAnchoredTarget: null,
    candidateCurrentCtc: null,
    competingOffer: null,
    candidateAskedAsRange: false,
    highestOfferMade: 0,
    leversUsed: [],
    lastAiText: "",
    conversationLog: [],
    finalOfferAssertedCount: 0,
    vossTacticsUsed: [],
    infoAsked: [],
    verbalAcceptanceTurn: null,
    postVerbalRenegotiationCount: 0,
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
      noticePeriodDays: null, buyoutRequested: false, joiningBonusAsk: null,
      earlyJoinPreferred: false, joiningBonusClawbackDiscussed: false,
      lastWorkingDayText: null, hasAny: false,
    },
    equityVesting: {
      vestingYears: null, cliffMonths: null, preference: null, familiarity: null,
      strikePriceDiscussed: false, valuationDiscussed: false, liquidityDiscussed: false, hasAny: false,
    },
    locationMode: {
      workMode: null, locationCity: null, relocationRequested: false,
      relocationRefused: false, hasAny: false,
    },
    competingOfferDetail: {
      company: null, status: null, stage: null, letterShareOffered: false, onHold: false, hasAny: false,
    },
    decisionDeadline: {
      deadlineDays: null, deadlineExplicit: false, conditionalAcceptance: false,
      conditionalEvidence: null, hasAny: false,
    },
    candidateProfile: {
      careerGapMonths: null, careerGapActivity: null, tenureSignal: null,
      levelMismatch: null, domainPivot: false, transferableSkillsClaimed: false,
      compensationHistoryIssue: null, serviceBondAccepted: false, probationCompMentioned: false, hasAny: false,
    },
    miscSignals: {
      candidateFloor: null, salaryReviewMonths: null, proofOfCtcShareable: null,
      internalCounterRisk: null, hasAny: false,
    },
    retentionCounter: { amountLpa: null, declined: false, hasAny: false },
    candidateStance: emptyStance(),
    salesOTE: {
      oteAmount: null, baseAmount: null, attainmentPct: null,
      quotesOteAsGuaranteed: false, hasAny: false,
    },
    contractRate: {
      dayRate: null, monthlyRetainer: null, utilizationPct: null,
      dayRateAsAnnualConfusion: false, hasAny: false,
    },
    ...over,
  };
}

function emptyStance(): CandidateStanceResult {
  return {
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
  };
}

const m = (over: Partial<KernelTurnSummary>): KernelTurnSummary => ({
  lever: "open-with-offer",
  newTotalLpa: null,
  turnIndex: 0,
  candidateTargetAtTurn: null,
  ...over,
});

describe("analyzePivotalTurn — no-anchor", () => {
  it("returns no-anchor reason when candidate never anchored", () => {
    const out: PivotalTurn = analyzePivotalTurn({
      finalState: makeState(),
      moves: [m({ lever: "open-with-offer", newTotalLpa: 22, turnIndex: 0 })],
    });
    expect(out.reason).toBe("no-anchor");
    expect(out.turnIndex).toBe(null);
    expect(out.detail).toMatch(/anchor/i);
  });
});

describe("analyzePivotalTurn — stance breach dominates", () => {
  it("returns stance-breach when desperate stance present in final state", () => {
    const stance = { ...emptyStance(), soundsDesperate: true, hasAny: true };
    const out = analyzePivotalTurn({
      finalState: makeState({ candidateStance: stance }),
      moves: [
        m({ lever: "open-with-offer", newTotalLpa: 22, turnIndex: 0, candidateTargetAtTurn: 26 }),
        m({ lever: "counter-base", newTotalLpa: 24, turnIndex: 1, candidateTargetAtTurn: 26 }),
      ],
    });
    expect(out.reason).toBe("stance-breach");
    expect(out.stanceCode).toBe("soundsDesperate");
    expect(out.detail).toMatch(/desperation|urgency|market data/i);
  });

  it("uses per-turn stance map to pinpoint the breach turn", () => {
    const breachStance = { ...emptyStance(), badmouthsCurrent: true, hasAny: true };
    const stanceByTurn = new Map<number, CandidateStanceResult>([
      [0, emptyStance()],
      [2, breachStance],
      [4, breachStance],
    ]);
    const out = analyzePivotalTurn({
      finalState: makeState({ candidateStance: breachStance }),
      moves: [
        m({ lever: "open-with-offer", newTotalLpa: 22, turnIndex: 0, candidateTargetAtTurn: 26 }),
        m({ lever: "counter-base", newTotalLpa: 24, turnIndex: 2, candidateTargetAtTurn: 26 }),
      ],
      stanceByTurn,
    });
    expect(out.reason).toBe("stance-breach");
    expect(out.turnIndex).toBe(2);
    expect(out.stanceCode).toBe("badmouthsCurrent");
  });
});

describe("analyzePivotalTurn — anchor too late", () => {
  it("flags anchor-too-late when recruiter traversed >60% before candidate anchored", () => {
    const out = analyzePivotalTurn({
      finalState: makeState(),
      moves: [
        m({ lever: "open-with-offer", newTotalLpa: 21, turnIndex: 0 }),
        m({ lever: "counter-base", newTotalLpa: 27, turnIndex: 1 }), // already 70% of band
        m({ lever: "counter-base", newTotalLpa: 28, turnIndex: 2, candidateTargetAtTurn: 28 }),
      ],
    });
    expect(out.reason).toBe("anchor-too-late");
    expect(out.turnIndex).toBe(2);
  });
});

describe("analyzePivotalTurn — leverage collapse", () => {
  it("detects largest single-turn leverage drop", () => {
    /* Spread = 10. Turn 0 target 30, offer 20 → leverage 1.0.
     * Turn 1 target 30, offer 28 → leverage 0.2. Delta -0.8. */
    const out = analyzePivotalTurn({
      finalState: makeState(),
      moves: [
        m({ lever: "open-with-offer", newTotalLpa: 20, turnIndex: 0, candidateTargetAtTurn: 30 }),
        m({ lever: "counter-base", newTotalLpa: 28, turnIndex: 1, candidateTargetAtTurn: 30 }),
      ],
    });
    expect(out.reason).toBe("leverage-collapse");
    expect(out.turnIndex).toBe(1);
    expect(out.leverageDelta!).toBeLessThan(0);
  });

  it("returns null pivotal turn on a clean session", () => {
    const out = analyzePivotalTurn({
      finalState: makeState(),
      moves: [
        m({ lever: "open-with-offer", newTotalLpa: 20, turnIndex: 0, candidateTargetAtTurn: 26 }),
        m({ lever: "counter-base", newTotalLpa: 22, turnIndex: 1, candidateTargetAtTurn: 26 }),
        m({ lever: "counter-base", newTotalLpa: 24, turnIndex: 2, candidateTargetAtTurn: 26 }),
      ],
    });
    expect(out.turnIndex).toBe(null);
  });
});
