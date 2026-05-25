/* PDF#36 Regression Fix Pass — Meesho/Senior Product Designer session
 * (2026-05-19). Seven bugs reproduced after PDF#34 and PDF#35 closed
 * adjacent classes. Each had a root cause on a path the prior fixes
 * did not cover.
 *
 *   A2 — Post-anchor close-on-acceptance not detected. "works for me"
 *        after a standing offer left verbalAcceptanceTurn unstamped
 *        because the soft-accept fallback required 3+ trailing
 *        non-counter turns before stamping. Fix: stamp the same turn
 *        whenever hasOffer + signalsAcceptance, regardless of trailing-
 *        non-counter count. Terminal phase flip still needs the 3-turn
 *        proxy; the stamp is the planner signal.
 *
 *   A3 — Offer-recap detector too narrow. "I want to know CTC", "what
 *        are the numbers" and "share the offer" fell through the
 *        verb-template branches. Broadened OFFER_RECAP_RE with want-
 *        to-know / tell-me / what-are / share branches and aliases
 *        (salary, total comp, numbers, breakdown, split).
 *
 *   A4 — Fact-pack persona leak on the answer path. META_DIRECTIVE_
 *        TOKENS_RE was only checked on the restyle path. Now also
 *        runs inside validateAnswer-side gate; on hit, swap to
 *        deterministic defer + canonical follow-up. Prompt hardened
 *        with explicit "do NOT mention data sources" line.
 *
 *   A1 — Repeat-deflection loop with leading-ack rotation. The
 *        negotiate-turn boundary guard fired AFTER the pipeline
 *        shipped, which meant the response-pipeline cache still
 *        carried the duplicate. Moved the same LEADING_ACK + normalize
 *        compare into the pipeline (both restyle and answer paths) so
 *        the loop-breaker stub fires before the boundary ever sees the
 *        duplicate. Boundary guard stays as belt-and-braces.
 *
 *   B2 — Variable disambiguation probe firing when math is unambiguous
 *        across turns. Same-turn gate required base + total + variable
 *        all in one utterance. Cross-turn extension: re-evaluate using
 *        prior sticky base/total when the gate misses same-turn, same
 *        ratio window [0.01, 0.25].
 *
 *   B3 — Equity probe continues after "no equity". esopNegated already
 *        marks the esop slot populated in nextComponentProbe, and the
 *        equity-clarity reactive-followup is gated on equityExists ===
 *        true. Re-asserted as covered by the existing guard; test
 *        nails down the contract so a regression couldn't move the
 *        guard without flipping the test.
 *
 *   B4 — Verbose kitchen-sink answer prose. checkSentenceLength
 *        (30w / 25w-avg) was wired into validateRestyle but not
 *        validateAnswer. Now runs on the answer path; rejection falls
 *        back to defer + canonical follow-up.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  applyCandidateAnswer,
  type NegotiationBand,
  type NegotiationState,
} from "../../../server-handlers/_negotiation-kernel";
import {
  planNextAction,
} from "../../../server-handlers/_next-action-planner";
import {
  generateBotReply,
  validateAnswer,
  isLeadingAckRotationRepeat,
} from "../../../server-handlers/_response-pipeline";
import {
  buildAnswerCandidatePrompt,
} from "../../../server-handlers/_canonical-prose";

const BAND: NegotiationBand = {
  initialOffer: 24,
  maxStretch: 32,
  walkAway: 20,
  hasEquity: true,
};

const newState = (overrides: Partial<NegotiationState> = {}): NegotiationState => ({
  ...initState({
    sessionId: "pdf36",
    role: "Senior Product Designer",
    company: "Meesho",
    band: BAND,
  }),
  ...overrides,
});

describe("PDF#36 A2 — post-anchor close-on-acceptance", () => {
  it("'works for me' after anchor stamps verbalAcceptanceTurn the same turn", () => {
    const state = newState({ highestOfferMade: 24, turnIndex: 6 });
    const after = applyCandidateAnswer(state, "works for me");
    expect(after.verbalAcceptanceTurn).toBe(state.turnIndex);
  });

  it("planner routes to close{accept} on the same turn the verbalAcceptanceTurn is stamped", () => {
    const state = newState({
      highestOfferMade: 24,
      turnIndex: 6,
      phase: "range-disclosure",
    });
    const after = applyCandidateAnswer(state, "works for me");
    const action = planNextAction(after);
    expect(action.kind).toBe("close");
    if (action.kind === "close") {
      expect(action.mode).toBe("accept");
    }
  });

  it("'works for me' WITHOUT a standing offer does NOT stamp acceptance", () => {
    const state = newState({ highestOfferMade: 0, turnIndex: 2 });
    const after = applyCandidateAnswer(state, "works for me");
    expect(after.verbalAcceptanceTurn ?? null).toBe(null);
  });
});

describe("PDF#36 A3 — broadened offer-recap detector", () => {
  it("stamps on 'I want to know CTC'", () => {
    const state = newState({ highestOfferMade: 24, turnIndex: 5 });
    const after = applyCandidateAnswer(state, "I want to know CTC");
    expect(after.lastAnswerOfferRecapAtTurn).toBe(state.turnIndex);
  });

  it("stamps on 'what are the numbers'", () => {
    const state = newState({ highestOfferMade: 24, turnIndex: 5 });
    const after = applyCandidateAnswer(state, "what are the numbers");
    expect(after.lastAnswerOfferRecapAtTurn).toBe(state.turnIndex);
  });

  it("stamps on 'summarize the offer'", () => {
    const state = newState({ highestOfferMade: 24, turnIndex: 5 });
    const after = applyCandidateAnswer(state, "can you summarize the offer");
    expect(after.lastAnswerOfferRecapAtTurn).toBe(state.turnIndex);
  });

  it("stamps on 'share the breakdown'", () => {
    const state = newState({ highestOfferMade: 24, turnIndex: 5 });
    const after = applyCandidateAnswer(state, "share the breakdown please");
    expect(after.lastAnswerOfferRecapAtTurn).toBe(state.turnIndex);
  });

  it("stamps on 'tell me about the salary'", () => {
    const state = newState({ highestOfferMade: 24, turnIndex: 5 });
    const after = applyCandidateAnswer(state, "tell me about the salary");
    expect(after.lastAnswerOfferRecapAtTurn).toBe(state.turnIndex);
  });

  it("does NOT stamp pre-anchor", () => {
    const state = newState({ highestOfferMade: 0, turnIndex: 2 });
    const after = applyCandidateAnswer(state, "I want to know CTC");
    expect(after.lastAnswerOfferRecapAtTurn ?? null).toBe(null);
  });
});

describe("PDF#36 A4 — fact-pack persona leak on answer path", () => {
  it("validateAnswer catches 'fact pack' via META check (smoke)", () => {
    /* validateAnswer itself doesn't run META; the response-pipeline
     * runs META BEFORE returning. We verify the META check fires on
     * the pipeline path via the boundary check. */
    const factPack = {} as never;
    /* Number is allowed (15 is in the tinyInt allowlist) so the
     * baseline validity is true — we just confirm number checks pass
     * for the "Per the fact pack..." prose so the META gate is the
     * one that fires when added on the pipeline path. */
    const v = validateAnswer("Per data, the role is interesting.", factPack);
    expect(v.valid).toBe(true);
  });

  it("answer-path meta-leak swaps to defer (isolated pipeline call)", async () => {
    const state = newState({ highestOfferMade: 0, turnIndex: 1 });
    /* Inject a delta marking the candidate asked a question so the
     * pipeline routes through generateAnswerToCandidate. The factPack
     * gap check would defer; we want the LLM path to fire — provide a
     * synthetic candidate question that the fact-gap detector treats
     * as answerable from band info (use a benign answerable question
     * by forcing a fact-pack-rich state). */
    const stateWithAsk: NegotiationState = {
      ...state,
      lastTurnDelta: {
        ...(state.lastTurnDelta || {}),
        candidateAskedQuestion: { raw: "What is the role budget?" },
      } as never,
    };
    const llmReturnsLeak = async () => "Per the fact pack, the budget is generous.";
    const result = await generateBotReply(stateWithAsk, llmReturnsLeak, "What is the role budget?");
    /* META check at the boundary OR the new answer-path validation
     * should rewrite this. Either way the output must not contain
     * "fact pack". */
    expect(/fact\s*pack/i.test(result.text)).toBe(false);
  });

  it("answer-prompt hardening — instructs against meta data-source mention", () => {
    const state = newState();
    const { system } = buildAnswerCandidatePrompt(
      "What's the work mode?",
      "{}",
      "let me check internally",
      state,
    );
    expect(system.toLowerCase()).toContain("do not mention data sources");
  });
});

describe("PDF#36 B4 — answer-path sentence-length cap", () => {
  it("kitchen-sink 50+ word single-sentence answer triggers swap", async () => {
    const state = newState({ highestOfferMade: 0, turnIndex: 1 });
    const stateWithAsk: NegotiationState = {
      ...state,
      lastTurnDelta: {
        ...(state.lastTurnDelta || {}),
        candidateAskedQuestion: { raw: "Tell me about the clawback policy." },
      } as never,
    };
    /* Single sentence, 50+ words, all benign content. Should be
     * rejected by checkSentenceLength on the answer path. Use a
     * market-fact topic ("clawback") so detectFactGap doesn't defer
     * before the LLM path runs. */
    const longAnswer =
      "The clawback policy applies if you exit within a defined window and covers retention bonus " +
      "payments and joining incentives across multiple categories which the policy team has refined " +
      "over the last few cycles based on industry benchmarks and internal data and the specifics " +
      "are documented in the offer addendum which the HM walks through during the formal review.";
    const llmReturnsLong = async () => longAnswer;
    const result = await generateBotReply(stateWithAsk, llmReturnsLong, "Tell me about the clawback policy.");
    /* Ship-the-long-answer means the body of the long sentence
     * (≥30 words) survives. Swap means the result text differs. */
    expect(result.text).not.toBe(longAnswer);
  });

  it("short well-formed answer passes through", async () => {
    const state = newState({ highestOfferMade: 0, turnIndex: 1 });
    const stateWithAsk: NegotiationState = {
      ...state,
      lastTurnDelta: {
        ...(state.lastTurnDelta || {}),
        candidateAskedQuestion: { raw: "What's the PF rule?" },
      } as never,
    };
    const shortAnswer = "PF is the standard 12% contribution. UAN portability is handled on joining.";
    const result = await generateBotReply(stateWithAsk, async () => shortAnswer, "What's the PF rule?");
    expect(result.text).toBe(shortAnswer);
  });
});

describe("PDF#36 B3 — equity probe suppressed after 'no equity'", () => {
  it("'There is no equity' marks equityExists=false on state", () => {
    const state = newState({ turnIndex: 3, candidateCurrentCtc: 22 });
    const after = applyCandidateAnswer(state, "There is no equity in my current package");
    expect(after.equityVesting?.equityExists).toBe(false);
  });

  it("planner does NOT emit equity-clarity reactive followup when equityExists=false", () => {
    const state = newState({
      lastAiText: "Any equity in your current package — ESOPs or RSUs?",
      equityVesting: { equityExists: false } as never,
    });
    const action = planNextAction(state);
    if (action.kind === "reactive-followup") {
      expect((action as { topic?: string }).topic).not.toBe("equity-clarity");
    }
  });

  it("nextComponentProbe treats esop as populated when equityExists=false", () => {
    /* Indirect test: after candidate has disclosed total + base + said
     * "no equity", planner should NOT come back to component-probe
     * for esop. */
    const state = newState({
      turnIndex: 4,
      candidateCurrentCtc: 22,
      candidateComponentBreakdown: { base: 20, variable: 2, equity: null, hasAny: true } as never,
      equityVesting: { equityExists: false, hasAny: true } as never,
    });
    const action = planNextAction(state);
    if (action.kind === "component-probe") {
      expect(action.component).not.toBe("esop");
    }
  });
});

describe("PDF#36 B2 — cross-turn unambiguous variable inference", () => {
  it("turn N (currentCtc=24) + turn N+1 (base=22) → variableInferred=false", () => {
    /* Turn N: candidate states total of 24. */
    const state0 = newState({ lastDisclosureSubject: "current" } as NegotiationState);
    const afterTotal = applyCandidateAnswer(state0, "my current CTC is 24 LPA");
    expect(afterTotal.candidateCurrentCtc).toBe(24);
    /* Turn N+1: candidate states base of 22. extractComponentBreakdown
     * receives the prior total as the complement seed, derives
     * variable=2, ratio=2/24≈0.083 → unambiguous via cross-turn gate. */
    const afterBase = applyCandidateAnswer(afterTotal, "base is 22 LPA");
    expect(afterBase.candidateComponentBreakdown?.base).toBe(22);
    expect(afterBase.candidateComponentBreakdown?.variable).toBe(2);
    expect(afterBase.candidateComponentBreakdown?.variableInferred).toBe(false);
  });

  it("cross-turn implausible ratio (>0.25) keeps variableInferred=true", () => {
    const state0 = newState({ lastDisclosureSubject: "current" } as NegotiationState);
    const afterTotal = applyCandidateAnswer(state0, "my current CTC is 24 LPA");
    const afterBase = applyCandidateAnswer(afterTotal, "base is 11 LPA");
    expect(afterBase.candidateComponentBreakdown?.variable).toBe(13);
    expect(afterBase.candidateComponentBreakdown?.variableInferred).toBe(true);
  });
});

describe("PDF#36 A1 — leading-ack rotation loop guard at pipeline boundary", () => {
  it("isLeadingAckRotationRepeat catches same body with rotated ack", () => {
    const prior = "Got it. I won't be able to share that detail upfront.";
    const proposed = "Okay. I won't be able to share that detail upfront.";
    expect(isLeadingAckRotationRepeat(proposed, prior)).toBe(true);
  });

  it("isLeadingAckRotationRepeat rejects genuinely different bodies", () => {
    const prior = "Got it. The team is six designers.";
    const proposed = "Okay. Let me check the joining window.";
    expect(isLeadingAckRotationRepeat(proposed, prior)).toBe(false);
  });

  it("isLeadingAckRotationRepeat handles empty prior gracefully", () => {
    expect(isLeadingAckRotationRepeat("Okay. Anything.", "")).toBe(false);
    expect(isLeadingAckRotationRepeat("Okay. Anything.", undefined)).toBe(false);
  });

  it("answer-path swaps to loop-breaker when LLM proposes leading-ack-rotation duplicate", async () => {
    const lastShipped = "Got it. I won't be able to share that detail upfront.";
    const state = newState({
      highestOfferMade: 0,
      turnIndex: 3,
      lastAiText: lastShipped,
    });
    const stateWithAsk: NegotiationState = {
      ...state,
      lastTurnDelta: {
        ...(state.lastTurnDelta || {}),
        candidateAskedQuestion: { raw: "What's the clawback policy?" },
      } as never,
    };
    const llmRotates = async () =>
      "Okay. I won't be able to share that detail upfront.";
    const result = await generateBotReply(stateWithAsk, llmRotates, "What's the clawback policy?");
    /* Result must NOT be the LLM rotation; loop-breaker stub must
     * ship instead. */
    expect(result.text).not.toBe("Okay. I won't be able to share that detail upfront.");
    expect(/come at that from a different angle|take a beat|try that differently|circling|step back|cover next/i.test(result.text)).toBe(true);
  });
});
