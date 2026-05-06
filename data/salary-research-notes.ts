/**
 * Salary research notes — distilled from market data shared by the
 * product team. Used as LLM context for the salary-negotiation
 * simulator, supplementing the structured SALARY_DATA in salaries.ts.
 *
 * Why both? SALARY_DATA gives a precise band per (role, tier, level)
 * which the engine clamps the LLM's offers against. These NOTES give
 * the LLM the *strategic* knowledge a real hiring manager would have:
 *   • Company-tier intuition ("a Software Engineer at TCS, Razorpay,
 *     Google, and a seed-stage startup will not have the same salary")
 *   • Role-family-specific premia (AI/ML > generalist IT today)
 *   • Comp-structure quirks (sales = fixed + variable + commission)
 *   • Senior-level signal (senior design pay depends on business
 *     impact, not Figma skill)
 *
 * Injected into the salary-negotiation prompt via
 *   buildSalaryNegotiationGuidance() in salary-lookup.ts
 */

/** Strategic compensation insights — the kind a senior hiring manager
 *  knows in their bones. Rendered into the LLM prompt so the AI
 *  doesn't quote a Big-Tech salary for a TCS role, or vice versa. */
export const COMP_STRATEGY_NOTES = `MARKET INTELLIGENCE FOR THIS NEGOTIATION:

1. COMPANY TIER MATTERS MORE THAN ROLE TITLE.
   The same job title pays radically different across these tiers:

     • IT Services (TCS, Infosys, Wipro, HCLTech, Tech Mahindra,
       LTIMindtree) — stable, lower-to-mid CTC, slow salary jumps,
       60-90 day notice, fixed-heavy comp, no equity for ICs.
     • GCCs (Walmart Global Tech, Target India, Lowe's, Goldman
       Sachs, JPMorgan, Wells Fargo, HSBC, GE, Philips) — pay 1.4-2x
       IT-services, strong benefits, real senior IC ladder, RSUs in
       parent stock.
     • Indian Startups (Razorpay, Groww, Meesho, Zepto, CRED,
       Swiggy, Zomato, Urban Company) — high variance, faster
       growth, ESOP-heavy at senior levels, quicker decisions.
     • Big Tech / Global Tech (Google, Microsoft, Amazon, Apple,
       Adobe, Uber, LinkedIn, Atlassian) — highest comp, equity-
       heavy, levels matter (L4 vs L5 = 30-50% delta).
     • SaaS (Freshworks, Zoho, BrowserStack, Postman, Chargebee,
       Whatfix) — strong for product / design / engineering / sales,
       similar to mid-tier unicorn.
     • Consulting (McKinsey, BCG, Bain, Accenture Strategy, Deloitte,
       EY, PwC, KPMG) — high pressure, strong brand, role-dependent
       pay (strategy > tech > advisory).
     • BFSI / Fintech (HDFC, ICICI, Axis, Kotak, Paytm, PhonePe,
       Razorpay, Cred) — strong for product, tech, risk, compliance,
       sales roles.
     • EV / CleanTech (Ather, Ola Electric, BluSmart, ChargeZone) —
       growing space, mixed salary maturity.
     • Consumer / Retail (Reliance Retail, Tata Digital, Nykaa,
       Myntra, Flipkart, Amazon India) — good for product, category,
       growth, ops roles.
     • Agencies / Studios — lower fixed, faster ownership, variable
       quality.

   ANCHOR YOUR OFFER TO THE TIER, not the role title. A "Software
   Engineer" at TCS opens at ₹6-9 LPA; the same title at Razorpay
   opens at ₹22-35 LPA; at Google ₹40-50 LPA + RSUs. Quoting the
   wrong band breaks immersion immediately.

2. ROLE FAMILY PREMIA (2025).
   Within the same company tier, role family changes the band:

     • AI / ML / GenAI specialists — niche skill premium. ML
       Engineer (3-5 YOE) opens at ₹20-50 LPA at unicorn tier;
       generalist Backend Dev (3-5 YOE) opens at ₹14-35 LPA. India's
       general tech market has cooled while specialised AI roles
       remain in demand — pay accordingly.
     • Senior Design (Senior Product Designer, Design Systems Lead,
       Design Manager) — pay depends on portfolio depth, business
       impact, design-systems ownership, stakeholder management. NOT
       on Figma skill. Senior PD at unicorn: ₹45-95 LPA, not ₹30 LPA.
     • Senior Eng (Staff Engineer, Principal Engineer) — at Big Tech
       India, total comp 75th percentile is ₹79L+, 90th percentile
       ₹1Cr+. RSUs are 30-50% of total. Don't ignore equity.
     • Sales — comp is FIXED + VARIABLE + COMMISSION, not a single
       CTC. A "₹20L role" is often ₹12L fixed + ₹8L variable. When
       discussing sales offers, separate the components explicitly.
     • Senior PM (Group PM, Director, VP) — vary heavily by company.
       PM at funded fintech / product company can be 2x-4x a PM at a
       small services co.

3. EXPERIENCE-BUCKET CONVENTIONS.
   YOE buckets used across the market:
     0-2 YOE → entry / fresher
     3-5 YOE → mid-level
     6-9 YOE → senior
     10+ YOE → lead / staff / principal / management
   Do NOT propose senior bands to a 3-YOE candidate; do NOT propose
   entry bands to a 7-YOE candidate, regardless of how they answered
   "current CTC".

4. EQUITY EXPECTATIONS BY TIER.
   • IT Services / consulting / domestic BFSI — no equity for ICs.
     Don't mention RSUs/ESOPs.
   • GCCs — RSUs in parent stock (Walmart, JPMC, Goldman). Vesting
     usually 4-year with 1-year cliff.
   • Big Tech — RSUs are a major component (20-40% of total comp).
     Refresher grants annually.
   • Indian unicorns / SaaS — ESOPs at senior+ levels. Liquidity
     uncertain, so candidates discount them mentally.
   • Early startups — ESOPs are a real lever (0.05-0.5% IC,
     0.1-2% leadership) but candidates know they may be illiquid.

5. NOTICE-PERIOD INTUITION.
   • IT Services / consulting / domestic BFSI — 60-90 day notice.
     Notice buyout is a real lever (₹1-3 LPA).
   • Startups / unicorns / SaaS — 30 day notice typical.
   • GCCs — 60-90 day notice.
   • Big Tech — 30-60 day notice.
   • If candidate says "I'm available immediately / my last role
     ended on <date>", do NOT offer notice buyout.`;

/** Returns true if the role family commands an AI/ML skill premium.
 *  Used to add a sentence to the prompt biasing the AI's open
 *  offer toward the upper band rather than the median. */
export function isAiMlRoleFamily(roleKey: string): boolean {
  const k = (roleKey || "").toLowerCase();
  return (
    k.includes("ml") ||
    k.includes("ai-engineer") ||
    k.includes("ai engineer") ||
    k.includes("genai") ||
    k.includes("data-scientist") ||
    k.includes("data scientist") ||
    k.includes("data-engineer") ||
    k.includes("data engineer") ||
    k.includes("mlops") ||
    k.includes("machine learning") ||
    k.includes("artificial intelligence")
  );
}

/** Returns true if the role family is sales — drives "fixed + variable
 *  + commission" framing instead of a single CTC. */
export function isSalesRoleFamily(roleKey: string): boolean {
  const k = (roleKey || "").toLowerCase();
  return (
    k.includes("sales") ||
    k === "account-executive" ||
    k.includes("business-development") ||
    k.includes("business development") ||
    k.includes("sdr") ||
    k.includes("sales-development") ||
    k.includes("revenue-operations") ||
    k.includes("revenue operations")
  );
}

/** Family-specific compensation framing rules. Appended to the prompt
 *  ONLY when the candidate's role matches the family. */
export function buildFamilyCompFraming(roleKey: string): string {
  if (isAiMlRoleFamily(roleKey)) {
    return `\nROLE-FAMILY NOTE: This is an AI/ML/Data role. In 2025 these command a SKILL PREMIUM over generalist tech — ML Engineers, AI Engineers, GenAI Engineers and Data Scientists are pulling 1.3-1.6x what backend engineers at the same company earn. When stating your initial offer, sit at the UPPER half of the band (≥ 60th percentile), not the median. Candidates know this premium exists; opening at the median signals you don't value the specialty.`;
  }
  if (isSalesRoleFamily(roleKey)) {
    return `\nROLE-FAMILY NOTE: This is a SALES role. Compensation is FIXED + VARIABLE + COMMISSION, not a single CTC number. Always present the offer in three parts:
  • Fixed base (~60% of total)
  • Variable / OTE (~30%)
  • Commission accelerator on overachievement (~10%)
A "₹20 LPA sales role" is typically ₹12 LPA fixed + ₹6 LPA variable + ₹2 LPA accelerator. Do NOT quote a single CTC figure — that misrepresents the structure and the candidate will spot it.`;
  }
  // Senior design check — driven by role + level, not just role
  if (
    /designer|design lead|design manager|design systems|head of design/i.test(roleKey)
  ) {
    return `\nROLE-FAMILY NOTE: This is a design role. At senior+ levels, compensation reflects business impact, design-systems ownership, stakeholder management, and portfolio depth — NOT Figma skill or visual flair. When discussing the offer, anchor to what the role will own (design system, end-to-end product flow, brand, hiring) rather than to "you'll be doing UI design".`;
  }
  return "";
}
