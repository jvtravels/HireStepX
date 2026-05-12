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

  const lpaGained = Math.max(0, finalState.highestOfferMade - band.initialOffer);
  const cashTurns = moves.filter((m) => m.newTotalLpa != null).length;
  const lpaPerTurn = cashTurns > 0 ? Math.round((lpaGained / cashTurns) * 100) / 100 : 0;

  const spread = band.maxStretch - band.initialOffer;
  const bandTraversal = spread > 0
    ? Math.max(0, Math.min(1, lpaGained / spread))
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
    walkAwayReturned: finalState.walkAwayReturned ?? false,
    hardBandCap: finalState.hardBandCap ?? false,
    marketMode: finalState.marketMode ?? "neutral",
  };
}

/** Map a metrics snapshot to a 0–100 candidate-behaviour score. The
 *  weighting is editorial: anchoring matters most (you can't negotiate
 *  without a number), then traversal (did you push?), then diversity
 *  (did you explore non-cash levers?), then outcome (acceptance is a
 *  multiplier, walkaway is neutral, stalemate is a slight penalty). */
export function scoreNegotiationBehaviour(
  m: Pick<NegotiationMetrics,
    | "anchorTurn" | "bandTraversal" | "leverDiversity" | "outcome" | "overBandViolation"
    | "lpaGained" | "lpaPerTurn" | "totalTurns">,
): number {
  let score = 0;

  /* Anchoring: 30 pts, front-loaded on early turns. */
  if (m.anchorTurn != null) {
    if (m.anchorTurn <= 1) score += 30;
    else if (m.anchorTurn <= 3) score += 22;
    else if (m.anchorTurn <= 5) score += 14;
    else score += 8;
  }

  /* Band traversal: up to 30 pts, linear in fraction climbed. */
  if (m.bandTraversal != null) score += Math.round(m.bandTraversal * 30);

  /* Lever diversity: 1 lever = 5, 2 = 10, 3 = 15, 4+ = 20. */
  score += Math.min(20, m.leverDiversity * 5);

  /* Outcome modifier (max 20). */
  switch (m.outcome) {
    case "accepted":     score += 20; break;
    case "walked-away":  score += 10; break;
    case "stalemate":    score += 5;  break;
    case "in-progress":  score += 0;  break;
  }

  /* Hard penalty: over-band offers are a kernel bug AND inflate the
     candidate's perceived win. Zero them out so the bug doesn't pay. */
  if (m.overBandViolation) score = Math.max(0, score - 25);

  return Math.max(0, Math.min(100, score));
}
