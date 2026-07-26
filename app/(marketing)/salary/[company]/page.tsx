import type { Metadata } from "next";
import Script from "next/script";
import { notFound } from "next/navigation";
import {
  getSalaryPage,
  getAllSalarySlugs,
  salaryCompanyLabel,
} from "../../../../data/salary-seo";
import { COMPANY_SALARY_OVERRIDES, COMPANY_META } from "../../../../data/company-salary-overrides";
import { COMPANY_KNOWN_FACTS } from "../../../../data/company-known-facts";
import { CALIBRATION_DATE } from "../../../../data/salaries";
import {
  SalaryCompanyPage,
  type SalaryRoleSection,
  type SalaryBandRow,
} from "@/marketing-v2/SalaryPage";
import { NavV2, MobileStickyCTA } from "@/marketing-v2/HomepageV2";
import { FooterDome } from "@/marketing-v2/FooterDome";
import { breadcrumb, ldJson } from "@/marketing-v2/_schema";
import { BLOG_META } from "@/blog-meta";

/* /salary/[company] — company-specific salary guide pages.
 *
 * All salary figures are read from COMPANY_SALARY_OVERRIDES which
 * cites its sources (AmbitionBox, Glassdoor, Levels.fyi, DRHP filings)
 * per entry. No figures are invented here.
 */

/* ─── Salary page groupings for cross-linking ────────────────────────────── */

const SALARY_GROUPS: Record<string, string[]> = {
  "IT Services": ["tcs", "infosys", "wipro", "cognizant", "hcl", "capgemini", "ltimindtree", "accenture", "techmahindra", "mphasis", "persistent", "ibm", "ntt-data", "globallogic", "thoughtworks"],
  "Indian Fintech": ["razorpay", "phonepe", "paytm", "cred", "groww", "zerodha", "upstox", "angel-one", "bharatpe", "cashfree", "policybazaar", "navi", "slice", "jupiter", "fi-money", "indmoney", "smallcase"],
  "Indian Product & Unicorns": ["flipkart", "swiggy", "zomato", "meesho", "nykaa", "myntra", "dream11", "zepto", "blinkit", "oyo", "rapido", "lenskart", "mamaearth", "cars24", "shiprocket", "truecaller", "naukri", "scaler"],
  "Global Tech (FAANG+)": ["google", "amazon", "microsoft", "meta", "apple", "netflix", "uber", "oracle", "adobe", "atlassian", "salesforce", "stripe", "linkedin", "databricks", "openai", "servicenow", "workday"],
  "Finance & Quant": ["goldman", "jpmc", "morgan-stanley", "barclays", "citi", "hsbc", "deutsche-bank", "wells-fargo", "standard-chartered", "bny-mellon", "tower-research", "jane-street", "de-shaw", "optiver", "millennium", "citadel"],
  "Indian Banking": ["hdfc-bank", "icici", "axis", "kotak", "sbi", "bajaj-finance", "star-health", "icici-lombard"],
  "Consulting": ["deloitte", "mckinsey", "bcg", "bain", "ey", "kpmg", "pwc"],
  "Semiconductor & Hardware": ["qualcomm", "intel-india", "arm-india", "texas-instruments", "nvidia", "cisco", "mediatek", "sap-labs", "siemens-india", "bosch-india"],
  "Indian AI Startups": ["sarvam", "sarvam-ai"],
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ company: string }>;
}): Promise<Metadata> {
  const { company } = await params;
  const page = getSalaryPage(company);
  if (!page) return { title: "Not Found" };

  const label = salaryCompanyLabel(company);
  const title = `${page.searchPhrase} | HireStepX`;

  return {
    title,
    description: page.metaDescription,
    keywords: [
      `${label} salary India 2026`,
      `${label} software engineer salary`,
      `${label} fresher salary`,
      `${label} CTC India`,
      "salary India 2026",
    ],
    alternates: { canonical: `/salary/${company}` },
    openGraph: {
      type: "article",
      title,
      description: page.metaDescription,
      url: `https://hirestepx.com/salary/${company}`,
      siteName: "HireStepX",
      locale: "en_IN",
      images: [{ url: "https://hirestepx.com/opengraph-image", width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: page.metaDescription,
      images: ["https://hirestepx.com/opengraph-image"],
    },
  };
}

/* ─── Build salary sections from COMPANY_SALARY_OVERRIDES ─── */

const LEVEL_KEYS = ["entry", "mid", "senior", "lead", "executive"] as const;

/* Some legacy override keys use spaces ("morgan stanley", "hdfc bank").
   Slugs in salary-seo use hyphens. Normalize so both resolve. */
function resolveOverrides(slug: string) {
  return COMPANY_SALARY_OVERRIDES[slug] ?? COMPANY_SALARY_OVERRIDES[slug.replace(/-/g, " ")];
}

function buildRoleSections(
  companySlug: string,
  roles: Array<{ roleKey: string; label: string }>,
): SalaryRoleSection[] {
  const overrides = resolveOverrides(companySlug);
  if (!overrides) return [];

  return roles.flatMap(({ roleKey, label }) => {
    const roleData = overrides[roleKey];
    if (!roleData) return [];

    const bands: SalaryBandRow[] = LEVEL_KEYS.flatMap((lvl) => {
      const band = roleData[lvl];
      if (!band) return [];
      return [
        {
          level: lvl,
          levelLabel: lvl,
          totalMin: band.totalMin,
          totalMax: band.totalMax,
          baseMin: band.baseMin,
          baseMax: band.baseMax,
          equityType: band.equityType,
          equityMin: band.equityMin,
          equityMax: band.equityMax,
          notes: band.notes,
          source: band.source,
          lastVerified: band.lastVerified,
        } satisfies SalaryBandRow,
      ];
    });

    if (bands.length === 0) return [];

    return [{ roleKey, roleLabel: label, bands }];
  });
}

/* ─── Page ─────────────────────────────────────────────────────── */

export default async function SalaryCompanySlugPage({
  params,
}: {
  params: Promise<{ company: string }>;
}) {
  const { headers } = await import("next/headers");
  const nonce = (await headers()).get("x-nonce") ?? "";
  const { company } = await params;

  const page = getSalaryPage(company);
  if (!page) notFound();

  const label = salaryCompanyLabel(company);
  const overrideKey = company.replace(/-/g, " ");
  const knownFacts = COMPANY_KNOWN_FACTS[company] ?? COMPANY_KNOWN_FACTS[overrideKey];
  const meta = COMPANY_META[company] ?? COMPANY_META[overrideKey];
  const roles = buildRoleSections(company, page.roles);

  /* Matching blog post — links back to the interview guide for this company. */
  const blogPost = BLOG_META.find((p) => p.company.toLowerCase() === company);

  /* Related salary pages in the same company category. */
  const relatedSalary = relatedSalaryPages(company);

  /* Company description: use verified KnownFacts description, or generic fallback */
  const description =
    knownFacts?.description
      ? `${knownFacts.description} `
      : `${label} is a leading employer in India. `;

  /* FAQ schema — targets "[Company] salary" head queries */
  const faqEntries = roles.flatMap((role) =>
    role.bands.slice(0, 2).map((band) => ({
      "@type": "Question",
      name: `What is the ${role.roleLabel} salary at ${label} India 2026?`,
      acceptedAnswer: {
        "@type": "Answer",
        text: `${role.roleLabel}s at ${label} in India earn between ₹${band.totalMin}L and ₹${band.totalMax}L total CTC at the ${band.level} level (2026, 25th–90th percentile). Source: ${band.source}.`,
      },
    })),
  );

  const faqSchema = faqEntries.length > 0
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqEntries,
      }
    : null;

  /* Article schema — editorial signal */
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `${label} Salary Guide India 2026`,
    description: page.metaDescription,
    author: { "@type": "Organization", name: "HireStepX", url: "https://hirestepx.com" },
    publisher: {
      "@type": "Organization",
      name: "HireStepX",
      logo: { "@type": "ImageObject", url: "https://hirestepx.com/wordmark.png" },
    },
    datePublished: "2026-06-01",
    dateModified: `${CALIBRATION_DATE}-01`,
    inLanguage: "en-IN",
    url: `https://hirestepx.com/salary/${company}`,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://hirestepx.com/salary/${company}`,
    },
  };

  const breadcrumbSchema = breadcrumb([
    { name: "Salary Guides", path: "/salary" },
    { name: `${label} Salary 2026`, path: `/salary/${company}` },
  ]);

  return (
    <>
      {faqSchema && (
        <script
          nonce={nonce || undefined}
          type="application/ld+json"
          dangerouslySetInnerHTML={ldJson(faqSchema)}
        />
      )}
      <script
        nonce={nonce || undefined}
        type="application/ld+json"
        dangerouslySetInnerHTML={ldJson(articleSchema)}
      />
      <script
        nonce={nonce || undefined}
        type="application/ld+json"
        dangerouslySetInnerHTML={ldJson(breadcrumbSchema)}
      />
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
      />
      {relatedSalary.length > 0 && (
        <section
          aria-label={`Compare ${label} salary with similar companies`}
          style={{ borderTop: "1px solid #e8eaed", background: "#f8f9fb", padding: "40px 24px 48px" }}
        >
          <div style={{ maxWidth: 960, margin: "0 auto" }}>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: "#8a919e", textTransform: "uppercase", marginBottom: 12 }}>
              {SLUG_TO_GROUP[company]}
            </p>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1a1d23", margin: "0 0 20px" }}>
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
                    background: "#fff",
                    border: "1px solid #e4e7ec",
                    borderRadius: 8,
                    textDecoration: "none",
                    color: "#1a1d23",
                    fontSize: 14,
                    fontWeight: 500,
                  }}
                >
                  {peer.label} salary
                  <span style={{ color: "#6366f1", fontSize: 12 }}>→</span>
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
