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
  type DiscoveryTopic,
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
import { marketDataSources } from "./_candidate-profile";
import { resumeConfirmsCompany } from "./_resume-fact-pack";

/** Polish 3 (2026-05-16) — render the reactive followup for a
 *  candidate who cited external market data. When the candidate named
 *  specific sources (AmbitionBox, Naukri, Blind, ...), the line cites
 *  them verbatim using the `marketDataSources` map so the recruiter
 *  sounds like they actually heard the candidate. When the source
 *  list is empty (generic "market data" framing), falls back to a
 *  source-agnostic line. */
function buildMarketDataReferenceAsk(sources: string[]): string {
  if (sources.length === 0) {
    return (
      "You're referencing market data — useful. Which source are we " +
      "comparing against? I want to make sure we're benchmarking against " +
      "comparable companies and stage."
    );
  }
  const names = sources
    .map((k) => marketDataSources[k])
    .filter((s): s is string => Boolean(s));
  /* "A", "A and B", "A, B and C" */
  let joined: string;
  if (names.length === 1) joined = names[0];
  else if (names.length === 2) joined = `${names[0]} and ${names[1]}`;
  else joined = `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return (
    `Right — ${joined} numbers are useful as a floor, but they aggregate ` +
    `across grades and don't always reflect the level rubric. For your ` +
    `level specifically, our internal band sits on a different basis. Let me ` +
    `walk you through how we're framing the fitment.`
  );
}

/** Polish 2 (2026-05-16) — refireable-topic policy table.
 *
 * Most reactive topics single-fire (the planner consults
 * state.reactiveFollowupsFired before emitting and skips on a match).
 * Sticky topics that real Indian candidates revisit across a call
 * — tax planning, notice-period anxiety, narrowing a stated range —
 * are listed here with a per-topic max fire count and a per-topic
 * minimum turn gap between fires. Consulted by `canRefire`.
 *
 * Tuning rationale:
 *   - tax-implication (max 3, gap 4): candidates re-raise tax after
 *     each fitment movement; gap 4 keeps it from spamming.
 *   - notice-buyout    (max 2, gap 5): a second pass after a structural
 *     lever lands is realistic; more becomes nagging.
 *   - range-to-point   (max 3, gap 3): candidates often soften the
 *     range under different framings as the discussion progresses.
 *   - variable-comfort (max 2, gap 4): post counter, candidates re-poke
 *     variable-pay risk before committing — classic Indian-mid-career
 *     reflex after a Wipro/Infy variable-cut memory.
 *   - equity-clarity   (max 2, gap 4): after lever-rsu-refresh fires
 *     or a band-anchor moves, candidates re-ask cliff/vest specifics;
 *     fitment changes invalidate the prior mental model.
 *   - competing-credibility (max 2, gap 5): when the candidate keeps
 *     dropping a competing-offer hint, recruiters legitimately probe
 *     twice — once for written/verbal, once for the actual number. */
export const REFIREABLE_TOPICS: Partial<Record<DiscoveryTopic, { max: number; gap: number }>> = {
  "tax-implication": { max: 3, gap: 4 },
  "notice-buyout": { max: 2, gap: 5 },
  "range-to-point": { max: 3, gap: 3 },
  "variable-comfort": { max: 2, gap: 4 },
  "equity-clarity": { max: 2, gap: 4 },
  "competing-credibility": { max: 2, gap: 5 },
};

/** Polish 2 (2026-05-16) — decide whether a topic can fire (again) this
 *  turn given the per-topic policy. For refireable topics: checks both
 *  the per-topic max count and the per-topic minimum turn-gap since
 *  last fire. For everything else: single-fire (matches legacy
 *  hasFired semantics against state.reactiveFollowupsFired). Pure. */
export function canRefire(topic: DiscoveryTopic, state: NegotiationState): boolean {
  const policy = REFIREABLE_TOPICS[topic];
  if (!policy) {
    /* Non-refireable: fires once. The reactiveFollowupsFired ledger is
     * the source of truth for single-fire topics. */
    const fired = state.reactiveFollowupsFired ?? [];
    return !fired.includes(topic);
  }
  const log = state.reactiveFollowupsFireLog ?? {};
  const turns = log[topic] ?? [];
  if (turns.length >= policy.max) return false;
  if (turns.length === 0) return true;
  const lastTurn = turns[turns.length - 1];
  const gap = state.turnIndex - lastTurn;
  return gap >= policy.gap;
}

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
  | { kind: "reactive-followup"; ask: string; trigger: string; topic: DiscoveryTopic }
  /* ResumeFactPack track Step 4 (2026-05-16) — credibility-probe. Fires
   * when the candidate states a current-company affiliation and the
   * ResumeFactPack does NOT confirm it (no fuzzy match against latestRole
   * or priorCompanies). Single-fire via state.credibilityProbeFired.
   * resumeCompany is the latestRole.companyName from the pack;
   * statedCompany is what the candidate said. */
  | { kind: "credibility-probe"; resumeCompany: string; statedCompany: string }
  | { kind: "probe-mismatch" }
  | { kind: "live-walk-away"; mode: "walk" | "hold-firm" | "probe" }
  | { kind: "range-disclosure" }
  | { kind: "discovery-probe"; item: string; ask: string }
  | { kind: "open-with-offer" }
  | { kind: "lever-loop-guard" }
  | { kind: "info-disclosure"; topic: "breakdown" | "benefits" | "comp-structure" | "notice" | "hike-pct" }
  | { kind: "probe-expectations" }
  | { kind: "probe-justification" }
  | {
      kind: "counter-offer";
      /* Kernel-first cleanup (2026-05-16) — typed counter-offer payload.
       * Canonical prose reads these directly instead of casting to
       * `(action as any)._move.newTotalLpa`. The same numbers live on
       * `_move.newTotalLpa` for actionToLever; carrying them on the
       * action discriminator means downstream consumers don't have to
       * touch the private `_move` field. */
      counterTotalLpa: number;
      counterFixedLpa?: number;
      counterVariableLpa?: number;
    }
  | { kind: "lever-explore"; from: "hard-band-cap" | "no-headroom" | "constraint-violation" | "default" }
  | { kind: "hold-firm"; mode: "verbal-accept" | "lever-loop" }
  | { kind: "rescission" }
  /* Fix 4 (2026-05-16) — formal close recap. Fires when phase is
   * closing-push or accepted AND the candidate has verbally accepted.
   * Enumerates the structured fitment so the candidate reaffirms the
   * full picture (numbers + process + dates) before the offer letter
   * is cut. Canonical prose lists Fixed | Variable | JB | Retention |
   * Notice | Proposed joining | BGV start trigger | OL ETA. */
  | {
      kind: "close-recap-formal";
      fixedLpa: number;
      variableLpa: number;
      joiningBonusLpa?: number;
      retentionBonusLpa?: number;
      noticePeriodWeeks: number;
      proposedJoiningDate?: string;
      bgvStartTrigger: string;
      offerLetterEta: string;
    }
  /* Fix 1 (2026-05-16) — Real Indian-context negotiation levers. Each
   * is a structural alternative to cash on the table; the planner
   * rotates through them in lever-explore mode based on marketMode
   * and what hasn't fired yet (tracked via state.leversFired). RSU
   * refresh is sampled only when marketMode ∈ {hot,neutral} AND the
   * band carries equity (MNC/GCC). */
  | { kind: "lever-grade-upgrade" }
  | { kind: "lever-retention-bonus" }
  | { kind: "lever-rsu-refresh" }
  | { kind: "lever-relocation" }
  | { kind: "lever-perf-bonus-cadence" }
  | { kind: "lever-joining-bonus-explained" }
  | { kind: "band-anchor-with-rationale" }
  /* perfect 5 (2026-05-16) — Indian-recruiter band-defense moves.
   * internal-equity-defense: surfaces peer-band ranges when the
   * candidate pushes past counterRound 2 — invokes the comp-team
   * escalation gate ("would have to be signed off by Comp").
   * comparative-anchoring: places the candidate's proposed number
   * relative to the band (top quartile vs median) so the candidate
   * understands where in the band they're landing. */
  | {
      kind: "internal-equity-defense";
      peerBandTopLpa: number;
      peerBandMedianLpa: number;
    }
  | {
      kind: "comparative-anchoring";
      quartile: "top" | "median";
    }
  /* AP3-F2 (2026-05-17) — component-aware discovery probe. Fires for
   * senior comp negotiations AFTER currentCtc is satisfied AND BEFORE
   * the target probe. Order: base → variable → esop. Skips any
   * component already populated on state.candidateComponentBreakdown.
   * Single-fire per (session, component) via the askedTopics ledger
   * (topic = "currentCtcBase" | "currentCtcVariable" | "currentCtcEsop"). */
  | { kind: "component-probe"; component: "base" | "variable" | "esop" };

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
 *  withinTurns turns so getNextOrderedDiscoveryItem skips them both.
 *
 *  BUG-2 ROOT CAUSE FIX (PDF#24, 2026-05-16): the recently-asked branch
 *  was unconditional — any topic asked in the last 3 turns got skipped,
 *  even if the candidate never answered it. Real session: turn 0
 *  canonical opener asked currentCtc; candidate replied with a hike-
 *  rationale (no number). On the next planner turn, currentCtc was in
 *  the recently-asked set so the planner SKIPPED it and fell through
 *  to expected-CTC fitment-split — which was the symptom in PDF#24
 *  turn 4 (bot skipped currentCtc backfill, jumped to fitment-split
 *  the moment the candidate volunteered expected CTC).
 *
 *  The recency suppression is for "don't immediately re-ask what the
 *  candidate JUST answered" — it should only fire when the asked-AND-
 *  answered both hold. We gate the recently-asked block by checking
 *  the discovery checklist: if the corresponding `*Answered`/`*Disclosed`
 *  flag is still false, the candidate dodged the ask, and the planner
 *  must keep the item in the ordered sequence so it can backfill the
 *  gap. */
function isAskedTopicAnswered(
  checklist: NegotiationState["discoveryChecklist"],
  topic: DiscoveryTopic,
  state?: NegotiationState,
): boolean {
  /* Session #25 root-fix (2026-05-16) — state-derived satisfaction signal.
   * The discovery checklist normally tracks satisfaction, but if
   * syncChecklistFromParsedFacts desyncs (legacy session, parser miss
   * later corrected by foldFactsIntoState, etc.) the planner could
   * re-fire a topic whose fact is already in NegotiationState. Read the
   * fact fields directly as an OR-satisfaction signal — either the
   * checklist OR the bound fact satisfies the topic. */
  if (state != null) {
    if (
      (topic === "currentCtcAnswered" || topic === "currentCtcAsked") &&
      state.candidateCurrentCtc != null
    ) {
      return true;
    }
    if (
      (topic === "targetAnswered" || topic === "targetAsked") &&
      state.candidateTarget != null
    ) {
      return true;
    }
    if (
      (topic === "competingOffersAnswered" || topic === "competingOffersAsked") &&
      (state.competingOffer != null || state.competingOfferDetail?.hasAny)
    ) {
      return true;
    }
  }
  if (checklist == null) return false;
  /* The askedTopic key the planner pushes mirrors the DISCOVERY_SEQUENCE
   * key for discovery probes (currentCtcAnswered, targetAnswered, etc.),
   * which doubles as the satisfied-flag name on DiscoveryChecklist.
   * Look it up directly; treat any unrecognised key as "still pending"
   * so we never accidentally over-skip a topic we can't reason about. */
  const flag = (checklist as unknown as Record<string, boolean | undefined>)[topic];
  if (typeof flag === "boolean" && flag) return true;
  /* Some legacy planner sites use a `*Asked` topic name (e.g.
   * "currentCtcAsked"). Those are pre-F7 sentinels we treat as
   * satisfied iff the matching `*Answered`/`*Disclosed` flag is set;
   * if not, leave them OUT of the skip record so the gap stays
   * visible to the ordered cascade. */
  if (topic.endsWith("Asked")) {
    const root = topic.slice(0, -"Asked".length);
    const answered = (checklist as unknown as Record<string, boolean | undefined>)[`${root}Answered`];
    const disclosed = (checklist as unknown as Record<string, boolean | undefined>)[`${root}Disclosed`];
    return Boolean(answered || disclosed);
  }
  return false;
}

function buildSkipRecord(
  state: NegotiationState,
  withinTurns = 3,
): Partial<Record<DiscoveryTopic, boolean>> | null {
  const refused = state.discoveryRefusedItems ?? null;
  const topics = state.askedTopics ?? [];
  const cutoff = state.turnIndex - withinTurns;
  const recentlyAsked: Partial<Record<DiscoveryTopic, boolean>> = {};
  for (const t of topics) {
    if (t.atTurn <= cutoff) continue;
    /* Only mark as "skip" if the topic was both asked AND answered
     * within the window. Asked-but-unanswered topics stay re-askable
     * so the discovery cascade can backfill the gap. */
    if (!isAskedTopicAnswered(state.discoveryChecklist, t.topic, state)) continue;
    recentlyAsked[t.topic] = true;
  }
  /* Session #25 root-fix (2026-05-16) — 3-strike consecutive-topic cap.
   * Even when the candidate has dodged a discovery item across multiple
   * turns (and the BUG-2 gate would otherwise keep re-asking it), don't
   * fire the SAME discovery topic three turns in a row. After two
   * consecutive unanswered asks, force-advance so the cascade can move
   * on to the next item. In dev we throw to surface regressions; in
   * prod we silently force-skip and rely on the defensive log
   * downstream. */
  const tail = topics.slice(-2);
  if (tail.length === 2 && tail[0].topic === tail[1].topic) {
    const stuckTopic = tail[0].topic;
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn(
        `[planner] discovery topic "${stuckTopic}" has fired twice in a row at turns ` +
          `${tail[0].atTurn},${tail[1].atTurn}; force-advancing past it on turn ${state.turnIndex}.`,
      );
    }
    recentlyAsked[stuckTopic] = true;
  }
  if (refused == null && Object.keys(recentlyAsked).length === 0) return null;
  return { ...(refused ?? {}), ...recentlyAsked };
}

/** AP3-F2 (2026-05-17) — senior comp-negotiation signal. Real Indian
 *  recruiters break the current-CTC into base / variable / ESOP only
 *  when the candidate's profile makes the components material. Two
 *  signals qualify:
 *    - applicableYoe >= 4 (the role-applicable YOE — promoted from the
 *      Phase 29 distinction; total YOE doesn't reliably predict comp-
 *      structure literacy in domain-switch cases);
 *    - target role string matches /senior|lead|principal|staff/i — the
 *      title itself signals the band where components matter.
 *  Either signal is sufficient. Pure. */
function isSeniorCompProfile(state: NegotiationState): boolean {
  const yoe = state.candidateApplicableYoe;
  if (yoe != null && yoe >= 4) return true;
  if (state.role && /senior|lead|principal|staff/i.test(state.role)) return true;
  return false;
}

/** AP3-F2 (2026-05-17) — pick the next un-probed AND un-satisfied
 *  component in canonical order (base → variable → esop). Returns null
 *  when all components are either populated on
 *  state.candidateComponentBreakdown OR already asked this session
 *  (recorded in state.askedTopics under the matching `currentCtc*`
 *  topic key). Pure. */
function nextComponentProbe(
  state: NegotiationState,
): { component: "base" | "variable" | "esop"; topic: DiscoveryTopic } | null {
  const bd = state.candidateComponentBreakdown;
  const asked = new Set((state.askedTopics ?? []).map((t) => t.topic));
  const order: { component: "base" | "variable" | "esop"; topic: DiscoveryTopic; populated: boolean }[] = [
    { component: "base", topic: "currentCtcBase", populated: bd?.base != null },
    { component: "variable", topic: "currentCtcVariable", populated: bd?.variable != null },
    { component: "esop", topic: "currentCtcEsop", populated: bd?.equity != null },
  ];
  for (const o of order) {
    if (o.populated) continue;
    if (asked.has(o.topic)) continue;
    return { component: o.component, topic: o.topic };
  }
  return null;
}

function planNextActionInternal(state: NegotiationState): PlannedAction {
  /* Terminal stickiness guard (session 13 bug, 2026-05-14): see notes in
   * the original move-picker. */
  if (
    isTerminalPhase(state.phase) &&
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

  if (!isTerminalPhase(state.phase)) {
    const reactive = planReactiveFollowup(state);
    if (reactive) return reactive;
    /* Fix 5 (2026-05-16) — state-based wired profile-flag rules. These
     * read candidateProfile booleans directly (not lastTurnDelta), so
     * they fire even on simulated states without a per-turn delta. */
    const wired = planWiredProfileFollowup(state);
    if (wired) return wired;
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

  /* Fix 1 (2026-05-16) — walk-away gap-gate. When the candidate's
   * target exceeds bandCeiling * 1.5, the gap is structurally
   * unbridgeable; walk-away regardless of turn count (overrides the
   * minTurnsBeforeClose guard below). Threshold sits just above the
   * legacy counter-offer stiffening fixture (target=40, ceiling=28,
   * ratio≈1.43) to preserve the schedule semantics. */
  if (
    !isTerminalPhase(state.phase) &&
    state.phase !== "opening" &&
    state.candidateTarget != null &&
    state.candidateTarget > state.band.maxStretch * 1.5
  ) {
    return {
      kind: "live-walk-away",
      mode: "walk",
      _move: {
        lever: "close-walkaway",
        newTotalLpa: null,
        rationale:
          `Walk-away gap-gate: candidate target ₹${state.candidateTarget}L exceeds ` +
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
  if (
    !isTerminalPhase(state.phase) &&
    PRE_ANCHOR_PHASES.has(state.phase) &&
    !hasOutstandingInfoAsk &&
    state.candidateCurrentCtc != null &&
    state.candidateTarget == null
  ) {
    if (isSeniorCompProfile(state)) {
      const cp = nextComponentProbe(state);
      if (cp != null) {
        return {
          kind: "component-probe",
          component: cp.component,
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
      _move: {
        lever: "open-with-offer",
        newTotalLpa: clampedOpener,
        rationale: clampedOpener < state.band.initialOffer
          ? `Open with anchor ₹${clampedOpener} LPA (clamped from band initial ₹${state.band.initialOffer} against candidate ask ₹${state.candidateTarget}).`
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
        isDiscoveryComplete(
          state.discoveryChecklist,
          classifyRoleFamily(state.role),
        ))
    ) {
      return {
        kind: "band-anchor-with-rationale",
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
        : (state.askedTopics ?? []).some(
            (t) => t.topic === "targetAsked" || t.topic === "targetAnswered",
          );
    if (discoveryDone) {
      return buildCloseRecapFormal(state);
    }
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

    /* perfect 5 (2026-05-16) — Indian-recruiter band-defense moves.
     *
     * These intercept the counter-offer construction with structural
     * band-anchored framing instead of yet another cash-split. Both
     * register on the reactiveFollowupsFired ledger so they single-
     * fire per session (the kernel's applyAiMove plumbing pushes the
     * askedTopic onto the sticky ledger). */
    const fired = state.reactiveFollowupsFired ?? [];

    /* comparative-anchoring fires ONCE after the first counter (when
     * the AI has already shipped a counter-base and the candidate is
     * pushing for more). Quartile selection: candidate target >=
     * band-median → "top", else "median". */
    if (
      state.counterRound === 1 &&
      state.candidateTarget != null &&
      !fired.includes("comparative-anchoring")
    ) {
      const peerBandMedian =
        (state.band.maxStretch + state.band.initialOffer) / 2;
      const quartile: "top" | "median" =
        state.candidateTarget >= peerBandMedian ? "top" : "median";
      return {
        kind: "comparative-anchoring",
        quartile,
        _move: {
          lever: "hold-firm",
          newTotalLpa: state.highestOfferMade,
          rationale: `Comparative-anchoring: candidate target ₹${state.candidateTarget}L vs band-median ₹${peerBandMedian.toFixed(1)}L (quartile=${quartile}).`,
          askedTopic: "comparative-anchoring",
          actionKind: "comparative-anchoring",
        },
      };
    }

    /* internal-equity-defense fires when counterRound >= 2 AND there
     * is a dissatisfaction signal from the candidate this turn (fresh
     * counter / disclosed expected ctc again / asked a question). Uses
     * band.maxStretch as the peer-band top, band-median as floor for
     * the "between X and Y" framing. Single-fire via fired ledger. */
    const delta = state.lastTurnDelta;
    const candidatePushedAgain =
      state.lastCandidateCounterLpa != null ||
      (delta?.disclosedExpectedCtc ?? false) ||
      (delta?.askedQuestion ?? false);
    if (
      state.counterRound >= 2 &&
      candidatePushedAgain &&
      !fired.includes("internal-equity-defense")
    ) {
      const peerBandTopLpa = Math.round(state.band.maxStretch * 10) / 10;
      const peerBandMedianLpa =
        Math.round(((state.band.maxStretch + state.band.initialOffer) / 2) * 10) / 10;
      return {
        kind: "internal-equity-defense",
        peerBandTopLpa,
        peerBandMedianLpa,
        _move: {
          lever: "hold-firm",
          newTotalLpa: state.highestOfferMade,
          rationale: `Internal-equity defense: peer band ₹${peerBandMedianLpa}-${peerBandTopLpa}L; further movement requires Comp sign-off.`,
          askedTopic: "internal-equity-defense",
          actionKind: "internal-equity-defense",
        },
      };
    }

    const target = state.candidateTarget ?? state.band.maxStretch;
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
    const floor = Math.max(state.highestOfferMade, effectiveAnchorLpa(state), priorCtcFloor);
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

    /* perfect 1 (2026-05-16) — multi-turn negotiation spiral.
     * counterRound = number of counter-base moves already shipped this
     * session. Apply a diminishing-concessions multiplier to the
     * gap-fraction on each subsequent counter so the conversation
     * tapers naturally. The existing splitSchedule/boost stack is
     * already tuned for the first counter (round 0 → ~50% of gap), so
     * the multiplier table is [1.0, 0.66, 0.33]:
     *   round 0 → full tuned base (no taper; lead with movement)
     *   round 1 → 2/3 of the tuned base (we've moved once)
     *   round 2 → 1/3 of the tuned base (stretching the band)
     *   round 3+ → 0 (hold firm; pivot to structural levers)
     * Composes multiplicatively with splitSchedule/boost AND applies
     * BEFORE the band-cap component clamp on newTotal. Tuned this way
     * (rather than [0.6, 0.4, 0.2]) so the first-counter behaviour the
     * rest of the system is calibrated against is preserved end-to-end;
     * the diminishing-concessions intent lives strictly on subsequent
     * rounds, which is where real negotiation feels stiffer anyway. */
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
    const SPIRAL_MULTIPLIERS = [1.0, 0.66, 0.33];
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

    if (split > 0.95) split = 0.95;
    /* perfect 1 (2026-05-16) — apply the spiral multiplier to the
     * gap-fraction. Composed multiplicatively with the existing
     * splitSchedule/boost stack so a stiffened rotation still tapers
     * over multiple counter rounds. Applied BEFORE the component
     * constraint validator below (band-cap clamp), so the diminishing
     * concessions take effect first and the band-ceiling still wins
     * as a hard ceiling when the multiplied gap would overshoot. */
    split = split * spiralMultiplier;
    const newTotal = Math.round((floor + (aspiration - floor) * split) * 10) / 10;

    const constraint = validateComponentConstraints(state.band, newTotal);
    if (!constraint.ok) {
      return wrapLeverExplore(pickLeverExploreMove(state), "constraint-violation");
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
    return {
      kind: "counter-offer",
      counterTotalLpa: newTotal,
      counterFixedLpa,
      counterVariableLpa,
      _move: {
        lever: "counter-base",
        newTotalLpa: newTotal,
        rationale: `Split toward target (stiffening ${splitSchedule[counterCount] ?? 0.05}, effective ${split.toFixed(2)}, boost ${boost.toFixed(2)}, market ${state.marketMode}${state.walkAwayReturned ? ", returned" : ""}): floor ₹${floor} → ₹${newTotal} (target ₹${target}, ceiling ₹${ceiling}${priorCtcFloor > 0 ? `, priorCtcFloor ₹${priorCtcFloor}` : ""}).`,
      },
    };
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
  return wrapLeverExplore(legacyMove, "default");
}

/* Fix 1 (2026-05-16) — sample the next un-fired structural lever based on
 * marketMode. Returns null when every lever has fired (caller falls
 * through to the legacy cash-lever rotation). */
function pickStructuralLever(state: NegotiationState): PlannedAction | null {
  const fired = new Set(state.leversFired ?? []);
  /* Rotation order: anchor-with-rationale (first turn after cash floor
   * hit), then explanatory levers, then the structural movers. RSU
   * refresh is gated on MNC/GCC posture (hot/neutral market AND band
   * has equity). */
  const rotation: { kind: StructuralLeverKind; gated: boolean }[] = [
    { kind: "band-anchor-with-rationale", gated: false },
    { kind: "lever-joining-bonus-explained", gated: false },
    { kind: "lever-grade-upgrade", gated: false },
    {
      kind: "lever-rsu-refresh",
      gated: !(state.band.hasEquity && state.marketMode !== "soft"),
    },
    { kind: "lever-retention-bonus", gated: false },
    { kind: "lever-relocation", gated: false },
    { kind: "lever-perf-bonus-cadence", gated: false },
  ];
  for (const { kind, gated } of rotation) {
    if (gated) continue;
    if (fired.has(kind)) continue;
    return makeStructuralLeverAction(kind, state);
  }
  return null;
}

type StructuralLeverKind =
  | "band-anchor-with-rationale"
  | "lever-grade-upgrade"
  | "lever-retention-bonus"
  | "lever-rsu-refresh"
  | "lever-relocation"
  | "lever-perf-bonus-cadence"
  | "lever-joining-bonus-explained";

function makeStructuralLeverAction(
  kind: StructuralLeverKind,
  state: NegotiationState,
): PlannedAction {
  const newTotal = state.highestOfferMade > 0 ? state.highestOfferMade : null;
  const move: AiMove = {
    lever: "benefits-summary",
    newTotalLpa: newTotal,
    rationale: `Structural lever ${kind} (marketMode=${state.marketMode}).`,
    actionKind: kind,
    askedTopic: kind,
  };
  return { kind, _move: move } as PlannedAction;
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
  const hasFired = (topic: DiscoveryTopic): boolean => fired.includes(topic);

  /* Rule: answer-direct — candidate ended the turn on a direct question.
   * Highest priority among reactive rules: ignoring a candidate question
   * to push the next checklist item is the canonical procedural-by-default
   * failure mode. Topic key includes the turn so the same question
   * acknowledgement doesn't blanket-suppress future questions. */
  if (delta.askedQuestion) {
    /* ArchRec 2 (2026-05-16) — was `answer-direct@${turnIndex}`. The
     * per-turn suffix made hasFired() always pass (every turn produced
     * a fresh string), so the "single-fire" intent was actually dead.
     * Use the canonical literal topic; dedup against
     * reactiveFollowupsFired works as documented now that the key
     * matches across turns. */
    if (!hasFired("answer-direct")) {
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
          askedTopic: "answer-direct",
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

/* Fix 5 (2026-05-16) — wire 13 previously-dead candidate-profile flags
 * to reactive followup rules. Sibling of planReactiveFollowup that
 * reads candidateProfile booleans directly (not lastTurnDelta), so the
 * rules fire even on simulated states. Sticky via reactiveFollowupsFired.
 * Phrasing uses Indian recruiter idiom (fitment, grade, revert, BGV). */
function planWiredProfileFollowup(state: NegotiationState): PlannedAction | null {
  const profile = state.candidateProfile;
  if (!profile) return null;
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
        ask: "Understood that fixed weight matters to you — is that to bank against EMIs or to anchor the next appraisal cycle? Helps me frame the fitment correctly.",
        rationale: "Candidate signalled preference for higher base — probe motivation (cashflow vs anchor) to size the fixed:variable split.",
      },
      {
        flag: profile.wantsJoiningBonus,
        topic: "wants-joining-bonus",
        ask: "On the joining bonus — are you looking to cover a notice buyout or a variable shortfall at your current place? The clawback is typically 12 months pro-rata.",
        rationale: "Candidate asked for JB — probe whether it's notice buyout vs variable bridge to size correctly and surface clawback context.",
      },
      {
        flag: profile.wantsRelocationAllowance,
        topic: "wants-relocation-allowance",
        ask: "Relocation is on our standard menu — one-time shift assistance plus a settling-in component. Are we talking intra-city or a base-city change?",
        rationale: "Candidate mentioned relocation — confirm intra-city vs inter-city to pick the right reimbursement bucket.",
      },
      {
        flag: profile.mentionedSpouseFamily,
        topic: "spouse-family-context",
        ask: "Got it — and on the family side, is your spouse also in a similar role search, or is location flex something we should plan around?",
        rationale: "Candidate referenced spouse/family — surface dual-career and location constraints early so they don't ambush the close.",
      },
      {
        flag: profile.askedAboutReporting,
        topic: "reporting-structure",
        ask: "Reporting on this role is into the EM/Director on the platform side; skip-level is the VP. Want me to set up a quick chat with the hiring manager?",
        rationale: "Candidate asked about reporting — answer with reporting line and offer manager intro to de-risk the close.",
      },
      {
        flag: profile.askedAboutGrowthPath,
        topic: "growth-path",
        ask: "On the growth path — standard arc here is two appraisal cycles to the next grade, faster if you land a high-impact charter. We'll align that in the first 30 days.",
        rationale: "Candidate asked about growth path — give the appraisal-cycle anchor (Indian context: April/March cycle, two cycles to next grade).",
      },
      {
        flag: profile.askedAboutTeamSize,
        topic: "team-size",
        ask: "The pod you'd join is about 8 engineers today, splitting into two squads next quarter — so genuine ownership without being lost in headcount.",
        rationale: "Candidate asked about team size — answer with concrete headcount and trajectory so they can map ownership scope.",
      },
      {
        flag: profile.mentionedTaxImplication,
        topic: "tax-implication",
        ask: "On tax — under the new regime, the optimisation point sits around ₹15L; above that the marginal rate is 30% plus surcharge. Want me to share the structured breakup so you can see take-home?",
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
        ask: "On the moonlighting question — our policy is the standard one: prior written disclosure for any external paid engagement, no compete-overlap. Was there a specific arrangement you wanted to flag?",
        rationale: "Candidate mentioned moonlighting — surface policy proactively (Indian context: post-2022 IT-services crackdown made this load-bearing).",
      },
      {
        flag: profile.gaveRangeNotPoint,
        topic: "range-to-point",
        ask: "You shared a range — to frame the fitment cleanly, where in that range do you actually see yourself landing? Helps me run a sharper number past leadership.",
        rationale: "Candidate gave a range instead of a target — pin down the actual point before the lever rotation locks in.",
      },
      {
        flag: profile.deflectedOnRange,
        topic: "range-deflection",
        ask: "I understand wanting to hear our number first — fair. As per our band for this grade, the fitment sits in a defined corridor; if you can share even a rough target, I can tell you straight away whether we're broadly aligned.",
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
function buildCloseRecapFormal(state: NegotiationState): PlannedAction {
  const total = state.highestOfferMade;
  const baseStretch = state.band.baseStretch ?? Math.round(total * 0.85 * 10) / 10;
  const variableMax = state.band.variableMax ?? Math.max(0, Math.round((total - baseStretch) * 10) / 10);
  const fixedLpa = Math.min(total, baseStretch);
  const variableLpa = Math.max(0, Math.min(variableMax, Math.round((total - fixedLpa) * 10) / 10));
  const noticeDays = state.noticeJoining?.noticePeriodDays ?? 60;
  const noticePeriodWeeks = Math.max(1, Math.round(noticeDays / 7));
  return {
    kind: "close-recap-formal",
    fixedLpa,
    variableLpa,
    joiningBonusLpa: state.lastJoiningBonusOffered ?? undefined,
    retentionBonusLpa: undefined,
    noticePeriodWeeks,
    proposedJoiningDate: undefined,
    bgvStartTrigger: "post-acceptance, on signed offer letter",
    offerLetterEta: "2-3 business days",
    _move: {
      lever: "close-acceptance",
      newTotalLpa: total,
      joiningBonusAmount: state.lastJoiningBonusOffered ?? undefined,
      rationale:
        `Candidate verbally accepted; emit structured close recap (fixed ₹${fixedLpa}L, variable ₹${variableLpa}L, ` +
        `JB ${state.lastJoiningBonusOffered != null ? `₹${state.lastJoiningBonusOffered}L` : "none"}, ` +
        `notice ${noticePeriodWeeks}w, OL ETA 2-3 business days).`,
      actionKind: "close-recap-formal",
      askedTopic: "close-recap-formal",
    },
  };
}

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
