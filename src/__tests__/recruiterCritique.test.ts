import { describe, it, expect } from "vitest";
import {
  critiqueRecruiterStrategy,
  recommendWalkAway,
  type RecruiterCritiqueCode,
} from "../../server-handlers/_recruiter-critique";
import {
  computeNegotiationMetrics,
  type KernelTurnSummary,
} from "../../server-handlers/_negotiation-metrics";
import type {
  NegotiationState,
  NegotiationBand,
} from "../../server-handlers/_negotiation-kernel";
import { EMPTY_CANDIDATE_PROFILE } from "../../server-handlers/_candidate-profile";

const BAND: NegotiationBand = { initialOffer: 20, maxStretch: 30, walkAway: 16, hasEquity: false };

function makeState(over: Partial<NegotiationState> = {}): NegotiationState {
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
    infoAskedInitiated: [],
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

const m = (over: Partial<KernelTurnSummary>): KernelTurnSummary => ({
  lever: "open-with-offer",
  newTotalLpa: null,
  turnIndex: 0,
  candidateTargetAtTurn: null,
  ...over,
});

function codes(
  state: NegotiationState,
  moves: KernelTurnSummary[],
): RecruiterCritiqueCode[] {
  return critiqueRecruiterStrategy({ finalState: state, moves }).map((c) => c.code);
}

describe("critiqueRecruiterStrategy — opening posture", () => {
  it("flags open-too-high when opening > band midpoint", () => {
    /* midpoint = 25; opening at 27 = too high. */
    const moves = [m({ lever: "open-with-offer", newTotalLpa: 27, turnIndex: 0 })];
    expect(codes(makeState(), moves)).toContain("open-too-high");
  });

  it("clean open at initialOffer fires nothing", () => {
    const moves = [m({ lever: "open-with-offer", newTotalLpa: 20, turnIndex: 0 })];
    expect(codes(makeState(), moves)).not.toContain("open-too-high");
  });
});

describe("critiqueRecruiterStrategy — ceiling discipline", () => {
  it("premature-ceiling when maxStretch hit before turn 3", () => {
    const moves = [
      m({ lever: "open-with-offer", newTotalLpa: 22, turnIndex: 0, candidateTargetAtTurn: 30 }),
      m({ lever: "counter-base", newTotalLpa: 30, turnIndex: 1, candidateTargetAtTurn: 30 }),
    ];
    const c = codes(makeState(), moves);
    expect(c).toContain("premature-ceiling");
  });

  it("ceiling-without-anchor when max hit before candidate stated target", () => {
    const moves = [
      m({ lever: "open-with-offer", newTotalLpa: 22, turnIndex: 0 }),
      m({ lever: "counter-base", newTotalLpa: 30, turnIndex: 1 }),
    ];
    expect(codes(makeState(), moves)).toContain("ceiling-without-anchor");
  });

  it("late ceiling (turn ≥3) with anchor does not fire", () => {
    const moves = [
      m({ lever: "open-with-offer", newTotalLpa: 22, turnIndex: 0, candidateTargetAtTurn: 30 }),
      m({ lever: "probe", turnIndex: 1, candidateTargetAtTurn: 30 }),
      m({ lever: "counter-base", newTotalLpa: 25, turnIndex: 2, candidateTargetAtTurn: 30 }),
      m({ lever: "counter-base", newTotalLpa: 30, turnIndex: 3, candidateTargetAtTurn: 30 }),
    ];
    const c = codes(makeState(), moves);
    expect(c).not.toContain("premature-ceiling");
    expect(c).not.toContain("ceiling-without-anchor");
  });
});

describe("critiqueRecruiterStrategy — concession discipline", () => {
  it("concession-without-ask when offer climbs but candidate target unchanged", () => {
    const moves = [
      m({ lever: "open-with-offer", newTotalLpa: 22, turnIndex: 0, candidateTargetAtTurn: 25 }),
      m({ lever: "counter-base", newTotalLpa: 24, turnIndex: 1, candidateTargetAtTurn: 25 }),
    ];
    expect(codes(makeState(), moves)).toContain("concession-without-ask");
  });

  it("clean climb when candidate target moves between turns", () => {
    const moves = [
      m({ lever: "open-with-offer", newTotalLpa: 22, turnIndex: 0, candidateTargetAtTurn: 25 }),
      m({ lever: "counter-base", newTotalLpa: 24, turnIndex: 1, candidateTargetAtTurn: 28 }),
    ];
    expect(codes(makeState(), moves)).not.toContain("concession-without-ask");
  });
});

describe("critiqueRecruiterStrategy — lever pacing", () => {
  it("lever-fatigue when ≥4 distinct concession levers in first 4 turns", () => {
    const moves = [
      m({ lever: "counter-base", newTotalLpa: 22, turnIndex: 0 }),
      m({ lever: "joining-bonus", turnIndex: 1 }),
      m({ lever: "equity-grant", turnIndex: 2 }),
      m({ lever: "benefits-summary", turnIndex: 3 }),
    ];
    expect(codes(makeState(), moves)).toContain("lever-fatigue");
  });

  it("paced lever use does not fire fatigue", () => {
    const moves = [
      m({ lever: "open-with-offer", newTotalLpa: 22, turnIndex: 0 }),
      m({ lever: "probe", turnIndex: 1 }),
      m({ lever: "counter-base", newTotalLpa: 24, turnIndex: 2 }),
    ];
    expect(codes(makeState(), moves)).not.toContain("lever-fatigue");
  });
});

describe("critiqueRecruiterStrategy — hold-firm credibility", () => {
  it("hold-firm-then-concede when bump happens after hold-firm", () => {
    const moves = [
      m({ lever: "open-with-offer", newTotalLpa: 22, turnIndex: 0, candidateTargetAtTurn: 28 }),
      m({ lever: "counter-base", newTotalLpa: 25, turnIndex: 1, candidateTargetAtTurn: 28 }),
      m({ lever: "hold-firm", turnIndex: 2, candidateTargetAtTurn: 28 }),
      m({ lever: "counter-base", newTotalLpa: 27, turnIndex: 3, candidateTargetAtTurn: 28 }),
    ];
    expect(codes(makeState(), moves)).toContain("hold-firm-then-concede");
  });

  it("hold-firm honoured (no later bump) does not fire", () => {
    const moves = [
      m({ lever: "open-with-offer", newTotalLpa: 22, turnIndex: 0, candidateTargetAtTurn: 28 }),
      m({ lever: "counter-base", newTotalLpa: 25, turnIndex: 1, candidateTargetAtTurn: 28 }),
      m({ lever: "hold-firm", turnIndex: 2, candidateTargetAtTurn: 28 }),
    ];
    expect(codes(makeState(), moves)).not.toContain("hold-firm-then-concede");
  });

  it("multiple final-offer assertions without close fires secondary signal", () => {
    const moves = [
      m({ lever: "open-with-offer", newTotalLpa: 22, turnIndex: 0, candidateTargetAtTurn: 30 }),
      m({ lever: "counter-base", newTotalLpa: 25, turnIndex: 1, candidateTargetAtTurn: 30 }),
    ];
    const state = makeState({ phase: "stalemate", finalOfferAssertedCount: 3 });
    expect(codes(state, moves)).toContain("hold-firm-then-concede");
  });
});

describe("critiqueRecruiterStrategy — info gathering", () => {
  it("no-probe when counter-base used without prior probe", () => {
    const moves = [
      m({ lever: "open-with-offer", newTotalLpa: 22, turnIndex: 0, candidateTargetAtTurn: 25 }),
      m({ lever: "counter-base", newTotalLpa: 24, turnIndex: 1, candidateTargetAtTurn: 25 }),
    ];
    expect(codes(makeState(), moves)).toContain("no-probe");
  });

  it("probe-then-counter clean path", () => {
    const moves = [
      m({ lever: "open-with-offer", newTotalLpa: 22, turnIndex: 0 }),
      m({ lever: "probe", turnIndex: 1, candidateTargetAtTurn: 25 }),
      m({ lever: "counter-base", newTotalLpa: 24, turnIndex: 2, candidateTargetAtTurn: 25 }),
    ];
    expect(codes(makeState(), moves)).not.toContain("no-probe");
  });
});

describe("critiqueRecruiterStrategy — closure quality", () => {
  it("closed-without-breakup when accepted without candidate breakdown", () => {
    const state = makeState({
      phase: "accepted",
      acceptedAtTurn: 3,
      candidateComponentBreakdown: { base: null, variable: null, equity: null, hasAny: false },
    });
    const moves = [
      m({ lever: "open-with-offer", newTotalLpa: 22, turnIndex: 0 }),
      m({ lever: "close-acceptance", turnIndex: 3 }),
    ];
    expect(codes(state, moves)).toContain("closed-without-breakup");
  });

  it("accepted with breakdown does not fire", () => {
    const state = makeState({
      phase: "accepted",
      acceptedAtTurn: 3,
      candidateComponentBreakdown: { base: 18, variable: 4, equity: null, hasAny: true },
    });
    const moves = [
      m({ lever: "open-with-offer", newTotalLpa: 22, turnIndex: 0 }),
      m({ lever: "close-acceptance", turnIndex: 3 }),
    ];
    expect(codes(state, moves)).not.toContain("closed-without-breakup");
  });

  it("walkaway-without-warning fires on abrupt walkaway", () => {
    const state = makeState({ phase: "walked-away", walkedAwayAtTurn: 2 });
    const moves = [
      m({ lever: "open-with-offer", newTotalLpa: 22, turnIndex: 0 }),
      m({ lever: "close-walkaway", turnIndex: 2 }),
    ];
    expect(codes(state, moves)).toContain("walkaway-without-warning");
  });

  it("walkaway after hold-firm does not fire warning", () => {
    const state = makeState({ phase: "walked-away", walkedAwayAtTurn: 3 });
    const moves = [
      m({ lever: "open-with-offer", newTotalLpa: 22, turnIndex: 0 }),
      m({ lever: "hold-firm", turnIndex: 2 }),
      m({ lever: "close-walkaway", turnIndex: 3 }),
    ];
    expect(codes(state, moves)).not.toContain("walkaway-without-warning");
  });
});

describe("critiqueRecruiterStrategy — clean session", () => {
  it("textbook session fires nothing", () => {
    const state = makeState({
      phase: "accepted",
      acceptedAtTurn: 4,
      candidateComponentBreakdown: { base: 18, variable: 4, equity: null, hasAny: true },
    });
    const moves = [
      m({ lever: "open-with-offer", newTotalLpa: 20, turnIndex: 0 }),
      m({ lever: "probe", turnIndex: 1, candidateTargetAtTurn: 26 }),
      m({ lever: "counter-base", newTotalLpa: 24, turnIndex: 2, candidateTargetAtTurn: 26 }),
      m({ lever: "joining-bonus", turnIndex: 3, candidateTargetAtTurn: 26 }),
      m({ lever: "close-acceptance", turnIndex: 4, candidateTargetAtTurn: 26 }),
    ];
    expect(codes(state, moves)).toEqual([]);
  });
});

describe("computeNegotiationMetrics — recruiterCritique field", () => {
  it("surfaces critique items on the metrics envelope", () => {
    const state = makeState({ phase: "accepted", acceptedAtTurn: 1, highestOfferMade: 30 });
    const moves = [
      m({ lever: "open-with-offer", newTotalLpa: 22, turnIndex: 0 }),
      m({ lever: "counter-base", newTotalLpa: 30, turnIndex: 1 }),
    ];
    const out = computeNegotiationMetrics({ finalState: state, moves });
    expect(out.recruiterCritique.length).toBeGreaterThan(0);
    expect(out.recruiterCritique.map((c) => c.code)).toContain("ceiling-without-anchor");
  });

  it("clean session yields empty critique array", () => {
    const state = makeState({
      phase: "accepted",
      acceptedAtTurn: 4,
      candidateComponentBreakdown: { base: 18, variable: 4, equity: null, hasAny: true },
    });
    const moves = [
      m({ lever: "open-with-offer", newTotalLpa: 20, turnIndex: 0 }),
      m({ lever: "probe", turnIndex: 1, candidateTargetAtTurn: 26 }),
      m({ lever: "counter-base", newTotalLpa: 24, turnIndex: 2, candidateTargetAtTurn: 26 }),
      m({ lever: "close-acceptance", turnIndex: 4, candidateTargetAtTurn: 26 }),
    ];
    const out = computeNegotiationMetrics({ finalState: state, moves });
    expect(out.recruiterCritique).toEqual([]);
  });
});

describe("recommendWalkAway — Wave-7 disengagement signal", () => {
  it("no walk on a vanilla state", () => {
    const r = recommendWalkAway(makeState());
    expect(r.walk).toBe(false);
    expect(r.reason).toBe("");
  });

  it("walks when target is >20% above maxStretch after 3+ turns", () => {
    /* band ceiling 30; target 40 = 33% above. */
    const r = recommendWalkAway(makeState({ candidateTarget: 40, turnIndex: 5 }));
    expect(r.walk).toBe(true);
    expect(r.reason).toMatch(/above band ceiling/);
  });

  it("does NOT walk on >20% target when turn < 3 (still early)", () => {
    const r = recommendWalkAway(makeState({ candidateTarget: 40, turnIndex: 1 }));
    expect(r.walk).toBe(false);
  });

  it("walks when final-offer asserted 3+ times without resolution", () => {
    const r = recommendWalkAway(makeState({ finalOfferAssertedCount: 3 }));
    expect(r.walk).toBe(true);
    expect(r.reason).toMatch(/Final-offer asserted/);
  });

  it("does NOT walk when finalOfferAssertedCount is high but candidate already walked", () => {
    const r = recommendWalkAway(
      makeState({ finalOfferAssertedCount: 4, walkAwayReturned: true }),
    );
    /* candidate already gone; recruiter walk-recommendation is moot. */
    expect(r.walk).toBe(false);
  });

  it("walks on stacked renege + bgvAnxiety", () => {
    const base = makeState();
    base.candidateProfile.postAcceptanceRenege = true;
    base.candidateProfile.bgvAnxiety = true;
    const r = recommendWalkAway(base);
    expect(r.walk).toBe(true);
    expect(r.reason).toMatch(/risk signals/);
  });

  it("walks on PIP + prior offer rescinded", () => {
    const base = makeState();
    base.candidateProfile.pipDisclosed = true;
    base.candidateProfile.offerRescindedHistory = true;
    const r = recommendWalkAway(base);
    expect(r.walk).toBe(true);
  });

  it("walks when at ceiling and turn > 8 (conversation dragged)", () => {
    const r = recommendWalkAway(
      makeState({ highestOfferMade: 30, turnIndex: 9 }),
    );
    expect(r.walk).toBe(true);
    expect(r.reason).toMatch(/At ceiling/);
  });

  it("does NOT walk at ceiling when turn <= 8", () => {
    const r = recommendWalkAway(
      makeState({ highestOfferMade: 30, turnIndex: 6 }),
    );
    expect(r.walk).toBe(false);
  });
});

describe("recommendWalkAway — Bug-D close/engagement carve-out", () => {
  /* The cardinal failure: a candidate who has relented and is ACCEPTING the
   * standing offer keeps a stale over-band target on record (their first
   * number), so the over-band walk condition fired ON the acceptance and the
   * bot walked away from a candidate trying to close. A candidate closing —
   * or making a constructive in-band counter — must NEVER be walked away from.
   * These lock the suppression; a genuine over-band decline must still walk. */
  function withLastCandidate(text: string, over: Partial<NegotiationState> = {}) {
    return makeState({
      ...over,
      conversationLog: [{ speaker: "candidate", text }],
    });
  }

  it("does NOT walk on an explicit acceptance despite a stale over-band target", () => {
    const r = recommendWalkAway(
      withLastCandidate("Great, that works for me. Let's go ahead and close.", {
        candidateTarget: 40, // 33% over ceiling 30 — would otherwise walk
        turnIndex: 5,
      }),
    );
    expect(r.walk).toBe(false);
  });

  it("does NOT walk on a constructive in-band counter (movement signal)", () => {
    const r = recommendWalkAway(
      withLastCandidate("The fixed feels a bit low — can we get it closer to 28?", {
        candidateTarget: 40,
        turnIndex: 5,
      }),
    );
    expect(r.walk).toBe(false);
  });

  it("does NOT walk when the candidate offers to come down to a number", () => {
    const r = recommendWalkAway(
      withLastCandidate("I can come down to 32 if the fixed is solid.", {
        candidateTarget: 40,
        turnIndex: 5,
      }),
    );
    expect(r.walk).toBe(false);
  });

  it("STILL walks on a genuine over-band decline (no engagement, no close)", () => {
    const r = recommendWalkAway(
      withLastCandidate("40 is my floor and I'm not moving off it.", {
        candidateTarget: 40,
        turnIndex: 5,
      }),
    );
    expect(r.walk).toBe(true);
    expect(r.reason).toMatch(/above band ceiling/);
  });

  it("STILL walks on a negated/conditional 'that works' that is not a real close", () => {
    /* "that won't work unless you hit 40" contains the acceptance token
     * "work" but is a conditional decline — the negation guard must keep it
     * walking, not mistake it for a close. */
    const r = recommendWalkAway(
      withLastCandidate("That won't work for me unless you can hit 40.", {
        candidateTarget: 40,
        turnIndex: 5,
      }),
    );
    expect(r.walk).toBe(true);
  });
});
