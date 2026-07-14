import type { Metadata } from "next";
import { SALARY_SEO_PAGES, salaryCompanyLabel } from "../../../data/salary-seo";
import { COMPANY_SALARY_OVERRIDES } from "../../../data/company-salary-overrides";
import { SalaryHubPage, type SalaryHubEntry } from "@/marketing-v2/SalaryPage";
import { NavV2, MobileStickyCTA } from "@/marketing-v2/HomepageV2";
import { FooterDome } from "@/marketing-v2/FooterDome";
import { breadcrumb, ldJson } from "@/marketing-v2/_schema";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Company Salary Guides India 2026 | HireStepX",
  description:
    "Verified salary ranges for 19+ companies hiring in India in 2026 — TCS, Infosys, Razorpay, Google, Amazon, Flipkart, and more. Total CTC data from AmbitionBox, Glassdoor, and Levels.fyi.",
  keywords: [
    "software engineer salary India 2026",
    "TCS salary freshers 2026",
    "Razorpay salary India",
    "Infosys salary 2026",
    "Google salary India",
    "Amazon SDE salary India",
    "company salary guide India",
  ],
  alternates: { canonical: "/salary" },
  openGraph: {
    type: "website",
    title: "Company Salary Guides India 2026 | HireStepX",
    description:
      "Verified salary ranges for 19+ companies — total CTC from AmbitionBox, Glassdoor, and Levels.fyi.",
    url: "https://hirestepx.com/salary",
    siteName: "HireStepX",
    locale: "en_IN",
  },
};

export default async function SalaryIndexPage() {
  const { headers } = await import("next/headers");
  const nonce = (await headers()).get("x-nonce") ?? "";

  const entries: SalaryHubEntry[] = SALARY_SEO_PAGES.map((page) => {
    const overrides = COMPANY_SALARY_OVERRIDES[page.slug];
    const sweBands = overrides?.["software-engineer"];
    const entryBand = sweBands?.["entry"];

    return {
      slug: page.slug,
      label: salaryCompanyLabel(page.slug),
      hubNote: page.hubNote,
      topRoleLabel: page.roles[0]?.label ?? "Software Engineer",
      entryMin: entryBand?.totalMin,
      entryMax: entryBand?.totalMax,
    };
  });

  const breadcrumbSchema = breadcrumb([{ name: "Salary Guides", path: "/salary" }]);

  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Company Salary Guides India 2026",
    description:
      "Verified total CTC ranges for 19 companies hiring in India — sourced from AmbitionBox, Glassdoor, and Levels.fyi.",
    numberOfItems: entries.length,
    itemListElement: entries.map((e, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: `${e.label} Salary Guide India 2026`,
      url: `https://hirestepx.com/salary/${e.slug}`,
    })),
  };

  return (
    <>
      <script
        nonce={nonce || undefined}
        type="application/ld+json"
        dangerouslySetInnerHTML={ldJson(breadcrumbSchema)}
      />
      <script
        nonce={nonce || undefined}
        type="application/ld+json"
        dangerouslySetInnerHTML={ldJson(itemListSchema)}
      />
      <NavV2 />
      <SalaryHubPage entries={entries} />
      <FooterDome />
      <MobileStickyCTA />
    </>
  );
}
