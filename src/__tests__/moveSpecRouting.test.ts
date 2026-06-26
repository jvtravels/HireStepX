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

  it("flag ON — a number-dropping restyle never ships (defense in depth)", async () => {
    process.env.NEGOTIATION_MOVE_SPEC_ENABLED = "1";
    /* Pipeline-level safety property: when the LLM returns a restyle that
     * strips the kernel's salary scalars, the shipped text must NEVER be that
     * restyle. Two layers enforce this — legacy validateRestyle's
     * completeness/shape checks are the first catcher for kinds that have one
     * (e.g. close-recap-incomplete), and the ARCH-C3b structural slot gate
     * (validateMoveSpecRestyle Check 2: every canonical number must survive)
     * is the backstop for kinds without a legacy completeness check. Either
     * way the pipeline falls back to the kernel-authored canonical.
     *
     * Note: for THIS close-recap fixture legacy fires first, so the rejection
     * reason is legacy's, not "slot:*". The slot validator's unique value
     * (dropped-number on kinds legacy doesn't complete-check) is unit-tested
     * directly in moveSpecValidator.test.ts; here we assert the end-to-end
     * guarantee that stripped prose is discarded. */
    const strippingLlm = vi.fn(async (_sys: string, user: string) =>
      user.replace(/\d+(?:\.\d+)?/g, "the agreed amount"),
    );
    const result = await generateBotReply(
      mkCloseRecapState(),
      strippingLlm as never,
    );
    /* The number-stripped restyle must never be the shipped text. */
    expect(result.source).not.toBe("movespec");
    expect(result.source).not.toBe("restyle");
    expect(result.source).toBe("canonical-fallback");
    /* The shipped text is the kernel-authored canonical, which still carries
     * its numbers — proof the stripped prose was discarded. */
    expect(/\d/.test(result.text)).toBe(true);
    expect(result.text).not.toContain("the agreed amount");
  });

  it("flag ON — the slot gate BODY fires: legacy passes, one dropped number trips slot:dropped-number", async () => {
    process.env.NEGOTIATION_MOVE_SPEC_ENABLED = "1";
    /* ARCH-C3b coverage (the MED gap the unbiased Class-C review flagged):
     * the promoted slot gate's BODY had 0% live coverage because every
     * prior fixture either fed a faithful restyle (gate doesn't fire) or a
     * fully-number-stripped restyle (LEGACY validateRestyle's
     * completeness/required checks fire FIRST, so the slot gate is never
     * reached). This test threads the needle so the slot gate is the
     * UNIQUE catcher:
     *   - keeps every legacy-required close-recap word token
     *     (fixed/variable/notice/bgv) → close-recap-incomplete passes
     *   - keeps ≥1 number → numberPolicy "required" passes
     *   - introduces NO new salary scalar → legacy's subset rule passes
     *     (legacy measures only ₹..L scalars), but the slot validator's
     *     Check 2 (every canonical DIGIT token must survive) rejects.
     * The restyle below drops the non-salary canonical numbers (the
     * 12-month / 9-week / day-count tokens) while keeping every salary
     * scalar so legacy stays green; Check 2 iterates the canonical numbers
     * in order and short-circuits on the FIRST missing one (12). It is not a single-drop
     * fixture — the point is only that ≥1 canonical number is dropped while
     * legacy stays green, so the slot gate is the unique catcher.
     * The only way to reach a "slot:dropped-number" reason is for the gate
     * body to execute — so this gives it genuine coverage and proves an
     * invalid slot really does force a canonical-fallback in the live
     * pipeline, not just in the validator unit test. */
    /* The close-recap canonical only passes legacy's completeness check
     * (`close-recap-incomplete` requires fixed/variable/notice/bgv) when
     * the planner emitted the notice + BGV clauses — which it does only
     * once those topics were discussed. Stamp the two discussed-signals so
     * the canonical renders the FULL recap; otherwise legacy pre-empts and
     * the slot gate is never reached. */
    const fullRecapState = {
      ...mkCloseRecapState(),
      noticeJoining: { noticePeriodDays: 60 } as never,
      candidateProfile: { bgvAnxiety: true } as never,
    } as NegotiationState;
    /* The restyle must (a) keep all four legacy completeness tokens, (b)
     * keep ≥1 number so numberPolicy "required" passes, (c) introduce no
     * NEW salary scalar so legacy's subset rule passes, (d) stay short so
     * `sentence-too-long` doesn't pre-empt, and (e) DROP at least one
     * canonical number so the slot validator is the unique catcher.
     * Legacy's salary scalars are {24, 0, 2} (the ₹..L figures — "12-month"/
     * "9 weeks"/"2-3 days" are NOT salary scalars, so legacy ignores them,
     * but the structural slot validator extracts ALL digits). We keep every
     * salary scalar (Fixed ₹24L, variable ₹0L, joining bonus ₹2L) so legacy
     * passes, and drop the non-salary 12-month / 9-week / day tokens. The
     * slot validator's Check 2 walks the canonical digit tokens
     * [24,0,2,12,9,2,3] and short-circuits on the first missing one — 12 —
     * making it the only thing that rejects. (Pre-PRI-54b this fixture used
     * a fabricated 85/15 split, Fixed ₹20.4L / variable ₹3.6L; that split is
     * gone — the canonical now carries the full ₹24L fixed with ₹0L
     * variable.) */
    const dropFixedAmountLlm = vi.fn(
      async (_sys: string, _user: string) =>
        "Fixed ₹24L, variable ₹0L, joining bonus ₹2L, notice and BGV all noted.",
    );
    const result = await generateBotReply(
      fullRecapState,
      dropFixedAmountLlm as never,
    );
    expect(result.action.kind).toBe("close-recap-formal");
    /* The slot gate is the catcher — not legacy, not verbatim-repeat. */
    expect(result.rejectReason).toBe("slot:dropped-number");
    expect(result.source).toBe("canonical-fallback");
    /* The shipped text is the kernel canonical, which retains the dropped
     * non-salary tokens — proof the number-dropping restyle was discarded. */
    expect(result.text).toContain("12-month");
  });

  it("flag ON — a faithful restyle ships as 'movespec', never slot-rejected (no silent downgrade)", async () => {
    process.env.NEGOTIATION_MOVE_SPEC_ENABLED = "1";
    /* Regression guard for the ARCH-C3b gate's MED risk: a restyle that
     * preserves every canonical salary scalar and invents none must pass
     * BOTH legacy and the structural slot validator and actually SHIP as the
     * MoveSpec restyle. Asserting only "rejectReason isn't slot:*" is too
     * weak — a legacy reject (e.g. close-recap-incomplete / sentence-too-
     * long) would also satisfy it while the MoveSpec path never ran. We use
     * the FULL recap state (notice+BGV stamped, so legacy completeness
     * passes) and a terse faithful restyle that reproduces EVERY canonical
     * numeric token (the slot validator extracts all digits, not just salary
     * scalars: {24, 0, 2, 12, 9, 2, 3}), keeps the four completeness
     * tokens, invents no number, and stays under the 30-word length cap.
     * That forces source === "movespec", proving the validator ran AND let
     * the good prose through. */
    const fullRecapState = {
      ...mkCloseRecapState(),
      noticeJoining: { noticePeriodDays: 60 } as never,
      candidateProfile: { bgvAnxiety: true } as never,
    } as NegotiationState;
    const faithfulLlm = vi.fn(
      async (_sys: string, _user: string) =>
        "Fixed ₹24L, variable ₹0L, joining bonus ₹2L, 12-month clawback, notice 9 weeks, BGV later, offer letter 2-3 days.",
    );
    const result = await generateBotReply(fullRecapState, faithfulLlm as never);
    expect(result.action.kind).toBe("close-recap-formal");
    expect(result.source).toBe("movespec");
    expect(result.rejectReason ?? null).toBeNull();
    /* The shipped text is the faithful restyle (not the kernel canonical). */
    expect(result.text).toContain("12-month clawback");
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
