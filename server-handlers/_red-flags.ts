/* Salary-negotiation red-flag detector — Phase 18 (2026-05-13).
 *
 * The 19-scenario audit produced a 14-item list of recruiter red
 * flags. We split them into three families:
 *
 *   1. State-derived — derivable from existing NegotiationState
 *      (e.g. "doesn't know current CTC" = `candidateCurrentCtc === null`
 *      after the candidate has been asked).
 *
 *   2. Stance-derived — fired by `_candidate-stance.ts` (badmouth,
 *      desperation, confidential overshare, treats-equity-as-cash,
 *      salary-only-factor).
 *
 *   3. Composite — require correlating multiple kernel fields
 *      (e.g. "huge hike without rationale" = hike > 40% AND
 *      no rationale, "confuses CTC with in-hand" = candidate stated
 *      a monthly figure inside an annual context).
 *
 * Each red flag has a SEVERITY:
 *   - "info"     — worth noting in the brief
 *   - "concern"  — recruiter should probe / soften
 *   - "blocker"  — recruiter should pause and verify (lies, etc.)
 *
 * Red flags are NOT folded into state. They're computed fresh each
 * turn so the brief always reflects the current view; if a flag is
 * resolved (e.g. candidate later supplies the missing breakup), the
 * flag silently disappears. */

import type { NegotiationState } from "./_negotiation-kernel";
import type { CandidateStanceResult } from "./_candidate-stance";

export type RedFlagCode =
  | "no-current-ctc"
  | "no-fixed-variable-breakup"
  | "ctc-inhand-confusion"
  | "huge-hike-no-rationale"
  | "salary-only-factor"
  | "lies-about-offer"
  | "overcommits-joining"
  | "sounds-desperate"
  | "badmouths-current"
  | "shares-confidential"
  | "demands-no-flex"
  | "treats-equity-as-cash"
  | "ignores-variable-risk"
  | "verbal-accept-no-breakup";

export type RedFlagSeverity = "info" | "concern" | "blocker";

export interface RedFlag {
  code: RedFlagCode;
  severity: RedFlagSeverity;
  /** Short human-readable rationale for the brief. */
  detail: string;
}

interface DetectorInput {
  state: NegotiationState;
  stance: CandidateStanceResult;
  /** The candidate's current-turn answer text. Required for the few
   *  red flags that need fresh utterance text (CTC/in-hand confusion,
   *  "lies about offer" surface form). */
  utterance: string;
}

/* Threshold mirroring the follow-up router. */
const HUGE_HIKE_THRESHOLD = 40;

/* "I'm earning 80k per month" / "in-hand is 65000 monthly" inside a
 * conversation where the recruiter is asking annual CTC. We pattern-
 * match the monthly figure; the composite check pairs it with the
 * absence of an annual figure on the same turn. */
const MONTHLY_FIGURE = /\b(\d{2,3}(?:[.,]\d+)?)\s*k?\s*(?:per\s+month|\/\s*month|monthly|p\.?m\.?)\b/i;
const ANNUAL_CONTEXT = /\b(lpa|lakhs?\s+per\s+(?:year|annum)|annual|per\s+annum|p\.?a\.?|cr|crore)\b/i;

/* "Lies about offer" is unsafe to detect from text alone. We use a
 * narrow heuristic: candidate names a competing company + a number
 * that the kernel can't verify, AND has previously declined to share
 * the offer letter. That's the closest deterministic proxy. */

export function detectRedFlags(input: DetectorInput): RedFlag[] {
  const { state, stance, utterance } = input;
  const out: RedFlag[] = [];
  const u = (utterance || "").trim();

  /* 1. Doesn't know current CTC — fires after turn 2 when the
   *    recruiter has had a chance to ask. */
  if (state.turnIndex >= 2 && state.candidateCurrentCtc == null) {
    out.push({
      code: "no-current-ctc",
      severity: "concern",
      detail: "current CTC not stated after 2+ recruiter turns",
    });
  }

  /* 2. No fixed-vs-variable breakup. Fires once a CTC magnitude is on
   *    the table but `candidateComponentBreakdown.hasAny === false`. */
  if (
    (state.candidateCurrentCtc != null || state.candidateTarget != null) &&
    !state.candidateComponentBreakdown.hasAny
  ) {
    out.push({
      code: "no-fixed-variable-breakup",
      severity: "info",
      detail: "CTC magnitude stated but fixed/variable split unstated",
    });
  }

  /* 3. CTC/in-hand confusion — monthly figure in an annual context,
   *    without a matching annual figure on the same turn. */
  if (u && MONTHLY_FIGURE.test(u) && !ANNUAL_CONTEXT.test(u)) {
    out.push({
      code: "ctc-inhand-confusion",
      severity: "concern",
      detail: "candidate quoted a monthly figure in an annual-comp discussion",
    });
  }

  /* 4. Huge hike with no rationale. */
  if (
    state.hikePercent != null &&
    state.hikePercent > HUGE_HIKE_THRESHOLD &&
    state.rationale == null
  ) {
    out.push({
      code: "huge-hike-no-rationale",
      severity: "concern",
      detail: `ask is +${Math.round(state.hikePercent)}% hike, no rationale cue detected`,
    });
  }

  /* 5. Salary is the only decision factor. */
  if (stance.salaryOnlyFactor) {
    out.push({
      code: "salary-only-factor",
      severity: "concern",
      detail: "candidate stated salary is the sole consideration",
    });
  }

  /* 6. Lies about offer (narrow heuristic). Candidate has stated a
   *    competing-offer NUMBER but explicitly refused to share the
   *    letter / proof. We mark "blocker" only when the refusal is
   *    explicit, otherwise no flag. */
  if (
    state.competingOffer != null &&
    state.competingOfferDetail.letterShareOffered === false &&
    state.miscSignals.proofOfCtcShareable === false
  ) {
    out.push({
      code: "lies-about-offer",
      severity: "blocker",
      detail: "competing offer claimed but candidate refuses to share documentation",
    });
  }

  /* 7. Overcommits joining date — early-join preference WITH a non-
   *    trivial notice period the candidate hasn't said is bought out. */
  const np = state.noticeJoining.noticePeriodDays;
  if (
    state.noticeJoining.earlyJoinPreferred &&
    np != null &&
    np > 30 &&
    !state.noticeJoining.buyoutRequested
  ) {
    out.push({
      code: "overcommits-joining",
      severity: "info",
      detail: `candidate wants early join with ${np}-day notice and no buyout discussion`,
    });
  }

  /* 8. Desperation. */
  if (stance.soundsDesperate) {
    out.push({
      code: "sounds-desperate",
      severity: "concern",
      detail: "candidate signalled urgency/no-other-options — BATNA weakened",
    });
  }

  /* 9. Badmouths current employer. */
  if (stance.badmouthsCurrent) {
    out.push({
      code: "badmouths-current",
      severity: "concern",
      detail: "candidate disparaged current employer — culture risk",
    });
  }

  /* 10. Confidential overshare. */
  if (stance.confidentialOvershare) {
    out.push({
      code: "shares-confidential",
      severity: "concern",
      detail: "candidate shared confidential / privileged info — integrity risk",
    });
  }

  /* 11. Demands with no flexibility (hardline + no floor signal). */
  if (stance.flexibilityPosture === "rigid") {
    out.push({
      code: "demands-no-flex",
      severity: "concern",
      detail: "candidate signalled non-negotiable / take-it-or-leave-it stance",
    });
  }

  /* 12. Treats equity as guaranteed cash. */
  if (stance.treatsEquityAsCash) {
    out.push({
      code: "treats-equity-as-cash",
      severity: "concern",
      detail: "candidate is counting ESOP/equity at face value as guaranteed cash",
    });
  }

  /* 13. Ignores variable-pay risk. Composite: candidate has a stated
   *     breakdown WITH a non-trivial variable component AND a target
   *     that only makes sense if 100pct of variable is paid out
   *     (target ≥ base + 90pct of stated variable). We approximate
   *     "ignores risk" as: variable > 15pct of breakdown total AND
   *     candidate's target equals base+variable sum (no haircut). */
  const cb = state.candidateComponentBreakdown;
  if (
    cb.hasAny &&
    cb.base != null &&
    cb.variable != null &&
    cb.variable > 0 &&
    state.candidateTarget != null
  ) {
    const total = cb.base + cb.variable;
    const variablePct = total > 0 ? cb.variable / total : 0;
    const targetMatchesNoHaircut = Math.abs(state.candidateTarget - total) < 0.5;
    if (variablePct >= 0.15 && targetMatchesNoHaircut) {
      out.push({
        code: "ignores-variable-risk",
        severity: "info",
        detail: "target equals base+variable sum with no payout-risk haircut",
      });
    }
  }

  /* 14. Verbal accept without breakup. Candidate has signalled
   *     verbal acceptance (verbalAcceptanceTurn set) but the kernel
   *     has no component breakdown for them. */
  if (
    state.verbalAcceptanceTurn != null &&
    !state.candidateComponentBreakdown.hasAny
  ) {
    out.push({
      code: "verbal-accept-no-breakup",
      severity: "concern",
      detail: "candidate accepted verbally but offer breakup never recorded",
    });
  }

  return out;
}
