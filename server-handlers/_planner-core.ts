/* Next-action planner: the main planNextAction entry point and its decision tree. */

import { type NegotiationState, type AiMove, isTerminalPhase, clampToCloseFloor, totalScopedCounter, statedTotalTargetCtcLpa, canCloseSession, canDiscloseSpecificNumber, type DiscoveryTopic, clampAnchorAgainstCandidateAsk, effectiveTargetCtcLpa, effectiveAnchorLpa, validateComponentConstraints } from "./_negotiation-kernel";
import { type NextAction, type PlannedAction, type SatisfiesTopic, NON_CASH_DEMAND_REASONS, readAskedTopics, defensiveLadderStep } from "./_planner-actions";
import { clampAnchorAboveDisclosed, fixedConditionBlocksClose, nearOfferCloseNumber, resolveFixedCloseAsk, fixedScopedCloseTotal, acceptanceUtteranceFigure, resolveConditionalCashTarget, planDiscoverySufficientAnchor, planStonewallAnchor, isSeniorCompProfile, nextComponentProbe, buildSkipRecord, applyUncertaintyEscapeHatch, clampOpeningAnchor, MIN_COUNTER_ROUNDS_BEFORE_HOLD_FIRM, undeliverableFixedConditionAsk } from "./_planner-close";
import { maybePlanCalibratedSurprise, maybePlanParaphraseRecap, maybePlanProactiveSweetener, maybePlanManagerConsultStall } from "./_planner-flavor";
import { maybePlanPriorContextAction, computeJoiningBonusAmount, maybePlanCompetingOfferWarmAck, maybePlanCallbackPriorContext, wrapLeverExplore, pickLeverExploreMove, maybePlanTacticInject, pickStructuralLever } from "./_planner-tactics";
import { latestCandidateText, type QuestionRoute, routeCandidateQuestion, isSalaryPush } from "./_question-router";
import { detectInHandFollowupAfterInflation, planCtcInflationTruth, detectOfferBreakdownRequest, planOfferBreakdown, shouldFireCtcInflationAnchor, planCtcInflationAnchor } from "./_planner-inflation";
import { buildCloseRecapFormal, planReactiveFollowup, planWiredProfileFollowup } from "./_planner-reactive";
import { analyzeDemand } from "./_utterance-intent";
import { analyzeEquityClarity } from "./_trial-close-detector";
import { resumeConfirmsCompany } from "./_resume-fact-pack";
import { recommendWalkAway } from "./_recruiter-critique";
import { classifyRoleFamily, getCompanyHikeCap } from "./_company-band-tiers";
import { isDiscoverySufficientToAnchor, getNextOrderedDiscoveryItem, getNextOrderedDiscoveryQuestion, isDiscoveryComplete } from "./_discovery-stage";
import { getFactOr } from "./_conversation-ledger";
import { hasConcreteTell } from "./_competing-offer-detail";
import { estimateCounterOfferRisk } from "./_counter-offer-risk";
import { timeContextToMoodDelta } from "./_recruiter-time-context";

export function planNextAction(state: NegotiationState): NextAction {
  const action = planNextActionInternal(state);
  /* S25-B1 (2026-07-22) — false-close guard on simultaneous CTC+target disclosure.
   *
   * When the candidate states BOTH their current CTC AND their target in
   * the same discovery turn (e.g. "I'm currently at 28L and targeting 42L"
   * at exchange 2), discovery completes in one shot. Some downstream paths
   * — the honest-defer arm (band ceiling below CTC), the gap-gate, or the
   * acceptance-classifier reacting to the target number — can short-circuit
   * to a close/walk-away action BEFORE the recruiter has made a single
   * offer. The candidate then hears "we'll be in touch" without ever finding
   * out what the company actually pays.
   *
   * Guard: if the inner planner returns a close or live-walk-away AND no
   * offer is on the table yet (highestOfferMade === 0) AND we are in an
   * early turn (≤ 4), veto the close and redirect to the discovery-
   * sufficient anchor helper (which will make a ceiling offer). After the
   * offer lands, the walk-away / no-deal path can fire legitimately on the
   * next turn. */
  if (
    state.highestOfferMade === 0 &&
    state.turnIndex <= 4 &&
    state.candidateCurrentCtc != null &&
    (state.candidateTarget != null || state.candidateTargetFixed != null) &&
    (action.kind === "close" || action.kind === "live-walk-away")
  ) {
    const lo = state.band?.initialOffer;
    const hi = state.band?.maxStretch;
    if (typeof lo === "number" && typeof hi === "number" && lo > 0) {
      const anchored = clampAnchorAboveDisclosed(lo, hi, state) ?? hi;
      return {
        kind: "anchor-with-offer",
        initialOffer: anchored,
        bandIncomplete: false,
        satisfiesTopic: "band-anchor-with-rationale",
        _move: {
          lever: "probe",
          newTotalLpa: anchored,
          rationale:
            `S25-B1 false-close guard: planner returned ${action.kind} at turn ${state.turnIndex} ` +
            `with highestOfferMade=0 and both currentCtc+target known — vetoing close and ` +
            `anchoring ceiling ₹${anchored}L first so candidate sees an actual offer.`,
          askedTopic: "band-anchor-with-rationale",
          actionKind: "anchor-with-offer",
        },
      } as PlannedAction;
    }
  }
  return action;
}

/** Recover the AiMove the planner constructed alongside the action. The
 *  move is cached on the planned action; this fn is the inverse of the
 *  planner's construction step. */
export function actionToLever(action: NextAction, _state: NegotiationState): AiMove {
  const carried = action as PlannedAction;
  if (carried._move) return carried._move;
  /* Fallback (should not happen — every planNextAction return path sets
   * _move). Guard against stripped serialization by re-planning. */
  return planNextActionInternal(_state)._move;
}

export function planNextActionInternal(state: NegotiationState): PlannedAction {
  /* 2026-06-15 architecture audit — Planner Finding 1: terminal-phase and
   * turn-budget caps are the highest-precedence concern, so they run FIRST.
   * They were previously placed below the feature branches
   * (calibrated-surprise, paraphrase-recap, proactive-sweetener,
   * manager-consult-stall, prior-context), which meant a session past its
   * turn budget or already in a terminal phase could emit a feature turn
   * instead of closing — overshooting maxTurns / re-opening a settled deal.
   * The prior-context branch's own comment already documents these caps as
   * sitting "above" it; the code contradicted that. All five feature
   * helpers self-gate to non-terminal phases, so hoisting is byte-identical
   * except in the over-budget / stuck-progress / terminal cases these caps
   * are designed to own. */

  /* PDF#38 BUG-D (2026-05-20) — stuck-progress terminal close. PDF#38
   * Flipkart SPD session ended at T8 with the candidate still
   * disengaged: no salary disclosure, two probe-and-repeat cycles,
   * acknowledge-and-recover already burned. The hard MAX_TURNS cap
   * below would force closure but only at turnIndex >= maxTurns (T20+).
   * This earlier cap catches the case where the recovery lever failed
   * to break the loop: acknowledge-and-recover has fired AND the
   * candidate is STILL non-disclosing (no currentCtc, no target) AND
   * we've burned ≥ 8 turns. Force stalemate close — both sides have
   * given up; dragging the session to T20 is worse user-experience
   * than a clean terminal turn. Single-fire by virtue of routing to
   * the terminal branch (phase becomes stalemate). */
  /* PDF#41 BUG-D (2026-05-21) — also require highestOfferMade === 0.
   * The stuck-progress cap was designed for pre-anchor sessions where
   * the candidate never discloses anything. If an anchor IS on the
   * table (highestOfferMade > 0), we are past discovery — even if the
   * candidate is being squirrelly about target / current CTC. Force-
   * closing as stalemate post-anchor truncates the session before the
   * candidate can respond to the offer. The Flipkart PDF#41 session
   * terminated abruptly after the candidate asked for a breakdown
   * because this guard fired with the anchor already on the table. */
  /* 2026-06-15 architecture audit — Planner Finding 1 follow-up: also require
   * no disclosed expected-CTC claim. The "non-disclosing" premise is that the
   * candidate has given us nothing to work with; but a stated
   * userClaims.expectedCtc IS a numeric anchor (it arms calibrated-surprise,
   * which can legitimately fire under these same turn/offer conditions). Once
   * the cap hoisted above the feature branches, omitting this guard would let
   * the stalemate close pre-empt a valid calibrated-surprise probe. */
  if (
    !isTerminalPhase(state.phase) &&
    state.turnIndex >= 8 &&
    state.candidateCurrentCtc == null &&
    state.candidateTarget == null &&
    state.userClaims?.expectedCtc?.value == null &&
    state.highestOfferMade === 0 &&
    state.leversUsed.includes("acknowledge-and-recover")
  ) {
    return {
      kind: "close",
      mode: "stalemate",
      _move: {
        lever: "close-stalemate",
        newTotalLpa: state.highestOfferMade || state.band.initialOffer,
        rationale:
          `PDF#38 BUG-D stuck-progress cap: acknowledge-and-recover ` +
          `already fired AND candidate still non-disclosing at turn ` +
          `${state.turnIndex}; force stalemate close before the budget ` +
          `overshoot at maxTurns=${state.maxTurns}.`,
      },
    };
  }

  /* PDF#37 BUG-H (2026-05-20) — hard terminal cap. When the AI has
   * produced `state.maxTurns` turns and is still non-terminal (no
   * accept, no walk, no stalemate ledger stamp), the session silently
   * loops on the last non-terminal action — observed in PDF#37 as the
   * Flipkart session running past its budget without a close turn.
   * Force a stalemate close so the conversation always ends with an
   * explicit terminal turn. derivePhase already routes turnIndex ===
   * maxTurns-1 → closing-push (line 4228) for a final framed close;
   * this guard catches the case where that escalation didn't fire (no
   * candidateTarget, lever-explore never entered) and the budget is
   * about to overshoot. */
  if (
    !isTerminalPhase(state.phase) &&
    state.turnIndex >= state.maxTurns
  ) {
    return {
      kind: "close",
      mode: "stalemate",
      _move: {
        lever: "close-stalemate",
        newTotalLpa: state.highestOfferMade || state.band.initialOffer,
        rationale:
          `Turn budget (${state.maxTurns}) reached at non-terminal phase ${state.phase}; ` +
          `force stalemate close so session ends with an explicit terminal turn.`,
      },
    };
  }

  /* Terminal stickiness guard (session 13 bug, 2026-05-14): see notes in
   * the original move-picker. */
  /* PDF#40 BUG-3 (2026-05-21) — accepted-phase closeout escape hatch.
   * Terminal stickiness was firing on the FIRST AI turn after the
   * candidate verbally accepted (acceptedAtTurn = turnIndex-1), which
   * bypassed the two-step closeout (close-recap-formal → post-
   * acceptance-document-request) at L983+ and L1000+. The live
   * Flipkart session terminated abruptly with no enumerated recap
   * and no BGV/docs ask. Fix: when the session OWES either of those
   * post-acceptance turns, fall through to L983 / L1000. After both
   * have fired, stickiness resumes its role of preventing re-opening
   * the negotiation on subsequent turns. */
  const owesPostAcceptanceCloseout =
    state.phase === "accepted" &&
    state.verbalAcceptanceTurn != null &&
    (
      !(state.reactiveFollowupsFired ?? []).includes("close-recap-formal") ||
      state.postAcceptanceDocsRequestedAtTurn == null
    );
  if (
    isTerminalPhase(state.phase) &&
    !owesPostAcceptanceCloseout &&
    (
      (state.phase === "accepted" && state.acceptedAtTurn != null && state.acceptedAtTurn < state.turnIndex) ||
      (state.phase === "walked-away" && state.walkedAwayAtTurn != null && state.walkedAwayAtTurn < state.turnIndex) ||
      /* Audit Pass 3 / Fix 1 (2026-05-16) — read the stalemate ledger
       * directly instead of proxying through the close-stalemate lever
       * sentinel. The lever conflates "phase became terminal" with "we
       * already emitted the stalemate close lever this session"; the
       * ledger captures the entry-turn fact independently and stays
       * symmetric with the accepted/walked-away predicates above. */
      (state.phase === "stalemate" && state.stalemateAtTurn != null && state.stalemateAtTurn < state.turnIndex)
    )
  ) {
    return {
      kind: "terminal-restate",
      _move: {
        lever: "terminal-restate",
        newTotalLpa: clampToCloseFloor(state, state.highestOfferMade || state.band.initialOffer),
        joiningBonusAmount: state.lastJoiningBonusOffered ?? undefined,
        rationale: `Terminal phase ${state.phase} reached at turn ${state.acceptedAtTurn ?? state.walkedAwayAtTurn ?? state.stalemateAtTurn ?? "?"}; restate close.`,
      },
    };
  }

  /* Phase 5 Session A (2026-05-19) — multi-round persona handoff
   * pre-emption. When the kernel just transitioned between round
   * personas (maybeAdvanceRound pushed a fresh entry to
   * state.roundTransitions THIS turn), the planner emits a dedicated
   * `round-transition` action ahead of every other branch so the
   * handoff prose runs in front of the candidate before the new
   * persona starts their cascade.
   *
   * Default-OFF invariance: when `multiRoundEnabled` is false (HEAD
   * default), `roundTransitions` is empty (initialised to []) and this
   * branch never fires. Byte-identical to today. */
  if (state.multiRoundEnabled === true && (state.roundTransitions?.length ?? 0) > 0) {
    const transitions = state.roundTransitions!;
    const last = transitions[transitions.length - 1];
    if (last.atTurn === state.turnIndex) {
      return {
        kind: "round-transition",
        from: last.from,
        to: last.to,
        _move: {
          lever: "probe",
          newTotalLpa: null,
          rationale:
            `Phase 5 Session A — multi-round handoff at turn ${state.turnIndex}: ` +
            `${last.from} → ${last.to}.`,
          actionKind: "round-transition",
        },
      };
    }
  }

  /* S23-B1 (2026-07-21) — hold-phase: candidate asked the recruiter for
   * thinking time ("can I take until Thursday?", "need a couple of days").
   *
   * Real recruiters respond with a brief, warm time-bridge — "Of course —
   * take until Thursday. Just let me know." — rather than continuing to
   * push levers. The kernel currently ignores this signal and plows ahead
   * with normal negotiation, causing the recruiter to hallucinate progress
   * and the candidate to feel steamrolled.
   *
   * Guards:
   *   - Only fires when state.decisionDeadline.requestsHold is true
   *     (detected this turn or carried from a prior merge).
   *   - Single-fire: holdGrantedAtTurn must be null so the recruiter
   *     doesn't re-grant time on every subsequent turn.
   *   - Not in a terminal phase (accepted/walked/stalemate).
   *   - Suppressed when conditionalAcceptance is also true — a
   *     conditional accept has its own close gate above and must not
   *     divert to a hold. */
  if (
    !isTerminalPhase(state.phase) &&
    state.decisionDeadline?.requestsHold === true &&
    state.decisionDeadline?.conditionalAcceptance !== true &&
    state.holdGrantedAtTurn == null
  ) {
    return {
      kind: "hold-firm",
      mode: "verbal-accept",
      grantTime: true,
      _move: {
        lever: "hold-firm",
        newTotalLpa: state.highestOfferMade > 0 ? state.highestOfferMade : null,
        actionKind: "hold-grant",
        rationale: "grant-time: candidate requested thinking time; recruiter grants a time-bridge and stands by",
      },
    } as PlannedAction;
  }

  /* Realism-Audit Fix 3 (2026-05-22) — manager-consult stall.
   *
   * Two-phase gate:
   *   (A) Stall ALREADY in flight (stallTurnsRemaining > 0): ship the
   *       return-turn this turn. The simulator commits to either a
   *       small concession ("checked — we can move ₹X on JB only")
   *       OR a hold ("checked — band stays"). Choice is deterministic
   *       from persona + band headroom.
   *   (B) Stall NOT in flight: consider opening one when ALL gates pass.
   *       Gates are conservative — the audit explicitly forbids first-turn
   *       short-circuit stalls.
   *
   * The stall genuinely models a leverage move; coaching downstream
   * can observe `stallsFiredCount` and `lastStallContext`. */
  /* Calibrated-surprise lowball (2026-05-29) — fires BEFORE the
   * paraphrase / counter-offer / anchor cascade so the probe interrupts
   * the standard flow when the candidate undershoots band floor by ≥20%.
   * Also handles the Branch A follow-up (`accept-lowball-quiet`) when
   * the prior turn classification stamped `acceptedLowball`. */
  {
    const cs = maybePlanCalibratedSurprise(state);
    if (cs !== null) return cs;
  }
  /* Paraphrase-loop feature (2026-05-29) — pre-empt manager-consult-stall
   * and close so the recap fires the turn BEFORE the decision push. */
  {
    const paraphrase = maybePlanParaphraseRecap(state);
    if (paraphrase !== null) return paraphrase;
  }
  /* Proactive-sweetener feature (2026-05-30) — when the recruiter is
   * cash-capped (highestOfferMade ≥ 95% of band.maxStretch) AND the
   * candidate is cooling, the recruiter volunteers a non-cash
   * sweetener INSTEAD of stalling for manager-consult. Slots BEFORE
   * manager-consult-stall so the cooling-candidate / cash-capped
   * pattern dangles relocation / signing-bonus / equity-refresh /
   * joining-flex / notice-buyout-help rather than re-running the
   * stall ritual. Single-fire so the cascade falls through to the
   * stall on subsequent cooling turns. */
  {
    const sweetener = maybePlanProactiveSweetener(state);
    if (sweetener !== null) return sweetener;
  }
  {
    const stallSelected = maybePlanManagerConsultStall(state);
    if (stallSelected !== null) return stallSelected;
  }

  /* Prior-context feature (2026-05-29) — HIGH priority on turn 1-2
   * when the user declared an upfront competing-offer or retention
   * context. Mid-stage `match-existing-offer-prose` and
   * `retention-trump-warning` pre-empt routine stalls but sit BEHIND
   * the terminal-cap and manager-consult-stall crisis branches above.
   * Skipped silently when state.priorContext is undefined (back-compat
   * byte-identity with the pre-feature cascade). */
  {
    const pre = maybePlanPriorContextAction(state);
    if (pre !== null) return pre;
  }

  /* PDF#34 Fix 3 (2026-05-18) — clarification-request branch.
   *
   * When the candidate's most recent utterance was a comprehension
   * question about a term the bot just used ("what is that?", "huh?",
   * "what does X mean?"), the parser stamps
   * `state.lastAnswerClarificationAtTurn = state.turnIndex`. Route to
   * a dedicated `clarify-prior-question` action so the canonical-prose
   * surface defines the jargon term inline and re-asks in plain
   * English — INSTEAD of letting the LLM freelance an off-topic
   * deflection ("This conversation is about Senior Product Designer
   * at Meesho…" — the PDF#34 Meesho/Prita persona break).
   *
   * Single-fire per clarification: only fires when the stamp matches
   * the current turn index (the parser just set it). Repeated
   * confusion across turns falls through to other planner branches
   * so we don't loop on the same definition.
   *
   * Suppressed in terminal phases (the session is winding down; the
   * candidate's "huh?" is best handled by the close-recap, not a new
   * clarification turn). */
  if (
    !isTerminalPhase(state.phase) &&
    state.lastAnswerClarificationAtTurn != null &&
    state.lastAnswerClarificationAtTurn === state.turnIndex
  ) {
    const priorAi = state.lastAiText ?? "";
    return {
      kind: "clarify-prior-question",
      priorAiText: priorAi,
      satisfiesTopic: "clarify-prior-question" as SatisfiesTopic,
      _move: {
        lever: "probe",
        newTotalLpa: null,
        rationale:
          `PDF#34 Fix 3 — candidate requested clarification at turn ${state.turnIndex}; ` +
          `re-explain the prior question's jargon inline before advancing.`,
        actionKind: "clarify-prior-question",
      },
    };
  }

  /* PDF#51 (2026-05-28) — single question-router call per turn.
   *
   * Replaces three inline regex tests (DIRECT_ANCHOR_ASK_RE here,
   * BREAKDOWN_REQUEST_RE further down via detectOfferBreakdownRequest,
   * and the 14-topic curated path that pre-2026-05-28 only existed in
   * `_candidate-question.ts` with no planner consumer). The router is
   * pure and the result drives three branches:
   *
   *   - `anchor-ask`    → existing open-with-offer preemption below
   *   - `breakdown-ask` → existing inflation-truth / offer-breakdown
   *                       disclosure branch further down
   *   - `topical`       → new answer-direct deterministic-prose branch
   *                       (LLM is skipped in negotiate-turn.ts)
   *
   * Computed once at the top of planNextAction so each branch reads
   * the same routing decision. `latestCandidateText` centralises the
   * conversationLog walk that four call sites used to duplicate. */
  const lastCandidateUtterance = latestCandidateText(state);
  const questionRoute: QuestionRoute | null =
    routeCandidateQuestion(lastCandidateUtterance);

  /* PDF#51 (2026-05-28) — direct anchor-ask preemption.
   *
   * The Flipkart Senior Product Designer transcript showed the
   * candidate asking "so what's your offer?" three turns in a row
   * while the planner held its course through the discovery cascade
   * (currentCtc → target → notice period → THEN anchor). Real
   * recruiters do not hold discovery hostage when the candidate has
   * directly asked for the number; they share the headline and let
   * discovery continue in parallel.
   *
   * Gates (ALL must hold):
   *   (a) router classified the utterance as `anchor-ask`
   *       (pattern lives in `_question-router.ts:ANCHOR_ASK_RE`),
   *   (b) the band exists and has an initialOffer,
   *   (c) no anchor has been disclosed yet (highestOfferMade === 0),
   *   (d) phase is non-terminal — closed sessions don't re-anchor.
   *
   * When all four hold, force `open-with-offer` with the band's
   * initialOffer regardless of where the discovery cascade thinks
   * we are. */
  if (
    questionRoute?.kind === "anchor-ask" &&
    !isTerminalPhase(state.phase) &&
    state.highestOfferMade === 0 &&
    state.band?.initialOffer != null
  ) {
    /* Crack 9 (2026-06-17) — anchor-ask must actually DISCLOSE a number.
     *
     * The legacy PDF#51 preemption returned `open-with-offer`. But that
     * kind carries numberPolicy:"forbidden" in the response pipeline (in
     * the kernel-first world `open-with-offer` is the no-number opening
     * probe), so the prose layer gagged the figure — the candidate's
     * explicit "what's your offer?" shipped a numberless probe and the
     * offer was NEVER disclosed (reproduced live: recruiter dodged
     * "what can you put on the table?" / "the figure you're offering?"
     * four turns running). Emit `anchor-with-offer`
     * (numberPolicy:"required", tokens LPA+fitment) instead, exactly
     * like the AUDIT-3 discovery-complete anchor below, so band.initial
     * reaches the candidate. Clamp above any disclosed CTC so we never
     * anchor below current pay; null => honest defer, not a pay-cut. */
    const lo = state.band.initialOffer;
    const hi = state.band.maxStretch;
    const anchored = clampAnchorAboveDisclosed(lo, hi, state);
    if (anchored === null) {
      return {
        kind: "anchor-with-offer",
        initialOffer: lo,
        bandIncomplete: true,
        satisfiesTopic: "band-anchor-with-rationale",
        _move: {
          lever: "probe",
          newTotalLpa: null,
          rationale:
            `Crack 9 anchor-ask defer — candidate asked for the offer at ` +
            `turn ${state.turnIndex}, but band ceiling (${hi}) is below ` +
            `disclosed CTC (${state.candidateCurrentCtc}); honest-defer ` +
            `rather than a pay-cut anchor.`,
          askedTopic: "band-anchor-with-rationale",
          actionKind: "anchor-with-offer",
        },
      };
    }
    return {
      kind: "anchor-with-offer",
      initialOffer: anchored,
      bandIncomplete: false,
      satisfiesTopic: "band-anchor-with-rationale",
      _move: {
        lever: "probe",
        newTotalLpa: anchored,
        rationale:
          `Crack 9 direct anchor-ask preemption — candidate asked for the ` +
          `offer at turn ${state.turnIndex}; disclose band initial ` +
          `₹${anchored} LPA via anchor-with-offer (open-with-offer gags ` +
          `the number) instead of holding discovery hostage.`,
        askedTopic: "band-anchor-with-rationale",
        actionKind: "anchor-with-offer",
      },
    };
  }

  /* Audit fix 2026-05-21 — CTC-inflation truth follow-up. Priority-
   * positioned RIGHT AFTER the clarification-request branch (and BEFORE
   * stalled-discovery / discovery cascades) so that a candidate's
   * "what's the in-hand?" lands the truthful breakdown instead of
   * routing through the regular probe cascade. Reads the candidate's
   * most recent utterance from conversationLog (the kernel appends a
   * "candidate" entry before planNextAction runs) and gates on the
   * single-fire stamp `ctcInflationAnchorCtcLpa` from the kernel. The
   * truth helper reuses the EXACT headline CTC from the original
   * inflation quote — same numbers, honest framing. */
  if (state.ctcInflationAnchorCtcLpa != null) {
    const log = state.conversationLog ?? [];
    let lastCandidate = "";
    for (let i = log.length - 1; i >= 0; i--) {
      if (log[i].speaker === "candidate") {
        lastCandidate = log[i].text ?? "";
        break;
      }
    }
    if (
      lastCandidate &&
      detectInHandFollowupAfterInflation(state, lastCandidate)
    ) {
      const action = planCtcInflationTruth(state.ctcInflationAnchorCtcLpa);
      if (action != null) return action;
    }
  }

  /* Audit fix (2026-05-22, user-reported Flipkart transcript) — widened
   * offer-breakdown disclosure. The truth-followup above is GATED on
   * `ctcInflationAnchorCtcLpa != null`, which only stamps after the
   * single-fire inflation-anchor lever has been used. In the wild the
   * candidate can ask for an offer breakdown ("Can you share the
   * breakdown of 41 LPA offer", "what is base, variable, bonus",
   * "summarize the offer again") after a PLAIN anchor-with-offer turn
   * where the inflation lever never fired. Previously the planner had
   * no breakdown-disclosure branch for that case and routed through the
   * generic answer-direct path which classified to null and shipped the
   * generic "Happy to address that — let me come back to where we were."
   * fallback three turns in a row. Fire whenever (a) the candidate
   * asked for a breakdown, (b) at least one offer has been quoted
   * (`highestOfferMade > 0`), and (c) we haven't shipped the inflation-
   * truth above. Reuses the same buildCtcInflationBreakdown helper so
   * the disclosed numbers match the inflation-anchor mix. */
  {
    /* PDF#51 (2026-05-28) — reuse the top-of-function router result
     * rather than re-walking the conversation log. The router already
     * classifies `breakdown-ask` as a distinct route; the inline
     * `detectOfferBreakdownRequest(lastCandidate)` call below is kept
     * as a belt-and-suspenders so legacy tests that mock the helper
     * directly keep passing. */
    const lastCandidate = lastCandidateUtterance;
    const offerLpa =
      state.highestOfferMade > 0
        ? state.highestOfferMade
        : state.band?.initialOffer ?? 0;
    /* Defense: only fire when (a) the offer is genuinely on the table
     * (post-anchor phase), (b) the candidate's last AI turn wasn't
     * already this same disclosure (we don't want to ship two recaps
     * in a row to the same "yes do it" follow-up), and (c) the
     * candidate isn't simultaneously countering — countering carries
     * a NEW target number which the counter-base planner branch
     * handles. */
    const lastAiText = (state.lastAiText ?? "").toLowerCase();
    /* S45-B1 (2026-07-23) — widen alreadyDisclosed to catch the
     * "fully fixed cash, guaranteed and contractual" and "no variable
     * component" prose variants that the prior two-phrase check missed,
     * preventing the same offer-breakdown from firing twice in a row. */
    const alreadyDisclosed =
      lastAiText.includes("guaranteed cash is") ||
      lastAiText.includes("let me break it down honestly") ||
      lastAiText.includes("fully fixed") ||
      lastAiText.includes("no variable component") ||
      lastAiText.includes("all fixed cash") ||
      lastAiText.includes("guaranteed and contractual");
    /* A8 adversarial-sim (2026-06-19) — a base/component breakdown ask
     * ("what can you do on the base?", "and the base specifically?") often
     * lands in probe-expectations / offer-presented once a concrete offer
     * is on the table, NOT only in counter/closing. Previously those phases
     * were excluded, so the planner ignored the base question and re-issued
     * the SAME target probe ("what fitment were you expecting?") every turn
     * — a verbatim dodge-loop. Admit those phases too, but ONLY when an
     * offer GENUINELY stands (highestOfferMade > 0, not the band fallback),
     * so a pre-anchor "what can you do?" still routes to a fresh anchor. */
    const offerGenuinelyStands = state.highestOfferMade > 0;
    const isPostAnchorPhase =
      state.phase === "counter-offer" ||
      state.phase === "closing-push" ||
      state.phase === "accepted" ||
      ((state.phase === "probe-expectations" ||
        state.phase === "offer-presented") &&
        offerGenuinelyStands);
    /* Counter-detection: candidate carries a salary number that is
     * NOT the recruiter's current offer — that's a counter, not a
     * breakdown ask. Restating the offer's own number (e.g. "share the
     * breakdown of 41 LPA offer") is fine. */
    /* S45-B1/B3 (2026-07-23) — "lakhs" (plural) wasn't in the unit
     * alternation, so "52 lakhs" didn't match and candidateHasNewNumber
     * stayed false. Planner routed to offer-breakdown instead of
     * counter-base, the offer never moved, and the breakdown repeated
     * verbatim. Adding `s?` makes `lakh` and `lakhs` both match. */
    const numberMatches = Array.from(
      lastCandidate.matchAll(/\b(\d+(?:\.\d+)?)\s*(?:l|lpa|lakhs?|lacs?|cr)\b/gi),
    ).map((m) => Number(m[1]));
    const candidateHasNewNumber = numberMatches.some(
      (n) => Number.isFinite(n) && Math.abs(n - offerLpa) > 0.5,
    );
    /* Audit fix (2026-05-22) — phrase-level counter cue. Candidates
     * often counter with a BARE number ("I had 38 in mind", "I was
     * thinking 40", "looking for 42", "expecting 45") with no LPA/L
     * suffix. The unit-anchored regex above misses those. Detect the
     * intent-carrying phrase instead. */
    const COUNTER_PHRASE_RE =
      /\b(?:i\s+(?:had|was)\b.*?(?:in\s+mind|thinking|expecting|hoping)|i'?m\s+(?:thinking|expecting|hoping|looking\s+for)|looking\s+for\s+\d|expecting\s+\d|hoping\s+for\s+\d|targeting\s+\d|aiming\s+(?:at|for)\s+\d|considering\s+\d|need(?:ed|ing)?\s+(?:at\s+least\s+|around\s+|closer\s+to\s+)\d|can\s+you\s+(?:do|match|stretch\s+(?:to|up)|go\s+up\s+to)\s+\d)/i;
    const candidateHasCounterPhrase = COUNTER_PHRASE_RE.test(lastCandidate);
    /* Audit fix (2026-05-22) — non-cash-context guard. If the candidate
     * is asking for a breakdown of EQUITY/ESOP/RSU/vesting OR any other
     * non-cash structure (team, role, location, WFH days, process,
     * timeline, benefits, interview, notice period), the 60/18/12/5/5
     * cash-mix is the wrong response. Let dedicated prose paths handle
     * those. We require the utterance to either:
     *   (a) carry an explicit cash keyword (base/variable/bonus/CTC/etc.),
     *       OR
     *   (b) be cash-neutral (no non-cash context keyword present).
     * If a non-cash context keyword is present AND no cash keyword is
     * present, skip the cash-breakdown branch entirely. */
    const NON_CASH_CONTEXT_RE =
      /\b(?:equity|esop|rsu|vesting|stock|options?|team|reporting|manager|location|office|wfh|work[\s-]?from[\s-]?home|hybrid|remote|onsite|relocation|notice[\s-]?period|joining[\s-]?date|interview|process|timeline|role|responsibilities|leave|insurance|benefits|perks|hours|schedule|shift)\b/i;
    const CASH_BREAKDOWN_CONTEXT_RE =
      /\b(?:base|variable|bonus|ctc|fixed|in[\s-]?hand|take[\s-]?home|offer|package|fitment|comp(?:ensation)?|salary|fixed\s+pay)\b/i;
    const looksLikeNonCashBreakdown =
      NON_CASH_CONTEXT_RE.test(lastCandidate) &&
      !CASH_BREAKDOWN_CONTEXT_RE.test(lastCandidate);
    if (
      offerLpa > 0 &&
      isPostAnchorPhase &&
      !alreadyDisclosed &&
      !candidateHasNewNumber &&
      !candidateHasCounterPhrase &&
      !looksLikeNonCashBreakdown &&
      lastCandidate &&
      /* PDF#51 (2026-05-28) — accept either the unified router's
       * classification OR the legacy regex helper. Both reduce to
       * BREAKDOWN_ASK_RE today (the helper now imports the regex
       * from the router); the dual-check is paranoia against drift
       * if either side is monkey-patched in tests. */
      (questionRoute?.kind === "breakdown-ask" ||
        detectOfferBreakdownRequest(lastCandidate) ||
        /* A8 (2026-06-19) — the unified router classifies "what can you do
         * on the base?" as anchor-ask (the greedy "what … can you do" frame)
         * before breakdown-ask can claim it, so over a standing offer it
         * never reached this branch and looped the target probe. When an
         * offer genuinely stands AND the question explicitly names a cash
         * component (base / fixed / variable / split / structure), treat it
         * as a breakdown request regardless of the router's anchor-ask
         * label. The cash/non-cash guards above already scope this to a
         * genuine cash-component ask. */
        (offerGenuinelyStands &&
          /* Must be an actual QUESTION (routeCandidateQuestion non-null),
           * not a statement that merely contains "structure" / "fixed". A
           * candidate accepting with "that structure works for me" is NOT
           * asking for a breakdown — without this guard the acceptance was
           * mis-routed to ctc-inflation-truth instead of closing. */
          questionRoute != null &&
          /* And never preempt a FRESH verbal acceptance: if the candidate
           * just accepted on this very turn, the post-anchor close (below)
           * owns the turn — a component keyword in the acceptance prose
           * ("the revised fitment / structure works for me") must not be
           * mistaken for a breakdown ask. */
          state.verbalAcceptanceTurn !== state.turnIndex &&
          /\b(?:base|fixed|variable|split|break(?:down|up)|structure)\b/i.test(
            lastCandidate,
          )))
    ) {
      /* Model selection (2026-06-19) — the inflation breakdown
       * (`buildCtcInflationBreakdown`, 60/18/12/5/5, ESOP-paper carved
       * OUT of the headline) is correct ONLY when a CTC-inflation anchor
       * was actually weaponised this session. For a STRAIGHT fitment the
       * headline was never padded, so its in-hand split must be the SAME
       * fixed/variable the close-recap will quote — otherwise the turn-8
       * breakdown ("guaranteed cash ₹19.9L") contradicts the turn-9
       * close-recap ("Fixed ₹28.2L") for the very same offer (live
       * staging 2026-06-19, session sweep-ctcmix-4). Pick the model that
       * matches what actually happened on the table. */
      const inflationAnchorWeaponised =
        state.ctcInflationAnchorCtcLpa != null ||
        (state.leversUsed?.includes("ctc-inflation-anchor") ?? false);
      const action = inflationAnchorWeaponised
        ? planCtcInflationTruth(offerLpa)
        : planOfferBreakdown(state, offerLpa);
      if (action != null) return action;
    }
  }

  /* PDF#30 architectural pass (2026-05-18) — stalled-discovery cap.
   * Sibling to the explicit-frustration branch below: even when the
   * candidate hasn't VOICED frustration, if the bot has emitted a
   * probe-family lever on the last 4 consecutive turns, we are by
   * definition looping on discovery. PDF#30 T18/T20/T22 was the
   * canonical example — three identical "what's your CTC?" probes
   * in a row before the candidate finally pushed back. This rule
   * promotes acknowledge-and-recover BEFORE the candidate has to
   * complain. Single-fire per session via `stalled-recovery` marker
   * pushed into leversFired by applyAiMove (downstream); subsequent
   * stalls fall through to the normal cascade. */
  const PROBE_FAMILY: ReadonlySet<string> = new Set([
    "probe",
    "probe-justification",
  ]);
  const recent = state.leversUsed.slice(-4);
  const allProbes = recent.length >= 4 && recent.every((l) => PROBE_FAMILY.has(l));
  /* Stalled-discovery is the conjunction of (a) 4 consecutive probes
   * AND (b) the candidate has bound NO salary disclosure across that
   * window. If currentCtc or target has materialized, probes are
   * progressing through OTHER topics — not stalled. This guard is
   * deliberately conservative: it only fires when the parser came
   * back empty 4 times in a row.
   * No explicit single-fire guard needed: once acknowledge-and-recover
   * lands in leversUsed, the streak breaks. */
  const noSalaryDisclosed = state.candidateCurrentCtc == null && state.candidateTarget == null;
  if (allProbes && noSalaryDisclosed) {
    return {
      kind: "acknowledge-and-recover",
      satisfiesTopic: "acknowledge-and-recover",
      _move: {
        lever: "acknowledge-and-recover",
        newTotalLpa: null,
        rationale: "Stalled-discovery cap (PDF#30): 4 consecutive probe-family turns; promote acknowledge-and-recover before the candidate has to push back.",
        actionKind: "acknowledge-and-recover",
      },
    };
  }

  /* PDF#29 Bug 7 (2026-05-18) — frustration recovery is the highest-
   * priority lever (sits above every other branch). Fires when the
   * candidate's last utterance carried a "you're looping on me" cue.
   * Acceptable to ship as a standalone turn for v1; subsequent turns
   * resume the normal cascade because lastUserFrustrated is cleared
   * in applyAiMove. Not pushed through STRUCTURAL_LEVERS rotation
   * (this is a meta / repair move, not a comp lever).
   *
   * MVP-audit fast-follow (2026-06-18) — consecutive-fire guard. A
   * candidate who keeps signalling frustration ("I already told you",
   * "you keep asking") re-sets lastUserFrustrated every turn, and this
   * branch re-emitted the IDENTICAL meta-line on each — three verbatim
   * "let me not loop on that. Moving on." turns in a row, a loop of the
   * very anti-loop line. The recover move is a one-shot rapport reset:
   * if the immediately-preceding lever was already acknowledge-and-
   * recover, suppress it and fall through to the real cascade. The
   * post-recovery force-advance (see force-advance block above) has
   * already skipped the last-asked topic, so the cascade now anchors the
   * offer or probes the NEXT item instead of repeating the apology. */
  const lastLeverForRecovery = state.leversUsed[state.leversUsed.length - 1];
  if (
    state.lastUserFrustrated === true &&
    lastLeverForRecovery !== "acknowledge-and-recover"
  ) {
    return {
      kind: "acknowledge-and-recover",
      satisfiesTopic: "acknowledge-and-recover",
      _move: {
        lever: "acknowledge-and-recover",
        newTotalLpa: null,
        rationale: "Candidate signalled frustration / topic-loop; acknowledge + break out of the loop before continuing the cascade.",
        actionKind: "acknowledge-and-recover",
      },
    };
  }

  /* Memory feature (2026-05-29) — contradiction-callout. Fires when the
   * candidate's current turn restated a previously-recorded claim with a
   * value outside ±10% drift (set by applyCandidateAnswer on
   * state.lastContradiction). Priority slot: above stall / discovery /
   * counter branches so the bot reconciles the gap BEFORE asking the
   * next question or moving money. Sits BELOW frustration recovery
   * (above) and below the terminal walked-away / stalemate close
   * branches (at the very top of the cascade) so crisis paths still
   * win. Single-fire per turn — applyAiMove clears
   * lastContradiction. */
  if (state.lastContradiction != null) {
    const c = state.lastContradiction;
    return {
      kind: "contradiction-callout",
      topic: c.topic,
      oldValue: c.oldValue,
      newValue: c.newValue,
      firstSeenTurn: c.firstSeenTurn,
      oldLabel: c.oldLabel,
      newLabel: c.newLabel,
      _move: {
        lever: "acknowledge-and-recover",
        newTotalLpa: null,
        rationale: `Memory: candidate contradicted earlier claim on ${c.topic} (was ${c.oldValue} at turn ${c.firstSeenTurn}, now ${c.newValue}); call out the gap and ask which is authoritative.`,
        actionKind: "contradiction-callout",
      },
    };
  }

  /* Fix 4 (2026-05-16) — formal close recap. Phase is closing-push (or
   * accepted in the same turn the candidate verbally accepted). Fires
   * before the terminal `accepted` close so the candidate gets a full
   * structured enumeration BEFORE the recap-only terminal-restate path.
   * Suppressed after first emission via leversUsed sentinel. */
  if (
    (state.phase === "closing-push" || state.phase === "accepted") &&
    state.verbalAcceptanceTurn != null &&
    state.highestOfferMade > 0 &&
    !(state.reactiveFollowupsFired ?? []).includes("close-recap-formal")
  ) {
    return buildCloseRecapFormal(state);
  }

  /* Phase 2 Indian-HR redesign (2026-05-17) — post-acceptance documentation
   * request. Fires immediately after `verbalAcceptanceTurn` is stamped AND
   * close-recap-formal has been delivered, BEFORE the terminal accepted
   * close. Single-fire via state.postAcceptanceDocsRequestedAtTurn; after
   * firing, the conversation transitions cleanly to the terminal accepted
   * close on the next turn (the field is stamped by applyAiMove via the
   * action kind, so a re-entry on the same turn returns the terminal
   * close). */
  if (
    state.verbalAcceptanceTurn != null &&
    state.postAcceptanceDocsRequestedAtTurn == null &&
    (state.reactiveFollowupsFired ?? []).includes("close-recap-formal")
  ) {
    return {
      kind: "post-acceptance-document-request",
      _move: {
        lever: "close-acceptance",
        newTotalLpa: null,
        rationale:
          "Phase 2 Indian-HR — verbal acceptance recorded; request BGV / " +
          "documentation set (payslips, Form 16, BGV docs, etc.).",
        actionKind: "post-acceptance-document-request",
      },
    };
  }

  /* Terminal closings. */
  if (state.phase === "accepted") {
    const jb = state.lastJoiningBonusOffered;
    return {
      kind: "close",
      mode: "accept",
      _move: {
        lever: "close-acceptance",
        newTotalLpa: clampToCloseFloor(state, state.highestOfferMade || state.band.initialOffer),
        joiningBonusAmount: jb != null ? jb : undefined,
        rationale: `Candidate accepted; recap terms${jb != null ? ` including ₹${jb}L one-time JB` : ""}.`,
      },
    };
  }
  if (state.phase === "walked-away") {
    return {
      kind: "close",
      mode: "walkaway",
      _move: {
        lever: "close-walkaway",
        newTotalLpa: null,
        rationale: "Candidate walked; acknowledge respectfully.",
      },
    };
  }
  if (state.phase === "stalemate") {
    return {
      kind: "close",
      mode: "stalemate",
      _move: {
        lever: "close-stalemate",
        newTotalLpa: state.highestOfferMade || state.band.initialOffer,
        rationale: "Turn budget exhausted; offer time to think.",
      },
    };
  }

  /* Bug-report 11/12 (2026-05-14) — auto-accept: candidate counter
   * BELOW current offer → close at the close-floor (=highestOfferMade).
   * Gate is restricted to current-turn counters (lastCandidateCounterLpa)
   * — a sticky intake target alone is not enough to fire close.
   * (PDF#44 attempted to broaden this to candidateTarget but
   * closeFloorInvariant guards the narrower contract; the right place to
   * address PDF#44 Bug A is to ensure lastCandidateCounterLpa stamps
   * correctly when the candidate states a counter, not to weaken the
   * gate.) */
  /* Class-A (2026-06-15) — totalScopedCounter returns null for FIXED-scoped
   * counters ("₹26 LPA fixed at minimum"), which are raise-the-base asks, not
   * acceptance of the TOTAL. Comparing a fixed ask against highestOfferMade (a
   * total) false-accepted the candidate while they were still pushing on base.
   * Only a total-scoped counter below the standing total offer is a genuine
   * guaranteed-accept; a fixed-scoped counter falls through to counter-base. */
  const autoAcceptCounter = totalScopedCounter(state);
  if (
    autoAcceptCounter != null &&
    state.highestOfferMade > 0 &&
    autoAcceptCounter <= state.highestOfferMade &&
    !isTerminalPhase(state.phase)
  ) {
    const accLpa = clampToCloseFloor(
      state,
      Math.min(state.highestOfferMade, autoAcceptCounter),
    );
    const jb = state.lastJoiningBonusOffered;
    return {
      kind: "auto-accept",
      _move: {
        lever: "close-acceptance",
        newTotalLpa: accLpa,
        joiningBonusAmount: jb != null ? jb : undefined,
        rationale: `Candidate counter ₹${autoAcceptCounter}L ≤ current offer ₹${state.highestOfferMade}L — guaranteed-accept signal; close at ₹${accLpa}L (floor = highest offer).`,
      },
    };
  }

  /* Negotiation-flow redesign commit 4 (2026-05-15) — reactive followup
   * rules. Per audit section C.2: candidate volunteers info out-of-order
   * (variable share, vague competing offer, long notice, big hike with
   * no proof, direct question, repeated refusal). The bot must react
   * to what was just disclosed BEFORE advancing the checklist. Inserted
   * here (above probe-mismatch) per session-2 agent's plan: only the
   * three precedence-1 gates (terminal restate, terminal close, auto-
   * accept) outrank reactive routing.
   *
   * Sources of truth:
   *   - delta = state.lastTurnDelta (commit 1; what changed this turn)
   *   - fired = state.reactiveFollowupsFired (sticky session ledger)
   *   - state.* (detail fields the delta booleans reference)
   *
   * Each rule consults `fired` so the same topic doesn't re-emit. */
  /* ITEM 3 (2026-05-15) — close-confirmation: fires whether or not lastTurnDelta
   * is set. When the candidate has signaled readiness to close (candidateSignaledClose=true,
   * set by applyCandidateAnswer when detectTrialCloseAsked fired on the prior bot turn)
   * AND the session hasn't already closed, emit a close-confirmation move. Placed outside
   * planReactiveFollowup so it fires even when lastTurnDelta is null (e.g. simulated states).
   * Priority: above reactive followups so close-readiness always gets a close move. */
  if (!isTerminalPhase(state.phase)) {
    const extState = state as NegotiationState & { candidateSignaledClose?: boolean; closeFired?: boolean };
    const closeFiredAlready = (state.reactiveFollowupsFired ?? []).includes("close-confirmation");
    if (
      extState.candidateSignaledClose &&
      !extState.closeFired &&
      !closeFiredAlready &&
      state.highestOfferMade > 0
    ) {
      /* #105 (2026-06-20, live-staging) — do NOT close when a pending FIXED
       * close-ask cannot be honored at/near the standing offer. Closing here
       * would land on the standing total framed as meeting the candidate's
       * terms while silently dropping the unmet fixed condition (the "we're
       * in the same range, lock it at ₹X" stealth under-close — confirmed
       * live: candidate asked ₹40L fixed against a ₹34.5L offer and the bot
       * closed at ₹34.5L). Fall through instead: the fixed-counter completion
       * sink (L3111+) re-routes the turn into counter-offer so the recruiter
       * honestly engages the base/structure cap. A DELIVERABLE fixed ask at or
       * within the near-offer gap is unaffected — nearOfferCloseNumber
       * converts it to its implied total and we close on that. */
      if (!fixedConditionBlocksClose(state)) {
        const jb = state.lastJoiningBonusOffered;
        /* #93 (2026-06-19, live-staging) — honor the candidate's near-offer
         * number on close. A candidate who signals close-readiness AT a
         * concrete number just above the standing offer ("36 and I'll sign
         * today") must be closed at THAT number when it's a trivial,
         * in-band gap — not short-changed back down to the standing offer.
         * Closing below the number the candidate offered to sign at is the
         * forbidden under-close (reads as bait-and-switch). Same gap math as
         * the #94 conditional-close gate: the larger of ₹2L or 6% of offer,
         * capped at the band ceiling. Outside that window we close at the
         * standing offer as before (clampToCloseFloor only raises, never
         * lowers, so a stray low counter can't drag the close down). */
        const closeAt = nearOfferCloseNumber(state);
        /* S73-B1 (2026-07-25) — premature session close before candidate
         * confirms. Previously fired close-acceptance here (lever =
         * "close-acceptance"), which caused applyAiMove to immediately stamp
         * phase = "accepted" and return conversationDone:true. The UI then
         * set waitForUser:false on the closing step, so when the candidate
         * pressed Continue (expecting to say "yes, I accept"), the session
         * ended without them getting a turn. A real recruiter meeting the
         * candidate's conditional ask says "₹70L — confirmed?" and WAITS for
         * the candidate to say yes. We mirror that: fire counter-base at the
         * candidate's ask number, the recruiter says "We can do ₹X — does
         * that work?", and the candidate gets one more turn to explicitly
         * accept. Only their confirmation (detected by classifyAcceptance in
         * applyCandidateAnswer) stamps verbalAcceptanceTurn → the proper
         * close sequence (close-recap-formal → post-acceptance-docs →
         * terminal close-acceptance) fires from there. */
        return {
          kind: "counter-offer",
          counterTotalLpa: clampToCloseFloor(state, closeAt),
          satisfiesTopic: "close-confirmation",
          _move: {
            lever: "counter-base",
            newTotalLpa: clampToCloseFloor(state, closeAt),
            joiningBonusAmount: jb != null ? jb : undefined,
            rationale: `S73-B1: Candidate signaled close readiness; recruiter meets ask at ₹${closeAt}L and waits for candidate confirmation before closing.`,
            askedTopic: "close-confirmation",
          },
        } as PlannedAction;
      }
    }
  }

  /* Near-offer conditional close-engagement (live-staging 2026-06-19, #94).
   *
   * When the candidate gives a CONDITIONAL acceptance — "if you can do 36,
   * that works for me", "provided you cover the buyout, I'm in" — they have
   * named the concrete terms on which they WILL sign. A real Indian recruiter
   * facing a conditional yes within a rupee of the offer MEETS it and closes;
   * they do not divert to interrogating the joining-bonus rationale (#94),
   * re-argue the band ceiling (#92), or stall on panel approval (#93). Those
   * are the exact forbidden "divert/stall on a near-offer close" failure
   * modes. The legacy planner had no branch for this — `conditionalAcceptance`
   * was parsed (decision-deadline module) but consulted ONLY as a downstream
   * LLM cosmetic hint, never by the kernel. We converge here, deterministically.
   *
   * Precedence: below the auto-accept gate (a counter ≤ offer is already a
   * guaranteed accept) and the trial-close gate, above every probe / lever /
   * ceiling path. Single source of truth: the converge number is the kernel's
   * own bound counter (totalScopedCounter → lastCandidateCounterLpa); the JB
   * amount the candidate asked for is NOT bound as a target (component-bonus
   * guard in the classifier), so it can never inflate the close.
   *
   * Guard rails:
   *   - Only fires on a fresh conditional acceptance (merge is last-stated-wins).
   *   - A concrete counter only converges when it sits WITHIN a small gap above
   *     the standing offer AND at/under the band ceiling — a conditional ask
   *     beyond the ceiling or far above the offer is a genuine gap the normal
   *     counter/hold-firm logic must still work, so we fall through there.
   *   - A conditional yes with NO cash number (a non-cash condition — "once you
   *     confirm the band, that's acceptable") closes at the standing offer. */
  if (
    !isTerminalPhase(state.phase) &&
    state.highestOfferMade > 0 &&
    state.decisionDeadline?.conditionalAcceptance === true
  ) {
    const offer = state.highestOfferMade;
    const ceil = state.band.maxStretch;
    /* #105 (2026-06-20, live-staging) — scope-aware conditional close.
     * A FIXED-scoped conditional ask ("if you can do ₹40L fixed, I'll sign")
     * is not a total: totalScopedCounter() returns null, and the live
     * classifier records the figure on candidateTargetFixed with
     * lastCounterComponent left null. The legacy gate consulted ONLY counters,
     * so condNum was null and it closed at the standing offer framed "we're in
     * the same range" — a stealth under-close that silently dropped the unmet
     * fixed term (confirmed live: ₹40L fixed ask vs ₹34.5L offer closed at
     * ₹34.5L). Now we resolve the close figure by scope, in priority:
     *   1. a TOTAL counter (totalScopedCounter) — the #94 path;
     *   2. a FIXED ask (counter or candidateTargetFixed) → its implied total,
     *      honored ONLY when the band can deliver it AND it sits within the
     *      near-offer gap; otherwise we do NOT close (fall through to the
     *      fixed-counter cascade which engages the base/structure cap);
     *   3. no number at all (a pure non-cash condition) → close at the offer.
     * Gap a recruiter will close instantly: the larger of ₹2L or 6% of the
     * standing offer. Wider gaps remain a live negotiation. */
    const gap = Math.max(2, offer * 0.06);
    const totalCounter = totalScopedCounter(state);
    const fixedAsk = resolveFixedCloseAsk(state);
    let closeAt: number | null = null;
    if (totalCounter != null) {
      if (totalCounter <= ceil && totalCounter - offer <= gap) {
        closeAt = Math.max(offer, totalCounter);
      }
    } else if (fixedAsk != null) {
      const delivered = fixedScopedCloseTotal(state);
      if (delivered != null && delivered <= ceil && delivered - offer <= gap) {
        closeAt = Math.max(offer, delivered);
      }
      /* else: undeliverable, or a real gap above the offer → fall through. */
    } else {
      /* #129 (2026-06-21, live-staging) — close-number fidelity. A firm accept
       * that restates an in-band figure matching the candidate's sticky target
       * ("46 works, I'll sign today" after asking for 46) commits to THAT
       * number; closing at the bare standing offer shortchanges the agreed
       * deal. Honored above the near-offer gap because this is an ACCEPT (the
       * candidate has stopped bargaining at their stated number), not a fresh
       * counter to haggle — capped at the band ceiling, never below the offer.
       * A bare "done"/"ok" with no figure returns null → close at the offer. */
      /* Canonical demand veto, computed ONCE and consulted by BOTH close paths
       * below (single source — the same analyzeDemand the acceptance gates use).
       * Only CASH cores veto: a non-numeric sweetener ("throw in a joining
       * bonus") is deliverable in-place via the JB grant below (PRI-63) and must
       * still close. Over-blocking a genuine bare accept costs one turn; a
       * false-close is unrecoverable. */
      const demand = analyzeDemand(latestCandidateText(state), offer);
      const unmetCashDemand =
        demand.unmet &&
        demand.reasons.some((r) => !NON_CASH_DEMAND_REASONS.has(r));
      const agreed = acceptanceUtteranceFigure(state);
      if (agreed != null && agreed > offer && agreed <= ceil && !unmetCashDemand) {
        /* #129 close-number fidelity — but NOT when an unmet cash demand is on
         * the table. acceptanceUtteranceFigure only corroborates a figure near
         * the sticky target; it is demand-blind, so "beat the 47" (a competing
         * figure the candidate wants EXCEEDED) resolved to a false-close AT 47
         * (offline battery, 2026-07-09). The veto routes it to a live counter. */
        closeAt = agreed;
      } else {
        /* PRI-68 (2026-07-07) — a conditional accept that demands MORE cash on
         * the standing offer ("I'll accept if you bump the fixed by another
         * 2L") resolves to an implied total. Meet it only when deliverable —
         * at/under the ceiling AND within the instant-close gap; otherwise
         * DECLINE (null → fall through to hold/counter) rather than closing at
         * the un-bumped offer and silently dropping the candidate's condition.
         * A target already at/under the offer is effectively an accept (close
         * at offer); a pure non-cash condition or bare accept resolves to null
         * here and closes at the offer, unchanged. */
        const bumpTarget = resolveConditionalCashTarget(state, offer);
        if (bumpTarget == null) {
          /* No quantifiable cash target from the local resolver — either a
           * pure non-cash condition / bare accept (close at the offer) OR a
           * real cash demand this resolver's parser could not read (a
           * crore-scale figure, a prepositionless landing verb, a floor
           * expression, a bare competing figure). Defer to the canonical
           * demand veto computed above so an unparsed-but-real demand cannot
           * fall through to a false-close at the un-bumped offer ("I'll take it
           * if the package hits 1.2 crore" — batch-5 leak, 2026-07-09). */
          closeAt = unmetCashDemand ? null : offer;
        } else if (bumpTarget <= offer) {
          closeAt = offer;
        } else if (bumpTarget <= ceil && bumpTarget - offer <= gap) {
          closeAt = bumpTarget;
        } else {
          closeAt = null;
        }
      }
    }
    if (closeAt != null) {
      /* PRI-63 (2026-06-25, real prod salary-negotiation audit, session
       * f22e215b — Flipkart EM). The conditional acceptance can rest on an
       * UNMET non-cash sweetener the candidate explicitly named as their
       * closing condition ("if you throw in a joining bonus I can make it
       * work" → wantsJoiningBonus=true, lastJoiningBonusOffered=null). The
       * legacy gate closed at the standing offer with no JB — silently
       * DROPPING the condition. The recap then enumerated a deal (₹offer flat)
       * the candidate never agreed to: a soft FALSE-CLOSE, the worst failure
       * mode. Honor the condition in-place — size a one-time joining bonus via
       * the single-source computeJoiningBonusAmount and carry it on the close,
       * so buildCloseRecapFormal enumerates it ("joining bonus ₹XL with an
       * N-month clawback") and the report reflects it. The JB is one-time and
       * never folded into the LPA total (deriveOfferFixedVariable ignores it),
       * so the close FIGURE is unchanged — no cash over-concession, just the
       * sweetener the candidate asked for actually granted. */
      const unmetJoiningBonus =
        state.candidateProfile?.wantsJoiningBonus === true &&
        state.lastJoiningBonusOffered == null;
      const jb = unmetJoiningBonus
        ? computeJoiningBonusAmount(state)
        : state.lastJoiningBonusOffered;
      return {
        kind: "close",
        mode: "accept",
        joiningBonusGranted: unmetJoiningBonus && jb != null ? jb : undefined,
        _move: {
          lever: "close-acceptance",
          newTotalLpa: clampToCloseFloor(state, closeAt),
          joiningBonusAmount: jb != null ? jb : undefined,
          rationale: unmetJoiningBonus
            ? `Near-offer conditional acceptance on an UNMET joining-bonus ask — grant one-time ₹${jb}L JB and close at ₹${closeAt}L (offer ₹${offer}L, ceiling ₹${ceil}L) so the recorded deal honors the condition rather than silently dropping it.`
            : `Near-offer conditional acceptance: deliverable close at ₹${closeAt}L (offer ₹${offer}L, ceiling ₹${ceil}L); converge and close rather than divert.`,
          askedTopic: "close-confirmation",
        },
      };
    }
  }

  /* ITEM 3 (2026-05-15) — equity-clarity probe: fires when band has equity,
   * the last bot reply contained equity language but did not cover all four
   * clarity pillars, and the equity-clarity probe hasn't been fired yet.
   * Placed above planReactiveFollowup so it fires even when lastTurnDelta is
   * null (e.g. when candidate asks "what does the equity look like?"). */
  /* PDF#35 Move 3 (2026-05-18) — explicit "no equity" disclosure also
   * silences the equity-clarity probe. The PDF#33 gate already requires
   * `equityExists === true`; this comment documents the symmetric
   * exit so future readers don't reintroduce a default-narrate
   * regression. When the candidate has stated `equity === null` on the
   * breakdown AND equityVesting carries the explicit-none signal, no
   * equity-related reactive followup may fire — regardless of which
   * planner branch is below. */
  const equityExplicitlyNone =
    state.equityVesting?.equityExists === false ||
    (state.candidateComponentBreakdown?.equity === null &&
      state.candidateComponentBreakdown?.hasAny === true &&
      /\b(?:no\s+(?:equity|esops?|rsus?|stock|stocks?|options?)|don'?t\s+(?:get|have)\s+(?:any\s+)?(?:equity|esops?|rsus?|stock)|nothing\s+like\s+(?:that|it))\b/i.test(
        (() => {
          const log = state.conversationLog ?? [];
          for (let i = log.length - 1; i >= 0; i--) {
            const e = log[i];
            if (e && e.speaker === "candidate") return e.text || "";
          }
          return "";
        })(),
      ));
  if (
    !isTerminalPhase(state.phase) &&
    state.band.hasEquity &&
    !equityExplicitlyNone &&
    /* PDF#33 architectural flip (2026-05-18) — narrate equity ONLY when
     * the candidate has *explicitly confirmed* equity exists. Prior
     * gate was `equityExists !== false`, which lets `null` (unknown)
     * through; combined with regex-only negation detection that misses
     * colloquial denials like "nothing like it" / "we don't get any",
     * this shipped equity-vesting walkthroughs to cash-only candidates
     * (Meesho Sr PD T7). The default-narrate posture is wrong for a
     * probe topic — silence is correct when status is unknown. We now
     * only narrate on confirmed `=== true`. */
    state.equityVesting?.equityExists === true
  ) {
    const equityFired = (state.reactiveFollowupsFired ?? []).includes("equity-clarity");
    if (!equityFired) {
      const lastBotReply = state.lastAiText ?? "";
      const hasEquityLanguage = /\b(equity|esop|rsu|stock|options?|vesting|cliff)\b/i.test(lastBotReply);
      if (hasEquityLanguage) {
        const clarity = analyzeEquityClarity(lastBotReply);
        if (!clarity.allFourCovered) {
          return {
            kind: "reactive-followup",
            /* BUG E audit (PDF#31, 2026-05-18) — `ask` is candidate-
             * facing prose, never an internal directive. The
             * directive-shape "Clarify equity terms (vesting, strike/
             * FMV, buyback history, included-vs-additional) before
             * discussing comp." was a planner-internal note that has
             * no business being shipped to the candidate. The canonical-
             * prose equity-clarity branch already returns explicit
             * recruiter prose; the `ask` here is the fallback safety
             * net for that case. The four clarity-pillars belong in
             * the rationale, not the ask. */
            /* PDF#33 (2026-05-18) — substantive ask, not a teaser.
             * Prior fallback was "let me walk you through how the
             * vesting and cliff are structured for this grade" which
             * promised content the kernel never delivered. Now asks the
             * candidate to disclose schedule + cliff, which is the
             * actual signal the equity-clarity probe needs. */
            ask: "On the equity part — what's the vesting schedule and cliff on your current grant?",
            trigger: "equityUnclear",
            topic: "equity-clarity",
            satisfiesTopic: "equity-clarity",
            _move: {
              lever: "probe",
              newTotalLpa: null,
              rationale: "equity: last bot reply mentioned equity but did not cover all four clarity pillars — probe equity terms.",
              actionKind: "reactive-followup",
              askedTopic: "equity-clarity",
            },
          };
        }
      }
    }
  }

  /* ResumeFactPack track Step 4 (2026-05-16) — credibility-probe.
   * Fires when a stated current-company affiliation conflicts with the
   * resume's latest role / prior companies. Single-fire. Skipped when
   * the resume confirms (and the avoidance is logged in leversUsed for
   * visibility — handled at applyAiMove). */
  if (
    !isTerminalPhase(state.phase) &&
    !state.credibilityProbeFired &&
    state.candidateStatedCurrentCompany &&
    state.resumeFactPack
  ) {
    const stated = state.candidateStatedCurrentCompany;
    if (!resumeConfirmsCompany(state.resumeFactPack, stated)) {
      const resumeCompany = state.resumeFactPack.latestRole?.companyName ?? "";
      if (resumeCompany) {
        return {
          kind: "credibility-probe",
          resumeCompany,
          statedCompany: stated,
          satisfiesTopic: "credibility-probe",
          _move: {
            lever: "probe",
            newTotalLpa: null,
            rationale:
              `credibility-probe: candidate stated "${stated}" but resume latest role is ` +
              `"${resumeCompany}" — surface the alignment gap before counter.`,
            askedTopic: "credibility-probe",
          },
        };
      }
    }
  }

  /* Bug-D (2026-06-19) — recruiter-anchors-once-discovery-sufficient, call
   * site (1). Hoisted ABOVE planReactiveFollowup / warm-ack / callback-prior-
   * context / live-walk-away: once current CTC + target are known and no offer
   * is on the table, STATE THE BAND rather than fire another reactive probe.
   * Without this the planner re-probed every turn, never anchored, and a later
   * acceptance with no standing offer routed to live-walk-away (cardinal
   * failure). Stays BELOW the equity-clarity and credibility probes above —
   * those are legitimate one-shot pre-anchor clarifications. */
  if (!isTerminalPhase(state.phase)) {
    const earlyAnchor = planDiscoverySufficientAnchor(state);
    if (earlyAnchor) return earlyAnchor;
    /* #121 (2026-06-21) — stonewall companion to the discovery-sufficient
     * anchor, same priority slot (above reactive-followups). Fires only
     * when the candidate has disclosed NOTHING for STONEWALL_ANCHOR_TURNS+
     * turns with no offer on the table — states the band floor to break
     * the deadlock instead of re-probing into a ₹0-offer stalemate. */
    const stonewallAnchor = planStonewallAnchor(state);
    if (stonewallAnchor) return stonewallAnchor;
  }

  /* #128 (2026-06-21, live-staging Flipkart-EM) — in-band conditional-accept
   * convergence routing. When the candidate has named a concrete TOTAL number
   * as a conditional acceptance ("if you can do 46 I'm in") that sits within
   * the band ceiling but ABOVE the near-offer instant-close gap, the
   * conditional-close block above deliberately falls through (a 7L gap on a
   * 39L offer is a genuine live negotiation, not an instant close). The bug
   * was that flow then hit the reactive justify-probe, which interrogates the
   * candidate for the very number they just committed to — a tone-deaf stall.
   * The structural fix is pure ROUTING: this is a convergence signal, so yield
   * the reactive/wired probes and let flow reach the counter-base concession
   * engine (single source of truth), which steps the cash anchor UP toward the
   * number (and, via #92, matches a named in-band competing offer). Subsequent
   * turns narrow the gap until the near-offer close fires — realistic Indian-HR
   * convergence rather than a probe loop. Gated tightly: an above-ceiling
   * conditional number is NOT in-band, so it still falls to the normal
   * hold/walk-away path (negotiationConditionalClose.test.ts live-negotiation
   * lock preserved). */
  const inBandConditionalConverge = (() => {
    if (isTerminalPhase(state.phase)) return false;
    if (!(state.highestOfferMade > 0)) return false;
    if (state.decisionDeadline?.conditionalAcceptance !== true) return false;
    const gap = Math.max(2, state.highestOfferMade * 0.06);
    const tc = totalScopedCounter(state);
    if (tc != null) {
      return tc <= state.band.maxStretch && tc - state.highestOfferMade > gap;
    }
    /* PRI-55 (2026-06-22, product call) — a FIXED-scoped conditional
     * acceptance ("34 fixed and I'll sign") is equally a convergence signal,
     * but totalScopedCounter is null for it, so the original #128 gate ignored
     * it: flow fell to the justify-probe and then closed at the bare ₹floor — a
     * stealth under-close the candidate never agreed to (PRI-55 repro: 34-fixed
     * ask vs ₹28L offer, ceiling ₹42L, closed ₹28L). When the band can deliver
     * the implied total (fixedScopedCloseTotal != null) and it sits in-band but
     * above the near-offer instant-close gap, route it through the SAME
     * concession engine so the cash anchor steps UP toward the number and the
     * near-offer close fires at the converged figure rather than the floor.
     * Undeliverable or above-ceiling asks stay null → normal hold/walk-away. */
    const deliveredFixed = fixedScopedCloseTotal(state);
    if (deliveredFixed != null) {
      return deliveredFixed <= state.band.maxStretch &&
        deliveredFixed - state.highestOfferMade > gap;
    }
    return false;
  })();

  /* S55-B2 (2026-07-24) — when a fresh counter arrived this turn against a
   * live offer (lastCandidateCounterLpa != null AND highestOfferMade > 0),
   * reactive/wired followups must NOT pre-empt the counter-offer engine.
   * A real recruiter ALWAYS responds to the number first; sidebars like
   * tax-implication can wait until after the concession move.
   * Guard: highestOfferMade > 0 prevents bypassing wired-profile followups in
   * DISCOVERY phase when the candidate first names a target (which also sets
   * lastCandidateCounterLpa). Only planWiredProfileFollowup is bypassed —
   * planReactiveFollowup remains active so discovery-phase reactives like
   * hike-justification (load-bearing, first-time target disclosure) are never
   * silenced by a fresh counter. This differs from inBandConditionalConverge
   * which bypasses both; here only the decorative wired-flag reactives are
   * pre-empted so the counter-offer engine can own the turn. */
  const hasFreshCounter =
    state.lastCandidateCounterLpa != null && state.highestOfferMade > 0;
  if (!isTerminalPhase(state.phase) && !inBandConditionalConverge) {
    const reactive = planReactiveFollowup(state);
    if (reactive) return reactive;
    /* Fix 5 (2026-05-16) — state-based wired profile-flag rules. These
     * read candidateProfile booleans directly (not lastTurnDelta), so
     * they fire even on simulated states without a per-turn delta.
     * S55-B2 (2026-07-24) — bypass when fresh counter is present so the
     * counter-offer engine responds first; wired probes (tax-implication
     * etc.) can wait until the next AI turn. */
    if (!hasFreshCounter) {
      const wired = planWiredProfileFollowup(state);
      if (wired) return wired;
    }
  }

  /* Memory-callback feature (2026-05-29) — competing-offer warm
   * acknowledgment. Slotted AFTER reactive-followup (so structural
   * leverage challenges like fake-leverage-challenge / competitor-match
   * still pre-empt) but ABOVE routine probes — adds genuine warmth
   * when the conversational space allows. Single-fire per session. */
  {
    const warmAck = maybePlanCompetingOfferWarmAck(state);
    if (warmAck !== null) return warmAck;
  }

  /* Memory-callback feature (2026-05-29) — periodic call-back to a
   * prior-stated fact. Same priority slot as the warm-ack: BELOW
   * crisis/contradiction/reactive branches, ABOVE routine discovery
   * probes. Single-fire per session; turn ≥ 4. */
  {
    const cb = maybePlanCallbackPriorContext(state);
    if (cb !== null) return cb;
  }

  /* PDF #17 — probe-mismatch routing. */
  if (
    state.discoveryStage === "probe-mismatch" &&
    !isTerminalPhase(state.phase)
  ) {
    return {
      kind: "probe-mismatch",
      satisfiesTopic: "probe",
      _move: {
        lever: "probe",
        newTotalLpa: null,
        rationale:
          "Discovery stage = probe-mismatch: probe the resume↔role domain switch BEFORE anchoring or discussing comp.",
      },
    };
  }

  /* Fix 1 (2026-05-16) — walk-away gap-gate. When the candidate's
   * target exceeds bandCeiling * 1.5, the gap is structurally
   * unbridgeable; walk-away regardless of turn count (overrides the
   * minTurnsBeforeClose guard below). Threshold sits just above the
   * legacy counter-offer stiffening fixture (target=40, ceiling=28,
   * ratio≈1.43) to preserve the schedule semantics. */
  /* Class-A (2026-06-15) — in-hand-adjust the total before the gap test so an
   * in-hand ask isn't measured against the TOTAL ceiling in the wrong frame.
   * Kept to stated TOTAL targets only (a fixed-component ask doesn't trigger a
   * terminal gap walk-away). */
  /* S3-B11/B13 (2026-07-22) — offer-first guard. Before walking away, the
   * recruiter MUST make at least one offer so the candidate knows what is
   * actually on the table. If highestOfferMade === 0, anchor the ceiling offer
   * first; the walk-away fires on the NEXT turn after the candidate reacts.
   * Only emitting a walk-away without any prior offer produces a session that
   * feels abrupt and trains the candidate nothing ("how much does HireStepX
   * pay? I never found out"). The anchor is a point-offer at band.maxStretch
   * (the best the recruiter can do) — an honest disclosure that the candidate
   * can accept or walk away from themselves. */
  const gapGateTarget = statedTotalTargetCtcLpa(state);
  if (
    !isTerminalPhase(state.phase) &&
    state.phase !== "opening" &&
    gapGateTarget != null &&
    gapGateTarget > state.band.maxStretch * 1.5
  ) {
    if (state.highestOfferMade === 0) {
      /* No offer yet — make one at the ceiling before walking away. */
      const ceilingOffer = state.band.maxStretch;
      return {
        kind: "anchor-with-offer",
        initialOffer: ceilingOffer,
        bandIncomplete: false,
        satisfiesTopic: "band-anchor-with-rationale",
        _move: {
          lever: "probe",
          newTotalLpa: ceilingOffer,
          rationale:
            `S3-B11/B13 offer-first anchor: candidate target ₹${gapGateTarget}L exceeds ` +
            `band ceiling ₹${state.band.maxStretch}L by >50% — anchoring at ceiling before walk-away ` +
            `so candidate sees what is actually on the table.`,
          askedTopic: "band-anchor-with-rationale",
          actionKind: "anchor-with-offer",
        },
      } as PlannedAction;
    }
    return {
      kind: "live-walk-away",
      mode: "walk",
      _move: {
        lever: "close-walkaway",
        newTotalLpa: null,
        rationale:
          `Walk-away gap-gate: candidate target ₹${gapGateTarget}L exceeds ` +
          `band ceiling ₹${state.band.maxStretch}L by >50% — gap is structurally unbridgeable.`,
      },
    };
  }

  /* Sprint B.1 — live recruiter walk-away (turn-gated). */
  if (!isTerminalPhase(state.phase) && state.phase !== "opening") {
    const wa = recommendWalkAway(state);
    if (wa.walk) {
      const minTurns = state.minTurnsBeforeClose ?? 8;
      const lastCandidateText = (() => {
        const log = state.conversationLog ?? [];
        for (let i = log.length - 1; i >= 0; i--) {
          const e = log[i];
          if (e && e.speaker === "candidate") return e.text || "";
        }
        return "";
      })();
      const declineAllowed = canCloseSession(state, lastCandidateText, "decline");
      const explicitDecline =
        declineAllowed &&
        /\b(walk away|walking away|not interested|withdraw|decline|won.?t work|isn.?t going to work|move on|no thanks|pass on this|not the right fit|nahi\s+(?:chahiye|karna|banega))\b/i.test(lastCandidateText);
      if (state.turnIndex >= minTurns || explicitDecline) {
        /* S25-B2 (2026-07-22) — offer-first guard in Sprint B.1.
         *
         * The gap-gate above (line ~3703) only fires when target > 1.5×
         * maxStretch. For targets in the 1.2×–1.5× range, condition (1)
         * of recommendWalkAway fires at turn ≥ minTurns but there was no
         * prior offer-first anchor — walking away with highestOfferMade
         * === 0 trains the candidate nothing ("what was their best
         * number?"). Mirror the gap-gate offer-first pattern: anchor at
         * the ceiling NOW so the candidate sees the best offer on the
         * table; the walk fires on the NEXT turn after they react.
         * Only fires once (highestOfferMade === 0 guard); subsequent
         * turns with highestOfferMade > 0 fall through to the normal
         * walk return below. */
        if (state.highestOfferMade === 0) {
          const ceilingOffer = state.band.maxStretch;
          return {
            kind: "anchor-with-offer",
            initialOffer: ceilingOffer,
            bandIncomplete: false,
            satisfiesTopic: "band-anchor-with-rationale",
            _move: {
              lever: "probe",
              newTotalLpa: ceilingOffer,
              rationale:
                `S25-B2 offer-first anchor: walk signal (${wa.reason}) ` +
                `at turn ${state.turnIndex} ≥ minTurns ${minTurns}; ` +
                `anchoring at ceiling (₹${ceilingOffer}L) before walk-away ` +
                `so candidate sees the best offer on the table.`,
              askedTopic: "band-anchor-with-rationale",
              actionKind: "anchor-with-offer",
            },
          } as PlannedAction;
        }
        return {
          kind: "live-walk-away",
          mode: "walk",
          _move: {
            lever: "close-walkaway",
            newTotalLpa: null,
            rationale: `Live walk-away: ${wa.reason}`,
          },
        };
      }
      /* S48-B8 (2026-07-24) — BATNA-pressure concession attempt.
       *
       * When the walk signal is suppressed (early turn) AND the candidate's
       * last utterance contains competing-offer / "other conversations" BATNA
       * language, the correct recruiter move is a cash concession attempt, NOT
       * hold-firm. Holding firm on BATNA pressure signals inflexibility and
       * trains the candidate that having alternatives doesn't help. The
       * distinction from a real walk-away:
       *   • Real walk-away ("I'm out", "not interested") → hold-firm / probe
       *   • BATNA pressure ("other conversations are moving forward", "I have
       *     another offer") → concession attempt so the recruiter stays competitive
       *
       * We only fire this when there is concrete headroom: the current offer
       * must be below maxStretch (otherwise there is genuinely nothing to give).
       * The concession is a half-step counter: midpoint between current offer
       * and maxStretch, rounded to nearest 0.5L. If that equals the standing
       * offer (no headroom), fall back to hold-firm. */
      const BATNA_PRESSURE_RE = /\b(?:other\s+conversations?|other\s+offers?|other\s+opportunities?|other\s+companies|another\s+offer|competing\s+offer|offer\s+in\s+hand|offer\s+on\s+the\s+table|in\s+process\s+with|interviewing\s+(?:with|at|elsewhere)|evaluating\s+other|in\s+talks\s+with|multiple\s+offers?|other\s+options?|let\s+(?:it|them|those)\s+(?:progress|move\s+forward|proceed))\b/i;
      const candidateHasBatna = BATNA_PRESSURE_RE.test(lastCandidateText);
      if (state.highestOfferMade > 0 && candidateHasBatna) {
        const standingOffer = state.highestOfferMade;
        const ceiling = state.band.maxStretch;
        const headroom = ceiling - standingOffer;
        if (headroom >= 0.5) {
          const concessionAmount = Math.round((standingOffer + headroom * 0.5) * 2) / 2;
          return {
            kind: "counter-offer",
            counterTotalLpa: concessionAmount,
            satisfiesTopic: "counter-base",
            _move: {
              lever: "counter-base",
              newTotalLpa: concessionAmount,
              rationale:
                `S48-B8 BATNA-pressure concession: candidate signalled competing offer/conversations at turn ${state.turnIndex}; ` +
                `walk suppressed (< minTurns ${minTurns}) — trying a half-step concession from ₹${standingOffer}L ` +
                `to ₹${concessionAmount}L (ceiling ₹${ceiling}L) to stay competitive.`,
            },
          } as PlannedAction;
        }
      }
      if (state.highestOfferMade > 0) {
        return {
          kind: "live-walk-away",
          mode: "hold-firm",
          _move: {
            lever: "hold-firm",
            newTotalLpa: state.highestOfferMade,
            rationale: `Walk-away signal (${wa.reason}) suppressed: turn ${state.turnIndex} < minTurnsBeforeClose ${minTurns}; hold-firm instead.`,
          },
        };
      }
      return {
        kind: "live-walk-away",
        mode: "probe",
        _move: {
          lever: "probe",
          newTotalLpa: null,
          rationale: `Walk-away signal (${wa.reason}) suppressed: turn ${state.turnIndex} < minTurnsBeforeClose ${minTurns}; probe instead.`,
        },
      };
    }
  }

  /* PDF#35 Move 1 (2026-05-18) — post-anchor planner branches.
   *
   * Symptom (BUG 6/7/8): after the recruiter put a number on the table
   * (state.highestOfferMade > 0), the candidate said "Works for me" /
   * "Sounds good" / "Could we make it 32?" / "What was the offer
   * again?" — but `phase === "range-disclosure"` was still set so the
   * planner kept hitting `band-disclosure-deflect`. Result:
   * post-anchor deflection lock; no close, no recap, no counter
   * engagement.
   *
   * Fix: three short-circuit branches inserted ABOVE the
   * `band-disclosure-deflect` gate.
   *
   *   (a) Post-anchor acceptance close — verbalAcceptanceTurn was
   *       stamped this turn → route to close{mode:"accept"}.
   *   (b) Offer-recap — lastAnswerOfferRecapAtTurn stamped → route to
   *       a deterministic recap of the standing offer.
   *   (c) Counter-engagement post-anchor — lastCandidateCounterLpa >
   *       highestOfferMade → fall through (return null here so the
   *       counter-offer planner branch downstream takes the turn,
   *       instead of band-disclosure-deflect winning the race). */
  if (state.highestOfferMade > 0 && !isTerminalPhase(state.phase)) {
    /* Class-A (2026-06-15) — the counter-engagement escapes (c) below must
     * compare a TOTAL counter against the total offer. A fixed-scoped counter
     * is excluded (totalScopedCounter → null); it routes to counter-base via
     * the fixed-counter branch, not these total-vs-total force-routes. */
    const totalCounter = totalScopedCounter(state);
    /* (a) Acceptance close: candidate signalled acceptance THIS turn
     * (state.verbalAcceptanceTurn === state.turnIndex). The terminal
     * close branch above requires phase === "accepted"; that flip is
     * derivePhase's job and happens on the NEXT turn. We need the
     * close to fire on the SAME turn the acceptance lands. */
    if (
      state.verbalAcceptanceTurn != null &&
      state.verbalAcceptanceTurn === state.turnIndex &&
      !(state.reactiveFollowupsFired ?? []).includes("close-confirmation")
    ) {
      const jb = state.lastJoiningBonusOffered;
      /* #93 — honor a near-offer accepted number (e.g. "36 and I'll sign
       * today") rather than short-changing back to the standing offer. */
      const closeAt = nearOfferCloseNumber(state);
      return {
        kind: "close",
        mode: "accept",
        _move: {
          lever: "close-acceptance",
          newTotalLpa: clampToCloseFloor(state, closeAt),
          joiningBonusAmount: jb != null ? jb : undefined,
          rationale: `Post-anchor acceptance: candidate verbally accepted at turn ${state.verbalAcceptanceTurn}; close at ₹${closeAt}L (offer ₹${state.highestOfferMade}L).`,
          askedTopic: "close-confirmation",
        },
      };
    }

    /* (b) Offer-recap: candidate asked to be reminded of the standing
     * offer. Parser stamped state.lastAnswerOfferRecapAtTurn on the
     * just-completed candidate turn. */
    if (
      state.lastAnswerOfferRecapAtTurn != null &&
      state.lastAnswerOfferRecapAtTurn >= state.turnIndex - 1
    ) {
      return {
        kind: "offer-recap",
        offerLpa: state.highestOfferMade,
        _move: {
          lever: "probe",
          newTotalLpa: null,
          rationale: `Post-anchor offer-recap: candidate asked to restate the standing offer at turn ${state.lastAnswerOfferRecapAtTurn}; recap ₹${state.highestOfferMade}L without re-anchoring.`,
        },
      };
    }

    /* (c) Counter-engagement post-anchor: candidate countered ABOVE
     * the current offer. The auto-accept gate above (line ~936)
     * already handles counter ≤ offer; the >offer case must NOT
     * deflect — fall through so the counter-offer planner branch
     * downstream gets the turn. We skip the band-disclosure-deflect
     * by returning a hold-firm/probe wrapper that's structurally a
     * pass-through; the cleanest architectural way is to clear the
     * range-disclosure phase guard for this case. Since planNextAction
     * runs on a frozen state, we instead emit a `live-walk-away`
     * mode:probe wrapper here is wrong — what we really want is for
     * the counter-offer branch to fire. The counter-offer branch is
     * deep in pickCounterOrLever (called below). To route through
     * cleanly, we simply DO NOT short-circuit here; the
     * band-disclosure-deflect block below also checks state.phase ===
     * "range-disclosure", which derivePhase has already moved past
     * once highestOfferMade > 0 in a healthy state. In the buggy
     * sessions the phase was sticky on range-disclosure even after
     * the anchor; we now break that lock by force-routing past it
     * when the candidate's counter is on the table. */
    if (
      totalCounter != null &&
      totalCounter > state.highestOfferMade &&
      state.phase === "range-disclosure"
    ) {
      /* Force the planner to skip band-disclosure-deflect by treating
       * the state as if it were counter-offer phase for the remainder
       * of this turn. We construct a derived state inline (no mutation
       * — planNextAction is pure) and recurse. Recursion is bounded:
       * the recursive call sees phase !== "range-disclosure" so it
       * cannot re-enter this branch. */
      const derived: NegotiationState = { ...state, phase: "counter-offer" };
      return planNextActionInternal(derived);
    }

    /* PDF#44 Bug A (2026-05-25, re-read of Flipkart Sr-PD session) —
     * candidate stated expectation of ₹46L against an offer of ₹42.4L.
     * lastCandidateCounterLpa stamped correctly (46 > 42.4) but phase had
     * already advanced past "range-disclosure" to "offer-presented" /
     * "probe-expectations" (target not yet bound when derivePhase ran, or
     * cleared by a subsequent non-numeric filler turn). The L1799 override
     * misses, the info-disclosure intent-override at L2285+ eats the
     * turn, and the candidate's counter never reaches the counter-offer
     * planner branch. Widen the override to fire across any non-terminal
     * phase that ISN'T already counter-offer (which has its own native
     * branch at L2703). Same bounded-recursion guard: the recursive call
     * sees phase === "counter-offer" so this branch is skipped. */
    if (
      totalCounter != null &&
      totalCounter > state.highestOfferMade &&
      state.phase !== "counter-offer" &&
      state.phase !== "range-disclosure" &&
      state.phase !== "opening"
    ) {
      const derived: NegotiationState = { ...state, phase: "counter-offer" };
      return planNextActionInternal(derived);
    }

    /* THIRD completion sink (live-staging, 2026-06-17) — FIXED-scoped
     * counter-as-question force-route.
     *
     * The branches above (c)/PDF#44 only catch TOTAL-scoped counters
     * (`totalScopedCounter()` returns null for fixed-scoped ones). A
     * candidate who counters on the FIXED axis but phrases it as a
     * question ("I was targeting 50 fixed — can we get closer?") sets
     * `askedQuestion`, which made the downstream generic `answer-direct`
     * reactive branch pre-empt counter handling and ship a content-free
     * "let me note that and come back" deflection — the recruiter never
     * engaged the counter, so the negotiation could not close.
     *
     * Mirror the total-counter force-route: when a fresh fixed-scoped
     * counter is live and we have an offer on the table, route into the
     * counter-offer phase so the native counter handling engages it. */
    if (
      state.lastCandidateCounterLpa != null &&
      state.lastCounterComponent === "fixed" &&
      state.phase !== "counter-offer" &&
      state.phase !== "range-disclosure" &&
      state.phase !== "opening"
    ) {
      const derived: NegotiationState = { ...state, phase: "counter-offer" };
      return planNextActionInternal(derived);
    }
  }

  /* PDF#18 — range-disclosure phase override.
   *
   * Phase 2 Indian-HR redesign (2026-05-17): the lever is now
   * `band-disclosure-deflect` — real Indian HR recruiters do NOT disclose
   * internal bands; they deflect and offer to take the candidate's
   * expectation back to the panel. The PHASE name is retained as a state-
   * machine marker; only the rendered lever / prose changed. */
  if (state.phase === "range-disclosure" && !isTerminalPhase(state.phase)) {
    /* Deflect-loop fix (2026-06-15) — break the band-disclosure-deflect
     * sink.
     *
     * The deflect lever emits newTotalLpa:null, so it never advances
     * highestOfferMade; and it discloses no literal range, so applyAiMove
     * never stamps rangeDisclosedAtTurn (kernel ~6538). derivePhase only
     * leaves range-disclosure when a number lands (highestOfferMade>0,
     * kernel ~5845) OR a range was emitted (~5851) — neither of which a
     * deflect produces. So once the candidate has put a usable target on
     * the table, repeating the deflect is a closed loop: T4-T8 of
     * salary-negotiation-happy-path-trace.json restate the identical
     * deflection verbatim while highestOfferMade stays pinned at 0 and the
     * recruiter never actually anchors.
     *
     * Fix: the deflect is only correct as a ONE-shot response to a bare
     * "what's your band?" ask BEFORE the candidate has revealed a number.
     * The moment number-discipline allows it — candidate target on the
     * table (total or fixed-scoped, via canDiscloseSpecificNumber), band
     * complete, nothing anchored yet — anchor the initial offer instead.
     * The anchor sets highestOfferMade>0, which promotes the phase out of
     * range-disclosure on the next derivePhase pass (~5845-5848), so the
     * loop cannot re-enter. */
    const lo = state.band?.initialOffer;
    const hi = state.band?.maxStretch;
    const bandComplete =
      typeof lo === "number" && typeof hi === "number" && lo < hi;
    /* The re-entry guard here is `highestOfferMade === 0`, NOT
     * `!anchorAlreadyDisclosed`. A real anchor always sets
     * highestOfferMade > 0, so this gate is already single-fire for
     * genuine anchors. The ONLY case where a band-anchor-with-rationale
     * stamp coexists with highestOfferMade === 0 is the numberless
     * honest-defer — and there we WANT to re-enter so clampAnchorAbove-
     * Disclosed can escalate from null (first defer) to `hi` (honest
     * ceiling) on the repeat, instead of stalling in the deflect sink
     * below. (Deflect-loop terminator, 2026-06-18 live-staging finding.) */
    if (
      state.highestOfferMade === 0 &&
      bandComplete &&
      canDiscloseSpecificNumber(state)
    ) {
      const anchored = clampAnchorAboveDisclosed(lo, hi, state);
      /* null = band ceiling sits below the candidate's disclosed CTC AND
       * we have not yet deferred once; honest-defer rather than anchor a
       * pay cut (mirrors AUDIT-W02 BUG-001 at the offer-ask gate below).
       * On the repeat, clamp returns `hi` and we anchor the ceiling. */
      if (anchored === null) {
        return {
          kind: "anchor-with-offer",
          initialOffer: lo,
          bandIncomplete: true,
          satisfiesTopic: "band-anchor-with-rationale",
          _move: {
            lever: "probe",
            newTotalLpa: null,
            rationale: `Deflect-loop fix — band ceiling (${hi}) below disclosed CTC (${state.candidateCurrentCtc}); honest-defer rather than re-deflect into a sink.`,
            askedTopic: "band-anchor-with-rationale",
            actionKind: "anchor-with-offer",
          },
        };
      }
      return {
        kind: "anchor-with-offer",
        initialOffer: anchored,
        bandIncomplete: false,
        satisfiesTopic: "band-anchor-with-rationale",
        _move: {
          lever: "probe",
          newTotalLpa: anchored,
          rationale:
            `Deflect-loop fix — candidate target on the table ` +
            `(${state.candidateTarget ?? state.candidateTargetFixed}L), band complete; ` +
            `anchor point-offer at ₹${anchored}L (floor=${lo}, disclosed CTC=${state.candidateCurrentCtc ?? "?"}) ` +
            `instead of re-deflecting. Breaks the range-disclosure sink.`,
          askedTopic: "band-anchor-with-rationale",
          actionKind: "anchor-with-offer",
        },
      };
    }

    /* No usable target yet → the deflect is correct: a bare band-disclosure
     * ask before the candidate has named a number. Real Indian HR deflects
     * and takes the expectation back to the panel rather than disclosing
     * the internal band. */
    const floor = state.band.initialOffer;
    return {
      kind: "band-disclosure-deflect",
      satisfiesTopic: "range-deflection",
      _move: {
        lever: "probe",
        newTotalLpa: null,
        rationale:
          `Band-disclosure deflect: candidate asked for the internal band; ` +
          `real Indian HR does NOT disclose ranges. Restate offer (₹${floor}L) ` +
          `if any, deflect, and offer to take expectation to the panel.`,
      },
    };
  }

  /* AP3-F2 + AP3-F3 (2026-05-17) — component-aware discovery + band
   * disclosure gate. After the candidate has disclosed currentCtc but
   * BEFORE the target probe lands, real Indian recruiters working
   * senior comp negotiations (i) break the current package into base /
   * variable / ESOP, then (ii) anchor the band as a range before
   * inviting the candidate's fitment number. This block sits above all
   * discovery-cascade branches so it runs uniformly across opening,
   * offer-presented, and probe-expectations phases.
   *
   * Order of operations:
   *   1. If senior signal + currentCtc != null + target == null + a
   *      next component remains unprobed → component-probe.
   *   2. Else if currentCtc != null + target == null + band complete +
   *      anchor-with-band hasn't fired this session → anchor-with-band.
   *
   * Both are single-fire per (session, slot) so a candidate who deflects
   * lands cleanly on the next item without the planner looping. */
  /* Gate this gate narrowly: only in discovery-shaped phases (opening,
   * offer-presented, probe-expectations). counter-offer / closing-push
   * are past anchor-time; the anchor-with-band lever and component
   * probes would be incongruous there. Also defer when the candidate
   * has an outstanding info-ask (package-breakdown / benefits /
   * compensation-breakdown / notice-period-ask / hike-percentage-ask)
   * — answering the candidate outranks proactive component discovery. */
  const PRE_ANCHOR_PHASES = new Set(["opening", "offer-presented", "probe-expectations"]);
  const hasOutstandingInfoAsk =
    state.infoAsked.includes("package-breakdown") ||
    state.infoAsked.includes("fixed-vs-variable") ||
    state.infoAsked.includes("perks-non-cash") ||
    state.infoAsked.includes("benefits-overview") ||
    state.infoAsked.includes("compensation-breakdown") ||
    state.infoAsked.includes("notice-period-ask") ||
    state.infoAsked.includes("hike-percentage-ask");
  /* PDF#27 Fix 5 (2026-05-17) — offer-ask → band-anchor short-circuit.
   *
   * When the candidate explicitly asked "what's the offer?" on their
   * most recent turn, the recruiter should anchor the band ahead of
   * grinding more discovery questions. The kernel stamps
   * state.offerAskedAtTurn when applyCandidateAnswer detects the
   * OFFER_ASK_RE pattern (_negotiation-kernel.ts Fix 5). This gate is
   * the consumer: it routes to anchor-with-band regardless of
   * currentCtc disclosure state, single-fire per session.
   *
   * 2026-05-29 TECH-DEBT NOTE — double-anchor with the PDF#51 router.
   * The router-based `anchor-ask → open-with-offer` path (line ~1270)
   * also handles the offer-ask cue, and currently fires FIRST. That
   * leaves this gate to re-fire `anchor-with-offer` on the very next
   * turn, double-disclosing the band floor in user-facing prose. The
   * obvious gate (`skip if open-with-offer in askedTopics` OR `skip if
   * highestOfferMade > 0`) cascades into a probe-triple downstream
   * because the post-anchor T+1 fallback paths weren't designed for
   * the case where T-1 already anchored cleanly. Closing this needs a
   * restructure of the discovery cascade's "what to do post-anchor"
   * fallback, not just a gate flip. Keeping the redundant anchor for
   * now; the second instance reads as a re-statement, not a
   * contradiction, so it's cosmetic rather than wrong.
   *
   * Gating:
   *   - PRE_ANCHOR_PHASES only (counter / closing-push are past).
   *   - Recency: offerAskedAtTurn >= turnIndex - 1 (window of one
   *     planner call from the candidate ask).
   *   - Band complete (lo < hi, both numeric).
   *   - Single-fire via askedTopics ledger inspection. */
  const bandAnchorAlreadyFired = readAskedTopics(state).some(
    (t) =>
      t.topic === "band-anchor-with-rationale" ||
      (t.topic as string) === "anchor-with-band" ||
      (t.topic as string) === "anchor-with-offer",
  );
  /* Note: hasOutstandingInfoAsk is intentionally NOT consulted here.
   * The candidate's "what's the offer?" utterance flows into infoAsked
   * as "package-breakdown" via the package-breakdown intent regex, so
   * the generic gate would always be skipped. Fix 5's whole purpose is
   * to ANSWER that ask with a band-anchor, so it short-circuits ahead
   * of the generic info-ask handler. */
  if (
    !isTerminalPhase(state.phase) &&
    PRE_ANCHOR_PHASES.has(state.phase) &&
    !bandAnchorAlreadyFired &&
    state.offerAskedAtTurn != null &&
    state.offerAskedAtTurn >= state.turnIndex - 1
  ) {
    const lo = state.band?.initialOffer;
    const hi = state.band?.maxStretch;
    const bandComplete =
      typeof lo === "number" && typeof hi === "number" && lo < hi;
    if (bandComplete) {
      const anchored = clampAnchorAboveDisclosed(lo, hi, state);
      /* AUDIT-W02 BUG-001 — null = band ceiling below disclosed; defer. */
      if (anchored === null) {
        return {
          kind: "anchor-with-offer",
          initialOffer: lo,
          bandIncomplete: true,
          satisfiesTopic: "band-anchor-with-rationale",
          _move: {
            lever: "probe",
            newTotalLpa: null,
            rationale: `AUDIT-W02 BUG-001 — band ceiling (${hi}) below disclosed CTC (${state.candidateCurrentCtc}); honest-defer rather than pay-cut anchor.`,
            askedTopic: "band-anchor-with-rationale",
            actionKind: "anchor-with-offer",
          },
        };
      }
      return {
        kind: "anchor-with-offer",
        initialOffer: anchored,
        bandIncomplete: false,
        satisfiesTopic: "band-anchor-with-rationale",
        _move: {
          lever: "probe",
          newTotalLpa: anchored,
          rationale:
            `PDF#27 Fix 5 — candidate asked for the offer at turn ${state.offerAskedAtTurn}; ` +
            `anchor point-offer at ₹${anchored}L (band floor=${lo}, disclosed CTC=${state.candidateCurrentCtc ?? "?"}) and invite fitment.`,
          askedTopic: "band-anchor-with-rationale",
          actionKind: "anchor-with-offer",
        },
      };
    }
  }
  if (
    !isTerminalPhase(state.phase) &&
    PRE_ANCHOR_PHASES.has(state.phase) &&
    !hasOutstandingInfoAsk &&
    state.candidateCurrentCtc != null &&
    state.candidateTarget == null &&
    /* Bug (2026-06-20, live staging) — a FIXED-scoped target counts as a
     * stated expectation. The classifier routes "18-20 LPA fixed" to
     * candidateTargetFixed and deliberately leaves candidateTarget null
     * (kernel L4861, total-vs-fixed scope split). This discovery cascade
     * keyed on candidateTarget alone, so a candidate who stated their ask
     * in fixed terms read as "target pending" forever — the planner kept
     * firing component probes (… probe esop before anchoring) even AFTER
     * the candidate said "I'll sign today". Once EITHER a total or a fixed
     * target is on the table, discovery is sufficient; stop probing and let
     * the anchor / counter-engagement paths run. Mirrors the anchor-readiness
     * gates that already accept candidateTargetFixed (L862, L3792, L4101). */
    state.candidateTargetFixed == null
  ) {
    /* PDF#34 Fix 2 (2026-05-18) — anchor circuit-breaker.
     *
     * The senior-comp path below keeps firing component-probes until
     * `nextComponentProbe` returns null. If the candidate gets confused
     * (PDF#34 Meesho/Prita: "what is that?" after vesting probe) or
     * never volunteers expected-CTC, the planner stays in discovery
     * limbo forever and the AI never anchors its initial offer.
     *
     * Real recruiters don't probe indefinitely. After ~3-4 component
     * probes, an Indian HR recruiter would anchor a number anchored on
     * the band floor and invite the candidate's reaction — that's how
     * the negotiation gets unstuck. The probes-without-anchor count is
     * derived from the askedTopics ledger so we don't need a new state
     * field. */
    const componentProbeAskCount = readAskedTopics(state).filter(
      (t) =>
        t.topic === "currentCtcBase" ||
        t.topic === "currentCtcVariable" ||
        t.topic === "currentCtcEsop",
    ).length;
    const ANCHOR_CIRCUIT_BREAKER_THRESHOLD = 3;
    const circuitBreakerTripped =
      componentProbeAskCount >= ANCHOR_CIRCUIT_BREAKER_THRESHOLD;
    if (isSeniorCompProfile(state) && !circuitBreakerTripped) {
      const cp = nextComponentProbe(state);
      if (cp != null) {
        return {
          kind: "component-probe",
          component: cp.component,
          satisfiesTopic: cp.topic,
          _move: {
            lever: "probe",
            newTotalLpa: null,
            rationale:
              `AP3-F2 component-aware discovery: senior comp profile ` +
              `(applicableYoe=${state.candidateApplicableYoe ?? "?"}, role="${state.role}"); ` +
              `currentCtc disclosed, target pending — probe ${cp.component} before anchoring.`,
            askedTopic: cp.topic,
            actionKind: "discovery-probe",
          },
        };
      }
    }
    /* AP3-F3 / PDF#27 Fix 5 (2026-05-17) — anchor-with-band lever.
     *
     * Senior path: fires AFTER all applicable component probes are
     * complete (nextComponentProbe returns null OR the profile isn't
     * senior). Junior path: fires immediately after currentCtc is
     * disclosed since no components are needed.
     *
     * Single-fire per session via leversUsed.includes("anchor-with-
     * band"). Band-completeness gate: lo (initialOffer) < hi
     * (maxStretch) and both numeric. When the band is incomplete the
     * lever still fires but in honest-defer mode (bandIncomplete=true)
     * — NEVER falls back to "missing from fact pack"-style language. */
    /* PDF#34 Fix 2 (2026-05-18) — circuit-breaker also collapses
     * seniorComponentsRemain to false so the anchor fires even when
     * nextComponentProbe would otherwise still return a candidate
     * (e.g. unfilled esop slot after 3 probes). The circuit-breaker
     * threshold is the architectural "enough probes" line. */
    const seniorComponentsRemain =
      isSeniorCompProfile(state) &&
      !circuitBreakerTripped &&
      nextComponentProbe(state) != null;
    /* Single-fire marker. The kernel's applyAiMove pushes the askedTopic
     * onto state.askedTopics; subsequent planner calls see the entry
     * and skip the lever. Test fixtures simulate this by injecting an
     * askedTopics entry (since the kernel mutation lives downstream of
     * planNextAction in the pipeline). */
    const bandAnchorFired = readAskedTopics(state).some(
      (t) =>
        t.topic === "band-anchor-with-rationale" ||
        (t.topic as string) === "anchor-with-band" ||
        (t.topic as string) === "anchor-with-offer",
    );
    if (
      !seniorComponentsRemain &&
      !bandAnchorFired
    ) {
      const lo = state.band?.initialOffer;
      const hi = state.band?.maxStretch;
      const bandComplete =
        typeof lo === "number" && typeof hi === "number" && lo < hi;
      if (bandComplete) {
        const anchored = clampAnchorAboveDisclosed(lo, hi, state);
        /* AUDIT-W02 BUG-001 — null = band ceiling below disclosed; defer. */
        if (anchored === null) {
          return {
            kind: "anchor-with-offer",
            initialOffer: lo,
            bandIncomplete: true,
            satisfiesTopic: "band-anchor-with-rationale",
            _move: {
              lever: "probe",
              newTotalLpa: null,
              rationale: `AUDIT-W02 BUG-001 — band ceiling (${hi}) below disclosed CTC (${state.candidateCurrentCtc}); honest-defer rather than pay-cut anchor.`,
              askedTopic: "band-anchor-with-rationale",
              actionKind: "anchor-with-offer",
            },
          };
        }
        return {
          kind: "anchor-with-offer",
          initialOffer: anchored,
          bandIncomplete: false,
          satisfiesTopic: "band-anchor-with-rationale",
          _move: {
            lever: "probe",
            newTotalLpa: anchored,
            rationale:
              `AP3-F3 band-disclosure: currentCtc satisfied, senior-component probes ` +
              `${isSeniorCompProfile(state) ? "complete" : "n/a"}, target pending — anchor point-offer at ₹${anchored}L (band floor=${lo}, disclosed CTC=${state.candidateCurrentCtc ?? "?"}) and invite fitment.`,
            askedTopic: "band-anchor-with-rationale",
            actionKind: "anchor-with-offer",
          },
        };
      }
      /* Honest defer path — band is unusable; still fire the lever
       * with bandIncomplete=true so the canonical-prose surface emits
       * the panel-signoff defer + fitment invitation. The honest-defer
       * branch intentionally leaves newTotalLpa=null: no committed
       * number has been put on the table yet (the prose surface defers
       * to the panel), so highestOfferMade must stay 0 and the phase
       * machine must remain in range-disclosure pending a real anchor. */
      return {
        kind: "anchor-with-offer",
        initialOffer: typeof lo === "number" ? lo : 0,
        bandIncomplete: true,
        satisfiesTopic: "band-anchor-with-rationale",
        _move: {
          lever: "probe",
          newTotalLpa: null,
          rationale: `AP3-F3 band-disclosure: band incomplete (lo=${lo}, hi=${hi}); honest-defer with fitment invitation.`,
          askedTopic: "band-anchor-with-rationale",
          actionKind: "anchor-with-offer",
        },
      };
    }
  }

  /* Opening: discovery-incomplete probe, then anchor.
   *
   * F1 (PDF#19 2026-05-15) — removed the `turnIndex >= 1` gate that
   * forced turn 0 to skip discovery and go straight to open-with-offer
   * (a specific number anchor). Real recruiters open with a discovery
   * question, not an anchor; F2 substitutes if the LLM tries to anchor
   * anyway. */
  /* AUDIT-3 Fix C (2026-06-08) — mid-session discovery for tier-1 slots.
   *
   * Production symptom: bot stops asking discovery questions after the
   * phase advances past "opening", even when critical tier-1 slots
   * (currentCtc, target) are still unanswered. Audit case: candidate
   * gives a partial disclosure that flips highestOfferMade indirectly
   * (e.g. via a target volunteer that auto-promotes phase), the
   * discovery branch then never re-fires, and the bot never recovers
   * the missing tier-1 fact.
   *
   * Gate widened from `phase === "opening"` to also include
   * range-disclosure and probe-expectations IF either tier-1 slot is
   * still empty. Tier-2 slots (notice, competing, value-proof) are
   * deliberately NOT re-asked post-opening — switching back to those
   * after an anchor is on the table reads as scripted/jarring. */
  const tier1Missing =
    state.discoveryChecklist != null &&
    (state.discoveryChecklist.currentCtcAnswered !== true ||
      state.discoveryChecklist.targetAnswered !== true);
  /* Bug-D (2026-06-19) — the discovery-sufficient + no-offer anchor is now
   * forced earlier, at call site (1) of planDiscoverySufficientAnchor (above
   * the reactive-followup / callback / walk-away branches), so this gate keeps
   * its original shape. The inline AUDIT-3 bridge below remains as call site
   * (2) for the phase==="opening" turn-1 both-volunteered path. */
  if (
    state.phase === "opening" ||
    ((state.phase === "range-disclosure" ||
      state.phase === "probe-expectations") &&
      tier1Missing &&
      state.highestOfferMade === 0)
  ) {
    if (
      state.discoveryStage === "discovery" &&
      state.discoveryChecklist != null
    ) {
      /* A6 adversarial-sim (2026-06-19) — recruiter-anchors-first on a
       * STONEWALL. When the candidate has answered several turns with pure
       * flat-acks ("ok", "hmm", "sure") and disclosed NOTHING — no current
       * CTC, no target, no fixed target — the discovery cascade below would
       * re-issue the same probe every turn until the kernel's phase budget
       * dumped the session to `stalemate` with ZERO offer ever made. That
       * is the cardinal failure: a dead-end with no number on the table.
       *
       * A real Indian recruiter breaks exactly this deadlock by stating the
       * band: "Let me put our range on the table — for this grade we're
       * looking at ₹X." So after STONEWALL_TURNS content-free turns we
       * anchor the band floor instead of probing a (N+1)th time. Gated
       * hard: only when literally nothing has been disclosed AND the band
       * is complete AND we haven't already anchored — so a candidate who is
       * mid-disclosure or merely terse-but-substantive is never short-
       * circuited. This is the structural counterpart to the kernel's
       * forcedPhaseFor("discovery") escape (which now routes a no-signal
       * discovery overstay to offer-presented rather than stalemate). */
      const nothingDisclosed =
        state.candidateCurrentCtc == null &&
        state.candidateTarget == null &&
        state.candidateTargetFixed == null;
      /* Threshold = 5: give the discovery cascade a full run of probes
       * (current-CTC soft + structural, target soft + structural) before
       * the recruiter gives up on disclosure and states the band. Lower
       * thresholds anchored over candidates who were merely slow to
       * disclose (eval "partial-disclosure-no-target" regressed at 3). */
      const STONEWALL_TURNS = 5;
      if (
        nothingDisclosed &&
        state.turnIndex >= STONEWALL_TURNS &&
        !bandAnchorAlreadyFired &&
        state.highestOfferMade === 0
      ) {
        const lo = state.band?.initialOffer;
        const hi = state.band?.maxStretch;
        if (typeof lo === "number" && typeof hi === "number" && lo < hi) {
          const anchored = clampAnchorAboveDisclosed(lo, hi, state) ?? lo;
          return {
            kind: "anchor-with-offer",
            initialOffer: anchored,
            bandIncomplete: false,
            satisfiesTopic: "band-anchor-with-rationale",
            _move: {
              lever: "probe",
              newTotalLpa: anchored,
              rationale:
                `A6 stonewall escape — candidate gave ${state.turnIndex} content-free ` +
                `turns with no disclosure; recruiter anchors the band floor (₹${anchored}L) ` +
                `to break the deadlock rather than probe again or stalemate with no offer.`,
              askedTopic: "band-anchor-with-rationale",
              actionKind: "anchor-with-offer",
            },
          };
        }
      }
      const roleFamily = classifyRoleFamily(state.role);
      /* 2026-06-18 — gate the discovery cascade on SUFFICIENCY, not
       * completeness. Once the candidate has disclosed both essentials
       * (current comp + target), stop re-probing nice-to-have items
       * (comp split / notice / value-proof) and fall through to the
       * anchor bridge below. Those orthogonal items are picked up by the
       * post-anchor cascade. Without this, an un-answered nice-to-have
       * (e.g. a Hinglish "60 din" notice that didn't parse) kept the
       * cascade re-probing and the bot never reached the anchor. */
      if (!isDiscoverySufficientToAnchor(state.discoveryChecklist, roleFamily)) {
        /* F7 (PDF#20 2026-05-15) — merge recently-asked topics into the
         * skip record so getNextOrderedDiscoveryItem advances past topics
         * that were asked within the last 3 turns. */
        const skipRecord = buildSkipRecord(state);
        const orderedItem = getNextOrderedDiscoveryItem(
          state.discoveryChecklist,
          roleFamily,
          skipRecord,
        );
        const ordered = getNextOrderedDiscoveryQuestion(
          state.discoveryChecklist,
          roleFamily,
          skipRecord,
        );
        if (ordered != null && orderedItem != null) {
          const refused = state.discoveryRefusedItems ?? null;
          const skippedHint = refused != null && Object.keys(refused).length > 0
            ? ` [ITEM REFUSED — SKIPPED: ${Object.keys(refused).join(", ")}; proceeding to ${orderedItem}]`
            : "";
          /* FL5 / Audit Pass 4 (PDF#27, 2026-05-17) — uncertainty
           * escape hatch. When the candidate's PRIOR turn was hedged
           * AND we're about to re-ask the same item, deterministically
           * pick between (a) offering a range and (b) advancing past
           * the item. Grinding on an exact number after an uncertain
           * reply is the pattern flagged by the audit. */
          const uncertaintyEscape = applyUncertaintyEscapeHatch(
            state,
            orderedItem,
            ordered.prompt,
          );
          if (uncertaintyEscape.advance) {
            /* Re-run the ordered cascade with the stuck item explicitly
             * marked as skipped this turn. */
            const advancedSkip: Partial<Record<DiscoveryTopic, boolean>> = {
              ...(skipRecord ?? {}),
              [orderedItem]: true,
            };
            const advItem = getNextOrderedDiscoveryItem(
              state.discoveryChecklist,
              roleFamily,
              advancedSkip,
            );
            const advAsk = getNextOrderedDiscoveryQuestion(
              state.discoveryChecklist,
              roleFamily,
              advancedSkip,
            );
            if (advItem != null && advAsk != null) {
              return {
                kind: "discovery-probe",
                item: advItem,
                ask: advAsk.prompt,
                satisfiesTopic: advItem,
                _move: {
                  lever: "probe",
                  newTotalLpa: null,
                  rationale:
                    `Discovery incomplete (FL5 uncertainty escape — advancing past "${orderedItem}" to "${advItem}").`,
                  askedTopic: advItem,
                },
              };
            }
            /* No advance target available → fall through to the
             * range-ask path so the bot still doesn't grind. */
          }
          /* S13-B30 (2026-07-22) — probe cap (tier1Missing / opening path).
           * Mirror of the cap at the probe-expectations block below: when the
           * target question lands here AND ≥4 probes have already been sent
           * with no response, skip the probe and fall through to the anchor
           * path rather than looping indefinitely. This branch fires when
           * phase==="probe-expectations" + tier1Missing + highestOfferMade===0. */
          const isTargetProbeTier1 =
            orderedItem === "targetAnswered" || ordered.item === "targetAsked";
          if (isTargetProbeTier1) {
            const MAX_DISCOVERY_PROBES = 4;
            const targetProbeCountTier1 = readAskedTopics(state).filter(
              (t) => t.topic === "targetAsked" || t.topic === "targetAnswered",
            ).length;
            if (targetProbeCountTier1 >= MAX_DISCOVERY_PROBES) {
              /* Fall through — do NOT return probe here. The code after this
               * `if (ordered != null)` block (and after the outer
               * `!isDiscoverySufficientToAnchor` block) reaches the hard-gate
               * anchor paths at lines 4533+, which will anchor the band. */
              /* break-out of the if block by not returning */
            } else {
              const finalAsk = uncertaintyEscape.rangeAsk ?? ordered.prompt;
              return {
                kind: "discovery-probe",
                item: orderedItem,
                ask: finalAsk,
                satisfiesTopic: orderedItem,
                _move: {
                  lever: "probe",
                  newTotalLpa: null,
                  rationale:
                    `Discovery incomplete (next: ${orderedItem}) — ask: ${finalAsk}${skippedHint}`,
                  askedTopic: orderedItem,
                },
              };
            }
          } else {
            const finalAsk = uncertaintyEscape.rangeAsk ?? ordered.prompt;
            return {
              kind: "discovery-probe",
              item: orderedItem,
              ask: finalAsk,
              satisfiesTopic: orderedItem,
              _move: {
                lever: "probe",
                newTotalLpa: null,
                rationale:
                  `Discovery incomplete (next: ${orderedItem}) — ask: ${finalAsk}${skippedHint}`,
                askedTopic: orderedItem,
              },
            };
          }
        }
        /* PDF#46 (2026-05-25) — legacy fallback path removed. It used a
         * different priority order than DISCOVERY_SEQUENCE (target was
         * LAST, before notice+competing) which caused topics to fire
         * out-of-order whenever the ordered cascade returned null but
         * the checklist still had un-answered items. Only the ordered
         * cascade drives sequencing now. */
      }
    }
    /* PDF#46 (2026-05-25) — hard gate: never anchor before the
     * candidate's target/expected CTC has been asked. Honors the
     * discovery checklist (the source of truth) — if a checklist exists
     * and targetAnswered is still false, route to a discovery-probe for
     * target before opening with an offer. Legacy sessions (no
     * checklist) are exempt because they bypass discovery entirely. The
     * opener-as-discovery branch (turnIndex === 0) is also exempt
     * because canonical-prose renders it as a currentCtc probe, not an
     * anchor.
     *
     * S13-B30 (2026-07-22) — probe cap. When the candidate declines to name
     * a target 3+ times (targetAnswered appears ≥3 times in askedTopics),
     * do NOT emit another probe — advance to anchor using the band floor/ceiling
     * as the basis. Infinite target-probe loops are a worse experience than
     * anchoring without the candidate's stated number. */
    /* Count how many times the target probe has already been sent this session. */
    const targetProbeCount = readAskedTopics(state).filter(
      (t) => t.topic === "targetAnswered" || t.topic === "targetAsked",
    ).length;
    /* S52-WL-B6 / S53-B2 — suppress this gate when acknowledge-and-recover
     * just fired: the recruiter has already apologised for looping; re-asking
     * the target here produces a different discovery probe instead of
     * pivoting to offer-reveal, which is the exact bug being fixed. */
    const postAcknowledgeAndRecover =
      state.leversUsed[state.leversUsed.length - 1] === "acknowledge-and-recover";
    if (
      state.turnIndex > 0 &&
      state.discoveryChecklist != null &&
      state.discoveryChecklist.targetAnswered !== true &&
      targetProbeCount < 3 &&
      !postAcknowledgeAndRecover
    ) {
      return {
        kind: "discovery-probe",
        item: "targetAnswered",
        ask: "Before I share the band — what's your target / expected CTC for this move?",
        satisfiesTopic: "targetAnswered",
        _move: {
          lever: "probe",
          newTotalLpa: null,
          rationale: "Anchor gate — targetAnswered still false; must surface expected CTC before opening with an offer.",
          askedTopic: "targetAnswered",
        },
      };
    }
    /* PDF#48 follow-up (2026-05-26) — second anchor gate for legacy
     * sessions without a discoveryChecklist.
     *
     * The checklist gate above is necessary but not sufficient: when
     * state.discoveryChecklist is null (legacy session shapes, older
     * sessions started before the checklist was wired, or kernel
     * fixtures that never populate it) the gate exempts the session
     * and the planner falls through to open-with-offer unconditionally.
     * That's how the PDF#48 session reached "we can offer ₹30.4 LPA"
     * after only 3 data-collection probes — the kernel never asked
     * the candidate's target because no checklist made it ask.
     *
     * `canDiscloseSpecificNumber` (defined at _negotiation-kernel.ts
     * ~line 2587) is the broader heuristic that already encodes the
     * recruiter-anchors-first policy: disclose only when the
     * candidate has anchored OR the probe has been refused 2+ times.
     * It was defined for exactly this purpose but was orphaned —
     * never called by the planner. Wire it as a belt-and-braces gate
     * after the checklist gate. When it returns false AND we have no
     * checklist to defer to, emit the same target-probe that the
     * checklist branch above would emit.
     *
     * S13-B30 (2026-07-22) — same probe cap applies: skip once ≥3 probes sent. */
    if (
      state.turnIndex >= 2 &&
      state.discoveryChecklist == null &&
      !canDiscloseSpecificNumber(state) &&
      targetProbeCount < 3
    ) {
      /* Turn-index gate: turn 1 (the very first AI turn) is the
       * legitimate opener — rendered by canonical-prose as a currentCtc
       * probe, not as a band disclosure. Preserve that exemption so the
       * legacy single-turn opener still routes through open-with-offer
       * (locked by activePhaseGating turn-1 test). On turn 2+ the
       * opener is behind us; if no checklist deferred the gate and the
       * candidate still hasn't anchored, ask for the target. */
      return {
        kind: "discovery-probe",
        item: "targetAnswered",
        ask: "Before I share the band — what's your target / expected CTC for this move?",
        satisfiesTopic: "targetAnswered",
        _move: {
          lever: "probe",
          newTotalLpa: null,
          rationale: "Anchor gate (checklist-null path) — canDiscloseSpecificNumber=false; must surface expected CTC before opening with an offer.",
          askedTopic: "targetAnswered",
        },
      };
    }
    /* AUDIT-3 Fix A (2026-06-08) — discovery-complete anchor.
     *
     * Production symptom: when the candidate volunteers BOTH currentCtc
     * AND target on turn 1, the original anchor-with-offer gate (~line
     * 2786) closes (candidateTarget != null), the discovery-cascade
     * finds nothing left to ask, the target-anchor gate (~line 3029)
     * skips (targetAnswered === true), and the cascade lands on
     * open-with-offer. open-with-offer has numberPolicy: "forbidden" in
     * the response pipeline, so the prose layer strips the number —
     * the candidate never sees an initial offer. Bot looks idle.
     *
     * Bridge: when (a) discovery is complete, (b) no offer is on the
     * table yet, and (c) we already have both current+target, anchor
     * the band initial NOW. Bypasses open-with-offer's number gag and
     * mirrors the band-anchor-with-rationale bridge that handles the
     * same case once phase has advanced to probe-expectations. */
    if (
      state.highestOfferMade === 0 &&
      state.candidateCurrentCtc != null &&
      /* Accept a fixed-scoped target too (candidateTargetFixed). When a
       * candidate states "Mujhe 32 LPA fixed chahiye", the value routes
       * to candidateTargetFixed and candidateTarget stays null — the
       * old `candidateTarget != null` guard skipped the clean anchor and
       * the bot ground through extra deflection turns. */
      (state.candidateTarget != null || state.candidateTargetFixed != null) &&
      state.discoveryChecklist != null &&
      isDiscoverySufficientToAnchor(
        state.discoveryChecklist,
        classifyRoleFamily(state.role),
      ) &&
      readAskedTopics(state).every(
        (t) =>
          t.topic !== "band-anchor-with-rationale" &&
          (t.topic as string) !== "anchor-with-offer",
      )
    ) {
      const lo = state.band.initialOffer;
      const hi = state.band.maxStretch;
      /* S1-B4 (2026-07-22) — use clampOpeningAnchor (not clampAnchorAboveDisclosed)
       * so the OPENING anchor leaves headroom below the band ceiling for
       * subsequent concessions. clampAnchorAboveDisclosed can return hi (ceiling)
       * when the candidate's hike floor (CTC × 1.25) overshoots the ceiling
       * while the CTC itself is still within the band — e.g. CTC=30L on a 28–35.8L
       * band: candidate = max(28, 38) = 38, clamped to 35.8. The opening then pins
       * at the ceiling, leaving no room to negotiate upward (S2-B9 corollary: any
       * subsequent counter produces a hold-firm rather than an incremental step).
       * clampOpeningAnchor backs the opener off by ~20% of band spread; the
       * null/honest-defer behaviour is unchanged (both delegates propagate null). */
      const anchored = clampOpeningAnchor(lo, hi, state);
      /* AUDIT-W02 BUG-001 — null = band ceiling below disclosed; defer. */
      if (anchored === null) {
        return {
          kind: "anchor-with-offer",
          initialOffer: lo,
          bandIncomplete: true,
          satisfiesTopic: "band-anchor-with-rationale",
          _move: {
            lever: "probe",
            newTotalLpa: null,
            rationale: `AUDIT-W02 BUG-001 — band ceiling (${hi}) below disclosed CTC (${state.candidateCurrentCtc}); honest-defer rather than pay-cut anchor.`,
            askedTopic: "band-anchor-with-rationale",
            actionKind: "anchor-with-offer",
          },
        };
      }
      return {
        kind: "anchor-with-offer",
        initialOffer: anchored,
        bandIncomplete: false,
        satisfiesTopic: "band-anchor-with-rationale",
        _move: {
          lever: "probe",
          newTotalLpa: anchored,
          rationale:
            `AUDIT-3 discovery-sufficient anchor: candidate volunteered current ₹${state.candidateCurrentCtc}L + target ₹${state.candidateTarget ?? state.candidateTargetFixed}L${state.candidateTarget == null ? " (fixed)" : ""}; ` +
            `discovery sufficient; no offer on the table — anchor point-offer at ₹${anchored}L (band floor=${lo}, ceiling=${hi}, clampOpeningAnchor applied).`,
          askedTopic: "band-anchor-with-rationale",
          actionKind: "anchor-with-offer",
        },
      };
    }

    const rawOpener = clampAnchorAgainstCandidateAsk(
      state.band.initialOffer,
      state.candidateTarget,
      state.band.walkAway,
    );
    /* S2-B7 (2026-07-22) — clamp open-with-offer against disclosed CTC.
     * When AP3-F3 is gated out (hasOutstandingInfoAsk) and the probe cap
     * fires, code falls here with candidateCurrentCtc non-null but the opener
     * still holding the raw band floor (27.8 in the live S2 case — a pay cut
     * below the disclosed CTC of 32). Apply clampOpeningAnchor so the first
     * number on the table is never below the candidate's existing pay. If the
     * band ceiling itself is below the CTC+hike floor (clampOpeningAnchor →
     * null), fall back to band.maxStretch so the candidate at least sees an
     * honest ceiling even if it's below their expectation. */
    const clampedOpener = clampOpeningAnchor(rawOpener, state.band.maxStretch, state)
      ?? state.band.maxStretch;
    /* Session #25 root-fix (2026-05-16) — opener-marks-currentCtc.
     * The turn-0 open-with-offer branch is rendered by canonical-prose as
     * "walk me through your current compensation structure first" — i.e.
     * a currentCtc probe, NOT an anchor. The askedTopics ledger must
     * therefore record `currentCtcAnswered` (same key the discovery-probe
     * path uses) so that subsequent discovery-probe re-asks of currentCtc
     * see the topic-already-asked entry and the loop-guard fires correctly.
     * Without this, applyAiMove fell back to `move.lever = "open-with-offer"`
     * as the topic key, decoupling the opener probe from the discovery
     * cascade (failure mode a + d). */
    return {
      kind: "open-with-offer",
      satisfiesTopic: state.turnIndex === 0 ? "currentCtcAnswered" : "open-with-offer",
      _move: {
        lever: "open-with-offer",
        newTotalLpa: clampedOpener,
        rationale: clampedOpener < rawOpener
          ? `Open with anchor ₹${clampedOpener} LPA (clamped from band initial ₹${state.band.initialOffer} against candidate ask ₹${state.candidateTarget}).`
          : clampedOpener > rawOpener
            ? `Open with anchor ₹${clampedOpener} LPA (S2-B7 CTC clamp: raised from ₹${rawOpener} to clear disclosed CTC ₹${state.candidateCurrentCtc ?? "?"}).`
            : `Open with band initial ₹${state.band.initialOffer} LPA.`,
        askedTopic: state.turnIndex === 0 ? "currentCtcAnswered" : undefined,
      },
    };
  }

  /* Bug-report 15 follow-up — third-strike lever-loop guard. */
  const INFO_LEVERS_FOR_LOOP_GUARD = new Set([
    "compensation-summary",
    "benefits-summary",
    "notice-period-summary",
    "hike-context-summary",
  ]);
  const recentLevers = state.leversUsed.slice(-2);
  const stuckLever =
    recentLevers.length === 2 &&
    recentLevers[0] === recentLevers[1] &&
    INFO_LEVERS_FOR_LOOP_GUARD.has(recentLevers[0]);
  if (
    stuckLever &&
    !isTerminalPhase(state.phase) &&
    /* PDF#31 BUG D fix (2026-05-18) — don't hold-firm before the
     * candidate and recruiter have actually negotiated. The lever-loop-
     * guard catches a repeating INFO-lever (compensation-summary,
     * benefits-summary, etc.) and pivots to hold-firm — but if this
     * fires before MIN_COUNTER_ROUNDS_BEFORE_HOLD_FIRM counter rounds,
     * the candidate hears "we'll hold the fitment" after a single
     * exchange. PDF#31 Meesho/Prita T18 leaked exactly this pattern.
     * Min-rounds gate ensures hold-firm only after real bargaining. */
    state.counterRound >= MIN_COUNTER_ROUNDS_BEFORE_HOLD_FIRM
  ) {
    if (state.highestOfferMade > 0) {
      const jb = state.lastJoiningBonusOffered;
      return {
        kind: "lever-loop-guard",
        _move: {
          lever: "hold-firm",
          newTotalLpa: state.highestOfferMade,
          joiningBonusAmount: jb != null ? jb : undefined,
          rationale: `Lever-loop guard: ${recentLevers[0]} has fired twice already; force hold-firm at ₹${state.highestOfferMade}L instead of a third identical disclosure (counterRound=${state.counterRound}, min=${MIN_COUNTER_ROUNDS_BEFORE_HOLD_FIRM}).`,
        },
      };
    }
  }

  /* Intent overrides — package breakdown / benefits / comp-structure /
   * notice / hike-pct. One-shot per lever (benefits-summary): once we've
   * enumerated the breakdown, the planner falls through to probe rather
   * than re-disclosing. PDF#44 Bug B (the candidate's second breakdown
   * ask returning a dodge) is mitigated by the substantive prose in
   * prose/info-disclosure.ts — the FIRST disclosure is now informative
   * enough that a re-ask is rare; the loop-breaker escalation at the
   * pipeline boundary catches the residual case. */
  /* PRI-59 (2026-06-25, real prod session) — an explicit cash/fixed PUSH over a
   * standing offer ("forget the perks — what's your best fixed?") must never be
   * answered with an info-disclosure benefits/comp enumeration. The kernel
   * stamps infoAsked topics from keyword presence, so a NEGATED mention
   * ("forget the PERKS") spuriously sets `benefits-overview` and the wantsBenefits
   * override served an insurance recap to a candidate demanding the base number —
   * pure deflection. When the latest utterance is a salary push over a standing
   * offer, suppress every info-disclosure override here and defer to the cash
   * engine (counter-base / lever-explore cash-ceiling ack), the single place
   * that names the cash anchor. */
  const cashPushSuppressesInfo =
    state.highestOfferMade > 0 && isSalaryPush(latestCandidateText(state));
  /* PRI-60 (2026-06-25, real prod session) — total-vs-fixed scope mismatch at
   * the close. A candidate who pins a conditional close to a FIXED number the
   * standing TOTAL offer cannot deliver as cash ("if you can close at ₹52.3L
   * fixed, that works for me" — where ₹52.3L is the total of ₹46.3L fixed +
   * ₹6L variable) is making a CLOSE signal, not asking for a comp-structure
   * tour. In production the bot silently agreed ("let's lock it at ₹52.3L"),
   * converting an equity/variable-inclusive total into fixed cash; in the
   * deterministic path an earlier breakdown ask left `compensation-breakdown`
   * sticky in the cumulative `infoAsked`, so the info override below hijacked
   * the turn and shipped a generic structure recap — both DUCK the scope
   * conflict instead of reconciling it.
   *
   * The close gates above have already DECLINED to close (the conditional-close
   * gate returns null for an undeliverable fixed ask — `fixedScopedCloseTotal`
   * is null), so no false-close can happen. What's missing is naming the
   * conflict OUT LOUD. Reconcile it deterministically here: route to a
   * lever-explore that states the total→fixed conversion (stamped via
   * `undeliverableFixedConditionAsk` → `fixedAskAboveBand` in wrapLeverExplore)
   * and pivots to a concrete non-cash lever, rather than the comp-structure
   * duck OR the defensive ladder stealing the turn. "hard-band-cap" because the
   * fixed ask sits structurally above the cash band the grade can deliver. */
  if (
    state.highestOfferMade > 0 &&
    undeliverableFixedConditionAsk(state) != null
  ) {
    return wrapLeverExplore(pickLeverExploreMove(state), "hard-band-cap", state);
  }
  const wantsBreakdown =
    !cashPushSuppressesInfo &&
    state.highestOfferMade > 0 &&
    !state.leversUsed.includes("benefits-summary") &&
    (state.infoAsked.includes("package-breakdown") ||
      state.infoAsked.includes("fixed-vs-variable") ||
      state.infoAsked.includes("perks-non-cash"));
  if (wantsBreakdown) {
    return {
      kind: "info-disclosure",
      topic: "breakdown",
      _move: {
        lever: "benefits-summary",
        newTotalLpa: state.highestOfferMade,
        rationale: "Candidate asked for the package breakdown; enumerate components instead of probing.",
      },
    };
  }

  /* #132 (2026-06-21, live Flipkart-EM) — one-shot guard on every
   * info-disclosure lever, not just benefits-summary. `state.infoAsked`
   * is CUMULATIVE (kernel never clears it), so a single early "what's the
   * bonus structure?" leaves `compensation-breakdown` sticky for the rest
   * of the session. Without a one-shot gate the planner re-shipped the
   * SAME canonical disclosure on consecutive turns — e.g. a candidate
   * pushing to close above the band ceiling ("put your best number, I'll
   * sign") got the verbatim "On the structure — fixed is the bulk…" line
   * twice in a row instead of a firm ceiling-assert + close-invite. Each
   * company-policy disclosure is informative once; a re-ask now falls
   * through to the counter/close logic (which asserts the ceiling and
   * invites the close) rather than looping the explainer. */
  const wantsBenefits =
    !cashPushSuppressesInfo &&
    !isTerminalPhase(state.phase) &&
    !state.leversUsed.includes("benefits-summary") &&
    state.infoAsked.includes("benefits-overview");
  if (wantsBenefits) {
    return {
      kind: "info-disclosure",
      topic: "benefits",
      _move: {
        lever: "benefits-summary",
        newTotalLpa: state.highestOfferMade > 0 ? state.highestOfferMade : null,
        rationale: "Candidate asked about benefits / perks; enumerate the non-cash package instead of re-closing.",
      },
    };
  }

  const wantsCompStructure =
    !cashPushSuppressesInfo &&
    !isTerminalPhase(state.phase) &&
    !state.leversUsed.includes("compensation-summary") &&
    state.infoAsked.includes("compensation-breakdown");
  if (wantsCompStructure) {
    return {
      kind: "info-disclosure",
      topic: "comp-structure",
      _move: {
        lever: "compensation-summary",
        newTotalLpa: state.highestOfferMade > 0 ? state.highestOfferMade : null,
        rationale: "Candidate asked about variable/equity/bonus structure; disclose company comp structure instead of re-closing.",
      },
    };
  }

  const wantsNoticePolicy =
    !cashPushSuppressesInfo &&
    !isTerminalPhase(state.phase) &&
    !state.leversUsed.includes("notice-period-summary") &&
    state.infoAsked.includes("notice-period-ask");
  if (wantsNoticePolicy) {
    return {
      kind: "info-disclosure",
      topic: "notice",
      _move: {
        lever: "notice-period-summary",
        newTotalLpa: state.highestOfferMade > 0 ? state.highestOfferMade : null,
        rationale: "Candidate asked about joining window / notice / buyout; disclose company policy instead of re-closing.",
      },
    };
  }

  const wantsHikeContext =
    !cashPushSuppressesInfo &&
    !isTerminalPhase(state.phase) &&
    !state.leversUsed.includes("hike-context-summary") &&
    state.infoAsked.includes("hike-percentage-ask");
  if (wantsHikeContext) {
    return {
      kind: "info-disclosure",
      topic: "hike-pct",
      _move: {
        lever: "hike-context-summary",
        newTotalLpa: state.highestOfferMade > 0 ? state.highestOfferMade : null,
        rationale: "Candidate asked what hike% this offer represents; surface delta / market norms instead of re-closing.",
      },
    };
  }

  /* offer-presented / probe-expectations: discovery-incomplete probe, else generic. */
  if (state.phase === "offer-presented" || state.phase === "probe-expectations") {
    if (
      state.discoveryStage === "discovery" &&
      state.discoveryChecklist != null
    ) {
      const roleFamily = classifyRoleFamily(state.role);
      if (!isDiscoveryComplete(state.discoveryChecklist, roleFamily)) {
        /* F7 — apply same repetition-guard merge here. Defect 1 fix:
         * route through getNextOrderedDiscoveryQuestion so skipRecord
         * is actually consulted (legacy getNextDiscoveryQuestion has
         * no refused param and silently dropped the skipRecord). */
        const skipRecord = buildSkipRecord(state);
        const next = getNextOrderedDiscoveryQuestion(
          state.discoveryChecklist,
          roleFamily,
          skipRecord,
        );
        /* PDF#37 BUG-C/D (2026-05-20) — once an anchor offer is on the
         * table, discovery-probe must NOT regress the flow with an
         * orthogonal question. Flow-central items (currentCtc /
         * fixedVariableSplit / target) remain legitimate probes
         * because their answers reshape the counter directly.
         * Orthogonal items (noticePeriod / competingOffers /
         * valueProof) should NOT drop the recruiter back into a
         * discovery cascade — they get folded into reactive follow-
         * ups in counter / recap prose downstream instead. */
        /* PDF#45 follow-up (2026-05-25) — notice-period is NOT orthogonal:
         * real HR always confirms notice before close. Keeping it in the
         * post-anchor discovery cascade ensures the recruiter asks for
         * noticePeriodDays even after an anchor has been placed, so the
         * close-recap-formal can quote a concrete joining target. */
        /* PDF#44 (2026-05-26) — fixedVariableSplit on the candidate's
         * CURRENT comp is retrospective: once an anchor is on the
         * table the breakdown conversation shifts to OUR offer (via
         * the breakdown-request path), not the candidate's historic
         * split. Treating it as orthogonal post-anchor prevents the
         * recruiter from regressing into a "what's your current
         * fixed/variable split?" probe right after anchoring. */
        const ORTHOGONAL_POST_ANCHOR_ITEMS: ReadonlySet<string> = new Set([
          "competingOffersAsked",
          "valueProofAsked",
          "fixedVariableSplitAsked",
        ]);
        /* S75-B1 (2026-07-25) — once the recruiter has put an offer on the
         * table in the offer-presented phase, asking for the candidate's
         * current CTC (currentCtcAnswered) is ALSO orthogonal. The conversation
         * has moved from intake-discovery into offer-reaction territory:
         * returning "Before we go further, can you share your current CTC?"
         * when the candidate comments on structure/title-vs-comp/variable
         * preference is jarring and ignores the candidate's actual concern.
         * The rationale for keeping currentCtc non-orthogonal ("their answer
         * reshapes the counter directly") applies in counter-offer phase, not
         * offer-presented, where the initial offer is already down and the
         * recruiter should respond to the pushback — not re-probe for intake.
         * Narrowly scoped: offer-presented + highestOfferMade > 0 only. */
        const ctcOrthogonalInOfferPresented =
          state.phase === "offer-presented" && (state.highestOfferMade ?? 0) > 0;
        const effectiveOrthogonalItems: ReadonlySet<string> = ctcOrthogonalInOfferPresented
          ? new Set([...ORTHOGONAL_POST_ANCHOR_ITEMS, "currentCtcAnswered"])
          : ORTHOGONAL_POST_ANCHOR_ITEMS;
        /* #119 (2026-06-21, live staging) — post-anchor stonewall guard.
         * Repro (Flipkart EM, content-free candidate): the bot anchored
         * ₹32L, then REGRESSED to a cold "share your current CTC — fixed,
         * variable, in-hand?" discovery-probe a turn later. currentCtc /
         * target are deliberately kept probeable post-anchor (their answers
         * reshape the counter) — but that justification evaporates when the
         * candidate has disclosed NOTHING across the whole session: re-asking
         * a 4th time is futile and reads as the bot looping backwards over an
         * offer it already put down. This is the post-anchor twin of the A6
         * pre-anchor stonewall escape (which only guards highestOfferMade===0).
         * Once an offer is on the table AND the candidate has stonewalled past
         * the threshold, suppress the tier-1 re-probe and fall through to the
         * offer-standing close/counter bridge below — the recruiter holds the
         * number and invites a decision instead of probing again. */
        const stonewalledPostAnchor =
          (state.highestOfferMade ?? 0) > 0 &&
          state.candidateCurrentCtc == null &&
          state.candidateTarget == null &&
          state.candidateTargetFixed == null &&
          state.turnIndex >= 5;
        const allowProbeWithOfferOnTable =
          !stonewalledPostAnchor &&
          (state.highestOfferMade === 0 ||
            (next != null && !effectiveOrthogonalItems.has(next.item)));
        if (next != null && allowProbeWithOfferOnTable) {
          /* Fix C (2026-07-22) — MAX_DISCOVERY_PROBES cap on target-ask probes.
           * When the candidate has refused to name a target 4+ times
           * (targetAsked or targetAnswered appears ≥4 times in askedTopics),
           * do NOT emit another target probe here either — advance to band-anchor
           * so the session never loops indefinitely waiting for a number the
           * candidate won't supply. This guard applies to the discovery-probe
           * path (here) AND the probe-expectations fallthrough (below) so the
           * cap fires regardless of which branch the planner entered. */
          const MAX_DISCOVERY_PROBES = 4;
          const isTargetProbe = next.item === "targetAsked";
          if (isTargetProbe) {
            const targetProbeCount = readAskedTopics(state).filter(
              (t) => t.topic === "targetAsked" || t.topic === "targetAnswered",
            ).length;
            if (targetProbeCount >= MAX_DISCOVERY_PROBES) {
              return {
                kind: "band-anchor-with-rationale",
                satisfiesTopic: "band-anchor-with-rationale",
                _move: {
                  lever: "benefits-summary",
                  newTotalLpa: null,
                  rationale:
                    `Fix C — discovery probe cap hit (${targetProbeCount} target probes with no response); ` +
                    `advancing to band anchor (₹${state.band.initialOffer}L–₹${state.band.maxStretch}L) ` +
                    `rather than looping on target-ask indefinitely.`,
                  actionKind: "band-anchor-with-rationale",
                  askedTopic: "band-anchor-with-rationale",
                },
              };
            }
          }
          return {
            kind: "discovery-probe",
            item: next.item,
            ask: next.prompt,
            satisfiesTopic: next.item,
            _move: {
              lever: "probe",
              newTotalLpa: null,
              rationale: `Discovery incomplete (next: ${next.item}) — ask: ${next.prompt}`,
              askedTopic: next.item,
            },
          };
        }
      }
    }
    /* Audit Pass 2 Fix B (2026-05-16) — probe-expectations → anchor
     * bridge. From `phase = "probe-expectations"`, the cascade below
     * (without this branch) only ever returns the generic
     * `probe-expectations` action, which writes `newTotalLpa: null`.
     * The only writer of `state.highestOfferMade` from this phase was
     * the candidate-driven auto-accept path. Result: bot loops on
     * probes until maxTurns → stalemate.
     *
     * Bridge: once discovery is complete AND no offer is on the table
     * yet, escalate to `band-anchor-with-rationale`. probe-expectations
     * semantically implies the candidate has already expressed
     * expectations; the next idiomatic recruiter move is to anchor the
     * band ("As per the band for this grade, fitment sits in
     * ₹{lo}–₹{hi} LPA…") rather than probing for a number a second time. */
    if (
      state.phase === "probe-expectations" &&
      state.highestOfferMade === 0 &&
      (state.discoveryChecklist == null ||
        isDiscoverySufficientToAnchor(
          state.discoveryChecklist,
          classifyRoleFamily(state.role),
        ))
    ) {
      return {
        kind: "band-anchor-with-rationale",
        satisfiesTopic: "band-anchor-with-rationale",
        _move: {
          lever: "benefits-summary",
          newTotalLpa: null,
          rationale:
            `Discovery complete with no offer on the table; from probe-expectations, anchor the band` +
            ` (₹${state.band.initialOffer}L–₹${state.band.maxStretch}L) so the candidate has a reference range to react to.`,
          actionKind: "band-anchor-with-rationale",
          askedTopic: "band-anchor-with-rationale",
        },
      };
    }
    /* PDF#45 BUG-2 fix (2026-05-25) — Flipkart Sr-PD session triple-asked
     * the candidate's target after they had already stated it. Once
     * candidateTarget is set, the probe-expectations fallback must NOT
     * fire — reroute to band-anchor (no offer yet) or counter-offer
     * (offer on the table). A fixed-scoped ask (candidateTargetFixed,
     * candidateTarget null) is just as much an expressed expectation, so
     * honor it too — otherwise a Hinglish "32 LPA fixed chahiye" loops. */
    if (state.candidateTarget != null || state.candidateTargetFixed != null) {
      if (state.highestOfferMade === 0) {
        return {
          kind: "band-anchor-with-rationale",
          satisfiesTopic: "band-anchor-with-rationale",
          _move: {
            lever: "benefits-summary",
            newTotalLpa: null,
            rationale: `Candidate target ₹${effectiveTargetCtcLpa(state) ?? state.candidateTarget}L already on the table; anchor the band instead of re-probing expectations.`,
            actionKind: "band-anchor-with-rationale",
            askedTopic: "band-anchor-with-rationale",
          },
        };
      }
      const derived: NegotiationState = { ...state, phase: "counter-offer" };
      return planNextActionInternal(derived);
    }
    /* #122 (2026-06-21, live staging) — post-anchor re-probe loop. Repro
     * (Flipkart EM, content-free candidate): after the #121 stonewall
     * anchor put ₹32.7L on the table, phase = "probe-expectations" with
     * highestOfferMade > 0. The candidate kept stonewalling ("Hmm." /
     * "I see." / "Okay.") and this fallthrough re-emitted the IDENTICAL
     * "What fitment were you expecting for this role?" probe-expectations
     * action three turns running — the bot looping backwards over an
     * offer it had already put down, begging for a number while ignoring
     * its own standing offer.
     *
     * Root cause: `probe-expectations` is semantically a PRE-anchor move
     * (ask the candidate's number before we put an offer down). The two
     * bridges above both early-out on `highestOfferMade === 0`, so once an
     * offer stands the cascade fell straight through to this unconditional
     * re-probe. Asking "what were you expecting?" ONCE over a standing offer
     * is a legitimate gap-gauge (the activeStageGating unit tests bless it) —
     * the defect is the REPEAT. The F7 askedTopics ledger that would normally
     * single-fire it gets tail-rewound on content-free / noise answers (the
     * exact stonewall path), so the ledger can't gate this. Use the #119
     * stonewall predicate instead: once an offer stands AND the candidate has
     * disclosed NOTHING past the turn threshold, they are stonewalling — HOLD
     * the number and invite a decision via offer-recap rather than begging for
     * a figure over our own offer (and rather than auto-escalating cash, which
     * would over-concede for free). offer-recap restates highestOfferMade
     * WITHOUT moving the band. A fresh probe-expectations with an offer but no
     * stonewall history (turnIndex 0) still flows through to the single probe
     * below. (Post-anchor twin of the pre-anchor probe→anchor bridge.) */
    const stonewalledOverOffer =
      (state.highestOfferMade ?? 0) > 0 &&
      state.candidateCurrentCtc == null &&
      state.candidateTarget == null &&
      state.candidateTargetFixed == null &&
      state.turnIndex >= 5;
    if (stonewalledOverOffer) {
      return {
        kind: "offer-recap",
        offerLpa: state.highestOfferMade,
        _move: {
          lever: "hold-firm",
          newTotalLpa: state.highestOfferMade,
          rationale:
            `Offer ₹${state.highestOfferMade}L already on the table and candidate has not named a target after stonewalling;` +
            ` hold the standing number and invite a decision instead of re-probing expectations (would beg for a figure over our own offer).`,
        },
      };
    }
    /* Fix C (2026-07-22) — MAX_DISCOVERY_PROBES cap on target-ask probes.
     * When the candidate has refused to name a target 4+ times (targetAsked
     * or targetAnswered appears ≥4 times in askedTopics), do NOT emit another
     * probe — advance to anchor using the band so the session never loops
     * indefinitely waiting for a number the candidate won't supply. Real
     * recruiters give up asking after 3-4 attempts and anchor the band
     * unilaterally. */
    const MAX_DISCOVERY_PROBES = 4;
    const probeExpProbeCount = readAskedTopics(state).filter(
      (t) => t.topic === "targetAsked" || t.topic === "targetAnswered",
    ).length;
    if (probeExpProbeCount >= MAX_DISCOVERY_PROBES) {
      return {
        kind: "band-anchor-with-rationale",
        satisfiesTopic: "band-anchor-with-rationale",
        _move: {
          lever: "benefits-summary",
          newTotalLpa: null,
          rationale:
            `Fix C — discovery probe cap hit (${probeExpProbeCount} target probes with no response); ` +
            `advancing to band anchor (₹${state.band.initialOffer}L–₹${state.band.maxStretch}L) ` +
            `rather than looping on target-ask indefinitely.`,
          actionKind: "band-anchor-with-rationale",
          askedTopic: "band-anchor-with-rationale",
        },
      };
    }
    return {
      kind: "probe-expectations",
      satisfiesTopic: "targetAsked",
      _move: {
        lever: "probe",
        newTotalLpa: null,
        rationale: "Probe candidate's expectation before moving.",
      },
    };
  }

  /* Probe-justification before first counter-base. Class-A (2026-06-15):
   * compare the total-CTC-scoped target against the initial offer so an
   * in-hand-framed target (raw take-home) isn't under-detected vs a total
   * offer (it would otherwise look smaller than it really is). */
  const probeJustifyTarget = effectiveTargetCtcLpa(state);
  const shouldProbeJustification =
    state.phase === "counter-offer" &&
    probeJustifyTarget != null &&
    probeJustifyTarget > state.band.initialOffer * 1.05 &&
    !state.leversUsed.includes("probe-justification") &&
    !state.leversUsed.includes("counter-base") &&
    state.candidateCurrentCtc == null &&
    !state.competingOfferDetail.hasAny &&
    /* PRI-55 (2026-06-22, product call) — never interrogate a number the
     * candidate has already committed to as an in-band conditional
     * acceptance. inBandConditionalConverge is the convergence signal (a
     * deliverable in-band total OR fixed conditional-accept above the
     * near-offer gap); when it's live, yield this justify-probe so flow
     * reaches the counter-base concession engine and the cash anchor steps
     * UP toward the agreed figure instead of stalling at the floor. Mirrors
     * the #128 reactive-probe yield above. */
    !inBandConditionalConverge;
  if (shouldProbeJustification) {
    return {
      kind: "probe-justification",
      satisfiesTopic: "probe-justification",
      _move: {
        lever: "probe-justification",
        newTotalLpa: null,
        /* Report the EFFECTIVE target (folds a fixed-scoped ask via
           effectiveTargetCtcLpa). This gate fires on probeJustifyTarget,
           which is non-null for fixed-scoped targets even when raw
           candidateTarget is null — interpolating the raw value here was
           the source of the "₹nullL" rationale the candidate saw echoed. */
        rationale: `Candidate target ₹${probeJustifyTarget}L exceeds initial ₹${state.band.initialOffer}L by >5% with no justification on the table; probe before countering.`,
      },
    };
  }

  /* Perfect 3 (2026-05-16) — firm-urgency bias toward finalising.
   *
   * When the candidate has surfaced a firm deadline (in-hand offer,
   * "by Friday", etc.) AND discovery is complete AND there's an offer
   * already on the table AND phase is counter-offer or closing-push,
   * skip another lever-explore / counter-split round and go straight
   * to the formal close recap. Real recruiters in firm-urgency
   * situations stop rotating non-cash levers and pin down the fitment
   * before the candidate's deadline forces a walk.
   *
   * Gated narrowly to avoid disrupting the priority cascade:
   *   - close-recap-formal already wins on verbalAcceptance above, so
   *     this only adds coverage for the "no verbal accept but firm
   *     deadline" branch.
   *   - Requires an offer on the table (highestOfferMade > 0) — we are
   *     not authoring a new anchor under urgency, just finalising one
   *     that already exists.
   *   - Requires discovery complete (via the discoveryChecklist +
   *     roleFamily helpers when present, falling back to "expectedCtc"
   *     askedTopics proxy when the checklist hasn't been initialised
   *     for the session — matches the gating rule from the compaction
   *     notes).
   *   - Suppressed once close-recap-formal has already fired (sticky
   *     via reactiveFollowupsFired).
   *   - Soft urgency intentionally NOT acted on here — informational
   *     only, surfaced via the askedTopic ledger when the formal recap
   *     does eventually fire. */
  if (
    state.cumulativeUrgency === "firm" &&
    state.highestOfferMade > 0 &&
    (state.phase === "counter-offer" || state.phase === "closing-push") &&
    !(state.reactiveFollowupsFired ?? []).includes("close-recap-formal")
  ) {
    const roleFamily = classifyRoleFamily(state.role);
    /* askedTopics carries item-key strings using the
     * `<topic>Asked` / `<topic>Answered` naming scheme (e.g.
     * `targetAsked`, `targetAnswered`) — NOT the bare `expectedCtc`
     * string. Defect 5 (2026-05-16): the prior check
     * `t.topic === "expectedCtc"` could never match because no
     * push-site emits that literal; the proxy was permanently false
     * and the firm-urgency close-recap path silently dropped through.
     * Use the canonical `targetAsked` / `targetAnswered` keys here so
     * the proxy actually fires when the checklist is missing. */
    const discoveryDone =
      state.discoveryChecklist != null
        ? isDiscoveryComplete(state.discoveryChecklist, roleFamily)
        : readAskedTopics(state).some(
            (t) => t.topic === "targetAsked" || t.topic === "targetAnswered",
          );
    if (discoveryDone) {
      return buildCloseRecapFormal(state);
    }
  }

  /* Phase 3 missing-lever set (2026-05-17) — interception block for the
   * three new Indian-HR levers (panel-approval-stall / polite-walkaway /
   * anchor-defense-hike-strong). All three apply across the
   * counter-offer + closing-push phases, so the gate is hoisted above
   * the per-phase branches. Single-fire each via dedicated turn-marker
   * state fields.
   *
   * Priority order (per audit spec):
   *   1. polite-walkaway — short-circuits everything when the candidate
   *      is stalling without leverage. We've already conceded once and
   *      they're not engaging; holding the fitment open burns the slot.
   *   2. anchor-defense-hike-strong — reactive to a specific "only X%
   *      hike" complaint. Must beat comparative-anchoring because the
   *      candidate's framing is hike-%-driven, not band-quartile-driven.
   *   3. panel-approval-stall — stall before escalating to the internal-
   *      equity-defense round. Fires between comparative-anchoring's
   *      counterRound==1 and internal-equity-defense's counterRound>=2,
   *      i.e. counterRound>=2 AND the candidate countered again.
   *
   * The polite-walkaway / hike-strong branches sit ABOVE comparative-
   * anchoring (which fires inside the counter-offer block); the
   * panel-approval-stall branch is co-located after comparative-
   * anchoring fires but BEFORE internal-equity-defense per spec — that
   * ordering is enforced inside the counter-offer block itself. */
  if (
    (state.phase === "counter-offer" || state.phase === "closing-push") &&
    state.verbalAcceptanceTurn == null
  ) {
    /* 1. polite-walkaway — highest priority. */
    const stallSignal = state.candidateStance?.stallSignal ?? null;
    const flexibilityPosture = state.candidateStance?.flexibilityPosture ?? null;
    const competingOfferStatus = state.competingOfferDetail?.status ?? null;
    if (
      state.politeWalkawayFiredAtTurn == null &&
      stallSignal != null &&
      state.competingOffer == null &&
      competingOfferStatus == null &&
      state.counterRound >= 1 &&
      flexibilityPosture !== "flexible"
    ) {
      return {
        kind: "polite-walkaway",
        _move: {
          lever: "hold-firm",
          newTotalLpa: state.highestOfferMade,
          actionKind: "polite-walkaway",
          rationale:
            `Polite walk-away: candidate stall='${stallSignal.kind}' (since turn ${stallSignal.statedAt}), ` +
            `no leverage (competingOffer=null), counterRound=${state.counterRound}, ` +
            `flexibilityPosture=${flexibilityPosture ?? "null"}; decline to keep the fitment open.`,
        },
      };
    }

    /* 1b. fake-leverage-challenge — soft probe for offer-letter proof.
     * Inserted between polite-walkaway (1) and anchor-defense-hike-strong
     * (2). Fires when the candidate has DISCLOSED a competing offer but
     * provided no proof, AND we have already conceded once (so we don't
     * pre-emptively accuse the candidate of bluffing on round 0). Single-
     * fire via two redundant gates: the top-level
     * `fakeLeverageChallengeFiredAtTurn` marker AND the
     * `competingOfferDetail.proofRequestedAtTurn` stamp. The challenge is
     * skipped entirely once proof is provided (or already shared via
     * letterShareOffered). */
    const coDetail = state.competingOfferDetail;
    /* PR-4 (PDF #28) — ledger-first competing-offer read. Once a
     * competing-offer amount is disclosed, first-wins locks the value
     * the planner reasons about; a later misparse of a follow-up
     * candidate utterance can no longer change the leverage math. */
    const competingOfferValue = getFactOr(state.ledger, "competing-offer", state.competingOffer);
    const hasUnsubstantiatedOffer =
      competingOfferValue != null &&
      coDetail != null &&
      hasConcreteTell(coDetail) &&
      coDetail.letterShareOffered !== true &&
      coDetail.proofProvided !== true &&
      coDetail.proofRequestedAtTurn == null;
    if (
      state.fakeLeverageChallengeFiredAtTurn == null &&
      hasUnsubstantiatedOffer &&
      state.counterRound >= 1
    ) {
      const competingCompany = coDetail?.company ?? null;
      return {
        kind: "fake-leverage-challenge",
        competingCompany,
        _move: {
          lever: "hold-firm",
          newTotalLpa: state.highestOfferMade,
          actionKind: "fake-leverage-challenge",
          rationale:
            `Fake-leverage challenge: candidate disclosed competing offer ` +
            `(₹${competingOfferValue}L${competingCompany ? `, ${competingCompany}` : ""}) ` +
            `but provided no proof; counterRound=${state.counterRound}. ` +
            `Softly request offer letter / redacted version to corroborate ` +
            `before further concessions.`,
        },
      };
    }

    /* 1c. competitor-match (PDF#42 BUG-A, 2026-05-21) — fires when the
     * candidate HAS substantiated the competing offer (proofProvided
     * OR letterShareOffered) AND that offer exceeds our standing offer.
     * Without this branch, the planner cascaded into lever-explore /
     * pickLeverExploreMove, whose canonical surface (after LLM restyle)
     * landed on "Thanks for that — what else can we add to the
     * fitment?" — putting the ball in the candidate's court right at
     * the moment leverage is concrete. The recruiter MUST own the
     * response: commit to a panel re-check with a revert window. */
    const competitorProven =
      coDetail != null &&
      (coDetail.proofProvided === true || coDetail.letterShareOffered === true);
    if (
      state.competitorMatchFiredAtTurn == null &&
      competitorProven &&
      competingOfferValue != null &&
      competingOfferValue > state.highestOfferMade &&
      state.highestOfferMade > 0 &&
      /* Order discipline: only commit panel-match AFTER the proof-of-
       * leverage probe has fired. If the candidate volunteers a letter
       * unprompted, we still want the fake-leverage-challenge to run
       * first so the recruiter visibly verified before committing. The
       * single-fire stamp ensures we don't loop on the challenge. */
      state.fakeLeverageChallengeFiredAtTurn != null
    ) {
      const competingCompany = coDetail?.company ?? null;
      return {
        kind: "competitor-match",
        competingOffer: competingOfferValue,
        competingCompany,
        _move: {
          lever: "hold-firm",
          newTotalLpa: state.highestOfferMade,
          actionKind: "competitor-match",
          rationale:
            `Competitor-match: candidate substantiated competing offer ` +
            `(₹${competingOfferValue}L${competingCompany ? `, ${competingCompany}` : ""}) ` +
            `above standing offer ₹${state.highestOfferMade}L. Commit to ` +
            `panel re-check with revert window rather than routing through ` +
            `lever-explore (which historically prompted the candidate).`,
        },
      };
    }

    /* 1d. ctc-inflation-anchor (audit fix 2026-05-21) — fires when the
     * candidate over-anchors (>= 1.3x initial offer) AFTER at least one
     * counter-base has already shipped. The lever weaponises CTC-vs-in-
     * hand confusion by quoting a headline total package broken into
     * fixed / variable / ESOP-paper / JB / benefits (60/18/12/5/5 mix).
     * Single-fire per session via `leversUsed`. Sits between competitor-
     * match (proven leverage path) and anchor-defense-hike-strong
     * (small-hike complaint path) so neither legitimate branch is
     * displaced. See shouldFireCtcInflationAnchor for the full gate. */
    if (shouldFireCtcInflationAnchor(state)) {
      const action = planCtcInflationAnchor(state);
      if (action != null) return action;
    }

    /* 2. anchor-defense-hike-strong — fires when candidate complains
     * the offer represents only a small % hike on their current CTC.
     * Compute hikePct from max(highestOfferMade, band.initialOffer) and
     * candidateCurrentCtc; payload echoes both numbers so the canonical
     * prose has the exact rebuttal context. */
    const complained = state.candidateStance?.complainedAboutHikePercent ?? false;
    /* PR-4 (PDF #28) — read currentCtc ledger-first so hike-percent math
     * is computed against the candidate's FIRST disclosed value, even
     * if a later misparse overwrote the slot. */
    const currentCtcForHike = getFactOr(state.ledger, "current-ctc", state.candidateCurrentCtc);
    if (
      state.hikeStrongDefenseFiredAtTurn == null &&
      state.phase === "counter-offer" &&
      complained &&
      currentCtcForHike != null &&
      currentCtcForHike > 0
    ) {
      const offer =
        state.highestOfferMade > 0 ? state.highestOfferMade : state.band.initialOffer;
      const hikePct = Math.round(((offer - currentCtcForHike) / currentCtcForHike) * 100);
      return {
        kind: "anchor-defense-hike-strong",
        hikePct,
        currentCtc: currentCtcForHike,
        offer,
        _move: {
          lever: "hold-firm",
          newTotalLpa: state.highestOfferMade,
          actionKind: "anchor-defense-hike-strong",
          rationale:
            `Anchor-defense (hike-strong): candidate complained about hike %; ` +
            `offer ₹${offer}L on ₹${currentCtcForHike}L = ${hikePct}% hike (peers see 8-12% on laterals).`,
        },
      };
    }
  }

  /* counter-offer: split with stiffening / market / risk / boost. */
  if (state.phase === "counter-offer") {
    if (state.hardBandCap) {
      return wrapLeverExplore(pickLeverExploreMove(state), "hard-band-cap", state);
    }
    if (state.verbalAcceptanceTurn != null) {
      if (state.postVerbalRenegotiationCount >= 2) {
        return {
          kind: "rescission",
          _move: {
            lever: "close-walkaway",
            newTotalLpa: null,
            rationale: "Candidate verbally accepted then re-opened twice — the offer is being rescinded.",
          },
        };
      }
      return {
        kind: "hold-firm",
        mode: "verbal-accept",
        _move: {
          lever: "hold-firm",
          newTotalLpa: state.highestOfferMade,
          rationale: "Candidate verbally accepted; further base asks risk rescission. Hold firm.",
        },
      };
    }

    /* Crack 3 (2026-05-17) — band-defense triad as a deterministic
     * step ladder. Replaces three sequential if/return blocks whose
     * ordering depended on a mix of counterRound thresholds and
     * single-fire stamps — interleaving a reactive interrupt
     * (anchor-defense-hike-strong / fake-leverage-challenge) used to
     * shuffle the sub-sequence depending on which stamp happened to
     * be set first. Now: defensiveLadderStep(state) returns the next
     * step (0/1/2) keyed off the reactiveFollowupsFired ledger; each
     * step gates on the previous step's ledger entry. The triad
     * shares one single-fire mechanism (the askedTopic ledger), not
     * a mix of ledger + dedicated stamp fields.
     *
     *   step 0 → comparative-anchoring   (peer-band reframe)
     *   step 1 → panel-approval-stall    (manufactured friction)
     *   step 2 → internal-equity-defense (final defensive)
     *
     * The panelApprovalStallFiredAtTurn stamp continues to be set by
     * applyAiMove for downstream consumers; the ladder itself no
     * longer reads it. */
    switch (defensiveLadderStep(state)) {
      case 0: {
        /* Quartile selection requires candidateTarget. If absent, fall
         * through to the rest of the planner — the triad re-arms next
         * turn once the candidate has stated a target. */
        if (state.candidateTarget != null) {
          const peerBandMedian =
            (state.band.maxStretch + state.band.initialOffer) / 2;
          /* Class-A (2026-06-15) — bucket on the CTC-equivalent target so an
           * in-hand-framed ask is compared in the same frame as the band
           * median (both total-CTC), not under-quoted into the wrong quartile. */
          const cmpTarget = effectiveTargetCtcLpa(state) ?? state.candidateTarget;
          const quartile: "top" | "median" =
            cmpTarget >= peerBandMedian ? "top" : "median";
          return {
            kind: "comparative-anchoring",
            quartile,
            satisfiesTopic: "comparative-anchoring",
            _move: {
              lever: "hold-firm",
              newTotalLpa: state.highestOfferMade,
              rationale: `Comparative-anchoring: candidate target ₹${cmpTarget}L vs band-median ₹${peerBandMedian.toFixed(1)}L (quartile=${quartile}).`,
              askedTopic: "comparative-anchoring",
              actionKind: "comparative-anchoring",
            },
          };
        }
        break;
      }
      case 1: {
        return {
          kind: "panel-approval-stall",
          _move: {
            lever: "hold-firm",
            newTotalLpa: state.highestOfferMade,
            actionKind: "panel-approval-stall",
            askedTopic: "panel-approval-stall",
            rationale:
              `Panel-approval stall: counterRound=${state.counterRound}, defensive ladder step 1; ` +
              `escalate to leadership before the next concession (single-fire).`,
          },
        };
      }
      case 2: {
        const peerBandTopLpa = Math.round(state.band.maxStretch * 10) / 10;
        const peerBandMedianLpa =
          Math.round(((state.band.maxStretch + state.band.initialOffer) / 2) * 10) / 10;
        return {
          kind: "internal-equity-defense",
          peerBandTopLpa,
          peerBandMedianLpa,
          satisfiesTopic: "internal-equity-defense",
          _move: {
            lever: "hold-firm",
            newTotalLpa: state.highestOfferMade,
            rationale: `Internal-equity defense: peer band ₹${peerBandMedianLpa}-${peerBandTopLpa}L; further movement requires Comp sign-off.`,
            askedTopic: "internal-equity-defense",
            actionKind: "internal-equity-defense",
          },
        };
      }
      case null:
        break;
    }

    /* #123 (2026-06-21, live Flipkart EM) — never bid against ourselves.
     * The counter-base concession engine sizes a move from the GAP between a
     * candidate aspiration and our standing offer. When the candidate has
     * named NO aspiration of any kind (no total target, no fixed target, no
     * total-scoped counter), the `?? state.band.maxStretch` default below
     * silently invented an aspiration at the band ceiling — so a purely
     * content-free / stonewalling candidate got cash auto-escalated toward
     * maxStretch for free (live: ₹32.7L → ₹37.2L on a bare "Hmm."). Industry
     * practice: hold the standing number and invite a figure rather than
     * concede toward a target the candidate never stated. This guard mirrors
     * the #122 offer-recap hold but on the counter-offer-phase side, where the
     * #119 stonewall predicate doesn't reach. The branch re-arms the instant
     * any real number lands (any of the three signals below goes non-null). */
    /* B2 (2026-07-23) — removed `state.lastCandidateCounterLpa != null` as
     * the third arm here. That raw per-turn field is not cleared between turns
     * and goes stale: once a candidate states any cash number, the field
     * persists indefinitely, causing `candidateNamedAspiration` to stay true
     * even when they switch to a non-cash push or stay silent. The result was
     * the counter-base cash engine firing toward a number the candidate never
     * restated. effectiveTargetCtcLpa covers the sticky session ask; the
     * totalScopedCounter covers the current-turn total counter — together they
     * are sufficient and neither goes stale. */
    const candidateNamedAspiration =
      effectiveTargetCtcLpa(state) != null ||
      totalScopedCounter(state) != null;
    if (!candidateNamedAspiration && (state.highestOfferMade ?? 0) > 0) {
      /* Route to lever-explore, NOT hold-firm: the counter-base engine's
       * phantom aspiration at maxStretch is what manufactures the headroom
       * that ships a free cash bump. With no real aspiration there is no real
       * gap — exactly the no-headroom case below — so we keep the standing
       * number flat and rotate a non-cash lever. lever-explore (not hold-firm)
       * also respects the PDF#31 BUG D min-counter-rounds floor: a premature
       * hold-firm here would stonewall before any real bargaining, whereas
       * the candidate genuinely has not bargained — they have said nothing. */
      return wrapLeverExplore(pickLeverExploreMove(state), "no-headroom", state);
    }

    /* Class-A (2026-06-15) — effectiveTargetCtcLpa folds in-hand→CTC and
     * fixed-only→implied-total so the aspiration isn't computed in the wrong
     * frame (the in-hand under-quote / fixed-only fall-to-ceiling bugs). The
     * Math.min(target, ceiling) below still clamps to band.
     *
     * S54-B3/B4 (2026-07-24) — when the offer already exceeds the candidate's
     * intake target (over-offer scenario — e.g. offer ₹21.8L vs stated target
     * ₹18L), effectiveTargetCtcLpa returns ₹18L which is ≤ floor ₹21.8L →
     * aspiration ≤ floor → no-headroom guard fires → lever-explore, even though
     * the candidate then counter-offers at ₹23L. Fold totalScopedCounter as the
     * effective aspiration when it exceeds the intake target: the candidate's
     * explicit counter is their real ask, and the engine must respond to it. */
    const _eftTarget = effectiveTargetCtcLpa(state);
    const _counter = totalScopedCounter(state);
    const target =
      (_counter != null && (_eftTarget == null || _counter > _eftTarget)
        ? _counter
        : _eftTarget) ?? state.band.maxStretch;
    /* Step 5 (2026-05-16, ResumeFactPack track) — when the candidate has
     * not disclosed their currentCtc, fall back to the resume-implied
     * prior CTC as a floor signal. The counter math anchors against
     * max(highestOfferMade, effectiveAnchor, impliedPriorCtc), so a
     * candidate withholding CTC but with a strong resume (e.g. FAANG
     * latest role) gets a floor that reflects their plausible prior
     * package rather than collapsing to the offer/anchor alone. */
    const priorCtcFloor =
      state.candidateCurrentCtc == null && state.impliedPriorCtcFromResume != null
        ? state.impliedPriorCtcFromResume
        : 0;
    const baseFloor = Math.max(state.highestOfferMade, effectiveAnchorLpa(state), priorCtcFloor);
    let ceiling = state.band.maxStretch;
    /* Hike-cap ceiling: prefer stated currentCtc, but when withheld and a
     * resume-implied prior CTC exists, use that as the basis. Same hard
     * clamp (band.maxStretch × 1.10) applies in both branches. */
    const ctcBasis =
      state.candidateCurrentCtc != null && state.candidateCurrentCtc > 0
        ? state.candidateCurrentCtc
        : (state.candidateCurrentCtc == null && state.impliedPriorCtcFromResume != null
            ? state.impliedPriorCtcFromResume
            : null);
    if (ctcBasis != null && ctcBasis > 0) {
      const cap = getCompanyHikeCap(state.company);
      if (cap != null) {
        const capped = ctcBasis * (1 + cap / 100);
        /* #66 (2026-06-18) — the hike cap may only BIND when it sits at or
         * above the standing-offer floor. If the band already extended an
         * offer ABOVE the hike-implied cap (e.g. band {39.2, 56} on a
         * candidate at 24 LPA — a 63% hike that deliberately breaches the
         * 50% company cap), the per-current-CTC hike cap has already been
         * overridden by the band decision and is moot. The previous
         * `Math.max(capped, floor)` pinned the ceiling DOWN to the floor in
         * that case, collapsing all in-band headroom to zero — so the
         * planner read every in-band cash target as "no-headroom" and
         * rotated non-cash levers forever instead of raising the cash
         * anchor. When capped < floor we leave the ceiling at
         * band.maxStretch (the company's real decision envelope); the cap
         * only narrows the ceiling when it lands above the standing offer. */
        if (capped < ceiling && capped >= baseFloor) ceiling = capped;
        // F7 (2026-05-15) — clamp hike-cap to band.maxStretch * 1.10.
        // Company hike cap may exceed band.maxStretch by up to 10% —
        // company-specific reality overrides generic band, but not
        // unboundedly. Without this clamp a permissive company cap
        // (e.g. 80% hike) paired with a high currentCtc could drift
        // the ceiling far above any reasonable band, defeating the
        // structural walk-away protections.
        const hardCap = state.band.maxStretch * 1.10;
        if (ceiling > hardCap) ceiling = Math.max(hardCap, baseFloor);
      }
    }
    const aspiration = Math.min(target, ceiling);
    /* Competing-aware counter floor (#92, 2026-06-19, live-staging).
     * A credible, in-band competing offer ABOVE our standing offer is
     * leverage we can and should answer — a real recruiter who can match
     * within band does so rather than parroting a generic split-toward-
     * target that lands below the candidate's stated competing number.
     * Before this, the competing offer touched the counter math only via
     * `competingCredibility → counterOfferRisk`, which *shrinks* the
     * concession (retention-risk logic) — exactly backwards for leverage.
     *
     * Gate tightly to avoid regressing the proof-discipline paths:
     *   - NAMED (company present) or letter-in-hand — a bare vague "I have
     *     another offer" without a recognised company is left to the
     *     existing fake-leverage-challenge / vague-credibility probe.
     *   - strictly ABOVE baseFloor (real leverage over our offer),
     *   - within ceiling (out-of-band/inflated numbers are handled by the
     *     hold / inflated-number prose guard, never auto-matched here), and
     *   - strictly BELOW the candidate's own aspiration — we never counter
     *     at/above what they're asking, and this keeps a real concession
     *     gap so the split math ships a move instead of collapsing to
     *     no-headroom/lever-explore (a competing number that exceeds the
     *     candidate's stated target is contradictory input; leave it to the
     *     normal curve).
     * When it fires, the counter floor rises to the competing number so
     * newTotal lands at-or-above it (a genuine match), still under ceiling. */
    const competingFloor = (() => {
      const co = state.competingOffer;
      if (co == null) return 0;
      const named =
        state.competingOfferDetail?.company != null ||
        state.competingOfferDetail?.letterShareOffered === true;
      if (!named) return 0;
      if (co <= baseFloor) return 0;
      if (co > ceiling) return 0;
      if (co >= aspiration) return 0;
      return co;
    })();
    const floor = Math.max(baseFloor, competingFloor);

    if (aspiration <= floor + 0.1) {
      return wrapLeverExplore(pickLeverExploreMove(state), "no-headroom", state);
    }

    /* perfect 1 (2026-05-16) — multi-turn negotiation spiral.
     * counterRound = number of counter-base moves already shipped this
     * session. Apply a diminishing-concessions multiplier to the
     * gap-fraction on each subsequent counter so the conversation
     * tapers naturally. The existing splitSchedule/boost stack is
     * already tuned for the first counter (round 0 → ~50% of gap), so
     * the multiplier table is [0.30, 0.20, 0.10] (counter-realism phase 3):
     *   round 0 → 30% of tuned base (small first concession; Indian HR rarely jumps)
     *   round 1 → 20% of tuned base (we've moved once; stiffer)
     *   round 2 → 10% of tuned base (stretching the band; near-final)
     *   round 3+ → 0 (hold firm; pivot to structural levers)
     * Composes multiplicatively with splitSchedule/boost AND applies
     * BEFORE the band-cap component clamp on newTotal. Tightened from
     * the prior [1.0, 0.66, 0.33] curve to model realistic Indian HR
     * concession behaviour — first counter is rarely > 5–10% of asked
     * gap; subsequent rounds halve again. */
    const spiralRound = state.counterRound;
    if (spiralRound >= 3) {
      return {
        kind: "hold-firm",
        mode: "lever-loop",
        _move: {
          lever: "hold-firm",
          newTotalLpa: state.highestOfferMade,
          rationale: `Counter-spiral exhausted (round ${spiralRound}); pivot to structural levers instead of more cash.`,
        },
      };
    }
    /* PDF#40 BUG-1 (2026-05-21) — re-tuned from [0.30, 0.20, 0.10].
     * The old curve composed multiplicatively with splitSchedule[0]=0.5
     * to produce a 0.15× gap-fraction on the first counter (e.g. ₹37
     * → ₹37.75 on a 5L candidate ask — the live Flipkart session).
     * That's a ~₹0.7L concession on a ₹5L gap; real Indian HR first
     * concessions sit in the 1.5–2L band on the same gap. New curve
     * lands round 0 at 0.5×0.60=0.30 of the gap, round 1 at 0.35×0.35
     * =0.12, round 2 at 0.22×0.18≈0.04 — meaningful first concession,
     * still tapering hard into the band ceiling on subsequent rounds. */
    const SPIRAL_MULTIPLIERS = [0.60, 0.35, 0.18];
    const spiralMultiplier = SPIRAL_MULTIPLIERS[spiralRound] ?? 0;
    const counterCount = state.leversUsed.filter(l => l === "counter-base").length;
    const splitSchedule = [0.5, 0.35, 0.22, 0.12, 0.06];
    let split = splitSchedule[counterCount] ?? 0.05;

    let boost = 1;
    if (state.candidateAskedAsRange) boost += 0.15;
    if (state.vossTacticsUsed.includes("calibrated")) boost += 0.25;
    if (state.vossTacticsUsed.includes("label")) boost += 0.15;
    if (state.vossTacticsUsed.includes("mirror")) boost += 0.05;
    if (state.vossTacticsUsed.includes("sign-today-bundle")) boost += 0.35;
    if (state.vossTacticsUsed.includes("deflect-current-ctc")) boost += 0.10;
    const infoBoost = Math.min(state.infoAsked.length * 0.03, 0.10);
    boost += infoBoost;
    if (state.recentRecoveryActive) boost += 0.05;
    if (boost > 2) boost = 2;
    split = Math.min(split * boost, 0.6);

    const tenureSignal = state.candidateProfile?.tenureSignal ?? null;
    const tenureMonths = (() => {
      if (typeof tenureSignal !== "string") return null;
      const m = tenureSignal.match(/(\d+)\s*(?:mo|month|months)/i);
      if (m) return parseInt(m[1], 10);
      const y = tenureSignal.match(/(\d+)\s*(?:yr|year|years)/i);
      if (y) return parseInt(y[1], 10) * 12;
      return null;
    })();
    const competingCredibility: "vague" | "named" | "letter-in-hand" | null =
      state.competingOfferDetail?.letterShareOffered
        ? "letter-in-hand"
        : state.competingOfferDetail?.company
          ? "named"
          : state.competingOffer != null
            ? "vague"
            : null;
    const counterOfferRisk = estimateCounterOfferRisk({
      currentCtcLpa: state.candidateCurrentCtc ?? null,
      targetLpa: state.candidateTarget ?? null,
      tenureMonths,
      currentEmployer: state.currentEmployer ?? null,
      competingOfferCredibility: competingCredibility,
    }).risk;
    if (counterOfferRisk === "high") split *= 0.8;
    else if (counterOfferRisk === "medium") split *= 0.9;

    if (state.marketMode === "soft") split *= 0.7;
    else if (state.marketMode === "hot") split *= 1.3;

    if (state.walkAwayReturned) split *= 0.5;

    /* Affinity-dynamic feature (2026-05-29) — recruiter's per-call
     * affinity modulates concession headroom: +1 = +5% headroom,
     * -1 = -5%, capped at ±15% (i.e. ±3 cumulative affinity). Applied
     * multiplicatively to `split` (the gap-fraction). Conservative —
     * affinity = 0 → no-op (byte-identical to pre-feature behavior). */
    const affinity = state.recruiterAffinity ?? 0;
    if (affinity !== 0) {
      const affMult = 1 + Math.max(-0.15, Math.min(0.15, affinity * 0.05));
      split *= affMult;
    }

    /* 2026-05-30 time-context — concession headroom multiplier from the
     * derived time-context. Default "midweek-standard" → 1.0 (no-op).
     * Stacks multiplicatively with affinity. friday-rush 0.7 tightens
     * the gap-fraction; monday-fresh 1.2 loosens it. */
    const tCtx = state.timeContext ?? "midweek-standard";
    const timeMult = timeContextToMoodDelta(tCtx).concessionHeadroom;
    if (timeMult !== 1.0) {
      split *= timeMult;
    }

    /* Recruiter-power-dynamics feature (2026-05-29) — power inverse
     * modulates concession headroom. recruiterPower +3 → 0.85× (recruiter
     * strong, tighter); -3 → 1.15× (recruiter hungry, wider). Power 0 →
     * 1.0× (no-op, byte-identical to pre-feature behaviour). Stacks
     * multiplicatively with affinity + time-context. */
    const powerHeadroom = 1 + Math.max(-0.15, Math.min(0.15, -(state.recruiterPower ?? 0) * 0.05));
    split *= powerHeadroom;

    if (split > 0.95) split = 0.95;
    /* perfect 1 (2026-05-16) — apply the spiral multiplier to the
     * gap-fraction. Composed multiplicatively with the existing
     * splitSchedule/boost stack so a stiffened rotation still tapers
     * over multiple counter rounds. Applied BEFORE the component
     * constraint validator below (band-cap clamp), so the diminishing
     * concessions take effect first and the band-ceiling still wins
     * as a hard ceiling when the multiplied gap would overshoot. */
    split = split * spiralMultiplier;
    /* PDF#45 BUG-5 fix (2026-05-25) — Flipkart Sr-PD session shipped a
     * first concession of ~8% of the gap. With market signals stacked
     * (calibrated, named competing offer, hot market) the first counter
     * should clear a floor of 15% of (aspiration - floor); otherwise the
     * candidate hears a token move and walks. Floor only applies on
     * round-0 (first counter), so subsequent rounds still taper. */
    if (spiralRound === 0 && counterCount === 0) {
      const MIN_FIRST_CONCESSION_FRACTION = 0.15;
      if (split < MIN_FIRST_CONCESSION_FRACTION) {
        split = MIN_FIRST_CONCESSION_FRACTION;
      }
    }
    /* Counter-offer side keeps 1-decimal precision: the concession-curve
     * arithmetic (risk × multiplier × spiralMultiplier × marketMode boost)
     * relies on small numeric differences for the anti-exploitation and
     * hot/neutral comparisons. PDF#39 BUG-D scope was the anchor only. */
    const newTotal = Math.round((floor + (aspiration - floor) * split) * 10) / 10;

    const constraint = validateComponentConstraints(state.band, newTotal);
    if (!constraint.ok) {
      return wrapLeverExplore(pickLeverExploreMove(state), "constraint-violation", state);
    }
    /* Kernel-first cleanup (2026-05-16) — populate typed counter-offer
     * fields from band component metadata when present, so canonical
     * prose / restyle validator can read them without casting.
     *   base     = min(baseStretch, newTotal)
     *   variable = max(0, min(variableMax, newTotal - base))
     * Falls back to undefined for the split when the band lacks
     * component metadata; the total is always set. */
    const baseStretch = state.band.baseStretch;
    const variableMax = state.band.variableMax;
    let counterFixedLpa: number | undefined;
    let counterVariableLpa: number | undefined;
    if (baseStretch != null && variableMax != null) {
      const base = Math.min(baseStretch, newTotal);
      counterFixedLpa = Math.round(base * 10) / 10;
      counterVariableLpa =
        Math.round(Math.max(0, Math.min(variableMax, newTotal - base)) * 10) / 10;
    }
    /* PDF#46 B6 (2026-05-25) — surface candidate's stated base on the
     * counter action when their latest counter named one. Heuristic:
     * we're post-anchor (highestOfferMade > 0), the breakdown has a
     * non-null base, and the stated total roughly matches our parsed
     * lastCandidateCounterLpa — meaning the breakdown belongs to the
     * counter utterance, not a stale discovery-phase capture. */
    let candidateProposedBaseLpa: number | undefined;
    {
      const cb = state.candidateComponentBreakdown;
      /* B2 (2026-07-23) — replaced `state.lastCandidateCounterLpa` with
       * `effectiveTargetCtcLpa(state)` as the breakdown coherence target.
       * The raw per-turn field was cleared by applyAiMove each round, so when
       * the candidate states a component breakdown WITHOUT repeating their total
       * counter in the same utterance, the field is null and the coherence
       * check silently skips — losing the proposed base. effectiveTargetCtcLpa
       * is the sticky session-level ask (folding in-hand→CTC and fixed→total)
       * and is the correct reference to check "does this breakdown match what
       * the candidate has ever told us their target total is". */
      const counterTotal = effectiveTargetCtcLpa(state);
      if (
        state.highestOfferMade > 0 &&
        cb != null &&
        typeof cb.base === "number" &&
        cb.base > 0 &&
        typeof counterTotal === "number" &&
        counterTotal > 0
      ) {
        const v = typeof cb.variable === "number" ? cb.variable : 0;
        const breakdownTotal = cb.base + v;
        /* allow up to ±1L slack to absorb JB / ESOP framings */
        if (Math.abs(breakdownTotal - counterTotal) <= Math.max(1, counterTotal * 0.05)) {
          candidateProposedBaseLpa = Math.round(cb.base * 10) / 10;
        }
      }
    }
    return {
      kind: "counter-offer",
      counterTotalLpa: newTotal,
      counterFixedLpa,
      counterVariableLpa,
      candidateProposedBaseLpa,
      satisfiesTopic: "counter-base",
      _move: {
        lever: "counter-base",
        newTotalLpa: newTotal,
        rationale: `Split toward target (stiffening ${splitSchedule[counterCount] ?? 0.05}, effective ${split.toFixed(2)}, boost ${boost.toFixed(2)}, market ${state.marketMode}${state.walkAwayReturned ? ", returned" : ""}): floor ₹${floor} → ₹${newTotal} (target ₹${target}, ceiling ₹${ceiling}${priorCtcFloor > 0 ? `, priorCtcFloor ₹${priorCtcFloor}` : ""}${competingFloor > 0 ? `, competing-match floor ₹${competingFloor}` : ""}).`,
      },
    };
  }

  /* Bad-faith tactic injection (2026-05-29) — low-priority flavor
   * injects. Each tactic single-fires per session, gated by
   * state.tacticsUsed. The cascade above is the normal priority path;
   * only when nothing preempts do we consider a manipulation play.
   * Order below is the tactic priority (exploding-offer first because
   * it's only available late, then competing-candidate, then the
   * vague-promise filler). */
  {
    const tactic = maybePlanTacticInject(state);
    if (tactic !== null) return tactic;
  }

  /* Fix 1 (2026-05-16) — Indian-context structural lever rotation. Fires
   * ONLY after the legacy cash-lever rotation (equity-grant, joining-
   * bonus, notice-buyout, benefits-summary) is fully exhausted — i.e.
   * pickLeverExploreMove would otherwise return hold-firm. Gated on
   * marketMode (RSU refresh only for MNC/GCC: marketMode in {hot, neutral}
   * AND band has equity).
   *
   * This preserves the legacy fixture-test ordering (joining-bonus →
   * equity-grant → notice-buyout → benefits-summary) and only intercepts
   * the terminal hold-firm fallback to inject structural levers. */
  const legacyMove = pickLeverExploreMove(state);
  if (legacyMove.lever === "hold-firm") {
    const structural = pickStructuralLever(state);
    if (structural != null) return structural;
  }

  /* lever-explore / closing-push: rotate non-cash levers. */
  return wrapLeverExplore(legacyMove, "default", state);
}
