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
    "Salary ranges for TCS, Infosys, Razorpay, Google, Amazon, Goldman Sachs, JP Morgan, and more in India 2026. CTC data sourced from AmbitionBox, Glassdoor, and Levels.fyi.",
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
      "Salary ranges for 23 companies — total CTC sourced from AmbitionBox, Glassdoor, and Levels.fyi.",
    url: "https://hirestepx.com/salary",
    siteName: "HireStepX",
    locale: "en_IN",
    images: [{ url: "https://hirestepx.com/opengraph-image", width: 1200, height: 630, alt: "Company Salary Guides India 2026 | HireStepX" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Company Salary Guides India 2026 | HireStepX",
    description: "Salary ranges for 23 companies — total CTC sourced from AmbitionBox, Glassdoor, and Levels.fyi.",
    images: ["https://hirestepx.com/opengraph-image"],
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

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What is a good salary for a software engineer fresher in India in 2026?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "For freshers in India in 2026, salary ranges by company tier: Service companies (TCS, Infosys, Wipro, Cognizant) — ₹3.5–7 LPA depending on track. Mid-tier product companies (Freshworks, Zoho, LTIMindtree) — ₹6–12 LPA. Indian startups and unicorns (Razorpay, PhonePe, Meesho, CRED) — ₹15–30 LPA. FAANG India campuses (Google, Amazon, Microsoft, Meta) from IIT/NIT — ₹35–60 LPA all-in. These are total CTC figures including variable pay and benefits.",
        },
      },
      {
        "@type": "Question",
        name: "What components make up a software engineer's CTC in India?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Indian tech CTC typically has 4–6 components: (1) Fixed base salary — the guaranteed monthly component. (2) Variable pay — performance bonus, typically 10–20% of base at service companies and 15–30% at product companies. (3) Joining bonus — one-time payment, common when buying out notice period. (4) ESOPs or RSUs — equity at Series B+ startups and public companies; vests over 4 years with a 1-year cliff. (5) Employer PF contribution — 12% of basic, excluded from gross CTC at some companies. (6) Other allowances — HRA, transport, food. Total CTC is the full cost to company; in-hand salary is significantly lower.",
        },
      },
      {
        "@type": "Question",
        name: "How accurate are AmbitionBox and Glassdoor salary figures for Indian companies?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "AmbitionBox and Glassdoor India salary data is directionally accurate but has known biases: (1) Self-reporting bias — employees who are especially happy or unhappy with their salaries over-represent the dataset. (2) Vintage lag — salary data can be 1–3 years old in fast-moving markets. (3) Variable exclusion — many self-reported figures exclude variable pay, ESOPs, and joining bonuses. HireStepX cross-references AmbitionBox, Glassdoor, and Levels.fyi data with public DRHP filings (for listed companies) and labels each entry with a verification date.",
        },
      },
      {
        "@type": "Question",
        name: "How much can I negotiate above the initial offer in Indian tech?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "For most Indian tech companies, counter-offering 15–25% above the initial offer is the standard negotiation range. Service companies (TCS, Infosys, Wipro) have compressed negotiation room for freshers — typically 5–10%. Product startups and unicorns have more room — 15–25% on base, with additional room on joining bonus, ESOPs, and variable cap. FAANG companies in India have structured bands; negotiation works best by requesting the higher end of the band rather than exceeding it. Knowing your BATNA (Best Alternative To a Negotiated Agreement) before the call is essential.",
        },
      },
    ],
  };

  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Company Salary Guides India 2026",
    description:
      "Total CTC ranges for 23 companies hiring in India — sourced from AmbitionBox, Glassdoor, and Levels.fyi.",
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
        dangerouslySetInnerHTML={ldJson(faqSchema)}
      />
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
