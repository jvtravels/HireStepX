/**
 * Session B (2026-05-14) — Area 7 audit.
 *
 * Terminal-phase sticky integration: once the kernel reaches a terminal
 * phase (accepted / walked-away / stalemate), the server-derived
 * `terminal` flag must remain true on every subsequent turn no matter
 * what the candidate sends, AND the kernel must not silently re-open
 * the negotiation on follow-up chit-chat.
 *
 * The UI side (src/useInterviewEngine.ts ~line 1430+) consumes
 * `result.terminal` / `result.conversationDone` and transitions the
 * engine to phase="done". The contract this test pins is:
 *
 *   For every subsequent candidate turn after acceptance:
 *     - state.phase remains "accepted"
 *     - isTerminalPhase(state.phase) === true
 *     - pickAiMove returns the "terminal-restate" lever (NOT a
 *       counter-offer or open-with-offer)
 *     - newTotalLpa stays clamped to the close floor
 *
 * Three post-acceptance turns are simulated; the invariant holds for
 * each. A follow-up "open-with-offer" or "counter" lever after
 * acceptance would be a regression.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  pickAiMove,
  applyCandidateAnswer,
  applyAiMove,
  isTerminalPhase,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";

const BAND: NegotiationBand = { initialOffer: 40, maxStretch: 55, walkAway: 30, hasEquity: true };

function newState(): NegotiationState {
  return initState({ sessionId: "term-int", role: "swe", company: "acme", band: BAND });
}

describe("terminal-phase sticky integration — multi-turn post-acceptance sequence", () => {
  it("kernel stays terminal across 3 post-acceptance turns", () => {
    let state = newState();

    /* Turn 1 — AI opens. */
    let move = pickAiMove(state);
    expect(move.lever).toBe("open-with-offer");
    state = applyAiMove(state, move, "We can offer ₹40 LPA.");

    /* Turn 2 — candidate accepts. */
    state = applyCandidateAnswer(state, "I accept the offer");
    expect(state.phase).toBe("accepted");
    move = pickAiMove(state);
    expect(move.lever).toBe("close-acceptance");
    state = applyAiMove(state, move, "Locked at ₹40 LPA.");
    expect(isTerminalPhase(state.phase)).toBe(true);

    /* Turn 3 — candidate chit-chat #1. */
    state = applyCandidateAnswer(state, "Thank you so much! When does onboarding start?");
    expect(state.phase).toBe("accepted");
    expect(isTerminalPhase(state.phase)).toBe(true);
    move = pickAiMove(state);
    expect(move.lever).toBe("terminal-restate");
    expect(move.newTotalLpa!).toBeGreaterThanOrEqual(40);
    state = applyAiMove(state, move, "Restate.");

    /* Turn 4 — candidate chit-chat #2. */
    state = applyCandidateAnswer(state, "Could you share the benefits document?");
    expect(state.phase).toBe("accepted");
    expect(isTerminalPhase(state.phase)).toBe(true);
    move = pickAiMove(state);
    expect(move.lever).toBe("terminal-restate");
    state = applyAiMove(state, move, "Restate.");

    /* Turn 5 — candidate chit-chat #3 (attempt to re-open). */
    state = applyCandidateAnswer(state, "Actually can we bump it to ₹45L?");
    expect(state.phase).toBe("accepted");
    expect(isTerminalPhase(state.phase)).toBe(true);
    move = pickAiMove(state);
    expect(move.lever).toBe("terminal-restate");
    expect(move.newTotalLpa!).toBeGreaterThanOrEqual(40);
  });

  it("walked-away stays sticky when the candidate keeps repeating walk-away phrases", () => {
    /* Note: walked-away has a documented one-way trapdoor — if the
     * candidate sends a non-walk-away engagement we reopen to counter-
     * offer (line ~1149 in _negotiation-kernel.ts). This test pins the
     * complementary path: when the candidate reinforces the walk-away,
     * the kernel must stay terminal. */
    let state = newState();
    let move = pickAiMove(state);
    state = applyAiMove(state, move, "We can offer ₹40 LPA.");
    state = applyCandidateAnswer(state, "I'm out, not interested.");
    expect(state.phase).toBe("walked-away");
    move = pickAiMove(state);
    state = applyAiMove(state, move, "Understood.");

    const walkAwayReinforcements = ["I'm out.", "Not interested.", "I'll pass."];
    for (const utt of walkAwayReinforcements) {
      state = applyCandidateAnswer(state, utt);
      expect(isTerminalPhase(state.phase)).toBe(true);
      expect(state.phase).toBe("walked-away");
    }
  });
});
