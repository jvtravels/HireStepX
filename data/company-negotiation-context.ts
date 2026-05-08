/**
 * Company-level negotiation context — strategic guidance the LLM
 * hiring-manager needs to coach a candidate through a *real* offer
 * conversation for a specific company. Distilled from the salary
 * research backlog (per-company role × level grids with
 * negotiation focus, candidate-should-ask checklists, likely
 * benefits, and liquidity risk).
 *
 * Why a separate file from COMPANY_SALARY_OVERRIDES?
 *   COMPANY_SALARY_OVERRIDES gives the *numeric* band
 *   (₹X-Y LPA total / base / equity). This file gives the
 *   *strategic posture* — what the candidate should ask, what
 *   the realistic negotiation lever is at this level, and how
 *   liquid the equity is. The LLM uses both: numbers from the
 *   override layer drive the offer math; this file drives the
 *   coaching text and the recruiter's tone.
 *
 * Wiring: rendered into the salary-negotiation prompt by
 *   formatCompanyNegotiationContext() → consumed by
 *   buildSalaryNegotiationGuidance() in salary-lookup.ts.
 *
 * Refresh: when scraped research backlog updates, mirror here.
 */

export type LiquidityRisk = "low" | "medium" | "medium-high" | "high";

export interface CompanyNegotiationContext {
  /** Likelihood the equity becomes cash. Listed cos = low, ESOP at
   *  pre-IPO Indian unicorn = medium-high. Drives the "discount the
   *  equity face value" coaching. */
  liquidityRisk: LiquidityRisk;
  /** Concrete things the candidate should ask HR before signing.
   *  These are SPECIFIC to this company's quirks, not generic
   *  "ask about salary" advice. */
  candidateShouldAsk: string[];
  /** Common benefits beyond CTC at this company. Lets the
   *  hiring-manager mention them proactively. */
  likelyBenefits: string[];
  /** Per-(role-label × level) negotiation focus, formatted as
   *  "<role> <Junior|Mid|Senior>: <focus>" lines. Verbatim from
   *  the research grid so the LLM can pattern-match the
   *  candidate's role text to the closest line. Roles outside
   *  the standard taxonomy (Risk/Fraud Analyst, Inspection
   *  Engineer, Dealer Relations) are kept as-is — they're more
   *  useful as coaching prompts than as missed lookups. */
  negotiationFocusGrid: string[];
  /** ISO date — pair with research-backlog timestamp. */
  lastVerified: string;
}

export const COMPANY_NEGOTIATION_CONTEXT: Record<string, CompanyNegotiationContext> = {
  meesho: {
    liquidityRisk: "medium-high",
    candidateShouldAsk: [
      "ESOP strike price vs current FMV",
      "Buyback history + next planned window",
      "Fixed vs variable split for this role",
      "Category/growth target payout history (last 4 cycles)",
      "Internal level mapping vs comp band",
      "First appraisal cycle timing",
    ],
    likelyBenefits: [
      "health insurance",
      "PF + gratuity",
      "ESOP for product/tech roles",
      "role-based bonus",
      "device policy for tech/product/design",
      "hybrid possible",
      "learning budget possible",
      "joining bonus for critical hires",
    ],
    negotiationFocusGrid: [
      "Software Engineer Junior: Fixed + joining bonus",
      "Software Engineer Mid: Fixed + ESOP clarity",
      "Software Engineer Senior: Fixed + level",
      "Product Manager Junior: Role scope",
      "Product Manager Mid: Fixed + ESOP",
      "Product Manager Senior: Product ownership",
      "Data Scientist Junior: Fixed + model impact",
      "Data Scientist Mid: ML/business impact",
      "Data Scientist Senior: Ownership + scope",
      "UX/Product Designer Junior: Fixed",
      "UX/Product Designer Mid: Portfolio + level",
      "UX/Product Designer Senior: Product ownership",
      "Category Manager Junior: Fixed + variable",
      "Category Manager Mid: Category P&L",
      "Category Manager Senior: Category ownership",
      "Growth Marketing Junior: Fixed + variable",
      "Growth Marketing Mid: CAC/ROI impact",
      "Growth Marketing Senior: Growth ownership",
    ],
    lastVerified: "2026-05-08",
  },

  myntra: {
    liquidityRisk: "medium",
    candidateShouldAsk: [
      "Whether equity is ESOP / RSU / Flipkart-group-linked",
      "Fixed vs variable split",
      "Category incentive payout rules",
      "Apparel/retail employee benefits",
      "Internal level vs Flipkart-group calibration",
      "Appraisal timing",
    ],
    likelyBenefits: [
      "health insurance",
      "PF + gratuity",
      "office benefits",
      "possible product/tech equity (group-linked)",
      "bonus by role",
      "employee shopping benefits",
      "device policy for tech/design",
      "relocation case-by-case",
    ],
    negotiationFocusGrid: [
      "Software Engineer Junior: Fixed + joining bonus",
      "Software Engineer Mid: Fixed + level",
      "Software Engineer Senior: Level calibration (vs Flipkart group)",
      "Product Manager Junior: Scope + fixed",
      "Product Manager Mid: Product scope",
      "Product Manager Senior: Ownership + org impact",
      "UX/Product Designer Junior: Fixed + portfolio",
      "UX/Product Designer Mid: Craft + ownership",
      "UX/Product Designer Senior: Design leadership",
      "Category Manager Junior: Category scope",
      "Category Manager Mid: Category P&L",
      "Category Manager Senior: P&L ownership",
      "Merchandising Junior: Fixed",
      "Merchandising Mid: Brand/category impact",
      "Merchandising Senior: Ownership",
      "Brand Marketing Junior: Campaign impact",
      "Brand Marketing Mid: Brand/growth impact",
      "Brand Marketing Senior: Brand ownership",
    ],
    lastVerified: "2026-05-08",
  },

  nykaa: {
    liquidityRisk: "medium",
    candidateShouldAsk: [
      "Fixed vs variable split",
      "Retail/category incentive calculation",
      "Equity vs stock-linked component (role-wise)",
      "Brand/category targets and reset cadence",
      "Store/region scope (for retail roles)",
      "Appraisal cycle timing",
    ],
    likelyBenefits: [
      "health insurance",
      "PF + gratuity",
      "retail/beauty product perks",
      "role-based bonus",
      "possible equity for senior/product roles",
      "office benefits",
      "hybrid role-dependent",
    ],
    negotiationFocusGrid: [
      "Software Engineer Junior: Fixed",
      "Software Engineer Mid: Fixed + equity",
      "Software Engineer Senior: Fixed + level",
      "Product Manager Junior: Scope",
      "Product Manager Mid: Fixed + product impact",
      "Product Manager Senior: Scope + equity",
      "UX/Product Designer Junior: Fixed + portfolio",
      "UX/Product Designer Mid: Design ownership",
      "UX/Product Designer Senior: Fixed + ownership",
      "Category Manager Junior: Category scope",
      "Category Manager Mid: Category P&L",
      "Category Manager Senior: P&L ownership",
      "Brand Manager Junior: Fixed + bonus",
      "Brand Manager Mid: Brand ownership",
      "Brand Manager Senior: Brand/category impact",
      "Retail Operations Junior: Fixed + shift terms",
      "Retail Operations Mid: Store/region scope",
      "Retail Operations Senior: Regional ownership",
    ],
    lastVerified: "2026-05-08",
  },

  paytm: {
    liquidityRisk: "medium",
    candidateShouldAsk: [
      "Fixed percentage of CTC",
      "Variable payout history (last 4 quarters)",
      "Sales target rules and OTE realism",
      "ESOP / stock-linked structure (role-wise; Paytm is listed)",
      "Internal grade vs published level",
      "First appraisal cycle",
      "Notice buyout policy",
    ],
    likelyBenefits: [
      "health insurance",
      "PF + gratuity",
      "role-wise variable",
      "possible stock/equity for some roles",
      "sales incentives",
      "device policy for tech/product",
      "office benefits",
      "joining bonus for critical roles",
    ],
    negotiationFocusGrid: [
      "Software Engineer Junior: Fixed",
      "Software Engineer Mid: Fixed + level",
      "Software Engineer Senior: Fixed + equity",
      "Product Manager Junior: Scope",
      "Product Manager Mid: Fixed + scope",
      "Product Manager Senior: Product ownership",
      "Risk/Fraud Analyst Junior: Fixed + bonus",
      "Risk/Fraud Analyst Mid: Risk scope",
      "Risk/Fraud Analyst Senior: Criticality",
      "Data Analyst Junior: Fixed",
      "Data Analyst Mid: Analytics scope",
      "Data Analyst Senior: Fixed + title",
      "Key Account Manager Junior: OTE clarity",
      "Key Account Manager Mid: Fixed vs incentive",
      "Key Account Manager Senior: Incentive terms",
      "Customer Support Junior: Fixed + shift",
      "Customer Support Mid: Fixed",
      "Customer Support Senior: Team scope",
    ],
    lastVerified: "2026-05-08",
  },

  acko: {
    liquidityRisk: "medium-high",
    candidateShouldAsk: [
      "ESOP liquidity — last buyback / next window",
      "Actuarial/risk bonus rules",
      "Claims workload (if claims role) — daily case load",
      "Fixed vs variable split",
      "Insurance-related employee benefits",
      "Appraisal cycle",
    ],
    likelyBenefits: [
      "health insurance",
      "PF + gratuity",
      "ESOP for product/tech roles",
      "insurance-related benefits possible",
      "role-wise bonus",
      "device policy",
      "hybrid role-dependent",
      "possible wellness allowance",
    ],
    negotiationFocusGrid: [
      "Software Engineer Junior: Fixed",
      "Software Engineer Mid: Fixed + ESOP",
      "Software Engineer Senior: Fixed + level",
      "Product Manager Junior: Scope",
      "Product Manager Mid: Product ownership",
      "Product Manager Senior: Scope + equity",
      "Claims Analyst Junior: Fixed",
      "Claims Analyst Mid: Process ownership",
      "Claims Analyst Senior: Team/process scope",
      "Actuarial Analyst Junior: Fixed + credentials (IAI/SOA)",
      "Actuarial Analyst Mid: Risk/pricing impact",
      "Actuarial Analyst Senior: Pricing ownership",
      "Risk Analyst Junior: Fixed",
      "Risk Analyst Mid: Risk scope",
      "Risk Analyst Senior: Ownership",
      "Customer Success Junior: Fixed + support terms",
      "Customer Success Mid: Customer ownership",
      "Customer Success Senior: Retention impact",
    ],
    lastVerified: "2026-05-08",
  },

  cars24: {
    liquidityRisk: "medium-high",
    candidateShouldAsk: [
      "Incentive payout history (last 4 quarters)",
      "Field / travel allowance structure",
      "Fixed vs variable split",
      "ESOP availability for this role (corporate/product only)",
      "Notice buyout policy",
      "City/region target setting",
    ],
    likelyBenefits: [
      "health insurance",
      "PF + gratuity",
      "field/operations allowances possible",
      "sales incentives",
      "possible ESOP for corporate/product roles",
      "device policy role-dependent",
      "travel reimbursement possible",
    ],
    negotiationFocusGrid: [
      "Software Engineer Junior: Fixed",
      "Software Engineer Mid: Fixed + ESOP",
      "Software Engineer Senior: Fixed + level",
      "Product Manager Junior: Product scope",
      "Product Manager Mid: Fixed + role scope",
      "Product Manager Senior: Product ownership",
      "Operations Manager Junior: Fixed + variable",
      "Operations Manager Mid: City/process scope",
      "Operations Manager Senior: Team ownership",
      "Inspection Engineer Junior: Fixed + field conditions",
      "Inspection Engineer Mid: Incentive terms",
      "Inspection Engineer Senior: Team/region scope",
      "Sales Executive Junior: Fixed vs incentive",
      "Sales Executive Mid: OTE payout",
      "Sales Executive Senior: Incentive realism",
      "Dealer Relations Junior: OTE clarity",
      "Dealer Relations Mid: Network impact",
      "Dealer Relations Senior: Fixed + variable cap",
    ],
    lastVerified: "2026-05-08",
  },
};

/** Same normalisation as getKnownFacts() — keep these in lockstep. */
function normaliseCompany(rawCompany: string | undefined): string {
  if (!rawCompany) return "";
  return rawCompany
    .toLowerCase()
    .replace(/[^a-z\s-]/g, "")
    .replace(/[\s-]+/g, " ")
    .trim();
}

export function getCompanyNegotiationContext(
  rawCompany: string | undefined,
): CompanyNegotiationContext | null {
  const cleaned = normaliseCompany(rawCompany);
  if (!cleaned) return null;
  // Direct match first.
  const direct = COMPANY_NEGOTIATION_CONTEXT[cleaned];
  if (direct) return direct;
  // Loose containment (e.g. "Meesho Inc." → meesho).
  for (const [key, ctx] of Object.entries(COMPANY_NEGOTIATION_CONTEXT)) {
    if (key.length < 4) continue;
    if (cleaned.includes(key) || key.includes(cleaned)) return ctx;
  }
  return null;
}

/** Render the negotiation context as a prompt-ready block. Empty
 *  string when no context — caller falls back to generic guidance. */
export function formatCompanyNegotiationContext(
  ctx: CompanyNegotiationContext | null,
  companyName: string | undefined,
): string {
  if (!ctx || !companyName) return "";
  const lines: string[] = [];
  lines.push("");
  lines.push(`COMPANY-SPECIFIC NEGOTIATION CONTEXT for ${companyName}:`);
  lines.push(`  • Equity liquidity risk: ${ctx.liquidityRisk} — discount face-value equity accordingly when coaching.`);
  lines.push(`  • Candidate should ask HR (use these as the "questions to clarify" coaching prompts):`);
  for (const ask of ctx.candidateShouldAsk) lines.push(`      - ${ask}`);
  lines.push(`  • Likely benefits beyond CTC (mention proactively when presenting the offer): ${ctx.likelyBenefits.join("; ")}.`);
  lines.push(`  • Negotiation focus by role × level (anchor counter-offer levers to the row that matches the candidate's role + level; do NOT invent levers outside this grid):`);
  for (const row of ctx.negotiationFocusGrid) lines.push(`      - ${row}`);
  lines.push(`  • Context last verified: ${ctx.lastVerified}.`);
  lines.push("");
  return lines.join("\n");
}
