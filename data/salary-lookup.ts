/**
 * Salary lookup: resolves (role, company, experience, currentCity, jobCity) → compact salary context string.
 * Replaces ~2,700 tokens of hardcoded salary tables with ~100-150 tokens of targeted data.
 *
 * Distinguishes between current city (where candidate lives) and job city (where the role is based).
 * When relocating, adds relocation context (notice buyout premium, HRA adjustment, relocation allowance).
 */

import { SALARY_DATA, ROLE_ALIASES, matchRoleKey, type RoleKey, type ExperienceLevel, type SalaryEntry } from "./salaries";
import { getCompanyBandOverride } from "./company-salary-overrides";
import { getCompanyTier, getSalaryTierFallback, TIER_LABELS, type CompanyTier } from "./company-tiers";
import { getCityTier, CITY_MULTIPLIERS, adjustForCity } from "./city-tiers";
import { getCompanyCity } from "./company-cities";
import { COMP_STRATEGY_NOTES, buildFamilyCompFraming } from "./salary-research-notes";
import { formatGranularBand } from "./india-salary-bands-2025";

export interface SalaryLookupParams {
  role: string;
  company?: string;
  experienceLevel?: string;
  /** Where the candidate currently lives/works */
  currentCity?: string;
  /** Where the job is located (offer salary based on this) */
  jobCity?: string;
}

/** Negotiation band: defines the range the hiring manager can negotiate within */
export interface NegotiationBand {
  /** Initial offer CTC (what the manager opens with) */
  initialOffer: number;
  /** Minimum the company would accept (walk-away floor for candidate) */
  minOffer: number;
  /** Maximum stretch the manager can go to */
  maxStretch: number;
  /** Walk-away point — if candidate demands above this, manager must decline */
  walkAway: number;
  /** Joining bonus range */
  joiningBonusRange: [number, number];
  /** Whether equity is available at this level */
  hasEquity: boolean;
  /** Equity annual value range (LPA) */
  equityRange: [number, number];
  /** Formatted string for LLM context */
  bandContext: string;
  /** True when the underlying SalaryEntry was filled by the densifier
   * from a sibling cell rather than independently researched. Consumers
   * (admin dashboard, telemetry, UI badges) can flag derived bands. */
  isSynthetic?: boolean;
  /** Provenance string for synthesized bands. Undefined for curated. */
  syntheticSource?: string;
}

/** Negotiation style: modifies how the hiring manager behaves */
export type NegotiationStyle = "cooperative" | "aggressive" | "defensive";

/** Industry-specific package flavor text for LLM */
export const INDUSTRY_PACKAGE_CONTEXT: Record<string, string> = {
  fintech: `INDUSTRY: Fintech/Payments. Comp structure leans heavily on variable pay (15-25% of CTC). ESOPs are common at growth-stage. Compliance bonuses exist. Expect candidates to benchmark against Razorpay, PhonePe, CRED, Zerodha. Perks: wealth management tools, financial literacy budget, stock trading accounts.`,
  faang: `INDUSTRY: FAANG/Big Tech. RSUs are a major component (20-40% of total comp). Annual refreshers common. L4-L7 leveling matters — one level up = 30-50% more. Perks: relocation packages, immigration support, sabbaticals, mental health budget. Candidates benchmark against Google, Microsoft, Amazon, Meta India.`,
  startup: `INDUSTRY: Early/Growth-Stage Startup. Cash-heavy comp with aggressive ESOPs (0.01-0.5% for IC, 0.1-2% for leadership). Joining bonus common to offset ESOP illiquidity. Fast promotion cycles. Perks: unlimited PTO, learning budget, co-working spaces. Candidates benchmark against YC/Sequoia portfolio companies.`,
  ecommerce: `INDUSTRY: E-commerce/D2C. Mix of base + performance bonus tied to GMV/revenue targets. ESOPs at growth stage. Seasonal pressure (festive sales = crunch). Perks: employee discounts, wellness budgets. Candidates benchmark against Flipkart, Meesho, Myntra, Nykaa.`,
  consulting: `INDUSTRY: Consulting/IT Services. Lower base but strong variable (20-30% of CTC). Overseas deputation = 2-3x salary. Limited equity. Notice periods are long (60-90 days). Perks: client-site allowances, certification budgets, travel perks. Candidates benchmark against TCS, Infosys, Wipro (services) or McKinsey, BCG (strategy).`,
  government: `INDUSTRY: Government/PSU. Pay fixed by 7th CPC bands. No negotiation on base. Negotiate: grade level, posting city (HRA varies 8-24%), housing, deputation allowance, training budget. Pension is the real wealth — defined benefit worth ₹50-150 LPA actuarially. Job security is the key selling point.`,
};

/** Tier-specific variable-bonus percentage of CTC. Indian-market grounded:
 *   - government-psu: 0% (7th CPC fixed pay; no performance variable)
 *   - it-services: 25% (billing-linked + deputation premium baked in)
 *   - bfsi-global: 22% (Goldman, JPM, Barclays India — perf bonuses heavy)
 *   - bfsi-domestic: 15% (HDFC/ICICI — moderate variable)
 *   - consulting-mbb / consulting-big4: 20% (utilization-linked)
 *   - fmcg-mnc: 15% (annual perf bonus + 13th-month festive — see getFestiveBonus)
 *   - faang / big-tech / gcc: 12% (low cash variable; comp loaded into RSUs)
 *   - indian-unicorn / saas-product: 12% (mixed cash + ESOPs)
 *   - startup-growth / startup-early: 8% (cash-conservative; ESOP-heavy)
 *   - edtech: 12% (moderate variable; some target-linked)
 *   - default: 10% */
function getVariablePct(companyTier: string | undefined): number {
  switch (companyTier) {
    case "government-psu": return 0;
    case "it-services": return 0.25;
    case "bfsi-global": return 0.22;
    case "bfsi-domestic": return 0.15;
    case "consulting-mbb":
    case "consulting-big4": return 0.20;
    case "fmcg-mnc": return 0.15;
    case "faang":
    case "big-tech":
    case "gcc": return 0.12;
    case "indian-unicorn":
    case "saas-product":
    case "edtech": return 0.12;
    case "startup-growth":
    case "startup-early": return 0.08;
    default: return 0.10;
  }
}

/* ─── Indian-market helpers (all tier-driven, all data-grounded) ─── */

/** In-hand take-home as % of CTC for both tax regimes.
 *
 * Approximation grounded in 2025-26 slabs for a typical IC role:
 *   - New regime (default for FY25-26): 70-78% in-hand for ₹10-30L CTC,
 *     dropping to 62-68% above ₹50L due to surcharge.
 *   - Old regime: ~3-5% lower than new for ₹10-30L because slabs are
 *     steeper, but candidates with home-loan / 80C / HRA exemption
 *     usually beat new-regime take-home by 1-3%.
 *
 * Numbers are deliberate ranges — we tell the LLM "around 65-70%" not
 * a single point so it doesn't false-precision its way into wrong math
 * when the candidate doesn't share their exemptions. */
function getInHandRange(totalCtc: number, cityTier: string | undefined): {
  newRegime: [number, number];
  oldRegime: [number, number];
  text: string;
} {
  const round1 = (x: number) => Math.round(x * 10) / 10;
  // % of CTC bands: bigger CTC → more surcharge → lower take-home %
  let newPctLo: number, newPctHi: number, oldPctLo: number, oldPctHi: number;
  if (totalCtc < 12) { newPctLo = 0.78; newPctHi = 0.82; oldPctLo = 0.74; oldPctHi = 0.80; }
  else if (totalCtc < 25) { newPctLo = 0.72; newPctHi = 0.78; oldPctLo = 0.68; oldPctHi = 0.76; }
  else if (totalCtc < 50) { newPctLo = 0.66; newPctHi = 0.72; oldPctLo = 0.62; oldPctHi = 0.70; }
  else if (totalCtc < 100) { newPctLo = 0.60; newPctHi = 0.66; oldPctLo = 0.56; oldPctHi = 0.64; }
  else { newPctLo = 0.54; newPctHi = 0.60; oldPctLo = 0.52; oldPctHi = 0.58; }

  const newRegime: [number, number] = [round1(totalCtc * newPctLo), round1(totalCtc * newPctHi)];
  const oldRegime: [number, number] = [round1(totalCtc * oldPctLo), round1(totalCtc * oldPctHi)];
  const cityNote = cityTier === "tier1"
    ? "tier-1 metro HRA exemption helps old-regime more than new"
    : "tier-2/3 lower HRA exemption narrows the regime gap";

  const text = `IN-HAND TAKE-HOME (when candidate asks "kitna in-hand?"):
- New regime (default FY25-26): ${fmtRange(newRegime[0], newRegime[1])} per year (${Math.round(newPctLo*100)}-${Math.round(newPctHi*100)}% of CTC)
- Old regime (with HRA + 80C + home loan): ${fmtRange(oldRegime[0], oldRegime[1])} per year (${Math.round(oldPctLo*100)}-${Math.round(oldPctHi*100)}% of CTC)
- Note: ${cityNote}; exact in-hand depends on candidate's exemptions and rent. Don't promise a precise number — give the range.`;

  return { newRegime, oldRegime, text };
}

/** Tier-specific notice-period buyout reality (NOT a generic formula).
 *
 * The previous (notice_days/30 × monthly_base × 1.5x) formula over-quoted
 * by ~50% for services firms which have flat buyouts ₹1.5-2.5 LPA, and
 * massively under-quoted for FAANG India which often waives notice with
 * a letter (₹0 cost). */
function getNoticeBuyoutContext(companyTier: string | undefined, totalCtc: number): string {
  const round1 = (x: number) => Math.round(x * 10) / 10;
  switch (companyTier) {
    case "it-services":
      return `NOTICE-PERIOD BUYOUT (services-firm reality): TCS / Infosys / Wipro candidates have 60-90 day notice. Actual buyout authority for the new employer: flat ₹1.5-2.5 LPA regardless of candidate's monthly base. Don't quote (notice_days × monthly_base × 1.5) — that's 2-3x over-quote and exposes you as scripted. If candidate is currently at TCS / Infosys / Wipro, offer ₹2 LPA as a notice-buyout sweetener if you've conceded base.`;
    case "faang":
    case "big-tech":
    case "gcc":
      return `NOTICE-PERIOD BUYOUT: FAANG / GCC India typically waives notice with a release letter — no cash buyout needed. If the candidate's current employer demands buyout, offer to absorb up to ₹${round1(totalCtc * 0.05)} LPA as a one-time signing bonus instead of a "buyout" line item. Cleaner accounting.`;
    case "government-psu":
      return `NOTICE-PERIOD BUYOUT: Government / PSU — no buyout. The candidate must serve the full notice or pay it themselves. If they're transferring from another PSU, joining is governed by their parent department's release order, not money.`;
    case "startup-early":
    case "startup-growth":
      return `NOTICE-PERIOD BUYOUT: Indian startups expect candidates to negotiate notice down to 30 days with their current employer. If buyout is needed, offer ₹0.5-1 LPA as joining bonus — frame it as helping, not as buying out.`;
    default:
      return `NOTICE-PERIOD BUYOUT: Authority up to ₹${round1(totalCtc * 0.04)} LPA as one-time signing bonus, only if candidate is currently employed with a real notice obligation. Don't volunteer this — only offer if it bridges a gap.`;
  }
}

/** Detect campus-hire / fresher patterns in the role string. Returns
 * non-empty caveat string when the role is explicitly a campus offer. */
function detectCampusHire(role: string | undefined): string {
  if (!role) return "";
  const r = role.toLowerCase();
  if (/\b(get|graduate engineer trainee|management trainee|gat|sat|associate engineer trainee|campus|campus hire|campus placement|fresher|new grad|0\s*yoe|trainee program|leadership development program)\b/.test(r)) {
    return `CAMPUS / FRESHER OFFER — NEGOTIATION-RESISTANT: This is a campus / trainee offer. Indian campus offers (TCS GET, Infosys SE, Wipro PAT, Cognizant GenC, HCL Tech Bee) are FIXED BY POLICY — there is NO negotiation room. The offer is signed during placement; reopening it after acceptance is rare. If the candidate tries to negotiate, respond honestly: "Campus offers are fixed by company policy across the cohort. I genuinely don't have authority to revise this — not for you, not for anyone. The negotiation lever is which TRACK you choose (e.g., TCS Digital vs Ninja, Infosys Power Programmer vs SE), not the number itself." Do NOT pretend you can stretch — that's the most common simulator failure mode for campus interviews.`;
  }
  return "";
}

/** Equity liquidity classifier — tells the LLM whether ESOPs are real
 * money (listed) or speculative (illiquid). The naive "ESOPs are
 * speculative until exit" framing under-prices listed-company equity. */
function getEquityLiquidityNote(company: string | undefined, companyTier: string | undefined, hasEquity: boolean): string {
  if (!hasEquity) return "";
  const c = (company || "").toLowerCase();
  // Indian listed companies (post-IPO; equity is liquid via NSE/BSE)
  const listedIndian = /\b(zomato|paytm|nykaa|policybazaar|delhivery|mamaearth|infosys|tcs|wipro|hcl|tech mahindra|cognizant|persistent|ltts|mphasis|ola|swiggy)\b/.test(c);
  // US-listed (RSUs liquid via Nasdaq)
  const listedUs = /\b(google|alphabet|microsoft|meta|amazon|apple|netflix|adobe|salesforce|atlassian|nvidia|uber|airbnb|stripe|databricks|snowflake|servicenow)\b/.test(c) || companyTier === "faang" || companyTier === "big-tech";
  // Pre-IPO with active secondary markets (real liquidity, just not public)
  const secondary = /\b(razorpay|cred|phonepe|zerodha|groww|meesho|dream11|udaan|byjus|unacademy|acko|pine labs|browserstack|postman|zepto)\b/.test(c);

  if (listedUs) return `EQUITY LIQUIDITY: RSUs at ${company || "this company"} are LISTED — liquid on US public markets (Nasdaq/NYSE). Vested RSUs convert to cash you can sell instantly minus a brokerage delay. This is real money, not speculation. Counter any "but ESOPs are uncertain" framing with: "These are listed RSUs, not ESOPs — at vest you get the public-market value."`;
  if (listedIndian) return `EQUITY LIQUIDITY: ${company || "This company"} is publicly listed on NSE/BSE — your ESOPs/RSUs convert to cash you can sell. Treat as real value at face value; not speculation.`;
  if (secondary) return `EQUITY LIQUIDITY: ${company || "This company"} is pre-IPO but runs regular ESOP buybacks (Razorpay/CRED/PhonePe/Zerodha pattern) at marked-up valuations. Last 2-3 buybacks have been at 1.5-2.5x earlier strike — ESOPs here are NOT illiquid speculation.`;
  if (companyTier === "startup-early") return `EQUITY LIQUIDITY: Early-stage startup — ESOPs are illiquid until acquisition or IPO (3-7 yrs typically, often 50%+ companies fail to exit at all). Be honest with the candidate: "Treat ESOPs as a long-shot bonus; negotiate hard on cash."`;
  return `EQUITY LIQUIDITY: Mid-stage startup — ESOPs may liquefy via buyback rounds (typical at series C+) or eventual IPO. Expect 3-5 yr timeline. Not pure speculation but not cash either.`;
}

/** Deputation/onsite premium context for IT services. The biggest
 * negotiation lever in TCS/Infosys/Wipro hiring is whether the
 * candidate is willing to go onsite (US/UK/Singapore). Onsite earns
 * 1.5-3x base. Without this context the LLM ignores the lever. */
function getDeputationContext(companyTier: string | undefined): string {
  if (companyTier !== "it-services") return "";
  return `DEPUTATION LEVER (services-firm specific): TCS / Infosys / Wipro / HCL roles often have an onsite-deputation track. Onsite to US / UK / Singapore / EU pays 1.5-3x the domestic base (USD/GBP/SGD allowance + housing + per diem). If the candidate is willing to relocate, offer the onsite track explicitly: "If you're open to onsite within the first 12-18 months, our typical deputation pays USD 5-8K/month plus housing on top of your domestic base. That's effectively ₹50-90 LPA equivalent for the deputation period."`;
}

/** 13th-month / festive bonus — prevalent at FMCG, conglomerates,
 * some banks. Equals roughly 1 month of basic. */
function getFestiveBonus(companyTier: string | undefined, basicLpa: number): { amount: number; text: string } {
  const round1 = (x: number) => Math.round(x * 10) / 10;
  const has13thMonth = companyTier === "fmcg-mnc" || companyTier === "bfsi-domestic" || companyTier === "government-psu";
  if (!has13thMonth) return { amount: 0, text: "" };
  // 13th month = 1 month of basic = basic / 12
  const amount = round1(basicLpa / 12);
  const tierLabel = companyTier === "fmcg-mnc" ? "FMCG / consumer-goods" : companyTier === "bfsi-domestic" ? "Indian banking" : "PSU / government";
  return {
    amount,
    text: `13TH-MONTH / FESTIVE BONUS (${tierLabel} norm): ${fmtLPA(amount)} paid annually around Diwali / financial-year-end as a 13th salary. NOT part of CTC headline; this is on top of the listed total. Standard at ${tierLabel} firms; mention it if the candidate hasn't accounted for it.`,
  };
}

/** Retention bonus / clawback authority — common for senior-and-above
 * at unicorns / FAANG. Locks the candidate in for 12-24 months. */
function getRetentionBonusContext(companyTier: string | undefined, exp: ExperienceLevel, totalCtc: number): string {
  const round1 = (x: number) => Math.round(x * 10) / 10;
  const eligibleTiers = new Set(["faang", "big-tech", "gcc", "indian-unicorn", "saas-product", "consulting-mbb", "bfsi-global"]);
  if (!eligibleTiers.has(companyTier ?? "")) return "";
  if (exp !== "senior" && exp !== "lead" && exp !== "executive") return "";
  const retention1yr = round1(totalCtc * 0.10);
  const retention2yr = round1(totalCtc * 0.15);
  return `RETENTION BONUS AUTHORITY (senior+ at top tiers): You can structure a retention bonus for senior hires: ₹${retention1yr} LPA paid at 1-yr mark + ₹${retention2yr} LPA at 2-yr mark, both contingent on continued employment. Clawback if candidate leaves earlier. Don't volunteer this in turn 1 — use it as a closer when candidate is on the fence and you're already at maxStretch on base.`;
}

/** Bond / service-agreement warning for tiers that enforce them. */
function getBondWarning(companyTier: string | undefined): string {
  if (companyTier === "it-services") {
    return `BOND CULTURE (services firms): TCS imposes a 2-yr bond (₹50K penalty for early exit), Infosys ₹1L, Cognizant ₹0.75L, Wipro varies. Real cost the candidate must factor in. If the candidate is currently bonded and joining, they OWE the previous employer if they leave before serving — don't pretend otherwise.`;
  }
  if (companyTier === "government-psu") {
    return `BOND CULTURE (PSUs): 3-5 year service bond is standard; penalty ranges from refunding training cost to ₹5-10 LPA. Bond enforcement is real — PSU candidates can't job-hop without paying out.`;
  }
  return "";
}

/** Bluff-check rule for unverified counter-offers — distinct from the
 * existing Indian-context guidance because it specifies what the LLM
 * should DO when a counter is mentioned without a written letter. */
const COUNTER_OFFER_BLUFF_CHECK = `COUNTER-OFFER BLUFF CHECK (Indian-market reality): When the candidate claims a competing offer, ASK FOR THE WRITTEN LETTER before stretching your offer. Phrases like "my current company will counter", "I have an offer at ₹X" without a letter are bluffs ~50-60% of the time. Respond professionally: "That's helpful context. Could you share the written offer (you can redact the company name) so I can see exactly what you're weighing? Once I see it I can figure out where I can land." Do NOT stretch maxStretch on a verbal claim alone. If the candidate refuses to share even a redacted letter, treat it as no-leverage and stay at your current offer.`;

/** WFH / internet / equipment allowance — post-COVID standard for
 * product-tech and GCC tiers. Services firms generally don't offer
 * (employees expected to work from office or client site). */
function getWfhAllowanceContext(companyTier: string | undefined): string {
  const offers = new Set([
    "faang", "big-tech", "gcc", "indian-unicorn", "saas-product",
    "startup-growth", "startup-early", "edtech", "fmcg-mnc",
    "consulting-mbb", "consulting-big4",
  ]);
  if (!offers.has(companyTier ?? "")) return "";
  return `WFH / WORK-FROM-HOME ALLOWANCE: Standard for product-tech roles post-COVID — typically ₹2-5K/month for internet + electricity, plus a ₹40-80K one-time setup allowance (laptop, monitor, chair). Mention if candidate raises remote/hybrid concerns. Negotiable lever for senior roles asking for fully-remote arrangements.`;
}

/** Family health-insurance value (self / spouse / kids / parents).
 * The premium difference between "self only" and "self + dependents"
 * is real money the candidate often doesn't account for. */
function getFamilyInsuranceContext(companyTier: string | undefined, exp: ExperienceLevel): string {
  if (companyTier === "government-psu") {
    return `HEALTH INSURANCE (PSU norm): CGHS-style coverage for self + spouse + dependents + parents, lifelong post-retirement. This is worth ₹40-60K/yr in market premium and is part of why PSU jobs feel "safe". Mention as a benefit when candidate compares against private-sector offers.`;
  }
  const offers = new Set([
    "faang", "big-tech", "gcc", "indian-unicorn", "saas-product",
    "consulting-mbb", "consulting-big4", "bfsi-global", "bfsi-domestic",
    "fmcg-mnc",
  ]);
  if (!offers.has(companyTier ?? "")) return "";
  const corporateLimit = exp === "senior" || exp === "lead" || exp === "executive" ? "₹10L" : "₹5-7L";
  return `HEALTH INSURANCE (corporate group): Self + spouse + 2 kids + parents covered up to ${corporateLimit} per year (no individual underwriting; pre-existing conditions covered from day 1). Equivalent retail premium would be ₹40-60K/yr for self+spouse+kids and another ₹30-50K/yr for parents (parents above 60 are otherwise hard to insure). When candidate compares CTC, point this out — it's a real ₹70K-1L value not in the headline number.`;
}

/** ESOP refresh-grant cadence — FAANG India does annual refreshes
 * (~30% of initial grant), Indian unicorns do biennial. Candidates
 * miss this in initial-offer math. */
function getEsopRefreshContext(companyTier: string | undefined, hasEquity: boolean): string {
  if (!hasEquity) return "";
  if (companyTier === "faang" || companyTier === "big-tech" || companyTier === "gcc") {
    return `RSU REFRESH CADENCE: Annual refresh grants at ${companyTier === "faang" ? "FAANG" : companyTier === "gcc" ? "GCC" : "big-tech"} India — typically ~30% of initial grant value granted each year, vesting on the same 4-yr/1-yr-cliff schedule. Effective Year-2 onwards comp is meaningfully higher than the initial offer suggests. If the candidate stays 3+ yrs the equity stack compounds: Y1 = initial grant, Y2 = initial + refresh1, Y3 = initial + refresh1 + refresh2, etc.`;
  }
  if (companyTier === "indian-unicorn" || companyTier === "saas-product") {
    return `ESOP REFRESH CADENCE: Top Indian unicorns (CRED, Razorpay, PhonePe, Zerodha) do refresh grants every 18-24 months for retained senior talent — usually ₹20-30L of additional ESOPs at then-current FMV. Less predictable than FAANG annual refreshes; tied to performance + retention.`;
  }
  return "";
}

/** Bench period reality for IT services. Candidates joining TCS / Infy
 * may sit on bench (between projects) for 0-3 months. Pay continues
 * but this is a real career signal candidates worry about. */
function getBenchContext(companyTier: string | undefined): string {
  if (companyTier !== "it-services") return "";
  return `BENCH PERIOD (services-firm reality): New joiners at TCS / Infosys / Wipro typically spend 4-12 weeks on bench before allocation to a client project. Pay continues at full base, but no client-facing work, no skill growth, no onsite eligibility. If candidate asks "when will I be allocated?", be honest: "Allocation depends on demand — typically 4-8 weeks for someone with your profile, longer for niche skills."`;
}

/** Tax-saving allowances rolled into Indian salary structures. Most
 * are pre-2019 era but still common at structured-comp companies
 * (services, BFSI, FMCG). Worth ₹1-2L/yr in tax savings combined. */
function getTaxSavingAllowances(companyTier: string | undefined): string {
  const structured = new Set(["it-services", "bfsi-global", "bfsi-domestic", "fmcg-mnc", "consulting-big4", "government-psu"]);
  if (!structured.has(companyTier ?? "")) return "";
  return `TAX-SAVING ALLOWANCES (structured-comp norm): Salary slip likely includes (a) LTA — Leave Travel Allowance, ₹0.6-1L/yr tax-exempt twice in 4 yrs against domestic travel bills, (b) Sodexo / Zeta meal vouchers, ₹26,400/yr tax-free, (c) Conveyance / fuel reimbursement against bills, ₹19,200-30K/yr (only old-regime), (d) NPS — National Pension System employer contribution up to 10% of basic, deductible. These are visible on the slip but not part of the cash-in-hand headline — when candidate asks for "all components", list them.`;
}

/** Indian DA (Dearness Allowance) only for PSUs / govt — pegged to
 * the Consumer Price Index, revised twice yearly. */
function getDearnessAllowanceContext(companyTier: string | undefined): string {
  if (companyTier !== "government-psu") return "";
  return `DEARNESS ALLOWANCE (PSU/govt only): DA is pegged to CPI-IW and revised every Jan + July. Currently at ~50% of basic for central PSUs. This compounds the basic over time — a 7th CPC ₹1L basic today becomes ₹1.5L+ in DA-adjusted in-hand. PSU candidates should account for DA growth when comparing against private offers.`;
}

/** HRA exemption math walkthrough — Income Tax Act Section 10(13A).
 * Exemption = MIN of (actual HRA received, X% of basic, rent paid - 10% of basic),
 * where X = 50% for metros (Mumbai/Delhi/Kolkata/Chennai by IT Act; Bangalore /
 * Hyderabad / Pune commonly treated as 50% by employers despite ambiguity)
 * and 40% otherwise. Only available in the OLD tax regime.
 *
 * Most candidates don't compute this and overestimate their old-regime savings.
 * Encoding the math here lets the LLM walk through it accurately when asked. */
function getHraExemptionWalkthrough(cityTier: string | undefined, basicLpa: number, hraLpa: number): string {
  const round1 = (x: number) => Math.round(x * 10) / 10;
  const isMetro = cityTier === "tier1";
  const pctOfBasic = isMetro ? 0.50 : 0.40;
  const pctCap = round1(basicLpa * pctOfBasic);
  const cityLabel = isMetro ? "metro (50% of basic)" : "non-metro (40% of basic)";
  // Example: assume rent = 50% of HRA (typical in metros)
  const exampleRent = round1(hraLpa * 0.6);
  const rentMinusTenPct = round1(exampleRent - basicLpa * 0.10);
  const exemption = round1(Math.min(hraLpa, pctCap, Math.max(0, rentMinusTenPct)));
  return `HRA EXEMPTION MATH (old-regime only — Section 10(13A)):
- Actual HRA received: ${fmtLPA(hraLpa)}
- Cap based on city: ${fmtLPA(pctCap)} (${cityLabel})
- Rent paid minus 10% of basic: ${fmtLPA(rentMinusTenPct)} (assumes rent ≈ ${fmtLPA(exampleRent)} — adjust for candidate's actual rent)
- TAX-EXEMPT HRA: ${fmtLPA(exemption)} (the MINIMUM of the three above)

If the candidate asks "how much HRA tax-free?", walk through THIS calculation with their actual rent. Don't quote a generic "HRA is tax-exempt" — that's the kind of vagueness candidates remember when comparing offers later.`;
}

/** ESOP dilution timeline — every funding round dilutes existing ESOPs.
 * After 3 rounds (Series B → C → D → IPO) a Series-A grant is worth
 * ~50-60% of its face value at vest. Real cost candidates miss. */
function getEsopDilutionContext(companyTier: string | undefined, hasEquity: boolean): string {
  if (!hasEquity) return "";
  if (companyTier === "startup-early" || companyTier === "startup-growth") {
    return `ESOP DILUTION REALITY (startup founder math):
- Each funding round dilutes existing equity holders by 15-25%.
- Typical path: Series A (today) → B (12-18 mo, ~20% dilution) → C (12-18 mo, ~15%) → D (~12%) → IPO (~10% additional).
- A grant of, say, 0.1% at Series A is worth 0.1% × (1-0.20) × (1-0.15) × (1-0.12) × (1-0.10) ≈ 0.054% at IPO — roughly HALF the face value.
- This isn't a bug; it's how venture funding works. Frame ESOPs as "1.5-2x growth potential offsetting dilution", NOT "guaranteed X LPA".
- Anti-dilution clauses (full ratchet / weighted-average) protect investors, NOT employees. Employee ESOPs almost never have anti-dilution protection.`;
  }
  if (companyTier === "indian-unicorn" || companyTier === "saas-product") {
    return `ESOP DILUTION REALITY (mid-late-stage unicorn): At unicorn stage there's typically 1-2 more rounds before IPO, so ~25-35% additional dilution from today. A ₹10 LPA grant face-value today is closer to ₹6.5-7.5 LPA at IPO time. Mention this when candidate gets too excited about the headline ESOP value.`;
  }
  return "";
}

/** Recent ESOP buyback events for top Indian unicorns. These are public
 * and material to the candidate's equity valuation. Not exhaustive but
 * covers the most-asked-about companies. */
function getRecentBuybackContext(company: string | undefined): string {
  const c = (company || "").toLowerCase().trim();
  // Each entry is { match: substring, context: string }
  const buybacks: Record<string, string> = {
    "razorpay": "Razorpay has run 6 ESOP buybacks since 2018 (latest mid-2024 at ~$12B implied valuation). Vested ESOPs have liquefied multiple times — treat as real money, not paper.",
    "phonepe": "PhonePe ran a ₹1,150 Cr ESOP buyback in 2022 (one of India's largest), and another in 2024 around its India domicile shift. Liquidity has been consistent — vested ESOPs are bankable.",
    "cred": "CRED has done 3+ buyback events; latest around its 2022-23 round. ESOPs at CRED have appreciated meaningfully but cycle is irregular.",
    "zerodha": "Zerodha is profitable + bootstrapped — no traditional buyback rounds, but distributes performance bonuses + occasional ESOP cash-out for senior team. Liquidity is high but informal.",
    "groww": "Groww ran an ESOP buyback in 2024 covering tenured employees. Pre-IPO trajectory.",
    "meesho": "Meesho ran a ₹250 Cr ESOP buyback in 2024 covering vested grants for current and former employees.",
    "udaan": "Udaan has had limited buyback activity; ESOPs largely paper until exit.",
    "swiggy": "Swiggy IPO'd Nov 2024; ESOPs that vested pre-IPO are now liquid via NSE/BSE.",
    "zomato": "Zomato is publicly listed (Eternal Ltd post-rebrand) — RSUs and existing ESOPs liquid via NSE/BSE.",
  };
  for (const [key, ctx] of Object.entries(buybacks)) {
    if (c.includes(key)) {
      return `RECENT BUYBACK / LIQUIDITY EVENTS for ${company}: ${ctx} If candidate raises "but ESOPs are paper" framing, counter with this concrete history.`;
    }
  }
  return "";
}

/** Regional role × city variation — same role pays differently across
 * Indian cities even within the same tier. Bangalore is the design /
 * tech premium hub; Chennai pays ~25% less for design but matches for
 * core engineering; Pune sits in between. */
function getRegionalRoleVariation(roleKey: string | undefined, cityTier: string | undefined, jobCity: string | undefined): string {
  if (!cityTier || cityTier === "tier1") return ""; // tier-1 baseline; no adjustment commentary
  const city = (jobCity || "").toLowerCase().trim();
  if (!city) return "";
  // Approximations grounded in Glassdoor / AmbitionBox 2024-25 medians:
  const isDesignRole = roleKey === "ux-designer" || roleKey === "design-engineer";
  const isProductRole = roleKey === "product-manager";
  if (isDesignRole) {
    if (city.includes("chennai")) return `REGIONAL ROLE VARIATION: Chennai design roles run 20-25% below Bangalore for the same band — design talent density is lower so companies don't pay the Bangalore premium. Don't over-correct: tier-2 multiplier already partially accounts for this.`;
    if (city.includes("hyderabad")) return `REGIONAL ROLE VARIATION: Hyderabad design pays ~10-15% below Bangalore — closing the gap as more product cos open Hyderabad campuses but still trailing.`;
    if (city.includes("pune")) return `REGIONAL ROLE VARIATION: Pune design pays ~10% below Bangalore for the same band — strong startup base but Bangalore still sets the price for senior design.`;
  }
  if (isProductRole) {
    if (city.includes("hyderabad")) return `REGIONAL ROLE VARIATION: Hyderabad PM roles run ~10% below Bangalore — Microsoft / Google / Salesforce hubs help but Bangalore PM market is deeper.`;
    if (city.includes("chennai")) return `REGIONAL ROLE VARIATION: Chennai PM market is thin — pays ~20% below Bangalore for the same band.`;
  }
  return "";
}

/** Compose all Indian-market context blocks into a single bandContext
 * suffix. Returns separate `campusWarning` (goes at very top, before
 * even the band) and `fullContextBlock` (goes between band breakdown
 * and the absolute-number rules). */
function buildIndianMarketContext(p: {
  role?: string;
  companyTier: string;
  cityTier: string;
  company?: string;
  hasEquity: boolean;
  exp: ExperienceLevel;
  totalCtc: number;
  basicLpa: number;
  hraLpa?: number;
  jobCity?: string;
  roleKey?: string;
}): { campusWarning: string; fullContextBlock: string } {
  const campusWarning = detectCampusHire(p.role);
  const inHand = getInHandRange(p.totalCtc, p.cityTier);
  const buyout = getNoticeBuyoutContext(p.companyTier, p.totalCtc);
  const equityLiq = getEquityLiquidityNote(p.company, p.companyTier, p.hasEquity);
  const esopRefresh = getEsopRefreshContext(p.companyTier, p.hasEquity);
  const esopDilution = getEsopDilutionContext(p.companyTier, p.hasEquity);
  const recentBuyback = getRecentBuybackContext(p.company);
  const dep = getDeputationContext(p.companyTier);
  const fest = getFestiveBonus(p.companyTier, p.basicLpa);
  const retention = getRetentionBonusContext(p.companyTier, p.exp, p.totalCtc);
  const bond = getBondWarning(p.companyTier);
  const wfh = getWfhAllowanceContext(p.companyTier);
  const insurance = getFamilyInsuranceContext(p.companyTier, p.exp);
  const bench = getBenchContext(p.companyTier);
  const taxSavings = getTaxSavingAllowances(p.companyTier);
  const da = getDearnessAllowanceContext(p.companyTier);
  const hraExemption = (p.hraLpa && p.hraLpa > 0)
    ? getHraExemptionWalkthrough(p.cityTier, p.basicLpa, p.hraLpa)
    : "";
  const regionalVariation = getRegionalRoleVariation(p.roleKey, p.cityTier, p.jobCity);
  // Compose only non-empty blocks so prompt stays focused per-tier.
  const blocks = [
    inHand.text,
    hraExemption,
    buyout,
    equityLiq,
    recentBuyback,
    esopRefresh,
    esopDilution,
    dep,
    bench,
    fest.text,
    retention,
    wfh,
    insurance,
    taxSavings,
    da,
    bond,
    regionalVariation,
    COUNTER_OFFER_BLUFF_CHECK,
  ].filter(Boolean);
  return {
    campusWarning,
    fullContextBlock: `INDIAN-MARKET CONTEXT (use these blocks when relevant — quote numbers verbatim, don't invent):\n\n${blocks.join("\n\n")}`,
  };
}

/** City-tier HRA percentage (of basic, per Indian Income Tax Act):
 *   tier-1 metro: 50% of basic | tier-2: 40% | tier-3: 40% (still allowed but less practical) */
function getHraPctOfBasic(cityTier: string | undefined): number {
  if (cityTier === "tier1") return 0.50;
  if (cityTier === "tier2") return 0.40;
  return 0.40;
}

/** Indian-market component breakdown for a given total CTC.
 *
 * Real Indian salaries decompose CTC into:
 *   - Base salary (~65-78% of CTC) — what taxes + PF compute on
 *   - Variable / performance bonus (0-25%, depends on company tier)
 *   - Employer PF (~5%, mandatory for companies >20 employees)
 *   - Gratuity + other allowances (~3%, mandatory after 5 yrs but accrued from day 1)
 *   - ESOP / RSU (~5-15% of CTC equivalent, ONLY if hasEquity)
 *
 * Within base salary the Indian salary slip further splits into:
 *   - Basic (~50% of base) — what taxes + PF compute on
 *   - HRA (40-50% of basic depending on city tier)
 *   - Special Allowance (remainder, balancing item)
 *
 * Components MUST sum exactly to totalCtc (within ₹0.1 LPA rounding) so
 * the LLM can quote them verbatim without inventing numbers. */
function buildComponentBreakdown(
  totalCtc: number,
  hasEquity: boolean,
  equityType: string,
  companyTier: string | undefined,
  cityTier: string | undefined,
): {
  base: number;
  variable: number;
  pf: number;
  gratuity_benefits: number;
  esop_per_year: number;
  basic: number;
  hra: number;
  special_allowance: number;
  text: string;
} {
  const round1 = (x: number) => Math.round(x * 10) / 10;
  // Indian standards: PF 5% of CTC (employer share, ~12% of basic),
  // Gratuity + benefits ~3% (LTA, medical, etc. accrued).
  const pf = round1(totalCtc * 0.05);
  const gratuity_benefits = round1(totalCtc * 0.03);
  // ESOP only when company offers it. Annual vest value ≈ 8% CTC equivalent.
  const esop_per_year = hasEquity ? round1(totalCtc * 0.08) : 0;
  // Variable: tier-driven. PSUs get 0, services 25%, FAANG 12%, etc.
  const variable = round1(totalCtc * getVariablePct(companyTier));
  // Base = whatever's left so the sum is exact.
  const remaining = totalCtc - pf - gratuity_benefits - esop_per_year - variable;
  const base = round1(remaining);

  // Within-base salary-slip split (Basic / HRA / Special Allowance). This is
  // the "monthly salary slip" view candidates ask about for income-tax planning.
  const basic = round1(base * 0.50);
  const hra = round1(basic * getHraPctOfBasic(cityTier));
  const special_allowance = round1(base - basic - hra);

  const lines = [`- Base salary: ${fmtLPA(base)}`];
  if (variable > 0) lines.push(`- Performance-linked variable bonus: ${fmtLPA(variable)} (paid out against quarterly/annual targets)`);
  else lines.push(`- No performance variable component (fixed-pay role)`);
  lines.push(`- Employer PF contribution: ${fmtLPA(pf)} (mandatory; 12% of basic, ~5% of CTC)`);
  lines.push(`- Gratuity + benefits (medical, LTA): ${fmtLPA(gratuity_benefits)}`);
  if (hasEquity) {
    const equityLabel = equityType === "rsu" ? "RSUs" : "ESOPs";
    lines.push(`- ${equityLabel}: ${fmtLPA(esop_per_year)} per year (4yr vest with 1yr cliff)`);
  } else {
    lines.push(`- No equity / ESOPs at this company-tier (typical for ${companyTier === "it-services" ? "IT services firms" : companyTier === "government" ? "PSUs / government" : "this tier"})`);
  }
  lines.push(`- TOTAL CTC: ${fmtLPA(totalCtc)} (components above SUM EXACTLY to this)`);

  // Salary-slip split (only mention when candidate asks for monthly-take-home detail)
  lines.push(``);
  lines.push(`MONTHLY SALARY-SLIP SPLIT OF BASE (${fmtLPA(base)}, when candidate asks "how does it land on the slip"):`);
  lines.push(`  - Basic: ${fmtLPA(basic)} (50% of base, drives PF/gratuity/HRA calculations)`);
  lines.push(`  - HRA: ${fmtLPA(hra)} (${cityTier === "tier1" ? "50%" : "40%"} of Basic, ${cityTier === "tier1" ? "tier-1 metro" : "tier-2/3 city"} rate)`);
  lines.push(`  - Special Allowance: ${fmtLPA(special_allowance)} (residual; fully taxable)`);

  return {
    base, variable, pf, gratuity_benefits, esop_per_year,
    basic, hra, special_allowance,
    text: lines.join("\n"),
  };
}

/** Boost the experience level by the role title prefix when present.
 *
 * Why: a candidate may have 5 YOE (mid by raw years) but be applying for
 * "Senior Product Designer" — a real recruiter would offer the senior band,
 * not the mid band. Without this, Upstox Senior PD was being offered ₹14-22
 * LPA (mid band) when AmbitionBox shows ₹30-33 LPA (the senior band).
 *
 * Floors only — never DOWNGRADES (a fresher applying for "Lead" still gets
 * filtered through interview screens; if they make it to negotiation, the
 * title is what's being negotiated). */
function applyTitleExpFloor(role: string | undefined, baseExp: ExperienceLevel): ExperienceLevel {
  if (!role) return baseExp;
  const r = role.toLowerCase();
  const RANK: ExperienceLevel[] = ["entry", "mid", "senior", "lead", "executive"];
  const idx = (e: ExperienceLevel) => RANK.indexOf(e);
  const max = (a: ExperienceLevel, b: ExperienceLevel) => idx(a) >= idx(b) ? a : b;
  // Order matters: check executive titles BEFORE senior/lead so "VP of Engineering"
  // doesn't match "engineer" first.
  if (/\b(vp|vice president|director|head of|chief|cxo|c[deot]o|c-?suite|partner)\b/.test(r)) return max(baseExp, "executive");
  if (/\b(lead|principal|staff|architect)\b/.test(r)) return max(baseExp, "lead");
  if (/\b(senior|sr\.?|sr )/.test(r)) return max(baseExp, "senior");
  return baseExp;
}

/** Generate a negotiation band for a given role/company/experience/city combination */
export function generateNegotiationBand(params: SalaryLookupParams): NegotiationBand {
  const roleKey = matchRoleKey(params.role);
  const companyTier = getCompanyTier(params.company) ?? "indian-unicorn";
  // Boost experience by the role title — "Senior Product Designer" should
  // use the senior band even when YOE-derived experience is "mid".
  const exp = applyTitleExpFloor(params.role, normalizeExp(params.experienceLevel));
  // jobCity resolution priority: explicit param > company HQ city (when known)
  // > candidate's current city > tier-1 default. Lets a Razorpay offer default
  // to Bangalore even if user didn't specify, matching real recruiter behaviour.
  const inferredJobCity = params.jobCity || getCompanyCity(params.company) || params.currentCity;
  const jobCityTier = getCityTier(inferredJobCity);

  /* Layer 1: per-company verified override (data/company-salary-overrides.ts).
     When a high-traffic company has a verified band from
     Levels.fyi / AmbitionBox / Glassdoor / DRHP filings, use it
     instead of the generic tier band. Specific > generic. */
  const override = getCompanyBandOverride(params.company, roleKey, exp);
  if (override) {
    const adjOv = (v: number) => jobCityTier === "tier1" ? v : adjustForCity(v, jobCityTier);
    const totalMin = adjOv(override.totalMin);
    const totalMax = adjOv(override.totalMax);
    const initialOffer = Math.round((totalMin + (totalMax - totalMin) * 0.35) * 10) / 10;
    const minOffer = Math.round(totalMin * 0.95 * 10) / 10;
    const maxStretch = Math.round((totalMin + (totalMax - totalMin) * 0.85) * 10) / 10;
    const walkAway = Math.round(totalMax * 1.1 * 10) / 10;
    const hasEquity = (override.equityType ?? "none") !== "none";
    const equityRange: [number, number] = hasEquity
      ? [adjOv(override.equityMin ?? 0), adjOv(override.equityMax ?? 0)]
      : [0, 0];
    // Joining bonus is NOT culture-universal. PSUs / government and most
    // traditional Indian-IT-services firms (TCS, Infosys, Wipro, HCL) don't
    // offer joining bonuses at IC level. Older industrial firms (Tata, L&T,
    // Mahindra) similarly. Cap at 0 for those tiers; otherwise allow up to
    // 10% of initial offer as authority.
    const noBonusTiers = new Set(["government-psu", "it-services"]);
    const joiningBonusMax = noBonusTiers.has(companyTier)
      ? 0
      : Math.max(0.5, Math.round(initialOffer * 0.1 * 10) / 10);
    const joiningBonusRange: [number, number] = [0, joiningBonusMax];
    // Pre-compute the component breakdown for the initial offer so the LLM
    // quotes exact, additive numbers instead of free-styling. Now tier-aware:
    // PSUs get 0% variable, services get 25%, FAANG get 12%, etc.
    const components = buildComponentBreakdown(initialOffer, hasEquity, override.equityType ?? "none", companyTier, jobCityTier);
    // Indian-market context blocks (tax regime, notice buyout, equity
    // liquidity, deputation, retention, festive bonus, bond warnings,
    // campus rigidity). Each is non-empty only when relevant for this
    // tier — keeps the prompt focused.
    const indianContext = buildIndianMarketContext({
      role: params.role,
      companyTier,
      cityTier: jobCityTier,
      company: params.company,
      hasEquity,
      exp,
      totalCtc: initialOffer,
      basicLpa: components.basic,
      hraLpa: components.hra,
      jobCity: inferredJobCity,
      roleKey,
    });
    const bandContext = `${indianContext.campusWarning ? `${indianContext.campusWarning}\n\n` : ""}NEGOTIATION BAND (verified for ${params.company} from public sources, last verified ${override.lastVerified}):
- Initial offer: ${fmtLPA(initialOffer)} CTC — this is what you PRESENT FIRST
- Floor (minimum you can offer): ${fmtLPA(minOffer)} CTC
- Max stretch (with approval): ${fmtLPA(maxStretch)} CTC
- Walk-away ceiling: ${fmtLPA(walkAway)}
- Joining bonus authority: ${fmtRange(joiningBonusRange[0], joiningBonusRange[1])}
${hasEquity ? `- Equity: ${fmtRange(equityRange[0], equityRange[1])}/yr (${override.equityVesting ?? "4yr / 1yr cliff"})` : `- No equity at this level (${noBonusTiers.has(companyTier) ? "typical for this tier" : "company-specific"})`}
${override.notes ? `- Note: ${override.notes}` : ""}
SOURCE: ${override.source}.

${indianContext.fullContextBlock}

INITIAL-OFFER COMPONENT BREAKDOWN (Indian-market standard — quote these EXACT numbers when the candidate asks "what's the breakdown?", do NOT invent your own):
${components.text}

These numbers are calibrated to the COMPANY (not the tier). Quoting numbers from a different tier (e.g. unicorn bands for a small design studio) breaks the simulation. Stay anchored.`;
    return {
      initialOffer, minOffer, maxStretch, walkAway,
      joiningBonusRange, hasEquity, equityRange,
      bandContext,
    };
  }

  const entry = findSalaryEntry(roleKey, companyTier, exp);

  // Fallback band if no salary data. Calibrate by experience level so
  // an unknown junior role doesn't default to a senior-IC band.
  // Previous default (₹12 / ₹16 / ₹20) was producing wildly inflated
  // offers for unknown junior roles (e.g. ₹22 LPA for a junior UI/UX
  // role at a small Mumbai design studio).
  if (!entry) {
    const fallbackByExp: Record<string, { initial: number; min: number; max: number; walk: number }> = {
      entry:     { initial: 5,  min: 3,   max: 8,   walk: 12 },
      mid:       { initial: 10, min: 7,   max: 15,  walk: 20 },
      senior:    { initial: 18, min: 14,  max: 28,  walk: 35 },
      lead:      { initial: 28, min: 22,  max: 45,  walk: 55 },
      executive: { initial: 50, min: 40,  max: 90,  walk: 120 },
    };
    const f = fallbackByExp[exp] ?? fallbackByExp.mid;
    return {
      initialOffer: f.initial, minOffer: f.min, maxStretch: f.max, walkAway: f.walk,
      joiningBonusRange: [0, Math.max(0.5, f.initial * 0.1)], hasEquity: false, equityRange: [0, 0],
      bandContext: `No specific salary data for this role/company. Conservative fallback for ${exp} level: ₹${f.initial} LPA initial offer, ₹${f.max} LPA max stretch.`,
    };
  }

  const adj = (v: number) => jobCityTier === "tier1" ? v : adjustForCity(v, jobCityTier);

  // Initial offer: ~75th percentile of the range (leaves room to negotiate up)
  const totalMin = adj(entry.total_min);
  const totalMax = adj(entry.total_max);
  const initialOffer = Math.round((totalMin + (totalMax - totalMin) * 0.35) * 10) / 10;

  // Min offer: slightly below the data range min (floor)
  const minOffer = Math.round(totalMin * 0.95 * 10) / 10;

  // Max stretch: 90th percentile of range
  const maxStretch = Math.round((totalMin + (totalMax - totalMin) * 0.85) * 10) / 10;

  // Walk-away: above the top of the range — if candidate demands more, manager declines
  const walkAway = Math.round(totalMax * 1.1 * 10) / 10;

  const hasEquity = entry.equity_type !== "none";
  const equityRange: [number, number] = hasEquity
    ? [adj(entry.equity_annual_min), adj(entry.equity_annual_max)]
    : [0, 0];

  // Tier-aware joining bonus. PSUs / IT-services don't offer bonuses at IC
  // level; respect that culture rather than letting the LLM invent one. If
  // the salary entry has a curated max, trust it (overrides the tier rule).
  const noBonusTiers = new Set(["government-psu", "it-services"]);
  const tierAllowsBonus = !noBonusTiers.has(companyTier);
  const joiningBonusRange: [number, number] = [
    entry.joining_bonus_min,
    entry.joining_bonus_max > 0
      ? entry.joining_bonus_max
      : tierAllowsBonus
        ? Math.round(initialOffer * 0.08 * 10) / 10
        : 0,
  ];

  /* Synthetic-cell provenance: when this band came from densification
     (sibling-derived, not researched), tell the LLM so it can speak
     with appropriate hedging. Curated cells produce no caveat. */
  const isSynthetic = entry._synthetic === true;
  const syntheticCaveat = isSynthetic
    ? `\nDATA-PROVENANCE CAVEAT: This band is DERIVED from a sibling cell (${entry._synthetic_source ?? "tier-fallback"}), not independently researched for this exact role/tier combination. The figures are structurally consistent with neighboring cells but should be treated as estimates, not verified market data. If the candidate cites a specific source contradicting these numbers, defer rather than insist.\n`
    : "";

  // Pre-compute Indian-market component breakdown for the initial offer.
  // The LLM quotes from this block verbatim — no more invented numbers.
  // Tier-aware: PSUs get 0% variable, services 25%, FAANG 12%, etc.
  const components = buildComponentBreakdown(initialOffer, hasEquity, entry.equity_type, companyTier, jobCityTier);
  // Indian-market context (tax, notice, equity-liquidity, deputation,
  // retention, festive, bond, campus, HRA exemption math, recent buyback
  // history, ESOP dilution timeline, regional role variation). Each block
  // is non-empty only when relevant for this tier so the prompt stays
  // focused per-session.
  const indianContext = buildIndianMarketContext({
    role: params.role,
    companyTier,
    cityTier: jobCityTier,
    company: params.company,
    hasEquity,
    exp,
    totalCtc: initialOffer,
    basicLpa: components.basic,
    hraLpa: components.hra,
    jobCity: inferredJobCity,
    roleKey,
  });
  const bandContext = `${indianContext.campusWarning ? `${indianContext.campusWarning}\n\n` : ""}${syntheticCaveat}NEGOTIATION BAND (your authority as hiring manager):
- Initial offer: ${fmtLPA(initialOffer)} CTC — this is what you PRESENT FIRST
- Floor (minimum you can offer): ${fmtLPA(minOffer)} CTC
- Max stretch (with approval): ${fmtLPA(maxStretch)} CTC
- Walk-away ceiling: ${fmtLPA(walkAway)} — if candidate demands above this, politely decline: "That's beyond our band for this level. I'd need to explore a senior/staff position instead."
- Joining bonus authority: ${fmtRange(joiningBonusRange[0], joiningBonusRange[1])}
${hasEquity ? `- Equity: ${fmtRange(equityRange[0], equityRange[1])}/yr (${entry.equity_vesting})` : "- No equity at this level"}

INITIAL-OFFER COMPONENT BREAKDOWN (Indian-market standard — quote these EXACT numbers when the candidate asks "what's the breakdown?", do NOT invent your own):
${components.text}

${indianContext.fullContextBlock}

ABSOLUTE NUMBER RULES (violations destroy realism):
1. ALWAYS use a SINGLE precise figure. NEVER quote a range like "₹28-45 LPA" or "between X and Y" — real hiring managers state ONE number and defend it. The band above is YOUR internal authority, not a public range to share.
2. NEVER write a placeholder like "₹X" / "₹X LPA" / "TBD" / "[amount]". Every figure you say MUST be a real LPA number derived from the band above. If you don't know, don't quote.
3. NEVER quote a number ABOVE ${fmtLPA(walkAway)} — that's outside your authority for this role and level.
4. NEVER quote a number that conflicts with this band's CTC tier. The band is calibrated to the candidate's role, company tier, experience, and city — overriding it with bigger numbers (e.g. unicorn-tier figures for a services-firm role) breaks the simulation.

YOUR GOAL AS HIRING MANAGER: SAVE COST. You want the best talent at the LOWEST possible CTC. You are NOT a friendly career coach — you protect the budget.
- ALWAYS open at the initial offer (${fmtLPA(initialOffer)}). NEVER open higher. NEVER pre-empt with bonuses or perks before the candidate asks.
- If the candidate asks for LESS than your initial offer: close immediately — that's a win for you.
- If the candidate asks for MORE than your initial offer: PUSH BACK firmly. Counter BELOW their ask, not above it. Meet them partway, NOT at their number. NEVER agree to the candidate's stated number on the first ask — that signals you had budget to spare and ruins your authority for the rest of the conversation.
- NEVER offer MORE than what the candidate asked for. That is unrealistic and wasteful.
- Resist arbitrary numbers. If a content-writer candidate at TCS asks for ₹50 LPA, DO NOT quote a range, DO NOT engage with it as if it's reasonable. Reply: "That's well above where this role lands at our company. Our band for this role is ${fmtLPA(initialOffer)}-${fmtLPA(maxStretch)}, and I'd need a strong story to even approach ${fmtLPA(maxStretch)}. What's making you think this role is worth ${fmtLPA(walkAway)}+ ?".
- Concede in small increments (₹0.5-1.5 LPA per round). Make them EARN every rupee.
- Trade — don't just give. If you raise base, reduce variable or delay review cycle.
- Max stretch requires leadership approval. Use it reluctantly, only after the candidate pushes hard with a concrete justification.
- DO NOT volunteer joining bonuses, notice-period buyouts, or equity unless the candidate raises them OR you've already conceded base and need a sweetener.

JOINING-BONUS / NOTICE-PERIOD INTELLIGENCE:
- Notice-period buyout is ONLY relevant if the candidate is currently EMPLOYED with a long notice (60-90 days at TCS / Infosys / Wipro). If the candidate explicitly says they're already free / "available immediately" / "my notice ended on <date>" — do NOT offer a notice buyout. They have nothing to buy out.
- Same for "join in 30 days" framing — if the candidate is already available, don't ask them to join in 30 days; ask their preferred start date instead.
- A joining bonus is a recruiting tool, not a default — only offer one if (a) the candidate is sacrificing a real bonus from their current employer, OR (b) you're using it to bridge a CTC gap you can't close on base.`;

  return {
    initialOffer, minOffer, maxStretch, walkAway,
    joiningBonusRange, hasEquity, equityRange, bandContext,
    isSynthetic, syntheticSource: entry._synthetic_source,
  };
}

/** Get negotiation style instructions for the LLM */
export function getNegotiationStyleContext(style: NegotiationStyle): string {
  switch (style) {
    case "cooperative":
      return `NEGOTIATION STYLE: COOPERATIVE
You are a friendly, collaborative hiring manager. You genuinely want the candidate to succeed and feel valued.
- Lead with transparency: share your band range early
- Actively suggest creative solutions: "What if we do X instead of Y?"
- Show empathy: "I understand that's important to you"
- Goal: reach win-win. You'll stretch budget if the candidate gives reasonable justification
- Tone: warm, supportive, solution-oriented`;
    case "aggressive":
      return `NEGOTIATION STYLE: AGGRESSIVE
You are a tough, budget-conscious hiring manager. The company is watching costs closely.
- Anchor LOW — start at the bottom of your band
- Push back on every counter: "That's ambitious. Help me justify that to finance."
- Use pressure: "We have other strong candidates", "Budget is tight this quarter"
- Concede slowly and only when the candidate provides strong reasoning
- Create urgency: "I need an answer by Friday"
- Tone: professional but firm, slightly skeptical, data-driven`;
    case "defensive":
      return `NEGOTIATION STYLE: DEFENSIVE
You are a cautious hiring manager who avoids confrontation but protects the budget.
- Deflect early salary questions: "Let me check with finance", "That's above our standard band"
- Lead with non-monetary benefits before raising base: flexibility, learning budget, title upgrade
- When you DO give a number, make it reluctant: "Finance approved ₹X, but I had to push hard for it"
- When pushed hard, cite policy: "Our compensation committee sets the bands"
- You WILL eventually commit to specific numbers — but only after the candidate pushes or we reach the counter-offer stage
- Tone: polite, slightly evasive, bureaucratic — the candidate must be persistent to get concessions`;
  }
}

/** Normalize experience level string to our enum.
 *  Accepts: canonical levels ("entry"/"mid"/"senior"/"lead"/"executive"),
 *  role-title hints ("staff", "principal", "vp", "director", "cxo"),
 *  and free-text YOE inputs ("15 years", "12+ yrs", "8-10 years", "0-2 yrs").
 *  Pre-fix bug: "15 years experience" returned "mid", so 15-YOE candidates
 *  got mid-level bands. */
function normalizeExp(exp: string | undefined): ExperienceLevel {
  if (!exp) return "mid";
  const lower = exp.toLowerCase().trim();
  /* Fresher synonyms — Indian campus / new-grad pipelines have many
     names. Cover the most common before YOE / title parsing so a
     candidate typing "campus hire" / "GET" / "management trainee" /
     "graduate" gets the entry band, not the mid default. */
  if (
    lower === "fresher" || lower === "entry" || lower === "junior" || lower === "intern" ||
    lower === "graduate" || lower === "new grad" || lower === "newgrad" ||
    lower === "campus" || lower === "campus hire" || lower === "campus placement" ||
    lower === "get" || lower === "graduate engineer trainee" ||
    lower === "management trainee" || lower === "mt" || lower === "trainee" ||
    lower === "associate engineer" || lower === "associate software engineer" ||
    lower === "no experience" || lower === "0 yoe" || lower === "0 years" ||
    /\b(get|management trainee|graduate engineer trainee|campus hire|campus placement|new grad|fresher|0\s*(?:yoe|year))\b/.test(lower)
  ) return "entry";
  if (lower === "mid" || lower === "middle" || lower === "intermediate") return "mid";
  if (lower === "senior" || lower === "sr") return "senior";
  if (lower === "lead" || lower === "staff" || lower === "principal") return "lead";
  if (lower === "executive" || lower === "vp" || lower === "director" || lower === "c-suite" || lower === "cxo") return "executive";

  /* YOE parsing — extract first integer in the string and map to level.
     Handles: "15 years", "15+ years", "10-12 yrs", "0-2 years",
     "approximately 8 years", "8 years experience", "18 yoe", etc.
     The character class [-+to] is split so each char is independently
     optional (otherwise "15+ years" fails because + isn't followed by
     a digit). */
  const yoeMatch = lower.match(/(\d+)\s*[-+]?\s*\d*\s*(?:year|yr|yoe)/);
  if (yoeMatch) {
    const yoe = parseInt(yoeMatch[1], 10);
    if (yoe <= 2) return "entry";
    if (yoe <= 5) return "mid";
    if (yoe <= 9) return "senior";
    if (yoe <= 14) return "lead";
    return "executive"; // 15+ years
  }

  /* Title-based fallbacks (when an exp-string is actually a role title). */
  if (/\b(staff|principal|architect|tech lead)\b/.test(lower)) return "lead";
  if (/\b(vp|svp|evp|chief|cto|cpo|cfo|coo|ceo|chro|head of|director)\b/.test(lower)) return "executive";
  if (/\b(senior|sr\.|sde[-\s]?(iii|3))\b/.test(lower)) return "senior";

  return "mid";
}

const EXP_FALLBACK_ORDER: Record<ExperienceLevel, ExperienceLevel[]> = {
  entry: ["entry", "mid"],
  mid: ["mid", "entry", "senior"],
  senior: ["senior", "lead", "mid"],
  lead: ["lead", "senior", "executive"],
  executive: ["executive", "lead", "senior"],
};

const EXP_LABELS: Record<ExperienceLevel, string> = {
  entry: "Entry-level (0-2 yrs)",
  mid: "Mid-level (3-5 yrs)",
  senior: "Senior (6-10 yrs)",
  lead: "Lead/Staff (10-15 yrs)",
  executive: "Executive/VP (15+ yrs)",
};

/**
 * Look up salary entry from the structured data.
 * Tries: exact role → alias → tier fallback → adjacent experience levels
 */
function findSalaryEntry(roleKey: RoleKey, tier: CompanyTier, exp: ExperienceLevel): SalaryEntry | null {
  const roleData = SALARY_DATA[roleKey];
  if (roleData) {
    const tierData = roleData[tier];
    if (tierData) {
      for (const fallbackExp of EXP_FALLBACK_ORDER[exp]) {
        if (tierData[fallbackExp]) return tierData[fallbackExp]!;
      }
    }
    const fallbackTier = getSalaryTierFallback(tier);
    if (fallbackTier !== tier) {
      const fbTierData = roleData[fallbackTier];
      if (fbTierData) {
        for (const fallbackExp of EXP_FALLBACK_ORDER[exp]) {
          if (fbTierData[fallbackExp]) return fbTierData[fallbackExp]!;
        }
      }
    }
    if (tier !== "faang" && roleData["faang"]) {
      for (const fallbackExp of EXP_FALLBACK_ORDER[exp]) {
        if (roleData["faang"]![fallbackExp]) return roleData["faang"]![fallbackExp]!;
      }
    }
  }
  const alias = ROLE_ALIASES[roleKey];
  if (alias && alias !== roleKey) {
    return findSalaryEntry(alias, tier, exp);
  }
  if (roleKey !== "software-engineer") {
    return findSalaryEntry("software-engineer", tier, exp);
  }
  return null;
}

/** Format LPA value: "₹12" or "₹1.5 Cr" */
function fmtLPA(lpa: number): string {
  if (lpa >= 100) return `₹${(lpa / 100).toFixed(1).replace(/\.0$/, "")} Cr`;
  if (lpa >= 10) return `₹${Math.round(lpa)} LPA`;
  return `₹${lpa % 1 === 0 ? lpa : lpa.toFixed(1)} LPA`;
}

/** Format a range */
function fmtRange(min: number, max: number): string {
  if (min === 0 && max === 0) return "N/A";
  if (min === max) return fmtLPA(min);
  return `${fmtLPA(min)}-${fmtLPA(max).replace("₹", "")}`;
}

/** Determine if two cities represent a relocation scenario */
function isRelocation(currentCity: string | undefined, jobCity: string | undefined): boolean {
  if (!currentCity || !jobCity) return false;
  const a = currentCity.toLowerCase().trim();
  const b = jobCity.toLowerCase().trim();
  if (a === b) return false;
  // Same metro area
  if ((a.includes("bangalore") || a.includes("bengaluru")) && (b.includes("bangalore") || b.includes("bengaluru"))) return false;
  if ((a.includes("delhi") || a.includes("gurgaon") || a.includes("gurugram") || a.includes("noida")) &&
      (b.includes("delhi") || b.includes("gurgaon") || b.includes("gurugram") || b.includes("noida"))) return false;
  if ((a.includes("mumbai") || a.includes("bombay")) && (b.includes("mumbai") || b.includes("bombay"))) return false;
  return true;
}

/**
 * Main lookup: returns a compact salary context string (~100-180 tokens)
 * for injection into the LLM prompt.
 *
 * Salary is based on JOB CITY (where the role is), not current city.
 * When relocating, adds relocation context.
 */
export function lookupSalaryContext(params: SalaryLookupParams): string {
  const roleKey = matchRoleKey(params.role);
  const companyTier = getCompanyTier(params.company) ?? "indian-unicorn";
  const exp = normalizeExp(params.experienceLevel);

  // Salary based on JOB location (where the offer is), fallback to current city, fallback to Tier 1
  const jobCityTier = getCityTier(params.jobCity || params.currentCity);
  const currentCityTier = getCityTier(params.currentCity);
  const relocating = isRelocation(params.currentCity, params.jobCity);

  const entry = findSalaryEntry(roleKey, companyTier, exp);
  if (!entry) {
    return `No specific salary data for this role/company combination. Use general India market rates for ${EXP_LABELS[exp]}.`;
  }

  const tierLabel = TIER_LABELS[companyTier];
  const cityNote = jobCityTier !== "tier1"
    ? ` (${jobCityTier === "tier2" ? "Tier 2 city" : "Tier 3 city"}, ~${Math.round(CITY_MULTIPLIERS[jobCityTier].min * 100)}-${Math.round(CITY_MULTIPLIERS[jobCityTier].max * 100)}% of Tier 1 rates)`
    : " (Tier 1 city)";

  // Apply job city multiplier (salary = where the job is)
  const adj = (v: number) => jobCityTier === "tier1" ? v : adjustForCity(v, jobCityTier);

  const parts: string[] = [];

  // Line 1: Role + Company + Level + Job City
  const locationLabel = params.jobCity
    ? params.jobCity
    : params.currentCity
    ? params.currentCity
    : tierLabel;
  parts.push(`SALARY DATA for ${params.role || roleKey} at ${params.company || tierLabel} (${tierLabel}), ${EXP_LABELS[exp]}, ${locationLabel}${cityNote}:`);

  // Line 2: Compensation breakdown
  const base = `Base: ${fmtRange(adj(entry.base_min), adj(entry.base_max))}`;
  const variable = entry.variable_min > 0 ? `Variable/Bonus: ${fmtRange(adj(entry.variable_min), adj(entry.variable_max))}` : "";
  const equity = entry.equity_type !== "none"
    ? `${entry.equity_type === "rsu" ? "RSUs" : "ESOPs"}: ${fmtRange(adj(entry.equity_annual_min), adj(entry.equity_annual_max))}/yr (${entry.equity_vesting})`
    : "";
  const total = `Total CTC: ${fmtRange(adj(entry.total_min), adj(entry.total_max))}`;

  parts.push([base, variable, equity, total].filter(Boolean).join(". ") + ".");

  // Line 3: Practical details
  const details: string[] = [];
  details.push(`In-hand: ~${Math.round(entry.in_hand_ratio * 100)}% of CTC`);
  if (entry.joining_bonus_max > 0) {
    details.push(`Joining bonus: ${fmtRange(entry.joining_bonus_min, entry.joining_bonus_max)}`);
  }
  details.push(`Notice period: ${entry.notice_period_days} days`);
  details.push(`Negotiation room: ${entry.negotiation_leverage}`);
  parts.push(details.join(". ") + ".");

  // Line 4: Hot skills premium (if any)
  if (entry.hot_skills.length > 0) {
    parts.push(`Premium skills: ${entry.hot_skills.join(", ")}.`);
  }

  // Line 5: Notes (if any)
  if (entry.notes) {
    parts.push(`Note: ${entry.notes}`);
  }

  // Line 6: Relocation context (when current city ≠ job city)
  if (relocating && params.currentCity && params.jobCity) {
    const relocParts: string[] = [];
    relocParts.push(`RELOCATION: Candidate is moving from ${params.currentCity} to ${params.jobCity}.`);

    // Relocation allowance
    relocParts.push(`Relocation allowance: ₹50K-3 LPA one-time (cross-state: up to 2 months basic salary).`);

    // Cost of living adjustment
    if (currentCityTier !== jobCityTier) {
      if (jobCityTier === "tier1" && currentCityTier !== "tier1") {
        relocParts.push(`CoL adjustment: ${params.jobCity} is a Tier 1 city — expect 15-40% higher rent/expenses vs ${params.currentCity}. Candidate should negotiate accordingly.`);
      } else if (currentCityTier === "tier1" && jobCityTier !== "tier1") {
        relocParts.push(`CoL benefit: ${params.jobCity} has lower living costs than ${params.currentCity}. Base salary may be lower but purchasing power is higher.`);
      }
    }

    // Temporary accommodation
    relocParts.push(`Companies typically offer: economy airfare for family, 15 days hotel accommodation, moving expenses.`);

    // Notice period buyout for relocation hires
    relocParts.push(`Notice buyout formula: (notice_days ÷ 30) × (monthly_base) × 1.5-2x = joining bonus. For 90-day notice at ₹50K/month base → ₹2.25-3 LPA buyout.`);

    parts.push(relocParts.join(" "));
  }

  return parts.join("\n");
}

/**
 * Build the complete salary negotiation guidance for the LLM prompt.
 * Combines the lookup result with structural rules (equity constraints, examples).
 */
export function buildSalaryNegotiationGuidance(params: SalaryLookupParams): string {
  const salaryContext = lookupSalaryContext(params);
  const exp = normalizeExp(params.experienceLevel);
  const companyTier = getCompanyTier(params.company);
  const relocating = isRelocation(params.currentCity, params.jobCity);

  // Look up entry for dynamic rules (in-hand ratio, equity, variable availability)
  const roleKey = matchRoleKey(params.role);
  const safeTier = companyTier ?? "indian-unicorn";
  const entry = findSalaryEntry(roleKey, safeTier, exp);
  const hasEquity = entry ? entry.equity_type !== "none" : false;
  const hasVariable = entry ? entry.variable_min > 0 : false;
  const inHandPct = entry ? `${Math.round(entry.in_hand_ratio * 100)}%` : "65-75%";
  const isGovt = companyTier === "government-psu";
  const isStartup = companyTier === "startup-early" || companyTier === "startup-growth";

  // Equity rule: gated by company type AND salary data, not just experience level
  let equityRule: string;
  if (isGovt) {
    equityRule = "EQUITY RULE: Government/PSU roles have NO equity, ESOPs, or stock options. Do NOT mention equity at all. Focus on grade level, HRA, DA, pension, and allowances.";
  } else if (!hasEquity) {
    equityRule = `EQUITY RULE: This role/company does NOT offer equity at this level. Do NOT mention ESOPs, RSUs, or stock options in the offer or counter-offers. Negotiate only base salary${hasVariable ? " + variable/bonus" : ""} + joining bonus + benefits.`;
  } else if (exp === "entry") {
    equityRule = "EQUITY RULE: Do NOT mention equity, stock options, or ESOPs. Freshers don't get equity. Negotiate only base salary + joining bonus + benefits.";
  } else if (exp === "mid") {
    equityRule = `EQUITY RULE: ${isStartup ? "ESOPs may be offered" : "RSUs/ESOPs are available"} — quote by annual value only (e.g., 'ESOPs worth ₹3-5 LPA/yr vesting over 4 years'). NEVER as percentage of company.`;
  } else if (exp === "senior" || exp === "lead") {
    equityRule = `EQUITY RULE: May discuss ${entry?.equity_type === "rsu" ? "RSUs" : "ESOPs"}. Quote by annual value (₹10-60 LPA/yr). ${isStartup ? "At startups: 0.05-0.5% max. NEVER more than 1%." : "Quote only annual value, not percentage."}`;
  } else {
    equityRule = `EQUITY RULE: ${isStartup ? "Equity at startups: 0.5-2% max." : "RSUs/equity by annual value."} ${entry?.equity_type === "rsu" ? "RSUs" : "ESOPs"} available. NEVER offer 5%+ — that's co-founder territory.`;
  }

  // CTC structure guidance based on what this role/company actually offers
  let ctcStructureNote: string;
  if (isGovt) {
    ctcStructureNote = ""; // handled by govNote below
  } else if (hasEquity && hasVariable) {
    ctcStructureNote = "\nCTC STRUCTURE: Present as Base + Variable/Bonus + Equity + Benefits. All components are available for this role.";
  } else if (hasVariable && !hasEquity) {
    ctcStructureNote = "\nCTC STRUCTURE: Present as Base + Variable/Bonus + Benefits. Do NOT mention equity/ESOPs — this role does not include them.";
  } else if (hasEquity && !hasVariable) {
    ctcStructureNote = "\nCTC STRUCTURE: Present as Base + Equity + Benefits. Variable/bonus is not standard at this level.";
  } else {
    ctcStructureNote = "\nCTC STRUCTURE: Present as Fixed CTC (Base + Allowances) + Benefits. Do NOT mention equity/ESOPs or variable pay — this role does not include them.";
  }

  // Government/PSU has very different negotiation dynamics
  const govNote = companyTier === "government-psu"
    ? `\nGOVERNMENT/PSU NOTE: Salary negotiation is VERY different here. Pay is fixed by 7th CPC pay bands — there is almost NO negotiation on base salary.

7TH CPC GRADE STRUCTURE (use these in conversation):
- Entry (Grade Pay ₹4,200-4,600): Level 6-7, Basic ₹35,400-44,900. Total: ₹5-8 LPA.
- Mid (Grade Pay ₹4,800-5,400): Level 8-9, Basic ₹47,600-53,100. Total: ₹8-14 LPA.
- Senior (Grade Pay ₹6,600-7,600): Level 10-12, Basic ₹56,100-78,800. Total: ₹14-25 LPA.
- Director/SAG (Grade Pay ₹8,700-10,000): Level 13-14, Basic ₹1,23,100-1,44,200. Total: ₹25-40 LPA.
Actual take-home includes DA (~46% of basic), HRA (8-24% by city), Transport, and pension contribution.

WHAT TO NEGOTIATE (instead of base):
- Joining grade/level (one level higher = 15-20% more)
- Posting location (metro = higher HRA: 24% vs 8% for Tier 3)
- Deputation allowance (20% extra if posted to another department)
- Housing (Type IV/V quarters worth ₹5-15 LPA in metros)
- Training budget (foreign training, conferences)
- Performance-linked incentive (PLI: ₹10K-2 LPA/yr)
- Pension value: defined benefit pension is worth ₹50-150 LPA actuarially over retirement

Do NOT present this as a normal corporate salary negotiation. Frame it as: "Let me walk you through the grade and posting we've approved for you."`
    : "";

  // Relocation narration instruction with CoL context
  const jobCityTier = getCityTier(params.jobCity || params.currentCity);
  const currentCityTier = getCityTier(params.currentCity);
  let relocNote = "";
  if (relocating && params.currentCity && params.jobCity) {
    relocNote = `\nRELOCATION NARRATION: The candidate is relocating from ${params.currentCity} to ${params.jobCity}. You MUST reference this in the conversation. Mention the relocation package in your offer presentation (e.g., "Since you'd be relocating from ${params.currentCity}, we're including a relocation allowance of ₹X and 2 weeks temporary accommodation"). Use relocation as a negotiation lever — candidates expect companies to sweeten the deal for relocation.`;
    // Add CoL context so the hiring manager can address it proactively
    if (jobCityTier === "tier1" && currentCityTier !== "tier1") {
      relocNote += `\nCOST OF LIVING: ${params.jobCity} (Tier 1) has 20-40% higher rent than ${params.currentCity}. Proactively mention this: "I know living costs are higher in ${params.jobCity}, which is why we've factored in a higher base and HRA." Use this to justify the offer level or add a relocation top-up.`;
    } else if (currentCityTier === "tier1" && jobCityTier !== "tier1") {
      relocNote += `\nCOST OF LIVING: ${params.jobCity} has lower living costs than ${params.currentCity}. You can mention: "The purchasing power in ${params.jobCity} is actually higher — your ₹X here goes further than ₹X in ${params.currentCity}."`;
    }
  }

  /* Family-specific framing for AI/ML (skill premium), sales
     (fixed+variable+commission), senior design (business impact > Figma).
     Returns "" for roles without a special framing rule. */
  const familyFraming = buildFamilyCompFraming(roleKey);

  /* Granular role band — the 2025 India market grid covering 80+
     specific roles (Frontend Developer, Senior Product Designer,
     GenAI Engineer, Enterprise Sales Manager, etc.) at the
     candidate's exact YOE bucket and company tier. Layered ON TOP
     of the existing salaryContext so the LLM has both:
       • coarse band from salaries.ts → drives the numeric clamp
       • granular band from this lookup → tells the LLM the
         realistic 2025 range for the candidate's specific role
     If the role-text doesn't match any granular role, returns ""
     and we fall back to the coarse band only. */
  const granularBand = formatGranularBand(params.role, safeTier, exp);

  return `CRITICAL: This is a SALARY NEGOTIATION simulation, NOT a behavioral interview. You ARE the hiring manager — stay in character throughout.
- Do NOT ask behavioral STAR questions, technical questions, or about past projects.
- Use Indian Rupees (₹) and LPA (Lakhs Per Annum). CTC = Cost to Company. In-hand ≈ ${inHandPct} of CTC (after PF, gratuity, professional tax deductions).${ctcStructureNote}${familyFraming}

${COMP_STRATEGY_NOTES}

VOICE: Sound like a real Indian hiring manager — warm but businesslike. Use phrases like "We've been impressed with your profile", "Let me walk you through the offer", "I'll be transparent about our bands", "Let me see what I can do". Avoid robotic or overly formal language.

NEGOTIATION FLOW — Each question MUST follow this progression:
1. INTRO: Welcome + set context. "We'd like to extend an offer for the [Role] position..."
2. OFFER PRESENTATION: Present a specific CTC breakdown from the salary data below. State base, bonus, benefits. Ask: "How does this align with your expectations?"
3. EXPECTATION PROBE: Ask what range they're targeting and whether they have competing offers. Do NOT ask for current CTC — focus on what they WANT, not what they currently earn. If they name a higher number, acknowledge it: "That's above our initial band, but let me see what flexibility we have."
4. COUNTER-OFFER: Based on their response, present an improved package. Trade levers: base vs joining bonus vs flexible work vs relocation support vs learning budget. Example: "I can stretch the base to ₹X, or keep it at ₹Y and add a ₹Z joining bonus — which works better for you?"
5. CLOSING: Finalize with timeline. "If we can agree on this, when can you join? What's your notice period situation?"

${salaryContext}${granularBand}

${equityRule}
EQUITY VESTING DETAILS (use when candidate asks):
- Amazon RSUs: back-loaded 5/15/40/40 over 4 years (Year 1 = only 5%).
- Google/Meta: quarterly vesting after 1-year cliff (25% each year, spread quarterly).
- Indian startups: 4-year vest, 1-year cliff. ESOPs are illiquid until IPO/exit.
- If candidate asks to accelerate vesting: "Standard is 4 years, but I can check with finance about 3-year vesting as an exception."
- If candidate asks about ESOP value: "At current valuation, your ₹X/yr in ESOPs could be worth ₹Y on exit, but that's speculative."

COMPENSATION RULES:
- Present CTC breakdown: Base + Bonus + RSUs/ESOPs (if applicable) + Benefits.
- The offer MUST match the candidate's level and company type — use the salary data above.
- Typical switching hike: 20-35% lateral, 40-100% services-to-product. Annual increment avg: 9.5%.

NOTICE PERIOD & BUYOUT:
- Notice buyout formula: (notice_days ÷ 30) × (annual_base ÷ 12) = buyout amount. Often offered as 1.5-2× this amount as joining bonus.
- Fast-joining premium: Companies pay 10-15% extra for candidates joining within 30 vs 90 days.
- If candidate says "I have 3 months notice": Respond with "If you can negotiate it down to 30 days, I can add ₹X as an early joining bonus."

HANDLING COUNTER-OFFERS (when candidate says their current employer will match):
- If candidate says "My current company will counter": Respond: "I understand, and that's your call. But consider — why did you start looking? Counter-offers rarely address the root cause. We're offering [growth/scope/culture] that's different."
- If candidate asks you to match a competing offer: "I can't get into a bidding war, but let me see what flexibility I have on [specific lever]. What would make this a clear yes?"
- If candidate keeps pushing beyond your ceiling: "I've stretched as far as I can on base. Here's my best: ₹X CTC + ₹Y joining bonus + [benefits]. I'd need your decision by [date]."
- NEVER say "take it or leave it" — always offer a graceful path: "Take 48 hours. I genuinely want you on the team."${govNote}${relocNote}

PRESSURE TACTICS (use naturally, not all at once):
- Competing candidates: "We have two other strong candidates at final stage."
- Deadline: "We'd need your decision by end of this week."
- Budget ceiling: "This is at the top of our band for this level."
- Notice buyout: "If you can join within 30 days instead of 60, we can add ₹X as an early joining bonus."

THINGS TO NEGOTIATE BEYOND SALARY (bring these up if candidate only focuses on base):
- Joining bonus (one-time)
- Flexible/hybrid work policy
- Learning & development budget (₹50K-2 LPA/yr)
- Health insurance (family coverage upgrade)
- Relocation support
- Performance review timeline (6-month vs annual)
- Title/level adjustment

Example good: "We'd like to offer you ₹18 LPA — that's ₹14.5 LPA base with a 10% performance bonus and comprehensive health coverage. How does that compare with what you're looking at?"
Example bad: "We can offer $120,000." (wrong currency), "Tell me about a time you led a project." (behavioral, not negotiation), "We're offering 15% equity." (unrealistically high)`;
}

/**
 * Build compact salary context for experienceCalibration blocks.
 * Only injected for salary-negotiation and hr-round interview types.
 */
export function buildExperienceSalaryContext(params: SalaryLookupParams): string {
  if (!params.role && !params.company) return "";
  const ctx = lookupSalaryContext(params);
  return `\nSALARY CONTEXT (for reference in salary/compensation discussions):\n${ctx}`;
}
