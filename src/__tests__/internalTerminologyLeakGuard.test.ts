/* PDF#27 Fix 1 (2026-05-17) — internal-terminology / defer-leak /
 * invented-jargon validator guards.
 *
 * PDF#27 captured three classes of leak in the same session:
 *   - T6 LEAK: "I cannot provide the total CTC offered as that
 *     information is missing from the fact pack."
 *   - T5 HALLUCINATION: "...considering the current market mode as hot..."
 *   - (variants) "next action", "kernel state", "lever" etc.
 *
 * Each is the LLM exposing kernel-internal vocabulary that no real
 * recruiter would use. The fix is three new validator rejections that
 * fire BEFORE the global checks so the named reason lands on the
 * primary failure mode rather than masking under a downstream gate.
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
    sessionId: "leak-test",
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

describe("validateRestyle — PDF#27 Fix 1: internal-terminology leak", () => {
  const canonical = "What's the total CTC offered at your current company?";

  it("T6 LEAK fixture: 'missing from the fact pack' → internal-defer-leak", () => {
    const r = validateRestyle(
      canonical,
      "I cannot provide the total CTC offered as that information is missing from the fact pack.",
      mkState(),
    );
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("internal-defer-leak");
  });

  it("T5 HALLUCINATION fixture: 'market mode as hot' → invented-market-jargon", () => {
    const r = validateRestyle(
      canonical,
      "Considering the current market mode as hot, we'd like to anchor around 22 LPA.",
      mkState(),
    );
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("invented-market-jargon");
  });

  it("bare 'market mode' phrase → invented-market-jargon", () => {
    const r = validateRestyle(
      canonical,
      "Given the market mode this quarter, we can stretch a bit.",
      mkState(),
    );
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("invented-market-jargon");
  });

  it("'next action' / 'lever' / 'kernel' leaks → internal-terminology-leak", () => {
    const cases = [
      "The next action for this lever is to confirm your current package.",
      "Based on the kernel state, I'll come back with a number.",
      "Please confirm the asked topic so I can fold facts.",
      "Per state.candidateCurrentCtc the offer stands.",
    ];
    for (const restyled of cases) {
      const r = validateRestyle(canonical, restyled, mkState());
      expect(r.valid).toBe(false);
      expect(r.reason).toBe("internal-terminology-leak");
    }
  });

  it("clean restyle (no internal vocabulary) → valid", () => {
    const r = validateRestyle(
      canonical,
      "What's your current total CTC at this company?",
      mkState(),
    );
    expect(r.valid).toBe(true);
  });
});
