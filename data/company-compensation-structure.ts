/* Company-specific compensation STRUCTURE overrides.
 *
 * Session C follow-up (2026-05-14): this module is now a thin SHIM
 * over `data/company-facts.ts`, which holds the unified per-company
 * table. `CompanyCompensationStructure`, `GENERIC_INDIA_COMP`,
 * `lookupCompanyCompStructure`, and `formatCompStructureForPrompt` are
 * preserved exactly so call sites/tests keep working. New code should
 * prefer `lookupCompanyFacts` directly.
 *
 * Original module purpose, retained for context:
 * Added in session 12 bug fix (2026-05-14). The kernel previously had
 * no handler for utterances like "explain the variable components" or
 * "ESOP details?" — those are asks about the COMPANY's general
 * compensation structure (base/variable/equity ratios, bonus frequency,
 * vesting), not about the candidate's specific offer. Looked up by
 * `lookupCompanyCompStructure(company)` in
 * `_negotiate-turn-helpers.ts` when the candidate has asked for the
 * compensation structure (`compensation-breakdown` info intent).
 *
 * Match is case-insensitive substring. Missing entry falls back to a
 * generic Indian-corporate package; never throws. Ratios sum to ~1.0
 * but are intentionally illustrative (not committed numbers for THIS
 * offer — that's the kernel's job).
 */

import { lookupCompanyFacts, COMPANY_FACTS } from "./company-facts";

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

/** Back-compat: per-company comp structures keyed by canonical name.
 *  Derived from the unified `COMPANY_FACTS` table — DO NOT add new
 *  entries here; add to `data/company-facts.ts` instead. */
/* Keys are lowercased here for back-compat with the pre-consolidation
 * casing convention this module used (tests access `.razorpay`,
 * `.tcs`, etc.). */
export const COMPANY_COMP: Record<string, CompanyCompensationStructure> = Object.fromEntries(
  Object.entries(COMPANY_FACTS)
    .filter(([, v]) => v.compStructure != null)
    .map(([k, v]) => [k.toLowerCase(), v.compStructure as CompanyCompensationStructure]),
);

/** Look up the comp structure for a company. Case-insensitive substring
 *  match via the unified facts table; falls back to GENERIC_INDIA_COMP.
 *  Pure. */
export function lookupCompanyCompStructure(
  company: string | null | undefined,
): CompanyCompensationStructure {
  return lookupCompanyFacts(company).compStructure ?? GENERIC_INDIA_COMP;
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
