/* Per-tier × role salary bands for the Indian market.
 *
 * Why a second classifier alongside _company-tier.ts:
 *   _company-tier.ts collapses companies into 5 buckets driven by
 *   *interview voice* (service / product-india / product-global /
 *   startup / default). That bucketing is too coarse for *band
 *   anchoring* — Infosys and Accenture share an interview register
 *   but JPMC India (GCC) does not, and the bands move by ~2.5×
 *   across these. This module is the dedicated band-tier table:
 *   10 buckets keyed to median 2026 Indian-market salary anchors.
 *
 * The bug it fixes: real session anchored ₹22 LPA for an Infosys
 * React Dev (market for IT-services Reactjs 5 yrs is ₹8-14 LPA).
 * The legacy lookup pipeline drove the number from a generic SWE
 * band without applying an it-services tier discount. */

export type CompanyTier =
  | "big-tech"
  | "product-india"
  | "gcc"
  | "unicorn"
  | "it-services"
  | "consulting"
  | "bfsi"
  | "startup"
  | "sme"
  | "pharma";

const IT_SERVICES = [
  "infosys", "tcs", "tata consultancy", "wipro", "cognizant", "hcl",
  "tech mahindra", "capgemini", "ltimindtree", "lti", "mphasis",
  "accenture", "persistent", "mindtree", "hexaware", "coforge",
  "dxc", "ibm india", "ibm", "genpact", "birlasoft",
];
const BIG_TECH = [
  "google", "microsoft", "amazon", "meta", "facebook", "apple",
  "netflix", "uber", "adobe", "linkedin",
];
const GCC = [
  "walmart labs", "walmart", "target", "lowe's", "lowes",
  "jpmc", "jp morgan", "jpmorgan", "db", "deutsche bank",
  "morgan stanley", "ms gcc", "goldman sachs", "wells fargo",
  "citi", "barclays", "hsbc", "shell", "bp", "chevron",
  "honeywell", "ge", "ge india", "philips",
];
const UNICORN = [
  "flipkart", "swiggy", "zomato", "ola", "paytm", "phonepe",
  "razorpay", "cred", "urban company", "urbanclap", "meesho",
  "dream11", "byju", "byju's", "unacademy", "nykaa", "policybazaar",
  "lenskart", "delhivery", "groww", "upstox",
];
const PRODUCT_INDIA = [
  "zoho", "freshworks", "postman", "hasura", "browserstack",
  "chargebee", "darwinbox", "moengage", "icertis",
];
const CONSULTING = [
  "mckinsey", "bcg", "bain", "deloitte", "ey", "ernst & young",
  "kpmg", "pwc", "pricewaterhousecoopers", "accenture strategy",
];
const BFSI = [
  "hdfc", "icici", "sbi", "axis", "kotak", "idfc",
  "yes bank", "bandhan", "indusind", "federal bank", "rbl",
];
const PHARMA = [
  "sun pharma", "dr reddy", "dr reddy's", "cipla", "lupin",
  "biocon", "aurobindo", "torrent pharma", "glenmark",
];

function normalize(s: string): string {
  // Strip apostrophes (so "Lowe's" → "lowes") before collapsing other punctuation to spaces.
  return s.toLowerCase().replace(/['']/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function any(n: string, list: string[]): boolean {
  for (const t of list) if ((" " + n + " ").includes(" " + t + " ")) return true;
  return false;
}

/** Classify a company name into one of 10 band tiers. */
export function classifyCompanyTier(companyName: string | null | undefined): CompanyTier {
  if (!companyName) return "sme";
  const n = normalize(companyName);
  if (!n) return "sme";
  if (any(n, BIG_TECH)) return "big-tech";
  if (any(n, GCC)) return "gcc";
  if (any(n, UNICORN)) return "unicorn";
  if (any(n, IT_SERVICES)) return "it-services";
  if (any(n, CONSULTING)) return "consulting";
  if (any(n, BFSI)) return "bfsi";
  if (any(n, PHARMA)) return "pharma";
  if (any(n, PRODUCT_INDIA)) return "product-india";
  if (/(\blabs?\b|\bai\b|\bseed\b|\bstealth\b)/.test(n) || /\.(io|ai)\b/i.test(companyName)) return "startup";
  return "sme";
}

export interface RoleBand { floor: number; ceil: number; target: number }

/** Reference table: React Dev 5yr (= mid-level engineering, lateral).
 *  Other roles scale relative to this — for now we treat all engineering
 *  / data / design roles as one mid-level row. Sales/PM use a uniform
 *  +10% modifier (PM premium) or +0% (sales = base table).
 *  The key insight is the tier multipliers — a 5-yr SWE at Infosys vs
 *  Google vs Walmart Labs is ~₹11L / ₹48L / ₹28L, not flat. */
const REFERENCE_5YR: Record<CompanyTier, RoleBand> = {
  "it-services":    { floor:  8, ceil: 14, target: 11 },
  "product-india":  { floor: 18, ceil: 32, target: 24 },
  "gcc":            { floor: 22, ceil: 38, target: 28 },
  "unicorn":        { floor: 20, ceil: 40, target: 28 },
  "big-tech":       { floor: 35, ceil: 65, target: 48 },
  "bfsi":           { floor: 12, ceil: 22, target: 16 },
  "consulting":     { floor: 15, ceil: 28, target: 20 },
  "startup":        { floor: 12, ceil: 25, target: 18 },
  "sme":            { floor:  6, ceil: 12, target:  9 },
  "pharma":         { floor: 10, ceil: 18, target: 14 },
};

function yoeScale(yoe: number | null | undefined): number {
  const y = typeof yoe === "number" && Number.isFinite(yoe) ? yoe : 5;
  if (y < 2) return 0.6;
  if (y < 5) return 0.85;
  if (y <= 7) return 1.0;
  if (y <= 12) return 1.4;
  return 1.8;
}

function roleModifier(role: string): number {
  const r = (role || "").toLowerCase();
  if (/\b(product manager|pm|program manager|tpm)\b/.test(r)) return 1.1;
  if (/\b(staff|principal|architect)\b/.test(r)) return 1.3;
  if (/\b(senior|sr\.|lead)\b/.test(r)) return 1.15;
  if (/\b(intern|trainee)\b/.test(r)) return 0.35;
  return 1.0;
}

/** Compute (floor, ceil, target) LPA band for a (tier, role, yoe) tuple. */
export function getBandForRole(
  tier: CompanyTier,
  role: string,
  yoe: number | null | undefined,
): RoleBand {
  const base = REFERENCE_5YR[tier];
  const m = yoeScale(yoe) * roleModifier(role);
  return {
    floor: Math.round(base.floor * m * 10) / 10,
    ceil: Math.round(base.ceil * m * 10) / 10,
    target: Math.round(base.target * m * 10) / 10,
  };
}
