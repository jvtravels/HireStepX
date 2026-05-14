/* Company-specific benefits / perks overrides.
 *
 * Session C follow-up (2026-05-14): this module is now a thin SHIM
 * over `data/company-facts.ts`, which holds the unified per-company
 * table. The `CompanyBenefits` type, `GENERIC_INDIA_BENEFITS` fallback,
 * `lookupCompanyBenefits`, and `formatBenefitsForPrompt` are preserved
 * exactly so existing call sites (helpers, tests) keep working. New
 * code should prefer `lookupCompanyFacts` directly.
 *
 * Original module purpose, retained for context:
 * The salary kernel handles CTC, joining bonus, equity, and variable —
 * but candidates routinely ask "what are the benefits?" before signing,
 * and the kernel had no source of truth for the non-cash package. The
 * Lollypop / "Accenture-style" sessions (May 2026) showed the AI
 * responding to "can you let me know the benefits for this role?" with
 * just CTC + JB and looping the same close on re-ask. This module is
 * the source of truth for the non-cash package, looked up by
 * `lookupCompanyBenefits(company)` in
 * `server-handlers/_negotiate-turn-helpers.ts` when the candidate has
 * asked for the benefits breakdown (`benefits-overview` info intent).
 *
 * Match is case-insensitive substring (Accenture matches "Accenture
 * India", "Accenture Solutions Pvt Ltd", etc.). A missing entry falls
 * back to the generic Indian-corporate package below — never throws.
 */

import { lookupCompanyFacts, COMPANY_FACTS } from "./company-facts";

export interface CompanyBenefits {
  /** Health insurance — coverage amount and dependents covered. */
  healthInsurance: string;
  /** Provident Fund — usually statutory 12% but some startups top up. */
  providentFund: string;
  /** Gratuity policy — 5-year vesting is statutory in India. */
  gratuity: string;
  /** Paid time off (annual leave + sick + holidays). */
  paidTimeOff: string;
  /** Performance bonus / variable. Phrased as a typical range so the
   *  recruiter doesn't conflate this with a committed number. */
  performanceBonus: string;
  /** Annual learning / certification reimbursement. */
  learningBudget: string;
  /** Remote / hybrid / on-site policy. */
  workMode: string;
  /** One or two "signature" perks the company is known for (free meals,
   *  travel allowance, etc.). Optional. */
  signaturePerks?: string;
}

/** Generic India-corporate fallback package. The kernel emits this when
 *  no company override is found OR when company is unknown. Numbers are
 *  the statutory / typical floor — never a commitment. */
export const GENERIC_INDIA_BENEFITS: CompanyBenefits = {
  healthInsurance: "Group health insurance covering employee + family (spouse, children, optionally parents), typical sum insured ₹5-10 lakh",
  providentFund: "Provident Fund — statutory 12% employer contribution on basic, matched by employee",
  gratuity: "Gratuity per Payment of Gratuity Act — vests at 5 years of continuous service",
  paidTimeOff: "15-20 days annual leave + sick leave + national/state public holidays",
  performanceBonus: "Annual performance bonus — variable component, typically 10-20% of CTC depending on role and rating",
  learningBudget: "Annual learning and development allowance for certifications, conferences, and courses",
  workMode: "Hybrid work policy (typically 2-3 days in office)",
};

/** Back-compat: per-company benefits keyed by canonical name. Derived
 *  from the unified `COMPANY_FACTS` table — DO NOT add new entries here;
 *  add to `data/company-facts.ts` instead. */
export const COMPANY_BENEFITS: Record<string, CompanyBenefits> = Object.fromEntries(
  Object.entries(COMPANY_FACTS)
    .filter(([, v]) => v.benefits != null)
    .map(([k, v]) => [k, v.benefits as CompanyBenefits]),
);

/** Look up benefits for a company. Case-insensitive substring matching:
 *  "Accenture India" matches the "Accenture" entry. Returns the generic
 *  fallback if no entry matches. Pure — delegates to
 *  `lookupCompanyFacts`. */
export function lookupCompanyBenefits(company: string | null | undefined): CompanyBenefits {
  return lookupCompanyFacts(company).benefits ?? GENERIC_INDIA_BENEFITS;
}

/** Format a CompanyBenefits record into a recruiter-spoken prose blob
 *  for the LLM response-hint layer. Kept short so the LLM has room to
 *  paraphrase. */
export function formatBenefitsForPrompt(b: CompanyBenefits): string {
  const lines = [
    `- Health insurance: ${b.healthInsurance}`,
    `- Provident Fund: ${b.providentFund}`,
    `- Gratuity: ${b.gratuity}`,
    `- Paid time off: ${b.paidTimeOff}`,
    `- Performance bonus: ${b.performanceBonus}`,
    `- Learning budget: ${b.learningBudget}`,
    `- Work mode: ${b.workMode}`,
  ];
  if (b.signaturePerks) lines.push(`- Other perks: ${b.signaturePerks}`);
  return lines.join("\n");
}
