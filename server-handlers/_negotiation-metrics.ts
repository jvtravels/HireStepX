/* Kernel-aware negotiation metrics.
 * ─────────────────────────────────────────────────────────────────────
 * The transcript-driven analyzer in analyzers/salary-negotiation.ts
 * scores AI-side hallucinations and US-ism drift. It does NOT score the
 * candidate's negotiation behaviour, because that requires a structured
 * view of the session that the transcript alone doesn't expose:
 *   - Did the candidate anchor early, or wait to be probed?
 *   - How efficiently did they climb the band (LPA gained per turn)?
 *   - How diverse were the levers explored before closing?
 *   - Did they exit at acceptance, walkaway, or stalemate?
 *
 * The kernel knows all four from NegotiationState. These helpers
 * compute the metrics from the final state + the move history. Pure,
 * unit-tested. Designed so the report layer can call them without
 * needing to re-derive context.
 *
 * Wire-up note: this module is intentionally NOT yet imported by
 * SessionReportView / evaluate-session.ts. Landing the metrics + tests
 * first lets us validate the math; the UI layer adopts them in a
 * follow-up once kernel state is persisted alongside the transcript.
 */

import type {
  NegotiationState,
  NegotiationLever,
  NegotiationBand,
  VossTactic,
  InfoIntent,
  MarketMode,
} from "./_negotiation-kernel";

/* The candidate's effective TOTAL-CTC target, inlined from the kernel's
 * `effectiveTargetCtcLpa` (+ `statedTotalTargetCtcLpa`). This module is
 * dynamically imported on the CLIENT (useInterviewEngine), so it must
 * NOT take a runtime import on `_negotiation-kernel` — doing so drags the
 * entire 5000-line kernel into the client chunk and breaks the bundler
 * codegen (same import-hazard class as the _canonical-prose cycle).
 * Types are erased, so the `import type` above is safe; this small pure
 * fold is duplicated deliberately. Keep in sync with the kernel. */
function effectiveTargetCtcLpaLocal(state: NegotiationState): number | null {
  // statedTotalTargetCtcLpa: prefer the CTC-equivalent of an in-hand ask.
  if (state.candidateTarget != null) {
    if (state.candidateTargetIsInHand && state.candidateTargetCtcEquivalentLpa != null) {
      return state.candidateTargetCtcEquivalentLpa;
    }
    return state.candidateTarget;
  }
  // Fixed-only ask → implied total = fixed + band variable headroom.
  if (state.candidateTargetFixed != null) {
    return state.candidateTargetFixed + (state.band.variableMax ?? 0);
  }
  return null;
}
import {
  critiqueRecruiterStrategy,
  type RecruiterCritiqueItem,
} from "./_recruiter-critique";
import {
  analyzePivotalTurn,
  type PivotalTurn,
} from "./_pivotal-turn";

export interface KernelTurnSummary {
  /** The lever the AI pulled on this turn. */
  lever: NegotiationLever;
  /** Total CTC presented on this turn (LPA), or null for non-cash levers. */
  newTotalLpa: number | null;
  /** 0-indexed turn number. */
  turnIndex: number;
  /** Snapshot of candidateTarget at the time of this AI turn (may be null). */
  candidateTargetAtTurn: number | null;
}

export interface NegotiationMetricsInput {
  /** Final kernel state at session end. */
  finalState: NegotiationState;
  /** Move history in chronological order. */
  moves: ReadonlyArray<KernelTurnSummary>;
}

export interface NegotiationMetrics {
  /** Outcome bucket. Stalemate = ran out of turns; walked-away =
   *  explicit candidate exit; accepted = explicit candidate yes. */
  outcome: "accepted" | "walked-away" | "stalemate" | "in-progress";
  /** Turn index where the candidate first stated a target (0-indexed).
   *  null means they never anchored. Early anchoring (≤2) is generally
   *  stronger negotiation behaviour than late or never. */
  anchorTurn: number | null;
  /** Distinct levers the AI pulled this session. More diversity →
   *  richer practice exposure. Capped at the full lever list size. */
  leverDiversity: number;
  /** LPA gained from initial offer to highest offer made. */
  lpaGained: number;
  /** Average LPA gained per AI turn (lpaGained / countOfCashTurns).
   *  0 when no cash turns happened. */
  lpaPerTurn: number;
  /** % of the band traversed: (highest - initial) / (maxStretch - initial).
   *  Clamped to [0, 1]. 1.0 means the candidate pushed the AI to the
   *  ceiling. Null when band is degenerate (maxStretch ≤ initial). */
  bandTraversal: number | null;
  /** Did the AI ever offer above maxStretch? Should always be false —
   *  if true we have a kernel/post-LLM validation bug. */
  overBandViolation: boolean;
  /** Total AI turns counted. */
  totalTurns: number;
  /** Voss-style tactics the candidate actually used at least once
   *  (deduplicated across turns). Sourced from final kernel state. */
  vossTacticsUsed: ReadonlyArray<VossTactic>;
  /** Info intents the candidate raised — clawback, vest schedule, etc.
   *  Each represents a *good* question they thought to ask. */
  infoAsked: ReadonlyArray<InfoIntent>;
  /** S13-B9 — the subset of `infoAsked` the candidate raised on their OWN
   *  initiative (the recruiter did not solicit it on the prior turn). The
   *  report's "You justified your number" stage keys on THIS, so a
   *  recruiter-elicited disclosure is not miscredited as candidate-initiated
   *  justification. Subset of `infoAsked` by construction. */
  infoAskedInitiated: ReadonlyArray<InfoIntent>;
  /** True if the candidate walked away and returned. Rare and risky;
   *  surfaced separately so the report can call it out. */
  walkAwayReturned: boolean;
  /** True if the session ran with the hard band cap (services-co
   *  fitment pattern) — affects how we evaluate cash gains. */
  hardBandCap: boolean;
  /** Market mode the session simulated. Coaches reading the report
   *  need this to interpret bandTraversal — pushing 0.9 traversal in a
   *  hot market is different from doing so in a soft one. */
  marketMode: MarketMode;
  /** Phase 23 — recruiter-side strategy critique. Graded against the
   *  AI's own moves (anchoring, pacing, hold-firm credibility, etc.).
   *  Empty array = no detected mistakes. Pure derivation from the
   *  same final-state + move history; no transcript re-parse. */
  recruiterCritique: ReadonlyArray<RecruiterCritiqueItem>;
  /** Phase 24a — single pivotal turn for counterfactual coaching.
   *  Surfaces "the one moment that mattered most" rather than the
   *  whole list, so the post-session view stays focused. */
  pivotalTurn: PivotalTurn;
  /* ── Authoritative offer/ask numbers (2026-06-18) ──────────────────
   * The report's offer trajectory + close/stage detection used to be
   * re-derived by regex-scanning the transcript (adapter.ts
   * buildNegotiationOutcome). That heuristic silently failed on real
   * sessions — a session that closed at ₹25.2L rendered "0 of 5 stages,
   * didn't close, no counter named". The kernel already KNOWS these
   * numbers; persisting them lets the report adopt kernel truth instead
   * of guessing. Mirrors the adoptKernelBand fix for the Deal Summary
   * band. */
  /** The recruiter's opening offer (LPA) — band.initialOffer. */
  initialOfferLpa: number;
  /** The highest total CTC the recruiter put on the table (LPA). For an
   *  accepted deal this is the agreed number. */
  finalOfferLpa: number;
  /** The candidate's effective target CTC (LPA), folding a fixed-only ask
   *  into a total-equivalent. Null when they never anchored. */
  candidateAskLpa: number | null;
  /** Chronological cash offers the recruiter made (LPA), most-recent last.
   *  One entry per cash turn; non-cash lever turns are excluded. */
  offerTrajectoryLpa: ReadonlyArray<number>;
  /** S4S5-B3 — one-time joining bonus the recruiter last offered (LPA).
   *  Null when no joining bonus was ever offered. Distinct from the
   *  annual CTC total (`finalOfferLpa`) — persisted separately so the
   *  report can display "₹X CTC + ₹Y joining bonus" and the
   *  OfferEconomicsPanel can compute clawback-honest net value. */
  lastJoiningBonusOffered: number | null;
}

/** Compute kernel-aware metrics from final state + move history. Pure. */
export function computeNegotiationMetrics(input: NegotiationMetricsInput): NegotiationMetrics {
  const { finalState, moves } = input;
  const band: NegotiationBand = finalState.band;

  const outcome: NegotiationMetrics["outcome"] =
    finalState.phase === "accepted" ? "accepted"
    : finalState.phase === "walked-away" ? "walked-away"
    : finalState.phase === "stalemate" ? "stalemate"
    : "in-progress";

  /* First turn the candidateTarget transitioned from null → number.
     Reads off the snapshot in each move. */
  let anchorTurn: number | null = null;
  for (const m of moves) {
    if (m.candidateTargetAtTurn != null) {
      anchorTurn = m.turnIndex;
      break;
    }
  }

  const leverDiversity = new Set(moves.map((m) => m.lever)).size;

  /* Authoritative offer trajectory + ask — straight off the kernel, no
     transcript re-parse. Cash turns only (non-cash levers carry null). */
  const offerTrajectoryLpa = moves
    .map((m) => m.newTotalLpa)
    .filter((n): n is number => n != null);
  const candidateAskLpa = effectiveTargetCtcLpaLocal(finalState);

  /* The recruiter's realized top offer — the SINGLE source of truth for every
     concession-derived metric below (final offer, LPA gained, band traversal).
     It is the max of the recruiter's actual spoken numbers (the trajectory the
     offer-progression panel renders), NOT the raw highestOfferMade field.
     Rationale: the accept-on-band back-fill (_negotiation-kernel.ts:6046) can
     register the candidate's in-band TARGET into highestOfferMade without ever
     emitting a numeric move — a write that never enters the trajectory. Reading
     highestOfferMade for `lpaGained` while the progression panel reads the
     trajectory lets the two panels contradict (report shows "gained ₹15L" beside
     a flat ₹48→₹48→₹48 progression). Deriving both from the trajectory makes them
     consistent by construction. This is a strict no-op on every kernel-produced
     state: highestOfferMade only exceeds max(trajectory) via the !hasOffer-gated
     6046 path, which fires only when no numeric move exists (empty trajectory) —
     so whenever the trajectory is non-empty, max(trajectory) === highestOfferMade
     already. The empty-trajectory fallback keeps the legitimate pure accept-on-band
     close number (candidate accepted the band outright, no counter ever spoken). */
  const recruiterTopOfferLpa = offerTrajectoryLpa.length > 0
    ? Math.max(...offerTrajectoryLpa)
    : finalState.highestOfferMade;

  /* L-5 (2026-07-10, live staging — walk-away report 599e1c9f): `lpaGained`
     is "LPA gained ... over the opening offer" (see the outcome explanation
     in scoreNegotiationBehaviourDetailed) — the value the candidate NEGOTIATED,
     i.e. movement from the recruiter's first spoken offer to their top offer.
     Baselining it on `band.initialOffer` (the band FLOOR) instead over-credited
     every session where the recruiter opened ABOVE the floor: a Tough recruiter
     who opened at the ceiling (₹40.3, band ₹30.4–₹40.3) and never moved showed
     "LPA gained ₹9.9" on a WALK-AWAY, contradicting "Money left on the table",
     "0% gap closed", and "+7% pushed back" on the same report. Movement is
     top − first actual offer; when the recruiter opens exactly at the floor
     (the common case) first === band.initialOffer, so this is a no-op there.
     The empty-trajectory fallback preserves the pure accept-on-band close. */
  const recruiterFirstOfferLpa = offerTrajectoryLpa.length > 0
    ? offerTrajectoryLpa[0]
    : band.initialOffer;
  const lpaGained = Math.max(0, recruiterTopOfferLpa - recruiterFirstOfferLpa);
  const cashTurns = moves.filter((m) => m.newTotalLpa != null).length;
  const lpaPerTurn = cashTurns > 0 ? Math.round((lpaGained / cashTurns) * 100) / 100 : 0;

  /* Band traversal is a POSITION metric — how high in the band the final offer
     sits — distinct from lpaGained (movement). It stays keyed on band.initialOffer
     so it is unchanged by the L-5 fix above (it previously read lpaGained/spread,
     and old lpaGained === recruiterTopOfferLpa − band.initialOffer, so this is the
     identical value). Kept explicit so the two metrics can no longer drift. */
  const spread = band.maxStretch - band.initialOffer;
  const bandTraversal = spread > 0
    ? Math.max(0, Math.min(1, (recruiterTopOfferLpa - band.initialOffer) / spread))
    : null;

  const overBandViolation = moves.some(
    (m) => m.newTotalLpa != null && m.newTotalLpa > band.maxStretch + 0.01,
  );

  return {
    outcome,
    anchorTurn,
    leverDiversity,
    lpaGained: Math.round(lpaGained * 100) / 100,
    lpaPerTurn,
    bandTraversal: bandTraversal == null ? null : Math.round(bandTraversal * 100) / 100,
    overBandViolation,
    totalTurns: moves.length,
    vossTacticsUsed: [...(finalState.vossTacticsUsed ?? [])],
    infoAsked: [...(finalState.infoAsked ?? [])],
    infoAskedInitiated: [...(finalState.infoAskedInitiated ?? [])],
    walkAwayReturned: finalState.walkAwayReturned ?? false,
    hardBandCap: finalState.hardBandCap ?? false,
    marketMode: finalState.marketMode ?? "neutral",
    recruiterCritique: critiqueRecruiterStrategy({ finalState, moves }),
    pivotalTurn: analyzePivotalTurn({ finalState, moves }),
    initialOfferLpa: band.initialOffer,
    finalOfferLpa: recruiterTopOfferLpa,
    candidateAskLpa,
    offerTrajectoryLpa,
    lastJoiningBonusOffered:
      typeof finalState.lastJoiningBonusOffered === "number" &&
      finalState.lastJoiningBonusOffered > 0
        ? finalState.lastJoiningBonusOffered
        : null,
  };
}

/** Phase 20 — per-component score breakdown for the report layer.
 *  Each entry: how many points the candidate earned out of how many
 *  available, plus a one-line explanation. Lets the UI render
 *  "you lost X because Y" instead of an opaque 0-100 number. */
export interface ScoreComponent {
  /** Stable identifier (UI can map to icon / label). */
  key: "anchoring" | "band-traversal" | "lever-diversity" | "outcome" | "over-band-penalty";
  /** Human-friendly label for the report. */
  label: string;
  /** Points earned in this component (negative for penalties). */
  points: number;
  /** Maximum points available (0 for penalty-only components). */
  max: number;
  /** Why the candidate earned (or lost) these points. */
  explanation: string;
}

export interface ScoredNegotiation {
  /** Total 0–100 score (same as the legacy scalar). */
  score: number;
  /** Per-component breakdown for explainability. */
  breakdown: ReadonlyArray<ScoreComponent>;
}

/** Map a metrics snapshot to a 0–100 candidate-behaviour score with
 *  per-component breakdown. The weighting is editorial: anchoring
 *  matters most (you can't negotiate without a number), then traversal
 *  (did you push?), then diversity (did you explore non-cash levers?),
 *  then outcome (acceptance is a multiplier, walkaway is neutral,
 *  stalemate is a slight penalty). */
export function scoreNegotiationBehaviourDetailed(
  m: Pick<NegotiationMetrics,
    | "anchorTurn" | "bandTraversal" | "leverDiversity" | "outcome" | "overBandViolation"
    | "lpaGained" | "lpaPerTurn" | "totalTurns">,
): ScoredNegotiation {
  const breakdown: ScoreComponent[] = [];

  /* Anchoring: 30 pts, front-loaded on early turns. */
  let anchorPts = 0;
  let anchorExpl: string;
  if (m.anchorTurn == null) {
    anchorPts = 0;
    anchorExpl = "Never anchored — the recruiter never had a candidate number to react to. Anchor in the first 1–2 turns next time.";
  } else if (m.anchorTurn <= 1) {
    anchorPts = 30;
    anchorExpl = `Anchored on turn ${m.anchorTurn} — strong early anchor, full credit.`;
  } else if (m.anchorTurn <= 3) {
    anchorPts = 22;
    anchorExpl = `Anchored on turn ${m.anchorTurn} — good, but earlier (turn 0–1) would lock the recruiter's mental band sooner.`;
  } else if (m.anchorTurn <= 5) {
    anchorPts = 14;
    anchorExpl = `Anchored on turn ${m.anchorTurn} — late. By this point the recruiter has framed the band; you're reacting, not setting.`;
  } else {
    anchorPts = 8;
    anchorExpl = `Anchored on turn ${m.anchorTurn} — very late. Most of the value is set in the first 3 turns; this gives up that leverage.`;
  }
  breakdown.push({ key: "anchoring", label: "Anchoring", points: anchorPts, max: 30, explanation: anchorExpl });

  /* Band traversal: up to 30 pts, linear in fraction climbed. */
  let traversalPts = 0;
  let traversalExpl: string;
  if (m.bandTraversal == null) {
    traversalExpl = "Band traversal not measurable (degenerate band).";
  } else {
    traversalPts = Math.round(m.bandTraversal * 30);
    const pct = Math.round(m.bandTraversal * 100);
    if (m.bandTraversal >= 0.85) {
      traversalExpl = `Pushed the recruiter to ${pct}% of the band — near the ceiling. You captured almost all the available upside.`;
    } else if (m.bandTraversal >= 0.5) {
      traversalExpl = `Climbed ${pct}% of the band — solid push. Each additional ask explored (joining bonus, equity, retention) could have squeezed more.`;
    } else if (m.bandTraversal > 0) {
      traversalExpl = `Climbed only ${pct}% of the band — you left meaningful room on the table. Counter at least once more next time.`;
    } else {
      traversalExpl = "Took the opening offer — zero band traversal. Always counter once, even if just to test the ceiling.";
    }
  }
  breakdown.push({ key: "band-traversal", label: "Band traversal", points: traversalPts, max: 30, explanation: traversalExpl });

  /* Lever diversity: 1 lever = 5, 2 = 10, 3 = 15, 4+ = 20. */
  const diversityPts = Math.min(20, m.leverDiversity * 5);
  const diversityExpl = m.leverDiversity <= 1
    ? `Only ${m.leverDiversity} lever explored — the negotiation stayed one-dimensional. Try joining bonus, equity refresh, start date, retention bonus.`
    : m.leverDiversity <= 2
      ? `${m.leverDiversity} levers explored — getting there. The strongest sessions touch 3–4 non-cash levers in addition to base.`
      : `${m.leverDiversity} levers explored — good range, recruiter saw a sophisticated counterpart.`;
  breakdown.push({ key: "lever-diversity", label: "Lever diversity", points: diversityPts, max: 20, explanation: diversityExpl });

  /* Outcome modifier (max 20). */
  let outcomePts = 0;
  let outcomeExpl: string;
  switch (m.outcome) {
    case "accepted":
      outcomePts = 20;
      outcomeExpl = `Accepted at +₹${m.lpaGained}L over the opening offer — landed the deal.`;
      break;
    case "walked-away":
      outcomePts = 10;
      outcomeExpl = "Walked away — neutral. Disciplined exit can be the right call; partial credit because we don't know what they would have escalated to.";
      break;
    case "stalemate":
      outcomePts = 5;
      outcomeExpl = "Ran out of turns without resolution. Push to either close or explicitly walk; stalemates leave value on the table.";
      break;
    case "in-progress":
      outcomePts = 0;
      outcomeExpl = "Session did not reach an outcome.";
      break;
  }
  breakdown.push({ key: "outcome", label: "Outcome", points: outcomePts, max: 20, explanation: outcomeExpl });

  /* Hard penalty: over-band offers are a kernel bug AND inflate the
     candidate's perceived win. Apply as a separate negative component
     so the report can show the user it happened. */
  let raw = anchorPts + traversalPts + diversityPts + outcomePts;
  if (m.overBandViolation) {
    breakdown.push({
      key: "over-band-penalty",
      label: "Over-band penalty",
      points: -25,
      max: 0,
      explanation: "Recruiter offered above the published ceiling — kernel guardrail violation. Score reduced so the bug doesn't inflate perceived skill.",
    });
    raw -= 25;
  }

  const score = Math.max(0, Math.min(100, raw));
  return { score, breakdown };
}

/** Calibrated-surprise lowball event builder (2026-05-29).
 *
 * Closes the report-integration gap: kernel state already tracks
 * `calibratedSurpriseFired`, `acceptedLowball`, and the
 * `calibratedSurpriseContext` { candidateAnchor, bandFloor } slice,
 * but no callsite yet projects them onto the report-shaped
 * `NegotiationOutcome.lowballEvent`. This is that projection.
 *
 * Returns undefined when the surprise probe did NOT fire — by
 * construction the panel only renders the coaching note when the
 * recruiter actually probed. `gapPct` is derived here (kernel context
 * carries the raw anchor + floor; the percentage is a presentation
 * concern). */
export interface LowballEvent {
  candidateAnchor: number;
  bandFloor: number;
  gapPct: number;
  recruiterProbed: boolean;
  candidateHeld: boolean;
}

export function buildLowballEvent(
  state: NegotiationState,
): LowballEvent | undefined {
  if (state.calibratedSurpriseFired !== true) return undefined;
  /* Prefer the context snapshot taken at probe-fire time — it pins the
   * exact numbers the probe measured against, even if the candidate
   * later revises their anchor (Branch B). Fall back to live state for
   * sessions persisted before the context was introduced. */
  const ctx = state.calibratedSurpriseContext ?? null;
  const candidateAnchor =
    ctx?.candidateAnchor ??
    state.userClaims?.expectedCtc?.value ??
    state.candidateTarget ??
    0;
  const bandFloor =
    ctx?.bandFloor ??
    state.band?.walkAway ??
    state.band?.initialOffer ??
    0;
  const gapPct =
    bandFloor > 0
      ? Math.max(0, (bandFloor - candidateAnchor) / bandFloor)
      : 0;
  return {
    candidateAnchor,
    bandFloor,
    gapPct,
    recruiterProbed: true,
    candidateHeld: state.acceptedLowball === true,
  };
}

/* Recruiter-power-dynamics feature (2026-05-29) — outcome projection.
 * Returns undefined when no signals were supplied AND no mid-session
 * detection flipped candidateHasCompetingProcess (i.e. the signal bundle
 * is fully empty). Posture is derived from the scalar; candidateLeverage
 * is the inverse. */
export interface PowerContext {
  recruiterPower: number;
  signals: {
    openReqMonths?: number;
    pipelineDepth?: number;
    quarterTiming?: "fresh-quarter" | "mid-quarter" | "quarter-end" | "annual-sprint";
    candidateHasCompetingProcess?: boolean;
  };
  posture: "strong" | "neutral" | "hungry";
  candidateLeverage: "low" | "neutral" | "high";
}

export function buildPowerContext(
  state: NegotiationState,
): PowerContext | undefined {
  const signals = state.powerSignals ?? {};
  const hasAny =
    signals.openReqMonths !== undefined ||
    signals.pipelineDepth !== undefined ||
    signals.quarterTiming !== undefined ||
    signals.candidateHasCompetingProcess !== undefined;
  if (!hasAny) return undefined;
  const power = state.recruiterPower ?? 0;
  const posture: PowerContext["posture"] =
    power >= 2 ? "strong" : power <= -2 ? "hungry" : "neutral";
  const candidateLeverage: PowerContext["candidateLeverage"] =
    posture === "strong" ? "low" : posture === "hungry" ? "high" : "neutral";
  return {
    recruiterPower: power,
    signals: { ...signals },
    posture,
    candidateLeverage,
  };
}

/** Legacy scalar API — preserved for callers that only want the number. */
export function scoreNegotiationBehaviour(
  m: Pick<NegotiationMetrics,
    | "anchorTurn" | "bandTraversal" | "leverDiversity" | "outcome" | "overBandViolation"
    | "lpaGained" | "lpaPerTurn" | "totalTurns">,
): number {
  return scoreNegotiationBehaviourDetailed(m).score;
}
