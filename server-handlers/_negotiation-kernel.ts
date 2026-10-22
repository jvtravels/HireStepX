/* HireStepX — Salary Negotiation Canonical State Kernel
 * ─────────────────────────────────────────────────────────────────────
 * The static 7-anchor script + regex transcript re-parsing + LLM echo
 * guards + post-hoc clamp layers — the legacy architecture — have
 * produced the same bug class over and over: state drift between the
 * three subsystems (script slot index, regex-extracted "current facts",
 * LLM-generated text). Every patch is a regex addition or guard
 * tightening that closes one crack and opens another.
 *
 * This module is the replacement: a single, authoritative
 * NegotiationState that the engine owns and mutates ONLY through
 * pure transition functions defined here. The LLM is downstream — it
 * receives state, returns text, and never sets state. Facts are folded
 * into state ONCE per turn (when the candidate's answer arrives), not
 * re-parsed every render.
 *
 * Design rules:
 *   1. State is the source of truth. The transcript is a render artefact.
 *   2. Transitions are pure functions. No LLM, no IO, no clock — all
 *      injected if needed. Same input → same output, always.
 *   3. Terminal phases are sticky. accepted / walked-away / stalemate
 *      never transition back.
 *   4. Numbers come from `band` and `state.highestOfferMade`. The LLM
 *      cannot invent a counter — its text is post-validated against
 *      the AiMove returned by pickAiMove(state).
 *   5. Backwards compatibility: this module is unused at runtime until
 *      a route handler (Ship 2) and the engine flag (Ship 3) are wired.
 *      Ship 1 establishes the data model only — tests cover transitions
 *      end-to-end without touching production code paths.
 *
 * Naming note: the existing `_negotiation-state.ts` covers a narrower
 * concern (per-turn intent classification — accepted/rejected/walking/
 * deflected). This kernel is the canonical session-long state object;
 * the intent classifier feeds into it. Keeping them separate so the
 * intent regexes stay reviewable in isolation.
 */

import type { RecruiterSectorPersona } from "./_indian-recruiter-personas";
import type { RecruiterMood } from "./_recruiter-prose-realism";
import type { TimeContext } from "./_recruiter-time-context";
import { ROUND_PERSONA_SEQUENCE } from "./_negotiation-rounds";

export { assertNever, isDiscoveryTopic, isTerminalPhase, canTransitionPhase } from "./_negotiation-vocab";
export type { DiscoveryTopic, NegotiationPhase, NegotiationLever, NegotiationBand } from "./_negotiation-vocab";
export { applyPersonaToBand, applyDifficultyToBand, computeRecruiterPower } from "./_negotiation-state-types";
export type { InfoIntent, VossTactic, MarketMode, RecruiterPersona, SessionDifficulty, NegotiationState, AffinityReason, AffinityLedgerEntry, UserClaimRecord, UserClaims, PriorContext, PowerSignals, ContradictionTopic, ContradictionSignal } from "./_negotiation-state-types";
export { EMPTY_TURN_DELTA, computeTurnDelta, effectiveAnchorLpa, lockAnchor, clampAnchorAgainstCandidateAsk } from "./_negotiation-turn-delta";
export type { TurnDelta } from "./_negotiation-turn-delta";
export { initState, deriveDefaultPerRoundBand, maybeAdvanceRound, detectExplicitDecline, FLAT_ACK_RE, isFlatAck, canDiscloseSpecificNumber, statedTotalTargetCtcLpa, effectiveTargetCtcLpa, totalScopedCounter, detectCurrentEmployer, detectConsecutiveDeadEnd, isOfferOnTable, canCloseSession } from "./_negotiation-factory";
export type { InitStateInput, InitStateExtras } from "./_negotiation-factory";
export { MAX_INR_LPA, MAX_NOTICE_DAYS, MAX_GAP_MONTHS, clampInr, clampNoticeDays, clampGapMonths, parseCandidateAnswer } from "./_negotiation-parse";
export type { ParsedAnswer } from "./_negotiation-parse";
export { bandAcceptOfferFloor, applyCandidateAnswer, foldFactsIntoState } from "./_negotiation-apply-answer";
export { derivePhase, clampToCloseFloor, CONVERSATION_LOG_CAP, applyAiMove } from "./_negotiation-moves";
export type { AiMove } from "./_negotiation-moves";
export { validateComponentConstraints, findOutOfBandNumber, isVerbatimRepeat, KERNEL_STATE_VERSION, serializeState, validateState, deserializeState } from "./_negotiation-serialize";
export type { ComponentConstraintReason, ComponentConstraintResult } from "./_negotiation-serialize";

/* Re-export so test fixtures and downstream callers can read the type
 * straight off the kernel barrel (qa-120-matrix.test.ts and others). */
export type { RecruiterSectorPersona };
/* Re-export the mood type alongside the persona for the same reason. */
export type { RecruiterMood };
export type { TimeContext };

/* Exported for the round-aware persona sequence helper used by tests
 * and Session B downstream consumers. */
export { ROUND_PERSONA_SEQUENCE };

/** pickAiMove was extracted to _kernel-move-picker.ts on 2026-05-14
 *  (kernel split refactor). Re-exported here so every existing caller
 *  continues to `import { pickAiMove } from "./_negotiation-kernel"`
 *  unchanged. See _kernel-move-picker.ts for rationale + dependency edges. */
export { pickAiMove } from "./_kernel-move-picker";
