/* Next-action planner — extracted from _kernel-move-picker.ts on 2026-05-15.
 *
 * Why a separate file (negotiation-flow redesign commit 3):
 *   - Pre-extraction, "what should the bot ask/do next?" was computed at
 *     five sites that fed text downstream without converging:
 *       (1) pickAiMoveCore opening branch (move-picker) — calls
 *           getNextOrderedDiscoveryItem, writes prompt into move.rationale.
 *       (2) pickAiMoveCore offer-presented branch — calls
 *           getNextDiscoveryQuestion (non-ordered) — a DIFFERENT helper.
 *       (3) compactTurnBrief [NEXT REQUIRED ACTION] — also calls
 *           getNextDiscoveryQuestion (non-ordered), so the brief line and
 *           the rationale can name two different next items on the same
 *           turn.
 *       (4) [HIKE JUSTIFICATION REQUIRED] — independent probe with its
 *           own role-specific prompt, layered on top of (3).
 *       (5) [PHASE RULE: disclose RANGE] — can fire alongside an
 *           open-with-offer rationale, giving the LLM contradictory
 *           directives.
 *
 * After this commit:
 *   - planNextAction(state) → NextAction is the SINGLE source of truth.
 *   - pickAiMoveCore shrinks to: planNextAction(state) then actionToLever.
 *   - compactTurnBrief reads plannedNextAction off state (cached on the
 *     post-applyCandidateAnswer state) so the brief and the rationale
 *     name THE SAME thing — they cannot diverge.
 *
 * Why bit-identical:
 *   - Each return branch from the original pickAiMoveCore is ported as a
 *     NextAction kind. The guard predicate stays intact; the AiMove
 *     construction stays intact. The NextAction carries the constructed
 *     AiMove inline (in __move), so actionToLever is a trivial lookup —
 *     no opportunity for divergence. The kind discriminator is for
 *     external consumers (brief, validators, decision log).
 *
 * Pure. No clock, no IO, no LLM.
 */

import { registerNextActionPlanner } from "./_planner-registry";
import { planNextAction, actionToLever } from "./_planner-core";
import type { NegotiationState } from "./_negotiation-kernel";
import type { NextAction } from "./_planner-actions";

export { planNextAction, actionToLever } from "./_planner-core";
export { nearOfferCloseNumber, parseCashIncreaseIntent, fixedScopedCloseTotal, undeliverableFixedConditionAsk, fixedConditionBlocksClose, MIN_COUNTER_ROUNDS_BEFORE_HOLD_FIRM, clampAnchorAboveDisclosed, clampOpeningAnchor } from "./_planner-close";
export type { CashIncreaseIntent } from "./_planner-close";
export { deriveOfferFixedVariable } from "./_planner-reactive";
export { REFIREABLE_TOPICS, canRefire, defensiveLadderStep, PROBE_PRODUCING_KINDS } from "./_planner-actions";
export type { SatisfiesTopic, NextAction, TacticKind } from "./_planner-actions";
export { STALL_SESSION_CAP, STALL_PROBABILITY_GATE } from "./_planner-flavor";
export { maybePlanPriorContextAction, maybePlanCallbackPriorContext, maybePlanCompetingOfferWarmAck, maybePlanTacticInject, detectUserCaughtTactic } from "./_planner-tactics";
export { shouldFireCtcInflationAnchor, planCtcInflationAnchor, detectInHandFollowupAfterInflation, detectOfferBreakdownRequest, planCtcInflationTruth, planOfferBreakdown } from "./_planner-inflation";

/* F2 fallback prose was removed in the kernel-first cleanup
 * (2026-05-16). The kernel-first pipeline (planNextAction →
 * renderCanonicalProse → LLM restyle) shipped the canonical line
 * directly on restyle failure, so the F2 substitution layer became
 * unreachable. `renderCanonicalProse` (in _canonical-prose.ts) is the
 * sole deterministic fallback now.
 */

/* Commit 4 (2026-05-15) — register with the planner-registry so the
 * kernel's applyCandidateAnswer can stamp state.plannedNextAction
 * without an import cycle. The registry breaks the kernel↔planner
 * load-order cycle (kernel and planner both depend on the registry;
 * registry depends on neither). Replaces the prior commit 3 globalThis
 * workaround. Side-effect at module load; idempotent. */
registerNextActionPlanner(
  (s) => planNextAction(s as NegotiationState),
  (a, s) => actionToLever(a as NextAction, s as NegotiationState),
);

/** Audit fix (2026-05-22) — breakdown/recap request regex, shared by the
 *  inflation-truth branch AND the new wider offer-breakdown disclosure
 *  branch. Matches all real-world phrasings: "in-hand", "breakdown",
 *  "what is base, variable, bonus", "summarize the offer", "split",
 *  "components", "structure of the offer", "recap".
 *
 *  Deliberately omits bare `\bbreakup\b` — "I've reviewed the breakup"
 *  is a past-tense observation, not an information request, and was
 *  false-firing on the happy-path E2E T5 (candidate counters on fixed,
 *  the planner read it as "ship a breakdown" and routed to inflation-
 *  truth with numbers below the band floor). The deeper anchor here:
 *  bare nouns are ambient, request VERBS (share, give, can you,
 *  what's, summarize) are what mark intent.
 *
 *  PDF#51 (2026-05-28) — the regex now lives in `_question-router.ts`
 *  as `BREAKDOWN_ASK_RE` so the unified router and the legacy helper
 *  share one source of truth. The re-export below keeps the existing
 *  public name + import sites stable. */
export { BREAKDOWN_ASK_RE as BREAKDOWN_REQUEST_RE } from "./_question-router";
