/* Next-action planner: CTC-inflation anchors and offer-breakdown requests. */

import { type NegotiationState, effectiveTargetCtcLpa, statedTotalTargetCtcLpa } from "./_negotiation-kernel";
import type { PlannedAction } from "./_planner-actions";
import { buildCtcInflationBreakdown } from "./_ctc-inflation";
import { BREAKDOWN_ASK_RE } from "./_question-router";
import { deriveOfferFixedVariable } from "./_planner-reactive";

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
