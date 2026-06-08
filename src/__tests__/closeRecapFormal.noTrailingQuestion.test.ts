/* BUG-1 — close-recap-formal prose must NOT end with a question that
 * solicits further dialogue. Today line 60 ends with 'Sounds good?'.
 */
import { describe, it, expect } from "vitest";
import { proseCloseRecapFormal } from "../../server-handlers/prose/close-recap-formal";
import type { NegotiationState, NegotiationBand } from "../../server-handlers/_negotiation-kernel";

const BAND: NegotiationBand = { initialOffer: 18, maxStretch: 24, walkAway: 14, hasEquity: false };

function mkState(): NegotiationState {
  return {
    sessionId: "close-recap-test",
    role: "Senior Product Designer",
    company: "acme",
    band: BAND,
    phase: "closing-push",
    turnIndex: 13,
    maxTurns: 20,
    candidateTarget: 24,
    lastCandidateCounterLpa: 24,
    firstAnchoredTarget: 24,
    candidateCurrentCtc: 18,
    competingOffer: null,
    candidateComponentBreakdown: {} as never,
    candidateAskedAsRange: false,
    highestOfferMade: 24,
    leversUsed: ["counter-base"],
    lastAiText: "",
    lastJoiningBonusOffered: 2,
    conversationLog: [],
    finalOfferAssertedCount: 0,
    vossTacticsUsed: [],
    infoAsked: [],
    verbalAcceptanceTurn: 12,
    postVerbalRenegotiationCount: 0,
    counterRound: 1,
    recentRecoveryActive: false,
    walkAwayReturned: false,
    hardBandCap: false,
    marketMode: "neutral",
    recruiterPersona: "consultative",
    acceptedAtTurn: null,
    walkedAwayAtTurn: null,
    hikePercent: null,
    rationale: null,
    noticeJoining: {} as never,
    equityVesting: {} as never,
    locationMode: {} as never,
    competingOfferDetail: {} as never,
    decisionDeadline: {} as never,
    candidateProfile: {} as never,
    miscSignals: {} as never,
    candidateStance: {} as never,
    salesOTE: {} as never,
    contractRate: {} as never,
    retentionCounter: {} as never,
    candidateTotalYoe: 6,
    candidateApplicableYoe: 6,
    candidatePrimaryDomain: null,
    freshGradDisclosed: false,
    recruiterFactsAlreadySaid: [],
    anchorLocked: true,
    lockedAnchorLpa: 24,
    promptInjectionAttempts: [],
  } as NegotiationState;
}

describe("proseCloseRecapFormal — terminal prose hygiene", () => {
  it("does not end with a question (no 'Sounds good?')", () => {
    const action = {
      kind: "close-recap-formal",
      fixedLpa: 20,
      variableLpa: 4,
      joiningBonusLpa: 2,
      retentionBonusLpa: 0,
      noticePeriodWeeks: 8,
      proposedJoiningDate: null,
      bgvStartTrigger: null,
      offerLetterEta: "5 business days",
    } as never;
    const out = proseCloseRecapFormal(action, mkState(), {} as never);
    expect(out).not.toMatch(/\?\s*$/);
    expect(out.toLowerCase()).not.toContain("sounds good?");
  });
});
