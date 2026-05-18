/* PDF#32 BUG H regression (2026-05-18) — unparseable / noise candidate
 * answer caused askedTopics to advance past a topic the candidate
 * never addressed, which downstream triggered a fabricated-disclosure
 * restyle (BUG G) and an abrupt session end.
 *
 * Symptom (PDF#32, Meesho/Prita T18→T19):
 *   Bot: "Got it on the total — what's the base split?"
 *   Candidate: "audible" (STT artifact, not real speech)
 *   Bot: "Thanks for that — ESOPs do kick in, but there's a vesting
 *        cliff as per company policy." (jumped past base to esop)
 *   Session terminated abruptly.
 *
 * Architectural fix in _negotiation-kernel.ts applyCandidateAnswer:
 *   1. NOISE_ANSWER_RE detects the well-bounded set of stage-direction
 *      artifacts ("audible", "inaudible", "[noise]", "[unclear]",
 *      "<silence>", "...", "—" alone, empty after trim).
 *   2. When noise detected, the askedTopics TAIL entry pushed in the
 *      prior AI turn is popped — so the planner re-fires that probe
 *      next turn instead of advancing.
 *   3. state.lastAnswerNoiseAtTurn stamped for diagnostics.
 *
 * Real terse answers ("yes", "no", "k", "fine", numbers) are NOT
 * matched — those are legitimate signal.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  applyCandidateAnswer,
  type NegotiationBand,
  type NegotiationState,
} from "../../../server-handlers/_negotiation-kernel";

const BAND: NegotiationBand = {
  initialOffer: 30,
  maxStretch: 45,
  walkAway: 25,
  hasEquity: true,
};

const newState = (overrides: Partial<NegotiationState> = {}): NegotiationState => ({
  ...initState({
    sessionId: "pdf32-bugH",
    role: "Senior Product Designer",
    company: "Meesho",
    band: BAND,
  }),
  ...overrides,
});

describe("PDF#32 BUG H — noise candidate answer rewinds askedTopics tail", () => {
  it("'audible' (stage-direction STT artifact) is detected as noise", () => {
    const state = newState({
      turnIndex: 3,
      askedTopics: [
        { topic: "currentCtcAsked", atTurn: 1 },
        { topic: "currentCtcBase", atTurn: 3 },
      ],
    });
    const next = applyCandidateAnswer(state, "audible");
    expect(next.lastAnswerNoiseAtTurn).toBe(3);
    /* Tail popped — base probe will re-fire next planner call. */
    expect(next.askedTopics?.map((t) => t.topic)).toEqual(["currentCtcAsked"]);
  });

  it("'inaudible' and bracket-wrapped transcription tags are noise", () => {
    const variants = ["inaudible", "[noise]", "[unclear]", "[silence]", "<silence>", "[crosstalk]"];
    for (const v of variants) {
      const state = newState({
        turnIndex: 5,
        askedTopics: [{ topic: "currentCtcEsop", atTurn: 5 }],
      });
      const next = applyCandidateAnswer(state, v);
      expect(next.lastAnswerNoiseAtTurn).toBe(5);
      expect(next.askedTopics).toEqual([]);
    }
  });

  it("empty / whitespace-only answer is noise", () => {
    const state = newState({
      turnIndex: 2,
      askedTopics: [{ topic: "currentCtcBase", atTurn: 2 }],
    });
    const next = applyCandidateAnswer(state, "   ");
    expect(next.lastAnswerNoiseAtTurn).toBe(2);
    expect(next.askedTopics).toEqual([]);
  });

  it("ellipsis-only / dash-only answer is noise", () => {
    for (const noise of ["...", "....", "—", "——", "--"]) {
      const state = newState({
        turnIndex: 4,
        askedTopics: [{ topic: "currentCtcBase", atTurn: 4 }],
      });
      const next = applyCandidateAnswer(state, noise);
      expect(next.lastAnswerNoiseAtTurn).toBe(4);
      expect(next.askedTopics).toEqual([]);
    }
  });

  it("rewind is scoped to last-turn tail only — older asked-topics preserved", () => {
    /* Older topic was asked at turn 1 and answered; current noise turn
     * 5 shouldn't wipe history. */
    const state = newState({
      turnIndex: 5,
      askedTopics: [
        { topic: "currentCtcAsked", atTurn: 1 },
        { topic: "currentCtcBase", atTurn: 5 },
      ],
    });
    const next = applyCandidateAnswer(state, "audible");
    expect(next.askedTopics).toEqual([{ topic: "currentCtcAsked", atTurn: 1 }]);
  });

  it("rewind is a no-op when tail.atTurn != current state.turnIndex", () => {
    /* Asked at turn 2, candidate gave a real answer (parsed and
     * advanced state to turn 4), then a later turn fires noise on a
     * different probe — only the matching tail should pop, not the
     * stale entry. */
    const state = newState({
      turnIndex: 4,
      askedTopics: [
        { topic: "currentCtcBase", atTurn: 2 }, // already answered earlier
      ],
    });
    const next = applyCandidateAnswer(state, "audible");
    /* Tail.atTurn (2) != state.turnIndex (4), so do not pop. */
    expect(next.askedTopics).toEqual([{ topic: "currentCtcBase", atTurn: 2 }]);
    expect(next.lastAnswerNoiseAtTurn).toBe(4);
  });

  it("legitimate terse answers ('yes', 'no', 'k', '24L') are NOT noise", () => {
    for (const real of ["yes", "no", "k", "fine", "24L", "ok", "sure", "30 LPA", "no esops"]) {
      const state = newState({
        turnIndex: 3,
        askedTopics: [{ topic: "currentCtcBase", atTurn: 3 }],
      });
      const next = applyCandidateAnswer(state, real);
      expect(next.lastAnswerNoiseAtTurn ?? null).toBe(null);
      /* Tail preserved — answer was real signal. */
      expect(next.askedTopics?.length).toBe(1);
    }
  });

  it("Prita full replay: base probe re-fires after 'audible' instead of jumping to esop", () => {
    /* Simulate the exact T18→T19 flow: total-CTC answered, base probe
     * asked, candidate noise. Verify state goes back to "base not
     * asked" so planner re-fires base, NOT esop. */
    let state = newState();
    /* Manually stamp the prior probe ledger to match what applyAiMove
     * would have written after the bot emitted "what's the base split?". */
    state = {
      ...state,
      turnIndex: 3,
      candidateCurrentCtc: 24,
      askedTopics: [
        { topic: "currentCtcAsked", atTurn: 1 },
        { topic: "currentCtcBase", atTurn: 3 },
      ],
    };
    const next = applyCandidateAnswer(state, "audible");
    const topics = (next.askedTopics ?? []).map((t) => t.topic);
    expect(topics).toEqual(["currentCtcAsked"]);
    expect(topics).not.toContain("currentCtcBase");
    expect(topics).not.toContain("currentCtcEsop");
  });
});
