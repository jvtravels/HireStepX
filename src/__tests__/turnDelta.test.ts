/* TurnDelta tests — negotiation-flow redesign commit 1 (2026-05-15).
 *
 * The kernel computes a per-turn delta inside applyCandidateAnswer
 * capturing WHAT CHANGED on the candidate's last utterance. Stored on
 * state.lastTurnDelta and cleared by applyAiMove. Pure addition — no
 * consumers in this commit, but downstream commits read it for
 * reactive routing.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  applyCandidateAnswer,
  applyAiMove,
  type NegotiationBand,
  type NegotiationState,
  type AiMove,
} from "../../server-handlers/_negotiation-kernel";

const BAND: NegotiationBand = { initialOffer: 20, maxStretch: 28, walkAway: 16, hasEquity: true };
const init = (overrides: Partial<NegotiationState> = {}): NegotiationState => ({
  ...initState({ sessionId: "s1", role: "swe", company: "acme", band: BAND }),
  ...overrides,
});

describe("TurnDelta", () => {
  it("flags disclosedExpectedCtc when candidate volunteers a target", () => {
    const s0 = init();
    const s1 = applyCandidateAnswer(s0, "I'm looking for 24 LPA");
    expect(s1.lastTurnDelta).not.toBeNull();
    expect(s1.lastTurnDelta?.disclosedExpectedCtc).toBe(true);
    /* Sanity: untouched categories stay false. */
    expect(s1.lastTurnDelta?.disclosedNoticePeriod).toBe(false);
    expect(s1.lastTurnDelta?.disclosedCompetingOffer).toBe(false);
  });

  it("flags askedQuestion when the candidate utterance contains a '?'", () => {
    const s0 = init();
    const s1 = applyCandidateAnswer(s0, "Can you share the breakdown?");
    expect(s1.lastTurnDelta?.askedQuestion).toBe(true);
  });

  it("clears lastTurnDelta to null on applyAiMove", () => {
    const s0 = init();
    const s1 = applyCandidateAnswer(s0, "I'm looking for 24 LPA");
    expect(s1.lastTurnDelta).not.toBeNull();
    const move: AiMove = { lever: "hold-firm", rationale: "test", newTotalLpa: null };
    const s2 = applyAiMove(s1, move, "Got it — let me come back on that.");
    expect(s2.lastTurnDelta).toBeNull();
  });

  it("does NOT flag disclosedExpectedCtc on a same-value restate", () => {
    const s0 = init({ candidateTarget: 24, firstAnchoredTarget: 24 });
    const s1 = applyCandidateAnswer(s0, "As I said, I'm looking for 24 LPA");
    /* The post-state value equals the pre-state value, so the delta is
     * NOT a fresh disclosure — restates should not retrigger reactive
     * follow-ups. */
    expect(s1.lastTurnDelta?.disclosedExpectedCtc).toBe(false);
  });
});
