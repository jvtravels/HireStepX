/* BUG-5 — clarification questions after verbal acceptance must NOT
 * increment postVerbalRenegotiationCount. Today, two info questions in a row
 * trigger rescission. Fails on main.
 */
import { describe, it, expect } from "vitest";
import { applyCandidateAnswer } from "../../server-handlers/_negotiation-kernel";
import type { NegotiationState, NegotiationBand } from "../../server-handlers/_negotiation-kernel";

const BAND: NegotiationBand = { initialOffer: 18, maxStretch: 24, walkAway: 14, hasEquity: false };

function mkAcceptedState(): NegotiationState {
  return {
    sessionId: "postverbal-renege-test",
    role: "Senior Product Designer",
    company: "acme",
    band: BAND,
    phase: "closing-push",
    turnIndex: 12,
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
    lastAiText: "Great — confirming 24 LPA all-in.",
    lastJoiningBonusOffered: 2,
    conversationLog: [],
    finalOfferAssertedCount: 0,
    vossTacticsUsed: [],
    infoAsked: [],
    verbalAcceptanceTurn: 11,
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

describe("applyCandidateAnswer — post-verbal clarification is not renegotiation", () => {
  it("info-only asks do not increment postVerbalRenegotiationCount", () => {
    const s1 = applyCandidateAnswer(
      mkAcceptedState(),
      "Can you explain the variable component breakdown again?",
    );
    const s2 = applyCandidateAnswer(
      s1,
      "And what's the joining date you had in mind?",
    );
    expect(s2.postVerbalRenegotiationCount).toBe(0);
    expect(s2.phase).not.toBe("walked-away");
  });
});
