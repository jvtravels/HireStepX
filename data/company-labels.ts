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
  databricks: "Databricks",
  zepto: "Zepto",
  unacademy: "Unacademy",
  physicswallah: "PhysicsWallah",

  // Indian product & unicorns
  flipkart: "Flipkart",
  razorpay: "Razorpay",
  swiggy: "Swiggy",
  zomato: "Zomato",
  phonepe: "PhonePe",
  paytm: "Paytm",
  cred: "CRED",
  zerodha: "Zerodha",
  groww: "Groww",
  meesho: "Meesho",
  oyo: "OYO",
  nykaa: "Nykaa",
  myntra: "Myntra",
  dream11: "Dream11",
  rapido: "Rapido",
  freshworks: "Freshworks",
  zoho: "Zoho",
  sarvam: "Sarvam AI",
  "sarvam-ai": "Sarvam AI",
  optiver: "Optiver",
  millennium: "Millennium Management",
  barclays: "Barclays",
  upstox: "Upstox",
  "angel-one": "Angel One",
  "ola-electric": "Ola Electric",
  "ather-energy": "Ather Energy",
  blinkit: "Blinkit",

  intuit: "Intuit",
  "walmart-global-tech": "Walmart Global Tech",

  // Service IT
  tcs: "TCS",
  infosys: "Infosys",
  wipro: "Wipro",
  cognizant: "Cognizant",
  accenture: "Accenture",
  ltimindtree: "LTIMindtree",
  hcl: "HCL",
  persistent: "Persistent Systems",
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
  "morgan-stanley-india": "Morgan Stanley",
  "jane-street": "Jane Street",
  "de-shaw": "DE Shaw",
  "tower-research": "Tower Research Capital",
  citadel: "Citadel",
  hdfc: "HDFC",
  "hdfc-bank": "HDFC Bank",
  icici: "ICICI",

  // Enterprise tech GCCs
  qualcomm: "Qualcomm India",
  mediatek: "MediaTek India",
  servicenow: "ServiceNow India",
  workday: "Workday India",
  vmware: "VMware (Broadcom)",

  // Big 4 consulting
  ey: "EY India",
  kpmg: "KPMG India",
  pwc: "PwC India",

  // Banking GCCs
  axis: "Axis Bank",
  kotak: "Kotak Mahindra Bank",
  sbi: "State Bank of India",
  citi: "Citi India",
  hsbc: "HSBC India",
  "deutsche-bank": "Deutsche Bank India",

  // FinTech / InsurTech
  bharatpe: "BharatPe",
  cashfree: "Cashfree Payments",
  acko: "Acko Insurance",
  digit: "Go Digit Insurance",
  "pine-labs": "Pine Labs",
  "star-health": "Star Health Insurance",
  "icici-lombard": "ICICI Lombard",
  "bajaj-finance": "Bajaj Finance",
  bajaj: "Bajaj Finance",

  // D2C / Consumer
  lenskart: "Lenskart",
  mamaearth: "Mamaearth",
  boat: "boAt",
  wakefit: "Wakefit",
  dmart: "D-Mart",
  spinny: "Spinny",
  cars24: "CARS24",

  // Healthcare
  metropolis: "Metropolis Healthcare",
  curefit: "Cure.fit",
  "dr-lal-pathlabs": "Dr Lal PathLabs",
  "tata-1mg": "Tata 1mg",

  // Mobility / Auto
  ola: "Ola Cabs",
  "tata-motors": "Tata Motors",
  "tata-steel": "Tata Steel",
  mahindra: "Mahindra Group",

  // EdTech
  byjus: "BYJU'S",

  // FMCG
  godrej: "Godrej Group",
  nestle: "Nestlé India",
  "procter-gamble": "P&G India",

  // Indian B2B SaaS
  postman: "Postman",
  browserstack: "BrowserStack",
  chargebee: "Chargebee",

  // Travel tech
  makemytrip: "MakeMyTrip",
  ixigo: "ixigo",

  // AI search
  perplexity: "Perplexity",
  krutrim: "Krutrim",

  // Banking GCCs
  "wells-fargo": "Wells Fargo India",

  // Logistics
  delhivery: "Delhivery",

  // Grocery / retail
  bigbasket: "BigBasket",

  // FMCG / conglomerate
  hul: "HUL",
  "p&g": "P&G",
  itc: "ITC",

  // Wave 14: GCCs + FinServ + remaining
  "lowes-india": "Lowe's India (GCC)",
  "target-india": "Target India (TCI)",
  "bny-mellon": "BNY Mellon Technology",
  "standard-chartered": "Standard Chartered GBS India",
  mastercard: "Mastercard Technology India",
  "visa-india": "Visa India",
  fiserv: "Fiserv India",
  // Generic fresher / campus prep pages
  campus: "Campus Interviews",

  // Wave 11: Enterprise GCCs
  "sap-labs": "SAP Labs India",
  "siemens-india": "Siemens India",
  "bosch-india": "Bosch India (BGSW)",
  "texas-instruments": "Texas Instruments India",
  "intel-india": "Intel India",
  "arm-india": "ARM Holdings India",
  thoughtworks: "Thoughtworks",
  "samsung-india": "Samsung R&D India",
  samsung: "Samsung R&D India",
  "ericsson-india": "Ericsson India",
  "nokia-india": "Nokia India",
  "ntt-data": "NTT Data India",
  globallogic: "GlobalLogic",

  // Wave 12: Indian FinTech / Neo-banks
  juspay: "Juspay",
  slice: "Slice",
  jupiter: "Jupiter Money",
  "fi-money": "Fi Money",
  policybazaar: "PolicyBazaar",
  nium: "Nium",
  "m2p-fintech": "M2P Fintech",
  khatabook: "Khatabook",
  smallcase: "smallcase",
  zeta: "Zeta Tech",
  navi: "Navi Technologies",
  kreditbee: "KreditBee",
  moneyview: "MoneyView",
  fibe: "Fibe",
  sharechat: "ShareChat",
  scaler: "Scaler Academy",
  moengage: "MoEngage",
  clevertap: "CleverTap",
  druva: "Druva",
  darwinbox: "Darwinbox",
  truecaller: "Truecaller",
  inmobi: "InMobi",
  naukri: "Naukri (Info Edge)",

  // Wave 13: More Startups / SaaS / Healthtech
  practo: "Practo",
  shiprocket: "Shiprocket",
  udaan: "Udaan",
  moglix: "Moglix",
  ninjacart: "Ninjacart",
  licious: "Licious",
  vedantu: "Vedantu",
  "rebel-foods": "Rebel Foods",
  purplle: "Purplle",
  blackbuck: "BlackBuck (Zinka)",
  shadowfax: "Shadowfax",
  hasura: "Hasura",
  gupshup: "Gupshup",
  exotel: "Exotel",
  "capillary-tech": "Capillary Technologies",
  plivo: "Plivo",
  indmoney: "INDmoney",
  rupeek: "Rupeek",
  niyo: "Niyo Solutions",
  "apollo-247": "Apollo 24/7",
  "ecom-express": "Ecom Express",
  yulu: "Yulu",
  sigmoid: "Sigmoid",
  mindtickle: "Mindtickle",
  medibuddy: "MediBuddy",
  tracxn: "Tracxn",
  "country-delight": "Country Delight",
  rivigo: "Rivigo",
  sumologic: "Sumo Logic",
  clari: "Clari",

  // Government / PSU
  upsc: "UPSC",
  ssc: "SSC",
  ibps: "IBPS",
  rbi: "RBI",
  isro: "ISRO",
  drdo: "DRDO",
  ssb: "SSB",
};
