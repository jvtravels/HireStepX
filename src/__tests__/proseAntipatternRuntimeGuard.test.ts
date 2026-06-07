/* PROSE-LINT-1 RUNTIME guard (2026-06-08) — validateRestyle rejection.
 *
 * The same prose detectors used by the eval rubric also run inside the
 * response pipeline's validateRestyle. If the LLM produces meta-
 * narration, template filler, or generic advice, the restyle is
 * rejected with reason `prose-antipattern-leak` and the canonical line
 * is used instead. This file pins both halves: leak rejected, clean
 * restyle accepted.
 *
 * Why: catching it at eval-time is necessary but not sufficient — eval
 * runs on PRs, not on every user session. The runtime guard means a
 * regression in the LLM behavior doesn't reach the candidate.
 */
import { describe, it, expect } from "vitest";
import { validateRestyle } from "../../server-handlers/_response-pipeline";
import type {
  NegotiationState,
  NegotiationBand,
} from "../../server-handlers/_negotiation-kernel";

const BAND: NegotiationBand = {
  initialOffer: 18,
  maxStretch: 24,
  walkAway: 14,
  hasEquity: false,
};

function mkState(): NegotiationState {
  return {
    sessionId: "prose-runtime-test",
    role: "Software Engineer",
    company: "infosys",
    band: BAND,
    phase: "opening",
    turnIndex: 1,
    maxTurns: 16,
    candidateTarget: null,
    lastCandidateCounterLpa: null,
    firstAnchoredTarget: null,
    candidateCurrentCtc: null,
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
    candidateTotalYoe: null,
    candidateApplicableYoe: null,
    candidatePrimaryDomain: null,
    freshGradDisclosed: false,
    recruiterFactsAlreadySaid: [],
    anchorLocked: false,
    lockedAnchorLpa: null,
    promptInjectionAttempts: [],
  } as NegotiationState;
}

describe("validateRestyle — PROSE-LINT-1 runtime guard", () => {
  const canonical = "What's your current total CTC at this company?";

  it("meta-narration → prose-antipattern-leak", () => {
    const r = validateRestyle(
      canonical,
      "As your interview practice partner, I'd ask: what's your current total CTC?",
      mkState(),
    );
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("prose-antipattern-leak");
  });

  it("template filler → prose-antipattern-leak", () => {
    const r = validateRestyle(
      canonical,
      "I understand that this is an important decision for you. What's your current CTC?",
      mkState(),
    );
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("prose-antipattern-leak");
  });

  it("generic advice → prose-antipattern-leak", () => {
    const r = validateRestyle(
      canonical,
      "Always negotiate your worth. So — what's your current CTC?",
      mkState(),
    );
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("prose-antipattern-leak");
  });

  it("clean restyle (real recruiter phrasing) → valid", () => {
    const r = validateRestyle(
      canonical,
      "What's your current total CTC at this company?",
      mkState(),
    );
    expect(r.valid).toBe(true);
  });

  it("clean restyle that mentions 'appreciate' and 'share' (vocab overlap) → valid", () => {
    /* These verbs overlap with TEMPLATE_FILLER_RE's near-miss space.
     * They MUST be accepted — natural recruiter speech. */
    const r = validateRestyle(
      canonical,
      "Appreciate you sharing the offer details. What's your current CTC?",
      mkState(),
    );
    expect(r.valid).toBe(true);
  });
});
