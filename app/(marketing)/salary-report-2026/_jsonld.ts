import { SALARY_SEO_PAGES, salaryCompanyLabel } from "../../../data/salary-seo";
import { COMPANY_SALARY_OVERRIDES } from "../../../data/company-salary-overrides";
import { buildSalaryReport, EMERGING_COMPANY_SLUGS, type SalaryReport } from "../../../data/_salary-report";
import { breadcrumb, ldJson } from "@/marketing-v2/_schema";

/* Shared source of truth for /salary-report-2026's JSON-LD, used by both
 * the page (renders it) and scripts/generate-jsonld-csp-hashes.mts
 * (hashes the JSON-LD for the CSP header). Keeping this in one place
 * guarantees the hash always matches what the page actually renders.
 *
 * The report itself also drives visible rendering (the salary table), so
 * it's built once here and exported for the page to reuse — avoids
 * computing buildSalaryReport() twice per request. */

export const report: SalaryReport = buildSalaryReport(
  SALARY_SEO_PAGES,
  COMPANY_SALARY_OVERRIDES,
  salaryCompanyLabel,
  EMERGING_COMPANY_SLUGS,
);

export function buildSalaryReport2026JsonLd(): { __html: string }[] {
  const { stats } = report;

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
    datePublished: "2026-07-31",
    dateModified: stats.lastVerified ?? "2026-07-31",
  };

  return [
    ldJson(datasetSchema),
    ldJson(articleSchema),
    ldJson(breadcrumbSchema),
  ];
}
