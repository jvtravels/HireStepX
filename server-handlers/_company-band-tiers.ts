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
  /* S46-B2 (2026-07-23): Quick-commerce players (Zepto, Blinkit, Dunzo, Instamart)
   * were in QCOM for sector classification but missing from UNICORN, so they fell
   * through to "sme" and received a ₹9-19L band — far below market. All major
   * quick-commerce operators are unicorn-scale; treat them as such for comp bands. */
  if (any(n, QCOM)) return "unicorn";
  if (any(n, IT_SERVICES)) return "it-services";
  if (any(n, CONSULTING)) return "consulting";
  if (any(n, BFSI)) return "bfsi";
  if (any(n, PHARMA)) return "pharma";
  if (any(n, PRODUCT_INDIA)) return "product-india";
  if (/(\blabs?\b|\bai\b|\bseed\b|\bstealth\b)/.test(n) || /\.(io|ai)\b/i.test(companyName)) return "startup";
  return "sme";
}

export interface RoleBand { floor: number; ceil: number; target: number }

/* Fix 2 (2026-05-15) — Role-family × tier band matrix.
 *
 * Real session: target = Customer Success Manager at Freshworks (product-
 * india tier), 5+ yrs. The legacy single-row engineering reference
 * anchored ₹34L; the actual Indian CSM market for that tier × YOE is
 * ₹12-17L. Reason: every role hit the same REFERENCE_5YR row regardless
 * of family.
 *
 * Eight role families with distinct 5-yr Indian-market anchors per tier.
 * Engineering retains the legacy numbers as the reference row; product
 * is slight premium; design / csm-cs / sales / data / marketing / ops
 * are calibrated against 2026 Indian-market data from offer scrapes. */
export type RoleFamily =
  | "engineering"
  | "product"
  | "design"
  | "csm-cs"
  | "sales"
  | "marketing"
  | "data"
  | "ops";

/** Classify a free-form role title into one of 8 families. Keyword-
 *  based; conservative; falls back to "engineering" for unknown
 *  technical titles. Pure. */
export function classifyRoleFamily(role: string | null | undefined): RoleFamily {
  const r = (role || "").toLowerCase().trim();
  if (!r) return "engineering";
  if (/\b(customer\s+success|cs\s+manager|csm|customer\s+experience|account\s+management|account\s+manager|client\s+success|client\s+partner|support\s+manager|technical\s+account\s+manager|tam)\b/.test(r)) return "csm-cs";
  if (/\b(product\s+manager|product\s+owner|pm\b|po\b|product\s+lead|head\s+of\s+product|group\s+product|tpm\b|program\s+manager|technical\s+program|chief\s+product)\b/.test(r)) return "product";
  if (/\b(ux\s+designer|ui\s+designer|product\s+designer|interaction\s+designer|visual\s+designer|graphic\s+designer|design\s+lead|design\s+manager|head\s+of\s+design|brand\s+designer|motion\s+designer|illustrator|ux\s+researcher|design\s+researcher)\b/.test(r)) return "design";
  if (/\b(sales|account\s+executive|ae\b|bdr|sdr|bdm|business\s+development|inside\s+sales|enterprise\s+sales|relationship\s+manager|sales\s+manager|sales\s+lead|sales\s+director|head\s+of\s+sales|chief\s+revenue|cro\b|territory\s+manager|key\s+account)\b/.test(r)) return "sales";
  if (/\b(marketing|growth|seo|sem|content\s+marketing|digital\s+marketing|brand\s+manager|product\s+marketing|pmm|marketing\s+manager|head\s+of\s+marketing|cmo\b|chief\s+marketing|community\s+manager|social\s+media\s+manager|demand\s+gen|email\s+marketing)\b/.test(r)) return "marketing";
  if (/\b(data\s+scientist|data\s+analyst|business\s+analyst|ba\b|analytics|machine\s+learning|ml\s+engineer|ai\s+engineer|data\s+engineer|nlp|research\s+scientist|quant|quantitative|statistician)\b/.test(r)) return "data";
  if (/\b(operations\s+manager|ops\s+manager|operations\s+lead|coo\b|chief\s+operating|supply\s+chain|logistics|fulfilment|fulfillment|warehouse\s+manager|city\s+manager|category\s+manager|head\s+of\s+operations|business\s+operations|biz\s+ops|biz-ops)\b/.test(r)) return "ops";
  /* Default to engineering for software / dev / SDE / SWE / java / react /
   * etc — the historical reference family. */
  return "engineering";
}

/** Reference table: 5-yr role-family × tier in INR LPA (Indian market 2026).
 *  Read it as: 8 families × 10 tiers = 80 cells. Engineering retains the
 *  legacy anchors (compatible with pre-Fix-2 tests). All other families
 *  calibrated against offer-scrape medians.
 *
 *  Freshworks (product-india) × csm-cs × 5yr → target ₹15L, floor ₹12L,
 *  ceil ₹20L (matches the real Indian-market spread). */
const FAMILY_TIER_REFERENCE_5YR: Record<RoleFamily, Record<CompanyTier, RoleBand>> = {
  engineering: {
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
  },
  product: {
    "it-services":    { floor: 12, ceil: 20, target: 16 },
    "product-india":  { floor: 22, ceil: 38, target: 28 },
    "gcc":            { floor: 25, ceil: 42, target: 32 },
    "unicorn":        { floor: 24, ceil: 45, target: 32 },
    "big-tech":       { floor: 40, ceil: 75, target: 55 },
    "bfsi":           { floor: 16, ceil: 28, target: 21 },
    "consulting":     { floor: 18, ceil: 32, target: 24 },
    "startup":        { floor: 16, ceil: 30, target: 22 },
    "sme":            { floor:  8, ceil: 16, target: 12 },
    "pharma":         { floor: 14, ceil: 24, target: 18 },
  },
  design: {
    "it-services":    { floor:  6, ceil: 12, target:  9 },
    "product-india":  { floor: 14, ceil: 26, target: 19 },
    "gcc":            { floor: 16, ceil: 28, target: 21 },
    "unicorn":        { floor: 14, ceil: 28, target: 20 },
    "big-tech":       { floor: 25, ceil: 50, target: 36 },
    "bfsi":           { floor:  9, ceil: 18, target: 13 },
    "consulting":     { floor: 10, ceil: 20, target: 14 },
    "startup":        { floor:  9, ceil: 20, target: 14 },
    "sme":            { floor:  5, ceil: 10, target:  7 },
    "pharma":         { floor:  7, ceil: 14, target: 10 },
  },
  "csm-cs": {
    "it-services":    { floor:  6, ceil: 11, target:  8 },
    "product-india":  { floor: 12, ceil: 20, target: 15 },
    "gcc":            { floor: 14, ceil: 24, target: 18 },
    "unicorn":        { floor: 12, ceil: 22, target: 16 },
    "big-tech":       { floor: 20, ceil: 38, target: 28 },
    "bfsi":           { floor:  9, ceil: 16, target: 12 },
    "consulting":     { floor: 10, ceil: 18, target: 13 },
    "startup":        { floor:  9, ceil: 18, target: 13 },
    "sme":            { floor:  5, ceil:  9, target:  7 },
    "pharma":         { floor:  7, ceil: 13, target: 10 },
  },
  sales: {
    "it-services":    { floor:  8, ceil: 18, target: 12 },
    "product-india":  { floor: 16, ceil: 32, target: 22 },
    "gcc":            { floor: 18, ceil: 34, target: 24 },
    "unicorn":        { floor: 16, ceil: 36, target: 24 },
    "big-tech":       { floor: 28, ceil: 60, target: 40 },
    "bfsi":           { floor: 10, ceil: 22, target: 15 },
    "consulting":     { floor: 14, ceil: 28, target: 20 },
    "startup":        { floor: 12, ceil: 26, target: 18 },
    "sme":            { floor:  6, ceil: 14, target:  9 },
    "pharma":         { floor:  9, ceil: 18, target: 13 },
  },
  marketing: {
    "it-services":    { floor:  7, ceil: 13, target: 10 },
    "product-india":  { floor: 14, ceil: 26, target: 19 },
    "gcc":            { floor: 15, ceil: 28, target: 20 },
    "unicorn":        { floor: 13, ceil: 26, target: 19 },
    "big-tech":       { floor: 22, ceil: 45, target: 32 },
    "bfsi":           { floor:  9, ceil: 17, target: 13 },
    "consulting":     { floor: 11, ceil: 22, target: 16 },
    "startup":        { floor:  9, ceil: 20, target: 14 },
    "sme":            { floor:  5, ceil: 10, target:  7 },
    "pharma":         { floor:  8, ceil: 15, target: 11 },
  },
  data: {
    "it-services":    { floor:  9, ceil: 16, target: 12 },
    "product-india":  { floor: 18, ceil: 32, target: 24 },
    "gcc":            { floor: 20, ceil: 36, target: 27 },
    "unicorn":        { floor: 18, ceil: 36, target: 26 },
    "big-tech":       { floor: 32, ceil: 60, target: 44 },
    "bfsi":           { floor: 12, ceil: 22, target: 16 },
    "consulting":     { floor: 14, ceil: 26, target: 19 },
    "startup":        { floor: 11, ceil: 22, target: 16 },
    "sme":            { floor:  6, ceil: 12, target:  9 },
    "pharma":         { floor:  9, ceil: 16, target: 12 },
  },
  ops: {
    "it-services":    { floor:  6, ceil: 12, target:  9 },
    "product-india":  { floor: 12, ceil: 22, target: 16 },
    "gcc":            { floor: 13, ceil: 24, target: 18 },
    "unicorn":        { floor: 12, ceil: 24, target: 17 },
    "big-tech":       { floor: 18, ceil: 36, target: 26 },
    "bfsi":           { floor:  9, ceil: 17, target: 12 },
    "consulting":     { floor: 10, ceil: 20, target: 14 },
    "startup":        { floor:  9, ceil: 18, target: 13 },
    "sme":            { floor:  5, ceil: 10, target:  7 },
    "pharma":         { floor:  7, ceil: 13, target: 10 },
  },
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
  if (/\b(staff|principal|architect)\b/.test(r)) return 1.3;
  if (/\b(senior|sr\.|lead)\b/.test(r)) return 1.15;
  if (/\b(intern|trainee)\b/.test(r)) return 0.35;
  return 1.0;
}

/* Title-implied YoE floor (2026-07-10, live staging — a Senior Product
 * Designer with no resume / text-only setup resolved to ₹8 / ₹11.5, a mid-IC
 * band). Root cause: when the caller has NO YoE, yoeScale() defaults to the
 * 5-yr mid anchor (1.0×), so a title that EXPLICITLY carries seniority only
 * ever received the flat roleModifier premium and none of the years-of-
 * experience lift a real senior commands. Holding a senior/lead/staff title
 * IS itself an experience floor — the same principle MANAGER_DEFAULT_YOE
 * already applies to people-managers. Fire ONLY when yoe is unknown so every
 * explicit-YoE caller and test is byte-identical; a supplied YoE always wins.
 * Ordered most-senior-first; representative Indian-market YoE per band. */
const TITLE_IMPLIED_YOE: Array<{ re: RegExp; yoe: number }> = [
  { re: /\b(staff|principal|architect|distinguished|fellow)\b/, yoe: 12 },
  { re: /\b(senior|sr\.?|lead)\b/, yoe: 8 },
];

function impliedYoeFromTitle(role: string): number | null {
  const r = (role || "").toLowerCase();
  for (const { re, yoe } of TITLE_IMPLIED_YOE) if (re.test(r)) return yoe;
  return null;
}

/** Compute (floor, ceil, target) LPA band for a (tier, role, yoe) tuple.
 *  Uses the role family × tier matrix (Fix 2, 2026-05-15). */
export function getBandForRole(
  tier: CompanyTier,
  role: string,
  yoe: number | null | undefined,
): RoleBand {
  const family = classifyRoleFamily(role);
  const base = FAMILY_TIER_REFERENCE_5YR[family][tier];
  /* When YoE is unknown, let a seniority-bearing title floor the effective
   * YoE (see TITLE_IMPLIED_YOE) instead of silently defaulting to the 5-yr
   * mid anchor. Explicit YoE always passes through untouched. */
  const effYoe =
    yoe == null || !Number.isFinite(yoe) ? impliedYoeFromTitle(role) ?? yoe : yoe;
  const m = yoeScale(effYoe) * roleModifier(role);
  return {
    floor: Math.round(base.floor * m * 10) / 10,
    ceil: Math.round(base.ceil * m * 10) / 10,
    target: Math.round(base.target * m * 10) / 10,
  };
}

/* People-management eng/tech titles (Engineering / Delivery / Group /
 * Dev / Software / Technical / Platform / Data / QA / SRE Manager, plus
 * the seniorised "Senior / General Manager"). Deliberately ENUMERATES the
 * management-bearing prefixes rather than matching a bare "manager" — that
 * keeps the IC "…Manager" titles that aren't people-managers in the Indian
 * market OUT (Product / Program / Project / Account / Community Manager).
 *
 * Moved here 2026-06-20 (#115 fast-follow) from _band-resolver so the
 * people-manager band floor has ONE definition shared by BOTH band-
 * resolution entry points — `resolveServerBand` (the negotiate-turn
 * kernel path) AND `generateNegotiationBand` (the generate-questions seed
 * path that the candidate's opening offer + prose are built from). The
 * lift previously lived only in resolveServerBand, so the generate-
 * questions path shipped an unlifted ₹19.4/₹25.6 lowball for a Flipkart
 * Engineering Manager. See liftPeopleManagerBand. */
export const PEOPLE_MANAGER_TITLE_RE =
  /\b(engineering|eng|software|development|dev|delivery|group|senior|sr\.?|general|technical|technology|platform|infrastructure|infra|data|qa|test|sre|site reliability|product\s+engineering)\s+manager\b/;

/** Representative YoE for a first-line people-manager when the caller has
 *  no resume / onboarding YoE. First-line eng managers in the Indian
 *  market typically sit at 9-13 YoE; 11 anchors the tier-table manager
 *  band without over-reaching into senior-EM / director territory. */
export const MANAGER_DEFAULT_YOE = 11;

/** Intern guard — never lift an "Engineering Manager Intern"-style title
 *  into the full-time manager band. Mirrors _band-resolver.isInternshipRole. */
const INTERN_TITLE_RE = /\b(intern|internship|intern[- ]?ship|summer intern|industrial trainee)\b/i;

/** People-manager band floor (#115) — the single source of truth for
 *  lifting a genuine people-management title UP to the calibrated tier-
 *  table manager band when the resolved band sits below it.
 *
 *  The legacy salary-lookup keys a people-management title (Engineering
 *  Manager) to a generic senior-IC company row and IGNORES seniority, so a
 *  Flipkart EM resolved to a senior-IC cap (~43.6, or a ₹25.6 company-
 *  override lowball) — well under the real first-line EM market. This lifts
 *  the ceil to the manager ceil and the opener up to (at most) the manager
 *  FLOOR (anchor-low opening preserved — we never open above the floor);
 *  the walk-away floor nudges up to stay coherent. One-way (never lowers),
 *  uses existing calibrated tier numbers (no invented values), and is a
 *  no-op for IC "…Manager" titles, intern titles, and bands already at or
 *  above the manager ceil. Pure given inputs. */
export function liftPeopleManagerBand(
  band: { initialOffer: number; maxStretch: number; walkAway: number },
  role: string,
  company: string | null | undefined,
  applicableYoe?: number | null,
): { initialOffer: number; maxStretch: number; walkAway: number } {
  if (!role || !company) return band;
  if (INTERN_TITLE_RE.test(role)) return band;
  if (!PEOPLE_MANAGER_TITLE_RE.test(role.toLowerCase())) return band;
  /* #117 (2026-06-21, live staging) — the manager band must be resolved at
   * AT LEAST the representative first-line-manager YoE. Holding a genuine
   * people-management title IS itself a seniority floor: a first-line EM
   * promoted only 4 years ago still commands the manager-grade market, not a
   * junior-IC band. Threading the candidate's raw applicableYoe straight into
   * getBandForRole let a low value (e.g. yoe=4, yoeScale 0.85) scale the
   * MANAGER floor DOWN — a Flipkart EM with applicableYoe=4 resolved to
   * 23.8/34/16.2 and the kernel CLOSED at ₹31.4L total, BELOW the candidate's
   * own ₹48L CTC and below the unlifted-null EM floor (₹32.7/₹56). Clamp the
   * lookup YoE to MANAGER_DEFAULT_YOE so applicableYoe can only ever lift the
   * manager band (a 15-yr senior EM still scales up), never sink it below the
   * first-line-EM floor. One source of truth — both resolveServerBand and the
   * generate-questions seed go through this helper. */
  const mgrYoe = Math.max(applicableYoe ?? MANAGER_DEFAULT_YOE, MANAGER_DEFAULT_YOE);
  const mgrBand = getBandForRole(classifyCompanyTier(company), role, mgrYoe);
  if (band.maxStretch >= mgrBand.ceil) return band;
  return {
    initialOffer: Math.max(band.initialOffer, mgrBand.floor),
    maxStretch: mgrBand.ceil,
    walkAway: Math.max(band.walkAway, Math.round(mgrBand.floor * 0.95 * 10) / 10),
  };
}

/* ─── Counter-offer risk: well-funded employers ─────────────────────
 *
 * Tier-1 ship (2026-05-15): when a candidate currently works at one of these
 * well-funded employers AND meets the other counter-offer-risk heuristics
 * (short tenure, target hike in the "just enough to beat" band, vague
 * competing offer), the recruiter should expect a retention counter from
 * the current employer to land within 2-3 weeks of resignation. The
 * negotiation move-picker uses this to choose firmer close-pressure and to
 * surface a written-offer commitment ask earlier. */
export const COUNTER_OFFER_RISK_EMPLOYERS: ReadonlySet<string> = new Set([
  "infosys", "tcs", "tata consultancy", "wipro", "hcl", "cognizant",
  "flipkart", "swiggy", "zomato", "phonepe", "razorpay", "paytm",
  "amazon", "microsoft", "google", "adobe", "salesforce",
  "walmart labs", "walmart", "jpmc", "jpmorgan", "goldman sachs", "wells fargo",
  "freshworks", "zoho",
]);

/** Returns true if companyName matches any well-funded employer known to
 *  actively counter-offer. Conservative substring match on normalized name. */
export function isCounterOfferRiskEmployer(companyName: string | null | undefined): boolean {
  if (!companyName) return false;
  const n = normalize(companyName);
  if (!n) return false;
  for (const e of COUNTER_OFFER_RISK_EMPLOYERS) {
    if (n.includes(e)) return true;
  }
  return false;
}

/* ─── Per-company hike caps ─────────────────────────────────────────
 *
 * Tier-3 ship (2026-05-15): in-house TA policy at large Indian employers
 * caps the % hike they'll authorize over current CTC, regardless of band.
 * Values are observed 2026 ceilings from offer-scrape data; null = unknown.
 * The kernel concession ceiling clamps to (currentCtc × (1 + cap/100))
 * when a cap is known and currentCtc is stated. */
export const COMPANY_HIKE_CAP_PCT: ReadonlyMap<string, number> = new Map([
  ["infosys", 30], ["tcs", 30], ["tata consultancy", 30], ["wipro", 30],
  ["hcl", 30], ["cognizant", 30], ["capgemini", 30],
  ["jpmc", 35], ["jpmorgan", 35], ["goldman sachs", 35], ["wells fargo", 30],
  ["citi", 35], ["walmart labs", 40],
  ["flipkart", 50], ["swiggy", 50], ["zomato", 50], ["phonepe", 50],
  ["razorpay", 50], ["freshworks", 35], ["zoho", 25],
  ["google", 40], ["microsoft", 40], ["amazon", 40], ["adobe", 35],
  ["salesforce", 35],
  ["mckinsey", 25], ["bain", 25],
  ["deloitte", 30], ["ey", 30], ["pwc", 30], ["kpmg", 30],
]);

/** Returns the per-company % hike cap if known, else null. Substring match
 *  on normalized name; longest-match wins to disambiguate "ge" vs "google". */
export function getCompanyHikeCap(companyName: string | null | undefined): number | null {
  if (!companyName) return null;
  const n = normalize(companyName);
  if (!n) return null;
  let best: { key: string; cap: number } | null = null;
  for (const [key, cap] of COMPANY_HIKE_CAP_PCT) {
    if (n.includes(key) && (best == null || key.length > best.key.length)) {
      best = { key, cap };
    }
  }
  return best?.cap ?? null;
}
