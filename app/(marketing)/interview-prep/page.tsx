import type { Metadata } from "next";
import ConsentGatedAdSense from "../../ConsentGatedAdSense";
import { SEO_PAGES } from "../../../data/seo-pages";
import { COMPANY_LABEL as ALL_LABELS } from "../../../data/company-labels";
import { SALARY_SEO_PAGES, salaryCompanyLabel } from "../../../data/salary-seo";
import { CITY_PAGES } from "../../../data/city-pages";
import { breadcrumb, ldJson } from "@/marketing-v2/_schema";
import { HubTemplate, type HubSection } from "@/home2/HubTemplate";
import { questionHref } from "../../../src/seoLinks";

/* /interview-prep — pillar page targeting broad "interview preparation
 * India" head terms. Acts as the hub for the entire company × focus
 * content tree. Every /companies/[slug] page is linked from here,
 * which is the strongest crawl-budget and topical-authority signal
 * available without off-site link building.
 *
 * Schema: Article + BreadcrumbList + FAQPage
 * Target queries: "interview preparation India 2026", "how to prepare
 *   for job interview India", "interview tips freshers India",
 *   "best mock interview platform India"
 *
 * The 15 industry groups are flattened and paginated at 30 companies per
 * page (mirrors /questions) — the guide content (hero, framework, FAQ,
 * salary/blog links) only renders on page 1 to avoid duplicating it across
 * the directory pages; ?page= is intentionally excluded from the canonical.
 */

export const revalidate = 86400;

// Same self-canonical-but-not-noindexed gap that /questions and /salary
// had: ?page=N renders a distinct, thin card-grid URL (no guide prose —
// that only renders on page 1) while alternates.canonical always points
// back to plain /interview-prep. A self-canonical is a hint, not a
// directive, so Google is free to index those paginated URLs on their own
// merits — which are weak, given the content mismatch with the declared
// title/description. Add the matching noindex so they can't get flagged
// as duplicate/thin ("Crawled - currently not indexed") on their own.
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}): Promise<Metadata> {
  const { page } = await searchParams;
  const pageNum = Math.max(1, parseInt(page ?? "1", 10) || 1);

  return {
    title: "Interview Preparation Guide India 2026 | HireStepX",
    description:
      "Interview prep guide for India 2026. AI mock interviews for TCS, Infosys, Google, Amazon, Flipkart, and 200+ companies. All formats covered.",
    keywords: [
      "interview preparation India 2026",
      "how to prepare for job interview India",
      "interview tips freshers India",
      "mock interview practice India",
      "ai mock interview India",
      "campus placement preparation",
      "technical interview preparation",
      "behavioral interview preparation India",
    ].join(", "),
    alternates: { canonical: "/interview-prep" },
    ...(pageNum === 1 ? {} : { robots: { index: false, follow: true } }),
    openGraph: {
      type: "article",
      title: "Interview Preparation Guide India 2026 | HireStepX",
      description:
        "Complete interview preparation guide for Indian job seekers. AI mock interviews for 200+ companies, 2 sessions free.",
      url: "https://hirestepx.com/interview-prep",
      siteName: "HireStepX",
      locale: "en_IN",
      images: [{ url: "https://hirestepx.com/opengraph-image", width: 1200, height: 630, alt: "Interview Preparation Guide India 2026 | HireStepX" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Interview Preparation Guide India 2026 | HireStepX",
      description: "Complete guide + AI mock interview practice for 200+ Indian companies.",
      images: ["https://hirestepx.com/opengraph-image"],
    },
  };
}

/* ── Company groupings ──────────────────────────────────────────────── */
const COMPANY_LABEL = ALL_LABELS;

const FOCUS_LABEL: Record<string, string> = {
  behavioral: "Behavioural", technical: "Technical", "system-design": "System Design",
  "case-study": "Case Study", "campus-placement": "Campus Placement",
  hr: "HR Round", "salary-negotiation": "Salary Negotiation",
  management: "Management", "government-psu": "Government / PSU", strategic: "Strategic",
  general: "General", leadership: "Leadership", panel: "Panel", quant: "Quant",
};

const SERVICE_COMPANIES = ["tcs", "infosys", "wipro", "cognizant", "accenture", "ltimindtree", "hcl", "capgemini", "ibm", "techmahindra", "mphasis", "persistent", "ntt-data", "globallogic", "thoughtworks"];
const PRODUCT_COMPANIES = ["flipkart", "razorpay", "swiggy", "zomato", "phonepe", "paytm", "cred", "zerodha", "meesho", "oyo", "freshworks", "zoho", "nykaa", "mamaearth", "myntra", "bigbasket", "blinkit", "makemytrip", "ixigo", "dream11", "lenskart", "boat", "naukri", "sharechat", "truecaller", "groww", "dmart", "wakefit", "zepto", "udaan"];
const FAANG_COMPANIES = ["google", "amazon", "microsoft", "meta", "apple", "netflix", "linkedin", "adobe", "uber", "stripe", "salesforce", "atlassian", "workday", "servicenow", "vmware", "nvidia", "openai", "anthropic", "perplexity", "postman", "chargebee", "clevertap", "moengage", "inmobi", "druva", "browserstack", "darwinbox"];
const CONSULTING_COMPANIES = ["mckinsey", "bcg", "bain", "deloitte", "goldman", "jpmc", "ey", "kpmg", "pwc"];
const FINTECH_COMPANIES = ["bajaj-finance", "fibe", "kreditbee", "moneyview", "rupeek", "fi-money", "niyo", "smallcase", "indmoney", "zeta", "nium", "upstox", "angel-one", "jupiter", "navi", "slice", "cashfree", "juspay", "pine-labs", "bharatpe", "acko", "policybazaar", "icici-lombard", "digit"];
const BANKING_COMPANIES = ["hdfc-bank", "icici", "hdfc", "axis", "kotak", "sbi", "barclays", "hsbc", "citi", "deutsche-bank", "bny-mellon", "standard-chartered", "wells-fargo", "morgan-stanley", "mastercard", "visa-india", "fiserv"];
const SEMICONDUCTOR_COMPANIES = ["intel-india", "qualcomm", "arm-india", "mediatek", "bosch-india", "texas-instruments", "samsung", "samsung-india", "nvidia", "ericsson-india", "nokia-india", "cisco", "oracle", "sap-labs", "siemens-india", "walmart-global-tech", "lowes-india", "target-india"];
const HEALTHCARE_COMPANIES = ["apollo-247", "practo", "medibuddy", "tata-1mg", "dr-lal-pathlabs", "metropolis", "star-health", "curefit"];
const LOGISTICS_COMPANIES = ["delhivery", "shadowfax", "shiprocket", "rapido", "blackbuck", "moglix", "ninjacart"];
const EDTECH_COMPANIES = ["scaler", "vedantu", "unacademy", "byjus", "physicswallah"];
const D2C_COMPANIES = ["godrej", "nestle", "hul", "itc", "p&g", "tata-steel", "purplle", "licious", "rebel-foods"];
const QUANT_COMPANIES = ["optiver", "millennium", "jane-street", "de-shaw", "citadel"];
const SAAS_COMPANIES = ["hasura", "gupshup", "exotel", "plivo", "intuit", "mindtickle", "sigmoid", "tracxn", "khatabook", "krutrim", "sarvam"];
const EV_COMPANIES = ["ola-electric", "ather-energy", "ola", "cars24", "spinny", "tata-motors", "mahindra", "bajaj"];
const CAMPUS_COMPANIES = ["campus"];

function pageGroup(companies: string[]) {
  return SEO_PAGES.filter((p) => companies.includes(p.company));
}

/* All 15 industry groups in display order. Flattened + paginated below so
   the hub never renders more than GROUPS_PER_PAGE company cards at once —
   the same 30-per-page cap used on /questions. */
const GROUPS = [
  { slug: "service-it", heading: "Service IT: Campus & Fresher Guides", description: "The highest-volume hiring segment in India. These companies hire 100,000+ freshers per year combined.", companies: SERVICE_COMPANIES },
  { slug: "product", heading: "Indian Product Companies", description: "Unicorns and fast-scaling startups. Higher pay, harder interviews, more ownership.", companies: PRODUCT_COMPANIES },
  { slug: "faang", heading: "FAANG & Global Tech", description: "The most competitive hiring bar. Long preparation lead time, significant pay premium.", companies: FAANG_COMPANIES },
  { slug: "consulting", heading: "Consulting & Finance", description: "Case-driven hiring with a structured evaluation rubric. Completely different format from tech.", companies: CONSULTING_COMPANIES },
  { slug: "fintech", heading: "Fintech & WealthTech", description: "India's fastest-growing hiring segment. Expect system design at scale, payments APIs, and strong product sense around India-specific financial products.", companies: FINTECH_COMPANIES },
  { slug: "banking", heading: "Banking & Financial Services", description: "Indian private banks, global investment banks, and payments networks. Tech roles need strong distributed systems; business roles need finance domain knowledge.", companies: BANKING_COMPANIES },
  { slug: "semiconductor", heading: "Semiconductor, Hardware & Global Capability Centers", description: "Embedded systems, chip design, and large enterprise tech GCCs. Often overlooked but pay competitively and offer high technical depth with job stability.", companies: SEMICONDUCTOR_COMPANIES },
  { slug: "healthcare", heading: "Healthcare & Diagnostics", description: "Health tech companies building at the intersection of clinical data and software. Strong on product sense, compliance awareness, and user empathy for patients.", companies: HEALTHCARE_COMPANIES },
  { slug: "logistics", heading: "Logistics, Supply Chain & Quick Commerce", description: "India's delivery infrastructure layer. Interviews focus on real-time systems, routing algorithms, warehouse management, and scale-under-constraint engineering.", companies: LOGISTICS_COMPANIES },
  { slug: "edtech", heading: "EdTech & Skilling Platforms", description: "Built for India's 300M+ student population. Product and engineering roles need deep understanding of low-bandwidth delivery, vernacular content, and mobile-first learning.", companies: EDTECH_COMPANIES },
  { slug: "d2c", heading: "D2C, FMCG & Consumer Brands", description: "From century-old FMCG giants to digital-native brands. Tech and analytics roles focus on supply chain, demand forecasting, and digital commerce at Indian scale.", companies: D2C_COMPANIES },
  { slug: "ev", heading: "EV, Automotive & Mobility", description: "India's EV transition is creating strong demand for embedded software, battery management, and platform engineering talent. Niche but high-growth.", companies: EV_COMPANIES },
  { slug: "saas", heading: "B2B SaaS & Developer Tools", description: "Global-from-day-one product companies built out of India. Strong engineering culture, high bar for product thinking, and often the best engineering environments in the country.", companies: SAAS_COMPANIES },
  { slug: "quant", heading: "Quant & Algorithmic Trading", description: "The highest-paying engineering and research roles in finance. Require elite mathematical ability, strong coding, and comfort with probability and statistics under time pressure.", companies: QUANT_COMPANIES },
  { slug: "campus", heading: "Campus Placement Preparation", description: "General campus placement guides covering aptitude, group discussions, and HR rounds that cut across all companies and sectors.", companies: CAMPUS_COMPANIES },
] as const;

const GROUPS_PER_PAGE = 30;

export default async function InterviewPrepPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { headers } = await import("next/headers");
  const nonce = (await headers()).get("x-nonce") ?? "";
  const { page } = await searchParams;
  const pageNum = Math.max(1, parseInt(page ?? "1", 10) || 1);

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "How do I prepare for a job interview in India in 2026?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Start by identifying the company type (service IT, product startup, FAANG, consulting). Each has a distinct format: service companies (TCS, Infosys, Wipro) emphasise aptitude and CS fundamentals; product companies (Flipkart, Razorpay, Swiggy) need DSA + system design; FAANG needs hard DSA + system design + behavioral; consulting needs case studies. Practice out loud with AI mock interviews, not just reading answers.",
        },
      },
      {
        "@type": "Question",
        name: "How many mock interviews should I do before the real one?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "At minimum 3: one baseline session (to identify your weaknesses), one targeted practice session (acting on that feedback), and one full simulation close to the interview date. More is better; most candidates see measurable improvement within 5 practice sessions.",
        },
      },
      {
        "@type": "Question",
        name: "What is the difference between technical and behavioral interview preparation?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Technical preparation focuses on data structures, algorithms, system design, and CS fundamentals: skills you demonstrate by solving problems. Behavioral preparation builds a story bank of 8–10 STAR (Situation, Task, Action, Result) examples from your experience, which you adapt across different questions. Both require practice out loud, not just note-taking.",
        },
      },
      {
        "@type": "Question",
        name: "How long does it take to prepare for campus placements in India?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "For service companies (TCS, Infosys, Wipro): 3–4 weeks of focused aptitude + coding practice. For product companies (Flipkart, CRED, Razorpay): 2–3 months of DSA + system design + behavioral preparation. Start early: most candidates underestimate how much practice is needed to answer clearly under pressure.",
        },
      },
      {
        "@type": "Question",
        name: "What is AI mock interview practice and does it actually help?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "AI mock interview practice (like HireStepX) simulates real interview conditions: the AI asks questions, listens to your voice answer, and grades your response on structure, specificity, and delivery. It's available 24/7, provides consistent scoring (unlike friends who may be too kind), and tracks improvement across sessions. Studies on deliberate practice consistently show that objective feedback loops accelerate skill acquisition compared to unstructured practice.",
        },
      },
    ],
  };

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Complete Interview Preparation Guide for India 2026",
    description: "Comprehensive guide covering how to prepare for job interviews at service companies, product startups, FAANG, and consulting firms in India, with AI mock interview practice.",
    image: "https://hirestepx.com/opengraph-image",
    author: { "@type": "Organization", name: "HireStepX", url: "https://hirestepx.com" },
    publisher: {
      "@type": "Organization", name: "HireStepX",
      logo: { "@type": "ImageObject", url: "https://hirestepx.com/wordmark.png" },
    },
    datePublished: "2026-01-01",
    dateModified: "2026-07-14",
    inLanguage: "en-IN",
    url: "https://hirestepx.com/interview-prep",
    mainEntityOfPage: { "@type": "WebPage", "@id": "https://hirestepx.com/interview-prep" },
    keywords: "interview preparation India 2026, mock interview India, campus placement preparation, AI mock interview",
    articleSection: "Interview Preparation",
  };

  /* ── Flatten + paginate the 15 industry groups ─────────────────────── */
  const groupsWithPages = GROUPS.map((g) => ({ ...g, pages: pageGroup([...g.companies]) })).filter(
    (g) => g.pages.length > 0,
  );
  const flat = groupsWithPages.flatMap((g) => g.pages.map((p) => ({ p, slug: g.slug })));
  const totalCompanyPages = Math.max(1, Math.ceil(flat.length / GROUPS_PER_PAGE));
  const safePage = Math.min(Math.max(1, pageNum), totalCompanyPages);
  const pageSlice = flat.slice((safePage - 1) * GROUPS_PER_PAGE, safePage * GROUPS_PER_PAGE);

  /* Absolute start index of each group in the flattened list — tells us
     which page a group first appears on and whether a group rendered on
     this page is a continuation from a previous one. */
  const groupAbsStart: Record<string, number> = {};
  let cursor = 0;
  for (const g of groupsWithPages) {
    groupAbsStart[g.slug] = cursor;
    cursor += g.pages.length;
  }
  const groupStartPage = (slug: string) => Math.floor(groupAbsStart[slug] / GROUPS_PER_PAGE) + 1;

  const companyPageHref = (p: number) => (p > 1 ? `/interview-prep?page=${p}` : "/interview-prep");

  /* Group this page's slice back into contiguous sections, preserving order. */
  const groupSections: { slug: string; pages: typeof SEO_PAGES }[] = [];
  for (const item of pageSlice) {
    const last = groupSections[groupSections.length - 1];
    if (last && last.slug === item.slug) last.pages.push(item.p);
    else groupSections.push({ slug: item.slug, pages: [item.p] });
  }
  const globalStartOfPage = (safePage - 1) * GROUPS_PER_PAGE;

  const companySections: HubSection[] = groupSections.map((section) => {
    const meta = groupsWithPages.find((g) => g.slug === section.slug)!;
    const continued = groupAbsStart[section.slug] < globalStartOfPage;
    return {
      kind: "grid",
      id: continued ? `${section.slug}-continued` : section.slug,
      title: continued ? `${meta.heading} (continued)` : meta.heading,
      sub: meta.description,
      items: section.pages.map((p) => ({
        label: p.searchPhrase,
        href: questionHref(p.slug),
        meta: `${COMPANY_LABEL[p.company] ?? p.company} · ${FOCUS_LABEL[p.focus] ?? p.focus}`,
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
          meta: groupsWithPages.filter((g) => groupStartPage(g.slug) === n).map((g) => g.heading.split(" — ")[0].split(",")[0]).join(", ") || undefined,
        })),
        initial: 60,
      }]
    : [];

  const faqs = faqSchema.mainEntity.map((f) => ({ q: f.name, a: f.acceptedAnswer.text }));

  const guideSections: HubSection[] = [
    {
      kind: "grid", id: "types", title: "The four types of Indian interviews",
      sub: "Preparation differs entirely by company type. Map your target before you prepare.",
      items: [
        { label: "Service IT Companies", href: "/candidates", meta: "TCS · Infosys · Wipro · Cognizant · Accenture · HCL · Capgemini. Aptitude test → CS fundamentals → HR. The aptitude round filters out a large share of candidates. Score well on reasoning and coding basics first." },
        { label: "Indian Product Companies", href: "/questions/flipkart-sde-interview-questions", meta: "Flipkart · Razorpay · Swiggy · CRED · Meesho · Zerodha. DSA (medium–hard) → System Design → Behavioral. Bar is high. Expect 2 DSA problems in 45 min + a system design round tied to India-scale problems." },
        { label: "FAANG & Global Tech", href: "/questions/google-india-engineering-interview-questions", meta: "Google · Amazon · Microsoft · Meta · Netflix · Adobe. Hard DSA → System Design → Behavioral (LP or Googleyness). The highest bar. DSA needs competitive-programming speed. Behavioral rounds are as important as coding." },
        { label: "Consulting & Finance", href: "/questions/mckinsey-case-study-interview-questions", meta: "McKinsey · BCG · Deloitte · Goldman · JPMorgan. Case Study → Behavioral (PEI/LP) → Partner round. Hypothesis-first thinking and structured problem-solving matter more than technical depth." },
      ],
    },
    {
      kind: "steps", id: "framework", title: "A preparation framework that works",
      sub: "Most candidates fail at Step 1: they study what they already know instead of what they don't.",
      items: [
        { title: "Baseline mock interview first", body: "Do one practice interview before any studying. This is uncomfortable but essential: it shows you exactly where you are, not where you think you are. Most candidates discover their real gap is delivery and structure, not content." },
        { title: "Know your company's format cold", body: "TCS Ninja has 3 NQT rounds. Amazon has 16 Leadership Principles. Google has a 'Googleyness' round. CRED has a take-home assignment. Each format rewards different preparation, so don't use generic content." },
        { title: "Build a story bank (behavioral)", body: "Prepare 8–10 STAR (Situation, Task, Action, Result) stories covering: leadership, conflict, failure, initiative, teamwork, technical problem-solving, and learning something new. These same stories cover most behavioral questions across companies." },
        { title: "Practice out loud, not on paper", body: "Reading answers and saying them are completely different skills. Record yourself. Count filler words. Time every answer (aim for 90 seconds to 2 minutes). The goal is naturally structured, not scripted." },
        { title: "Company-specific deep dive (last 1 week)", body: "In the final week, simulate the exact interview format: same time limits, same question types, same pressure. Use company-specific question sets and frameworks, not generic prep materials." },
      ],
    },
    {
      kind: "table", id: "timelines", title: "How long does preparation take?",
      head: ["Target", "Time needed", "Focus"],
      rows: [
        ["TCS / Infosys / Wipro", "3–4 weeks", "Aptitude + CS fundamentals + HR prep. 2 hours/day."],
        ["Cognizant / Accenture / HCL", "3–4 weeks", "Same as above + communication practice for Accenture."],
        ["Flipkart / Razorpay / Swiggy", "6–10 weeks", "Medium–hard DSA + system design + behavioral. 3+ hrs/day."],
        ["Google / Amazon / Meta", "3–6 months", "Hard DSA, system design depth, 8–10 LP stories. Intensive."],
        ["McKinsey / BCG / Deloitte", "6–8 weeks", "Case practice daily (out loud), PEI story bank, casing partner."],
      ],
    },
  ];

  const tailSections: HubSection[] = [
    {
      kind: "grid", id: "campus-hr", title: "Freshers & Campus Placement: HR Prep",
      sub: "Every campus interview ends with an HR round. These guides cover the questions that appear in 90%+ of Indian campus drives, with structured answer frameworks you can practice out loud.",
      items: [
        { label: "Why Should We Hire You?", href: "/questions/why-should-we-hire-you-answer-india", meta: "The most consequential question in campus interviews. Most freshers waste it with vague claims. Learn the Skills → Proof → Fit structure." },
        { label: "Tell Me About Yourself", href: "/questions/tell-me-about-yourself-answer-freshers-india", meta: "Opens every interview. The wrong structure is chronological. Learn the Present → Achievement → Future format that interviewers want." },
        { label: "Common HR Interview Questions", href: "/questions/common-hr-interview-questions-freshers-india", meta: "10 questions that appear in 95%+ of fresher HR rounds: strength, weakness, 5-year goal, why this company, relocation, and more." },
        { label: "Full campus placement guide", href: "/candidates", meta: "Preparing for a campus placement drive? See the full guide." },
      ],
    },
    {
      kind: "grid", id: "cities", title: "Prepare by city",
      sub: "Hiring mix differs by city: a Bengaluru loop skews GCC-heavy, Mumbai skews banking and consulting. See which companies are actually hiring where.",
      items: CITY_PAGES.map((c) => ({ label: c.city, href: `/interview-prep/${c.slug}` })),
    },
    {
      kind: "grid", id: "guides", title: "Company interview guides",
      sub: "Each guide covers the full process for that company: rounds, format, what the interviewers evaluate, and what separates shortlisted candidates.",
      items: [
        ["Browse all question sets", "/questions"],
        ["AI Mock Interview Practice: Free, Voice-Based", "/ai-mock-interview"],
        ["Freshworks SDE Interview 2026: B2B SaaS & Customer-Success Engineering", "/blog/freshworks-interview-questions-india-2026"],
        ["PhonePe Engineering Interview 2026: Scale, UPI & Builder Mindset", "/blog/phonepe-interview-questions-india-2026"],
        ["Meesho Engineering Interview 2026: Social Commerce & Tier-3 India", "/blog/meesho-interview-questions-india-2026"],
        ["FAANG Interview Preparation India 2026", "/blog/faang-interview-preparation-india-2026"],
        ["System Design Interview Preparation India", "/blog/system-design-interview-preparation-india-2026"],
        ["DSA 60-Day Preparation Plan India 2026", "/blog/dsa-60-day-preparation-plan"],
        ["Goldman Sachs India Interview Questions 2026", "/blog/goldman-sachs-india-interview-questions"],
        ["JP Morgan Interview Questions India 2026", "/blog/jp-morgan-interview-questions-india-2026"],
        ["Software Engineer Interview Checklist 2026", "/blog/software-engineer-interview-checklist-2026"],
        ["STAR Method Interview Answers India", "/blog/star-method-interview-answers"],
      ].map(([label, href]) => ({ label, href })),
    },
    {
      kind: "grid", id: "salary", title: "Know your worth before the interview",
      sub: "Salary guides for top Indian employers, sourced from AmbitionBox, Glassdoor, and DRHP filings. Know the range before you negotiate.",
      items: [
        ...SALARY_SEO_PAGES.slice(0, 18).map((sp) => ({ label: `${salaryCompanyLabel(sp.slug)} India 2026`, href: `/salary/${sp.slug}`, meta: "Salary guide" })),
        { label: "View all salary guides", href: "/salary" },
      ],
    },
  ];

  return (
    <>
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={ldJson(breadcrumb([{ name: "Interview Prep", path: "/interview-prep" }]))} />

      {/* Mediapartners-Google (AdSense's ad crawler) isn't governed by the
          noindex meta tag above — only loading ads on the canonical page 1
          keeps thin, noindexed pagination pages out of ad-serving scope. */}
      {safePage === 1 && <ConsentGatedAdSense />}
      <HubTemplate
        kicker="Complete Guide · 2026"
        title={safePage === 1 ? "Interview Preparation Guide for India 2026" : "Company Interview Directory"}
        dek={safePage === 1
          ? "Not all Indian interviews are the same. TCS wants aptitude. Razorpay wants system design. McKinsey wants case studies. This guide maps the terrain and links you directly to practice for each company."
          : `Page ${safePage} of ${totalCompanyPages}. Practice guides for every company in the directory.`}
        crumbs={safePage === 1
          ? [{ label: "Interview prep" }]
          : [{ label: "Interview prep", href: "/interview-prep" }, { label: `Page ${safePage}` }]}
        stats={[{ label: "Company guides", value: String(flat.length) }, { label: "Free sessions", value: "2" }]}
        cta={["Start free mock interview", "/signup?source=interview-prep"]}
        sections={[
          ...(safePage === 1 ? guideSections : []),
          ...companySections,
          ...paginationSection,
          ...(safePage === 1 ? tailSections : []),
        ]}
        faqs={safePage === 1 ? faqs : undefined}
        close={{ kicker: "Practise", title: "Stop reading. Start practicing.", body: "Reading interview tips is not the same as interview practice. The AI interviewer asks questions, listens to your voice answer, and grades your structure and delivery, in 2 minutes.", primary: ["Start free practice", "/signup?source=interview-prep-cta"] }}
      />
    </>
  );
}
