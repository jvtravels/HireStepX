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
  /* Wave-7 expansion. */
  "ltts", "l t technology", "kpit", "cyient", "sonata", "nseit",
  "happiest minds", "zensar", "tata elxsi", "tata technologies",
  "nagarro", "globant", "epam", "thoughtworks", "infogain",
  "marlabs", "virtusa", "incedo", "mastek", "syntel",
];
const BIG_TECH = [
  "google", "microsoft", "amazon", "meta", "facebook", "apple",
  "netflix", "uber", "adobe", "linkedin",
  /* Wave-7. */
  "salesforce", "oracle", "intuit", "atlassian", "stripe",
  "snowflake", "databricks", "nvidia", "intel", "qualcomm",
  "samsung r&d", "samsung india", "vmware",
];
const GCC = [
  "walmart labs", "walmart", "target", "lowe's", "lowes",
  "jpmc", "jp morgan", "jpmorgan", "db", "deutsche bank",
  "morgan stanley", "ms gcc", "goldman sachs", "wells fargo",
  "citi", "barclays", "hsbc", "shell", "bp", "chevron",
  "honeywell", "ge", "ge india", "philips",
  /* Wave-7 — expanded captive / GCC roster. */
  "tesco", "lowes india", "macys", "macy's", "kroger",
  "bank of america", "bofa", "rbs", "natwest", "ubs",
  "credit suisse", "nomura", "society generale", "socgen",
  "standard chartered", "anz", "fidelity", "blackrock",
  "boeing india", "airbus india", "rolls royce india",
  "schlumberger", "halliburton", "exxonmobil", "totalenergies",
  "siemens healthineers", "abb india", "bosch", "continental",
  "sap labs", "sap india", "dell india", "hp india", "cisco india",
];
const UNICORN = [
  "flipkart", "swiggy", "zomato", "ola", "paytm", "phonepe",
  "razorpay", "cred", "urban company", "urbanclap", "meesho",
  "dream11", "byju", "byju's", "unacademy", "nykaa", "policybazaar",
  "lenskart", "delhivery", "groww", "upstox",
  /* Wave-7. */
  "rapido", "porter", "shiprocket", "boat", "mamaearth",
  "purplle", "myntra", "ixigo", "yatra", "redbus",
  "snapdeal", "khatabook", "okcredit", "vedantu",
  "physicswallah", "leetcode india", "scaler", "interview kickstart",
  "zerodha", "coindcx", "coinswitch", "wazirx", "polygon",
];
const PRODUCT_INDIA = [
  "zoho", "freshworks", "postman", "hasura", "browserstack",
  "chargebee", "darwinbox", "moengage", "icertis",
  /* Wave-7. */
  "fivetran india", "rippling india", "highspot", "amagi",
  "innovaccer", "mindtickle", "clevertap",
  "whatfix", "uniphore", "yellow.ai", "haptik",
];
const CONSULTING = [
  "mckinsey", "bcg", "bain", "deloitte", "ey", "ernst & young",
  "kpmg", "pwc", "pricewaterhousecoopers", "accenture strategy",
  /* Wave-7. */
  "kearney", "at kearney", "oliver wyman", "roland berger",
  "mercer", "willis towers watson", "korn ferry", "aon",
  "zs associates", "zs", "parthenon", "alvarez marsal",
];
const BFSI = [
  "hdfc", "icici", "sbi", "axis", "kotak", "idfc",
  "yes bank", "bandhan", "indusind", "federal bank", "rbl",
  /* Wave-7 — expanded BFSI. */
  "pnb", "punjab national", "boi", "bank of india", "union bank",
  "canara bank", "iob", "indian overseas", "central bank of india",
  "lic", "life insurance corporation", "gic", "bajaj finserv",
  "bajaj allianz", "sbi life", "max life", "tata aig",
  "icici prudential", "hdfc life", "reliance general",
  "muthoot", "manappuram", "shriram finance", "cholamandalam",
];
const PHARMA = [
  "sun pharma", "dr reddy", "dr reddy's", "cipla", "lupin",
  "biocon", "aurobindo", "torrent pharma", "glenmark",
  /* Wave-7. */
  "zydus", "cadila", "alkem", "piramal", "intas", "mankind",
  "abbott india", "pfizer india", "gsk india", "novartis india",
  "sanofi india", "roche india", "merck india", "astrazeneca india",
  "syngene", "biocon biologics", "wockhardt", "ipca",
];

function normalize(s: string): string {
  // Strip apostrophes (so "Lowe's" → "lowes") before collapsing other punctuation to spaces.
  return s.toLowerCase().replace(/['']/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function any(n: string, list: string[]): boolean {
  for (const t of list) if ((" " + n + " ").includes(" " + t + " ")) return true;
  return false;
}

/* ─── Wave-7 (2026-05-15) — sector classifier ──────────────────────────
 *
 * Independent of the comp tier, the SECTOR string surfaces a richer
 * vertical context the recruiter prompt can route on (edtech voice,
 * EV voice, space-tech band, etc.). This is a separate classifier from
 * `classifyCompanyTier` because the tier is about comp anchoring and
 * the sector is about voice / domain-specific levers. Pure. */
export type CompanySector =
  | "edtech"
  | "ev-mobility"
  | "space-tech"
  | "defence"
  | "web3-crypto"
  | "psu-defence-aero"
  | "fintech-lending"
  | "fintech-payments"
  | "fintech-wealth"
  | "fintech-neobank"
  | "fintech-insurtech"
  | "core-engineering"
  | "quick-commerce"
  | null;

const EDTECH = [
  "byju", "byjus", "vedantu", "unacademy", "extramarks", "whitehat",
  "toppr", "simplilearn", "upgrad", "cuemath", "doubtnut",
  "physicswallah", "scaler", "interview kickstart", "great learning",
];
const EV_MOBILITY = [
  "ather", "ola electric", "ultraviolette", "exponent energy",
  "battery smart", "log9", "euler motors", "tork motors",
  "ampere", "revolt", "okinawa", "hero electric",
];
const SPACE_TECH = [
  "skyroot", "agnikul", "pixxel", "dhruva space",
  "bellatrix", "satellize", "kawa space", "digantara",
];
const DEFENCE = [
  "tonbo", "ideaforge", "newspace", "alpha design",
  "optimized electrotech", "paras defence", "bharat forge defence",
];
const WEB3 = [
  "polygon labs", "polygon", "coindcx", "wazirx", "coinswitch",
  "crypto offshore", "dubai web3", "singapore web3",
];
const PSU = [
  "indian oil", "ongc", "bhel", "bel", "hal", "drdo",
  "sail", "gail", "coal india", "ntpc", "nhpc", "powergrid",
  "ircon", "nbcc", "rites", "dmrc",
];
const FINTECH_LENDING = ["lendingkart", "kissht", "kreditbee", "moneyview", "navi", "indiagold"];
const FINTECH_PAYMENTS = ["razorpay", "paytm", "phonepe", "billdesk", "pine labs", "mswipe"];
const FINTECH_WEALTH = ["groww", "upstox", "zerodha", "smallcase", "indmoney", "kuvera"];
const FINTECH_NEOBANK = ["jupiter", "fi money", "niyo", "open money", "freo"];
const FINTECH_INSURTECH = ["acko", "digit insurance", "policybazaar", "turtlemint", "renewbuy"];
const CORE_ENG = [
  "l t", "larsen", "siemens india", "abb india", "thermax",
  "cummins india", "kirloskar", "bhel", "tata steel", "jsw steel",
];
const QCOM = [
  "zepto", "instamart", "blinkit", "swiggy instamart",
  "dunzo daily", "getfresh", "fraazo", "bb now", "bigbasket now",
];

/** Classify a company name into a vertical-sector bucket (or null). */
export function classifyCompanySector(
  companyName: string | null | undefined,
): CompanySector {
  if (!companyName) return null;
  const n = normalize(companyName);
  if (!n) return null;
  if (any(n, EDTECH)) return "edtech";
  if (any(n, EV_MOBILITY)) return "ev-mobility";
  if (any(n, SPACE_TECH)) return "space-tech";
  if (any(n, DEFENCE)) return "defence";
  if (any(n, WEB3)) return "web3-crypto";
  if (any(n, PSU)) return "psu-defence-aero";
  if (any(n, FINTECH_LENDING)) return "fintech-lending";
  if (any(n, FINTECH_PAYMENTS)) return "fintech-payments";
  if (any(n, FINTECH_WEALTH)) return "fintech-wealth";
  if (any(n, FINTECH_NEOBANK)) return "fintech-neobank";
  if (any(n, FINTECH_INSURTECH)) return "fintech-insurtech";
  if (any(n, QCOM)) return "quick-commerce";
  if (any(n, CORE_ENG)) return "core-engineering";
  return null;
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
