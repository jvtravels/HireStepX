/* Peer groupings for /salary/[company] pages — used for both the
 * "compare with similar companies" cross-link rail and the peer-median
 * salary comparison. Kept as a standalone data file (rather than living
 * in the route file) so both the page component and the pure model
 * builder in _jsonld.ts can import it without a route-to-route import. */

export const SALARY_GROUPS: Record<string, string[]> = {
  "IT Services": ["tcs", "infosys", "wipro", "cognizant", "hcl", "capgemini", "ltimindtree", "accenture", "techmahindra", "mphasis", "persistent", "ibm", "ntt-data", "globallogic", "thoughtworks"],
  "Indian Fintech": ["razorpay", "phonepe", "paytm", "cred", "groww", "zerodha", "upstox", "angel-one", "bharatpe", "cashfree", "policybazaar", "navi", "slice", "jupiter", "fi-money", "indmoney", "smallcase", "juspay", "nium", "m2p-fintech", "khatabook", "zeta", "kreditbee", "moneyview", "fibe", "pine-labs", "rupeek", "niyo", "acko", "digit", "mobikwik"],
  "Indian Product & Unicorns": ["flipkart", "swiggy", "zomato", "meesho", "nykaa", "myntra", "dream11", "zepto", "blinkit", "oyo", "rapido", "lenskart", "mamaearth", "cars24", "shiprocket", "truecaller", "naukri", "scaler"],
  "Global Tech (FAANG+)": ["google", "amazon", "microsoft", "meta", "apple", "netflix", "uber", "oracle", "adobe", "atlassian", "salesforce", "stripe", "linkedin", "databricks", "openai", "servicenow", "workday", "anthropic", "airbnb", "twitter-x", "walmart-global-tech", "vmware", "paypal", "american-express", "mastercard", "visa-india", "intuit"],
  "Finance & Quant": ["goldman", "jpmc", "morgan-stanley", "barclays", "citi", "hsbc", "deutsche-bank", "wells-fargo", "standard-chartered", "bny-mellon", "tower-research", "jane-street", "de-shaw", "optiver", "millennium", "citadel"],
  "Indian Banking": ["hdfc-bank", "icici", "axis", "kotak", "sbi", "bajaj-finance", "star-health", "icici-lombard", "hdfc", "bajaj-finserv", "aditya-birla-capital"],
  "Consulting": ["deloitte", "mckinsey", "bcg", "bain", "ey", "kpmg", "pwc"],
  "Semiconductor & Hardware": ["qualcomm", "intel-india", "arm-india", "texas-instruments", "nvidia", "cisco", "mediatek", "sap-labs", "siemens-india", "bosch-india", "samsung-india", "ericsson-india", "nokia-india"],
  "Indian AI Startups": ["sarvam-ai", "krutrim", "perplexity", "glance"],
  "SaaS & Enterprise Software": ["freshworks", "zoho", "postman", "browserstack", "chargebee", "hasura", "mindtickle", "darwinbox", "capillary-tech", "clari", "sumologic", "icertis", "druva", "clevertap", "moengage", "gupshup", "exotel", "plivo", "sigmoid", "tracxn"],
  "EdTech": ["unacademy", "physicswallah", "byjus", "vedantu"],
  "Logistics & Quick Commerce": ["delhivery", "bigbasket", "shadowfax", "ecom-express", "blackbuck", "rivigo", "ninjacart", "country-delight", "yulu", "moglix", "udaan"],
  "Healthtech": ["tata-1mg", "dr-lal-pathlabs", "metropolis", "curefit", "practo", "apollo-247", "medibuddy", "fortis", "pharmeasy"],
  "Travel & Mobility": ["makemytrip", "ixigo", "ola", "ola-electric", "ather-energy", "spinny"],
  "Consumer & Conglomerates": ["hul", "itc", "godrej", "nestle", "dmart", "procter-gamble", "tata-motors", "mahindra", "tata-steel", "reliance-jio", "airtel", "vodafone-idea"],
  "D2C Consumer Brands": ["wakefit", "boat", "purplle", "licious", "rebel-foods"],
  "Global Retail & Enterprise GCCs": ["lowes-india", "target-india", "fiserv"],
  "Design Studios": ["bombay-design-centre", "lollypop-design-studio", "thence", "yellow-slice"],
  "Ad-tech & Media Platforms": ["sharechat", "inmobi", "dailyhunt"],
};

/* Reverse map: slug → group name */
export const SLUG_TO_GROUP: Record<string, string> = {};
for (const [group, slugs] of Object.entries(SALARY_GROUPS)) {
  for (const slug of slugs) {
    SLUG_TO_GROUP[slug] = group;
  }
}
