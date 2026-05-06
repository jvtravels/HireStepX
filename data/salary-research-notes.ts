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

2. ROLE FAMILY PREMIA (2026 update).
   Within the same company tier, role family changes the band:

     • AI / ML / GenAI specialists — premium remains real but is
       NORMALISING as supply grows. 2025-26 reality:
         - GenAI / LLM / RAG / agentic-systems engineers: still
           1.3-1.6x backend pay at same YOE. Senior GenAI specialists
           ₹25-50 LPA at unicorn tier; outliers at top product cos
           cross ₹1Cr+ TC including RSUs.
         - Generic "ML Engineer" (classical models, BI-adjacent) —
           premium is closing; now closer to 1.1-1.3x backend.
         - Differentiator at senior level is now eval/MLOps/safety
           skills, not "I have used PyTorch".
       Open at 60-70th percentile for genuine GenAI/LLM specialists;
       median for generic ML.
     • Senior Design (Senior Product Designer, Design Systems Lead,
       Design Manager) — pay depends on portfolio depth, business
       impact, design-systems ownership, stakeholder management. NOT
       on Figma skill. Senior PD at unicorn: ₹45-95 LPA, not ₹30 LPA.
     • Senior Eng (Staff Engineer, Principal Engineer) — at Big Tech
       India 2026, 10-yr Staff at top product co targets ₹90-160 LPA
       TC (base + bonus + RSU). 75th percentile ₹79L+, 90th percentile
       ₹1Cr+. RSUs are 30-50% of total. Don't ignore equity.
     • Sales — comp is FIXED + VARIABLE + COMMISSION, not a single
       CTC. A "₹20L role" is often ₹12L fixed + ₹8L variable. When
       discussing sales offers, separate the components explicitly.
     • Senior PM (Group PM, Director, VP) at FAANG India — 5-8 YOE
       PM ₹40-70 LPA cash + heavy RSU = ₹60L-1.5Cr TC. Director/VP
       up to ₹3Cr. Tier-1 unicorns (Flipkart, PhonePe, Meesho, Zepto)
       5-8 YOE PM: ₹28-50L cash + ESOP = ₹40-80L TC.
     • Design agencies / ad agencies / VFX studios — services-firm
       economics: senior IC ₹35-70L globally (IDEO/R/GA/AKQA tier),
       India agency senior ₹15-35L. Equity rare; bill rates drive
       leverage. Don't anchor to product-company bands here.

3. EXPERIENCE-BUCKET CONVENTIONS.
   YOE buckets used across the market:
     0-2 YOE → entry / fresher
     3-5 YOE → mid-level
     6-9 YOE → senior
     10+ YOE → lead / staff / principal / management
   Do NOT propose senior bands to a 3-YOE candidate; do NOT propose
   entry bands to a 7-YOE candidate, regardless of how they answered
   "current CTC".

4. EQUITY EXPECTATIONS BY TIER (2026 update).
   • IT Services / consulting / domestic BFSI — no equity for ICs.
     Don't mention RSUs/ESOPs.
   • GCCs — RSUs in parent stock (Walmart, JPMC, Goldman, Apple,
     Google, Microsoft, Adobe). Vesting usually 4-year with 1-year
     cliff. GCCs delivered ~11.5% increments in 2026 vs 9.1% India
     Inc avg; pay 15-22% premium over IT services for like-for-like
     roles. The "salary race" is over — differentiation is now skill
     mix (cloud/AI/security depth).
   • Big Tech — RSUs are a major component (20-40% of total comp).
     Refresher grants annually.
   • Indian unicorns / SaaS — ESOPs at senior+ levels. 2025 was the
     breakout liquidity year for Indian startup ESOPs:
         - 18 startup IPOs in 2025 raised ₹41,248 Cr (Lenskart, Groww,
           Meesho, PhysicsWallah listed).
         - Razorpay filed DRHP via SEBI confidential route Apr 2026;
           IPO bankers Axis/Kotak/JPM/Citi onboarded Feb 2026.
         - PhonePe DRHP filed via confidential route. Zepto, OYO,
           Flipkart, InMobi, Zetwerk in 2026 pipeline (~₹47,000 Cr
           potential raise).
         - Flipkart did $50M ESOP buyback in 2025; smaller buybacks
           at Darwinbox, Dhan, Dezerv, InsuranceDekho.
     Liquidity is no longer purely theoretical — candidates can
     reasonably assign 40-60% expected-value weight to ESOPs at
     pre-IPO unicorns vs. 20-30% in 2023-24. Adjust your offer
     framing: ESOPs at top-tier unicorns now carry near-equity
     credibility, not just "monopoly money".
   • Early startups — ESOPs are a real lever (0.05-0.5% IC,
     0.1-2% leadership) but candidates know they may be illiquid.

5. NOTICE-PERIOD INTUITION (2026).
   • IT Services / consulting / domestic BFSI — 60-90 day notice.
     Notice buyout is a real lever (₹1-3 LPA).
   • Hypergrowth startups — 15-30 day notice now common (down from
     30-45 in 2023). Some Series A/B startups offer 0-day onboarding
     for senior hires.
   • Established unicorns / SaaS — 30 day notice typical.
   • GCCs — 60-90 day notice.
   • Big Tech — 30-60 day notice.
   • If candidate says "I'm available immediately / my last role
     ended on <date>", do NOT offer notice buyout.

6. VARIABLE PAY — TARGET vs REALISED (IT SERVICES).
   IT services quote variable pay as a target % of CTC, but Q4 FY25
   actuals (Apr 2025 disbursement) show the gap:
     • TCS — 100% to 70%+ of workforce; senior staff and weak-BU
       employees got 20-40% only.
     • Wipro — 90% average. Internal formula: revenue 40% +
       gross margin 30% + TCV 30%.
     • Infosys — 65% average (lowest in 3 quarters). Range 0%
       (Needs Improvement) to 83% (Outstanding). Band 6 and below
       only.
   When a candidate says "my CTC is ₹15L including variable",
   deduct realised variable: real cash is closer to ₹13-14L. Counter-
   offers should specify "fixed CTC", not just "CTC". For senior IT-
   services candidates (more variable, lower realisation %), prefer
   bumping fixed base over preserving the variable target.

7. JOINING BONUS BENCHMARKS (negotiable, often forgotten).
   Joining bonus is the single biggest one-shot lever for net-new
   hires — easier to move than base salary because it doesn't reset
   the band:
     • FAANG / Big Tech India — common, 10-25% of annual base, often
       split year-1 / year-2 with clawback (12-24 months).
     • Indian unicorn — SDE2 / mid: ₹3-8L common. Senior PD / PM:
       ₹5-15L. Clawback typically 12 months.
     • SaaS / GCC — sometimes offered, smaller bands (₹2-5L).
     • IT Services — rare. Substitute is notice-period buyout
       (₹1-3L for 30-day buyout).
     • Early startup — rare; sometimes substituted with extra ESOP.
   If the candidate has a competing offer, joining bonus is where
   you match — not on base.

8. ESOP EXERCISE WINDOW — UNDER-DISCUSSED LEVER.
   Window between separation and forfeit of vested options:
     • 30-90 days — STANDARD across most Indian startups. Punitive
       for long-tenure employees who can't fund the exercise.
     • 1-3 years — employee-friendly, increasingly common.
     • 7-10 years (full term) — progressive (Razorpay, Zerodha, CRED,
       Postman). Transformative for ESOP NPV.
   A 90-day vs 7-year window changes effective ESOP value by 30-60%.
   When discussing equity-heavy offers, ALWAYS surface the exercise
   window. Candidates who don't ask are leaving real money on the
   table. Negotiable at offer stage; rarely re-opened post-signing.

9. STATUTORY FLOOR — 2025 LABOUR CODE.
   The four labour codes became effective 21 November 2025:
     • Basic salary must be >= 50% of CTC. This raises PF + gratuity
       contributions by 30-50% in many plans (employer cost).
     • Gratuity eligibility for fixed-term contracts dropped from
       5 years to 1 year.
     • Maternity remains 26 weeks paid (first two children).
   When a candidate's current employer hasn't restructured to the
   50% basic floor yet, their "in-hand" calculation may overstate
   true take-home. New offers from compliant employers will look
   lower in-hand even at the same CTC because PF deduction is higher.

10. ESPP AT GCC / BIG TECH — OFTEN UNDISCUSSED.
    Employee Stock Purchase Plan: parent stock at 15% discount with
    6-month look-back is standard at large GCCs (Walmart, JPMC,
    Goldman, Wells Fargo, Microsoft, Adobe) and most Big Tech.
    Effective discount can hit 25-35% if stock appreciates during
    the offer period. Often not mentioned in the offer letter — ask
    HR specifically. Worth ~5-10% of base on top of RSUs for those
    who max contributions (typically 10-15% of salary capped at
    $25K/yr in parent currency).

11. NPS 14% RESTRUCTURING PLAY (BIGGEST 2025 UNLOCK).
    From Apr 2025 the §80CCD(2) employer-NPS limit was raised from
    10% → 14% of basic for ALL salaried under the new tax regime
    (was government-only at 14% earlier). Practical effect:
      • At ₹50L CTC with ~₹25L basic, candidate can route ~₹3.5L
        of CTC into corporate NPS Tier 1 instead of special allowance,
        same CTC, but the ₹3.5L is now tax-free → ~₹1L+ extra net
        wealth/year at top slab.
      • The 14% match is a payroll setting at most large employers,
        NOT a comp negotiation — they almost always say yes.
    When candidate is on a senior offer (CTC ≥ ₹25L) and asks how to
    get more in-hand, surface this lever explicitly: "We can route
    14% of basic into corporate NPS Tier 1 — same CTC for the
    company, lower tax for you under §80CCD(2)."

12. NEW vs OLD TAX REGIME — NEW WINS BY DEFAULT (FY 2025-26).
    Section 87A rebate raised to ₹60K → effective tax-free up to
    ₹12.75L gross (₹12L taxable + ₹75K standard deduction). Old
    regime now only wins if candidate has combined deductions
    (HRA + 80C + 80D + home-loan §24 + 80CCD(1B)) ≥ ~₹4.75L. Most
    tech employees don't hit this. New regime allows §80CCD(2)
    employer NPS up to 14% of basic — the only major deduction worth
    fighting for. Default the conversation to new regime; only
    discuss HRA / LTA / 80C exemptions if candidate explicitly says
    they're on old regime.

13. SECTION 87A — TAX-FREE BELOW ₹12.75L GROSS.
    Junior offers (entry IT services, design freshers, campus hires)
    now land tax-free under the new regime if total taxable income
    ≤ ₹12L (gross ≤ ~₹12.75L). Marginal relief above ₹12L prevents
    cliff. When framing entry-level offers (₹6-12L band), the
    "you'll keep nearly all of this" pitch is genuine and a real
    differentiator vs. older calculators that assume slab rates apply
    from ₹3L onwards.

14. ₹7.5L COMBINED-CAP PERQUISITE TRAP.
    Combined employer contribution to (PF + NPS Tier 1 +
    Superannuation) > ₹7.5L/year is taxable as perquisite. Bites at
    ~₹40L+ basic (~₹70L+ CTC). When restructuring senior offers
    toward NPS, watch this ceiling — going from 10%→14% NPS at very
    high basic can push past ₹7.5L and the excess becomes taxable.
    Sweet spot: 14% NPS as long as basic stays below ~₹40-45L.

15. METRO HRA EXPANSION (AY 2026-27 ONWARDS).
    Hyderabad / Pune / Ahmedabad / Bangalore are now treated as
    metro (50% basic HRA exemption, up from 40%). FY 2025-26 ITR
    (filed Jul 2026) STILL uses old 4-city rule (only Mumbai /
    Delhi / Chennai / Kolkata at 50%); next fiscal year onward the
    expanded list applies. Only relevant for old-regime candidates;
    new regime makes HRA fully taxable regardless.

16. RSU DISCLOSURE — SCHEDULE FA / BLACK MONEY ACT.
    Foreign-listed RSUs (FAANG parent stock at Google / Microsoft /
    Amazon / Meta / Apple / Adobe) require Schedule FA disclosure in
    ITR-2 even before sale. Vested-but-unsold counts. Penalty up to
    ₹10L for non-disclosure under the Black Money Act. Most
    candidates miss this and only realise during tax audit. When
    discussing FAANG/GCC offers with RSU components, mention the
    Schedule FA filing burden as part of the "real cost" of the
    grant — it's not just the upside of the stock.

17. CALIBRATION DATE.
   These notes reflect Indian market conditions as of May 2026.
   Sources: Levels.fyi, AmbitionBox, Glassdoor India, Inc42 IPO
   tracker, Zinnov GCC report 2026, public DRHP filings, peoplematters
   variable-pay coverage Q4 FY25, Inc42/Entrackr ESOP buyback trackers,
   ClearTax/Bajaj Finserv tax-slab updates FY 2025-26, NSDL NPS
   employer-contribution circulars Apr 2025.
   Refresh recommended every 6 months — startup ESOP liquidity, GCC
   pay differential, AI/ML premium, IT-services variable-pay
   realisation, and tax-regime breakeven thresholds are the five
   fastest-moving data points.`;

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
    return `\nROLE-FAMILY NOTE: This is an AI/ML/Data role. In 2026 the premium is REAL but BIFURCATED:
  • Genuine GenAI / LLM / RAG / agentic / MLOps / eval specialists still command 1.3-1.6x backend pay at same YOE — open at 60-70th percentile.
  • Generic "ML Engineer" / classical-DS roles — premium has compressed to 1.1-1.3x; open at median.
Read the candidate's actual depth (do they ship LLMs in production? own evals? deal with agent orchestration? or are they doing notebook-driven feature engineering?). Opening at the upper band for a generic ML candidate signals you don't know the market; opening at median for a GenAI specialist signals you don't value the specialty.`;
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
