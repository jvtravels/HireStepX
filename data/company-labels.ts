/* Canonical company display names — single source of truth.
 * Import { COMPANY_LABEL } wherever a human-readable name is needed.
 * When adding a new company to seo-pages, add it here too. */

export const COMPANY_LABEL: Record<string, string> = {
  // FAANG & global tech
  google: "Google",
  amazon: "Amazon",
  microsoft: "Microsoft",
  meta: "Meta",
  apple: "Apple",
  netflix: "Netflix",
  linkedin: "LinkedIn",
  adobe: "Adobe",
  uber: "Uber",
  atlassian: "Atlassian",
  stripe: "Stripe",
  salesforce: "Salesforce",
  cisco: "Cisco",
  oracle: "Oracle",
  nvidia: "NVIDIA",
  openai: "OpenAI",
  anthropic: "Anthropic",

  // Indian product & unicorns
  flipkart: "Flipkart",
  razorpay: "Razorpay",
  swiggy: "Swiggy",
  zomato: "Zomato",
  phonepe: "PhonePe",
  paytm: "Paytm",
  cred: "CRED",
  zerodha: "Zerodha",
  meesho: "Meesho",
  oyo: "OYO",
  freshworks: "Freshworks",
  zoho: "Zoho",
  sarvam: "Sarvam AI",

  // Service IT
  tcs: "TCS",
  infosys: "Infosys",
  wipro: "Wipro",
  cognizant: "Cognizant",
  accenture: "Accenture",
  ltimindtree: "LTIMindtree",
  hcl: "HCL",
  capgemini: "Capgemini",
  ibm: "IBM",
  techmahindra: "Tech Mahindra",
  mphasis: "Mphasis",

  // Consulting & finance
  mckinsey: "McKinsey",
  bcg: "BCG",
  bain: "Bain",
  deloitte: "Deloitte",
  goldman: "Goldman Sachs",
  jpmc: "JPMorgan Chase",
  "morgan-stanley": "Morgan Stanley",
  "jane-street": "Jane Street",
  "de-shaw": "DE Shaw",
  citadel: "Citadel",
  hdfc: "HDFC",
  icici: "ICICI",

  // FMCG / conglomerate
  hul: "HUL",
  "p&g": "P&G",
  itc: "ITC",

  // Generic fresher / campus prep pages
  campus: "Campus Interviews",

  // Government / PSU
  upsc: "UPSC",
  ssc: "SSC",
  ibps: "IBPS",
  rbi: "RBI",
  isro: "ISRO",
  drdo: "DRDO",
  ssb: "SSB",
};
