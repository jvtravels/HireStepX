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

const BAND: NegotiationBand = {
  initialOffer: 18,
  maxStretch: 24,
  walkAway: 14,
  hasEquity: false,
};

function mkState(): NegotiationState {
  return {
    sessionId: "ack-test",
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
