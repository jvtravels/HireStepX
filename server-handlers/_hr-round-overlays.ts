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

export type HrSectorOverlay = "services-tier1" | "product-unicorn" | "bfsi" | "none";
export type HrSeniorityOverlay = "fresher" | "mid" | "senior" | "executive";

const SERVICES_T1 = /tcs|tata consultancy|infosys|wipro|hcl|tech mahindra|cognizant|capgemini|accenture|ltimindtree|lti|mindtree|mphasis|hexaware|persistent/i;
const PRODUCT_UNICORN = /razorpay|phonepe|paytm|swiggy|zomato|meesho|cred|groww|zerodha|nykaa|udaan|dream11|policybazaar|byju'?s|unacademy|upgrad|postman|freshworks|chargebee|zoho|flipkart|myntra|ola/i;
const BFSI = /hdfc|icici|sbi|state bank|kotak|axis bank|bajaj (?:finserv|finance|allianz)|yes bank|indusind|standard chartered|hsbc|citi|deutsche|jp ?morgan|goldman|morgan stanley|barclays|aditya birla capital|tata aia|lic|max life|reliance (?:nippon|general)/i;

export function resolveHrSectorOverlay(companyName: string | null | undefined): HrSectorOverlay {
  const c = (companyName || "").trim();
  if (!c) return "none";
  if (SERVICES_T1.test(c)) return "services-tier1";
  if (BFSI.test(c)) return "bfsi";
  if (PRODUCT_UNICORN.test(c)) return "product-unicorn";
  return "none";
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
