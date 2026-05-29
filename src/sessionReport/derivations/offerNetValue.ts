/* Offer net-value derivation.
 *
 * Today the report shows headline CTC and tax-adjusted NPV, but it does
 * NOT reckon with the joining-bonus clawback asterisk. An Indian offer
 * letter routinely bundles a ₹2-15L "joining award" that is reclaimable
 * — sometimes in full — if the candidate exits before a tenure cliff.
 * Without surfacing the clawback-floor, the headline CTC mis-states the
 * floor value of the offer.
 *
 * `computeOfferNetValue` is a pure function: it takes a structured offer
 * (the fields the kernel already exposes — see server-handlers/
 * _negotiation-kernel.ts § joiningBonus, _joining-bonus-clawback.ts §
 * clawbackForCompany) and returns the three numbers the report needs:
 *   • headline CTC (what the offer letter advertises)
 *   • Y1 if the candidate stays past the clawback window
 *   • Y1 floor if the candidate leaves at month 11 (clawback fully bites)
 *
 * Plus a one-sentence asterisk that names the catch in plain English.
 *
 * Pure. No I/O, no React, no token imports. */

/* The minimal offer shape this derivation consumes. Mirrors the
 * fields surfaced by the kernel (base + variable + joiningBonus +
 * clawback terms resolved via `clawbackForCompany`). Kept narrow so
 * the function is trivially typed from either the negotiation-state
 * shape OR a hand-built fixture. */
export interface OfferNetValueInput {
  /** Annual base in LPA. */
  baseLpa: number;
  /** Variable / performance pay expected at target, in LPA. */
  variableAtTargetLpa: number;
  /** One-time joining (sign-on) bonus, in LPA. */
  joiningBonusLpa: number;
  /** Clawback window in months — typically 12 / 18 / 24, resolved by
   *  `clawbackForJoiningBonus` in server-handlers. */
  clawbackWindowMonths: number;
  /** Optional company label — surfaces in the asterisk note when
   *  present so the sentence reads like "Microsoft's joining award…"
   *  rather than "the joining award…". */
  company?: string | null;
}

export interface OfferNetValue {
  /** Headline CTC the offer letter advertises — base + variable + JB. */
  headlineCtc: number;
  /** Guaranteed cash at target (base + variable at target, NO bonus). */
  guaranteedCash: number;
  /** Joining bonus component (already counted in headlineCtc). */
  joiningBonus: number;
  /** Clawback window the joining bonus is subject to. */
  joiningBonusClawbackWindowMonths: number;
  /** Y1 if the candidate exits at month 11 — full JB clawed back. */
  effectiveYearOneIfLeaveEarly: number;
  /** Y1 if the candidate stays through the clawback cliff. */
  effectiveYearOneStayedFull: number;
  /** One human sentence summarizing the asterisk. */
  asteriskNote: string;
}

/* Round to one decimal so the report's mono number column lines up
 * with the rest of the LPA values (NPVMathPanel uses the same scale). */
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function computeOfferNetValue(offer: OfferNetValueInput): OfferNetValue {
  /* Defensive: a non-finite or negative field falls through to zero
   * rather than propagating NaN into the candidate-facing report. */
  const base = Number.isFinite(offer.baseLpa) && offer.baseLpa > 0 ? offer.baseLpa : 0;
  const variable =
    Number.isFinite(offer.variableAtTargetLpa) && offer.variableAtTargetLpa > 0
      ? offer.variableAtTargetLpa
      : 0;
  const jb =
    Number.isFinite(offer.joiningBonusLpa) && offer.joiningBonusLpa > 0
      ? offer.joiningBonusLpa
      : 0;
  const window =
    Number.isFinite(offer.clawbackWindowMonths) && offer.clawbackWindowMonths > 0
      ? offer.clawbackWindowMonths
      : 0;

  const guaranteedCash = round1(base + variable);
  const headlineCtc = round1(guaranteedCash + jb);

  /* Year-1 floor assumes exit at month 11:
   *   • full joining bonus reclaimed (worst-case clawback)
   *   • base + variable accrued for 11 of 12 months
   * This is the rupees that hit the bank if the candidate leaves
   * before the cliff — the honest floor of the offer. */
  const monthlyCash = (base + variable) / 12;
  const effectiveYearOneIfLeaveEarly = round1(monthlyCash * 11);
  /* Stayed-full Y1 = base + variable + the full JB. */
  const effectiveYearOneStayedFull = round1(base + variable + jb);

  const companyLabel = offer.company ? `${offer.company}'s` : "The";
  const asteriskNote =
    jb > 0 && window > 0
      ? `${companyLabel} ₹${round1(jb)}L joining bonus is clawback-eligible for ${window} months — if you exit before then, the headline ₹${headlineCtc}L collapses toward ₹${effectiveYearOneIfLeaveEarly}L for year one.`
      : jb > 0
        ? `${companyLabel} ₹${round1(jb)}L joining bonus has no clawback window on record — verify the actual offer-letter clause before treating it as guaranteed.`
        : `No joining bonus on this offer, so the headline ₹${headlineCtc}L equals the guaranteed cash — no clawback asterisk to worry about.`;

  return {
    headlineCtc,
    guaranteedCash,
    joiningBonus: round1(jb),
    joiningBonusClawbackWindowMonths: window,
    effectiveYearOneIfLeaveEarly,
    effectiveYearOneStayedFull,
    asteriskNote,
  };
}
