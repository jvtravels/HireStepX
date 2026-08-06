import type { Metadata } from "next";
import Script from "next/script";
import { SALARY_SEO_PAGES, salaryCompanyLabel } from "../../../data/salary-seo";
import { COMPANY_SALARY_OVERRIDES } from "../../../data/company-salary-overrides";
import { buildSalaryReport, EMERGING_COMPANY_SLUGS } from "../../../data/_salary-report";
import { SalaryReport2026 } from "@/marketing-v2/SalaryReport2026";
import { NavV2, MobileStickyCTA } from "@/marketing-v2/HomepageV2";
import { FooterDome } from "@/marketing-v2/FooterDome";
import { breadcrumb, ldJson } from "@/marketing-v2/_schema";

export const revalidate = 86400;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** ISO "2026-07-15" → "July 2026" without touching Date (locale/tz-safe). */
function monthYear(iso: string | null): string {
  if (!iso) return "2026";
  const m = /^(\d{4})-(\d{2})/.exec(iso);
  if (!m) return "2026";
  const monthIdx = Number(m[2]) - 1;
  return `${MONTHS[monthIdx] ?? ""} ${m[1]}`.trim();
}

const report = buildSalaryReport(
  SALARY_SEO_PAGES,
  COMPANY_SALARY_OVERRIDES,
  salaryCompanyLabel,
  EMERGING_COMPANY_SLUGS,
);

export function generateMetadata(): Metadata {
  const { companyCount, emergingCount } = report.stats;
  const desc = `Total-CTC salary bands across ${companyCount} companies in India for 2026, including ${emergingCount} emerging AI startups. Median entry, mid, senior ranges with sources.`;
  return {
    title: "Indian Startup Engineer Salary Report 2026 | HireStepX",
    description: desc,
    keywords: [
      "Indian startup salary report 2026",
      "AI startup engineer salary India",
      "Sarvam salary",
      "Moglix salary",
      "Navi salary",
      "software engineer salary India 2026",
      "startup CTC India",
      "unicorn salary India 2026",
    ],
    alternates: { canonical: "/salary-report-2026" },
    openGraph: {
      type: "article",
      title: "Indian Startup Engineer Salary Report 2026 | HireStepX",
      description: desc,
      url: "https://hirestepx.com/salary-report-2026",
      siteName: "HireStepX",
      locale: "en_IN",
      images: [{ url: "https://hirestepx.com/opengraph-image", width: 1200, height: 630, alt: "Indian Startup Engineer Salary Report 2026" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Indian Startup Engineer Salary Report 2026 | HireStepX",
      description: desc,
      images: ["https://hirestepx.com/opengraph-image"],
    },
  };
}

export default async function SalaryReport2026Page() {
  const { headers } = await import("next/headers");
  const nonce = (await headers()).get("x-nonce") ?? "";

  const { rows, stats } = report;
  const updatedLabel = monthYear(stats.lastVerified);

  const breadcrumbSchema = breadcrumb([
    { name: "Salary Guides", path: "/salary" },
    { name: "Indian Startup Engineer Salary Report 2026", path: "/salary-report-2026" },
  ]);

  const datasetSchema = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "Indian Startup Engineer Salary Report 2026",
    description:
      `Total-CTC software-engineer salary bands (entry, mid, senior) across ${stats.companyCount} companies hiring in India for 2026, including ${stats.emergingCount} emerging AI startups and new unicorns. Cross-referenced from Levels.fyi, AmbitionBox, Glassdoor, and public DRHP filings.`,
    url: "https://hirestepx.com/salary-report-2026",
    keywords: ["salary", "India", "software engineer", "startup", "compensation", "CTC", "2026"],
    creator: { "@type": "Organization", name: "HireStepX", url: "https://hirestepx.com" },
    isAccessibleForFree: true,
    ...(stats.lastVerified ? { dateModified: stats.lastVerified } : {}),
    measurementTechnique: "Cross-referenced aggregation of self-reported (Levels.fyi, AmbitionBox, Glassdoor), public filings (DRHP), and offer-letter research.",
    variableMeasured: "Total annual CTC in INR lakhs per annum (LPA) by experience level",
  };

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Indian Startup Engineer Salary Report 2026",
    description:
      `Median total-CTC software-engineer salary bands across ${stats.companyCount} companies hiring in India for 2026, with a focus on emerging AI startups and new unicorns.`,
    author: { "@type": "Organization", name: "HireStepX", url: "https://hirestepx.com" },
    publisher: {
      "@type": "Organization",
      name: "HireStepX",
      logo: { "@type": "ImageObject", url: "https://hirestepx.com/wordmark.png" },
    },
    mainEntityOfPage: "https://hirestepx.com/salary-report-2026",
    image: "https://hirestepx.com/opengraph-image",
    ...(stats.lastVerified ? { dateModified: stats.lastVerified, datePublished: stats.lastVerified } : {}),
  };

  return (
    <>
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={ldJson(datasetSchema)} />
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={ldJson(articleSchema)} />
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={ldJson(breadcrumbSchema)} />
      <Script
        async
        src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7810403590527236"
        crossOrigin="anonymous"
        strategy="lazyOnload"
      />
      <NavV2 />
      <SalaryReport2026 rows={rows} stats={stats} updatedLabel={updatedLabel} />
      <FooterDome />
      <MobileStickyCTA />
    </>
  );
}
