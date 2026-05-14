/* Unified per-company facts table.
 *
 * Session C follow-up (2026-05-14): consolidates three parallel
 * per-company lookup modules (`company-benefits`, `company-
 * compensation-structure`, `company-notice-norms`) that had each
 * grown their own substring-match resolver and their own GENERIC_INDIA
 * fallback. Three resolvers meant three places to update when adding a
 * new company, three drift surfaces, and three risks of accidentally
 * inventing data for a company that's only present in one file.
 *
 * Design:
 *  - One canonical record (`COMPANY_FACTS`) keyed by canonical company
 *    name. Each entry has optional `benefits`, `compStructure`,
 *    `noticeNorms` sub-objects — absence is meaningful (the format
 *    helpers fall through to the GENERIC_INDIA defaults defined by
 *    the per-domain shim modules).
 *  - One substring matcher (`lookupCompanyFacts`) that's run ONCE
 *    per candidate utterance. Per-domain accessors (`benefits`,
 *    `compStructure`, `noticeNorms`) return the domain slice or
 *    `undefined`.
 *  - The three legacy modules (`company-benefits.ts`,
 *    `company-compensation-structure.ts`, `company-notice-norms.ts`)
 *    remain as thin shims that delegate here, so all existing call
 *    sites and tests work without modification. Full call-site
 *    migration is a separate refactor.
 *
 * Audit (companies and their coverage):
 *  Accenture, TCS, Infosys, Wipro, Google, Microsoft, Amazon, Flipkart,
 *  Swiggy, Zomato, Razorpay — all 3 domains.
 *  Zepto — notice-norms only (no benefits / comp entries on file; the
 *  format helpers will return the GENERIC_INDIA defaults for those).
 *
 * IMPORTANT: do NOT invent missing sub-objects to "fill out" a row.
 * Absence is intentional and falls through to GENERIC_INDIA defaults
 * at the format-helper layer. Adding fabricated data here would
 * silently commit the simulator to non-authoritative numbers.
 */

import type { CompanyBenefits } from "./company-benefits";
import type { CompanyCompensationStructure } from "./company-compensation-structure";
import type { CompanyNoticeNorm } from "./company-notice-norms";

export interface CompanyFacts {
  benefits?: CompanyBenefits;
  compStructure?: CompanyCompensationStructure;
  noticeNorms?: CompanyNoticeNorm;
}

/* Per-company unified facts. Keys are canonical names; the substring
 * matcher is case-insensitive, so "Accenture India" hits "Accenture".
 * Order matters: when a free-text company name could substring-match
 * multiple keys, earlier keys win — keep more-specific names above
 * more-generic ones. */
export const COMPANY_FACTS: Record<string, CompanyFacts> = {
  Accenture: {
    benefits: {
      healthInsurance: "Group medical insurance for employee + spouse + 2 children + parents, ₹5-7 lakh cover; OPD reimbursement available",
      providentFund: "Standard 12% Provident Fund employer contribution",
      gratuity: "Gratuity per statute (5-year vesting)",
      paidTimeOff: "21 days annual leave + 10 sick leave + ~12 public holidays",
      performanceBonus: "Annual variable pay, typically 10-15% of CTC tied to individual + business performance",
      learningBudget: "Access to Accenture Learning Hub + sponsored certifications (AWS, Azure, GCP, Salesforce, etc.)",
      workMode: "Hybrid — typically 3 days in office, role-dependent",
      signaturePerks: "Internal mobility, global project rotation, ESPP for eligible bands",
    },
    compStructure: { baseRatio: 0.85, variableRatio: 0.15, equityRatio: 0.0, bonusFrequency: "annual", vestingSchedule: "n/a", notes: "Performance bonus tied to annual ratings; no equity component for standard hires." },
    noticeNorms: {
      expectedJoiningWindowDays: "60-90 days joining window depending on band",
      buyoutPolicy: "Buyout up to 30 days available for senior bands",
    },
  },
  TCS: {
    benefits: {
      healthInsurance: "Group medical cover for employee + family, ~₹3-5 lakh sum insured",
      providentFund: "12% PF employer contribution",
      gratuity: "Statutory gratuity (5-year vesting)",
      paidTimeOff: "16-22 days annual leave (slab-based) + 8 sick + public holidays",
      performanceBonus: "Quarterly variable allowance + annual performance bonus, ~10% of CTC",
      learningBudget: "TCS iEvolve learning platform + role-based certifications sponsored",
      workMode: "Hybrid — varies by project, mostly office-leaning",
    },
    compStructure: { baseRatio: 0.90, variableRatio: 0.10, equityRatio: 0.0, bonusFrequency: "quarterly", vestingSchedule: "n/a", notes: "Quarterly variable allowance based on QAVA." },
    noticeNorms: {
      expectedJoiningWindowDays: "90 days notice on TCS side is standard; we expect candidates to serve their full prior notice",
      buyoutPolicy: "Buyout is not standard at TCS; in rare cases approved up to 30 days",
      flexibility: "If you can serve your existing notice cleanly, that's preferred",
    },
  },
  Infosys: {
    benefits: {
      healthInsurance: "Group medical insurance for employee + dependents, ~₹3-6 lakh cover",
      providentFund: "12% PF employer contribution",
      gratuity: "Statutory gratuity (5-year vesting)",
      paidTimeOff: "15 days privilege leave + 12 sick + public holidays",
      performanceBonus: "Performance-linked variable, typically 8-12% of CTC",
      learningBudget: "Infosys Lex learning platform + paid certifications",
      workMode: "Hybrid — typically 10 days/month in office",
    },
    compStructure: { baseRatio: 0.88, variableRatio: 0.12, equityRatio: 0.0, bonusFrequency: "annual", vestingSchedule: "n/a", notes: "" },
    noticeNorms: {
      expectedJoiningWindowDays: "90 days standard joining window from offer acceptance",
      buyoutPolicy: "Buyout limited; case-by-case approval, typically up to 30 days",
    },
  },
  Wipro: {
    benefits: {
      healthInsurance: "Group medical cover for employee + family, ~₹3-5 lakh sum insured",
      providentFund: "12% PF employer contribution",
      gratuity: "Statutory gratuity (5-year vesting)",
      paidTimeOff: "16-22 days annual leave + 8 sick + public holidays",
      performanceBonus: "Annual variable, ~8-12% of CTC",
      learningBudget: "Wipro Learning Pi + reimbursed certifications",
      workMode: "Hybrid",
    },
    compStructure: { baseRatio: 0.88, variableRatio: 0.12, equityRatio: 0.0, bonusFrequency: "annual", vestingSchedule: "n/a", notes: "" },
    noticeNorms: {
      expectedJoiningWindowDays: "90 days standard joining window",
      buyoutPolicy: "Buyout case-by-case, typically capped at 30 days",
    },
  },
  Google: {
    benefits: {
      healthInsurance: "Premium group medical + dental + vision for employee + family + parents, ₹10 lakh+ cover, no co-pay on most claims",
      providentFund: "PF + NPS options; employer matches additional contribution",
      gratuity: "Statutory gratuity (5-year vesting)",
      paidTimeOff: "20+ days annual leave + 12 sick + bereavement + parental leave (24 weeks maternity, 12 weeks paternity)",
      performanceBonus: "Annual cash bonus (~15% of base, performance-linked) + GSU equity refresh cycle",
      learningBudget: "Generous learning stipend, conference attendance, internal Google University courses",
      workMode: "Hybrid — 3 days in office (Bangalore / Gurgaon / Hyderabad)",
      signaturePerks: "Free meals, on-campus gym, wellness benefits, commute support, employee stock (GSU) refresh",
    },
    compStructure: { baseRatio: 0.55, variableRatio: 0.15, equityRatio: 0.30, bonusFrequency: "annual", vestingSchedule: "4-year, monthly after 1-year cliff", notes: "GSU equity grant; annual refreshers." },
    noticeNorms: {
      expectedJoiningWindowDays: "60 days target joining window",
      buyoutPolicy: "Buyout up to 60 days standard for tier-1 talent",
      flexibility: "Flexible start date negotiation supported",
    },
  },
  Microsoft: {
    benefits: {
      healthInsurance: "Group medical + dental + vision for employee + family + parents, ₹7-10 lakh cover",
      providentFund: "PF + NPS options with employer match",
      gratuity: "Statutory gratuity (5-year vesting)",
      paidTimeOff: "20 days annual leave + 10 sick + parental leave (26 weeks maternity, 6 weeks paternity)",
      performanceBonus: "Annual cash bonus (0-30% of base) + stock awards on hire + refresh",
      learningBudget: "LinkedIn Learning + Microsoft Learn + conference allowance",
      workMode: "Hybrid — flexible, 2-3 days in office expected",
      signaturePerks: "ESPP at 10% discount, wellness reimbursement, internet stipend",
    },
    compStructure: { baseRatio: 0.60, variableRatio: 0.15, equityRatio: 0.25, bonusFrequency: "annual", vestingSchedule: "4-year, 20/20/30/30 quarterly", notes: "Stock awards via Promote/Connect cycle." },
    noticeNorms: {
      expectedJoiningWindowDays: "60-day target joining window",
      buyoutPolicy: "Buyout up to 60 days supported",
    },
  },
  Amazon: {
    benefits: {
      healthInsurance: "Group medical + parents cover, ~₹5-8 lakh sum insured",
      providentFund: "12% PF employer contribution",
      gratuity: "Statutory gratuity (5-year vesting)",
      paidTimeOff: "15 days annual + 10 sick + parental leave",
      performanceBonus: "Sign-on bonus split across year 1 and year 2; RSU vesting back-loaded (5%-15%-40%-40%)",
      learningBudget: "Amazon-internal training + reimbursement for select certifications",
      workMode: "5 days in office (post-2025 RTO mandate)",
      signaturePerks: "RSUs vesting in 4 years (back-loaded), internal transfer mobility",
    },
    compStructure: { baseRatio: 0.50, variableRatio: 0.10, equityRatio: 0.40, bonusFrequency: "annual sign-on; no annual perf bonus", vestingSchedule: "4-year, 5/15/40/40 backloaded", notes: "Sign-on bonus front-loaded to offset backloaded RSUs." },
    noticeNorms: {
      expectedJoiningWindowDays: "60-day target joining window",
      buyoutPolicy: "Buyout up to 60 days supported via signing bonus structure",
    },
  },
  Flipkart: {
    benefits: {
      healthInsurance: "Group medical for employee + spouse + 2 kids + parents, ₹5-10 lakh cover",
      providentFund: "12% PF employer contribution",
      gratuity: "Statutory gratuity (5-year vesting)",
      paidTimeOff: "24 days annual leave + 12 sick + parental leave (26 weeks maternity, 6 weeks paternity)",
      performanceBonus: "Annual performance bonus (10-20% of CTC) + ESOPs for select roles",
      learningBudget: "Internal Flipkart Learning Hub + external course sponsorship",
      workMode: "Hybrid — typically 3 days in office",
      signaturePerks: "ESOPs (RSU-style) for senior IC/manager roles, on-site cafeteria, wellness budget",
    },
    compStructure: { baseRatio: 0.70, variableRatio: 0.15, equityRatio: 0.15, bonusFrequency: "annual", vestingSchedule: "4-year, 1-year cliff", notes: "ESOPs typical for senior roles." },
    noticeNorms: {
      expectedJoiningWindowDays: "60-day target joining window",
      buyoutPolicy: "Notice buyout commonly approved up to 60 days",
    },
  },
  Swiggy: {
    benefits: {
      healthInsurance: "Group medical for employee + spouse + kids + parents, ₹5 lakh+ cover",
      providentFund: "12% PF employer contribution",
      gratuity: "Statutory gratuity (5-year vesting)",
      paidTimeOff: "Unlimited / flexible PTO (manager-approval), 26 weeks maternity, 4 weeks paternity",
      performanceBonus: "Performance bonus + ESOPs for eligible roles",
      learningBudget: "Annual learning stipend + internal courses",
      workMode: "Hybrid — 3 days in office",
      signaturePerks: "Free Swiggy One membership, food allowance, ESOPs for senior roles",
    },
    compStructure: { baseRatio: 0.70, variableRatio: 0.20, equityRatio: 0.10, bonusFrequency: "annual", vestingSchedule: "4-year, 1-year cliff", notes: "" },
    noticeNorms: {
      expectedJoiningWindowDays: "30-60 day joining window",
      buyoutPolicy: "Buyout up to 60 days supported",
    },
  },
  Zomato: {
    benefits: {
      healthInsurance: "Group medical for employee + family, ~₹5 lakh cover",
      providentFund: "12% PF employer contribution",
      gratuity: "Statutory gratuity (5-year vesting)",
      paidTimeOff: "21 days annual leave + sick + 26 weeks maternity / paternity policy",
      performanceBonus: "Performance bonus + ESOPs post-IPO for eligible roles",
      learningBudget: "Internal courses + external reimbursement (case by case)",
      workMode: "Hybrid",
      signaturePerks: "ESOPs (listed equity), Zomato Pro membership",
    },
    compStructure: { baseRatio: 0.72, variableRatio: 0.18, equityRatio: 0.10, bonusFrequency: "annual", vestingSchedule: "4-year, 1-year cliff", notes: "" },
    noticeNorms: {
      expectedJoiningWindowDays: "30-60 day joining window",
      buyoutPolicy: "Buyout up to 30-60 days routinely approved",
    },
  },
  Razorpay: {
    benefits: {
      healthInsurance: "Group medical for employee + spouse + kids + parents, ₹5-8 lakh cover",
      providentFund: "12% PF employer contribution",
      gratuity: "Statutory gratuity (5-year vesting)",
      paidTimeOff: "26 days annual leave (no separate sick leave) + 26 weeks maternity / 6 weeks paternity",
      performanceBonus: "Annual performance bonus + ESOPs (vest 4 years, 1-year cliff)",
      learningBudget: "Annual learning stipend (~₹50k) for courses/conferences",
      workMode: "Hybrid — flexible, role-dependent",
      signaturePerks: "ESOPs at unicorn valuation, wellness reimbursement, internet allowance",
    },
    compStructure: { baseRatio: 0.75, variableRatio: 0.15, equityRatio: 0.10, bonusFrequency: "annual", vestingSchedule: "4-year, 1-year cliff", notes: "ESOPs vested quarterly after cliff." },
    noticeNorms: {
      expectedJoiningWindowDays: "60-day joining window; faster preferred",
      buyoutPolicy: "Buyout supported up to 60 days for the right candidate",
      flexibility: "Early joining always welcome; flex on start date supported",
    },
  },
  /* Zepto is intentionally notice-only — there's no curated benefits or
   * comp-structure data on file. Format helpers fall back to GENERIC_INDIA
   * for those domains. Do NOT fabricate the missing slices. */
  Zepto: {
    noticeNorms: {
      expectedJoiningWindowDays: "30-day joining window preferred (early-stage pace)",
      buyoutPolicy: "Notice buyout up to 30 days supported",
      flexibility: "We move fast — earliest possible start preferred",
    },
  },
};

const EMPTY_FACTS: CompanyFacts = {};

/** Resolve a free-text company name to the curated facts record.
 *  Case-insensitive substring match; returns an empty facts object if
 *  no entry matches (caller falls back to GENERIC_INDIA per-domain).
 *  Pure — no IO, no state. */
export function lookupCompanyFacts(company: string | null | undefined): CompanyFacts {
  if (!company || typeof company !== "string") return EMPTY_FACTS;
  const c = company.trim().toLowerCase();
  if (!c) return EMPTY_FACTS;
  for (const [key, value] of Object.entries(COMPANY_FACTS)) {
    if (c.includes(key.toLowerCase())) return value;
  }
  return EMPTY_FACTS;
}
