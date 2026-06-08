/* V2-SHADOW test suite (2026-06-09).
 *
 * Asserts the three contracts in shadow.ts:
 *   1. Env-gated. Without NEGOTIATION_V2_SHADOW_ENABLED=1, runShadow
 *      is a no-op and the LLM is never invoked.
 *   2. Never throws upstream. When the LLM throws / returns garbage
 *      / the orchestrator falls through, runShadow swallows it.
 *   3. Logs a `negotiation_v2_shadow_turn` event with the divergence
 *      flag when v1 and v2 disagree (v1 ships no number, v2 does).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runShadow } from "../../../server-handlers/v2/shadow";
import type { GenerateAiTextFn, PipelineResult } from "../../../server-handlers/_response-pipeline";
import type {
  NegotiationState,
  NegotiationBand,
} from "../../../server-handlers/_negotiation-kernel";
import type { NextAction } from "../../../server-handlers/_next-action-planner";
import { computeBand } from "../../../server-handlers/v2/kernel";

vi.mock("../../../server-handlers/_posthog", () => ({
  captureServerEvent: vi.fn(),
}));
import { captureServerEvent } from "../../../server-handlers/_posthog";

const BAND: NegotiationBand = { initialOffer: 18, maxStretch: 24, walkAway: 14, hasEquity: false };

/* The shadow computes its own band from (role, company) at runShadow
 * time. We compute the SAME band here lazily (inside the test rather
 * than at module load) so the stub's anchor number matches what the
 * shadow will actually validate against — salary-lookup can be cold
 * at module-load time and resolve to DEFAULT_BAND, then warm up by
 * runtime, which used to silently desync the test. */
function liveBand(): NegotiationBand {
  return computeBand("Senior Product Designer", "flipkart", undefined, 6);
}

function mkState(extra: Partial<NegotiationState> = {}): NegotiationState {
  return {
    sessionId: "shadow-test-session",
    role: "Senior Product Designer",
    company: "flipkart",
    band: BAND,
    phase: "discovery",
    turnIndex: 7,
    maxTurns: 20,
    candidateTarget: 44,
    lastCandidateCounterLpa: 0,
    firstAnchoredTarget: 0,
    candidateCurrentCtc: 32,
    competingOffer: null,
    candidateComponentBreakdown: {} as never,
    candidateAskedAsRange: false,
    highestOfferMade: 0,
    leversUsed: [],
    lastAiText: "",
    lastJoiningBonusOffered: 0,
    conversationLog: [
      { speaker: "ai", text: "What's your current CTC?" },
      { speaker: "candidate", text: "32 LPA" },
      { speaker: "ai", text: "Base split?" },
      { speaker: "candidate", text: "28 LPA" },
      { speaker: "ai", text: "Variable?" },
      { speaker: "candidate", text: "4 LPA" },
      { speaker: "ai", text: "Process status?" },
      { speaker: "candidate", text: "" },
      { speaker: "ai", text: "Step back — what's most useful next?" },
      { speaker: "candidate", text: "" },
      { speaker: "ai", text: "On equity?" },
      { speaker: "candidate", text: "this is salary negotiation so you should give your initial offer" },
    ],
    finalOfferAssertedCount: 0,
    vossTacticsUsed: [],
    infoAsked: [],
    verbalAcceptanceTurn: null as unknown as number,
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
    candidateTotalYoe: 6,
    candidateApplicableYoe: 6,
    candidatePrimaryDomain: null,
    freshGradDisclosed: false,
    recruiterFactsAlreadySaid: [],
    anchorLocked: false,
    lockedAnchorLpa: 0,
    promptInjectionAttempts: [],
    ...extra,
  } as NegotiationState;
}

const V1_FLUFF_RESULT: PipelineResult = {
  text: "Thanks for that - how does your current comp fit in the local market?",
  source: "restyle",
  action: { kind: "ask-discovery" } as unknown as NextAction,
  move: "discovery" as never,
};

beforeEach(() => {
  vi.mocked(captureServerEvent).mockClear();
});

afterEach(() => {
  delete process.env.NEGOTIATION_V2_SHADOW_ENABLED;
});

describe("v2 shadow — env gating", () => {
  it("is a no-op when NEGOTIATION_V2_SHADOW_ENABLED is unset", async () => {
    const llm = vi.fn(async () => "should not be called");
    runShadow(mkState(), llm as GenerateAiTextFn, V1_FLUFF_RESULT, "user-1");
    /* fire-and-forget — wait a microtask tick. */
    await new Promise((r) => setImmediate(r));
    expect(llm).not.toHaveBeenCalled();
    expect(captureServerEvent).not.toHaveBeenCalled();
  });

  it("runs when NEGOTIATION_V2_SHADOW_ENABLED=1", async () => {
    process.env.NEGOTIATION_V2_SHADOW_ENABLED = "1";
    const band = liveBand();
    const llm = vi.fn(async () =>
      JSON.stringify({
        name: "propose_anchor",
        args: {
          number_lpa: band.initialOffer,
          rationale: "based on senior PD band at Flipkart this is the calibrated opener",
        },
      }),
    );
    runShadow(mkState(), llm as GenerateAiTextFn, V1_FLUFF_RESULT, "user-1");
    /* Need to wait for the async background work to complete. */
    await new Promise((r) => setTimeout(r, 50));
    expect(llm).toHaveBeenCalled();
    expect(captureServerEvent).toHaveBeenCalledWith(
      "negotiation_v2_shadow_turn",
      "user-1",
      expect.objectContaining({
        v2_tool: "propose_anchor",
        v2_lpa: band.initialOffer,
        diverged: true /* v1 had no number, v2 has one */,
      }),
    );
  });
});

describe("v2 shadow — error containment", () => {
  it("LLM throw → logs shadow_error, does NOT throw upstream", async () => {
    process.env.NEGOTIATION_V2_SHADOW_ENABLED = "1";
    const llm = vi.fn(async () => {
      throw new Error("LLM unavailable");
    });
    /* Calling runShadow must not throw — period. */
    expect(() =>
      runShadow(mkState(), llm as GenerateAiTextFn, V1_FLUFF_RESULT, "user-1"),
    ).not.toThrow();
    await new Promise((r) => setTimeout(r, 50));
    expect(captureServerEvent).toHaveBeenCalledWith(
      "negotiation_v2_shadow_error",
      "user-1",
      expect.objectContaining({ error: expect.stringMatching(/LLM unavailable/) }),
    );
  });

  it("malformed LLM JSON → logs shadow_error, does NOT throw upstream", async () => {
    process.env.NEGOTIATION_V2_SHADOW_ENABLED = "1";
    const llm = vi.fn(async () => "this is not JSON at all");
    runShadow(mkState(), llm as GenerateAiTextFn, V1_FLUFF_RESULT, "user-1");
    await new Promise((r) => setTimeout(r, 50));
    expect(captureServerEvent).toHaveBeenCalledWith(
      "negotiation_v2_shadow_error",
      "user-1",
      expect.objectContaining({ error: expect.any(String) }),
    );
  });
});

describe("v2 shadow — divergence signal", () => {
  it("diverged=true when v1 shipped fluff and v2 shipped a number", async () => {
    process.env.NEGOTIATION_V2_SHADOW_ENABLED = "1";
    const band = liveBand();
    const llm = vi.fn(async () =>
      JSON.stringify({
        name: "propose_anchor",
        args: {
          number_lpa: band.initialOffer,
          rationale: "calibrated to the senior PD band and the 6 YoE you've described",
        },
      }),
    );
    runShadow(mkState(), llm as GenerateAiTextFn, V1_FLUFF_RESULT, "user-1");
    await new Promise((r) => setTimeout(r, 50));
    expect(captureServerEvent).toHaveBeenCalledWith(
      "negotiation_v2_shadow_turn",
      "user-1",
      expect.objectContaining({ diverged: true, v1_has_number: false, v2_lpa: band.initialOffer }),
    );
  });
});
