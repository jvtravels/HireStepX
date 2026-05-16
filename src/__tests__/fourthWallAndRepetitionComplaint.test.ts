/* PDF#27 Fix 2 (2026-05-17) — fourth-wall break + repetition complaint.
 *
 * Two-pronged fix:
 *   - validator: reject restyles that meta-comment on asking ("I'm not
 *     repeating", "the question I asked", "as an AI"). Reason
 *     `fourth-wall-break`. PDF#27 T4 fixture is the canonical example.
 *   - planner: when applyCandidateAnswer detects a repetition complaint
 *     in the candidate utterance, stamp `state.repetitionComplaintAt
 *     Turn`. The planner's buildSkipRecord then force-advances past
 *     the most-recently-asked topic on the next planner call.
 */
import { describe, it, expect } from "vitest";
import { validateRestyle } from "../../server-handlers/_response-pipeline";
import {
  applyCandidateAnswer,
  type NegotiationState,
  type NegotiationBand,
} from "../../server-handlers/_negotiation-kernel";

const BAND: NegotiationBand = {
  initialOffer: 18,
  maxStretch: 24,
  walkAway: 14,
  hasEquity: false,
};

function mkState(): NegotiationState {
  return {
    sessionId: "fwb-test",
    role: "Software Engineer",
    company: "infosys",
    band: BAND,
    phase: "opening",
    turnIndex: 3,
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
    lastAiText: "What's the fixed/variable split of your current package?",
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
  } as NegotiationState;
}

describe("PDF#27 Fix 2 — fourth-wall break validator", () => {
  const canonical = "How is your current package split between fixed and variable?";

  it("T4 fixture: 'No, I'm not repeating the question.' → fourth-wall-break", () => {
    const r = validateRestyle(
      canonical,
      "No, I'm not repeating the question. Just clarifying the split.",
      mkState(),
    );
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("fourth-wall-break");
  });

  it("'I am not repeating' (no contraction) → fourth-wall-break", () => {
    const r = validateRestyle(
      canonical,
      "I am not repeating myself — let's confirm the split.",
      mkState(),
    );
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("fourth-wall-break");
  });

  it("'as an AI' meta-comment → fourth-wall-break", () => {
    const r = validateRestyle(
      canonical,
      "As an AI recruiter, I just want to confirm the fixed vs variable.",
      mkState(),
    );
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("fourth-wall-break");
  });

  it("'the question I asked' fourth-wall reference → fourth-wall-break", () => {
    const r = validateRestyle(
      canonical,
      "Going back to the question I asked earlier about the split.",
      mkState(),
    );
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("fourth-wall-break");
  });

  it("clean restyle without meta-commentary → valid", () => {
    const r = validateRestyle(
      canonical,
      "What's the fixed-vs-variable split on your current package?",
      mkState(),
    );
    expect(r.valid).toBe(true);
  });
});

describe("PDF#27 Fix 2 — applyCandidateAnswer detects repetition complaint", () => {
  it("'stop repeating the same question' → stamps repetitionComplaintAtTurn", () => {
    const s = mkState();
    const next = applyCandidateAnswer(s, "Stop repeating the same question, I already answered.");
    expect(next.repetitionComplaintAtTurn).toBe(s.turnIndex);
  });

  it("'I already answered that' → stamps repetitionComplaintAtTurn", () => {
    const s = mkState();
    const next = applyCandidateAnswer(s, "I already answered that before.");
    expect(next.repetitionComplaintAtTurn).toBe(s.turnIndex);
  });

  it("benign answer → repetitionComplaintAtTurn remains null", () => {
    const s = mkState();
    const next = applyCandidateAnswer(s, "Sure, the split is 12 fixed and 3 variable.");
    expect(next.repetitionComplaintAtTurn ?? null).toBeNull();
  });
});
