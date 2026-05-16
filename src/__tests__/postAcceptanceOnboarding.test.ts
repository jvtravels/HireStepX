import { describe, it, expect } from "vitest";
import { buildPostAcceptanceMessage } from "../../server-handlers/_post-acceptance";
import type { NegotiationState } from "../../server-handlers/_negotiation-kernel";

function makeState(overrides: Partial<NegotiationState> = {}): NegotiationState {
  // Minimal stub — only the fields the post-acceptance helper reads.
  return {
    sessionId: "s",
    role: "Senior SDE",
    company: "Acme",
    band: {
      walkAway: 20,
      initialOffer: 24,
      maxStretch: 32,
      hasEquity: true,
      baseFloor: 18,
      baseStretch: 28,
      variableMax: 6,
    },
    phase: "closing",
    turnIndex: 6,
    maxTurns: 8,
    candidateTarget: 30,
    lastCandidateCounterLpa: null,
    firstAnchoredTarget: 30,
    candidateCurrentCtc: 24,
    competingOffer: null,
    candidateComponentBreakdown: { base: null, variable: null, equity: null, hasAny: false },
    candidateAskedAsRange: false,
    highestOfferMade: 28,
    leversUsed: [],
    lastAiText: "",
    lastJoiningBonusOffered: 2,
    conversationLog: [],
    finalOfferAssertedCount: 0,
    vossTacticsUsed: [],
    infoAsked: [],
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
    hikePercent: null,
    rationale: null,
    noticeJoining: {
      noticePeriodDays: 60,
      buyoutRequested: false,
      joiningBonusAsk: null,
      earlyJoinPreferred: false,
      joiningBonusClawbackDiscussed: false,
      lastWorkingDayText: null,
      hasAny: true,
    } as never,
    equityVesting: { hasAny: false } as never,
    locationMode: { hasAny: false } as never,
    competingOfferDetail: { hasAny: false } as never,
    decisionDeadline: { hasAny: false } as never,
    candidateProfile: { hasAny: false } as never,
    miscSignals: { hasAny: false } as never,
    candidateStance: { hasAny: false } as never,
    salesOTE: { hasAny: false } as never,
    contractRate: { hasAny: false } as never,
    retentionCounter: { hasAny: false } as never,
    candidateTotalYoe: 5,
    candidateApplicableYoe: 5,
    candidatePrimaryDomain: "backend",
    freshGradDisclosed: false,
    recruiterFactsAlreadySaid: [],
    ...overrides,
  } as NegotiationState;
}

describe("_post-acceptance — buildPostAcceptanceMessage", () => {
  it("includes congratulations + company + ₹close + JB", () => {
    const msg = buildPostAcceptanceMessage(makeState());
    expect(msg).toMatch(/Congratulations/);
    expect(msg).toMatch(/Acme/);
    expect(msg).toMatch(/₹28L/);
    expect(msg).toMatch(/₹2L joining bonus/);
  });

  it("lists all six doc checklist items in order", () => {
    const msg = buildPostAcceptanceMessage(makeState());
    const expectedOrder = [
      "PF UAN",
      "payslips",
      "Income Tax Return",
      "Form 16",
      "Education originals",
      "Relieving-letter chain",
    ];
    let idx = -1;
    for (const tok of expectedOrder) {
      const next = msg.indexOf(tok);
      expect(next).toBeGreaterThan(idx);
      idx = next;
    }
  });

  it("includes BGV section by default", () => {
    expect(buildPostAcceptanceMessage(makeState())).toMatch(/BGV/);
  });

  it("includeBgv=false suppresses BGV section", () => {
    expect(buildPostAcceptanceMessage(makeState(), { includeBgv: false })).not.toMatch(/BGV/);
  });

  it("includes counter-offer heads-up by default", () => {
    expect(buildPostAcceptanceMessage(makeState())).toMatch(/retention counter/);
  });

  it("includeCounterOfferHeadsUp=false suppresses heads-up", () => {
    expect(buildPostAcceptanceMessage(makeState(), { includeCounterOfferHeadsUp: false }))
      .not.toMatch(/retention counter/);
  });

  it("when noticePeriodDays known, joining-date lock references it", () => {
    const msg = buildPostAcceptanceMessage(makeState());
    expect(msg).toMatch(/60-day notice/);
  });

  it("when noticePeriodDays null, joining-date lock asks for tentative date", () => {
    const s = makeState({
      noticeJoining: { hasAny: false } as never,
    });
    const msg = buildPostAcceptanceMessage(s);
    expect(msg).toMatch(/tentative joining date/);
  });
});
