/* PDF#31 BUG E regression (2026-05-18) — system-prompt directive leak.
 *
 * Symptom (PDF#31 T18, Meesho/Prita): bot uttered
 *   "Coming back to the structure — okay. Answer the candidate's
 *    question first; checklist advance pauses until the question is
 *    addressed."
 * That string was the planner's INTERNAL directive (the `ask` field on
 * the reactive-followup answer-direct action) being shipped verbatim
 * through the canonical-prose fallback branch.
 *
 * Architectural fix (3 layers, defense-in-depth):
 *   1. _next-action-planner.ts:2353 — `ask` now carries safe candidate
 *      prose ("Sure — let me address that directly."), never a
 *      second-person directive about the bot's own behavior.
 *   2. _canonical-prose.ts answer-direct case — explicit safe string;
 *      no longer falls through to the verbatim-`action.ask` branch.
 *      The verbatim branch (for ctc-gentle-push, notice-buyout, etc.)
 *      now runs through sanitiseCandidateProse.
 *   3. _response-pipeline.ts generateBotReply — final boundary check
 *      against META_DIRECTIVE_TOKENS_RE; if anything still slips
 *      through, swap to a safe stub.
 *
 * Each test below pins one of those three layers.
 */
import { describe, it, expect, vi } from "vitest";
import {
  initState,
  applyCandidateAnswer,
  type NegotiationBand,
  type NegotiationState,
} from "../../../server-handlers/_negotiation-kernel";
import { planNextAction } from "../../../server-handlers/_next-action-planner";
import {
  renderCanonicalProse,
  META_DIRECTIVE_TOKENS_RE,
  sanitiseCandidateProse,
} from "../../../server-handlers/_canonical-prose";
import {
  generateBotReply,
  type GenerateAiTextFn,
} from "../../../server-handlers/_response-pipeline";

const BAND: NegotiationBand = {
  initialOffer: 23,
  maxStretch: 32,
  walkAway: 20,
  hasEquity: false,
};

const newState = (overrides: Partial<NegotiationState> = {}): NegotiationState => ({
  ...initState({
    sessionId: "pdf31-bugE",
    role: "Senior PM",
    company: "Meesho",
    band: BAND,
  }),
  ...overrides,
});

describe("PDF#31 BUG E — answer-direct system-prompt leak", () => {
  it("layer 1: planner emits candidate-safe prose, not an internal directive", () => {
    let state = newState();
    /* Candidate asks a direct question — answer-direct gate should fire. */
    state = applyCandidateAnswer(state, "What's the team size?");
    const action = planNextAction(state);
    /* The directive may not always be selected (other gates can win) —
     * but IF a reactive-followup is selected, its `ask` must be clean. */
    if (action.kind === "reactive-followup") {
      expect(action.ask).not.toMatch(META_DIRECTIVE_TOKENS_RE);
      expect(action.ask).not.toMatch(/answer the candidate's question first/i);
      expect(action.ask).not.toMatch(/checklist advance pauses/i);
    }
  });

  it("layer 2: canonical-prose answer-direct branch never emits a directive", () => {
    const state = newState();
    const action = {
      kind: "reactive-followup" as const,
      /* Even if the planner regresses and ships a directive here, the
       * canonical-prose explicit answer-direct case must not propagate it. */
      ask: "Answer the candidate's question first; checklist advance pauses until the question is addressed.",
      trigger: "askedQuestion",
      topic: "answer-direct" as const,
      satisfiesTopic: "answer-direct" as const,
    };
    const prose = renderCanonicalProse(action, state);
    expect(prose).not.toMatch(META_DIRECTIVE_TOKENS_RE);
  });

  it("layer 2b: sanitiseCandidateProse rejects meta-directive prose", () => {
    expect(
      sanitiseCandidateProse(
        "Answer the candidate's question first; checklist advance pauses.",
      ),
    ).toBeNull();
    expect(sanitiseCandidateProse("Sure — let me address that.")).toBe(
      "Sure — let me address that.",
    );
    expect(sanitiseCandidateProse("")).toBeNull();
    expect(sanitiseCandidateProse(null)).toBeNull();
  });

  it("layer 3: response-pipeline boundary scrubs any meta-directive leak", async () => {
    /* Mock the LLM to inject the directive — the final boundary check
     * in generateBotReply must catch it and swap to a safe stub. */
    const mockGen: GenerateAiTextFn = vi
      .fn()
      .mockResolvedValue(
        "Coming back to the structure — Answer the candidate's question first; checklist advance pauses until the question is addressed.",
      );
    let state = newState();
    state = applyCandidateAnswer(state, "What's the team size?");
    const result = await generateBotReply(
      state,
      mockGen,
      "What's the team size?",
    );
    expect(result.text).not.toMatch(META_DIRECTIVE_TOKENS_RE);
    expect(result.text.toLowerCase()).not.toContain("checklist");
    expect(result.text.toLowerCase()).not.toContain("advance pauses");
  });

  it("META_DIRECTIVE_TOKENS_RE catches the exact PDF#31 T18 string", () => {
    const t18 =
      "Coming back to the structure — okay. Answer the candidate's question first; checklist advance pauses until the question is addressed.";
    expect(t18).toMatch(META_DIRECTIVE_TOKENS_RE);
  });

  it("META_DIRECTIVE_TOKENS_RE does NOT false-positive on legitimate prose", () => {
    /* Real recruiter idiom that should pass through unchanged. */
    const safe = [
      "Sure — let me address that directly.",
      "Happy to address that — let me come back to where we were.",
      "Team size is something the HM walks through in the next round.",
      "Let me check with the team and get back to you on that.",
      "Right, on the comp side — what's anchoring your expectation?",
    ];
    for (const s of safe) {
      expect(s).not.toMatch(META_DIRECTIVE_TOKENS_RE);
    }
  });
});
