/* F3 (2026-05-15) — reroll cap invariant.
 *
 * The negotiate-turn LLM glue runs at most ONE reroll per turn, even
 * when both the coherence detector AND the duplicate-reply detector
 * fire on the same draft. Without this cap a pathological turn could
 * stack three LLM calls (initial + coherence-reroll + duplicate-reroll)
 * which doubles latency and amplifies token cost.
 *
 * These tests stub the LlmCaller to count calls, then construct turns
 * that trigger both detectors back-to-back and assert the call count
 * never exceeds 2.
 */
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { generateAiText, type LlmCaller } from "../../server-handlers/negotiate-turn";
import {
  initState,
  type AiMove,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";

const BAND: NegotiationBand = { initialOffer: 15, maxStretch: 22, walkAway: 12, hasEquity: false };

function makeState(overrides: Partial<NegotiationState> = {}): NegotiationState {
  return {
    ...initState({ sessionId: "s", role: "swe", company: "Acme", band: BAND }),
    ...overrides,
  };
}

/* Move that doesn't require a specific number in the LLM output —
 * lets us return arbitrary stub text without tripping validation. */
const PROBE_MOVE: AiMove = {
  lever: "probe",
  newTotalLpa: null,
  rationale: "Need candidate target before counter.",
};

describe("F3 — reroll cap invariant", () => {
  it("back-to-back incoherent drafts → at most 2 LLM calls", async () => {
    let calls = 0;
    const llm: LlmCaller = vi.fn(async () => {
      calls++;
      /* This text has no content overlap with the candidate's question
       * and contains no direct-answer marker → trips coherence. */
      return "Unrelated company values and culture statement.";
    });
    const candidateQ = "What is the fixed component of the offer?";
    const s = makeState({ turnIndex: 1 });
    await generateAiText(s, PROBE_MOVE, candidateQ, llm, "user");
    expect(calls).toBeLessThanOrEqual(2);
  });

  it("incoherent + duplicate combined on same draft → single combined reroll, 2 calls total", async () => {
    let calls = 0;
    /* lastBotReply same as the stub LLM text → repetition detector
     * fires AND the unrelated text fails coherence. Both flags on a1. */
    const stubText = "We are excited about your profile and look forward to discussing further opportunity.";
    const llm: LlmCaller = vi.fn(async () => {
      calls++;
      return stubText;
    });
    const s = makeState({
      turnIndex: 1,
      lastBotReply: stubText,
    });
    await generateAiText(
      s,
      PROBE_MOVE,
      "What is the variable component?",
      llm,
      "user",
    );
    expect(calls).toBe(2);
  });

  it("a1 passes both checks → no reroll, 1 call total", async () => {
    let calls = 0;
    const llm: LlmCaller = vi.fn(async () => {
      calls++;
      /* Candidate utterance has no '?' suffix → coherence auto-pass.
       * lastBotReply null → repetition can't fire. Plain text. */
      return "Got it — let me note that down and circle back next turn.";
    });
    const s = makeState({ turnIndex: 1, lastBotReply: null });
    await generateAiText(s, PROBE_MOVE, "Thanks, that's helpful.", llm, "user");
    expect(calls).toBe(1);
  });

  it("a1 incoherent, a1b coherent → 2 calls, returns the rerolled text", async () => {
    let calls = 0;
    const llm: LlmCaller = vi.fn(async () => {
      calls++;
      if (calls === 1) {
        /* incoherent for the breakdown question (no number, no deferral) */
        return "We value collaboration and excellence at our company.";
      }
      /* second call: coherent (deferral phrase) */
      return "I'll come back to that after we discuss your target.";
    });
    const s = makeState({ turnIndex: 1, lastBotReply: null });
    const res = await generateAiText(s, PROBE_MOVE, "What's the fixed?", llm, "user");
    expect(calls).toBe(2);
    expect(res.text).toContain("come back");
    expect(res.source).toBe("llm-retry");
  });

  it("a1 + a1b both incoherent → 2 calls, returns the original a1 text", async () => {
    let calls = 0;
    const stubA1 = "Generic platitude about the role.";
    const stubA1b = "Another generic platitude with no answer.";
    const llm: LlmCaller = vi.fn(async () => {
      calls++;
      return calls === 1 ? stubA1 : stubA1b;
    });
    const s = makeState({ turnIndex: 1, lastBotReply: null });
    const res = await generateAiText(s, PROBE_MOVE, "What's the fixed?", llm, "user");
    expect(calls).toBe(2);
    /* Reroll cap: when the reroll attempt also fails the detectors, the
     * original a1 text is returned — never a third call. */
    expect(res.text).toContain("Generic platitude");
  });

  it("rerollAttempts variable is bounded to 1 in source (no second-reroll path exists)", () => {
    /* Defense-in-depth source-level guard: search for any pattern that
     * could trigger a second reroll attempt after a1b. */
    const src = readFileSync(
      join(__dirname, "..", "..", "server-handlers", "negotiate-turn.ts"),
      "utf-8",
    );
    /* Only one rerollAttempts++ in the file. */
    const incrCount = (src.match(/rerollAttempts\+\+/g) || []).length;
    expect(incrCount).toBe(1);
    /* F3 cap comment must be present. */
    expect(src).toMatch(/F3 \(2026-05-15\) — reroll cap/);
  });
});
