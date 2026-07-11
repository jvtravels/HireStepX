/* HR-round sector × seniority rubric overlays.
 *
 * A single HR rubric mis-grades real Indian rounds because the gate
 * looks different at different employer-types and seniority levels:
 *
 *   • IT services (TCS, Infosys, Wipro, HCL, LTI/Mindtree) — pedigree
 *     recital + bond/service-agreement comfort + NPS literacy carry
 *     real weight; comp transparency is less of a fight (bands are
 *     public).
 *   • Product unicorn (Razorpay, PhonePe, Swiggy, Zomato, Meesho) —
 *     stock literacy (ESOP vesting cliff, liquidity events, buyback
 *     cadence) and competing-offer transparency dominate; bond is
 *     rarely a thing.
 *   • BFSI (HDFC, ICICI, Kotak, SBI, Bajaj Finserv) — vintage
 *     (tenure ≥ 2yrs/role) and regulatory compliance (FEMA/RBI
 *     conduct, prior dismissals) weighted higher; comp upside is
 *     capped so motivation specificity is checked harder.
 *   • Fresher (0–2 YOE) — commitment-signal removed (counter-offers
 *     don't apply); fundamentals + learning-attitude carry weight.
 *   • Executive (12+ YOE / leadership) — commitment-signal doubled
 *     (drop-out risk highest at this level); motivation specificity
 *     dominates (why-this-mission must be exceptional).
 *
 * Resolution: caller passes (company, role, level); we pick at most
 * one sector overlay AND at most one seniority overlay, weighted-merge
 * onto the base recipe, renormalise to sum 1.00.
 */

import type { FocusRecipe } from "../data/focus-question-recipes";
import { hrCompanyNorms, type HrCompanyNorms } from "../data/hr-company-norms";

export type HrSectorOverlay =
  | "services-tier1"
  | "product-unicorn"
  | "bfsi"
  | "gcc"
  | "consulting"
  | "psu"
  | "none";
export type HrSeniorityOverlay = "fresher" | "mid" | "senior" | "executive";

const SERVICES_T1 = /tcs|tata consultancy|infosys|wipro|hcl|tech mahindra|cognizant|capgemini|accenture|ltimindtree|lti|mindtree|mphasis|hexaware|persistent/i;
const PRODUCT_UNICORN = /razorpay|phonepe|paytm|swiggy|zomato|meesho|cred|groww|zerodha|nykaa|udaan|dream11|policybazaar|byju'?s|unacademy|upgrad|postman|freshworks|chargebee|zoho|flipkart|myntra|ola/i;
const BFSI = /hdfc|icici|sbi|state bank|kotak|axis bank|bajaj (?:finserv|finance|allianz)|yes bank|indusind|standard chartered|hsbc|citi|deutsche|jp ?morgan|goldman|morgan stanley|barclays|aditya birla capital|tata aia|lic|max life|reliance (?:nippon|general)/i;
/* MNC captive / Global Capability Centres — parent-stock RSU literacy,
   global-standard BGV (criminal + education + prior-employment, sometimes
   sanctions screening), strict code-of-conduct on dual employment. */
const GCC = /walmart|google|alphabet|amazon|\baws\b|microsoft|\bidc\b|\bgcc\b|target corp|wells fargo|american express|\bamex\b|optum|unitedhealth|nvidia|\bintel\b|qualcomm|adobe|salesforce|sap labs|oracle|cisco|vmware|\bibm\b|\bdell\b|\bhp\b|\bhpe\b|shell|lowe'?s|tesco|mastercard|\bvisa inc|paypal|expedia|booking|uber|linkedin|meta|\bapple\b/i;
/* Strategy + Big-4 consulting — up-or-out narrative, client-conflict
   scrutiny, travel/utilisation expectations, variable-heavy comp.
   (Accenture stays services-tier1 by design — its India footprint is
   delivery-shaped, not partner-track consulting.) */
const CONSULTING = /mckinsey|bcg|boston consulting|\bbain\b|deloitte|\bey\b|ernst (?:&|and) young|\bkpmg\b|\bpwc\b|pricewaterhouse|kearney|oliver wyman|\bzs\b|zs associates|roland berger|alvarez (?:&|and) marsal|grant thornton|\bbcg\b/i;
/* Government / PSU / Maharatna-Navratna — fixed pay-scale (CPC), police
   verification + category/character certificates, dual employment barred
   by conduct rules, joining tied to allotment not a negotiated date. */
const PSU = /\bongc\b|\bntpc\b|\bsail\b|\bgail\b|\bbhel\b|\bhal\b|\bisro\b|\bdrdo\b|coal india|\bnabard\b|\brbi\b|\bbsnl\b|\bnhpc\b|\bpowergrid\b|power grid|indian oil|\biocl\b|\bbpcl\b|\bhpcl\b|\bnmdc\b|\becil\b|\bnpcil\b|railway|\birctc\b|public sector|\bpsu\b|ministry of|govt of|government of|\bupsc\b|\bibps\b/i;

export function resolveHrSectorOverlay(companyName: string | null | undefined): HrSectorOverlay {
  const c = (companyName || "").trim();
  if (!c) return "none";
  // Order matters only where patterns could overlap. Consulting and PSU are
  // checked before services/BFSI so a "Deloitte"/"RBI" match wins cleanly.
  if (CONSULTING.test(c)) return "consulting";
  if (PSU.test(c)) return "psu";
  if (SERVICES_T1.test(c)) return "services-tier1";
  if (BFSI.test(c)) return "bfsi";
  if (GCC.test(c)) return "gcc";
  if (PRODUCT_UNICORN.test(c)) return "product-unicorn";
  return "none";
}

/* Resolve the India HR norms (notice/BGV/comp/dual-employment) for a company by
   mapping it through the same sector taxonomy used for rubric weights. Returns
   null when no company is set or the sector is unrecognised, so callers fall
   back to generic guidance. HrSectorOverlay and HrNormSector share string keys
   by construction (see data/hr-company-norms.ts). */
export function resolveHrCompanyNorms(companyName: string | null | undefined): HrCompanyNorms | null {
  return hrCompanyNorms(resolveHrSectorOverlay(companyName));
}

export function resolveHrSeniorityOverlay(expLevel: string | null | undefined, yoe?: number | null): HrSeniorityOverlay {
  const n = typeof yoe === "number" ? yoe : NaN;
  if (!Number.isNaN(n)) {
    if (n <= 2) return "fresher";
    if (n >= 12) return "executive";
    if (n >= 7) return "senior";
    return "mid";
  }
  const e = (expLevel || "").toLowerCase();
  if (/fresher|intern|entry|campus|0-?2/.test(e)) return "fresher";
  if (/exec|director|vp|head|principal|staff\s*\+|sde-?(?:iv|v)|l[67]/.test(e)) return "executive";
  if (/senior|sde-?iii|lead|manager/.test(e)) return "senior";
  return "mid";
}

/* Multiplicative weight adjustments (1.0 = no change). Applied to base
 * rubric weights, then renormalised to sum 1.0. Conservative: only
 * dimensions where the overlay genuinely shifts the scoring lens. */
const SECTOR_MULTIPLIERS: Record<Exclude<HrSectorOverlay, "none">, Record<string, number>> = {
  "services-tier1": {
    "Compliance readiness": 1.4,    // bond, service agreement, marksheets are real
    "Benefits/policy literacy": 1.5, // NPS/EPF/bond knowledge expected
    "Comp transparency": 0.7,        // bands public, less of a fight
    "Motivation specificity": 0.9,
  },
  "product-unicorn": {
    "Comp transparency": 1.4,         // ESOP/RSU literacy, competing offer transparency
    "Benefits/policy literacy": 1.3,  // vesting cliff, liquidity, buyback
    "Commitment signal": 1.2,
    "Compliance readiness": 0.8,
  },
  "bfsi": {
    "Compliance readiness": 1.5,      // FEMA/RBI conduct, prior dismissals
    "Switch-rationale honesty": 1.3,  // vintage and tenure pattern matter
    "Motivation specificity": 1.2,    // why banking + role specificity
    "Comp transparency": 0.9,
  },
  "gcc": {
    "Comp transparency": 1.4,         // parent-stock RSU literacy, liquid equity
    "Compliance readiness": 1.3,      // global BGV: criminal + education + sanctions
    "Benefits/policy literacy": 1.2,  // RSU vest, ESPP, global benefits
    "Motivation specificity": 0.9,
  },
  "consulting": {
    "Motivation specificity": 1.4,    // "why consulting / why this firm" is the gate
    "Switch-rationale honesty": 1.3,  // up-or-out narrative, exit timing
    "Commitment signal": 1.2,         // travel/utilisation buy-in, offer-shopping risk
    "Comp transparency": 0.9,         // variable-heavy, bands well known
  },
  "psu": {
    "Compliance readiness": 1.6,      // police verification, category/character certs, medical
    "Comp transparency": 0.5,         // fixed CPC pay-scale — effectively non-negotiable
    "Motivation specificity": 1.3,    // "why public sector" carries real weight
    "Commitment signal": 1.2,         // long joining/allotment timelines, stability expected
  },
};

const SENIORITY_MULTIPLIERS: Record<HrSeniorityOverlay, Record<string, number>> = {
  fresher: {
    "Commitment signal": 0.3,
    "Comp transparency": 0.7,
    "Compliance readiness": 0.8,
    "Self-awareness": 1.4,
    "Motivation specificity": 1.3,
  },
  mid: {},
  senior: {
    "Commitment signal": 1.2,
    "Comp transparency": 1.1,
  },
  executive: {
    "Commitment signal": 2.0,        // drop-out risk highest here
    "Motivation specificity": 1.5,    // mission alignment dominates
    "Switch-rationale honesty": 1.3,
    "Self-awareness": 1.2,
  },
};

export interface HrRecipeContext {
  sector: HrSectorOverlay;
  seniority: HrSeniorityOverlay;
}

export function applyHrOverlays(base: FocusRecipe, ctx: HrRecipeContext): FocusRecipe {
  if (!base.scoringRubric) return base;
  const sectorMul = ctx.sector === "none" ? {} : SECTOR_MULTIPLIERS[ctx.sector];
  const seniorityMul = SENIORITY_MULTIPLIERS[ctx.seniority];
  const scaled = base.scoringRubric.map((r) => {
    const mul = (sectorMul[r.dimension] ?? 1) * (seniorityMul[r.dimension] ?? 1);
    return { ...r, weight: r.weight * mul };
  });
  const total = scaled.reduce((acc, r) => acc + r.weight, 0);
  const renormed = scaled.map((r) => ({ ...r, weight: total > 0 ? r.weight / total : r.weight }));
  return { ...base, scoringRubric: renormed };
}

export function resolveHrRoundRecipe(
  base: FocusRecipe,
  opts: { company?: string | null; expLevel?: string | null; yoe?: number | null },
): { recipe: FocusRecipe; context: HrRecipeContext } {
  const context: HrRecipeContext = {
    sector: resolveHrSectorOverlay(opts.company),
    seniority: resolveHrSeniorityOverlay(opts.expLevel, opts.yoe),
  };
  return { recipe: applyHrOverlays(base, context), context };
}
