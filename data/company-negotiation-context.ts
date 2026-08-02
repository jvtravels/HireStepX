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

import { getCsvDerivedNegotiationContext } from "./csv-derived-fallbacks";

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
  /** ISO date, pair with research-backlog timestamp. */
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
      "ESOP liquidity, last buyback / next window",
      "Actuarial/risk bonus rules",
      "Claims workload (if claims role), daily case load",
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

  dream11: {
    liquidityRisk: "medium-high",
    candidateShouldAsk: [
      "ESOP buyback history (Dream Sports privately held)",
      "ESOP strike vs current FMV",
      "Fixed vs variable split (esp. for game/product roles)",
      "IPL cycle bonus / cricket-window incentives",
      "Internal level mapping vs published band",
      "First appraisal cycle + refresh ESOP cadence",
    ],
    likelyBenefits: [
      "health insurance (premium plan)",
      "PF + gratuity",
      "ESOP for tech/product/data roles",
      "annual cricket-window bonus",
      "device policy",
      "hybrid possible",
      "learning budget",
      "joining bonus for SDE-2/3 + DS hires",
    ],
    negotiationFocusGrid: [
      "Software Engineer Junior: Fixed + joining bonus",
      "Software Engineer Mid: Fixed + ESOP clarity (buyback cadence)",
      "Software Engineer Senior: Fixed + level + ESOP",
      "Product Manager Junior: Product scope",
      "Product Manager Mid: Fixed + product scope",
      "Product Manager Senior: Product ownership + ESOP",
      "Data Scientist Junior: Fixed + model impact",
      "Data Scientist Mid: ML/business impact",
      "Data Scientist Senior: Ownership + scope (vertical / model line)",
      "ML Engineer Junior: Fixed",
      "ML Engineer Mid: Modelling impact",
      "ML Engineer Senior: ML ownership",
      "UX/Product Designer Junior: Fixed + portfolio",
      "UX/Product Designer Mid: Craft + product ownership",
      "UX/Product Designer Senior: Design leadership",
      "Risk/Compliance Junior: Fixed + bonus",
      "Risk/Compliance Mid: Risk scope",
      "Risk/Compliance Senior: Criticality + ownership",
      "Brand/Growth Marketing Junior: Campaign impact + bonus",
      "Brand/Growth Marketing Mid: CAC/ROI impact",
      "Brand/Growth Marketing Senior: Brand/growth ownership + ESOP",
    ],
    lastVerified: "2026-05-08",
  },

  postman: {
    liquidityRisk: "medium-high",
    candidateShouldAsk: [
      "ESOP grant size + refresh cadence (Postman late-stage private)",
      "Liquidity events history (secondary / tender offers)",
      "Global pay parity vs India band for this level",
      "Fixed vs joining bonus split",
      "Internal level mapping (IC1-IC5)",
      "Remote/hybrid policy + WFH stipend",
      "First refresh / appraisal timing",
    ],
    likelyBenefits: [
      "health insurance (US-style coverage)",
      "PF + gratuity",
      "ESOP, meaningful at IC2+",
      "WFH stipend / remote-first culture",
      "device policy (top-tier hardware)",
      "learning budget",
      "wellness allowance",
      "joining bonus for IC2+ and DevRel hires",
    ],
    negotiationFocusGrid: [
      "Software Engineer Junior: Fixed + ESOP grant size + joining bonus",
      "Software Engineer Mid: Fixed + ESOP refresh cadence",
      "Software Engineer Senior: Fixed + level + ESOP grant",
      "Product Manager Junior: Product scope + fixed",
      "Product Manager Mid: Product ownership + ESOP",
      "Product Manager Senior: Strategic ownership + ESOP grant size",
      "UX/Product Designer Junior: Fixed + portfolio",
      "UX/Product Designer Mid: Craft + product ownership",
      "UX/Product Designer Senior: Design leadership + ESOP",
      "DevOps/SRE Junior: Fixed + infra scope",
      "DevOps/SRE Mid: Reliability ownership",
      "DevOps/SRE Senior: Platform ownership + ESOP",
      "Developer Advocate Junior: Fixed + content/talk portfolio",
      "Developer Advocate Mid: Audience + content scope + ESOP",
      "Developer Advocate Senior: Program ownership + ESOP grant",
      "Technical Writer Junior: Fixed + writing portfolio",
      "Technical Writer Mid: Doc surface ownership",
      "Technical Writer Senior: Strategic content programs",
      "Customer Success Junior: Fixed + customer ownership",
      "Customer Success Mid: Customer ownership + retention metrics",
      "Customer Success Senior: Retention impact + book size",
    ],
    lastVerified: "2026-05-08",
  },

  browserstack: {
    liquidityRisk: "medium",
    candidateShouldAsk: [
      "ESOP grant size + last secondary / buyback (profitable, periodic liquidity)",
      "Why pay is below product-co peers (quality-of-work narrative is real)",
      "Fixed vs variable for sales/SE roles, OTE realism",
      "Territory + quota for AE",
      "Internal level mapping (L1-L7)",
      "Hybrid / remote policy",
      "First appraisal + refresh cadence",
    ],
    likelyBenefits: [
      "health insurance",
      "PF + gratuity",
      "ESOP (measured grants, profitable co)",
      "device policy",
      "learning budget",
      "office benefits",
      "sales incentives for GTM roles",
      "joining bonus for senior IC + AE hires",
    ],
    negotiationFocusGrid: [
      "Software Engineer Junior: Fixed + joining bonus",
      "Software Engineer Mid: Fixed + level + ESOP clarity",
      "Software Engineer Senior: Fixed + level (L5/L6 calibration)",
      "Product Manager Junior: Product scope",
      "Product Manager Mid: Product ownership",
      "Product Manager Senior: Scope + ESOP",
      "UX/Product Designer Junior: Fixed + portfolio",
      "UX/Product Designer Mid: Craft + ownership",
      "UX/Product Designer Senior: Design leadership",
      "DevOps/SRE Junior: Fixed",
      "DevOps/SRE Mid: Reliability ownership",
      "DevOps/SRE Senior: Platform ownership",
      "QA/Automation Engineer Junior: Fixed + automation portfolio",
      "QA/Automation Engineer Mid: Tooling ownership + level",
      "QA/Automation Engineer Senior: Architecture ownership + ESOP",
      "Solutions Engineer Junior: OTE clarity + ramp",
      "Solutions Engineer Mid: Pre-sales scope + territory",
      "Solutions Engineer Senior: Strategic accounts + accelerators",
      "Account Executive Junior: OTE clarity + ramp",
      "Account Executive Mid: Fixed vs incentive split + territory",
      "Account Executive Senior: OTE realism + accelerators + ESOP",
    ],
    lastVerified: "2026-05-08",
  },

  zoho: {
    liquidityRisk: "low",
    candidateShouldAsk: [
      "Fixed vs role-based bonus split",
      "Internal grade vs published level",
      "Appraisal cycle (Zoho is famously slow but steady)",
      "Work location policy (Tenkasi vs Chennai vs remote)",
      "Support shift allowance (for support roles)",
      "Product ownership scope (Zoho One has 50+ apps)",
    ],
    likelyBenefits: [
      "health insurance",
      "PF + gratuity",
      "office benefits (campus food/transport in Chennai/Tenkasi)",
      "role-based bonus",
      "learning / internal training (Zoho University)",
      "device policy for tech roles",
      "no equity (bootstrapped)",
    ],
    negotiationFocusGrid: [
      "Software Engineer Junior: Fixed salary",
      "Software Engineer Mid: Fixed + role scope",
      "Software Engineer Senior: Fixed + ownership",
      "QA Engineer Junior: Fixed + automation scope",
      "QA Engineer Mid: Automation depth",
      "QA Engineer Senior: Framework ownership",
      "Product Manager Junior: Scope + fixed",
      "Product Manager Mid: Product ownership",
      "Product Manager Senior: Scope + level",
      "Product Designer Junior: Fixed",
      "Product Designer Mid: Design ownership",
      "Product Designer Senior: Craft + product impact",
      "Technical Writer Junior: Fixed + writing portfolio",
      "Technical Writer Mid: Documentation ownership",
      "Technical Writer Senior: Product docs impact",
      "Customer Support Junior: Fixed + shift terms",
      "Customer Support Mid: Support scope",
      "Customer Support Senior: Team ownership",
    ],
    lastVerified: "2026-05-08",
  },

  atlassian: {
    liquidityRisk: "low",
    candidateShouldAsk: [
      "RSU vesting schedule (Atlassian = 4yr 25-25-25-25, periodic)",
      "RSU refresher policy / annual stock refresh eligibility",
      "Internal level mapping (P30 / P40 / P50 / P60)",
      "Remote / hybrid policy (Atlassian = TEAM Anywhere)",
      "Performance bonus payout (last 4 cycles)",
      "First compensation review timing",
      "Stock refresh eligibility cutoff",
    ],
    likelyBenefits: [
      "strong health insurance (US-style)",
      "PF + gratuity",
      "RSU (public-market liquid; lower risk than private ESOP)",
      "wellness allowance",
      "learning budget",
      "remote/hybrid flexibility (TEAM Anywhere)",
      "device policy",
      "parental leave (generous)",
      "global SaaS benefits",
    ],
    negotiationFocusGrid: [
      "Software Engineer Junior: Fixed + RSU",
      "Software Engineer Mid: RSU + level",
      "Software Engineer Senior: Level calibration",
      "Senior Software Engineer Mid: Fixed + RSU",
      "Senior Software Engineer Senior: Level + equity (staff/lead calibration at P60)",
      "Product Manager Junior: Scope + RSU",
      "Product Manager Mid: Product scope",
      "Product Manager Senior: Org impact",
      "Product Designer Junior: Portfolio + level",
      "Product Designer Mid: Design systems / product",
      "Product Designer Senior: Design leadership",
      "Data Scientist Junior: Fixed + RSU",
      "Data Scientist Mid: ML/business impact",
      "Data Scientist Senior: Model ownership",
      "Program Manager Junior: Scope",
      "Program Manager Mid: Program complexity",
      "Program Manager Senior: Cross-org impact",
    ],
    lastVerified: "2026-05-08",
  },

  google: {
    liquidityRisk: "low",
    candidateShouldAsk: [
      "Internal level mapping (L3/L4/L5/L6/L7)",
      "RSU vesting + refresher cycle (Google = 4yr 25-25-25-25 + annual refresh)",
      "Sign-on bonus + clawback terms",
      "Bonus target (% of base for this level)",
      "Role location (Bangalore / Hyderabad / Gurugram impact comp)",
      "Team / org scope at this level",
      "Promotion timeline (typical L4→L5 = 2-3 yrs)",
    ],
    likelyBenefits: [
      "strong health insurance",
      "PF + gratuity",
      "RSU (public-market liquid)",
      "wellness allowance",
      "learning budget",
      "global mobility opportunities",
      "parental leave (generous)",
      "food / office perks (Google campuses)",
      "device policy",
      "hybrid role-dependent",
    ],
    negotiationFocusGrid: [
      "Software Engineer Junior: Level + RSU (push for L4 if YOE supports)",
      "Software Engineer Mid: Level calibration (L4 vs L5)",
      "Software Engineer Senior: RSU + level (refresher cycle)",
      "Staff Engineer Senior: Staff-level calibration (L6 IC vs M1)",
      "Product Manager Junior: Product scope (APM)",
      "Product Manager Mid: Level + scope",
      "Product Manager Senior: Org impact",
      "UX Designer Junior: Portfolio + level",
      "UX Designer Mid: Product impact",
      "UX Designer Senior: Design leadership",
      "ML Engineer Junior: AI scope (which area)",
      "ML Engineer Mid: Model impact",
      "ML Engineer Senior: Research/product impact",
      "Program Manager Junior: Scope",
      "Program Manager Mid: Cross-functional scope",
      "Program Manager Senior: Cross-org impact",
    ],
    lastVerified: "2026-05-08",
  },

  apple: {
    liquidityRisk: "low",
    candidateShouldAsk: [
      "Internal level (ICT2 / ICT3 / ICT4 / ICT5) + step within level",
      "RSU vesting (4yr periodic, semi-annual vest in Apr/Oct)",
      "Sign-on bonus (₹2-25L by level; often single-year clawback)",
      "Bonus target (Apple bonus is lower than peers, 3-10% typical)",
      "Hardware vs software team scope (Silicon / Apple Intelligence / Services orgs differ)",
      "First appraisal date + promo eligibility timeline",
      "Device / product benefits + global mobility (Cupertino transfer)",
    ],
    likelyBenefits: [
      "health insurance (self + family)",
      "PF + gratuity",
      "RSU (semi-annual vest; public-market liquid)",
      "ESPP (15% discount, 6-month lookback)",
      "product discounts (significant)",
      "wellness allowance",
      "device policy",
      "global mobility opportunities",
      "parental leave",
      "learning budget",
    ],
    negotiationFocusGrid: [
      "Software Engineer Junior: ICT2 calibration + RSU",
      "Software Engineer Mid: Fixed + RSU (bonus is low)",
      "Software Engineer Senior: ICT5 level + Silicon/AI org",
      "Firmware Engineer Junior: Hardware/software niche",
      "Firmware Engineer Mid: Scarce skill premium",
      "Firmware Engineer Senior: Deep expertise + RSU grant",
      "Product Manager Junior: Scope (HW vs SW PM)",
      "Product Manager Mid: Product scope (Services vs Hardware)",
      "Product Manager Senior: Strategic ownership + global mobility",
      "ML Engineer Junior: AI/ML scope (Apple Intelligence)",
      "ML Engineer Mid: Model/product impact (on-device vs cloud)",
      "ML Engineer Senior: AI ownership + RSU grant size",
      "Program Manager Junior: Scope (HW launch vs SW)",
      "Program Manager Mid: Cross-functional + NPI scope",
      "Program Manager Senior: Launch/program ownership",
      "Operations Manager Junior: Fixed + ops scope (SCM)",
      "Operations Manager Mid: Vendor/process scope",
      "Operations Manager Senior: Global ops impact (APAC manufacturing)",
    ],
    lastVerified: "2026-05-08",
  },

  adobe: {
    liquidityRisk: "low",
    candidateShouldAsk: [
      "RSU vesting + annual refresher (Adobe refreshers are 3-5% top-up, get floor in writing)",
      "Internal level (IC2 / IC3 / IC4 / IC5)",
      "Bonus target (% of base, AIP, 8-15% typical)",
      "Sign-on bonus (₹2-30L by level)",
      "Team / product (Creative Cloud / Document Cloud / Experience Cloud / Firefly GenAI)",
      "First appraisal date",
      "ESPP enrollment + discount (15%)",
    ],
    likelyBenefits: [
      "strong health insurance",
      "PF + gratuity",
      "RSU (public-market liquid; annual refresh)",
      "ESPP (15% discount)",
      "Adobe product access (full Creative Cloud)",
      "wellness + learning budget",
      "device policy",
      "hybrid (role-dependent)",
      "parental leave",
      "global mobility",
    ],
    negotiationFocusGrid: [
      "Software Engineer Junior: Fixed + RSU (refresher floor)",
      "Software Engineer Mid: Level calibration (IC3 vs IC4)",
      "Software Engineer Senior: Fixed + equity (Firefly/GenAI top-band)",
      "Product Manager Junior: Scope (DX vs DMe)",
      "Product Manager Mid: Product impact (Firefly = scarce premium)",
      "Product Manager Senior: Org scope + first-appraisal date",
      "Product Designer Junior: Portfolio + craft",
      "Product Designer Mid: Design systems / product",
      "Product Designer Senior: Design leadership",
      "ML Engineer Junior: AI scope (Firefly Foundation Models)",
      "ML Engineer Mid: ML/product impact (GenAI orgs)",
      "ML Engineer Senior: Research/product ownership",
      "Data Scientist Junior: Fixed + data impact",
      "Data Scientist Mid: Product analytics scope",
      "Data Scientist Senior: Model/data ownership",
      "Program Manager Junior: Scope",
      "Program Manager Mid: Program complexity",
      "Program Manager Senior: Cross-org scope",
    ],
    lastVerified: "2026-05-08",
  },

  salesforce: {
    liquidityRisk: "low",
    candidateShouldAsk: [
      "RSU vesting / refresher cadence (Salesforce RSU = annual cliff variant, uncommon)",
      "Internal level (AMTS / MTS / SMTS / LMTS / Architect)",
      "Sales OTE attainment + quota history (last 4 quarters) for sales roles",
      "Bonus target (% of base, V2MOM-driven)",
      "Product / cloud team (Sales Cloud / Service Cloud / Data Cloud / MuleSoft / Slack / Tableau)",
      "First review cycle + promo timeline",
      "Sign-on bonus + clawback",
    ],
    likelyBenefits: [
      "strong health insurance",
      "PF + gratuity",
      "RSUs (public-market liquid)",
      "wellness allowance",
      "learning + Trailhead certifications",
      "sales commission (for AE/SE roles)",
      "device policy",
      "hybrid (role-dependent)",
      "parental leave",
      "VTO (volunteer time off, 7 days/yr)",
    ],
    negotiationFocusGrid: [
      "Software Engineer Junior: Fixed + RSU (AMTS/MTS calibration)",
      "Software Engineer Mid: Level calibration (MTS vs SMTS = ₹15-25L gap)",
      "Software Engineer Senior: Fixed + RSU (LMTS/SMTS, vest schedule)",
      "Product Manager Junior: Scope (cloud assignment)",
      "Product Manager Mid: Product impact (Data Cloud / AI Cloud premium)",
      "Product Manager Senior: Org scope",
      "Product Designer Junior: Portfolio",
      "Product Designer Mid: Product ownership",
      "Product Designer Senior: Design leadership",
      "DevOps Engineer Junior: Reliability scope",
      "DevOps Engineer Mid: On-call + scale",
      "DevOps Engineer Senior: Platform reliability",
      "Solutions Engineer Junior: Fixed + variable",
      "Solutions Engineer Mid: Enterprise scope",
      "Solutions Engineer Senior: Enterprise impact",
      "Account Executive Junior: OTE clarity + ramp quota relief",
      "Account Executive Mid: Quota + accelerators",
      "Account Executive Senior: OTE realism + named-account list",
    ],
    lastVerified: "2026-05-08",
  },

  microsoft: {
    liquidityRisk: "low",
    candidateShouldAsk: [
      "Internal level number (L59 / L60 / L61 / L62 / L63 / L64 / L65)",
      "RSU vesting + annual refresher floor (5yr stock = unique to MSFT, refresher is 30-50% of new-hire)",
      "Sign-on bonus + clawback (Y1 typical, ₹3-25L by level)",
      "Performance bonus target (% of base, 0-25% by impact)",
      "Team / org assignment (Azure, M365, AI, Gaming pay differently)",
      "First review cycle date + promo eligibility",
      "Relocation / visa support (US/EU mobility)",
    ],
    likelyBenefits: [
      "strong health insurance (incl. parents)",
      "PF + gratuity",
      "RSU (public-market liquid)",
      "annual wellness + connectivity allowance",
      "learning budget (LinkedIn Learning + courses)",
      "ESPP (10% discount)",
      "parental leave (generous)",
      "hybrid (3 days office)",
      "device policy",
      "global mobility opportunities",
    ],
    negotiationFocusGrid: [
      "Software Engineer Junior: L59-L60 calibration (push for L60)",
      "Software Engineer Mid: L61-L62, RSU refresher floor in writing",
      "Software Engineer Senior: L63-L64 sign-on + team selection",
      "Product Manager Junior: APM/PM1, push for PM2 with MBA signal",
      "Product Manager Mid: PM2-Senior PM RSU refresh + bonus target",
      "Product Manager Senior: Principal PM (L65) scope",
      "UX Designer Junior: Portfolio + IC level mapping",
      "UX Designer Mid: Senior Designer vs Designer 2 calibration",
      "UX Designer Senior: L65 design system ownership",
      "ML Engineer Junior: Azure AI vs research org",
      "ML Engineer Mid: Model impact + refresher",
      "ML Engineer Senior: L64-L65 staff calibration",
      "Data Scientist Junior: Org (Bing/M365/Azure) drives band",
      "Data Scientist Mid: Causal inference vs prediction split",
      "Data Scientist Senior: Org-wide impact",
      "Program Manager Junior: TPM L60 written-doc skill",
      "Program Manager Mid: TPM L61-L62 cross-team scope",
      "Program Manager Senior: Principal TPM L65",
    ],
    lastVerified: "2026-05-08",
  },

  amazon: {
    liquidityRisk: "low",
    candidateShouldAsk: [
      "Internal level (L4 SDE-1 / L5 SDE-2 / L6 SDE-3 / L7 Principal)",
      "RSU vesting schedule (back-loaded 5-15-40-40 = unique to Amazon)",
      "Year-1 + Year-2 sign-on structure (offsets back-loaded vest, both years critical)",
      "Performance bonus / on-call premium",
      "Team / org assignment (AWS vs Retail vs Alexa drives top of band)",
      "First review cycle + promo eligibility",
      "Relocation support + team location (HYD/BLR/Gurugram)",
    ],
    likelyBenefits: [
      "health insurance (self + family)",
      "PF + gratuity",
      "RSU (back-loaded but liquid)",
      "Year-1 + Year-2 cash sign-on",
      "ESPP (5% discount)",
      "parental leave",
      "relocation assistance",
      "device + connectivity allowance",
      "hybrid (5 days office post-RTO)",
      "leadership-principle-driven culture",
    ],
    negotiationFocusGrid: [
      "Software Engineer Junior: SDE-1 L4, Y1+Y2 sign-on split",
      "Software Engineer Mid: SDE-2 L5, sign-on funds back-loaded vest",
      "Software Engineer Senior: SDE-3 L6, level mapping (L5 vs L6 = ₹25-40L gap)",
      "Product Manager Junior: PM-T L4 written-narrative (6-pager)",
      "Product Manager Mid: PMT L5 two-pizza vs platform org",
      "Product Manager Senior: Senior PM-T L6 P&L + AWS pricing-power",
      "UX Designer Mid: L5 relocation + remote flex",
      "UX Designer Senior: L6 AWS vs Retail org",
      "Data Scientist Junior: L4 forecasting vs ML split",
      "Data Scientist Mid: L5 business-metric ownership",
      "Data Scientist Senior: L6 org-wide model impact",
      "ML Engineer Junior: L4 applied science vs SDE track",
      "ML Engineer Mid: L5 Alexa AI vs AWS AI band",
      "ML Engineer Senior: L6 research-to-prod ownership",
      "Program Manager Junior: TPM L4 written-doc skill",
      "Program Manager Mid: TPM L5 cross-team scope",
      "Program Manager Senior: Senior TPM L6 org-wide programs",
      "Business Analyst Junior: L4 SQL + business-metric depth",
      "Business Analyst Mid: L5 stakeholder ownership",
      "Business Analyst Senior: L6 strategic-analytics scope",
    ],
    lastVerified: "2026-05-08",
  },

  meta: {
    liquidityRisk: "low",
    candidateShouldAsk: [
      "Internal level (E3/E4 entry, E5 mid, E6 senior, E7 staff)",
      "RSU vesting (4yr quarterly, no cliff post-2022) + refresher cadence",
      "Sign-on bonus (₹4-40L by level, often two-year structure)",
      "Performance bonus target (15-20% on-target, ratings drive payout)",
      "Team / org stability (Family of Apps vs Reality Labs vs AI)",
      "First half-cycle review timing (Meta = semi-annual)",
      "Relocation + role scope (FoA vs RL changes pay envelope)",
    ],
    likelyBenefits: [
      "health insurance (self + family + parents)",
      "PF + gratuity",
      "RSU (public-market, quarterly vest)",
      "cash sign-on + RSU refreshers",
      "wellness + meal allowance",
      "parental leave (generous, both parents)",
      "learning budget",
      "device + connectivity",
      "hybrid (3 days office)",
      "global mobility opportunities",
    ],
    negotiationFocusGrid: [
      "Software Engineer Junior: E3/E4, push for E4 with intern conversion",
      "Software Engineer Mid: E5 RSU refresher cadence",
      "Software Engineer Senior: E6 AI/RL org top-of-band",
      "Product Manager Junior: IC4 RPM strategy interview",
      "Product Manager Mid: IC5 bonus target + RSU refresher",
      "Product Manager Senior: IC6 FoA vs RL org scope",
      "UX Designer Junior: Product Designer IC4 portfolio",
      "UX Designer Mid: IC5 craft + research split",
      "UX Designer Senior: IC6 design leadership scope",
      "ML Engineer Junior: E4 AI Research vs applied",
      "ML Engineer Mid: E5 model impact",
      "ML Engineer Senior: E6 research-to-prod scope",
      "Data Scientist Junior: IC4 product analytics vs core DS",
      "Data Scientist Mid: IC5 metric ownership",
      "Data Scientist Senior: IC6 org-wide causal scope",
      "Program Manager Junior: TPM IC4 written-doc skill",
      "Program Manager Mid: TPM IC5 cross-team scope",
      "Program Manager Senior: TPM IC6 org-wide programs",
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

/** Same normalisation as getKnownFacts(), keep these in lockstep. */
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
  /* CSV-derived research fallback. Synthesizes a CompanyNegotiationContext
     from the 100-company research dataset for any company we haven't
     hand-curated yet. Covers ~82 companies that previously had no
     negotiation context at all. The csv-derived-fallbacks module imports
     only TYPES from this file, so no runtime cycle. */
  return getCsvDerivedNegotiationContext(rawCompany) ?? null;
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
  lines.push(`  • Equity liquidity risk: ${ctx.liquidityRisk}, discount face-value equity accordingly when coaching.`);
  lines.push(`  • Candidate should ask HR (use these as the "questions to clarify" coaching prompts):`);
  for (const ask of ctx.candidateShouldAsk) lines.push(`      - ${ask}`);
  lines.push(`  • Likely benefits beyond CTC (mention proactively when presenting the offer): ${ctx.likelyBenefits.join("; ")}.`);
  lines.push(`  • Negotiation focus by role × level (anchor counter-offer levers to the row that matches the candidate's role + level; do NOT invent levers outside this grid):`);
  for (const row of ctx.negotiationFocusGrid) lines.push(`      - ${row}`);
  lines.push(`  • Context last verified: ${ctx.lastVerified}.`);
  lines.push("");
  return lines.join("\n");
}
