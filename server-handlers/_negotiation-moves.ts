/* Negotiation kernel: phase derivation, AI move selection, and applying an AI move. */

import { type NegotiationPhase, canTransitionPhase, isTerminalPhase, type NegotiationLever, type DiscoveryTopic, isDiscoveryTopic } from "./_negotiation-vocab";
import type { NegotiationState } from "./_negotiation-state-types";
import { isDiscoveryComplete } from "./_discovery-stage";
import { classifyRoleFamily } from "./_company-band-tiers";
import { statedTotalTargetCtcLpa, maybeAdvanceRound } from "./_negotiation-factory";
import type { QuestionIntent } from "./_question-intent";
import { recordAskedTopic } from "./_conversation-ledger";
import { extractRecruiterFacts, extractPromisesFulfilled, extractRecruiterPromises } from "./_recruiter-facts";
import { detectRangeDisclosure } from "./_trial-close-detector";
import { pruneAcknowledged } from "./_candidate-disclosure-tracker";

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
export const MAX_TURNS_PER_PHASE = {
  discovery: 5,
  anchoring: 3,
  counter: 4,
} as const;

export const DISCOVERY_PHASES: ReadonlySet<NegotiationPhase> = new Set([
  "opening",
  "range-disclosure",
]);
export const ANCHORING_PHASES: ReadonlySet<NegotiationPhase> = new Set([
  "offer-presented",
  "probe-expectations",
]);
export const COUNTER_PHASES: ReadonlySet<NegotiationPhase> = new Set([
  "counter-offer",
  "lever-explore",
  "closing-push",
]);

export function phaseGroupOf(
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
export function forcedPhaseFor(
  group: "discovery" | "anchoring" | "counter",
  state: NegotiationState,
): NegotiationPhase | null {
  if (group === "discovery") {
    const hasSignal =
      state.candidateCurrentCtc != null ||
      state.candidateTarget != null ||
      state.candidateTargetFixed != null;
    /* A6 adversarial-sim (2026-06-19) — recruiter-anchors-first on a
     * stonewall. A discovery overstay with NO disclosed signal used to dump
     * straight to `stalemate` — the cardinal failure of a dead-end with no
     * number ever on the table. A real recruiter instead states the band to
     * break the deadlock. Route to `offer-presented`, which sends the
     * planner through its anchor gates (including the A6 stonewall anchor)
     * so a concrete number lands rather than a no-offer stalemate. The
     * planner anchors well before this cap in the common case; this is the
     * kernel-side backstop that guarantees the invariant "never stalemate
     * without an offer." */
    if (!hasSignal) return "offer-presented";
    /* Class-B de-sink (2026-06-15) — if we're ALREADY in range-disclosure and
     * have overstayed its budget, push FORWARD to a concrete anchor instead of
     * returning range-disclosure again. The old `return "range-disclosure"`
     * was a no-op when phase===range-disclosure, so the band-disclosure-deflect
     * lever repeated verbatim every turn until the global turn budget dumped to
     * stalemate (the reported deflect-loop sink). offer-presented routes the
     * planner through its anchor gates so a real number lands next turn. */
    if (state.phase === "range-disclosure") {
      /* S1-B1 (2026-07-22) — target-asked guard. The 4 CTC component probes
       * (total → base → variable → ESOP) can exhaust the opening budget before
       * the target question fires even once. Block the forced escape to
       * offer-presented until target has been asked at least once. Once it has
       * been asked (even if unanswered), normal budget enforcement resumes and
       * the session can advance to anchor. Without this gate the recruiter
       * would present an offer without ever asking "what's your target CTC?" */
      const targetEverAsked =
        state.discoveryChecklist?.targetAnswered === true ||
        (state.askedTopics ?? []).some(
          (t) => t.topic === "targetAsked" || t.topic === "targetAnswered",
        );
      if (!targetEverAsked) return null;
      return "offer-presented";
    }
    return "range-disclosure";
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

export function derivePhaseInner(state: NegotiationState): NegotiationPhase {
  if (isTerminalPhase(state.phase)) return state.phase;
  /* AUDIT-W02 BUG-2 (2026-06-08) — walked-away precedence. If the
   * session already walked away, that terminal state must stick even
   * if turnIndex >= maxTurns; otherwise the stalemate branch below
   * silently overwrites a walked-away terminal phase set on the same
   * candidate turn (asymmetric vs accepted, which is sticky). */
  if (state.walkedAwayAtTurn != null) return "walked-away";
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
    /* Class-B (2026-06-15) — fold candidateTargetFixed (and in-hand framing)
     * into the "candidate has a target" test, matching the main cascade
     * (kernel ~5906) and canDiscloseSpecificNumber. Without this a fixed-only
     * ask ("₹26L fixed") routed to offer-presented (awaiting-first-reaction)
     * instead of counter-offer for one turn before self-correcting. */
    const hasTarget =
      (statedTotalTargetCtcLpa(state) ?? state.candidateTargetFixed) != null;
    if (state.highestOfferMade > 0) {
      /* A specific anchor has been put on the table — promote. This
       * highestOfferMade>0 exit is the PRIMARY, intent-based exit: the
       * anchor-with-offer action sets it directly, independent of any prose
       * regex (the rangeDisclosedAtTurn detector below is legacy
       * defense-in-depth, not the load-bearing trigger). */
      if (hasTarget) return "counter-offer";
      return "offer-presented";
    }
    if (
      state.rangeDisclosedAtTurn != null &&
      state.turnIndex > state.rangeDisclosedAtTurn
    ) {
      /* Candidate has had a turn to react — advance to negotiation. */
      if (hasTarget) return "probe-expectations";
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
  /* Class-A (2026-06-15) — in-hand-adjust the total before phase routing so
   * an in-hand ask isn't compared against TOTAL band figures in the wrong
   * frame. Fixed-only asks stay raw here (over-band detection at the
   * lever-explore gate below wants to see a fixed ask that alone exceeds the
   * total ceiling). */
  const target = statedTotalTargetCtcLpa(state) ?? state.candidateTargetFixed;
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
   *  this number — non-negotiable. Sizing logic (see
   *  computeJoiningBonusAmount in _next-action-planner.ts): 50% of the gap
   *  between current highest offer and the unit-normalized effective target
   *  (effectiveTargetCtcLpa, or maxStretch when no target), clamped to
   *  [1.5, 6.0] LPA, then modulated by marketMode (hot 1.5 / neutral 1.0 /
   *  soft 0.7) and finally capped at the band spread. Without this, the
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
  /** Month 2 PR-2 (2026-06-07) — coarse family classification derived
   *  from actionKind via _action-families.familyOf(). Stamped at the
   *  planner exit boundary (pickAiMove) so every emitted move carries
   *  it; sites that build AiMove inline do NOT need to set it manually.
   *  Used by decisionLog telemetry and (M2 PR-3+) family-level
   *  guardrails. "unmapped" surfaces here when an actionKind has no
   *  taxonomy entry — see _action-families.ts KIND_TO_FAMILY. */
  family?: import("./_action-families").ActionFamily | "unmapped";
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


/* Cap on the rolling conversation log. 4 entries = the last 2 exchanges,
 * which is what the per-turn LLM prompt embeds. Larger logs drift the
 * dynamic portion of the prompt farther through Groq's prefix cache,
 * costing both tokens and cache-hit rate without measurably improving
 * thread coherence (the kernel brief carries the derived facts; the log
 * is just for natural-language reference resolution). */
/* AUDIT-W02 C2 (2026-06-08) — bumped from 4 to 16 (8 AI + 8 candidate
 * turns). The pipeline's dedup loop and the kernel's verbatim-repeat
 * guard both scan recent AI utterances; a 4-cap means they only see the
 * last 2 AI turns and miss real repeats from earlier in the same
 * session. No other consumer relies on the prior cap of 4 — orphanExports
 * and kernelChaos tests just assert the constant exists and that the log
 * stays bounded. */
export const CONVERSATION_LOG_CAP = 16;

/** DEBT #2 (2026-05-21) — answeredQuestionLedger cardinality cap.
 *  Sized comfortably above the current QuestionIntent enum (~20
 *  buckets) so the cap acts as defense-in-depth, not as a routine
 *  pressure on the eviction policy. applyAiMove evicts the smallest-
 *  turn (LRU) entry on overflow; validateState asserts the invariant. */
export const MAX_LEDGER_ENTRIES = 20;

/** Push a new entry onto the rolling log, capping at the most recent
 *  CONVERSATION_LOG_CAP entries. Empty text drops the entry (e.g. the
 *  init turn where candidateAnswer = ""). Pure. */
export function appendConversation(
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
    /* Deflect-loop fix (2026-06-15) — the counter-scope marker is paired
     * with lastCandidateCounterLpa; clear it on the same one-shot cycle. */
    lastCounterComponent: null,
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
  /* S20-B1 (2026-07-22) — discoveryStage advancement. The discoveryStage
   * field was initialized to "discovery" and only ever reset from
   * "probe-mismatch" → "discovery"; it never advanced to "anchor",
   * "negotiation", etc. The compactTurnBrief always surfaced
   * [CURRENT STAGE: discovery] to the LLM even mid-counter-offer, causing
   * the LLM to generate discovery-mode prose (re-acknowledging CTC as if
   * just disclosed, asking discovery questions in the wrong phase).
   *
   * Advance the stage monotonically in lockstep with the kernel phase so
   * the LLM always has an accurate [CURRENT STAGE:] directive. Monotone-up:
   * "discovery" < "anchor" < "negotiation" < "commitment-test" < "closing"
   * < "terminal". Never regress (except the intentional probe-mismatch →
   * discovery reset above, which only fires before the first CTC probe). */
  if (
    next.discoveryStage === "discovery" &&
    (ANCHORING_PHASES.has(next.phase) ||
      COUNTER_PHASES.has(next.phase) ||
      isTerminalPhase(next.phase))
  ) {
    next.discoveryStage = "anchor";
  }
  if (
    next.discoveryStage === "anchor" &&
    (COUNTER_PHASES.has(next.phase) || isTerminalPhase(next.phase))
  ) {
    next.discoveryStage = "negotiation";
  }
  if (next.discoveryStage === "negotiation" && isTerminalPhase(next.phase)) {
    next.discoveryStage = "terminal";
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
    /* S55-B5 (2026-07-24) — strip any leading "Just to reconfirm" prefix before
     * writing to the ledger. The pipeline re-adds that prefix when reading back:
     * `Just to reconfirm — ${priorAnswer.answerText}`. Storing the raw aiText
     * (which may itself start with "Just to reconfirm —") caused a second
     * reconfirm-read to double-wrap: "Just to reconfirm, Just to reconfirm, …". */
    const cleanAiText = aiText.replace(/^Just to reconfirm\s*[,\-–—]\s*/i, "");
    /* AUDIT-W02 D4 (2026-06-08) — stamp phase at write-time. */
    const merged: Partial<Record<QuestionIntent, { answerText: string; turn: number; phase?: NegotiationPhase }>> = {
      ...priorLedger,
      [askedIntent]: { answerText: cleanAiText, turn: state.turnIndex, phase: state.phase },
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
    "lever-work-mode",
    "lever-growth-path",
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
  /* S23-B1 (2026-07-21) — hold-grant single-fire stamp. */
  if (move.actionKind === "hold-grant" && state.holdGrantedAtTurn == null) {
    next.holdGrantedAtTurn = state.turnIndex;
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
      /* Straight-fitment breakdown (2026-06-19) — an info-disclosure of
       * the standing offer's fixed/variable split, carrying no askedTopic;
       * bypasses the askedTopics ledger like the inflation truth above. */
      "offer-breakdown",
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
      /* PR-2 (PDF #28) — dual-write the asked topic onto the ledger so
       * PR-3 can migrate canRefire / isAskedTopicAnswered readers off
       * the askedTopics array. Read paths unchanged this PR. */
      if (next.ledger) {
        next.ledger = recordAskedTopic(next.ledger, topicKey, next.turnIndex, {
          kind: move.actionKind ?? "unknown",
          satisfiesTopic: topicKey,
        });
      }
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
  /* PRI-63 (2026-06-25) — honor the documented contract on
   * joiningBonusAmount (see the AiMove field doc): it is carried on
   * BOTH `joining-bonus` levers AND `close-acceptance` moves that grant
   * a JB to satisfy a conditional acceptance ("if you throw in a
   * joining bonus I can make it work"). Previously only the
   * `joining-bonus` lever stamped lastJoiningBonusOffered, so a
   * close-acceptance that granted a fresh JB closed FLAT — the recap
   * read null and silently dropped the candidate's condition (a
   * false-close). Stamping here makes proseCloseRecapFormal enumerate
   * the JB so the recorded deal honors the condition. */
  if (
    typeof move.joiningBonusAmount === "number" &&
    (move.lever === "joining-bonus" || move.lever === "close-acceptance")
  ) {
    next.lastJoiningBonusOffered = move.joiningBonusAmount;
  }
  /* S20-B2 (2026-07-22) — equity grant amount. When the equity-grant lever
   * fires and no grant amount has been stamped yet, derive a concrete 4-year
   * total grant (LPA-equivalent) from the band ceiling. Formula: 50% of
   * maxStretch as 4-year total = ~12.5% annual equity — typical for Indian
   * unicorns/GCCs offering ESOP/RSU sweeteners. Sticky (frozen on first
   * set). The LLM can cite this number when the candidate asks "how many
   * units / what ₹ value?" — previously the recruiter could only describe
   * structure (vest, cliff, strike) with no concrete amount. */
  if (move.lever === "equity-grant" && (next.equityGrantAmountLpa ?? null) == null) {
    next.equityGrantAmountLpa = Math.round(state.band.maxStretch * 0.5);
  }
  /* AUDIT-W02 BUG-4 (2026-06-08) — when a hold-firm move ships final-
   * language ("final offer", "best and final", "final number/position"),
   * increment the assertion counter so downstream recruiter-critique +
   * close-walkaway logic can detect the "asserted thrice, candidate
   * still hasn't moved" pattern. The counter was previously left to
   * drift, so escalation gates never tripped. */
  if (move.lever === "hold-firm" && typeof aiText === "string") {
    const FINAL_LANGUAGE_RE =
      /\b(final\s+(?:offer|number|position)|best\s+(?:we\s+can\s+do|and\s+final))\b/i;
    if (FINAL_LANGUAGE_RE.test(aiText)) {
      next.finalOfferAssertedCount = state.finalOfferAssertedCount + 1;
    }
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
