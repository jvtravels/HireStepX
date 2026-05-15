/**
 * Indian FY25-26 income tax calculator — new + old regime.
 *
 * Pure, deterministic, no I/O. Used by the negotiation prompt layer to
 * translate CTC components into take-home, and to recommend a regime
 * when the candidate asks for in-hand math.
 *
 * Conventions:
 *   - All monetary inputs/outputs are in INR LPA (Lakhs Per Annum), unless
 *     a name explicitly says "rupees" or "monthly".
 *   - Slabs are FY25-26 (April 2025 - March 2026), which is the live regime
 *     at the time this module ships (May 2026).
 *   - Health & Education cess: 4% on tax (both regimes).
 *   - New regime: standard deduction ₹75K; Sec 87A rebate fully zeroes tax
 *     on taxable income up to ₹12L; NPS 80CCD(2) employer contribution is
 *     NOT deductible under new regime (only basic + other employer benefits
 *     are pre-tax via salary structuring, which this calculator ignores —
 *     we model take-home of the disclosed CTC at the regime level).
 *   - Old regime: standard deduction ₹50K; 80C cap ₹1.5L (assumed maxed);
 *     80CCD(2) employer NPS deductible up to 10% of basic; HRA exemption
 *     and LTA exemption applied if components stated.
 */

export interface CtcInput {
  /** Fixed CTC (LPA) — base + fixed allowances. */
  fixedLpa: number;
  /** Variable / bonus target (LPA). */
  variableLpa: number;
  /** Employer PF contribution (LPA). Optional; default 0. */
  employerPfLpa?: number;
  /** HRA as percent of basic (e.g. 40 means 40% of basic). Default 40. */
  hraPctOfBasic?: number;
  /** LTA component (LPA). Default 0. */
  ltaLpa?: number;
  /** Gratuity accrual (LPA). Default 0. */
  gratuityLpa?: number;
  /** Employer NPS Sec 80CCD(2) contribution (LPA). Default 0. */
  nps80CCD2Lpa?: number;
}

export interface TaxResult {
  regime: "new" | "old";
  grossLpa: number;
  taxableLpa: number;
  taxBeforeCessLpa: number;
  rebate87ALpa: number;
  cessLpa: number;
  totalTaxLpa: number;
  netLpa: number;
  monthlyTakeHomeRupees: number;
}

const NEW_SLABS: ReadonlyArray<[number, number]> = [
  [3, 0],
  [7, 0.05],
  [10, 0.10],
  [12, 0.15],
  [15, 0.20],
  [Infinity, 0.30],
];

const OLD_SLABS: ReadonlyArray<[number, number]> = [
  [2.5, 0],
  [5, 0.05],
  [10, 0.20],
  [Infinity, 0.30],
];

const NEW_STD_DED_LPA = 0.75;
const OLD_STD_DED_LPA = 0.50;
const CESS_RATE = 0.04;
const NEW_87A_CAP_LPA = 12.0;
const OLD_87A_CAP_LPA = 5.0;
const OLD_80C_CAP_LPA = 1.5;

/** Sum slab tax for a taxable LPA against a slab table (cumulative bracket
 *  edges; each pair = [upper_edge_LPA, rate]). Pure. */
function applySlabs(
  taxableLpa: number,
  slabs: ReadonlyArray<[number, number]>,
): number {
  if (taxableLpa <= 0) return 0;
  let tax = 0;
  let prev = 0;
  for (const [edge, rate] of slabs) {
    if (taxableLpa <= prev) break;
    const span = Math.min(taxableLpa, edge) - prev;
    if (span > 0) tax += span * rate;
    prev = edge;
    if (taxableLpa <= edge) break;
  }
  return tax;
}

function computeGrossLpa(input: CtcInput): number {
  return (
    input.fixedLpa +
    input.variableLpa +
    (input.employerPfLpa ?? 0) +
    (input.ltaLpa ?? 0) +
    (input.gratuityLpa ?? 0) +
    (input.nps80CCD2Lpa ?? 0)
  );
}

/** Compute tax + take-home under the new regime (FY25-26 slabs).
 *  NPS 80CCD(2) is NOT deductible under new regime in this model. */
export function computeNewRegime(input: CtcInput): TaxResult {
  const gross = computeGrossLpa(input);
  // Under new regime, only the inHand cash compensation is taxed —
  // employer PF & gratuity accrual are not taxable to the employee.
  // Pre-tax base = fixed + variable + LTA + NPS (NPS taxable here per new regime).
  const preDed =
    input.fixedLpa +
    input.variableLpa +
    (input.ltaLpa ?? 0) +
    (input.nps80CCD2Lpa ?? 0);
  const taxable = Math.max(0, preDed - NEW_STD_DED_LPA);
  const slabTax = applySlabs(taxable, NEW_SLABS);
  // Sec 87A: full rebate if taxable income ≤ ₹12L.
  const rebate = taxable <= NEW_87A_CAP_LPA ? slabTax : 0;
  const taxAfterRebate = Math.max(0, slabTax - rebate);
  const cess = taxAfterRebate * CESS_RATE;
  const total = taxAfterRebate + cess;
  const netCash = preDed - total; // PF & gratuity are accruals, not cash
  return {
    regime: "new",
    grossLpa: round2(gross),
    taxableLpa: round2(taxable),
    taxBeforeCessLpa: round2(slabTax),
    rebate87ALpa: round2(rebate),
    cessLpa: round2(cess),
    totalTaxLpa: round2(total),
    netLpa: round2(netCash),
    monthlyTakeHomeRupees: Math.round((netCash * 100000) / 12),
  };
}

/** Compute tax + take-home under the old regime (FY25-26 slabs).
 *  Assumes 80C fully utilised (₹1.5L), HRA exemption ≈ min(actual HRA, 50%
 *  of basic — using metro proxy). 80CCD(2) employer NPS deductible. */
export function computeOldRegime(input: CtcInput): TaxResult {
  const gross = computeGrossLpa(input);
  // Basic ≈ 50% of fixed for a typical Indian salary structure (rule-of-
  // thumb used by HR systems when not explicitly disclosed).
  const basic = input.fixedLpa * 0.5;
  const hraPct = (input.hraPctOfBasic ?? 40) / 100;
  const hra = basic * hraPct;
  // HRA exemption (metro): min(actual HRA, 50% of basic). The "actual rent
  // minus 10% of basic" leg requires rent data the calculator doesn't have;
  // we use the structural cap which approximates a typical metro filer.
  const hraExempt = Math.min(hra, basic * 0.5);
  const lta = input.ltaLpa ?? 0;
  const nps = input.nps80CCD2Lpa ?? 0;
  // 80CCD(2) deductible up to 10% of basic.
  const npsDeductible = Math.min(nps, basic * 0.10);
  const preDed =
    input.fixedLpa + input.variableLpa + lta + nps;
  const deductions =
    OLD_STD_DED_LPA + OLD_80C_CAP_LPA + hraExempt + lta + npsDeductible;
  const taxable = Math.max(0, preDed - deductions);
  const slabTax = applySlabs(taxable, OLD_SLABS);
  const rebate = taxable <= OLD_87A_CAP_LPA ? slabTax : 0;
  const taxAfterRebate = Math.max(0, slabTax - rebate);
  const cess = taxAfterRebate * CESS_RATE;
  const total = taxAfterRebate + cess;
  const netCash = preDed - total;
  return {
    regime: "old",
    grossLpa: round2(gross),
    taxableLpa: round2(taxable),
    taxBeforeCessLpa: round2(slabTax),
    rebate87ALpa: round2(rebate),
    cessLpa: round2(cess),
    totalTaxLpa: round2(total),
    netLpa: round2(netCash),
    monthlyTakeHomeRupees: Math.round((netCash * 100000) / 12),
  };
}

export interface RegimeRecommendation {
  recommended: "new" | "old";
  newResult: TaxResult;
  oldResult: TaxResult;
  savingsLpa: number;
  reason: string;
}

/** Recommend the better regime for a given CTC. Higher net = winner.
 *  Returns both results so the caller can show the bridge. */
export function recommendRegime(input: CtcInput): RegimeRecommendation {
  const n = computeNewRegime(input);
  const o = computeOldRegime(input);
  const recommended = n.netLpa >= o.netLpa ? "new" : "old";
  const savings = Math.abs(n.netLpa - o.netLpa);
  let reason: string;
  if (savings < 0.05) {
    reason = "Both regimes net within ₹5K; new regime preferred for simplicity.";
  } else if (recommended === "new") {
    reason = `New regime saves ₹${savings.toFixed(2)}L vs old (87A rebate + lower slabs).`;
  } else {
    reason = `Old regime saves ₹${savings.toFixed(2)}L vs new (HRA + 80C + NPS deductions outweigh higher slabs).`;
  }
  return { recommended, newResult: n, oldResult: o, savingsLpa: round2(savings), reason };
}

/** Format an annual net (LPA) as a human-readable monthly take-home string,
 *  e.g. "₹1,12,500/mo". Indian comma formatting. */
export function formatTakeHomeMonthly(annualNetLpa: number): string {
  const monthly = Math.round((annualNetLpa * 100000) / 12);
  return `₹${formatIndianNumber(monthly)}/mo`;
}

function formatIndianNumber(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const sign = n < 0 ? "-" : "";
  const s = Math.abs(Math.round(n)).toString();
  if (s.length <= 3) return sign + s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  const grouped = rest.replace(/(\d)(?=(\d\d)+$)/g, "$1,");
  return sign + grouped + "," + last3;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
