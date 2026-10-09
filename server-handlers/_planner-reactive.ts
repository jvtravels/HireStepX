/* Next-action planner: reactive and wired-profile follow-ups, offer fixed/variable split, close recap. */

import { type NegotiationState, type DiscoveryTopic, clampToCloseFloor } from "./_negotiation-kernel";
import { type PlannedAction, canRefire, buildMarketDataReferenceAsk } from "./_planner-actions";
import { isSalaryPush, latestCandidateText, routeCandidateQuestion } from "./_question-router";
import { renderCandidateQuestionResponse } from "./_candidate-question";
import { applyContextRefOverlay, applyPersonaTicSignature, humanizeRecruiterProse, applyFallibilityOverlay, tidyRealismArtifacts } from "./_recruiter-prose-realism";
import { getCandidateFirstName } from "./_candidate-name";
import { sessionJitter } from "./_session-jitter";
import { HIKE_JUSTIFICATION_THRESHOLD, shouldProbeHikeJustification, getHikeJustificationProbe } from "./_hike-justification-probe";
import { classifyRoleFamily } from "./_company-band-tiers";
import { nearOfferCloseNumber } from "./_planner-close";

/* Negotiation-flow redesign commit 4 (2026-05-15) — reactive followup
 * rule table. Returns a PlannedAction when a reactive trigger fires
 * (and hasn't been fired in this session before), null otherwise.
 *
 * Rule order = priority. First-match wins. Each rule consults
 * state.reactiveFollowupsFired before emitting; once a topic has fired,
 * it's permanently skipped for this session (the candidate has been
 * probed on it).
 *
 * Triggers all read state.lastTurnDelta — the per-turn diff populated
 * by applyCandidateAnswer. State-only triggers (no delta) would be
 * indistinguishable from a stale signal and re-fire spuriously, so
 * we always anchor on "what changed THIS turn".
 *
 * Pure. */
export function planReactiveFollowup(state: NegotiationState): PlannedAction | null {
  const delta = state.lastTurnDelta;
  if (!delta) return null;
  const fired = state.reactiveFollowupsFired ?? [];
  const hasFired = (topic: DiscoveryTopic): boolean => fired.includes(topic);

  /* Rule: answer-direct — candidate ended the turn on a direct question.
   * Highest priority among reactive rules: ignoring a candidate question
   * to push the next checklist item is the canonical procedural-by-default
   * failure mode. Topic key includes the turn so the same question
   * acknowledgement doesn't blanket-suppress future questions. */
  if (delta.askedQuestion) {
    /* PDF#27 Fix 5 (2026-05-17) — when the candidate's question this
     * turn IS specifically "what's the offer?" (kernel-stamped via
     * state.offerAskedAtTurn === turnIndex), DO NOT route through the
     * generic answer-direct branch. Defer to the dedicated band-anchor
     * gate downstream which has the band context to actually answer.
     * Without this skip, the generic reactive-followup pre-empts band-
     * anchor and the candidate's offer-ask gets a non-answer. */
    const offerAskedThisTurn =
      state.offerAskedAtTurn != null &&
      state.offerAskedAtTurn === state.turnIndex;
    /* BUG-006 fix (QA v3, 2026-05-19) — when the candidate's question
     * resolves to a specific wired-profile topic (joining bonus, fixed
     * flex, ESOP, growth path, tax, BGV, moonlighting, team, reporting,
     * relocation, spouse-family), DO NOT route through the generic
     * answer-direct branch. Defer to planWiredProfileFollowup which has
     * topic-specific Indian-recruiter prose for each of those asks.
     * Without this skip, 47/120 QA cases hit the generic "Sure — let me
     * address that directly." tail because answer-direct pre-empted the
     * more specific wired branch. */
    const profile = state.candidateProfile;
    const wiredProfileTopicMatches =
      profile != null &&
      (profile.wantsHigherBase ||
        profile.wantsJoiningBonus ||
        profile.wantsRelocationAllowance ||
        profile.mentionedSpouseFamily ||
        profile.askedAboutReporting ||
        profile.askedAboutGrowthPath ||
        profile.askedAboutGrowthPath8 ||
        profile.askedAboutTeamSize ||
        profile.mentionedTaxImplication ||
        profile.mentionedBgvConcern ||
        profile.mentionedMoonlighting);
    /* Structural completion-sink invariant (2026-06-18) — replaces the
     * accreted skip-pile (liveCounterPending numeric gate + the
     * isSalaryPush open-phrasing regex from F1/THIRD-sink).
     *
     * Root insight: the generic non-topical branch in this block is the
     * ONLY content-free move the planner can emit. Every other return
     * path is substantive — the counter-offer concession engine, the
     * defensive ladder, lever rotation (pickLeverExploreMove always
     * returns a real lever), hold-firm, and the terminal
     * `wrapLeverExplore(legacyMove, "default", state)` fallback. So the
     * "let me come back to where we were." deflection is only ever the
     * correct terminal move when there is genuinely no negotiation to
     * advance — i.e. BEFORE any offer is on the table (opening /
     * discovery). The moment an offer stands, deferring to the
     * downstream cascade is ALWAYS at least as good as deflecting.
     *
     * The old approach tried to enumerate which utterances were
     * negotiation moves (a numeric counter, then a regex of push
     * phrasings) and skip the filler for those — an open-ended
     * phrasing-matching game that re-broke on every new wording
     * ("is that really your best?", Hinglish, oblique pushes, …).
     * One invariant subsumes the whole list:
     *
     *   standing offer  ⇒  never ship the content-free filler.
     *
     * The curated-topic answer (route.kind === "topical") still fires
     * over a standing offer — answering a real question (ESOP, notice
     * buyout, …) is substantive, not a deflection — so ONLY the generic
     * fallthrough at the end of this block is gated on `!hasStandingOffer`. */
    const hasStandingOffer = state.highestOfferMade > 0;
    /* ArchRec 2 (2026-05-16) — was `answer-direct@${turnIndex}`. The
     * per-turn suffix made hasFired() always pass (every turn produced
     * a fresh string), so the "single-fire" intent was actually dead.
     * Use the canonical literal topic; dedup against
     * reactiveFollowupsFired works as documented now that the key
     * matches across turns. */
    /* PRI-59 (2026-06-25, real prod session) — an explicit cash/fixed PUSH
     * over a standing offer ("what's your best fixed, final answer?", "put a
     * number on the table") is a negotiation move, NOT a topic question. The
     * unified router happily resolves it to a curated `fixed-variable-split` /
     * benefits answer-direct that recaps structure WITHOUT naming a cash
     * anchor — reading as evasion of the candidate's direct cash demand. Skip
     * answer-direct for a salary push over a standing offer so the turn defers
     * to the negotiation engine (counter-base when headroom remains, else the
     * lever-explore cash-ceiling acknowledgment which DOES name the number).
     * Mirrors the offerAskedThisTurn / wiredProfileTopicMatches skips. */
    const salaryPushOverOffer =
      hasStandingOffer && isSalaryPush(latestCandidateText(state));
    if (
      !hasFired("answer-direct") &&
      !offerAskedThisTurn &&
      !wiredProfileTopicMatches &&
      !salaryPushOverOffer
    ) {
      /* PDF#51 (2026-05-28) — deterministic-prose preempt.
       *
       * If the unified router resolves the candidate's question to one
       * of the 14 curated topics AND the response bank returns prose
       * for the active persona, ship the new `answer-direct` NextAction
       * kind. negotiate-turn.ts detects this kind via the _move flag
       * and SKIPS the LLM call — the prose ships byte-for-byte from
       * the response bank. Wins over the legacy reactive-followup
       * branch below because (a) curated prose is more reliable than
       * the LLM-factPack output and (b) hallucination risk drops to
       * zero for matched topics. Falls through to the LLM path for
       * non-topical direct questions (intent-only / open-direct). */
      const route = routeCandidateQuestion(latestCandidateText(state));
      if (route?.kind === "topical") {
        const prose = renderCandidateQuestionResponse(
          route.topic,
          state.recruiterSectorPersona ?? null,
          state.roundPersona ?? null,
          /* 2026-05-29 realism-pass — pass sessionId+turn as the variant
           * seed so paraphrase rotation is consistent within a session
           * but diverges across sessions, and re-asks within a session
           * pick a different phrasing. See `hashSeed` in
           * _candidate-question.ts. */
          `${state.sessionId}:${state.turnIndex}`,
          /* 2026-05-29 realism-pass — phase-tinted variants. Passing the
           * active phase lets `budget-disclosure`, `range-grade-leverage`,
           * `fixed-variable-split`, and `notice-buyout` shift register
           * during `closing-push` (warmer / urgent) and during `opening`
           * (more guarded). See the precedence rule in
           * `renderCandidateQuestionResponse`. */
          state.phase ?? null,
          /* 2026-05-29 realism-pass — strict in-session variant rotation.
           * Pass the per-topic serve count so a re-ask of the same topic
           * lands on the next variant, not a hash collision with the
           * prior phrasing. The kernel increments this map after every
           * answer-direct ships (see `_negotiation-kernel.ts`). */
          (state.candidateQuestionServeCount ?? {})[route.topic] ?? 0,
          /* 2026-05-29 realism-pass P0-2 — candidate register threads
           * into the renderer so topics with `registerVariants` pick a
           * register-mirrored response. Falls through to phaseTinted /
           * variant rotation when no register entry exists. */
          state.candidateRegister ?? null,
        );
        if (prose) {
          /* 2026-05-29 realism-pass — humanize the curated prose with a
           * persona-tic prefix + mid-sentence hedge + checkback suffix.
           * Probabilistic by (sessionId, turnIndex), so most utterances
           * ship unchanged and the bank's accuracy is preserved. See
           * `_recruiter-prose-realism.ts` for the layer rules. */
          /* 2026-05-30 conversational-realism chain (mirrors canonical-
           * prose exit). Sequential: ctxRef → personaTic →
           * humanizeRecruiterProse → fallibility. Each overlay is a
           * no-op when its gate misses, so byte-equivalence with the
           * canonical-prose fallback path is preserved. */
          const persona = state.recruiterSectorPersona ?? "default";
          const sid = state.sessionId ?? "";
          const overlaysActive = sid.length > 0 && persona !== "default";
          let chained = prose;
          if (overlaysActive) {
            chained = applyContextRefOverlay(chained, persona, sid, state.turnIndex);
            chained = applyPersonaTicSignature(chained, sid, persona);
          }
          chained = humanizeRecruiterProse(chained, {
            sector: state.recruiterSectorPersona ?? null,
            phase: state.phase ?? null,
            sessionId: state.sessionId,
            turnIndex: state.turnIndex,
            candidateRegister: state.candidateRegister ?? null,
            candidateFirstName: getCandidateFirstName(state),
            mood: state.recruiterMood ?? null,
            moodDynamic: state.recruiterMoodDynamic ?? null,
            /* Fire the cold line iff the latch is unset OR was stamped
             * THIS turn (the first turn of the cooling episode). On later
             * cooled turns the latch < turnIndex → suppressed, so the line
             * appears exactly once per episode. Same for the rewarm prefix. */
            coldLineAlreadyFired: !(
              state.recruiterMoodColdLineFiredAtTurn == null ||
              state.recruiterMoodColdLineFiredAtTurn === state.turnIndex
            ),
            rewarmLineAlreadyFired: !(
              state.recruiterMoodRewarmLineFiredAtTurn == null ||
              state.recruiterMoodRewarmLineFiredAtTurn === state.turnIndex
            ),
          });
          if (overlaysActive) {
            chained = applyFallibilityOverlay(chained, {
              mood:
                (state.recruiterMoodDynamic && state.recruiterMoodDynamic !== "baseline"
                  ? state.recruiterMoodDynamic
                  : state.recruiterMood) ?? null,
              turnIndex: state.turnIndex,
              packageComplexity: computePackageComplexityLocal(state),
              sessionId: state.sessionId,
            });
          }
          /* Final output-contract pass — mirrors the canonical-prose and
           * LLM-restyle exits. This answer-direct path composes its OWN
           * overlay chain at the planner level (it is pre-humanized so
           * canonical-prose suppresses re-humanizing), which means the
           * single tidy pass in `_canonical-prose.ts` never sees this text.
           * Without it, a stacked-tic roll ("Look, basically, on the buyout
           * piece …") or a broken mid-sentence cap ships raw. Run tidy on
           * every non-null-session turn — same gate as the humanizer above —
           * so this third composition point honours the same contract.
           * (Surfaced via the offline dice sweep, 2026-06-19.) */
          const spokenProse =
            sid.length > 0 ? tidyRealismArtifacts(chained) : chained;
          return {
            kind: "answer-direct",
            topic: route.topic,
            prose: spokenProse,
            satisfiesTopic: "answer-direct",
            _move: {
              lever: "probe",
              newTotalLpa: null,
              rationale:
                `PDF#51 deterministic answer-direct — candidate asked ` +
                `about "${route.topic}" at turn ${state.turnIndex}; ` +
                `ship curated response-bank prose (humanized), skip LLM.`,
              actionKind: "answer-direct",
              askedTopic: "answer-direct",
              deterministicProse: spokenProse,
              answerDirectTopic: route.topic,
            },
          };
        }
      }
      /* BUG E fix (PDF#31, 2026-05-18) — `ask` MUST be candidate-facing
       * prose, never an internal directive. Previously this field carried
       * "Answer the candidate's question first; checklist advance pauses
       * until the question is addressed.", which the canonical-prose
       * answer-direct branch shipped verbatim to the candidate, producing
       * the system-prompt leak in PDF#31 T18. The actual question is
       * answered by generateAnswerToCandidate via the LLM factPack path;
       * the canonical here is only a fallback tail. Keep it as safe,
       * neutral candidate prose. */
      /* Generic non-topical filler — the planner's only content-free
       * move. Forbidden over a standing offer (see the invariant comment
       * above): when an offer is on the table we fall through to the
       * downstream cascade (counter-offer engine / lever rotation /
       * hold-firm), which always negotiates instead of deflecting. Pre-
       * offer (opening / discovery) it remains the right acknowledgement
       * while the recruiter is still gathering context. */
      if (!hasStandingOffer) {
        return {
          kind: "reactive-followup",
          ask: "Sure — let me address that directly.",
          trigger: "askedQuestion",
          topic: "answer-direct",
          satisfiesTopic: "answer-direct",
          _move: {
            lever: "probe",
            newTotalLpa: null,
            rationale: "Candidate asked a direct question this turn — answer before advancing.",
            actionKind: "reactive-followup",
            askedTopic: "answer-direct",
          },
        };
      }
    }
  }

  /* Rule: variable-comfort — variable share is meaningful (>25%) on
   * the current-CTC breakdown. Real recruiters probe whether the
   * candidate has been hitting payouts in full before treating variable
   * as banked.
   *
   * PDF#46 (2026-05-25) — fire whenever the breakdown is populated
   * with a high variable share, not only on the turn currentCtc was
   * first disclosed. The Flipkart Sr-PD transcript disclosed total
   * (36L) on turn 2 and base (14L → 22L implicit variable, 61% share)
   * on turn 4; the per-turn delta gate meant the probe never fired. */
  if (!hasFired("variable-comfort")) {
    const breakdown = state.candidateComponentBreakdown;
    /* PRI-61 (2026-07-05, live Flipkart EM) — the probe interrogates
     * payout history ("have you been hitting payouts in full?"), which is
     * only coherent when the candidate ACTUALLY DISCLOSED a variable-heavy
     * split. A complement-INFERRED variable (base + known total → derived
     * variable, `variableInferred: true`) is explicitly not a disclosure —
     * every other consumer (nextComponentProbe, canonical prose, move-spec)
     * gates on `variableInferred !== true`; this probe was the lone
     * violator. Live repro: "firm up the top of your fixed band plus that
     * 4.2L joining bonus" mis-bound base=4.2 via extractNumberAfter, the
     * total-complement then fabricated variable=41.8 (91% share), and the
     * bot asked "91% variable is significant — have you been hitting payouts
     * in full?" about a split the candidate never stated. Require a genuine
     * (non-inferred) disclosed variable, matching the established idiom. */
    const variableDisclosed =
      breakdown != null &&
      breakdown.variable != null &&
      breakdown.variableInferred !== true;
    const total =
      variableDisclosed && breakdown.base != null && breakdown.variable != null
        ? breakdown.base + breakdown.variable
        : null;
    const variableSharePct =
      variableDisclosed && total != null && total > 0 && breakdown.variable != null
        ? (breakdown.variable / total) * 100
        : 0;
    /* 2026-05-29 realism-pass — per-session ±5% jitter on the 25%
     * canonical threshold. Some recruiters probe at 23%, some at 27%;
     * a hard cliff at exactly 25% reads as a switch. Deterministic by
     * sessionId so a given candidate sees a stable threshold across
     * turns, but two sessions diverge. */
    const variableThreshold =
      25 + sessionJitter(state.sessionId, "variable-comfort", 5);
    if (variableSharePct > variableThreshold) {
      const pctRounded = Math.round(variableSharePct);
      return {
        kind: "reactive-followup",
        ask:
          `${pctRounded}% variable is significant — what's your comfort with that share, ` +
          "and have you been hitting payouts in full?",
        trigger: "variable-share-high",
        topic: "variable-comfort",
        satisfiesTopic: "variable-comfort",
        _move: {
          lever: "probe",
          newTotalLpa: null,
          rationale: `Candidate disclosed ${pctRounded}% variable share (threshold ${variableThreshold.toFixed(1)}%) — probe comfort + payout history before banking it.`,
          actionKind: "reactive-followup",
          askedTopic: "variable-comfort",
        },
      };
    }
  }

  /* Rule: competing-leverage-ack — candidate actively used their competing
   * offer as leverage (not just mentioned). Fires BEFORE competing-credibility
   * because leveraging is a stronger signal: we first acknowledge the leverage
   * before probing credibility in the next turn. */
  if (
    state.candidateProfile?.invokedCompetingOffer &&
    !hasFired("competing-leverage-ack")
  ) {
    return {
      kind: "reactive-followup",
      ask: "That's helpful — is the competing offer at a similar interview stage, or further along?",
      trigger: "invokedCompetingOffer",
      topic: "competing-leverage-ack",
      satisfiesTopic: "competing-leverage-ack",
      _move: {
        lever: "probe",
        newTotalLpa: null,
        rationale: "Candidate invoked competing offer as leverage — probe stage and credibility before adjusting counter strategy.",
        actionKind: "reactive-followup",
        askedTopic: "competing-leverage-ack",
      },
    };
  }

  /* Rule: number-clarification — candidate gave inconsistent CTC numbers
   * across turns. Fires BEFORE hike-justification so we get clean numbers
   * before any hike math. */
  if (
    state.candidateProfile?.gaveInconsistentNumbers &&
    !hasFired("number-clarification")
  ) {
    const ctcRef = state.candidateCurrentCtc != null
      ? `₹${state.candidateCurrentCtc}L`
      : "the number you mentioned";
    return {
      kind: "reactive-followup",
      ask: `Just to make sure I have the right picture — can you confirm your current CTC is ${ctcRef}?`,
      trigger: "gaveInconsistentNumbers",
      topic: "number-clarification",
      satisfiesTopic: "number-clarification",
      _move: {
        lever: "probe",
        newTotalLpa: null,
        rationale: "Candidate gave inconsistent CTC numbers — confirm correct current CTC before continuing.",
        actionKind: "reactive-followup",
        askedTopic: "number-clarification",
      },
    };
  }

  /* Rule: competing-credibility — candidate disclosed a competing offer
   * that's vague (no named company, no letter). Real recruiters probe
   * for company + written-offer status before pricing against it. */
  if (delta.disclosedCompetingOffer && !hasFired("competing-credibility")) {
    const detail = state.competingOfferDetail;
    const vague =
      !detail ||
      (detail.company == null && !detail.letterShareOffered);
    if (vague) {
      return {
        kind: "reactive-followup",
        ask:
          "Got it — which company is that with, and do you have the written offer or just verbal at this stage?",
        trigger: "competing-offer-vague",
        topic: "competing-credibility",
        satisfiesTopic: "competing-credibility",
        _move: {
          lever: "probe",
          newTotalLpa: null,
          rationale: "Candidate disclosed competing offer without named company/letter — probe credibility before pricing against it.",
          actionKind: "reactive-followup",
          askedTopic: "competing-credibility",
        },
      };
    }
  }

  /* Rule: notice-buyout-confirm — candidate JUST confirmed buyout
   * availability this turn ("there is an option to buy out", "they
   * allow buyout", etc.). Without this rule the kernel silently
   * advances to the next ordered discovery item, ignoring the
   * disclosure. Acknowledge before moving on. (Fix 6, 2026-05-16) */
  if (delta.noticeBuyoutConfirmed && !hasFired("notice-buyout-confirm")) {
    return {
      kind: "reactive-followup",
      ask:
        "Got it — buyout is on the table. That helps us move faster on the timeline if we get to that stage.",
      trigger: "buyout-confirmed",
      topic: "notice-buyout-confirm",
      satisfiesTopic: "notice-buyout-confirm",
      _move: {
        lever: "probe",
        newTotalLpa: null,
        rationale:
          "Candidate confirmed buyout availability — acknowledge before advancing ordered discovery.",
        actionKind: "reactive-followup",
        askedTopic: "notice-buyout-confirm",
      },
    };
  }

  /* Rule: notice-buyout — candidate disclosed >= 60d notice. Buyout
   * conversation is the standard recruiter response on long runways.
   * Polish 2: refireable up to 2 fires with a 5-turn gap (real
   * candidates revisit the buyout question after a structural lever
   * has been put on the table). */
  if (delta.disclosedNoticePeriod && canRefire("notice-buyout", state)) {
    const days = state.noticeJoining?.noticePeriodDays;
    if (days != null && days >= 60) {
      return {
        kind: "reactive-followup",
        /* PDF#45 follow-up (2026-05-25) — real Indian HR never names
         * "buyout" first; that's a candidate-side ask. Surface the
         * runway and ask about flexibility — the candidate will name
         * buyout, garden leave, or KT plan themselves if relevant. */
        ask:
          `${days} days is a long runway — any flexibility on that timeline, ` +
          "or is it firm on your current employer's side?",
        trigger: "notice-period-long",
        topic: "notice-buyout",
        satisfiesTopic: "notice-buyout",
        _move: {
          lever: "probe",
          newTotalLpa: null,
          rationale: `Candidate disclosed ${days}-day notice — probe buyout vs lock-in before continuing.`,
          actionKind: "reactive-followup",
          askedTopic: "notice-buyout",
        },
      };
    }
  }

  /* Rule: hike-justification — candidate disclosed expected CTC and the
   * hike vs current is > 30% with no value proof yet. Reuses the
   * canonical _hike-justification-probe helper for the role-specific
   * ask. Triggered by delta on EITHER current or expected CTC so a
   * mid-session disclosure of either side fires the probe. */
  if (
    (delta.disclosedExpectedCtc || delta.disclosedCurrentCtc) &&
    !hasFired("hike-justification")
  ) {
    const valueProofProvided = state.candidateProfile?.valueProofProvided === true;
    /* 2026-05-29 realism-pass — per-session ±5% jitter on the 30%
     * canonical threshold. Real recruiters' patience for un-proved
     * hikes varies; some fire at 25%, some at 35%. Deterministic by
     * sessionId so the trigger is stable within a session, varies
     * across sessions. Distinct salt from "variable-comfort" so the
     * two axes don't co-vary. */
    const hikeThreshold =
      HIKE_JUSTIFICATION_THRESHOLD +
      sessionJitter(state.sessionId, "hike-justification", 0.05);
    const should = shouldProbeHikeJustification(
      {
        currentCtcLpa: state.candidateCurrentCtc,
        expectedCtcLpa: state.candidateTarget,
        valueProofProvided,
      },
      hikeThreshold,
    );
    if (should) {
      const roleFamily = classifyRoleFamily(state.role);
      const ask = getHikeJustificationProbe(
        roleFamily,
        state.role,
        state.resumeFactPack?.topAchievement ?? null,
      );
      return {
        kind: "reactive-followup",
        ask,
        trigger: "hike-above-threshold",
        topic: "hike-justification",
        satisfiesTopic: "hike-justification",
        _move: {
          lever: "probe",
          newTotalLpa: null,
          rationale: `Expected CTC > ${(hikeThreshold * 100).toFixed(1)}% over current with no value proof — role-specific impact probe (${roleFamily}).`,
          actionKind: "reactive-followup",
          askedTopic: "hike-justification",
        },
      };
    }
  }

  /* refused-advance: the kernel ALREADY marks discoveryRefusedItems
   * when probeRefusalCount hits 2 inside applyCandidateAnswer. The
   * audit table specifies a "bypass — emits a synthetic write + falls
   * through" — i.e. NO planned action; the next-checklist-item logic
   * (getNextOrderedDiscoveryItem / getNextDiscoveryQuestion) consults
   * discoveryRefusedItems and skips refused items naturally. Adding
   * a planned action here would shadow the legitimate advance to the
   * next checklist item. We intentionally do NOTHING — the side-effect
   * already ran in applyCandidateAnswer; reactive layer falls through
   * to discovery-probe. */

  /* fresh-grad-rebase: kernel already handles this end-to-end (sets
   * candidateApplicableYoe=0 and freshGradDisclosed=true inside
   * applyCandidateAnswer; downstream band rebase + entry-tier framing
   * runs from those flags). We intentionally do NOT emit a reactive-
   * followup ask here — the existing path is the source of truth and
   * a duplicate planner emission would shadow it. */

  /* Wave-7 reactive rules: competing-leverage-ack and number-clarification
   * were hoisted to higher-priority positions above competing-credibility
   * and hike-justification respectively (see earlier in this function). */

  /* Rule: ctc-gentle-push — candidate was evasive about current CTC and we're
   * at turn 3+ already. One gentle push before accepting the refusal.
   * #121 (2026-06-21, live staging) — pre-anchor ONLY. "Knowing your current
   * package helps me make a strong case internally" is a fitment-calibration
   * ask; once an offer is on the table the fitment is already set, so a
   * post-anchor current-CTC push reads as the bot ignoring its own offer (live
   * Flipkart-EM stonewall repro: anchored ₹45L at T5, then re-pushed for
   * current CTC at T6). Gate on highestOfferMade === 0. */
  if (
    state.candidateProfile?.evasiveOnCurrentCtc &&
    state.highestOfferMade === 0 &&
    state.turnIndex >= 3 &&
    !hasFired("ctc-gentle-push")
  ) {
    return {
      kind: "reactive-followup",
      ask: "I want to make a strong case for you internally — knowing your current package really helps. Are you comfortable sharing?",
      trigger: "evasiveOnCurrentCtc",
      topic: "ctc-gentle-push",
      satisfiesTopic: "ctc-gentle-push",
      _move: {
        lever: "probe",
        newTotalLpa: null,
        rationale: "Candidate has been evasive on current CTC (turn >= 3) — one gentle push before accepting refusal.",
        actionKind: "reactive-followup",
        askedTopic: "ctc-gentle-push",
      },
    };
  }

  /* F9 (PDF#20 2026-05-15) — directional expectation → value-proof routing.
   *
   * When the candidate's last reply contains directional value keywords
   * (growth, ownership, upside, learning, culture, trajectory, impact,
   * equity, meaningful, long-term) WITHOUT a specific number, and expectedCtc
   * is still unanswered, the planner should probe what would make the
   * opportunity worthwhile instead of re-asking the range.
   *
   * Priority: lower than hike-justification (fires only when no other
   * reactive trigger has matched). Guards: !hasFired so it fires once per
   * session; candidateTarget must be null (range still unanswered). */
  if (state.candidateTarget == null && !hasFired("value-proof")) {
    const lastCandidateText = (() => {
      const log = state.conversationLog ?? [];
      for (let i = log.length - 1; i >= 0; i--) {
        const e = log[i];
        if (e && e.speaker === "candidate") return e.text || "";
      }
      return "";
    })();
    /* PDF#46 (2026-05-25) — "equity" removed from directional list.
     * Candidates use "equity" to name the package component ("no equity"
     * in response to ESOP probe), not to express forward-looking value.
     * Letting it trigger the growth probe caused turn-4 random-question
     * complaints. Also gate against negation prefixes so utterances like
     * "no there is no growth" / "not interested in upside" don't fire. */
    const DIRECTIONAL_RE = /\b(growth|ownership|upside|learning|culture|trajectory|impact|meaningful|long.?term)\b/i;
    const HAS_SPECIFIC_NUMBER_RE = /\d+(?:\.\d+)?\s*(?:LPA|L\b|lakh|lakhs?|lac|lacs)/i;
    const NEGATION_RE = /\b(?:no|not|none|nothing|don'?t|doesn'?t|isn'?t|aren'?t|never)\b/i;
    if (
      lastCandidateText &&
      DIRECTIONAL_RE.test(lastCandidateText) &&
      !HAS_SPECIFIC_NUMBER_RE.test(lastCandidateText) &&
      !NEGATION_RE.test(lastCandidateText)
    ) {
      return {
        kind: "reactive-followup",
        ask: "It sounds like growth matters as much as the number — which of these would matter most to you: the scope of the role, the manager and team, equity and long-term upside, or a clearer path to a lead position?",
        trigger: "directional-expectation",
        topic: "value-proof",
        satisfiesTopic: "value-proof",
        _move: {
          lever: "probe",
          newTotalLpa: null,
          rationale: "Candidate expressed directional value (growth/ownership/culture) without naming a number — probe what would make the move worthwhile.",
          actionKind: "reactive-followup",
          askedTopic: "value-proof",
        },
      };
    }
  }

  /* QA v3 round 3 (2026-05-19) — archetype-aware tail.
   *
   * Sits AFTER all wired reactive rules but BEFORE the planner returns
   * null (which falls through to discovery-probe). When a recognisable
   * candidate archetype fires and none of the wired rules consumed it,
   * route to an archetype-specific reactive instead of the generic
   * discovery default. This is the BUG-002 classifier landing in the
   * planner: the scaffold from `_candidate-archetype.ts` now drives
   * routing for archetypes whose intent isn't captured by any single
   * profile-flag.
   *
   * Why a tail and not interleaved: the wired rules already capture
   * specific intents (joining bonus, ESOP probe, etc.) more reliably
   * than the archetype classifier. The tail only fires when those miss,
   * so we never override a more-specific reactive with a less-specific
   * archetype. */
  const archetype = delta.candidateArchetype;
  if (archetype) {
    const archetypeReactive = planArchetypeReactive(state, archetype, hasFired);
    if (archetypeReactive) return archetypeReactive;
  }

  return null;
}

/**
 * Archetype-specific reactive routing. Pure function over (state,
 * archetype). Returns a `PlannedAction` for archetypes that warrant a
 * distinct recruiter response, or `null` to fall through to discovery.
 *
 * Only handles archetypes whose stance has no clean profile-flag
 * representation:
 *   - P09_NON_CASH_FOCUS  — salary-secondary signal; recruiter acknowledges
 *                           the non-cash priority before re-anchoring.
 *   - P11_FREELANCER      — no standard CTC anchor; recruiter probes
 *                           rate-card / project-billing.
 *   - P14_HIGH_EARNER     — already at high CTC; recruiter probes role
 *                           pull / non-money motivation.
 *
 * Other archetypes (P03 direct, P15 hard-anchor, P06 equity prober, etc.)
 * are already well-handled by wired-profile flags + discovery probes;
 * adding archetype routes for those would compete with the more-specific
 * wired path.
 */
export function planArchetypeReactive(
  state: NegotiationState,
  archetype: NonNullable<NegotiationState["lastTurnDelta"]>["candidateArchetype"],
  hasFired: (topic: DiscoveryTopic) => boolean,
): PlannedAction | null {
  if (archetype === "P09_NON_CASH_FOCUS" && !hasFired("value-proof")) {
    return {
      kind: "reactive-followup",
      ask: "Got it — learning and exposure matter more than the package here. What would make the next 12 to 18 months a real step forward for you: bigger ownership, a stronger manager and team, equity upside, or a clearer path to a lead role?",
      trigger: "archetype:P09",
      topic: "value-proof",
      satisfiesTopic: "value-proof",
      _move: {
        lever: "probe",
        newTotalLpa: null,
        rationale: "Archetype P09_NON_CASH_FOCUS — acknowledge non-cash priority before re-anchoring.",
        actionKind: "reactive-followup",
        askedTopic: "value-proof",
      },
    };
  }
  if (archetype === "P11_FREELANCER" && !hasFired("anchor-clarify")) {
    return {
      kind: "reactive-followup",
      ask: "Got it — freelance billing doesn't map cleanly to a CTC. What's your average monthly billing over the last 6 to 12 months, and is it mostly one big retainer or spread across several clients?",
      trigger: "archetype:P11",
      topic: "anchor-clarify",
      satisfiesTopic: "anchor-clarify",
      _move: {
        lever: "probe",
        newTotalLpa: null,
        rationale: "Archetype P11_FREELANCER — no standard CTC; probe rate-card to set anchor.",
        actionKind: "reactive-followup",
        askedTopic: "anchor-clarify",
      },
    };
  }
  if (archetype === "P14_HIGH_EARNER" && !hasFired("value-proof")) {
    return {
      kind: "reactive-followup",
      ask: "Noted — at your level, money alone isn't going to be the deciding factor. What's drawing you to this role specifically?",
      trigger: "archetype:P14",
      topic: "value-proof",
      satisfiesTopic: "value-proof",
      _move: {
        lever: "probe",
        newTotalLpa: null,
        rationale: "Archetype P14_HIGH_EARNER — high current CTC; probe role pull beyond comp.",
        actionKind: "reactive-followup",
        askedTopic: "value-proof",
      },
    };
  }
  return null;
}

/* Fix 5 (2026-05-16) — wire 13 previously-dead candidate-profile flags
 * to reactive followup rules. Sibling of planReactiveFollowup that
 * reads candidateProfile booleans directly (not lastTurnDelta), so the
 * rules fire even on simulated states. Sticky via reactiveFollowupsFired.
 * Phrasing uses Indian recruiter idiom (fitment, grade, revert, BGV). */
export function planWiredProfileFollowup(state: NegotiationState): PlannedAction | null {
  const profile = state.candidateProfile;
  if (!profile) return null;
  /* S21-B2 (2026-07-22) — when the candidate stated a NEW salary counter THIS
   * turn (disclosedExpectedCtc) AND also asked for a joining bonus in the same
   * utterance, the joining-bonus probe must NOT fire this turn — it would
   * silently drop the salary counter by returning before the counter-response
   * path in planNextActionInternal ever runs. Defer the joining-bonus probe to
   * the next turn after the salary has been acknowledged. The flag is cleared
   * once the delta resets (applyCandidateAnswer on the next turn). */
  const freshSalaryCounter = state.lastTurnDelta?.disclosedExpectedCtc === true;
  /* Polish 2 (2026-05-16) — eligibility now flows through canRefire so
   * refireable topics (tax-implication, range-to-point) can revisit
   * subject to per-topic max + turn-gap policy. Non-refireable topics
   * fall back to the single-fire semantics canRefire applies via the
   * legacy reactiveFollowupsFired ledger. */
  const canFire = (topic: DiscoveryTopic): boolean => canRefire(topic, state);
  type WiredRule = {
    flag: boolean | undefined;
    topic: DiscoveryTopic;
    ask: string;
    rationale: string;
  };
  const wired: WiredRule[] = [
      {
        flag: profile.wantsHigherBase,
        topic: "wants-higher-base",
        /* PDF#45 BUG-1 fix (2026-05-25) — old prose was "is that to
         * cover EMIs, or to set a stronger base for your next appraisal?".
         * Real Indian HR doesn't probe personal cashflow ("EMIs") — too
         * personal, reads as intrusive. Reframe to a neutral
         * priority question that still surfaces the motivation
         * (immediate fixed vs long-term base anchor) without naming
         * personal finance. The fixed:variable split decision works
         * either way. */
        ask: "Got it — higher fixed makes sense. Is it about the in-hand monthly going up now, or anchoring a stronger base for the next cycle? Either way I can structure around it.",
        rationale: "Candidate signalled preference for higher base — probe motivation (in-hand-now vs base-anchor) to size the fixed:variable split.",
      },
      {
        /* S21-B2: suppress when a concurrent salary counter arrived this turn. */
        flag: profile.wantsJoiningBonus && !freshSalaryCounter,
        topic: "wants-joining-bonus",
        /* PDF#46 (2026-05-25) — never volunteer "buyout" first. Probe
         * the bridge purpose without naming buyout; candidate can name
         * it themselves if relevant. Clawback context stays. */
        ask: "On the joining bonus — what's it bridging on your side: a pending variable payout, a gap during notice, or something else? The clawback is typically 12 months pro-rata.",
        rationale: "Candidate asked for JB — probe the bridge purpose without naming buyout; surface clawback context.",
      },
      {
        flag: profile.wantsRelocationAllowance,
        topic: "wants-relocation-allowance",
        ask: "Relocation is part of our standard package — one-time shifting assistance plus a settling-in allowance. Is this a move within the same city, or to a different city?",
        rationale: "Candidate mentioned relocation — confirm intra-city vs inter-city to pick the right reimbursement bucket.",
      },
      {
        flag: profile.titlePrecisionAsk,
        topic: "title-designation",
        /* Gap #2 (2026-06-18) — a direct designation question used to be
         * absorbed (detector existed, no answer). Give a concrete title
         * with the grade mapping, and commit the designation in writing.
         * For a pay-grade bump the candidate is routed to the
         * lever-grade-upgrade panel step; here we settle the title. */
        ask: "On the designation — the role carries a Senior title at this grade, and that's exactly what goes on the offer letter and your business card, not a generic band code. If you're asking about a higher grade than that, I can take a grade revision to the panel separately — but the Senior designation itself I can confirm for you right now.",
        rationale: "Candidate asked about exact title/designation — confirm the concrete title and that it's written into the offer letter; route any pay-grade bump to the grade-upgrade panel step. No deferral.",
      },
      {
        flag: profile.wantsFlexibleWork,
        topic: "lever-work-mode",
        /* Gap #1 (2026-06-18) — a direct WFH/hybrid question gets a
         * concrete, committed answer (not absorbed into a recap or
         * deferred). Mirrors lever-work-mode prose: name the hybrid
         * cadence and put it in the offer letter. */
        ask: "On the work mode — we're hybrid, three days in office and two from home as the standard for this grade. Given the role I can formalise a two-day-in-office arrangement for you, and that goes into the offer letter so it isn't just a verbal understanding.",
        rationale: "Candidate asked about WFH/hybrid — answer with the concrete hybrid cadence and commit a two-day-in-office arrangement into the offer letter; no deferral.",
      },
      {
        flag: profile.mentionedSpouseFamily,
        topic: "spouse-family-context",
        ask: "Got it — and on the family side, is your spouse also looking for a role in the same city, or is location flexibility something we should plan for?",
        rationale: "Candidate referenced spouse/family — surface dual-career and location constraints early so they don't ambush the close.",
      },
      {
        /* S59-B2/B5 (2026-07-24) — suppress reporting-structure followup when a
         * fresh salary counter arrived this turn. askedAboutReporting is sticky once
         * set (OR-merged in _candidate-profile.ts), so without this guard it fires
         * over a salary counter in any subsequent turn — the candidate's comp ask is
         * silently dropped and replaced with org-chart content. Mirror the
         * wantsJoiningBonus !freshSalaryCounter pattern at line 7702. */
        flag: profile.askedAboutReporting && !freshSalaryCounter,
        topic: "reporting-structure",
        ask: "For this role, you'd report to the EM or Director on the platform side, and their manager is the VP. Would you like me to set up a short chat with the hiring manager?",
        rationale: "Candidate asked about reporting — answer with reporting line and offer manager intro to de-risk the close.",
      },
      {
        flag: profile.askedAboutGrowthPath,
        topic: "growth-path",
        /* Gap #6 (2026-06-18) — was "We'll discuss that in your first 30
         * days" (a deferral). Now commits a concrete, writeable horizon
         * tied to the review and scope, consistent with lever-growth-path. */
        ask: "On the growth path — this role has a defined path to the next grade at the 12 to 15 month mark, tied to your performance review and the charter you own, not just tenure. I can have those review milestones written into the offer annexure so it's committed up front, not left to a later conversation.",
        rationale: "Candidate asked about growth path — commit a concrete promotion horizon (next grade at 12-15mo, review-tied) and offer to put the milestones in the offer annexure; no deferral.",
      },
      {
        flag: profile.askedAboutTeamSize,
        topic: "team-size",
        ask: "The team you'd join is around 8 engineers today, splitting into two smaller teams next quarter — so you'll have real ownership without getting lost in the crowd.",
        rationale: "Candidate asked about team size — answer with concrete headcount and trajectory so they can map ownership scope.",
      },
      {
        flag: profile.mentionedTaxImplication,
        topic: "tax-implication",
        ask: "On tax — under the new regime, the take-home is most efficient up to around ₹15L; above that the marginal rate is 30% plus surcharge. Would you like me to share the salary breakup so you can see the take-home?",
        rationale: "Candidate raised tax — offer the structured breakup with new-regime breakpoints (Indian context: ₹7L/₹15L/₹25L slabs).",
      },
      {
        flag: profile.mentionedBgvConcern,
        topic: "bgv-concern",
        ask: "On the BGV — we run it through FirstAdvantage post-acceptance, typical TAT is 2-3 weeks. Anything specific you'd want us to flag in advance so it doesn't surprise either side?",
        rationale: "Candidate raised BGV anxiety — surface vendor + TAT + invite proactive disclosure to de-risk the post-acceptance window.",
      },
      {
        flag: profile.mentionedMoonlighting,
        topic: "moonlighting-policy",
        ask: "On the moonlighting question — our policy is the standard one: prior written disclosure for any external paid work, and no overlap with competing companies. Was there a specific arrangement you wanted to flag?",
        rationale: "Candidate mentioned moonlighting — surface policy proactively (Indian context: post-2022 IT-services crackdown made this load-bearing).",
      },
      {
        /* S48-B6 (2026-07-24) — suppress probe once candidate has given an explicit
         * point target (candidateTargetWasRange=false). Only re-probe while the current
         * stated target still came from a range (or no target at all yet). */
        flag: profile.gaveRangeNotPoint && state.candidateTargetWasRange !== false,
        topic: "range-to-point",
        ask: "You shared a range — to plan the fitment cleanly, where in that range do you actually see yourself landing? Helps me take a more specific number to leadership.",
        rationale: "Candidate gave a range instead of a target — pin down the actual point before the lever rotation locks in.",
      },
      {
        /* #121 (2026-06-21, live staging) — pre-anchor ONLY. "If you share a
         * rough target I can tell you whether we're in the same range" only
         * makes sense before our number is on the table; once anchored, the
         * range is already stated, so this re-push reads as a loop. Gate on
         * highestOfferMade === 0. */
        flag: profile.deflectedOnRange && state.highestOfferMade === 0,
        topic: "range-deflection",
        ask: "I understand wanting to hear our number first — fair. Our band for this grade has a defined range; if you can share even a rough target, I can tell you straight away whether we're in the same range.",
        rationale: "Candidate is deflecting on number disclosure — re-anchor with band-grade language and invite mutual disclosure.",
      },
      {
        flag: profile.referencedMarketData,
        topic: "market-data-reference",
        ask: buildMarketDataReferenceAsk(profile.referencedMarketDataSources ?? []),
        rationale: "Candidate cited market data — name the specific source(s) and flag aggregation/grade limits.",
      },
  ];
  for (const rule of wired) {
    if (rule.flag && canFire(rule.topic)) {
      return {
        kind: "reactive-followup",
        ask: rule.ask,
        trigger: rule.topic,
        topic: rule.topic,
        satisfiesTopic: rule.topic,
        _move: {
          lever: "probe",
          newTotalLpa: null,
          rationale: rule.rationale,
          actionKind: "reactive-followup",
          askedTopic: rule.topic,
        },
      };
    }
  }

  return null;
}

/* Fix 4 (2026-05-16) — build the formal close-recap action with the
 * structured fitment payload. Pure: derives the recap from current
 * state (highestOfferMade as total CTC, band components for the
 * fixed/variable split, lastJoiningBonusOffered for the one-time
 * piece, noticeJoining for the notice runway). Always uses the
 * close-acceptance lever underneath so the kernel's terminal-phase
 * machinery still applies cleanly. */
/* Single source of truth for the fixed/variable decomposition of a
 * standing offer total. BOTH the formal close-recap and the mid-
 * negotiation straight-fitment breakdown derive their split from here,
 * so the candidate never hears two different "fixed" numbers for the
 * same total CTC. fixed = min(total, baseStretch); variable = the
 * remainder capped at variableMax. ESOP / joining bonus are quoted ON
 * TOP — NOT carved out of the headline (that carve-out is the
 * CTC-inflation model in `_ctc-inflation.ts`, reserved for a weaponised
 * inflated anchor). Pure. */
export function deriveOfferFixedVariable(
  state: NegotiationState,
  total: number,
): { fixedLpa: number; variableLpa: number } {
  const round1 = (n: number) => Math.round(n * 10) / 10;
  const variableMax = state.band.variableMax;
  /* PRI-54b (2026-06-22) — honest split, no fabrication. A variable
   * component is carved out ONLY when the band actually carries one
   * (band.variableMax > 0) — the exact signal every OTHER prose path
   * already keys off (anchor-with-offer.ts, the offer-recap, and
   * info-disclosure.ts all gate on `variableMax > 0`). The previous
   * default — baseStretch = total*0.85, variableMax = the remainder —
   * fabricated an 85/15 split for EVERY offer. Since variableMax is
   * never populated on today's bands, that meant the close-recap and the
   * straight-fitment breakdown both invented a "Fixed ₹X + variable ₹Y"
   * for pure-fixed offers, contradicting the flat figure the anchor
   * prose (correctly) quoted. With no real variable bound the whole
   * offer is fixed. When a band DOES carry variableMax (validated in the
   * kernel and used by the anchor prose), the split returns automatically
   * — so this is forward-compatible, not a feature removal. */
  if (!(typeof variableMax === "number" && variableMax > 0)) {
    return { fixedLpa: round1(total), variableLpa: 0 };
  }
  const baseStretch = state.band.baseStretch ?? Math.max(0, round1(total - variableMax));
  const fixedLpa = Math.min(total, baseStretch);
  const variableLpa = Math.max(0, Math.min(variableMax, round1(total - fixedLpa)));
  return { fixedLpa: round1(fixedLpa), variableLpa };
}

export function buildCloseRecapFormal(state: NegotiationState): PlannedAction {
  /* PRI-54c (2026-06-22) — the recap must enumerate the number the
   * candidate actually CLOSED at, not the bare standing offer. When a
   * candidate accepts by restating an in-band figure ABOVE the standing
   * offer ("58 works, I'll sign" over a ₹50L offer), the mode:accept
   * close path (line ~3344) already honors it via nearOfferCloseNumber;
   * the structured recap used `highestOfferMade` directly and so reported
   * the lower ₹50L — a recap that misreads which number closed. Both
   * close artifacts now derive from the SAME source of truth
   * (clampToCloseFloor∘nearOfferCloseNumber, which only ever raises the
   * standing offer toward the agreed figure, never lowers it), so the
   * recap and the decision-log close total can never disagree. */
  const total = clampToCloseFloor(state, nearOfferCloseNumber(state));
  const { fixedLpa, variableLpa } = deriveOfferFixedVariable(state, total);
  /* PDF#45 B2 (2026-05-26) — recap-hallucination guard. Only emit
   * structural-fitment fields when the underlying state was actually
   * populated by a discovery turn. Previously these defaulted to
   * fabricated values ("notice 9 weeks", "BGV post-acceptance",
   * "OL 2-3 business days") even when no such topic had ever been
   * discussed in the session. Discussed-signal sources:
   *   - notice: state.noticeJoining.noticePeriodDays (extractor stamp)
   *             OR state.infoAsked.includes("notice-period-ask")
   *   - bgv:    state.infoAsked.includes("bgv-concern")
   *             OR state.candidateProfile?.bgvAnxiety
   *   - OL ETA: gated behind notice OR bgv discussion — there's no
   *             standalone "candidate asked for OL ETA" signal, but
   *             once the candidate has engaged on process topics the
   *             ETA is a coherent close-out detail (not a hallucination). */
  const noticeDiscussed =
    (state.noticeJoining?.noticePeriodDays != null && state.noticeJoining.noticePeriodDays > 0) ||
    state.infoAsked.includes("notice-period-ask");
  /* BGV signal: candidateProfile.bgvAnxiety is the structural flag set
   * by the profile detector when the candidate raises BGV concerns
   * (background-verification anxiety / documentation queries). The
   * "bgv-concern" token is an AskedTopic, not an InfoIntent, so it
   * isn't a member of state.infoAsked — bgvAnxiety is the single
   * source of truth for "candidate raised BGV in this session". */
  const bgvDiscussed = state.candidateProfile?.bgvAnxiety === true;
  const noticePeriodWeeks = noticeDiscussed
    ? Math.max(1, Math.round((state.noticeJoining?.noticePeriodDays ?? 60) / 7))
    : undefined;
  const bgvStartTrigger = bgvDiscussed ? "post-acceptance, on signed offer letter" : undefined;
  const offerLetterEta = (noticeDiscussed || bgvDiscussed) ? "2-3 business days" : undefined;
  /* PRI-54a (2026-06-22) — recap the ESOP grant only when the equity-grant
   * lever genuinely fired AND the band carries equity. Both conditions are
   * required: leversUsed proves we offered it this session; band.hasEquity
   * guards against a stray lever entry on a no-equity band (e.g. TCS). */
  const equityGranted =
    state.band.hasEquity === true && state.leversUsed.includes("equity-grant");
  return {
    kind: "close-recap-formal",
    fixedLpa,
    variableLpa,
    joiningBonusLpa: state.lastJoiningBonusOffered ?? undefined,
    retentionBonusLpa: undefined,
    noticePeriodWeeks,
    proposedJoiningDate: undefined,
    bgvStartTrigger,
    offerLetterEta,
    equityGranted: equityGranted ? true : undefined,
    satisfiesTopic: "close-recap-formal",
    _move: {
      lever: "close-acceptance",
      newTotalLpa: total,
      joiningBonusAmount: state.lastJoiningBonusOffered ?? undefined,
      rationale:
        `Candidate verbally accepted; emit structured close recap (fixed ₹${fixedLpa}L, variable ₹${variableLpa}L, ` +
        `JB ${state.lastJoiningBonusOffered != null ? `₹${state.lastJoiningBonusOffered}L` : "none"}` +
        `${noticePeriodWeeks != null ? `, notice ${noticePeriodWeeks}w` : ""}` +
        `${offerLetterEta != null ? `, OL ETA ${offerLetterEta}` : ""}).`,
      actionKind: "close-recap-formal",
      askedTopic: "close-recap-formal",
    },
  };
}

/* 2026-05-30 conversational-realism — package-complexity helper shared
 * with the canonical-prose chain so both call sites compute the same
 * fallibility-overlay input. Mirrors `computePackageComplexity` in
 * `_canonical-prose.ts`. */
export function computePackageComplexityLocal(state: NegotiationState): number {
  if ((state.highestOfferMade ?? 0) <= 0) return 0;
  const levers = new Set(state.leversUsed ?? []);
  let n = 1;
  if ((state.lastJoiningBonusOffered ?? null) != null || levers.has("joining-bonus")) n += 1;
  if (levers.has("equity-grant")) n += 1;
  if (levers.has("ctc-inflation-anchor")) n += 1;
  if (levers.has("notice-buyout")) n += 1;
  if (levers.has("benefits-summary")) n += 1;
  return n;
}
