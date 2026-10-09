/* Next-action planner: NextAction / PlannedAction shapes, topic refire rules, ladder steps. */

import { marketDataSources } from "./_candidate-profile";
import type { DiscoveryTopic, NegotiationState, NegotiationLever, ContradictionTopic, AiMove } from "./_negotiation-kernel";
import { askedTopicEntries } from "./_conversation-ledger";
import type { CandidateQuestionTopic } from "./_candidate-question";
import type { NegotiationRoundPersona } from "./_negotiation-rounds";

export const NON_CASH_DEMAND_REASONS = new Set([
  "grant-sweetener",
  "sweetener-demand",
  "title-upgrade",
]);

/** Polish 3 (2026-05-16) — render the reactive followup for a
 *  candidate who cited external market data. When the candidate named
 *  specific sources (AmbitionBox, Naukri, Blind, ...), the line cites
 *  them verbatim using the `marketDataSources` map so the recruiter
 *  sounds like they actually heard the candidate. When the source
 *  list is empty (generic "market data" framing), falls back to a
 *  source-agnostic line. */
export function buildMarketDataReferenceAsk(sources: string[]): string {
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
export function readAskedTopics(
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
  | {
      kind: "close";
      mode: "accept" | "walkaway" | "stalemate";
      /* PRI-63 (2026-06-25) — one-time joining bonus (LPA) granted to
       * satisfy a conditional acceptance ("if you throw in a joining
       * bonus I can make it work"). Carried at the action level (not just
       * on _move) so the close prose can verbally confirm the sweetener
       * at close time — the prose renders BEFORE applyAiMove stamps
       * lastJoiningBonusOffered, so reading it off state would be null. */
      joiningBonusGranted?: number;
    }
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
      /* PRI-59 (2026-06-25) — set when this lever-explore is the response to
       * an explicit cash/fixed PUSH that named NO number (the numbered case is
       * already engaged by canonical-prose's counterAck). Tells the renderer
       * to LEAD with a named cash-ceiling acknowledgment (the standing fixed
       * figure + that the base is at the band edge) before pivoting to the
       * non-cash lever, so a direct cash demand never gets a silent perk
       * rotation. */
      cashPushNamesCeiling?: boolean;
      /* PRI-60 (2026-06-25) — set to the candidate's pinned FIXED close-ask
       * figure when that figure is undeliverable as pure cash over the standing
       * TOTAL offer (an equity/variable-inclusive total being asked as fixed —
       * `undeliverableFixedConditionAsk`). Tells the renderer to RECONCILE the
       * scope out loud: name that the standing figure is total (not all fixed)
       * so the asked number sits above the cash band, before pivoting to a
       * non-cash lever. Prevents the silent total→fixed over-concession. */
      fixedAskAboveBand?: number;
    }
  | { kind: "hold-firm"; mode: "verbal-accept" | "lever-loop";
      /** S23-B1 (2026-07-21) — when true, the candidate asked for thinking
       *  time and the recruiter is granting it ("time-bridge" response). */
      grantTime?: boolean }
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
      /* PRI-54a (2026-06-22) — ESOP recap fix. When the equity-grant
       * lever actually fired during the session (RSU/ESOP top-up offered
       * "over and above the cash fitment"), the accepted package includes
       * equity — but the recap previously enumerated only cash components
       * and silently dropped it, recording an incomplete fitment. Set ONLY
       * when state.leversUsed.includes("equity-grant") && band.hasEquity,
       * so it can never fabricate equity the recruiter never put on the
       * table (mirrors the recap-hallucination guard above). */
      equityGranted?: boolean;
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
export type PlannedAction = NextAction & { _move: AiMove };
