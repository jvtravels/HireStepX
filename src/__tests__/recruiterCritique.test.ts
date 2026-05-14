import { describe, it, expect } from "vitest";
import {
  critiqueRecruiterStrategy,
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
      hasAny: false,
    },
    decisionDeadline: {
      deadlineDays: null,
      deadlineExplicit: false,
      conditionalAcceptance: false,
      conditionalEvidence: null,
      hasAny: false,
    },
    candidateProfile: {
      careerGapMonths: null,
      careerGapActivity: null,
      tenureSignal: null,
      levelMismatch: null,
      domainPivot: false,
      transferableSkillsClaimed: false,
      compensationHistoryIssue: null,
      serviceBondAccepted: false,
      probationCompMentioned: false,
    internshipConversion: false,
    collegeTier: null,
      earlySwitcher: false,
      lowCtcAlert: false,
      priorInternshipNonConversion: false,
      serviceCompanyBackground: false,
      compBreakupUnknown: false,
        recentLayoff: false,
        hotDomainPremium: false,
        pipDisclosed: false,
        verbalOnlyOffer: false,
        culturalJoiningConstraint: false,
        peopleManagementClaimed: false,
        crossBorderAnchor: false,
        unvestedEquityLossClaim: false,
        explodingOfferPressure: false,
        postAcceptanceRenege: false,
        quotaAttainmentClaimed: false,
        gardenLeaveDisclosed: false,
        nonCompeteFlagged: false,
        relocationBonusAsked: false,
        parentInsuranceAsked: false,
        inHandTakehomeFocus: false,
        rtoPushback: false,
        returnshipMaternity: false,
        payBandAsked: false,
        taxStructureAsked: false,
        bgvAnxiety: false,
        esopSophisticationProbe: false,
        spouseJobConstraint: false,
        agingParentCare: false,
        moonlightingDisclosed: false,
        mentalHealthDisclosed: false,
        payParityAsked: false,
        preemptiveCounterReceived: false,
        acceptanceTimeRequest: false,
        cryptoTokenComp: false,
        gccArbitrageAnchor: false,
        benchTimeDisclosed: false,
        founderSecondInnings: false,
        latecareerAgeBias: false,
        titlePrecisionAsk: false,
        currentCtcRefusal: false,
        pregnancyDisclosed: false,
        boomerangRehire: false,
        referralReceived: false,
        hometownReturnPreference: false,
        pwdDisability: false,
        gratuityVestingNear: false,
        acquisitionContextAsk: false,
        lgbtqDisclosure: false,
        chronicIllnessDisclosed: false,
        noticeBuyoutAsk: false,
        bfsiClawbackContext: false,
        bigFourGradeStep: false,
        securityClearanceNeeded: false,
        missionDrivenComp: false,
        edtechReputationCheck: false,
        acquiHireContext: false,
        cabinParkingAsk: false,
        spanOfControlAsk: false,
        preResignationStealth: false,
        reverseAnchorAsk: false,
        dietaryReligiousNeed: false,
        oldEmployerDocsIssue: false,
        equityRefreshCadenceAsk: false,
        signOnClawback: false,
        variableTrackRecord: false,
        wfhEquipmentStipend: false,
        salaryReviewCadenceAsk: false,
        multipleOffersJuggling: false,
        recruitmentAgencyMediation: false,
        internalTransferContext: false,
        offerRescindedHistory: false,
        internationalDegreePremium: false,
        domesticTopMbaAnchor: false,
        toxicManagerContext: false,
        visaSponsorshipNeed: false,
        casteReservationContext: false,
        veteranTransition: false,
        singleParentConstraint: false,
        jointFamilyFinancialResp: false,
        paternityLeaveAsk: false,
        menstrualLeavePolicy: false,
        esopExerciseLoanAsk: false,
        preIpoSecondaryAsk: false,
        accelerationTriggerAsk: false,
        esopPerquisiteTaxAsk: false,
        tenderOfferCycleAsk: false,
        probationaryDurationAsk: false,
        offerLetterTurnaroundDemand: false,
        contractToHireAsk: false,
        headcountApprovalCheck: false,
        ipAssignmentClauseAsk: false,
        healthcarePharmaContext: false,
        manufacturingCoreContext: false,
        quickCommerceContext: false,
        d2cConsumerEquity: false,
      hasAny: false,
    },
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
