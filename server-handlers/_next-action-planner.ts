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
  canDiscloseSpecificNumber,
  clampAnchorAgainstCandidateAsk,
  effectiveAnchorLpa,
  statedTotalTargetCtcLpa,
  effectiveTargetCtcLpa,
  totalScopedCounter,
  type NegotiationState,
  type NegotiationPhase,
  type AiMove,
  type NegotiationLever,
  type DiscoveryTopic,
  type ContradictionTopic,
} from "./_negotiation-kernel";
import { askedTopicEntries, getFactOr } from "./_conversation-ledger";
import type { NegotiationRoundPersona } from "./_negotiation-rounds";
import { registerNextActionPlanner } from "./_planner-registry";
import { classifyRoleFamily, getCompanyHikeCap } from "./_company-band-tiers";
import {
  getNextOrderedDiscoveryItem,
  getNextOrderedDiscoveryQuestion,
  isDiscoveryComplete,
  isDiscoverySufficientToAnchor,
} from "./_discovery-stage";
import { recommendWalkAway } from "./_recruiter-critique";
import { estimateCounterOfferRisk } from "./_counter-offer-risk";
import {
  getHikeJustificationProbe,
  HIKE_JUSTIFICATION_THRESHOLD,
  shouldProbeHikeJustification,
} from "./_hike-justification-probe";
import { sessionJitter } from "./_session-jitter";
import {
  humanizeRecruiterProse,
  applyFallibilityOverlay,
  applyPersonaTicSignature,
  applyContextRefOverlay,
  tidyRealismArtifacts,
} from "./_recruiter-prose-realism";
import { timeContextToMoodDelta } from "./_recruiter-time-context";
import { getCandidateFirstName } from "./_candidate-name";
import { analyzeEquityClarity } from "./_trial-close-detector";
import { marketDataSources } from "./_candidate-profile";
import { resumeConfirmsCompany } from "./_resume-fact-pack";
import { hasConcreteTell } from "./_competing-offer-detail";
import { getRecruiterSectorPersona } from "./_indian-recruiter-personas";
import type { RecruiterSectorPersona } from "./_indian-recruiter-personas";
/* PDF#51 (2026-05-28) — unified candidate-question router. Replaces
 * the planner's two inline regex tests (DIRECT_ANCHOR_ASK_RE @ ~1228,
 * BREAKDOWN_REQUEST_RE @ ~4313) AND wires a deterministic-prose path
 * for the 14 curated topics that pre-2026-05-28 always went through
 * the LLM-factPack reactive-followup branch. See `_question-router.ts`
 * for the design log. */
import {
  routeCandidateQuestion,
  latestCandidateText,
  isSalaryPush,
  BREAKDOWN_ASK_RE,
  type QuestionRoute,
} from "./_question-router";
import {
  renderCandidateQuestionResponse,
  type CandidateQuestionTopic,
} from "./_candidate-question";

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
  /* PDF#44 follow-up (2026-05-25) — closing line was "let me walk you
   * through how we're framing the fitment", which is the same teaser
   * dodge class fixed in info-disclosure.ts: a promise the next turn
   * never delivers. Replace with a concrete question that advances the
   * negotiation — which level/grade are they benchmarking against — so
   * the candidate's answer either narrows the comparison or lets the
   * planner pivot to band-anchor on the next turn. */
  return (
    `Right — ${joined} numbers are useful as a floor, but they aggregate ` +
    `across grades and don't always reflect the level rubric. For your ` +
    `level specifically, our internal band sits on a different basis — ` +
    `which level or comparable role were you benchmarking against on ${joined}?`
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

/* PR-3 (PDF #28) — single read path for the askedTopics ledger.
 *
 * All planner dedup logic now flows through this helper. When the
 * conversation ledger is present (new sessions post-PR-1), entries
 * are sourced from it; PR-2's dual-write guarantees the ledger
 * contains the same (topic, atTurn) pairs the legacy askedTopics
 * array does, so behavior is identical. For pre-PR-1 serialized
 * sessions still in flight, falls back to state.askedTopics. This
 * is the chokepoint PR-6 will lock down once the array is retired.
 *
 * Pure read — no mutation of either source. */
function readAskedTopics(
  state: NegotiationState,
): ReadonlyArray<{ topic: DiscoveryTopic; atTurn: number }> {
  /* Prefer the ledger only when its asked-topic entries are a superset
   * of state.askedTopics by count. Until PR-6 locks down direct array
   * writes, both fixtures and serialized in-flight sessions can carry
   * entries the ledger never saw (the dual-write only fires inside
   * applyAiMove). Length comparison keeps every legacy code path safe:
   *   - ledger.size ≥ array.size  → dual-write has caught up;
   *     ledger contains every entry the array does. Read ledger.
   *   - ledger.size  <  array.size → array carries entries the ledger
   *     hasn't seen (fixture-injected, deserialized pre-PR-1 session,
   *     etc.). Fall back to the array so behavior is preserved. */
  const arr = state.askedTopics ?? [];
  if (state.ledger) {
    const fromLedger = askedTopicEntries(state.ledger);
    if (fromLedger.length >= arr.length) return fromLedger;
  }
  return arr;
}

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
  /* PDF#34 Fix 3 (2026-05-18) — clarification response.
   *
   * Fires when state.lastAnswerClarificationAtTurn === turnIndex - 1
   * (the candidate's most recent turn was a comprehension question
   * about a term the bot just used). The canonical-prose surface
   * looks up the term in the glossary, emits the definition inline,
   * and re-asks the prior question in plain English. `priorAiText`
   * is the bot's last utterance so the prose layer can identify
   * which jargon term needs defining. */
  | { kind: "clarify-prior-question"; priorAiText: string; satisfiesTopic: SatisfiesTopic }
  /* Commit 4 (2026-05-15) — reactive follow-up emitted when the
   * candidate's CURRENT TURN disclosure created a higher-leverage
   * probe target than the next checklist item. Priority-gated above
   * probe-mismatch and discovery-probe so the bot reacts to what the
   * candidate just said before sequencing through the ordered checklist.
   * The topic is recorded in state.reactiveFollowupsFired via the
   * move.askedTopic plumbing so the same probe doesn't re-fire. */
  | { kind: "reactive-followup"; ask: string; trigger: string; topic: DiscoveryTopic; satisfiesTopic: SatisfiesTopic }
  /* PDF#51 (2026-05-28) — deterministic answer-direct.
   *
   * Fires when `routeCandidateQuestion` resolves the candidate's last
   * utterance to one of the 14 curated topics in `_candidate-question.ts`
   * AND `renderCandidateQuestionResponse` returns curated prose (the
   * response bank has an entry for the topic + active persona).
   *
   * Pre-2026-05-28, that prose existed in the response bank but the
   * planner had no way to ship it: every direct-answer turn routed
   * through the legacy `reactive-followup` with `topic: "answer-direct"`,
   * which delegated to the LLM-factPack path. The LLM had access to
   * the same context but routinely hallucinated numbers and topics
   * the kernel never authorised. This kind carries the curated prose
   * inline so negotiate-turn.ts can short-circuit the LLM entirely —
   * mirrors the terminal-intent / adversarial / STT-garble bypasses
   * that already existed.
   *
   * `topic` is preserved so telemetry can attribute deterministic
   * answers per topic. `prose` is the resolved candidate-facing text
   * (persona resolution already happened in `renderCandidateQuestionResponse`). */
  | {
      kind: "answer-direct";
      topic: CandidateQuestionTopic;
      prose: string;
      satisfiesTopic: SatisfiesTopic;
    }
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
      /* PDF#46 B6 (2026-05-25) — component-aware counter engagement.
       * When the candidate's counter is framed at the component level
       * ("46L total, 44L base, 2L JB"), surface their stated base on
       * the action so canonical prose can acknowledge the gap against
       * our fixed component, rather than responding to the bare
       * total. Optional — absent when the counter is total-only. */
      candidateProposedBaseLpa?: number;
      satisfiesTopic: SatisfiesTopic;
    }
  /* lever-explore rotates a CONCRETE non-cash lever each round
   * (equity → joining-bonus → notice-buyout → benefits → hold-firm via
   * pickLeverExploreMove). Surface that lever (and the kernel-sized
   * joining-bonus amount) on the action so canonical prose can NAME it
   * instead of shipping the same generic "let me see what else we can
   * structure on the fitment" teaser every round — the live-staging
   * 2026-06-19 teaser-loop defect (candidate heard the identical line
   * twice while we silently picked equity, then a joining bonus, and
   * communicated neither). leverKind absent ⇒ legacy/test callsites,
   * which keep the generic line. */
  | {
      kind: "lever-explore";
      from: "hard-band-cap" | "no-headroom" | "constraint-violation" | "default";
      leverKind?: NegotiationLever;
      joiningBonusLpa?: number;
    }
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
      /* PDF#45 B2 (2026-05-26) — recap-hallucination fix. These four
       * structural-fitment fields are now OPTIONAL. The recap previously
       * fabricated default values for notice / BGV-trigger / OL-ETA even
       * when none of those topics had been discussed (transcript T11
       * regression: "joining bonus ₹1.3L with 12-month clawback, notice
       * 9 weeks, BGV starts post-acceptance, offer letter in 2-3 business
       * days" — none of which the candidate ever raised). The recap now
       * only renders fields whose corresponding state has been populated
       * by an actual discovery turn. */
      noticePeriodWeeks?: number;
      proposedJoiningDate?: string;
      bgvStartTrigger?: string;
      offerLetterEta?: string;
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
  /* Gaps #1 / #6 (2026-06-18) — non-cash structural levers a real
   * Indian HR commits ON THE SPOT and writes into the offer letter:
   * work-mode (hybrid/WFH days) and growth-path (defined promotion
   * timeline + scope + mentoring). Previously work-mode lived only as a
   * discovery "note to self" and growth-path had no closing lever, so
   * the bot could neither trade them nor close on them. */
  | { kind: "lever-work-mode"; satisfiesTopic: SatisfiesTopic }
  | { kind: "lever-growth-path"; satisfiesTopic: SatisfiesTopic }
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
  /* Audit fix 2026-05-21 — CTC-inflation anchor. Recruiter quotes a
   * headline total package and breaks it into fixed/variable/ESOP-
   * paper/JB/benefits, teaching the candidate to always ask for the
   * in-hand breakdown. The numbers reflect a real Indian-market mix
   * (60/18/12/5/5 approx) computed by `buildCtcInflationBreakdown`. */
  | {
      kind: "ctc-inflation-anchor";
      ctcLpa: number;
      fixedLpa: number;
      variableLpa: number;
      esopPaperLpa: number;
      joiningBonusLpa: number;
      benefitsLpa: number;
    }
  /* Audit fix 2026-05-21 — truthful breakdown follow-up. Fires when the
   * candidate asks for the in-hand breakdown AFTER a ctc-inflation-
   * anchor has been used. Uses the SAME underlying numbers — the lie
   * was the framing, not the values. */
  | {
      kind: "ctc-inflation-truth";
      ctcLpa: number;
      fixedLpa: number;
      variableLpa: number;
      esopPaperLpa: number;
      joiningBonusLpa: number;
      benefitsLpa: number;
    }
  /* Straight-fitment offer breakdown (2026-06-19). Fires when the
   * candidate asks for the offer split AND no CTC-inflation anchor was
   * ever weaponised this session. Distinct from `ctc-inflation-truth`:
   * the inflation model carves ESOP-paper / benefits OUT of the headline
   * (in-hand is only ~60% of the quoted package — correct ONLY when the
   * recruiter padded an inflated anchor). A straight fitment was never
   * padded, so its breakdown must use the SAME fixed/variable
   * decomposition the close-recap will quote (fixed = min(total,
   * baseStretch), variable = remainder), with any joining bonus quoted
   * ON TOP. Routing a straight offer through the inflation model produced
   * a turn-8 "guaranteed cash ₹19.9L" that contradicted the turn-9
   * close-recap "Fixed ₹28.2L" for the same ₹33.2L offer (live staging). */
  | {
      kind: "offer-breakdown";
      totalLpa: number;
      fixedLpa: number;
      variableLpa: number;
      joiningBonusLpa?: number;
      satisfiesTopic: SatisfiesTopic;
    }
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
  /* PDF#42 BUG-A (2026-05-21) — competitor-match. Fires when the
   * candidate has substantiated a competing offer (proofProvided or
   * letterShareOffered) AND that offer exceeds the current
   * highestOfferMade. The recruiter commits to taking the competing
   * number back to the panel with a defined revert window — an
   * authoritative closing-push register, NOT a candidate-facing
   * "what else can we add?" probe (the live BUG-A surface). Single-
   * fire via state.competitorMatchFiredAtTurn. */
  | {
      kind: "competitor-match";
      competingOffer: number;
      competingCompany: string | null;
    }
  /* PDF#29 Bug 7 (2026-05-18) — acknowledge-and-recover. Fires when
   * state.lastUserFrustrated is true (candidate said "I already told
   * you", "you keep asking", "we covered this"). Highest-priority lever
   * so the bot acknowledges + breaks the loop instead of doubling down
   * on the same topic. Not probe-producing in the satisfiesTopic sense
   * but carries one so the askedTopics ledger records the recovery. */
  | { kind: "acknowledge-and-recover"; satisfiesTopic: SatisfiesTopic }
  /* Memory feature (2026-05-29) — contradiction-callout. Fires when the
   * candidate's CURRENT turn restated a previously-recorded claim with a
   * different value (numeric drift outside ±10% on CTC / expected /
   * notice, or a competing-offer amount drift while the company name
   * matches). The kernel's applyCandidateAnswer stamps the signal on
   * state.lastContradiction; the planner consumes it and surfaces the
   * gap in canonical-prose. Priority slot: above stall / discovery /
   * counter branches, below frustration recovery and live-walk-away
   * (crisis levers). Not probe-producing. */
  | {
      kind: "contradiction-callout";
      topic: ContradictionTopic;
      oldValue: number | string;
      newValue: number | string;
      firstSeenTurn: number;
      oldLabel?: string;
      newLabel?: string;
    }
  /* PDF#35 Move 1 (2026-05-18) — offer-recap. Post-anchor branch that
   * fires when the candidate has asked to hear the offer again /
   * summarise / restate the CTC. Distinct from `info-disclosure` (which
   * answers component-breakdown asks) and from `anchor-with-offer`
   * (the first-time anchor): this is the candidate explicitly asking
   * to be REMINDED of the standing offer after it's already been put
   * on the table. The prose layer recaps highestOfferMade with the
   * fixed/variable split when available. Not probe-producing. */
  | { kind: "offer-recap"; offerLpa: number }
  /* Phase 5 Session A (2026-05-19) — multi-round persona handoff.
   * Fires the single turn the kernel transitions between round personas
   * (HR Partner → Hiring Manager → Director). The planner detects the
   * fresh entry on `state.roundTransitions` (atTurn === turnIndex) and
   * pre-empts every other branch so the handoff prose runs that turn.
   *
   * Code-quality audit cleanup (2026-05-19): this variant carries NO
   * `satisfiesTopic` field — it's not a discovery probe, doesn't push
   * onto askedTopics, and the only `satisfiesTopic` consumer
   * (_move-tag.ts `case "discovery-probe"`) is kind-narrowed so the
   * field's absence is sound. `PROBE_PRODUCING_KINDS` deliberately
   * excludes "round-transition", which is the single source of truth
   * for "does this kind feed the askedTopics ledger?". */
  | {
      kind: "round-transition";
      from: NegotiationRoundPersona;
      to: NegotiationRoundPersona;
    }
  /* Realism-Audit Fix 3 (2026-05-22) — manager-consult stall.
   *
   * Real Indian recruiters' #1 leverage tactic is the multi-turn stall:
   * "let me check with my manager and revert by tomorrow." The
   * simulator now genuinely models this: when fired, the kernel sets
   * `stallTurnsRemaining` so the next AI turn ships a deterministic
   * stall-return outcome ("checked — we can move ₹X on joining
   * bonus only" / "checked — band stays") that reuses the stalled-ask
   * context (`lastStallContext`).
   *
   * `mode`:
   *   - "open" — the first turn the stall fires (no outcome yet)
   *   - "return-move"  — return turn that ships a small concession
   *   - "return-hold"  — return turn that holds the band firm
   *
   * Pre-conditions enforced in the planner gate:
   *   1. NOT the first AI turn (recruiter must have heard the ask).
   *   2. Candidate just dropped an ask above `band.maxStretch`.
   *   3. Persona's `stallProbability` ≥ stallGateThreshold OR
   *      `recruiterSectorPersona` ∈ {psu, consulting-big4}.
   *   4. `stallsFiredCount` < 3 in this session.
   *   5. No stall is already in-flight (`stallTurnsRemaining === 0`).
   *
   * NOT a probe — does not feed the askedTopics ledger (see
   * NON_PROBE_ACTION_KINDS in the kernel). */
  | {
      kind: "manager-consult-stall";
      mode: "open" | "return-move" | "return-hold";
      /** Stalled-ask context: the candidate's number that prompted the
       *  stall, carried verbatim to the return turn so coaching can see
       *  the simulator genuinely tracked the ask. */
      stalledAskLpa: number | null;
      /** On the return turn, the small concession the persona ships
       *  ("checked — we can move ₹2L on joining bonus") OR null when
       *  the return mode is "hold". Always null in "open" mode. */
      returnConcessionLpa: number | null;
    }
  /* Paraphrase-loop feature (2026-05-29) — compress the deal so far back
   * to the candidate as a recap-with-confirmation gate. Fires at most
   * once per session, just before manager-consult-stall or phase
   * transition to close, gated on ≥3 distinct facts disclosed. */
  | {
      kind: "paraphrase-recap";
      facts: Array<{ label: string; value: string }>;
      sectorVariant: "formal" | "casual";
    }
  /* Bad-faith tactic injections (2026-05-29). Each fires at most once
   * per session. Low-priority — only emitted when no normal action
   * preempts. Carries `tactic` for the report layer / detection. */
  | { kind: "exploding-offer-pressure"; tactic: "exploding-offer-pressure"; deadline: "eod" | "friday" | "24h" }
  | { kind: "fake-competing-candidate"; tactic: "fake-competing-candidate"; variant?: number }
  | { kind: "vague-promise"; tactic: "vague-promise"; topic: "wfh" | "joining-bonus" | "title" }
  /* Prior-context feature (2026-05-29) — caller-declared upfront
   * context (existing competing offer or current-employer retention
   * package) shapes the recruiter's opening moves. Acks fire turn 1-2
   * (HIGH priority, ahead of routine cascade); the mid-stage reactions
   * fire when the user pushes back citing the existing context or when
   * a retention package is structurally strong. */
  | { kind: "acknowledge-existing-offer"; company: string; amountLpa: number; signed: boolean; deadline?: string }
  | { kind: "match-existing-offer-prose"; company: string; competingAmountLpa: number; withinBand: boolean }
  | { kind: "acknowledge-retention-offer"; amountLpa: number; tenure: "immediate" | "midYear" | "cycleEnd" }
  | { kind: "retention-trump-warning"; retentionLpa: number; currentCtcLpa: number }
  /* Memory-callback feature (2026-05-29) — real recruiters periodically
   * call back to a fact the candidate stated earlier ("you mentioned X").
   * Surfaces ONE recorded userClaim warmly. Fires at most once per
   * session, after turn 3, sector-flavored (formal vs casual). */
  | {
      kind: "callback-prior-context";
      claim: "currentCtc" | "expectedCtc" | "competingOffer" | "noticePeriod" | "currentRole";
      /** Snapshot of the value being called back to — kept on the action
       *  so the prose arm can render without re-reading state. */
      value: number | string;
      /** Company name only for competingOffer; null for the rest. */
      companyLabel: string | null;
      /** Turn the claim was first seen — informs "earlier" framing. */
      firstSeenTurn: number;
    }
  /* Competing-offer warm acknowledgment (2026-05-29). Separate from
   * competitor-match (which negotiates) — this is pure respectful
   * acknowledgment of the candidate's market value, fired the FIRST
   * turn after a competingOffer claim lands in userClaims. Once per
   * session. */
  | {
      kind: "competing-offer-warm-ack";
      company: string;
      amountLpa: number;
    }
  /* Calibrated-surprise lowball feature (2026-05-29) — real recruiters
   * probe with calibrated surprise when a candidate's anchor lands
   * meaningfully below band floor. Single-fire per session via
   * state.calibratedSurpriseFired; gate on recruiterAffinity ≥ -1
   * (a cooled recruiter quietly accepts the lowball instead of
   * coaching). Numbers are echoed verbatim from the candidate's stated
   * anchor — the band floor is invoked but the precise band is NEVER
   * disclosed. */
  | {
      kind: "calibrated-surprise-lowball";
      tactic: "calibrated-surprise-lowball";
      candidateAnchor: number;
      bandFloor: number;
      gapPct: number;
    }
  /* Calibrated-surprise lowball — Branch A follow-up. Fires the turn
   * AFTER the probe when applyCandidateAnswer classified the reply as
   * a double-down (state.acceptedLowball === true). Quietly accepts the
   * candidate's lowball anchor and moves to packaging — the cynical
   * real-world variant of "they didn't read the signal". */
  | {
      kind: "accept-lowball-quiet";
      candidateAnchor: number;
    }
  /* Proactive-sweetener feature (2026-05-30) — real recruiters offer
   * non-cash sweeteners (signing bonus, relocation, equity refresh,
   * joining flexibility, notice-buyout help) UNPROMPTED when they
   * sense the candidate cooling and they're capped on cash. The #1
   * remaining salary-negotiation realism gap was that the simulator
   * NEVER volunteered anything — recruiters were 100% reactive. This
   * action is verbal-only: prose surfaces the sweetener as a question
   * ("we can look at relocation support, would that help close
   * this?"). No comp lever, no money math, no band mutation. Single-
   * fire per session via state.proactiveSweetenerFired so the
   * recruiter doesn't repeatedly dangle non-cash levers (real social
   * permission is one-shot). `sweetenerKind` is picked off a sector-
   * keyed map so the offer matches what that sector actually has
   * headroom on (BFSI → signing bonus; PSU → joining flexibility;
   * unicorn/edtech/early-startup → equity refresh; GCC / Big4 →
   * relocation; IT-services → notice buyout help; MBB → signing
   * bonus; FMCG → joining flexibility; default → signing bonus). */
  | {
      kind: "proactive-sweetener";
      sweetenerKind:
        | "signing-bonus"
        | "relocation"
        | "equity-refresh"
        | "joining-flexibility"
        | "notice-buyout-help";
    };

/** Bad-faith tactic injection kinds (2026-05-29). These are flavor
 *  injects — the recruiter uses a classic manipulation play (deadline
 *  pressure, fake competing candidate, vague non-binding promise). They
 *  fire at most once per session each, gated by state.tacticsUsed, and
 *  only when no normal priority action preempts. Detecting / naming
 *  them out loud as the candidate is recorded into
 *  state.userCaughtTactics so the report layer can surface it as a
 *  positive coaching signal. */
export type TacticKind =
  | "exploding-offer-pressure"
  | "fake-competing-candidate"
  | "vague-promise";

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
  "lever-work-mode",
  "lever-growth-path",
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
  /* PDF#34 Fix 3 (2026-05-18). */
  "clarify-prior-question",
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
/* Bug-D (2026-06-19, live staging) — recruiter-anchors-once-discovery-
 * sufficient, extracted from the AUDIT-3 Fix A inline bridge (~L3500) so the
 * SAME decision can run at two priority points inside planNextActionInternal:
 *   (1) HOISTED above the reactive-followup / warm-ack / callback-prior-
 *       context / live-walk-away branches — those all sit above the original
 *       L3226 anchor gate and kept winning the turn once current CTC + target
 *       were known, so the planner re-probed forever, NEVER put a number on
 *       the table, and a later candidate acceptance with no standing offer
 *       routed to live-walk-away. A real Indian recruiter, once current+target
 *       are known and nothing is on the table, STATES THE BAND.
 *   (2) the original post-discovery fall-through (kept as a belt-and-braces
 *       second call site).
 * Returns an anchor-with-offer action when the candidate has disclosed current
 * CTC + target, discovery is sufficient, and no offer has been made yet; null
 * otherwise. The equity-clarity and credibility probes remain HIGHER priority
 * than call site (1) — they are legitimate one-shot pre-anchor clarifications. */
function planDiscoverySufficientAnchor(
  state: NegotiationState,
): PlannedAction | null {
  if (
    !(
      state.highestOfferMade === 0 &&
      state.candidateCurrentCtc != null &&
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
    )
  ) {
    return null;
  }
  /* Rhythm gate: a real recruiter acknowledges a FRESH comp disclosure before
   * stating the band — they don't slap a number down in the same breath the
   * candidate names their expectation. So when the candidate disclosed a comp
   * fact THIS very turn (current CTC, target, or split), defer to the natural
   * reactive acknowledgment and let the anchor fire on the NEXT turn. This
   * preserves the "react at T(n), anchor at T(n+1)" cadence the happy-path arc
   * locks, while still breaking Bug D's failure mode — where, turn after turn
   * with nothing new disclosed, reactive-followups kept winning and the anchor
   * never got a turn. lastTurnDelta is the precise per-turn signal (it flags
   * only values that CHANGED this turn — a restatement does not count). */
  const disclosedCompThisTurn =
    state.lastTurnDelta?.disclosedCurrentCtc === true ||
    state.lastTurnDelta?.disclosedExpectedCtc === true ||
    state.lastTurnDelta?.disclosedFixedVariableSplit === true;
  if (disclosedCompThisTurn) {
    return null;
  }
  const lo = state.band.initialOffer;
  const hi = state.band.maxStretch;
  const anchored = clampAnchorAboveDisclosed(lo, hi, state);
  /* AUDIT-W02 BUG-001 — when the band ceiling sits below the candidate's
   * disclosed CTC, stating the band as a range would advertise a pay cut;
   * honest-defer with a point anchor flagged bandIncomplete instead. */
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
    } as PlannedAction;
  }
  /* Pay-cut-range guard (the second half of Bug D). When the candidate already
   * earns at/above the band FLOOR, narrating the band as a range (₹lo–₹hi)
   * would advertise pay-cut numbers (everything from lo up to their current
   * CTC). Worse, a range move carries newTotalLpa:null, so highestOfferMade
   * stays 0 and the deal can never actually CLOSE — the candidate's eventual
   * acceptance, finding no standing offer, routes to live-walk-away. Emit a
   * concrete POINT anchor at the clamped value instead: it sits above their
   * current pay (clampAnchorAboveDisclosed lifts to currentCtc×(1+hike),
   * capped at the ceiling) AND sets highestOfferMade, so the negotiation has a
   * real number to converge on. */
  if (state.candidateCurrentCtc != null && state.candidateCurrentCtc >= lo) {
    return {
      kind: "anchor-with-offer",
      initialOffer: anchored,
      bandIncomplete: false,
      satisfiesTopic: "band-anchor-with-rationale",
      _move: {
        lever: "probe",
        newTotalLpa: anchored,
        rationale:
          `Bug-D discovery-sufficient point-anchor: candidate's current ₹${state.candidateCurrentCtc}L is at/above the band floor ₹${lo}L, so a range would advertise a pay cut and leave no standing offer; ` +
          `anchor a concrete ₹${anchored}L (lifted above current pay, capped at ceiling ₹${hi}L) the candidate can actually close on.`,
        askedTopic: "band-anchor-with-rationale",
        actionKind: "anchor-with-offer",
      },
    } as PlannedAction;
  }
  /* Clean case — the band floor sits above the candidate's current pay; STATE
   * THE BAND as a range (mirrors the probe-expectations bridge below) so the
   * candidate has a reference range to react to and there's room to bargain
   * up. The candidate's counter drives the concrete offer downstream — and an
   * outright acceptance of the stated band (with no concrete counter) is
   * handled by the kernel's accept path, which treats a presented band as an
   * offer-on-table and closes at the band floor (see the `bandPresented` /
   * `band-anchor-with-rationale` accept handling in _negotiation-kernel.ts).
   * Kept as a pure range here (newTotalLpa: null) so stating the band does NOT
   * flip the phase to counter-offer prematurely and reroute the next probe. */
  return {
    kind: "band-anchor-with-rationale",
    satisfiesTopic: "band-anchor-with-rationale",
    _move: {
      lever: "benefits-summary",
      newTotalLpa: null,
      rationale:
        `Bug-D discovery-sufficient anchor: candidate disclosed current ₹${state.candidateCurrentCtc}L + target ₹${state.candidateTarget ?? state.candidateTargetFixed}L${state.candidateTarget == null ? " (fixed)" : ""} and one acknowledgment has fired; ` +
        `state the band (₹${lo}L–₹${hi}L) as a reference range the candidate can react to.`,
      actionKind: "band-anchor-with-rationale",
      askedTopic: "band-anchor-with-rationale",
    },
  } as PlannedAction;
}

export function planNextAction(state: NegotiationState): NextAction {
  return planNextActionInternal(state);
}

/** #93 (2026-06-19, live-staging) — the close number to honor when a
 *  candidate accepts/signals-close AT a concrete figure just above the
 *  standing offer ("36 and I'll sign today"). Sources, in order of
 *  authority: a TOTAL-scoped bound counter, the last bound counter, then
 *  the sticky candidate target (the acceptance/close gates that consult
 *  this only fire when the candidate is closing, so the target is the
 *  number they're signing at, not an aspirational ask). Honored only
 *  when it sits ABOVE the offer, AT/UNDER the band ceiling, and within a
 *  trivial gap (the larger of ₹2L or 6% of the offer) — otherwise the
 *  standing offer stands. Returning a number ABOVE the offer is always
 *  safe: clampToCloseFloor raises, never lowers. */
export function nearOfferCloseNumber(state: NegotiationState): number {
  const offer = state.highestOfferMade;
  if (!(offer > 0)) return offer;
  const cnum =
    totalScopedCounter(state) ??
    state.lastCandidateCounterLpa ??
    state.candidateTarget ??
    null;
  if (cnum == null) return offer;
  const gap = Math.max(2, offer * 0.06);
  if (cnum > offer && cnum <= state.band.maxStretch && cnum - offer <= gap) {
    return cnum;
  }
  return offer;
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
  const topics = readAskedTopics(state);
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
  /* PDF #45 second-pass audit (2026-05-22) — POST-FRUSTRATION-RECOVERY
   * force-advance. After `acknowledge-and-recover` fires, the next
   * planner call re-enters the ordered discovery cascade. If the same
   * topic that triggered the frustration is still un-answered, the
   * cascade re-asks it — which is exactly the loop the recovery was
   * meant to break. Sentinel: if the LAST entry in leversUsed is
   * `acknowledge-and-recover`, mark the most-recently-asked topic as
   * skipped for this turn so the cascade advances to the NEXT item
   * (or exits discovery if everything else is satisfied). */
  const lastLever = state.leversUsed[state.leversUsed.length - 1];
  if (lastLever === "acknowledge-and-recover" && topics.length > 0) {
    const lastAsked = topics[topics.length - 1].topic;
    recentlyAsked[lastAsked] = true;
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn(
        `[planner] post-recovery force-advance: skipping last-asked topic "${lastAsked}" on turn ${state.turnIndex}.`,
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
  const asked = new Set(readAskedTopics(state).map((t) => t.topic));
  /* PDF#31 BUG A (2026-05-18) — esop component is "populated" when the
   * candidate has explicitly stated NO equity (equityExists === false).
   * Otherwise the bot re-asks "ESOPs in play?" after the candidate
   * already said no — exactly the Meesho/Prita repro. */
  const esopNegated = state.equityVesting?.equityExists === false;
  /* PDF#33 Move B1 (2026-05-18) — when `variable` arrived via complement
   * inference (`variableInferred === true`), the candidate never
   * explicitly stated it. Treat as NOT populated so the variable probe
   * fires for confirmation ("Quick check — variable is the remaining
   * ₹X on that ₹Y total?"). The candidate's reply either confirms the
   * derived number, corrects it, or denies any variable at all (which
   * the next parse will overwrite to a non-inferred value or null). */
  const variablePopulated = bd?.variable != null && bd?.variableInferred !== true;
  const order: { component: "base" | "variable" | "esop"; topic: DiscoveryTopic; populated: boolean }[] = [
    { component: "base", topic: "currentCtcBase", populated: bd?.base != null },
    { component: "variable", topic: "currentCtcVariable", populated: variablePopulated },
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
  const tail = readAskedTopics(state).slice(-1)[0]?.topic ?? null;
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

/* Paraphrase-loop feature (2026-05-29) — recap-before-decision gate.
 *
 * Fires at most once per session, just before manager-consult-stall OR
 * before phase transition into close (proxied via state.phase ===
 * "closing-push"). Requires ≥3 distinct disclosed facts in userClaims.
 * Skipped if the last 2 AI turns already contained a recap pattern. */
const PARAPHRASE_MIN_FACTS = 3;
const RECENT_RECAP_RE = /\bso if i|let me recap|to summari[sz]e\b/i;

function _collectParaphraseFacts(
  state: NegotiationState,
): Array<{ label: string; value: string }> {
  const claims = state.userClaims ?? {};
  const facts: Array<{ label: string; value: string; firstSeenTurn: number }> = [];
  if (claims.expectedCtc != null) {
    facts.push({
      label: "base ask",
      value: `₹${claims.expectedCtc.value}L`,
      firstSeenTurn: claims.expectedCtc.firstSeenTurn,
    });
  }
  if (claims.noticePeriod != null) {
    facts.push({
      label: "notice",
      value: `${claims.noticePeriod.value}-day notice`,
      firstSeenTurn: claims.noticePeriod.firstSeenTurn,
    });
  }
  if (claims.currentCtc != null) {
    facts.push({
      label: "current",
      value: `current at ₹${claims.currentCtc.value}L`,
      firstSeenTurn: claims.currentCtc.firstSeenTurn,
    });
  }
  if (claims.competingOffer != null) {
    facts.push({
      label: "competing",
      value: `${claims.competingOffer.value.company} at ₹${claims.competingOffer.value.amount}L`,
      firstSeenTurn: claims.competingOffer.firstSeenTurn,
    });
  }
  if (claims.currentRole != null) {
    facts.push({
      label: "current role",
      value: String(claims.currentRole.value),
      firstSeenTurn: claims.currentRole.firstSeenTurn,
    });
  }
  /* Most-recent first (largest firstSeenTurn). */
  facts.sort((a, b) => b.firstSeenTurn - a.firstSeenTurn);
  return facts.slice(0, 4).map((f) => ({ label: f.label, value: f.value }));
}

function _recentRecapInTranscript(state: NegotiationState): boolean {
  const log = state.conversationLog ?? [];
  let aiSeen = 0;
  for (let i = log.length - 1; i >= 0 && aiSeen < 2; i--) {
    const e = log[i];
    if (e?.speaker !== "ai" || typeof e.text !== "string") continue;
    aiSeen++;
    if (RECENT_RECAP_RE.test(e.text)) return true;
  }
  return false;
}

function _sectorParaphraseVariant(
  persona: RecruiterSectorPersona,
): "formal" | "casual" {
  if (
    persona === "bfsi" ||
    persona === "psu" ||
    persona === "consulting-mbb" ||
    persona === "consulting-big4"
  ) {
    return "formal";
  }
  return "casual";
}

/** Calibrated-surprise lowball feature (2026-05-29) — planner gate.
 *
 *  Real recruiters who hear a candidate anchor meaningfully BELOW band
 *  floor don't silently accept; they probe with calibrated surprise.
 *  This gate fires when:
 *    1. The candidate has disclosed a numeric anchor (userClaims.expectedCtc
 *       OR candidateTarget).
 *    2. That anchor sits at < 0.80 × band floor (band.walkAway). The
 *       20% threshold is the "meaningful undershoot" mark — anything
 *       smaller (5-19%) is just optimistic anchoring and doesn't fire.
 *    3. Single-fire per session (state.calibratedSurpriseFired).
 *    4. Recruiter affinity ≥ -1. Below -1 the recruiter has already
 *       cooled on the candidate and quietly pockets the lowball — the
 *       cynical real-world variant.
 *
 *  Branch-A follow-up (accept-lowball-quiet) ships when applyCandidateAnswer
 *  classified the candidate's reply as a double-down (acceptedLowball
 *  was stamped). That branch ALSO needs to short-circuit before the
 *  routine cascade so the recruiter quietly closes rather than
 *  re-engaging discovery / counter-offer arms. */
const CALIBRATED_SURPRISE_THRESHOLD = 0.80;

function maybePlanCalibratedSurprise(
  state: NegotiationState,
): PlannedAction | null {
  /* Branch A follow-up — applyCandidateAnswer stamped acceptedLowball
   * on the prior turn; ship the quiet accept now. Single-fire by the
   * very nature of `acceptedLowball` being sticky-true and us also
   * requiring `calibratedSurpriseFired` (which only flips once). */
  if (
    state.acceptedLowball === true &&
    state.calibratedSurpriseFired === true &&
    !isTerminalPhase(state.phase)
  ) {
    /* Don't re-fire the accept after the planner has already shipped
     * it once: applyAiMove stamps `acceptLowballQuietFiredAtTurn`. */
    if (state.acceptLowballQuietFiredAtTurn == null) {
      const anchor =
        state.calibratedSurpriseContext?.candidateAnchor ??
        state.userClaims?.expectedCtc?.value ??
        state.candidateTarget ??
        0;
      return {
        kind: "accept-lowball-quiet",
        candidateAnchor: anchor,
        _move: {
          lever: "close-acceptance",
          newTotalLpa: anchor,
          actionKind: "accept-lowball-quiet",
          rationale:
            `Calibrated-surprise lowball — candidate doubled down on ` +
            `₹${anchor}L after the probe. Quiet accept; coaching surfaces ` +
            `acceptedLowball=true on the report.`,
        },
      } as PlannedAction;
    }
  }

  /* Open-gate — already fired? */
  if (state.calibratedSurpriseFired === true) return null;
  /* Recruiter affinity gate. */
  const affinity = state.recruiterAffinity ?? 0;
  if (affinity < -1) return null;
  /* Terminal phases skip. */
  if (isTerminalPhase(state.phase)) return null;
  /* Phase gate — only fire during anchor-discovery; once an offer is on
   * the table or candidate is countering live, the routine close/counter
   * cascade owns the turn. */
  if (
    state.phase !== "opening" &&
    state.phase !== "range-disclosure" &&
    state.phase !== "probe-expectations"
  ) {
    return null;
  }
  /* If recruiter has already put an offer on the table, the surprise
   * window has closed — fall through to the offer/close cascade. */
  if ((state.highestOfferMade ?? 0) > 0) return null;
  if (state.lastCandidateCounterLpa != null) return null;
  /* Numeric anchor must be disclosed. Class-A (2026-06-15): read the
   * total-CTC-scoped target, not the raw field — an in-hand-framed target
   * compared raw against the total walkAway floor produced a false lowball
   * flag (the take-home number is naturally ~13-25% below a CTC floor). */
  const anchor =
    state.userClaims?.expectedCtc?.value ??
    statedTotalTargetCtcLpa(state) ??
    null;
  if (anchor == null || !Number.isFinite(anchor) || anchor <= 0) return null;
  /* Band floor — use walkAway (real recruiter floor). */
  const floor = state.band?.walkAway;
  if (typeof floor !== "number" || floor <= 0) return null;
  /* 20% under floor gate. */
  const ratio = anchor / floor;
  if (ratio >= CALIBRATED_SURPRISE_THRESHOLD) return null;
  const gapPct = 1 - ratio;
  return {
    kind: "calibrated-surprise-lowball",
    tactic: "calibrated-surprise-lowball",
    candidateAnchor: anchor,
    bandFloor: floor,
    gapPct,
    _move: {
      lever: "probe",
      newTotalLpa: null,
      actionKind: "calibrated-surprise-lowball",
      rationale:
        `Calibrated-surprise lowball probe — candidate anchored at ` +
        `₹${anchor}L vs band floor ₹${floor}L (${(gapPct * 100).toFixed(0)}% ` +
        `under). Single-fire; affinity=${affinity}.`,
    },
  } as PlannedAction;
}

function maybePlanParaphraseRecap(
  state: NegotiationState,
): PlannedAction | null {
  /* Single-fire. */
  if (state.paraphraseFired === true) return null;
  /* Fact-count gate. */
  const facts = _collectParaphraseFacts(state);
  if (facts.length < PARAPHRASE_MIN_FACTS) return null;
  /* Recent-recap skip. */
  if (_recentRecapInTranscript(state)) return null;
  /* Trigger context: about to fire manager-consult-stall (open) OR phase
   * is closing-push. Mirror manager-consult open-gate predicates so the
   * paraphrase runs the turn BEFORE the stall would open. */
  const aboutToStallOpen = (() => {
    if ((state.stallTurnsRemaining ?? 0) > 0) return false; /* return-turn, not open */
    if (state.turnIndex < 1) return false;
    /* Class-A (2026-06-15) — compare a TOTAL-scoped counter against the total
     * maxStretch. totalScopedCounter returns null for a FIXED-scoped counter
     * ("₹26L fixed"), so a base ask can never falsely trip this over-band-total
     * stall (the units-mismatch false-fire). Still reads the fresh this-turn
     * counter, not the sticky intake target. */
    const freshAsk = totalScopedCounter(state);
    if (freshAsk == null || freshAsk <= state.band.maxStretch) return false;
    if ((state.stallsFiredCount ?? 0) >= STALL_SESSION_CAP) return false;
    const personaCfg = getRecruiterSectorPersona(state.recruiterSectorPersona ?? "default");
    const personaIsHighStall =
      personaCfg.id === "psu" ||
      personaCfg.id === "consulting-big4" ||
      personaCfg.stallProbability >= STALL_PROBABILITY_GATE;
    if (!personaIsHighStall) return false;
    if (state.phase !== "counter-offer" && state.phase !== "offer-presented") return false;
    return true;
  })();
  const aboutToClose = state.phase === "closing-push";
  if (!aboutToStallOpen && !aboutToClose) return null;

  const persona: RecruiterSectorPersona = state.recruiterSectorPersona ?? "default";
  const variant = _sectorParaphraseVariant(persona);
  return {
    kind: "paraphrase-recap",
    facts,
    sectorVariant: variant,
    _move: {
      lever: "hold-firm",
      newTotalLpa: state.highestOfferMade || state.band.initialOffer,
      actionKind: "paraphrase-recap",
      rationale:
        `Paraphrase-recap: ${facts.length} disclosed facts; ` +
        `trigger=${aboutToStallOpen ? "pre-manager-stall" : "pre-close"}; ` +
        `variant=${variant}.`,
    },
  } as PlannedAction;
}

/** Proactive-sweetener feature (2026-05-30) — sector-keyed sweetener map.
 *
 *  Each sector picks the non-cash lever it genuinely has the most
 *  flexibility on in the real market:
 *   - it-services      → notice-buyout-help (notice-period buyout is
 *                        the most common cash-adjacent ask at TCS /
 *                        Infosys / Wipro)
 *   - gcc              → relocation (global comp templates routinely
 *                        carry relocation budget separate from band)
 *   - indian-unicorn   → equity-refresh (refresh grants after the
 *                        cliff are the dominant compounding lever)
 *   - early-startup    → equity-refresh (ESOP stretch is the only
 *                        real lever when cash is tight)
 *   - bfsi             → signing-bonus (joining-bonus headroom even
 *                        when grade-pay is rigid)
 *   - psu              → joining-flexibility (cadre pay is fixed but
 *                        joining date is genuinely flexible)
 *   - consulting-big4  → relocation (relocation package is a real
 *                        lever distinct from grade)
 *   - consulting-mbb   → signing-bonus (sign-on is the standard MBB
 *                        sweetener once base is anchored)
 *   - fmcg-management  → joining-flexibility (intake / joining-cycle
 *                        flex is the standard FMCG lever)
 *   - edtech           → equity-refresh (post-correction cash is
 *                        tight; equity is where the upside sits)
 *   - default          → signing-bonus (safe verbal sweetener that
 *                        works across sectors) */
const SECTOR_SWEETENER_MAP: Record<
  RecruiterSectorPersona,
  | "signing-bonus"
  | "relocation"
  | "equity-refresh"
  | "joining-flexibility"
  | "notice-buyout-help"
> = {
  "it-services": "notice-buyout-help",
  "gcc": "relocation",
  "indian-unicorn": "equity-refresh",
  "early-startup": "equity-refresh",
  "bfsi": "signing-bonus",
  "psu": "joining-flexibility",
  "consulting-big4": "relocation",
  "consulting-mbb": "signing-bonus",
  "fmcg-management": "joining-flexibility",
  "edtech": "equity-refresh",
  "default": "signing-bonus",
};

/** Proactive-sweetener feature (2026-05-30) — planner gate.
 *
 *  Real recruiters offer non-cash sweeteners UNPROMPTED when they
 *  sense the candidate cooling and they're capped on cash. Pre-2026-
 *  05-30 the simulator never volunteered anything — recruiters were
 *  100% reactive, which was the #1 remaining realism gap.
 *
 *  Gates (all must pass):
 *   (1) Single-fire — proactiveSweetenerFired === true → null.
 *   (2) Phase — only counter-offer OR closing-push. Opening / range-
 *       disclosure / probe-expectations / manager-consult phases bail
 *       early (a sweetener volunteered before an offer is even on the
 *       table reads as desperate, not strategic).
 *   (3) Offer-on-table — highestOfferMade > 0. The sweetener supplements
 *       a cash offer; it never substitutes for one.
 *   (4) Cash-capped — highestOfferMade >= band.maxStretch * 0.95. The
 *       recruiter only reaches for non-cash levers when there's no
 *       material cash headroom left. The 95% threshold gives a small
 *       cash-residue buffer (real recruiters don't switch to non-cash
 *       at exactly maxStretch — they switch when they're "basically
 *       there").
 *   (5) Cooling signal — fire when ANY of:
 *         (a) last 2 affinity-ledger entries are net negative
 *         (b) candidate is still asking more than highestOfferMade
 *             (lastCandidateCounterLpa > highestOfferMade)
 *         (c) 2+ turns have elapsed since the last offer with no close
 *             action shipped
 *
 *  Verbal-only: no money math, no band mutation. The prose arm
 *  surfaces the sweetener as a question ("would that help close
 *  this?"); coaching downstream attributes it via
 *  state.proactiveSweetenerKind. */
function maybePlanProactiveSweetener(
  state: NegotiationState,
): PlannedAction | null {
  /* (0) Byte-equivalence baseline — when sessionId is empty we short-
   * circuit so legacy snapshot tests with no session identity see the
   * unchanged baseline cascade. Live sessions always carry a sessionId.
   * The persona may still be "default" — that path is exercised by the
   * default-sector fallback test (signing-bonus). */
  const sessionId = state.sessionId ?? "";
  if (sessionId.length === 0) return null;
  const persona: RecruiterSectorPersona =
    state.recruiterSectorPersona ?? "default";
  /* (1) Single-fire. */
  if (state.proactiveSweetenerFired === true) return null;
  /* (2) Phase gate — only counter-offer OR closing-push. */
  if (state.phase !== "counter-offer" && state.phase !== "closing-push") {
    return null;
  }
  /* (3) Recruiter has an offer on the table. */
  const highest = state.highestOfferMade ?? 0;
  if (highest <= 0) return null;
  /* (4) Cash-capped. band.maxStretch is the recruiter's hard money
   * ceiling; 95% of that is "basically there on cash". */
  const maxStretch = state.band?.maxStretch ?? 0;
  if (maxStretch <= 0) return null;
  if (highest < maxStretch * 0.95) return null;
  /* (5) Cooling signal — three independent triggers. The first match
   * wins so the rationale can attribute correctly. */
  let signal: string | null = null;
  /* (5a) Last 2 affinity-ledger entries net negative. */
  const ledger = state.affinityLedger ?? [];
  if (ledger.length >= 2) {
    const tail = ledger.slice(-2);
    const sum = tail.reduce((acc, e) => acc + (e.delta ?? 0), 0);
    if (sum < 0) signal = "affinity-drop";
  }
  /* (5b) Counter still pending above the recruiter's cap. Class-A
   * (2026-06-15) — only a TOTAL-scoped counter is comparable to `highest` (a
   * total offer); a fixed-component ask is not "pending above the cap". */
  const pendingTotalCounter = totalScopedCounter(state);
  if (
    signal == null &&
    pendingTotalCounter != null &&
    pendingTotalCounter > highest
  ) {
    signal = "counter-still-pending";
  }
  /* (5c) 2+ turns since the last offer with no close action shipped.
   * highestOfferMadeAtTurn carries the turn the cap was reached; when
   * unavailable, fall through to the turn budget check on lastOfferTurn. */
  if (signal == null) {
    const lastOfferTurn =
      (state as unknown as { lastOfferTurn?: number }).lastOfferTurn ??
      (state as unknown as { highestOfferMadeAtTurn?: number })
        .highestOfferMadeAtTurn ??
      null;
    if (
      lastOfferTurn != null &&
      state.turnIndex - lastOfferTurn >= 2 &&
      !state.leversUsed.includes("close-acceptance")
    ) {
      signal = "stale-offer";
    }
  }
  if (signal == null) return null;
  /* Sector-keyed sweetener pick. "default" persona short-circuits the
   * overlay layer downstream, but the planner still picks a sensible
   * sweetener (signing-bonus) so the gate is testable. */
  const sweetenerKind = SECTOR_SWEETENER_MAP[persona];
  return {
    kind: "proactive-sweetener",
    sweetenerKind,
    _move: {
      /* No "soften" lever exists in the NegotiationLever union; the
       * closest non-money lever is hold-firm, which the existing
       * paraphrase-recap and manager-consult-stall arms already use
       * to carry non-numeric prose without touching highestOfferMade. */
      lever: "hold-firm",
      newTotalLpa: null,
      actionKind: "proactive-sweetener",
      sweetenerKind,
      rationale:
        `Proactive sweetener offered — recruiter capped at ` +
        `₹${highest}L vs max-stretch ₹${maxStretch}L. ` +
        `Candidate cooling signal: ${signal}. Single-fire; ` +
        `sweetener=${sweetenerKind} (persona=${persona}).`,
    },
  } as PlannedAction;
}

/** Realism-Audit Fix 3 (2026-05-22) — manager-consult stall gate.
 *
 *  Returns the stall PlannedAction (open OR return) when all gate
 *  conditions are met, else null and the planner cascade proceeds
 *  normally. Pure / deterministic; reads `stallTurnsRemaining`,
 *  `stallsFiredCount`, `lastStallContext`, turn budget, persona's
 *  `stallProbability`, and the candidate's ask vs `band.maxStretch`. */
export const STALL_SESSION_CAP = 3;
export const STALL_PROBABILITY_GATE = 0.40;

function maybePlanManagerConsultStall(
  state: NegotiationState,
): PlannedAction | null {
  /* (A) Return-turn — a stall is already in flight. Ship the deterministic
   * outcome and let applyAiMove decrement stallTurnsRemaining + clear
   * lastStallContext. The simulator commits to either a small concession
   * OR a hold; choice keys off persona pushback + headroom against
   * highestOfferMade. */
  const inFlight = (state.stallTurnsRemaining ?? 0) > 0;
  if (inFlight) {
    const stalledAskLpa = state.lastStallContext?.stalledAskLpa ?? null;
    const personaCfg = getRecruiterSectorPersona(state.recruiterSectorPersona ?? "default");
    /* Choose return mode. PSU / Big-4 hold harder; unicorn / startup
     * tend to ship a small concession on the return turn. The hold
     * branch is also chosen when there's no headroom left between
     * highestOfferMade and band.maxStretch. */
    const headroom = state.band.maxStretch - state.highestOfferMade;
    const personaHolds =
      personaCfg.pushbackStyle === "cadre-pay-rigid" ||
      personaCfg.pushbackStyle === "internal-equity-cap";
    const returnMode: "return-move" | "return-hold" =
      personaHolds || headroom < 0.5 ? "return-hold" : "return-move";
    /* Concession size — half a LPA on consultative personas, ₹2L on
     * unicorn/startup who actually have JB flex; capped at headroom. */
    let concession: number | null = null;
    if (returnMode === "return-move") {
      const target = personaCfg.id === "indian-unicorn" || personaCfg.id === "early-startup" ? 2.0 : 1.0;
      concession = Math.max(0.5, Math.min(target, headroom));
      concession = Math.round(concession * 10) / 10;
    }
    return {
      kind: "manager-consult-stall",
      mode: returnMode,
      stalledAskLpa,
      returnConcessionLpa: concession,
      _move: {
        lever: "hold-firm",
        newTotalLpa: state.highestOfferMade,
        actionKind: "manager-consult-stall",
        rationale:
          `Manager-consult stall — return turn (mode=${returnMode}, concession=` +
          `₹${concession ?? 0}L). Stalled ask was ₹${stalledAskLpa ?? "?"}L; ` +
          `stallsFiredCount=${state.stallsFiredCount ?? 0}.`,
      },
    } as PlannedAction;
  }

  /* (B) Open-turn gates. */
  /* Gate 1 — not the first AI turn. Recruiter must have heard the ask. */
  if (state.turnIndex < 1) return null;
  /* Gate 2 — candidate just dropped a hard TOTAL ask above band.maxStretch.
   * Uses the fresh this-turn counter (not sticky candidateTarget) so a stale
   * intake target doesn't keep re-triggering stalls across the session.
   * Class-A (2026-06-15): routed through totalScopedCounter so a FIXED-scoped
   * counter ("₹26L fixed") returns null and cannot falsely trip this
   * over-band-total stall — that was the units-mismatch false-fire. */
  const freshAsk = totalScopedCounter(state);
  if (freshAsk == null || freshAsk <= state.band.maxStretch) return null;
  /* Gate 3 — session-wide cap. */
  if ((state.stallsFiredCount ?? 0) >= STALL_SESSION_CAP) return null;
  /* Gate 4 — persona stall probability OR PSU/Big-4 short-circuit
   * (those are dominant-stall sectors per audit). */
  const personaCfg = getRecruiterSectorPersona(state.recruiterSectorPersona ?? "default");
  const personaIsHighStall =
    personaCfg.id === "psu" ||
    personaCfg.id === "consulting-big4" ||
    personaCfg.stallProbability >= STALL_PROBABILITY_GATE;
  if (!personaIsHighStall) return null;
  /* Gate 5 — must not be in a terminal phase. Stalls only make sense
   * once an offer is on the table (offer-presented) or in counter-offer. */
  if (state.phase !== "counter-offer" && state.phase !== "offer-presented") return null;

  return {
    kind: "manager-consult-stall",
    mode: "open",
    stalledAskLpa: freshAsk,
    returnConcessionLpa: null,
    _move: {
      lever: "hold-firm",
      newTotalLpa: state.highestOfferMade,
      actionKind: "manager-consult-stall",
      rationale:
        `Manager-consult stall — open. Candidate asked ₹${freshAsk}L vs band ` +
        `maxStretch ₹${state.band.maxStretch}L (persona=${personaCfg.id}, ` +
        `stallsFiredCount=${state.stallsFiredCount ?? 0}).`,
    },
  } as PlannedAction;
}

function planNextActionInternal(state: NegotiationState): PlannedAction {
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
    const alreadyDisclosed =
      lastAiText.includes("guaranteed cash is") ||
      lastAiText.includes("let me break it down honestly");
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
    const numberMatches = Array.from(
      lastCandidate.matchAll(/\b(\d+(?:\.\d+)?)\s*(?:l|lpa|lakh|lacs?|cr)\b/gi),
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
      return {
        kind: "close",
        mode: "accept",
        _move: {
          lever: "close-acceptance",
          newTotalLpa: clampToCloseFloor(state, closeAt),
          joiningBonusAmount: jb != null ? jb : undefined,
          rationale: `Candidate signaled close readiness (trial-close detected on prior turn); close at ₹${closeAt}L (offer ₹${state.highestOfferMade}L).`,
          askedTopic: "close-confirmation",
        },
      };
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
    const condNum = totalScopedCounter(state) ?? state.lastCandidateCounterLpa ?? null;
    /* Gap a recruiter will close instantly: the larger of ₹2L or 6% of the
     * standing offer. Wider gaps remain a live negotiation. */
    const gap = Math.max(2, offer * 0.06);
    let closeAt: number | null = null;
    if (condNum == null) {
      closeAt = offer;
    } else if (condNum <= ceil && condNum - offer <= gap) {
      closeAt = Math.max(offer, condNum);
    }
    if (closeAt != null) {
      const jb = state.lastJoiningBonusOffered;
      return {
        kind: "close",
        mode: "accept",
        _move: {
          lever: "close-acceptance",
          newTotalLpa: clampToCloseFloor(state, closeAt),
          joiningBonusAmount: jb != null ? jb : undefined,
          rationale: `Near-offer conditional acceptance: candidate will close on ₹${condNum ?? offer}L (offer ₹${offer}L, ceiling ₹${ceil}L); converge at ₹${closeAt}L and close rather than divert.`,
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
  const gapGateTarget = statedTotalTargetCtcLpa(state);
  if (
    !isTerminalPhase(state.phase) &&
    state.phase !== "opening" &&
    gapGateTarget != null &&
    gapGateTarget > state.band.maxStretch * 1.5
  ) {
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
    state.candidateTarget == null
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
     * anchor. */
    if (
      state.turnIndex > 0 &&
      state.discoveryChecklist != null &&
      state.discoveryChecklist.targetAnswered !== true
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
     * checklist branch above would emit. */
    if (
      state.turnIndex >= 2 &&
      state.discoveryChecklist == null &&
      !canDiscloseSpecificNumber(state)
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
            `AUDIT-3 discovery-sufficient anchor: candidate volunteered current ₹${state.candidateCurrentCtc}L + target ₹${state.candidateTarget ?? state.candidateTargetFixed}L${state.candidateTarget == null ? " (fixed)" : ""}; ` +
            `discovery sufficient; no offer on the table — anchor point-offer at ₹${anchored}L (band floor=${lo}).`,
          askedTopic: "band-anchor-with-rationale",
          actionKind: "anchor-with-offer",
        },
      };
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
   * notice / hike-pct. One-shot per lever (benefits-summary): once we've
   * enumerated the breakdown, the planner falls through to probe rather
   * than re-disclosing. PDF#44 Bug B (the candidate's second breakdown
   * ask returning a dodge) is mitigated by the substantive prose in
   * prose/info-disclosure.ts — the FIRST disclosure is now informative
   * enough that a re-ask is rare; the loop-breaker escalation at the
   * pipeline boundary catches the residual case. */
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
        const allowProbeWithOfferOnTable =
          state.highestOfferMade === 0 ||
          (next != null && !ORTHOGONAL_POST_ANCHOR_ITEMS.has(next.item));
        if (next != null && allowProbeWithOfferOnTable) {
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
    !state.competingOfferDetail.hasAny;
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

    /* Class-A (2026-06-15) — effectiveTargetCtcLpa folds in-hand→CTC and
     * fixed-only→implied-total so the aspiration isn't computed in the wrong
     * frame (the in-hand under-quote / fixed-only fall-to-ceiling bugs). The
     * Math.min(target, ceiling) below still clamps to band. */
    const target = effectiveTargetCtcLpa(state) ?? state.band.maxStretch;
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
    /* PDF#46 B6 (2026-05-25) — surface candidate's stated base on the
     * counter action when their latest counter named one. Heuristic:
     * we're post-anchor (highestOfferMade > 0), the breakdown has a
     * non-null base, and the stated total roughly matches our parsed
     * lastCandidateCounterLpa — meaning the breakdown belongs to the
     * counter utterance, not a stale discovery-phase capture. */
    let candidateProposedBaseLpa: number | undefined;
    {
      const cb = state.candidateComponentBreakdown;
      const counterTotal = state.lastCandidateCounterLpa;
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
  return wrapLeverExplore(legacyMove, "default");
}

/** Prior-context feature (2026-05-29) — emits a high-priority action
 *  shaped by the user's upfront-declared context (existingCompetingOffer
 *  / retentionOffer). Two firing windows:
 *    - turn 1-2 acknowledgements: `acknowledge-existing-offer` and
 *      `acknowledge-retention-offer` fire ONCE each at the start of the
 *      session so the recruiter immediately registers the leverage.
 *    - mid-stage reactions: `match-existing-offer-prose` fires when
 *      the candidate pushes back citing the existing offer, and
 *      `retention-trump-warning` fires once mid-stage when the retention
 *      is structurally strong (>= 1.25× current CTC).
 *
 *  Single-fire semantics are tracked via reactiveFollowupsFired (same
 *  ledger the rest of the planner uses) so a re-entry of the same
 *  cascade doesn't double-fire. Returns null when no priorContext is
 *  declared OR when no gate fires this turn. Pure. */
export function maybePlanPriorContextAction(
  state: NegotiationState,
): PlannedAction | null {
  const ctx = state.priorContext;
  if (!ctx) return null;
  if (isTerminalPhase(state.phase)) return null;
  const fired = state.reactiveFollowupsFired ?? [];

  /* Turn 1-2 acknowledgements. These pre-empt the routine discovery
   * cascade so the recruiter signals up-front that the context has
   * landed. Single-fire per session. */
  if (state.turnIndex <= 2) {
    if (ctx.existingCompetingOffer && !fired.includes("acknowledge-existing-offer" as DiscoveryTopic)) {
      const off = ctx.existingCompetingOffer;
      return {
        kind: "acknowledge-existing-offer",
        company: off.company,
        amountLpa: off.amountLpa,
        signed: off.signed,
        deadline: off.deadline,
        _move: {
          lever: "probe",
          newTotalLpa: null,
          actionKind: "acknowledge-existing-offer",
          askedTopic: "acknowledge-existing-offer",
          rationale:
            `priorContext.existingCompetingOffer declared at session init ` +
            `(${off.company} @ ₹${off.amountLpa}L, signed=${off.signed}); ` +
            `acknowledge upfront on turn ${state.turnIndex} so candidate ` +
            `knows we've registered the leverage before discovery begins.`,
        },
      };
    }
    if (ctx.retentionOffer && !fired.includes("acknowledge-retention-offer" as DiscoveryTopic)) {
      const r = ctx.retentionOffer;
      return {
        kind: "acknowledge-retention-offer",
        amountLpa: r.amountLpa,
        tenure: r.tenure,
        _move: {
          lever: "probe",
          newTotalLpa: null,
          actionKind: "acknowledge-retention-offer",
          askedTopic: "acknowledge-retention-offer",
          rationale:
            `priorContext.retentionOffer declared at session init ` +
            `(₹${r.amountLpa}L, ${r.tenure}); ack on turn ${state.turnIndex} ` +
            `and probe whether retention is enough or candidate wants more.`,
        },
      };
    }
  }

  /* Mid-stage retention-trump warning. Fires ONCE when the retention
   * package is structurally strong relative to currentCtc (>= 1.25×).
   * Doesn't pre-empt closes / crisis actions — placed at "preempt
   * routine stalls" priority. */
  if (
    ctx.retentionOffer &&
    state.candidateCurrentCtc != null &&
    state.candidateCurrentCtc > 0 &&
    ctx.retentionOffer.amountLpa >= state.candidateCurrentCtc * 1.25 &&
    state.turnIndex >= 3 &&
    !fired.includes("retention-trump-warning" as DiscoveryTopic)
  ) {
    return {
      kind: "retention-trump-warning",
      retentionLpa: ctx.retentionOffer.amountLpa,
      currentCtcLpa: state.candidateCurrentCtc,
      _move: {
        lever: "hold-firm",
        newTotalLpa: state.highestOfferMade || null,
        actionKind: "retention-trump-warning",
        askedTopic: "retention-trump-warning",
        rationale:
          `retentionOffer ₹${ctx.retentionOffer.amountLpa}L >= 1.25× ` +
          `currentCtc ₹${state.candidateCurrentCtc}L; signal sign-off ` +
          `requirement on turn ${state.turnIndex}.`,
      },
    };
  }

  /* Mid-stage match-existing-offer prose. Fires when the candidate's
   * latest utterance references the existing offer ("but my X offer is
   * Y", "I have ABC at Z LPA", etc.) AND we have not yet emitted this
   * arm. The within-band test feeds the prose arm so the recruiter
   * either matches (within band) or politely declines (above band). */
  if (
    ctx.existingCompetingOffer &&
    state.turnIndex >= 2 &&
    !fired.includes("match-existing-offer-prose" as DiscoveryTopic)
  ) {
    const last = latestCandidateText(state).toLowerCase();
    const off = ctx.existingCompetingOffer;
    const co = off.company.toLowerCase();
    const mentionsCompany = co.length > 1 && last.includes(co);
    const mentionsAmount = last.includes(String(off.amountLpa));
    const pushbackTokens =
      /\b(but|already|i have|i've got|hold(?:ing)?|matching|match it|offer (?:from|of)|standing offer)\b/.test(
        last,
      );
    if ((mentionsCompany || mentionsAmount) && pushbackTokens) {
      const cap = state.band?.maxStretch ?? Infinity;
      const withinBand = off.amountLpa <= cap;
      return {
        kind: "match-existing-offer-prose",
        company: off.company,
        competingAmountLpa: off.amountLpa,
        withinBand,
        _move: {
          lever: withinBand ? "counter-base" : "hold-firm",
          newTotalLpa: withinBand ? off.amountLpa : state.highestOfferMade || null,
          actionKind: "match-existing-offer-prose",
          askedTopic: "match-existing-offer-prose",
          rationale:
            `priorContext.existingCompetingOffer cited by candidate at turn ` +
            `${state.turnIndex} (${off.company} @ ₹${off.amountLpa}L); ` +
            `withinBand=${withinBand}.`,
        },
      };
    }
  }

  return null;
}

/** Memory-callback feature (2026-05-29) — periodically reference a fact
 *  the candidate stated earlier so the recruiter sounds like they're
 *  listening. Picks the MOST RECENT recorded claim (highest
 *  firstSeenTurn) from state.userClaims that hasn't been called back
 *  yet. Single-fire per session via reactiveFollowupsFired ledger
 *  ("callback-prior-context"). Returns null when:
 *    - terminal phase
 *    - turn < 4 (need facts to call back to)
 *    - userClaims absent / empty
 *    - already fired this session
 *
 *  Pure. */
export function maybePlanCallbackPriorContext(
  state: NegotiationState,
): PlannedAction | null {
  if (isTerminalPhase(state.phase)) return null;
  /* Don't interrupt active negotiation phases — the recruiter calls
   * back during conversational space, not mid-counter or post-anchor.
   * Restricted to the pure pre-anchor `opening` phase AND only
   * when no offer is on the table; once an offer is made, the rest
   * of the cascade owns the conversational floor. */
  if (state.phase !== "opening") return null;
  if (state.highestOfferMade > 0) return null;
  if (state.turnIndex < 4) return null;
  const fired = state.reactiveFollowupsFired ?? [];
  if (fired.includes("callback-prior-context" as DiscoveryTopic)) return null;
  /* Don't fire when the candidate's CURRENT turn brought a fresh
   * disclosure — the reactive-followup branch above should own that
   * turn. Callback is for "space" turns. */
  const d = state.lastTurnDelta;
  if (
    d &&
    (d.disclosedCurrentCtc ||
      d.disclosedExpectedCtc ||
      d.disclosedNoticePeriod ||
      d.disclosedCompetingOffer ||
      d.disclosedFixedVariableSplit ||
      d.disclosedValueProof ||
      d.askedQuestion)
  ) {
    return null;
  }
  const claims = state.userClaims;
  if (!claims) return null;
  /* Build candidates list — (key, firstSeenTurn, value, label). Picks
   * most-recent unaddressed. */
  type Candidate = {
    claim: "currentCtc" | "expectedCtc" | "competingOffer" | "noticePeriod" | "currentRole";
    value: number | string;
    companyLabel: string | null;
    firstSeenTurn: number;
  };
  const candidates: Candidate[] = [];
  if (claims.currentCtc) {
    candidates.push({
      claim: "currentCtc",
      value: claims.currentCtc.value,
      companyLabel: null,
      firstSeenTurn: claims.currentCtc.firstSeenTurn,
    });
  }
  if (claims.expectedCtc) {
    candidates.push({
      claim: "expectedCtc",
      value: claims.expectedCtc.value,
      companyLabel: null,
      firstSeenTurn: claims.expectedCtc.firstSeenTurn,
    });
  }
  if (claims.competingOffer) {
    candidates.push({
      claim: "competingOffer",
      value: claims.competingOffer.value.amount,
      companyLabel: claims.competingOffer.value.company,
      firstSeenTurn: claims.competingOffer.firstSeenTurn,
    });
  }
  if (claims.noticePeriod) {
    candidates.push({
      claim: "noticePeriod",
      value: claims.noticePeriod.value,
      companyLabel: null,
      firstSeenTurn: claims.noticePeriod.firstSeenTurn,
    });
  }
  if (claims.currentRole) {
    candidates.push({
      claim: "currentRole",
      value: claims.currentRole.value,
      companyLabel: null,
      firstSeenTurn: claims.currentRole.firstSeenTurn,
    });
  }
  if (candidates.length === 0) return null;
  /* Most-recent first; stable tiebreak by declaration order. */
  candidates.sort((a, b) => b.firstSeenTurn - a.firstSeenTurn);
  const pick = candidates[0];
  return {
    kind: "callback-prior-context",
    claim: pick.claim,
    value: pick.value,
    companyLabel: pick.companyLabel,
    firstSeenTurn: pick.firstSeenTurn,
    _move: {
      lever: "probe",
      newTotalLpa: null,
      actionKind: "callback-prior-context",
      askedTopic: "callback-prior-context" as DiscoveryTopic,
      rationale:
        `Memory-callback (2026-05-29): surfacing recorded userClaim ` +
        `${pick.claim} (firstSeenTurn=${pick.firstSeenTurn}) at turn ` +
        `${state.turnIndex} so the recruiter sounds like they're tracking ` +
        `earlier-stated facts.`,
    },
  };
}

/** Competing-offer warm-acknowledgment (2026-05-29). Fires once per
 *  session when state.userClaims.competingOffer was first seen on the
 *  PRIOR candidate turn (i.e. the claim is fresh and we haven't yet
 *  acknowledged it). Distinct from competitor-match (which negotiates)
 *  — this is pure respectful acknowledgment of market value. Skipped
 *  when terminal, when priorContext.existingCompetingOffer is present
 *  (acknowledge-existing-offer covers that flow), or when already
 *  fired. Pure. */
export function maybePlanCompetingOfferWarmAck(
  state: NegotiationState,
): PlannedAction | null {
  if (isTerminalPhase(state.phase)) return null;
  /* Don't interrupt active counter / lever / close phases — by then
   * the competing-offer leverage is being handled by competitor-match
   * / fake-leverage-challenge. Warm-ack is for early acknowledgment. */
  const EARLY_PHASES = new Set<NegotiationPhase>([
    "opening",
    "range-disclosure",
  ]);
  if (!EARLY_PHASES.has(state.phase)) return null;
  if (state.highestOfferMade > 0) return null;
  const fired = state.reactiveFollowupsFired ?? [];
  if (fired.includes("competing-offer-warm-ack" as DiscoveryTopic)) return null;
  /* Don't double-up with priorContext acknowledgment. */
  if (state.priorContext?.existingCompetingOffer) return null;
  const co = state.userClaims?.competingOffer;
  if (!co) return null;
  return {
    kind: "competing-offer-warm-ack",
    company: co.value.company,
    amountLpa: co.value.amount,
    _move: {
      lever: "probe",
      newTotalLpa: null,
      actionKind: "competing-offer-warm-ack",
      askedTopic: "competing-offer-warm-ack" as DiscoveryTopic,
      rationale:
        `Competing-offer warm-ack (2026-05-29): userClaims.competingOffer ` +
        `recorded at turn ${co.firstSeenTurn} (${co.value.company} @ ` +
        `₹${co.value.amount}L); emit respectful market-value acknowledgment ` +
        `before any negotiation pushback.`,
    },
  };
}

/** Deterministic non-negative integer hash for tactic slot / variant
 *  selection. Pure FNV-1a-style over (sessionId || "", salt). Null
 *  sessionId hashes to a constant — tests that don't carry a session
 *  see stable behaviour. */
function tacticHash(sessionId: string | null | undefined, salt: string): number {
  const s = `${sessionId ?? ""}|${salt}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Bad-faith tactic injection (2026-05-29). Returns a low-priority
 *  tactic PlannedAction or null when no tactic gate fires.
 *
 *  Gates:
 *   - exploding-offer-pressure: turn ≥ 6, candidate hasn't accepted,
 *     not in terminal phase. Once per session.
 *   - fake-competing-candidate: turn ≥ 4, candidate is over-band on
 *     their ask (candidateTarget > band.maxStretch). Once per session.
 *   - vague-promise: any mid-stage turn (≥ 2, not terminal). Low
 *     probability — fires deterministically once on a turn matching a
 *     simple session-jittered slot so we don't spam. Once per session.
 *
 *  All three skip when state.tacticsUsed already contains them. The
 *  function checks gates in priority order (exploding > competing >
 *  vague-promise) and returns the first eligible. */
export function maybePlanTacticInject(
  state: NegotiationState,
): PlannedAction | null {
  if (isTerminalPhase(state.phase)) return null;
  const used: TacticKind[] = (state.tacticsUsed ?? []) as TacticKind[];
  const usedSet = new Set<TacticKind>(used);

  /* Exploding-offer pressure — turn 6+, no acceptance yet, mid-arc only. */
  if (
    !usedSet.has("exploding-offer-pressure") &&
    state.turnIndex >= 6 &&
    state.phase === "counter-offer" &&
    state.acceptedAtTurn == null
  ) {
    const deadlines: ("eod" | "friday" | "24h")[] = ["eod", "friday", "24h"];
    const pick = deadlines[tacticHash(state.sessionId, "exploding-offer-deadline") % 3];
    return {
      kind: "exploding-offer-pressure",
      tactic: "exploding-offer-pressure",
      deadline: pick,
      _move: {
        lever: "hold-firm",
        newTotalLpa: state.highestOfferMade || null,
        actionKind: "exploding-offer-pressure",
        rationale:
          `Bad-faith tactic inject (exploding-offer-pressure): turn ` +
          `${state.turnIndex} ≥ 6 and candidate has not accepted; ` +
          `single-fire per session. Deadline=${pick}.`,
      },
    };
  }

  /* Fake competing candidate — turn 4+, candidate is over-band.
   * Class-A (2026-06-15) — over-band must be judged on a TOTAL-CTC basis.
   * The raw `state.candidateTarget` may be in-hand-framed, so comparing it
   * directly against `band.maxStretch` (a total) mismatched units and could
   * mis-fire. effectiveTargetCtcLpa folds in-hand→CTC into the same basis
   * as maxStretch. */
  const fakeCompetingTarget =
    state.band != null ? effectiveTargetCtcLpa(state) : null;
  if (
    !usedSet.has("fake-competing-candidate") &&
    state.turnIndex >= 4 &&
    state.phase === "counter-offer" &&
    fakeCompetingTarget != null &&
    state.band != null &&
    fakeCompetingTarget > state.band.maxStretch
  ) {
    return {
      kind: "fake-competing-candidate",
      tactic: "fake-competing-candidate",
      variant: tacticHash(state.sessionId, "fake-competing-variant") % 5,
      _move: {
        lever: "hold-firm",
        newTotalLpa: state.highestOfferMade || null,
        actionKind: "fake-competing-candidate",
        rationale:
          `Bad-faith tactic inject (fake-competing-candidate): turn ` +
          `${state.turnIndex} ≥ 4 and candidate is over-band ` +
          `(CTC-basis target ₹${fakeCompetingTarget}L > maxStretch ₹${state.band.maxStretch}L); ` +
          `single-fire per session.`,
      },
    };
  }

  /* Vague non-binding promise — mid-stage, low-probability slot.
   * Suppressed when the candidate's latest utterance is an open-phrasing
   * salary push (live-staging 2026-06-19): a cash push like "push the
   * cash a little more" deserves a money-lever response, NOT an off-topic
   * vague WFH/title promise. Diverting to an unrelated soft topic over a
   * direct cash ask reads as a non-sequitur stonewall. Let the planner
   * fall through to lever-explore, which engages the number. */
  if (
    !usedSet.has("vague-promise") &&
    state.turnIndex >= 2 &&
    !isSalaryPush(latestCandidateText(state))
  ) {
    const slot = tacticHash(state.sessionId, `vague-promise-${state.turnIndex}`) % 5;
    if (slot === 0) {
      const topics: ("wfh" | "joining-bonus" | "title")[] = ["wfh", "joining-bonus", "title"];
      const pick = topics[tacticHash(state.sessionId, "vague-promise-topic") % 3];
      return {
        kind: "vague-promise",
        tactic: "vague-promise",
        topic: pick,
        _move: {
          lever: "hold-firm",
          newTotalLpa: state.highestOfferMade || null,
          actionKind: "vague-promise",
          rationale:
            `Bad-faith tactic inject (vague-promise): turn ${state.turnIndex} ` +
            `slot match; soft non-binding promise on ${pick}. Single-fire per session.`,
        },
      };
    }
  }

  return null;
}

/** Detect whether the candidate's latest utterance NAMED a bad-faith
 *  tactic the recruiter used this session. Returns the tactic kind
 *  matched (or null). Used by the scoring layer to credit the user
 *  with a positive coaching signal. Pure — no IO. */
export function detectUserCaughtTactic(
  utterance: string,
  tacticsUsed: TacticKind[] | undefined,
): TacticKind | null {
  if (!utterance || typeof utterance !== "string") return null;
  const used = new Set<TacticKind>(tacticsUsed ?? []);
  const u = utterance.toLowerCase();
  if (
    used.has("exploding-offer-pressure") &&
    /\b(exploding|deadline|artificial|pressur(?:e|ing)|why\s+(?:the\s+)?rush|by\s+(?:eod|friday|tomorrow))\b/.test(u)
  ) {
    return "exploding-offer-pressure";
  }
  if (
    used.has("fake-competing-candidate") &&
    /\b(another\s+candidate|competing\s+candidate|other\s+candidate|that'?s\s+(?:a\s+)?(?:bluff|pressure))\b/.test(u)
  ) {
    return "fake-competing-candidate";
  }
  if (
    used.has("vague-promise") &&
    /\b(non[-\s]?binding|in\s+writing|written|vague|let'?s\s+put\s+(?:it|that)\s+in\s+(?:the\s+)?offer|specific|commit(?:ment)?|guarantee)\b/.test(u)
  ) {
    return "vague-promise";
  }
  return null;
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

/** PDF #45 fix (2026-05-22) — tier-aware hike floor. The flat 15% floor
 *  is junior-grade and reads as a lowball for senior switches. Real
 *  Indian-market norms for a Senior / Lead / Principal / Staff role
 *  with ≥4 YoE applicable are 25–35% on switch. User-reported
 *  Flipkart Sr PD transcript anchored at ₹37 LPA on a candidate with
 *  current CTC ₹32–36 LPA (15% floor = 36.8, rounded to 37) — a
 *  ₹1 LPA hike on switch. Real Sr PD floor is ₹40 LPA (25% floor) or
 *  higher. Returns the role-aware percentage. */
function minHikePctForRole(state: NegotiationState): number {
  const role = (state.role || "").toLowerCase();
  const seniorRoleRe = /\b(?:senior|lead|principal|staff|sr\.?|director|head)\b/i;
  const isSeniorRole = seniorRoleRe.test(role);
  const applicableYoe = state.candidateApplicableYoe ?? 0;
  if (isSeniorRole || applicableYoe >= 4) return 0.25;
  return MIN_HIKE_PCT_FOR_ANCHOR;
}

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

/* AUDIT-W02 BUG-001 (2026-06-08) — Return `number | null`. Null signals
 * "band-incomplete defer" so callers emit a defer rather than a pay-cut
 * anchor when the band ceiling is below the disclosed current CTC.
 * Picked null over { defer: true } because all three callers already
 * have an existing bandIncomplete-defer branch to reuse — minimal churn. */
export function clampAnchorAboveDisclosed(
  lo: number,
  hi: number,
  state: NegotiationState,
): number | null {
  const disclosed = state.candidateCurrentCtc;
  if (typeof disclosed !== "number" || disclosed <= 0) return lo;
  /* Floor = disclosed * (1 + hike) — anchor must beat current CTC by a
   * real margin, not merely match it. PDF #45 (2026-05-22): tier-aware
   * hike — senior roles / ≥4 YoE candidates get a 25% floor instead of
   * 15% to match real Indian-market norms. */
  const hikePct = minHikePctForRole(state);
  const hikeFloor = disclosed * (1 + hikePct);
  /* PDF#39 BUG-D (2026-05-20) — round to INTEGER, not 1 decimal. */
  const hikeFloorRounded = Math.round(hikeFloor);
  const candidate = Math.max(lo, hikeFloorRounded);
  /* AUDIT-W02 BUG-001 — If the hike-floored candidate exceeds the band
   * ceiling AND the candidate's disclosed current already exceeds the
   * band ceiling, clamping to `hi` would emit a pay-cut anchor. Signal
   * defer instead.
   *
   * Deflect-loop terminator (2026-06-18, live-staging finding) — but
   * defer only ONCE. The honest-defer stamps `band-anchor-with-
   * rationale` while putting no number on the table, so on the next
   * relevant turn we'd defer again, and again, forever ("I'll have a
   * firmer number once the panel signs off") — and past the min-turns
   * floor the recruiter can even walk away on the candidate's own
   * acceptance. Once we've already deferred (band-anchor-with-rationale
   * stamped) and STILL have no number out (highestOfferMade === 0), a
   * real recruiter stops stalling and puts their honest ceiling on the
   * table: anchor at `hi`. This is the ONE point all ~6 honest-defer
   * callers funnel through, so the loop can't drift back in at a site
   * we forgot to patch. The first-defer null path is unchanged and stays
   * pinned by clampAnchorAboveDisclosed.belowMaxStretch.test.ts. */
  if (candidate > hi && disclosed > hi) {
    const alreadyDeferred =
      state.highestOfferMade === 0 &&
      readAskedTopics(state).some(
        (t) =>
          t.topic === "band-anchor-with-rationale" ||
          (t.topic as string) === "anchor-with-offer",
      );
    return alreadyDeferred ? hi : null;
  }
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
    { kind: "lever-work-mode", gated: false },
    { kind: "lever-growth-path", gated: false },
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
  | "lever-work-mode"
  | "lever-growth-path"
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
  return {
    kind: "lever-explore",
    from,
    leverKind: move.lever,
    joiningBonusLpa: move.joiningBonusAmount,
    _move: move,
  };
}

/** Phase 28 (2026-05-13) — compute the joining-bonus amount. See original
 *  in _kernel-move-picker.ts for full sizing rationale. Duplicated here
 *  rather than imported because the move-picker's copy is module-private
 *  and the planner is the new home for "what move next" logic. */
function computeJoiningBonusAmount(state: NegotiationState): number {
  /* Class-A (2026-06-15) — size the joining bonus off the unit-normalized
   * total target (in-hand→CTC, fixed-only→implied total), not the raw field. */
  const refTop = effectiveTargetCtcLpa(state) ?? state.band.maxStretch;
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
     * `wrapLeverExplore(legacyMove, "default")` fallback. So the
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
    if (
      !hasFired("answer-direct") &&
      !offerAskedThisTurn &&
      !wiredProfileTopicMatches
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
    const total =
      breakdown && breakdown.base != null && breakdown.variable != null
        ? breakdown.base + breakdown.variable
        : null;
    const variableSharePct =
      total != null && total > 0 && breakdown.variable != null
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
   * at turn 3+ already. One gentle push before accepting the refusal. */
  if (
    state.candidateProfile?.evasiveOnCurrentCtc &&
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
function planArchetypeReactive(
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
        flag: profile.wantsJoiningBonus,
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
        flag: profile.askedAboutReporting,
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
        flag: profile.gaveRangeNotPoint,
        topic: "range-to-point",
        ask: "You shared a range — to plan the fitment cleanly, where in that range do you actually see yourself landing? Helps me take a more specific number to leadership.",
        rationale: "Candidate gave a range instead of a target — pin down the actual point before the lever rotation locks in.",
      },
      {
        flag: profile.deflectedOnRange,
        topic: "range-deflection",
        ask: "I understand wanting to hear our number first — fair. Our band for this grade has a defined range; if you can share even a rough target, I can tell you straight away whether we're in the same ballpark.",
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
  const baseStretch = state.band.baseStretch ?? Math.round(total * 0.85 * 10) / 10;
  const variableMax =
    state.band.variableMax ?? Math.max(0, Math.round((total - baseStretch) * 10) / 10);
  const fixedLpa = Math.min(total, baseStretch);
  const variableLpa = Math.max(
    0,
    Math.min(variableMax, Math.round((total - fixedLpa) * 10) / 10),
  );
  return { fixedLpa, variableLpa };
}

function buildCloseRecapFormal(state: NegotiationState): PlannedAction {
  const total = state.highestOfferMade;
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

/* ───────────────────────────────────────────────────────────────────
 * Audit fix 2026-05-21 — CTC-inflation anchor planner helpers.
 *
 * Pure helpers that the cascade integration site (TBD) calls to (a)
 * decide whether to weaponise CTC-vs-in-hand confusion and (b) build
 * the inflated anchor action. Kept as separate exports so the lever +
 * prose surface ships cleanly today; full cascade integration is a
 * follow-up commit. See `_ctc-inflation.ts` for the breakdown math
 * and prose renderers.
 *
 * Detection contract (intentionally tight to avoid noise):
 *   1. The candidate has anchored a target (state.candidateTarget != null).
 *   2. The target is materially above the recruiter's initial offer
 *      (>= 1.3x), i.e. an "over-anchor".
 *   3. The candidate has not previously asked about the in-hand
 *      breakdown (in-hand-monthly / fixed-vs-variable infoAsked items).
 *   4. The recruiter has not already used this lever this session.
 * ─────────────────────────────────────────────────────────────────── */

import { buildCtcInflationBreakdown } from "./_ctc-inflation";

/** Pure: should the recruiter weaponise CTC-vs-in-hand confusion on the
 *  next turn? See the contract above.
 *
 *  Audit revision 2026-05-21 — tightened gate:
 *    - Phase MUST be counter-offer or closing-push (not pre-empting the
 *      first counter; the lever is a number-ship wrap on a SUBSEQUENT
 *      counter).
 *    - At least one `counter-base` lever must already have shipped.
 *
 *  Together these prevent the lever from intercepting the FIRST counter-
 *  offer (which previously displaced legitimate counter-base shipping in
 *  20+ existing tests). */
export function shouldFireCtcInflationAnchor(state: NegotiationState): boolean {
  if (state.phase !== "counter-offer" && state.phase !== "closing-push") return false;
  if (!state.leversUsed?.includes("counter-base")) return false;
  if (state.candidateTarget == null) return false;
  if (state.band == null) return false;
  if (!Number.isFinite(state.band.initialOffer) || state.band.initialOffer <= 0) return false;
  /* Class-A (2026-06-15) — detect over-anchoring on the CTC-equivalent target.
   * An in-hand-framed ask under-states against the (total) initialOffer, which
   * would under-detect the over-anchor this lever exists to teach. */
  const targetCtc = effectiveTargetCtcLpa(state) ?? state.candidateTarget;
  const overAnchor = targetCtc >= state.band.initialOffer * 1.3;
  if (!overAnchor) return false;
  /* Has the candidate already asked about the in-hand breakdown? If so,
   * the inflation lever is moot — the candidate has already exercised
   * the defence we're trying to teach. */
  const askedInHand =
    state.infoAsked?.includes("in-hand-monthly") ||
    state.infoAsked?.includes("fixed-vs-variable") ||
    state.infoAsked?.includes("compensation-breakdown");
  if (askedInHand) return false;
  /* Single-fire per session — `leversUsed` mirrors lever history. */
  if (state.leversUsed?.includes("ctc-inflation-anchor")) return false;
  return true;
}

/** Pure: build the CTC-inflation NextAction at the current anchor level.
 *  Uses the total-CTC-scoped target as the headline (the recruiter is
 *  matching the over-anchor on TOTAL package while the actual guaranteed
 *  cash is much lower). Class-A (2026-06-15): read the same accessor the
 *  firing gate (shouldFireCtcInflationAnchor) uses, so an in-hand-framed
 *  target drives the headline AND the gate off the same CTC-equivalent —
 *  otherwise the rebuttal anchored a 27L over-ask but rendered a 20L
 *  breakdown. Returns null when no target is set. */
export function planCtcInflationAnchor(state: NegotiationState): PlannedAction | null {
  const ctc =
    (state.band != null
      ? effectiveTargetCtcLpa(state)
      : statedTotalTargetCtcLpa(state)) ?? state.candidateTarget;
  if (ctc == null || !Number.isFinite(ctc) || ctc <= 0) return null;
  const br = buildCtcInflationBreakdown(ctc);
  return {
    kind: "ctc-inflation-anchor",
    ctcLpa: br.ctcLpa,
    fixedLpa: br.fixedLpa,
    variableLpa: br.variableLpa,
    esopPaperLpa: br.esopPaperLpa,
    joiningBonusLpa: br.joiningBonusLpa,
    benefitsLpa: br.benefitsLpa,
    _move: {
      lever: "ctc-inflation-anchor",
      newTotalLpa: br.ctcLpa,
      rationale:
        `CTC-inflation anchor at turn ${state.turnIndex}: candidate over-anchored ` +
        `(target ₹${ctc}L vs initial ₹${state.band?.initialOffer}L). Recruiter quotes ` +
        `total package broken into fixed/variable/ESOP-paper/JB/benefits to weaponise ` +
        `CTC-vs-in-hand confusion. Single-fire per session.`,
      actionKind: "ctc-inflation-anchor",
    },
  };
}

/** Pure: detect whether the candidate's last utterance is asking for the
 *  in-hand / breakdown information AFTER a ctc-inflation-anchor has been
 *  used. Caller passes the latest candidate utterance text. */
export function detectInHandFollowupAfterInflation(
  state: NegotiationState,
  candidateUtterance: string,
): boolean {
  if (!state.leversUsed?.includes("ctc-inflation-anchor")) return false;
  if (!candidateUtterance || typeof candidateUtterance !== "string") return false;
  return BREAKDOWN_ASK_RE.test(candidateUtterance);
}

/** Audit fix (2026-05-22) — breakdown/recap request regex, shared by the
 *  inflation-truth branch AND the new wider offer-breakdown disclosure
 *  branch. Matches all real-world phrasings: "in-hand", "breakdown",
 *  "what is base, variable, bonus", "summarize the offer", "split",
 *  "components", "structure of the offer", "recap".
 *
 *  Deliberately omits bare `\bbreakup\b` — "I've reviewed the breakup"
 *  is a past-tense observation, not an information request, and was
 *  false-firing on the happy-path E2E T5 (candidate counters on fixed,
 *  the planner read it as "ship a breakdown" and routed to inflation-
 *  truth with numbers below the band floor). The deeper anchor here:
 *  bare nouns are ambient, request VERBS (share, give, can you,
 *  what's, summarize) are what mark intent.
 *
 *  PDF#51 (2026-05-28) — the regex now lives in `_question-router.ts`
 *  as `BREAKDOWN_ASK_RE` so the unified router and the legacy helper
 *  share one source of truth. The re-export below keeps the existing
 *  public name + import sites stable. */
export { BREAKDOWN_ASK_RE as BREAKDOWN_REQUEST_RE } from "./_question-router";

/** Audit fix (2026-05-22) — detect ANY candidate breakdown / recap
 *  request. Used by the planner's offer-breakdown branch to ship a
 *  structured component breakdown EVEN when the prior offer wasn't a
 *  ctc-inflation-anchor. The user-reported transcript (Flipkart, T10/
 *  T12/T16, 2026-05-22) shows three consecutive breakdown requests
 *  going unanswered because the only breakdown path was gated on a
 *  prior inflation-anchor. */
export function detectOfferBreakdownRequest(
  candidateUtterance: string,
): boolean {
  if (!candidateUtterance || typeof candidateUtterance !== "string") return false;
  return BREAKDOWN_ASK_RE.test(candidateUtterance);
}

/** Pure: build the truthful follow-up action using the same numbers as
 *  the original inflation quote. The caller must pass the original
 *  headline CTC (typically state.candidateTarget at the time the
 *  inflation lever fired) so the numbers match byte-for-byte. */
export function planCtcInflationTruth(headlineCtcLpa: number): PlannedAction | null {
  if (!Number.isFinite(headlineCtcLpa) || headlineCtcLpa <= 0) return null;
  const br = buildCtcInflationBreakdown(headlineCtcLpa);
  return {
    kind: "ctc-inflation-truth",
    ctcLpa: br.ctcLpa,
    fixedLpa: br.fixedLpa,
    variableLpa: br.variableLpa,
    esopPaperLpa: br.esopPaperLpa,
    joiningBonusLpa: br.joiningBonusLpa,
    benefitsLpa: br.benefitsLpa,
    _move: {
      lever: "benefits-summary", // a truthful info turn, not a fresh anchor
      newTotalLpa: null,
      rationale:
        "CTC-inflation truth follow-up: candidate asked for the in-hand " +
        "breakdown after the inflated anchor. Recruiter answers truthfully " +
        "with the same underlying numbers; the lie was the framing.",
      actionKind: "ctc-inflation-truth",
    },
  };
}

/** Pure: build the straight-fitment breakdown action for a candidate who
 *  asked for the offer split when NO ctc-inflation anchor was weaponised.
 *  Derives fixed/variable from `deriveOfferFixedVariable` — the SAME
 *  source of truth the close-recap uses — so the disclosed split is
 *  consistent with the close numbers (no "fixed ₹19.9L" breakdown that
 *  contradicts a "Fixed ₹28.2L" close-recap). ESOP is NOT invented; any
 *  joining bonus already on the table is quoted on top. Returns null on
 *  a non-positive total. */
export function planOfferBreakdown(
  state: NegotiationState,
  totalLpa: number,
): PlannedAction | null {
  if (!Number.isFinite(totalLpa) || totalLpa <= 0) return null;
  const { fixedLpa, variableLpa } = deriveOfferFixedVariable(state, totalLpa);
  const total = Math.round(totalLpa * 10) / 10;
  const jb = state.lastJoiningBonusOffered;
  const joiningBonusLpa =
    jb != null && Number.isFinite(jb) && jb > 0 ? Math.round(jb * 10) / 10 : undefined;
  return {
    kind: "offer-breakdown",
    totalLpa: total,
    fixedLpa: Math.round(fixedLpa * 10) / 10,
    variableLpa: Math.round(variableLpa * 10) / 10,
    joiningBonusLpa,
    satisfiesTopic: "answer-direct",
    _move: {
      lever: "benefits-summary", // a truthful info turn, not a fresh anchor
      newTotalLpa: null,
      rationale:
        `Straight-fitment breakdown (no inflation anchor in play): disclose ₹${total}L as ` +
        `fixed ₹${Math.round(fixedLpa * 10) / 10}L + variable ₹${Math.round(variableLpa * 10) / 10}L ` +
        `— same split as the close-recap so the numbers stay consistent through to close.`,
      actionKind: "offer-breakdown",
    },
  };
}

/* 2026-05-30 conversational-realism — package-complexity helper shared
 * with the canonical-prose chain so both call sites compute the same
 * fallibility-overlay input. Mirrors `computePackageComplexity` in
 * `_canonical-prose.ts`. */
function computePackageComplexityLocal(state: NegotiationState): number {
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

