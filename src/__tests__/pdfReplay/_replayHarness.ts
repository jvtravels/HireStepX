/* Month 3 PR-1 (PDF #28) — PDF-replay harness.
 *
 * Drives a stored candidate-turn sequence through the kernel + planner
 * the same way the live engine does (applyCandidateAnswer → pickAiMove
 * → applyAiMove), and returns the final NegotiationState. The state
 * carries everything Month 1/2 made readable:
 *   - ledger (current-ctc / current-company / competing-offer facts)
 *   - decisionLog with actionKind + family + guardrailFlags per turn
 *   - askedTopics, phase machine, offers, etc.
 *
 * Tests written against this harness express PDF-audit regressions as
 * one-line assertions over the final state:
 *
 *   const state = replayTranscript(FIX);
 *   expect(countGuardrailFlag(state, "pressure-repeat")).toBe(0);
 *   expect(getFact(state.ledger!, "current-ctc")).toBe(14);
 *
 * The harness is intentionally minimal — it does NOT mock the LLM. The
 * planner's behavior under candidate input is what we're testing. The
 * `aiText` field on each turn is the AI's literal response to be folded
 * back into transcript state (used by applyAiMove's transcript-pushing
 * side effect); it does NOT influence the next planner pick. */

import {
  initState,
  applyCandidateAnswer,
  pickAiMove,
  applyAiMove,
  type NegotiationBand,
  type NegotiationState,
} from "../../../server-handlers/_negotiation-kernel";

/* One turn of replay: the candidate's utterance + (optionally) the
 * AI's verbatim response. When aiText is omitted the harness uses the
 * picked move's rationale as a placeholder — the kernel only reads the
 * string for transcript bookkeeping, not for routing decisions. */
export type ReplayTurn = {
  candidate: string;
  aiText?: string;
};

export type ReplayInit = {
  sessionId: string;
  role: string;
  company: string;
  band: NegotiationBand;
};

export type ReplayInput = {
  init: ReplayInit;
  turns: ReplayTurn[];
};

/** Drive an entire stored transcript through the kernel and return the
 *  final state. Pure modulo `pickAiMove`'s decisionLog appending (which
 *  is exactly the state we want recorded for assertions). */
export function replayTranscript(input: ReplayInput): NegotiationState {
  let state = initState(input.init);
  for (const turn of input.turns) {
    state = applyCandidateAnswer(state, turn.candidate);
    const move = pickAiMove(state);
    state = applyAiMove(state, move, turn.aiText ?? move.rationale ?? "");
  }
  return state;
}

/** Convenience: replay only the candidate turns up to but NOT including
 *  the indexed turn. Useful for "what would the planner do here?"
 *  isolation tests where we want to inspect the picked move at turn N
 *  without folding in the actual AI response. */
export function replayUpTo(
  input: ReplayInput,
  turnIndex: number,
): NegotiationState {
  return replayTranscript({
    init: input.init,
    turns: input.turns.slice(0, turnIndex),
  });
}

/** Common default band for PDF replay fixtures so each fixture file
 *  doesn't repeat the boilerplate. Matches the "₹24L initial / ₹30L
 *  stretch / ₹20L walkaway" shape used across the existing kernel
 *  test fixtures. */
export const DEFAULT_BAND: NegotiationBand = {
  initialOffer: 24,
  maxStretch: 30,
  walkAway: 20,
  hasEquity: false,
};

/** Helper to construct the init bag for a PDF fixture in one line. */
export function pdfReplayInit(sessionId: string): ReplayInit {
  return {
    sessionId,
    role: "Software Engineer",
    company: "JP Morgan",
    band: DEFAULT_BAND,
  };
}
