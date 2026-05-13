/* Company-specific benefits / perks overrides.
 *
 * The salary kernel handles CTC, joining bonus, equity, and variable —
 * but candidates routinely ask "what are the benefits?" before signing,
 * and the kernel had no source of truth for the non-cash package. The
 * Lollypop / "Accenture-style" sessions (May 2026) showed the AI
 * responding to "can you let me know the benefits for this role?" with
 * just CTC + JB and looping the same close on re-ask.
 *
 * This file is the source of truth for the non-cash package. Looked up
 * by `lookupCompanyBenefits(company)` in
 * `server-handlers/_negotiate-turn-helpers.ts` when the candidate has
 * asked for the benefits breakdown (`benefits-overview` info intent).
 *
 * Match is case-insensitive substring (Accenture matches "Accenture
 * India", "Accenture Solutions Pvt Ltd", etc.). A missing entry falls
 * back to the generic Indian-corporate package defined inline at the
 * call site — never throws. Refresh quarterly; data is intentionally
 * conservative ("typically", "up to") rather than committing to
 * specific rupee figures the recruiter doesn't have authority on. */

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

/** Per-company overrides. Keyed by canonical company name; the lookup
 *  helper does case-insensitive substring matching. Entries are
 *  intentionally non-exhaustive — only the highest-traffic companies in
 *  the kernel are listed; everyone else gets the generic package. */
export const COMPANY_BENEFITS: Record<string, CompanyBenefits> = {
  Accenture: {
    healthInsurance: "Group medical insurance for employee + spouse + 2 children + parents, ₹5-7 lakh cover; OPD reimbursement available",
    providentFund: "Standard 12% Provident Fund employer contribution",
    gratuity: "Gratuity per statute (5-year vesting)",
    paidTimeOff: "21 days annual leave + 10 sick leave + ~12 public holidays",
    performanceBonus: "Annual variable pay, typically 10-15% of CTC tied to individual + business performance",
    learningBudget: "Access to Accenture Learning Hub + sponsored certifications (AWS, Azure, GCP, Salesforce, etc.)",
    workMode: "Hybrid — typically 3 days in office, role-dependent",
    signaturePerks: "Internal mobility, global project rotation, ESPP for eligible bands",
  },
  TCS: {
    healthInsurance: "Group medical cover for employee + family, ~₹3-5 lakh sum insured",
    providentFund: "12% PF employer contribution",
    gratuity: "Statutory gratuity (5-year vesting)",
    paidTimeOff: "16-22 days annual leave (slab-based) + 8 sick + public holidays",
    performanceBonus: "Quarterly variable allowance + annual performance bonus, ~10% of CTC",
    learningBudget: "TCS iEvolve learning platform + role-based certifications sponsored",
    workMode: "Hybrid — varies by project, mostly office-leaning",
  },
  Infosys: {
    healthInsurance: "Group medical insurance for employee + dependents, ~₹3-6 lakh cover",
    providentFund: "12% PF employer contribution",
    gratuity: "Statutory gratuity (5-year vesting)",
    paidTimeOff: "15 days privilege leave + 12 sick + public holidays",
    performanceBonus: "Performance-linked variable, typically 8-12% of CTC",
    learningBudget: "Infosys Lex learning platform + paid certifications",
    workMode: "Hybrid — typically 10 days/month in office",
  },
  Wipro: {
    healthInsurance: "Group medical cover for employee + family, ~₹3-5 lakh sum insured",
    providentFund: "12% PF employer contribution",
    gratuity: "Statutory gratuity (5-year vesting)",
    paidTimeOff: "16-22 days annual leave + 8 sick + public holidays",
    performanceBonus: "Annual variable, ~8-12% of CTC",
    learningBudget: "Wipro Learning Pi + reimbursed certifications",
    workMode: "Hybrid",
  },
  Google: {
    healthInsurance: "Premium group medical + dental + vision for employee + family + parents, ₹10 lakh+ cover, no co-pay on most claims",
    providentFund: "PF + NPS options; employer matches additional contribution",
    gratuity: "Statutory gratuity (5-year vesting)",
    paidTimeOff: "20+ days annual leave + 12 sick + bereavement + parental leave (24 weeks maternity, 12 weeks paternity)",
    performanceBonus: "Annual cash bonus (~15% of base, performance-linked) + GSU equity refresh cycle",
    learningBudget: "Generous learning stipend, conference attendance, internal Google University courses",
    workMode: "Hybrid — 3 days in office (Bangalore / Gurgaon / Hyderabad)",
    signaturePerks: "Free meals, on-campus gym, wellness benefits, commute support, employee stock (GSU) refresh",
  },
  Microsoft: {
    healthInsurance: "Group medical + dental + vision for employee + family + parents, ₹7-10 lakh cover",
    providentFund: "PF + NPS options with employer match",
    gratuity: "Statutory gratuity (5-year vesting)",
    paidTimeOff: "20 days annual leave + 10 sick + parental leave (26 weeks maternity, 6 weeks paternity)",
    performanceBonus: "Annual cash bonus (0-30% of base) + stock awards on hire + refresh",
    learningBudget: "LinkedIn Learning + Microsoft Learn + conference allowance",
    workMode: "Hybrid — flexible, 2-3 days in office expected",
    signaturePerks: "ESPP at 10% discount, wellness reimbursement, internet stipend",
  },
  Amazon: {
    healthInsurance: "Group medical + parents cover, ~₹5-8 lakh sum insured",
    providentFund: "12% PF employer contribution",
    gratuity: "Statutory gratuity (5-year vesting)",
    paidTimeOff: "15 days annual + 10 sick + parental leave",
    performanceBonus: "Sign-on bonus split across year 1 and year 2; RSU vesting back-loaded (5%-15%-40%-40%)",
    learningBudget: "Amazon-internal training + reimbursement for select certifications",
    workMode: "5 days in office (post-2025 RTO mandate)",
    signaturePerks: "RSUs vesting in 4 years (back-loaded), internal transfer mobility",
  },
  Flipkart: {
    healthInsurance: "Group medical for employee + spouse + 2 kids + parents, ₹5-10 lakh cover",
    providentFund: "12% PF employer contribution",
    gratuity: "Statutory gratuity (5-year vesting)",
    paidTimeOff: "24 days annual leave + 12 sick + parental leave (26 weeks maternity, 6 weeks paternity)",
    performanceBonus: "Annual performance bonus (10-20% of CTC) + ESOPs for select roles",
    learningBudget: "Internal Flipkart Learning Hub + external course sponsorship",
    workMode: "Hybrid — typically 3 days in office",
    signaturePerks: "ESOPs (RSU-style) for senior IC/manager roles, on-site cafeteria, wellness budget",
  },
  Swiggy: {
    healthInsurance: "Group medical for employee + spouse + kids + parents, ₹5 lakh+ cover",
    providentFund: "12% PF employer contribution",
    gratuity: "Statutory gratuity (5-year vesting)",
    paidTimeOff: "Unlimited / flexible PTO (manager-approval), 26 weeks maternity, 4 weeks paternity",
    performanceBonus: "Performance bonus + ESOPs for eligible roles",
    learningBudget: "Annual learning stipend + internal courses",
    workMode: "Hybrid — 3 days in office",
    signaturePerks: "Free Swiggy One membership, food allowance, ESOPs for senior roles",
  },
  Zomato: {
    healthInsurance: "Group medical for employee + family, ~₹5 lakh cover",
    providentFund: "12% PF employer contribution",
    gratuity: "Statutory gratuity (5-year vesting)",
    paidTimeOff: "21 days annual leave + sick + 26 weeks maternity / paternity policy",
    performanceBonus: "Performance bonus + ESOPs post-IPO for eligible roles",
    learningBudget: "Internal courses + external reimbursement (case by case)",
    workMode: "Hybrid",
    signaturePerks: "ESOPs (listed equity), Zomato Pro membership",
  },
  Razorpay: {
    healthInsurance: "Group medical for employee + spouse + kids + parents, ₹5-8 lakh cover",
    providentFund: "12% PF employer contribution",
    gratuity: "Statutory gratuity (5-year vesting)",
    paidTimeOff: "26 days annual leave (no separate sick leave) + 26 weeks maternity / 6 weeks paternity",
    performanceBonus: "Annual performance bonus + ESOPs (vest 4 years, 1-year cliff)",
    learningBudget: "Annual learning stipend (~₹50k) for courses/conferences",
    workMode: "Hybrid — flexible, role-dependent",
    signaturePerks: "ESOPs at unicorn valuation, wellness reimbursement, internet allowance",
  },
};

/** Look up benefits for a company. Case-insensitive substring matching:
 *  "Accenture India" matches the "Accenture" entry. Returns the generic
 *  fallback if no entry matches. Pure — no IO, no state. */
export function lookupCompanyBenefits(company: string | null | undefined): CompanyBenefits {
  if (!company || typeof company !== "string") return GENERIC_INDIA_BENEFITS;
  const c = company.trim().toLowerCase();
  if (!c) return GENERIC_INDIA_BENEFITS;
  for (const [key, value] of Object.entries(COMPANY_BENEFITS)) {
    if (c.includes(key.toLowerCase())) return value;
  }
  return GENERIC_INDIA_BENEFITS;
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
