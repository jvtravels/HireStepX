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

import type { NegotiationFacts } from "../src/interviewEvaluation";
import {
  type RecruiterSectorPersona,
  selectRecruiterSectorPersona,
} from "./_indian-recruiter-personas";
/* Re-export so test fixtures and downstream callers can read the type
 * straight off the kernel barrel (qa-120-matrix.test.ts and others). */
export type { RecruiterSectorPersona };
import {
  deriveRecruiterMood,
  type RecruiterMood,
  type RecruiterMoodDynamic,
} from "./_recruiter-prose-realism";
/* Re-export the mood type alongside the persona for the same reason. */
export type { RecruiterMood };
import {
  deriveTimeContext,
  type TimeContext,
} from "./_recruiter-time-context";
export type { TimeContext };
import {
  type NegotiationRoundPersona,
  selectNextRoundPersona,
  ROUND_PERSONA_SEQUENCE,
} from "./_negotiation-rounds";
import { clampBandToTierP50 } from "./_band-sanity";
import { getCompanyTier } from "../data/company-tiers";
import { classifyQuestionIntent, type QuestionIntent } from "./_question-intent";
import { classifyAcceptance, detectExplicitAcceptance } from "./_acceptance-classifier";
import { normalizeForParsing } from "./_speech-normalize";
import { classifyFromLog } from "./_candidate-register";
import { classifyCandidateArchetype } from "./_candidate-archetype";
import { classifyNumberRoles } from "./_number-role-classifier";
import { isWalkAway } from "./_walkaway-detection";
import { extractRecruiterFacts, extractRecruiterPromises, extractPromisesFulfilled } from "./_recruiter-facts";
import { extractNonSalaryConstraints, mergeNonSalaryConstraints } from "./_non-salary-constraints";
import { buildPostAcceptanceMessageChunks } from "./_post-acceptance";
import { detectInHandFraming, backComputeCtcFromInHand } from "./_in-hand-vs-ctc";
import { detectRangeDisclosure, detectTrialCloseAsked, detectTrialCloseResponse } from "./_trial-close-detector";
import {
  extractComponentBreakdown,
  mergeBreakdown,
  type ComponentBreakdown,
} from "./_component-breakdown";
import {
  extractHikeRationale,
  computeHikePercent,
  type RationaleResult,
} from "./_hike-rationale";
import {
  extractNoticeJoining,
  mergeNoticeJoining,
  type NoticeJoiningResult,
} from "./_notice-joining";
import {
  extractEquityVesting,
  mergeEquityVesting,
  type EquityVestingResult,
} from "./_equity-vesting";
import {
  extractLocationMode,
  mergeLocationMode,
  type LocationModeResult,
} from "./_location-mode";
import {
  extractCompetingOfferDetail,
  mergeCompetingOfferDetail,
  type CompetingOfferDetail,
} from "./_competing-offer-detail";
import {
  extractDecisionDeadline,
  mergeDecisionDeadline,
  type DecisionDeadlineResult,
} from "./_decision-deadline";
import {
  extractCandidateProfile,
  mergeCandidateProfile,
  detectFreshGradDisclosure,
  EMPTY_CANDIDATE_PROFILE,
  type CandidateProfileResult,
} from "./_candidate-profile";
import { resolveServerBand } from "./_band-resolver";
import {
  detectCandidateDisclosures,
  pruneAcknowledged,
} from "./_candidate-disclosure-tracker";
import {
  extractMiscSignals,
  mergeMiscSignals,
  type MiscSignalsResult,
} from "./_misc-signals";
import {
  extractCandidateStance,
  mergeCandidateStance,
  detectRecoverySignals,
  type CandidateStanceResult,
} from "./_candidate-stance";
import {
  extractSalesOTE,
  extractContractRate,
  mergeSalesOTE,
  mergeContractRate,
  EMPTY_SALES_OTE,
  EMPTY_CONTRACT_RATE,
  type SalesOTEResult,
  type ContractRateResult,
} from "./_comp-structure";
import {
  extractRetentionCounter,
  mergeRetentionCounter,
  EMPTY_RETENTION_COUNTER,
  type RetentionCounterResult,
} from "./_retention-counter";
import {
  EMPTY_DISCOVERY_CHECKLIST,
  backfillDiscoveryChecklist,
  isValidDiscoveryStage,
  isDiscoveryComplete,
  syncChecklistFromParsedFacts,
  type DiscoveryChecklist,
  type DiscoveryStage,
} from "./_discovery-stage";
import { USER_FRUSTRATION_RE } from "./_user-signals";
import { classifyRoleFamily, getBandForRole, classifyCompanyTier as classifyBandCompanyTier } from "./_company-band-tiers";
import {
  buildResumeFactPack,
  deriveCandidateProfileSeed,
  detectStatedCurrentCompany,
  resumeConfirmsCompany,
  type ResumeFactPack,
} from "./_resume-fact-pack";
import { detectResumeRoleMismatch } from "./_resume-role-match";
import { getNextActionPlanner } from "./_planner-registry";

/* ─── Commit 4 (2026-05-15) — planner-registry refactor ───────────────
 * The planner module (_next-action-planner.ts) imports value bindings
 * from this kernel; a static import the other way would create a
 * load-order cycle. We break the cycle through a third module
 * (_planner-registry.ts) that has no imports of either side. The kernel
 * READS through `getNextActionPlanner()` and the planner REGISTERS via
 * `registerNextActionPlanner(...)` at module-bottom.
 *
 * Replaces the prior commit 3 globalThis workaround (load-order kludge
 * that buried the dependency in a runtime side-effect on globalThis).
 * Same call-graph shape, properly typed module edges:
 *
 *   kernel ──▶ planner-registry ◀── planner
 *
 * The registry's getter returns null while the planner module hasn't
 * loaded yet — callers (applyCandidateAnswer's finalize()) tolerate
 * null gracefully (state.plannedNextAction stays null on that turn). */
function _callNextActionPlanner(s: unknown): unknown {
  const fn = getNextActionPlanner();
  return fn ? fn(s) : null;
}

/* ─── Discovery topics (ArchRec 2 typed enum, 2026-05-16) ─────────────
 *
 * The `askedTopic` field on AiMove flows into three different ledgers:
 *   - state.askedTopics[].topic   (F7 repetition guard)
 *   - state.reactiveFollowupsFired (single-fire reactive dedup)
 *   - state.reactiveFollowupsFireLog keys (refireable per-topic budget)
 * and is the lookup key for REFIREABLE_TOPICS in _next-action-planner.
 *
 * Before this commit the field was typed `string`, which let typos
 * silently break dedup (`"variable-confort"` would route past
 * canRefire as a fresh topic). This union enumerates every observed
 * topic literal across the three planner sites + the discovery
 * cascade + the wired-profile rules table. Three classes:
 *
 *   1. Discovery checklist keys (both *Asked + *Answered forms — the
 *      cascade emits *Asked as the public item, the ordered variant
 *      uses *Answered as the internal sentinel, and the F7 guard
 *      compares against whichever the planner pushed).
 *   2. Reactive-followup topic names (kebab-case, paired with prose
 *      branches in _canonical-prose.ts).
 *   3. Structural lever / actionKind markers that flow into the F7
 *      ledger via the `move.lever`/`move.actionKind` fallback in
 *      applyAiMove (see the fallback chain below).
 *
 * The fallback in applyAiMove still widens to string at the cast site
 * because `move.lever` is a NegotiationLever (a different union); the
 * dev-mode assertion at that one site catches additions to the lever
 * vocabulary that aren't also registered here. */
export type DiscoveryTopic =
  /* Discovery checklist — *Asked keys (emitted by getNextDiscoveryQuestion
   * and getNextOrderedDiscoveryQuestion as the public `item` value). */
  | "currentCtcAsked"
  | "fixedVariableSplitAsked"
  | "noticePeriodAsked"
  | "competingOffersAsked"
  | "valueProofAsked"
  | "targetAsked"
  /* Discovery checklist — *Answered keys (returned by
   * getNextOrderedDiscoveryItem and observed in F7 repetition-guard
   * test fixtures and applyAiMove fallback paths). */
  | "currentCtcAnswered"
  | "fixedVariableSplitAnswered"
  | "noticePeriodAnswered"
  | "competingOffersAnswered"
  | "valueProofAnswered"
  | "targetAnswered"
  | "currentCtcFixedVariableSplitDisclosed"
  | "expectedCtcFixedVariableSplitDisclosed"
  /* AP3-F2 (2026-05-17) — component-aware discovery probes. Fired by
   * the planner AFTER currentCtc is satisfied for senior comp
   * negotiations (applicableYoe >= 4 OR role matches
   * /senior|lead|principal|staff/i). Each maps to a single component of
   * the candidate's current package; parsing into
   * state.candidateComponentBreakdown is handled by the existing
   * component-breakdown extractor (extractComponentBreakdown +
   * mergeBreakdown), so satisfaction is observed by reading
   * `state.candidateComponentBreakdown.{base,variable,equity}`. */
  | "currentCtcBase"
  | "currentCtcVariable"
  | "currentCtcEsop"
  /* Reactive-followup topics (planReactiveFollowup + planWiredProfileFollowup). */
  | "variable-comfort"
  | "equity-clarity"
  | "competing-credibility"
  | "competing-leverage-ack"
  | "credibility-probe"
  | "ctc-gentle-push"
  | "hike-justification"
  | "notice-buyout"
  | "notice-buyout-confirm"
  | "number-clarification"
  | "value-proof"
  | "answer-direct"
  | "wants-higher-base"
  | "wants-joining-bonus"
  | "wants-relocation-allowance"
  | "spouse-family-context"
  | "reporting-structure"
  | "growth-path"
  | "team-size"
  | "tax-implication"
  | "bgv-concern"
  | "moonlighting-policy"
  | "range-to-point"
  | "range-deflection"
  | "market-data-reference"
  /* PDF#37 (2026-05-20) — freelancer/archetype anchor-clarify reactive
   * followup. P11_FREELANCER candidates need a rate-card probe before
   * a CTC anchor is meaningful. */
  | "anchor-clarify"
  /* Single-fire markers pushed through applyAiMove. */
  | "close-confirmation"
  | "close-recap-formal"
  | "candidate-trial-close"
  /* Audit fix (2026-05-22) — trial-close response classification.
   * Stamped by applyCandidateAnswer when the candidate replies to a
   * trial-close with a hedge or decline (not an accept). The planner
   * uses these to avoid re-asking the same trial close on the next
   * turn. */
  | "candidate-trial-close-hedge"
  | "candidate-trial-close-decline"
  | "comparative-anchoring"
  | "internal-equity-defense"
  /* Phase 3 missing-lever set (2026-05-17) — three additional Indian-HR
   * levers (stall / walkaway / hike-strong rebuttal). actionKinds are
   * registered as DiscoveryTopics so the applyAiMove F7 ledger push
   * passes the dev-only KNOWN_TOPICS guard. */
  | "panel-approval-stall"
  | "polite-walkaway"
  | "anchor-defense-hike-strong"
  /* PDF#42 BUG-A (2026-05-21) — competitor-match. AI's authoritative
   * response after the candidate proves a higher competing offer
   * (proofProvided OR letterShareOffered). Commits to taking the
   * competing number back to the panel with a revert window, instead
   * of routing through lever-explore which historically prompted the
   * candidate ("what else can we add to the fitment?"). Single-fire
   * via state.competitorMatchFiredAtTurn. */
  | "competitor-match"
  /* Phase 2 Indian-HR redesign (2026-05-17) — post-acceptance documentation
   * request actionKind. Pushed onto askedTopics via applyAiMove's F7 ledger
   * so the planner can verify single-fire (in addition to the explicit
   * postAcceptanceDocsRequestedAtTurn marker). */
  | "post-acceptance-document-request"
  /* Structural-lever actionKinds — pushed onto askedTopic by
   * makeStructuralLeverAction so applyAiMove can route them through
   * the F7 ledger uniformly. */
  | "band-anchor-with-rationale"
  /* Phase 2 Indian-HR redesign (2026-05-17) — point-offer anchor lever
   * actionKind (replaces the legacy `anchor-with-band` kind that emitted
   * a range). Single-fire per session via askedTopics ledger. */
  | "anchor-with-offer"
  | "lever-grade-upgrade"
  | "lever-retention-bonus"
  | "lever-rsu-refresh"
  | "lever-relocation"
  | "lever-perf-bonus-cadence"
  | "lever-joining-bonus-explained"
  /* NegotiationLever values (move.lever fallback in applyAiMove pushes
   * these onto state.askedTopics when no askedTopic/actionKind is set).
   * Mirrors the NegotiationLever union below so the fallback is
   * exhaustively covered by the type. */
  | "open-with-offer"
  | "probe"
  | "probe-justification"
  | "counter-base"
  | "joining-bonus"
  | "equity-grant"
  | "benefits-summary"
  | "compensation-summary"
  | "notice-period-summary"
  | "hike-context-summary"
  | "hold-firm"
  | "close-acceptance"
  | "close-walkaway"
  | "close-stalemate"
  | "terminal-restate"
  | "ctc-inflation-anchor"
  /* PDF#29 Bug 7 (2026-05-18) — frustration-recovery actionKind. Pushed
   * onto state.askedTopics by applyAiMove so the F7 ledger records the
   * single-fire emission alongside the lastUserFrustrated clear. */
  | "acknowledge-and-recover"
  /* PDF#34 Fix 3 (2026-05-18) — clarification response actionKind.
   * Pushed onto state.askedTopics by applyAiMove so the F7 ledger sees
   * the single-fire emission; the planner consults
   * lastAnswerClarificationAtTurn to decide whether to re-fire. */
  | "clarify-prior-question"
  /* Prior-context feature (2026-05-29) — caller-declared upfront
   * context shapers. Stamped through applyAiMove's askedTopics push so
   * the planner observes single-fire via reactiveFollowupsFired. They
   * are NOT discovery probes — the bot is acknowledging / reacting to
   * context the user declared at session init, not asking a fresh
   * question — so the askedTopics ledger entry doubles as a "this arm
   * fired" marker rather than a discovery-completion stamp. */
  | "acknowledge-existing-offer"
  | "acknowledge-retention-offer"
  | "match-existing-offer-prose"
  | "retention-trump-warning";

/** Exhaustiveness helper. Used in topic switches so adding a new
 *  DiscoveryTopic literal lights up at every consumer site that hasn't
 *  been updated. */
export function assertNever(x: never): never {
  throw new Error(`Unhandled discriminant: ${String(x)}`);
}

/** Dev-only guard against silent additions of unknown topic strings
 *  pushed through the `move.lever`/`move.actionKind` fallback in
 *  applyAiMove. In production we let unknown strings pass (back-compat
 *  with sessions serialized before this commit). In dev we throw so
 *  the test suite forces every new lever/actionKind that flows into
 *  the F7 ledger to be registered as a DiscoveryTopic. */
const KNOWN_TOPICS: ReadonlySet<string> = new Set<DiscoveryTopic>([
  "currentCtcAsked", "fixedVariableSplitAsked", "noticePeriodAsked",
  "competingOffersAsked", "valueProofAsked", "targetAsked",
  "currentCtcAnswered", "fixedVariableSplitAnswered", "noticePeriodAnswered",
  "competingOffersAnswered", "valueProofAnswered", "targetAnswered",
  "currentCtcFixedVariableSplitDisclosed", "expectedCtcFixedVariableSplitDisclosed",
  /* AP3-F2 (2026-05-17) — component-aware discovery topics. */
  "currentCtcBase", "currentCtcVariable", "currentCtcEsop",
  "variable-comfort", "equity-clarity", "competing-credibility",
  "competing-leverage-ack", "credibility-probe", "ctc-gentle-push",
  "hike-justification", "notice-buyout", "notice-buyout-confirm",
  "number-clarification", "value-proof", "answer-direct",
  "wants-higher-base", "wants-joining-bonus", "wants-relocation-allowance",
  "spouse-family-context", "reporting-structure", "growth-path", "team-size",
  "tax-implication", "bgv-concern", "moonlighting-policy",
  "range-to-point", "range-deflection", "market-data-reference",
  /* PDF#37 (2026-05-20). */
  "anchor-clarify",
  "close-confirmation", "close-recap-formal", "candidate-trial-close",
  "candidate-trial-close-hedge", "candidate-trial-close-decline",
  "comparative-anchoring", "internal-equity-defense", "band-anchor-with-rationale",
  "panel-approval-stall", "polite-walkaway", "anchor-defense-hike-strong",
  /* PDF#42 BUG-A (2026-05-21). */
  "competitor-match",
  "anchor-with-offer", "post-acceptance-document-request",
  "lever-grade-upgrade", "lever-retention-bonus", "lever-rsu-refresh",
  "lever-relocation", "lever-perf-bonus-cadence", "lever-joining-bonus-explained",
  "open-with-offer", "probe", "probe-justification", "counter-base",
  "joining-bonus", "equity-grant", "benefits-summary", "compensation-summary",
  "notice-period-summary", "hike-context-summary", "hold-firm",
  "close-acceptance", "close-walkaway", "close-stalemate", "terminal-restate",
  /* PDF#29 Bug 7 (2026-05-18). */
  "acknowledge-and-recover",
  /* PDF#34 Fix 3 (2026-05-18). */
  "clarify-prior-question",
  /* Prior-context feature (2026-05-29) — caller-declared upfront
   * context shapers. */
  "acknowledge-existing-offer",
  "acknowledge-retention-offer",
  "match-existing-offer-prose",
  "retention-trump-warning",
]);

export function isDiscoveryTopic(s: string): s is DiscoveryTopic {
  return KNOWN_TOPICS.has(s);
}

/* ─── Phases ──────────────────────────────────────────────────────── */

export type NegotiationPhase =
  /* Pre-offer — AI hasn't put a number on the table yet. */
  | "opening"
  /* Ordered discovery is complete but no specific anchor has been
   * disclosed yet — the AI must volunteer a salary RANGE (e.g.
   * "₹X-Y band") before converging to a single number. PDF#18
   * follow-up (2026-05-15): promoted from a soft brief-only directive
   * into a real phase enum value so the state-machine + move-picker
   * + validator enforce it. */
  | "range-disclosure"
  /* AI has presented the initial offer; candidate is reacting. */
  | "offer-presented"
  /* AI is probing candidate's target / reasoning. */
  | "probe-expectations"
  /* Candidate has anchored; AI is countering with cash levers. */
  | "counter-offer"
  /* Multiple rounds of counter exhausted base; exploring non-cash. */
  | "lever-explore"
  /* AI is pushing for close ("I need to know today"). */
  | "closing-push"
  /* Terminal — candidate accepted the offer. */
  | "accepted"
  /* Terminal — candidate walked away / rejected. */
  | "walked-away"
  /* Terminal — turn budget exhausted without resolution. */
  | "stalemate";

const TERMINAL_PHASES = new Set<NegotiationPhase>([
  "accepted",
  "walked-away",
  "stalemate",
]);
export const isTerminalPhase = (p: NegotiationPhase): boolean => TERMINAL_PHASES.has(p);

/* Negotiation-flow redesign commit 6 (2026-05-15) — phase-transition
 * monotonicity matrix (kills D6 from /tmp/negotiation-flow-audit.md).
 *
 * Phases form a one-way ratchet. Higher rank can only go higher (or stay
 * the same). Backward transitions are blocked structurally, except for
 * two LEGITIMATE re-open paths:
 *   1. walk-away-reopen — terminal `walked-away` → `counter-offer` when
 *      the candidate re-engages (the `walkAwayReturned` flag is set in
 *      applyCandidateAnswer). This is the only path out of any terminal
 *      phase and is a one-shot re-entry.
 *   2. verbal-renege — `verbalAcceptanceTurn` is set (candidate said yes
 *      and then re-opened). Only the move-picker stiffens; phase wants
 *      to stay in `counter-offer` while the bot stiffens, and any
 *      derivation that would otherwise compute a "lower" target phase
 *      should be allowed to land on counter-offer.
 *
 * Terminal phases share rank so they never transition between each
 * other except via the walk-away-reopen exception. The two non-walk-away
 * terminals (accepted / stalemate) are absorbing under normal flow.
 *
 * Removes the prior ad-hoc sticky clauses (POST_PROBE_PHASES /
 * isPostProbe / alreadyProbed) inside derivePhase — once monotonicity
 * is structural, those one-off `if` clauses become unnecessary. */
const PHASE_RANK: Record<NegotiationPhase, number> = {
  "opening": 0,
  "range-disclosure": 1,
  "offer-presented": 2,
  "probe-expectations": 3,
  "counter-offer": 4,
  "lever-explore": 5,
  "closing-push": 6,
  "accepted": 7,
  "walked-away": 7,
  "stalemate": 7,
};

export function canTransitionPhase(
  from: NegotiationPhase,
  to: NegotiationPhase,
  state: NegotiationState,
): boolean {
  if (PHASE_RANK[to] >= PHASE_RANK[from]) return true;
  /* Exception 1: walk-away reopen — `walkAwayReturned` is set inside
   * applyCandidateAnswer when a candidate re-engages after `walked-away`.
   * The reopen path explicitly hops phase to `counter-offer`; subsequent
   * derivations that produce `counter-offer` (or higher) are fine via
   * the rank check above, but any derivation that produces a LOWER
   * phase (e.g. `probe-expectations`) while reopened should still be
   * allowed to clamp into `counter-offer` rather than getting stuck. */
  if (state.walkAwayReturned && to === "counter-offer") return true;
  /* Exception 2: verbal-renege — `verbalAcceptanceTurn` is set when the
   * candidate previously said yes but is now asking for more. The state-
   * machine intentionally keeps us in `counter-offer` while the move-
   * picker stiffens. If derivation produces `counter-offer` and we're
   * sitting in a higher phase like `lever-explore` or `closing-push`,
   * permit the regression so the stiffening path runs cleanly. */
  if (state.verbalAcceptanceTurn != null && to === "counter-offer") return true;
  return false;
}

/* ─── Levers ─────────────────────────────────────────────────────── */

export type NegotiationLever =
  | "open-with-offer"   // initial offer presentation
  | "probe"             // ask what they want
  /* Bug-report 15 (2026-05-14) — fire ONCE before the first counter-base
   * when the candidate has anchored materially above initialOffer. Real
   * HR never moves money without first asking what's driving the number
   * (benchmark? competing offer? current-package hike math?). The probe
   * is a one-shot: kernel records it in leversUsed so the next turn
   * proceeds with counter-base regardless of the candidate's follow-up. */
  | "probe-justification"
  | "counter-base"      // bump base
  | "joining-bonus"     // one-time
  | "equity-grant"      // RSU/ESOP top-up
  | "notice-buyout"     // buy out notice period
  | "benefits-summary"  // recap non-cash
  | "compensation-summary" // disclose company comp STRUCTURE (base/var/equity ratios, bonus freq, vesting) — session 12 bug fix 2026-05-14
  | "notice-period-summary" // disclose company notice / start-date / buyout policy — audit Session C 2026-05-14
  | "hike-context-summary"  // surface hike% delta + Indian market context — audit Session C 2026-05-14
  | "hold-firm"         // explicit "this is final"
  | "close-acceptance"  // wrap with agreed terms
  | "close-walkaway"    // wrap acknowledging no-deal
  | "close-stalemate"   // wrap acknowledging out of turns
  /* Re-served wrap when the candidate keeps talking AFTER a terminal
   * phase was reached. Distinct from close-acceptance so we can tell in
   * telemetry / tests that this turn is a sticky restate, not a fresh
   * transition. Always carries terminal=true in the response payload. */
  | "terminal-restate"
  /* PDF#29 Bug 7 (2026-05-18) — frustration-recovery move. The bot
   * acknowledges that it looped on a topic the candidate already
   * answered and breaks out of the loop. Not a comp lever; no
   * newTotalLpa is emitted. Single-fire is enforced by the planner
   * via state.lastUserFrustrated being one-shot. */
  | "acknowledge-and-recover"
  /* Audit fix 2026-05-21 — CTC-inflation anchor. Recruiter anchors high
   * on the TOTAL PACKAGE while breaking it into fixed/variable/ESOP-
   * paper/JB/benefits, weaponising the CTC-vs-in-hand confusion that
   * Indian candidates routinely hit. The framing is the lie; the
   * numbers are accurate. When the candidate later asks for the
   * in-hand breakdown, a separate truthful render is shipped (see
   * `_ctc-inflation.ts`). Single-fire per session via the planner. */
  | "ctc-inflation-anchor";

/* ─── Band — server-derived once at session start ────────────────── */

export interface NegotiationBand {
  /** AI's opening number (LPA). */
  initialOffer: number;
  /** Maximum the AI can stretch to with explicit approval (LPA). */
  maxStretch: number;
  /** Below this, AI walks (LPA). */
  walkAway: number;
  /** Whether equity/RSU is on the table for this role/company tier. */
  hasEquity: boolean;
  /** Phase 12 (2026-05-13): optional base/variable component bounds.
   *  When set, the move-picker + validator enforce that any counter
   *  respects the candidate's stated base floor (via
   *  `candidateComponentBreakdown.base`) AND the recruiter's
   *  structural caps. Optional so legacy bands without this info
   *  fall through to the prior total-CTC-only behaviour. */
  baseFloor?: number;
  baseStretch?: number;
  variableMax?: number;
  /** Fresher-flow extension (2026-05-14). Set ONLY for IT-services tier
   *  entry-level offers — real recruiters at TCS / Infosys / Wipro pay a
   *  reduced rate during the 6-month probation period (typically ~90%
   *  of confirmed CTC), then step up to `initialOffer` on confirmation.
   *  Surfacing this on the band lets the opener explicitly break the
   *  number into "₹X during 6-month probation → ₹Y on confirmation"
   *  instead of quoting a single flat figure the candidate is then
   *  surprised by on joining. Unset for all other tiers. */
  probationOffer?: number;
  probationMonths?: number;
  /** Fresher-flow extension (2026-05-14). True when the candidate is
   *  applying for an INTERNSHIP (not a full-time fresher role). Tagged
   *  on the band by `_band-resolver` after detecting "intern" /
   *  "internship" in the original role string. When set, the band
   *  numbers represent monthly stipend × 12 (annualized stipend), NOT
   *  full-time CTC — the LLM must frame the offer accordingly
   *  ("₹X/month stipend over a 6-month internship"). */
  isInternshipStipend?: boolean;
  internshipMonths?: number;
}

/* ─── Canonical State ────────────────────────────────────────────── */

/**
 * Information items a candidate can interrogate the recruiter about.
 * Tracked as a set on state so we don't double-credit repeated asks
 * and so the move-picker can reward depth of due diligence.
 *
 * CONVENTION — two tiers of handling (see `_negotiate-turn-helpers.ts`
 * `INFO_ANSWERS` for the long-form note):
 *
 *  - STATIC ONE-LINERS (9): clawback-period, variable-history,
 *    vest-schedule, strike-price, in-hand-monthly, exercise-window,
 *    acceleration, fixed-vs-variable, perks-non-cash. Each maps to a
 *    fixed snippet in the `INFO_ANSWERS` table — no state interpolation.
 *
 *  - STATE-DERIVED BLOCKS (4): benefits-overview, compensation-breakdown,
 *    notice-period-ask, hike-percentage-ask. These have bespoke
 *    `if (state.infoAsked.includes(...))` blocks inside
 *    `buildResponseHints` that interpolate kernel state (state.company,
 *    state.highestOfferMade, state.candidateCurrentCtc, etc.) and
 *    matching lever-routing branches in `pickAiMove` (search for
 *    `wantsBenefits` / `wantsCompStructure` / `wantsNoticePolicy` /
 *    `wantsHikeContext` for the pattern).
 *
 *  - HYBRID: `package-breakdown` is handled by lever-routing in
 *    `pickAiMove` (`wantsBreakdown` → `benefits-summary` lever) and has
 *    no dedicated `INFO_ANSWERS` row — the lever itself drives the
 *    response. `fixed-vs-variable` and `perks-non-cash` appear in BOTH
 *    tiers (one-liner fallback + breakdown lever trigger).
 *
 * When adding a new intent: if it's a state-free policy snippet, add
 * a row to `INFO_ANSWERS`. If it requires kernel state, add a block to
 * `buildResponseHints` AND a routing branch to `pickAiMove`.
 */
export type InfoIntent =
  | "clawback-period"      // joining-bonus clawback duration / pro-rata
  | "variable-history"     // last 2-3yr variable payout %
  | "vest-schedule"        // RSU/ESOP grant + cliff + slope
  | "strike-price"         // ESOP exercise price / last 409A / FMV
  | "in-hand-monthly"      // CTC → net take-home breakdown
  | "exercise-window"      // post-termination ESOP exercise window
  | "acceleration"         // accelerated vesting on acquisition / RIF
  | "fixed-vs-variable"    // CTC split breakdown
  | "perks-non-cash"       // Sodexo / gratuity / NPS lumping
  | "package-breakdown"    // generic "walk me through the package" / "break it down" — added 2026-05 after the Lollypop session where the candidate asked for the structure and the AI responded with a probe ("what range are you targeting?") instead of providing the breakdown. The existing intents were all component-specific; this catches the higher-level "explain the offer" ask.
  | "benefits-overview"    // "what are the benefits?" / "what perks do you offer?" — added 2026-05 (bug report 11 follow-up E). Distinct from `perks-non-cash` (Sodexo / gratuity lump-into-CTC trick) and from `package-breakdown` (offer-component enumeration). This is the candidate asking what's IN the benefits package — health insurance, PF, leaves, learning budget, work mode. Routed to a company-aware disclosure in the helpers layer.
  | "compensation-breakdown" // "explain the variable components" / "ESOP details?" / "what's the bonus structure?" — added 2026-05 (session 12 bug). Distinct from `package-breakdown` (offer-component enumeration of THIS offer) and `fixed-vs-variable` (just the split). This is the candidate asking about the GENERAL compensation STRUCTURE at the company — base/variable/equity ratios, bonus frequency, vesting. Routed to a company-aware compensation disclosure (data/company-compensation-structure.ts) via the response-hint layer.
  | "notice-period-ask"    // Session B (2026-05-14): candidate asking ABOUT notice / start-date / buyout — "notice period?", "when can I join?", "earliest start date?", "buyout?". Distinct from the noticeJoining EXTRACTION (candidate stating THEIR notice). An info-ask the recruiter should answer in-channel.
  | "hike-percentage-ask"; // Session B (2026-05-14): candidate asking what hike% this offer represents — "what hike is this?", "is this a 30% hike?", "% raise?". Distinct from hikeRationale (candidate justifying their ask). Recruiter should respond with the computed delta if currentCtc known.

/* Negotiation tactics from the Voss / interviewing.io canon that the
   parser detects and the move-picker rewards. Tracked so a candidate
   who's clearly negotiating well faces less recruiter stiffening. */
export type VossTactic =
  | "mirror"               // repeats AI's last 1-3 words as a question
  | "label"                // "it sounds like..." framing
  | "calibrated"           // "how can I..." / "what's the best you can..."
  | "sign-today-bundle"    // "if you can do X+Y+Z I'll sign today"
  | "deflect-current-ctc"; // refuses to disclose current CTC

/* Macro market mode — adjusts global concession curves. Soft markets
   (post-layoff 2023-style) reduce concession willingness; hot markets
   (AI/ML 2025-style) increase it. Default neutral. */
export type MarketMode = "soft" | "neutral" | "hot";

/* Phase 21 — Recruiter persona. The same kernel state can be played
 * by four distinct recruiter archetypes; each modulates tactical
 * preferences (concession curve, what they probe for, what they
 * surface unprompted, tone). The kernel uses persona ONLY at the
 * response-hints layer so band math stays persona-agnostic — the
 * candidate's *experience* changes, not the underlying economics.
 *
 *   hardline      — aggressive in-house TA. Anchors at walkAway,
 *                   resists concessions, treats every probe as a
 *                   bargaining tell. Closing-pressure heavy.
 *   consultative  — friendly hiring manager. Transparent about the
 *                   band, willing to swap levers (JB ↔ equity ↔
 *                   review cycle), explains the why.
 *   founder       — early-stage founder/CEO. Mission-heavy, equity-
 *                   heavy, time-pressured ("we need to move fast"),
 *                   conservative on cash but generous on title/scope.
 *   agency        — external agency recruiter on commission. Surface-
 *                   level, deal-making, optimises for closure speed,
 *                   pushes acceptance harder than is warranted by
 *                   the actual band.
 *
 * Default: "consultative" — the existing kernel behaviour mapped
 * cleanly to a transparent hiring-manager persona, so callers that
 * don't specify persona see no change. */
export type RecruiterPersona = "hardline" | "consultative" | "founder" | "agency";

/* Phase 24b (2026-05-13) — persona-conditional band economics.
 * Earlier persona work modulated STYLE (hints, probes). This pure
 * helper modulates the BAND itself so persona affects what's actually
 * negotiable:
 *   - hardline:    +1L walkAway (less willing to chase low), -1L maxStretch
 *                  (less willing to flex high). Tighter band overall.
 *   - founder:     hasEquity forced true (equity is the trade lever),
 *                  +0.5L maxStretch (founder authority to flex on TC).
 *   - agency:      +0.5L maxStretch (commission-motivated to close).
 *   - consultative: no change (baseline).
 *
 * Invariants preserved:
 *   - walkAway < initialOffer < maxStretch (clamped if persona deltas
 *     would invert).
 *   - If a caller pre-applied tighter bounds, we never widen past
 *     {initialOffer ± 0.01} into invalid territory. */
export function applyPersonaToBand(
  base: NegotiationBand,
  persona: RecruiterPersona,
): NegotiationBand {
  const out: NegotiationBand = { ...base };
  switch (persona) {
    case "hardline":
      out.walkAway = base.walkAway + 1;
      out.maxStretch = base.maxStretch - 1;
      break;
    case "founder":
      out.hasEquity = true;
      out.maxStretch = base.maxStretch + 0.5;
      break;
    case "agency":
      out.maxStretch = base.maxStretch + 0.5;
      break;
    case "consultative":
      /* no change */
      break;
  }
  /* Clamp to preserve invariants: walkAway strictly below initialOffer,
   * maxStretch strictly above initialOffer. */
  if (out.walkAway >= base.initialOffer) out.walkAway = base.initialOffer - 0.5;
  if (out.maxStretch <= base.initialOffer) out.maxStretch = base.initialOffer + 0.5;
  /* P35 clamp invariant (session 12 fix — 2026-05-14). Persona never
   * raises initialOffer; this preserves the 35th-percentile opening
   * anchor set at construction time in salary-lookup.ts. Defensive: if
   * future persona logic ever bumped initialOffer above the input base
   * (e.g. a "founder" boost), this clamp would catch it. */
  if (out.initialOffer > base.initialOffer) out.initialOffer = base.initialOffer;
  return out;
}

export interface NegotiationState {
  /* Identity */
  readonly sessionId: string;
  readonly role: string;
  readonly company: string;

  /* Band — frozen at session start. Server is authoritative; the
     engine cannot mutate this after init. */
  readonly band: NegotiationBand;

  /* Phase + turn budget */
  phase: NegotiationPhase;
  turnIndex: number;    // number of AI turns produced; incremented in applyAiMove
  maxTurns: number;     // hard cap before stalemate (default 20)

  /* Candidate-stated facts. Folded in via applyCandidateAnswer or
     foldFactsIntoState — set ONCE per turn, never re-derived from
     transcript. Null = not stated. */
  candidateTarget: number | null;        // their TOTAL-package ask (LPA, last-stated-wins)
  /** Audit Fix (2026-05-19) — Fixed-component target. Separate from
   *  candidateTarget so a fixed-only restatement ("target is ₹26 LPA
   *  fixed at minimum") does NOT overwrite a previously stated total
   *  target ("expecting ₹32 LPA total"). The number-role classifier
   *  routes a target here when its adjacency window names "fixed" /
   *  "base" / "basic" without a "total"/"ctc"/"overall" override.
   *  Optional in serialized form AND in fixture construction for
   *  back-compat — absence ≡ null. All consumers must coalesce
   *  `state.candidateTargetFixed ?? null` (or `?? state.candidateTarget`
   *  where the field is used as a fallback target). */
  candidateTargetFixed?: number | null;
  /** Bug-report 12 (2026-05-14) — the numeric counter the candidate
   *  parsed THIS turn (LPA). Distinct from `candidateTarget` which is
   *  sticky from intake / earliest anchor; this field is the per-turn
   *  fresh-counter signal. Set in applyCandidateAnswer when parsed.target
   *  is non-null AND differs from the prior sticky candidateTarget (so
   *  re-asserting the same number doesn't count as a "fresh" counter).
   *  Cleared by applyAiMove so it never bleeds into the next AI turn.
   *  Used by the auto-accept gate so a stale intake target can NEVER
   *  close the AI below highestOfferMade without an in-turn counter. */
  lastCandidateCounterLpa: number | null;
  /** Phase 25a (2026-05-13) — the FIRST number the candidate ever
   *  anchored. Frozen on first non-null assignment; never updated
   *  after. Lets the red-flag layer detect upward drift ("Earlier
   *  you mentioned ₹18L; now you're at ₹24L"). */
  firstAnchoredTarget: number | null;
  candidateCurrentCtc: number | null;    // current package (NOT target)
  competingOffer: number | null;         // BATNA in hand (NOT target)

  /* Component-level breakdown the candidate has stated about their
   * ask or current — base / variable / equity in LPA. Phase 10A
   * (2026-05-13). Carries cross-turn (last-stated-wins via
   * mergeBreakdown). The LLM prompt surfaces these so the AI doesn't
   * propose a counter that satisfies the candidate's total while
   * violating their base-floor constraint. Detection-only at the
   * kernel level: enforcement in the move-picker is deferred until
   * the band schema also carries components. */
  candidateComponentBreakdown: ComponentBreakdown;

  /* Range ask: candidate stated "30-35 LPA" instead of a single number.
     Research (Idaho / Harvard PON) shows range asks earn meaningfully
     more than single-point asks. We reward this in the counter-offer
     split. */
  candidateAskedAsRange: boolean;

  /* AI moves made */
  highestOfferMade: number;              // best number AI has put on table (LPA)
  /** PDF#48 (2026-05-26) — turn index on which the kernel first put a
   *  specific number on the table (the moment `highestOfferMade`
   *  transitioned from 0 to > 0). Lets the premature-close guard ask
   *  "how many candidate turns have elapsed since the offer landed?" —
   *  the structural invariant the auto-close bug violated was that
   *  acceptance could lock in on the SAME turn the offer was first
   *  spoken, before the candidate had any chance to counter. Set once
   *  in applyAiMove at the same site that bumps highestOfferMade.
   *  Optional / nullable for backward-compat with sessions started
   *  before this field existed; absent ≡ never anchored. */
  firstOfferAtTurn?: number | null;
  leversUsed: NegotiationLever[];        // ordered history
  lastAiText: string;                    // for verbatim-repeat detection

  /** Phase 28 (2026-05-13) — last kernel-computed joining-bonus amount
   *  the AI has put on the table this session (LPA, one-time). Null
   *  until a joining-bonus move fires. Carries across turns so
   *  close-acceptance can include it in the recap — without this the
   *  JB silently disappeared from the close summary (May 2026 session).
   *  Sticky (never reset to null after being set). */
  lastJoiningBonusOffered: number | null;

  /* Rolling conversation log — capped at the last CONVERSATION_LOG_CAP
   * entries (= 4, i.e. last 2 exchanges). Phase 5 of the rebuild: the
   * compact brief carried derived facts only (target, current, highest
   * offer, etc.); the per-turn user prompt had `lastAiText` and the
   * candidate's CURRENT answer but no thread before that. The Lollypop
   * session (May 2026) showed the bot dropping context across turns
   * (re-asking what the candidate had said two turns earlier). Carrying
   * the last 2 exchanges into the prompt lets the LLM thread responses
   * without re-deriving state from the full transcript.
   *
   * Capped on purpose. A growing log inflates the per-turn prompt and
   * trips Groq's prefix cache (dynamic content drifts farther through
   * the prompt with each turn). 4 entries = ~600 tokens of dialogue,
   * which is enough thread for natural references and small enough that
   * the cache prefix still hits. */
  conversationLog: Array<{ speaker: "ai" | "candidate"; text: string }>;

  /* Recruiter-side tactic counters. `finalOfferAssertedCount` tracks
     how many times the AI (or upstream LLM) has claimed "best and
     final" — used by the move-picker to decay credibility after the
     AI then moves anyway. */
  finalOfferAssertedCount: number;

  /* Candidate-side tactic & intent counters. */
  vossTacticsUsed: VossTactic[];
  infoAsked: InfoIntent[];

  /* Verbal-acceptance lock: the candidate said "yes" but then tried to
     re-open the conversation. Distinct from terminal `accepted` — when
     this fires, the move-picker stiffens dramatically and a small
     rescission risk applies on the next turn. */
  verbalAcceptanceTurn: number | null;

  /* Phase 25d (2026-05-13) — rescission escalation. Counts candidate
   * turns AFTER verbalAcceptanceTurn on which the candidate is still
   * asking for more (target/info/tactic firing without acceptance).
   * 2+ = the offer is being rescinded; move-picker routes directly to
   * close-walkaway and the red-flag layer surfaces "rescission-risk"
   * as a blocker. */
  postVerbalRenegotiationCount: number;

  /* perfect 1 (2026-05-16) — multi-turn negotiation spiral. Counts the
   * number of counter-offer moves the AI has shipped this session.
   * Incremented in applyAiMove when move.lever === "counter-base".
   * Read by the planner's counter-offer construction path to apply a
   * diminishing-concessions multiplier (60% / 40% / 20% of the gap
   * for rounds 0/1/2; round 3+ pivots to hold-firm lever-loop). Also
   * read by canonical prose to emit a "we've already moved once"
   * acknowledgement on rounds >= 1.
   *
   * Distinct from counterCount derived from leversUsed (which the
   * existing splitSchedule already uses): counterRound is the canonical
   * authoritative counter for the spiral cadence and prose tells, kept
   * separate so we don't accidentally double-count rotation-counter and
   * spiral-counter against each other. */
  counterRound: number;

  /* Phase 21b (2026-05-13) — recovery actualization. True on the AI
   * turn that immediately follows a candidate utterance carrying a
   * recovery signal (desperate / salary-only / avoids-anchor /
   * personal-expense / offer-shopping recovered). Read by
   * pickAiMove to un-stiffen the counter split for one turn. Reset
   * to false in applyAiMove so it never bleeds into the next AI
   * turn. */
  recentRecoveryActive: boolean;

  /* Walk-away-and-return: candidate hit `walked-away` and then re-
     engaged. Comes with a penalty (loss of joining bonus, lower base
     ceiling on return). */
  walkAwayReturned: boolean;

  /* PDF#29 Bug 7 (2026-05-18) — candidate frustration signal. Set in
   * applyCandidateAnswer when the last user utterance matches
   * USER_FRUSTRATION_RE ("I already told you", "you keep asking",
   * "we covered this", "asked and answered"). Consumed by the planner
   * to promote `acknowledge-and-recover` as the highest-priority lever,
   * and cleared in applyAiMove after the recover turn fires so it
   * doesn't repeat. */
  lastUserFrustrated?: boolean;

  /* Hard-vs-soft band cap. When true, `maxStretch` is genuinely
     unreachable on base — the AI redirects to JB/equity/level instead
     of conceding on base. Modeled after services-co fitment caps. */
  hardBandCap: boolean;

  /* Macro market mode — adjusts concession curve globally. */
  marketMode: MarketMode;

  /* Phase 21 — Recruiter persona archetype. Influences response-hint
   * tone and tactical preferences but NOT band math. Frozen at session
   * start. Default "consultative" preserves legacy behaviour. */
  recruiterPersona: RecruiterPersona;

  /* Phase 3 of Salary-Negotiation SCORE_IMPROVEMENT_PLAN (2026-05-18) —
   * Indian recruiter SECTOR archetype (IT Services / GCC / Indian
   * Unicorn / Early Startup / BFSI / default). Frozen at session start
   * from tierBucket + band shape via selectRecruiterSectorPersona.
   * Distinct from `recruiterPersona` above (which is a tone axis:
   * hardline / consultative / founder / agency, and modulates band
   * economics). This persona only colours prose surfaces — pushback
   * shape, counter-offer phrasing, band-disclosure-deflect. Never
   * mutates after init. Optional on the interface for back-compat with
   * hand-constructed partial-state test fixtures and with in-flight
   * sessions serialised before Phase 3 shipped — consumers treat
   * undefined as "default". `initState` always sets it; deserializeState
   * backfills to "default" on load. */
  recruiterSectorPersona?: RecruiterSectorPersona;

  /* 2026-05-29 mood-pass — recruiter personality mood. Three buckets
   * (warm / brusque / frantic) seeded once at session start from a
   * hash of sessionId so it's deterministic per session and varies
   * across sessions. Affects tone only — the planner, move-picker,
   * and band math are mood-blind. Optional on the interface for
   * back-compat with hand-constructed test fixtures and with in-flight
   * sessions serialised before this field shipped; consumers treat
   * undefined as "warm" (current behaviour). */
  recruiterMood?: import("./_recruiter-prose-realism").RecruiterMood;

  /* 2026-05-30 time-context — derived once at session init from the
   * caller-provided `callTimeIso`. Optional / back-compat: undefined or
   * absent on serialized state defaults to "midweek-standard" (behavioral
   * no-op). Affects concession headroom and mood-cool probability;
   * never mutated after initState. */
  timeContext?: import("./_recruiter-time-context").TimeContext;

  /* 2026-05-29 mood-shift-pass — DYNAMIC mood overlay. The baseline
   * `recruiterMood` is seeded once at init and never changes (the
   * recruiter's personality). `recruiterMoodDynamic` shifts during
   * the call in response to candidate behaviour:
   *
   *   baseline  — use seeded mood (back-compat, default)
   *   cooled    — recruiter pushed back, behaves brusque-like for
   *               up to MOOD_COOLED_TTL turns or until a rewarm
   *               trigger fires
   *   rewarmed  — candidate conceded after cooling; behaves warm-like
   *
   * Trigger plumbing:
   *   - `recruiterMoodDynamicEnteredAtTurn`: turn the current dynamic
   *     state was entered. Used to TTL `cooled` back to `baseline`.
   *   - `consecutiveOverBandAsks`: streak counter for one of the cool
   *     triggers (3+ in a row).
   *   - `recruiterMoodColdLineFiredAtTurn` / `RewarmLineFiredAtTurn`:
   *     once-per-session gates so the cold line / rewarm prefix
   *     don't spam every turn the recruiter is in the cooled state.
   *
   * All optional for back-compat with serialised in-flight state. */
  recruiterMoodDynamic?: import("./_recruiter-prose-realism").RecruiterMoodDynamic;
  recruiterMoodDynamicEnteredAtTurn?: number | null;
  consecutiveOverBandAsks?: number;
  recruiterMoodColdLineFiredAtTurn?: number | null;
  recruiterMoodRewarmLineFiredAtTurn?: number | null;
  /* Highest candidate target seen so far this session — used to detect
   * concession (drop of ≥10% from prior ask). Pure-derived; updated in
   * applyMoodShift. */
  recruiterMoodPeakCandidateAskLpa?: number | null;

  /* Realism-Audit Fix 3 (2026-05-22) — manager-consult stall state.
   *
   * Models the multi-turn "let me check with my manager and revert"
   * leverage tactic. Three coupled fields:
   *
   * `stallTurnsRemaining` — when > 0, the recruiter is in the middle
   *   of a stall and the next AI turn must ship a stall-return outcome
   *   (small concession OR hold). Decremented to 0 after the return
   *   fires.
   *
   * `stallsFiredCount` — session-wide count of stalls opened. Capped
   *   at 3 in the planner gate so the same persona doesn't loop into
   *   "let me check with my manager" forever.
   *
   * `lastStallContext` — the stalled-ask number carried across the
   *   open turn → return turn boundary so the return prose can recap
   *   it verbatim. Cleared after the return fires.
   *
   * All three optional for back-compat with serialized state from
   * before this fix (in-flight sessions deserialize to 0 / null). */
  stallTurnsRemaining?: number;
  stallsFiredCount?: number;
  lastStallContext?: {
    /** Candidate's stalled ask (LPA, total package). */
    stalledAskLpa: number | null;
    /** Turn index when the stall opened. */
    openedAtTurn: number;
  } | null;

  /* Terminal signals (turn index where the transition fired) */
  acceptedAtTurn: number | null;
  walkedAwayAtTurn: number | null;
  /* Phase 3 missing-lever set (2026-05-17) — single-fire turn markers for
   * the three new Indian-HR levers that complement the existing
   * comparative-anchoring / internal-equity-defense / probe-justification
   * triad. Null on init; stamped by applyAiMove the turn the lever fires;
   * planner reads them as the single-fire gate. Optional for back-compat
   * with in-flight sessions and test fixtures serialised before the
   * fields shipped — deserializeState backfills to null. */
  panelApprovalStallFiredAtTurn?: number | null;
  politeWalkawayFiredAtTurn?: number | null;
  hikeStrongDefenseFiredAtTurn?: number | null;
  /* fake-leverage-challenge (2026-05-17) — single-fire turn marker for
   * the soft offer-proof probe. Null on init; stamped by applyAiMove
   * the turn the lever fires. Defensive single-fire layered on top of
   * the proofRequestedAtTurn gate on competingOfferDetail. */
  fakeLeverageChallengeFiredAtTurn?: number | null;
  /* PDF#42 BUG-A (2026-05-21) — competitor-match single-fire marker.
   * Null on init; stamped by applyAiMove when actionKind ===
   * "competitor-match". Planner reads it as the single-fire gate so
   * the panel-match commitment doesn't ship repeatedly. */
  competitorMatchFiredAtTurn?: number | null;
  /* Audit fix 2026-05-21 — CTC-inflation cascade. Stamped by applyAiMove
   * when actionKind === "ctc-inflation-anchor" with the headline CTC at
   * fire time (typically state.candidateTarget). The truth follow-up
   * reads this back so the breakdown reuses the EXACT same numbers as
   * the inflated quote — the lie was the framing, not the values. Null
   * on init; null after a walk-away-return reset. */
  ctcInflationAnchorCtcLpa?: number | null;
  /* Symmetric ledger entry for stalemate. Stamped once when derivePhase
   * first returns "stalemate"; cleared symmetrically with the others
   * when a walk-away-return reopens the session. Lets downstream
   * planners read state directly instead of proxying through
   * leversUsed.includes("close-stalemate"). */
  stalemateAtTurn?: number | null;

  /* Phase 11 (2026-05-13) — hike % + candidate-stated rationale.
   * Computed sticky: hikePercent regenerates each turn from
   * (target, currentCtc); rationale is last-stated-wins. */
  hikePercent: number | null;
  rationale: RationaleResult | null;

  /* Phase 13 (2026-05-13) — notice period + joining bonus + buyout
   * signals. Sticky: notice days and joining-bonus ask persist
   * across turns; buyoutRequested / earlyJoinPreferred booleans are
   * monotone-up. */
  noticeJoining: NoticeJoiningResult;

  /* Phase 14 (2026-05-13) — equity vesting preferences + literacy.
   * Captures vesting years, cliff months, cash/equity preference,
   * and candidate's prior equity experience. */
  equityVesting: EquityVestingResult;

  /* Phase 15 (2026-05-13) — work mode (remote/hybrid/office) +
   * candidate location + relocation signals. */
  locationMode: LocationModeResult;

  /* Phase 16 (2026-05-13) — structured competing-offer detail.
   * Complements the existing `competingOffer: number` magnitude with
   * company + status + stage + letter-share signals. */
  competingOfferDetail: CompetingOfferDetail;

  /* Phase 17A (2026-05-13) — decision deadline + conditional accept.
   * deadlineDays sets the AI's closing-pressure pacing; conditional
   * acceptance downgrades the legacy signalsAcceptance to a "trade
   * proposal" the move-picker should counter on. */
  decisionDeadline: DecisionDeadlineResult;

  /* Phase 17B (2026-05-13) — candidate background. Career gap, tenure
   * cadence, and over/under-qualified self-statement. Materially
   * affects the AI's framing of joining bonus, level fit, and
   * retention. */
  candidateProfile: CandidateProfileResult;

  /* Phase 17F (2026-05-13) — scalar candidate signals: floor, salary-
   * review cycle, proof-of-CTC shareability, internal-counter risk. */
  miscSignals: MiscSignalsResult;

  /* Phase 18 (2026-05-13) — candidate stance / posture (rigidity,
   * market-reference, salary-only-factor, badmouth, confidential
   * overshare, desperation, equity-as-cash). Drives the follow-up
   * router and red-flag detector — both pure derived views recomputed
   * each turn. */
  candidateStance: CandidateStanceResult;

  /* Phase 24c (2026-05-13) — promoted sales / contract comp-structure
   * detectors. Previously utterance-grade only (Phase 22). Now sticky
   * across turns: numeric facts (OTE, base, attainment, day rate,
   * utilization) are last-stated-wins; red-flag booleans are
   * monotone-up. Lets the recruiter side reason across turns ("you
   * quoted ₹40L OTE 3 turns ago; what was the base?"). */
  salesOTE: SalesOTEResult;
  contractRate: ContractRateResult;

  /* Phase 27 — retention-counter from current employer. Materially
   * affects the new-employer's leverage: they now have to beat TWO
   * numbers, and the candidate's "exit story" gets noisier. */
  retentionCounter: RetentionCounterResult;

  /* Phase 29 (2026-05-14) — Role-applicable YOE. Distinguishes the
   * candidate's TOTAL career YOE from the YOE that maps to the TARGET
   * role's domain. A Senior Product Designer with 6 years applying for
   * a Java Developer role has totalYoe=6 but applicableYoe≈0; the
   * kernel must use applicableYoe (not totalYoe) when sizing the band,
   * the hike%, and the recruiter framing for a domain pivot. All three
   * are session-immutable once initialised (computed from resumeProfile
   * + targetRole at init); null = unknown signal. */
  candidateTotalYoe: number | null;
  candidateApplicableYoe: number | null;
  candidatePrimaryDomain: string | null;

  /* Bug-report 11 (2026-05-14) — mid-session fresh-grad disclosure. The
   * candidate told us mid-conversation that they're pre-graduate / a
   * fresh grad / still in college. When true, candidateApplicableYoe is
   * forced to 0 AND the band rebases to entry-tier via resolveServerBand
   * (Phase 30, 2026-05-14) — clamped so the new ceiling is never below
   * highestOfferMade, preserving the close-floor invariant. Sticky once set. */
  freshGradDisclosed: boolean;

  /* Bug 7 (2026-05-14) — anti-repetition of recruiter benefits. Tracks
   * the set of RecruiterFactToken values that the bot has already
   * surfaced in this session. Fed back into compactTurnBrief so the
   * LLM knows not to restate them verbatim. */
  recruiterFactsAlreadySaid: string[];

  /* Audit follow-up (2026-05-21) — cross-turn answer coherence ledger.
   *
   * The off-script answer-from-factPack path (response-pipeline.ts
   * generateAnswerToCandidate) rebuilds the factPack fresh per turn.
   * Without a memory of what the bot has already answered for a given
   * intent, the LLM could land on inconsistent factual answers across
   * turns ("vesting is 25/25/25/25" turn 4, "vesting is 1-year cliff
   * then quarterly" turn 9). The ledger records the *intent* (coarse
   * bucket from detectCandidateAskedQuestion) → the canonical answer
   * the bot shipped + the turn it was shipped on. On a repeat ask of
   * the same intent, the pipeline short-circuits the LLM and ships a
   * deterministic "Just to reconfirm — <prior answer>" so the factual
   * thread stays coherent.
   *
   * Optional for back-compat with in-flight sessions serialized before
   * this field shipped; deserializeState backfills to {}. */
  answeredQuestionLedger?: Partial<Record<QuestionIntent, { answerText: string; turn: number }>>;

  /* Fix 3 (2026-05-15) — Promise-keeping enforcement. Open promises the
   * bot has made but not yet delivered ("we can discuss X", "let me share
   * Y"). Subjects are short normalised strings; promises that get
   * fulfilled on a turn are removed. compactTurnBrief surfaces these so
   * the LLM is forced to deliver on outstanding promises. */
  pendingPromises?: string[];

  /* Fix 4 (2026-05-15) — Full-message-repetition detector. The verbatim
   * AI text the bot produced on the most recent successful turn. Word-
   * shingle Jaccard against this drives the reroll path in negotiate-
   * turn.ts. Null on init; set in applyAiMove. */
  lastBotReply?: string | null;

  /* Fix 7 (2026-05-15) — Anchor recomputation suppression. In a real
   * session the initial anchor jumped from ₹34L on turn 1 to ₹24L on
   * turn 2 with no candidate action — band.initialOffer was being
   * re-derived per turn. Once the recruiter discloses the opening
   * anchor, this flag locks band.initialOffer for the remainder of
   * the session: subsequent rebases may move maxStretch / walkAway
   * but never reset initialOffer downward. Default false; toggled to
   * true on the first turn that reveals a comp number. */
  anchorLocked?: boolean;
  /** Fix 7 (2026-05-15) — the locked anchor value (LPA) for this
   *  session. Set when anchorLocked transitions false → true. */
  lockedAnchorLpa?: number | null;

  /* Fix 3 (PDF #17 follow-up, 2026-05-15) — premature-close guard.
   * Real session ended after ~6 turns with "View Result" button, no
   * resolution. Block ANY transition to a terminal phase before this
   * turn count unless the candidate explicitly declined OR
   * MAX_TURNS_PER_SESSION is hit. Default 8. */
  minTurnsBeforeClose?: number;

  /* PDF #17 architectural fix (2026-05-15) — discovery-first state
   * machine. The recruiter MUST collect a minimum bar of discovery
   * items (current CTC, fixed/variable split, notice period,
   * competing offers, role-specific value proof, target CTC) BEFORE
   * disclosing an anchor band. The checklist tracks ask/answer pairs
   * per item. Optional for back-compat with in-flight sessions;
   * deserializeState backfills via backfillDiscoveryChecklist. */
  discoveryChecklist?: import("./_discovery-stage").DiscoveryChecklist;

  /* PDF #17 architectural fix (2026-05-15) — explicit discovery-first
   * stage machine layered on top of the existing phase machine. The
   * legacy `phase` field remains the authoritative kernel state; this
   * `discoveryStage` runs in parallel as an informational signal for
   * compactTurnBrief and the move-picker. Optional for back-compat. */
  discoveryStage?: import("./_discovery-stage").DiscoveryStage;

  /* Tier-2 ship (2026-05-15) — non-salary constraints. Hard, non-comp asks
   * that materially change the recruiter's playbook (WFH days, parent-care
   * location lock, specific office). Captured as a single optional object
   * to avoid the 9-site fanout pattern: new constraint fields land as keys
   * here, not as new top-level state fields. */
  nonSalaryConstraints?: import("./_non-salary-constraints").NonSalaryConstraints;

  /* Tier-? ship (2026-05-15) — post-acceptance onboarding message. Built
   * once when the kernel transitions to `accepted` (or soft-accept), so
   * the response layer can concatenate it onto the close turn rather than
   * have the LLM improvise onboarding language. Pure derived; sticky once
   * set so a follow-up terminal restate still surfaces it. Optional for
   * back-compat. */
  postAcceptanceMessage?: string;

  /* PDF#48 follow-up (2026-05-26) — structured chunks of the same
   * post-acceptance content, one logical beat per entry (congrats,
   * doc checklist, BGV, counter-offer heads-up, joining-date). The
   * joined-string `postAcceptanceMessage` above is a back-compat view
   * of these chunks (joined with paragraph breaks); the chunks array
   * is the forward-compatible source of truth for a future engine
   * fan-out that renders one bubble per beat instead of one wall-of-
   * text bubble. Populated alongside `postAcceptanceMessage` whenever
   * `attachPostAcceptanceMessage` fires; readers that don't fan out
   * yet can ignore this field. Optional for back-compat. */
  postAcceptanceFollowups?: string[];

  /* Sprint A.4 (2026-05-15) — current employer (free-form, normalized
   * downstream). Detected from utterances; threaded into the
   * counter-offer-risk detector so the well-funded-employer signal can
   * fire. Optional for back-compat. */
  currentEmployer?: string;

  /* Sprint B.2 (2026-05-15) — refusal-count tracker for the number
   * discipline gate. Increments when the candidate dodges a probe for
   * their expectation. Optional. */
  probeRefusalCount?: number;

  /* PDF#18 follow-up (2026-05-15) — range-disclosure phase enum.
   * Records the turnIndex at which the bot first emitted a salary
   * RANGE (e.g. "₹18-22L band"). Set in applyAiMove when
   * detectRangeDisclosure fires on the bot text. derivePhase uses this
   * to transition out of the new "range-disclosure" phase once the
   * candidate has reacted (one turn later). Optional for back-compat. */
  rangeDisclosedAtTurn?: number | null;

  /* PDF#18 follow-up (2026-05-15) — current-vs-expected split
   * disambiguation. Records the subject of the LAST discovery question
   * the bot asked, so when the candidate then provides a "fixed +
   * variable" split utterance, the detector knows whether to flag it
   * against currentCtcFixedVariableSplitDisclosed (subject='current')
   * or expectedCtcFixedVariableSplitDisclosed (subject='expected').
   * Set in applyAiMove from move.rationale (which carries the next
   * ordered-discovery item key). Optional. */
  lastDisclosureSubject?: "current" | "expected" | null;

  /* P4 (2026-05-15) — per-item refusal tracking for the refusal-fallback
   * path in getNextOrderedDiscoveryItem. When the candidate refuses an
   * item ≥2 times, the kernel skips it and moves to the next ordered
   * item. Keys are DiscoverySequenceItem values; values true once the
   * item has been refused enough times. Optional. */
  discoveryRefusedItems?: Record<string, boolean>;

  /* P4 (2026-05-15) — the discovery sequence item the bot just asked
   * about (set in applyAiMove from move.rationale). Used by
   * applyCandidateAnswer to attribute refusals to the correct item. */
  lastDiscoveryItemAsked?: string | null;

  /* Sprint B.3 (2026-05-15) — in-hand vs CTC anchor disambiguation. When
   * true, candidateTarget is in-hand (not CTC). The CTC-equivalent is
   * stored separately so downstream consumers can switch frames. Optional. */
  candidateTargetIsInHand?: boolean;
  candidateTargetCtcEquivalentLpa?: number;

  /* PDF #18 root-cause (2026-05-15) — candidate-disclosure acks. Tracks
   * candidate-disclosed facts (notice period, current CTC, competing
   * offer, joining date) the bot has NOT yet acknowledged. Pushed in
   * applyCandidateAnswer when a disclosure is detected; pruned in
   * applyAiMove when the bot reply addresses it. Surfaced via the
   * brief as [CANDIDATE DISCLOSED — ACKNOWLEDGE THIS TURN: ...]. */
  pendingCandidateAcks?: import("./_candidate-disclosure-tracker").CandidateDisclosureEntry[];

  /* Architectural bug-prevention (2026-05-15) — decision log. Append-only
   * record of every move the kernel picked, with rationale, phase at pick
   * time, and the bracket tags injected into the brief this turn. Lets us
   * reconstruct *why* the kernel moved as it did from final state alone,
   * which is the prerequisite for the replay harness. Optional for
   * back-compat. */
  decisionLog?: Array<{
    turn: number;
    picker: string;        // e.g. "probe-mismatch", "discovery-next", "range-disclosure", "anchor", "concession"
    rationale: string;     // short human-readable reason
    phase: NegotiationPhase;
    briefTags?: string[];  // which bracketed tags were injected this turn
  }>;

  /* Architectural bug-prevention (2026-05-15) — last-turn brief tags. Set
   * by compactTurnBrief, read by the move-picker so the decision log can
   * record which bracket-tagged directives were in front of the LLM on
   * the turn the move was chosen. One-shot per turn; cleared in applyAiMove. */
  lastBriefTags?: string[];

  /* Negotiation-flow redesign commit 1 (2026-05-15) — TurnDelta.
   * Captures WHAT CHANGED on the most recent candidate turn (folded by
   * applyCandidateAnswer) so downstream consumers can route reactively
   * ("candidate just disclosed competing offer — probe credibility")
   * instead of from accumulated state ("competing offer is set, but who
   * knows when it was set"). Cleared (null) by applyAiMove. Optional for
   * back-compat — older serialized sessions deserialize without it and
   * any consumer must null-check. */
  lastTurnDelta?: TurnDelta | null;

  /* Negotiation-flow redesign commit 3 (2026-05-15) — cached NextAction.
   * planNextAction is stamped onto state at the END of applyCandidateAnswer
   * (after phase derivation) and cleared (null) by applyAiMove. Both the
   * move-picker and compactTurnBrief read from this single field, so the
   * brief's [NEXT REQUIRED ACTION] line and the rationale on move.lever
   * cannot diverge — they're produced by the SAME planner call. Optional
   * + nullable for back-compat with sessions serialized before commit 3:
   * pickAiMoveCore replays planNextAction when the field is absent. The
   * declared type is `unknown` so this module doesn't take a runtime
   * dependency on _next-action-planner.ts (which depends on this module
   * for state types); consumers cast to NextAction. */
  plannedNextAction?: unknown | null;

  /* AR2 telemetry wire-in (2026-05-25) — the action that was SHIPPED on
   * the previous AI turn (i.e. state.plannedNextAction at the moment
   * applyAiMove ran). Used by the response-pipeline's
   * validateTurnCoherence call to compare prevAi vs nextAi without the
   * kernel having to reverse-import _next-action-planner. Stored as
   * `unknown` for the same back-compat / no-cycle reasons as
   * plannedNextAction. Cleared explicitly only by initState; consumers
   * cast to NextAction. */
  lastShippedAction?: unknown | null;

  /* Negotiation-flow redesign commit 4 (2026-05-15) — reactive-followup
   * de-dupe ledger. Each reactive trigger (variable-comfort,
   * competing-credibility, notice-buyout, hike-justification,
   * answer-direct, refused-advance, fresh-grad-rebase) pushes its topic
   * here when the planner emits a reactive-followup action. Consulted
   * by the planner before re-emitting so the same probe doesn't fire
   * twice in the same session. Optional + nullable for back-compat
   * with sessions serialized before commit 4. */
  reactiveFollowupsFired?: DiscoveryTopic[];

  /* Bad-faith tactic injection ledger (2026-05-29). The planner pushes
   * a tactic kind here when it emits a tactic action so the same tactic
   * cannot fire twice in the same session. Optional + nullable for
   * back-compat with sessions serialized before this field. */
  tacticsUsed?: string[];

  /* Bad-faith tactic detection by the user (2026-05-29). When the
   * candidate names/calls out a tactic the recruiter used this session,
   * detectUserCaughtTactic() pushes the tactic kind here so the report
   * layer can surface it as a positive coaching signal in NPS / quality
   * scoring. Optional + nullable for back-compat. */
  userCaughtTactics?: string[];

  /* 2026-05-29 realism-pass — strict in-session variant rotation.
   *
   * The 14-topic curated bank has 2-5 paraphrase variants per entry.
   * The renderer hashes (sessionId, turnIndex) to pick an index, so
   * within a session, re-asks of the same topic on different turns
   * land on DIFFERENT seeds — but with 3 variants there's a 1/3
   * collision probability that the second ask gets the same variant
   * as the first.
   *
   * This ledger tracks per-topic serve count (number of times the
   * planner emitted an answer-direct for that curated topic in this
   * session). The renderer adds the count to the hash index, giving
   * strict non-repetition: ask #1 → variant 0, ask #2 → variant 1,
   * ask #3 → variant 2, ask #4 wraps to variant 0 (or whatever the
   * shifted hash lands on). Real recruiters never re-phrase identically
   * within a single call.
   *
   * Keyed by the candidate-question topic string (e.g. "variable-comfort",
   * "esop-structure"). Optional + nullable for back-compat with
   * sessions serialized before this field. */
  candidateQuestionServeCount?: Partial<Record<string, number>>;

  /* 2026-05-29 realism-pass — candidate register classifier output.
   *
   * Inferred register of the candidate ("formal" | "casual" | "direct" |
   * "neutral") based on their last-N utterances. Recomputed by
   * applyCandidateAnswer on every candidate turn via
   * classifyFromLog(state.conversationLog). Consumed downstream by
   * humanizeRecruiterProse to bias persona-tic selection so the
   * recruiter mirrors the candidate's register instead of speaking past
   * it.
   *
   * Defaults to "neutral" until enough signal accumulates (≥2 hits in
   * one bucket within a 5-utterance window). Optional + nullable for
   * back-compat with sessions serialized before this field. */
  candidateRegister?: "formal" | "casual" | "direct" | "neutral";

  /* Polish 2 (2026-05-16) — per-topic fire-history (turn indices at
   * which each topic was fired). The legacy `reactiveFollowupsFired`
   * is single-fire dedup; this parallel ledger lets refireable topics
   * (tax-implication, notice-buyout, range-to-point) revisit 2-3
   * times across a session subject to a per-topic max-count + minimum
   * turn-gap, more accurately modelling how Indian candidates revisit
   * sticky topics. Consulted by canRefire() in _next-action-planner.
   * Optional + nullable for back-compat with pre-Polish-2 serialized
   * sessions. */
  reactiveFollowupsFireLog?: Partial<Record<DiscoveryTopic, number[]>>;

  /* Fix 1 (2026-05-16) — leversFired ledger for Indian-context structural
   * levers (grade upgrade, retention bonus, RSU refresh, relocation,
   * perf-bonus cadence, joining-bonus explainer, band-anchor with
   * rationale). The planner consults this set during lever rotation
   * to ensure each lever fires at most once per session. Optional for
   * back-compat with sessions serialized before Fix 1. */
  leversFired?: string[];

  /* F7 (PDF#20 2026-05-15) — askedTopics repetition guard.
   * Ordered history of discovery topics the bot has asked, with the
   * turnIndex at which each ask was emitted. applyAiMove pushes here
   * whenever a move carries an askedTopic marker. planNextAction
   * consults this ledger: if the same topic appears within the last 3
   * turns, the planner skips it and advances to the next checklist item.
   * Optional for back-compat with pre-F7 serialized sessions. */
  askedTopics?: { topic: DiscoveryTopic; atTurn: number }[];

  /* ITEM 3 (2026-05-15) — Trial-close signaling.
   *
   * candidateSignaledClose: set true by applyCandidateAnswer when the
   *   bot's PREVIOUS turn contained a trial-close ask (detectTrialCloseAsked)
   *   and the candidate replied on this turn. Sticky once true. Triggers
   *   the close-confirmation reactive rule in planNextAction.
   *
   * closeFired: set true by applyAiMove when a close-acceptance or
   *   close-walkaway move is applied. Guards the reactive rule so it
   *   only fires once.
   *
   * Optional for back-compat with sessions serialized before ITEM 3. */
  candidateSignaledClose?: boolean;
  closeFired?: boolean;

  /* Kernel-first cleanup (2026-05-16) — first-class role facts. Previously
   * read via loose extension shape in _fact-pack.ts and _canonical-prose.ts.
   * Threaded through InitStateInput and copied to state at init (defaults
   * null). All optional / nullable — absent → fact pack omits them and the
   * LLM is instructed to defer. */
  workMode?: "remote" | "hybrid" | "office" | null;
  teamSize?: number | null;
  reportingTo?: string | null;
  joiningWindow?: string | null;
  /** Additional first-class role facts surfaced alongside workMode et al.
   *  perfCycle: text describing the perf-review cadence (e.g. "annual").
   *  equityStructure: text describing equity grant shape (RSU / ESOP / none). */
  perfCycle?: string | null;
  equityStructure?: string | null;
  /** Kernel-first cleanup (2026-05-16) — candidate first name. Threaded
   *  from intake so _canonical-prose.ts doesn't have to scan the
   *  conversation log to greet by name. Log-scan stays as a fallback for
   *  legacy sessions or self-introductions mid-flow. */
  candidateName?: string | null;

  /** Perfect 3 (2026-05-16) — sticky session-wide urgency level. Promoted
   *  from per-turn TurnDelta.urgencySignal via a monotone upgrade rule
   *  (firm > soft > none, never downgrades). Read by the planner — gated
   *  on discovery-complete — to bias closing-push toward close-recap-formal
   *  when the candidate has surfaced a firm deadline. Default "none". */
  cumulativeUrgency?: "none" | "soft" | "firm";

  /** PDF#27 Fix 2 (2026-05-17) — turn-index at which the candidate
   *  expressed a repetition complaint ("you're repeating", "I already
   *  answered that"). Set by applyCandidateAnswer when it detects the
   *  pattern; read by planNextAction so the next probe force-advances
   *  past the topic the candidate is complaining about. Null when no
   *  complaint registered. Sticky to the turn it landed at — the
   *  planner consumes-and-clears via the askedTopics ledger. */
  repetitionComplaintAtTurn?: number | null;

  /** PDF#27 Fix 5 (2026-05-17) — turn-index at which the candidate
   *  asked for the company's offer ("what's the offer?", "share the
   *  offer", "what are you offering?"). Set by applyCandidateAnswer;
   *  read by the anchor-with-band lever so the band-disclosure fires
   *  on the very next turn rather than after the discovery cascade. */
  offerAskedAtTurn?: number | null;

  /** Phase 2 Indian-HR redesign (2026-05-17) — turn-index at which the
   *  post-acceptance documentation request lever fired (Congrats + BGV
   *  paperwork checklist). Stamped by applyAiMove when
   *  move.actionKind === "post-acceptance-document-request". Single-fire
   *  per session — read by the planner so the lever doesn't re-emit. */
  postAcceptanceDocsRequestedAtTurn?: number | null;

  /** FL5 / Audit Pass 4 (PDF#27, 2026-05-17) — turn-index at which the
   *  candidate's reply was hedged ("not sure", "around 30", "I think",
   *  "approximately", "don't remember"). Set by applyCandidateAnswer;
   *  read by the planner so the next move offers a range / escape
   *  hatch on the same topic instead of grinding on an exact value. */
  lastAnswerUncertainAt?: number | null;

  /** PDF#32 BUG H (2026-05-18) — turn-index at which the candidate's
   *  reply was an unparseable noise artifact (empty after trim, or
   *  stage-direction text like "audible" / "[noise]" / "[unclear]"
   *  surfaced by the STT layer). Set by applyCandidateAnswer; the same
   *  pass also rewinds the askedTopics tail so the planner re-fires
   *  the prior probe instead of advancing past a topic the candidate
   *  never addressed. Mostly diagnostic — downstream analyzers can
   *  count noise turns to flag transcription degradation. */
  lastAnswerNoiseAtTurn?: number | null;

  /** PDF#34 Fix 3 (2026-05-18) — turn-index at which the candidate
   *  asked a CLARIFICATION about a term the bot just used ("what is
   *  that?", "what's vesting?", "huh?", "I don't understand", "?"
   *  alone). Distinct from off-topic (the candidate IS on-topic — they
   *  just don't know the term) and from uncertainty (which is about
   *  the candidate's own value, not the bot's question).
   *
   *  Set by applyCandidateAnswer; read by the planner to emit a
   *  `clarify-prior-question` action that defines the term inline
   *  before re-asking. Without this gate, real Indian-PD candidates
   *  who don't know vesting jargon get the off-topic deflection
   *  ("this conversation is about…") and bounce. */
  lastAnswerClarificationAtTurn?: number | null;

  /** PDF#35 Move 1 (2026-05-18) — turn-index at which the candidate
   *  asked the bot to RECAP / REPEAT / SUMMARISE the standing offer
   *  AFTER the anchor had already been put on the table. Distinct from
   *  `offerAskedAtTurn` (which fires BEFORE the anchor — "what's the
   *  offer?" pre-anchor → triggers anchor-with-offer). This stamp
   *  fires ONLY when highestOfferMade > 0 already and the candidate
   *  is asking to be reminded ("what was the offer again?", "can you
   *  restate the CTC?", "summarise where we landed").
   *
   *  Read by the planner to route to `offer-recap` instead of looping
   *  through `band-disclosure-deflect`. */
  lastAnswerOfferRecapAtTurn?: number | null;

  /** AR3 / Audit Pass 4 (PDF#27, 2026-05-17) — turn-index at which the
   *  current state.phase was entered. Stamped by derivePhase whenever
   *  the phase changes. Read by the per-phase maxTurns cap so a phase
   *  that overstays its budget force-advances instead of looping. */
  phaseEnteredAtTurn?: number | null;

  /** ResumeFactPack track (2026-05-16) — structured resume-derived facts
   *  built once at session-init and stored frozen on state. Replaces the
   *  earlier path that reduced the parsed resume to ~6 scalars and threw
   *  away the rest. Read by the credibility-probe lever, the counter-math
   *  prior-CTC floor, and the fact-pack restyle layer. Optional for
   *  back-compat with sessions serialized before this field shipped.
   *  Frozen at init — never mutated mid-session. */
  resumeFactPack?: import("./_resume-fact-pack").ResumeFactPack | null;

  /** Resume-derived implied prior CTC (LPA). Derived once at init from
   *  resumeFactPack.latestRole.companyTier × role-family median band.
   *  When candidate withholds current CTC, the counter-offer split math
   *  uses this as a floor (logged, never silent). Null when the latest
   *  role can't be resolved to a tier band. */
  impliedPriorCtcFromResume?: number | null;

  /** ResumeFactPack track (2026-05-16) — most-recent candidate-stated
   *  current-company affiliation, parsed from "I'm at X" / "I work
   *  at X" / "currently at X" patterns in candidate utterances. Sticky
   *  last-stated-wins. Read by the credibility-probe lever to compare
   *  against resumeFactPack.latestRole / priorCompanies. Null when the
   *  candidate has not stated a current company. */
  candidateStatedCurrentCompany?: string | null;

  /** ResumeFactPack track (2026-05-16) — credibility-probe ledger.
   *  True once the credibility-probe has fired this session (single-fire);
   *  prevents re-asking the same alignment question. */
  credibilityProbeFired?: boolean;

  /** ResumeFactPack track (2026-05-16) — turn index at which we
   *  deliberately AVOIDED the credibility-probe because the resume
   *  confirmed the stated company. Null when not yet evaluated. Read
   *  by the decision log for visibility — "we saw the affiliation
   *  match and chose not to probe". Avoids polluting leversUsed
   *  (which is a real-lever ledger). */
  credibilityProbeAvoidedAt?: number | null;

  /** Parallel provenance map for candidateProfile flags. Key = flag
   *  name (CandidateProfileResult field). Value = "resume" when the
   *  flag was seeded from ResumeFactPack at init, "stated" when set
   *  later by a candidate utterance. Candidate utterances confirm
   *  resume facts via the monotone-up merge in mergeCandidateProfile —
   *  they never downgrade them. Read by the planner / restyle layer
   *  when it needs to know "did the candidate actually say this or
   *  did we infer it from the CV". Optional for back-compat. */
  flagProvenance?: Record<string, "resume" | "stated">;

  /** Prompt-injection defense telemetry (2026-05-17). One record per
   *  candidate turn on which `detectAndSanitizeInjection` flagged the
   *  raw utterance and span-redacted it. Silent — the AI's response is
   *  unchanged in shape; this ledger lets us see attack rate / which
   *  patterns hit in prod without telegraphing the defense to the
   *  candidate. Empty array at session start; never cleared. */
  promptInjectionAttempts: Array<{
    atTurn: number;
    patterns: string[];
    originalLength: number;
    sanitizedLength: number;
  }>;

  /* Phase 5 Session A (2026-05-19) — multi-round simulated persona switch.
   *
   * The kernel can cycle a single conversation through three sequential
   * "rounds" (HR Partner → Hiring Manager → Director). To the candidate
   * it reads as one continuous interview that hands off mid-session.
   * Default-OFF opt-in: when `multiRoundEnabled` is false (the HEAD
   * default), the kernel behaves byte-identical to single-round — none
   * of the round fields ever mutate.
   *
   * When enabled:
   *   - `roundPersona` starts at "hr-partner" and advances via
   *     `selectNextRoundPersona` as the kernel detects round-end signals
   *     (closing-push reached, or accepted / walked-away phase) for
   *     rounds 0..1; round 2 (Director) is terminal.
   *   - `roundIndex` 0 → 1 → 2, monotone-up. Stays at 2 once Director.
   *   - `roundTransitions` accumulates the per-handoff ledger so
   *     downstream consumers (analyzer in Session B, UI dashboard) can
   *     reconstruct the round trajectory from state alone.
   *   - `perRoundBand` lets callers pre-resolve per-round band overrides
   *     (HR Partner = floor only; HM = floor + 8% stretch; Director =
   *     full stretch). `initState` derives defaults from the base band
   *     when caller omits.
   *
   * All five fields are optional / nullable so existing serialised
   * sessions deserialise unchanged.
   *
   * ── Default-OFF byte-identical invariant ───────────────────────────
   * When `multiRoundEnabled !== true` (the HEAD default), every code
   * path that reads these fields short-circuits to the pre-Phase-5
   * behaviour:
   *   - `maybeAdvanceRound` returns the state untouched
   *     (no roundTransitions append).
   *   - `_canonical-prose.ts:activeRoundPersona` returns null
   *     (sector-only prose branch — pre-Phase-5 byte-identical).
   *   - `_next-action-planner.ts` round-transition pre-emption is
   *     gated on `multiRoundEnabled === true && roundTransitions.length > 0`.
   *   - The Session B analyzer block on `meta.salaryNegotiation` is
   *     additive only — never mutates existing fields.
   * The integration test fixtures in
   * `src/__tests__/integration/phase5RoundPersonaProse.test.ts`
   * exercise the OFF path explicitly and assert byte-identity against
   * the v8 sector-default surfaces. */
  roundPersona?: NegotiationRoundPersona;
  /* Optional on the interface so legacy partial-state test fixtures and
   * pre-Phase-5A serialised sessions deserialise without TS errors. The
   * kernel always treats `undefined` as 0 / [] / false respectively —
   * see `maybeAdvanceRound` and the planner's pre-emption guard. */
  roundIndex?: 0 | 1 | 2;
  roundTransitions?: Array<{
    atTurn: number;
    from: NegotiationRoundPersona;
    to: NegotiationRoundPersona;
  }>;
  multiRoundEnabled?: boolean;
  perRoundBand?: Record<NegotiationRoundPersona, NegotiationBand>;

  /** Memory feature (2026-05-29) — recorded user claims with the turn at
   *  which each was FIRST seen. The kernel writes the claim on first
   *  mention; subsequent mentions are compared against the recorded value
   *  to detect contradictions (±10% tolerance on numeric claims). Optional
   *  for back-compat. */
  userClaims?: UserClaims;

  /** Prior-context feature (2026-05-29) — caller-declared context the
   *  user announces UP FRONT at session init (NOT parsed from
   *  utterances). Lets the kernel + planner adjust strategy from turn
   *  zero when the candidate already holds a competing written offer or
   *  a retention package from their current employer. SET ONCE at
   *  initState via NegotiationKernelInput.priorContext; the planner
   *  reads it on every turn but never mutates it. Optional / fully
   *  back-compat — when absent the planner behaves byte-identically to
   *  the pre-feature cascade. */
  priorContext?: PriorContext;

  /** Memory feature (2026-05-29) — one-shot contradiction signal stamped
   *  by applyCandidateAnswer when the current turn's parsed claim
   *  disagrees with the recorded value (outside ±10% on numbers). The
   *  planner consumes this to fire contradiction-callout; applyAiMove
   *  clears it so a single contradiction doesn't re-fire forever. */
  lastContradiction?: ContradictionSignal | null;

  /** Affinity-dynamic feature (2026-05-29) — recruiter's per-call affinity
   *  toward the candidate. Clamped to [-3, +3]. Starts at 0. Updated each
   *  candidate turn by applyAffinitySignals based on rapport markers.
   *  Affects mood cool/rewarm probability, concession headroom, and prose
   *  warmth/cool overlay. Optional for back-compat. */
  recruiterAffinity?: number;
  affinityLedger?: AffinityLedgerEntry[];

  /** Paraphrase-loop feature (2026-05-29) — single-fire marker for the
   *  paraphrase-recap action. Set to true by applyAiMove the first turn
   *  the planner emits `paraphrase-recap`; never reset. Optional for
   *  back-compat with sessions serialized before the feature shipped. */
  paraphraseFired?: boolean;
  /** Calibrated-surprise lowball feature (2026-05-29) — single-fire
   *  marker for the `calibrated-surprise-lowball` action. Set true by
   *  applyAiMove the first turn the planner emits the probe. Never reset
   *  so the probe doesn't refire in the same session even if a fresh
   *  lowball anchor is later detected. */
  calibratedSurpriseFired?: boolean;
  /** Calibrated-surprise lowball feature — context carried from the
   *  probe-fire turn so the next applyCandidateAnswer can classify the
   *  candidate's reply (double-down vs revise-up vs ask-why) against the
   *  same numbers the probe used. Cleared once the reply lands. */
  calibratedSurpriseContext?: {
    firedAtTurn: number;
    candidateAnchor: number;
    bandFloor: number;
  } | null;
  /** Calibrated-surprise lowball feature — sticky marker set when the
   *  candidate doubled down on the lowball anchor after the probe (Branch
   *  A). The report layer surfaces this as a coaching moment ("you left
   *  money on the table"). Never reset. */
  acceptedLowball?: boolean;
  /** Calibrated-surprise lowball feature — turn the recruiter's quiet
   *  accept (`accept-lowball-quiet`) was shipped. Used by the planner to
   *  avoid re-firing the accept across subsequent turns (the close
   *  transition handles terminal stickiness from there). Null when the
   *  Branch-A accept hasn't fired this session. */
  acceptLowballQuietFiredAtTurn?: number | null;
  /** Paraphrase-loop feature (2026-05-29) — confirmation-gate ledger.
   *  When the candidate replies to a paraphrase with a correction
   *  ("no, my notice is actually 90 days"), the kernel stamps the topic
   *  + raw correction text here so subsequent turns can reference it.
   *  Sticky once set; never cleared. */
  paraphraseCorrections?: Array<{
    turn: number;
    topic: string;
    correction: string;
  }>;

  /** Proactive-sweetener feature (2026-05-30) — single-fire marker for
   *  the `proactive-sweetener` action. Set to true by applyAiMove the
   *  first turn the planner emits the sweetener. Never reset, so the
   *  recruiter never volunteers a second non-cash sweetener in the same
   *  session even if cooling signals recur. Real recruiters get ONE
   *  chance to dangle relocation / signing bonus / equity refresh /
   *  joining flex / notice-buyout-help before the conversation either
   *  closes or breaks down — the single-fire models that finite social
   *  permission. Optional for back-compat with sessions serialized
   *  before the feature shipped. */
  proactiveSweetenerFired?: boolean;
  /** Proactive-sweetener feature (2026-05-30) — which sweetener kind
   *  the planner picked based on `recruiterSectorPersona`. Read by the
   *  prose layer to render the sector + sweetener-specific verbal
   *  offer. Copied from the action payload on the firing turn. Sticky
   *  once set so coaching / report layers can attribute it post-hoc. */
  proactiveSweetenerKind?:
    | "signing-bonus"
    | "relocation"
    | "equity-refresh"
    | "joining-flexibility"
    | "notice-buyout-help";
  /** Recruiter-power-dynamics feature (2026-05-29) — scalar derived from
   *  `powerSignals` at init via `computeRecruiterPower`. Clamped to
   *  [-3, +3]. Default 0. May be recomputed mid-session ONLY when a new
   *  signal is detected (e.g. competing-process disclosure). Optional
   *  for back-compat. */
  recruiterPower?: number;
  /** Recruiter-power-dynamics feature (2026-05-29) — caller-declared
   *  signal bundle, plus mid-session detections. Optional for back-compat;
   *  default `{}`. */
  powerSignals?: PowerSignals;
}

/** Affinity-dynamic feature (2026-05-29). */
export type AffinityReason =
  | "rapport-signal"
  | "respect-marker"
  | "abrasive-tone"
  | "value-prop-signal"
  | "wasted-time"
  | "transparency"
  | "evasion";

export interface AffinityLedgerEntry {
  turn: number;
  delta: number;
  reason: AffinityReason;
}

/** Memory feature (2026-05-29) — per-claim record with first-seen turn. */
export interface UserClaimRecord<T> {
  value: T;
  firstSeenTurn: number;
}

export interface UserClaims {
  currentCtc?: UserClaimRecord<number>;
  expectedCtc?: UserClaimRecord<number>;
  competingOffer?: UserClaimRecord<{ company: string; amount: number }>;
  noticePeriod?: UserClaimRecord<number>;
  currentRole?: UserClaimRecord<string>;
}

/** Prior-context feature (2026-05-29) — user-declared upfront context
 *  at session start. Distinguished from in-utterance signals
 *  (`competingOffer`, `userClaims.competingOffer`, `competingOfferDetail`)
 *  by SOURCE: the user declared these BEFORE the simulation began, so
 *  the planner can shape opening moves around them without waiting for
 *  the discovery cascade to surface them. SET ONCE at init; never
 *  mutated. */
export interface PriorContext {
  /** Existing competing offer the candidate already holds in hand.
   *  `signed` distinguishes a written/letter-stage offer from a verbal
   *  one (verbal: recruiter probes for credibility; signed: recruiter
   *  acknowledges immediately and engages with the number). */
  existingCompetingOffer?: {
    company: string;
    amountLpa: number;
    deadline?: string;
    signed: boolean;
  };
  /** Retention package the candidate's CURRENT employer has offered to
   *  keep them. Tenure indicates payout horizon: immediate (one-shot
   *  bonus now), midYear (next review), cycleEnd (full appraisal). */
  retentionOffer?: {
    fromCurrentEmployer: true;
    amountLpa: number;
    tenure: "immediate" | "midYear" | "cycleEnd";
  };
}

/** Recruiter-power-dynamics feature (2026-05-29) — caller-declared
 *  signals about the recruiter's external pressure. Folded once at
 *  init via `computeRecruiterPower` into a scalar `recruiterPower` on
 *  state. Default `{}` → power 0 → identity behavior. */
export interface PowerSignals {
  /** Months the requisition has been open. >=6 strongly hungry; >=3 mildly. */
  openReqMonths?: number;
  /** How many other late-stage candidates the recruiter has lined up. */
  pipelineDepth?: number;
  /** Hiring-cycle timing. */
  quarterTiming?: "fresh-quarter" | "mid-quarter" | "quarter-end" | "annual-sprint";
  /** True when the candidate has stated a competing live process. May be
   *  caller-declared OR auto-flipped by `applyCandidateAnswer` when the
   *  utterance discloses one mid-session. */
  candidateHasCompetingProcess?: boolean;
}

/** Pure: fold signal bundle into a scalar in [-3, +3]. Positive = recruiter
 *  has leverage (open-req young, deep pipeline, fresh quarter); negative =
 *  recruiter is hungry (req aged, no pipeline, EOQ pressure, candidate has
 *  competing process). */
export function computeRecruiterPower(signals: PowerSignals): number {
  let p = 0;
  const m = signals.openReqMonths;
  if (typeof m === "number" && Number.isFinite(m)) {
    if (m >= 6) p += -2;
    else if (m >= 3) p += -1;
    /* m <= 1 → 0, else 0 (no bump in the "fresh" range either) */
  }
  const d = signals.pipelineDepth;
  if (typeof d === "number" && Number.isFinite(d)) {
    if (d >= 4) p += 2;
    else if (d >= 2) p += 1;
    else if (d === 0) p += -1;
  }
  switch (signals.quarterTiming) {
    case "quarter-end": p += -1; break;
    case "annual-sprint": p += -2; break;
    case "fresh-quarter": p += 1; break;
    default: break;
  }
  if (signals.candidateHasCompetingProcess === true) p += -1;
  if (p > 3) p = 3;
  if (p < -3) p = -3;
  return p;
}

export type ContradictionTopic =
  | "currentCtc"
  | "expectedCtc"
  | "competingOffer"
  | "noticePeriod"
  | "currentRole";

export interface ContradictionSignal {
  topic: ContradictionTopic;
  oldValue: number | string;
  newValue: number | string;
  firstSeenTurn: number;
  /** Company name for competingOffer; unused for numeric topics. */
  oldLabel?: string;
  newLabel?: string;
}

/* ─── Negotiation-flow redesign commit 1 (2026-05-15) — TurnDelta ────
 *
 * Diff between pre- and post-state for a single candidate utterance.
 * Populated by `computeTurnDelta(pre, post, parsed)` inside
 * `applyCandidateAnswer` and stored on `state.lastTurnDelta`. Cleared
 * by `applyAiMove`. Each field is a boolean "this kind of thing just
 * happened this turn" signal — consumers that need the actual value
 * read it from the post-state.
 *
 * Eleven disclosure categories spec'd by the negotiation-flow audit
 * (E row 1):
 *   currentCtc / expectedCtc          — comp facts (new values, not restates)
 *   fixedVariableSplit                — base+variable breakdown disclosed
 *   noticePeriod                      — notice days OR buyout signal
 *   competingOffer                    — competing-offer presence (number or vague)
 *   joiningDate                       — early-join / last-working-day signal
 *   valueProof                        — quota / portfolio / depth signal (sales/contract/profile)
 *   askedQuestion                     — candidate's utterance contains a "?" question
 *   refusedItem                       — probeRefusalCount incremented this turn
 *   freshGrad                         — first-time fresh-grad disclosure
 *   retentionCounter                  — current-employer retention counter disclosed
 */
export interface TurnDelta {
  /** Candidate disclosed a NEW currentCtc value this turn (not a restate). */
  disclosedCurrentCtc: boolean;
  /** Candidate disclosed a NEW expected/target value this turn. */
  disclosedExpectedCtc: boolean;
  /** Candidate disclosed a fixed/variable breakdown for either CTC. */
  disclosedFixedVariableSplit: boolean;
  /** Candidate disclosed notice period or notice-related signal (buyout / LWD). */
  disclosedNoticePeriod: boolean;
  /** Candidate confirmed buyout availability THIS turn (pre.buyoutRequested
   *  false → post true). Distinct from disclosedNoticePeriod which also
   *  fires on bare notice-day disclosures. Used by the reactive-rule
   *  layer to acknowledge buyout before advancing discovery. (Fix 6,
   *  2026-05-16) */
  noticeBuyoutConfirmed: boolean;
  /** Candidate disclosed a competing offer (number OR named-vague signal). */
  disclosedCompetingOffer: boolean;
  /** Candidate disclosed role-specific value proof (quota / ARR / portfolio / shipped systems). */
  disclosedValueProof: boolean;
  /** Candidate utterance contained a direct question ("?"). */
  askedQuestion: boolean;
  /** Structured form of the candidate question. Carries the (trimmed) raw
   *  text and a coarse intent tag so the response pipeline can decide
   *  whether to answer vs. defer without re-detecting the question. */
  candidateAskedQuestion?: { raw: string; intent?: QuestionIntent } | null;
  /** Candidate refused a probe this turn (probeRefusalCount incremented). */
  refusedItem: boolean;
  /** Candidate first-disclosed fresh-grad status this turn. */
  freshGradDisclosed: boolean;
  /** Perfect 2 (2026-05-16) — coarse emotional sentiment classification of
   *  the candidate's utterance this turn. Drives an Indian-recruiter-idiom
   *  acknowledgement prefix in canonical prose for frustrated / excited /
   *  hesitant; decisive and neutral suppress the prefix (decisive needs no
   *  emotional softening, neutral needs no acknowledgement). */
  candidateSentiment?: "frustrated" | "excited" | "hesitant" | "decisive" | "neutral";
  /** Perfect 3 (2026-05-16) — time-pressure signal detected this turn.
   *  "firm" = explicit deadline ("by Friday", "deadline is Monday",
   *  "competing offer expires"); "soft" = directional movement framing
   *  ("looking to move quickly", "in final stages elsewhere"); "none" =
   *  default. Merged into the sticky state.cumulativeUrgency via
   *  applyAiMove (sticky upgrade — firm overrides soft overrides none,
   *  never downgrades within a session). */
  urgencySignal?: "none" | "soft" | "firm";
  /** QA v3 round 3 (2026-05-19) — classified candidate archetype from
   *  `_candidate-archetype.ts`. Per-turn classification on the raw
   *  utterance; `null` when no signal fires. The planner uses this to
   *  disambiguate routing when wired-profile flags don't fully describe
   *  the candidate's stance (e.g. P09_NON_CASH_FOCUS suppresses counter-
   *  offer; P15_HARD_ANCHOR forces band-disclosure-deflect over generic
   *  acknowledge). Pure metadata — no state mutation. */
  candidateArchetype?:
    | import("./_candidate-archetype").CandidateArchetype
    | null;
}

export const EMPTY_TURN_DELTA: TurnDelta = {
  disclosedCurrentCtc: false,
  disclosedExpectedCtc: false,
  disclosedFixedVariableSplit: false,
  disclosedNoticePeriod: false,
  noticeBuyoutConfirmed: false,
  disclosedCompetingOffer: false,
  disclosedValueProof: false,
  askedQuestion: false,
  candidateAskedQuestion: null,
  refusedItem: false,
  freshGradDisclosed: false,
  candidateSentiment: "neutral",
  urgencySignal: "none",
  candidateArchetype: null,
};

/** Perfect 2 (2026-05-16) — coarse emotional sentiment classifier for
 *  the candidate's utterance. Pure regex-based heuristic on raw text.
 *  Patterns are tuned to Indian-English negotiation idiom (frustrated
 *  candidates lean on "honestly" / "frankly" hedges; excited candidates
 *  use "looking forward" / "happy with"; hesitant candidates surface
 *  family / "let me think" framings; decisive candidates use "final
 *  number" / "bottom line").
 *
 *  Priority order matters: decisive and frustrated outrank excited /
 *  hesitant when patterns collide ("honestly, this is my final number"
 *  → frustrated wins because frustration drives the prefix decision).
 *  Default is "neutral". Downstream renderSentimentPrefix suppresses
 *  the prefix for decisive + neutral. */
/* Audit Fix (2026-05-19) — Mask target-context spans of a candidate
 * utterance so downstream DISCLOSURE-context parsers (specifically
 * extractComponentBreakdown) don't bind target-LPA values as if they
 * were the candidate's currently-paid breakdown.
 *
 * A target clause starts at a target-marking cue ("target", "expecting",
 * "want", "looking for", "asking for", "ideal", "would like", "anchor")
 * AND runs until the next sentence boundary (`.` `!` `?` `\n`) OR a
 * clause break that resets to a non-target context. Within the masked
 * span we replace every non-whitespace, non-sentence-boundary char with
 * a space so regex byte-offsets are preserved (no downstream parser
 * relies on contiguous character positions across the mask boundary).
 *
 * Conservative: we mask only when an UNAMBIGUOUS target cue fires.
 * Hedge words alone ("at minimum", "at least") do NOT trigger a mask
 * — they're modifiers, not target markers. */
const TARGET_CLAUSE_CUES = [
  /\btarget\s+is\b/i,
  /\bmy\s+target\b/i,
  /\bi.?m\s+expecting\b/i,
  /\bi\s+(?:am\s+)?expecting\b/i,
  /\bexpecting\s+(?:around|about|at|near)?\b/i,
  /\bi\s+want\b/i,
  /\bi.?d\s+like\b/i,
  /\bi\s+would\s+like\b/i,
  /\blooking\s+for\b/i,
  /\basking\s+for\b/i,
  /\bideal(?:ly)?\b/i,
  /\bhoping\s+for\b/i,
  /\baim(?:ing)?\s+for\b/i,
  /\banchor(?:ing)?\s+(?:around|at|on)?\b/i,
  /\bcan\s+we\s+revisit\b/i,
  /* Audit Fix (2026-05-19) — conditional close phrasings. When the
   * candidate says "if you can get fixed to ₹X, I'm ready to move
   * forward" they are stating a TARGET condition, not disclosing their
   * current fixed. The ask is forward-looking; the number must not
   * leak into candidateComponentBreakdown.base. */
  /\bif\s+you\s+can\s+(?:get|make|push|move|bring|raise|bump|stretch)\b/i,
  /\bif\s+(?:the\s+)?fixed\s+(?:can\s+)?(?:get|go|move|push|stretch)/i,
  /\bget\s+(?:the\s+)?fixed\s+to\b/i,
  /\bpush\s+(?:the\s+)?fixed\s+to\b/i,
];
function maskTargetClauses(text: string): string {
  if (!text) return text;
  const out: string[] = text.split("");
  for (const cue of TARGET_CLAUSE_CUES) {
    const m = cue.exec(text);
    if (!m || m.index == null) continue;
    /* Mask from the cue's start up to the next sentence boundary. */
    const start = m.index;
    let end = text.length;
    for (let i = start; i < text.length; i++) {
      if (/[.!?\n]/.test(text[i])) {
        end = i;
        break;
      }
    }
    for (let i = start; i < end; i++) {
      if (!/\s/.test(out[i])) out[i] = " ";
    }
  }
  return out.join("");
}

function detectCandidateSentiment(
  rawCandidateText: string,
): TurnDelta["candidateSentiment"] {
  if (typeof rawCandidateText !== "string" || !rawCandidateText.trim()) {
    return "neutral";
  }
  const text = rawCandidateText.toLowerCase();
  /* Multiple exclamation marks anywhere → frustrated signal. */
  const multiBang = /!\s*!/.test(rawCandidateText);
  const FRUSTRATED_RE =
    /\b(honestly|frankly|to be very honest|this is not fair|really disappointed|expected more|i don['’]?t think|lowball|very low)\b/i;
  if (multiBang || FRUSTRATED_RE.test(text)) return "frustrated";
  const DECISIVE_RE =
    /\b(final number|bottom line|non[- ]?negotiable|either way|let me be direct|straight up)\b/i;
  if (DECISIVE_RE.test(text)) return "decisive";
  const EXCITED_RE =
    /\b(looking forward|excited to join|happy with|absolutely|great|let['’]?s go ahead|let['’]?s close)\b/i;
  if (EXCITED_RE.test(text)) return "excited";
  const HESITANT_RE =
    /\b(i['’]?m not sure|need to think|let me get back|discuss with family|let me check|kind of|maybe|i suppose)\b/i;
  if (HESITANT_RE.test(text)) return "hesitant";
  return "neutral";
}

/** Perfect 3 (2026-05-16) — time-pressure / urgency signal detector.
 *
 *  Two-bucket classifier (plus default "none") tuned to how Indian
 *  candidates surface time pressure: firm signals carry an explicit
 *  date, named weekday, or "in-hand offer" framing; soft signals are
 *  directional intent without a hard deadline ("looking to move
 *  quickly", "in final stages elsewhere").
 *
 *  Why "firm" outranks "soft": a candidate who says both "looking to
 *  move quickly AND I have to revert by Friday" is firm — the deadline
 *  is the binding constraint, the directional framing is incidental. */
function detectUrgencySignal(
  rawCandidateText: string,
): TurnDelta["urgencySignal"] {
  if (typeof rawCandidateText !== "string" || !rawCandidateText.trim()) {
    return "none";
  }
  const text = rawCandidateText.toLowerCase();
  const FIRM_RE =
    /\b(have to revert by|deadline is|joining by|by\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|this week|next week|end of (?:the )?week|eow|eod)|have an offer in hand|offer in hand|competing offer expires|need to close this week|close this week)\b/i;
  if (FIRM_RE.test(text)) return "firm";
  const SOFT_RE =
    /\b(soon|looking to move quickly|want to wrap up|in final stages elsewhere|interviewing with others|interviewing elsewhere)\b/i;
  if (SOFT_RE.test(text)) return "soft";
  return "none";
}

/** Perfect 3 (2026-05-16) — sticky upgrade for cumulativeUrgency. Firm
 *  overrides soft overrides none; never downgrades. Pure. */
function mergeCumulativeUrgency(
  prior: NegotiationState["cumulativeUrgency"],
  fresh: TurnDelta["urgencySignal"],
): "none" | "soft" | "firm" {
  const rank = { none: 0, soft: 1, firm: 2 } as const;
  const p = rank[prior ?? "none"];
  const f = rank[fresh ?? "none"];
  const max = p >= f ? p : f;
  return (Object.keys(rank) as Array<"none" | "soft" | "firm">).find(
    (k) => rank[k] === max,
  ) ?? "none";
}

/** Compute the per-turn delta between pre-state and post-state given
 *  the parsed candidate answer. Pure. Called at every return point of
 *  applyCandidateAnswer so terminal / soft-accept / walk-away paths all
 *  carry an accurate delta for downstream consumers. */
export function computeTurnDelta(
  pre: NegotiationState,
  post: NegotiationState,
  parsed: ParsedAnswer,
  rawAnswer: string,
): TurnDelta {
  const d: TurnDelta = { ...EMPTY_TURN_DELTA };

  /* Comp facts — disclosed iff the post value is different from the pre
   * value (covers null→number AND value-changed cases). Re-stating the
   * same number does NOT count as a fresh disclosure. */
  if (post.candidateCurrentCtc != null && post.candidateCurrentCtc !== pre.candidateCurrentCtc) {
    d.disclosedCurrentCtc = true;
  }
  if (post.candidateTarget != null && post.candidateTarget !== pre.candidateTarget) {
    d.disclosedExpectedCtc = true;
  }

  /* Fixed/variable split — fired when this turn's parsed breakdown
   * carried BOTH base and variable. Captures both "split disclosed for
   * current CTC" and "split disclosed for expected CTC" — consumers
   * disambiguate via state.lastDisclosureSubject if they care. */
  if (
    parsed.componentBreakdown.hasAny &&
    ((parsed.componentBreakdown.base != null && parsed.componentBreakdown.variable != null) ||
      (parsed.componentBreakdown.basePercent != null && parsed.componentBreakdown.variablePercent != null))
  ) {
    /* BUG-3 (PDF#24, 2026-05-16): a percentage-shaped split
     * ("80% fixed, 20% variable") is also a valid disclosure of the
     * fitment split — we just don't know the absolute LPA values
     * without a total. Either form flips this flag. */
    d.disclosedFixedVariableSplit = true;
  }

  /* Notice period — covers both notice-days AND buyout/LWD signals. */
  if (parsed.noticeJoining.hasAny) {
    const pn = pre.noticeJoining;
    const nn = post.noticeJoining;
    if (
      (nn.noticePeriodDays != null && nn.noticePeriodDays !== pn.noticePeriodDays) ||
      (nn.buyoutRequested && !pn.buyoutRequested) ||
      (nn.lastWorkingDayText != null && nn.lastWorkingDayText !== pn.lastWorkingDayText)
    ) {
      d.disclosedNoticePeriod = true;
    }
    /* Buyout confirmation flip (Fix 6, 2026-05-16). Distinguished from
     * disclosedNoticePeriod so the reactive-rule layer can acknowledge
     * the buyout disclosure before advancing ordered discovery. */
    if (nn.buyoutRequested && !pn.buyoutRequested) {
      d.noticeBuyoutConfirmed = true;
    }
  }

  /* Competing offer — either numeric or named-vague signal. */
  if (
    (post.competingOffer != null && post.competingOffer !== pre.competingOffer) ||
    parsed.signalsCompetingExistsWithoutNumber ||
    (parsed.competingOfferDetail.hasAny &&
      (parsed.competingOfferDetail.company != null ||
        parsed.competingOfferDetail.status != null ||
        parsed.competingOfferDetail.stage != null ||
        parsed.competingOfferDetail.letterShareOffered ||
        parsed.competingOfferDetail.onHold))
  ) {
    d.disclosedCompetingOffer = true;
  }

  /* Value proof — sales OTE / contract rate / profile signals that
   * speak to role-specific value. Sales/contract aren't in ParsedAnswer;
   * detect via post-state diff against pre-state (extractSalesOTE /
   * extractContractRate are folded into post inside applyCandidateAnswer). */
  if (
    (post.salesOTE.hasAny && !pre.salesOTE.hasAny) ||
    (post.contractRate.hasAny && !pre.contractRate.hasAny)
  ) {
    d.disclosedValueProof = true;
  }
  if (
    parsed.candidateProfile.hasAny &&
    (parsed.candidateProfile.quotaAttainmentClaimed ||
      parsed.candidateProfile.peopleManagementClaimed ||
      parsed.candidateProfile.transferableSkillsClaimed ||
      parsed.candidateProfile.variableTrackRecord)
  ) {
    d.disclosedValueProof = true;
  }

  /* Asked-question — direct question in the candidate's utterance.
   *
   * Populates two fields:
   *   askedQuestion             — back-compat boolean
   *   candidateAskedQuestion    — structured {raw, intent} that the
   *                                response pipeline prefers over a
   *                                fresh re-detection at request time.
   *
   * Audit follow-up (2026-05-21) — DEBT #1 consolidation. The classifier
   * lives in `_question-intent.ts`, called from BOTH this site (write
   * side of the answeredQuestionLedger) and `_fact-pack.ts:detect-
   * CandidateAskedQuestion` / `_response-pipeline.ts` (read side). Same
   * function, same vocabulary, ledger dedup actually fires.
   */
  if (typeof rawAnswer === "string" && rawAnswer.trim()) {
    const trimmed = rawAnswer.trim();
    const Q_LEAD_RE =
      /^\s*(?:what|how|when|where|who|why|can you|could you|do you|is the|are you|tell me about)\b/i;
    const RHETORICAL_BEFORE_RE =
      /\b(thinking|wondering|wonder|guess|suppose|imagine|just|maybe)\b[^.?!]*?\b(what|how|when|where|who|why)\b/i;
    const trailingQ = /\?\s*$/.test(trimmed);
    const leadingQ = Q_LEAD_RE.test(trimmed);
    const rhetorical = RHETORICAL_BEFORE_RE.test(trimmed) && !trailingQ;
    if (!rhetorical && (trailingQ || leadingQ)) {
      d.askedQuestion = true;
      const intent = classifyQuestionIntent(trimmed);
      d.candidateAskedQuestion = {
        raw: trimmed.slice(0, 240),
        ...(intent ? { intent } : {}),
      };
    }
  }

  /* Refused-item — probeRefusalCount incremented this turn. */
  if ((post.probeRefusalCount ?? 0) > (pre.probeRefusalCount ?? 0)) {
    d.refusedItem = true;
  }

  /* Fresh-grad — first-time disclosure (pre=false, post=true). */
  if (!pre.freshGradDisclosed && post.freshGradDisclosed) {
    d.freshGradDisclosed = true;
  }

  /* Perfect 2 (2026-05-16) — emotional sentiment classification. Pure
   * regex on the raw candidate utterance. Drives the canonical-prose
   * acknowledgement prefix when sentiment ∈ {frustrated, excited,
   * hesitant}; decisive + neutral suppress (no preachy prefix). */
  d.candidateSentiment = detectCandidateSentiment(rawAnswer);

  /* Perfect 3 (2026-05-16) — per-turn urgency signal. The sticky session
   * field state.cumulativeUrgency is upgraded by finalize() in applyCandidate-
   * Answer using this value; the delta field stays as the per-turn read. */
  d.urgencySignal = detectUrgencySignal(rawAnswer);

  /* QA v3 round 3 (2026-05-19) — per-turn archetype classification.
   * Reads the post-state candidateProfile so the classifier can boost on
   * wired-profile flags (e.g. wantsHigherBase boosts P18_BREAKUP_PUSHBACK
   * confidence). Stored on the delta so planReactiveFollowup can read it
   * without re-running regex. */
  const classified = classifyCandidateArchetype(
    rawAnswer,
    post.candidateProfile ?? null,
  );
  d.candidateArchetype = classified?.archetype ?? null;

  return d;
}

/* ─── Fix 7 (2026-05-15) — Anchor-lock helpers ───────────────────── */

/** Return the locked anchor LPA if the session already locked one;
 *  otherwise fall back to band.initialOffer. Pure. */
export function effectiveAnchorLpa(state: NegotiationState): number {
  if (state.anchorLocked && state.lockedAnchorLpa != null) {
    return state.lockedAnchorLpa;
  }
  return state.band.initialOffer;
}

/** Lock the session's anchor. Idempotent — once locked, subsequent
 *  calls are no-ops (the original anchor never changes within a
 *  session). Returns a new state. Pure. */
export function lockAnchor(state: NegotiationState, anchorLpa: number): NegotiationState {
  if (state.anchorLocked) return state;
  return { ...state, anchorLocked: true, lockedAnchorLpa: anchorLpa };
}

/* ─── Fix 1 (2026-05-15) — Anchor clamp against candidate ask ──────
 *
 * Real-session bug (PDF #17 re-analysis): candidate asked ₹16L,
 * recruiter anchored ₹24L — volunteering money the candidate never
 * requested. Real recruiters never anchor higher than the candidate's
 * stated target; if the candidate undershoots the band, they accept
 * quickly with a small step-up rather than padding the offer.
 *
 * PDF #18 audit (2026-05-15): tightened unified rule. The cleanest
 * recruiter behavior is: NEVER offer above max(candidateAsk × 1.10,
 * bandFloor). Below-floor asks are handled by the same expression
 * (max picks the floor); above-anchor asks are no-ops (clamp ≥ anchor).
 *
 * clampAnchorAgainstCandidateAsk:
 *   - candidateAskLpa == null/invalid → return originalAnchor unchanged
 *   - else → min(originalAnchor, max(candidateAsk × 1.10, bandFloor))
 *
 * Applied at session-init AND on each turn before re-anchor (anchor
 * is locked per Fix 7, so this only fires at init for the locked
 * value). Pure. */
export function clampAnchorAgainstCandidateAsk(
  originalAnchor: number,
  candidateAskLpa: number | null,
  bandFloor: number,
): number {
  if (candidateAskLpa == null) return originalAnchor;
  if (!Number.isFinite(candidateAskLpa) || candidateAskLpa <= 0) return originalAnchor;
  const cap = Math.max(candidateAskLpa * 1.10, bandFloor);
  return Math.min(originalAnchor, cap);
}

/* Sprint A.3 (2026-05-15) — attach the post-acceptance onboarding
 * message to state at the moment the kernel transitions to `accepted`.
 * Builds once and stores on state so the response layer can concatenate
 * it onto the close turn without the LLM improvising onboarding
 * language. Idempotent — re-attach is a no-op once set. Mutates `next`
 * in place (callers pass a fresh draft just before returning).
 *
 * Dynamic require kept because `_post-acceptance` imports the
 * NegotiationState type from this file and a static import would lock
 * the load order. */
/** Audit Pass 2 Fix D (2026-05-16) — normalize curly / smart quotes
 *  to ASCII at the input boundary. iOS / macOS auto-correct silently
 *  rewrites apostrophes to U+2019 (right single quotation mark) and
 *  double quotes to U+201C/U+201D, but every regex bank in
 *  `_acceptance-classifier.ts` (lines 78/80/82/92/101/133/143/146/147/
 *  198/226/438-465) uses ASCII `'` exclusively. Pre-fix, "I'll accept"
 *  and "I'm in" pasted from iOS Notes never matched any acceptance
 *  pattern. Apply at applyCandidateAnswer entry (kernel-side) AND at
 *  classifyAcceptance entry (defense-in-depth for the legacy
 *  whole-transcript facts path which doesn't route through the kernel). */
function normalizeQuotes(s: string): string {
  return s
    .replace(/[\u2018\u2019\u02BC\u02BB]/g, "'")
    .replace(/[\u201C\u201D]/g, '"');
}

function attachPostAcceptanceMessage(next: NegotiationState): void {
  if (next.postAcceptanceMessage) return;
  /* Populate both views in one call so the joined-string consumer
   * (current negotiate-turn dispatch) and the chunks consumer (future
   * engine fan-out) read consistent data — single source, two
   * projections. The chunks array is the forward-compatible shape;
   * see the field doc on NegotiationState.postAcceptanceFollowups. */
  const chunks = buildPostAcceptanceMessageChunks(next);
  next.postAcceptanceFollowups = chunks;
  next.postAcceptanceMessage = chunks.join("\n\n");
}

/** Audit Pass 2 Fix C (2026-05-16) — single helper for the
 *  "candidate verbally accepted, lock in terminal" state-tuple. Three
 *  accept paths in `applyCandidateAnswer` (strict-boost explicit accept,
 *  classifyAcceptance / soft-accept fallthrough, and the strict-acceptance
 *  terminal write) plus `foldFactsIntoState` were each setting `phase` +
 *  `acceptedAtTurn` independently, BUT only one of them set
 *  `verbalAcceptanceTurn`. The next-action planner gates the
 *  close-recap-formal step on `verbalAcceptanceTurn != null`, so the
 *  close-recap never fired on those paths — terminal-restate won
 *  instead. Forcing the field tuple through this helper closes the gap.
 *
 *  Call sites must keep their own site-specific extras (e.g.
 *  `attachPostAcceptanceMessage` or sign-today-bundle attachments) —
 *  this helper only enforces the field tuple, nothing else. */
function markAccepted(next: NegotiationState, state: NegotiationState): void {
  next.phase = "accepted";
  next.acceptedAtTurn = state.turnIndex;
  next.verbalAcceptanceTurn = state.turnIndex;
}

/* ─── Factory ────────────────────────────────────────────────────── */

export interface InitStateInput {
  sessionId: string;
  role: string;
  company: string;
  band: NegotiationBand;
  maxTurns?: number;
  /* Kernel-first cleanup (2026-05-16) — role facts and candidate name
   * surfaced as typed init inputs. All optional / nullable. */
  workMode?: "remote" | "hybrid" | "office" | null;
  teamSize?: number | null;
  reportingTo?: string | null;
  joiningWindow?: string | null;
  perfCycle?: string | null;
  equityStructure?: string | null;
  candidateName?: string | null;
  /* Prior-context feature (2026-05-29) — caller-declared upfront
   * context (existing competing offer or retention package). Optional
   * and SET ONCE here; the planner reads it on every turn but the
   * kernel never mutates it. */
  priorContext?: PriorContext;
  /* 2026-05-30 time-context — ISO-8601 timestamp of the call. Used to
   * derive `timeContext` once at session init via `deriveTimeContext`.
   * Optional; undefined defaults to "midweek-standard" (no behavioral
   * change). Treated as a one-shot input — never re-evaluated mid-call,
   * since a single negotiation is a single moment in time. */
  callTimeIso?: string;
  /* Recruiter-power-dynamics feature (2026-05-29) — caller-declared
   * signal bundle. Folded into `recruiterPower` once at init via
   * `computeRecruiterPower`. Undefined → power 0, signals {}, behavior
   * is identity. */
  powerSignals?: PowerSignals;
}

export interface InitStateExtras {
  hardBandCap?: boolean;
  marketMode?: MarketMode;
  recruiterPersona?: RecruiterPersona;
  /* Phase 3 of Salary-Negotiation SCORE_IMPROVEMENT_PLAN (2026-05-18) —
   * the sector archetype the caller has resolved from company + band.
   * Optional: when omitted, `initState` derives via
   * selectRecruiterSectorPersona using only the band shape (heuristic
   * fallback). Callers in negotiate-turn pass an explicit tierBucket
   * via the dedicated field below so the kernel doesn't need to
   * depend on data/company-tiers. */
  recruiterSectorPersona?: RecruiterSectorPersona;
  /* Optional tierBucket hint forwarded from the caller. Used only by
   * the persona selector when recruiterSectorPersona is not
   * pre-resolved. */
  tierBucketHint?: import("../src/_negotiation-math").CompanyTierBucket | null;
  /* Phase 29 — role-applicable YOE plumbed from the client (resume
   * profile + target role). All three optional; defaults to null. */
  candidateTotalYoe?: number | null;
  candidateApplicableYoe?: number | null;
  candidatePrimaryDomain?: string | null;
  /* ResumeFactPack track (2026-05-16) — caller may pass either a
   * pre-built fact pack OR a raw parsed-resume shape. When both are
   * absent the kernel runs with resumeFactPack = null and the
   * credibility-probe / prior-CTC floor levers are inert (back-compat). */
  resumeFactPack?: import("./_resume-fact-pack").ResumeFactPack | null;
  parsedResume?: import("./_resume-fact-pack").ParsedResume | null;
  /* Phase 5 Session A (2026-05-19) — multi-round simulated persona
   * switch. Default-OFF; when omitted or false, the kernel runs single-
   * round (HEAD behaviour). When true, `roundPersona` initialises to
   * "hr-partner", `roundIndex` to 0, and `perRoundBand` is derived from
   * the input band unless the caller pre-resolves it. */
  multiRoundEnabled?: boolean;
  perRoundBand?: Record<NegotiationRoundPersona, NegotiationBand>;
}

export function initState(input: InitStateInput & InitStateExtras): NegotiationState {
  /* ResumeFactPack track (2026-05-16) — build once at init and freeze on
   * state. Caller may supply a pre-built pack OR a raw parsed resume;
   * when both absent the kernel runs without resume context (back-compat). */
  const resumeFactPack: ResumeFactPack | null =
    input.resumeFactPack
      ?? (input.parsedResume ? buildResumeFactPack(input.parsedResume) : null);

  /* Derive impliedPriorCtcFromResume once at init. Reads the latest
   * role's company-tier and projects through the role-family × tier
   * band median. Used as a prior-CTC floor in counter-offer split math
   * when the candidate later withholds currentCtc. Null when the
   * latest role can't be resolved to a band tier. */
  let impliedPriorCtcFromResume: number | null = null;
  if (resumeFactPack?.latestRole?.companyName) {
    const band = getBandForRole(
      classifyBandCompanyTier(resumeFactPack.latestRole.companyName),
      input.role,
      input.candidateApplicableYoe ?? input.candidateTotalYoe ?? null,
    );
    impliedPriorCtcFromResume = band.target;
  }

  /* Pre-seed candidateProfile flags with provenance="resume". The
   * mergeCandidateProfile layer is monotone-up (||) so candidate
   * utterances can later confirm these flags but never downgrade. */
  const seed = deriveCandidateProfileSeed(resumeFactPack);
  const seededProfile = { ...EMPTY_CANDIDATE_PROFILE };
  const flagProvenance: Record<string, "resume" | "stated"> = {};
  if (seed.tenureSignal) {
    seededProfile.tenureSignal = seed.tenureSignal;
    flagProvenance.tenureSignal = "resume";
  }
  if (seed.peopleManagementClaimed) {
    seededProfile.peopleManagementClaimed = true;
    flagProvenance.peopleManagementClaimed = "resume";
  }
  if (seed.domesticTopMbaAnchor) {
    seededProfile.domesticTopMbaAnchor = true;
    flagProvenance.domesticTopMbaAnchor = "resume";
  }
  /* ResumeFactPack track (2026-05-16) — mncExperience is now a
   * first-class field on CandidateProfileResult. Pre-seed from the
   * resume pack (faang or indian-product tier in priorCompanies)
   * with provenance="resume". Resume wins on conflict; mergeCandidateProfile
   * is monotone-up, so a later stated utterance cannot downgrade. */
  if (seed.mncExperience) {
    seededProfile.mncExperience = true;
    flagProvenance.mncExperience = "resume";
  }
  /* hasAny derives from any flag being set; recompute. */
  seededProfile.hasAny =
    EMPTY_CANDIDATE_PROFILE.hasAny ||
    seededProfile.tenureSignal != null ||
    seededProfile.peopleManagementClaimed ||
    seededProfile.mncExperience ||
    seededProfile.domesticTopMbaAnchor;

  return {
    sessionId: input.sessionId,
    role: input.role,
    company: input.company,
    band: applyPersonaToBand({ ...input.band }, input.recruiterPersona ?? "consultative"),
    phase: "opening",
    turnIndex: 0,
    /* BUG-5 (PDF#24, 2026-05-16) — default raised from 8 to 16, then
     * raised again to 20 in the follow-up audit. Worst-case turn count
     * for a fully exercised session:
     *   - Ordered discovery cascade: currentCtc, currentCtcFixedVariable
     *     Split, expectedCtc, expectedCtcFixedVariableSplit, noticePeriod,
     *     competingOffers, valueProof = 7 AI turns
     *   - Range-disclosure: 1 turn
     *   - Open-with-offer / first anchor: 1 turn
     *   - Counter-base spiral, rounds 0..2 with diminishing concessions:
     *     3 turns
     *   - Closing-push runway (fires at maxTurns-1 from counter-offer /
     *     lever-explore): 1 turn
     *   - Close-recap formal: 1 turn
     *   Subtotal: 14 turns minimum, zero off-script questions.
     * Real candidates ask 2-4 off-script questions across a session
     * (work mode, equity, relocation, etc.) which the response pipeline
     * routes through the answer-and-pivot branch — each one burns an
     * AI turn before the planned canonical resumes. Twenty leaves 6
     * turns of headroom on top of the floor, which fits 4+ off-script
     * interruptions before stalemate fires. Sixteen left only 2 turns
     * of headroom, too tight for as-per-band reality. */
    maxTurns: input.maxTurns ?? 20,
    candidateTarget: null,
    candidateTargetFixed: null,
    lastCandidateCounterLpa: null,
    firstAnchoredTarget: null,
    candidateCurrentCtc: null,
    competingOffer: null,
    candidateComponentBreakdown: { base: null, variable: null, equity: null, hasAny: false },
    candidateAskedAsRange: false,
    userClaims: {},
    lastContradiction: null,
    highestOfferMade: 0,
    firstOfferAtTurn: null,
    leversUsed: [],
    lastAiText: "",
    lastJoiningBonusOffered: null,
    conversationLog: [],
    finalOfferAssertedCount: 0,
    vossTacticsUsed: [],
    infoAsked: [],
    verbalAcceptanceTurn: null,
    postVerbalRenegotiationCount: 0,
    counterRound: 0,
    recentRecoveryActive: false,
    walkAwayReturned: false,
    hardBandCap: input.hardBandCap ?? false,
    marketMode: input.marketMode ?? "neutral",
    recruiterPersona: input.recruiterPersona ?? "consultative",
    /* Phase 3 of Salary-Negotiation plan — sector persona derived once
     * from the (tierBucket hint, band shape, company). Caller-supplied
     * value wins; otherwise the kernel runs the selector against the
     * band shape (heuristic fallback). Cheap, deterministic; never
     * mutates after init. */
    recruiterSectorPersona:
      input.recruiterSectorPersona ??
      selectRecruiterSectorPersona({
        tierBucket: input.tierBucketHint ?? null,
        band: input.band,
        company: input.company,
      }),
    /* 2026-05-29 mood-pass — seed the recruiter mood from a hash of
     * sessionId. Deterministic per session, roughly even split across
     * the three buckets. Pure / no I/O. Mood affects prose tone only
     * (see `_recruiter-prose-realism.ts`); planner/strategy is
     * mood-blind. */
    recruiterMood: deriveRecruiterMood(input.sessionId),
    /* 2026-05-30 time-context — derive once at session init. Undefined
     * callTimeIso → "midweek-standard" (behavioral no-op). Single
     * negotiation = single moment in time; never re-derived. */
    timeContext: deriveTimeContext({ callTimeIso: input.callTimeIso }),
    /* 2026-05-29 mood-shift-pass — dynamic mood overlay starts at
     * baseline (no shift). applyMoodShift in applyCandidateAnswer
     * transitions baseline → cooled → rewarmed based on candidate
     * behaviour. */
    recruiterMoodDynamic: "baseline",
    recruiterMoodDynamicEnteredAtTurn: null,
    consecutiveOverBandAsks: 0,
    recruiterMoodColdLineFiredAtTurn: null,
    recruiterMoodRewarmLineFiredAtTurn: null,
    recruiterMoodPeakCandidateAskLpa: null,
    /* Realism-Audit Fix 3 (2026-05-22) — manager-consult stall state. */
    stallTurnsRemaining: 0,
    stallsFiredCount: 0,
    lastStallContext: null,
    acceptedAtTurn: null,
    postAcceptanceDocsRequestedAtTurn: null,
    walkedAwayAtTurn: null,
    stalemateAtTurn: null,
    /* Phase 3 missing-lever set (2026-05-17) — single-fire turn markers. */
    panelApprovalStallFiredAtTurn: null,
    politeWalkawayFiredAtTurn: null,
    hikeStrongDefenseFiredAtTurn: null,
    fakeLeverageChallengeFiredAtTurn: null,
    competitorMatchFiredAtTurn: null,
    ctcInflationAnchorCtcLpa: null,
    /* Audit follow-up (2026-05-21) — kernel chaos test caught schema
     * drift on 10 optional fields: applyCandidateAnswer produced these
     * keys, but initState never seeded them. Consumers checking the
     * field before its first trigger got `undefined`, often masked
     * because the field is typed `?:`. Explicit defaults close the
     * drift so the state shape after initState ≡ state shape after
     * applyCandidateAnswer (modulo derived facts). */
    repetitionComplaintAtTurn: null,
    lastAnswerClarificationAtTurn: null,
    lastAnswerNoiseAtTurn: null,
    lastAnswerOfferRecapAtTurn: null,
    lastAnswerUncertainAt: null,
    lastTurnDelta: null,
    lastUserFrustrated: false,
    offerAskedAtTurn: null,
    pendingCandidateAcks: [],
    phaseEnteredAtTurn: null,
    plannedNextAction: null,
    lastShippedAction: null,
    hikePercent: null,
    rationale: null,
    noticeJoining: {
      noticePeriodDays: null,
      buyoutRequested: false,
      joiningBonusAsk: null,
      earlyJoinPreferred: false,
      joiningBonusClawbackDiscussed: false,
      lastWorkingDayText: null,
      hasAny: false,
    },
    equityVesting: {
      vestingYears: null,
      cliffMonths: null,
      preference: null,
      familiarity: null,
      strikePriceDiscussed: false,
      valuationDiscussed: false,
      liquidityDiscussed: false,
      equityExists: null,
      hasAny: false,
    },
    locationMode: {
      workMode: null,
      locationCity: null,
      relocationRequested: false,
      relocationRefused: false,
      hasAny: false,
    },
    competingOfferDetail: {
      company: null,
      status: null,
      stage: null,
      amount: null,
      letterShareOffered: false,
      onHold: false,
      proofRequestedAtTurn: null,
      proofProvided: false,
      hasAny: false,
    },
    decisionDeadline: {
      deadlineDays: null,
      deadlineExplicit: false,
      conditionalAcceptance: false,
      conditionalEvidence: null,
      hasAny: false,
    },
    candidateProfile: seededProfile,
    miscSignals: {
      candidateFloor: null,
      salaryReviewMonths: null,
      proofOfCtcShareable: null,
      internalCounterRisk: null,
      hasAny: false,
    },
    candidateStance: {
      flexibilityPosture: null,
      marketReferenceVague: false,
      salaryOnlyFactor: false,
      badmouthsCurrent: false,
      confidentialOvershare: false,
      soundsDesperate: false,
      treatsEquityAsCash: false,
      avoidsAnchor: false,
      personalExpenseJustification: false,
      offerShoppingDemand: false,
      dismissesVariableRisk: false,
      overpromisesJoining: false,
      complainedAboutHikePercent: false,
      stallSignal: null,
      hasAny: false,
    },
    salesOTE: { ...EMPTY_SALES_OTE },
    contractRate: { ...EMPTY_CONTRACT_RATE },
    retentionCounter: { ...EMPTY_RETENTION_COUNTER },
    candidateTotalYoe: input.candidateTotalYoe ?? null,
    candidateApplicableYoe: input.candidateApplicableYoe ?? null,
    candidatePrimaryDomain: input.candidatePrimaryDomain ?? null,
    freshGradDisclosed: false,
    recruiterFactsAlreadySaid: [],
    answeredQuestionLedger: {},
    pendingPromises: [],
    lastBotReply: null,
    anchorLocked: false,
    lockedAnchorLpa: null,
    minTurnsBeforeClose: 8,
    /* PDF #17 architectural fix (2026-05-15) — initial checklist all
     * false. PDF#38 BUG-B (2026-05-20) — the prior init wired
     * discoveryStage unconditionally to "discovery", which orphaned
     * the planner's probe-mismatch consumer (no code anywhere set
     * the stage to "probe-mismatch"). Now we derive the initial
     * stage from a resume↔role hard mismatch: when the candidate's
     * resume domain (resumeFactPack.latestRole.title preferred,
     * candidatePrimaryDomain as fallback) crosses a domain-family
     * boundary versus the target role, we route the first
     * substantive turn through the mismatch-probe before letting
     * the discovery cascade or anchor turn fire. Subsequent
     * stage advance to "discovery" happens in applyAiMove below
     * (after the probe-mismatch lever lands its single turn). */
    discoveryChecklist: { ...EMPTY_DISCOVERY_CHECKLIST },
    discoveryStage: ((): DiscoveryStage => {
      const resumeTitle =
        resumeFactPack?.latestRole?.title ?? input.candidatePrimaryDomain ?? null;
      if (!resumeTitle || !input.role) return "discovery";
      const mm = detectResumeRoleMismatch({
        resumeTitle,
        targetRole: input.role,
      });
      return mm.mismatch && mm.severity === "hard" ? "probe-mismatch" : "discovery";
    })(),
    /* Negotiation-flow redesign commit 4 (2026-05-15) — reactive-followup
     * de-dupe ledger. Empty at session start; each reactive-followup
     * emission pushes its topic. */
    reactiveFollowupsFired: [],
    /* Bad-faith tactic injection ledgers (2026-05-29). Empty at start. */
    tacticsUsed: [],
    userCaughtTactics: [],
    /* Polish 2 (2026-05-16) — per-topic fire-history. Empty at start. */
    reactiveFollowupsFireLog: {},
    /* 2026-05-29 realism-pass — per-topic answer-direct serve count for
     * strict variant rotation. Empty at start. */
    candidateQuestionServeCount: {},
    /* 2026-05-29 realism-pass — candidate register classifier output.
     * Defaults to neutral; recomputed each candidate turn. */
    candidateRegister: "neutral",
    /* Fix 1 (2026-05-16) — leversFired ledger for Indian-context
     * structural levers. Empty at session start. */
    leversFired: [],
    /* Perfect 3 (2026-05-16) — cumulative urgency sticky upgrade ledger.
     * "none" at init; computeTurnDelta + finalize() promote to soft / firm
     * monotonically across the session. */
    cumulativeUrgency: "none",
    /* Kernel-first cleanup (2026-05-16) — first-class role facts and
     * candidate name. Default null when caller doesn't supply. */
    workMode: input.workMode ?? null,
    teamSize: input.teamSize ?? null,
    reportingTo: input.reportingTo ?? null,
    joiningWindow: input.joiningWindow ?? null,
    perfCycle: input.perfCycle ?? null,
    equityStructure: input.equityStructure ?? null,
    candidateName: input.candidateName ?? null,
    resumeFactPack,
    impliedPriorCtcFromResume,
    flagProvenance,
    candidateStatedCurrentCompany: null,
    credibilityProbeFired: false,
    credibilityProbeAvoidedAt: null,
    /* Prompt-injection defense telemetry (2026-05-17) — empty ledger at
     * session start; appended by the candidate-turn intake when
     * detectAndSanitizeInjection flags the utterance. */
    promptInjectionAttempts: [],
    /* Phase 5 Session A (2026-05-19) — multi-round persona switch.
     * Default-OFF invariance: when `multiRoundEnabled` is false (HEAD
     * default), `roundPersona` stays undefined, `roundIndex` stays 0,
     * `roundTransitions` stays empty, `perRoundBand` stays undefined.
     * No round-aware code path can fire. When true, seed at HR Partner /
     * round 0 with derived per-round band defaults (caller may override). */
    multiRoundEnabled: input.multiRoundEnabled === true,
    roundPersona: input.multiRoundEnabled === true ? "hr-partner" : undefined,
    roundIndex: 0,
    roundTransitions: [],
    perRoundBand:
      input.multiRoundEnabled === true
        ? (input.perRoundBand ?? deriveDefaultPerRoundBand(input.band))
        : undefined,
    /* Prior-context feature (2026-05-29) — pass-through. Undefined
     * when caller doesn't declare; otherwise frozen for session
     * lifetime. */
    priorContext: input.priorContext,
    /* Affinity-dynamic feature (2026-05-29). */
    recruiterAffinity: 0,
    affinityLedger: [],
    /* Paraphrase-loop feature (2026-05-29). */
    paraphraseFired: false,
    paraphraseCorrections: [],
    /* Calibrated-surprise lowball feature (2026-05-29). */
    calibratedSurpriseFired: false,
    calibratedSurpriseContext: null,
    acceptedLowball: false,
    acceptLowballQuietFiredAtTurn: null,
    /* Proactive-sweetener feature (2026-05-30). */
    proactiveSweetenerFired: false,
    /* Recruiter-power-dynamics feature (2026-05-29) — scalar derived
     * once at init from caller-declared signals. Undefined input →
     * {} signals and power 0 (identity behavior). */
    powerSignals: input.powerSignals ?? {},
    recruiterPower: computeRecruiterPower(input.powerSignals ?? {}),
  };
}

/* ─── Phase 5 Session A (2026-05-19) — multi-round helpers ─────────── */

/** Derive a `perRoundBand` record from a single base band. Used by
 *  `initState` when caller enables multi-round but doesn't pre-resolve
 *  the per-round bands.
 *
 *  Shape:
 *   - HR Partner    = floor only           → initialOffer = base.initialOffer,
 *                                            maxStretch = base.initialOffer
 *   - Hiring Manager= floor + ~8% stretch  → maxStretch = floor + 8% of
 *                                            (base.maxStretch − base.initialOffer)
 *                                            (i.e. partial stretch authority)
 *   - Director      = full stretch         → identical to the base band
 *
 *  walkAway / hasEquity / component caps stay aligned with the base band
 *  so the close-floor invariant (highestOfferMade never drops on round
 *  swap) is preserved structurally. */
export function deriveDefaultPerRoundBand(
  base: NegotiationBand,
): Record<NegotiationRoundPersona, NegotiationBand> {
  const stretchGap = Math.max(0, base.maxStretch - base.initialOffer);
  return {
    "hr-partner": {
      ...base,
      initialOffer: base.initialOffer,
      maxStretch: base.initialOffer,
    },
    "hiring-manager": {
      ...base,
      initialOffer: base.initialOffer,
      maxStretch: base.initialOffer + stretchGap * 0.08,
    },
    "director": {
      ...base,
      initialOffer: base.initialOffer,
      maxStretch: base.maxStretch,
    },
  };
}

/** Round-end trigger evaluator. Returns the post-transition state when
 *  the current round is closing AND there's a next persona in the
 *  sequence; otherwise returns `state` unchanged.
 *
 *  Fires when:
 *    1. `multiRoundEnabled` is true (default-OFF invariance);
 *    2. `roundPersona` is set AND `selectNextRoundPersona` returns a
 *       non-null next persona (i.e. roundIndex < 2);
 *    3. Current phase is one of:
 *         - "closing-push"   (the round-end pressure beat)
 *         - "accepted"       (candidate accepted this round)
 *         - "walked-away"    (candidate walked this round)
 *       In all three cases, this round has run its course and the next
 *       persona takes over.
 *
 *  On transition:
 *    - `roundPersona` ← next persona
 *    - `roundIndex`   incremented
 *    - `roundTransitions` accumulates the handoff entry
 *    - `phase`        reset to "opening" (each round opens fresh)
 *    - `band`         swapped to `perRoundBand[newPersona]` when defined
 *      (preserves close-floor invariant by clamping initialOffer at
 *      `highestOfferMade` if the new round band's initialOffer would
 *      drop below it; that's handled inside the swap itself).
 *    - `verbalAcceptanceTurn` / `acceptedAtTurn` / `walkedAwayAtTurn`
 *      cleared (round-scoped — next round starts fresh).
 *
 *  When `roundIndex === 2` (Director already in seat) AND the round
 *  closes, NO transition fires: the session terminates as today.
 *
 *  Pure. Call from `applyAiMove` AND `applyCandidateAnswer` at the tail,
 *  after the normal phase derivation. Idempotent — running on a state
 *  that doesn't satisfy the trigger returns the input reference. */
export function maybeAdvanceRound(state: NegotiationState): NegotiationState {
  if (!state.multiRoundEnabled) return state;
  const current = state.roundPersona;
  if (current == null) return state;
  /* Round-end signal: closing-push OR a terminal phase reached this round. */
  const ROUND_END_PHASES = new Set<NegotiationPhase>([
    "closing-push",
    "accepted",
    "walked-away",
  ]);
  if (!ROUND_END_PHASES.has(state.phase)) return state;
  const next = selectNextRoundPersona(current);
  if (next == null) return state; /* Director — terminal, no further round. */
  /* Defensive guard — should never trip given the index/persona invariant
   * carried through initState + this helper, but kept so a corrupted
   * legacy session can't escalate past Director. */
  const currentIndex = state.roundIndex ?? 0;
  if (currentIndex >= 2) return state;
  const nextIndex = (currentIndex + 1) as 0 | 1 | 2;
  const nextBand =
    state.perRoundBand?.[next] ?? state.band;
  /* Preserve the candidate's disclosed signal: the band swap MUST NOT
   * drop initialOffer below `highestOfferMade`, otherwise the close-
   * floor invariant breaks across the handoff. Clamp upward if needed. */
  const clampedBand: NegotiationBand =
    nextBand.initialOffer < state.highestOfferMade
      ? { ...nextBand, initialOffer: state.highestOfferMade }
      : nextBand;
  return {
    ...state,
    roundPersona: next,
    roundIndex: nextIndex,
    roundTransitions: [
      ...(state.roundTransitions ?? []),
      { atTurn: state.turnIndex, from: current, to: next },
    ],
    phase: "opening",
    band: clampedBand,
    /* Round-scoped — clear acceptance / walked-away markers so the new
     * round's machinery starts fresh. `highestOfferMade` is preserved
     * (the candidate doesn't forget what's been put on the table). */
    verbalAcceptanceTurn: null,
    acceptedAtTurn: null,
    walkedAwayAtTurn: null,
  };
}

/* Exported for the round-aware persona sequence helper used by tests
 * and Session B downstream consumers. */
export { ROUND_PERSONA_SEQUENCE };

/* ─── Fix 3 (PDF #17 follow-up, 2026-05-15) — Explicit decline + dead-end ──
 *
 * Real-session bug: bot ended a 6-turn conversation with "View Result"
 * and no resolution. The terminal-state invariant below tightens
 * transitions: terminal phases (accepted / walked-away / stalemate)
 * may only fire when ONE of the following is true:
 *
 *   1. detectExplicitAcceptance(answer).accepted === true AND
 *      highestOfferMade > 0
 *   2. Candidate explicitly declined ("I'm passing", "I'll decline",
 *      "not interested")
 *   3. turnIndex >= MAX_TURNS_PER_SESSION (hard cap)
 *   4. Three consecutive "I don't know" / "I'm not sure" candidate
 *      turns (genuine dead-end)
 *
 * The minTurnsBeforeClose guard blocks (1) and (4) before the floor
 * turn count. (2) and (3) always pass. Pure. */

const EXPLICIT_DECLINE_PATTERNS: RegExp[] = [
  /\b(?:i'?m\s+passing|i\s+am\s+passing|i\s+will\s+pass|i'?ll\s+pass)\b/i,
  /\b(?:i\s+(?:will\s+)?decline|i'?ll\s+decline|i\s+have\s+to\s+decline|i\s+must\s+decline)\b/i,
  /\b(?:not\s+interested|no(?:'?t|t)\s+interested|i'?m\s+not\s+interested)\b/i,
  /\b(?:withdraw(?:ing)?\s+(?:my\s+)?(?:candidacy|application)|stepping\s+out\s+of\s+(?:this\s+)?process)\b/i,
  /\b(?:i'?ll\s+(?:go|move)\s+with\s+(?:the\s+)?other(?:s)?|going\s+with\s+another\s+offer)\b/i,
];

export function detectExplicitDecline(answer: string | null | undefined): boolean {
  if (!answer || typeof answer !== "string") return false;
  return EXPLICIT_DECLINE_PATTERNS.some((p) => p.test(answer));
}

/** PDF#35 Move 3 (2026-05-18) — flat-ack vocabulary. Single source of
 *  truth for "bare acknowledgement, zero new content" candidate
 *  utterances. Prior implementation caught only "ok / cool / sure";
 *  Meesho/Prita replay surfaced "got it", "right", "noted",
 *  "understood", "makes sense", "fair", "fine", "alright" being
 *  treated as substantive (and downstream loops were planning around
 *  them as if discovery had advanced). Broadened here so every
 *  consumer that needs "flat-ack vs real answer" reads from the same
 *  literal set. */
export const FLAT_ACK_RE =
  /^\s*(?:ok|okay|cool|sure|got\s+it|right|understood|noted|makes\s+sense|fair(?:\s+enough)?|fine|alright|hmm+|mm+hmm+|yeah|yep|yup|aha|ah)[\s.,!?]*$/i;

export function isFlatAck(answer: string | null | undefined): boolean {
  if (!answer || typeof answer !== "string") return false;
  return FLAT_ACK_RE.test(answer);
}

/* Sprint B.2 (2026-05-15) — number-discipline gate.
 *
 * Recruiter-anchors-first is the #1 reason new recruiters give away money:
 * the candidate dodges "what are you targeting?" and the recruiter
 * volunteers a number. Real recruiters never disclose a specific number
 * until either:
 *   (a) the candidate has anchored (candidateTargetLpa is set), OR
 *   (b) discovery is complete AND the candidate has refused the
 *       expectation probe at least twice (probeRefusalCount ≥ 2).
 *
 * Returns true when it's safe to disclose a specific number. Pure. */
export function canDiscloseSpecificNumber(state: NegotiationState): boolean {
  if (state.candidateTarget != null) return true;
  const refusals = state.probeRefusalCount ?? 0;
  if (refusals >= 2) {
    /* Discovery-complete check is only meaningful when the checklist is
     * tracked; otherwise treat refusal-count alone as sufficient. */
    const checklist = state.discoveryChecklist;
    if (checklist == null) return true;
    const fam = classifyRoleFamily(state.role);
    return isDiscoveryComplete(checklist, fam);
  }
  return false;
}

/* Sprint A.4 (2026-05-15) — current-employer free-form extractor.
 * Patterns: "currently at X" / "working at X" / "I'm with X" / "I work
 * at X" / "right now at X" / "presently at/with X". Returns the proper-
 * noun phrase (1-3 capitalized tokens) or null. Conservative on stop-
 * words ("a", "the", "my") to avoid false positives. Pure. */
const CURRENT_EMPLOYER_PATTERNS: RegExp[] = [
  /\b(?:currently|presently|right\s+now)\s+(?:at|with|working\s+(?:at|for))\s+([A-Z][A-Za-z0-9&.-]*(?:\s+[A-Z][A-Za-z0-9&.-]*){0,2})/,
  /\bI(?:'?m|\s+am)\s+(?:at|with|working\s+(?:at|for))\s+([A-Z][A-Za-z0-9&.-]*(?:\s+[A-Z][A-Za-z0-9&.-]*){0,2})/,
  /\bI\s+work\s+(?:at|for|with)\s+([A-Z][A-Za-z0-9&.-]*(?:\s+[A-Z][A-Za-z0-9&.-]*){0,2})/,
  /\bworking\s+(?:at|for|with)\s+([A-Z][A-Za-z0-9&.-]*(?:\s+[A-Z][A-Za-z0-9&.-]*){0,2})/,
];
export function detectCurrentEmployer(answer: string | null | undefined): string | null {
  if (!answer || typeof answer !== "string") return null;
  for (const re of CURRENT_EMPLOYER_PATTERNS) {
    const m = answer.match(re);
    if (m && m[1]) {
      const candidate = m[1].trim();
      // Reject filler-only matches like "A", "The", "My".
      if (candidate.length < 2) continue;
      if (/^(?:The|My|Our|An?|This|That)$/i.test(candidate)) continue;
      return candidate;
    }
  }
  return null;
}

const DEAD_END_PATTERNS: RegExp[] = [
  /\b(?:i\s+don'?t\s+know|i\s+do\s+not\s+know|not\s+sure|i'?m\s+not\s+sure|no\s+idea|dunno|idk)\b/i,
  /\b(?:can'?t\s+say|cannot\s+say|hard\s+to\s+say|tough\s+to\s+say)\b/i,
];

/** Returns true when the last 3 candidate turns in conversationLog are
 *  all "I don't know" / "I'm not sure" / similar dead-end signals.
 *  Genuine dead-end → terminal close is acceptable. Pure. */
export function detectConsecutiveDeadEnd(state: NegotiationState): boolean {
  const log = state.conversationLog ?? [];
  let candidateCount = 0;
  let deadEnds = 0;
  for (let i = log.length - 1; i >= 0; i--) {
    const e = log[i];
    if (!e || e.speaker !== "candidate") continue;
    candidateCount += 1;
    const t = e.text || "";
    if (DEAD_END_PATTERNS.some((p) => p.test(t))) {
      deadEnds += 1;
    } else {
      return false;
    }
    if (candidateCount >= 3) break;
  }
  return candidateCount >= 3 && deadEnds >= 3;
}

/** Premature-close guard. Returns true when the kernel is permitted to
 *  transition into a terminal phase given the current state. The
 *  caller passes the candidate answer (for explicit-decline detection)
 *  and a reason describing the path:
 *
 *    - "accept"         — strict explicit acceptance (e.g. "I accept",
 *                          "please send the offer letter"). Always
 *                          passes — explicit accept is one of the four
 *                          permitted close conditions.
 *    - "soft-accept"    — implicit / soft-acceptance proxy (3+
 *                          trailing non-counter candidate turns). Blocked
 *                          before minTurnsBeforeClose so the bot can't
 *                          flip to terminal too early.
 *    - "decline"        — candidate explicitly declined. Always passes.
 *    - "max-turns"      — MAX_TURNS_PER_SESSION reached. Always passes.
 *    - "dead-end"       — 3+ consecutive "I don't know" candidate turns.
 *                          Blocked before minTurnsBeforeClose. */
export function canCloseSession(
  state: NegotiationState,
  answer: string | null | undefined,
  reason: "accept" | "soft-accept" | "decline" | "max-turns" | "dead-end",
): boolean {
  /* Hard-cap always wins. */
  if (reason === "max-turns") return true;
  /* Explicit decline always passes the guard. */
  if (reason === "decline") return true;
  /* PDF#48 (2026-05-26) — structural anti-premature-close invariant.
   *
   * The bug: a candidate answered three data-collection questions
   * (current CTC, base split, "no there is not equity"). The kernel
   * announced ₹30.4 LPA on turn 4 and on the SAME turn fired
   * close-acceptance with a full post-acceptance message ("Locking the
   * close at ₹30.4L... Aadhaar, PAN, BGV, retention-counter warning,
   * joining-date lock") — all in one turn. The candidate never had a
   * chance to counter, ask for breakdown, or even react.
   *
   * The trigger was a soft-accept false-positive: parseAcceptance read
   * a candidate utterance (likely "no there is not equity" parsed via
   * the medium-confidence path, or an empty Continue press) as
   * acceptance, the planner stamped verbalAcceptanceTurn = turnIndex
   * via the PDF#36 A2 fast-path, and `_next-action-planner.ts:1765`
   * fired close-acceptance the same turn the offer was first spoken.
   *
   * The root invariant being violated: an "accept" cannot logically
   * exist BEFORE an offer the candidate has seen and processed. The
   * minimum-viable structural guarantee is one full candidate turn
   * AFTER the first offer was announced. Without that, acceptance is
   * by definition a parse artifact — there is nothing yet to accept.
   *
   * Gate BOTH strict-accept and soft-accept (this code-path; the
   * caller at line 4188 / 4261 routes both through here) on:
   *
   *   firstOfferAtTurn != null
   *     AND turnIndex > firstOfferAtTurn          (≥1 candidate turn elapsed)
   *
   * If the candidate has named a counter, that's prima facie proof
   * they processed the offer and the gate releases immediately —
   * counter-then-accept is a normal negotiation path. Strict-accept
   * also gets a same-turn release ONLY if the LANGUAGE is explicit
   * (the candidate literally said "I accept" / "send the offer
   * letter") rather than soft-accept proxies.
   *
   * No real session loses anything from this guard: a candidate who
   * wants to accept can do so on the very next turn. A candidate who
   * doesn't want to accept stops being silently force-closed. */
  /* Soft-accept ONLY: when we can prove the offer landed THIS turn
   * (firstOfferAtTurn === turnIndex) AND the candidate hasn't named a
   * counter, block the close. This catches the PDF#48 trigger where
   * a candidate utterance answering an unrelated probe ("no there is
   * not equity" answering the ESOPs question) gets parsed by the
   * soft-accept proxy as acceptance on the same turn the offer was
   * first announced. Strict explicit acceptance ("I accept", "please
   * send the offer letter") is unambiguous human consent and is NOT
   * gated — a candidate who literally says "I accept" to a same-turn
   * offer should be allowed to close. */
  if (reason === "soft-accept") {
    if (state.firstOfferAtTurn != null && state.firstOfferAtTurn === state.turnIndex) {
      const candidateCountered =
        state.lastCandidateCounterLpa != null || state.candidateTarget != null;
      if (!candidateCountered) return false;
    }
  }
  /* Strict explicit accept past the structural gate is one of the four
   * canonical valid-close conditions — always passes. */
  if (reason === "accept") return true;
  const min = state.minTurnsBeforeClose ?? 8;
  /* Hard system cap (60) always passes regardless of min. */
  if (state.turnIndex >= 60) return true;
  /* Before the min-turns floor, block soft-accept and dead-ends unless
   * the candidate has explicitly declined this turn. */
  if (state.turnIndex < min) {
    if (detectExplicitDecline(answer)) return true;
    return false;
  }
  return true;
}

/* ─── Candidate answer → parsed signals ──────────────────────────── */

export interface ParsedAnswer {
  target: number | null;
  currentCtc: number | null;
  competing: number | null;
  signalsAcceptance: boolean;
  signalsWalkAway: boolean;
  /* Candidate stated their target as a range ("30-35 LPA") rather than
     a single number. Set on the turn it's detected; sticky on state. */
  targetAsRange: boolean;
  /** Audit Fix (2026-05-19) — Component scope of the bound `target`.
   *  Passed through from the number-role classifier. "total" by default,
   *  "fixed" when the candidate tagged the target with a base/fixed
   *  qualifier, null when no target was bound. The kernel routes
   *  "fixed"-scoped targets to candidateTargetFixed instead of
   *  candidateTarget. */
  targetComponent?: "total" | "fixed" | null;
  /* Voss / interviewing.io tactics detected this turn. Multiple may
     fire on the same answer. */
  vossTactics: VossTactic[];
  /* Information items the candidate explicitly asked about this turn. */
  infoAsked: InfoIntent[];
  /* Candidate has explicitly hedged on a competing offer ("I have other
     offers but can't share details"). Signals leverage without
     disclosing a number — kernel should respect but not anchor. */
  signalsCompetingExistsWithoutNumber: boolean;
  /* Component breakdown the candidate stated this turn — base /
     variable / equity. Phase 10A (2026-05-13). When `hasAny` is true,
     the LLM prompt surfaces these so it can respect base-floor /
     variable-cap constraints in subsequent offers. Phase 12 added
     enforcement in the move-picker (response hints + base-floor
     validator). */
  componentBreakdown: ComponentBreakdown;
  /* Phase 11 (2026-05-13) — rationale + hike justification cues. */
  rationale: RationaleResult | null;
  /* Phase 13 — notice / joining bonus / buyout signals. */
  noticeJoining: NoticeJoiningResult;
  /* Phase 14 — equity vesting preferences + literacy. */
  equityVesting: EquityVestingResult;
  /* Phase 15 — work-mode + location + relocation signals. */
  locationMode: LocationModeResult;
  /* Phase 16 — competing-offer paperwork / company / stage detail. */
  competingOfferDetail: CompetingOfferDetail;
  /* Phase 17A — deadline + conditional accept. */
  decisionDeadline: DecisionDeadlineResult;
  /* Phase 17B — candidate background (gap / tenure / level mismatch). */
  candidateProfile: CandidateProfileResult;
  /* Phase 17F — floor / review / proof / internal-counter scalars. */
  miscSignals: MiscSignalsResult;
  /* Phase 18 — candidate stance / posture scalars. */
  candidateStance: CandidateStanceResult;
  /* Phase 27 — retention-counter from current employer. */
  retentionCounter: RetentionCounterResult;
}

/* Parse the candidate's free-text answer for salary-relevant numbers
   and intent signals. Distinguishes "my current package is X" (currentCtc)
   from "I'm looking for Y" (target). Strict ordering: current/competing
   patterns claim their numbers first; target patterns only bind a
   number that wasn't already bound elsewhere. This is what the legacy
   extractor did across the whole transcript every render; here we run
   it once per candidate turn against the single fresh answer. */
/* Hinglish word-number substitution (`tees` → 30, `pachas` → 50, etc.)
 * was relocated to `_speech-normalize.ts` as part of the STT-fragility
 * audit (2026-05-22). The kernel-boundary `normalizeForParsing` call in
 * `parseCandidateAnswer` below runs it together with English
 * number-words, unit-typo fixups, and decimal-point folding — single
 * source of truth for STT normalization. */

/* Voss-tactic detection. These patterns are conservative — only
   reasonably unambiguous formulations are recognized. False positives
   here would silently boost concessions for candidates who didn't
   actually negotiate well. */
function detectVossTactics(a: string, lastAiText: string): VossTactic[] {
  const out: VossTactic[] = [];

  /* Mirror: candidate ends with a 1-3 word echo of the AI's last
     content phrase, phrased as a question. We approximate by checking
     for trailing "?" + last-AI 1-3 word echo. */
  if (lastAiText && /\?\s*$/.test(a)) {
    const aiWords = fingerprintWords(lastAiText);
    const candWords = fingerprintWords(a);
    if (aiWords.length >= 2 && candWords.length >= 1) {
      const tail = candWords.slice(-3);
      if (tail.length > 0 && aiWords.slice(-6).join(" ").includes(tail.join(" "))) {
        out.push("mirror");
      }
    }
  }

  /* Label: "it sounds like X" / "it seems like X" / "you must be X".
     The classic Voss formulations that name the other party's
     constraint or emotion. */
  if (/\b(it\s+(?:sounds|seems|looks|feels)\s+like|you\s+must\s+(?:be|feel|need)|it\s+appears\s+that)\b/i.test(a)) {
    out.push("label");
  }

  /* Calibrated how/what question. We require "how"/"what" + a modal +
     question mark to avoid grabbing every "how are you" pleasantry. */
  if (/\b(how\s+(?:am\s+i|can\s+(?:we|i)|do\s+(?:you|we)|would\s+you|could\s+(?:we|you))|what.?s\s+(?:the\s+(?:best|most|maximum)|your\s+thinking|driving|behind))\b[^?]*\?/i.test(a)) {
    out.push("calibrated");
  }

  /* "Sign today if X+Y+Z" bundle from interviewing.io playbook.
     Matches both orderings: "sign today if X" and "if X I'll sign
     today". */
  const signToday = /\b(sign\s+today|accept\s+today|close\s+(?:this\s+)?today|done\s+today|sign\s+(?:right\s+)?now|sign\s+tonight)\b/i;
  const conditional = /\b(if|when|provided|as\s+long\s+as)\b/i;
  if (signToday.test(a) && conditional.test(a)) {
    out.push("sign-today-bundle");
  }

  /* Current-CTC deflection. Candidate explicitly refuses to disclose
     current package. */
  if (/\b(?:prefer\s+not\s+to\s+(?:share|disclose)|company\s+policy.*(?:share|disclose|reveal)|(?:current\s+)?ctc\s+is\s+(?:irrelevant|confidential)|focus\s+on\s+(?:expected|market)|don.?t\s+(?:share|disclose)\s+(?:my\s+)?(?:current\s+)?ctc|rather\s+(?:not\s+)?(?:share|discuss)\s+(?:my\s+)?current)\b/i.test(a)) {
    out.push("deflect-current-ctc");
  }

  return out;
}

/* Info-intent detection. The candidate explicitly asks about an offer
   component. Each phrase is conservative — we'd rather miss an ask than
   credit one that wasn't there. */
function detectInfoIntents(a: string): InfoIntent[] {
  const out: InfoIntent[] = [];
  if (/\b(clawback|claw\s+back|return\s+(?:the\s+)?bonus|repay(?:ment)?|pro[-\s]?rata|tenure\s+requirement)\b/i.test(a)) out.push("clawback-period");
  if (/\b(variable\s+(?:pay|component|payout|history)|bonus\s+payout\s+(?:history|last|past)|payout\s+(?:percentage|%|history)|how\s+much\s+variable)\b/i.test(a)) out.push("variable-history");
  if (/\b(vest(?:ing)?\s+(?:schedule|period|cliff|slope)|cliff|grant\s+schedule|back[-\s]?loaded|monthly\s+vest|quarterly\s+vest)\b/i.test(a)) out.push("vest-schedule");
  if (/\b(strike\s+price|exercise\s+price|409a|fmv|fair\s+market\s+value|grant\s+price)\b/i.test(a)) out.push("strike-price");
  if (/\b(in[-\s]?hand|take[-\s]?home|net\s+(?:salary|monthly|pay)|monthly\s+(?:salary|pay|in\s+hand))\b/i.test(a)) out.push("in-hand-monthly");
  if (/\b(exercise\s+window|post[-\s]?termination|after\s+(?:leaving|resignation)|exercise\s+period)\b/i.test(a)) out.push("exercise-window");
  if (/\b(accelerat(?:ed|ion)\s+vest|change\s+of\s+control|acquisition\s+(?:trigger|clause|vesting)|single[-\s]?trigger|double[-\s]?trigger)\b/i.test(a)) out.push("acceleration");
  /* PDF#41 BUG-B (2026-05-21) — broaden fixed-vs-variable detection.
   * Live Flipkart session: candidate asked "can you provide the
   * breakdown of base vs variable?" and the AI freelanced a refusal
   * because neither this regex (matched only "fixed vs variable", not
   * "base vs variable") nor package-breakdown (required "breakdown of
   * offer/package/ctc", not "breakdown of base") fired. Added
   * "base vs/versus/or/and variable" + "breakdown of base" + "base
   * split" so the wantsBreakdown short-circuit at the planner picks
   * the canonical breakdown lever instead of routing to the LLM
   * answer path. */
  if (/\b(fixed\s+(?:vs|versus|and|or)\s+variable|variable\s+(?:vs|versus|or)\s+fixed|base\s+(?:vs|versus|and|or)\s+variable|variable\s+(?:vs|versus|or|and)\s+base|split\s+(?:between|of)\s+(?:fixed|base)|how\s+much\s+(?:is\s+)?fixed|fixed\s+component|ctc\s+(?:breakdown|split)|base\s+fixed\s+or\s+variable|breakdown\s+of\s+base|base\s+split)\b/i.test(a)) out.push("fixed-vs-variable");
  if (/\b(sodexo|food\s+coupon|gratuity|nps|insurance\s+(?:value|cost)|non[-\s]?cash|benefits\s+(?:value|in\s+ctc))\b/i.test(a)) out.push("perks-non-cash");
  /* Generic "walk me through / break it down / what's the structure" —
     the candidate is explicitly asking the recruiter to enumerate the
     package, NOT to probe their expectations. The Lollypop session
     (May 2026) showed the AI responding to "could you break down the
     offer for me?" with "what range are you targeting?" — a phase
     mismatch the move-picker now overrides via this intent. */
  if (/\b(walk\s+me\s+through|break\s+(?:it|that|the\s+offer|the\s+package)\s+down|breakdown\s+of\s+(?:the\s+)?(?:offer|package|ctc)|structure\s+of\s+(?:the\s+)?(?:offer|package|ctc)|what(?:'s|\s+is)\s+(?:in\s+)?(?:the\s+)?(?:package|offer)|tell\s+me\s+more\s+about\s+(?:the\s+)?(?:package|offer|ctc))\b/i.test(a)) out.push("package-breakdown");
  /* Generic benefits / perks ask — "what are the benefits?", "what
     perks do you offer?", "what do I get besides salary?", "tell me
     about the benefits package", "for the benefits.". Bug report 11
     follow-up E (2026-05-14): the recruiter previously had no response
     for this and looped close-acceptance. Distinct from `perks-non-cash`
     (lump-into-CTC trick) — this is purely an info disclosure. We
     deliberately do NOT match a bare "benefits" word standing alone
     against substrings like "fringe benefits of equity"; we anchor to
     interrogative shapes or the explicit "for the benefits" follow-up. */
  /* Bug session 12 (2026-05-14) — broaden benefits detection.
   * Trigger when an utterance contains \bbenefits?\b OR \bperks?\b AND
   * shows interrogative / imperative shape:
   *   - ends with `?`
   *   - imperative verb: tell|let me know|give|share|explain|list|
   *     describe|details|breakdown|elaborate|walk me through
   *   - question lead: what are|what is|what's|how about|how does|
   *     what does|what kind of|which|can you|could you
   * Falsy guard: bare declaratives like "I counted the benefits." don't
   * trip because they lack interrogative shape and end with `.`.
   * Existing narrow phrases (for the benefits., what do I get, etc.)
   * still match via the legacy regex. */
  const hasBenefitsWord = /\b(?:benefits?|perks?)\b/i.test(a);
  const endsWithQuestion = /\?\s*$/.test(a.trim());
  const imperativeCue = /\b(?:tell\s+me|let\s+me\s+know|give\s+(?:me)?|share|explain|list|describe|details?|breakdown|elaborate|walk\s+me\s+through|can\s+you|could\s+you|would\s+you)\b/i.test(a);
  const questionLead = /\b(?:what\s+are|what\s+is|what['’]s|how\s+about|how\s+does|what\s+does|what\s+kind\s+of|which)\b/i.test(a);
  const broadBenefitsMatch = hasBenefitsWord && (endsWithQuestion || imperativeCue || questionLead);
  const legacyBenefitsMatch =
    /\b(?:what(?:'s|\s+is|\s+are)?\s+(?:the\s+|some\s+|your\s+)?(?:benefits|perks)|tell\s+me\s+(?:about\s+)?(?:the\s+)?(?:benefits|perks)|(?:any|other)\s+(?:benefits|perks)|let\s+me\s+know\s+(?:about\s+)?(?:are\s+)?(?:the\s+)?(?:benefits|perks)|for\s+the\s+(?:benefits|perks)\b|what\s+do\s+i\s+get|benefits\s+(?:for\s+this\s+role|package|breakdown)|perks\s+(?:do\s+you|of\s+(?:this|the)))\b/i.test(a);
  /* "fringe benefits" used to be a standalone trigger; it now requires
   * interrogative shape so "fringe benefits of equity are nice"
   * (declarative) does not fire. */
  const fringeBenefitsMatch = /\bfringe\s+benefits\b/i.test(a) && (endsWithQuestion || imperativeCue || questionLead);
  if (broadBenefitsMatch || legacyBenefitsMatch || fringeBenefitsMatch) out.push("benefits-overview");

  /* Bug session 12 (2026-05-14) — compensation-breakdown.
   * Candidate asking about variable / bonus / ESOP / equity / RSU /
   * OTE structure — generally, NOT about THIS offer's components. Same
   * interrogative/imperative shape gate as benefits-overview so bare
   * declaratives ("the variable was 12% last year") don't trip. */
  const hasCompWord =
    /\bvariable\s+(?:components?|pay|comp(?:ensation)?)\b/i.test(a) ||
    /\bbonus(?:es)?\b/i.test(a) ||
    /\bESOPs?\b/i.test(a) ||
    /\bstock\s+options?\b/i.test(a) ||
    /\bRSUs?\b/i.test(a) ||
    /\bequity\b/i.test(a) ||
    /\bOTE\b/i.test(a) ||
    /on[-\s]target\s+earnings/i.test(a) ||
    /performance\s+bonus/i.test(a) ||
    /\bcommission\b/i.test(a);
  if (hasCompWord && (endsWithQuestion || imperativeCue || questionLead)) {
    out.push("compensation-breakdown");
  }

  /* Session B (2026-05-14) — notice-period info ask. Anchored to
   * interrogative shapes around notice / start-date / joining-date /
   * buyout so declarative "I have a 60-day notice" doesn't trip. */
  const noticeAskPatterns = [
    /\bnotice\s+period\s*\?/i,
    /\b(?:what(?:'s|\s+is)|how\s+long\s+is)\s+(?:the\s+)?(?:notice|notice\s+period)\b/i,
    /\b(?:when|how\s+soon)\s+can\s+i\s+(?:join|start)\b/i,
    /\b(?:earliest|expected)\s+(?:start\s+date|joining\s+date)\s*\??/i,
    /\bjoining\s+date\s*\?/i,
    /\bstart\s+date\s*\?/i,
    /\bbuyout\s*\?/i,
    /\b(?:do\s+you|will\s+you|can\s+you)\s+(?:offer|cover|do)\s+(?:a\s+)?buy[-\s]?out\b/i,
    /\bbuy[-\s]?out\s+option\b/i,
  ];
  if (noticeAskPatterns.some((p) => p.test(a))) out.push("notice-period-ask");

  /* Session B (2026-05-14) — hike-percentage info ask. The candidate
   * is asking what hike% the offer represents vs their current CTC.
   * Anchored to interrogative shape so declarative "I want a 30% hike"
   * doesn't fire. */
  const hikeDeclarativeGuard = /\b(?:i\s+want|i.?m\s+asking|i\s+expect|i\s+need|i.?d\s+like|i\s+am\s+looking\s+for|expecting)\b/i.test(a);
  const hikeAskPatterns = [
    /\b(?:what(?:'s|\s+is)?|how\s+much)\s+(?:(?:the|a)\s+)?(?:hike|raise|increment|bump)\b/i,
    /\bhike\s*%/i,
    /(?:^|\s)%\s+(?:hike|raise|increment)\s*\?/i,
    /\b(?:is\s+this|will\s+this\s+be)\s+(?:a\s+)?\d{1,3}\s*%\s+(?:hike|raise|increment|bump)\b/i,
    /\bhike\s+(?:from|on)\s+(?:my\s+)?current\b/i,
    /\bwhat\s+hike\s+is\s+this\b/i,
  ];
  if (!hikeDeclarativeGuard && hikeAskPatterns.some((p) => p.test(a))) out.push("hike-percentage-ask");

  return out;
}

/* ─── Input-sanity bounds (launch-blocker, 2026-05-14) ──────────────
 *
 * The kernel previously accepted any number the parsers extracted —
 * including absurd values like "₹50,000 crore" from STT mishears or
 * scripted abuse. That number then propagated into hike-% math, band-
 * comparison branches, and telemetry. The clamping helpers below pin
 * each numeric input to a plausible upper bound and reject negative /
 * NaN / Infinity. Out-of-bounds values become null — which is the
 * "not-stated" sentinel the rest of the kernel already handles. */

/** Hard ceiling on INR LPA values. 5000 LPA = ₹50 Cr per annum, which
 *  is well above any real Indian comp number (top-of-market C-suite
 *  TC is ~₹15-25 Cr including equity). Anything above this is a
 *  parser / STT artefact. */
export const MAX_INR_LPA = 5000;

/** Hard ceiling on notice-period days. 365 days = 1 year, which is
 *  the longest realistic notice (some senior overseas contracts).
 *  Anything above is a parser artefact. */
export const MAX_NOTICE_DAYS = 365;

/** Hard ceiling on career-gap months. 60 months = 5 years, which is
 *  the soft outer bound already enforced by extractGapMonths. We add
 *  a defensive clamp here so out-of-band values from any source get
 *  rejected. */
export const MAX_GAP_MONTHS = 60;

/** Clamp an INR LPA-denominated number to [0, MAX_INR_LPA]. Returns
 *  null for negative, NaN, ±Infinity, or > MAX_INR_LPA. Zero is
 *  accepted (a candidate stating "current package zero" / fresher
 *  with no prior salary is structurally valid). */
export function clampInr(v: number | null): number | null {
  if (v == null) return null;
  if (typeof v !== "number") return null;
  if (!Number.isFinite(v)) return null;
  if (v < 0) return null;
  if (v > MAX_INR_LPA) return null;
  return v;
}

/** Clamp notice-period days to (0, MAX_NOTICE_DAYS]. Zero is
 *  rejected (candidate states "no notice" via other signals, not 0
 *  days). Negative / NaN / ±Infinity / overflow → null. */
export function clampNoticeDays(v: number | null): number | null {
  if (v == null) return null;
  if (typeof v !== "number") return null;
  if (!Number.isFinite(v)) return null;
  if (v <= 0) return null;
  if (v > MAX_NOTICE_DAYS) return null;
  return v;
}

/** Clamp career-gap months to (0, MAX_GAP_MONTHS]. Same rules as
 *  clampNoticeDays — zero is rejected (no gap means null, not 0). */
export function clampGapMonths(v: number | null): number | null {
  if (v == null) return null;
  if (typeof v !== "number") return null;
  if (!Number.isFinite(v)) return null;
  if (v <= 0) return null;
  if (v > MAX_GAP_MONTHS) return null;
  return v;
}

/* Phase param is optional and only used to widen target-binding when
 * the recruiter just asked for expectations. The Tech-Mahindra UX
 * session (May 2026) had the candidate reply "30 lpa thirty lakhs
 * per ctc" — bare number, no "looking for / want / expecting"
 * trigger — and the kernel left target = null, so the AI kept
 * probing instead of countering. When `phase === "probe-expectations"`
 * a bare "<n> LPA / lakhs" is accepted as the target (still gated
 * by the current/competing disambiguator). */
export function parseCandidateAnswer(
  answer: string,
  lastAiText = "",
  phase?: NegotiationPhase,
  /** Whether an offer has been quoted by the bot. When known and
   *  false, the acceptance classifier vetoes commitment idioms
   *  ("sounds good") that lack an offer reference — you can't
   *  accept what hasn't been offered. Default undefined preserves
   *  back-compat for callers that don't have state context. */
  offerOnTable?: boolean,
  /** Phase 3 missing-lever set (2026-05-17) — current state.turnIndex.
   *  Threaded through to extractCandidateStance to stamp
   *  stallSignal.statedAt at the candidate-turn index of first
   *  detection. Default 0 preserves back-compat with callers that
   *  don't have state context (unit-test fixtures). */
  turnIndex: number = 0,
  /** PDF#29 Bug 1 (2026-05-18) — prior-state total CTC. When supplied
   *  AND the candidate names a single-sided absolute split this turn,
   *  the component-breakdown parser derives the complement (variable =
   *  total − base, or base = total − variable). Optional to preserve
   *  back-compat for callers that don't have state context. */
  priorTotalCtc: number | null = null,
): ParsedAnswer {
  /* STT fragility audit (2026-05-22) — kernel-boundary normalization.
   *
   * Follow-up to f5289f3 (LPA→LPE STT mishear fix). That commit landed
   * inline fixes in two parsers; this routes ALL downstream parsers
   * through a single normalizer at the candidate-turn entry boundary.
   * `normalizeForParsing` is a superset of the legacy
   * `substituteHinglishNumbers` (which it absorbs) plus English
   * number-words, unit-typo fixups (LPE/lacks/krore/rupies), letter-
   * spelled "L P A", and decimal-point folding. Every extractor below
   * (`extractComponentBreakdown`, `extractHikeRationale`,
   * `extractNoticeJoining`, `extractEquityVesting`,
   * `extractLocationMode`, `extractCompetingOfferDetail`,
   * `extractDecisionDeadline`, `extractCandidateProfile`,
   * `extractMiscSignals`, `extractCandidateStance`,
   * `extractRetentionCounter`, `classifyAcceptance`,
   * `classifyNumberRoles`) sees the normalized string. */
  const a = normalizeForParsing((answer || "").trim());
  if (!a) {
    return {
      target: null, currentCtc: null, competing: null,
      signalsAcceptance: false, signalsWalkAway: false,
      targetAsRange: false, targetComponent: null, vossTactics: [], infoAsked: [],
      signalsCompetingExistsWithoutNumber: false,
      componentBreakdown: { base: null, variable: null, equity: null, hasAny: false },
      rationale: null,
      noticeJoining: { noticePeriodDays: null, buyoutRequested: false, joiningBonusAsk: null, earlyJoinPreferred: false, joiningBonusClawbackDiscussed: false, lastWorkingDayText: null, hasAny: false },
      equityVesting: { vestingYears: null, cliffMonths: null, preference: null, familiarity: null, strikePriceDiscussed: false, valuationDiscussed: false, liquidityDiscussed: false, equityExists: null, hasAny: false },
      locationMode: { workMode: null, locationCity: null, relocationRequested: false, relocationRefused: false, hasAny: false },
      competingOfferDetail: { company: null, status: null, stage: null, amount: null, letterShareOffered: false, onHold: false, proofRequestedAtTurn: null, proofProvided: false, hasAny: false },
      decisionDeadline: { deadlineDays: null, deadlineExplicit: false, conditionalAcceptance: false, conditionalEvidence: null, hasAny: false },
      candidateProfile: { ...EMPTY_CANDIDATE_PROFILE },
      miscSignals: { candidateFloor: null, salaryReviewMonths: null, proofOfCtcShareable: null, internalCounterRisk: null, hasAny: false },
      candidateStance: { flexibilityPosture: null, marketReferenceVague: false, salaryOnlyFactor: false, badmouthsCurrent: false, confidentialOvershare: false, soundsDesperate: false, treatsEquityAsCash: false, avoidsAnchor: false, personalExpenseJustification: false, offerShoppingDemand: false, dismissesVariableRisk: false, overpromisesJoining: false, hasAny: false },
      retentionCounter: { ...EMPTY_RETENTION_COUNTER },
    };
  }

  /* Acceptance detection is delegated to the unified
   * `_acceptance-classifier` module (Phase 9, 2026-05-13). The legacy
   * inline regex bank that lived here was duplicated in
   * `interviewEvaluation.extractNegotiationFacts.acceptedImmediately`
   * and the two paths drifted across sessions — each fix had to land
   * twice. The classifier is the single source of truth for both
   * detectors, and adds a structural phase gate that pure regex can't
   * express ("you can't accept what hasn't been offered"). The
   * walk-away signal is still computed locally because the kernel
   * exposes it as an independent ParsedAnswer field, and the legacy
   * extractor needs a paired walk-away check on the same axis. */
  const acceptanceResult = classifyAcceptance(a, { phase, offerOnTable });
  const signalsAcceptance = acceptanceResult.accepted;
  const signalsWalkAway = isWalkAway(a);

  /* Architectural refactor (PDF#30, 2026-05-18) — number-role classification.
   *
   * Five PDFs in a row surfaced parser misses where a candidate's
   * disclosure was dropped on the floor and the bot looped. Each fix
   * added a regex alternative to a 60+-alt bank in this function;
   * eventually the bank became impossible to reason about (alt-N
   * shadowing alt-N+1, role cues interleaved across patterns).
   *
   * That entire bank is now replaced by `classifyNumberRoles`
   * (`_number-role-classifier.ts`):
   *
   *   - One token-finder for salary numbers (LPA / USD / range upper).
   *   - Three small cue tables (current / target / competing) — adding
   *     a phrasing means appending one row to the matching table.
   *   - One scoring function that picks the role per number span.
   *   - Sentence-level defaults when no cue fires (Gricean cooperation
   *     when AI just asked for CTC; phase-aware bare number when in
   *     probe-expectations).
   *
   * The 200 lines this block used to occupy now live in a 350-line
   * module with explicit precedence, a single decision point, and a
   * table-driven test surface. */
  const roles = classifyNumberRoles(a, { lastAiText, phase });
  const currentCtc = roles.currentCtc;
  const competing = roles.competing;
  const target = roles.target;
  const targetAsRange = roles.targetAsRange;
  const targetComponent = roles.targetComponent;

  /* Competing-without-number: candidate has signaled competing exists
     but refuses or omits to share magnitude.
     F8 (PDF#20 2026-05-15) — expanded pattern set.  Added:
       "another opportunity", "another offer", "evaluating other roles/
       companies/options", "in process with", "in talks with",
       "interviewing with/at/elsewhere", "offer on the table",
       "multiple offers". */
  const competingMentionPat = /\b(competing\s+offer|another\s+offer|another\s+opportunity|other\s+offers?|offer\s+in\s+hand|offer\s+on\s+the\s+table|other\s+companies|other\s+roles?|other\s+options?|other\s+conversations|elsewhere|in\s+the\s+market|evaluating\s+other|in\s+process\s+with|in\s+talks\s+with|interviewing\s+with|interviewing\s+at|interviewing\s+elsewhere|multiple\s+offers?)\b/i;
  const hedgePat = /\b(can.?t\s+share|prefer\s+not|nda|confidential|not\s+at\s+liberty|won.?t\s+disclose|details\s+(?:are\s+)?confidential)\b/i;
  const signalsCompetingExistsWithoutNumber =
    competing == null && competingMentionPat.test(a) && (hedgePat.test(a) || !/[\d]/.test(a));

  const vossTactics = detectVossTactics(a, lastAiText);
  const infoAsked = detectInfoIntents(a);
  /* PDF#29 Bug 1 (2026-05-18) — pass total CTC so a single-sided
   * absolute-rupee split ("₹12 LPA fixed" with known currentCtc=18)
   * can derive the complement. Prefer the freshly-parsed currentCtc
   * from THIS turn (if any) over the stale state field so a turn that
   * names both total + split satisfies fixedVariableSplitHasBoth in
   * one shot. */
  /* PDF#29 Bug 1 (2026-05-18) — total source preference. The prior state
   * total wins over a same-turn freshly-parsed currentCtc, because the
   * fresh parse can mis-bind a single component value (e.g. the "12" in
   * "₹12 LPA fixed" is the FIXED component, not the total) and that
   * would force the complement gate to compute complement=0. The stale
   * state value (set in an earlier discovery turn) is the trustworthy
   * total here. Falls back to fresh currentCtc only when no prior is
   * recorded. */
  const totalForSplitComplement =
    (priorTotalCtc != null && priorTotalCtc > 0 ? priorTotalCtc : null) ??
    (typeof currentCtc === "number" && currentCtc > 0 ? currentCtc : null);
  /* Audit Fix (2026-05-19) — Mask target-context clauses before
   * feeding the disclosed-breakdown parser. Target utterances
   * ("my target is ₹26 LPA fixed at minimum") describe what the
   * candidate WANTS, not what they're CURRENTLY paid; without this
   * mask the breakdown parser would update candidateComponentBreakdown
   * .base = 26 even though the candidate's actual current fixed is
   * unchanged (e.g. 18 from an earlier disclosure). The masker
   * replaces target clauses with whitespace of the same length so all
   * regex offsets remain stable and only DISCLOSURE-context language
   * reaches extractComponentBreakdown. */
  const breakdownInput = maskTargetClauses(a);
  const componentBreakdown = extractComponentBreakdown(breakdownInput, totalForSplitComplement);
  /* Phases 11/13/14/15/16 parsers — each returns a structured record
   * with `hasAny` (or null for the rationale singleton). They run
   * over the SAME normalized text so a single utterance "I'm in
   * Bangalore, 90-day notice, market is 32 LPA for my YOE" populates
   * location + notice + rationale in one pass. */
  const hikeRationale = extractHikeRationale(a, target, currentCtc);
  const noticeJoining = extractNoticeJoining(a);
  const equityVesting = extractEquityVesting(a);
  const locationMode = extractLocationMode(a);
  const competingOfferDetail = extractCompetingOfferDetail(a);
  const decisionDeadline = extractDecisionDeadline(a);
  const candidateProfile = extractCandidateProfile(a);
  const miscSignals = extractMiscSignals(a);
  const candidateStance = extractCandidateStance(a, turnIndex);
  const retentionCounter = extractRetentionCounter(a);

  /* Phase 17A — when a conditional acceptance fires, the legacy
   * `signalsAcceptance` boolean must be downgraded. A conditional
   * commit is not an unconditional accept; the AI should respond to
   * the CONDITION, not close the deal. The classifier already requires
   * an "if X" clause to fire conditional, so this is structural:
   * conditional ⇒ NOT accepted. */
  const signalsAcceptanceFinal =
    signalsAcceptance && !decisionDeadline.conditionalAcceptance;

  /* Input-sanity clamps — out-of-bound numeric values become null at
   * the parse boundary so they never leak into hike-% math, band
   * comparisons, or telemetry. See clampInr / clampNoticeDays /
   * clampGapMonths above for the policy. */
  const sanitizedNoticeJoining = {
    ...noticeJoining,
    noticePeriodDays: clampNoticeDays(noticeJoining.noticePeriodDays),
    joiningBonusAsk: clampInr(noticeJoining.joiningBonusAsk),
  };
  const sanitizedCandidateProfile = {
    ...candidateProfile,
    careerGapMonths: clampGapMonths(candidateProfile.careerGapMonths),
  };

  return {
    target: clampInr(target),
    currentCtc: clampInr(currentCtc),
    competing: clampInr(competing),
    signalsAcceptance: signalsAcceptanceFinal, signalsWalkAway,
    targetAsRange, targetComponent, vossTactics, infoAsked,
    signalsCompetingExistsWithoutNumber,
    componentBreakdown,
    rationale: hikeRationale.rationale,
    noticeJoining: sanitizedNoticeJoining,
    equityVesting,
    locationMode,
    competingOfferDetail,
    decisionDeadline,
    candidateProfile: sanitizedCandidateProfile,
    miscSignals,
    candidateStance,
    retentionCounter,
  };
}

/* 2026-05-29 mood-shift-pass — recruiter mood transition helper.
 *
 * Real recruiters' mood SHIFTS during a call:
 *   - Cool: visibly colder when the candidate pushes hard. Triggers:
 *       1. 3+ consecutive over-band asks (candidate keeps asking
 *          beyond maxStretch), OR
 *       2. explicit pushback at counter-offer phase (user rejects
 *          the recruiter's latest move at counter-offer), OR
 *       3. detected user-confrontation phrases ("that's ridiculous",
 *          "you're lowballing", "you're joking", "this is a joke")
 *   - Rewarm: re-warm when the candidate concedes after being cooled.
 *       1. Drop in their ask by ≥10%, OR
 *       2. explicit acceptance phrases ("ok that works", "fair enough",
 *          "that's fair", "deal", "sounds reasonable")
 *
 * Cool persists for up to MOOD_COOLED_TTL turns or until a rewarm
 * trigger fires; after TTL expires it auto-resets to baseline (the
 * recruiter eventually settles back, not into rewarm — rewarm is a
 * positive response to candidate concession, not a passive decay).
 *
 * The function mutates `n` in place (consistent with the
 * applyCandidateAnswer pattern of folding facts onto `next`). */
const MOOD_COOLED_TTL = 4;
const CONFRONTATION_RE =
  /\b(?:that'?s\s+ridiculous|you'?re\s+lowballing|low[\s-]?balling|you'?re\s+joking|this\s+is\s+(?:a\s+)?joke|that'?s\s+(?:a\s+)?joke|insulting|disrespectful|waste\s+of\s+(?:my\s+)?time|are\s+you\s+serious)\b/i;
const ACCEPTANCE_SOFT_RE =
  /\b(?:ok(?:ay)?\s+(?:that\s+)?works|fair\s+enough|that'?s\s+fair|sounds\s+reasonable|sounds\s+fair|that\s+works\s+for\s+me|deal|i\s+can\s+(?:work\s+with|live\s+with)\s+that)\b/i;

const COUNTER_PUSHBACK_RE =
  /\b(?:not\s+enough|too\s+low|need\s+more|come\s+up|won'?t\s+work|can'?t\s+accept|push\s+(?:the\s+)?(?:band|range|number|offer)|stretch\s+(?:more|further)|i'?ll\s+pass)\b/i;

/* FNV-1a 32-bit — local copy to avoid importing _session-jitter or
 * _recruiter-prose-realism (kernel module is the dependency root). */
function fnv1a32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* Affinity-dynamic feature (2026-05-29) — pattern-match candidate
 * utterance for rapport / respect / abrasion / transparency / value-
 * prop / evasion / stalling signals. Updates state.recruiterAffinity
 * (clamped to [-3, +3]) and appends to state.affinityLedger.
 *
 * Per-turn delta cap: ±2. Cumulative cap: [-3, +3].
 *
 * Pure / deterministic; no I/O. Called from finalize() in
 * applyCandidateAnswer AFTER applyMoodShift so the mood-shift can read
 * the prior affinity (we order detection AFTER mood-shift so the next
 * planner call sees the freshly-updated affinity, but the CURRENT
 * mood-shift reads pre.recruiterAffinity — see applyMoodShift). */
const AFFINITY_PER_TURN_CAP = 2;
const AFFINITY_MIN = -3;
const AFFINITY_MAX = 3;

const TRANSPARENCY_RE =
  /\b(?:to be honest|honestly|let me be (?:upfront|honest|straight)|upfront|frankly|to be (?:upfront|frank|candid)|i'?ll be honest|i'?ll be upfront|i'?ll level with you)\b/i;
const VALUE_PROP_NUM_RE =
  /\b(?:led|drove|delivered|grew|scaled|took|increased|reduced|cut|saved|generated|owned)\b[^.!?]{0,80}(?:\d+|\$\d|₹\d|\bcrore\b|\blakh\b|\bmillion\b|\bbillion\b|%)/i;
const ABRASIVE_RE =
  /\b(?:you don'?t get it|that'?s ridiculous|lowballing|lowball|you'?re wasting|stop wasting|insulting|joke|are you serious|ridiculous offer|cheap|stingy|shut up|nonsense|garbage|bullshit|bs\b)\b/i;
/* "Evasion" — uses a 3-turn-running heuristic. We approximate by counting
 * "i don't want to share / not comfortable / let's skip / pass on that"
 * style cues. */
const EVASION_RE =
  /\b(?:i (?:don'?t|do not) want to (?:share|disclose|say)|not (?:comfortable|sure i want)|let'?s skip|pass on that|rather not say|prefer not to|that'?s personal|move on|next question)\b/i;

function detectAffinitySignals(
  answer: string,
  pre: NegotiationState,
): { deltas: Array<{ delta: number; reason: AffinityReason }>; totalCap: number } {
  const out: Array<{ delta: number; reason: AffinityReason }> = [];
  const a = answer || "";
  if (!a.trim()) return { deltas: out, totalCap: AFFINITY_PER_TURN_CAP };

  /* Respect-marker — name use + thanks/appreciate. We split the test so
   * the gratitude keyword matches case-insensitively but the proper-noun
   * (candidate addressing recruiter by name) is recognised as a capital-
   * starting word in the original casing. */
  const thanksHit = /\b(?:thanks?|thank you|appreciate|appreciated|cheers)\b/i.test(a);
  const nameHit = /\b[A-Z][a-z]{2,}\b/.test(a);
  if (thanksHit && nameHit) {
    out.push({ delta: 1, reason: "respect-marker" });
  }

  /* Rapport-signal — mirror phrasing. Light heuristic: the candidate
   * echoes a recruiter-introduced noun phrase from the prior AI turn.
   * Look at pre.lastAiText for shared 2-3-word phrases. */
  const lastAi = (pre.lastAiText || "").toLowerCase();
  if (lastAi.length > 0) {
    const candidateLower = a.toLowerCase();
    /* Pull candidate ≥6-char noun-ish tokens from lastAi (fitment, joining
     * bonus, comp committee, variable, hike, band, etc.) */
    const MIRROR_VOCAB =
      /(fitment|joining bonus|comp committee|comp-committee|variable|stretch|band|esop|grade|hike|equity|cliff|notice period|in[- ]hand|loop|grade fitment)/g;
    let matched = false;
    let m: RegExpExecArray | null;
    while ((m = MIRROR_VOCAB.exec(lastAi)) !== null) {
      if (candidateLower.includes(m[1])) {
        matched = true;
        break;
      }
    }
    if (matched) {
      out.push({ delta: 1, reason: "rapport-signal" });
    }
  }

  /* Transparency cues. */
  if (TRANSPARENCY_RE.test(a)) {
    out.push({ delta: 1, reason: "transparency" });
  }

  /* Value-prop signal — impact + numbers. */
  if (VALUE_PROP_NUM_RE.test(a)) {
    out.push({ delta: 1, reason: "value-prop-signal" });
  }

  /* Abrasive — bigger negative weight. */
  if (ABRASIVE_RE.test(a)) {
    out.push({ delta: -2, reason: "abrasive-tone" });
  }

  /* Evasion — single-turn heuristic. */
  if (EVASION_RE.test(a)) {
    out.push({ delta: -1, reason: "evasion" });
  }

  /* Wasted-time — repeats prior turn's content nearly verbatim. */
  const log = pre.conversationLog ?? [];
  let lastUser: string | null = null;
  for (let i = log.length - 1; i >= 0; i--) {
    const e = log[i];
    if (e?.speaker === "candidate" && typeof e.text === "string" && e.text.trim()) {
      lastUser = e.text.trim().toLowerCase();
      break;
    }
  }
  if (lastUser) {
    const curr = a.trim().toLowerCase();
    if (curr.length >= 10) {
      const overlap = lastUser === curr ||
        (curr.length >= 0.7 * lastUser.length &&
          (lastUser.includes(curr.slice(0, Math.max(15, Math.floor(curr.length * 0.6))))));
      if (overlap) {
        out.push({ delta: -1, reason: "wasted-time" });
      }
    }
  }

  return { deltas: out, totalCap: AFFINITY_PER_TURN_CAP };
}

function applyAffinitySignals(
  n: NegotiationState,
  pre: NegotiationState,
  answer: string,
): void {
  const turn = n.turnIndex;
  const { deltas } = detectAffinitySignals(answer, pre);
  if (deltas.length === 0) return;

  /* Cap the per-turn aggregate delta. Apply caps separately to positive
   * and negative sums so a single abrasive (-2) plus a respect (+1) lands
   * at -1, not capped. We want: net = clamp(sum, -2, +2). */
  let posSum = 0;
  let negSum = 0;
  for (const d of deltas) {
    if (d.delta > 0) posSum += d.delta;
    else if (d.delta < 0) negSum += d.delta;
  }
  if (posSum > AFFINITY_PER_TURN_CAP) posSum = AFFINITY_PER_TURN_CAP;
  if (negSum < -AFFINITY_PER_TURN_CAP) negSum = -AFFINITY_PER_TURN_CAP;
  const net = posSum + negSum;
  if (net === 0) return;

  const prevAffinity = pre.recruiterAffinity ?? 0;
  let nextAffinity = prevAffinity + net;
  if (nextAffinity > AFFINITY_MAX) nextAffinity = AFFINITY_MAX;
  if (nextAffinity < AFFINITY_MIN) nextAffinity = AFFINITY_MIN;
  n.recruiterAffinity = nextAffinity;

  /* Append to ledger — record each detected reason (use net delta on the
   * first dominant reason to keep ledger compact). Append all individual
   * detections so analyzers can see what fired. */
  const ledger = [...(pre.affinityLedger ?? [])];
  /* Compose effective applied delta proportional to net direction; emit
   * one entry per detected reason. We DON'T re-clamp inside the entries —
   * the cumulative state tracks the truth; the ledger is per-detection. */
  for (const d of deltas) {
    ledger.push({ turn, delta: d.delta, reason: d.reason });
  }
  n.affinityLedger = ledger;
}

function applyMoodShift(
  n: NegotiationState,
  pre: NegotiationState,
  parsed: { target?: number | null },
  answer: string,
): void {
  const ans = (answer || "").toLowerCase();
  const turn = n.turnIndex;
  const band = n.band;
  const prevDynamic: RecruiterMoodDynamic = pre.recruiterMoodDynamic ?? "baseline";

  /* Track peak candidate ask across the session — used by concession
   * detection. Capture BEFORE we evaluate concession so a fresh higher
   * ask updates the peak first; concession compares the CURRENT ask
   * against the PRIOR peak. */
  const priorPeak = pre.recruiterMoodPeakCandidateAskLpa ?? null;
  const currentTarget = (parsed as { target?: number | null }).target ?? null;

  /* ---------- 1. Over-band streak counter ---------- */
  let overBandStreak = pre.consecutiveOverBandAsks ?? 0;
  if (currentTarget != null && band && typeof band.maxStretch === "number") {
    if (currentTarget > band.maxStretch + 0.01) {
      overBandStreak += 1;
    } else {
      /* Within-band ask resets the streak. */
      overBandStreak = 0;
    }
  }
  n.consecutiveOverBandAsks = overBandStreak;

  /* ---------- 2. Detect cool / rewarm trigger signals ---------- */
  const confrontation = CONFRONTATION_RE.test(ans);
  const softAccept = ACCEPTANCE_SOFT_RE.test(ans);
  const rejectedAtCounter =
    pre.phase === "counter-offer" && COUNTER_PUSHBACK_RE.test(ans);
  const overBandPush = overBandStreak >= 3;

  /* Concession: candidate's new target is ≥10% below their prior peak. */
  let concession = false;
  if (currentTarget != null && priorPeak != null && priorPeak > 0) {
    concession = currentTarget <= priorPeak * 0.9;
  }

  /* Update peak AFTER concession check so the next turn compares
   * against the updated peak. */
  let newPeak = priorPeak;
  if (currentTarget != null) {
    newPeak = priorPeak == null ? currentTarget : Math.max(priorPeak, currentTarget);
  }
  n.recruiterMoodPeakCandidateAskLpa = newPeak;

  /* ---------- 3. Transition decisions ---------- */
  let nextDynamic: RecruiterMoodDynamic = prevDynamic;
  let enteredAt = pre.recruiterMoodDynamicEnteredAtTurn ?? null;

  /* Rewarm wins over cool when both fire on the same turn — a
   * concession after being cooled IS the recovery signal even if the
   * same utterance happens to be over-band. Rewarm is gated on the
   * recruiter having BEEN cooled this session. */
  const wasCooled = prevDynamic === "cooled";
  const canRewarm = wasCooled && (concession || softAccept);
  let canCool =
    !canRewarm &&
    (confrontation || overBandPush || rejectedAtCounter);

  /* Affinity-dynamic feature (2026-05-29) — affinity ≥ +2 halves the
   * probability of cooling; affinity ≤ -2 boosts it by ~50%. Deterministic
   * FNV gate keyed on (sessionId, turnIndex). When canCool is already
   * false we don't suppress to true (negative affinity doesn't manufacture
   * confrontation that wasn't there); we only modulate the existing
   * candidate-side trigger. */
  const affinity = pre.recruiterAffinity ?? 0;
  if (canCool && pre.sessionId) {
    const hashSeed = `affinity-cool|${pre.sessionId}|${turn}`;
    const u = fnv1a32(hashSeed) / 0x100000000;
    if (affinity >= 2) {
      /* 50% suppression of the cool trigger. */
      if (u < 0.5) canCool = false;
    } else if (affinity <= -2) {
      /* Already-cooling: leave as is (no further amplification needed).
       * Boost mode is also fold into rewarm gating below: shorter rewarm
       * window. Nothing additional here. */
    }
  }

  /* 2026-05-30 time-context cool-bumper — Friday-rush and after-hours-
   * tired recruiters get terser more readily. When canCool is already
   * triggered, leave alone (already cooling). When canCool is false but
   * we're in a time-context that drains energy/time AND there's some
   * negative signal this turn (overBandStreak ≥ 2 OR confrontation OR
   * rejectedAtCounter), flip canCool with ~30% probability. Deterministic
   * FNV gate keyed on (sessionId, turnIndex, time-context). */
  const tCtx = pre.timeContext ?? "midweek-standard";
  if (
    !canCool &&
    pre.sessionId &&
    (tCtx === "friday-rush" || tCtx === "after-hours-tired") &&
    (overBandStreak >= 2 || confrontation || rejectedAtCounter)
  ) {
    const hashSeed = `time-cool-bump|${pre.sessionId}|${turn}|${tCtx}`;
    const u = fnv1a32(hashSeed) / 0x100000000;
    if (u < 0.3) canCool = true;
  }

  if (!canCool && affinity <= -2 && pre.sessionId &&
             (overBandStreak >= 2 || ans.length > 0)) {
    /* Negative affinity: when over-band streak hits 2 (one shy of the
     * baseline 3-streak trigger), a deterministic ~50% gate trips cool
     * early. This implements the "+50% probability" half of the spec
     * symmetrically with the positive-affinity suppression. */
    if (overBandStreak >= 2) {
      const hashSeed = `affinity-cool-boost|${pre.sessionId}|${turn}`;
      const u = fnv1a32(hashSeed) / 0x100000000;
      if (u < 0.5) canCool = true;
    }
  }

  if (canRewarm) {
    nextDynamic = "rewarmed";
    enteredAt = turn;
  } else if (canCool) {
    /* Re-cool resets the entered-at timestamp so the TTL window
     * restarts. */
    nextDynamic = "cooled";
    enteredAt = turn;
  } else if (prevDynamic === "cooled" && enteredAt != null && (turn - enteredAt) > MOOD_COOLED_TTL) {
    /* TTL expiry → settle back to baseline (NOT rewarmed, since the
     * candidate never gave us a positive signal). */
    nextDynamic = "baseline";
    enteredAt = null;
  }

  n.recruiterMoodDynamic = nextDynamic;
  n.recruiterMoodDynamicEnteredAtTurn = enteredAt;
}


/* ─── State transition: fold candidate's answer into state ───────── */

/** Apply a candidate turn to state. Returns a new state — never
 *  mutates the input. Terminal phases are sticky: if state.phase is
 *  already terminal, returns state unchanged. */
export function applyCandidateAnswer(state: NegotiationState, rawAnswerInput: string): NegotiationState {
  /* Audit Pass 2 Fix D (2026-05-16) — normalize curly/smart quotes at
   * the input boundary BEFORE anything else reads `answer`. Every
   * downstream regex bank assumes ASCII `'`/`"`. Single point of fix
   * for iOS / macOS / smart-typography paste paths. */
  const answer = normalizeQuotes(rawAnswerInput ?? "");
  /* Negotiation-flow redesign commit 1 (2026-05-15): capture pre-state
   * snapshot for TurnDelta computation. The single pre/post diff is
   * recomputed at every return point via finalize() below to keep
   * the 8+ return branches consistent. */
  const pre = state;
  /* Walk-away-and-return: if state is terminal `walked-away` but the
     candidate sends a non-empty engagement, re-open the conversation
     with a penalty flag. This is the only path out of a terminal phase
     and it's a one-way trapdoor (the flag is sticky). */
  if (state.phase === "walked-away" && (answer || "").trim().length > 0 &&
      !isWalkAway(answer)) {
    /* 2026-05-29 audit pass — walkAwayReturned is documented as a
     * one-way trapdoor (sticky once true). If the kernel ever re-enters
     * this reopen branch with the flag ALREADY true, something
     * upstream reset the flag illegally — surface it as a hard error
     * rather than silently re-flipping. The flag drives split-half
     * stiffening in the planner and event emission in kernel-audit;
     * a silent reset breaks both. */
    if (state.walkAwayReturned === true) {
      throw new Error(
        "kernel-invariant: walkAwayReturned reset to false between turns " +
        `(session=${state.sessionId} turn=${state.turnIndex})`,
      );
    }
    const reopened: NegotiationState = {
      ...state,
      leversUsed: [...state.leversUsed],
      vossTacticsUsed: [...state.vossTacticsUsed],
      infoAsked: [...state.infoAsked],
      phase: "counter-offer",
      walkAwayReturned: true,
      walkedAwayAtTurn: null,
      /* Audit Pass 3 / Fix 1 (2026-05-16) — clear stalemate ledger
       * symmetrically with walkedAwayAtTurn when the session reopens. */
      stalemateAtTurn: null,
    };
    return applyCandidateAnswer(reopened, answer);
  }
  if (isTerminalPhase(state.phase)) return state;

  /* `offerOnTable` lets the acceptance classifier veto commitment
     idioms ("sounds good") that arrive before any number has been
     quoted — structural phase gate (Phase 9). */
  const offerOnTable = (state.highestOfferMade ?? 0) > 0;
  const parsed = parseCandidateAnswer(answer, state.lastAiText, state.phase, offerOnTable, state.turnIndex, state.candidateCurrentCtc ?? null);
  /* PDF#27 Fix 2 (2026-05-17) — repetition-complaint detection. The
   * candidate flags that the bot is repeating itself ("stop repeating",
   * "I already answered that", "asked this before"). Stamp the turn so
   * the planner force-advances past the topic next turn. */
  const REPETITION_COMPLAINT_RE =
    /\b(?:repeat(?:ing)?|same\s+question|already\s+(?:answered|asked|told|said)|asked\s+(?:this|that)\s+(?:before|already)|stop\s+repeating|why\s+(?:are\s+you|do\s+you)\s+keep\s+asking)\b/i;
  const repetitionComplaintAtTurn = REPETITION_COMPLAINT_RE.test(answer)
    ? state.turnIndex
    : (state.repetitionComplaintAtTurn ?? null);
  /* PDF#29 Bug 7 (2026-05-18) — frustration signal. Distinct from the
   * repetition-complaint stamp (which lives forever for analyzer
   * audit): this is a one-turn fold the planner consumes to fire the
   * acknowledge-and-recover lever. Cleared in applyAiMove. */
  const lastUserFrustrated = USER_FRUSTRATION_RE.test(answer);
  /* PDF#27 Fix 5 (2026-05-17) — offer-ask detection. Candidate asks
   * what the company is offering; the band-disclosure lever reads this
   * to fire on the very next planner call. */
  /* PDF#42 BUG-D (2026-05-21) — widen to include "final offer", "last
   * offer", "best (and) final". Candidate's "what is your final offer?"
   * after multiple deflections must route to a closing-push restate,
   * NOT fall through the question-intent classifier into a generic
   * budget-deflection (which masked the ask and trickled into an
   * abrupt-termination chain). The kernel stamp `offerAskedAtTurn`
   * lets the planner pick the closing-push lever on the very next call. */
  /* PDF#44 (2026-05-26) — STRUCTURAL widening. Prior regex enumerated
   * fixture-specific spellings ("what's the offer", "share the offer")
   * and missed real fixtures like "what is your offer?" (Flipkart
   * Sr-PD T3) — the determiner "the" vs possessor "your" should not
   * make the difference. Rewrote as three structural shapes:
   *
   *   (A) ASK-VERB + (possessor) + OFFER-NOUN
   *       Verbs: what(?:'s| is| are), tell me, share, give me, can
   *       you (share|tell|give), provide.
   *       Possessor (optional): the / your / this / a.
   *       Offer-nouns: offer, fitment, number(s), package, range,
   *       on offer, offer range.
   *
   *   (B) Adjective-qualified offer ask (final / last / best) —
   *       preserved from PDF#42.
   *
   *   (C) Bare "best and final" — preserved.
   *
   * Generalises across "what's the offer?", "what is your offer?",
   * "tell me the offer", "share your number", "what's the package"
   * without enumerating each fixture. */
  const OFFER_ASK_RE = new RegExp(
    [
      // (A) ASK-VERB + optional possessor + offer-noun
      String.raw`\b(?:what(?:'?s|\s+is|\s+are)|tell\s+me|share|give\s+me|can\s+you\s+(?:share|tell\s+me|give\s+me|provide)|provide)\s+(?:the\s+|your\s+|this\s+|a\s+|me\s+)*(?:initial\s+|standing\s+)?(?:offer|fitment|number|numbers|package|range|on\s+offer|offer\s+range)\b`,
      // (B) adjective-qualified (final / last / best (and final))
      String.raw`(?:what(?:'?s|\s+is)\s+your\s+)?\b(?:final|last|best(?:\s+and\s+final)?)\s+(?:offer|number|fitment)\b`,
      // (C) bare "best and final"
      String.raw`\bbest\s+and\s+final\b`,
      // (D) "what are you offering"
      String.raw`\bwhat\s+are\s+you\s+offering\b`,
    ].join("|"),
    "i",
  );
  const offerAskedAtTurn = OFFER_ASK_RE.test(answer)
    ? state.turnIndex
    : (state.offerAskedAtTurn ?? null);
  /* FL5 / Audit Pass 4 (PDF#27, 2026-05-17) — uncertainty detection.
   * When the candidate hedges on the value ("not sure", "around 30",
   * "I think", "approximately", "don't remember"), the planner should
   * offer a range / escape hatch on the NEXT turn instead of
   * grinding on an exact number. Stamp the turn index; the planner
   * consults state.lastAnswerUncertainAt to route off-script. */
  const UNCERTAINTY_RE =
    /\b(?:not\s+sure|don'?t\s+remember|don'?t\s+know|approximat(?:e|ely)?|around|roughly|i\s+think|maybe|forget|forgot)\b/i;
  const lastAnswerUncertainAt = UNCERTAINTY_RE.test(answer)
    ? state.turnIndex
    : (state.lastAnswerUncertainAt ?? null);
  /* PDF#32 BUG H (2026-05-18) — unparseable / noise candidate input.
   *
   * Prita replay T19: candidate's STT layer surfaced the literal string
   * "audible" (a stage-direction artifact, not actual speech) as the
   * answer to the bot's "what's the base split?" probe. Downstream the
   * bot:
   *   1. Marked "base" satisfied on the askedTopics ledger anyway
   *      (the push happens at applyAiMove time, BEFORE the candidate
   *      answers — so an unparseable answer left "base" looking
   *      satisfied).
   *   2. Planner advanced past base, fired the esop component-probe.
   *   3. LLM-restyle drifted the question into a fabricated-disclosure
   *      statement ("ESOPs do kick in, but vesting cliff…"). [BUG G]
   *   4. Session terminated abruptly.
   *
   * Architectural fix: detect the small, well-bounded set of "this is
   * not a real answer" signals at the kernel input boundary, and REWIND
   * the askedTopics tail so the prior probe re-fires on the next turn.
   * The bot then re-asks instead of advancing past a topic the
   * candidate never actually addressed.
   *
   * Conservative-by-design: matches only literal stage-direction
   * artifacts and bracket-wrapped transcription tags. Real terse
   * answers ("yes", "no", "k", "fine") are NOT noise and must pass
   * through — those are legitimate signal the parser handles. */
  const NOISE_ANSWER_RE =
    /^[\s"'""''.,!?\-—–]*(?:\[(?:noise|unclear|silence|inaudible|crosstalk|unintelligible)\]|<(?:silence|noise|unclear|inaudible)>|(?:in)?audible|unintelligible|crosstalk|silence|\.{2,}|—+|-{2,})[\s"'""''.,!?\-—–]*$/i;
  /* PDF#35 Move 6 (2026-05-18) — single-word affirmative on a substantive
   * yes/no probe should be treated as noise (not as a discovery signal).
   *
   * Symptom: bot asks "Do you have variable in your current package?" —
   * a yes/no probe whose useful follow-up needs a NUMBER. Candidate
   * answers "Yes." The parser treated this as substantive, advanced
   * past the variable slot, and the bot never got the actual split.
   *
   * Fix: when the most recent bot turn was a substantive probe (asks
   * about a specific component, contains "?" but DOES NOT itself
   * contain a digit and is NOT framed as "what's the X / how much /
   * what number"), AND the candidate's reply is a bare single-word
   * affirmative, stamp lastAnswerNoiseAtTurn so the askedTopics tail
   * gets rewound and the planner re-asks for the actual number.
   *
   * Conservative gate: only fires on bare single-word affirmatives —
   * "yes, I do have variable" or "yes, 3 LPA" pass through normally
   * (the parser binds the number; the affirmative is decoration). */
  const SINGLE_WORD_AFFIRMATIVE_RE = /^\s*(?:yes|yeah|yep|yup|sure|ok|okay)\.?\s*$/i;
  const lastBotProbeIsYesNoSubstantive = (() => {
    const t = (state.lastAiText || "").trim();
    if (t.length === 0) return false;
    if (!/\?/.test(t)) return false;
    if (/\d/.test(t)) return false; /* a probe quoting numbers wants confirmation, not a number back */
    /* Substantive yes/no probes about a component / current package. */
    return /\b(?:do\s+you\s+have|is\s+there|any\s+(?:variable|equity|esop|rsu|bonus|stock|grants?)|got\s+(?:variable|equity|esops?|rsus?|bonus|stock)|in\s+your\s+(?:current\s+)?package)\b/i.test(t);
  })();
  /* PDF#41 BUG-A (2026-05-21) — number-seeking probe + bare "yes" = noise.
   * Prior gate (lastBotProbeIsYesNoSubstantive) EXCLUDED number-seeking
   * probes ("what's your current CTC?"), letting a bare "yes" reply
   * fall through as a substantive answer — the parser bound no facts,
   * the planner re-emitted the same probe, isVerbatimRepeat fired the
   * generic recovery stub, and the candidate perceived the UI as frozen
   * (PDF#41: "screen is stuck no way to speak"). A bare "yes" to ANY
   * number-seeking probe is noise too — it answers nothing. */
  const lastBotProbeIsNumberSeeking = (() => {
    const t = (state.lastAiText || "").trim();
    if (t.length === 0 || !/\?/.test(t)) return false;
    if (/\d/.test(t)) return false;
    return /\b(?:what(?:'s)?|how\s+much|how\s+many|what\s+number|what\s+figure|share\s+the|range|fitment)\b/i.test(t);
  })();
  const lastAnswerWasSingleWordYesOnProbe =
    (lastBotProbeIsYesNoSubstantive || lastBotProbeIsNumberSeeking) &&
    SINGLE_WORD_AFFIRMATIVE_RE.test(answer);
  /* PDF#35 Move 3 (2026-05-18) — flat-ack on a substantive bot probe
   * is noise. If the prior bot turn ended in "?" (a real probe) and
   * the candidate replies with a bare acknowledgement ("got it",
   * "noted", "makes sense"), the slot did not advance — stamp noise
   * so the planner re-asks instead of advancing past the probe. */
  const lastBotEndedInQuestion = /\?\s*$/.test((state.lastAiText ?? "").trim());
  const lastAnswerWasFlatAckOnProbe =
    lastBotEndedInQuestion && isFlatAck(answer);
  const lastAnswerWasNoise =
    answer.trim().length === 0 ||
    NOISE_ANSWER_RE.test(answer) ||
    lastAnswerWasSingleWordYesOnProbe ||
    lastAnswerWasFlatAckOnProbe;
  const lastAnswerNoiseAtTurn = lastAnswerWasNoise
    ? state.turnIndex
    : (state.lastAnswerNoiseAtTurn ?? null);

  /* PDF#34 Fix 3 (2026-05-18) — clarification-request detector.
   *
   * PDF#34 Meesho/Prita T6: bot asked "what's the vesting schedule?"
   * → candidate said "what is that?" — a comprehension question about
   * the term `vesting`. Pre-fix, the off-topic detector flagged the
   * utterance (14 chars, no on-topic lexicon, no digit, turn ≥ 2) and
   * the LLM freelanced "I'm not sure what you're referring to. This
   * conversation is about Senior Product Designer at Meesho." — a
   * persona break that misread a clarification as a topic-drift.
   *
   * Real recruiters answer the clarification ("vesting is the
   * schedule on which equity grants become yours") before re-asking.
   * The detector below is conservative: short utterance (≤ 40 chars)
   * AND matches a clarification shape ("what is X", "what does X
   * mean", "what's that", "huh", "I don't understand", "explain",
   * "?" alone). Stamps the turn so the planner can route to a
   * `clarify-prior-question` action instead of advancing discovery
   * or letting the LLM freelance a deflection.
   *
   * The detector does NOT fire when the utterance also carries a
   * number — that's typically a substantive answer (e.g. "what is
   * 22 LPA" probably came from a confused parse, not a clarification
   * request). */
  /* PDF#41 BUG-C (2026-05-21) — bare "why?" / "why not" / "how come"
   * added. Live Flipkart session: candidate said "why?" after the AI
   * refused a breakdown ask, and the AI emitted the verbatim refusal
   * a second time. Routing "why" to clarify-prior-question forces the
   * canonical-prose surface to re-explain inline rather than letting
   * the LLM re-emit the prior refusal sentence. */
  /* PDF#44 (2026-05-26) — STRUCTURAL clarification detector.
   *
   * Clarification asks have one of FOUR structural shapes — all
   * other "WH-word + noun" forms are substantive content asks
   * (e.g. "what's the offer?" — asks for the offer; "what does
   * the equity look like?" — asks about equity) and MUST NOT be
   * routed to clarify-prior-question:
   *
   *   (A) WH-word paired with a deictic pronoun (no topical noun):
   *       "what is that", "what does this mean", "what do you
   *       mean", "why is that", etc. The deictic refers BACK to
   *       the bot's prior turn — a definitional clarification ask.
   *   (B) Bare WH-word / interjection of confusion:
   *       "what?", "why?", "huh?", "pardon?", "sorry?", "?".
   *   (C) First-person confusion frame:
   *       "i don't understand", "i'm not sure what", "i'm
   *       confused", "i don't know what this/that is".
   *   (D) Explicit clarification verb:
   *       "can you clarify / specify / repeat / rephrase /
   *       elaborate / explain", "come again", "explain that".
   *
   * Covers every captured fixture (PDF#34 "what is that?",
   * PDF#41 "why?", PDF#44 "can you specify…?") without flagging
   * topic-bearing asks like "what's the offer?". */
  const CLARIFICATION_REQUEST_RE = new RegExp(
    [
      // (A) WH + deictic
      String.raw`^[\s"'""''.,!?-]*what(?:'?s|\s+is|\s+does|\s+are)?\s+(?:that|this|it|those|these|they)(?:\s+mean(?:s|ing)?)?\s*\??[\s.!]*$`,
      String.raw`^[\s"'""''.,!?-]*what\s+(?:do\s+you\s+mean|does\s+(?:that|this|it)\s+mean)\s*\??[\s.!]*$`,
      String.raw`^[\s"'""''.,!?-]*why(?:\s+not|\s+is\s+(?:that|this|it))?\s*\??[\s.!]*$`,
      String.raw`^[\s"'""''.,!?-]*how\s+come\s*\??[\s.!]*$`,
      // (B) bare WH / interjections
      String.raw`^[\s"'""''.,!?-]*(?:huh|pardon|sorry,?\s*what|meaning(?:\s+of\s+(?:that|this|it))?|\?)\s*\??[\s.!]*$`,
      // (C) first-person confusion
      String.raw`^[\s"'""''.,!?-]*i\s+(?:don'?t\s+(?:understand|know\s+what(?:'?s|\s+(?:that|this)))|am\s+(?:confused|not\s+sure\s+what)|'?m\s+(?:confused|not\s+sure\s+what))`,
      // (D) explicit clarification verb (allowed to carry a tail —
      //     "can you specify which number" is a clarifying ask)
      String.raw`\bcan\s+you\s+(?:clarify|specify|repeat|rephrase|elaborate|explain)\b`,
      String.raw`^[\s"'""''.,!?-]*(?:come\s+again|explain(?:\s+(?:that|this|it|please))?)\s*\??[\s.!]*$`,
    ].join("|"),
    "i",
  );
  const aTrim = answer.trim();
  const lastAnswerWasClarification =
    aTrim.length > 0 &&
    aTrim.length <= 40 &&
    !/\d/.test(aTrim) &&
    CLARIFICATION_REQUEST_RE.test(aTrim);
  const lastAnswerClarificationAtTurn = lastAnswerWasClarification
    ? state.turnIndex
    : (state.lastAnswerClarificationAtTurn ?? null);

  /* PDF#35 Move 1 (2026-05-18) — post-anchor offer-recap detector.
   *
   * Fires only when highestOfferMade > 0 — i.e. the anchor has already
   * landed and the candidate is asking to be REMINDED of the standing
   * offer. Pre-anchor offer asks ("what's the offer?") are handled by
   * OFFER_ASK_RE which routes to anchor-with-offer. */
  /* PDF#36 Fix A3 (2026-05-19) — broadened recap phrasings. Prior gate
   * only matched verb-template forms (what's/repeat/restate/summarize).
   * Candidate utterances like "I want to know CTC", "tell me the
   * numbers", "what are the numbers" and "share the offer" fell through
   * and got routed to band-disclosure-deflect instead of recap.
   *
   * Expanded verb branches: want-to-know / tell-me / what-are / give-
   * me / share. Expanded offer-word aliases: salary, total comp,
   * numbers, breakdown, split. */
  const OFFER_RECAP_RE =
    /\b(?:(?:what'?s|repeat|restate|remind\s+me(?:\s+of)?|summari[sz]e|summari[sz]e\s+the|what\s+was)\s+(?:the\s+)?(?:offer|ctc|fitment|number|numbers|package|total|total\s+comp(?:ensation)?|salary|breakdown|split)|want\s+to\s+know\s+(?:the\s+)?(?:offer|ctc|fitment|number|numbers|package|total|total\s+comp(?:ensation)?|salary|breakdown|split)|tell\s+me\s+(?:about\s+)?(?:the\s+)?(?:offer|ctc|fitment|number|numbers|package|total|total\s+comp(?:ensation)?|salary|breakdown|split)|what\s+(?:are|were)\s+(?:the\s+)?(?:offer|ctc|numbers|components|breakdown|split|package|total)|(?:share|give)\s+(?:me\s+)?(?:the\s+)?(?:offer|ctc|numbers|breakdown|split|package|total|fitment|salary)|offer\s+again|sorry,?\s+what\s+was|come\s+again\s+on\s+the\s+(?:offer|ctc|number|numbers)|where\s+(?:are|were)\s+we\s+(?:at|landing))\b/i;
  const lastAnswerOfferRecapAtTurn =
    state.highestOfferMade > 0 && OFFER_RECAP_RE.test(answer)
      ? state.turnIndex
      : (state.lastAnswerOfferRecapAtTurn ?? null);
  const nextConversationLog = appendConversation(state.conversationLog, "candidate", answer);
  /* 2026-05-29 realism-pass — recompute candidate register from the
   * fresh log (including the just-applied candidate utterance). Pure
   * call, idempotent, defaults to "neutral" when signal is thin. */
  const candidateRegister = classifyFromLog(nextConversationLog);
  const next: NegotiationState = {
    ...state,
    leversUsed: [...state.leversUsed],
    vossTacticsUsed: [...state.vossTacticsUsed],
    infoAsked: [...state.infoAsked],
    conversationLog: nextConversationLog,
    repetitionComplaintAtTurn,
    offerAskedAtTurn,
    lastAnswerUncertainAt,
    lastUserFrustrated,
    lastAnswerNoiseAtTurn,
    lastAnswerClarificationAtTurn,
    lastAnswerOfferRecapAtTurn,
    candidateRegister,
  };
  /* PDF#32 BUG H (2026-05-18) — askedTopics tail rewind.
   * When the prior AI turn pushed an askedTopics entry and the
   * candidate's reply to it was noise, pop that tail entry so the
   * planner re-fires the same probe instead of advancing. The pop is
   * scoped to the most-recent entry only — historical asked-topics are
   * preserved (they were answered, possibly imperfectly, but answered).
   *
   * Idempotent: if there's no tail entry or it was pushed at a turn
   * other than the last AI turn, leave the ledger alone. */
  if (lastAnswerWasNoise) {
    const prior = state.askedTopics ?? [];
    const tail = prior[prior.length - 1];
    if (tail != null && tail.atTurn === state.turnIndex) {
      next.askedTopics = prior.slice(0, -1);
    }
  }
  /* Commit 1 (2026-05-15): finalize() stamps state.lastTurnDelta from the
   * pre-state snapshot before every return. Keeps the 8+ return branches
   * (terminal-accept / soft-accept / walk-away / regular / phase-only)
   * symmetric. Pure — mutates the draft `n` in place. */
  const finalize = (n: NegotiationState): NegotiationState => {
    /* 2026-05-29 mood-shift-pass — recruiter mood shift transitions.
     * Runs BEFORE planNextAction so the planner-emitted prose this
     * turn already reflects any cool/rewarm shift. Pure; only mutates
     * the dynamic-mood ledger fields. */
    applyMoodShift(n, pre, parsed, answer);
    /* Affinity-dynamic feature (2026-05-29) — runs AFTER applyMoodShift
     * so this turn's mood-shift reads pre.recruiterAffinity (the prior
     * cumulative value). The planner call below reads the freshly
     * updated affinity via n.recruiterAffinity. */
    applyAffinitySignals(n, pre, answer);
    n.lastTurnDelta = computeTurnDelta(pre, n, parsed, answer);
    /* Perfect 3 (2026-05-16) — promote per-turn urgencySignal to sticky
     * state.cumulativeUrgency via the monotone upgrade rule. Done BEFORE
     * planNextAction so the planner's urgency-aware nudges read the
     * already-merged value, not the prior turn's. */
    n.cumulativeUrgency = mergeCumulativeUrgency(
      pre.cumulativeUrgency,
      n.lastTurnDelta.urgencySignal,
    );
    /* Phase 5 Session A (2026-05-19) — evaluate round-end trigger BEFORE
     * planNextAction so the planner sees the post-transition state (new
     * persona, opening phase, swapped band, fresh round). Default-OFF:
     * typed no-op when `multiRoundEnabled` is false. */
    const advanced = maybeAdvanceRound(n);
    if (advanced !== n) {
      /* In-place copy of advanced fields onto `n` so the rest of finalize
       * sees the post-transition state. */
      Object.assign(n, advanced);
    }
    /* Bad-faith tactic detection (2026-05-29). If the candidate's
     * latest utterance names a tactic the recruiter has already used
     * this session, push the tactic kind onto userCaughtTactics so the
     * report layer can credit a positive coaching signal. Inlined here
     * to avoid a kernel → planner cycle; mirrors detectUserCaughtTactic
     * in _next-action-planner.ts. */
    {
      const used = n.tacticsUsed ?? [];
      if (used.length > 0 && typeof answer === "string" && answer.length > 0) {
        const u = answer.toLowerCase();
        const caught = [...(n.userCaughtTactics ?? [])];
        const pushIfNew = (k: string) => {
          if (used.includes(k) && !caught.includes(k)) caught.push(k);
        };
        if (/\b(exploding|deadline|artificial|pressur(?:e|ing)|why\s+(?:the\s+)?rush|by\s+(?:eod|friday|tomorrow))\b/.test(u)) {
          pushIfNew("exploding-offer-pressure");
        }
        if (/\b(another\s+candidate|competing\s+candidate|other\s+candidate|that'?s\s+(?:a\s+)?(?:bluff|pressure))\b/.test(u)) {
          pushIfNew("fake-competing-candidate");
        }
        if (/\b(non[-\s]?binding|in\s+writing|written|vague|let'?s\s+put\s+(?:it|that)\s+in\s+(?:the\s+)?offer|specific|commit(?:ment)?|guarantee)\b/.test(u)) {
          pushIfNew("vague-promise");
        }
        n.userCaughtTactics = caught;
      }
    }
    /* Commit 3 (2026-05-15) — stamp planNextAction so the brief and the
     * move-picker read the SAME action without recomputing. The planner
     * registers itself via _planner-registry at module load (see commit
     * 4 — registerNextActionPlanner at the bottom of
     * _next-action-planner.ts) to avoid an import cycle. */
    n.plannedNextAction = _callNextActionPlanner(n);
    return n;
  };

  /* Bind newly-stated facts. Last-stated wins (the candidate may
     revise their target mid-conversation; that's allowed). Phase 25a
     also records the FIRST anchored target, frozen — used by the
     red-flag layer to detect upward drift. */
  if (parsed.target != null) {
    /* Audit Fix (2026-05-19) — Target-component routing. When the
     * classifier flags the target as fixed-scoped ("₹26 LPA fixed at
     * minimum"), it goes to candidateTargetFixed and does NOT touch
     * candidateTarget (which holds the total-package anchor). Only
     * total-scoped targets feed lastCandidateCounterLpa /
     * firstAnchoredTarget — those signals are about the overall ask. */
    if (parsed.targetComponent === "fixed") {
      next.candidateTargetFixed = parsed.target;
      /* PDF#40 BUG-2 (2026-05-21) — a base-only counter (e.g. "39.2L
       * as base salary") IS a counter signal — the candidate is naming
       * the single most negotiable component. Without this stamp the
       * planner's post-anchor counter-engagement override (gate at
       * _next-action-planner.ts L1427) never fires (it reads
       * lastCandidateCounterLpa), the planner falls through to a
       * generic info/benefits lever, and the candidate gets a
       * non-sequitur (live Flipkart session: AI replied with medical
       * floater info to a base-counter ask). Stamp fresh-counter on
       * material change, mirroring the total-scope branch below. */
      const priorFixed = state.candidateTargetFixed;
      if (priorFixed == null || Math.abs(priorFixed - parsed.target) > 0.05) {
        next.lastCandidateCounterLpa = parsed.target;
      }
    } else {
      /* Bug-report 12 (2026-05-14) — per-turn fresh-counter signal.
         Only count as a fresh counter when the parsed number is
         materially different from the prior sticky candidateTarget; a
         candidate re-asserting the same intake number doesn't unlock
         the auto-accept gate. */
      const prior = state.candidateTarget;
      if (prior == null || Math.abs(prior - parsed.target) > 0.05) {
        next.lastCandidateCounterLpa = parsed.target;
      }
      next.candidateTarget = parsed.target;
      if (next.firstAnchoredTarget == null) next.firstAnchoredTarget = parsed.target;
    }
    /* Sprint B.3 (2026-05-15) — in-hand framing disambiguation. If the
     * candidate's anchor utterance frames the number as in-hand /
     * take-home, flag it and back-compute a CTC-equivalent so downstream
     * consumers can switch frames. Pure derived; the original target
     * stays as candidateTarget (still in candidate's units) so existing
     * counter math doesn't silently shift frame. */
    if (detectInHandFraming(answer)) {
      next.candidateTargetIsInHand = true;
      const ctcEq = backComputeCtcFromInHand(parsed.target);
      if (ctcEq != null) next.candidateTargetCtcEquivalentLpa = ctcEq;
    }
  }
  if (parsed.currentCtc != null) next.candidateCurrentCtc = parsed.currentCtc;
  if (parsed.competing != null) next.competingOffer = parsed.competing;
  if (parsed.targetAsRange) next.candidateAskedAsRange = true;

  /* Memory feature (2026-05-29) — record claims on first mention; on
   * subsequent mentions detect contradictions outside ±10%. The kernel
   * stamps `lastContradiction` once per turn; the planner reads it to
   * fire `contradiction-callout` next. applyAiMove clears the signal
   * so a single contradiction doesn't re-fire forever. */
  const claimsBefore: UserClaims = state.userClaims ?? {};
  const claimsNext: UserClaims = { ...claimsBefore };
  let contradiction: ContradictionSignal | null = state.lastContradiction ?? null;
  const NUMERIC_TOLERANCE = 0.10;
  const recordNumeric = (
    topic: "currentCtc" | "expectedCtc" | "noticePeriod",
    parsedValue: number | null | undefined,
  ): void => {
    if (parsedValue == null || !Number.isFinite(parsedValue)) return;
    const prior = claimsBefore[topic];
    if (prior == null) {
      claimsNext[topic] = { value: parsedValue, firstSeenTurn: state.turnIndex };
      return;
    }
    const drift = Math.abs(parsedValue - prior.value) / Math.max(Math.abs(prior.value), 1e-9);
    if (drift > NUMERIC_TOLERANCE && contradiction == null) {
      contradiction = {
        topic,
        oldValue: prior.value,
        newValue: parsedValue,
        firstSeenTurn: prior.firstSeenTurn,
      };
    }
  };
  recordNumeric("currentCtc", parsed.currentCtc);
  /* Audit Fix #2 contract — a "fixed"-scoped target ("₹26 LPA fixed at
   * minimum") refers to a component, not the total package; routing it
   * to candidateTargetFixed (above) means it must NOT be compared
   * against the prior total-package expectedCtc claim or the
   * contradiction detector spuriously fires. Only total-scoped targets
   * feed the expectedCtc ledger. */
  if (parsed.targetComponent !== "fixed") {
    recordNumeric("expectedCtc", parsed.target);
  }
  recordNumeric("noticePeriod", parsed.noticeJoining.noticePeriodDays);

  /* Competing offer — composite (company + amount). Contradict when the
   * company matches but the amount drifts beyond ±10%, OR when the
   * company changes and an amount is given (we treat that as a new
   * claim — last-stated wins for company tracking, no callout). */
  const competingCompany = parsed.competingOfferDetail.company;
  const competingAmount = parsed.competingOfferDetail.amount ?? parsed.competing ?? null;
  if (competingCompany != null && competingAmount != null && Number.isFinite(competingAmount)) {
    const prior = claimsBefore.competingOffer;
    if (prior == null) {
      claimsNext.competingOffer = {
        value: { company: competingCompany, amount: competingAmount },
        firstSeenTurn: state.turnIndex,
      };
    } else if (prior.value.company.toLowerCase() === competingCompany.toLowerCase()) {
      const drift = Math.abs(competingAmount - prior.value.amount) /
        Math.max(Math.abs(prior.value.amount), 1e-9);
      if (drift > NUMERIC_TOLERANCE && contradiction == null) {
        contradiction = {
          topic: "competingOffer",
          oldValue: prior.value.amount,
          newValue: competingAmount,
          firstSeenTurn: prior.firstSeenTurn,
          oldLabel: prior.value.company,
          newLabel: competingCompany,
        };
      }
    }
  }

  /* currentRole tracking is reserved on the type; a parser hook for
   * role-restatement claims will be wired in alongside the role-mismatch
   * detector. For now the field is populated only via direct state
   * seeding (e.g. tests / replay fixtures). */

  next.userClaims = claimsNext;
  next.lastContradiction = contradiction;

  /* Recruiter-power-dynamics feature (2026-05-29) — mid-session
   * competing-process disclosure detector. Regex sweep on the raw
   * candidate utterance. If matched AND the signal hasn't already been
   * flipped, set powerSignals.candidateHasCompetingProcess = true and
   * recompute recruiterPower. Pure / idempotent: a second match no-ops. */
  {
    const a = (answer || "").toString();
    const COMPETING_PROCESS_RES: RegExp[] = [
      /another offer (in hand|already)/i,
      /in (the )?final round(s)? at /i,
      /competing offer/i,
      /I have an offer from /i,
      /interviewing (with|at) (next week|tomorrow)/i,
    ];
    const priorSignals = next.powerSignals ?? {};
    if (priorSignals.candidateHasCompetingProcess !== true) {
      const hit = COMPETING_PROCESS_RES.some((re) => re.test(a));
      if (hit) {
        const updated: PowerSignals = {
          ...priorSignals,
          candidateHasCompetingProcess: true,
        };
        next.powerSignals = updated;
        next.recruiterPower = computeRecruiterPower(updated);
      }
    }
  }

  /* Paraphrase-loop feature (2026-05-29) — confirmation-gate detection.
   * If the LAST AI turn shipped a paraphrase-recap (state.paraphraseFired
   * went true on the prior applyAiMove) AND the candidate just replied
   * with a "no, actually X" pattern, log a correction event so subsequent
   * planner cascades can reference it as priorContext. The simple
   * yes/right/correct reply is a no-op (no behavioral change). */
  if (state.paraphraseFired === true) {
    const a = (answer || "").trim();
    if (a) {
      const NEG_CORRECTION_RE =
        /\b(?:no|nope|actually|correction|to clarify|wait,?\s+)\b[^.!?]{0,200}/i;
      const lowered = a.toLowerCase();
      const isAffirm = /^(?:yes|yeah|right|correct|that'?s right|got it|sure)\b/.test(lowered);
      if (!isAffirm && NEG_CORRECTION_RE.test(a)) {
        const corrections = [...(state.paraphraseCorrections ?? [])];
        /* Lightweight topic detection — surface the dominant noun. */
        let topic = "general";
        if (/\bnotice\b/i.test(a)) topic = "noticePeriod";
        else if (/\bjoining|join\b/i.test(a)) topic = "joining";
        else if (/\bbase|expected|ask\b/i.test(a)) topic = "expectedCtc";
        else if (/\bcurrent\b/i.test(a)) topic = "currentCtc";
        else if (/\bcompeting|offer\b/i.test(a)) topic = "competingOffer";
        corrections.push({
          turn: state.turnIndex,
          topic,
          correction: a.slice(0, 240),
        });
        next.paraphraseCorrections = corrections;
      }
    }
  }

  /* Calibrated-surprise lowball feature (2026-05-29) — branch detection.
   * If the PRIOR turn shipped the probe (state.calibratedSurpriseContext
   * is populated), classify the candidate's reply into one of:
   *   A — double-down: yes/comfortable/no number revision  → acceptedLowball
   *   B — revise up:   utterance contains a NEW higher number → wasn't lowballing
   *   C — ask why:     "why / what's the band / what should it be"
   * Each branch updates the affinity ledger; A also stamps acceptedLowball.
   * Context is cleared so the classification only fires once per probe.
   */
  if (state.calibratedSurpriseContext != null) {
    const ctx = state.calibratedSurpriseContext;
    const raw = (answer || "").trim();
    const lowered = raw.toLowerCase();
    /* Branch C — ask why / band probe. Check FIRST so questions don't
     * get mis-classified as a double-down. */
    const ASK_WHY_RE =
      /\b(?:why\s+(?:do\s+you|would\s+you|did\s+you)|what(?:'?s|\s+is)\s+(?:the|your)?\s*band|what\s+should\s+it\s+be|how\s+(?:come|did\s+you)|on\s+what\s+basis|what(?:'?s|\s+is)\s+the\s+(?:floor|range|benchmark))\b/i;
    /* Numeric-revision detection: look for an explicit revision phrase
     * OR a number that is materially HIGHER than the prior anchor. */
    const REVISION_HINT_RE =
      /\b(?:actually|on reflection|revise|let me revise|reconsider|raise|bump|change(?:d)?\s+(?:my\s+)?(?:mind|number)|update(?:d)?\s+(?:my\s+)?(?:ask|number))\b/i;
    /* Cheap LPA-shaped number scan — anything plausibly above prior anchor. */
    const numRe = /(\d+(?:\.\d+)?)\s*(?:l|lpa|lakh|lakhs|cr|crore)?/gi;
    let revisedAnchor: number | null = null;
    let m: RegExpExecArray | null;
    while ((m = numRe.exec(lowered)) !== null) {
      const n = Number(m[1]);
      if (!Number.isFinite(n)) continue;
      /* Treat 5..200 as a plausible LPA value. Bigger numbers (like
       * "60000 USD" or "180000") are not interpreted here. */
      if (n > ctx.candidateAnchor && n >= 5 && n <= 200) {
        if (revisedAnchor == null || n > revisedAnchor) revisedAnchor = n;
      }
    }
    const isAskWhy = ASK_WHY_RE.test(raw);
    const isRevise =
      revisedAnchor != null ||
      (REVISION_HINT_RE.test(raw) && /\d/.test(raw));
    const ledger = [...(next.affinityLedger ?? state.affinityLedger ?? [])];
    let nextAffinity = next.recruiterAffinity ?? state.recruiterAffinity ?? 0;
    if (isAskWhy) {
      /* Branch C — no flag change, no affinity delta. */
    } else if (isRevise && revisedAnchor != null) {
      /* Branch B — transparency reward. */
      ledger.push({ turn: state.turnIndex, delta: 1, reason: "transparency" });
      nextAffinity = Math.min(AFFINITY_MAX, nextAffinity + 1);
      /* Update userClaims.expectedCtc to the revised number so the rest
       * of the cascade engages with the new anchor. */
      const claims = { ...(next.userClaims ?? state.userClaims ?? {}) };
      claims.expectedCtc = {
        value: revisedAnchor,
        firstSeenTurn:
          claims.expectedCtc?.firstSeenTurn ?? state.turnIndex,
      };
      next.userClaims = claims;
      next.candidateTarget = revisedAnchor;
    } else {
      /* Branch A (default) — double-down. */
      next.acceptedLowball = true;
      ledger.push({ turn: state.turnIndex, delta: -1, reason: "wasted-time" });
      nextAffinity = Math.max(AFFINITY_MIN, nextAffinity - 1);
    }
    next.affinityLedger = ledger;
    next.recruiterAffinity = nextAffinity;
    /* Clear the context — branch classification is one-shot. */
    next.calibratedSurpriseContext = null;
  }

  /* Component breakdown — merge non-null fields into sticky state.
     Last-stated wins per component; previously-stated components
     persist when the current turn names only one. */
  if (parsed.componentBreakdown.hasAny) {
    next.candidateComponentBreakdown = mergeBreakdown(
      state.candidateComponentBreakdown,
      parsed.componentBreakdown,
    );

    /* PDF#18 follow-up P3 (2026-05-15) — current-vs-expected fixed/
     * variable split disambiguation. When the candidate's utterance
     * carries a fixed+variable breakdown AND the bot's previous
     * question was tagged with `lastDisclosureSubject`, route the
     * split to the right flag:
     *   subject='current'  → currentCtcFixedVariableSplitDisclosed=true
     *   subject='expected' → expectedCtcFixedVariableSplitDisclosed=true
     * The legacy umbrella `fixedVariableSplitAnswered` flag is also
     * monotone-true so legacy checklists clear. Monotone-up. */
    /* BUG-3 follow-up (PDF#24, 2026-05-16): a percentage-shaped split
     * ("80% fixed, 20% variable") is also a valid disclosure of the
     * fitment structure — accept either absolute OR percent shape so
     * the subject-specific flag flips for percent-only candidates too.
     * Without this, the umbrella `fixedVariableSplitAnswered` was being
     * set (via syncChecklistFromParsedFacts) but the subject-specific
     * `currentCtcFixedVariableSplitDisclosed` /
     * `expectedCtcFixedVariableSplitDisclosed` stayed false, leaving
     * downstream consumers that key on the subject-specific flag blind
     * to the percent-only disclosure. Monotone-up. */
    /* PDF#34 Fix 1 (2026-05-18) — variableInferred provenance gate on
     * the discovery checklist.
     *
     * PDF#33 Move B1 stamped `variableInferred=true` on the breakdown
     * when `variable` arrived via the total−base complement (the
     * candidate stated total + base but not variable). The
     * nextComponentProbe consumer was taught to treat the inferred
     * value as needs-confirmation. But this checklist setter was NOT —
     * an inferred variable would still flip
     * `currentCtcFixedVariableSplitDisclosed=true`, advancing the
     * discovery sequence past the split slot without the candidate
     * ever confirming the number.
     *
     * In the PDF#34 Meesho/Prita repro: total=24, base=22 → variable
     * inferred=2. Checklist flag flipped → sequence advanced → planner
     * jumped to vesting/esop before the variable was ratified. Move
     * B1's component-probe path SHOULD have caught it, but the
     * discovery cascade was already racing ahead.
     *
     * Fix: gate `splitHasBoth` on the variable being EXPLICITLY
     * disclosed, not inferred. The percent-shape path is unaffected
     * (percentages are always explicit). */
    /* PDF#35 Move 5 (2026-05-18) — variableInferred unambiguous-math
     * refinement. PDF#34 Fix 1's gate was too coarse: it forced
     * `variableInferred=true` on every total−base inference, including
     * cases where the math is completely unambiguous (total=24, base=22
     * → variable=2 with no plausible alternative). The kernel was then
     * re-asking the variable even after the candidate had clearly
     * stated total + base, producing a perceived loop.
     *
     * Refinement: when variable came via the total−base complement AND
     * the resulting ratio variable/total is in [0.01, 0.25] (small
     * residual = credible variable component, not a parser slip) AND
     * both total and base were explicitly stated in the same utterance,
     * treat the inference as unambiguous — drop the inferred flag for
     * the checklist gate so the split slot advances naturally. Outside
     * that range (e.g. base=11, total=24 → variable=13, ratio≈0.54)
     * keep variableInferred=true: a 54% variable share is implausible
     * enough that we should re-confirm rather than silently advance.
     *
     * "Explicitly stated in the same utterance" is signalled here by
     * `currentCtc != null` (this turn parsed a total) AND `base != null`
     * (this turn parsed a base). The complement is derived inside
     * extractComponentBreakdown, so when both are present this turn,
     * the inference is from THIS utterance, not stale state. */
    const variableCameFromInference =
      parsed.componentBreakdown.variableInferred === true;
    let variableUnambiguous = false;
    if (
      variableCameFromInference &&
      parsed.componentBreakdown.base != null &&
      parsed.componentBreakdown.variable != null &&
      parsed.currentCtc != null &&
      parsed.currentCtc > 0
    ) {
      const ratio = parsed.componentBreakdown.variable / parsed.currentCtc;
      if (ratio >= 0.01 && ratio <= 0.25) {
        variableUnambiguous = true;
      }
    }
    /* PDF#36 Fix B2 (2026-05-19) — cross-turn unambiguous-math gate.
     * The same-turn gate above only fires when base + total both arrive
     * in a single utterance. Real candidates often disclose total on
     * one turn and base on another ("My CTC is 24 LPA" → next turn:
     * "base is 22 LPA"). Re-evaluate the unambiguous gate using prior
     * sticky state values, ratio window unchanged.
     *
     * We require:
     *   - variable came from inference THIS turn (variableInferred true)
     *   - we now have BOTH a base value (parsed this turn OR sticky)
     *     and a total (parsed this turn OR sticky)
     *   - both explicit (not previously inferred — base has no inferred
     *     flag in the schema, so its presence implies explicit; total
     *     never carries inferred provenance)
     *   - ratio of variable/total is in [0.01, 0.25]. */
    if (!variableUnambiguous && variableCameFromInference) {
      const baseCross =
        parsed.componentBreakdown.base ??
        state.candidateComponentBreakdown?.base ??
        null;
      const totalCross =
        parsed.currentCtc ??
        state.candidateCurrentCtc ??
        null;
      const variableNow = parsed.componentBreakdown.variable;
      if (
        baseCross != null &&
        totalCross != null &&
        totalCross > 0 &&
        variableNow != null
      ) {
        const ratio = variableNow / totalCross;
        if (ratio >= 0.01 && ratio <= 0.25) {
          variableUnambiguous = true;
        }
      }
    }
    const variableExplicitlyDisclosed =
      parsed.componentBreakdown.variable != null &&
      (parsed.componentBreakdown.variableInferred !== true || variableUnambiguous);
    const splitHasBoth =
      (parsed.componentBreakdown.base != null &&
        variableExplicitlyDisclosed) ||
      (parsed.componentBreakdown.basePercent != null &&
        parsed.componentBreakdown.variablePercent != null);
    /* When the math was unambiguous, also clear the inferred flag on
     * the breakdown so downstream consumers (component-probe path)
     * treat the variable as settled. */
    if (variableUnambiguous && next.candidateComponentBreakdown) {
      next.candidateComponentBreakdown = {
        ...next.candidateComponentBreakdown,
        variableInferred: false,
      };
    }
    if (splitHasBoth && state.discoveryChecklist != null) {
      const subject = state.lastDisclosureSubject ?? null;
      const checklist = { ...state.discoveryChecklist };
      checklist.fixedVariableSplitAnswered = true;
      if (subject === "current") {
        checklist.currentCtcFixedVariableSplitDisclosed = true;
      } else if (subject === "expected") {
        checklist.expectedCtcFixedVariableSplitDisclosed = true;
      } else {
        /* No subject tag (legacy session / split offered unprompted):
         * fall back to the legacy umbrella flag only. Conservative —
         * doesn't accidentally tag a split against the wrong CTC. */
      }
      next.discoveryChecklist = checklist;
    }
  }

  /* Phase 12c (2026-05-13) — structural hard-band-cap detection. If
   * the candidate's stated base floor exceeds the band's
   * baseStretch, the cap is structural (not just band): no amount
   * of total-CTC stretching satisfies the constraint, because base
   * is the binding component. Flip hardBandCap so the move-picker
   * redirects all concession energy to non-cash levers instead of
   * inching the total toward maxStretch on impossible base.
   *
   * BUG-3 follow-up (PDF#24, 2026-05-16): when the candidate stated
   * the split as a percentage ("80% fixed, 20% variable") but no
   * absolute base was parsed, derive base = basePercent% of the
   * stated current CTC. That lets the cap detection work for
   * percent-only disclosures, broadly aligned with how a recruiter
   * would mentally derive the fixed component from a known total
   * fitment and a stated split. Last-stated wins: absolute base
   * (when present) is authoritative; the derived value only fires
   * when the absolute is missing. */
  let candidateStatedBaseLpa: number | null =
    next.candidateComponentBreakdown.base ?? null;
  if (
    candidateStatedBaseLpa == null &&
    next.candidateComponentBreakdown.basePercent != null &&
    next.candidateCurrentCtc != null
  ) {
    candidateStatedBaseLpa =
      (next.candidateComponentBreakdown.basePercent / 100) *
      next.candidateCurrentCtc;
  }
  if (
    candidateStatedBaseLpa != null &&
    state.band.baseStretch != null &&
    candidateStatedBaseLpa > state.band.baseStretch
  ) {
    next.hardBandCap = true;
  }

  /* Phase 11 — hike% is recomputed each turn from the LATEST
     target+currentCtc (after current-turn binding). Rationale is
     sticky: last-stated wins, prior preserved when current turn
     mentions no rationale cue. */
  next.hikePercent = computeHikePercent(next.candidateTarget, next.candidateCurrentCtc);
  if (parsed.rationale) next.rationale = parsed.rationale;

  /* Phase 13/14/15/16 — merge non-empty parses into sticky state.
     Each merger preserves prior fields when the current turn doesn't
     mention them; non-null new values overwrite. Booleans are
     monotone-up (once requested/refused, stays). */
  if (parsed.noticeJoining.hasAny) {
    next.noticeJoining = mergeNoticeJoining(state.noticeJoining, parsed.noticeJoining);
  }
  if (parsed.equityVesting.hasAny) {
    next.equityVesting = mergeEquityVesting(state.equityVesting, parsed.equityVesting);
  }
  if (parsed.locationMode.hasAny) {
    next.locationMode = mergeLocationMode(state.locationMode, parsed.locationMode);
  }
  if (parsed.competingOfferDetail.hasAny) {
    next.competingOfferDetail = mergeCompetingOfferDetail(
      state.competingOfferDetail,
      parsed.competingOfferDetail,
    );
  }

  /* Phase 17 — fold deadline + profile + misc scalars. Same
   * last-stated-wins / monotone-up merge semantics. */
  if (parsed.decisionDeadline.hasAny) {
    next.decisionDeadline = mergeDecisionDeadline(state.decisionDeadline, parsed.decisionDeadline);
  }
  /* ResumeFactPack track (2026-05-16) — detect a stated current-company
   * affiliation from the candidate utterance. Last-stated-wins. The
   * credibility-probe lever in the planner reads this against
   * state.resumeFactPack to flag mismatches. */
  const statedCompany = detectStatedCurrentCompany(answer);
  if (statedCompany) {
    next.candidateStatedCurrentCompany = statedCompany;
    /* When the resume confirms the stated affiliation, log the
     * avoidance so the decision-log shows the planner consciously
     * skipped the probe (rather than appearing to have forgotten). */
    if (next.resumeFactPack && resumeConfirmsCompany(next.resumeFactPack, statedCompany)) {
      next.credibilityProbeAvoidedAt = next.turnIndex;
    }
  }

  if (parsed.candidateProfile.hasAny) {
    next.candidateProfile = mergeCandidateProfile(state.candidateProfile, parsed.candidateProfile);
    /* ResumeFactPack track (2026-05-16) — record provenance="stated"
     * for any flag transitioning false→true via a candidate utterance.
     * Resume-seeded flags already carry provenance="resume" and are
     * left untouched (merge is monotone-up, so the resume fact stands). */
    const provenance: Record<string, "resume" | "stated"> = { ...(state.flagProvenance ?? {}) };
    const trackFlag = (key: "tenureSignal" | "peopleManagementClaimed" | "domesticTopMbaAnchor" | "mncExperience") => {
      if (provenance[key]) return; // resume seed wins; stated only confirms.
      const before = state.candidateProfile[key];
      const after = next.candidateProfile[key];
      if (!before && after) provenance[key] = "stated";
    };
    trackFlag("tenureSignal");
    trackFlag("peopleManagementClaimed");
    trackFlag("domesticTopMbaAnchor");
    trackFlag("mncExperience");
    next.flagProvenance = provenance;
  }

  /* Bug-report 11 (2026-05-14) — fresh-grad disclosure overrides the
   * resume-derived applicableYoe. If the candidate says "I'm pre-grad"
   * / "fresh graduate" / "still in college" mid-session, force
   * candidateApplicableYoe to 0 and flip freshGradDisclosed sticky-true.
   * The brief in _negotiate-turn-helpers surfaces this so the AI
   * acknowledges the disclosure rather than continuing to anchor on
   * the senior bucket inferred from the resume. */
  if (!state.freshGradDisclosed && detectFreshGradDisclosure(answer)) {
    next.freshGradDisclosed = true;
    next.candidateApplicableYoe = 0;
    /* Phase 30 (2026-05-14) — mid-session band rebase.
     *
     * Before this block we only zeroed candidateApplicableYoe, but the
     * band stored on state was already resolved at init from the
     * onboarding-time applicableYoe (e.g. resume said "5 yrs" → senior
     * band locked at ₹35-65L). With the disclosure, the AI should
     * anchor entry-tier numbers from the very next move.
     *
     * Re-resolve the band with applicableYoe=0 → "entry" tier. But never
     * lower the ceiling below what has ALREADY been offered: the close-
     * floor invariant says we cannot claw back commitments. If the AI
     * has already opened at ₹40L and only now learns the candidate is
     * pre-grad, the ceiling pins to the prior offer rather than
     * collapsing the floor underneath an active negotiation. */
    /* Fresher-flow extension (2026-05-14c): thread collegeTier +
     * internshipConversion from the (merged) candidate profile into the
     * rebase. Both are monotone-up, so reading from `next` (the about-to-
     * commit state) captures any disclosure made on this turn. */
    const rebasedRaw = resolveServerBand(state.role, state.company, "entry", 0, {
      collegeTier: next.candidateProfile?.collegeTier ?? null,
      internshipConversion: next.candidateProfile?.internshipConversion ?? false,
    });
    /* Audit follow-up (2026-05-21) — mid-session band re-clamp. The
     * INIT path runs clampBandToTierP50 to catch curator data that
     * would price the opener at >2× the tier P50 (Wipro UI/UX ₹27L
     * regression). The fresher-rebase path used to skip the clamp,
     * which meant a senior PD disclosing pre-grad at TCS could land on
     * a rebased band that still inherited a designer-family curator
     * outlier. Apply the same clamp here, gated by the highest-offer
     * floor below so we still never claw back an already-committed
     * number. */
    const rebasedTier = getCompanyTier(state.company);
    const rebasedClamp = clampBandToTierP50(rebasedRaw, state.role, rebasedTier);
    const rebased = rebasedClamp.clamped
      ? { ...rebasedRaw, ...rebasedClamp.band }
      : rebasedRaw;
    const floor = Math.max(state.highestOfferMade ?? 0, rebased.initialOffer);
    /* `band` is `readonly` on NegotiationState — by design it's an
     * init-time field. Phase 30 is the one explicit case where we
     * rebase, so we narrow the cast to this assignment rather than
     * dropping the readonly contract everywhere. */
    /* Fresher-flow extension (2026-05-14): preserve ALL fields from the
     * rebased band — including probationOffer / probationMonths /
     * isInternshipStipend / internshipMonths / baseStretch / variableMax
     * / minOffer. Previously this assignment listed only the 4 core
     * fields, silently dropping probation + stipend flags when a
     * mid-session rebase happened (e.g. senior PD → discloses pre-grad
     * at TCS). The candidate would see one framing pre-rebase and a
     * different one post-rebase. Spread first, then patch maxStretch
     * for the floor-protection invariant. */
    (next as { band: NegotiationBand }).band = {
      ...rebased,
      maxStretch: Math.max(rebased.maxStretch, floor),
    };
  }
  if (parsed.miscSignals.hasAny) {
    next.miscSignals = mergeMiscSignals(state.miscSignals, parsed.miscSignals);
  }
  if (parsed.retentionCounter.hasAny) {
    next.retentionCounter = mergeRetentionCounter(state.retentionCounter, parsed.retentionCounter);
  }
  /* Phase 21 — pass recovery signals so posture booleans (desperate,
   * salary-only, avoids-anchor, personal-expense, offer-shopping) can
   * decay when the candidate course-corrects in a later turn. Other
   * red flags (badmouth, equity-as-cash, etc.) stay sticky. */
  const recovery = detectRecoverySignals(answer);
  const hasRecovery =
    recovery.desperateRecovered ||
    recovery.salaryOnlyRecovered ||
    recovery.avoidsAnchorRecovered ||
    recovery.personalExpenseRecovered ||
    recovery.offerShoppingRecovered;
  if (parsed.candidateStance.hasAny || hasRecovery) {
    next.candidateStance = mergeCandidateStance(
      state.candidateStance,
      parsed.candidateStance,
      recovery,
    );
  }
  /* Phase 21b recovery actualization (2026-05-13) — mark the AI's next
   * turn as eligible for a small un-stiffening boost in the move-picker.
   * Reset to false in applyAiMove so the bonus is one-shot, not sticky. */
  next.recentRecoveryActive = hasRecovery;

  /* Sprint A.4 (2026-05-15) — current-employer detection. Free-form
   * extraction from "currently at X", "working at X", "I'm with X",
   * "I work at X". Threaded into the counter-offer-risk detector so the
   * well-funded-employer signal can fire. Last-stated-wins; never
   * cleared by an utterance that doesn't mention an employer. */
  if (!next.currentEmployer) {
    const emp = detectCurrentEmployer(answer);
    if (emp) next.currentEmployer = emp;
  }

  /* F6 (2026-05-15) — probe-refusal counter. The move-picker's number-
   * discipline gate watches probeRefusalCount to escalate from "soft
   * probe" → "structural probe" → "close-walkaway" when the candidate
   * keeps dodging the expectation question. Without this counter the
   * gate is dead code — the move-picker can't see that the candidate
   * refused. Increment monotonically when the candidate utterance is a
   * recognisable refusal-of-disclosure. Pattern is intentionally narrow
   * (false positives here would burn the requisition). */
  if (
    /i'?d prefer not|not comfortable sharing|let'?s come back|prefer to keep that|won'?t disclose|skip that|pass on that|rather not say|that's personal/i.test(answer)
  ) {
    next.probeRefusalCount = (state.probeRefusalCount ?? 0) + 1;

    /* P4 (2026-05-15) — refusal-fallback wiring. When the candidate
     * has refused the same discovery item twice (probeRefusalCount
     * ≥ 2 with the same lastDiscoveryItemAsked), mark the item in
     * discoveryRefusedItems so getNextOrderedDiscoveryItem skips it
     * and moves to the next item in sequence. Threshold = 2 gives
     * the candidate one "soft probe" and one "structural probe"
     * before the kernel respects the boundary. */
    const askedItem = state.lastDiscoveryItemAsked;
    if (
      askedItem &&
      (next.probeRefusalCount ?? 0) >= 2
    ) {
      const prior = state.discoveryRefusedItems ?? {};
      next.discoveryRefusedItems = { ...prior, [askedItem]: true };
    }
  }

  /* Tier-2 ship wiring (2026-05-15) — non-salary constraints extraction.
   * Detector is already shipped and the brief-injection site already
   * reads `state.nonSalaryConstraints`; the only missing piece was the
   * extractor call. Merge monotone-up so a constraint disclosed earlier
   * survives a later turn that doesn't restate it. */
  {
    const fresh = extractNonSalaryConstraints(answer);
    if (Object.keys(fresh).length > 0) {
      next.nonSalaryConstraints = mergeNonSalaryConstraints(
        state.nonSalaryConstraints,
        fresh,
      );
    }
  }

  /* Phase 24c — merge sales / contract comp-structure detectors.
   * Only merge when the new utterance carried a signal; otherwise
   * leave prior state intact (we never blank out earlier disclosure). */
  const freshSales = extractSalesOTE(answer);
  if (freshSales.hasAny) {
    next.salesOTE = mergeSalesOTE(state.salesOTE, freshSales);
  }
  const freshContract = extractContractRate(answer);
  if (freshContract.hasAny) {
    next.contractRate = mergeContractRate(state.contractRate, freshContract);
  }

  /* PDF #18 root-cause (2026-05-15) — candidate-disclosure ack tracker.
   * Detect notice-period / current-CTC / competing-offer / joining-date
   * disclosures in the utterance and append to pendingCandidateAcks.
   * The next bot turn MUST acknowledge them (enforced via brief
   * injection + pruneAcknowledged in applyAiMove). De-dupe by kind so
   * a candidate restating the same disclosure across multiple turns
   * doesn't multiply pending entries. */
  {
    const fresh = detectCandidateDisclosures(answer);
    if (fresh.length > 0) {
      const existing = state.pendingCandidateAcks ?? [];
      const merged: typeof existing = [...existing];
      const seen = new Set(existing.map((e) => e.kind));
      for (const entry of fresh) {
        if (!seen.has(entry.kind)) {
          merged.push(entry);
          seen.add(entry.kind);
        }
      }
      if (merged.length !== existing.length) {
        next.pendingCandidateAcks = merged;
      }

      /* PDF #28 (2026-06-07) — disclosure write-through to kernel slots.
       *
       * Previously the disclosure tracker only wrote per-turn ack
       * labels. The kernel had a SEPARATE parser (parseCandidateAnswer
       * → next.candidateCurrentCtc) whose regex was stricter. When the
       * stricter parser missed but the disclosure tracker matched (e.g.
       * "my current ctc is 44 LPA" with extra punctuation that
       * confused the stricter parser), the slot stayed null and the
       * planner re-emitted ctc-ask next turn — the user saw it as the
       * bot forgetting what they just told it.
       *
       * Fix: when the disclosure tracker captures a parsedValue AND
       * the slot is currently null after the main parser ran, write
       * the value through. Never overwrite an existing value — that
       * preserves the main parser's authority where it fired. */
      for (const entry of fresh) {
        if (typeof entry.parsedValue !== "number") continue;
        if (entry.kind === "current-ctc" && next.candidateCurrentCtc == null) {
          next.candidateCurrentCtc = entry.parsedValue;
        } else if (
          entry.kind === "notice-period"
          && next.noticeJoining.noticePeriodDays == null
        ) {
          next.noticeJoining = {
            ...next.noticeJoining,
            noticePeriodDays: entry.parsedValue,
            hasAny: true,
          };
        }
      }
    }
  }

  /* ITEM 3 (2026-05-15) — trial-close detector wiring.
   * If the bot's PREVIOUS turn contained a trial-close ask (e.g.
   * "if we land at ₹X, would you accept today?") AND the candidate is
   * replying now, set candidateSignaledClose sticky-true and push
   * "candidate-trial-close" onto reactiveFollowupsFired so the planner
   * can emit a close-confirmation move. Monotone-up: once signaled,
   * stays signaled for the rest of the session.
   *
   * Audit fix (2026-05-22) — the prior gate stamped `candidateSignaledClose`
   * whenever the bot's PRIOR turn was a trial close, regardless of how
   * the candidate actually responded. A hedge ("I'd be comfortable IF
   * X happens", "let me think", "depends") or decline ("not interested",
   * "I'll pass") would still flip the flag → planner shipped a close-
   * confirmation move → bot prematurely treated the candidate as
   * accepting. Now we classify the candidate response and stamp ONLY on
   * explicit accept. Hedge/decline/null → stay in counter-offer. */
  if (!next.candidateSignaledClose && detectTrialCloseAsked(state.lastAiText ?? null)) {
    const response = detectTrialCloseResponse(answer);
    if (response === "accept") {
      next.candidateSignaledClose = true;
      const priorFired = next.reactiveFollowupsFired ?? [];
      if (!priorFired.includes("candidate-trial-close")) {
        next.reactiveFollowupsFired = [...priorFired, "candidate-trial-close"];
      }
    }
    /* Hedge / decline / null — record on reactiveFollowupsFired so the
     * planner can avoid re-asking the same trial-close immediately, but
     * do NOT stamp candidateSignaledClose. */
    if (response === "hedge" || response === "decline") {
      const priorFired = next.reactiveFollowupsFired ?? [];
      const marker =
        response === "hedge"
          ? "candidate-trial-close-hedge"
          : "candidate-trial-close-decline";
      if (!priorFired.includes(marker)) {
        next.reactiveFollowupsFired = [...priorFired, marker];
      }
    }
  }

  /* Merge tactic + info sets — sticky, never cleared. */
  for (const t of parsed.vossTactics) {
    if (!next.vossTacticsUsed.includes(t)) next.vossTacticsUsed.push(t);
  }
  for (const i of parsed.infoAsked) {
    if (!next.infoAsked.includes(i)) next.infoAsked.push(i);
  }

  /* Negotiation-flow redesign commit 2 (2026-05-15) — sync discovery
   * checklist from parsed facts (audit D5 fix). Parsed-facts → *Answered
   * flag writes were asymmetric: currentCtcAnswered / targetAnswered /
   * noticePeriodAnswered / competingOffersAnswered / valueProofAnswered
   * were written only by the legacy whole-transcript foldFactsIntoState
   * path, so a candidate volunteering "90 days notice" on turn 1 would
   * be acknowledged but the bot would still re-ask notice on turn 2.
   * Runs after fact binding (parsed → next), before phase derivation
   * (terminal-accept / walk-away / derivePhase). Monotone-up. */
  if (next.discoveryChecklist != null) {
    const cb = next.candidateComponentBreakdown;
    /* BUG-3 (PDF#24, 2026-05-16): treat a percentage-shaped split
     * ("80% fixed, 20% variable") as a valid disclosure for checklist
     * purposes — the candidate stated the split, just not in absolute
     * LPA terms. */
    const fixedVariableSplitHasBoth =
      (cb.base != null && cb.variable != null) ||
      (cb.basePercent != null && cb.variablePercent != null);
    const valueProofSignal =
      (next.salesOTE?.hasAny ?? false) ||
      (next.contractRate?.hasAny ?? false) ||
      (parsed.candidateProfile.hasAny &&
        (parsed.candidateProfile.quotaAttainmentClaimed ||
          parsed.candidateProfile.peopleManagementClaimed ||
          parsed.candidateProfile.transferableSkillsClaimed ||
          parsed.candidateProfile.variableTrackRecord));
    next.discoveryChecklist = syncChecklistFromParsedFacts(next.discoveryChecklist, {
      target: parsed.target,
      currentCtc: parsed.currentCtc,
      competing: parsed.competing,
      signalsCompetingExistsWithoutNumber: parsed.signalsCompetingExistsWithoutNumber,
      competingOfferDetailHasAny: parsed.competingOfferDetail.hasAny,
      noticeJoiningHasAny: parsed.noticeJoining.hasAny,
      fixedVariableSplitHasBoth,
      valueProofSignal,
    });
  }

  /* Verbal-acceptance lock — if the candidate previously said yes but
     now is asking for more (target above current offer, or new lever
     request), record the turn so the move-picker can stiffen. We do
     NOT transition to terminal `accepted` in this case; the candidate
     re-opened. */
  const reneging =
    next.verbalAcceptanceTurn != null &&
    (parsed.target != null || parsed.vossTactics.includes("sign-today-bundle") || parsed.infoAsked.length > 0) &&
    !parsed.signalsAcceptance;
  if (reneging) {
    /* Sticky — leave verbalAcceptanceTurn set so the move-picker keeps
       seeing it across subsequent turns. Phase 25d: also escalate the
       rescission counter so 2+ consecutive renegotiation attempts trip
       a hard close-walkaway path in the move-picker AND a "rescission-
       risk" blocker in the red-flag layer. */
    next.postVerbalRenegotiationCount = state.postVerbalRenegotiationCount + 1;
  }

  /* Bug 2 (2026-05-14) — escalation path: explicit acceptance forms
   * like "please send the offer letter" / "let's move forward with this
   * number" don't trip the legacy `classifyAcceptance` performative
   * bank (they're commitment language, not "I accept" verb). Promote
   * them to terminal `accepted` here so the closing path fires. */
  if (!parsed.signalsAcceptance) {
    const strictBoost = detectExplicitAcceptance(answer);
    if (strictBoost.accepted && state.highestOfferMade > 0 && !isTerminalPhase(next.phase)) {
      /* Fix 3 (PDF #17 follow-up, 2026-05-15) — premature-close guard.
       * Block accepts before minTurnsBeforeClose unless the candidate
       * explicitly declined. */
      if (canCloseSession(next, answer, "accept")) {
        markAccepted(next, state);
        attachPostAcceptanceMessage(next);
        return finalize(next);
      }
    }
  }

  /* Terminal transitions. */
  if (parsed.signalsAcceptance) {
    /* Conditional accept ("yes if X") set verbalAcceptanceTurn instead
       of locking terminal. parseCandidateAnswer's acceptPat already
       rejects most conditionals; this is belt-and-suspenders for the
       sign-today-bundle path which carries its own implicit "if". */
    if (parsed.vossTactics.includes("sign-today-bundle")) {
      next.verbalAcceptanceTurn = state.turnIndex;
      next.phase = derivePhase(next);
      return finalize(next);
    }
    /* Bug 2 (2026-05-14) — STAGE GATING. Terminal `accepted` requires
     * an unambiguous explicit acceptance OR three consecutive non-
     * counter, non-info-asking turns from the candidate (proxy for
     * "they're done negotiating"). The `classifyAcceptance` medium-
     * confidence path is too permissive for closing into offer-letter:
     * "sounds good" / "I'd be comfortable moving forward if X" was
     * tripping a premature close. */
    const strict = detectExplicitAcceptance(answer);
    const hasOffer = state.highestOfferMade > 0;
    if (!strict.accepted) {
      /* Soft-acceptance fallback: 3+ consecutive non-counter, non-info
       * candidate turns means the candidate has stopped negotiating —
       * acceptable as an implicit-accept proxy. */
      const log = next.conversationLog;
      let trailingNonCounter = 0;
      for (let i = log.length - 1; i >= 0; i--) {
        const e = log[i];
        if (!e || e.speaker !== "candidate") continue;
        const t = e.text || "";
        const isCounter = /(?:\d+\s*(?:lpa|lakh|l\b|cr|crore|k\b)|expecting|target|want\s+\d|asking)/i.test(t);
        const isInfoAsk = /\?|how\s+much|what\s+is|tell\s+me|can\s+you/i.test(t);
        if (isCounter || isInfoAsk) break;
        trailingNonCounter += 1;
        if (trailingNonCounter >= 3) break;
      }
      if (!hasOffer || trailingNonCounter < 3) {
        /* PDF#36 Fix A2 (2026-05-19) — soft-accept idiom on top of an
         * anchored offer ("works for me", "sounds good", etc.) must
         * still stamp verbalAcceptanceTurn so the planner's
         * post-anchor close gate fires on the SAME turn. Prior code
         * dropped the stamp when trailing-non-counter < 3, which meant
         * the planner had to wait for the candidate to fall silent
         * for three more turns — by which point the bot had typically
         * fired another probe and the candidate had to "accept" again.
         *
         * Keep the 3-turn rule for whether to flip terminal
         * phase="accepted" (that still requires the strong proxy);
         * the verbalAcceptanceTurn stamp is the signal the planner
         * needs to route to close-on-acceptance and is safe to set
         * whenever the candidate signals acceptance over a standing
         * offer. */
        if (hasOffer) {
          /* PDF#48 (2026-05-26) — same structural invariant as
           * canCloseSession. The PDF#36 A2 patch stamped
           * verbalAcceptanceTurn here so the planner's post-anchor
           * close gate (_next-action-planner.ts:1765) could fire
           * same-turn. That fast-path is what produced the
           * PDF#48 auto-close: parseAcceptance medium-confidence
           * false-positive → stamp → planner fires close-
           * acceptance on the turn the offer was first announced.
           *
           * Block the stamp ONLY when we can prove the offer
           * landed THIS turn (firstOfferAtTurn === turnIndex) AND
           * the candidate hasn't named a counter. Otherwise (offer
           * was on the table from a prior turn, OR candidate has
           * countered, OR firstOfferAtTurn is null from a fixture/
           * legacy state) the PDF#36 A2 behavior is preserved. */
          const stampedThisTurn =
            state.firstOfferAtTurn != null && state.firstOfferAtTurn === state.turnIndex;
          const candidateCountered =
            state.lastCandidateCounterLpa != null || state.candidateTarget != null;
          if (!stampedThisTurn || candidateCountered) {
            next.verbalAcceptanceTurn = state.turnIndex;
          }
        }
        /* Not strict-accepted and no implicit-accept proxy: hold the
         * phase instead of closing. Derive phase normally. */
        next.phase = derivePhase(next);
        return finalize(next);
      }
    }
    /* Fix 3 (PDF #17 follow-up, 2026-05-15) — premature-close guard.
     * Strict-accepted path passes; soft-accept (trailing-non-counter)
     * path is blocked before minTurnsBeforeClose. */
    const closeReason: "accept" | "soft-accept" = strict.accepted ? "accept" : "soft-accept";
    if (!canCloseSession(next, answer, closeReason)) {
      next.phase = derivePhase(next);
      return finalize(next);
    }
    markAccepted(next, state);
    attachPostAcceptanceMessage(next);
    return finalize(next);
  }
  if (parsed.signalsWalkAway) {
    /* Fix 3 (PDF #17 follow-up, 2026-05-15) — explicit walk-away always
     * passes; this is the candidate declining outright. */
    next.phase = "walked-away";
    next.walkedAwayAtTurn = state.turnIndex;
    return finalize(next);
  }

  /* Non-terminal: re-derive phase from updated state. */
  next.phase = derivePhase(next);
  return finalize(next);
}

/** Fold an externally-computed NegotiationFacts (from the legacy
 *  whole-transcript extractor) into state. Useful during the
 *  feature-flag transition: legacy code already has facts, and the
 *  new kernel can adopt them without re-parsing. */
export function foldFactsIntoState(state: NegotiationState, facts: NegotiationFacts): NegotiationState {
  if (isTerminalPhase(state.phase)) return state;
  const next: NegotiationState = {
    ...state,
    leversUsed: [...state.leversUsed],
    vossTacticsUsed: [...state.vossTacticsUsed],
    infoAsked: [...state.infoAsked],
  };
  const num = (s: string | null): number | null => {
    if (!s) return null;
    const v = parseFloat(s.replace(/[^\d.]/g, ""));
    return Number.isFinite(v) && v > 0 ? v : null;
  };
  const t = num(facts.candidateCounter);
  const c = num(facts.candidateCurrentCTC);
  const comp = num(facts.competingOfferAmount ?? null);
  if (t != null) {
    next.candidateTarget = t;
    if (next.firstAnchoredTarget == null) next.firstAnchoredTarget = t;
  }
  if (c != null) next.candidateCurrentCtc = c;
  if (comp != null) next.competingOffer = comp;
  /* Audit Pass 2 Fix C (2026-05-16) — finalize() symmetry with
   * applyCandidateAnswer. There's no candidate turn here (no answer
   * was parsed), so no lastTurnDelta to stamp. We DO need to re-stamp
   * plannedNextAction so consumers reading from fold-facts state see
   * the planner output for the new phase (the prior bug returned
   * `next` raw, so the planner cascade never ran for fold-facts). */
  const finalize = (n: NegotiationState): NegotiationState => {
    n.plannedNextAction = _callNextActionPlanner(n);
    return n;
  };
  if (facts.acceptedImmediately) {
    markAccepted(next, state);
    attachPostAcceptanceMessage(next);
    return finalize(next);
  }
  if (facts.rejectedOutright) {
    next.phase = "walked-away";
    next.walkedAwayAtTurn = state.turnIndex;
    return finalize(next);
  }
  next.phase = derivePhase(next);
  return finalize(next);
}

/* ─── Phase derivation ───────────────────────────────────────────── */

/** State → phase. Pure, no transcript dependency. The earlier
 *  detectSalaryPhase needed transcript + turn index + facts because it
 *  was reconstructing state from scratch each render; here the phase
 *  IS state, and we just compute the next bucket from already-folded
 *  facts. */
/** AR3 / Audit Pass 4 (PDF#27, 2026-05-17) — per-phase maxTurns cap.
 *
 * Each phase-group has a hard ceiling on how many turns it can occupy
 * before the planner force-advances. The cap is the safety net against
 * discovery-loop / lever-loop pathologies — a normal session lands well
 * within budget; the cap fires when a probe keeps re-firing on the
 * same topic or a counter loop fails to converge.
 *
 *   - discovery (opening / range-disclosure): 5 turns
 *   - anchoring (offer-presented / probe-expectations): 3 turns
 *   - counter   (counter-offer / lever-explore / closing-push): 4 turns
 *
 * Plumbed via state.phaseEnteredAtTurn, stamped by derivePhase on every
 * phase transition. Read by the planner top-level (see _next-action-
 * planner.ts) which routes to a phase-appropriate force-advance action
 * rather than re-routing state.phase directly (that path is reserved
 * for the natural derivePhase cascade). */
/* PDF#48 B4 (2026-05-25) — counter-phase cap STAYS at 4. The earlier
 * patchwork raised it to 7, which was just a kicking-the-can magic
 * number. The structural issue was the ROUTING: when counter
 * exhausts, the prior force-advance went straight to `stalemate`
 * (hard cliff). Real recruiter close-out has one framed beat in
 * between — a closing-push restate ("this is what we can do, let
 * me know"). With `forcedPhaseFor("counter")` now routing through
 * `closing-push` (and `closing-push` itself force-advancing to
 * `stalemate` when ITS budget exhausts), the counter-spiral budget
 * of 4 turns is correct: 4 counter-group turns + 4 closing-push
 * turns = 8 turn-runway before terminal, with a framed close beat
 * in between. The PDF#48 Flipkart session would emit the closing-
 * push restate at turn 14 instead of the abrupt stalemate. */
const MAX_TURNS_PER_PHASE = {
  discovery: 5,
  anchoring: 3,
  counter: 4,
} as const;

const DISCOVERY_PHASES: ReadonlySet<NegotiationPhase> = new Set([
  "opening",
  "range-disclosure",
]);
const ANCHORING_PHASES: ReadonlySet<NegotiationPhase> = new Set([
  "offer-presented",
  "probe-expectations",
]);
const COUNTER_PHASES: ReadonlySet<NegotiationPhase> = new Set([
  "counter-offer",
  "lever-explore",
  "closing-push",
]);

function phaseGroupOf(
  phase: NegotiationPhase,
): "discovery" | "anchoring" | "counter" | null {
  if (DISCOVERY_PHASES.has(phase)) return "discovery";
  if (ANCHORING_PHASES.has(phase)) return "anchoring";
  if (COUNTER_PHASES.has(phase)) return "counter";
  return null;
}

/** AR3 — phase-group force-advance target.
 *
 *  Discovery → range-disclosure if a signal (currentCtc OR target)
 *  is known else stalemate; anchoring → counter-offer; counter →
 *  closing-push when still in counter-offer / lever-explore (gives
 *  the recruiter one framed close beat before terminal), then →
 *  stalemate when even closing-push has overstayed.
 *
 *  Returned phase MUST still pass canTransitionPhase at the caller;
 *  this helper just names the preferred next bucket. */
function forcedPhaseFor(
  group: "discovery" | "anchoring" | "counter",
  state: NegotiationState,
): NegotiationPhase | null {
  if (group === "discovery") {
    const hasSignal =
      state.candidateCurrentCtc != null || state.candidateTarget != null;
    if (hasSignal) return "range-disclosure";
    return "stalemate";
  }
  if (group === "anchoring") return "counter-offer";
  /* counter group: route through closing-push first. Once closing-
   * push itself overstays its budget, terminate to stalemate. */
  if (state.phase === "closing-push") return "stalemate";
  return "closing-push";
}

export function derivePhase(state: NegotiationState): NegotiationPhase {
  const derived = derivePhaseInner(state);
  /* Negotiation-flow redesign commit 6 (2026-05-15) — clamp the result
   * through the monotonicity matrix. If derivation produced a backward
   * transition that isn't an authorized exception (walk-away-reopen,
   * verbal-renege), hold the prior phase instead of regressing. */
  let next = canTransitionPhase(state.phase, derived, state) ? derived : state.phase;
  /* AR3 / Audit Pass 4 (PDF#27, 2026-05-17) — per-phase maxTurns cap as
   * an override on the natural cascade. When the current phase has
   * overstayed its budget AND derivePhaseInner failed to advance it
   * (e.g. discovery cascade is stuck because one checklist flag never
   * flipped), force-advance to the next phase-group's entry. The
   * override is gated on canTransitionPhase so we never produce an
   * illegal regression. */
  if (next === state.phase && state.phaseEnteredAtTurn != null) {
    const group = phaseGroupOf(state.phase);
    if (group != null && !isTerminalPhase(state.phase)) {
      const cap = MAX_TURNS_PER_PHASE[group];
      if (state.turnIndex - state.phaseEnteredAtTurn > cap) {
        const forced = forcedPhaseFor(group, state);
        if (forced != null && canTransitionPhase(state.phase, forced, state)) {
          next = forced;
        }
      }
    }
  }
  /* AR3 — stamp phaseEnteredAtTurn on every phase transition. The
   * mutation pattern mirrors the stalemateAtTurn stamp below — state is
   * the caller's mutable `next` workspace by convention. The stamp is
   * only updated on actual phase change; once set for a phase it stays
   * until the next transition, giving the planner a stable budget
   * anchor to measure against. */
  if (next !== state.phase) {
    state.phaseEnteredAtTurn = state.turnIndex;
  } else if (state.phaseEnteredAtTurn == null) {
    state.phaseEnteredAtTurn = state.turnIndex;
  }
  /* Audit Pass 3 / Fix 1 (2026-05-16) — symmetric ledger stamp on
   * stalemate entry. Mirrors acceptedAtTurn / walkedAwayAtTurn semantics
   * (set once on first transition into terminal phase, never overwritten
   * once set). state is the callers' mutable `next` workspace by
   * convention; this side effect is the same pattern markAccepted /
   * the rejectedOutright branch already use. */
  if (next === "stalemate" && (state.stalemateAtTurn == null)) {
    state.stalemateAtTurn = state.turnIndex;
  }
  return next;
}

function derivePhaseInner(state: NegotiationState): NegotiationPhase {
  if (isTerminalPhase(state.phase)) return state.phase;
  if (state.turnIndex >= state.maxTurns) return "stalemate";

  /* C2 — active phase gating (2026-05-15). Narrow trigger: when the
   * session is still in the opening phase, no offer has gone out yet,
   * the candidate has spoken at least once (turnIndex >= 1 — so there
   * is utterance to extract discovery facts from), discoveryStage is
   * "discovery" and the checklist is incomplete, HOLD the phase at
   * "opening". Without this gate the kernel would advance into the
   * offer/probe phases the moment any prior offer-ish artefact (e.g.,
   * a synthetic test seed) appears, even though discovery hasn't been
   * collected. The companion gate in the move-picker re-routes the
   * opening branch from `open-with-offer` to a discovery probe when
   * this condition holds, so the bot asks instead of anchoring.
   *
   * turnIndex >= 1 keeps every turn-0 opening-flow test green (turn 0
   * still routes through open-with-offer as before). highestOfferMade
   * === 0 keeps the gate from regressing once an anchor is on the
   * table (the existing post-offer advancement is unchanged). */
  if (
    state.phase === "opening" &&
    state.highestOfferMade === 0 &&
    state.turnIndex >= 1 &&
    state.discoveryStage === "discovery" &&
    state.discoveryChecklist != null &&
    !isDiscoveryComplete(state.discoveryChecklist, classifyRoleFamily(state.role))
  ) {
    return "opening";
  }

  /* PDF#18 follow-up (2026-05-15) — range-disclosure phase transitions.
   *
   * ENTRY: when in `opening` AND ordered discovery is complete AND no
   * specific anchor disclosed yet (highestOfferMade === 0) AND the
   * session is past turn 0 (so we have something to react to), promote
   * to `range-disclosure`. The companion gate in the move-picker
   * forces a range-emitting move when this phase is active.
   *
   * EXIT: once a range has been disclosed (rangeDisclosedAtTurn set)
   * AND at least one AI turn has elapsed since (turnIndex >
   * rangeDisclosedAtTurn), advance to negotiation territory. We use
   * the post-range "negotiation" semantically = offer-presented when
   * no candidate target has been parsed yet, counter-offer when one
   * has — same routing the rest of derivePhase already uses. */
  if (
    state.phase === "opening" &&
    state.highestOfferMade === 0 &&
    state.turnIndex >= 1 &&
    state.discoveryChecklist != null &&
    isDiscoveryComplete(state.discoveryChecklist, classifyRoleFamily(state.role)) &&
    (state.rangeDisclosedAtTurn == null)
  ) {
    return "range-disclosure";
  }
  if (state.phase === "range-disclosure") {
    /* Still pre-anchor: if a specific number hasn't been put on the
     * table, stay in range-disclosure until the bot has actually
     * disclosed a range AND at least one further turn has elapsed
     * (allowing the candidate to react). */
    if (state.highestOfferMade > 0) {
      /* A specific anchor has been put on the table — promote. */
      if (state.candidateTarget != null) return "counter-offer";
      return "offer-presented";
    }
    if (
      state.rangeDisclosedAtTurn != null &&
      state.turnIndex > state.rangeDisclosedAtTurn
    ) {
      /* Candidate has had a turn to react — advance to negotiation. */
      if (state.candidateTarget != null) return "probe-expectations";
      return "offer-presented";
    }
    return "range-disclosure";
  }

  /* Phase 25e (2026-05-13) — closing-push runway. The previous machine
   * jumped straight from counter-offer / lever-explore to stalemate the
   * instant turn budget elapsed, denying the AI a final framed close.
   * One turn before stalemate, when we're still mid-negotiation, route
   * into closing-push so the LLM can issue a clean "I need a decision
   * today" turn before the budget terminates. */
  if (
    state.turnIndex === state.maxTurns - 1 &&
    (state.phase === "counter-offer" || state.phase === "lever-explore")
  ) {
    return "closing-push";
  }

  /* PDF#37 BUG-C/D (2026-05-20) — phase derivation must also consult
   * candidateTargetFixed. When the candidate states a fixed-component
   * target ("I want ₹26 LPA fixed") without a separate total-target, the
   * session was stuck in probe-expectations because `target` was null,
   * which caused planNextAction to regress to discovery-probe even after
   * an anchor offer was on the table. Folding candidateTargetFixed into
   * the target gate drives the legitimate transition to counter-offer. */
  const target = state.candidateTarget ?? state.candidateTargetFixed;
  /* Negotiation-flow redesign commit 6 (2026-05-15) — sticky-floor
   * clauses (POST_PROBE_PHASES / isPostProbe / alreadyProbed /
   * candidateEngagedAtAll) removed. Monotonicity is now enforced
   * structurally by the canTransitionPhase clamp wrapping this function.
   * Backward transitions (e.g. counter-offer → probe-expectations) are
   * rejected by the matrix; legitimate verbal-renege keeps the phase
   * sticky via the verbal-renege exception in canTransitionPhase. */

  /* Target above max stretch + ≥2 levers tried → lever-explore. Only
     non-cash bridges remain. */
  if (target != null && target > state.band.maxStretch && state.leversUsed.length >= 2) {
    return "lever-explore";
  }

  /* Target stated + we've made an offer → counter territory. */
  if (target != null && state.highestOfferMade > 0) {
    return "counter-offer";
  }

  /* Offered, no target — distinguish between "candidate has engaged"
     (probe-expectations) and "awaiting first reaction" (offer-presented).
     Backward regressions from higher phases are blocked by the
     monotonicity matrix above. */
  if (state.highestOfferMade > 0) {
    const candidateEngaged =
      state.candidateCurrentCtc != null ||
      state.competingOffer != null ||
      state.leversUsed.includes("probe");
    return candidateEngaged ? "probe-expectations" : "offer-presented";
  }

  return "opening";
}

/* ─── AI move selection ──────────────────────────────────────────── */

export interface AiMove {
  lever: NegotiationLever;
  /** New total CTC the AI is willing to put on the table this turn
   *  (LPA). Null when the move is non-numeric (probe / benefits / hold). */
  newTotalLpa: number | null;
  /** Human-readable rationale for telemetry and prompt context. */
  rationale: string;
  /** Phase 24d (2026-05-13) — market modulation hint for non-cash
   *  levers. counter-base bakes marketMode into the numeric split,
   *  but joining-bonus / equity-grant / notice-buyout amounts come
   *  from the LLM, not the kernel. Surface a tone hint so the LLM
   *  sizes those concessions in line with the market: hot → be
   *  generous, soft → be tight, neutral → standard. */
  marketModeHint?: string;
  /** Kernel-computed joining-bonus amount (LPA, one-time). Set when
   *  lever='joining-bonus' OR when lever='close-acceptance' and a
   *  JB had previously been offered this session. The LLM MUST quote
   *  this number — non-negotiable. Sizing logic: 40% of the gap
   *  between current highest offer and candidateTarget (or maxStretch
   *  when target is null), modulated by marketMode (hot 1.5 / neutral
   *  1.0 / soft 0.7), clamped to [1.0, 6.0] LPA. Without this, the
   *  LLM offered "joining bonus" three times without ever naming an
   *  amount (May 2026 session). */
  joiningBonusAmount?: number;
  /** Commit 4 (2026-05-15) — reactive-followup topic marker. Set when
   *  the planner emits a `reactive-followup` NextAction so applyAiMove
   *  can push the topic into state.reactiveFollowupsFired (sticky
   *  de-dupe ledger). Unset on every other lever class.
   *
   *  ArchRec 2 (2026-05-16) — typed as DiscoveryTopic so typos at push
   *  sites become compile errors instead of silent dedup misses. */
  askedTopic?: DiscoveryTopic;
  /** Commit 4 (2026-05-15) — NextAction kind discriminator carried on
   *  the move for telemetry / decisionLog inspection. Optional. */
  actionKind?: string;
  /** PDF#51 (2026-05-28) — deterministic-prose payload for the new
   *  `answer-direct` NextAction kind. When set, negotiate-turn.ts
   *  short-circuits the LLM call and ships this string verbatim. Pre-
   *  resolved by the planner via `renderCandidateQuestionResponse`
   *  (persona overrides already applied). Mirrors the structural
   *  bypass that terminal-intent + adversarial + STT-garble already
   *  use for their canned responses — same pattern, planner-driven. */
  deterministicProse?: string;
  /** 2026-05-29 audit follow-up — telemetry slice for the 14-topic
   *  curated bank. Set ONLY when `actionKind === "answer-direct"` so
   *  `kernel_answer_direct_deterministic` can be filtered per topic
   *  (coverage / quality regressions per curated entry). Mirrors
   *  `route.topic` from `_question-router.ts`. */
  answerDirectTopic?: string;
  /** Proactive-sweetener feature (2026-05-30) — which sweetener kind
   *  the planner picked. Set ONLY when `actionKind ===
   *  "proactive-sweetener"`. applyAiMove copies this onto
   *  `state.proactiveSweetenerKind` so the prose + report layers can
   *  attribute the sweetener post-hoc. */
  sweetenerKind?:
    | "signing-bonus"
    | "relocation"
    | "equity-refresh"
    | "joining-flexibility"
    | "notice-buyout-help";
}

/** Bug-report 12 (2026-05-14) — close-floor invariant. Every
 *  close-acceptance return MUST clamp newTotalLpa to at least
 *  highestOfferMade (falling back to band.initialOffer when the AI
 *  hasn't opened yet). The kernel must NEVER close below the number
 *  it already put on the table — once an offer is out there, that's
 *  the floor for any future close. Belt-and-suspenders against any
 *  logic path that tries to close low (e.g. the auto-accept gate when
 *  candidate counters DOWN below the offer they already have on the
 *  table — they don't need to take less than what was offered, so we
 *  honor the higher number).
 *  Pure. */
export function clampToCloseFloor(state: NegotiationState, value: number): number {
  const closeFloor = state.highestOfferMade > 0
    ? state.highestOfferMade
    : state.band.initialOffer;
  return Math.max(closeFloor, value);
}

/** pickAiMove was extracted to _kernel-move-picker.ts on 2026-05-14
 *  (kernel split refactor). Re-exported here so every existing caller
 *  continues to `import { pickAiMove } from "./_negotiation-kernel"`
 *  unchanged. See _kernel-move-picker.ts for rationale + dependency edges. */
export { pickAiMove } from "./_kernel-move-picker";


/* Cap on the rolling conversation log. 4 entries = the last 2 exchanges,
 * which is what the per-turn LLM prompt embeds. Larger logs drift the
 * dynamic portion of the prompt farther through Groq's prefix cache,
 * costing both tokens and cache-hit rate without measurably improving
 * thread coherence (the kernel brief carries the derived facts; the log
 * is just for natural-language reference resolution). */
export const CONVERSATION_LOG_CAP = 4;

/** DEBT #2 (2026-05-21) — answeredQuestionLedger cardinality cap.
 *  Sized comfortably above the current QuestionIntent enum (~20
 *  buckets) so the cap acts as defense-in-depth, not as a routine
 *  pressure on the eviction policy. applyAiMove evicts the smallest-
 *  turn (LRU) entry on overflow; validateState asserts the invariant. */
const MAX_LEDGER_ENTRIES = 20;

/** Push a new entry onto the rolling log, capping at the most recent
 *  CONVERSATION_LOG_CAP entries. Empty text drops the entry (e.g. the
 *  init turn where candidateAnswer = ""). Pure. */
function appendConversation(
  log: NegotiationState["conversationLog"],
  speaker: "ai" | "candidate",
  text: string,
): NegotiationState["conversationLog"] {
  const trimmed = (text || "").trim();
  if (!trimmed) return log.slice();
  const next = [...log, { speaker, text: trimmed }];
  return next.length > CONVERSATION_LOG_CAP ? next.slice(next.length - CONVERSATION_LOG_CAP) : next;
}

/* ─── State transition: apply an AI move ─────────────────────────── */

/** Apply an AI move to state, incrementing turn index and recording
 *  the lever + offered number. Pure. Caller is responsible for the
 *  actual text generation; this just bookkeeps the move. */
export function applyAiMove(state: NegotiationState, move: AiMove, aiText: string): NegotiationState {
  const next: NegotiationState = {
    ...state,
    turnIndex: state.turnIndex + 1,
    leversUsed: [...state.leversUsed, move.lever],
    lastAiText: aiText,
    conversationLog: appendConversation(state.conversationLog, "ai", aiText),
    /* Phase 21b: recovery boost is one-shot — clear after the AI's
     * turn fires so subsequent turns aren't permanently un-stiffened
     * after a single recovery utterance. */
    recentRecoveryActive: false,
    /* Bug-report 12 (2026-05-14): the per-turn fresh-counter signal
     * is also one-shot — clear after the AI's turn so a sticky intake
     * target can't keep firing the auto-accept gate on subsequent
     * turns where the candidate didn't actually re-counter. */
    lastCandidateCounterLpa: null,
    /* Architectural bug-prevention (2026-05-15) — clear one-shot brief
     * tag attribution so next turn starts fresh. */
    lastBriefTags: undefined,
    /* Negotiation-flow redesign commit 1 (2026-05-15) — TurnDelta is a
     * per-candidate-turn signal. Clear it on the AI turn so a stale delta
     * cannot bleed into the next candidate turn's reactive routing. */
    lastTurnDelta: null,
    /* Negotiation-flow redesign commit 3 (2026-05-15) — plannedNextAction
     * is a per-candidate-turn signal too. Clear after the AI consumes it;
     * the next applyCandidateAnswer call repopulates from the post-derive
     * state. AR2 telemetry wire-in (2026-05-25) — before clearing, copy
     * to lastShippedAction so the next turn's pipeline can compare
     * prevAi (the action we just consumed) vs nextAi (the one
     * applyCandidateAnswer will stamp). */
    lastShippedAction: state.plannedNextAction ?? null,
    plannedNextAction: null,
    /* PDF#29 Bug 7 (2026-05-18) — frustration signal is one-shot. Clear
     * after the AI turn fires so a single complaint doesn't re-trigger
     * acknowledge-and-recover on every subsequent turn until the
     * candidate happens to send a non-frustrated utterance. */
    lastUserFrustrated: false,
    /* Memory feature (2026-05-29) — contradiction signal is one-shot,
     * same shape as lastUserFrustrated. The userClaims record persists
     * across turns; only the per-turn callout trigger is cleared. */
    lastContradiction: null,
  };
  /* PDF#38 BUG-B (2026-05-20) — single-fire advance from probe-mismatch
   * to discovery. The planner routes the FIRST substantive turn through
   * the mismatch-probe when the resume↔role gap is hard. Once that
   * probe lands (any AI turn while stage === "probe-mismatch") we
   * advance the stage so the discovery cascade resumes on the next
   * turn. Without this advance the bot would re-route into the same
   * probe every turn (the consumer at planner line 1219 gates purely
   * on stage). The mismatch-probe lever shape is `lever: "probe"`
   * with rationale containing "probe-mismatch" — but any AI turn
   * fired while stage === "probe-mismatch" satisfies the probe slot,
   * so we advance unconditionally on the stage match. */
  if (state.discoveryStage === "probe-mismatch") {
    next.discoveryStage = "discovery";
  }
  /* Audit follow-up (2026-05-21) — answeredQuestionLedger write.
   *
   * If the candidate's most recent turn carried a structured
   * `candidateAskedQuestion.intent`, the AI text we just shipped is
   * THE canonical answer to that intent for this session. Record it
   * so a future repeat of the same intent can short-circuit straight
   * to the prior answer (cross-turn factual coherence).
   *
   * Two reasons for keying on intent (not raw question text):
   *   1. Same fact, different phrasings ("when do RSUs vest?" vs
   *      "what's the equity schedule?") share an intent ("equity") so
   *      both get the consistent answer.
   *   2. The ledger size stays bounded by the intent enum cardinality
   *      (~15 buckets) instead of growing per-utterance.
   *
   * The write happens UNCONDITIONALLY on every AI turn that follows a
   * question-bearing user turn — re-asks of the same intent overwrite
   * the prior entry with the latest answer text and turn marker, so a
   * follow-up clarification on the same topic supersedes the older
   * answer rather than freezing on a stale one. */
  const askedIntent = state.lastTurnDelta?.candidateAskedQuestion?.intent;
  if (typeof askedIntent === "string" && askedIntent.length > 0 && aiText && aiText.trim().length > 0) {
    const priorLedger = state.answeredQuestionLedger ?? {};
    const merged: Partial<Record<QuestionIntent, { answerText: string; turn: number }>> = {
      ...priorLedger,
      [askedIntent]: { answerText: aiText, turn: state.turnIndex },
    };
    /* DEBT #2 (2026-05-21) — bounded cardinality. The QuestionIntent
     * enum has ~20 buckets so in practice the ledger should never grow
     * past that. The cap is defense-in-depth against future enum growth
     * or a back-compat hole that lets a stale string-keyed payload
     * accumulate. LRU-by-turn eviction matches the read-side semantic:
     * the entry with the smallest `turn` is the oldest answer and the
     * one least likely to still be referenced by a follow-up. */
    const keys = Object.keys(merged) as QuestionIntent[];
    if (keys.length > MAX_LEDGER_ENTRIES) {
      let evictKey: QuestionIntent = keys[0];
      let evictTurn = merged[evictKey]?.turn ?? Infinity;
      for (const k of keys) {
        const t = merged[k]?.turn ?? Infinity;
        if (t < evictTurn) {
          evictTurn = t;
          evictKey = k;
        }
      }
      /* Never evict the entry we just wrote — its turn is state.turnIndex
       * which (until close-recap) is the largest in the table. The min-
       * turn loop above naturally picks an older entry. */
      delete merged[evictKey];
    }
    next.answeredQuestionLedger = merged;
  }
  /* Negotiation-flow redesign commit 4 (2026-05-15) — record the
   * reactive-followup topic the planner emitted this turn. Sticky:
   * future planNextAction calls consult this ledger before re-emitting
   * the same trigger. Never cleared on AI turns. */
  if (move.askedTopic) {
    const fired = state.reactiveFollowupsFired ?? [];
    if (!fired.includes(move.askedTopic)) {
      next.reactiveFollowupsFired = [...fired, move.askedTopic];
    } else {
      next.reactiveFollowupsFired = fired;
    }
    /* ResumeFactPack track Step 4 (2026-05-16) — distinct ledger field
     * so consumers don't have to .includes() the string ledger to
     * check whether the credibility-probe has fired. */
    if (move.askedTopic === "credibility-probe") {
      next.credibilityProbeFired = true;
    }
    /* Polish 2 (2026-05-16) — append the AI turn index to the per-topic
     * fire-log so canRefire can compute counts + turn gaps for sticky
     * topics (tax-implication, notice-buyout, range-to-point). The
     * legacy `reactiveFollowupsFired` array stays as a dedup ledger for
     * single-fire topics. */
    const priorLog = state.reactiveFollowupsFireLog ?? {};
    const priorTurns = priorLog[move.askedTopic] ?? [];
    next.reactiveFollowupsFireLog = {
      ...priorLog,
      [move.askedTopic]: [...priorTurns, state.turnIndex],
    };
  }
  /* 2026-05-29 realism-pass — increment the per-topic serve count
   * whenever an answer-direct fires for a specific curated topic. The
   * renderer reads this on the NEXT planNextAction so a repeat ask of
   * the same topic strictly advances to the next variant. Pure / sticky;
   * never reset within a session. */
  if (move.actionKind === "answer-direct" && typeof move.answerDirectTopic === "string") {
    const priorCounts = state.candidateQuestionServeCount ?? {};
    const key = move.answerDirectTopic;
    next.candidateQuestionServeCount = {
      ...priorCounts,
      [key]: (priorCounts[key] ?? 0) + 1,
    };
  }
  /* Fix 1 (2026-05-16) — record structural lever emissions onto the
   * leversFired ledger so the planner's pickStructuralLever rotation
   * advances correctly. Gated on actionKind being one of the new
   * Indian-context lever kinds. */
  const STRUCTURAL_LEVERS = new Set<string>([
    "band-anchor-with-rationale",
    "lever-grade-upgrade",
    "lever-retention-bonus",
    "lever-rsu-refresh",
    "lever-relocation",
    "lever-perf-bonus-cadence",
    "lever-joining-bonus-explained",
  ]);
  if (move.actionKind && STRUCTURAL_LEVERS.has(move.actionKind)) {
    const firedLevers = state.leversFired ?? [];
    if (!firedLevers.includes(move.actionKind)) {
      next.leversFired = [...firedLevers, move.actionKind];
    } else {
      next.leversFired = firedLevers;
    }
  }
  /* Bad-faith tactic ledger stamp (2026-05-29). Push the actionKind
   * onto state.tacticsUsed when the planner emitted a tactic-injection
   * action so the same tactic cannot re-fire in the session. */
  const TACTIC_ACTION_KINDS = new Set<string>([
    "exploding-offer-pressure",
    "fake-competing-candidate",
    "vague-promise",
  ]);
  if (move.actionKind && TACTIC_ACTION_KINDS.has(move.actionKind)) {
    const tacticsUsed = state.tacticsUsed ?? [];
    if (!tacticsUsed.includes(move.actionKind)) {
      next.tacticsUsed = [...tacticsUsed, move.actionKind];
    } else {
      next.tacticsUsed = tacticsUsed;
    }
  }
  /* Phase 2 Indian-HR redesign (2026-05-17) — stamp the post-acceptance
   * documentation-request turn marker so the planner emits the lever
   * exactly once per session. */
  if (
    move.actionKind === "post-acceptance-document-request" &&
    state.postAcceptanceDocsRequestedAtTurn == null
  ) {
    next.postAcceptanceDocsRequestedAtTurn = state.turnIndex;
  }
  /* Phase 3 missing-lever set (2026-05-17) — stamp single-fire turn
   * markers for the three new levers. Stamping is keyed to actionKind
   * (which the planner sets via move.actionKind) so the markers are
   * driven by the planner emission, not by the lower-level lever
   * string. For polite-walkaway we ALSO stamp walkedAwayAtTurn so the
   * existing terminal-phase machinery treats the emission as the
   * formal walk-away trigger (the existing walk-away-return trapdoor
   * handles re-engagement). */
  if (
    move.actionKind === "panel-approval-stall" &&
    state.panelApprovalStallFiredAtTurn == null
  ) {
    next.panelApprovalStallFiredAtTurn = state.turnIndex;
  }
  if (
    move.actionKind === "polite-walkaway" &&
    state.politeWalkawayFiredAtTurn == null
  ) {
    next.politeWalkawayFiredAtTurn = state.turnIndex;
    if (next.walkedAwayAtTurn == null) {
      next.walkedAwayAtTurn = state.turnIndex;
    }
  }
  if (
    move.actionKind === "anchor-defense-hike-strong" &&
    state.hikeStrongDefenseFiredAtTurn == null
  ) {
    next.hikeStrongDefenseFiredAtTurn = state.turnIndex;
  }
  /* fake-leverage-challenge (2026-05-17) — stamp BOTH the
   * top-level single-fire marker AND the proofRequestedAtTurn on the
   * competingOfferDetail record. Subsequent candidate-utterance parses
   * read proofRequestedAtTurn to gate proofProvided into the state's
   * monotone-up flag (handled in the parser/merge above). */
  if (
    move.actionKind === "fake-leverage-challenge" &&
    state.fakeLeverageChallengeFiredAtTurn == null
  ) {
    next.fakeLeverageChallengeFiredAtTurn = state.turnIndex;
    if (next.competingOfferDetail.proofRequestedAtTurn == null) {
      next.competingOfferDetail = {
        ...next.competingOfferDetail,
        proofRequestedAtTurn: state.turnIndex,
      };
    }
  }
  /* PDF#42 BUG-A (2026-05-21) — competitor-match single-fire stamp. */
  if (
    move.actionKind === "competitor-match" &&
    state.competitorMatchFiredAtTurn == null
  ) {
    next.competitorMatchFiredAtTurn = state.turnIndex;
  }
  /* Paraphrase-loop feature (2026-05-29) — single-fire marker. */
  if (move.actionKind === "paraphrase-recap" && state.paraphraseFired !== true) {
    next.paraphraseFired = true;
  }
  /* Calibrated-surprise lowball feature (2026-05-29) — single-fire
   * marker + carry forward the probe context so the next
   * applyCandidateAnswer can classify the candidate's reply. */
  if (
    move.actionKind === "calibrated-surprise-lowball" &&
    state.calibratedSurpriseFired !== true
  ) {
    next.calibratedSurpriseFired = true;
    /* Extract the probe context from the move rationale-adjacent fields.
     * Planner stashes the numbers on the action payload; applyAiMove only
     * sees the AiMove. Use sticky state values it was computed from. */
    const anchor =
      state.userClaims?.expectedCtc?.value ??
      state.candidateTarget ??
      0;
    const floor = state.band?.walkAway ?? state.band?.initialOffer ?? 0;
    next.calibratedSurpriseContext = {
      firedAtTurn: state.turnIndex,
      candidateAnchor: anchor,
      bandFloor: floor,
    };
  }
  /* Proactive-sweetener feature (2026-05-30) — single-fire marker +
   * sticky kind copy. The recruiter volunteers ONE non-cash sweetener
   * (signing bonus / relocation / equity refresh / joining flex /
   * notice-buyout help) UNPROMPTED when they sense the candidate
   * cooling and cash is capped. Prose-only this commit: no band /
   * highestOfferMade mutation. Both writes are sticky so a re-fire
   * attempt is silently no-op. */
  if (
    move.actionKind === "proactive-sweetener" &&
    state.proactiveSweetenerFired !== true
  ) {
    next.proactiveSweetenerFired = true;
    if (move.sweetenerKind != null) {
      next.proactiveSweetenerKind = move.sweetenerKind;
    }
  }
  /* Branch A follow-up (2026-05-29) — `accept-lowball-quiet` is the
   * recruiter's accept move after the candidate doubled down on the
   * lowball. Stamp the turn so the planner gate doesn't re-fire. */
  if (
    move.actionKind === "accept-lowball-quiet" &&
    state.acceptLowballQuietFiredAtTurn == null
  ) {
    next.acceptLowballQuietFiredAtTurn = state.turnIndex;
  }
  /* Realism-Audit Fix 3 (2026-05-22) — manager-consult stall state
   * advancement. Three transitions, all keyed off `move.actionKind`:
   *
   *  - Open-turn: fresh stall fires. Set stallTurnsRemaining=1 so the
   *    next AI turn lands in the return branch; bump stallsFiredCount;
   *    record the stalled-ask context via move.stalledAskLpa (carried
   *    on the AiMove for this lever).
   *
   *  - Return-turn (move OR hold): decrement stallTurnsRemaining and
   *    clear lastStallContext so a fresh stall can open later in the
   *    session. The planner picks return-mode deterministically; we
   *    don't need to inspect mode here.
   *
   * `applyAiMove` runs before turnIndex is finalised below, so writes
   * are applied on `next`. */
  if (move.actionKind === "manager-consult-stall") {
    const wasInFlight = (state.stallTurnsRemaining ?? 0) > 0;
    if (wasInFlight) {
      next.stallTurnsRemaining = Math.max(0, (state.stallTurnsRemaining ?? 0) - 1);
      next.lastStallContext = null;
    } else {
      next.stallTurnsRemaining = 1;
      next.stallsFiredCount = (state.stallsFiredCount ?? 0) + 1;
      next.lastStallContext = {
        stalledAskLpa: state.lastCandidateCounterLpa ?? state.candidateTarget ?? null,
        openedAtTurn: state.turnIndex,
      };
    }
  }

  /* Audit fix 2026-05-21 — CTC-inflation anchor stamps the headline CTC
   * at fire time so the truth follow-up reuses the EXACT same numbers
   * (the lie was the framing, not the values). Pulled off the action
   * payload — `_move.newTotalLpa` carries `br.ctcLpa` for this lever. */
  if (
    move.actionKind === "ctc-inflation-anchor" &&
    state.ctcInflationAnchorCtcLpa == null &&
    move.newTotalLpa != null &&
    Number.isFinite(move.newTotalLpa) &&
    move.newTotalLpa > 0
  ) {
    next.ctcInflationAnchorCtcLpa = move.newTotalLpa;
  }
  /* F7 (PDF#20 2026-05-15) — push the asked topic onto the askedTopics
   * ledger so planNextAction can skip same-topic probes within 3 turns.
   * Use move.askedTopic if set (reactive-followups), otherwise fall back
   * to move.lever (discovery probes carry the lever key "probe" which is
   * less specific, but move.actionKind carries the item string for
   * discovery-probe moves). Use the most-specific available key. */
  {
    /* ArchRec 2 (2026-05-16) — narrow the fallback chain to DiscoveryTopic.
     * move.askedTopic is already typed; the actionKind/lever fallback is
     * validated against KNOWN_TOPICS (dev throws on unknown; prod widens
     * via cast for back-compat with pre-typing serialized sessions).
     *
     * Audit Fix (2026-05-19) — Non-probe action kinds (round-transition,
     * etc.) legitimately carry NO askedTopic and must NOT feed the
     * askedTopics ledger. Mirrors the planner's `PROBE_PRODUCING_KINDS`
     * single-source-of-truth — when actionKind is in the non-probe set
     * we skip the ledger push and short-circuit before the validator
     * would otherwise throw on an unregistered DiscoveryTopic. */
    const NON_PROBE_ACTION_KINDS: ReadonlySet<string> = new Set([
      "round-transition",
      "reactive-followup" /* generic reactive carrier — askedTopic supplied when probe-shaped */,
      /* Audit fix 2026-05-21 — CTC-inflation cascade. The anchor is a
       * number-ship (not a probe); the truth follow-up is an info-
       * disclosure carrying no askedTopic. Both legitimately bypass the
       * askedTopics ledger. */
      "ctc-inflation-anchor",
      "ctc-inflation-truth",
      /* Realism-Audit Fix 3 (2026-05-22) — manager-consult stall.
       * The stall is a leverage-tactic carrier, not a discovery probe;
       * its open + return turns legitimately bypass the askedTopics
       * ledger. The stall genuinely advances state (stallTurnsRemaining
       * / stallsFiredCount / lastStallContext) — see _next-action-planner. */
      "manager-consult-stall",
      /* Bad-faith tactic injections (2026-05-29) — flavour pressure
       * plays, not probes; they don't push the askedTopics ledger. */
      "exploding-offer-pressure",
      "fake-competing-candidate",
      "vague-promise",
      /* Memory feature (2026-05-29) — contradiction-callout is a
       * reconciliation action (acknowledge-and-recover lever), not a
       * discovery probe; it bypasses the askedTopics ledger. */
      "contradiction-callout",
      /* Paraphrase-loop feature (2026-05-29) — recap action, not a probe. */
      "paraphrase-recap",
      /* Calibrated-surprise lowball (2026-05-29) — flavour reaction +
       * Branch A quiet accept; neither pushes onto the askedTopics
       * ledger (the probe is a meta-comment on the anchor, not a
       * discovery item). */
      "calibrated-surprise-lowball",
      "accept-lowball-quiet",
      /* Proactive-sweetener (2026-05-30) — verbal non-cash sweetener
       * offered unprompted when the recruiter is cash-capped and the
       * candidate is cooling. Not a probe; doesn't push onto the
       * askedTopics ledger. */
      "proactive-sweetener",
    ]);
    const fallbackRaw =
      (move.actionKind && move.actionKind !== "reactive-followup" ? move.actionKind : null) ??
      move.lever;
    let topicKey: DiscoveryTopic | null = move.askedTopic ?? null;
    if (topicKey == null && fallbackRaw && !NON_PROBE_ACTION_KINDS.has(fallbackRaw)) {
      if (isDiscoveryTopic(fallbackRaw)) {
        topicKey = fallbackRaw;
      } else if (process.env.NODE_ENV !== "production") {
        throw new Error(
          `applyAiMove: fallback topic '${fallbackRaw}' is not a registered DiscoveryTopic. ` +
            `Add it to the DiscoveryTopic union + KNOWN_TOPICS in _negotiation-kernel.ts, ` +
            `or to NON_PROBE_ACTION_KINDS if it legitimately bypasses the askedTopics ledger.`,
        );
      } else {
        topicKey = fallbackRaw as DiscoveryTopic;
      }
    }
    if (topicKey) {
      const prior = state.askedTopics ?? [];
      next.askedTopics = [...prior, { topic: topicKey, atTurn: next.turnIndex }];
    }
  }
  if (move.newTotalLpa != null && move.newTotalLpa > state.highestOfferMade) {
    next.highestOfferMade = move.newTotalLpa;
    /* PDF#48 (2026-05-26) — stamp the first-offer turn the moment the
     * AI commits a specific number. One-shot: don't update on
     * subsequent disclosures (the candidate's "had a chance to react"
     * window is measured from FIRST anchor, not the highest). Used by
     * canCloseSession to block acceptance closes that fire on the same
     * turn the offer is announced (the kernel's parseAcceptance was
     * tripping false-positives like "no there is not equity" on the
     * very turn the offer landed; structurally that turn cannot be
     * accepting an offer the candidate hasn't seen yet). */
    if (state.firstOfferAtTurn == null) {
      next.firstOfferAtTurn = next.turnIndex;
    }
  }
  /* PDF #18 root-cause wiring (2026-05-15) — anchor lock on first numeric
   * disclosure. Before this wire, lockAnchor / effectiveAnchorLpa were
   * exported but never called anywhere (orphan helpers — confirmed via
   * full-codebase grep). The PDF #18 real session showed the anchor
   * jumping 54 → 28 LPA mid-flight; band.initialOffer was being
   * recomputed each turn with no immutable lock. We now fire lockAnchor
   * here, at the SINGLE site where the kernel commits an AI move with
   * a number on it. Idempotent — subsequent disclosures don't relock. */
  if (
    move.newTotalLpa != null &&
    Number.isFinite(move.newTotalLpa) &&
    move.newTotalLpa > 0 &&
    !next.anchorLocked
  ) {
    next.anchorLocked = true;
    next.lockedAnchorLpa = move.newTotalLpa;
  }
  /* Bug 7 (2026-05-14) — extract recruiter-fact tokens mentioned in this
   * AI turn and union into recruiterFactsAlreadySaid. Surfaced back via
   * compactTurnBrief so the LLM doesn't restate the same benefits. */
  if (aiText) {
    const newFacts = extractRecruiterFacts(aiText);
    if (newFacts.length > 0) {
      const merged = new Set<string>(state.recruiterFactsAlreadySaid || []);
      for (const f of newFacts) merged.add(f);
      next.recruiterFactsAlreadySaid = Array.from(merged);
    }
  }

  /* Fix 4 (2026-05-15) — remember last bot reply for repetition detection. */
  next.lastBotReply = aiText || null;

  /* PDF#18 follow-up (2026-05-15) — range-disclosure phase enum.
   * When the bot text emits a salary RANGE (detected by the existing
   * detectRangeDisclosure helper), record the turnIndex so derivePhase
   * can transition out of "range-disclosure" once the candidate has
   * reacted. Sticky: once set, do not overwrite (the first range
   * disclosure is the phase marker). */
  if (
    aiText &&
    next.rangeDisclosedAtTurn == null &&
    detectRangeDisclosure(aiText)
  ) {
    next.rangeDisclosedAtTurn = next.turnIndex;
  }

  /* PDF#18 follow-up (2026-05-15) — split-disambiguation subject tag.
   * The move-picker tags the rationale with the next ordered-discovery
   * item the bot is asking about. If that item is the current-CTC
   * fixed/variable split, set lastDisclosureSubject='current'; if it's
   * the expected-CTC split, set 'expected'. The next applyCandidateAnswer
   * call uses this to route the candidate's split utterance to the
   * correct flag (currentCtcFixedVariableSplitDisclosed vs
   * expectedCtcFixedVariableSplitDisclosed). */
  if (typeof move.rationale === "string") {
    if (move.rationale.includes("currentCtcFixedVariableSplitDisclosed")) {
      next.lastDisclosureSubject = "current";
    } else if (move.rationale.includes("expectedCtcFixedVariableSplitDisclosed")) {
      next.lastDisclosureSubject = "expected";
    }

    /* P4 (2026-05-15) — capture the discovery item the bot just asked
     * about so applyCandidateAnswer can attribute refusals to the
     * correct sequence item. The move-picker rationale follows the
     * convention `Discovery incomplete (next: <ITEM>) — ask: ...`. */
    const m = move.rationale.match(/Discovery incomplete \(next:\s*([a-zA-Z]+)\)/);
    if (m) {
      next.lastDiscoveryItemAsked = m[1];
    }
  }

  /* PDF #18 root-cause (2026-05-15) — prune pendingCandidateAcks that
   * this bot turn addressed. Mirror of the pendingPromises fulfillment
   * path. Entries not addressed remain pending and resurface in the
   * next turn brief. */
  if (state.pendingCandidateAcks && state.pendingCandidateAcks.length > 0) {
    const remaining = pruneAcknowledged(state.pendingCandidateAcks, aiText);
    if (remaining.length !== state.pendingCandidateAcks.length) {
      next.pendingCandidateAcks = remaining;
    }
  }

  /* Fix 3 (2026-05-15) — promise-keeping: consume any pending promises
   * the current turn fulfilled, then add any new promises this turn made. */
  if (aiText) {
    const pending = state.pendingPromises ?? [];
    const fulfilled = extractPromisesFulfilled(pending, aiText);
    let remaining = pending;
    if (fulfilled.length > 0) {
      const consumed = new Set(fulfilled);
      remaining = pending.filter(p => !consumed.has(p));
    }
    const newPromises = extractRecruiterPromises(aiText);
    if (newPromises.length > 0) {
      const merged = new Set<string>(remaining);
      for (const p of newPromises) merged.add(p);
      next.pendingPromises = Array.from(merged);
    } else if (fulfilled.length > 0) {
      next.pendingPromises = remaining;
    }
  }
  /* ITEM 3 (2026-05-15) — closeFired: set true when the AI emits a
   * close-acceptance or close-walkaway move so the reactive close-
   * confirmation rule does not re-fire after the session is closing. */
  /* perfect 1 (2026-05-16) — spiral counter. Increment counterRound
   * each time the AI ships a counter-base move; the planner reads
   * this to apply diminishing-concessions on subsequent rounds. */
  if (move.lever === "counter-base") {
    next.counterRound = state.counterRound + 1;
  }
  if (move.lever === "close-acceptance" || move.lever === "close-walkaway") {
    next.closeFired = true;
  }

  /* PDF#45 B3 (2026-05-26) — terminal-phase lock on bot-side close.
   * When the recruiter ships a close-acceptance recap, flip phase to
   * "accepted" immediately so the NEXT turn the planner short-circuits
   * at the `state.phase === "accepted"` gate (line ~1397) instead of
   * falling back into the discovery / probe cascade. Without this,
   * the bot would emit the formal close recap AND THEN, on the very
   * next turn (after candidate confirmation), re-enter discovery —
   * the transcript regression showed a recap at T11 followed by
   * "What's your current notice period?" at T12. Symmetric path for
   * close-walkaway → walked-away. Terminal phases set by the candidate
   * (acceptance / walk-away parser path) are preserved by the
   * `!isTerminalPhase(next.phase)` guard at the derivePhase site
   * below — this fires only when phase is still non-terminal at the
   * moment the bot ships the close. */
  if (move.lever === "close-acceptance" && !isTerminalPhase(next.phase)) {
    next.phase = "accepted";
    if (next.acceptedAtTurn == null) next.acceptedAtTurn = state.turnIndex;
    if (next.verbalAcceptanceTurn == null) next.verbalAcceptanceTurn = state.turnIndex;
  } else if (move.lever === "close-walkaway" && !isTerminalPhase(next.phase)) {
    next.phase = "walked-away";
    if (next.walkedAwayAtTurn == null) next.walkedAwayAtTurn = state.turnIndex;
  }

  /* Phase 28 — record the kernel-computed JB amount when a JB lever
     fires so close-acceptance can include it in the recap. Sticky:
     once set, only an upward replacement clobbers it (a subsequent JB
     lever would re-compute against the new highestOfferMade). */
  if (move.lever === "joining-bonus" && typeof move.joiningBonusAmount === "number") {
    next.lastJoiningBonusOffered = move.joiningBonusAmount;
  }
  /* Re-derive phase only for non-terminal states (terminal phases set
     by candidate-turn don't get clobbered by an AI move that follows). */
  if (!isTerminalPhase(next.phase)) {
    next.phase = derivePhase(next);
  }
  /* Phase 5 Session A (2026-05-19) — multi-round persona switch.
   * Evaluate round-end trigger AFTER phase derivation so the handoff
   * fires the same turn the kernel converges on closing-push (or a
   * terminal phase). Default-OFF: when `multiRoundEnabled` is false,
   * this is a typed no-op and `next` is returned unchanged. */
  return maybeAdvanceRound(next);
}

/* ─── Validation helpers ─────────────────────────────────────────── */

/** Does the LLM's generated text contain a salary number that
 *  violates the band? Returns the first violating number (in LPA) or
 *  null. Used by the route handler to detect when the LLM has invented
 *  a number outside the approved band.
 *
 *  Unit-aware: matches both `LPA / lakh` and `cr / crore` and normalises
 *  crore→LPA (×100). Without crore matching, the LLM could write
 *  "₹2 crore total" and bypass the validator entirely — a real risk
 *  since the upstream parser now accepts crore inputs from candidates. */
/** Phase 31 (2026-05-14) — centralised component-constraint validator.
 *
 *  Before this helper, `pickAiMove` had an inline check (Phase 12b,
 *  ~line 1924) that compared the proposed counter against
 *  `baseStretch + variableMax` but never against `baseFloor`. The audit
 *  flagged this: a band can declare baseFloor as the structural minimum
 *  base the company will quote, yet the kernel completely ignored it,
 *  so a counter below baseFloor could leave the picker.
 *
 *  Semantics:
 *    A total-CTC value T is structurally valid iff there EXISTS a
 *    (base, variable) decomposition with
 *      baseFloor   ≤ base    ≤ baseStretch
 *      0           ≤ variable ≤ variableMax
 *      base + variable = T
 *
 *    Therefore T must satisfy:
 *      baseFloor                       ≤ T   (else base would have to be < baseFloor)
 *      T ≤ baseStretch + variableMax        (else base would have to exceed baseStretch)
 *
 *  Returns { ok, reason }. Reason discriminates the two failure modes
 *  so the move-picker can react differently — below-floor offers
 *  shouldn't happen and indicate a band-resolution bug; above-cap
 *  offers route to non-cash levers.
 *
 *  Fields are all optional. When a field is absent, the corresponding
 *  half of the constraint is unenforced (treated as ±∞). Legacy bands
 *  without any component metadata always validate as ok. */
export type ComponentConstraintReason = "below-base-floor" | "above-component-cap";

export interface ComponentConstraintResult {
  ok: boolean;
  reason?: ComponentConstraintReason;
}

export function validateComponentConstraints(
  band: NegotiationBand,
  proposedTotalLpa: number,
): ComponentConstraintResult {
  if (band.baseFloor != null && proposedTotalLpa + 0.01 < band.baseFloor) {
    return { ok: false, reason: "below-base-floor" };
  }
  if (band.baseStretch != null) {
    const componentCap = band.baseStretch + (band.variableMax ?? 0);
    if (proposedTotalLpa > componentCap + 0.01) {
      return { ok: false, reason: "above-component-cap" };
    }
  }
  return { ok: true };
}

export function findOutOfBandNumber(text: string, band: NegotiationBand): number | null {
  /* Currency prefix accepts ₹, Rs., Rs, INR so an LLM switching
     notation can't sneak past validation. Now ALSO accepts a bare
     number followed by LPA / lakh / cr — production LLMs frequently
     drop the rupee glyph ("35 LPA"), and the prior strict regex was
     letting those slip past as "no numbers found".

     Strip commas before parseFloat for "₹1,50,000 LPA" style.

     SEMANTIC NOTE on band.walkAway: in the kernel state, walkAway is
     the candidate's FLOOR (recruiter going below this loses the
     candidate). The salary-lookup pipeline historically stored a
     RECRUITER ceiling here (= 1.1 × maxStretch), which made this
     check reject every legitimate offer below that ceiling. The
     server-side band resolver (`resolveServerBand` in negotiate-turn)
     now maps salary-lookup's `minOffer` to the kernel's `walkAway` so
     the semantics line up. The defensive `Math.min(...)` here is
     belt-and-suspenders: if anything upstream ever passes a band where
     walkAway >= maxStretch, we ignore the floor check entirely rather
     than spurious-reject every number. */
  /* Audit Pass 3 / Fix 4 (2026-05-16) — extend unit matcher to cover
   * the bare "L" suffix ("32L", "28 L") and the "lac" misspelling
   * ("28 lac"), in addition to the historical LPA / lakh / crore set.
   * Production transcripts show Indian candidates frequently using
   * "32L" / "lac" forms; the pre-fix regex treated these as no-unit
   * numbers and let them slip past the out-of-band guard. Word-boundary
   * \b after L / lac prevents matching mid-word ("Lalit", "lacking"). */
  const re = /(?:₹|Rs\.?\s*|INR\s*)?([\d,]+(?:\.\d+)?)\s*(LPA|lpa|lakhs?|lacs?|crore|\bcr\b|L\b)/gi;
  const effectiveFloor = band.walkAway < band.maxStretch ? band.walkAway : -Infinity;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    let n = parseFloat(m[1].replace(/,/g, ""));
    if (!Number.isFinite(n)) continue;
    if (/cr/i.test(m[2])) n *= 100;
    if (n > band.maxStretch + 0.01 || n < effectiveFloor - 0.01) return n;
  }
  return null;
}

/** Verbatim-repeat check. The LLM occasionally regenerates the
 *  identical question two turns in a row; this catches it without
 *  relying on Jaccard tuning. Returns true when both texts have a
 *  matching 8-content-word prefix AND both have at least that many
 *  content words. The min-length guard avoids false positives on very
 *  short closers like "Sounds good." which legitimately repeat across
 *  turns. */
const FINGERPRINT_WORDS = 8;
const MIN_CONTENT_WORDS = 4;

/* PDF#38 BUG-C (2026-05-20) — widen the verbatim-repeat look-back from
 * 1 AI turn (state.lastAiText) to the last 3 AI turns. PDF#38 Flipkart
 * T5 and T7 carried byte-identical canonical phrasing with a non-
 * matching T6 in between; the original guard never compared T7 to T5
 * (only to T6) and let the repeat through. Now we fingerprint the
 * candidate text against EACH of the last 3 AI utterances. */
const VERBATIM_LOOKBACK_AI_TURNS = 3;

export function isVerbatimRepeat(text: string, state: NegotiationState): boolean {
  if (!text) return false;
  const a = fingerprintWords(text);
  if (a.length < MIN_CONTENT_WORDS) return false;
  const aKey = a.slice(0, FINGERPRINT_WORDS).join(" ");
  const log = state.conversationLog ?? [];
  const aiTurns: string[] = [];
  for (let i = log.length - 1; i >= 0 && aiTurns.length < VERBATIM_LOOKBACK_AI_TURNS; i--) {
    const entry = log[i];
    if (entry && entry.speaker === "ai" && entry.text) aiTurns.push(entry.text);
  }
  /* Back-compat: also consult state.lastAiText when conversationLog is
   * empty (early-init sessions / unit-test fixtures that don't seed
   * the log). */
  if (aiTurns.length === 0 && state.lastAiText) aiTurns.push(state.lastAiText);
  for (const prior of aiTurns) {
    const b = fingerprintWords(prior);
    if (b.length < MIN_CONTENT_WORDS) continue;
    if (b.slice(0, FINGERPRINT_WORDS).join(" ") === aKey) return true;
  }
  return false;
}

const STOP_WORDS = new Set([
  "the","a","an","is","are","be","you","your","i","we","our","that","this","of","to","for",
  "and","or","but","with","what","how","do","does","can","could","would","should","let","me",
  "just","in","on","at","by","as","so","if","like","than","then","its","it","ll","ve","re",
]);

function fingerprintWords(s: string): string[] {
  return s.toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

/* ─── Serialization ──────────────────────────────────────────────── */

/* JSON-safe state for over-the-wire transit. Sets/Maps and `readonly`
   round-trip cleanly because NegotiationState uses plain arrays. */
/* Audit follow-up (2026-05-21) — wire-format version. Embedded under
 * the reserved `__v` key on every serialized state. The kernel reads
 * it on deserialize to refuse FUTURE-versioned payloads loudly (rather
 * than letting an unknown shape silently coerce through the
 * back-compat backfill chain). Bump this number ONLY when a kernel
 * change makes prior serialized states incompatible (field rename,
 * shape change, enum narrowing). Adding new fields with defaults does
 * NOT require a bump — the backfill block in deserializeState handles
 * that case. */
export const KERNEL_STATE_VERSION = 1;

export function serializeState(state: NegotiationState): string {
  /* Embed `__v` so a future kernel can refuse stale formats. The key
   * is deliberately namespaced (`__` prefix) so it cannot collide with
   * a legitimate state field name. */
  return JSON.stringify({ ...state, __v: KERNEL_STATE_VERSION });
}

const VALID_PHASES: ReadonlySet<NegotiationPhase> = new Set<NegotiationPhase>([
  "opening",
  "range-disclosure",
  "offer-presented",
  "probe-expectations",
  "counter-offer",
  "lever-explore",
  "closing-push",
  "accepted",
  "walked-away",
  "stalemate",
]);

const VALID_LEVERS: ReadonlySet<NegotiationLever> = new Set<NegotiationLever>([
  "open-with-offer",
  "probe",
  "counter-base",
  "joining-bonus",
  "equity-grant",
  "notice-buyout",
  "benefits-summary",
  "compensation-summary",
  "notice-period-summary",
  "hike-context-summary",
  "hold-firm",
  "close-acceptance",
  "close-walkaway",
  "close-stalemate",
  "terminal-restate",
  "ctc-inflation-anchor",
]);

function isFiniteNonNegInt(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0 && Number.isInteger(n);
}
function isFiniteNumOrNull(n: unknown): n is number | null {
  return n === null || (typeof n === "number" && Number.isFinite(n));
}

/** Throws if `state` is not a structurally valid NegotiationState. The
 *  route relies on this — malformed/out-of-sequence state from the
 *  client must not silently flow into applyCandidateAnswer. */
export function validateState(state: unknown): asserts state is NegotiationState {
  if (!state || typeof state !== "object") throw new Error("state: not an object");
  const s = state as Record<string, unknown>;
  if (typeof s.sessionId !== "string" || !s.sessionId) throw new Error("state.sessionId");
  if (typeof s.role !== "string") throw new Error("state.role");
  if (typeof s.company !== "string") throw new Error("state.company");
  const band = s.band as Record<string, unknown> | undefined;
  if (!band || typeof band !== "object") throw new Error("state.band");
  if (typeof band.initialOffer !== "number" || !Number.isFinite(band.initialOffer)) throw new Error("state.band.initialOffer");
  if (typeof band.maxStretch !== "number" || !Number.isFinite(band.maxStretch)) throw new Error("state.band.maxStretch");
  if (typeof band.walkAway !== "number" || !Number.isFinite(band.walkAway)) throw new Error("state.band.walkAway");
  if (typeof band.hasEquity !== "boolean") throw new Error("state.band.hasEquity");
  /* 2026-05-29 audit pass — band ordering invariants. Pre-existing
   * shape checks only proved the three numbers were finite; nothing
   * caught a band-resolver bug that emitted walkAway > initialOffer
   * (recruiter opens below their own floor) or maxStretch <
   * initialOffer (recruiter can't move up at all). Both were
   * representable in the type, both ship as silently wrong sessions.
   * Assert the natural ordering here so the resolver fails fast
   * instead of producing a session that bottoms out at turn 2. */
  if (!(band.walkAway > 0)) throw new Error("state.band.walkAway-non-positive");
  if (!(band.initialOffer >= band.walkAway)) throw new Error("state.band.initialOffer-below-walkAway");
  if (!(band.maxStretch >= band.initialOffer)) throw new Error("state.band.maxStretch-below-initialOffer");
  /* Component bounds (Phase 12) — when present, base bounds and
   * variable cap must be non-negative and base bounds must be ordered. */
  if (band.baseFloor !== undefined) {
    if (typeof band.baseFloor !== "number" || !Number.isFinite(band.baseFloor) || band.baseFloor < 0) {
      throw new Error("state.band.baseFloor");
    }
  }
  if (band.baseStretch !== undefined) {
    if (typeof band.baseStretch !== "number" || !Number.isFinite(band.baseStretch) || band.baseStretch < 0) {
      throw new Error("state.band.baseStretch");
    }
    if (typeof band.baseFloor === "number" && !(band.baseStretch >= band.baseFloor)) {
      throw new Error("state.band.baseStretch-below-baseFloor");
    }
  }
  if (band.variableMax !== undefined) {
    if (typeof band.variableMax !== "number" || !Number.isFinite(band.variableMax) || band.variableMax < 0) {
      throw new Error("state.band.variableMax");
    }
  }
  /* Fresher-flow probation extension — probationOffer must sit at or
   * below initialOffer (it's the reduced rate during probation, not a
   * higher number). */
  if (band.probationOffer !== undefined) {
    if (typeof band.probationOffer !== "number" || !Number.isFinite(band.probationOffer) || band.probationOffer <= 0) {
      throw new Error("state.band.probationOffer");
    }
    if (band.probationOffer > band.initialOffer) {
      throw new Error("state.band.probationOffer-above-initialOffer");
    }
  }
  if (band.probationMonths !== undefined) {
    if (typeof band.probationMonths !== "number" || !Number.isFinite(band.probationMonths) || band.probationMonths <= 0) {
      throw new Error("state.band.probationMonths");
    }
  }
  if (typeof s.phase !== "string" || !VALID_PHASES.has(s.phase as NegotiationPhase)) throw new Error("state.phase");
  if (!isFiniteNonNegInt(s.turnIndex)) throw new Error("state.turnIndex");
  if (!isFiniteNonNegInt(s.maxTurns) || s.maxTurns === 0) throw new Error("state.maxTurns");
  if (s.turnIndex > s.maxTurns + 1) throw new Error("state.turnIndex exceeds maxTurns");
  if (!isFiniteNumOrNull(s.candidateTarget)) throw new Error("state.candidateTarget");
  if (!isFiniteNumOrNull(s.candidateCurrentCtc)) throw new Error("state.candidateCurrentCtc");
  if (!isFiniteNumOrNull(s.competingOffer)) throw new Error("state.competingOffer");
  if (typeof s.highestOfferMade !== "number" || !Number.isFinite(s.highestOfferMade)) throw new Error("state.highestOfferMade");
  if (!Array.isArray(s.leversUsed) || !s.leversUsed.every((l) => typeof l === "string" && VALID_LEVERS.has(l as NegotiationLever))) {
    throw new Error("state.leversUsed");
  }
  if (typeof s.lastAiText !== "string") throw new Error("state.lastAiText");
  /* Phase 28 — sticky JB amount. Optional for back-compat with legacy
     in-flight sessions; deserializeState backfills to null. */
  if (s.lastJoiningBonusOffered !== undefined && !isFiniteNumOrNull(s.lastJoiningBonusOffered)) {
    throw new Error("state.lastJoiningBonusOffered");
  }
  if (s.acceptedAtTurn !== null && !isFiniteNonNegInt(s.acceptedAtTurn)) throw new Error("state.acceptedAtTurn");
  if (
    s.postAcceptanceDocsRequestedAtTurn !== undefined &&
    s.postAcceptanceDocsRequestedAtTurn !== null &&
    !isFiniteNonNegInt(s.postAcceptanceDocsRequestedAtTurn)
  ) {
    throw new Error("state.postAcceptanceDocsRequestedAtTurn");
  }
  if (s.walkedAwayAtTurn !== null && !isFiniteNonNegInt(s.walkedAwayAtTurn)) throw new Error("state.walkedAwayAtTurn");
  if (s.stalemateAtTurn !== undefined && s.stalemateAtTurn !== null && !isFiniteNonNegInt(s.stalemateAtTurn)) throw new Error("state.stalemateAtTurn");
  /* Phase 3 missing-lever set (2026-05-17) — single-fire turn markers. */
  if (
    s.panelApprovalStallFiredAtTurn !== undefined &&
    s.panelApprovalStallFiredAtTurn !== null &&
    !isFiniteNonNegInt(s.panelApprovalStallFiredAtTurn)
  ) {
    throw new Error("state.panelApprovalStallFiredAtTurn");
  }
  if (
    s.politeWalkawayFiredAtTurn !== undefined &&
    s.politeWalkawayFiredAtTurn !== null &&
    !isFiniteNonNegInt(s.politeWalkawayFiredAtTurn)
  ) {
    throw new Error("state.politeWalkawayFiredAtTurn");
  }
  if (
    s.hikeStrongDefenseFiredAtTurn !== undefined &&
    s.hikeStrongDefenseFiredAtTurn !== null &&
    !isFiniteNonNegInt(s.hikeStrongDefenseFiredAtTurn)
  ) {
    throw new Error("state.hikeStrongDefenseFiredAtTurn");
  }
  if (
    s.fakeLeverageChallengeFiredAtTurn !== undefined &&
    s.fakeLeverageChallengeFiredAtTurn !== null &&
    !isFiniteNonNegInt(s.fakeLeverageChallengeFiredAtTurn)
  ) {
    throw new Error("state.fakeLeverageChallengeFiredAtTurn");
  }
  if (
    s.competitorMatchFiredAtTurn !== undefined &&
    s.competitorMatchFiredAtTurn !== null &&
    !isFiniteNonNegInt(s.competitorMatchFiredAtTurn)
  ) {
    throw new Error("state.competitorMatchFiredAtTurn");
  }
  if (
    s.ctcInflationAnchorCtcLpa !== undefined &&
    s.ctcInflationAnchorCtcLpa !== null &&
    !(typeof s.ctcInflationAnchorCtcLpa === "number" && Number.isFinite(s.ctcInflationAnchorCtcLpa) && s.ctcInflationAnchorCtcLpa > 0)
  ) {
    throw new Error("state.ctcInflationAnchorCtcLpa");
  }
  /* Backward-compatible optional fields: tolerate absence (older
     in-flight sessions) but reject malformed values. deserializeState
     backfills defaults so the rest of the kernel sees a fully-shaped
     state. */
  if (s.finalOfferAssertedCount !== undefined && !isFiniteNonNegInt(s.finalOfferAssertedCount)) throw new Error("state.finalOfferAssertedCount");
  if (s.candidateAskedAsRange !== undefined && typeof s.candidateAskedAsRange !== "boolean") throw new Error("state.candidateAskedAsRange");
  if (s.vossTacticsUsed !== undefined && !(Array.isArray(s.vossTacticsUsed) && s.vossTacticsUsed.every((v) => typeof v === "string"))) throw new Error("state.vossTacticsUsed");
  if (s.infoAsked !== undefined && !(Array.isArray(s.infoAsked) && s.infoAsked.every((v) => typeof v === "string"))) throw new Error("state.infoAsked");
  if (s.verbalAcceptanceTurn !== undefined && s.verbalAcceptanceTurn !== null && !isFiniteNonNegInt(s.verbalAcceptanceTurn)) throw new Error("state.verbalAcceptanceTurn");
  if (s.postVerbalRenegotiationCount !== undefined && !isFiniteNonNegInt(s.postVerbalRenegotiationCount)) throw new Error("state.postVerbalRenegotiationCount");
  /* perfect 1 (2026-05-16) — counterRound spiral counter. Optional for
   * back-compat with sessions serialized before this field shipped. */
  if (s.counterRound !== undefined && !isFiniteNonNegInt(s.counterRound)) throw new Error("state.counterRound");
  if (s.recentRecoveryActive !== undefined && typeof s.recentRecoveryActive !== "boolean") throw new Error("state.recentRecoveryActive");
  if (s.walkAwayReturned !== undefined && typeof s.walkAwayReturned !== "boolean") throw new Error("state.walkAwayReturned");
  if (s.pendingCandidateAcks !== undefined) {
    if (!Array.isArray(s.pendingCandidateAcks)) throw new Error("state.pendingCandidateAcks");
    for (const entry of s.pendingCandidateAcks) {
      if (!entry || typeof entry !== "object") throw new Error("state.pendingCandidateAcks[].shape");
      const e = entry as Record<string, unknown>;
      if (typeof e.kind !== "string") throw new Error("state.pendingCandidateAcks[].kind");
      if (typeof e.label !== "string") throw new Error("state.pendingCandidateAcks[].label");
    }
  }
  /* Negotiation-flow redesign commit 4 (2026-05-15) — reactiveFollowupsFired
   * is optional + sticky. Reject only malformed shape. */
  /* 2026-05-29 realism-pass — candidateQuestionServeCount validator. */
  if (s.candidateQuestionServeCount !== undefined) {
    if (
      s.candidateQuestionServeCount === null ||
      typeof s.candidateQuestionServeCount !== "object" ||
      Array.isArray(s.candidateQuestionServeCount)
    ) {
      throw new Error("state.candidateQuestionServeCount");
    }
    for (const v of Object.values(s.candidateQuestionServeCount)) {
      if (!isFiniteNonNegInt(v)) {
        throw new Error("state.candidateQuestionServeCount.value");
      }
    }
  }
  if (s.reactiveFollowupsFired !== undefined) {
    if (!Array.isArray(s.reactiveFollowupsFired) || !s.reactiveFollowupsFired.every((v) => typeof v === "string")) {
      throw new Error("state.reactiveFollowupsFired");
    }
  }
  /* 2026-05-29 realism-pass — candidateRegister validator. */
  if (s.candidateRegister !== undefined) {
    if (
      s.candidateRegister !== "formal"
      && s.candidateRegister !== "casual"
      && s.candidateRegister !== "direct"
      && s.candidateRegister !== "neutral"
    ) {
      throw new Error("state.candidateRegister");
    }
  }
  /* Polish 2 (2026-05-16) — reactiveFollowupsFireLog validator. */
  if (s.reactiveFollowupsFireLog !== undefined) {
    if (
      s.reactiveFollowupsFireLog === null ||
      typeof s.reactiveFollowupsFireLog !== "object" ||
      Array.isArray(s.reactiveFollowupsFireLog)
    ) {
      throw new Error("state.reactiveFollowupsFireLog");
    }
    for (const [k, v] of Object.entries(s.reactiveFollowupsFireLog)) {
      if (typeof k !== "string") throw new Error("state.reactiveFollowupsFireLog.key");
      if (!Array.isArray(v) || !v.every((n) => typeof n === "number" && Number.isFinite(n))) {
        throw new Error("state.reactiveFollowupsFireLog.value");
      }
    }
  }
  /* Fix 1 (2026-05-16) — leversFired ledger validator. */
  if (s.leversFired !== undefined) {
    if (!Array.isArray(s.leversFired) || !s.leversFired.every((v) => typeof v === "string")) {
      throw new Error("state.leversFired");
    }
  }
  /* Bad-faith tactic ledgers validator (2026-05-29). */
  if (s.tacticsUsed !== undefined) {
    if (!Array.isArray(s.tacticsUsed) || !s.tacticsUsed.every((v) => typeof v === "string")) {
      throw new Error("state.tacticsUsed");
    }
  }
  if (s.userCaughtTactics !== undefined) {
    if (!Array.isArray(s.userCaughtTactics) || !s.userCaughtTactics.every((v) => typeof v === "string")) {
      throw new Error("state.userCaughtTactics");
    }
  }
  /* Audit follow-up (2026-05-21) — answeredQuestionLedger validator.
   * Optional for back-compat. When present, every value must be
   * { answerText: string, turn: finite non-neg int }. */
  if (s.answeredQuestionLedger !== undefined) {
    if (
      s.answeredQuestionLedger === null ||
      typeof s.answeredQuestionLedger !== "object" ||
      Array.isArray(s.answeredQuestionLedger)
    ) {
      throw new Error("state.answeredQuestionLedger");
    }
    for (const [k, v] of Object.entries(s.answeredQuestionLedger)) {
      if (typeof k !== "string" || k.length === 0) {
        throw new Error("state.answeredQuestionLedger.key");
      }
      if (!v || typeof v !== "object") throw new Error("state.answeredQuestionLedger.value");
      const entry = v as { answerText?: unknown; turn?: unknown };
      if (typeof entry.answerText !== "string") throw new Error("state.answeredQuestionLedger.answerText");
      if (!isFiniteNonNegInt(entry.turn)) throw new Error("state.answeredQuestionLedger.turn");
    }
    /* DEBT #2 (2026-05-21) — cardinality cap. applyAiMove evicts LRU-
     * by-turn before re-write, so a well-formed state from THIS kernel
     * will never exceed the cap. Reject any payload that does. */
    if (Object.keys(s.answeredQuestionLedger).length > MAX_LEDGER_ENTRIES) {
      throw new Error("state.answeredQuestionLedger.size");
    }
  }
  if (s.hardBandCap !== undefined && typeof s.hardBandCap !== "boolean") throw new Error("state.hardBandCap");
  if (s.marketMode !== undefined && s.marketMode !== "soft" && s.marketMode !== "neutral" && s.marketMode !== "hot") throw new Error("state.marketMode");
  if (
    s.recruiterPersona !== undefined &&
    s.recruiterPersona !== "hardline" &&
    s.recruiterPersona !== "consultative" &&
    s.recruiterPersona !== "founder" &&
    s.recruiterPersona !== "agency"
  ) {
    throw new Error("state.recruiterPersona");
  }
  /* Phase 3 — recruiterSectorPersona validator. Optional for back-compat
   * with in-flight sessions serialised before Phase 3 shipped. */
  if (
    s.recruiterSectorPersona !== undefined &&
    s.recruiterSectorPersona !== "it-services" &&
    s.recruiterSectorPersona !== "gcc" &&
    s.recruiterSectorPersona !== "indian-unicorn" &&
    s.recruiterSectorPersona !== "early-startup" &&
    s.recruiterSectorPersona !== "bfsi" &&
    /* Realism-Audit Fix 1 (2026-05-22) — three new personas. */
    s.recruiterSectorPersona !== "psu" &&
    s.recruiterSectorPersona !== "consulting-big4" &&
    s.recruiterSectorPersona !== "fmcg-management" &&
    /* 2026-05-29 sector-flavor pass — edtech + MBB personas. */
    s.recruiterSectorPersona !== "edtech" &&
    s.recruiterSectorPersona !== "consulting-mbb" &&
    s.recruiterSectorPersona !== "default"
  ) {
    throw new Error("state.recruiterSectorPersona");
  }
  /* 2026-05-29 mood-pass — recruiterMood validator. Optional for
   * back-compat with in-flight sessions and partial-state test
   * fixtures; deserializeState backfills to "warm". */
  if (
    s.recruiterMood !== undefined &&
    s.recruiterMood !== "warm" &&
    s.recruiterMood !== "brusque" &&
    s.recruiterMood !== "frantic"
  ) {
    throw new Error("state.recruiterMood");
  }
  /* 2026-05-30 time-context validator. Optional; deserializeState
   * backfills to "midweek-standard" when absent on serialized state. */
  if (
    s.timeContext !== undefined &&
    s.timeContext !== "monday-fresh" &&
    s.timeContext !== "midweek-standard" &&
    s.timeContext !== "friday-rush" &&
    s.timeContext !== "lunch-distracted" &&
    s.timeContext !== "after-hours-tired" &&
    s.timeContext !== "weekend-unusual"
  ) {
    throw new Error("state.timeContext");
  }
  /* 2026-05-29 mood-shift-pass — recruiterMoodDynamic validator. */
  if (
    s.recruiterMoodDynamic !== undefined &&
    s.recruiterMoodDynamic !== "baseline" &&
    s.recruiterMoodDynamic !== "cooled" &&
    s.recruiterMoodDynamic !== "rewarmed"
  ) {
    throw new Error("state.recruiterMoodDynamic");
  }
  if (s.candidateComponentBreakdown !== undefined) {
    const cb = s.candidateComponentBreakdown as Record<string, unknown>;
    if (!cb || typeof cb !== "object") throw new Error("state.candidateComponentBreakdown");
    for (const k of ["base", "variable", "equity"] as const) {
      if (!isFiniteNumOrNull(cb[k])) throw new Error(`state.candidateComponentBreakdown.${k}`);
    }
    if (typeof cb.hasAny !== "boolean") throw new Error("state.candidateComponentBreakdown.hasAny");
  }
  /* Phase 11–16 optional fields. Tolerate absence on legacy in-flight
     sessions; deserializeState backfills. Reject only malformed
     shapes. Lightweight checks — we don't enum-validate every value,
     just structural shape, because adversarial state authorship is
     already gated by the route auth + idempotency. */
  if (s.hikePercent !== undefined && !isFiniteNumOrNull(s.hikePercent)) {
    throw new Error("state.hikePercent");
  }
  if (s.rationale !== undefined && s.rationale !== null) {
    const r = s.rationale as Record<string, unknown>;
    if (typeof r !== "object" || typeof r.kind !== "string" || typeof r.evidence !== "string") {
      throw new Error("state.rationale");
    }
  }
  if (s.noticeJoining !== undefined) {
    const nj = s.noticeJoining as Record<string, unknown>;
    if (!nj || typeof nj !== "object") throw new Error("state.noticeJoining");
    if (!isFiniteNumOrNull(nj.noticePeriodDays)) throw new Error("state.noticeJoining.noticePeriodDays");
    if (typeof nj.buyoutRequested !== "boolean") throw new Error("state.noticeJoining.buyoutRequested");
    if (!isFiniteNumOrNull(nj.joiningBonusAsk)) throw new Error("state.noticeJoining.joiningBonusAsk");
    if (typeof nj.earlyJoinPreferred !== "boolean") throw new Error("state.noticeJoining.earlyJoinPreferred");
    if (typeof nj.hasAny !== "boolean") throw new Error("state.noticeJoining.hasAny");
  }
  if (s.equityVesting !== undefined) {
    const ev = s.equityVesting as Record<string, unknown>;
    if (!ev || typeof ev !== "object") throw new Error("state.equityVesting");
    if (!isFiniteNumOrNull(ev.vestingYears)) throw new Error("state.equityVesting.vestingYears");
    if (!isFiniteNumOrNull(ev.cliffMonths)) throw new Error("state.equityVesting.cliffMonths");
    if (ev.preference !== null && typeof ev.preference !== "string") throw new Error("state.equityVesting.preference");
    if (ev.familiarity !== null && typeof ev.familiarity !== "string") throw new Error("state.equityVesting.familiarity");
    if (typeof ev.hasAny !== "boolean") throw new Error("state.equityVesting.hasAny");
  }
  if (s.locationMode !== undefined) {
    const lm = s.locationMode as Record<string, unknown>;
    if (!lm || typeof lm !== "object") throw new Error("state.locationMode");
    if (lm.workMode !== null && typeof lm.workMode !== "string") throw new Error("state.locationMode.workMode");
    if (lm.locationCity !== null && typeof lm.locationCity !== "string") throw new Error("state.locationMode.locationCity");
    if (typeof lm.relocationRequested !== "boolean") throw new Error("state.locationMode.relocationRequested");
    if (typeof lm.relocationRefused !== "boolean") throw new Error("state.locationMode.relocationRefused");
    if (typeof lm.hasAny !== "boolean") throw new Error("state.locationMode.hasAny");
  }
  if (s.competingOfferDetail !== undefined) {
    const co = s.competingOfferDetail as Record<string, unknown>;
    if (!co || typeof co !== "object") throw new Error("state.competingOfferDetail");
    if (co.company !== null && typeof co.company !== "string") throw new Error("state.competingOfferDetail.company");
    if (co.status !== null && typeof co.status !== "string") throw new Error("state.competingOfferDetail.status");
    if (co.stage !== null && typeof co.stage !== "string") throw new Error("state.competingOfferDetail.stage");
    if (typeof co.letterShareOffered !== "boolean") throw new Error("state.competingOfferDetail.letterShareOffered");
    /* fake-leverage-challenge (2026-05-17) — proofRequestedAtTurn /
     * proofProvided are optional on legacy serialized snapshots;
     * deserializeState backfills via backfillCompetingOfferDetail.
     * Validate shape only when present. */
    if (
      co.proofRequestedAtTurn !== undefined &&
      co.proofRequestedAtTurn !== null &&
      !isFiniteNonNegInt(co.proofRequestedAtTurn)
    ) {
      throw new Error("state.competingOfferDetail.proofRequestedAtTurn");
    }
    if (
      co.proofProvided !== undefined &&
      typeof co.proofProvided !== "boolean"
    ) {
      throw new Error("state.competingOfferDetail.proofProvided");
    }
    /* fake-leverage-challenge (2026-05-17) — amount is optional on
     * legacy serialized snapshots; backfilled to null by the
     * backfillCompetingOfferDetail folder. Shape-check when present. */
    if (
      co.amount !== undefined &&
      co.amount !== null &&
      (typeof co.amount !== "number" || !Number.isFinite(co.amount))
    ) {
      throw new Error("state.competingOfferDetail.amount");
    }
    if (typeof co.hasAny !== "boolean") throw new Error("state.competingOfferDetail.hasAny");
  }
  /* Phase 17 optional fields — structural shape checks only. */
  if (s.decisionDeadline !== undefined) {
    const dd = s.decisionDeadline as Record<string, unknown>;
    if (!dd || typeof dd !== "object") throw new Error("state.decisionDeadline");
    if (!isFiniteNumOrNull(dd.deadlineDays)) throw new Error("state.decisionDeadline.deadlineDays");
    if (typeof dd.deadlineExplicit !== "boolean") throw new Error("state.decisionDeadline.deadlineExplicit");
    if (typeof dd.conditionalAcceptance !== "boolean") throw new Error("state.decisionDeadline.conditionalAcceptance");
    if (dd.conditionalEvidence !== null && typeof dd.conditionalEvidence !== "string") throw new Error("state.decisionDeadline.conditionalEvidence");
    if (typeof dd.hasAny !== "boolean") throw new Error("state.decisionDeadline.hasAny");
  }
  /* Phase 29 — role-applicable YOE. All three optional + null-tolerant
   * for back-compat with in-flight sessions. */
  if (s.candidateTotalYoe !== undefined && !isFiniteNumOrNull(s.candidateTotalYoe)) {
    throw new Error("state.candidateTotalYoe");
  }
  if (s.candidateApplicableYoe !== undefined && !isFiniteNumOrNull(s.candidateApplicableYoe)) {
    throw new Error("state.candidateApplicableYoe");
  }
  if (
    s.candidatePrimaryDomain !== undefined &&
    s.candidatePrimaryDomain !== null &&
    typeof s.candidatePrimaryDomain !== "string"
  ) {
    throw new Error("state.candidatePrimaryDomain");
  }
  if (s.candidateProfile !== undefined) {
    const cp = s.candidateProfile as Record<string, unknown>;
    if (!cp || typeof cp !== "object") throw new Error("state.candidateProfile");
    if (!isFiniteNumOrNull(cp.careerGapMonths)) throw new Error("state.candidateProfile.careerGapMonths");
    if (cp.careerGapActivity !== null && typeof cp.careerGapActivity !== "string") throw new Error("state.candidateProfile.careerGapActivity");
    if (cp.tenureSignal !== null && typeof cp.tenureSignal !== "string") throw new Error("state.candidateProfile.tenureSignal");
    if (cp.levelMismatch !== null && typeof cp.levelMismatch !== "string") throw new Error("state.candidateProfile.levelMismatch");
    if (typeof cp.hasAny !== "boolean") throw new Error("state.candidateProfile.hasAny");
  }
  if (s.miscSignals !== undefined) {
    const ms = s.miscSignals as Record<string, unknown>;
    if (!ms || typeof ms !== "object") throw new Error("state.miscSignals");
    if (!isFiniteNumOrNull(ms.candidateFloor)) throw new Error("state.miscSignals.candidateFloor");
    if (!isFiniteNumOrNull(ms.salaryReviewMonths)) throw new Error("state.miscSignals.salaryReviewMonths");
    if (ms.proofOfCtcShareable !== null && typeof ms.proofOfCtcShareable !== "boolean") throw new Error("state.miscSignals.proofOfCtcShareable");
    if (ms.internalCounterRisk !== null && typeof ms.internalCounterRisk !== "string") throw new Error("state.miscSignals.internalCounterRisk");
    if (typeof ms.hasAny !== "boolean") throw new Error("state.miscSignals.hasAny");
  }
  /* Phase 18 — candidate stance. Optional for backwards-compat. */
  if (s.candidateStance !== undefined) {
    const cs = s.candidateStance as Record<string, unknown>;
    if (!cs || typeof cs !== "object") throw new Error("state.candidateStance");
    if (cs.flexibilityPosture !== null && typeof cs.flexibilityPosture !== "string") {
      throw new Error("state.candidateStance.flexibilityPosture");
    }
    for (const k of ["marketReferenceVague", "salaryOnlyFactor", "badmouthsCurrent", "confidentialOvershare", "soundsDesperate", "treatsEquityAsCash", "hasAny"] as const) {
      if (typeof cs[k] !== "boolean") throw new Error(`state.candidateStance.${k}`);
    }
    /* Phase 19 — corpus-derived stance booleans. Optional for back-compat. */
    for (const k of ["avoidsAnchor", "personalExpenseJustification", "offerShoppingDemand", "dismissesVariableRisk", "overpromisesJoining"] as const) {
      if (cs[k] !== undefined && typeof cs[k] !== "boolean") throw new Error(`state.candidateStance.${k}`);
    }
  }
  /* Bug 7 — recruiter-facts-already-said. Optional + string array. */
  if (s.recruiterFactsAlreadySaid !== undefined) {
    if (!Array.isArray(s.recruiterFactsAlreadySaid) || !s.recruiterFactsAlreadySaid.every((v) => typeof v === "string")) {
      throw new Error("state.recruiterFactsAlreadySaid");
    }
  }
  /* Fix 3 (2026-05-15) — pendingPromises optional + string array. */
  if (s.pendingPromises !== undefined) {
    if (!Array.isArray(s.pendingPromises) || !s.pendingPromises.every((v) => typeof v === "string")) {
      throw new Error("state.pendingPromises");
    }
  }
  /* Fix 4 (2026-05-15) — lastBotReply optional + string-or-null. */
  if (s.lastBotReply !== undefined && s.lastBotReply !== null && typeof s.lastBotReply !== "string") {
    throw new Error("state.lastBotReply");
  }
  /* Fix 7 (2026-05-15) — anchorLocked optional boolean, lockedAnchorLpa optional number-or-null. */
  if (s.anchorLocked !== undefined && typeof s.anchorLocked !== "boolean") {
    throw new Error("state.anchorLocked");
  }
  if (
    s.lockedAnchorLpa !== undefined &&
    s.lockedAnchorLpa !== null &&
    (typeof s.lockedAnchorLpa !== "number" || !Number.isFinite(s.lockedAnchorLpa))
  ) {
    throw new Error("state.lockedAnchorLpa");
  }
  /* Fix 3 (PDF #17 follow-up, 2026-05-15) — minTurnsBeforeClose optional number. */
  if (
    s.minTurnsBeforeClose !== undefined &&
    (typeof s.minTurnsBeforeClose !== "number" || !Number.isFinite(s.minTurnsBeforeClose) || s.minTurnsBeforeClose < 0)
  ) {
    throw new Error("state.minTurnsBeforeClose");
  }
  /* PDF #17 architectural fix (2026-05-15) — discoveryChecklist
   * optional; when present every key must be boolean. */
  if (s.discoveryChecklist !== undefined) {
    const dc = s.discoveryChecklist as Record<string, unknown>;
    if (!dc || typeof dc !== "object") throw new Error("state.discoveryChecklist");
    const keys: (keyof DiscoveryChecklist)[] = [
      "currentCtcAsked", "currentCtcAnswered",
      "fixedVariableSplitAsked", "fixedVariableSplitAnswered",
      "noticePeriodAsked", "noticePeriodAnswered",
      "competingOffersAsked", "competingOffersAnswered",
      "valueProofAsked", "valueProofAnswered",
      "targetAsked", "targetAnswered",
      "variableComfortTested", "commitmentValidationAsked",
      "currentCtcFixedVariableSplitDisclosed",
      "expectedCtcFixedVariableSplitDisclosed",
    ];
    for (const k of keys) {
      if (dc[k] !== undefined && typeof dc[k] !== "boolean") {
        throw new Error(`state.discoveryChecklist.${k}`);
      }
    }
  }
  if (s.discoveryStage !== undefined && !isValidDiscoveryStage(s.discoveryStage)) {
    throw new Error("state.discoveryStage");
  }
  /* Prompt-injection defense ledger (2026-05-17) — optional for
     back-compat with sessions serialized before this field shipped.
     When present must be an array of { atTurn, patterns, originalLength,
     sanitizedLength }. */
  if (s.promptInjectionAttempts !== undefined) {
    if (!Array.isArray(s.promptInjectionAttempts)) {
      throw new Error("state.promptInjectionAttempts");
    }
    for (const entry of s.promptInjectionAttempts) {
      if (!entry || typeof entry !== "object") {
        throw new Error("state.promptInjectionAttempts[].shape");
      }
      const e = entry as Record<string, unknown>;
      if (!isFiniteNonNegInt(e.atTurn)) {
        throw new Error("state.promptInjectionAttempts[].atTurn");
      }
      if (!Array.isArray(e.patterns) || !e.patterns.every((p) => typeof p === "string")) {
        throw new Error("state.promptInjectionAttempts[].patterns");
      }
      if (!isFiniteNonNegInt(e.originalLength)) {
        throw new Error("state.promptInjectionAttempts[].originalLength");
      }
      if (!isFiniteNonNegInt(e.sanitizedLength)) {
        throw new Error("state.promptInjectionAttempts[].sanitizedLength");
      }
    }
  }
  /* conversationLog: optional for backwards compat with in-flight
     sessions; when present, every entry must have speaker ∈ {ai, candidate}
     and a string text. */
  if (s.conversationLog !== undefined) {
    if (!Array.isArray(s.conversationLog)) throw new Error("state.conversationLog");
    for (const e of s.conversationLog) {
      const entry = e as Record<string, unknown>;
      if (!entry || typeof entry !== "object") throw new Error("state.conversationLog entry");
      if (entry.speaker !== "ai" && entry.speaker !== "candidate") throw new Error("state.conversationLog.speaker");
      if (typeof entry.text !== "string") throw new Error("state.conversationLog.text");
    }
  }
}

export function deserializeState(json: string): NegotiationState {
  const parsed: unknown = JSON.parse(json);
  /* Audit follow-up (2026-05-21) — wire-format version check. Refuse
   * payloads with __v ABOVE the kernel's current KERNEL_STATE_VERSION:
   * that means the client is running a newer kernel and the server
   * has been rolled back / lags behind. Failing loudly here prevents
   * the back-compat backfill chain from silently coercing a
   * future-shape payload into the legacy default values. Payloads
   * with NO __v (legacy in-flight sessions) and with __v ≤ current
   * are accepted as before.
   *
   * DEBT #3 (2026-05-21) — capture __v into a local BEFORE deletion so
   * a future migration hook (e.g. "if wireVersion < 2, migrate field X")
   * can branch on the original wire version. At KERNEL_STATE_VERSION=1
   * the value is unused beyond the bounds check, but exposing it now
   * means the migration scaffolding is already in place when it's
   * actually needed. The local is named (not just left in place on
   * parsed) so the backfill chain below can still run against a
   * __v-stripped payload — validateState would otherwise reject the
   * reserved key as an unknown field. */
  let wireVersion: number | undefined;
  if (parsed && typeof parsed === "object") {
    const rawV = (parsed as { __v?: unknown }).__v;
    if (rawV !== undefined) {
      if (typeof rawV !== "number" || !Number.isFinite(rawV)) {
        throw new Error(`state.__v: expected finite number, got ${typeof rawV}`);
      }
      if (rawV > KERNEL_STATE_VERSION) {
        throw new Error(
          `state.__v=${rawV} exceeds server KERNEL_STATE_VERSION=${KERNEL_STATE_VERSION} ` +
            `(client is newer than server — refusing rather than coercing)`,
        );
      }
      wireVersion = rawV;
      /* Strip __v before downstream validators run. The version marker
       * is wire-only metadata; it is NOT a field on NegotiationState
       * so leaving it in would trip strict shape checks elsewhere. */
      delete (parsed as { __v?: unknown }).__v;
    }
  }
  /* Future migration hooks read `wireVersion` here. Intentionally
   * referenced (no-op) so the linter doesn't strip the local — the
   * value is part of the contract for the next kernel bump. */
  void wireVersion;
  validateState(parsed);
  /* Backfill defaults for optional fields added after the wire format
     was first deployed. Existing in-flight sessions serialized without
     these keys; we default them on read so the rest of the kernel can
     assume they exist. */
  const s = parsed as NegotiationState & Partial<Record<string, unknown>>;
  return {
    ...parsed,
    candidateAskedAsRange: s.candidateAskedAsRange ?? false,
    /* Audit Pass 3 / Fix 1 (2026-05-16) — backfill stalemate ledger
     * for in-flight sessions serialized before this field shipped. */
    stalemateAtTurn: (s.stalemateAtTurn as number | null | undefined) ?? null,
    /* Phase 3 missing-lever set (2026-05-17) — backfill single-fire turn
     * markers for sessions serialized before this field shipped. */
    panelApprovalStallFiredAtTurn:
      (s.panelApprovalStallFiredAtTurn as number | null | undefined) ?? null,
    politeWalkawayFiredAtTurn:
      (s.politeWalkawayFiredAtTurn as number | null | undefined) ?? null,
    hikeStrongDefenseFiredAtTurn:
      (s.hikeStrongDefenseFiredAtTurn as number | null | undefined) ?? null,
    fakeLeverageChallengeFiredAtTurn:
      (s.fakeLeverageChallengeFiredAtTurn as number | null | undefined) ?? null,
    competitorMatchFiredAtTurn:
      (s.competitorMatchFiredAtTurn as number | null | undefined) ?? null,
    ctcInflationAnchorCtcLpa:
      (s.ctcInflationAnchorCtcLpa as number | null | undefined) ?? null,
    firstAnchoredTarget:
      typeof s.firstAnchoredTarget === "number"
        ? s.firstAnchoredTarget
        : (s.candidateTarget as number | null) ?? null,
    finalOfferAssertedCount: s.finalOfferAssertedCount ?? 0,
    vossTacticsUsed: (s.vossTacticsUsed as VossTactic[] | undefined) ?? [],
    infoAsked: (s.infoAsked as InfoIntent[] | undefined) ?? [],
    verbalAcceptanceTurn: s.verbalAcceptanceTurn ?? null,
    postAcceptanceDocsRequestedAtTurn:
      (s.postAcceptanceDocsRequestedAtTurn as number | null | undefined) ?? null,
    postVerbalRenegotiationCount: (s.postVerbalRenegotiationCount as number | undefined) ?? 0,
    counterRound: (s.counterRound as number | undefined) ?? 0,
    recentRecoveryActive: (s.recentRecoveryActive as boolean | undefined) ?? false,
    walkAwayReturned: s.walkAwayReturned ?? false,
    hardBandCap: s.hardBandCap ?? false,
    marketMode: (s.marketMode as MarketMode | undefined) ?? "neutral",
    recruiterPersona: (s.recruiterPersona as RecruiterPersona | undefined) ?? "consultative",
    /* Phase 3 — sector-persona back-compat: in-flight sessions
     * serialised before Phase 3 shipped get "default", which renders
     * the legacy prose surfaces (no persona-conditional overrides). */
    recruiterSectorPersona:
      (s.recruiterSectorPersona as RecruiterSectorPersona | undefined) ?? "default",
    /* 2026-05-29 mood-pass — back-compat: legacy sessions get "warm"
     * (current behaviour). New sessions overwrite at initState. */
    recruiterMood:
      (s.recruiterMood as RecruiterMood | undefined) ?? "warm",
    /* 2026-05-30 time-context — back-compat: serialized state from before
     * this field shipped defaults to "midweek-standard" (no-op). */
    timeContext:
      (s.timeContext as TimeContext | undefined) ?? "midweek-standard",
    /* 2026-05-29 mood-shift-pass — backfill defaults preserve
     * baseline behaviour for legacy sessions. */
    recruiterMoodDynamic:
      (s.recruiterMoodDynamic as RecruiterMoodDynamic | undefined) ?? "baseline",
    recruiterMoodDynamicEnteredAtTurn:
      (s.recruiterMoodDynamicEnteredAtTurn as number | null | undefined) ?? null,
    consecutiveOverBandAsks:
      (s.consecutiveOverBandAsks as number | undefined) ?? 0,
    recruiterMoodColdLineFiredAtTurn:
      (s.recruiterMoodColdLineFiredAtTurn as number | null | undefined) ?? null,
    recruiterMoodRewarmLineFiredAtTurn:
      (s.recruiterMoodRewarmLineFiredAtTurn as number | null | undefined) ?? null,
    recruiterMoodPeakCandidateAskLpa:
      (s.recruiterMoodPeakCandidateAskLpa as number | null | undefined) ?? null,
    /* Realism-Audit Fix 3 (2026-05-22) — manager-consult stall state.
     * In-flight sessions serialised before this fix shipped backfill
     * to 0 / null so the planner gate treats them as "no stall in
     * flight, none fired yet". */
    stallTurnsRemaining: (s.stallTurnsRemaining as number | undefined) ?? 0,
    stallsFiredCount: (s.stallsFiredCount as number | undefined) ?? 0,
    lastStallContext:
      (s.lastStallContext as NegotiationState["lastStallContext"] | undefined) ?? null,
    conversationLog: (s.conversationLog as NegotiationState["conversationLog"] | undefined) ?? [],
    candidateComponentBreakdown: (s.candidateComponentBreakdown as ComponentBreakdown | undefined)
      ?? { base: null, variable: null, equity: null, hasAny: false },
    hikePercent: (s.hikePercent as number | null | undefined) ?? null,
    rationale: (s.rationale as RationaleResult | null | undefined) ?? null,
    noticeJoining: backfillNoticeJoining(s.noticeJoining),
    equityVesting: backfillEquityVesting(s.equityVesting),
    locationMode: (s.locationMode as LocationModeResult | undefined) ?? {
      workMode: null, locationCity: null, relocationRequested: false, relocationRefused: false, hasAny: false,
    },
    competingOfferDetail: backfillCompetingOfferDetail(s.competingOfferDetail),
    decisionDeadline: (s.decisionDeadline as DecisionDeadlineResult | undefined) ?? {
      deadlineDays: null, deadlineExplicit: false, conditionalAcceptance: false, conditionalEvidence: null, hasAny: false,
    },
    candidateProfile: backfillCandidateProfile(s.candidateProfile),
    miscSignals: (s.miscSignals as MiscSignalsResult | undefined) ?? {
      candidateFloor: null, salaryReviewMonths: null, proofOfCtcShareable: null, internalCounterRisk: null, hasAny: false,
    },
    candidateStance: backfillCandidateStance(s.candidateStance),
    lastJoiningBonusOffered: (s.lastJoiningBonusOffered as number | null | undefined) ?? null,
    salesOTE: (s.salesOTE as SalesOTEResult | undefined) ?? { ...EMPTY_SALES_OTE },
    contractRate: (s.contractRate as ContractRateResult | undefined) ?? { ...EMPTY_CONTRACT_RATE },
    retentionCounter: (s.retentionCounter as RetentionCounterResult | undefined) ?? { ...EMPTY_RETENTION_COUNTER },
    /* Phase 29 — role-applicable YOE. Optional for back-compat with
     * in-flight sessions serialized before this field shipped. */
    candidateTotalYoe: (s.candidateTotalYoe as number | null | undefined) ?? null,
    candidateApplicableYoe: (s.candidateApplicableYoe as number | null | undefined) ?? null,
    candidatePrimaryDomain: (s.candidatePrimaryDomain as string | null | undefined) ?? null,
    freshGradDisclosed: (s.freshGradDisclosed as boolean | undefined) ?? false,
    recruiterFactsAlreadySaid: (s.recruiterFactsAlreadySaid as string[] | undefined) ?? [],
    /* Audit follow-up (2026-05-21) — answeredQuestionLedger back-compat
     * default. In-flight sessions serialized before this field shipped
     * deserialise with an empty ledger; the cross-turn coherence
     * short-circuit becomes inert until the next answered question
     * populates it. */
    answeredQuestionLedger:
      (s.answeredQuestionLedger as NegotiationState["answeredQuestionLedger"]) ?? {},
    pendingPromises: (s.pendingPromises as string[] | undefined) ?? [],
    lastBotReply: (s.lastBotReply as string | null | undefined) ?? null,
    anchorLocked: (s.anchorLocked as boolean | undefined) ?? false,
    lockedAnchorLpa: (s.lockedAnchorLpa as number | null | undefined) ?? null,
    /* Fix 3 (PDF #17 follow-up, 2026-05-15) — premature-close guard. */
    minTurnsBeforeClose: (s.minTurnsBeforeClose as number | undefined) ?? 8,
    /* PDF #17 architectural fix (2026-05-15) — discovery-first state
     * machine fields. Optional for back-compat with in-flight sessions. */
    discoveryChecklist: backfillDiscoveryChecklist(s.discoveryChecklist),
    discoveryStage: (s.discoveryStage as DiscoveryStage | undefined) ?? "discovery",
    /* Bug-report 12 (2026-05-14) — per-turn fresh-counter signal.
     * Optional for back-compat; defaults to null (treat in-flight
     * sessions as if no fresh counter has been parsed). */
    lastCandidateCounterLpa: (s.lastCandidateCounterLpa as number | null | undefined) ?? null,
    /* PDF #18 (2026-05-15) — candidate-disclosure acks. Optional; omit
     * when empty to keep serialized wire size small. */
    pendingCandidateAcks: (s.pendingCandidateAcks as NegotiationState["pendingCandidateAcks"]) ?? undefined,
    /* Negotiation-flow redesign commit 4 (2026-05-15) — reactive-followup
     * ledger. Sticky across the session (never cleared by applyAiMove).
     * Optional for back-compat with sessions serialized before commit 4. */
    reactiveFollowupsFired:
      (s.reactiveFollowupsFired as DiscoveryTopic[] | undefined) ?? [],
    /* 2026-05-29 realism-pass — candidateQuestionServeCount back-compat
     * default. Pre-realism-pass sessions deserialise with an empty map. */
    candidateQuestionServeCount:
      (s.candidateQuestionServeCount as Partial<Record<string, number>> | undefined) ?? {},
    /* 2026-05-29 realism-pass — candidateRegister back-compat default.
     * Pre-realism-pass sessions deserialise as neutral; first candidate
     * turn after resume recomputes. */
    candidateRegister:
      (s.candidateRegister as NegotiationState["candidateRegister"]) ?? "neutral",
    /* Polish 2 (2026-05-16) — per-topic fire-history. Back-compat
     * default = empty record. */
    reactiveFollowupsFireLog:
      (s.reactiveFollowupsFireLog as Partial<Record<DiscoveryTopic, number[]>> | undefined) ?? {},
    /* Fix 1 (2026-05-16) — leversFired back-compat default. */
    leversFired: (s.leversFired as string[] | undefined) ?? [],
    /* ResumeFactPack track (2026-05-16) — back-compat default. Existing
     * in-flight sessions serialized before this field shipped get null,
     * which the credibility-probe and prior-CTC floor levers treat as
     * "no resume context" (inert). */
    resumeFactPack: (s.resumeFactPack as ResumeFactPack | null | undefined) ?? null,
    impliedPriorCtcFromResume:
      (s.impliedPriorCtcFromResume as number | null | undefined) ?? null,
    flagProvenance:
      (s.flagProvenance as Record<string, "resume" | "stated"> | undefined) ?? {},
    candidateStatedCurrentCompany:
      (s.candidateStatedCurrentCompany as string | null | undefined) ?? null,
    credibilityProbeFired:
      (s.credibilityProbeFired as boolean | undefined) ?? false,
    credibilityProbeAvoidedAt:
      (s.credibilityProbeAvoidedAt as number | null | undefined) ?? null,
    /* Prompt-injection defense ledger back-compat default. Sessions
     * serialized before this field shipped deserialize with an empty
     * ledger. */
    promptInjectionAttempts:
      (s.promptInjectionAttempts as NegotiationState["promptInjectionAttempts"] | undefined) ?? [],
    /* Phase 5 Session A (2026-05-19) — multi-round persona switch.
     * Back-compat: legacy sessions serialised before this field shipped
     * deserialise as single-round (multiRoundEnabled=false), with empty
     * transitions and roundIndex=0. `roundPersona` stays undefined so
     * downstream consumers treat the session as legacy. */
    multiRoundEnabled: (s.multiRoundEnabled as boolean | undefined) ?? false,
    roundPersona: (s.roundPersona as NegotiationRoundPersona | undefined) ?? undefined,
    roundIndex: ((s.roundIndex as 0 | 1 | 2 | undefined) ?? 0),
    roundTransitions:
      (s.roundTransitions as NegotiationState["roundTransitions"] | undefined) ?? [],
    perRoundBand: (s.perRoundBand as NegotiationState["perRoundBand"]) ?? undefined,
    /* Affinity-dynamic feature (2026-05-29) — back-compat defaults. */
    recruiterAffinity: (s.recruiterAffinity as number | undefined) ?? 0,
    affinityLedger:
      (s.affinityLedger as AffinityLedgerEntry[] | undefined) ?? [],
    /* Paraphrase-loop feature (2026-05-29) — back-compat default. */
    paraphraseFired: (s.paraphraseFired as boolean | undefined) ?? false,
    paraphraseCorrections:
      (s.paraphraseCorrections as NegotiationState["paraphraseCorrections"]) ?? [],
    /* Calibrated-surprise lowball feature (2026-05-29) — back-compat
     * defaults. Legacy sessions deserialise with the probe never having
     * fired and no acceptance-of-lowball flag set. */
    calibratedSurpriseFired:
      (s.calibratedSurpriseFired as boolean | undefined) ?? false,
    calibratedSurpriseContext:
      (s.calibratedSurpriseContext as NegotiationState["calibratedSurpriseContext"]) ?? null,
    acceptedLowball: (s.acceptedLowball as boolean | undefined) ?? false,
    acceptLowballQuietFiredAtTurn:
      (s.acceptLowballQuietFiredAtTurn as number | null | undefined) ?? null,
    /* Proactive-sweetener feature (2026-05-30) — back-compat defaults.
     * Legacy sessions deserialise as never-fired with no sweetener
     * kind. */
    proactiveSweetenerFired:
      (s.proactiveSweetenerFired as boolean | undefined) ?? false,
    proactiveSweetenerKind:
      (s.proactiveSweetenerKind as NegotiationState["proactiveSweetenerKind"]) ?? undefined,
    /* Recruiter-power-dynamics feature (2026-05-29) — back-compat
     * defaults preserve identity behaviour for legacy sessions. */
    recruiterPower: (s.recruiterPower as number | undefined) ?? 0,
    powerSignals: (s.powerSignals as PowerSignals | undefined) ?? {},
  };
}

/* Phase 27 — competingOfferDetail.onHold was added after the wire format
 * first deployed. Legacy in-flight sessions serialized this without the
 * onHold key; backfill it. */
function backfillCompetingOfferDetail(raw: unknown): CompetingOfferDetail {
  const v = raw as Partial<CompetingOfferDetail> | undefined;
  return {
    company: v?.company ?? null,
    status: v?.status ?? null,
    stage: v?.stage ?? null,
    letterShareOffered: v?.letterShareOffered ?? false,
    onHold: v?.onHold ?? false,
    /* fake-leverage-challenge (2026-05-17) — backfill the two new
     * proof-tracking fields for legacy in-flight sessions. */
    proofRequestedAtTurn: v?.proofRequestedAtTurn ?? null,
    proofProvided: v?.proofProvided ?? false,
    /* fake-leverage-challenge (2026-05-17) — backfill accumulated
     * amount for legacy in-flight sessions serialized before the field
     * shipped. */
    amount: v?.amount ?? null,
    hasAny: v?.hasAny ?? false,
  };
}

/* Phase 25b — domainPivot / transferableSkillsClaimed / compensationHistoryIssue
 * were added after the wire format first deployed. Legacy in-flight
 * sessions serialized candidateProfile without these keys; backfill them.
 * Uses EMPTY_CANDIDATE_PROFILE spread so new wave flags are always present.
 *
 * Backcompat: the following flags were pruned in commit "perfect 6" but
 * old persisted snapshots may carry them. Silently dropped via the
 * known-keys filter below (raw entries whose key is not in the current
 * EMPTY_CANDIDATE_PROFILE shape are discarded):
 *   prefersEquityOverCash, hasVestingCliff, rsuVestingAware, esopHolder,
 *   riskAverse, prefersMnc, prefersStartup, openToRelocation, remotePref,
 *   likelyToCounter, acceptedFirstOffer, hasWalkedAway, anchorsHigh,
 *   softOnRange, noticePeriodFlexible, joiningUrgency, isIcToManager,
 *   hasLeadershipExperience, domainSpecialist, multipleCompaniesInTwoYears,
 *   currentHasBonus, currentBonusPct, currentHasEsop, currentEsopVested,
 *   currentHasRetentionBonus, currentHasGratuity, currentHasNps,
 *   wantsHigherBonus, wantsFlexibleWork, wantsLearningBudget,
 *   wantsEquityRefresh, wantsProfessionalTitle, hasSeenOffer,
 *   offerDeadlineMentioned, offerDeadlineText, negotiatingMultipleOffers,
 *   prefersCashOverPerks, perksImportant, anchoredFirst, anchorWasHighball,
 *   retreatedFromAnchor, acceptedCounterQuickly, respondedToBudgetCeiling,
 *   pushedBackOnCeiling, expressedUrgency, expressedHesitation,
 *   usedRecruiterName, saidThankYou, askedAboutTeam, askedAboutWorkLifeBalance,
 *   dramaticAnchorJump, mentionedCounterOffer, mentionedLayoffRisk,
 *   seemsRushed, firstOfferReaction, explicitlyRejectedOffer,
 *   askedForTimeToDecide, mentionedRelocation, mentionedPf, mentionedGratuity,
 *   mentionedVariablePayout, mentionedSigningBonus, mentionedRetentionBonus,
 *   mentionedJoiningBonus, askedAboutPerformanceCycle, mentionedTargetRole,
 *   competingOfferIsVerbal, competingOfferCompany, competingOfferDeadline,
 *   showedFrustration, showedExcitement, usedSilence,
 *   backtrackedOnExpectation, escalatedDemand, mentionedRelievingLetterRisk,
 *   mentionedNoticeWaiver, mentionedNoticeBuyout, isFirstJobChange,
 *   hasManagementExperience, mentionedStartupExperience,
 *   mentionedMncExperience, hasPhdOrMba, usedAnchorFirst, mentionedCostOfLiving,
 *   wantsHigherBase (kept as live), wantsRelocationAllowance (kept as live),
 *   wantsJoiningBonus (kept as live).
 */
function backfillCandidateProfile(raw: unknown): CandidateProfileResult {
  const v = raw as Partial<CandidateProfileResult> | undefined;
  /* Spread EMPTY first so every required field has a default, then overlay
   * whatever the legacy payload carried (undefined values from the partial
   * are filtered out so they don't overwrite the defaults). Pruned-flag
   * keys present in the raw payload but no longer in EMPTY_CANDIDATE_PROFILE
   * are silently dropped via the known-keys filter — see backcompat note
   * above. */
  const knownKeys = new Set(Object.keys(EMPTY_CANDIDATE_PROFILE));
  const defined = Object.fromEntries(
    Object.entries(v ?? {}).filter(
      ([k, val]) => val !== undefined && knownKeys.has(k),
    ),
  ) as Partial<CandidateProfileResult>;
  return { ...EMPTY_CANDIDATE_PROFILE, ...defined };
}

/* Phase 19 — corpus-derived stance fields were added after the wire
 * format first deployed. Legacy in-flight sessions serialized
 * candidateStance without these keys; backfill them. */
function backfillCandidateStance(raw: unknown): CandidateStanceResult {
  const v = raw as Partial<CandidateStanceResult> | undefined;
  return {
    flexibilityPosture: v?.flexibilityPosture ?? null,
    marketReferenceVague: v?.marketReferenceVague ?? false,
    salaryOnlyFactor: v?.salaryOnlyFactor ?? false,
    badmouthsCurrent: v?.badmouthsCurrent ?? false,
    confidentialOvershare: v?.confidentialOvershare ?? false,
    soundsDesperate: v?.soundsDesperate ?? false,
    treatsEquityAsCash: v?.treatsEquityAsCash ?? false,
    avoidsAnchor: v?.avoidsAnchor ?? false,
    personalExpenseJustification: v?.personalExpenseJustification ?? false,
    offerShoppingDemand: v?.offerShoppingDemand ?? false,
    dismissesVariableRisk: v?.dismissesVariableRisk ?? false,
    overpromisesJoining: v?.overpromisesJoining ?? false,
    complainedAboutHikePercent: v?.complainedAboutHikePercent ?? false,
    stallSignal: v?.stallSignal ?? null,
    hasAny: v?.hasAny ?? false,
  };
}

/* Phase 17D — joiningBonusClawbackDiscussed + lastWorkingDayText were
 * added after the wire format first deployed. Legacy in-flight sessions
 * serialized noticeJoining without these keys; backfill them. */
function backfillNoticeJoining(raw: unknown): NoticeJoiningResult {
  const v = raw as Partial<NoticeJoiningResult> | undefined;
  return {
    noticePeriodDays: v?.noticePeriodDays ?? null,
    buyoutRequested: v?.buyoutRequested ?? false,
    joiningBonusAsk: v?.joiningBonusAsk ?? null,
    earlyJoinPreferred: v?.earlyJoinPreferred ?? false,
    joiningBonusClawbackDiscussed: v?.joiningBonusClawbackDiscussed ?? false,
    lastWorkingDayText: v?.lastWorkingDayText ?? null,
    hasAny: v?.hasAny ?? false,
  };
}

/* Phase 17E — strikePriceDiscussed / valuationDiscussed /
 * liquidityDiscussed were added after the wire format first deployed.
 * Legacy in-flight sessions serialized equityVesting without these
 * keys; backfill them. */
function backfillEquityVesting(raw: unknown): EquityVestingResult {
  const v = raw as Partial<EquityVestingResult> | undefined;
  return {
    vestingYears: v?.vestingYears ?? null,
    cliffMonths: v?.cliffMonths ?? null,
    preference: v?.preference ?? null,
    familiarity: v?.familiarity ?? null,
    strikePriceDiscussed: v?.strikePriceDiscussed ?? false,
    valuationDiscussed: v?.valuationDiscussed ?? false,
    liquidityDiscussed: v?.liquidityDiscussed ?? false,
    /* PDF#31 BUG A+B (2026-05-18) — backfill for sessions serialized
     * before the equityExists field existed. */
    equityExists: v?.equityExists ?? null,
    hasAny: v?.hasAny ?? false,
  };
}
