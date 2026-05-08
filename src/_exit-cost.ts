/* HireStepX — Early-exit cost calculator
 *
 * When a candidate negotiates joining a new company, the recruiter
 * routinely says "can you join in 30 days?" — but the actual cost of
 * leaving the current employer early is invisible to most candidates.
 * Three components add up:
 *
 *   1. Notice-period buyout — current employer demands ₹X (typically
 *      base/12 × notice_months_unfulfilled) for early release.
 *   2. Service-bond penalty — IT services / govt firms recover a
 *      lump-sum if you leave within bond duration.
 *   3. ESOP forfeit — pre-IPO ESOPs that haven't vested are lost; for
 *      vested-but-unexercised they're typically forfeited too unless
 *      the candidate exercises (= writes a tax cheque + holds illiquid
 *      shares).
 *
 * Pure helper. Consumed by the LLM coaching layer when the new
 * employer pressures notice-period reduction or signing-bonus
 * discussions.
 *
 * Tested in src/__tests__/exitCost.test.ts.
 */

import { COMPANY_META } from "../data/company-salary-overrides";

export interface ExitCostInput {
  /** Current employer's company key (lowercased canonical). Used to
   *  pull noticePeriodDays / bondPenaltyLpa from COMPANY_META. */
  currentCompanyKey: string;
  /** Candidate's current annual base salary in LPA. */
  currentBaseLpa: number;
  /** How many days they want to shorten notice by (= days they'd be
   *  buying out). 0 if serving full notice. */
  daysToBuyout: number;
  /** Years remaining on any service bond (TCS/Infosys/etc). 0 if no
   *  bond or already past it. */
  bondYearsRemaining?: number;
  /** Annual ESOP grant value (LPA) the candidate would forfeit on
   *  early exit (unvested portion + vested-but-unexercised). 0 if
   *  no equity at current employer. */
  esopForfeitLpa?: number;
}

export interface ExitCostOutput {
  noticeBuyoutLpa: number;
  bondPenaltyLpa: number;
  esopForfeitLpa: number;
  totalCostLpa: number;
  /** What the new employer would need to pay as joining bonus to make
   *  the candidate whole on early exit (1.5-2x is industry norm). */
  recommendedJoiningBonusLpa: number;
  /** Per-component explanation for the LLM to surface in conversation. */
  explanation: string;
  /** Source of the notice/bond inputs (per-company META vs default). */
  metaSource: "company" | "default";
}

const DEFAULT_NOTICE_DAYS = 60;

export function computeExitCost(input: ExitCostInput): ExitCostOutput {
  const key = (input.currentCompanyKey ?? "").toLowerCase().trim();
  const meta = COMPANY_META[key];

  const noticeDays = meta?.noticePeriodDays ?? DEFAULT_NOTICE_DAYS;
  const buyoutDays = Math.max(0, Math.min(noticeDays, input.daysToBuyout));
  const baseLpa = Math.max(0, input.currentBaseLpa);
  const bondYears = Math.max(0, input.bondYearsRemaining ?? 0);
  const esopForfeit = Math.max(0, input.esopForfeitLpa ?? 0);

  // Notice buyout = (buyout_days / 365) × annual_base. Most Indian employers
  // recover gross base for the unfulfilled days — not net of tax — though
  // the candidate eventually claims it as deduction. Modeling gross is
  // conservative for negotiation purposes.
  const noticeBuyoutLpa = (buyoutDays / 365) * baseLpa;

  // Service bond penalty: pulled from META if available; otherwise 0.
  // For IT services with bondYearsRemaining > 0, scale the penalty by
  // remaining years (TCS bond is 1yr → 0.5L flat; pro-rate is realistic).
  const bondTotal = meta?.bondPenaltyLpa ?? 0;
  const bondPenaltyLpa = bondYears > 0 ? bondTotal * Math.min(1, bondYears) : 0;

  const totalCostLpa = noticeBuyoutLpa + bondPenaltyLpa + esopForfeit;
  // Industry norm: new employer offers 1.5-2x the exit cost as joining
  // bonus to make the candidate net-positive on switching. Using 1.75x mid.
  const recommendedJoiningBonusLpa = totalCostLpa * 1.75;

  const parts: string[] = [];
  if (noticeBuyoutLpa > 0) {
    parts.push(`Notice buyout: ${buyoutDays} days × (₹${baseLpa.toFixed(1)}L/365) = ₹${round1(noticeBuyoutLpa)} LPA owed to current employer.`);
  }
  if (bondPenaltyLpa > 0) {
    parts.push(`Bond penalty: ₹${round1(bondPenaltyLpa)} LPA (${bondYears} yr remaining of service agreement).`);
  }
  if (esopForfeit > 0) {
    parts.push(`ESOP forfeit: ₹${round1(esopForfeit)} LPA in unvested/unexercised equity left on the table.`);
  }
  if (parts.length === 0) {
    parts.push("No early-exit cost detected — full notice + no bond + no equity in flight.");
  }
  const explanation = parts.join(" ");

  return {
    noticeBuyoutLpa: round1(noticeBuyoutLpa),
    bondPenaltyLpa: round1(bondPenaltyLpa),
    esopForfeitLpa: round1(esopForfeit),
    totalCostLpa: round1(totalCostLpa),
    recommendedJoiningBonusLpa: round1(recommendedJoiningBonusLpa),
    explanation,
    metaSource: meta ? "company" : "default",
  };
}

function round1(n: number): number { return Math.round(n * 10) / 10; }
