/* AUDIT-4 live-integration test (2026-06-08).
 *
 * Drives the FULL generateBotReply path with a stub LLM that produces
 * the exact Flipkart Sr PD dodge ("Our offer is competitive and based
 * on your experience"). Asserts the rail intercepts it before the
 * candidate sees it. State shape mirrors proseAntipatternRuntimeGuard
 * (the most complete real-state fixture in the repo).
 */

import { describe, it, expect } from "vitest";
import {
  generateBotReply,
  type GenerateAiTextFn,
} from "../../../server-handlers/_response-pipeline";
import type {
  NegotiationState,
  NegotiationBand,
} from "../../../server-handlers/_negotiation-kernel";

const BAND: NegotiationBand = {
  initialOffer: 30,
  maxStretch: 35,
  walkAway: 25,
  hasEquity: true,
};

function flipkartOverBandState(): NegotiationState {
  return {
    sessionId: "live-integration-flipkart-overband",
    role: "Senior Product Designer",
    company: "Flipkart",
    band: BAND,
    phase: "probe-expectations",
    turnIndex: 7,
    maxTurns: 16,
    candidateTarget: 50,
    lastCandidateCounterLpa: null,
    firstAnchoredTarget: null,
    candidateCurrentCtc: 40, // ABOVE the 35L stretch — Flipkart case
    competingOffer: null,
    candidateComponentBreakdown: { fixed: 32, variable: 8 } as never,
    candidateAskedAsRange: false,
    highestOfferMade: 0,
    leversUsed: ["probe", "probe", "probe"],
    lastAiText: "And what fitment are you looking at for this move?",
    lastJoiningBonusOffered: null,
    conversationLog: [
      { speaker: "ai", text: "Tell me about your current package." },
      { speaker: "candidate", text: "40L total — 32L fixed, 8L variable, no ESOP." },
      { speaker: "ai", text: "And what fitment for the move?" },
      { speaker: "candidate", text: "Looking at 50L total." },
    ],
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
    candidateTotalYoe: 8,
    candidateApplicableYoe: 8,
    candidatePrimaryDomain: null,
    freshGradDisclosed: false,
    recruiterFactsAlreadySaid: [],
    anchorLocked: false,
    lockedAnchorLpa: null,
    promptInjectionAttempts: [],
  } as NegotiationState;
}

/** Stub LLM that always returns the Flipkart-style dodge. */
const dodgeLlm: GenerateAiTextFn = async () =>
  "Our offer is competitive and based on your experience and the role's requirements.";

/** Stub LLM that produces a clean, on-topic restyle (no number expected
 *  because the candidate didn't ask for one). */
const benignLlm: GenerateAiTextFn = async () =>
  "Got it on the 40L total. What's your notice period at the current company?";

describe("Output rail — live integration with full pipeline", () => {
  it("intercepts the Flipkart 'competitive' dodge when candidate explicitly asks for the offer", async () => {
    const state = flipkartOverBandState();
    const result = await generateBotReply(state, dodgeLlm, "what's your offer for the role?");

    // Hard requirement: the fluff must NOT reach the candidate.
    expect(result.text).not.toMatch(/competitive and based on your experience/i);

    // The substitute must contain a number or an honest ceiling.
    const hasNumber = /\b\d{1,3}(?:\.\d+)?\s*(?:L|LPA|lakh)\b/i.test(result.text);
    const hasCeiling =
      /\b(?:above\s+where|cannot\s+(?:stretch|go)|caps?\s+(?:around|at)|stretch\s+on)\b/i.test(
        result.text,
      );
    expect(hasNumber || hasCeiling, `text must contain a number or ceiling: ${result.text}`).toBe(true);
  });

  it("does NOT intercept when candidate did not ask for a number", async () => {
    const state = flipkartOverBandState();
    const result = await generateBotReply(
      state,
      benignLlm,
      "my current is 40L, looking at 50L for the move",
    );
    // Rail-blocked rejections are namespaced `offer-ask-rail:`.
    expect(result.rejectReason ?? "").not.toMatch(/^offer-ask-rail:/);
  });
});
