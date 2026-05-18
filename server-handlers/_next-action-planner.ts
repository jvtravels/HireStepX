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
import { hasConcreteTell } from "./_competing-offer-detail";

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

/** Crack 3 (2026-05-17) — defensive-lever ladder determinism.
 *
 * The band-defense triad fires as a strict 3-step sequence when the
 * negotiation is in counter-offer with at least one prior counter:
 *
 *   step 0 → comparative-anchoring   (peer-band reframe)
 *   step 1 → panel-approval-stall    (manufactured friction)
 *   step 2 → internal-equity-defense (final defensive)
 *
 * Before this helper, ordering was emergent from a mix of single-fire
 * stamps and counterRound thresholds — swap a turn or interleave a
 * reactive interrupt (anchor-defense-hike-strong, fake-leverage-
 * challenge) and the sub-sequence shuffled. Now the ladder is keyed
 * off the reactiveFollowupsFired ledger (the same mechanism the
 * surrounding probes use): step N fires only if step N-1 is in the
 * ledger. Interrupts pass through without shuffling because they
 * don't push the triad's askedTopic markers.
 *
 * Returns the step that should fire next, or `null` if:
 *   - the triad is not yet armed (wrong phase / counterRound 0), or
 *   - the triad is exhausted (all three already in the ledger).
 *
 * Pure — no side-effects, no clock. */
export function defensiveLadderStep(state: NegotiationState): 0 | 1 | 2 | null {
  if (state.phase !== "counter-offer") return null;
  if (state.counterRound < 1) return null;
  const fired = state.reactiveFollowupsFired ?? [];
  const comparativeFired = fired.includes("comparative-anchoring");
  const stallFired = fired.includes("panel-approval-stall");
  const equityFired = fired.includes("internal-equity-defense");
  if (!comparativeFired) return 0;
  if (!stallFired) return 1;
  if (!equityFired) return 2;
  return null;
}

/** Discriminated union of every action the planner can emit. The kind
 *  taxonomy collapses the prior 15 sequential `if return` branches into
 *  a single declarative space external consumers can switch on without
 *  reading move.rationale strings. */
/* AR1 / Audit Pass 4 (PDF#27, 2026-05-17) — type-level satisfiesTopic.
 *
 * Probe-producing NextAction variants now declare a REQUIRED
 * `satisfiesTopic: DiscoveryTopic | DiscoveryTopic[]` field. The ship-
 * site in applyAiMove uses this as the SINGLE source of truth for
 * pushing onto state.askedTopics. Adding a new probe kind without
 * satisfiesTopic is a COMPILE ERROR — the discovery-loop class of
 * regression (kernel asks a topic but never records it) is closed
 * permanently.
 *
 * Terminal/structural kinds (close, auto-accept, hold-firm, info-
 * disclosure, etc.) don't probe and don't declare the field. */

/** Topic(s) a probe-producing action declares it is asking about. The
 *  array form is for legitimate multi-topic probes (e.g. close-recap-
 *  formal recaps notice + variable + fixed simultaneously). */
export type SatisfiesTopic = DiscoveryTopic | readonly DiscoveryTopic[];

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
  | { kind: "reactive-followup"; ask: string; trigger: string; topic: DiscoveryTopic; satisfiesTopic: SatisfiesTopic }
  /* ResumeFactPack track Step 4 (2026-05-16) — credibility-probe. Fires
   * when the candidate states a current-company affiliation and the
   * ResumeFactPack does NOT confirm it (no fuzzy match against latestRole
   * or priorCompanies). Single-fire via state.credibilityProbeFired.
   * resumeCompany is the latestRole.companyName from the pack;
   * statedCompany is what the candidate said. */
  | { kind: "credibility-probe"; resumeCompany: string; statedCompany: string; satisfiesTopic: SatisfiesTopic }
  | { kind: "probe-mismatch"; satisfiesTopic: SatisfiesTopic }
  | { kind: "live-walk-away"; mode: "walk" | "hold-firm" | "probe" }
  /* Phase 2 Indian-HR redesign (2026-05-17) — replaces the legacy
   * `range-disclosure` NextAction kind that leaked the band ceiling.
   * Real Indian HR recruiters deflect band/range questions; they NEVER
   * disclose internal bands. Fires when candidate asks "what's your band /
   * range / budget?" (same planner trigger as the old `range-disclosure`
   * kind), but the prose surface is a deflection that offers to take the
   * candidate's expectation back to the panel. Note: the `range-disclosure`
   * PHASE enum value (NegotiationPhase) is intentionally retained — it's a
   * state-machine stage, not a lever, and removing it would invalidate
   * derivePhase / phase-monotonicity rules. */
  | { kind: "band-disclosure-deflect"; satisfiesTopic: SatisfiesTopic }
  | { kind: "discovery-probe"; item: string; ask: string; satisfiesTopic: SatisfiesTopic }
  | { kind: "open-with-offer"; satisfiesTopic: SatisfiesTopic }
  | { kind: "lever-loop-guard" }
  | { kind: "info-disclosure"; topic: "breakdown" | "benefits" | "comp-structure" | "notice" | "hike-pct" }
  | { kind: "probe-expectations"; satisfiesTopic: SatisfiesTopic }
  | { kind: "probe-justification"; satisfiesTopic: SatisfiesTopic }
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
      satisfiesTopic: SatisfiesTopic;
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
      satisfiesTopic: SatisfiesTopic;
    }
  /* Fix 1 (2026-05-16) — Real Indian-context negotiation levers. Each
   * is a structural alternative to cash on the table; the planner
   * rotates through them in lever-explore mode based on marketMode
   * and what hasn't fired yet (tracked via state.leversFired). RSU
   * refresh is sampled only when marketMode ∈ {hot,neutral} AND the
   * band carries equity (MNC/GCC). */
  | { kind: "lever-grade-upgrade"; satisfiesTopic: SatisfiesTopic }
  | { kind: "lever-retention-bonus"; satisfiesTopic: SatisfiesTopic }
  | { kind: "lever-rsu-refresh"; satisfiesTopic: SatisfiesTopic }
  | { kind: "lever-relocation"; satisfiesTopic: SatisfiesTopic }
  | { kind: "lever-perf-bonus-cadence"; satisfiesTopic: SatisfiesTopic }
  | { kind: "lever-joining-bonus-explained"; satisfiesTopic: SatisfiesTopic }
  | { kind: "band-anchor-with-rationale"; satisfiesTopic: SatisfiesTopic }
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
      satisfiesTopic: SatisfiesTopic;
    }
  | {
      kind: "comparative-anchoring";
      quartile: "top" | "median";
      satisfiesTopic: SatisfiesTopic;
    }
  /* AP3-F2 (2026-05-17) — component-aware discovery probe. */
  | { kind: "component-probe"; component: "base" | "variable" | "esop"; satisfiesTopic: SatisfiesTopic }
  /* AP3-F3 / PDF#27 Fix 5 (2026-05-17) — band-disclosure anchor.
   *
   * Phase 2 Indian-HR redesign (2026-05-17 follow-up): real Indian HR
   * recruiters do NOT disclose internal salary bands to candidates — they
   * share a single initial offer number. Renamed from `anchor-with-band`
   * to `anchor-with-offer`; `lo`/`hi` dropped in favour of a single
   * `initialOffer` point (band floor, classic Indian HR lowball). */
  | { kind: "anchor-with-offer"; initialOffer: number; bandIncomplete: boolean; satisfiesTopic: SatisfiesTopic }
  /* Post-acceptance documentation request. Fires immediately after
   * `verbalAcceptanceTurn` is stamped (close-recap acceptance). Single-fire
   * via state.postAcceptanceDocsRequestedAtTurn; transitions to terminal. */
  | { kind: "post-acceptance-document-request" }
  /* Phase 3 missing-lever set (2026-05-17) — three Indian-HR levers that
   * complement the existing band-defense triad (comparative-anchoring /
   * internal-equity-defense / probe-justification). All three are
   * SINGLE-FIRE per session via dedicated turn-stamped state fields
   * (panelApprovalStallFiredAtTurn / politeWalkawayFiredAtTurn /
   * hikeStrongDefenseFiredAtTurn) so they're terminal-state-clean. None
   * are probe-producing (no satisfiesTopic) — they're stall / walkaway /
   * rebuttal moves, not discovery probes. */
  /* panel-approval-stall: distinct "let me check with the panel and
   * revert by EOD" stall move. Fires when counterRound>=2 and the
   * candidate has just countered again. The AI does NOT make a fresh
   * counter on this turn — it stalls; next turn (per planner cascade)
   * the AI returns with the final counter or hold-firm. */
  | { kind: "panel-approval-stall" }
  /* polite-walkaway: AI declines to continue when candidate stalls
   * without leverage. Fires when there's a stall signal AND no
   * competing offer AND counterRound>=1 AND candidate isn't in
   * good-faith negotiation. Stamps walkedAwayAtTurn immediately on
   * fire (we treat the polite-walkaway emission as the formal exit
   * trigger; if the candidate engages back the existing walk-away-
   * return trapdoor handles re-opening). */
  | { kind: "polite-walkaway" }
  /* anchor-defense-hike-strong: rebuts "that's only X% hike" complaint
   * with peer-context framing. Payload carries the computed hike% +
   * the current CTC + the offer used for the computation so canonical
   * prose can render the exact numbers without re-doing the math. */
  | {
      kind: "anchor-defense-hike-strong";
      hikePct: number;
      currentCtc: number;
      offer: number;
    }
  /* fake-leverage-challenge: AI softly asks the candidate to share the
   * competing offer letter (or a redacted version) after a concession
   * round. Catches bluffs (candidate dodges → planner can downweight
   * leverage in a future commit) and rewards real offers (candidate
   * complies → leverage strengthens). NOT probe-producing — does not
   * push onto askedTopics. Single-fire via
   * state.fakeLeverageChallengeFiredAtTurn AND
   * state.competingOfferDetail.proofRequestedAtTurn. */
  | { kind: "fake-leverage-challenge"; competingCompany: string | null }
  /* PDF#29 Bug 7 (2026-05-18) — acknowledge-and-recover. Fires when
   * state.lastUserFrustrated is true (candidate said "I already told
   * you", "you keep asking", "we covered this"). Highest-priority lever
   * so the bot acknowledges + breaks the loop instead of doubling down
   * on the same topic. Not probe-producing in the satisfiesTopic sense
   * but carries one so the askedTopics ledger records the recovery. */
  | { kind: "acknowledge-and-recover"; satisfiesTopic: SatisfiesTopic };

/** AR1 / Audit Pass 4 — set of NextAction kinds that probe (i.e. carry
 *  the required `satisfiesTopic` field). Used by the ship-site to gate
 *  the push onto state.askedTopics. */
export const PROBE_PRODUCING_KINDS: ReadonlySet<NextAction["kind"]> = new Set<NextAction["kind"]>([
  "reactive-followup",
  "credibility-probe",
  "probe-mismatch",
  "band-disclosure-deflect",
  "discovery-probe",
  "open-with-offer",
  "probe-expectations",
  "probe-justification",
  "counter-offer",
  "close-recap-formal",
  "lever-grade-upgrade",
  "lever-retention-bonus",
  "lever-rsu-refresh",
  "lever-relocation",
  "lever-perf-bonus-cadence",
  "lever-joining-bonus-explained",
  "band-anchor-with-rationale",
  "internal-equity-defense",
  "comparative-anchoring",
  "component-probe",
  "anchor-with-offer",
  /* PDF#29 Bug 7 (2026-05-18) — recovery turn is recorded in the
   * askedTopics ledger so analyzer / coverage downstream can detect
   * that the planner actually responded to the frustration signal. */
  "acknowledge-and-recover",
]);

/** Internal carrier: the planner builds the move alongside the action so
 *  actionToLever is bit-identical to the prior pickAiMoveCore. The
 *  `_move` field is private — consumers should treat NextAction as the
 *  discriminator. Use actionToLever to recover the AiMove. */
type PlannedAction = NextAction & { _move: AiMove };

/** Single declarative source of truth for "what should the bot do next?".
 *  Pure. Order of returns is the priority cascade — first match wins.
 *
 *  AR3 / Audit Pass 4 (PDF#27, 2026-05-17) — the per-phase maxTurns cap
 *  is enforced upstream of the planner inside derivePhase. When the
 *  current phase has overstayed its budget, derivePhase rewrites
 *  state.phase to the next-group entry (discovery → range-disclosure /
 *  stalemate; anchoring → counter-offer; counter → stalemate). That
 *  means planNextAction sees the already-advanced phase and emits the
 *  natural next-group action through the existing cascade — no override
 *  needed at this layer. */
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
  /* PDF#27 Fix 2 (2026-05-17) — repetition-complaint force-advance.
   * When the candidate explicitly complains the bot is repeating, mark
   * the most-recent-asked topic as skipped so the next probe routes
   * elsewhere. Sticky for one turn — the complaint applies to the
   * topic that triggered it, not to all topics for the session. */
  if (
    state.repetitionComplaintAtTurn != null &&
    state.repetitionComplaintAtTurn >= state.turnIndex - 1 &&
    topics.length > 0
  ) {
    const lastAsked = topics[topics.length - 1].topic;
    recentlyAsked[lastAsked] = true;
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn(
        `[planner] repetition-complaint at turn ${state.repetitionComplaintAtTurn}; ` +
          `force-advancing past last-asked topic "${lastAsked}" on turn ${state.turnIndex}.`,
      );
    }
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
 *  topic key).
 *
 *  FL4 / Audit Pass 4 (PDF#27, 2026-05-17) — hard precondition:
 *  state.candidateCurrentCtc MUST be non-null. Without the total
 *  in hand, asking for the base split presupposes a number the
 *  candidate hasn't disclosed. The outer planner gate already
 *  enforces this; the local guard makes the invariant local to
 *  nextComponentProbe so any future caller (or a regression that
 *  moves the gate) still cannot fire component-probe on YOE signal
 *  alone. Pure. */
function nextComponentProbe(
  state: NegotiationState,
): { component: "base" | "variable" | "esop"; topic: DiscoveryTopic } | null {
  /* FL4 root precondition — currentCtc must be in hand. */
  if (state.candidateCurrentCtc == null) return null;
  const bd = state.candidateComponentBreakdown;
  const asked = new Set((state.askedTopics ?? []).map((t) => t.topic));
  /* PDF#31 BUG A (2026-05-18) — esop component is "populated" when the
   * candidate has explicitly stated NO equity (equityExists === false).
   * Otherwise the bot re-asks "ESOPs in play?" after the candidate
   * already said no — exactly the Meesho/Prita repro. */
  const esopNegated = state.equityVesting?.equityExists === false;
  const order: { component: "base" | "variable" | "esop"; topic: DiscoveryTopic; populated: boolean }[] = [
    { component: "base", topic: "currentCtcBase", populated: bd?.base != null },
    { component: "variable", topic: "currentCtcVariable", populated: bd?.variable != null },
    { component: "esop", topic: "currentCtcEsop", populated: bd?.equity != null || esopNegated },
  ];
  for (const o of order) {
    if (o.populated) continue;
    if (asked.has(o.topic)) continue;
    return { component: o.component, topic: o.topic };
  }
  return null;
}

/** FL5 / Audit Pass 4 (PDF#27, 2026-05-17) — uncertainty escape hatch.
 *
 * Called when the planner is about to fire a discovery-probe for
 * `pendingItem`. If the candidate's PRIOR turn was uncertain
 * (state.lastAnswerUncertainAt === state.turnIndex - 1) AND the most-
 * recently-asked topic matches the item we're about to re-ask, the
 * planner picks deterministically between:
 *
 *   - `advance:true` — skip this item on this turn and let the cascade
 *     move on. The caller re-runs getNextOrderedDiscoveryItem with the
 *     stuck topic injected into the skip record.
 *
 *   - `rangeAsk:"<prose>"` — keep the item but swap the canonical
 *     question for a range-shaped one ("rough range — under 30, 30-40,
 *     40+ LPA?") so the candidate can answer without precision.
 *
 * Deterministic by state.turnIndex % 2 — keeps test surfaces stable;
 * the same session always sees the same cadence.
 *
 * Returns `{advance:false, rangeAsk:null}` when uncertainty doesn't
 * apply — caller should ship the default ordered ask. Pure. */
function applyUncertaintyEscapeHatch(
  state: NegotiationState,
  pendingItem: DiscoveryTopic,
  _defaultAsk: string,
): { advance: boolean; rangeAsk: string | null } {
  const NO_OP = { advance: false, rangeAsk: null } as const;
  const uncertainAt = state.lastAnswerUncertainAt ?? null;
  if (uncertainAt == null) return NO_OP;
  /* PDF#27 FL5 off-by-one fix (2026-05-17) — recency window covers
   * BOTH the same-turn case (planner runs inside applyCandidateAnswer
   * before the next applyAiMove increments turnIndex, so
   * lastAnswerUncertainAt === state.turnIndex) AND the next-turn case
   * (lastAnswerUncertainAt === state.turnIndex - 1, the historical
   * shape this function assumed). Without the same-turn allowance the
   * escape hatch never fired in the kernel-driven test harness — the
   * uncertain candidate utterance and the planner read state at
   * identical turnIndex values. */
  if (uncertainAt !== state.turnIndex && uncertainAt !== state.turnIndex - 1) return NO_OP;
  /* The escape hatch is only triggered when we're about to re-ASK
   * the same topic that triggered the uncertain reply. Looking at
   * state.askedTopics tail tells us the topic the candidate was
   * hedging about — if the cascade has already moved on to a fresh
   * topic, no escape hatch is needed. */
  const tail = (state.askedTopics ?? []).slice(-1)[0]?.topic ?? null;
  if (tail == null) return NO_OP;
  /* Strip the *Answered/*Disclosed suffix so the comparison normalises
   * across the asked-topic ledger and the planner's checklist keys. */
  const tailRoot = (tail as string).replace(/(?:Answered|Disclosed|Asked)$/, "");
  const pendingRoot = (pendingItem as string).replace(/(?:Answered|Disclosed|Asked)$/, "");
  if (tailRoot !== pendingRoot) return NO_OP;
  const advance = state.turnIndex % 2 === 1;
  if (advance) return { advance: true, rangeAsk: null };
  /* Range-ask: pick a topic-appropriate range template. The default
   * is a CTC-shaped range — covers currentCtc / target / expected
   * which are the topics where range framing is sensible. */
  const rangeAsk = buildUncertaintyRangeAsk(pendingRoot);
  return { advance: false, rangeAsk };
}

function buildUncertaintyRangeAsk(itemRoot: string): string {
  if (/^currentCtc/i.test(itemRoot)) {
    return "Rough range is fine — under 15, 15-25, 25-40, or 40+ LPA?";
  }
  if (/^(?:expectedCtc|target)/i.test(itemRoot)) {
    return "Rough range works too — under 20, 20-30, 30-45, or 45+ LPA?";
  }
  if (/^noticePeriod/i.test(itemRoot)) {
    return "Rough range is fine — under 30 days, 30-60, 60-90, or 90+?";
  }
  /* Fallback for any other discovery topic — just acknowledge the
   * uncertainty and reframe as approximate. */
  return "Rough range or ballpark is fine — no need for an exact number.";
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
   * (this is a meta / repair move, not a comp lever). */
  if (state.lastUserFrustrated === true) {
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
  if (
    !isTerminalPhase(state.phase) &&
    state.band.hasEquity &&
    /* PDF#31 BUG B (2026-05-18) — never narrate vesting/cliff when the
     * candidate has explicitly stated no equity in the package. The
     * narration assumes equity exists; firing it on a cash-only package
     * produces the "hallucinated ESOP vesting" failure mode (Meesho
     * Sr PD repro). */
    state.equityVesting?.equityExists !== false
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
            ask: "On the equity piece — let me walk you through how the vesting and cliff are structured for this grade.",
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

  /* PDF#18 — range-disclosure phase override.
   *
   * Phase 2 Indian-HR redesign (2026-05-17): the lever is now
   * `band-disclosure-deflect` — real Indian HR recruiters do NOT disclose
   * internal bands; they deflect and offer to take the candidate's
   * expectation back to the panel. The PHASE name is retained as a state-
   * machine marker; only the rendered lever / prose changed. */
  if (state.phase === "range-disclosure" && !isTerminalPhase(state.phase)) {
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
   * Gating:
   *   - PRE_ANCHOR_PHASES only (counter / closing-push are past).
   *   - Recency: offerAskedAtTurn >= turnIndex - 1 (window of one
   *     planner call from the candidate ask).
   *   - Band complete (lo < hi, both numeric).
   *   - Single-fire via askedTopics ledger inspection. */
  const bandAnchorAlreadyFired = (state.askedTopics ?? []).some(
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
      return {
        kind: "anchor-with-offer",
        initialOffer: anchored,
        bandIncomplete: false,
        satisfiesTopic: "band-anchor-with-rationale",
        _move: {
          lever: "probe",
          newTotalLpa: null,
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
    state.candidateTarget == null
  ) {
    if (isSeniorCompProfile(state)) {
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
    const seniorComponentsRemain =
      isSeniorCompProfile(state) && nextComponentProbe(state) != null;
    /* Single-fire marker. The kernel's applyAiMove pushes the askedTopic
     * onto state.askedTopics; subsequent planner calls see the entry
     * and skip the lever. Test fixtures simulate this by injecting an
     * askedTopics entry (since the kernel mutation lives downstream of
     * planNextAction in the pipeline). */
    const bandAnchorFired = (state.askedTopics ?? []).some(
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
        return {
          kind: "anchor-with-offer",
          initialOffer: anchored,
          bandIncomplete: false,
          satisfiesTopic: "band-anchor-with-rationale",
          _move: {
            lever: "probe",
            newTotalLpa: null,
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
       * the panel-signoff defer + fitment invitation. */
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
              /* F7 — carry the item key so applyAiMove can push it
               * onto askedTopics for the repetition guard. */
              askedTopic: orderedItem,
            },
          };
        }
        const next = getNextDiscoveryQuestion(
          state.discoveryChecklist,
          roleFamily,
          /* PDF#27 Fix 3 (2026-05-17) — propagate the same skipRecord
           * the ordered cascade used; the legacy fallback was the route
           * by which the 3-strike consecutive-topic cap got bypassed. */
          skipRecord ?? undefined,
        );
        if (next != null) {
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
      satisfiesTopic: state.turnIndex === 0 ? "currentCtcAnswered" : "open-with-offer",
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
        isDiscoveryComplete(
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
      satisfiesTopic: "probe-justification",
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
    const hasUnsubstantiatedOffer =
      state.competingOffer != null &&
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
            `(₹${state.competingOffer}L${competingCompany ? `, ${competingCompany}` : ""}) ` +
            `but provided no proof; counterRound=${state.counterRound}. ` +
            `Softly request offer letter / redacted version to corroborate ` +
            `before further concessions.`,
        },
      };
    }

    /* 2. anchor-defense-hike-strong — fires when candidate complains
     * the offer represents only a small % hike on their current CTC.
     * Compute hikePct from max(highestOfferMade, band.initialOffer) and
     * candidateCurrentCtc; payload echoes both numbers so the canonical
     * prose has the exact rebuttal context. */
    const complained = state.candidateStance?.complainedAboutHikePercent ?? false;
    if (
      state.hikeStrongDefenseFiredAtTurn == null &&
      state.phase === "counter-offer" &&
      complained &&
      state.candidateCurrentCtc != null &&
      state.candidateCurrentCtc > 0
    ) {
      const offer =
        state.highestOfferMade > 0 ? state.highestOfferMade : state.band.initialOffer;
      const hikePct = Math.round(((offer - state.candidateCurrentCtc) / state.candidateCurrentCtc) * 100);
      return {
        kind: "anchor-defense-hike-strong",
        hikePct,
        currentCtc: state.candidateCurrentCtc,
        offer,
        _move: {
          lever: "hold-firm",
          newTotalLpa: state.highestOfferMade,
          actionKind: "anchor-defense-hike-strong",
          rationale:
            `Anchor-defense (hike-strong): candidate complained about hike %; ` +
            `offer ₹${offer}L on ₹${state.candidateCurrentCtc}L = ${hikePct}% hike (peers see 8-12% on laterals).`,
        },
      };
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
          const quartile: "top" | "median" =
            state.candidateTarget >= peerBandMedian ? "top" : "median";
          return {
            kind: "comparative-anchoring",
            quartile,
            satisfiesTopic: "comparative-anchoring",
            _move: {
              lever: "hold-firm",
              newTotalLpa: state.highestOfferMade,
              rationale: `Comparative-anchoring: candidate target ₹${state.candidateTarget}L vs band-median ₹${peerBandMedian.toFixed(1)}L (quartile=${quartile}).`,
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
    const SPIRAL_MULTIPLIERS = [0.30, 0.20, 0.10];
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
      satisfiesTopic: "counter-base",
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
/** PDF#30 R5 (2026-05-18, Meesho/Prita T12) — disclosed-CTC anchor floor.
 *
 *  Real recruiters never anchor BELOW a candidate's already-disclosed
 *  current CTC; doing so signals an immediate lowball and burns trust.
 *  But the planner emits `anchor-with-offer` at the band FLOOR (`lo`)
 *  by design — and when band.initialOffer < candidateCurrentCtc, the
 *  point-offer goes out below the disclosed package.
 *
 *  PDF#30 evidence: Prita disclosed 24 LPA, band.initialOffer was 23,
 *  the anchor went out at ₹23L — below her current CTC. Recoverable
 *  only via R1 (which lifts parser accuracy so candidateCurrentCtc is
 *  populated) PLUS this floor (which honours the disclosure).
 *
 *  Policy: clamp the anchor to max(lo, candidateCurrentCtc * (1 + MIN_HIKE_PCT)).
 *  If that pushes us above `hi`, cap at `hi` — the band is structurally
 *  too tight for this candidate but we still hold the maxStretch ceiling.
 *  When candidateCurrentCtc is null, return `lo` unchanged.
 *
 *  PDF#31 BUG C fix (2026-05-18, Meesho/Prita): the previous version
 *  only lifted the anchor TO currentCtc, not ABOVE — anchoring at the
 *  candidate's current package is functionally a zero-hike offer and
 *  reads as a lowball. Real Indian-market hike norms for a Sr PD switch
 *  are 20–30 %; we anchor at MIN 15 % to leave headroom for the
 *  counter-base bargaining round to land in the 20–30 % zone. The floor
 *  is conservative; the planner's negotiation loop pushes higher on
 *  candidate counter. */
const MIN_HIKE_PCT_FOR_ANCHOR = 0.15;

/** PDF#31 BUG D fix (2026-05-18, Meesho/Prita T18) — minimum number of
 *  counter-base rounds that must have happened before a hold-firm action
 *  can fire from a non-acceptance, non-rescission emission site. Real
 *  Indian-HR bargaining patterns require at least two counter-rounds
 *  before "we'll hold the fitment" reads as honest negotiation rather
 *  than a stonewall. Verbal-accept hold-firm and the counter-spiral-
 *  exhausted hold-firm (round >= 3) bypass this — those are structurally
 *  later in the flow and the candidate has already consumed the offered
 *  concessions. */
export const MIN_COUNTER_ROUNDS_BEFORE_HOLD_FIRM = 2;

function clampAnchorAboveDisclosed(
  lo: number,
  hi: number,
  state: NegotiationState,
): number {
  const disclosed = state.candidateCurrentCtc;
  if (typeof disclosed !== "number" || disclosed <= 0) return lo;
  /* Floor = disclosed * (1 + hike) — anchor must beat current CTC by a
   * real margin, not merely match it. */
  const hikeFloor = disclosed * (1 + MIN_HIKE_PCT_FOR_ANCHOR);
  /* Round to 1 decimal so anchor doesn't ship with messy fractions. */
  const hikeFloorRounded = Math.round(hikeFloor * 10) / 10;
  const candidate = Math.max(lo, hikeFloorRounded);
  if (candidate <= lo) return lo;
  /* Cap by maxStretch — won't blow through the band ceiling even if the
   * candidate's current CTC is structurally above it. */
  return Math.min(hi, candidate);
}

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
  return { kind, satisfiesTopic: kind, _move: move } as PlannedAction;
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
  /* PDF#31 BUG D fix (2026-05-18) — tail-of-explore hold-firm is only
   * legitimate after MIN_COUNTER_ROUNDS_BEFORE_HOLD_FIRM. Before that,
   * even if all soft levers happen to have been used, the conversation
   * hasn't earned a "hold firm and invite decision" close — re-fall back
   * to benefits-summary (the least committal exploratory lever) so the
   * negotiation continues. */
  if (state.counterRound < MIN_COUNTER_ROUNDS_BEFORE_HOLD_FIRM) {
    return {
      lever: "benefits-summary",
      newTotalLpa: state.highestOfferMade,
      rationale:
        `Levers exhausted but counterRound=${state.counterRound} < min=${MIN_COUNTER_ROUNDS_BEFORE_HOLD_FIRM}; ` +
        "re-summarise benefits instead of declaring hold-firm.",
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
    /* ArchRec 2 (2026-05-16) — was `answer-direct@${turnIndex}`. The
     * per-turn suffix made hasFired() always pass (every turn produced
     * a fresh string), so the "single-fire" intent was actually dead.
     * Use the canonical literal topic; dedup against
     * reactiveFollowupsFired works as documented now that the key
     * matches across turns. */
    if (!hasFired("answer-direct") && !offerAskedThisTurn) {
      /* BUG E fix (PDF#31, 2026-05-18) — `ask` MUST be candidate-facing
       * prose, never an internal directive. Previously this field carried
       * "Answer the candidate's question first; checklist advance pauses
       * until the question is addressed.", which the canonical-prose
       * answer-direct branch shipped verbatim to the candidate, producing
       * the system-prompt leak in PDF#31 T18. The actual question is
       * answered by generateAnswerToCandidate via the LLM factPack path;
       * the canonical here is only a fallback tail. Keep it as safe,
       * neutral candidate prose. */
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
        satisfiesTopic: "variable-comfort",
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
        ask:
          `${days} days is a long runway — would your current employer entertain a buyout, ` +
          "or are you locked in?",
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
        satisfiesTopic: "hike-justification",
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
    satisfiesTopic: "close-recap-formal",
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
