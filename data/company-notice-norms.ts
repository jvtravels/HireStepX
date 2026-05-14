/* Company-specific notice-period norms.
 *
 * Session C follow-up (2026-05-14): this module is now a thin SHIM
 * over `data/company-facts.ts`, which holds the unified per-company
 * table. `CompanyNoticeNorm`, `GENERIC_INDIA_NOTICE`,
 * `lookupCompanyNoticeNorm`, and `formatNoticeNormForPrompt` are
 * preserved exactly so call sites/tests keep working. New code should
 * prefer `lookupCompanyFacts` directly.
 *
 * Original module purpose, retained for context:
 * Audit Session C (2026-05-14) — companion to company-benefits.ts.
 * The `notice-period-ask` info intent fires when the candidate asks the
 * RECRUITER about the offering company's notice/start-date policy
 * ("when do I need to join?", "what's the notice on my side?",
 * "can you buy out my notice?"). This is distinct from the candidate
 * STATING their own notice (noticeJoining extraction).
 *
 * Conservative India-default: 60-90 days. Buyout is industry-standard
 * for tier-1 / FAANG India and many startups; service-based IT tends to
 * insist on full notice.
 */

import { lookupCompanyFacts, COMPANY_FACTS } from "./company-facts";

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

/** Back-compat: per-company notice norms keyed by canonical name.
 *  Derived from the unified `COMPANY_FACTS` table — DO NOT add new
 *  entries here; add to `data/company-facts.ts` instead. */
export const COMPANY_NOTICE_NORMS: Record<string, CompanyNoticeNorm> = Object.fromEntries(
  Object.entries(COMPANY_FACTS)
    .filter(([, v]) => v.noticeNorms != null)
    .map(([k, v]) => [k, v.noticeNorms as CompanyNoticeNorm]),
);

/** Look up notice norms for a company. Pure; case-insensitive substring
 *  match via the unified facts table; falls back to GENERIC_INDIA_NOTICE
 *  for unknown companies. */
export function lookupCompanyNoticeNorm(
  company: string | null | undefined,
): CompanyNoticeNorm {
  return lookupCompanyFacts(company).noticeNorms ?? GENERIC_INDIA_NOTICE;
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
