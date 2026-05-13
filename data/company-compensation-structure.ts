/* Company-specific compensation STRUCTURE overrides.
 *
 * Added in session 12 bug fix (2026-05-14). The kernel previously had
 * no handler for utterances like "explain the variable components" or
 * "ESOP details?" — those are asks about the COMPANY's general
 * compensation structure (base/variable/equity ratios, bonus
 * frequency, vesting), not about the candidate's specific offer.
 *
 * Looked up by `lookupCompanyCompStructure(company)` in
 * `_negotiate-turn-helpers.ts` when the candidate has asked for the
 * compensation structure (`compensation-breakdown` info intent). Match
 * is case-insensitive substring. Missing entry falls back to a generic
 * Indian-corporate package; never throws.
 *
 * Ratios sum to ~1.0 but are intentionally illustrative (not
 * committed numbers for THIS offer — that's the kernel's job). The
 * response-hint layer phrases them as "typical structure at <company>"
 * to keep the disclosure non-binding.
 */

export interface CompanyCompensationStructure {
  /** Fraction of total CTC that is base / fixed salary. 0-1. */
  baseRatio: number;
  /** Fraction of total CTC that is variable / performance bonus. 0-1. */
  variableRatio: number;
  /** Fraction of total CTC attributed to equity (annualised). 0-1.
   *  Zero for service companies / no-equity hires. */
  equityRatio: number;
  /** Bonus payout cadence, e.g. "annual", "quarterly". */
  bonusFrequency: string;
  /** RSU/ESOP vesting shape, e.g. "4-year, 1-year cliff". "n/a" when
   *  the company doesn't offer equity for standard hires. */
  vestingSchedule: string;
  /** Optional context — refresh cycle, sign-on offset, etc. */
  notes: string;
}

/** Generic India-corporate fallback structure. */
export const GENERIC_INDIA_COMP: CompanyCompensationStructure = {
  baseRatio: 0.80,
  variableRatio: 0.15,
  equityRatio: 0.05,
  bonusFrequency: "annual",
  vestingSchedule: "4-year, 1-year cliff (when equity is granted)",
  notes: "Typical Indian-corporate structure; equity component depends on role seniority.",
};

/** Per-company overrides. Keyed by lowercase canonical name; lookup is
 *  case-insensitive substring match. */
export const COMPANY_COMP: Record<string, CompanyCompensationStructure> = {
  razorpay: { baseRatio: 0.75, variableRatio: 0.15, equityRatio: 0.10, bonusFrequency: "annual", vestingSchedule: "4-year, 1-year cliff", notes: "ESOPs vested quarterly after cliff." },
  accenture: { baseRatio: 0.85, variableRatio: 0.15, equityRatio: 0.0, bonusFrequency: "annual", vestingSchedule: "n/a", notes: "Performance bonus tied to annual ratings; no equity component for standard hires." },
  tcs: { baseRatio: 0.90, variableRatio: 0.10, equityRatio: 0.0, bonusFrequency: "quarterly", vestingSchedule: "n/a", notes: "Quarterly variable allowance based on QAVA." },
  google: { baseRatio: 0.55, variableRatio: 0.15, equityRatio: 0.30, bonusFrequency: "annual", vestingSchedule: "4-year, monthly after 1-year cliff", notes: "GSU equity grant; annual refreshers." },
  microsoft: { baseRatio: 0.60, variableRatio: 0.15, equityRatio: 0.25, bonusFrequency: "annual", vestingSchedule: "4-year, 20/20/30/30 quarterly", notes: "Stock awards via Promote/Connect cycle." },
  amazon: { baseRatio: 0.50, variableRatio: 0.10, equityRatio: 0.40, bonusFrequency: "annual sign-on; no annual perf bonus", vestingSchedule: "4-year, 5/15/40/40 backloaded", notes: "Sign-on bonus front-loaded to offset backloaded RSUs." },
  flipkart: { baseRatio: 0.70, variableRatio: 0.15, equityRatio: 0.15, bonusFrequency: "annual", vestingSchedule: "4-year, 1-year cliff", notes: "ESOPs typical for senior roles." },
  swiggy: { baseRatio: 0.70, variableRatio: 0.20, equityRatio: 0.10, bonusFrequency: "annual", vestingSchedule: "4-year, 1-year cliff", notes: "" },
  zomato: { baseRatio: 0.72, variableRatio: 0.18, equityRatio: 0.10, bonusFrequency: "annual", vestingSchedule: "4-year, 1-year cliff", notes: "" },
  infosys: { baseRatio: 0.88, variableRatio: 0.12, equityRatio: 0.0, bonusFrequency: "annual", vestingSchedule: "n/a", notes: "" },
  wipro: { baseRatio: 0.88, variableRatio: 0.12, equityRatio: 0.0, bonusFrequency: "annual", vestingSchedule: "n/a", notes: "" },
};

/** Look up the comp structure for a company. Case-insensitive substring
 *  match; falls back to the generic package. Pure. */
export function lookupCompanyCompStructure(
  company: string | null | undefined,
): CompanyCompensationStructure {
  if (!company || typeof company !== "string") return GENERIC_INDIA_COMP;
  const c = company.trim().toLowerCase();
  if (!c) return GENERIC_INDIA_COMP;
  for (const [key, value] of Object.entries(COMPANY_COMP)) {
    if (c.includes(key)) return value;
  }
  return GENERIC_INDIA_COMP;
}

/** Format a CompanyCompensationStructure into a prose blob for the
 *  response-hint layer. When `totalCtc` is provided (in LPA), surface
 *  per-component rupee figures alongside the percentages. Pure. */
export function formatCompStructureForPrompt(
  s: CompanyCompensationStructure,
  totalCtc: number,
): string {
  const round1 = (n: number) => Math.round(n * 10) / 10;
  const basePct = Math.round(s.baseRatio * 100);
  const varPct = Math.round(s.variableRatio * 100);
  const eqPct = Math.round(s.equityRatio * 100);
  const hasCtc = Number.isFinite(totalCtc) && totalCtc > 0;
  const baseLpa = hasCtc ? round1(totalCtc * s.baseRatio) : null;
  const varLpa = hasCtc ? round1(totalCtc * s.variableRatio) : null;
  const eqLpa = hasCtc ? round1(totalCtc * s.equityRatio) : null;
  const lines: string[] = [];
  lines.push(
    hasCtc
      ? `- Base: ₹${baseLpa} LPA (${basePct}% of CTC)`
      : `- Base: ${basePct}% of CTC`,
  );
  lines.push(
    hasCtc
      ? `- Variable / performance bonus: ₹${varLpa} LPA (${varPct}% of CTC)`
      : `- Variable / performance bonus: ${varPct}% of CTC`,
  );
  if (s.equityRatio > 0) {
    lines.push(
      hasCtc
        ? `- Equity (annualised): ₹${eqLpa} LPA (${eqPct}% of CTC)`
        : `- Equity (annualised): ${eqPct}% of CTC`,
    );
  } else {
    lines.push(`- Equity: not part of standard hires at this band`);
  }
  lines.push(`- Bonus frequency: ${s.bonusFrequency}`);
  lines.push(`- Vesting schedule: ${s.vestingSchedule}`);
  if (s.notes) lines.push(`- Notes: ${s.notes}`);
  return lines.join("\n");
}
