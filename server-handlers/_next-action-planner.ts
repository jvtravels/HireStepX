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
  type NegotiationState,
  type AiMove,
} from "./_negotiation-kernel";
import { registerNextActionPlanner } from "./_planner-registry";
import { classifyRoleFamily, getCompanyHikeCap } from "./_company-band-tiers";
import {
  getNextDiscoveryQuestion,
  getNextOrderedDiscoveryItem,
  getNextOrderedDiscoveryQuestion,
  isDiscoveryComplete,
} from "./_discovery-stage";
import { recommendWalkAway } from "./_recruiter-critique";
import { estimateCounterOfferRisk } from "./_counter-offer-risk";
import {
  getHikeJustificationProbe,
  shouldProbeHikeJustification,
} from "./_hike-justification-probe";
import { analyzeEquityClarity } from "./_trial-close-detector";

/** Discriminated union of every action the planner can emit. The kind
 *  taxonomy collapses the prior 15 sequential `if return` branches into
 *  a single declarative space external consumers can switch on without
 *  reading move.rationale strings. */
export type NextAction =
  | { kind: "terminal-restate" }
  | { kind: "close"; mode: "accept" | "walkaway" | "stalemate" }
  | { kind: "auto-accept" }
  /* Commit 4 (2026-05-15) — reactive follow-up emitted when the
   * candidate's CURRENT TURN disclosure created a higher-leverage
   * probe target than the next checklist item. Priority-gated above
   * probe-mismatch and discovery-probe so the bot reacts to what the
   * candidate just said before sequencing through the ordered checklist.
   * The topic is recorded in state.reactiveFollowupsFired via the
   * move.askedTopic plumbing so the same probe doesn't re-fire. */
  | { kind: "reactive-followup"; ask: string; trigger: string; topic: string }
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

/** F7 (PDF#20 2026-05-15) — build a merged "skip" record that combines
 *  discoveryRefusedItems with any topics that were asked in the last
 *  withinTurns turns so getNextOrderedDiscoveryItem skips them both. */
function buildSkipRecord(
  state: NegotiationState,
  withinTurns = 3,
): Record<string, boolean> | null {
  const refused = state.discoveryRefusedItems ?? null;
  const topics = state.askedTopics ?? [];
  const cutoff = state.turnIndex - withinTurns;
  const recentlyAsked: Record<string, boolean> = {};
  for (const t of topics) {
    if (t.atTurn > cutoff) recentlyAsked[t.topic] = true;
  }
  if (refused == null && Object.keys(recentlyAsked).length === 0) return null;
  return { ...(refused ?? {}), ...recentlyAsked };
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
      const jb = state.lastJoiningBonusOffered;
      return {
        kind: "close",
        mode: "accept",
        _move: {
          lever: "close-acceptance",
          newTotalLpa: clampToCloseFloor(state, state.highestOfferMade),
          joiningBonusAmount: jb != null ? jb : undefined,
          rationale: `Candidate signaled close readiness (trial-close detected on prior turn); emit close-confirmation.`,
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
  if (!isTerminalPhase(state.phase) && state.band.hasEquity) {
    const equityFired = (state.reactiveFollowupsFired ?? []).includes("equity-clarity");
    if (!equityFired) {
      const lastBotReply = state.lastAiText ?? "";
      const hasEquityLanguage = /\b(equity|esop|rsu|stock|options?|vesting|cliff)\b/i.test(lastBotReply);
      if (hasEquityLanguage) {
        const clarity = analyzeEquityClarity(lastBotReply);
        if (!clarity.allFourCovered) {
          return {
            kind: "reactive-followup",
            ask: "Clarify equity terms (vesting, strike/FMV, buyback history, included-vs-additional) before discussing comp.",
            trigger: "equityUnclear",
            topic: "equity-clarity",
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

  if (!isTerminalPhase(state.phase)) {
    const reactive = planReactiveFollowup(state);
    if (reactive) return reactive;
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

  /* Opening: discovery-incomplete probe, then anchor.
   *
   * F1 (PDF#19 2026-05-15) — removed the `turnIndex >= 1` gate that
   * forced turn 0 to skip discovery and go straight to open-with-offer
   * (a specific number anchor). Real recruiters open with a discovery
   * question, not an anchor; F2 substitutes if the LLM tries to anchor
   * anyway. */
  if (state.phase === "opening") {
    if (
      state.discoveryStage === "discovery" &&
      state.discoveryChecklist != null
    ) {
      const roleFamily = classifyRoleFamily(state.role);
      if (!isDiscoveryComplete(state.discoveryChecklist, roleFamily)) {
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
          return {
            kind: "discovery-probe",
            item: orderedItem,
            ask: ordered.prompt,
            _move: {
              lever: "probe",
              newTotalLpa: null,
              rationale:
                `Discovery incomplete (next: ${orderedItem}) — ask: ${ordered.prompt}${skippedHint}`,
              /* F7 — carry the item key so applyAiMove can push it
               * onto askedTopics for the repetition guard. */
              askedTopic: orderedItem,
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
              askedTopic: next.item,
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
        /* F7 — apply same repetition-guard merge here. */
        const skipRecord = buildSkipRecord(state);
        const next = skipRecord != null
          ? (() => {
              const item = getNextOrderedDiscoveryItem(state.discoveryChecklist!, roleFamily, skipRecord);
              return item != null ? getNextDiscoveryQuestion(state.discoveryChecklist!, roleFamily) : null;
            })()
          : getNextDiscoveryQuestion(state.discoveryChecklist, roleFamily);
        if (next != null) {
          return {
            kind: "discovery-probe",
            item: next.item,
            ask: next.prompt,
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
function planReactiveFollowup(state: NegotiationState): PlannedAction | null {
  const delta = state.lastTurnDelta;
  if (!delta) return null;
  const fired = state.reactiveFollowupsFired ?? [];
  const hasFired = (topic: string): boolean => fired.includes(topic);

  /* Rule: answer-direct — candidate ended the turn on a direct question.
   * Highest priority among reactive rules: ignoring a candidate question
   * to push the next checklist item is the canonical procedural-by-default
   * failure mode. Topic key includes the turn so the same question
   * acknowledgement doesn't blanket-suppress future questions. */
  if (delta.askedQuestion) {
    const topic = `answer-direct@${state.turnIndex}`;
    if (!hasFired(topic)) {
      return {
        kind: "reactive-followup",
        ask: "Answer the candidate's question first; checklist advance pauses until the question is addressed.",
        trigger: "askedQuestion",
        topic: "answer-direct",
        _move: {
          lever: "probe",
          newTotalLpa: null,
          rationale: "Candidate asked a direct question this turn — answer before advancing.",
          actionKind: "reactive-followup",
          askedTopic: topic,
        },
      };
    }
  }

  /* Rule: variable-comfort — candidate disclosed current CTC AND the
   * variable share is meaningful (>25%). Real recruiters probe whether
   * the candidate has been hitting payouts in full before treating
   * variable as banked. */
  if (delta.disclosedCurrentCtc && !hasFired("variable-comfort")) {
    const breakdown = state.candidateComponentBreakdown;
    const total =
      breakdown && breakdown.base != null && breakdown.variable != null
        ? breakdown.base + breakdown.variable
        : null;
    const variableSharePct =
      total != null && total > 0 && breakdown.variable != null
        ? (breakdown.variable / total) * 100
        : 0;
    if (variableSharePct > 25) {
      const pctRounded = Math.round(variableSharePct);
      return {
        kind: "reactive-followup",
        ask:
          `${pctRounded}% variable is significant — what's your comfort with that share, ` +
          "and have you been hitting payouts in full?",
        trigger: "variable-share-high",
        topic: "variable-comfort",
        _move: {
          lever: "probe",
          newTotalLpa: null,
          rationale: `Candidate disclosed ${pctRounded}% variable share — probe comfort + payout history before banking it.`,
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
      ask: "That's useful context — is the competing offer at a similar stage, or further along?",
      trigger: "invokedCompetingOffer",
      topic: "competing-leverage-ack",
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

  /* Rule: notice-buyout — candidate disclosed >= 60d notice. Buyout
   * conversation is the standard recruiter response on long runways. */
  if (delta.disclosedNoticePeriod && !hasFired("notice-buyout")) {
    const days = state.noticeJoining?.noticePeriodDays;
    if (days != null && days >= 60) {
      return {
        kind: "reactive-followup",
        ask:
          `${days} days is a long runway — would your current employer entertain a buyout, ` +
          "or are you locked in?",
        trigger: "notice-period-long",
        topic: "notice-buyout",
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
    const should = shouldProbeHikeJustification({
      currentCtcLpa: state.candidateCurrentCtc,
      expectedCtcLpa: state.candidateTarget,
      valueProofProvided,
    });
    if (should) {
      const roleFamily = classifyRoleFamily(state.role);
      const ask = getHikeJustificationProbe(roleFamily);
      return {
        kind: "reactive-followup",
        ask,
        trigger: "hike-above-threshold",
        topic: "hike-justification",
        _move: {
          lever: "probe",
          newTotalLpa: null,
          rationale: `Expected CTC > 30% over current with no value proof — role-specific impact probe (${roleFamily}).`,
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
   * at turn 3+ already. One gentle push before accepting the refusal. */
  if (
    state.candidateProfile?.evasiveOnCurrentCtc &&
    state.turnIndex >= 3 &&
    !hasFired("ctc-gentle-push")
  ) {
    return {
      kind: "reactive-followup",
      ask: "I want to make sure I can go to bat for you internally — having a sense of your current package really helps. Are you comfortable sharing?",
      trigger: "evasiveOnCurrentCtc",
      topic: "ctc-gentle-push",
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
    const DIRECTIONAL_RE = /\b(growth|ownership|upside|learning|culture|trajectory|impact|equity|meaningful|long.?term)\b/i;
    const HAS_SPECIFIC_NUMBER_RE = /\d+(?:\.\d+)?\s*(?:LPA|L\b|lakh|lakhs?|lac|lacs)/i;
    if (
      lastCandidateText &&
      DIRECTIONAL_RE.test(lastCandidateText) &&
      !HAS_SPECIFIC_NUMBER_RE.test(lastCandidateText)
    ) {
      return {
        kind: "reactive-followup",
        ask: "It sounds like the role's growth trajectory matters as much as the number — what would make the opportunity feel genuinely worth the move for you?",
        trigger: "directional-expectation",
        topic: "value-proof",
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

  return null;
}

/* F2 (PDF#19 2026-05-15) — kernel-authored fallback prose. When a
 * CRITICAL validator (number-discipline, range-discipline, budget-
 * discipline, next-action-emitted, role-label, close-vocab, fabricated-
 * facts) rejects the LLM draft past the reroll cap, the handler
 * substitutes this deterministic prose instead of shipping the bad
 * draft. Anchored on the planner's already-stamped `state.plannedNextAction`
 * so the user sees the question/move the kernel actually decided on,
 * not whatever the LLM hallucinated.
 *
 * Pure. No side-effects. Never reads non-state fields.
 */
export function renderActionFallbackProse(
  action: NextAction | null | undefined,
  state: NegotiationState,
): string {
  if (!action) {
    /* No planned action stamped — defensive default that names the
     * role but emits no number. */
    return "Let me check on that and come back to you in a moment.";
  }
  switch (action.kind) {
    case "discovery-probe":
      return action.ask || "Could you tell me a bit more about what you're looking for?";
    case "reactive-followup":
      return action.ask || "Could you say a little more about that?";
    case "range-disclosure": {
      const lo = state.band.initialOffer;
      const hi = state.band.maxStretch;
      return `The band we're working within is ₹${lo}-${hi}L. How does that land against what you had in mind?`;
    }
    case "open-with-offer":
      return "Before we name a number — what range were you targeting?";
    case "probe-expectations":
      return "What range were you targeting for this role?";
    case "probe-justification":
      return "Help me understand the rationale behind that number — what's it anchored on?";
    case "probe-mismatch":
      return "Before we dig into comp, can you walk me through how your current work maps to this role?";
    case "info-disclosure":
      return "Let me come back to you with the structured breakdown in a moment.";
    case "counter-offer":
      return state.highestOfferMade > 0
        ? `We're holding on the current offer of ₹${state.highestOfferMade}L. What would move this forward for you?`
        : "What number would land for you?";
    case "hold-firm":
      return state.highestOfferMade > 0
        ? `We're going to hold at ₹${state.highestOfferMade}L. Take some time to think it over.`
        : "We're going to hold here. Take some time to think it over.";
    case "lever-explore":
      return "Let me see what else we can put together on the package side.";
    case "lever-loop-guard":
      return "Take a moment to think it over and let me know where you land.";
    case "live-walk-away":
      return action.mode === "walk"
        ? "It sounds like this may not be the right fit — I appreciate the conversation."
        : state.highestOfferMade > 0
          ? `We're going to hold at ₹${state.highestOfferMade}L for now.`
          : "Let me think about how to move this forward.";
    case "close":
      return action.mode === "accept"
        ? "Glad we landed on this. I'll follow up with the formal paperwork shortly."
        : action.mode === "walkaway"
          ? "Understood — I appreciate the time. Wishing you well."
          : "Let's pause here. Take some time and come back to me when you're ready.";
    case "auto-accept":
      return "We can move forward at the current package. I'll follow up with the formal paperwork shortly.";
    case "terminal-restate":
      return state.highestOfferMade > 0
        ? `The offer stands at ₹${state.highestOfferMade}L.`
        : "We've covered the relevant ground here.";
    case "rescission":
      return "Given how this has gone, we're going to step back from the offer.";
    default:
      return "Let me come back to you in a moment.";
  }
}

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
