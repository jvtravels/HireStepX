/**
 * Joining-bonus clawback resolver (audit fix 2026-05-21).
 *
 * The legacy canonical-prose hard-coded "standard 12-month clawback" on
 * every joining-bonus / signing-bonus mention. Real Indian clawbacks
 * scale with both the AMOUNT of the bonus AND the COMPANY TIER:
 *
 *   ≤ ₹5 LPA:      12-month clawback, pro-rated monthly.
 *   ₹5L–₹15L:      18-month clawback, 50% cliff at 6 months + pro-rata.
 *   ≥ ₹15L:        24-month clawback, two cliffs (12mo, 24mo).
 *   MNC India:     24-month standard regardless of amount; full
 *                  repayment on attrition <12mo.
 *   IT-services:   24-36 month SERVICE BOND language, not "clawback".
 *
 * Numbers are ROUGH INDUSTRY APPROXIMATIONS sourced from publicly
 * circulated offer letters + Glassdoor / AmbitionBox negotiation posts.
 * NOT legally verified — candidates must read the actual offer-letter
 * clawback clause before signing.
 *
 * Pure. */

import { getCompanyTier, type CompanyTier } from "../data/company-tiers";

/* Named thresholds — codify so the schedule boundaries are auditable. */
/** Upper bound (inclusive) of the small-bonus tier. Source: rough
 *  industry approximation, not legally verified. */
export const SMALL_BONUS_CAP_LPA = 5;
/** Upper bound (inclusive) of the mid-bonus tier. */
export const MID_BONUS_CAP_LPA = 15;

export type ClawbackStructure =
  | "standard-monthly-prorated"   // pro-rated monthly across the window
  | "half-cliff-then-prorated"     // 50% cliff at 6 months, monthly thereafter
  | "two-cliffs"                   // two cliffs at 12mo + 24mo
  | "mnc-full-on-early-exit"       // full repayment on attrition <12mo
  | "it-services-service-bond";    // service-bond language, distinct legal instrument

export interface ClawbackTerms {
  /** Total clawback window in months. */
  months: number;
  /** Repayment structure identifier. */
  structure: ClawbackStructure;
  /** Human-readable description suitable for surface prose. */
  description: string;
}

/** Resolve the clawback terms for a joining-bonus of `amountLpa` at the
 *  given company tier.
 *
 *  Tier precedence rules (mirrors real Indian market practice):
 *    1. IT-services tiers use the SERVICE BOND clause regardless of
 *       amount — it's a distinct legal instrument, not a clawback.
 *    2. MNC India arms (FAANG / Big-Tech / GCC) standardise on 24mo
 *       full-repayment-on-early-exit regardless of amount.
 *    3. All other tiers: amount-based — small (≤5L) / mid (5-15L) /
 *       large (≥15L) ladder.
 *
 *  Pure. */
export function clawbackForJoiningBonus(
  amountLpa: number,
  companyTier: CompanyTier | null,
): ClawbackTerms {
  /* Sanitize: a non-finite or non-positive amount falls through to the
   * small-bonus tier (12mo) so the caller never sees a NaN / negative
   * window. The kernel should never propose a non-positive JB but be
   * defensive — this is candidate-facing text. */
  const amt = Number.isFinite(amountLpa) && amountLpa > 0 ? amountLpa : 0;

  /* Tier-specific overrides FIRST. */
  if (companyTier === "it-services" || companyTier === "consulting-big4") {
    return {
      months: 24,
      structure: "it-services-service-bond",
      description:
        "24-month service bond — distinct from a clawback. " +
        "Early-exit penalty is the bond amount (typically ₹0.5-2 LPA) plus pro-rated joining-award recovery.",
    };
  }
  if (
    companyTier === "faang" ||
    companyTier === "big-tech" ||
    companyTier === "gcc" ||
    companyTier === "bfsi-global"
  ) {
    return {
      months: 24,
      structure: "mnc-full-on-early-exit",
      description:
        "24-month clawback — full repayment if attrition is within the first 12 months, pro-rated thereafter.",
    };
  }

  /* Amount-based ladder. Source: rough industry approximation, not
   * legally verified. */
  if (amt <= SMALL_BONUS_CAP_LPA) {
    return {
      months: 12,
      structure: "standard-monthly-prorated",
      description: "12-month clawback, pro-rated monthly.",
    };
  }
  if (amt <= MID_BONUS_CAP_LPA) {
    return {
      months: 18,
      structure: "half-cliff-then-prorated",
      description:
        "18-month clawback with a 50% cliff at 6 months, then pro-rated monthly through month 18.",
    };
  }
  return {
    months: 24,
    structure: "two-cliffs",
    description:
      "24-month clawback with two cliffs — 100% repayable until month 12, 50% until month 24.",
  };
}

/** Convenience: resolve clawback terms by company name (looks up tier
 *  via `getCompanyTier`). Pure. */
export function clawbackForCompany(
  amountLpa: number,
  company: string | null | undefined,
): ClawbackTerms {
  return clawbackForJoiningBonus(amountLpa, getCompanyTier(company));
}
