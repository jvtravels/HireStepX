/* Move-picker — extracted from _negotiation-kernel.ts on 2026-05-14.
 *
 * Why a separate file:
 *   - Pre-extraction `_negotiation-kernel.ts` was 2,597 LoC across types,
 *     parsers, state-transitions, the move-picker, validators and
 *     serialization. The audit (2026-05-14) flagged the file as a
 *     monolith and the move-picker (~340 LoC) as the largest functional
 *     unit inside it. Moving the picker out narrows the kernel's surface
 *     to "state shape + transitions + (de)serialization" and concentrates
 *     all "what move does the AI play this turn?" logic in one place.
 *
 * Why no behavior change:
 *   - This is a pure mechanical extraction. The dependency edges are:
 *       _kernel-move-picker.ts  →  _negotiation-kernel.ts   (types + helpers)
 *       _negotiation-kernel.ts  →  _kernel-move-picker.ts   (re-export only)
 *     No runtime cycle: move-picker imports values (isTerminalPhase,
 *     clampToCloseFloor, validateComponentConstraints) that are defined
 *     at kernel module-load time before any pickAiMove call happens.
 *   - All public callers continue to `import { pickAiMove } from
 *     "./_negotiation-kernel"` — the kernel re-exports pickAiMove so
 *     this refactor is a no-op for every other file.
 *
 * What's INSIDE move-picker:
 *   - pickAiMove (the priority cascade — eventually becomes a declarative
 *     table; this extraction is the prerequisite)
 *   - pickLeverExploreMove (non-cash lever rotation)
 *   - computeJoiningBonusAmount (kernel-computed JB sizing)
 *
 * What's NOT (stays in the kernel):
 *   - AiMove interface (depended on by serialization + tests)
 *   - clampToCloseFloor (Bug-12 close-floor invariant; tightly coupled
 *     to state shape and used outside the move-picker too)
 *   - validateComponentConstraints (used by both move-picker and the
 *     LLM-text validator; lives with band semantics)
 */

import {
  isTerminalPhase,
  clampToCloseFloor,
  validateComponentConstraints,
  type NegotiationState,
  type AiMove,
} from "./_negotiation-kernel";
import { classifyRoleFamily } from "./_company-band-tiers";
import {
  getNextDiscoveryQuestion,
  isDiscoveryComplete,
} from "./_discovery-stage";

/** Pick the AI's move for this turn from state alone. Pure. */
export function pickAiMove(state: NegotiationState): AiMove {
  /* Terminal stickiness guard (session 13 bug, 2026-05-14): when the
   * candidate keeps talking AFTER a terminal phase was already reached
   * on a prior turn, do NOT re-run the close-* / move-picking logic —
   * just re-emit a minimal restate that the engine sees with the
   * server-derived `terminal: true` flag. This keeps the UI honest about
   * "View Result" transitions even when the candidate volleys a
   * follow-up question / chit-chat after acceptance ("Are the variable
   * components?", "Let's get started", "I have already accepted").
   *
   * The first terminal-transition turn (acceptedAtTurn === turnIndex)
   * still routes through close-acceptance below so the full recap +
   * JB phrasing fires once; only subsequent turns from a terminal state
   * hit this branch. */
  if (
    isTerminalPhase(state.phase) &&
    (
      (state.phase === "accepted" && state.acceptedAtTurn != null && state.acceptedAtTurn < state.turnIndex) ||
      (state.phase === "walked-away" && state.walkedAwayAtTurn != null && state.walkedAwayAtTurn < state.turnIndex) ||
      /* stalemate sets no transition-turn marker; use the lever
       * trail instead — if close-stalemate has already fired once,
       * any subsequent picker entry is a restate. */
      (state.phase === "stalemate" && state.leversUsed.includes("close-stalemate"))
    )
  ) {
    return {
      lever: "terminal-restate",
      newTotalLpa: clampToCloseFloor(state, state.highestOfferMade || state.band.initialOffer),
      joiningBonusAmount: state.lastJoiningBonusOffered ?? undefined,
      rationale: `Terminal phase ${state.phase} reached at turn ${state.acceptedAtTurn ?? state.walkedAwayAtTurn ?? "?"}; restate close.`,
    };
  }

  /* Terminal closings. */
  if (state.phase === "accepted") {
    /* Phase 28 — carry the previously-offered JB into the close so the
       recap reflects both base + one-time JB. Without this the close
       summary silently dropped any JB that had been put on the table
       earlier in the session (May 2026 session). */
    const jb = state.lastJoiningBonusOffered;
    return {
      lever: "close-acceptance",
      newTotalLpa: clampToCloseFloor(state, state.highestOfferMade || state.band.initialOffer),
      joiningBonusAmount: jb != null ? jb : undefined,
      rationale: `Candidate accepted; recap terms${jb != null ? ` including ₹${jb}L one-time JB` : ""}.`,
    };
  }
  if (state.phase === "walked-away") {
    return {
      lever: "close-walkaway",
      newTotalLpa: null,
      rationale: "Candidate walked; acknowledge respectfully.",
    };
  }
  if (state.phase === "stalemate") {
    return {
      lever: "close-stalemate",
      newTotalLpa: state.highestOfferMade || state.band.initialOffer,
      rationale: "Turn budget exhausted; offer time to think.",
    };
  }

  /* Bug-report 11 (2026-05-14) — candidate counter BELOW current offer.
   * Real failure mode: AI opened at ₹25L, candidate asked ₹14L, AI
   * countered down to ₹24.5L (still way above ask). The candidate had
   * just signalled willingness to accept materially less than what's
   * on the table; the right move is to close.
   *
   * Bug-report 12 (2026-05-14) — CATASTROPHIC fix. The original gate
   * fired on `state.candidateTarget` which is sticky from intake. In
   * Session 12 the AI opened at ₹49L while the intake-target was
   * ₹22.4L, and the gate fired immediately, closing the AI at ₹22.4L
   * even though the candidate had never countered down. Hard
   * invariant: the kernel must NEVER close below highestOfferMade.
   *
   * The fix is twofold:
   *   (1) Gate fires ONLY on an explicit numeric counter parsed in
   *       the CURRENT turn (`lastCandidateCounterLpa`). Stale intake
   *       targets do NOT trigger.
   *   (2) The closing value is clamped to the close-floor (=
   *       highestOfferMade). Even when the candidate explicitly
   *       counters DOWN below the offer they already have on the
   *       table, the AI closes at the HIGHER number — the candidate
   *       already had it on the table and doesn't need to take less. */
  if (
    state.lastCandidateCounterLpa != null &&
    state.highestOfferMade > 0 &&
    state.lastCandidateCounterLpa <= state.highestOfferMade &&
    !isTerminalPhase(state.phase)
  ) {
    const accLpa = clampToCloseFloor(
      state,
      Math.min(state.highestOfferMade, state.lastCandidateCounterLpa),
    );
    const jb = state.lastJoiningBonusOffered;
    return {
      lever: "close-acceptance",
      newTotalLpa: accLpa,
      joiningBonusAmount: jb != null ? jb : undefined,
      rationale: `Candidate counter ₹${state.lastCandidateCounterLpa}L ≤ current offer ₹${state.highestOfferMade}L — guaranteed-accept signal; close at ₹${accLpa}L (floor = highest offer).`,
    };
  }

  /* PDF #17 architectural fix (2026-05-15) — probe-mismatch stage
   * routing. When the orchestrator has explicitly set discoveryStage =
   * "probe-mismatch" (resume↔role hard mismatch on the first turn),
   * route the FIRST substantive move into a domain-switch probe rather
   * than the default open-with-offer / probe sequence. Fires before
   * the opening branch so the probe lands before any anchor disclosure.
   * Soft: only active when discoveryStage is explicitly set; legacy
   * sessions (discoveryStage undefined) keep the original opening
   * behavior. */
  if (
    state.discoveryStage === "probe-mismatch" &&
    !isTerminalPhase(state.phase)
  ) {
    return {
      lever: "probe",
      newTotalLpa: null,
      rationale:
        "Discovery stage = probe-mismatch: probe the resume↔role domain switch BEFORE anchoring or discussing comp.",
    };
  }

  /* Opening: put the initial offer on the table. */
  if (state.phase === "opening") {
    return {
      lever: "open-with-offer",
      newTotalLpa: state.band.initialOffer,
      rationale: `Open with band initial ₹${state.band.initialOffer} LPA.`,
    };
  }

  /* Bug-report 15 follow-up (2026-05-14) — third-strike lever-loop guard.
   *
   * In the Deloitte BA session the kernel emitted the SAME compensation-
   * summary lever three turns in a row (and the same fallback text)
   * because the intent classifier kept routing the candidate's questions
   * back to the same lever. The verbatim-repeat guard (isVerbatimRepeat)
   * compares against the immediately-prior AI turn only — when the same
   * lever fires N turns in a row with the same state, the same fallback
   * text comes out N times.
   *
   * Structural fix: when the LAST TWO AI moves were both the same non-
   * cash, non-terminal info-lever (compensation-summary, benefits-summary,
   * notice-period-summary, hike-context-summary) and the picker is about
   * to fire it a THIRD time, force-route instead:
   *   - if the candidate has shown ANY acceptance signal at all this
   *     session (signalledAcceptance flag or recent acceptance hint),
   *     route to close-acceptance.
   *   - otherwise route to hold-firm — explicit "this is where we are,
   *     take the time you need" beats a fourth identical disclosure.
   *
   * The guard fires BEFORE the intent overrides below so they can't
   * re-emit the looped lever. */
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
  if (stuckLever && !isTerminalPhase(state.phase)) {
    /* Prefer close-acceptance when an offer is on the table — the
     * candidate has had two disclosures already; the next move should
     * push toward decision, not produce a third copy of the same line. */
    if (state.highestOfferMade > 0) {
      const jb = state.lastJoiningBonusOffered;
      return {
        lever: "hold-firm",
        newTotalLpa: state.highestOfferMade,
        joiningBonusAmount: jb != null ? jb : undefined,
        rationale: `Lever-loop guard: ${recentLevers[0]} has fired twice already; force hold-firm at ₹${state.highestOfferMade}L instead of a third identical disclosure.`,
      };
    }
  }

  /* Intent override (Phase 3 of the rebuild — Lollypop session, May 2026).
   *
   * The phase machine alone is too coarse for one specific failure mode:
   * the candidate explicitly asks the recruiter to enumerate the
   * package ("can you break it down for me?", "walk me through the
   * structure") while the phase is still offer-presented / probe-
   * expectations. The default path here is the `probe` lever — but the
   * candidate just told us what they want, and it isn't a probe.
   * Responding with another question feels robotic and broke the
   * Lollypop session ("what range are you targeting?" against an explicit
   * ask for the structure).
   *
   * The override: when the candidate has asked for the package
   * breakdown AND we've made an offer AND we haven't already done
   * benefits-summary, jump straight to benefits-summary regardless of
   * phase. The kernel still tracks phase for downstream concession
   * curves, so this is intent-shaped routing on top of phase-shaped
   * routing — not a replacement. */
  const wantsBreakdown =
    state.highestOfferMade > 0 &&
    !state.leversUsed.includes("benefits-summary") &&
    (state.infoAsked.includes("package-breakdown") ||
      state.infoAsked.includes("fixed-vs-variable") ||
      state.infoAsked.includes("perks-non-cash"));
  if (wantsBreakdown) {
    return {
      lever: "benefits-summary",
      newTotalLpa: state.highestOfferMade,
      rationale: "Candidate asked for the package breakdown; enumerate components instead of probing.",
    };
  }

  /* Benefits-overview intent (bug report 11 follow-up E, 2026-05-14).
     Distinct from the package-breakdown override above: a candidate
     asking "what are the benefits?" wants the NON-CASH package (health
     insurance, PF, leaves, learning budget), not a fixed/variable
     enumeration of the offer. Routes to `benefits-summary` lever
     regardless of whether benefits-summary has been used before — a
     repeat ask deserves a fresh disclosure, NOT a re-close. The
     terminal-phase gate is preserved so we don't reopen `accepted`
     into a non-terminal lever; in terminal phases the prose-layer
     handles the disclosure via the response hint without re-running
     the move-picker. */
  const wantsBenefits =
    !isTerminalPhase(state.phase) &&
    state.infoAsked.includes("benefits-overview");
  if (wantsBenefits) {
    return {
      lever: "benefits-summary",
      newTotalLpa: state.highestOfferMade > 0 ? state.highestOfferMade : null,
      rationale: "Candidate asked about benefits / perks; enumerate the non-cash package instead of re-closing.",
    };
  }

  /* Compensation-breakdown intent (session 12 bug, 2026-05-14). The
     candidate is asking about the company's variable / equity / bonus
     STRUCTURE (not THIS offer's components). Route to a
     compensation-summary lever variant that re-uses benefits-summary
     plumbing for prose framing — the response-hint layer injects the
     per-company structure block. Terminal-phase gate preserved so we
     don't reopen an accepted close. */
  const wantsCompStructure =
    !isTerminalPhase(state.phase) &&
    state.infoAsked.includes("compensation-breakdown");
  if (wantsCompStructure) {
    return {
      lever: "compensation-summary",
      newTotalLpa: state.highestOfferMade > 0 ? state.highestOfferMade : null,
      rationale: "Candidate asked about variable/equity/bonus structure; disclose company comp structure instead of re-closing.",
    };
  }

  /* Notice-period-ask routing (audit Session C, 2026-05-14). Candidate
     asked about the offering company's notice / start-date / buyout
     policy. Route to a notice-period-summary lever; response-hint layer
     injects the per-company NOTICE PERIOD DISCLOSURE block. Terminal
     phases preserved — the prose layer handles the hint there without
     re-running move-picker. */
  const wantsNoticePolicy =
    !isTerminalPhase(state.phase) &&
    state.infoAsked.includes("notice-period-ask");
  if (wantsNoticePolicy) {
    return {
      lever: "notice-period-summary",
      newTotalLpa: state.highestOfferMade > 0 ? state.highestOfferMade : null,
      rationale: "Candidate asked about joining window / notice / buyout; disclose company policy instead of re-closing.",
    };
  }

  /* Hike-percentage-ask routing (audit Session C, 2026-05-14). Candidate
     asked what hike% this offer represents. Route to hike-context-summary;
     response-hint layer computes the delta if currentCtc is known and
     supplies Indian market context otherwise. Terminal phases preserved. */
  const wantsHikeContext =
    !isTerminalPhase(state.phase) &&
    state.infoAsked.includes("hike-percentage-ask");
  if (wantsHikeContext) {
    return {
      lever: "hike-context-summary",
      newTotalLpa: state.highestOfferMade > 0 ? state.highestOfferMade : null,
      rationale: "Candidate asked what hike% this offer represents; surface delta / market norms instead of re-closing.",
    };
  }

  /* PDF #17 architectural fix (2026-05-15) — discovery-first active gating.
   *
   * Two soft preferences layered on top of the legacy phase machine,
   * both gated to keep behavior identical for legacy / un-tracked
   * sessions (no discoveryStage / no discoveryChecklist → skip both):
   *
   *   (a) probe-mismatch stage — when the orchestrator has explicitly
   *       moved the session into "probe-mismatch" (resume↔role hard
   *       mismatch on turn 0), the FIRST substantive turn must probe
   *       the domain switch instead of producing the default offer/
   *       probe sequence.
   *
   *   (b) discovery stage — when the kernel is still in the "discovery"
   *       stage and isDiscoveryComplete() returns false for the
   *       derived role family, the move-picker MUST prefer the next
   *       open discovery question over any non-anchor probe. The lever
   *       stays `probe` (so existing prose plumbing, validators and
   *       test assertions keep working) — only the rationale carries
   *       the specific discovery item so compactTurnBrief / response
   *       hints can surface "NEXT REQUIRED ACTION: <question>" to the
   *       LLM. Soft: only fires in the phases where a probe was
   *       already the default choice (offer-presented / probe-
   *       expectations), and only when discovery tracking is wired
   *       (discoveryChecklist + discoveryStage both present). */
  /* No candidate anchor yet → probe. */
  if (state.phase === "offer-presented" || state.phase === "probe-expectations") {
    /* Discovery-stage preference: when discovery is incomplete, the
     * probe rationale carries the NEXT open discovery item so the
     * brief can surface a concrete [NEXT REQUIRED ACTION]. Falls
     * through to the legacy generic probe when discovery is already
     * complete or when the session predates discovery tracking. */
    if (
      state.discoveryStage === "discovery" &&
      state.discoveryChecklist != null
    ) {
      const roleFamily = classifyRoleFamily(state.role);
      if (!isDiscoveryComplete(state.discoveryChecklist, roleFamily)) {
        const next = getNextDiscoveryQuestion(state.discoveryChecklist, roleFamily);
        if (next != null) {
          return {
            lever: "probe",
            newTotalLpa: null,
            rationale: `Discovery incomplete (next: ${next.item}) — ask: ${next.prompt}`,
          };
        }
      }
    }
    return {
      lever: "probe",
      newTotalLpa: null,
      rationale: "Probe candidate's expectation before moving.",
    };
  }

  /* Bug-report 15 (2026-05-14) — probe-justification before first
   * counter-base. Real HR never moves money without first asking what's
   * driving the candidate's number. Without this gate, kernel jumped
   * from initialOffer ₹15L straight to counter ₹15.7L the moment the
   * candidate said "I was looking at ₹18L", which feels robotic and
   * skips a high-leverage tactical turn.
   *
   * Fires ONCE per session — leversUsed tracks the firing. Threshold
   * (target > initialOffer × 1.05) avoids probing on trivial deltas
   * where there's nothing meaningful to justify (₹15 vs ₹15.3 is just
   * noise). Skipped entirely when the candidate has already volunteered
   * justification context (current CTC, competing offer detail, hike
   * rationale) — the probe would be redundant. */
  const shouldProbeJustification =
    state.phase === "counter-offer" &&
    state.candidateTarget != null &&
    state.candidateTarget > state.band.initialOffer * 1.05 &&
    !state.leversUsed.includes("probe-justification") &&
    !state.leversUsed.includes("counter-base") &&
    state.candidateCurrentCtc == null &&
    !state.competingOfferDetail.hasAny;
  if (shouldProbeJustification) {
    return {
      lever: "probe-justification",
      newTotalLpa: null,
      rationale: `Candidate target ₹${state.candidateTarget}L exceeds initial ₹${state.band.initialOffer}L by >5% with no justification on the table; probe before countering.`,
    };
  }

  /* Counter-offer: split toward target, capped at maxStretch.

     Stiffening: the split factor decays as we repeat counter-base.
     A flat 0.5 every turn was exploitable — a candidate who simply
     re-asserted the same demand each turn could pull the offer to
     maxStretch in 4–5 turns. Real recruiters concede less each time
     the same lever is pulled. Schedule: 0.5 → 0.35 → 0.22 → 0.12 → 0.06,
     then floor at 0.05. The full ceiling (maxStretch) remains the hard
     cap, so this never *exceeds* band, only approaches it more slowly. */
  if (state.phase === "counter-offer") {
    /* Hard band cap: base is structurally capped; redirect concession
       energy to non-cash levers instead of inching toward maxStretch. */
    if (state.hardBandCap) {
      return pickLeverExploreMove(state);
    }
    /* Verbal-acceptance-then-renegotiate: heavy stiffening + reject any
       further base movement. Modeled after the offer-rescission risk
       documented in Salary.com survey data.

       Phase 25d (2026-05-13) — escalation. A first re-open earns
       hold-firm; the second re-open is the trigger for offer
       rescission: route directly to close-walkaway. The red-flag
       layer surfaces "rescission-risk" as a blocker on the same
       state so the coach layer can explain what just happened. */
    if (state.verbalAcceptanceTurn != null) {
      if (state.postVerbalRenegotiationCount >= 2) {
        return {
          lever: "close-walkaway",
          newTotalLpa: null,
          rationale: "Candidate verbally accepted then re-opened twice — the offer is being rescinded.",
        };
      }
      return {
        lever: "hold-firm",
        newTotalLpa: state.highestOfferMade,
        rationale: "Candidate verbally accepted; further base asks risk rescission. Hold firm.",
      };
    }

    const target = state.candidateTarget ?? state.band.maxStretch;
    const floor = Math.max(state.highestOfferMade, state.band.initialOffer);
    const ceiling = state.band.maxStretch;
    const aspiration = Math.min(target, ceiling);

    /* No headroom → switch to lever-explore. */
    if (aspiration <= floor + 0.1) {
      return pickLeverExploreMove(state);
    }
    const counterCount = state.leversUsed.filter(l => l === "counter-base").length;
    const splitSchedule = [0.5, 0.35, 0.22, 0.12, 0.06];
    let split = splitSchedule[counterCount] ?? 0.05;

    /* Tactic boost: candidates using calibrated questions, range asks,
       and labeling get larger concessions per turn. Mirroring alone is
       a softer signal so it earns a smaller bump. Sign-today bundles
       get the biggest boost (Voss-canon-grade certainty-for-concession
       trade). Cumulative, capped at 2x the base split. */
    let boost = 1;
    if (state.candidateAskedAsRange) boost += 0.15;
    if (state.vossTacticsUsed.includes("calibrated")) boost += 0.25;
    if (state.vossTacticsUsed.includes("label")) boost += 0.15;
    if (state.vossTacticsUsed.includes("mirror")) boost += 0.05;
    if (state.vossTacticsUsed.includes("sign-today-bundle")) boost += 0.35;
    if (state.vossTacticsUsed.includes("deflect-current-ctc")) boost += 0.10;
    /* Smart-question reward (Phase 25c, 2026-05-13). Asking specific
     * structural questions (clawback, vesting, strike, in-hand, etc.)
     * is itself a sophisticated negotiation tactic and should earn
     * the candidate a small but real concession boost. +0.03 per
     * unique info intent, capped at +0.10 (so ~3 smart questions
     * roughly equals one Voss tactic). */
    const infoBoost = Math.min(state.infoAsked.length * 0.03, 0.10);
    boost += infoBoost;
    /* Phase 21b recovery actualization (2026-05-13). A candidate who
     * course-corrected from a desperation / salary-only / personal-
     * expense / offer-shopping / no-anchor tell on the most recent
     * utterance shouldn't stay punished by an earlier stance breach.
     * Mirror a small "mirror"-tier bump for this AI turn only. */
    if (state.recentRecoveryActive) boost += 0.05;
    if (boost > 2) boost = 2;
    split = Math.min(split * boost, 0.6);

    /* Market mode modulator. Soft markets squeeze candidates; hot
       markets reward them. */
    if (state.marketMode === "soft") split *= 0.7;
    else if (state.marketMode === "hot") split *= 1.3;

    /* Walk-away-and-return penalty: returning candidate gets a worse
     * concession curve to model the loss of leverage. */
    if (state.walkAwayReturned) split *= 0.5;

    if (split > 0.95) split = 0.95;
    const newTotal = Math.round((floor + (aspiration - floor) * split) * 10) / 10;

    /* Phase 31 (2026-05-14) — centralised component-constraint check.
     * The kernel now validates both directions: above the component
     * cap (baseStretch + variableMax — Phase 12b ceiling) AND below
     * baseFloor (newly enforced; previously baseFloor was declared on
     * the band type but never read). Either failure routes to
     * lever-explore: cash levers are exhausted, non-cash levers (JB /
     * equity / notice-buyout) remain. */
    const constraint = validateComponentConstraints(state.band, newTotal);
    if (!constraint.ok) {
      return pickLeverExploreMove(state);
    }
    return {
      lever: "counter-base",
      newTotalLpa: newTotal,
      rationale: `Split toward target (stiffening ${splitSchedule[counterCount] ?? 0.05}, effective ${split.toFixed(2)}, boost ${boost.toFixed(2)}, market ${state.marketMode}${state.walkAwayReturned ? ", returned" : ""}): floor ₹${floor} → ₹${newTotal} (target ₹${target}, ceiling ₹${ceiling}).`,
    };
  }

  /* lever-explore / closing-push: rotate non-cash levers. */
  return pickLeverExploreMove(state);
}

/** Phase 28 (2026-05-13) — compute the joining-bonus amount the LLM
 *  MUST quote. The previous behaviour delegated this to the LLM and the
 *  LLM punted ("a joining bonus" with no number, three turns running).
 *  Sizing:
 *    gap        = max(0, candidateTarget − highestOfferMade)
 *                 (target null → gap = maxStretch − highestOfferMade)
 *    baseJB     = clamp(gap × 0.4, 1.0, 6.0)
 *    multiplier = marketMode: hot 1.5 / neutral 1.0 / soft 0.7
 *    final      = round(baseJB × multiplier × 10) / 10
 *  Annual-equivalent sanity cap: never exceed (maxStretch − initialOffer)
 *  so the one-time JB doesn't blow past the band's full year-1 spread.
 *  Edge cases:
 *    - gap ≤ 0 (we're already above the candidate's target): JB still
 *      hits the ₹1L floor so the lever fires meaningfully rather than
 *      producing a ₹0 "bonus".
 *    - hot market with tight band: the band-spread cap kicks in.
 *  Pure. */
function computeJoiningBonusAmount(state: NegotiationState): number {
  const target = state.candidateTarget;
  const refTop = target != null ? target : state.band.maxStretch;
  const gap = Math.max(0, refTop - state.highestOfferMade);
  /* Bug-report 15 follow-up (2026-05-14) — calibration: a JB of ₹1L on
   * a ₹3L target-vs-offer gap (33% bridge) reads as a token gesture, not
   * a real sweetener. Bumped the bridge ratio 0.4 → 0.5 (covers 50% of
   * the gap, the rule-of-thumb most Indian recruiters use) and the floor
   * 1.0 → 1.5 so even a zero-gap JB lands as a meaningful number. Cap
   * stays at ₹6L (above this it's a relocation grant, not a JB). */
  const baseJB = Math.min(6.0, Math.max(1.5, gap * 0.5));
  const multiplier =
    state.marketMode === "hot" ? 1.5 :
    state.marketMode === "soft" ? 0.7 : 1.0;
  let final = Math.round(baseJB * multiplier * 10) / 10;
  const bandSpreadCap = Math.max(1.5, state.band.maxStretch - state.band.initialOffer);
  if (final > bandSpreadCap) final = Math.round(bandSpreadCap * 10) / 10;
  /* Guard against NaN / Infinity from a degenerate band. */
  if (!Number.isFinite(final) || final <= 0) return 1.5;
  return final;
}

function pickLeverExploreMove(state: NegotiationState): AiMove {
  const used = new Set(state.leversUsed);
  /* Phase 24d (2026-05-13) — market mode applied to non-cash levers
   * via a tone hint. counter-base already bakes marketMode into the
   * numeric split; JB / equity / notice-buyout amounts come from the
   * LLM, so we surface a hint instead of a scalar. */
  const marketModeHint =
    state.marketMode === "hot"
      ? "hot market — be generous on non-cash (JB ~1.5x baseline, equity +25%, full notice buyout where applicable)"
      : state.marketMode === "soft"
      ? "soft market — non-cash is also tight (JB ~0.7x baseline, equity -25%, only partial notice buyout)"
      : "neutral market — standard non-cash sizing";
  /* Lever order optimises for company P&L: when the band supports equity
     we prefer equity-grant FIRST because grants vest over multi-year
     schedules and dilute cap-table paper (not in-year cash), whereas a
     joining bonus is full sunk cash at hire. Falling back to joining-
     bonus only when the tier has no equity to offer keeps the AI from
     leaking the cheapest concession last. */
  if (state.band.hasEquity && !used.has("equity-grant")) {
    return {
      lever: "equity-grant",
      newTotalLpa: state.highestOfferMade,
      rationale: "Add equity grant; cheaper long-term than cash sweeteners.",
      marketModeHint,
    };
  }
  if (!used.has("joining-bonus")) {
    return {
      lever: "joining-bonus",
      newTotalLpa: state.highestOfferMade,
      joiningBonusAmount: computeJoiningBonusAmount(state),
      rationale: "Cash headroom exhausted; add one-time joining bonus.",
      marketModeHint,
    };
  }
  if (!used.has("notice-buyout")) {
    return {
      lever: "notice-buyout",
      newTotalLpa: state.highestOfferMade,
      rationale: "Offer notice-period buyout as soft lever.",
      marketModeHint,
    };
  }
  if (!used.has("benefits-summary")) {
    return {
      lever: "benefits-summary",
      newTotalLpa: state.highestOfferMade,
      rationale: "Recap non-cash benefits totality.",
    };
  }
  return {
    lever: "hold-firm",
    newTotalLpa: state.highestOfferMade,
    rationale: "All levers exhausted; hold firm and invite decision.",
  };
}
