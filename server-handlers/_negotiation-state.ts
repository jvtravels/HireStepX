/**
 * Typed conversation state for the salary-negotiation phase machine.
 *
 * Why this exists: follow-up.ts had grown a ladder of overrides on top
 * of a single string `salaryPhase` —
 *   1. rejectionLocksClosing  → flip closing/closing-pressure to counter
 *   2. pendingQuestionForcesOpen → flip closing back to offer-reaction
 *   3. acceptedImmediately  → permanently sticky to "closing" (helper)
 * Every new edge case added another override branch. That's the same
 * bandaid pattern the regex-stripper refactor replaced — just hidden
 * inside the handler. This module collapses the ladder into a single
 * typed reducer: derive ConvState once from explicit signals, map state
 * → phase via one table, done.
 *
 * Behavior is identical to the prior override ladder. The intent of
 * this commit is structural — make the next edge case land as a new
 * case in `deriveConvState` / `phaseForState` rather than as a 4th
 * override.
 */

/** A request the candidate made that the AI's next reply MUST address
 *  before doing anything else. */
export type PendingRequest =
  | { kind: "breakdown"; text: string }   // "give me a breakdown of ₹27"
  | { kind: "question"; text: string };   // any other explicit question/request

/** Discriminated state. `pendingRequest` rides alongside the kind so
 *  "accepted + has a pending breakdown question" is representable. */
export type ConvState =
  | { kind: "open"; pendingRequest?: PendingRequest }
  | { kind: "accepted"; pendingRequest?: PendingRequest }
  | { kind: "conditional-accept"; pendingRequest?: PendingRequest }
  | { kind: "rejected"; pendingRequest?: PendingRequest }
  | { kind: "walking"; pendingRequest?: PendingRequest }
  | { kind: "deflected"; pendingRequest?: PendingRequest }
  | { kind: "needs-time"; pendingRequest?: PendingRequest };

export interface StateSignals {
  /** Did the candidate say a literal yes on THIS turn? */
  acceptedThisTurn: boolean;
  /** Conditional acceptance ("yes IF you can add X")? */
  conditionalAccept: boolean;
  /** Rejection on THIS turn (pushback)? */
  rejectedThisTurn: boolean;
  /** Walking away on THIS turn? */
  walkAwayThisTurn: boolean;
  /** Deflecting on THIS turn ("what's your offer first")? */
  deflectedThisTurn: boolean;
  /** Asking for time? */
  needsTimeThisTurn: boolean;
  /** Sticky: did the candidate ever accept in this session? */
  acceptedEverInHistory: boolean;
  /** Candidate's latest message — used for pending-request detection. */
  answer: string;
}

// Question-marker phrases. Same set the closing-with-pending-question
// detector uses, kept aligned by importing convention rather than a
// shared constant (different shapes — this regex must match in-line).
const EXPLICIT_REQUEST_RE =
  /\b(?:can\s+you|could\s+you|would\s+you|give\s+me|share|tell\s+me|walk\s+me\s+through|break\s*down|explain|clarify|what(?:'?s|\s+is)|how\s+(?:much|does|is)|why)\b/i;

const BREAKDOWN_RE =
  /\b(?:break\s*down|breakup|components?|structure|split|how(?:'?s|\s+is)\s+(?:the|it)\s+(?:offer|package|ctc)\s+(?:structured|split)|base\s+(?:and|vs)\s+variable)\b/i;

/** Returns the candidate's pending request, if any. A pending request
 *  is a question/ask in the candidate's most recent message that the
 *  AI's next reply MUST address. Returns null for plain statements,
 *  acceptances, and deflections that don't ask for information. */
export function detectPendingRequest(answer: string): PendingRequest | null {
  if (!answer) return null;
  const trimmed = answer.trim();
  const isQuestion = /\?\s*$/.test(trimmed);
  const explicitRequest = EXPLICIT_REQUEST_RE.test(trimmed);
  if (!isQuestion && !explicitRequest) return null;
  // Distinguish breakdown asks specifically — the server has a typed
  // wantsBreakdown response path for these (templated component sums).
  if (BREAKDOWN_RE.test(trimmed)) {
    return { kind: "breakdown", text: trimmed.slice(0, 200) };
  }
  return { kind: "question", text: trimmed.slice(0, 200) };
}

/** Single source of truth for what state the conversation is in.
 *  Pure function — no I/O, no globals. Behavior preserves the prior
 *  override-ladder semantics: rejection/walk-away dominate, then
 *  acceptance (current turn OR sticky from history), else open. */
export function deriveConvState(s: StateSignals): ConvState {
  const pendingRequest = detectPendingRequest(s.answer) ?? undefined;

  // Rejection / walk-away win — even if the candidate accepted earlier
  // in the session, a fresh pushback re-opens the negotiation.
  if (s.walkAwayThisTurn) return { kind: "walking", pendingRequest };
  if (s.rejectedThisTurn) return { kind: "rejected", pendingRequest };

  // Conditional acceptance on this turn — separate state so the prompt
  // can ask for confirmation of the condition.
  if (s.conditionalAccept) return { kind: "conditional-accept", pendingRequest };

  // Acceptance (this turn OR sticky from earlier). Pending request can
  // ride alongside — this is the Morningstar T6 bug case.
  if (s.acceptedThisTurn || s.acceptedEverInHistory) {
    return { kind: "accepted", pendingRequest };
  }

  // Soft states — needs-time / deflected — still classify as open for
  // phase routing, but carry the signal so the intent banner can pick
  // the right script.
  if (s.needsTimeThisTurn) return { kind: "needs-time", pendingRequest };
  if (s.deflectedThisTurn) return { kind: "deflected", pendingRequest };

  return { kind: "open", pendingRequest };
}

/** Map ConvState + the LLM-suggested phase into the effective phase the
 *  prompt template should select. Replaces the prior 3-branch override
 *  ladder in follow-up.ts. Behavior preserved:
 *   - rejected/walking + closing-family → counter-offer
 *   - accepted with pendingRequest → offer-reaction (answer the question)
 *   - open with pendingRequest in closing-family → offer-reaction
 *   - otherwise → suggestedPhase unchanged
 */
export function phaseForState(state: ConvState, suggestedPhase: string): string {
  const isClosingFamily = suggestedPhase === "closing" || suggestedPhase === "closing-pressure";
  if (state.kind === "rejected" || state.kind === "walking") {
    return isClosingFamily ? "counter-offer" : suggestedPhase;
  }
  if (state.pendingRequest) {
    // Accepted-with-pending-Q (Morningstar T6) OR open-with-pending-Q
    // in closing-family. Both route to offer-reaction so the prompt's
    // "if they asked about breakdown: answer" branch fires.
    if (state.kind === "accepted" && state.pendingRequest) return "offer-reaction";
    if (isClosingFamily) return "offer-reaction";
  }
  return suggestedPhase;
}

/** Convenience: did the conversation reach acceptance at any point? */
export function isAcceptedState(state: ConvState): boolean {
  return state.kind === "accepted" || state.kind === "conditional-accept";
}
