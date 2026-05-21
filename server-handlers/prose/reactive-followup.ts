/* Carved out of `_canonical-prose.ts` (2026-05-22).
 *
 * Reactive-followup arm. Topic-dispatched prose with one special-case:
 * `answer-direct` consults the candidate-question classifier and the
 * persona-aware response bank (extracted in QA v3 round 3,
 * 2026-05-19). Other topics carry deterministic prose either inline or
 * via the planner-supplied `action.ask` (sanitised before reaching
 * the candidate).
 */

import type { NegotiationState } from "../_negotiation-kernel";
import type { NextAction } from "../_next-action-planner";
import {
  classifyCandidateQuestion,
  renderCandidateQuestionResponse,
  CANDIDATE_QUESTION_GENERIC_FALLBACK,
} from "../_candidate-question";
import type { ProseHelpers } from "./_helpers";

export function proseReactiveFollowup(
  action: NextAction,
  state: NegotiationState,
  helpers: ProseHelpers,
): string {
  if (action.kind !== "reactive-followup") {
    throw new Error("proseReactiveFollowup invoked for non-reactive-followup action");
  }
  const topic = action.topic;
  if (topic === "variable-comfort") {
    return action.ask
      || "Your variable component is on the higher side — what has been your payout history, and are you comfortable with that structure continuing?";
  }
  if (topic === "competing-credibility") {
    return "On the other opportunity you mentioned — is the offer letter in hand, or is the discussion still in process?";
  }
  if (topic === "value-proof") {
    return "Sounds like the trajectory of the role matters as much as the fitment — what would make this opportunity feel worth the move for you?";
  }
  if (topic === "hike-justification") {
    return action.ask
      || "That's a meaningful jump on your current fitment — help me understand what's anchoring the expectation at that level.";
  }
  if (topic === "equity-clarity") {
    /* PDF#33 (2026-05-18) — substantive probe, not a teaser. Prior
     * prose promised a walkthrough the kernel never delivered. */
    return "On the equity piece — what's the vesting schedule and cliff on your current grant?";
  }
  if (topic === "number-clarification") {
    const n = state.candidateCurrentCtc ?? state.candidateTarget ?? null;
    return n != null
      ? `Just to be sure I noted it correctly — that's ₹${n} lakh you mentioned, na?`
      : "Just to be sure I noted it correctly — can you confirm the number you mentioned?";
  }
  if (topic === "competing-leverage-ack") {
    /* F2 (Audit Pass 2, 2026-05-16) — removed "let me make sure
     * we're broadly aligned" process-narration. */
    return "Noted on the competing opportunity. Before I revert internally — walk me through what matters most to you on this role.";
  }
  if (topic === "answer-direct") {
    /* QA v3 round 3 (2026-05-19) — extracted to a typed classifier +
     * response bank in `_candidate-question.ts`. */
    const raw = state.lastTurnDelta?.candidateAskedQuestion?.raw ?? "";
    const classified = classifyCandidateQuestion(raw);
    if (classified) {
      const prose = renderCandidateQuestionResponse(
        classified,
        helpers.sectorPersona,
        helpers.activeRoundPersona,
      );
      if (prose) return prose;
    }
    return CANDIDATE_QUESTION_GENERIC_FALLBACK;
  }
  /* ctc-gentle-push, notice-buyout, etc. carry planner-supplied ask
   * strings — use verbatim, but sanitise meta-directive tokens. */
  return helpers.sanitiseCandidateProse(action.ask) || "Can you elaborate on that a little?";
}
