/* Move-picker — extracted from _negotiation-kernel.ts on 2026-05-14.
 *
 * Negotiation-flow redesign commit 3 (2026-05-15) — pickAiMoveCore was
 * a 700 LoC priority cascade with 15 sequential `if return` branches.
 * It is now a thin shell over _next-action-planner.ts: the planner
 * decides WHICH NextAction this turn warrants, actionToLever rebuilds
 * the AiMove. The planner is the SINGLE source of truth for "what
 * should the bot do next?" — collapsing the five prior producers
 * (move-picker opening branch, move-picker offer-presented branch,
 * compactTurnBrief [NEXT REQUIRED ACTION], hike-justification probe,
 * range-disclosure phase rule) into one declarative module.
 *
 * Why no behavior change:
 *   - Every branch from the prior pickAiMoveCore was ported into the
 *     planner with its guard predicate and AiMove construction intact.
 *     The planner returns a NextAction discriminator AND the
 *     constructed AiMove inline; actionToLever just reads that move.
 *     There is no rebuild step that could drift — the same code that
 *     decides the kind also builds the move.
 *   - classifyPicker still operates over the resulting AiMove +
 *     rationale, so decisionLog picker names remain stable.
 *
 * What's still here:
 *   - pickAiMove (the public entry point) — appends decisionLog entries.
 *   - classifyPicker — derives the stable picker-name from the move.
 *
 * What moved to _next-action-planner.ts:
 *   - The priority cascade itself.
 *   - pickLeverExploreMove + computeJoiningBonusAmount.
 */

import {
  type NegotiationState,
  type AiMove,
} from "./_negotiation-kernel";
import {
  planNextAction,
  actionToLever,
  type NextAction,
} from "./_next-action-planner";

/** Architectural bug-prevention (2026-05-15) — classify the picker branch
 *  from the move + state. Read off move.lever and rationale fragments the
 *  branches above already produce; lets the decision log carry a stable
 *  picker name independent of internal branching. Pure. */
function classifyPicker(state: NegotiationState, move: AiMove): string {
  const r = (move.rationale || "").toLowerCase();
  if (move.lever === "terminal-restate") return "terminal-restate";
  if (move.lever === "close-acceptance") return r.includes("guaranteed-accept") ? "guaranteed-accept" : "close-acceptance";
  if (move.lever === "close-walkaway") return r.includes("rescission") ? "rescission" : "close-walkaway";
  if (move.lever === "close-stalemate") return "close-stalemate";
  if (r.includes("probe-mismatch")) return "probe-mismatch";
  if (r.includes("range-disclosure")) return "range-disclosure";
  if (r.includes("discovery incomplete")) return "discovery-next";
  if (move.lever === "open-with-offer") return "anchor";
  if (move.lever === "probe-justification") return "probe-justification";
  if (move.lever === "counter-base") return "concession";
  if (move.lever === "hold-firm") return "hold-firm";
  if (move.lever === "benefits-summary" || move.lever === "compensation-summary" ||
      move.lever === "notice-period-summary" || move.lever === "hike-context-summary") return "info-disclosure";
  if (move.lever === "equity-grant" || move.lever === "joining-bonus" ||
      move.lever === "notice-buyout") return "lever-explore";
  return move.lever;
}

/** Pick the AI's move for this turn from state alone. Mutates
 *  `state.decisionLog` (appends one entry) and clears `state.lastBriefTags`
 *  so brief-tag attribution stays one-shot per turn. The decision-pick
 *  logic itself remains pure — the wrapper around `pickAiMoveCore` only
 *  bookkeeps. */
export function pickAiMove(state: NegotiationState): AiMove {
  const move = pickAiMoveCore(state);
  /* Architectural bug-prevention (2026-05-15) — append to decision log. */
  if (!state.decisionLog) state.decisionLog = [];
  /* lastBriefTags is filled in by compactTurnBrief which runs AFTER
   * pickAiMove (in buildAiPrompt). applyAiMove backfills the just-pushed
   * entry's briefTags from state.lastBriefTags so the log captures the
   * tags that were actually in front of the LLM on this turn. */
  state.decisionLog.push({
    turn: state.turnIndex,
    picker: classifyPicker(state, move),
    rationale: move.rationale || "",
    phase: state.phase,
  });
  return move;
}

/** Inner picker — thin shell over planNextAction + actionToLever. Pure. */
function pickAiMoveCore(state: NegotiationState): AiMove {
  /* Negotiation-flow redesign commit 3 (2026-05-15): if the planner was
   * already run on the post-applyCandidateAnswer state and cached on
   * state.plannedNextAction, reuse it — avoids a redundant re-plan and
   * guarantees the brief and the move read the SAME action. Otherwise
   * (init turn / serialized session / explicit recompute), plan now. */
  const action = (state.plannedNextAction ?? planNextAction(state)) as NextAction;
  return actionToLever(action, state);
}
