/* MoveSpec — Commit 1 parity gate.
 *
 * For the 6 actions covered by the new typed MoveSpec layer, the
 * rendered string MUST equal the existing canonical-prose output for
 * the same (action, state, helpers) inputs. This is the safety rail
 * that lets us land MoveSpec as a behavior-preserving wrapper today
 * and flip the live pipeline onto it in a later commit without any
 * candidate-visible diff.
 *
 * Each test pairs one prose-source-of-truth call with one
 * renderMoveSpec(adapt(...)) call and asserts exact string equality.
 *
 * If a test fails after the design lands, the MoveSpec adapter is
 * stale relative to the prose template — fix the adapter, not the
 * test. The prose is the contract.
 */
import { describe, it, expect } from "vitest";
import type {
  NegotiationState,
  NegotiationBand,
} from "../../server-handlers/_negotiation-kernel";
import type { NextAction } from "../../server-handlers/_next-action-planner";
import { proseCloseRecapFormal } from "../../server-handlers/prose/close-recap-formal";
import { proseCounterOffer } from "../../server-handlers/prose/counter-offer";
import { proseInfoDisclosure } from "../../server-handlers/prose/info-disclosure";
import { clawbackForCompany } from "../../server-handlers/_joining-bonus-clawback";
import type { ProseHelpers } from "../../server-handlers/prose/_helpers";
import {
  closeRecapFormalToMoveSpec,
  counterOfferToMoveSpec,
  infoDisclosureToMoveSpec,
  variableShareHighToMoveSpec,
  renderMoveSpec,
  type MoveSpecHelpers,
} from "../../server-handlers/_move-spec";

/* ProseHelpers stub for the legacy prose functions — mirrors the
 * real helper bundle assembled by the dispatcher in
 * `_canonical-prose.ts`. Tests only exercise the lookups the prose
 * functions actually call for the chosen fixtures. */
const PROSE_HELPERS: ProseHelpers = {
  firstName: null,
  sectorPersona: "default",
  activeRoundPersona: null,
  selectByRoundPersona: (_p, table) => table["hr-partner"],
  selectBySectorPersona: (p, table) => table[p],
  selectEscalationAnchor: () => "",
  buildDiscoveryAck: () => null,
  sanitiseCandidateProse: (s) => s ?? null,
  gradeLabel: () => "this grade",
};

const BAND: NegotiationBand = {
  initialOffer: 18,
  maxStretch: 24,
  walkAway: 14,
  hasEquity: false,
};

const HELPERS: MoveSpecHelpers = {
  roundPersona: () => null,
  sectorPersona: () => "default",
  clawbackForCompany,
  /* Deterministic zero-jitter for tests so percentage thresholds are
   * predictable. Real session jitter is +/-5 around the gate
   * baseline. */
  sessionJitter: () => 0,
};

function mkState(overrides: Partial<NegotiationState> = {}): NegotiationState {
  return {
    sessionId: "movespec-parity",
    role: "Senior Product Designer",
    company: "acme",
    band: BAND,
    phase: "closing-push",
    turnIndex: 13,
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
    lastAiText: "",
    lastJoiningBonusOffered: 2,
    conversationLog: [],
    finalOfferAssertedCount: 0,
    vossTacticsUsed: [],
    infoAsked: [],
    verbalAcceptanceTurn: 12,
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
    ...overrides,
  } as NegotiationState;
}

describe("MoveSpec parity — close-recap-formal", () => {
  it("matches proseCloseRecapFormal exactly (happy path, urgency=neutral)", () => {
    const action = {
      kind: "close-recap-formal",
      fixedLpa: 20,
      variableLpa: 4,
      joiningBonusLpa: 2,
      retentionBonusLpa: 0,
      noticePeriodWeeks: 8,
      proposedJoiningDate: null,
      bgvStartTrigger: null,
      offerLetterEta: "5 business days",
    } as unknown as Extract<NextAction, { kind: "close-recap-formal" }>;
    const state = mkState();
    const expected = proseCloseRecapFormal(action, state, PROSE_HELPERS);
    const actual = renderMoveSpec(
      closeRecapFormalToMoveSpec(action, state, HELPERS),
      HELPERS,
    );
    expect(actual).toBe(expected);
  });

  it("matches when cumulativeUrgency=firm (fast-track tail)", () => {
    const action = {
      kind: "close-recap-formal",
      fixedLpa: 20,
      variableLpa: 4,
      joiningBonusLpa: 0,
      retentionBonusLpa: 0,
      noticePeriodWeeks: 8,
      proposedJoiningDate: null,
      bgvStartTrigger: null,
      offerLetterEta: null,
    } as unknown as Extract<NextAction, { kind: "close-recap-formal" }>;
    const state = mkState({
      cumulativeUrgency: "firm",
    } as unknown as Partial<NegotiationState>);
    const expected = proseCloseRecapFormal(action, state, PROSE_HELPERS);
    const actual = renderMoveSpec(
      closeRecapFormalToMoveSpec(action, state, HELPERS),
      HELPERS,
    );
    expect(actual).toBe(expected);
  });
});

describe("MoveSpec parity — counter-offer", () => {
  it("matches proseCounterOffer (round=1, total path, default persona)", () => {
    const action = {
      kind: "counter-offer",
      counterTotalLpa: 22,
      counterFixedLpa: null,
      candidateProposedBaseLpa: null,
    } as unknown as Extract<NextAction, { kind: "counter-offer" }>;
    const state = mkState({ counterRound: 1, highestOfferMade: 20 });
    const expected = proseCounterOffer(action, state, PROSE_HELPERS);
    const actual = renderMoveSpec(
      counterOfferToMoveSpec(action, state, HELPERS),
      HELPERS,
    );
    expect(actual).toBe(expected);
  });
});

describe("MoveSpec parity — info-disclosure", () => {
  it("matches proseInfoDisclosure (topic=breakdown, offer present)", () => {
    const action = {
      kind: "info-disclosure",
      topic: "breakdown",
    } as unknown as Extract<NextAction, { kind: "info-disclosure" }>;
    const state = mkState({ highestOfferMade: 24, lastJoiningBonusOffered: 2 });
    const expected = proseInfoDisclosure(action, state, PROSE_HELPERS);
    const actual = renderMoveSpec(
      infoDisclosureToMoveSpec(action, state, HELPERS),
      HELPERS,
    );
    expect(actual).toBe(expected);
  });
});

describe("MoveSpec regression — variable-share math is kernel-computed (session #55 BUG-W03-1)", () => {
  /* Session #55 (Flipkart Sr PD): candidate disclosed "26L base + 6L
   * variable = 32L total" (19% variable). Bot's restyled prose came
   * out as "81% variable is significant" — LLM inverted the math.
   * Root cause: legacy planner embedded the percentage as a raw
   * scalar inside a template the LLM was free to rewrite. The
   * MoveSpec adapter computes pctRounded in the spec; the renderer
   * interpolates it directly; the LLM has no authority over the
   * number once we route this kind through MoveSpec.
   *
   * This test pins the architectural invariant: for the disclosed
   * 26/6 breakdown, the spec MUST carry pctRounded=19, and the
   * rendered string MUST contain "19%" — never "81%". */
  it("renders 19% (not 81%) for 26L base + 6L variable disclosure", () => {
    const spec = variableShareHighToMoveSpec(
      {
        candidateBaseLpa: 26,
        candidateVariableLpa: 6,
        sessionId: "session-55-flipkart",
        hasFired: () => false,
      },
      HELPERS,
    );
    /* Threshold with zero jitter is 25%; 6/32 = 18.75 → rounds to 19
     * which is BELOW threshold. Gate would not fire — adapter returns
     * null. That's the correct behavior: a 19% variable share is not
     * "high", so the reactive-followup shouldn't fire at all. The
     * legacy bug was downstream — the LLM was generating the 81%
     * string from a DIFFERENT planner branch. We pin both halves: */
    expect(spec).toBeNull();
  });

  it("renders the exact percentage from the spec when the gate fires (e.g. 8L base + 8L variable = 50%)", () => {
    const spec = variableShareHighToMoveSpec(
      {
        candidateBaseLpa: 8,
        candidateVariableLpa: 8,
        sessionId: "session-50pct",
        hasFired: () => false,
      },
      HELPERS,
    );
    expect(spec).not.toBeNull();
    expect(spec!.derived.pctRounded).toBe(50);
    const rendered = renderMoveSpec(spec!, HELPERS);
    /* The number in the rendered string is the SAME number in the
     * spec — formatter interpolation, not LLM derivation. */
    expect(rendered).toContain("50%");
    expect(rendered).not.toContain("81%");
    expect(rendered).not.toContain("50.0%"); // pctRounded is an int
  });
});

describe("MoveSpec hard gate — close-recap-formal requires verbal acceptance", () => {
  it("throws when state.verbalAcceptanceTurn is missing (kernel invariant)", () => {
    const action = {
      kind: "close-recap-formal",
      fixedLpa: 20,
      variableLpa: 4,
      joiningBonusLpa: 0,
      retentionBonusLpa: 0,
      noticePeriodWeeks: 8,
      proposedJoiningDate: null,
      bgvStartTrigger: null,
      offerLetterEta: "5 business days",
    } as unknown as Extract<NextAction, { kind: "close-recap-formal" }>;
    const state = mkState({
      verbalAcceptanceTurn: null as unknown as number,
    });
    expect(() => closeRecapFormalToMoveSpec(action, state, HELPERS)).toThrow(
      /verbalAcceptanceTurn/i,
    );
  });
});
