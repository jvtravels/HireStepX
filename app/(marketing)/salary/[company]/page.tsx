import type { Metadata } from "next";
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

function buildRoleSections(
  companySlug: string,
  roles: Array<{ roleKey: string; label: string }>,
): SalaryRoleSection[] {
  const overrides = COMPANY_SALARY_OVERRIDES[companySlug];
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
  const knownFacts = COMPANY_KNOWN_FACTS[company];
  const meta = COMPANY_META[company];
  const roles = buildRoleSections(company, page.roles);

  /* Matching blog post — links back to the interview guide for this company. */
  const blogPost = BLOG_META.find((p) => p.company.toLowerCase() === company);

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
      <FooterDome />
      <MobileStickyCTA />
    </>
  );
}
