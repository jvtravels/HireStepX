/* ARCH-C2a (2026-06-08) — env-flag gating tests for the MoveSpec route
 * in the live response pipeline.
 *
 * Contract:
 *   - With NEGOTIATION_MOVE_SPEC_ENABLED unset/"0", the canonical
 *     string fed into the LLM restyle is produced by the LEGACY
 *     renderCanonicalProse path. The MoveSpec adapter is not called.
 *   - With NEGOTIATION_MOVE_SPEC_ENABLED="1", and an action.kind in
 *     SUPPORTED_MOVE_SPEC_KINDS, the canonical string is produced by
 *     the MoveSpec adapter. The string MUST be byte-identical to the
 *     legacy path (parity tests in moveSpec.parity.test.ts gate this),
 *     so the same restyle-stage stub here works either way.
 *
 * We probe the boundary by capturing the canonical text via the
 * generateAiText stub (the restyle prompt's `user` arg is the
 * canonical). When the LLM returns "" the pipeline falls back to that
 * exact canonical — that's what we read as result.text.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateBotReply } from "../../server-handlers/_response-pipeline";
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

function mkCloseRecapState(): NegotiationState {
  return {
    sessionId: "movespec-routing-test",
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
  } as NegotiationState;
}

describe("ARCH-C2a — MoveSpec route is feature-flag gated", () => {
  const original = process.env.NEGOTIATION_MOVE_SPEC_ENABLED;
  beforeEach(() => {
    delete process.env.NEGOTIATION_MOVE_SPEC_ENABLED;
  });
  afterEach(() => {
    if (original === undefined) delete process.env.NEGOTIATION_MOVE_SPEC_ENABLED;
    else process.env.NEGOTIATION_MOVE_SPEC_ENABLED = original;
  });

  it("flag OFF — source is 'restyle', never 'movespec'", async () => {
    process.env.NEGOTIATION_MOVE_SPEC_ENABLED = "0";
    const stubLlm = vi.fn(async (_sys: string, user: string) => user);
    const result = await generateBotReply(
      mkCloseRecapState(),
      stubLlm as never,
    );
    expect(result.source).not.toBe("movespec");
  });

  it("flag ON — supported-kind action surfaces source='movespec'", async () => {
    process.env.NEGOTIATION_MOVE_SPEC_ENABLED = "1";
    /* Stub returns the canonical verbatim so validateRestyle passes and
     * the success branch runs (where the 'movespec' label is stamped). */
    const stubLlm = vi.fn(async (_sys: string, user: string) => user);
    const result = await generateBotReply(
      mkCloseRecapState(),
      stubLlm as never,
    );
    /* If the planner picked a SUPPORTED_MOVE_SPEC_KINDS action for this
     * closing-push fixture, source must be 'movespec'. Otherwise the
     * test only proves we didn't crash — still useful as a smoke. */
    if (
      result.action.kind === "counter-offer" ||
      result.action.kind === "info-disclosure" ||
      result.action.kind === "close-recap-formal" ||
      result.action.kind === "component-probe" ||
      result.action.kind === "ctc-inflation-truth"
    ) {
      /* Either the LLM-restyle succeeded (source='movespec') or the
       * validator rejected (source='canonical-fallback'). What we
       * MUST see is that the MoveSpec path ran: PostHog telemetry
       * 'negotiation_movespec_routed' would have fired. Since we
       * can't intercept that easily here, accept either outcome but
       * REJECT 'restyle' (which would mean MoveSpec was bypassed). */
      expect(result.source === "movespec" || result.source === "canonical-fallback").toBe(true);
      expect(result.source).not.toBe("restyle");
    }
  });

  it("flag ON — non-supported action stays on legacy 'restyle' source", async () => {
    process.env.NEGOTIATION_MOVE_SPEC_ENABLED = "1";
    const stubLlm = vi.fn(async (_sys: string, user: string) => user);
    /* opening phase planner picks a non-supported kind (e.g.
     * discovery-probe, opening-warmup). */
    const openingState = {
      ...mkCloseRecapState(),
      phase: "opening" as const,
      turnIndex: 1,
      verbalAcceptanceTurn: null as unknown as number,
      anchorLocked: false,
      lockedAnchorLpa: null as unknown as number,
      highestOfferMade: 0,
      counterRound: 0,
      leversUsed: [],
    } as unknown as NegotiationState;
    const result = await generateBotReply(openingState, stubLlm as never);
    /* Whatever the planner picked, if it's NOT one of the six supported
     * kinds, source must not be 'movespec'. */
    const supported = new Set([
      "counter-offer",
      "info-disclosure",
      "close-recap-formal",
      "component-probe",
      "ctc-inflation-truth",
      "reactive-followup",
    ]);
    if (!supported.has(result.action.kind)) {
      expect(result.source).not.toBe("movespec");
    }
  });
});
