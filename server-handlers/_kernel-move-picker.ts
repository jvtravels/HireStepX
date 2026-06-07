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
import { familyOf } from "./_action-families";

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
  /* Month 2 PR-2 (2026-06-07) — stamp the family classification at the
   * planner exit boundary. Single site so the 37 inline AiMove
   * construction sites in _next-action-planner.ts don't each need to
   * set move.family. familyOf returns "unmapped" for any actionKind
   * not in KIND_TO_FAMILY — surface it on the move so telemetry can
   * spot taxonomy drift. Does not overwrite an explicitly-set family
   * (defensive for future call sites that pre-stamp). */
  if (move.actionKind && move.family === undefined) {
    move.family = familyOf(move.actionKind);
  }
  /* Architectural bug-prevention (2026-05-15) — append to decision log. */
  if (!state.decisionLog) state.decisionLog = [];
  /* M2 PR-3 (2026-06-07) — family-level guardrail check, BEFORE pushing
   * the new entry so the lookback at decisionLog[n-1] sees the prior
   * turn (not this one). Observability-only: we flag the rule but do
   * NOT substitute the move. Telemetry confirms how often the planner
   * actually wants to fire consecutive pressure-leverage before we
   * commit to a substitution path. */
  const guardrailFlags = checkFamilyGuardrails(state, move);
  /* lastBriefTags is filled in by compactTurnBrief which runs AFTER
   * pickAiMove (in buildAiPrompt). applyAiMove backfills the just-pushed
   * entry's briefTags from state.lastBriefTags so the log captures the
   * tags that were actually in front of the LLM on this turn. */
  state.decisionLog.push({
    turn: state.turnIndex,
    picker: classifyPicker(state, move),
    rationale: move.rationale || "",
    phase: state.phase,
    actionKind: move.actionKind,
    family: move.family,
    guardrailFlags: guardrailFlags.length > 0 ? guardrailFlags : undefined,
  });
  return move;
}

/** M2 PR-3 (2026-06-07) — family-level guardrail checks. Reads the
 *  most recent decisionLog entry and flags rule violations on the
 *  incoming move WITHOUT mutating it. Returns the list of flag strings
 *  (empty when no rules tripped).
 *
 *  Rules implemented:
 *    - "pressure-repeat" — two consecutive moves both classified as
 *      pressure-leverage family. Coercive moves back-to-back are the
 *      shape that produced the PDF#34 retention-into-exploding-offer
 *      finding; flagging here makes the pattern visible in the decision
 *      log even when the leaf actionKinds differ. */
function checkFamilyGuardrails(
  state: NegotiationState,
  move: AiMove,
): string[] {
  const flags: string[] = [];
  const log = state.decisionLog ?? [];
  const prev = log.length > 0 ? log[log.length - 1] : null;
  if (
    move.family === "pressure-leverage" &&
    prev?.family === "pressure-leverage"
  ) {
    flags.push("pressure-repeat");
  }
  return flags;
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
