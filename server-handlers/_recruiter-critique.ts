/* Recruiter-side strategy critique — Phase 23 (2026-05-13).
 * ─────────────────────────────────────────────────────────────────────
 * Phases 1–22 graded the CANDIDATE: did they anchor, push the band,
 * commit red-flag patterns. The RECRUITER AI's moves were validated
 * for legality (never above maxStretch, never below walk-away) but
 * never graded for STRATEGY. A clean run could still be a bad run —
 * "anchored at maxStretch on turn 0", "burned all four levers in two
 * turns", "asserted final-offer three times then conceded ₹3L".
 *
 * Phase 23 adds a pure critique module that reads the move history +
 * final state and returns an ordered list of strategy issues. Each
 * item has a code, a severity, a turn pointer (where it happened),
 * and a coach's-voice explanation. The UI / report layer surfaces
 * these alongside candidate metrics so a learner sees BOTH sides.
 *
 * Detectors deliberately fire on KERNEL signals only — we don't
 * re-parse text here. The kernel already records lever, total, turn
 * index, and band; that's enough to spot the major mistakes.
 *
 * Mistakes covered:
 *   1. open-too-high       — opened above midpoint of band
 *   2. open-too-low        — opened below initialOffer (shouldn't happen
 *                            via kernel, but catches direct-state corruption)
 *   3. premature-ceiling   — hit maxStretch before turn 3 (no negotiation
 *                            happened; gave away the band)
 *   4. ceiling-without-anchor — hit maxStretch before candidate ever
 *                            stated a target (negotiating against air)
 *   5. concession-without-ask — bumped offer when candidate didn't
 *                            counter or push (free money)
 *   6. lever-fatigue       — burned ≥4 distinct levers in ≤3 turns
 *                            (no pacing)
 *   7. hold-firm-then-concede — asserted hold-firm / final-offer then
 *                            bumped on a later turn (credibility hit)
 *   8. no-probe            — never used "probe" before counter-base
 *                            (didn't gather info)
 *   9. closed-without-breakup — closed acceptance without the
 *                            candidate stating a component breakdown
 *  10. walkaway-without-warning — closed walkaway with no prior
 *                            hold-firm signal (abrupt exit)
 */

import type { NegotiationState } from "./_negotiation-kernel";
import type { KernelTurnSummary } from "./_negotiation-metrics";

export type RecruiterCritiqueCode =
  | "open-too-high"
  | "open-too-low"
  | "premature-ceiling"
  | "ceiling-without-anchor"
  | "concession-without-ask"
  | "lever-fatigue"
  | "hold-firm-then-concede"
  | "no-probe"
  | "closed-without-breakup"
  | "walkaway-without-warning"
  /* Phase 27 — bias / inappropriate question scanning across the
   * conversationLog. Fires when the recruiter AI asks personal or
   * protected-attribute questions that have no business in a comp talk. */
  | "asks-inappropriate-personal-question";

export type RecruiterCritiqueSeverity = "info" | "concern" | "blocker";

export interface RecruiterCritiqueItem {
  code: RecruiterCritiqueCode;
  severity: RecruiterCritiqueSeverity;
  /** 0-indexed turn where the issue surfaced; null for session-level. */
  turnIndex: number | null;
  /** Coach's-voice explanation of the mistake + what should have happened. */
  detail: string;
}

export interface RecruiterCritiqueInput {
  finalState: NegotiationState;
  moves: ReadonlyArray<KernelTurnSummary>;
}

/* ── Helpers ─────────────────────────────────────────────────────── */

function bandMidpoint(state: NegotiationState): number {
  const { initialOffer, maxStretch } = state.band;
  return initialOffer + (maxStretch - initialOffer) / 2;
}

function firstTurnAt(moves: ReadonlyArray<KernelTurnSummary>, lpa: number): number | null {
  const m = moves.find((mv) => mv.newTotalLpa != null && mv.newTotalLpa >= lpa - 0.01);
  return m ? m.turnIndex : null;
}

/* ── Critique entrypoint ─────────────────────────────────────────── */

export function critiqueRecruiterStrategy(
  input: RecruiterCritiqueInput,
): RecruiterCritiqueItem[] {
  const { finalState, moves } = input;
  const band = finalState.band;
  const out: RecruiterCritiqueItem[] = [];

  const cashMoves = moves.filter((m) => m.newTotalLpa != null);
  const opening = cashMoves[0];

  /* 1. open-too-high — opened above midpoint, leaving little room. */
  if (opening && opening.newTotalLpa != null) {
    const mid = bandMidpoint(finalState);
    if (opening.newTotalLpa > mid + 0.01 && opening.newTotalLpa < band.maxStretch) {
      out.push({
        code: "open-too-high",
        severity: "concern",
        turnIndex: opening.turnIndex,
        detail: `Opened at ₹${opening.newTotalLpa}L vs band midpoint ₹${mid.toFixed(1)}L — left only ${(band.maxStretch - opening.newTotalLpa).toFixed(1)}L of headroom. Open closer to initialOffer (₹${band.initialOffer}L) and let the candidate earn the climb.`,
      });
    }
    /* 2. open-too-low — defensive guard for state corruption. */
    if (opening.newTotalLpa < band.initialOffer - 0.01) {
      out.push({
        code: "open-too-low",
        severity: "blocker",
        turnIndex: opening.turnIndex,
        detail: `Opened at ₹${opening.newTotalLpa}L, below band.initialOffer (₹${band.initialOffer}L). The kernel should reject this — investigate state plumbing.`,
      });
    }
  }

  /* 3. premature-ceiling — hit maxStretch before turn 3. */
  const ceilingTurn = firstTurnAt(moves, band.maxStretch);
  if (ceilingTurn != null && ceilingTurn < 3) {
    out.push({
      code: "premature-ceiling",
      severity: "concern",
      turnIndex: ceilingTurn,
      detail: `Reached band ceiling ₹${band.maxStretch}L on turn ${ceilingTurn}. With no headroom left, the rest of the conversation has nowhere to go — candidate can extract joining bonus / equity for free.`,
    });
  }

  /* 4. ceiling-without-anchor — hit max before candidate stated a target. */
  if (ceilingTurn != null) {
    const anchorMove = moves.find((m) => m.candidateTargetAtTurn != null);
    const anchorTurn = anchorMove ? anchorMove.turnIndex : null;
    if (anchorTurn == null || anchorTurn > ceilingTurn) {
      out.push({
        code: "ceiling-without-anchor",
        severity: "blocker",
        turnIndex: ceilingTurn,
        detail: `Moved to ceiling ₹${band.maxStretch}L on turn ${ceilingTurn} before the candidate ever stated a target. You're negotiating against yourself — always probe for a number first.`,
      });
    }
  }

  /* 5. concession-without-ask — recruiter bumped total without
   *    candidate pushing. Heuristic: two consecutive cash moves where
   *    candidateTargetAtTurn didn't change AND second total > first. */
  for (let i = 1; i < cashMoves.length; i++) {
    const prev = cashMoves[i - 1];
    const curr = cashMoves[i];
    if (
      prev.newTotalLpa != null &&
      curr.newTotalLpa != null &&
      curr.newTotalLpa > prev.newTotalLpa + 0.01 &&
      prev.candidateTargetAtTurn === curr.candidateTargetAtTurn
    ) {
      out.push({
        code: "concession-without-ask",
        severity: "concern",
        turnIndex: curr.turnIndex,
        detail: `Bumped ₹${prev.newTotalLpa}L → ₹${curr.newTotalLpa}L on turn ${curr.turnIndex} without the candidate raising or restating their target. Every concession should be in response to a candidate move — otherwise you've given away ₹${(curr.newTotalLpa - prev.newTotalLpa).toFixed(1)}L for nothing.`,
      });
      break; // one is enough; don't spam the report
    }
  }

  /* 6. lever-fatigue — too many distinct CONCESSION levers in too
   *    few turns. open-with-offer / probe / hold-firm are structural
   *    and don't burn trade-ables. The bad pattern is dumping multiple
   *    concession types (bonus, equity, benefits, notice-buyout) in
   *    quick succession instead of pacing them one per turn. */
  const CONCESSION_LEVERS = new Set([
    "counter-base",
    "joining-bonus",
    "equity-grant",
    "benefits-summary",
    "notice-buyout",
  ] as const);
  if (moves.length >= 4) {
    const firstFour = moves.slice(0, 4);
    const concessions = new Set(
      firstFour.filter((mv) => CONCESSION_LEVERS.has(mv.lever as never)).map((mv) => mv.lever),
    );
    if (concessions.size >= 4) {
      out.push({
        code: "lever-fatigue",
        severity: "concern",
        turnIndex: firstFour[firstFour.length - 1].turnIndex,
        detail: `Used ${concessions.size} distinct concession levers (${[...concessions].join(", ")}) in the first 4 turns. Burning concessions fast means you have nothing left to trade in the closing phase. Pace: probe → counter → joining-bonus → equity → benefits, one per turn.`,
      });
    }
  }

  /* 7. hold-firm-then-concede — asserted final-offer then bumped. */
  let holdFirmTurn: number | null = null;
  for (const m of moves) {
    if (m.lever === "hold-firm") {
      holdFirmTurn = m.turnIndex;
      continue;
    }
    if (
      holdFirmTurn != null &&
      m.turnIndex > holdFirmTurn &&
      m.newTotalLpa != null &&
      cashMoves.some(
        (c) => c.turnIndex <= holdFirmTurn! && c.newTotalLpa != null && m.newTotalLpa! > c.newTotalLpa,
      )
    ) {
      out.push({
        code: "hold-firm-then-concede",
        severity: "blocker",
        turnIndex: m.turnIndex,
        detail: `Asserted hold-firm on turn ${holdFirmTurn} then bumped the offer on turn ${m.turnIndex}. Candidates remember this — every future hold-firm is now non-credible. Either hold (and accept the walkaway risk) or don't assert.`,
      });
      break;
    }
  }
  /* Also use the kernel's finalOfferAssertedCount as a secondary signal:
   * asserted ≥2× but did not close — the assertion was empty. */
  if (
    (finalState.finalOfferAssertedCount ?? 0) >= 2 &&
    finalState.phase !== "accepted" &&
    finalState.phase !== "walked-away" &&
    !out.some((o) => o.code === "hold-firm-then-concede")
  ) {
    out.push({
      code: "hold-firm-then-concede",
      severity: "concern",
      turnIndex: null,
      detail: `Asserted "final offer" ${finalState.finalOfferAssertedCount}× without closing. Repeated final-offer language without a close trains candidates to discount it. Say it once, mean it, and be ready to walk.`,
    });
  }

  /* 8. no-probe — counter-base used without ever probing first. */
  const probeIdx = moves.findIndex((m) => m.lever === "probe");
  const firstCounterIdx = moves.findIndex((m) => m.lever === "counter-base");
  if (firstCounterIdx !== -1 && (probeIdx === -1 || probeIdx > firstCounterIdx)) {
    out.push({
      code: "no-probe",
      severity: "info",
      turnIndex: moves[firstCounterIdx].turnIndex,
      detail: `Countered on turn ${moves[firstCounterIdx].turnIndex} without probing the candidate's target first. Probing flips the anchor — you learn their number before showing yours. A turn spent on "probe" is rarely wasted.`,
    });
  }

  /* 9. closed-without-breakup — accepted but no component breakdown. */
  if (
    finalState.phase === "accepted" &&
    !finalState.candidateComponentBreakdown.hasAny
  ) {
    out.push({
      code: "closed-without-breakup",
      severity: "blocker",
      turnIndex: finalState.acceptedAtTurn,
      detail: `Closed at acceptance without a base/variable/equity breakdown on record. Verbal close turns into a written offer dispute — always lock the component split before saying "you're in."`,
    });
  }

  /* 11. Phase 27 — recruiter asked an inappropriate personal /
   *     protected-attribute question. Scans AI utterances across the
   *     conversation log for India-context patterns: marital status,
   *     children / family planning, religion / caste, age, gender, visa
   *     status absent legitimate work-authorization context. False
   *     positives here are damaging, so patterns are narrow. */
  const INAPPROPRIATE_PATTERNS: { kind: string; pattern: RegExp }[] = [
    { kind: "marital", pattern: /\b(?:are\s+you\s+married|marital\s+status|when\s+are\s+you\s+(?:getting\s+married|planning\s+to\s+marry)|your\s+(?:husband|wife|spouse)\b)/i },
    { kind: "family-planning", pattern: /\b(?:planning\s+(?:a\s+)?(?:family|kids|children|baby)|when\s+(?:are\s+you|do\s+you)\s+(?:planning|going)\s+to\s+have\s+(?:kids|children|a\s+baby)|pregnan(?:t|cy)\s+plans)\b/i },
    { kind: "children", pattern: /\b(?:do\s+you\s+have\s+(?:kids|children)|how\s+many\s+(?:kids|children)\s+do\s+you\s+have)\b/i },
    { kind: "religion", pattern: /\b(?:what(?:'s|\s+is)\s+your\s+religion|which\s+(?:caste|religion|community)|your\s+caste\b)/i },
    { kind: "age", pattern: /\b(?:how\s+old\s+are\s+you|what(?:'s|\s+is)\s+your\s+age)\b/i },
    { kind: "gender", pattern: /\b(?:we\s+(?:prefer|need|want)\s+(?:a\s+)?(?:male|female)\s+candidate|gender\s+preference)\b/i },
  ];
  if (finalState.conversationLog.length > 0) {
    const offences: { kind: string; turnIndex: number; snippet: string }[] = [];
    finalState.conversationLog.forEach((entry, idx) => {
      if (entry.speaker !== "ai") return;
      for (const { kind, pattern } of INAPPROPRIATE_PATTERNS) {
        const m = pattern.exec(entry.text);
        if (m) {
          offences.push({ kind, turnIndex: idx, snippet: m[0] });
          break;
        }
      }
    });
    if (offences.length > 0) {
      const first = offences[0];
      const kinds = [...new Set(offences.map((o) => o.kind))].join(", ");
      out.push({
        code: "asks-inappropriate-personal-question",
        severity: "blocker",
        turnIndex: first.turnIndex,
        detail: `Recruiter asked personal / protected-attribute question(s) (${kinds}) in conversation log — e.g. "${first.snippet}". These have no place in a comp talk; they expose the company to bias complaints and damage candidate trust.`,
      });
    }
  }

  /* 10. walkaway-without-warning — walkaway closure with no prior
   *     hold-firm signal. */
  if (finalState.phase === "walked-away" && holdFirmTurn == null) {
    out.push({
      code: "walkaway-without-warning",
      severity: "concern",
      turnIndex: finalState.walkedAwayAtTurn,
      detail: `Walked away without any prior hold-firm / final-offer signal. Abrupt exits damage the brand — even when the gap is real, signal twice before closing the door.`,
    });
  }

  return out;
}
