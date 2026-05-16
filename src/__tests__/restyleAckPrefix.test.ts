/* PDF#24 follow-up (2026-05-16) — restyle ack-prefix preservation.
 *
 * Bug 2's fix (commit 3ae6b47) prepends a one-line acknowledgement of the
 * candidate's prior disclosure to every discovery probe. The restyle prompt
 * asks the LLM to keep that gesture, but the validator wasn't enforcing it
 * — and the prompt explicitly permits "opening phrase" changes. So a
 * regression where the LLM stripped the ack and reverted to the cold,
 * transactional probe was structurally possible until this rule landed. */
import { describe, it, expect } from "vitest";
import { validateRestyle } from "../../server-handlers/_response-pipeline";
import type {
  NegotiationState,
  NegotiationBand,
} from "../../server-handlers/_negotiation-kernel";
import type { NextAction } from "../../server-handlers/_next-action-planner";

const BAND: NegotiationBand = {
  initialOffer: 18,
  maxStretch: 24,
  walkAway: 14,
  hasEquity: false,
};

function mkState(): NegotiationState {
  /* F7 (Audit Pass 2, 2026-05-16) — canonical lines used in this file
   * preface a discovery probe with an ack referencing the candidate's
   * expected fitment ("Noted on the expected fitment …"). Under F7 those
   * acks REQUIRE state.candidateTarget to be non-null; without that the
   * restyle's "noted on the expected side" leak is correctly rejected as
   * ack-without-disclosure. Seed the expected-side state to match. */
  return {
    sessionId: "ack-test",
    role: "Software Engineer",
    company: "infosys",
    band: BAND,
    phase: "opening",
    turnIndex: 1,
    maxTurns: 16,
    candidateTarget: 30,
    lastCandidateCounterLpa: null,
    firstAnchoredTarget: 30,
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
  } as NegotiationState;
}

describe("validateRestyle — ack-prefix preservation (PDF#24 follow-up)", () => {
  const canonical =
    "Noted on the expected fitment — what's the notice period at your current company? Any scope for buyout there?";

  it("restyle that keeps the 'noted' ack → valid", () => {
    const r = validateRestyle(
      canonical,
      "Noted on the expected side. What's the notice period at your current company, and is there scope for buyout?",
      mkState(),
    );
    expect(r.valid).toBe(true);
  });

  it("restyle that swaps to a near-equivalent ack ('right, on the X side') → valid", () => {
    const r = validateRestyle(
      canonical,
      "Right, on the expected side — what's the notice period currently, and any room for buyout?",
      mkState(),
    );
    expect(r.valid).toBe(true);
  });

  it("restyle that swaps to 'thanks for that' → valid", () => {
    const r = validateRestyle(
      canonical,
      "Thanks for that on the expected side. What's the notice period at present, and any buyout scope?",
      mkState(),
    );
    expect(r.valid).toBe(true);
  });

  it("restyle that strips the ack entirely → reject", () => {
    const r = validateRestyle(
      canonical,
      "What's the notice period at your current company? Any scope for buyout?",
      mkState(),
    );
    expect(r.valid).toBe(false);
    if (!r.valid) {
      expect(r.reason).toBe("ack-prefix-stripped");
    }
  });

  it("canonical without ack (turn-0 opener) → no ack required in restyle", () => {
    const turnZeroCanonical =
      "Thanks for making the time. Let's get straight into it — walk me through your current compensation structure first.";
    const r = validateRestyle(
      turnZeroCanonical,
      "Appreciate you making the time. Let's get into it — walk me through your current comp structure first.",
      mkState(),
    );
    /* "Appreciate" is in the ack vocab so this would pass either way; the
     * key assertion is that an ack-vocab-free turn-0 canonical doesn't
     * require an ack in the restyle. Use a vocab-free restyle here. */
    expect(r.valid).toBe(true);

    const r2 = validateRestyle(
      turnZeroCanonical,
      "Welcome — let's get into it. Walk me through your current comp structure first.",
      mkState(),
    );
    expect(r2.valid).toBe(true);
  });
});

describe("validateRestyle — sentiment-prefix preservation (defect 6)", () => {
  /* Canonical lines that begin with a renderSentimentPrefix anchor.
   * The probe body is intentionally vocab-free so the rejection is
   * unambiguously the sentiment strip and not a stripped ack. */
  it("strips 'I hear you' empathy lead → reject with sentiment-prefix-stripped", () => {
    const canonical =
      "I hear you — and I want to be straight with you here. Let's stay on the structure side; what's the notice period right now?";
    const r = validateRestyle(
      canonical,
      "Let's stay on the structure side; what's the notice period right now?",
      mkState(),
    );
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe("sentiment-prefix-stripped");
  });

  it("rephrases to 'I get where you're coming from' near-equivalent → valid", () => {
    const canonical =
      "I hear you — and I want to be straight with you here. Let's stay on the structure side; what's the notice period right now?";
    const r = validateRestyle(
      canonical,
      "I get where you're coming from. Let's stay on the structure side; what's the notice period right now?",
      mkState(),
    );
    expect(r.valid).toBe(true);
  });

  it("'Take your time' hesitant-sentiment lead is preserved with 'no rush' → valid", () => {
    const canonical =
      "Take your time on this — let's go back to the fitment side. What's the proposed joining date you're working towards?";
    const r = validateRestyle(
      canonical,
      "No rush. Let's go back to the fitment side. What's the proposed joining date you're working towards?",
      mkState(),
    );
    expect(r.valid).toBe(true);
  });
});

describe("validateRestyle — close-recap-formal completeness (defect 6)", () => {
  const recapCanonical =
    "Let me recap the fitment before I revert internally — Fixed ₹18L, variable target ₹3L, notice 8 weeks, BGV starts on offer letter signature, offer letter in 5 business days. Sounds good?";
  const recapAction: NextAction = {
    kind: "close-recap-formal",
    fixedLpa: 18,
    variableLpa: 3,
    noticePeriodWeeks: 8,
    bgvStartTrigger: "on offer letter signature",
    offerLetterEta: "5 business days",
  } as NextAction;

  it("restyle missing 'BGV' → reject with close-recap-incomplete", () => {
    const r = validateRestyle(
      recapCanonical,
      "Let me recap the fitment before I revert internally — Fixed ₹18L, variable target ₹3L, notice 8 weeks, offer letter in 5 business days. Sounds good?",
      mkState(),
      recapAction,
    );
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe("close-recap-incomplete");
  });

  it("restyle missing 'variable' → reject with close-recap-incomplete", () => {
    const r = validateRestyle(
      recapCanonical,
      "Recap — Fixed ₹18L plus a target component of ₹3L, notice 8 weeks, BGV starts on offer letter signature, offer letter in 5 business days. Sounds good?",
      mkState(),
      recapAction,
    );
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe("close-recap-incomplete");
  });

  it("restyle preserves all four required terms → valid", () => {
    const r = validateRestyle(
      recapCanonical,
      "Let me recap before I revert — Fixed ₹18L, variable target ₹3L, notice 8 weeks, BGV starts on offer-letter signature, offer letter in 5 business days. Sounds good?",
      mkState(),
      recapAction,
    );
    expect(r.valid).toBe(true);
  });
});

describe("validateRestyle — banned-idiom rejection (defect 2 verification)", () => {
  it("'circle back' leakage → reject with banned-idiom-leaked", () => {
    const canonical =
      "Noted on the expected fitment — what's the notice period at your current company? Any scope for buyout there?";
    const r = validateRestyle(
      canonical,
      "Noted on the expected side — let me circle back on notice period once I check with my team.",
      mkState(),
    );
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe("banned-idiom-leaked");
  });
});
