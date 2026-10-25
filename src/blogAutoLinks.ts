import type { BlogPost } from "../data/blog-posts";

const COMPANY_SALARY_SLUG: Record<string, string> = {
  "TCS": "tcs", "Infosys": "infosys", "Wipro": "wipro", "HCL": "hcl",
  "Accenture": "accenture", "Cognizant": "cognizant", "Capgemini": "capgemini",
  "Tech Mahindra": "techmahindra", "Mphasis": "mphasis", "LTIMindtree": "ltimindtree",
  "ThoughtWorks": "thoughtworks",
  "Google": "google", "Amazon": "amazon", "Microsoft": "microsoft",
  "Meta": "meta", "Apple": "apple", "Netflix": "netflix",
  "Flipkart": "flipkart", "Swiggy": "swiggy", "Zomato": "zomato",
  "Razorpay": "razorpay", "PhonePe": "phonepe", "Paytm": "paytm",
  "CRED": "cred", "Meesho": "meesho", "Zepto": "zepto",
  "Zerodha": "zerodha", "Groww": "groww", "Upstox": "upstox",
  "Goldman Sachs": "goldman", "JP Morgan": "jpmorgan", "JPMorgan": "jpmorgan",
  "JPMorgan Chase": "jpmorgan", "Barclays": "barclays",
  "Deloitte": "deloitte", "McKinsey": "mckinsey", "BCG": "bcg", "Bain": "bain",
  "Adobe": "adobe", "Salesforce": "salesforce", "Oracle": "oracle",
  "IBM": "ibm", "SAP": "sap", "Atlassian": "atlassian",
  "Uber": "uber", "Airbnb": "airbnb", "Stripe": "stripe",
  "Postman": "postman", "BrowserStack": "browserstack",
  "Freshworks": "freshworks", "Zoho": "zoho", "Dream11": "dream11",
  "ShareChat": "sharechat", "MakeMyTrip": "makemytrip",
  "OYO": "oyo", "Blinkit": "blinkit", "Myntra": "myntra", "Nykaa": "nykaa",
  "Angel One": "angelone", "Bajaj Finance": "bajajfinance",
  "HDFC Bank": "hdfc", "ICICI Bank": "icici", "Axis Bank": "axis",
  "Nvidia": "nvidia", "Intel": "intel", "Qualcomm": "qualcomm",
  "Cisco": "cisco", "VMware": "vmware", "LinkedIn": "linkedin", "Walmart": "walmart",
  "Citadel": "citadel", "D.E. Shaw": "deshaw", "Optiver": "optiver",
  "Millennium": "millennium", "PayPal": "paypal",
  "PhysicsWallah": "physicswallah", "Vedantu": "vedantu", "Scaler": "scaler",
};

export function getAutoLinks(post: BlogPost): { label: string; href: string }[] {
  const links: { label: string; href: string }[] = [];
  const { category, company } = post;

  if (category === "Company Guides" && company && company !== "General") {
    const slug = COMPANY_SALARY_SLUG[company];
    links.push({ label: `${company} salary guide`, href: slug ? `/salary#${slug}` : "/salary" });
    links.push({ label: `Practice ${company} interview`, href: "/interview" });
    links.push({ label: "All company interview guides", href: "/companies" });
  }
  if (category === "Salary Guide") {
    links.push({ label: "All company salary guides", href: "/salary" });
    links.push({ label: "Practice salary negotiation", href: "/interview" });
  }
  if (category === "Technical") {
    links.push({ label: "Practice with AI mock interview", href: "/interview" });
    links.push({ label: "Compare company salaries", href: "/salary" });
    links.push({ label: "Interview preparation hub", href: "/interview-prep" });
  }
  if (category === "Career") {
    links.push({ label: "Practice for your next move", href: "/interview" });
    links.push({ label: "Know your market salary", href: "/salary" });
    links.push({ label: "Interview preparation hub", href: "/interview-prep" });
  }
  if (category === "Freshers") {
    links.push({ label: "Practice campus placement interviews", href: "/interview" });
    links.push({ label: "Fresher salary benchmarks", href: "/salary" });
    links.push({ label: "Campus placement preparation guide", href: "/for-students" });
  }
  if (category === "Behavioral") {
    links.push({ label: "Practice behavioral questions with AI", href: "/interview" });
    links.push({ label: "Interview question bank", href: "/questions" });
    links.push({ label: "Interview preparation hub", href: "/interview-prep" });
  }
  if (category === "Role Guides") {
    links.push({ label: "Practice role-specific questions", href: "/interview" });
    links.push({ label: "Salary benchmarks by role", href: "/salary" });
    links.push({ label: "Interview preparation hub", href: "/interview-prep" });
  }
  if (category === "Strategy" || category === "Interview Skills" || category === "Interview Tips") {
    links.push({ label: "Apply this in a live mock interview", href: "/interview" });
    links.push({ label: "Practice question bank", href: "/questions" });
    links.push({ label: "Interview preparation hub", href: "/interview-prep" });
  }
  if (category === "Industry Insights") {
    links.push({ label: "Company salary benchmarks", href: "/salary" });
    links.push({ label: "Practice industry interviews", href: "/interview" });
    links.push({ label: "All company interview guides", href: "/companies" });
  }
  if (category === "HR") {
    links.push({ label: "Practice HR round questions", href: "/interview" });
    links.push({ label: "Interview preparation hub", href: "/interview-prep" });
  }
  if (category === "Product") {
    links.push({ label: "Practice PM interviews", href: "/interview" });
    links.push({ label: "PM salary guide", href: "/salary" });
  }
  if (category === "Campus Placement") {
    links.push({ label: "Campus placement preparation guide", href: "/for-students" });
    links.push({ label: "Practice campus interviews", href: "/interview" });
  }

  return links;
}
