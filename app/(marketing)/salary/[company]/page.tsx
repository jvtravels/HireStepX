import type { Metadata } from "next";
import Script from "next/script";
import { notFound } from "next/navigation";
import {
  getSalaryPage,
  getAllSalarySlugs,
  salaryCompanyLabel,
} from "../../../../data/salary-seo";
import { COMPANY_META } from "../../../../data/company-salary-overrides";
import { COMPANY_KNOWN_FACTS } from "../../../../data/company-known-facts";
import { CALIBRATION_DATE } from "../../../../data/salaries";
import { SalaryCompanyPage } from "@/marketing-v2/SalaryPage";
import { NavV2, MobileStickyCTA } from "@/marketing-v2/HomepageV2";
import { FooterDome } from "@/marketing-v2/FooterDome";
import { BLOG_META } from "@/blog-meta";
import { tokens as t, fonts } from "@/auth/_tokens";
import { buildSalaryPageModel, buildRoleSections } from "./_jsonld";

/* /salary/[company] — company-specific salary guide pages.
 *
 * All salary figures are read from COMPANY_SALARY_OVERRIDES which
 * cites its source (predominantly AmbitionBox, with Glassdoor as a
 * secondary cross-check) per entry. No figures are invented here.
 */

/* ─── Salary page groupings for cross-linking ────────────────────────────── */

const SALARY_GROUPS: Record<string, string[]> = {
  "IT Services": ["tcs", "infosys", "wipro", "cognizant", "hcl", "capgemini", "ltimindtree", "accenture", "techmahindra", "mphasis", "persistent", "ibm", "ntt-data", "globallogic", "thoughtworks"],
  "Indian Fintech": ["razorpay", "phonepe", "paytm", "cred", "groww", "zerodha", "upstox", "angel-one", "bharatpe", "cashfree", "policybazaar", "navi", "slice", "jupiter", "fi-money", "indmoney", "smallcase", "juspay", "nium", "m2p-fintech", "khatabook", "zeta", "kreditbee", "moneyview", "fibe", "pine-labs", "rupeek", "niyo", "acko", "digit", "mobikwik"],
  "Indian Product & Unicorns": ["flipkart", "swiggy", "zomato", "meesho", "nykaa", "myntra", "dream11", "zepto", "blinkit", "oyo", "rapido", "lenskart", "mamaearth", "cars24", "shiprocket", "truecaller", "naukri", "scaler"],
  "Global Tech (FAANG+)": ["google", "amazon", "microsoft", "meta", "apple", "netflix", "uber", "oracle", "adobe", "atlassian", "salesforce", "stripe", "linkedin", "databricks", "openai", "servicenow", "workday", "anthropic", "airbnb", "twitter-x", "walmart-global-tech", "vmware", "paypal", "american-express", "mastercard", "visa-india", "intuit"],
  "Finance & Quant": ["goldman", "jpmc", "morgan-stanley", "barclays", "citi", "hsbc", "deutsche-bank", "wells-fargo", "standard-chartered", "bny-mellon", "tower-research", "jane-street", "de-shaw", "optiver", "millennium", "citadel"],
  "Indian Banking": ["hdfc-bank", "icici", "axis", "kotak", "sbi", "bajaj-finance", "star-health", "icici-lombard", "hdfc", "bajaj-finserv", "aditya-birla-capital"],
  "Consulting": ["deloitte", "mckinsey", "bcg", "bain", "ey", "kpmg", "pwc"],
  "Semiconductor & Hardware": ["qualcomm", "intel-india", "arm-india", "texas-instruments", "nvidia", "cisco", "mediatek", "sap-labs", "siemens-india", "bosch-india", "samsung-india", "ericsson-india", "nokia-india"],
  "Indian AI Startups": ["sarvam", "sarvam-ai", "krutrim", "perplexity", "glance"],
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
const SLUG_TO_GROUP: Record<string, string> = {};
for (const [group, slugs] of Object.entries(SALARY_GROUPS)) {
  for (const slug of slugs) {
    SLUG_TO_GROUP[slug] = group;
  }
}

function relatedSalaryPages(currentSlug: string): Array<{ slug: string; label: string }> {
  const group = SLUG_TO_GROUP[currentSlug];
  if (!group) return [];
  return SALARY_GROUPS[group]
    .filter((s) => s !== currentSlug)
    .slice(0, 5)
    .map((s) => ({ slug: s, label: salaryCompanyLabel(s) }));
}

export const revalidate = 86400;

export async function generateStaticParams() {
  return getAllSalarySlugs().map((company) => ({ company }));
}

/* Google truncates SERP titles/descriptions around ~60 and ~155 chars
   respectively. The broad-roster title/description below are assembled
   from variable-length parts (company label, role names, CTC ranges) that
   can run well past both limits — this trims to the last full word that
   still fits instead of cutting mid-word or blowing past the limit. */
function truncateAtWord(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[,;:]$/, "");
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ company: string }>;
}): Promise<Metadata> {
  const { company } = await params;
  const page = getSalaryPage(company);
  if (!page) return { title: "Not Found" };

  const label = salaryCompanyLabel(company);
  const roleSections = buildRoleSections(company, page.roles);
  const hasData = roleSections.length > 0;

  // Pages with a handful of roles keep their hand-tuned, single-keyword
  // searchPhrase (e.g. "Razorpay Software Engineer Salary India 2026") —
  // that title is deliberately optimized for the highest-search-volume
  // query. Once the CSV-derived role expansion pushed a page well past
  // that scope, an unchanged title/description misrepresents what's on
  // the page to anyone landing via a different role's search query, and
  // undersells the page's coverage in the SERP snippet.
  const isBroadRoster = roleSections.length > 5;
  const firstRole = roleSections[0]?.roleLabel;
  const lastRole = roleSections[roleSections.length - 1]?.roleLabel;
  // GSC shows a consistent pattern: titles that lead with a real ₹ CTC
  // number earn clicks at a given position; generic titles (company +
  // "Salary Guide", no figure) sit at similar or better positions with
  // zero clicks. The old broad-roster title never carried a number at
  // all — pull the flagship role's headline range in so it does.
  const headlineBands = roleSections[0]?.bands ?? [];
  const headlineRange =
    headlineBands.length > 0
      ? `₹${Math.min(...headlineBands.map((b) => b.totalMin))}–${Math.max(...headlineBands.map((b) => b.totalMax))} LPA`
      : undefined;
  const baseTitle = isBroadRoster
    ? headlineRange
      ? `${label} Salary India 2026: ${firstRole} ${headlineRange} (+${roleSections.length - 1} More Roles)`
      : `${label} Salary Guide India 2026 — ${roleSections.length} Roles (${firstRole} to ${lastRole})`
    : page.searchPhrase;
  const titleWithSuffix = `${baseTitle} | HireStepX`;
  const title =
    titleWithSuffix.length <= 60 ? titleWithSuffix : truncateAtWord(baseTitle, 60);
  const baseDescription = isBroadRoster
    ? `${page.metaDescription} Covers ${roleSections.length} roles at ${label}, from ${firstRole} to ${lastRole}.`
    : page.metaDescription;
  const description =
    baseDescription.length <= 155 ? baseDescription : `${truncateAtWord(baseDescription, 154)}.`;

  return {
    title,
    description,
    keywords: [
      `${label} salary India 2026`,
      `${label} software engineer salary`,
      `${label} fresher salary`,
      `${label} CTC India`,
      "salary India 2026",
    ],
    /* No verified salary data yet for this company — don't let a stub
       page ("data not yet available") compete for the query in search. */
    ...(hasData ? {} : { robots: { index: false, follow: true } }),
    alternates: { canonical: `/salary/${company}` },
    openGraph: {
      type: "article",
      title,
      description,
      url: `https://hirestepx.com/salary/${company}`,
      siteName: "HireStepX",
      locale: "en_IN",
      images: [{ url: "https://hirestepx.com/opengraph-image", width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["https://hirestepx.com/opengraph-image"],
    },
  };
}

/* ─── Page ─────────────────────────────────────────────────────── */

export default async function SalaryCompanySlugPage({
  params,
}: {
  params: Promise<{ company: string }>;
}) {
  const { company } = await params;

  const model = buildSalaryPageModel(company);
  if (!model) notFound();
  const { page, label, roles, faqs, jsonLdScripts } = model;

  const overrideKey = company.replace(/-/g, " ");
  const knownFacts = COMPANY_KNOWN_FACTS[company] ?? COMPANY_KNOWN_FACTS[overrideKey];
  const meta = COMPANY_META[company] ?? COMPANY_META[overrideKey];

  /* Matching blog post — links back to the interview guide for this company. */
  const blogPost = BLOG_META.find((p) => p.company.toLowerCase() === company);

  /* Related salary pages in the same company category. */
  const relatedSalary = relatedSalaryPages(company);

  /* Company description: use verified KnownFacts description, or generic fallback */
  const description =
    knownFacts?.description
      ? `${knownFacts.description} `
      : `${label} is a leading employer in India. `;

  return (
    <>
      {/* No CSP nonce here on purpose — a live per-request headers() read
          would force this ISR route fully dynamic (defeating `revalidate`
          and killing cache-control). This JSON-LD is deterministic per
          company, so its CSP allowance comes from a build-time content hash
          instead — see scripts/generate-jsonld-csp-hashes.mts and
          proxy.ts's buildCsp(). */}
      {jsonLdScripts.map((html, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={html} />
      ))}
      <NavV2 />
      <SalaryCompanyPage
        companySlug={company}
        companyLabel={label}
        companyDescription={description}
        roles={roles}
        questionPageSlug={page.questionSlug}
        blogPostSlug={blogPost?.slug}
        noticePeriodDays={meta?.noticePeriodDays}
        bondPenaltyLpa={meta?.bondPenaltyLpa}
        calibrationDate={CALIBRATION_DATE}
        faqs={faqs}
        scale={knownFacts?.scale}
        products={knownFacts?.products}
        interviewNotes={knownFacts?.notes}
      />
      {relatedSalary.length >= 2 && (
        <section
          aria-label={`Compare ${label} salary with similar companies`}
          style={{ borderTop: `1px solid ${t.line}`, background: t.creamSoft, padding: "40px 24px 48px" }}
        >
          <div style={{ maxWidth: 960, margin: "0 auto" }}>
            <p style={{ fontFamily: fonts.sans, fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: t.inkFaint, textTransform: "uppercase", marginBottom: 12 }}>
              {SLUG_TO_GROUP[company]}
            </p>
            <h2 style={{ fontFamily: fonts.sans, fontSize: 20, fontWeight: 700, color: t.coal, margin: "0 0 20px" }}>
              Compare salary with similar companies
            </h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {relatedSalary.map((peer) => (
                <a
                  key={peer.slug}
                  href={`/salary/${peer.slug}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "10px 16px",
                    background: t.white,
                    border: `1px solid ${t.line}`,
                    borderRadius: 8,
                    textDecoration: "none",
                    color: t.coal,
                    fontFamily: fonts.sans,
                    fontSize: 14,
                    fontWeight: 500,
                  }}
                >
                  {peer.label} salary
                  <span style={{ color: t.copper, fontSize: 12 }}>→</span>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}
      <Script
        async
        src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7810403590527236"
        crossOrigin="anonymous"
        strategy="lazyOnload"
      />
      <FooterDome />
      <MobileStickyCTA />
    </>
  );
}
