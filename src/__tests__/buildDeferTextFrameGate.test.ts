/* ARCH-C2c (2026-06-08) — buildDeferText frame-compatibility gate.
 *
 * buildDeferText prefixes a defer lead ("Let me check and come back —")
 * to the planner's canonical pivot. For close-recap or commit-requiring
 * pivots, that lead undermines the close / anchor (same matrix
 * CompoundMoveSpec enforces at the compose sites). C2c short-circuits
 * those cases — the planner's canonical pivot ships alone.
 *
 * buildDeferText is module-internal; we exercise it via the public
 * generateBotReply with a stub LLM that forces the answer path into a
 * defer (LLM throw → "llm-throw" defer reason). With a close-recap
 * pivot in play, the shipped text should equal the canonical pivot
 * verbatim — no defer lead.
 */
import { describe, it, expect, vi } from "vitest";
import { generateBotReply, classifyLlmThrow } from "../../server-handlers/_response-pipeline";
import { proseCloseRecapFormal } from "../../server-handlers/prose/close-recap-formal";
import type {
  NegotiationState,
  NegotiationBand,
} from "../../server-handlers/_negotiation-kernel";

const BAND: NegotiationBand = { initialOffer: 18, maxStretch: 24, walkAway: 14, hasEquity: false };

function mkClosingState(): NegotiationState {
  return {
    sessionId: "c2c-defer-frame-gate",
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

describe("ARCH-C2c — buildDeferText drops defer lead for close-recap / commit-requiring pivots", () => {
  it("does NOT prefix 'Let me check and come back' / 'Coming back to' when the planner pivot is close-recap", async () => {
    const state = mkClosingState();
    const stubLlm = vi.fn(async () => {
      throw new Error("forced LLM throw to trip the llm-throw defer branch");
    });
    /* Candidate slips a question into their reply — pushes us into
     * generateAnswerToCandidate which then trips the llm-throw defer. */
    const result = await generateBotReply(
      state,
      stubLlm as never,
      "Quick one — when does BGV usually start?",
    );

    /* The pre-C2c shipped string would have started with a defer lead
     * like "Coming back to the structure — let me recap …". With the
     * frame gate, the defer lead is dropped and the close-recap canonical
     * ships verbatim. */
    expect(result.text).not.toMatch(/^\s*(?:coming back|let me check and come back|let me reframe|let me come back)/i);

    /* And the close-recap signature words from the planner's canonical
     * MUST be present (otherwise the planner's move was silently
     * dropped — the bug C2c is preventing the inverse of). */
    if (result.action.kind === "close-recap-formal") {
      const canonical = proseCloseRecapFormal(result.action, state, {} as never);
      /* Exact verbatim only when no LLM-restyle ran (defer branch ships
       * canonical directly). Equality is the strongest contract. */
      expect(result.text).toBe(canonical);
    }
  });
});

/* 2026-06-20 — classifyLlmThrow: the restyle catch used to collapse every
 * LLM failure into one opaque "llm-throw" reject reason. Live PostHog showed
 * 221 such throws (~79% of ALL restyle rejections) with no way to tell a
 * timeout from a 429 from an auth failure — the single biggest reason the LLM
 * polish layer never ships was unobservable. These pin the classifier so the
 * telemetry label is correct on the next staging run. */
describe("classifyLlmThrow — restyle failure-mode labels for telemetry", () => {
  it("labels per-provider timeout (AbortError) as llm-timeout", () => {
    const abort = new Error("The operation was aborted");
    abort.name = "AbortError";
    expect(classifyLlmThrow(abort)).toBe("llm-timeout");
    expect(classifyLlmThrow(new Error("request aborted due to timeout"))).toBe("llm-timeout");
  });

  it("labels rate-limit (429) as llm-rate-limit", () => {
    expect(classifyLlmThrow(new Error("Groq error 429: rate limit exceeded"))).toBe("llm-rate-limit");
    expect(classifyLlmThrow(new Error("Too Many Requests — rate limit"))).toBe("llm-rate-limit");
  });

  it("labels auth failures (401/403) as llm-auth", () => {
    expect(classifyLlmThrow(new Error("Groq error 401: invalid api key"))).toBe("llm-auth");
    expect(classifyLlmThrow(new Error("Gemini error 403: Unauthorized"))).toBe("llm-auth");
  });

  it("labels provider 5xx as llm-5xx", () => {
    expect(classifyLlmThrow(new Error("Groq error 503: service unavailable"))).toBe("llm-5xx");
  });

  it("labels config / provider-chain exhaustion distinctly", () => {
    expect(classifyLlmThrow(new Error("No LLM configured — set GROQ_API_KEY"))).toBe("llm-unconfigured");
    expect(classifyLlmThrow(new Error("All LLM providers failed"))).toBe("llm-all-providers-failed");
  });

  it("falls back to the generic llm-throw for unrecognised errors", () => {
    expect(classifyLlmThrow(new Error("something weird happened"))).toBe("llm-throw");
    expect(classifyLlmThrow("not even an Error")).toBe("llm-throw");
    expect(classifyLlmThrow(undefined)).toBe("llm-throw");
  });
});
