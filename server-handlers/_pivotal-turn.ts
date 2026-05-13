/* Pivotal-turn analyzer — Phase 24a (2026-05-13).
 * ─────────────────────────────────────────────────────────────────────
 * Phase 20 added rewrite suggestions ("here's what to say NOW"). Phase
 * 23 graded the recruiter's moves. Neither answered the question a
 * learner actually asks after a bad session:
 *
 *   "Where did I lose leverage?"
 *
 * This module replays the move history and identifies the single turn
 * where the candidate's leverage degraded the most, then attaches a
 * coach's-voice counterfactual ("turn N was where you lost ground —
 * here's what happened, and here's what you should have done").
 *
 * "Leverage" is modelled simply:
 *   leverage(turn) = (candidateTarget_at_turn - highestOffer_so_far) / spread
 * where spread = maxStretch - initialOffer. Higher = more room to
 * climb. The pivotal turn is the one where leverage dropped the
 * most negatively — or, when leverage stayed flat, the latest turn
 * a red-flag-worthy stance signal first fired.
 *
 * Output is at most ONE PivotalTurn per session. Surfacing 4-5 "here's
 * where you went wrong" notes is noise; one well-chosen one is signal.
 */

import type { NegotiationState } from "./_negotiation-kernel";
import type { CandidateStanceResult } from "./_candidate-stance";
import type { KernelTurnSummary } from "./_negotiation-metrics";

export type PivotalTurnReason =
  | "leverage-collapse" // negotiation room shrank in a single turn
  | "anchor-too-late"   // candidate first stated target after band was already mostly traversed
  | "stance-breach"     // a red-flag-grade stance fired (desperate / badmouth / etc.)
  | "no-anchor";        // candidate never anchored — different problem class

export interface PivotalTurn {
  /** 0-indexed turn the pivotal moment occurred (null when no-anchor). */
  turnIndex: number | null;
  /** Why this turn was pivotal. */
  reason: PivotalTurnReason;
  /** Numeric leverage delta (negative = lost ground). null for no-anchor. */
  leverageDelta: number | null;
  /** Coach's-voice explanation + counterfactual ("you should have…"). */
  detail: string;
  /** Optional: the specific stance code that fired, if reason is stance-breach. */
  stanceCode?: string;
}

export interface PivotalTurnInput {
  finalState: NegotiationState;
  moves: ReadonlyArray<KernelTurnSummary>;
  /** Optional per-turn stance snapshots, keyed by turnIndex. If the
   *  caller doesn't track these, we fall back to the final stance
   *  with reason="stance-breach" but turnIndex=last cash turn. */
  stanceByTurn?: ReadonlyMap<number, CandidateStanceResult>;
}

function spread(state: NegotiationState): number {
  return state.band.maxStretch - state.band.initialOffer;
}

function computeLeverage(
  candidateTarget: number | null,
  highestOfferSoFar: number,
  s: number,
): number | null {
  if (candidateTarget == null || s <= 0) return null;
  return (candidateTarget - highestOfferSoFar) / s;
}

export function analyzePivotalTurn(input: PivotalTurnInput): PivotalTurn {
  const { finalState, moves, stanceByTurn } = input;
  const s = spread(finalState);

  /* No-anchor case dominates everything else. */
  const everAnchored = moves.some((m) => m.candidateTargetAtTurn != null);
  if (!everAnchored) {
    return {
      turnIndex: null,
      reason: "no-anchor",
      leverageDelta: null,
      detail:
        "You never anchored a target this session. The pivotal moment was the missing turn — without a candidate number, the recruiter's band becomes the only number in the room. Next session: anchor by turn 1 with \"based on market for <role> at <tier>, I'm targeting ₹X-Y LPA fixed.\"",
    };
  }

  /* Replay leverage turn-by-turn. */
  let highestOfferSoFar = finalState.band.initialOffer;
  let prevLeverage: number | null = null;
  let worstDeltaTurn: number | null = null;
  let worstDelta = 0;

  for (const mv of moves) {
    if (mv.newTotalLpa != null && mv.newTotalLpa > highestOfferSoFar) {
      highestOfferSoFar = mv.newTotalLpa;
    }
    const lev = computeLeverage(mv.candidateTargetAtTurn, highestOfferSoFar, s);
    if (lev != null && prevLeverage != null) {
      const delta = lev - prevLeverage;
      if (delta < worstDelta) {
        worstDelta = delta;
        worstDeltaTurn = mv.turnIndex;
      }
    }
    if (lev != null) prevLeverage = lev;
  }

  /* Stance breach — check per-turn snapshots if available; otherwise
   * fall back to the final aggregated stance attributed to the latest
   * meaningful turn. A breach beats a flat-leverage collapse. */
  const breachCodes = (
    [
      "soundsDesperate",
      "badmouthsCurrent",
      "salaryOnlyFactor",
      "confidentialOvershare",
      "personalExpenseJustification",
      "offerShoppingDemand",
    ] as const
  );

  if (stanceByTurn) {
    let firstBreachTurn: number | null = null;
    let firstBreachCode: string | null = null;
    /* Sort by turn ascending */
    const turns = [...stanceByTurn.keys()].sort((a, b) => a - b);
    for (const t of turns) {
      const stance = stanceByTurn.get(t)!;
      const hit = breachCodes.find((c) => stance[c] === true);
      if (hit) {
        firstBreachTurn = t;
        firstBreachCode = hit;
        break;
      }
    }
    if (firstBreachTurn != null && firstBreachCode != null) {
      return {
        turnIndex: firstBreachTurn,
        reason: "stance-breach",
        leverageDelta: null,
        stanceCode: firstBreachCode,
        detail: stanceBreachExplanation(firstBreachCode, firstBreachTurn),
      };
    }
  } else {
    const stance = finalState.candidateStance;
    const hit = breachCodes.find((c) => stance[c] === true);
    if (hit) {
      const fallbackTurn =
        moves.length > 0 ? moves[moves.length - 1].turnIndex : null;
      return {
        turnIndex: fallbackTurn,
        reason: "stance-breach",
        leverageDelta: null,
        stanceCode: hit,
        detail: stanceBreachExplanation(hit, fallbackTurn),
      };
    }
  }

  /* Anchor-too-late: candidate anchored after the AI had already moved
   * past 60% of the band. */
  const firstAnchor = moves.find((m) => m.candidateTargetAtTurn != null);
  if (firstAnchor && s > 0) {
    const offerAtAnchor = moves
      .slice(0, moves.indexOf(firstAnchor) + 1)
      .reduce((acc, m) => (m.newTotalLpa != null && m.newTotalLpa > acc ? m.newTotalLpa : acc), finalState.band.initialOffer);
    const traversedAtAnchor = (offerAtAnchor - finalState.band.initialOffer) / s;
    if (traversedAtAnchor >= 0.6) {
      return {
        turnIndex: firstAnchor.turnIndex,
        reason: "anchor-too-late",
        leverageDelta: null,
        detail: `By turn ${firstAnchor.turnIndex}, the recruiter had already moved you ${(traversedAtAnchor * 100).toFixed(0)}% across the band before you stated a number. Anchoring sets the ceiling of the conversation — when you anchor late, you're negotiating inside the recruiter's frame, not yours. Next time, anchor in turn 0-1: "Based on <market data>, I'm targeting ₹X-Y LPA fixed."`,
      };
    }
  }

  /* Leverage collapse — the single worst turn-over-turn drop.
   * Threshold: -0.3 (≥30% of band lost in a single turn). Smaller
   * drops are routine negotiation pacing. */
  if (worstDeltaTurn != null && worstDelta < -0.3) {
    return {
      turnIndex: worstDeltaTurn,
      reason: "leverage-collapse",
      leverageDelta: Math.round(worstDelta * 100) / 100,
      detail: `Turn ${worstDeltaTurn} was your leverage-loss moment — the gap between your target and the recruiter's offer closed by ${Math.abs(Math.round(worstDelta * 100))}% of the band in one exchange without a corresponding concession from them. Likely cause: you accepted a counter at face value instead of asking "what's the full breakup?" or "is there room on joining bonus / equity?" before saying yes.`,
    };
  }

  /* Clean session — no pivotal turn found. */
  return {
    turnIndex: null,
    reason: "leverage-collapse",
    leverageDelta: 0,
    detail:
      "No single turn stood out as a leverage-loss moment — the negotiation progressed at a reasonable pace.",
  };
}

function stanceBreachExplanation(code: string, turn: number | null): string {
  const where = turn != null ? `turn ${turn}` : "this session";
  switch (code) {
    case "soundsDesperate":
      return `Pivotal moment was ${where}: you signalled desperation ("really need this job" / "I'll take anything"). Recruiters read this as "discount available" — the offer ceiling drops the moment desperation lands. Counterfactual: ground the same constraint in market data ("I'm targeting ₹X based on peer offers") instead of personal urgency.`;
    case "badmouthsCurrent":
      return `Pivotal moment was ${where}: you badmouthed your current employer. Two costs — the recruiter now wonders what you'll say about them next, AND your stated reason-to-move shifts from "growth" to "escape", which weakens the comp argument. Counterfactual: frame as "the role doesn't match where I want to grow" instead of "the company is toxic."`;
    case "salaryOnlyFactor":
      return `Pivotal moment was ${where}: you framed salary as the only factor. This shifts the conversation from "best mutual fit" to "highest bidder", which favours the recruiter (they know your reservation price exactly). Counterfactual: name 2-3 factors with comp as one of them.`;
    case "confidentialOvershare":
      return `Pivotal moment was ${where}: you shared confidential info ("our internal budget is X" / "off the record"). This signals poor judgment to the recruiter; they now wonder what you'll leak about THEM. Counterfactual: stay specific to your own situation, never about prior employer internals.`;
    case "personalExpenseJustification":
      return `Pivotal moment was ${where}: you justified the ask with personal expenses (home loan, family). Recruiters cannot pay personal-expense premiums — bands are set against market and budget. The argument doesn't move the number, but it does signal price-sensitivity. Counterfactual: anchor on market data instead.`;
    case "offerShoppingDemand":
      return `Pivotal moment was ${where}: you came across as offer-shopping (demanding a beat-by-X). Recruiters often disengage from auction dynamics — even when they could beat the number, they don't reward bidders. Counterfactual: "I'm comparing offers but want to land at a fair number; what's your band?"`;
    default:
      return `Pivotal moment was ${where}: a stance signal (${code}) fired. Review the rewrite suggestion attached to the matching red flag for the counterfactual.`;
  }
}
