/* BUG-001 — anchor must never ship below disclosed current CTC.
 * When disclosed >= maxStretch and the hike-floor would exceed maxStretch,
 * the function should defer/signal bandIncomplete rather than clamp to a
 * pay-cut anchor. Fails on main: returns 38 for disclosed=40, band={35,38}.
 */
import { describe, it, expect } from "vitest";
import { clampAnchorAboveDisclosed } from "../../server-handlers/_next-action-planner";
import type { NegotiationState, NegotiationBand } from "../../server-handlers/_negotiation-kernel";

const BAND: NegotiationBand = { initialOffer: 35, maxStretch: 38, walkAway: 30, hasEquity: false };

function mkState(disclosed: number): NegotiationState {
  return {
    sessionId: "anchor-clamp-test",
    role: "Associate Product Manager",
    company: "acme",
    band: BAND,
    phase: "opening",
    turnIndex: 4,
    maxTurns: 16,
    candidateTarget: 45,
    lastCandidateCounterLpa: null,
    firstAnchoredTarget: null,
    candidateCurrentCtc: disclosed,
    competingOffer: null,
    candidateComponentBreakdown: {} as never,
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
    candidateTotalYoe: 3,
    candidateApplicableYoe: 3,
    candidatePrimaryDomain: null,
    freshGradDisclosed: false,
    recruiterFactsAlreadySaid: [],
    anchorLocked: false,
    lockedAnchorLpa: null,
    promptInjectionAttempts: [],
  } as NegotiationState;
}

describe("clampAnchorAboveDisclosed — band ceiling below disclosed CTC", () => {
  it("returns null (defer) when disclosed=40 and band.maxStretch=38", () => {
    const result = clampAnchorAboveDisclosed(35, 38, mkState(40));
    // After AUDIT-W02 BUG-001 fix: returns null to signal defer rather
    // than a pay-cut anchor. Callers wrap as bandIncomplete=true.
    expect(result).toBeNull();
  });
});
