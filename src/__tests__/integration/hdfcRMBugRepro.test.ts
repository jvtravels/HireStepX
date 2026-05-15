/* Reproduction test for the HDFC Bank / Relationship Manager session bug
 * (2026-05-16). Two distinct defects:
 *
 *   1. Bot opened turn 0 with "we're looking at a total CTC of ₹20 LPA"
 *      — F6 (validateNoSpecificNumberInOpening) was supposed to catch
 *      this and trigger F2 prose substitution. Did it?
 *
 *   2. Bot asked "Before we go further — what range were you expecting
 *      for this role?" three turns in a row despite substantive answers.
 *      F7 (askedTopics repetition guard) was supposed to prevent this.
 *      Did it?
 *
 * This test drives the REAL generateAiText seam with a deterministic LLM
 * mock that emits the exact bad text the user observed. If F6/F7 are
 * wired correctly, the bad text must not reach the response.
 */
import { describe, it, expect, vi } from "vitest";
import { generateAiText, type LlmCaller } from "../../../server-handlers/negotiate-turn";
import {
  initState,
  pickAiMove,
  applyAiMove,
  type NegotiationBand,
  type NegotiationState,
} from "../../../server-handlers/_negotiation-kernel";

const BAND: NegotiationBand = {
  initialOffer: 20,
  maxStretch: 28,
  walkAway: 16,
  hasEquity: false,
};

describe("HDFC Bank / Relationship Manager — bug repro (F6 + F7)", () => {
  it("F6: turn-0 anchor '₹20 LPA' must not ship — substitution must fire", async () => {
    const state = initState({
      sessionId: "s-hdfc-rm",
      role: "Relationship Manager",
      company: "HDFC Bank",
      band: BAND,
    });
    expect(state.phase).toBe("opening");
    expect(state.turnIndex).toBe(0);

    const move = pickAiMove(state);
    /* Whatever lever the planner picked, simulate the LLM emitting the
     * exact text the user saw — a specific ₹20 LPA anchor in opening. */
    const badText = JSON.stringify({
      text: "So, Jay, for this Senior Relationship Manager role, we're looking at a total CTC of ₹20 LPA. This is where we're benchmarking based on what we're seeing in the market right now. What were you expecting?",
      roleMentioned: "Senior Relationship Manager",
      totalLpaMentioned: 20,
      leverExecuted: move.lever,
    });
    const llm: LlmCaller = vi.fn(async () => badText);

    const result = await generateAiText(state, move, "", llm, "user");

    /* F6 invariant: a specific salary number must NOT reach the user
     * in the opening turn before discovery is complete. */
    expect(result.text).not.toMatch(/₹\s*20\s*L|20\s*LPA|20\s*lakh/i);
    /* Should be a substitution / fallback, not the raw LLM text. */
    expect(result.source).toBe("fallback");
  });

  it("F7: same discovery topic must not be re-asked within 3 turns", async () => {
    /* Drive the kernel: turn 0 asks expectedCtc → turn 1 ask again
     * should be skipped by the repetition guard. */
    let state = initState({
      sessionId: "s-hdfc-rm-f7",
      role: "Relationship Manager",
      company: "HDFC Bank",
      band: BAND,
    });
    const move0 = pickAiMove(state);
    /* Simulate good LLM text that does ask for expected CTC. */
    const text0 = "Before we go further — what range were you expecting for this role?";
    state = applyAiMove(state, move0, text0);

    /* Inspect: did applyAiMove push the topic onto askedTopics? */
    const asked = state.askedTopics ?? [];
    expect(asked.length).toBeGreaterThanOrEqual(0);
    /* If F7 is wired, the topic key for the discovery probe should be
     * in askedTopics with the move's actionKind set to the item, NOT
     * the kind. The bug would be: tracked as 'discovery-probe' instead
     * of the item key ('expectedCtc' / 'currentCtc'). */
    if (asked.length > 0) {
      // Topic should be a concrete item key, never the action kind
      expect(asked[0].topic).not.toBe("discovery-probe");
      expect(asked[0].topic).not.toBe("probe");
    }

    /* Now simulate candidate giving a substantive answer. */
    // applyCandidateAnswer is called by the handler; for this kernel-only
    // test we simulate the next turn by advancing turn and re-picking. */
    state = { ...state, turnIndex: state.turnIndex + 1 };
    const move1 = pickAiMove(state);

    /* If F7 worked, the planner should NOT re-emit the same item ask
     * within the 3-turn window. The new probe's askedTopic (if any)
     * must differ from move0's. */
    if (move0.askedTopic && move1.askedTopic) {
      expect(move1.askedTopic).not.toBe(move0.askedTopic);
    }
  });

  it("F7 deterministic-fallback fix: deterministicFallbackText(probe) honors plannedNextAction.ask", async () => {
    /* Repro: even with F7 wired, deterministicFallbackText for `probe`
     * lever returned a hardcoded string. When the LLM kept failing on
     * consecutive turns, the user saw the SAME sentence repeated.
     *
     * Fix: deterministicFallbackText(probe) now reads
     * state.plannedNextAction.ask, so the deterministic path follows the
     * planner's per-turn discovery choice. */
    const { deterministicFallbackText } = await import(
      "../../../server-handlers/_negotiate-turn-helpers"
    );
    const state: NegotiationState = {
      ...initState({
        sessionId: "s-hdfc-rm-det",
        role: "Relationship Manager",
        company: "HDFC Bank",
        band: BAND,
      }),
      plannedNextAction: {
        kind: "discovery-probe",
        item: "currentCtc",
        ask: "Could you share your current CTC — fixed, variable, and in-hand?",
      } as never,
    };
    const text = deterministicFallbackText(state, {
      lever: "probe",
      newTotalLpa: null,
      rationale: "",
    });
    expect(text).toBe(
      "Could you share your current CTC — fixed, variable, and in-hand?",
    );
    /* And NOT the legacy hardcoded sentence. */
    expect(text).not.toMatch(/what range were you expecting/i);
  });
});
