/* Company-specific notice-period norms.
 *
 * Audit Session C (2026-05-14) — companion to company-benefits.ts.
 * The `notice-period-ask` info intent fires when the candidate asks the
 * RECRUITER about the offering company's notice/start-date policy
 * ("when do I need to join?", "what's the notice on my side?",
 * "can you buy out my notice?"). This is distinct from the candidate
 * STATING their own notice (noticeJoining extraction).
 *
 * Conservative India-default: 60-90 days. Buyout is industry-standard
 * for tier-1 / FAANG India and many startups; service-based IT tends to
 * insist on full notice. Refresh annually; intentionally returns a
 * single descriptive string rather than rupee figures (recruiters don't
 * have authority to quote a specific buyout number on the fly).
 */

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

export const GENERIC_INDIA_NOTICE: CompanyNoticeNorm = {
  expectedJoiningWindowDays: "Standard joining window is 60-90 days from offer letter",
  buyoutPolicy: "Notice-period buyout is negotiable case-by-case (typically up to 30-60 days)",
  flexibility: "If you can join earlier, we can flex the start date — let us know your no-earlier-than date",
};

/* Per-company overrides. Case-insensitive substring matching via
 * `lookupCompanyNoticeNorm`. Service-based IT (TCS / Infosys / Wipro)
 * standard is 90 days. FAANG India and tier-1 startups are 60 days with
 * buyout commonly offered. Early-stage startups often 30 days. */
export const COMPANY_NOTICE_NORMS: Record<string, CompanyNoticeNorm> = {
  TCS: {
    expectedJoiningWindowDays: "90 days notice on TCS side is standard; we expect candidates to serve their full prior notice",
    buyoutPolicy: "Buyout is not standard at TCS; in rare cases approved up to 30 days",
    flexibility: "If you can serve your existing notice cleanly, that's preferred",
  },
  Infosys: {
    expectedJoiningWindowDays: "90 days standard joining window from offer acceptance",
    buyoutPolicy: "Buyout limited; case-by-case approval, typically up to 30 days",
  },
  Wipro: {
    expectedJoiningWindowDays: "90 days standard joining window",
    buyoutPolicy: "Buyout case-by-case, typically capped at 30 days",
  },
  Accenture: {
    expectedJoiningWindowDays: "60-90 days joining window depending on band",
    buyoutPolicy: "Buyout up to 30 days available for senior bands",
  },
  Google: {
    expectedJoiningWindowDays: "60 days target joining window",
    buyoutPolicy: "Buyout up to 60 days standard for tier-1 talent",
    flexibility: "Flexible start date negotiation supported",
  },
  Microsoft: {
    expectedJoiningWindowDays: "60-day target joining window",
    buyoutPolicy: "Buyout up to 60 days supported",
  },
  Amazon: {
    expectedJoiningWindowDays: "60-day target joining window",
    buyoutPolicy: "Buyout up to 60 days supported via signing bonus structure",
  },
  Flipkart: {
    expectedJoiningWindowDays: "60-day target joining window",
    buyoutPolicy: "Notice buyout commonly approved up to 60 days",
  },
  Razorpay: {
    expectedJoiningWindowDays: "60-day joining window; faster preferred",
    buyoutPolicy: "Buyout supported up to 60 days for the right candidate",
    flexibility: "Early joining always welcome; flex on start date supported",
  },
  Zomato: {
    expectedJoiningWindowDays: "30-60 day joining window",
    buyoutPolicy: "Buyout up to 30-60 days routinely approved",
  },
  Swiggy: {
    expectedJoiningWindowDays: "30-60 day joining window",
    buyoutPolicy: "Buyout up to 60 days supported",
  },
  Zepto: {
    expectedJoiningWindowDays: "30-day joining window preferred (early-stage pace)",
    buyoutPolicy: "Notice buyout up to 30 days supported",
    flexibility: "We move fast — earliest possible start preferred",
  },
};

/** Look up notice norms for a company. Pure; case-insensitive substring
 *  match; falls back to GENERIC_INDIA_NOTICE for unknown companies. */
export function lookupCompanyNoticeNorm(
  company: string | null | undefined,
): CompanyNoticeNorm {
  if (!company || typeof company !== "string") return GENERIC_INDIA_NOTICE;
  const c = company.trim().toLowerCase();
  if (!c) return GENERIC_INDIA_NOTICE;
  for (const [key, value] of Object.entries(COMPANY_NOTICE_NORMS)) {
    if (c.includes(key.toLowerCase())) return value;
  }
  return GENERIC_INDIA_NOTICE;
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
