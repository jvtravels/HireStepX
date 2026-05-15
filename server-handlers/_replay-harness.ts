/* Replay harness — architectural bug-prevention (2026-05-15).
 *
 * Drive the kernel through a canned transcript and return the final
 * state, including the decision log. Lets us reconstruct *why* the
 * kernel moved as it did from a recorded session without needing an LLM
 * in the loop. Used by:
 *   - scripts/replay-negotiation.mts (operator tool)
 *   - replayHarness.test.ts (canary regression suite)
 *
 * The aiText we pass to applyAiMove is the recorded assistant message
 * from the transcript. The kernel's decisions are determined by the
 * candidate utterances + state shape; the recorded assistant text is
 * used only for state-side bookkeeping (anchor lock, range disclosure,
 * recruiter-fact extraction). This is sufficient to surface dead-wiring
 * bugs of the lockAnchor / buildPostAcceptanceMessage class.
 */
import {
  initState,
  applyCandidateAnswer,
  applyAiMove,
  type NegotiationState,
  type NegotiationBand,
} from "./_negotiation-kernel";
import { pickAiMove } from "./_kernel-move-picker";

export interface ReplayMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ReplayOptions {
  initOverrides?: Partial<NegotiationState>;
  sessionId?: string;
  role?: string;
  company?: string;
  band?: NegotiationBand;
}

const DEFAULT_BAND: NegotiationBand = {
  initialOffer: 18,
  maxStretch: 24,
  walkAway: 14,
  hasEquity: false,
};

/** Replay a transcript through the kernel and return final state with
 *  a populated decision log. The transcript shape mirrors what the
 *  client+server actually exchange — alternating user/assistant turns
 *  starting with a user message. The first assistant turn is treated
 *  as the kernel's "open with offer"; subsequent assistant turns are
 *  re-derived per-turn via pickAiMove. */
export async function replayTranscript(
  messages: ReplayMessage[],
  opts: ReplayOptions = {},
): Promise<NegotiationState> {
  let state: NegotiationState = initState({
    sessionId: opts.sessionId ?? "replay",
    role: opts.role ?? "Software Engineer",
    company: opts.company ?? "test-co",
    band: opts.band ?? DEFAULT_BAND,
  });
  if (opts.initOverrides) {
    state = { ...state, ...opts.initOverrides } as NegotiationState;
  }
  /* Drive turn-by-turn: each user message folds into state, then we
   * pick the AI move + apply it using the recorded assistant text
   * (if present) — same loop as scenarios.test.ts.simulateTurn. */
  let assistantCursor = 0;
  const assistantTurns = messages.filter((m) => m.role === "assistant");
  for (const msg of messages) {
    if (msg.role === "user") {
      state = applyCandidateAnswer(state, msg.content);
      const move = pickAiMove(state);
      const aiText = assistantCursor < assistantTurns.length
        ? assistantTurns[assistantCursor].content
        : (move.rationale || "");
      assistantCursor++;
      state = applyAiMove(state, move, aiText);
    }
  }
  return state;
}
