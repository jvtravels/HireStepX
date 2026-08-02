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
 * Follow-up (2026-05-14, post-consolidation): the three legacy shim
 * modules (`company-benefits.ts`, `company-compensation-structure.ts`,
 * `company-notice-norms.ts`) have been deleted; every call site now
 * imports types, GENERIC_INDIA_* defaults, and format helpers directly
 * from here. Keys on `COMPANY_FACTS` are lowercase canonical slugs
 * (`razorpay`, `accenture`, etc.) — never capitalized display names —
 * because `lookupCompanyFacts` already normalizes the input via
 * lowercase substring match.
 *
 * Design:
 *  - One canonical record (`COMPANY_FACTS`) keyed by lowercase canonical
 *    slug. Each entry has optional `benefits`, `compStructure`,
 *    `noticeNorms` sub-objects — absence is meaningful (the format
 *    helpers fall through to the GENERIC_INDIA defaults defined below).
 *  - One substring matcher (`lookupCompanyFacts`) that's run ONCE
 *    per candidate utterance. Per-domain accessors
 *    (`lookupCompanyBenefits`, `lookupCompanyCompStructure`,
 *    `lookupCompanyNoticeNorm`) return the domain slice or the
 *    GENERIC_INDIA_* fallback.
 *
 * Audit (companies and their coverage):
 *  accenture, tcs, infosys, wipro, google, microsoft, amazon, flipkart,
 *  swiggy, zomato, razorpay — all 3 domains.
 *  zepto — notice-norms only (no benefits / comp entries on file; the
 *  format helpers will return the GENERIC_INDIA defaults for those).
 *
 * IMPORTANT: do NOT invent missing sub-objects to "fill out" a row.
 * Absence is intentional and falls through to GENERIC_INDIA defaults
 * at the format-helper layer. Adding fabricated data here would
 * silently commit the simulator to non-authoritative numbers.
 */

/* ─── Types ───────────────────────────────────────────────────────── */

export interface CompanyBenefits {
  /** Health insurance, coverage amount and dependents covered. */
  healthInsurance: string;
  /** Provident Fund, usually statutory 12% but some startups top up. */
  providentFund: string;
  /** Gratuity policy, 5-year vesting is statutory in India. */
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
  /** Optional context, refresh cycle, sign-on offset, etc. */
  notes: string;
}

export interface CompanyNoticeNorm {
  /** Typical notice period the candidate would owe their NEXT employer
   *  (= the offering company). Most tier-1s align at 60 days; IT services
   *  / mature Indian corporates often want 90. */
  expectedJoiningWindowDays: string;
  /** Whether the offering company typically buys out previous-employer
   *  notice. Recruiter should state this honestly. */
  buyoutPolicy: string;
  /** Short signature note about flexibility / start-date negotiation. */
  flexibility?: string;
}

export interface CompanyFacts {
  benefits?: CompanyBenefits;
  compStructure?: CompanyCompensationStructure;
  noticeNorms?: CompanyNoticeNorm;
}

/* ─── GENERIC_INDIA fallbacks ────────────────────────────────────── */

/** Generic India-corporate fallback benefits package. The kernel emits
 *  this when no company override is found OR when company is unknown.
 *  Numbers are the statutory / typical floor — never a commitment. */
export const GENERIC_INDIA_BENEFITS: CompanyBenefits = {
  healthInsurance: "Group health insurance covering employee + family (spouse, children, optionally parents), typical sum insured ₹5-10 lakh",
  providentFund: "Provident Fund, statutory 12% employer contribution on basic, matched by employee",
  gratuity: "Gratuity per Payment of Gratuity Act, vests at 5 years of continuous service",
  paidTimeOff: "15-20 days annual leave + sick leave + national/state public holidays",
  performanceBonus: "Annual performance bonus, variable component, typically 10-20% of CTC depending on role and rating",
  learningBudget: "Annual learning and development allowance for certifications, conferences, and courses",
  workMode: "Hybrid work policy (typically 2-3 days in office)",
};

/** Generic India-corporate fallback compensation structure. */
export const GENERIC_INDIA_COMP: CompanyCompensationStructure = {
  baseRatio: 0.80,
  variableRatio: 0.15,
  equityRatio: 0.05,
  bonusFrequency: "annual",
  vestingSchedule: "4-year, 1-year cliff (when equity is granted)",
  notes: "Typical Indian-corporate structure; equity component depends on role seniority.",
};

/** Generic India-corporate fallback notice norms. */
export const GENERIC_INDIA_NOTICE: CompanyNoticeNorm = {
  expectedJoiningWindowDays: "Standard joining window is 60-90 days from offer letter",
  buyoutPolicy: "Notice-period buyout is negotiable case-by-case (typically up to 30-60 days)",
  flexibility: "If you can join earlier, we can flex the start date, let us know your no-earlier-than date",
};

/* ─── Per-company unified facts ──────────────────────────────────── */

/* Per-company unified facts. Keys are LOWERCASE canonical slugs; the
 * substring matcher is case-insensitive, so "Accenture India" hits
 * "accenture". Order matters: when a free-text company name could
 * substring-match multiple keys, earlier keys win — keep more-specific
 * names above more-generic ones. */
export const COMPANY_FACTS: Record<string, CompanyFacts> = {
  accenture: {
    benefits: {
      healthInsurance: "Group medical insurance for employee + spouse + 2 children + parents, ₹5-7 lakh cover; OPD reimbursement available",
      providentFund: "Standard 12% Provident Fund employer contribution",
      gratuity: "Gratuity per statute (5-year vesting)",
      paidTimeOff: "21 days annual leave + 10 sick leave + ~12 public holidays",
      performanceBonus: "Annual variable pay, typically 10-15% of CTC tied to individual + business performance",
      learningBudget: "Access to Accenture Learning Hub + sponsored certifications (AWS, Azure, GCP, Salesforce, etc.)",
      workMode: "Hybrid, typically 3 days in office, role-dependent",
      signaturePerks: "Internal mobility, global project rotation, ESPP for eligible bands",
    },
    compStructure: { baseRatio: 0.85, variableRatio: 0.15, equityRatio: 0.0, bonusFrequency: "annual", vestingSchedule: "n/a", notes: "Performance bonus tied to annual ratings; no equity component for standard hires." },
    noticeNorms: {
      expectedJoiningWindowDays: "60-90 days joining window depending on band",
      buyoutPolicy: "Buyout up to 30 days available for senior bands",
    },
  },
  tcs: {
    benefits: {
      healthInsurance: "Group medical cover for employee + family, ~₹3-5 lakh sum insured",
      providentFund: "12% PF employer contribution",
      gratuity: "Statutory gratuity (5-year vesting)",
      paidTimeOff: "16-22 days annual leave (slab-based) + 8 sick + public holidays",
      performanceBonus: "Quarterly variable allowance + annual performance bonus, ~10% of CTC",
      learningBudget: "TCS iEvolve learning platform + role-based certifications sponsored",
      workMode: "Hybrid, varies by project, mostly office-leaning",
    },
    compStructure: { baseRatio: 0.90, variableRatio: 0.10, equityRatio: 0.0, bonusFrequency: "quarterly", vestingSchedule: "n/a", notes: "Quarterly variable allowance based on QAVA." },
    noticeNorms: {
      expectedJoiningWindowDays: "90 days notice on TCS side is standard; we expect candidates to serve their full prior notice",
      buyoutPolicy: "Buyout is not standard at TCS; in rare cases approved up to 30 days",
      flexibility: "If you can serve your existing notice cleanly, that's preferred",
    },
  },
  infosys: {
    benefits: {
      healthInsurance: "Group medical insurance for employee + dependents, ~₹3-6 lakh cover",
      providentFund: "12% PF employer contribution",
      gratuity: "Statutory gratuity (5-year vesting)",
      paidTimeOff: "15 days privilege leave + 12 sick + public holidays",
      performanceBonus: "Performance-linked variable, typically 8-12% of CTC",
      learningBudget: "Infosys Lex learning platform + paid certifications",
      workMode: "Hybrid, typically 10 days/month in office",
    },
    compStructure: { baseRatio: 0.88, variableRatio: 0.12, equityRatio: 0.0, bonusFrequency: "annual", vestingSchedule: "n/a", notes: "" },
    noticeNorms: {
      expectedJoiningWindowDays: "90 days standard joining window from offer acceptance",
      buyoutPolicy: "Buyout limited; case-by-case approval, typically up to 30 days",
    },
  },
  wipro: {
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
  google: {
    benefits: {
      healthInsurance: "Premium group medical + dental + vision for employee + family + parents, ₹10 lakh+ cover, no co-pay on most claims",
      providentFund: "PF + NPS options; employer matches additional contribution",
      gratuity: "Statutory gratuity (5-year vesting)",
      paidTimeOff: "20+ days annual leave + 12 sick + bereavement + parental leave (24 weeks maternity, 12 weeks paternity)",
      performanceBonus: "Annual cash bonus (~15% of base, performance-linked) + GSU equity refresh cycle",
      learningBudget: "Generous learning stipend, conference attendance, internal Google University courses",
      workMode: "Hybrid, 3 days in office (Bangalore / Gurgaon / Hyderabad)",
      signaturePerks: "Free meals, on-campus gym, wellness benefits, commute support, employee stock (GSU) refresh",
    },
    compStructure: { baseRatio: 0.55, variableRatio: 0.15, equityRatio: 0.30, bonusFrequency: "annual", vestingSchedule: "4-year, monthly after 1-year cliff", notes: "GSU equity grant; annual refreshers." },
    noticeNorms: {
      expectedJoiningWindowDays: "60 days target joining window",
      buyoutPolicy: "Buyout up to 60 days standard for tier-1 talent",
      flexibility: "Flexible start date negotiation supported",
    },
  },
  microsoft: {
    benefits: {
      healthInsurance: "Group medical + dental + vision for employee + family + parents, ₹7-10 lakh cover",
      providentFund: "PF + NPS options with employer match",
      gratuity: "Statutory gratuity (5-year vesting)",
      paidTimeOff: "20 days annual leave + 10 sick + parental leave (26 weeks maternity, 6 weeks paternity)",
      performanceBonus: "Annual cash bonus (0-30% of base) + stock awards on hire + refresh",
      learningBudget: "LinkedIn Learning + Microsoft Learn + conference allowance",
      workMode: "Hybrid, flexible, 2-3 days in office expected",
      signaturePerks: "ESPP at 10% discount, wellness reimbursement, internet stipend",
    },
    compStructure: { baseRatio: 0.60, variableRatio: 0.15, equityRatio: 0.25, bonusFrequency: "annual", vestingSchedule: "4-year, 20/20/30/30 quarterly", notes: "Stock awards via Promote/Connect cycle." },
    noticeNorms: {
      expectedJoiningWindowDays: "60-day target joining window",
      buyoutPolicy: "Buyout up to 60 days supported",
    },
  },
  amazon: {
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
  flipkart: {
    benefits: {
      healthInsurance: "Group medical for employee + spouse + 2 kids + parents, ₹5-10 lakh cover",
      providentFund: "12% PF employer contribution",
      gratuity: "Statutory gratuity (5-year vesting)",
      paidTimeOff: "24 days annual leave + 12 sick + parental leave (26 weeks maternity, 6 weeks paternity)",
      performanceBonus: "Annual performance bonus (10-20% of CTC) + ESOPs for select roles",
      learningBudget: "Internal Flipkart Learning Hub + external course sponsorship",
      workMode: "Hybrid, typically 3 days in office",
      signaturePerks: "ESOPs (RSU-style) for senior IC/manager roles, on-site cafeteria, wellness budget",
    },
    compStructure: { baseRatio: 0.70, variableRatio: 0.15, equityRatio: 0.15, bonusFrequency: "annual", vestingSchedule: "4-year, 1-year cliff", notes: "ESOPs typical for senior roles." },
    noticeNorms: {
      expectedJoiningWindowDays: "60-day target joining window",
      buyoutPolicy: "Notice buyout commonly approved up to 60 days",
    },
  },
  swiggy: {
    benefits: {
      healthInsurance: "Group medical for employee + spouse + kids + parents, ₹5 lakh+ cover",
      providentFund: "12% PF employer contribution",
      gratuity: "Statutory gratuity (5-year vesting)",
      paidTimeOff: "Unlimited / flexible PTO (manager-approval), 26 weeks maternity, 4 weeks paternity",
      performanceBonus: "Performance bonus + ESOPs for eligible roles",
      learningBudget: "Annual learning stipend + internal courses",
      workMode: "Hybrid, 3 days in office",
      signaturePerks: "Free Swiggy One membership, food allowance, ESOPs for senior roles",
    },
    compStructure: { baseRatio: 0.70, variableRatio: 0.20, equityRatio: 0.10, bonusFrequency: "annual", vestingSchedule: "4-year, 1-year cliff", notes: "" },
    noticeNorms: {
      expectedJoiningWindowDays: "30-60 day joining window",
      buyoutPolicy: "Buyout up to 60 days supported",
    },
  },
  zomato: {
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
  razorpay: {
    benefits: {
      healthInsurance: "Group medical for employee + spouse + kids + parents, ₹5-8 lakh cover",
      providentFund: "12% PF employer contribution",
      gratuity: "Statutory gratuity (5-year vesting)",
      paidTimeOff: "26 days annual leave (no separate sick leave) + 26 weeks maternity / 6 weeks paternity",
      performanceBonus: "Annual performance bonus + ESOPs (vest 4 years, 1-year cliff)",
      learningBudget: "Annual learning stipend (~₹50k) for courses/conferences",
      workMode: "Hybrid, flexible, role-dependent",
      signaturePerks: "ESOPs at unicorn valuation, wellness reimbursement, internet allowance",
    },
    compStructure: { baseRatio: 0.75, variableRatio: 0.15, equityRatio: 0.10, bonusFrequency: "annual", vestingSchedule: "4-year, 1-year cliff", notes: "ESOPs vested quarterly after cliff." },
    noticeNorms: {
      expectedJoiningWindowDays: "60-day joining window; faster preferred",
      buyoutPolicy: "Buyout supported up to 60 days for the right candidate",
      flexibility: "Early joining always welcome; flex on start date supported",
    },
  },
  /* Zepto is intentionally notice-only, there's no curated benefits or
   * comp-structure data on file. Format helpers fall back to GENERIC_INDIA
   * for those domains. Do NOT fabricate the missing slices. */
  zepto: {
    noticeNorms: {
      expectedJoiningWindowDays: "30-day joining window preferred (early-stage pace)",
      buyoutPolicy: "Notice buyout up to 30 days supported",
      flexibility: "We move fast, earliest possible start preferred",
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
    /* Keys are already lowercase by convention; the toLowerCase() here is
     * defensive in case a future contributor adds a non-lowercased key. */
    if (c.includes(key.toLowerCase())) return value;
  }
  return EMPTY_FACTS;
}

/* ─── Per-domain accessors ───────────────────────────────────────── */

/** Look up benefits for a company. Case-insensitive substring matching:
 *  "Accenture India" matches the "accenture" entry. Returns the generic
 *  fallback if no entry matches. Pure. */
export function lookupCompanyBenefits(company: string | null | undefined): CompanyBenefits {
  return lookupCompanyFacts(company).benefits ?? GENERIC_INDIA_BENEFITS;
}

/** Look up the comp structure for a company. Case-insensitive substring
 *  match via the unified facts table; falls back to GENERIC_INDIA_COMP.
 *  Pure. */
export function lookupCompanyCompStructure(
  company: string | null | undefined,
): CompanyCompensationStructure {
  return lookupCompanyFacts(company).compStructure ?? GENERIC_INDIA_COMP;
}

/** Look up notice norms for a company. Pure; case-insensitive substring
 *  match via the unified facts table; falls back to GENERIC_INDIA_NOTICE
 *  for unknown companies. */
export function lookupCompanyNoticeNorm(
  company: string | null | undefined,
): CompanyNoticeNorm {
  return lookupCompanyFacts(company).noticeNorms ?? GENERIC_INDIA_NOTICE;
}

/* ─── Format helpers ─────────────────────────────────────────────── */

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

/** Format a CompanyNoticeNorm record for the LLM response-hint layer. */
export function formatNoticeNormForPrompt(n: CompanyNoticeNorm): string {
  const lines = [
    `- Joining window: ${n.expectedJoiningWindowDays}`,
    `- Buyout policy: ${n.buyoutPolicy}`,
  ];
  if (n.flexibility) lines.push(`- Flexibility: ${n.flexibility}`);
  return lines.join("\n");
}
