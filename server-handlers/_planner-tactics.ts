/* Next-action planner: prior-context callbacks, tactic injection, anchor clamps, structural levers. */

import { type NegotiationState, isTerminalPhase, type DiscoveryTopic, type NegotiationPhase, effectiveTargetCtcLpa, type AiMove, totalScopedCounter } from "./_negotiation-kernel";
import type { PlannedAction, TacticKind } from "./_planner-actions";
import { displayCompany } from "./_competing-offer-detail";
import { latestCandidateText, isSalaryPush } from "./_question-router";
import { undeliverableFixedConditionAsk, MIN_COUNTER_ROUNDS_BEFORE_HOLD_FIRM } from "./_planner-close";

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
        company: displayCompany(off.company),
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
        company: displayCompany(off.company),
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
    company: displayCompany(co.value.company),
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
export function tacticHash(sessionId: string | null | undefined, salt: string): number {
  const s = `${sessionId ?? ""}|${salt}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Cross-session bad-faith-tactic VARIANT selector (2026-06-20, #107).
 *
 *  Picks which deadline / line / topic a single-fire tactic uses this
 *  session, out of `n` options. When the session carries a
 *  `tacticRotation` cursor (seeded once at init in _scenario-seed.ts as
 *  `fnv1a(userId|"tactic") + priorNegotiationCount`), the variant is
 *  `(cursor + familySalt) % n`. Because the cursor advances by exactly 1
 *  each session, a returning user lands on a DIFFERENT variant every
 *  session and cycles the whole set before any repeat — true cross-session
 *  anti-repetition, deterministic in (userId, count). `familySalt`
 *  de-syncs the three tactic families so they don't all step together.
 *
 *  Fallback: states with no `tacticRotation` (hand-built test fixtures,
 *  pre-#107 serialized sessions, anonymous-with-no-seed paths) keep the
 *  legacy session-local `tacticHash(sessionId, …)` seeding unchanged, so
 *  no existing behaviour or test moves. Pure. */
export function rotatedTacticVariant(
  state: NegotiationState,
  familySalt: number,
  legacySalt: string,
  n: number,
): number {
  const cursor = state.tacticRotation;
  if (cursor == null || !Number.isFinite(cursor)) {
    return tacticHash(state.sessionId, legacySalt) % n;
  }
  return ((Math.floor(cursor) + familySalt) % n + n) % n;
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
    const pick = deadlines[rotatedTacticVariant(state, 0, "exploding-offer-deadline", 3)];
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
      variant: rotatedTacticVariant(state, 1, "fake-competing-variant", 5),
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
      const pick = topics[rotatedTacticVariant(state, 2, "vague-promise-topic", 3)];
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

export function pickStructuralLever(state: NegotiationState): PlannedAction | null {
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
    /* S44-B9 (2026-07-23) — gate perf-bonus cadence lever on the band actually
     * having a variable component. If variableMax is 0/absent the band is all-
     * fixed, so saying "performance bonus paid at March appraisal cycle" and
     * then later "no variable component on this grade" (offer-breakdown) are
     * internally contradictory. Only offer the lever when variableMax > 0. */
    { kind: "lever-perf-bonus-cadence", gated: !(typeof state.band.variableMax === "number" && state.band.variableMax > 0) },
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

export type StructuralLeverKind =
  | "band-anchor-with-rationale"
  | "lever-grade-upgrade"
  | "lever-retention-bonus"
  | "lever-rsu-refresh"
  | "lever-relocation"
  | "lever-perf-bonus-cadence"
  | "lever-work-mode"
  | "lever-growth-path"
  | "lever-joining-bonus-explained";

export function makeStructuralLeverAction(
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

export function wrapLeverExplore(
  move: AiMove,
  from: "hard-band-cap" | "no-headroom" | "constraint-violation" | "default",
  state: NegotiationState,
): PlannedAction {
  /* PRI-59 — when this rotation is the answer to an explicit, numberless cash
   * push over a standing offer, flag the renderer to name the cash ceiling
   * first. The numbered-push case is handled by canonical-prose's counterAck
   * (lastCandidateCounterLpa), so this only covers the numberless demand
   * ("put your best fixed on the table") that would otherwise get a silent
   * perk pivot.
   *
   * B2 (2026-07-23) — replaced `state.lastCandidateCounterLpa == null` with
   * `totalScopedCounter(state) == null`. The raw field persists across turns
   * (cleared by applyAiMove, but stale if that cycle was skipped or if a
   * fixed-scoped counter was set and the candidate later switches to a
   * numberless push without restating a number). totalScopedCounter is both
   * scope-aware (null for fixed counters) and the canonical source for "did
   * the candidate name a TOTAL this turn" — using it here keeps the
   * cashPushNamesCeiling flag consistent with every other total-vs-fixed
   * gate in the planner. */
  const cashPushNamesCeiling =
    state.highestOfferMade > 0 &&
    totalScopedCounter(state) == null &&
    isSalaryPush(latestCandidateText(state));
  /* PRI-60 — single source for the total-vs-fixed scope reconciliation figure.
   * Non-null only when the candidate's pinned fixed close-ask cannot be
   * delivered as cash over the standing total offer.
   *
   * PRI-65 (2026-06-26, pri59 sim repro) — `undeliverableFixedConditionAsk`
   * reads the STICKY `candidateTargetFixed`, so once a candidate pins a fixed
   * close ("get the fixed to ₹58L, then we have a deal") that figure replays
   * the "On closing at ₹58L fixed —" scope-reconcile line on EVERY later turn,
   * including fresh numberless cash pushes that never restated it ("put your
   * best fixed on the table", "forget the perks, best fixed?"). That reads as a
   * broken record fixated on a stale number. A numberless cash push has dropped
   * the specific figure and just wants the best the band can do — the correct
   * register is the cash-ceiling ack (name where the base sits now), not a
   * re-litigation of the old ask. So the cash-push flag wins: it suppresses the
   * stale scope-reconcile line and the two acks stay mutually exclusive. The
   * genuine numbered scope-reconcile case still fires — it carries
   * `lastCandidateCounterLpa`/isn't a bare push, so cashPushNamesCeiling is
   * false there. */
  const fixedAskAboveBand =
    state.highestOfferMade > 0 && !cashPushNamesCeiling
      ? (undeliverableFixedConditionAsk(state) ?? undefined)
      : undefined;
  return {
    kind: "lever-explore",
    from,
    leverKind: move.lever,
    joiningBonusLpa: move.joiningBonusAmount,
    cashPushNamesCeiling,
    fixedAskAboveBand,
    _move: move,
  };
}

/** Phase 28 (2026-05-13) — compute the joining-bonus amount. See original
 *  in _kernel-move-picker.ts for full sizing rationale. Duplicated here
 *  rather than imported because the move-picker's copy is module-private
 *  and the planner is the new home for "what move next" logic. */
export function computeJoiningBonusAmount(state: NegotiationState): number {
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

export function pickLeverExploreMove(state: NegotiationState): AiMove {
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
