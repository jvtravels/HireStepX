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

describe("validateMoveSpecRestyle — decimal-collision discipline (2026-06-15 HIGH)", () => {
  /* The int/decimal tolerance must NOT round a fractional figure. Indian
   * salaries are quoted in fractional lakhs (₹20.4L), and a restyle that
   * rounds "20.4" → "20" is a real number change the candidate would
   * notice — it must be caught, not waved through as "close enough". The
   * spec arg is unused by the two numeric checks, so an empty object is
   * sufficient to exercise them. */
  const spec = {} as unknown as Parameters<typeof validateMoveSpecRestyle>[0];

  it("REJECTS a fractional figure rounded down (20.4 → 20)", () => {
    const canonical = "I can move to ₹20.4L total, with ₹3.6L variable.";
    const rounded = "I can move to ₹20L total, with ₹3.6L variable.";
    const result = validateMoveSpecRestyle(spec, canonical, rounded);
    expect(result.valid).toBe(false);
    /* "20" is not authorized for a canonical "20.4", so the new-number
     * check fires first; either way the rounding is rejected. */
    expect(result.reason).toBe("unauthorized-number");
  });

  it("REJECTS dropping a fractional figure entirely (no truncation alias)", () => {
    const canonical = "Base ₹20.4L, variable ₹3.6L.";
    const dropped = "Base is set, variable ₹3.6L.";
    const result = validateMoveSpecRestyle(spec, canonical, dropped);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("dropped-number");
    expect(result.detail).toContain("20.4");
  });

  it("STILL tolerates the genuine int↔.0 restyle (20 ↔ 20.0)", () => {
    const canonical = "We're at ₹20L total.";
    expect(validateMoveSpecRestyle(spec, canonical, "We're at ₹20.0L total.").valid).toBe(true);
    const canonicalDot = "We're at ₹20.0L total.";
    expect(validateMoveSpecRestyle(spec, canonicalDot, "We're at ₹20L total.").valid).toBe(true);
  });

  it("accepts an exact fractional match (20.4 survives as 20.4)", () => {
    const canonical = "Base ₹20.4L, variable ₹3.6L.";
    const faithful = "₹20.4L base and ₹3.6L variable.";
    expect(validateMoveSpecRestyle(spec, canonical, faithful).valid).toBe(true);
  });
});
