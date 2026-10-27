import type { Metadata } from "next";
import ConsentGatedAdSense from "../../ConsentGatedAdSense";
import { SEO_PAGES } from "../../../data/seo-pages";
import { breadcrumb, ldJson } from "@/marketing-v2/_schema";
import { HubTemplate, type HubSection } from "@/home2/HubTemplate";
import { questionHref } from "../../../src/seoLinks";

/* /companies — index / hub page listing all 55+ company interview
 * question sets, grouped by company type.
 *
 * Job: act as the internal linking hub for the entire
 * /companies/[slug] tree. Every anchor from this page is a PageRank
 * signal for the leaf pages. Also targets "company interview
 * questions India 2026" head terms directly.
 *
 * Schema: ItemList (one ListItem per company group) + BreadcrumbList
 */

export const revalidate = 86400;

/* GSC: this page's title had no concrete figure in it — same pattern that
   measurably hurt CTR on /questions and the narrow-roster /salary pages
   before those got a real number added (see their generateMetadata
   comments). Reuse the same fix here with the actual indexed company count. */
const totalCompanies = new Set(SEO_PAGES.map((p) => p.company)).size;

/* ?page=N renders a real, separately-crawlable subset of the company
   directory (see companyPageHref below), but alternates.canonical always
   points back to plain /companies — same self-canonical-but-not-noindexed
   gap as /questions and /salary (see their generateMetadata comments).
   Without a matching noindex, Google is free to index each page of the
   directory separately, which is the thin/duplicate-URL pattern behind
   the AdSense "Low value content" flag. */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}): Promise<Metadata> {
  const { page } = await searchParams;
  const pageNum = Math.max(1, parseInt(page ?? "1", 10) || 1);

  const title = `${totalCompanies} Company Interview Questions India 2026 | HireStepX`;
  const ogTitle = `${totalCompanies} Company Interview Questions — India 2026`;

  return {
    title,
    description:
      `Interview questions for ${totalCompanies} companies in India, including TCS, Infosys, Google, Amazon, Flipkart, and Razorpay. Practice with AI voice mock interviews.`,
    keywords: [
      "company interview questions India",
      "TCS interview questions 2026",
      "Google interview questions India",
      "Amazon interview questions India",
      "Flipkart interview questions",
      "interview questions all companies India",
    ].join(", "),
    alternates: { canonical: "/companies" },
    ...(pageNum === 1 ? {} : { robots: { index: false, follow: true } }),
    openGraph: {
      type: "website",
      title: ogTitle,
      description: `Practice guides for ${totalCompanies} companies: AI voice mock interviews available free.`,
      url: "https://hirestepx.com/companies",
      siteName: "HireStepX",
      locale: "en_IN",
      images: [{ url: "https://hirestepx.com/opengraph-image", width: 1200, height: 630, alt: "HireStepX Company Interview Questions" }],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: `Practice guides for ${totalCompanies} companies: AI voice mock interviews available free.`,
      images: ["https://hirestepx.com/opengraph-image"],
    },
  };
}

/* ── Label maps ─────────────────────────────────────────────────────── */

const FOCUS_LABEL: Record<string, string> = {
  behavioral: "Behavioural", technical: "Technical", "system-design": "System Design",
  "case-study": "Case Study", "campus-placement": "Campus Placement",
  hr: "HR Round", "salary-negotiation": "Salary Negotiation",
  management: "Management", "government-psu": "Govt / PSU", strategic: "Strategic",
  general: "General", leadership: "Leadership", panel: "Panel", quant: "Quant",
};

/* ── Company groupings ──────────────────────────────────────────────── */
type GroupDef = { id: string; label: string; description: string; companies: string[] };

const GROUPS: GroupDef[] = [
  {
    id: "service-it",
    label: "Service IT",
    description: "India's largest employers. TCS, Infosys, and Wipro alone hire tens of thousands of freshers in a typical year. Focus: aptitude, CS fundamentals, HR.",
    companies: ["tcs", "infosys", "wipro", "cognizant", "accenture", "ltimindtree", "hcl", "capgemini", "ibm", "techmahindra", "mphasis", "persistent", "ntt-data", "globallogic", "thoughtworks"],
  },
  {
    id: "indian-product",
    label: "Indian Product",
    description: "Fast-scaling unicorns and product-first startups. Higher pay, harder interviews, more ownership.",
    companies: ["flipkart", "razorpay", "swiggy", "zomato", "phonepe", "paytm", "cred", "zerodha", "meesho", "oyo", "freshworks", "zoho", "nykaa", "mamaearth", "myntra", "bigbasket", "blinkit", "makemytrip", "ixigo", "dream11", "lenskart", "boat", "naukri", "sharechat", "truecaller", "groww", "dmart", "wakefit", "zepto", "udaan"],
  },
  {
    id: "faang",
    label: "FAANG & Global Tech",
    description: "The highest bar in the industry. 3–6 months of preparation needed for a competitive shot.",
    companies: ["google", "amazon", "microsoft", "meta", "apple", "netflix", "linkedin", "adobe", "uber", "stripe", "salesforce", "atlassian", "workday", "servicenow", "vmware", "nvidia", "openai", "anthropic", "perplexity", "postman", "chargebee", "clevertap", "moengage", "inmobi", "druva", "browserstack", "darwinbox"],
  },
  {
    id: "consulting-finance",
    label: "Consulting & Finance",
    description: "Case-study driven hiring with a completely different evaluation framework from tech.",
    companies: ["mckinsey", "bcg", "bain", "deloitte", "goldman", "jpmc", "ey", "kpmg", "pwc"],
  },
  {
    id: "fintech",
    label: "Fintech & WealthTech",
    description: "India's fastest-growing hiring segment. Payments APIs, lending platforms, wealthtech, and neo-banking.",
    companies: ["bajaj-finance", "fibe", "kreditbee", "moneyview", "rupeek", "fi-money", "niyo", "smallcase", "indmoney", "zeta", "nium", "upstox", "angel-one", "jupiter", "navi", "slice", "cashfree", "juspay", "pine-labs", "bharatpe", "acko", "policybazaar", "icici-lombard", "digit"],
  },
  {
    id: "banking",
    label: "Banking & Financial Services",
    description: "Indian private banks, global investment banks, and payments networks.",
    companies: ["hdfc-bank", "icici", "hdfc", "axis", "kotak", "sbi", "barclays", "hsbc", "citi", "deutsche-bank", "bny-mellon", "standard-chartered", "wells-fargo", "morgan-stanley", "mastercard", "visa-india", "fiserv"],
  },
  {
    id: "semiconductor",
    label: "Semiconductor & GCCs",
    description: "Chip design, embedded systems, and large enterprise tech Global Capability Centers.",
    companies: ["intel-india", "qualcomm", "arm-india", "mediatek", "bosch-india", "texas-instruments", "samsung", "samsung-india", "nvidia", "ericsson-india", "nokia-india", "cisco", "oracle", "sap-labs", "siemens-india", "walmart-global-tech", "lowes-india", "target-india"],
  },
  {
    id: "healthcare",
    label: "Healthcare & Diagnostics",
    description: "Health tech platforms at the intersection of clinical data and consumer software.",
    companies: ["apollo-247", "practo", "medibuddy", "tata-1mg", "dr-lal-pathlabs", "metropolis", "star-health", "curefit"],
  },
  {
    id: "logistics",
    label: "Logistics & Quick Commerce",
    description: "India's delivery infrastructure. Real-time systems, routing, and warehouse tech at national scale.",
    companies: ["delhivery", "shadowfax", "shiprocket", "rapido", "blackbuck", "moglix", "ninjacart"],
  },
  {
    id: "edtech",
    label: "EdTech & Skilling",
    description: "Built for India's 300M+ student population. Mobile-first learning at low bandwidth.",
    companies: ["scaler", "vedantu", "unacademy", "byjus", "physicswallah"],
  },
  {
    id: "d2c",
    label: "D2C & Consumer Brands",
    description: "Century-old FMCG giants and digital-native D2C brands hiring tech and analytics talent.",
    companies: ["godrej", "nestle", "hul", "itc", "p&g", "tata-steel", "purplle", "licious", "rebel-foods"],
  },
  {
    id: "ev",
    label: "EV & Mobility",
    description: "India's EV transition driving demand for embedded software and platform engineering.",
    companies: ["ola-electric", "ather-energy", "ola", "cars24", "spinny", "tata-motors", "mahindra", "bajaj"],
  },
  {
    id: "saas",
    label: "B2B SaaS & Dev Tools",
    description: "Global-from-day-one product companies built out of India, with high engineering culture and strong product sense.",
    companies: ["hasura", "gupshup", "exotel", "plivo", "intuit", "mindtickle", "sigmoid", "tracxn", "khatabook", "krutrim", "sarvam"],
  },
  {
    id: "quant",
    label: "Quant & Algo Trading",
    description: "The highest-paying roles in finance. Elite math, coding, and probability under time pressure.",
    companies: ["optiver", "millennium", "jane-street", "de-shaw", "citadel"],
  },
  {
    id: "campus-freshers",
    label: "Campus & Freshers",
    description: "HR round questions that appear in 95%+ of Indian campus drives, with structured answer frameworks for freshers.",
    companies: ["campus"],
  },
];

const GROUPS_PER_PAGE = 30;

export default async function CompaniesIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { headers } = await import("next/headers");
  const nonce = (await headers()).get("x-nonce") ?? "";
  const { page } = await searchParams;
  const pageNum = Math.max(1, parseInt(page ?? "1", 10) || 1);

  /* ── Flatten + paginate the 15 groups — same 30-per-page cap used on
     /questions and /interview-prep, so no single page load ever renders
     more than 30 company cards no matter how large a group is. */
  const groupsWithPages = GROUPS.map((g) => ({
    ...g,
    pages: [...SEO_PAGES.filter((p) => g.companies.includes(p.company))].sort(
      (a, b) => (b.sitemapPriority ?? 0.7) - (a.sitemapPriority ?? 0.7),
    ),
  })).filter((g) => g.pages.length > 0);

  const flat = groupsWithPages.flatMap((g) => g.pages.map((p) => ({ p, id: g.id })));
  const totalCompanyPages = Math.max(1, Math.ceil(flat.length / GROUPS_PER_PAGE));
  const safePage = Math.min(Math.max(1, pageNum), totalCompanyPages);
  const pageSlice = flat.slice((safePage - 1) * GROUPS_PER_PAGE, safePage * GROUPS_PER_PAGE);

  const groupAbsStart: Record<string, number> = {};
  let cursor = 0;
  for (const g of groupsWithPages) {
    groupAbsStart[g.id] = cursor;
    cursor += g.pages.length;
  }
  const groupStartPage = (id: string) => Math.floor(groupAbsStart[id] / GROUPS_PER_PAGE) + 1;
  const companyPageHref = (p: number, anchor?: string) => {
    const qs = p > 1 ? `?page=${p}` : "";
    return `/companies${qs}${anchor ? `#${anchor}` : ""}`;
  };

  const sections: { id: string; pages: typeof SEO_PAGES }[] = [];
  for (const item of pageSlice) {
    const last = sections[sections.length - 1];
    if (last && last.id === item.id) last.pages.push(item.p);
    else sections.push({ id: item.id, pages: [item.p] });
  }
  const globalStartOfPage = (safePage - 1) * GROUPS_PER_PAGE;

  /* ItemList schema — one ListItem per company group */
  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Company Interview Questions: India 2026",
    description: "Curated interview preparation guides for 200+ companies hiring in India",
    numberOfItems: SEO_PAGES.length,
    itemListElement: GROUPS.map((g, gi) => ({
      "@type": "ListItem",
      position: gi + 1,
      name: g.label,
      description: g.description,
      url: `https://hirestepx.com/companies#${g.id}`,
    })),
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      { "@type": "Question", name: "Which companies hire the most freshers in India?", acceptedAnswer: { "@type": "Answer", text: "TCS, Infosys, Wipro, Cognizant, and Accenture collectively hire over 150,000 freshers per year in India. Their interviews focus on aptitude, basic data structures, and HR rounds, with less emphasis on competitive coding than product companies like Flipkart or Razorpay." } },
      { "@type": "Question", name: "How different is a FAANG interview from a Service IT interview?", acceptedAnswer: { "@type": "Answer", text: "Service IT interviews (TCS, Infosys) are primarily aptitude tests, verbal ability, and one or two HR rounds. FAANG interviews (Google, Amazon, Microsoft) require 3–5 rounds of competitive DSA, system design, and behavioral interviews. Most candidates need 3–6 months of dedicated preparation for FAANG." } },
      { "@type": "Question", name: "What is the typical interview process at Indian product companies like Razorpay or Zerodha?", acceptedAnswer: { "@type": "Answer", text: "Indian product companies typically have 4–6 rounds: an online coding assessment, 1–2 DSA rounds, a system design round, an engineering manager round, and an HR round. Behavioral questions follow the STAR method. Preparation time is 6–12 weeks." } },
      { "@type": "Question", name: "How do consulting interviews (McKinsey, BCG, Deloitte) differ from tech interviews?", acceptedAnswer: { "@type": "Answer", text: "Consulting interviews have two main components: fit questions (leadership, teamwork) and case studies (market sizing, profitability analysis, business strategy). There is no coding. The evaluation framework is completely different from tech: verbal fluency and structured reasoning matter most." } },
      { "@type": "Question", name: "Can I use HireStepX to practice for multiple companies?", acceptedAnswer: { "@type": "Answer", text: "Yes. Each company on HireStepX has its own question set tuned to that company's known interview style: TCS NQT aptitude format, Google-style DSA, Amazon's leadership-principle behavioral questions. You get 2 free mock sessions per company and can switch companies any time." } },
    ],
  };

  const companySections: HubSection[] = sections.map((section) => {
    const group = groupsWithPages.find((g) => g.id === section.id)!;
    const continued = groupAbsStart[section.id] < globalStartOfPage;
    return {
      kind: "grid",
      id: continued ? `${section.id}-continued` : section.id,
      title: `${group.label}${continued ? " (continued)" : ""}`,
      sub: `${group.description} ${group.pages.length} ${group.pages.length === 1 ? "guide" : "guides"} total.`,
      items: section.pages.map((p) => ({
        label: p.searchPhrase,
        href: questionHref(p.slug),
        meta: FOCUS_LABEL[p.focus] ?? p.focus,
      })),
      initial: 30,
      filter: section.pages.length > 24,
    };
  });

  const paginationSection: HubSection[] = totalCompanyPages > 1
    ? [{
        kind: "grid",
        id: "directory-pages",
        title: "Company directory pages",
        sub: `${flat.length} companies · page ${safePage} of ${totalCompanyPages}`,
        items: Array.from({ length: totalCompanyPages }, (_, i) => i + 1).map((n) => ({
          label: `Page ${n}`,
          href: companyPageHref(n),
          meta: groupsWithPages.filter((g) => groupStartPage(g.id) === n).map((g) => g.label).join(", ") || undefined,
        })),
        initial: 60,
      }]
    : [];

  const faqs = faqSchema.mainEntity.map((f) => ({ q: f.name, a: f.acceptedAnswer.text }));

  return (
    <>
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }} />
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={ldJson(breadcrumb([{ name: "Companies", path: "/companies" }]))} />

      {/* Mediapartners-Google (AdSense's ad crawler) isn't governed by the
          noindex meta tag above — only loading ads on the canonical page 1
          keeps thin, noindexed pagination pages out of ad-serving scope. */}
      {safePage === 1 && <ConsentGatedAdSense />}
      <HubTemplate
        kicker="Company interview directory"
        title="Every company's interview, decoded."
        dek={`${SEO_PAGES.length} guides, 2 free AI mocks per company.${totalCompanyPages > 1 ? ` Page ${safePage} of ${totalCompanyPages}.` : ""}`}
        crumbs={safePage === 1
          ? [{ label: "Companies" }]
          : [{ label: "Companies", href: "/companies" }, { label: `Page ${safePage}` }]}
        stats={[{ label: "Guides", value: String(SEO_PAGES.length) }, { label: "Free mocks per company", value: "2" }]}
        cta={["Pick a company, start free", "/signup?source=companies-index"]}
        sections={[...companySections, ...paginationSection]}
        faqs={safePage === 1 ? faqs : undefined}
        close={{ kicker: "Reading won't get you hired", title: "Pick your company, start answering.", body: "The AI interviews you in that company's exact question style, listens to your voice, and scores your answer in two minutes.", primary: ["Start free: 2 mock interviews", "/signup?source=companies-index-cta"] }}
      />
    </>
  );
}
