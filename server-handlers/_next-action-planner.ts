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

import {
  isTerminalPhase,
  clampToCloseFloor,
  validateComponentConstraints,
  canCloseSession,
  clampAnchorAgainstCandidateAsk,
  effectiveAnchorLpa,
  setNextActionPlanner,
  type NegotiationState,
  type AiMove,
} from "./_negotiation-kernel";
import { classifyRoleFamily, getCompanyHikeCap } from "./_company-band-tiers";
import {
  getNextDiscoveryQuestion,
  getNextOrderedDiscoveryItem,
  getNextOrderedDiscoveryQuestion,
  isDiscoveryComplete,
} from "./_discovery-stage";
import { recommendWalkAway } from "./_recruiter-critique";
import { estimateCounterOfferRisk } from "./_counter-offer-risk";

/** Discriminated union of every action the planner can emit. The kind
 *  taxonomy collapses the prior 15 sequential `if return` branches into
 *  a single declarative space external consumers can switch on without
 *  reading move.rationale strings. */
export type NextAction =
  | { kind: "terminal-restate" }
  | { kind: "close"; mode: "accept" | "walkaway" | "stalemate" }
  | { kind: "auto-accept" }
  | { kind: "probe-mismatch" }
  | { kind: "live-walk-away"; mode: "walk" | "hold-firm" | "probe" }
  | { kind: "range-disclosure" }
  | { kind: "discovery-probe"; item: string; ask: string }
  | { kind: "open-with-offer" }
  | { kind: "lever-loop-guard" }
  | { kind: "info-disclosure"; topic: "breakdown" | "benefits" | "comp-structure" | "notice" | "hike-pct" }
  | { kind: "probe-expectations" }
  | { kind: "probe-justification" }
  | { kind: "counter-offer" }
  | { kind: "lever-explore"; from: "hard-band-cap" | "no-headroom" | "constraint-violation" | "default" }
  | { kind: "hold-firm"; mode: "verbal-accept" | "lever-loop" }
  | { kind: "rescission" };

/** Internal carrier: the planner builds the move alongside the action so
 *  actionToLever is bit-identical to the prior pickAiMoveCore. The
 *  `_move` field is private — consumers should treat NextAction as the
 *  discriminator. Use actionToLever to recover the AiMove. */
type PlannedAction = NextAction & { _move: AiMove };

/** Single declarative source of truth for "what should the bot do next?".
 *  Pure. Order of returns is the priority cascade — first match wins. */
export function planNextAction(state: NegotiationState): NextAction {
  return planNextActionInternal(state);
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

function planNextActionInternal(state: NegotiationState): PlannedAction {
  /* Terminal stickiness guard (session 13 bug, 2026-05-14): see notes in
   * the original move-picker. */
  if (
    isTerminalPhase(state.phase) &&
    (
      (state.phase === "accepted" && state.acceptedAtTurn != null && state.acceptedAtTurn < state.turnIndex) ||
      (state.phase === "walked-away" && state.walkedAwayAtTurn != null && state.walkedAwayAtTurn < state.turnIndex) ||
      (state.phase === "stalemate" && state.leversUsed.includes("close-stalemate"))
    )
  ) {
    return {
      kind: "terminal-restate",
      _move: {
        lever: "terminal-restate",
        newTotalLpa: clampToCloseFloor(state, state.highestOfferMade || state.band.initialOffer),
        joiningBonusAmount: state.lastJoiningBonusOffered ?? undefined,
        rationale: `Terminal phase ${state.phase} reached at turn ${state.acceptedAtTurn ?? state.walkedAwayAtTurn ?? "?"}; restate close.`,
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
   * BELOW current offer → close at the close-floor (=highestOfferMade). */
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
      kind: "auto-accept",
      _move: {
        lever: "close-acceptance",
        newTotalLpa: accLpa,
        joiningBonusAmount: jb != null ? jb : undefined,
        rationale: `Candidate counter ₹${state.lastCandidateCounterLpa}L ≤ current offer ₹${state.highestOfferMade}L — guaranteed-accept signal; close at ₹${accLpa}L (floor = highest offer).`,
      },
    };
  }

  /* PDF #17 — probe-mismatch routing. */
  if (
    state.discoveryStage === "probe-mismatch" &&
    !isTerminalPhase(state.phase)
  ) {
    return {
      kind: "probe-mismatch",
      _move: {
        lever: "probe",
        newTotalLpa: null,
        rationale:
          "Discovery stage = probe-mismatch: probe the resume↔role domain switch BEFORE anchoring or discussing comp.",
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

  /* PDF#18 — range-disclosure phase override. */
  if (state.phase === "range-disclosure" && !isTerminalPhase(state.phase)) {
    const floor = state.band.initialOffer;
    const ceiling = state.band.maxStretch;
    return {
      kind: "range-disclosure",
      _move: {
        lever: "probe",
        newTotalLpa: null,
        rationale:
          `Range-disclosure phase: bot MUST disclose the salary RANGE ` +
          `(₹${floor}-${ceiling}L band) and NOT a specific number. ` +
          `Wait for candidate reaction before converging to a single anchor.`,
      },
    };
  }

  /* Opening: discovery-incomplete probe, then anchor. */
  if (state.phase === "opening") {
    if (
      state.turnIndex >= 1 &&
      state.discoveryStage === "discovery" &&
      state.discoveryChecklist != null
    ) {
      const roleFamily = classifyRoleFamily(state.role);
      if (!isDiscoveryComplete(state.discoveryChecklist, roleFamily)) {
        const refused = state.discoveryRefusedItems ?? null;
        const orderedItem = getNextOrderedDiscoveryItem(
          state.discoveryChecklist,
          roleFamily,
          refused,
        );
        const ordered = getNextOrderedDiscoveryQuestion(
          state.discoveryChecklist,
          roleFamily,
          refused,
        );
        if (ordered != null && orderedItem != null) {
          const skippedHint = refused != null && Object.keys(refused).length > 0
            ? ` [ITEM REFUSED — SKIPPED: ${Object.keys(refused).join(", ")}; proceeding to ${orderedItem}]`
            : "";
          return {
            kind: "discovery-probe",
            item: orderedItem,
            ask: ordered.prompt,
            _move: {
              lever: "probe",
              newTotalLpa: null,
              rationale:
                `Discovery incomplete (next: ${orderedItem}) — ask: ${ordered.prompt}${skippedHint}`,
            },
          };
        }
        const next = getNextDiscoveryQuestion(state.discoveryChecklist, roleFamily);
        if (next != null) {
          return {
            kind: "discovery-probe",
            item: next.item,
            ask: next.prompt,
            _move: {
              lever: "probe",
              newTotalLpa: null,
              rationale: `Discovery incomplete (next: ${next.item}) — ask: ${next.prompt}`,
            },
          };
        }
      }
    }
    const clampedOpener = clampAnchorAgainstCandidateAsk(
      state.band.initialOffer,
      state.candidateTarget,
      state.band.walkAway,
    );
    return {
      kind: "open-with-offer",
      _move: {
        lever: "open-with-offer",
        newTotalLpa: clampedOpener,
        rationale: clampedOpener < state.band.initialOffer
          ? `Open with anchor ₹${clampedOpener} LPA (clamped from band initial ₹${state.band.initialOffer} against candidate ask ₹${state.candidateTarget}).`
          : `Open with band initial ₹${state.band.initialOffer} LPA.`,
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
  if (stuckLever && !isTerminalPhase(state.phase)) {
    if (state.highestOfferMade > 0) {
      const jb = state.lastJoiningBonusOffered;
      return {
        kind: "lever-loop-guard",
        _move: {
          lever: "hold-firm",
          newTotalLpa: state.highestOfferMade,
          joiningBonusAmount: jb != null ? jb : undefined,
          rationale: `Lever-loop guard: ${recentLevers[0]} has fired twice already; force hold-firm at ₹${state.highestOfferMade}L instead of a third identical disclosure.`,
        },
      };
    }
  }

  /* Intent overrides — package breakdown / benefits / comp-structure /
   * notice / hike-pct. */
  const wantsBreakdown =
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

  const wantsBenefits =
    !isTerminalPhase(state.phase) &&
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
    !isTerminalPhase(state.phase) &&
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
    !isTerminalPhase(state.phase) &&
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
    !isTerminalPhase(state.phase) &&
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
        const next = getNextDiscoveryQuestion(state.discoveryChecklist, roleFamily);
        if (next != null) {
          return {
            kind: "discovery-probe",
            item: next.item,
            ask: next.prompt,
            _move: {
              lever: "probe",
              newTotalLpa: null,
              rationale: `Discovery incomplete (next: ${next.item}) — ask: ${next.prompt}`,
            },
          };
        }
      }
    }
    return {
      kind: "probe-expectations",
      _move: {
        lever: "probe",
        newTotalLpa: null,
        rationale: "Probe candidate's expectation before moving.",
      },
    };
  }

  /* Probe-justification before first counter-base. */
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
      kind: "probe-justification",
      _move: {
        lever: "probe-justification",
        newTotalLpa: null,
        rationale: `Candidate target ₹${state.candidateTarget}L exceeds initial ₹${state.band.initialOffer}L by >5% with no justification on the table; probe before countering.`,
      },
    };
  }

  /* counter-offer: split with stiffening / market / risk / boost. */
  if (state.phase === "counter-offer") {
    if (state.hardBandCap) {
      return wrapLeverExplore(pickLeverExploreMove(state), "hard-band-cap");
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

    const target = state.candidateTarget ?? state.band.maxStretch;
    const floor = Math.max(state.highestOfferMade, effectiveAnchorLpa(state));
    let ceiling = state.band.maxStretch;
    if (state.candidateCurrentCtc != null && state.candidateCurrentCtc > 0) {
      const cap = getCompanyHikeCap(state.company);
      if (cap != null) {
        const capped = state.candidateCurrentCtc * (1 + cap / 100);
        if (capped < ceiling) ceiling = Math.max(capped, floor);
        // F7 (2026-05-15) — clamp hike-cap to band.maxStretch * 1.10.
        // Company hike cap may exceed band.maxStretch by up to 10% —
        // company-specific reality overrides generic band, but not
        // unboundedly. Without this clamp a permissive company cap
        // (e.g. 80% hike) paired with a high currentCtc could drift
        // the ceiling far above any reasonable band, defeating the
        // structural walk-away protections.
        const hardCap = state.band.maxStretch * 1.10;
        if (ceiling > hardCap) ceiling = Math.max(hardCap, floor);
      }
    }
    const aspiration = Math.min(target, ceiling);

    if (aspiration <= floor + 0.1) {
      return wrapLeverExplore(pickLeverExploreMove(state), "no-headroom");
    }
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

    if (split > 0.95) split = 0.95;
    const newTotal = Math.round((floor + (aspiration - floor) * split) * 10) / 10;

    const constraint = validateComponentConstraints(state.band, newTotal);
    if (!constraint.ok) {
      return wrapLeverExplore(pickLeverExploreMove(state), "constraint-violation");
    }
    return {
      kind: "counter-offer",
      _move: {
        lever: "counter-base",
        newTotalLpa: newTotal,
        rationale: `Split toward target (stiffening ${splitSchedule[counterCount] ?? 0.05}, effective ${split.toFixed(2)}, boost ${boost.toFixed(2)}, market ${state.marketMode}${state.walkAwayReturned ? ", returned" : ""}): floor ₹${floor} → ₹${newTotal} (target ₹${target}, ceiling ₹${ceiling}).`,
      },
    };
  }

  /* lever-explore / closing-push: rotate non-cash levers. */
  return wrapLeverExplore(pickLeverExploreMove(state), "default");
}

function wrapLeverExplore(
  move: AiMove,
  from: "hard-band-cap" | "no-headroom" | "constraint-violation" | "default",
): PlannedAction {
  return { kind: "lever-explore", from, _move: move };
}

/** Phase 28 (2026-05-13) — compute the joining-bonus amount. See original
 *  in _kernel-move-picker.ts for full sizing rationale. Duplicated here
 *  rather than imported because the move-picker's copy is module-private
 *  and the planner is the new home for "what move next" logic. */
function computeJoiningBonusAmount(state: NegotiationState): number {
  const target = state.candidateTarget;
  const refTop = target != null ? target : state.band.maxStretch;
  const gap = Math.max(0, refTop - state.highestOfferMade);
  const baseJB = Math.min(6.0, Math.max(1.5, gap * 0.5));
  const multiplier =
    state.marketMode === "hot" ? 1.5 :
    state.marketMode === "soft" ? 0.7 : 1.0;
  let final = Math.round(baseJB * multiplier * 10) / 10;
  const bandSpreadCap = Math.max(1.5, state.band.maxStretch - state.band.initialOffer);
  if (final > bandSpreadCap) final = Math.round(bandSpreadCap * 10) / 10;
  if (!Number.isFinite(final) || final <= 0) return 1.5;
  return final;
}

function pickLeverExploreMove(state: NegotiationState): AiMove {
  const used = new Set(state.leversUsed);
  const marketModeHint =
    state.marketMode === "hot"
      ? "hot market — be generous on non-cash (JB ~1.5x baseline, equity +25%, full notice buyout where applicable)"
      : state.marketMode === "soft"
      ? "soft market — non-cash is also tight (JB ~0.7x baseline, equity -25%, only partial notice buyout)"
      : "neutral market — standard non-cash sizing";
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

/* Commit 3 (2026-05-15) — register the planner with the kernel so
 * applyCandidateAnswer can stamp state.plannedNextAction without an
 * import cycle. Side-effect at module load; idempotent. */
setNextActionPlanner((s) => planNextAction(s as NegotiationState));
