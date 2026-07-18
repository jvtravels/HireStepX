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
    infoAskedInitiated: [],
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

/* OA-B69 (2026-07-18) — the post-accept reopen predicate now covers non-cash
 * lever asks, not just a fresh target number. A candidate who verbally
 * accepted and then asks for a higher base, a joining bonus, or relocation
 * assistance IS reopening the deal and must trip the renegotiation counter —
 * while info-only clarifications (BUG-5, locked above) still must not. */
describe("applyCandidateAnswer — post-verbal non-cash lever reopens (OA-B69)", () => {
  it("a post-accept joining-bonus ASK counts as renegotiation", () => {
    const s = applyCandidateAnswer(
      mkAcceptedState(),
      "Actually, can we add a joining bonus of 3 lakhs?",
    );
    expect(s.postVerbalRenegotiationCount).toBe(1);
  });

  it("a post-accept relocation-assistance request counts as renegotiation", () => {
    const s = applyCandidateAnswer(
      mkAcceptedState(),
      "One more thing — I'll need relocation assistance to move to Bangalore.",
    );
    expect(s.postVerbalRenegotiationCount).toBe(1);
  });

  it("a post-accept base-push counter counts as renegotiation", () => {
    const s = applyCandidateAnswer(
      mkAcceptedState(),
      "Can we push the fixed base to 22 LPA?",
    );
    expect(s.postVerbalRenegotiationCount).toBe(1);
  });

  it("info-only equity/notice clarification still does NOT count (BUG-5 preserved)", () => {
    // A vesting-schedule question and a notice-period clarification are
    // literacy/info asks, not new demands — they must never trip a reopen.
    const s1 = applyCandidateAnswer(
      mkAcceptedState(),
      "What's the vesting schedule and cliff on the equity?",
    );
    const s2 = applyCandidateAnswer(
      s1,
      "And remind me of the notice period expectation?",
    );
    expect(s2.postVerbalRenegotiationCount).toBe(0);
    expect(s2.phase).not.toBe("walked-away");
  });
});
