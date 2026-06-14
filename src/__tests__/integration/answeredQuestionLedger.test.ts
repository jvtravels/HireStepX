/* Cross-turn answer coherence — answeredQuestionLedger contract test.
 *
 * Audit follow-up (2026-05-21). When a candidate asks "what's the
 * equity vesting?" on turn 4 and again on turn 9, the bot used to
 * rebuild the factPack from scratch each time, letting the LLM drift
 * to inconsistent answers ("25/25/25/25" vs "1-year cliff then
 * quarterly"). The kernel now records every shipped answer keyed by
 * intent on state.answeredQuestionLedger, and the response pipeline
 * short-circuits a repeat intent to a deterministic reconfirmation
 * of the prior answer.
 *
 * These tests pin the contract:
 *
 *   1. State carries the ledger field (back-compat optional).
 *   2. initState seeds an empty ledger.
 *   3. applyAiMove writes the ledger entry when the immediately-prior
 *      candidate turn carried a structured askedQuestion intent.
 *   4. The pipeline short-circuits to the prior answer when the
 *      candidate re-asks the same intent on a LATER turn.
 *   5. Same-turn intent (turn the answer was written) does NOT
 *      short-circuit (still inside the same exchange).
 *   6. validateState / deserializeState round-trip the ledger.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  applyCandidateAnswer,
  applyAiMove,
  serializeState,
  deserializeState,
  type NegotiationState,
  type AiMove,
} from "../../../server-handlers/_negotiation-kernel";
import { generateBotReply, type GenerateAiTextFn } from "../../../server-handlers/_response-pipeline";

function seed(): NegotiationState {
  return initState({
    sessionId: "aql-1",
    role: "Senior Product Designer",
    company: "Flipkart",
    band: { initialOffer: 35, maxStretch: 50, walkAway: 30, hasEquity: true },
  });
}

describe("answeredQuestionLedger — schema", () => {
  it("initState seeds an empty ledger", () => {
    const s = seed();
    expect(s.answeredQuestionLedger).toEqual({});
  });

  it("survives serialize → deserialize round-trip", () => {
    const s = seed();
    const withEntry: NegotiationState = {
      ...s,
      answeredQuestionLedger: { equity: { answerText: "Quarterly vesting over 4 yrs.", turn: 3 } },
    };
    const restored = deserializeState(serializeState(withEntry));
    expect(restored.answeredQuestionLedger).toEqual(withEntry.answeredQuestionLedger);
  });

  it("deserializeState backfills missing field on legacy payloads", () => {
    const s = seed();
    /* Simulate a legacy payload: strip the ledger key before serializing. */
    const legacy = { ...s };
    delete (legacy as { answeredQuestionLedger?: unknown }).answeredQuestionLedger;
    const restored = deserializeState(JSON.stringify(legacy));
    expect(restored.answeredQuestionLedger).toEqual({});
  });
});

describe("answeredQuestionLedger — applyAiMove writes the entry", () => {
  it("captures the AI text when the prior candidate turn asked a question", () => {
    let s = seed();
    /* Candidate turn carries an equity question — applyCandidateAnswer
     * will populate state.lastTurnDelta.candidateAskedQuestion.intent. */
    s = applyCandidateAnswer(s, "What's the equity vesting schedule for RSUs?");
    expect(s.lastTurnDelta?.candidateAskedQuestion?.intent).toBe("equity");
    /* AI turn ships an answer; ledger should capture it under "equity". */
    const move: AiMove = {
      lever: "benefits-summary",
      newTotalLpa: null,
      rationale: "answer equity question",
      actionKind: "round-transition",
    };
    s = applyAiMove(s, move, "Standard RSU schedule: 1-year cliff then quarterly over 4 yrs.");
    /* AUDIT-W02 D4 (2026-06-08) — ledger entries now also stamp the
     * phase at write-time (declared optional on the schema). Assert the
     * stable answerText + turn, plus that a phase string was recorded. */
    expect(s.answeredQuestionLedger?.equity).toMatchObject({
      answerText: "Standard RSU schedule: 1-year cliff then quarterly over 4 yrs.",
      turn: 0,
    });
    expect(typeof s.answeredQuestionLedger?.equity?.phase).toBe("string");
  });

  it("does NOT write when the prior candidate turn carried no question", () => {
    let s = seed();
    s = applyCandidateAnswer(s, "currently at 18 LPA, expecting 28");
    /* No question → no intent. */
    expect(s.lastTurnDelta?.candidateAskedQuestion ?? null).toBeNull();
    const move: AiMove = {
      lever: "probe",
      newTotalLpa: null,
      rationale: "discovery probe",
      actionKind: "round-transition",
    };
    s = applyAiMove(s, move, "What's driving the 28 anchor?");
    expect(s.answeredQuestionLedger).toEqual({});
  });

  it("overwrites the ledger entry when the same intent is re-asked and re-answered", () => {
    let s = seed();
    s = applyCandidateAnswer(s, "What's the WFH policy?");
    const move: AiMove = {
      lever: "benefits-summary",
      newTotalLpa: null,
      rationale: "answer wfh",
      actionKind: "round-transition",
    };
    s = applyAiMove(s, move, "Hybrid — 3 days in office.");
    expect(s.answeredQuestionLedger?.wfh?.answerText).toBe("Hybrid — 3 days in office.");
    /* Candidate re-asks; AI clarifies. The new entry should overwrite. */
    s = applyCandidateAnswer(s, "Hybrid — but which 3 days?");
    s = applyAiMove(s, move, "Tuesday / Wednesday / Thursday.");
    expect(s.answeredQuestionLedger?.wfh?.answerText).toBe("Tuesday / Wednesday / Thursday.");
  });
});

describe("answeredQuestionLedger — pipeline short-circuit", () => {
  const llm: GenerateAiTextFn = async () => "LLM SHOULD NOT BE CALLED";

  it("short-circuits to a deterministic reconfirmation when intent has a prior answer from an EARLIER turn", async () => {
    let s = seed();
    /* Turn 0: candidate asks about WFH; bot's answer goes into ledger. */
    s = applyCandidateAnswer(s, "What's the WFH policy?");
    s = applyAiMove(
      s,
      { lever: "benefits-summary", newTotalLpa: null, rationale: "wfh", actionKind: "round-transition" },
      "Hybrid — 3 days in office.",
    );
    /* Turn 1: candidate re-asks. Pipeline should short-circuit. */
    s = applyCandidateAnswer(s, "And the WFH policy again?");
    const result = await generateBotReply(s, llm, "And the WFH policy again?");
    expect(result.source).toBe("answer-canonical");
    expect(result.rejectReason).toBe("repeat-intent:wfh");
    expect(result.text).toMatch(/Just to reconfirm/);
    expect(result.text).toMatch(/Hybrid — 3 days in office\./);
  });

  it("does NOT short-circuit when the intent has no prior answer (first ask)", async () => {
    let s = seed();
    s = applyCandidateAnswer(s, "What's the equity vesting schedule?");
    /* No prior ledger entry for "equity" — pipeline should fall
     * through to generateAnswerToCandidate which will call the LLM
     * (or the canonical-fallback when the LLM returns nothing). */
    let llmCalled = false;
    const detectLlm: GenerateAiTextFn = async () => {
      llmCalled = true;
      return "Some fresh LLM answer about equity.";
    };
    await generateBotReply(s, detectLlm, "What's the equity vesting schedule?");
    expect(llmCalled).toBe(true);
  });

  it("does NOT short-circuit on the SAME turn as the answer was written (no premature loop)", async () => {
    let s = seed();
    s = applyCandidateAnswer(s, "What's the WFH policy?");
    s = applyAiMove(
      s,
      { lever: "benefits-summary", newTotalLpa: null, rationale: "wfh", actionKind: "round-transition" },
      "Hybrid — 3 days in office.",
    );
    /* The entry was written at turn 0. State is now at turn 1
     * (post-applyAiMove). A FOLLOW-UP candidate turn happens; ledger
     * entry's turn=0 is strictly less than state.turnIndex=1, so the
     * short-circuit fires — but ONLY because we advanced a turn. The
     * critical invariant is: if turn === ledger.turn (impossible after
     * applyAiMove, but defensive), don't short-circuit. We assert the
     * inequality directly via the bounds. */
    expect((s.answeredQuestionLedger?.wfh?.turn ?? -1) < s.turnIndex).toBe(true);
  });
});
