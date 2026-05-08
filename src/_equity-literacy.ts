/* HireStepX — Equity literacy helpers
 *
 * Indian candidates routinely sign ESOP letters they can't read. The
 * critical numbers — vest schedule, strike price vs FMV, taxable event
 * at exercise vs sale, dilution risk — are buried in dense legalese.
 * This helper turns a grant offer into the 4 numbers that actually
 * change a candidate's decision:
 *
 *   1. Cliff value      — what you get if you stay through cliff (1yr).
 *   2. Half-vest value  — what you get if you stay 2 of 4 years.
 *   3. Full-vest value  — total grant face if you stay all 4 years.
 *   4. Tax bill bite    — perquisite tax owed on exercise (FMV - strike)
 *                          taxed at slab rate, paid out-of-pocket BEFORE
 *                          you can sell. Surprise #1 for most candidates.
 *
 * Tested in src/__tests__/equityLiteracy.test.ts.
 */

export interface EquityGrantInput {
  /** Total grant face value at issue (LPA/year × vest years, OR a lump). */
  totalGrantLpa: number;
  /** Vest schedule. Default Indian-unicorn standard 4yr / 1yr cliff. */
  vestYears?: number;
  /** Cliff in months (no vest before). Default 12. */
  cliffMonths?: number;
  /** Strike price as % of FMV at grant. ESOP usually 0% (free) to 50%
   *  (premium). RSU effectively 100% (you get full value). */
  strikePctOfFmv?: number;
  /** Equity type — drives tax treatment. */
  equityType: "rsu" | "esop";
  /** Pre-IPO discount (0-1). RSU on listed = 1; pre-IPO ESOP ~0.3.
   *  If listed/RSU, defaults 1.0; if ESOP, defaults 0.3. */
  liquidityFactor?: number;
  /** Candidate's marginal tax rate for perquisite tax calc. Defaults 30%
   *  (typical for ₹15L+ income; new regime top slab). */
  marginalTaxRate?: number;
}

export interface EquityGrantOutput {
  /** Annual grant equivalent (face / vest years). */
  annualFaceLpa: number;
  /** Cliff value (face × cliff fraction × liquidity). */
  cliffRealisticLpa: number;
  /** 50% vest mark realistic value. */
  halfVestRealisticLpa: number;
  /** Full-vest realistic value (face × liquidity). */
  fullVestRealisticLpa: number;
  /** Perquisite tax due AT EXERCISE (ESOP only) on (FMV - strike). For
   *  RSU, taxable event is at vest at FMV; same math at marginal rate.
   *  Returns the tax owed across all vested shares assuming exercise
   *  immediately after each vest. */
  perquisiteTaxAtFullVestLpa: number;
  /** Net realistic value AFTER paying perquisite tax (cash you keep
   *  before selling, assuming you can fund the exercise yourself). */
  netAfterTaxLpa: number;
  /** Realistic value as % of stated grant face (the "marketing markup"). */
  realisticPctOfFace: number;
  /** Schedule of vest events — month + cumulative vested face. Useful
   *  for vest-curve UI rendering. */
  vestSchedule: Array<{ monthsFromGrant: number; cumulativeFaceLpa: number }>;
}

export function computeEquityGrant(input: EquityGrantInput): EquityGrantOutput {
  const face = Math.max(0, input.totalGrantLpa);
  const vestYears = Math.max(1, input.vestYears ?? 4);
  const cliffMonths = Math.max(0, Math.min(vestYears * 12, input.cliffMonths ?? 12));
  const strikePct = Math.max(0, Math.min(1, input.strikePctOfFmv ?? 0));
  const liquidity = Math.max(
    0,
    Math.min(1, input.liquidityFactor ?? (input.equityType === "rsu" ? 1.0 : 0.3)),
  );
  const taxRate = Math.max(0, Math.min(0.42, input.marginalTaxRate ?? 0.30));

  const totalMonths = vestYears * 12;
  const annualFace = face / vestYears;

  // Vest schedule: cliff at cliffMonths releases (cliffMonths/totalMonths)
  // of face. After cliff, monthly vest of remainder.
  const schedule: Array<{ monthsFromGrant: number; cumulativeFaceLpa: number }> = [];
  if (cliffMonths > 0) {
    const cliffFraction = cliffMonths / totalMonths;
    schedule.push({ monthsFromGrant: cliffMonths, cumulativeFaceLpa: round1(face * cliffFraction) });
  }
  for (let m = cliffMonths + 12; m <= totalMonths; m += 12) {
    const cumFace = face * (m / totalMonths);
    schedule.push({ monthsFromGrant: m, cumulativeFaceLpa: round1(cumFace) });
  }
  // Always end with full vest if not already there.
  if (schedule.length === 0 || schedule[schedule.length - 1]!.monthsFromGrant !== totalMonths) {
    schedule.push({ monthsFromGrant: totalMonths, cumulativeFaceLpa: round1(face) });
  }

  const cliffFaceFraction = totalMonths > 0 ? cliffMonths / totalMonths : 0;
  const cliffFace = face * cliffFaceFraction;
  const halfFace = face * 0.50;

  // Realistic = face × liquidity factor (post-buyback / post-IPO discount).
  // ESOP candidate also pays the strike to exercise, so net is (FMV - strike) × shares.
  // We model strike as % of FMV; net face = face × (1 - strikePct).
  const exerciseDiscount = 1 - strikePct;
  const cliffRealistic = cliffFace * exerciseDiscount * liquidity;
  const halfRealistic = halfFace * exerciseDiscount * liquidity;
  const fullRealistic = face * exerciseDiscount * liquidity;

  // Perquisite tax: paid at exercise on (FMV - strike) — for free ESOPs (strike=0),
  // entire face value is taxable as perquisite at marginal rate. For RSU, same math
  // at vest at FMV. Tax is owed in cash BEFORE liquidity event for pre-IPO ESOP.
  const perquisiteTaxLpa = face * exerciseDiscount * taxRate;

  const netAfterTax = Math.max(0, fullRealistic - perquisiteTaxLpa);

  return {
    annualFaceLpa: round1(annualFace),
    cliffRealisticLpa: round1(cliffRealistic),
    halfVestRealisticLpa: round1(halfRealistic),
    fullVestRealisticLpa: round1(fullRealistic),
    perquisiteTaxAtFullVestLpa: round1(perquisiteTaxLpa),
    netAfterTaxLpa: round1(netAfterTax),
    realisticPctOfFace: face > 0 ? round1(fullRealistic / face * 100) : 0,
    vestSchedule: schedule,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
