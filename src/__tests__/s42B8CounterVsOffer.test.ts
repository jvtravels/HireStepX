/**
 * S42-B8 / S43-B7 — firstCounterVsOffer three-tier resolution
 *
 * Bug: candidateAskLpa in metrics used firstAnchoredTarget for ALL sessions,
 * so a discovery-phase disclosure (before any offer) leaked into "YOUR ASK"
 * even when the candidate accepted/walked without ever countering.
 *
 * Fix: the kernel sets firstCounterVsOffer ONLY when highestOfferMade>0 at
 * counter-state time. Metrics uses it for new rows; falls back to legacy
 * heuristic (firstAnchoredTarget > openingOffer) for old rows.
 */

import { describe, it, expect } from "vitest";
import {
  computeNegotiationMetrics,
  type KernelTurnSummary,
} from "../../server-handlers/_negotiation-metrics";
import type { NegotiationState, NegotiationBand } from "../../server-handlers/_negotiation-kernel";
import { EMPTY_CANDIDATE_PROFILE } from "../../server-handlers/_candidate-profile";

const BAND: NegotiationBand = {
  initialOffer: 43.7,
  maxStretch: 55,
  walkAway: 38,
  hasEquity: false,
};

function makeState(over: Partial<NegotiationState>): NegotiationState {
  return {
    sessionId: "s-s42b8",
    role: "SWE",
    company: "Myntra",
    band: BAND,
    phase: "accepted",
    turnIndex: 6,
    maxTurns: 8,
    candidateTarget: null,
    lastCandidateCounterLpa: null,
    firstAnchoredTarget: null,
    candidateCurrentCtc: null,
    competingOffer: null,
    candidateAskedAsRange: false,
    highestOfferMade: 48,
    leversUsed: [],
    lastAiText: "",
    lastJoiningBonusOffered: null,
    conversationLog: [],
    finalOfferAssertedCount: 0,
    vossTacticsUsed: [],
    infoAsked: [],
    infoAskedInitiated: [],
    verbalAcceptanceTurn: 6,
    postVerbalRenegotiationCount: 0,
    counterRound: 0,
    recentRecoveryActive: false,
    walkAwayReturned: false,
    hardBandCap: false,
    marketMode: "neutral",
    recruiterPersona: "consultative",
    acceptedAtTurn: 6,
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
      requestsHold: false,
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

const offerMove = (lpa: number, turnIndex = 0): KernelTurnSummary => ({
  lever: "open-with-offer",
  newTotalLpa: lpa,
  turnIndex,
  candidateTargetAtTurn: null,
});

/* ── S42-B8 pattern: discovery target NOT treated as a counter ── */
describe("S42-B8 — discovery target must not appear as YOUR ASK", () => {
  it("new row: firstCounterVsOffer=null → candidateAsk is null even when firstAnchoredTarget is set", () => {
    /* Candidate said ₹55L in discovery (E1) then silently accepted ₹48L offer.
     * firstAnchoredTarget=55 but firstCounterVsOffer=null (no counter vs offer). */
    const m = computeNegotiationMetrics({
      finalState: makeState({
        phase: "accepted",
        firstAnchoredTarget: 55,
        firstCounterVsOffer: null, // explicitly set → new row, no counter
        highestOfferMade: 48,
        acceptedAtTurn: 6,
      }),
      moves: [offerMove(48)],
    });
    expect(m.candidateAskLpa).toBeNull();
  });

  it("new row: firstCounterVsOffer=55 → candidateAsk is 55 (real counter)", () => {
    /* Candidate countered at ₹55L after recruiter opened at ₹48L.
     * firstCounterVsOffer=55 because highestOfferMade>0 at counter time. */
    const m = computeNegotiationMetrics({
      finalState: makeState({
        phase: "accepted",
        firstAnchoredTarget: 55,
        firstCounterVsOffer: 55,
        highestOfferMade: 51,
        acceptedAtTurn: 8,
      }),
      moves: [offerMove(48), offerMove(51, 4)],
    });
    expect(m.candidateAskLpa).toBe(55);
  });
});

/* ── S43-B7 pattern: walk-away without counter → no YOUR ASK ── */
describe("S43-B7 — walk-away without countering must not fabricate YOUR ASK", () => {
  it("new row: candidate walked away, never countered → candidateAsk is null", () => {
    /* Recruiter offered ₹45.1L, candidate walked without countering.
     * firstAnchoredTarget may be 45 (discovery) but firstCounterVsOffer=null. */
    const m = computeNegotiationMetrics({
      finalState: makeState({
        phase: "walked-away",
        firstAnchoredTarget: 45,
        firstCounterVsOffer: null,
        highestOfferMade: 45.1,
        acceptedAtTurn: null,
        walkedAwayAtTurn: 5,
      }),
      moves: [offerMove(45.1)],
    });
    expect(m.candidateAskLpa).toBeNull();
  });
});

/* ── No-offer sessions: proactive anchor IS the ask ── */
describe("proactive anchor (no offer made) → candidateAsk shows firstAnchoredTarget", () => {
  it("firstAnchoredTarget is used when no offer trajectory exists", () => {
    /* Candidate named ₹60L, recruiter never made an offer (walked). */
    const m = computeNegotiationMetrics({
      finalState: makeState({
        phase: "walked-away",
        firstAnchoredTarget: 60,
        firstCounterVsOffer: null, // no offer → field value doesn't matter
        highestOfferMade: 0,
        walkedAwayAtTurn: 3,
      }),
      moves: [], // no offer moves → offerTrajectoryLpa empty
    });
    expect(m.candidateAskLpa).toBe(60);
  });

  it("no anchor, no offer → candidateAsk is null", () => {
    const m = computeNegotiationMetrics({
      finalState: makeState({
        phase: "walked-away",
        firstAnchoredTarget: null,
        firstCounterVsOffer: null,
        highestOfferMade: 0,
      }),
      moves: [],
    });
    expect(m.candidateAskLpa).toBeNull();
  });
});

/* ── Legacy rows: firstCounterVsOffer is undefined ── */
describe("legacy rows (firstCounterVsOffer=undefined) — heuristic fallback", () => {
  it("firstAnchoredTarget > openingOffer → treated as real counter (legacy)", () => {
    /* Old session: candidate opened at ₹55L, recruiter offered ₹48L.
     * firstCounterVsOffer absent (undefined) → use firstAnchoredTarget=55 because
     * 55 > 48 (opening offer), so it reads as a genuine counter. */
    const m = computeNegotiationMetrics({
      finalState: makeState({
        phase: "accepted",
        firstAnchoredTarget: 55,
        firstCounterVsOffer: undefined, // legacy row: field absent
        highestOfferMade: 50,
        acceptedAtTurn: 6,
      }),
      moves: [offerMove(48), offerMove(50, 3)],
    });
    expect(m.candidateAskLpa).toBe(55);
  });

  it("firstAnchoredTarget <= openingOffer → treated as discovery (legacy)", () => {
    /* Old session: candidate said ₹45L in discovery, recruiter opened at ₹48L.
     * 45 <= 48 → the stated target was BELOW the offer, not a real counter. */
    const m = computeNegotiationMetrics({
      finalState: makeState({
        phase: "accepted",
        firstAnchoredTarget: 45,
        firstCounterVsOffer: undefined,
        highestOfferMade: 48,
        acceptedAtTurn: 5,
      }),
      moves: [offerMove(48)],
    });
    expect(m.candidateAskLpa).toBeNull();
  });
});
