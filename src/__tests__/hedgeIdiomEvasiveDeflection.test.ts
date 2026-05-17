/* PDF#27 Fix 4 (2026-05-17) — hedge / idiom / evasive-deflection
 * extensions for validateRestyle.
 *
 * Adds:
 *   - HEDGE_FILLER_RE: we're aligned, from our side, on our side.
 *   - BANNED_RECRUITER_IDIOM: remuneration (use "package" / "compensation").
 *   - new EVASIVE_DEFLECTION_RE rejection: "I'd be happy to share...",
 *     "I'd like to clarify..." — politeness-filler stalling in place
 *     of an honest defer or a band-anchor.
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
    sessionId: "fix4-test",
    role: "Software Engineer",
    company: "infosys",
    band: BAND,
    phase: "opening",
    turnIndex: 2,
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

describe("PDF#27 Fix 4 — hedge regex extension", () => {
  const canonical = "What's your current total CTC?";

  it("'from our side' leak → internal-hedge-leak", () => {
    const r = validateRestyle(
      canonical,
      "From our side, we'd like to confirm the current total CTC.",
      mkState(),
    );
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("internal-hedge-leak");
  });

  it("'on our side' leak → internal-hedge-leak", () => {
    const r = validateRestyle(
      canonical,
      "Yes, on our side we're broadly looking at the total package.",
      mkState(),
    );
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("internal-hedge-leak");
  });

  it("\"we're aligned\" stand-alone leak → internal-hedge-leak", () => {
    const r = validateRestyle(
      canonical,
      "We're aligned on the structure — confirm the total CTC?",
      mkState(),
    );
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("internal-hedge-leak");
  });
});

describe("PDF#27 Fix 4 — 'remuneration' banned", () => {
  const canonical = "How is your current package structured?";

  it("'remuneration' anywhere in restyle → banned-idiom-leaked", () => {
    const r = validateRestyle(
      canonical,
      "We'd like to understand how your current remuneration is structured.",
      mkState(),
    );
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("banned-idiom-leaked");
  });

  it("'package'/'compensation' equivalents → valid", () => {
    const r = validateRestyle(
      canonical,
      "We'd like to understand how your current package is structured.",
      mkState(),
    );
    expect(r.valid).toBe(true);
  });
});

describe("PDF#27 Fix 4 — evasive-deflection", () => {
  const canonical = "Let me come back with a firmer number once the panel signs off.";

  it("\"I'd be happy to share...\" → evasive-deflection", () => {
    const r = validateRestyle(
      canonical,
      "I'd be happy to share the offer details once we align on a few items.",
      mkState(),
    );
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("evasive-deflection");
  });

  it("\"I'd like to clarify...\" → evasive-deflection", () => {
    const r = validateRestyle(
      canonical,
      "I'd like to clarify a couple of items before I share the offer.",
      mkState(),
    );
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("evasive-deflection");
  });
});
