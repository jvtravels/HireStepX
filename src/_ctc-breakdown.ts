/* HireStepX — CTC-to-take-home breakdown
 *
 * Pure helper. Indian "₹40L CTC" doesn't mean ₹40L cash; the stated
 * total includes employer EPF, gratuity, insurance loading, equity face
 * value, and a variable-bonus target most candidates never realize at
 * 100%. Salary-neg sessions kept asking "why does my paycheck look so
 * small?" — this helper makes the gap explicit.
 *
 * Tax regime: India new regime, FY 2025-26 slabs (effective for offers
 * landing after 1-Apr-2025; rebate u/s 87A makes income up to ₹12L
 * effectively zero-tax post Budget 2025). Standard deduction ₹75,000.
 * 4% health & education cess on tax. Surcharge brackets applied.
 *
 * Caveats on purpose:
 * - HRA exemption not netted (depends on rent paid; user-specific).
 * - 80C/80D deductions not netted (new regime doesn't allow most).
 * - Equity discount is a heuristic: pre-IPO ESOP at 30% face, listed RSU
 *   at face. Buybacks change this — use with the company-override note.
 *
 * Tested in src/__tests__/ctcBreakdown.test.ts.
 */

export interface CtcBreakdownInput {
  /** Total stated CTC in LPA. */
  totalCtcLpa: number;
  /** Equity face value in LPA (annual vest, not cliff sum). 0 if cash-only. */
  equityLpa?: number;
  /** Whether equity is liquid (RSU on listed co) or pre-IPO (ESOP). */
  equityType?: "rsu" | "esop" | "none";
  /** Variable bonus % of CTC. Defaults to 12% (Indian tier-aware median). */
  variablePct?: number;
  /** Realistic variable payout multiplier vs target. 1.0 = always pays
   *  100%, 0.5 = half. Defaults 0.85 (mature unicorn average). */
  variablePayoutFactor?: number;
  /** Employer's EPF / gratuity / insurance loading as a fraction of base.
   *  Defaults to 0.18 (12% EPF + 4.81% gratuity + ~1% insurance). */
  benefitsLoadingPct?: number;
  /** Per-company equity-realism override. If set, overrides the default
   *  RSU=face, ESOP=30% heuristic. Use when a company has a documented
   *  recentBuybackNote — e.g. Razorpay (6 buybacks) → 0.55, CRED → 0.40.
   *  Listed cos (Swiggy/Zomato) → 1.0. */
  equityLiquidityFactor?: number;
}

/** Map a company-override `recentBuybackNote` (or absence) to a liquidity
 *  factor for ESOP discount. Listed RSU is always 1.0 — this is just for
 *  pre-IPO ESOPs where buyback frequency is the only honest signal.
 *
 *  Heuristic: every documented buyback round in the last 3 years adds ~5pp
 *  to the discount factor, capped at 0.55 (still a discount vs RSU since
 *  buybacks are episodic, not on-demand). */
export function liquidityFactorFromBuybackNote(note: string | undefined): number {
  if (!note) return 0.30; // No documented buybacks = pre-IPO baseline.
  // Count "buyback" mentions (case-insensitive); each round nudges the factor.
  const buybackCount = (note.match(/buyback/gi) ?? []).length;
  // "6 buybacks since 2018" or "5 rounds" — extract a number to handle the
  // common wording explicitly.
  const numMatch = note.match(/(\d+)\s*(?:buyback|round)/i);
  const explicitCount = numMatch ? parseInt(numMatch[1]!, 10) : buybackCount;
  const rounds = Math.max(buybackCount, explicitCount, 1);
  return Math.min(0.55, 0.30 + rounds * 0.05);
}

export interface CtcBreakdownOutput {
  statedCtcLpa: number;
  /** Equity face / listed value (LPA). */
  equityLpa: number;
  /** Equity discounted for liquidity (LPA). RSU = face, ESOP pre-IPO = 0.3×. */
  equityRealisticLpa: number;
  /** Cash CTC = stated - equity - employer-side benefits loading. */
  cashCtcLpa: number;
  /** Fixed cash component (base + allowances). */
  fixedCashLpa: number;
  /** Variable target (advertised). */
  variableTargetLpa: number;
  /** Variable realistic (target × payout factor). */
  variableRealisticLpa: number;
  /** Employee's own EPF deduction (deducted from take-home). */
  employeeEpfLpa: number;
  /** Annual income tax under new regime (incl 4% cess + surcharge). */
  annualTaxLpa: number;
  /** Annual cash take-home (gross fixed+variable, minus EPF, minus tax). */
  annualTakeHomeLpa: number;
  /** Monthly cash hitting account (₹). */
  monthlyTakeHomeInr: number;
  /** All-in realistic value: take-home + equity discounted. */
  totalRealisticLpa: number;
  /** Gap between stated CTC and total realistic (LPA). */
  gapLpa: number;
  /** Gap as % of stated CTC — the "marketing markup". */
  gapPct: number;
}

const LPA = 100000;

/** India new-regime FY 2025-26 tax slabs, in LPA. */
const SLABS: Array<[number, number]> = [
  [4, 0], // 0-4L: 0%
  [8, 0.05], // 4-8L: 5%
  [12, 0.10], // 8-12L: 10%
  [16, 0.15], // 12-16L: 15%
  [20, 0.20], // 16-20L: 20%
  [24, 0.25], // 20-24L: 25%
  [Infinity, 0.30], // 24L+: 30%
];

/** Compute tax on taxable income (in LPA) under new regime.
 *  Returns tax in LPA. Includes 87A rebate (zero-tax up to 12L taxable),
 *  4% cess, and surcharge on income >50L.
 *  Exported for unit testability. */
export function computeNewRegimeTaxLpa(taxableLpa: number): number {
  if (taxableLpa <= 0) return 0;
  // 87A rebate: full rebate when taxable ≤ 12L under new regime (post Budget 2025).
  if (taxableLpa <= 12) return 0;

  let tax = 0;
  let prev = 0;
  for (const [cap, rate] of SLABS) {
    if (taxableLpa <= prev) break;
    const slab = Math.min(taxableLpa, cap) - prev;
    tax += slab * rate;
    prev = cap;
    if (taxableLpa <= cap) break;
  }
  // Surcharge on tax (not on income).
  let surcharge = 0;
  if (taxableLpa > 200) surcharge = tax * 0.25;
  else if (taxableLpa > 100) surcharge = tax * 0.15;
  else if (taxableLpa > 50) surcharge = tax * 0.10;
  // 4% cess on (tax + surcharge).
  const cess = (tax + surcharge) * 0.04;
  return tax + surcharge + cess;
}

export function computeCtcBreakdown(input: CtcBreakdownInput): CtcBreakdownOutput {
  const stated = Math.max(0, input.totalCtcLpa);
  const equity = Math.max(0, input.equityLpa ?? 0);
  const equityType = input.equityType ?? "none";
  const variablePct = Math.max(0, Math.min(0.40, input.variablePct ?? 0.12));
  const payoutFactor = Math.max(0, Math.min(1, input.variablePayoutFactor ?? 0.85));
  const benefitsLoading = Math.max(0, Math.min(0.40, input.benefitsLoadingPct ?? 0.18));

  // Equity realistic: RSU on listed = face; pre-IPO ESOP discounted by
  // company-specific liquidity factor (defaults 0.30, but Razorpay-style
  // active-buyback cos can push this to 0.55). Caller passes override
  // via input.equityLiquidityFactor; otherwise we use the type default.
  const liquidityFactor = input.equityLiquidityFactor
    ?? (equityType === "rsu" ? 1.0 : equityType === "esop" ? 0.30 : 0);
  const equityRealistic = equity * liquidityFactor;

  // Cash CTC = stated - equity face - employer benefits loading on cash portion.
  // Note: stated CTC commonly INCLUDES employer EPF/gratuity in the headline.
  // We back those out so cash CTC is what's actually committed as salary.
  const cashCtcGross = Math.max(0, stated - equity);
  const cashCtcLpa = cashCtcGross / (1 + benefitsLoading);

  const variableTarget = cashCtcLpa * variablePct;
  const variableRealistic = variableTarget * payoutFactor;
  const fixedCash = cashCtcLpa - variableTarget;

  // Employee EPF: 12% of basic. Basic is ~50% of fixed in Indian payroll.
  // (₹0.21L cap option exists; using gross 12% of basic as the realistic
  // private-sector default since most product cos do full-basic EPF.)
  const employeeEpf = fixedCash * 0.50 * 0.12;

  // Taxable income = (fixed + realistic variable) - std deduction - employee EPF.
  const stdDeduction = 0.75; // ₹75,000 in LPA terms
  const taxableLpa = Math.max(0, fixedCash + variableRealistic - stdDeduction - employeeEpf);
  const taxLpa = computeNewRegimeTaxLpa(taxableLpa);

  const annualTakeHome = Math.max(0, fixedCash + variableRealistic - employeeEpf - taxLpa);
  const monthlyInr = (annualTakeHome * LPA) / 12;
  const totalRealistic = annualTakeHome + equityRealistic;
  const gap = stated - totalRealistic;
  const gapPct = stated > 0 ? gap / stated : 0;

  return {
    statedCtcLpa: round1(stated),
    equityLpa: round1(equity),
    equityRealisticLpa: round1(equityRealistic),
    cashCtcLpa: round1(cashCtcLpa),
    fixedCashLpa: round1(fixedCash),
    variableTargetLpa: round1(variableTarget),
    variableRealisticLpa: round1(variableRealistic),
    employeeEpfLpa: round1(employeeEpf),
    annualTaxLpa: round1(taxLpa),
    annualTakeHomeLpa: round1(annualTakeHome),
    monthlyTakeHomeInr: Math.round(monthlyInr / 100) * 100,
    totalRealisticLpa: round1(totalRealistic),
    gapLpa: round1(gap),
    gapPct: round1(gapPct * 100) / 100,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
