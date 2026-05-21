/**
 * CTC-inflation anchor — recruiter weaponisation of CTC-vs-in-hand
 * confusion (audit fix 2026-05-21).
 *
 * BACKGROUND: real Indian recruiters routinely anchor on an inflated
 * total-package number ("₹40L total package!") that breaks down as a
 * much lower guaranteed in-hand:
 *
 *   60-65%  fixed             (only guaranteed cash)
 *   15-20%  variable           (often pro-rated, often missed)
 *   10-15%  ESOP "paper value" (worthless pre-IPO / no buyback)
 *    5-8%   benefits           (gratuity, PF employer, NPS, insurance)
 *    5-10%  joining bonus      (one-time, amortised over year 1)
 *
 * The simulator's job is to TRAIN the candidate to ask "what's the
 * in-hand breakdown?" — so the recruiter is allowed to anchor with this
 * inflated framing ONCE per session when the candidate over-anchors and
 * has not yet asked about the breakdown.
 *
 * IMPORTANT TEACHING CONTRACT (audit 2026-05-21): the LIE IS THE
 * FRAMING, NOT THE NUMBERS. When the candidate later asks for the
 * in-hand breakdown, the recruiter answers TRUTHFULLY with the same
 * underlying numbers. This module exposes BOTH the inflation prose and
 * the truth-on-followup prose; the planner picks which to emit.
 *
 * Pure. */

/** Default inflation mix. Percentages of total package. Source: rough
 *  industry approximation, not legally verified. Sums to 100. */
export const CTC_INFLATION_MIX = {
  fixedPct: 60,
  variablePct: 18,
  esopPaperPct: 12,
  joiningBonusPct: 5,
  benefitsPct: 5,
} as const;

export interface CtcInflationBreakdown {
  /** Recruiter's "total package" anchor in LPA. */
  ctcLpa: number;
  /** Component values in LPA, rounded to 1 decimal. */
  fixedLpa: number;
  variableLpa: number;
  esopPaperLpa: number;
  joiningBonusLpa: number;
  benefitsLpa: number;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Build a deterministic CTC-inflation breakdown around a target CTC.
 *
 *  The breakdown reflects how a real Indian recruiter would pad the
 *  headline number — ~60% guaranteed cash, ~18% variable, ~12% ESOP
 *  paper, ~10% one-time / benefits — so the candidate hears "₹40L
 *  package!" but the actual guaranteed in-hand is only ~24L fixed
 *  before tax. Pure. */
export function buildCtcInflationBreakdown(ctcLpa: number): CtcInflationBreakdown {
  const ctc = Number.isFinite(ctcLpa) && ctcLpa > 0 ? ctcLpa : 0;
  return {
    ctcLpa: round1(ctc),
    fixedLpa: round1(ctc * (CTC_INFLATION_MIX.fixedPct / 100)),
    variableLpa: round1(ctc * (CTC_INFLATION_MIX.variablePct / 100)),
    esopPaperLpa: round1(ctc * (CTC_INFLATION_MIX.esopPaperPct / 100)),
    joiningBonusLpa: round1(ctc * (CTC_INFLATION_MIX.joiningBonusPct / 100)),
    benefitsLpa: round1(ctc * (CTC_INFLATION_MIX.benefitsPct / 100)),
  };
}

/** Inflated-anchor prose — the FRAMING the recruiter uses to weaponise
 *  CTC confusion. The numbers are accurate; the lie is the implication
 *  that this is all guaranteed cash. */
export function renderCtcInflationAnchor(br: CtcInflationBreakdown): string {
  return (
    `We can do ₹${br.ctcLpa}L total package — that's ₹${br.fixedLpa}L fixed, ` +
    `₹${br.variableLpa}L variable on annual rating, ESOPs worth ₹${br.esopPaperLpa}L ` +
    `at last fair-market-value, ₹${br.joiningBonusLpa}L joining bonus, and our standard ` +
    `benefits package (gratuity, PF employer, NPS, insurance) worth around ₹${br.benefitsLpa}L. ` +
    `So overall ₹${br.ctcLpa}L on the table.`
  );
}

/** Truth-on-followup prose — fired when the candidate asks for the
 *  in-hand breakdown after the inflated anchor. The SAME underlying
 *  numbers are reused; the framing now names what is guaranteed vs
 *  paper / one-time / non-cash so the candidate sees the gap. */
export function renderCtcInflationTruth(br: CtcInflationBreakdown): string {
  const guaranteedCash = round1(br.fixedLpa);
  return (
    `Fair question — let me break it down honestly. The guaranteed cash is the ₹${br.fixedLpa}L fixed; ` +
    `that's what hits your account month after month. The ₹${br.variableLpa}L variable is at-risk on the annual rating cycle — ` +
    `most years it pays out 80-100%, but it's not contractual. The ₹${br.esopPaperLpa}L ESOPs are paper value at last FMV — ` +
    `actual realisable value depends on buyback windows and vesting completion. The ₹${br.joiningBonusLpa}L joining bonus is ` +
    `one-time, amortised over year one, and carries a clawback if you leave early. Benefits ₹${br.benefitsLpa}L is gratuity / ` +
    `PF / NPS / insurance — real value, but non-cash. So the headline ₹${br.ctcLpa}L is the full envelope; ` +
    `the guaranteed annual cash is ₹${guaranteedCash}L fixed.`
  );
}
