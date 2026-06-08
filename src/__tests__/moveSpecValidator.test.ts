/* ARCH-C3a (2026-06-08) — typed slot validator tests.
 *
 * Verifies the four contracts on validateMoveSpecRestyle:
 *   - accepts a restyle that preserves every spec number
 *   - rejects a restyle that introduces a NEW number not in the spec
 *     (this is the session #55 BUG-W03-1 class — percentage inversion)
 *   - rejects a restyle that DROPS a number a containsNumber slot held
 *   - accepts a restyle that simply rephrases without touching numbers
 */
import { describe, it, expect } from "vitest";
import { validateMoveSpecRestyle } from "../../server-handlers/_move-spec-validator";
import {
  variableShareHighToMoveSpec,
  counterOfferToMoveSpec,
  renderMoveSpec,
  type MoveSpecHelpers,
} from "../../server-handlers/_move-spec";
import { clawbackForCompany } from "../../server-handlers/_joining-bonus-clawback";
import type {
  NegotiationState,
  NegotiationBand,
} from "../../server-handlers/_negotiation-kernel";
import type { NextAction } from "../../server-handlers/_next-action-planner";

const HELPERS: MoveSpecHelpers = {
  roundPersona: () => null,
  sectorPersona: () => "default",
  clawbackForCompany,
  sessionJitter: () => 0,
};

const BAND: NegotiationBand = {
  initialOffer: 18,
  maxStretch: 24,
  walkAway: 14,
  hasEquity: false,
};

function mkCounterState(): NegotiationState {
  return {
    sessionId: "validator-test",
    role: "Senior Product Designer",
    company: "acme",
    band: BAND,
    phase: "counter-offer",
    turnIndex: 8,
    maxTurns: 20,
    candidateTarget: 24,
    lastCandidateCounterLpa: 24,
    firstAnchoredTarget: 24,
    candidateCurrentCtc: 18,
    competingOffer: null,
    candidateComponentBreakdown: {} as never,
    candidateAskedAsRange: false,
    highestOfferMade: 20,
    leversUsed: ["counter-base"],
    lastAiText: "",
    lastJoiningBonusOffered: 2,
    conversationLog: [],
    finalOfferAssertedCount: 0,
    vossTacticsUsed: [],
    infoAsked: [],
    verbalAcceptanceTurn: null as unknown as number,
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
    lockedAnchorLpa: 20,
    promptInjectionAttempts: [],
  } as NegotiationState;
}

describe("validateMoveSpecRestyle — variable-share-high (session #55 BUG-W03-1 class)", () => {
  it("accepts a restyle that keeps the spec percentage", () => {
    const spec = variableShareHighToMoveSpec(
      {
        candidateBaseLpa: 8,
        candidateVariableLpa: 8,
        sessionId: "test-50",
        hasFired: () => false,
      },
      HELPERS,
    );
    expect(spec).not.toBeNull();
    const canonical = renderMoveSpec(spec!, HELPERS);
    const restyled = "A 50% variable share is on the higher end — happy to talk through it.";
    const result = validateMoveSpecRestyle(spec!, canonical, restyled);
    expect(result.valid).toBe(true);
  });

  it("REJECTS the percentage-inversion class (LLM emits 81% when spec says 50%)", () => {
    const spec = variableShareHighToMoveSpec(
      {
        candidateBaseLpa: 8,
        candidateVariableLpa: 8,
        sessionId: "test-50",
        hasFired: () => false,
      },
      HELPERS,
    );
    expect(spec).not.toBeNull();
    const canonical = renderMoveSpec(spec!, HELPERS);
    /* The exact session #55 failure mode: the LLM substituted the
     * complementary percentage (100 - 50 = 50 here; pretend it
     * inverted to 81 like the production bug). The slot validator
     * sees "81" — not in the canonical — and rejects. */
    const inverted = "An 81% variable share is on the higher end — happy to talk through it.";
    const result = validateMoveSpecRestyle(spec!, canonical, inverted);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("unauthorized-number");
    expect(result.detail).toContain("81");
  });

  it("REJECTS when the LLM drops the number entirely", () => {
    const spec = variableShareHighToMoveSpec(
      {
        candidateBaseLpa: 8,
        candidateVariableLpa: 8,
        sessionId: "test-50",
        hasFired: () => false,
      },
      HELPERS,
    );
    expect(spec).not.toBeNull();
    const canonical = renderMoveSpec(spec!, HELPERS);
    const noNumber = "That variable share is on the higher end — happy to talk through it.";
    const result = validateMoveSpecRestyle(spec!, canonical, noNumber);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("dropped-number");
  });
});

describe("validateMoveSpecRestyle — counter-offer numeric discipline", () => {
  it("accepts a faithful restyle of the counter-offer spec", () => {
    const action = {
      kind: "counter-offer",
      counterTotalLpa: 22,
      counterFixedLpa: null,
      candidateProposedBaseLpa: null,
    } as unknown as Extract<NextAction, { kind: "counter-offer" }>;
    const spec = counterOfferToMoveSpec(action, mkCounterState(), HELPERS);
    const canonical = renderMoveSpec(spec, HELPERS);
    /* Pass the canonical itself as the restyle — trivially faithful. */
    const result = validateMoveSpecRestyle(spec, canonical, canonical);
    expect(result.valid).toBe(true);
  });

  it("REJECTS a restyle that invents a number not in the spec", () => {
    const action = {
      kind: "counter-offer",
      counterTotalLpa: 22,
      counterFixedLpa: null,
      candidateProposedBaseLpa: null,
    } as unknown as Extract<NextAction, { kind: "counter-offer" }>;
    const spec = counterOfferToMoveSpec(action, mkCounterState(), HELPERS);
    const canonical = renderMoveSpec(spec, HELPERS);
    /* "37" is nowhere in the canonical — the LLM made it up. We splice
     * "37" into a near-canonical restyle so canonical numbers are still
     * present (otherwise dropped-number would fire first). */
    const hallucinated = `${canonical} Plus a ₹37L equity refresh in year two.`;
    const result = validateMoveSpecRestyle(spec, canonical, hallucinated);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("unauthorized-number");
    expect(result.detail).toContain("37");
  });
});
