/**
 * Salary SEO pages — static config for /salary/[company] routes.
 *
 * Each entry drives a dedicated salary page targeting queries like
 * "[Company] salary for software engineers India 2026". All salary
 * numbers are read at render time from COMPANY_SALARY_OVERRIDES and
 * india-salary-bands-2025.ts — this file contains only routing and
 * SEO metadata, never salary figures.
 *
 * Inclusion criteria: company must have an entry in
 * COMPANY_SALARY_OVERRIDES with at least one curated (non-synthetic)
 * band, and a matching entry in COMPANY_KNOWN_FACTS for an accurate
 * one-line description.
 */

import { COMPANY_LABEL } from "./company-labels";

export interface SalarySeoEntry {
  /** Lowercase kebab-case slug — becomes the URL segment. */
  slug: string;
  /** Primary SEO search phrase (≤65 chars ideally). */
  searchPhrase: string;
  /** Meta description (≤155 chars). */
  metaDescription: string;
  /** Which roles to surface in the salary table. */
  roles: Array<{
    roleKey: string;
    label: string;
  }>;
  /** Slug of the matching question page in /questions/, for cross-linking. */
  questionSlug?: string;
  /** Short note shown in the hub page card (plain text, ≤80 chars). */
  hubNote: string;
  /** Optional sitemap priority override (default 0.7). */
  sitemapPriority?: number;
}

export const SALARY_SEO_PAGES: SalarySeoEntry[] = [
  {
    slug: "tcs",
    searchPhrase: "TCS Salary for Freshers India 2026",
    metaDescription:
      "TCS fresher salary ranges for Ninja, Digital, and Prime tracks in India 2026. Verified CTC bands from AmbitionBox, Glassdoor, and TCS NQT disclosures.",
    roles: [
      { roleKey: "software-engineer", label: "Software Engineer" },
      { roleKey: "business-analyst", label: "Business Analyst" },
      { roleKey: "ux-designer", label: "UX Designer" },
    ],
    questionSlug: "tcs-ninja-interview-questions",
    hubNote: "Ninja · Digital · Prime tracks — three CTC bands",
  },
  {
    slug: "infosys",
    searchPhrase: "Infosys Salary for Freshers India 2026",
    metaDescription:
      "Infosys fresher and experienced salary ranges India 2026 — SE to Senior. Verified from AmbitionBox, Glassdoor, and Infosys offer-letter disclosures.",
    roles: [
      { roleKey: "software-engineer", label: "Software Engineer" },
      { roleKey: "business-analyst", label: "Business Analyst" },
    ],
    questionSlug: "infosys-behavioral-interview-questions",
    hubNote: "InStep → Systems Engineer → Technical Lead ladder",
  },
  {
    slug: "wipro",
    searchPhrase: "Wipro Salary for Freshers India 2026",
    metaDescription:
      "Wipro fresher salary India 2026 — NLTH, Elite, and Turbo track CTC ranges. Sourced from AmbitionBox and Wipro offer-letter disclosures.",
    roles: [
      { roleKey: "software-engineer", label: "Software Engineer" },
      { roleKey: "business-analyst", label: "Business Analyst" },
    ],
    questionSlug: "wipro-behavioral-interview-questions",
    hubNote: "NLTH · Elite · Turbo — salary varies by track",
  },
  {
    slug: "razorpay",
    searchPhrase: "Razorpay Software Engineer Salary India 2026",
    metaDescription:
      "Razorpay salary for software engineers, PMs, and data analysts in India 2026. Total CTC ranges from AmbitionBox, Glassdoor, and DRHP filings.",
    roles: [
      { roleKey: "software-engineer", label: "Software Engineer" },
      { roleKey: "product-manager", label: "Product Manager" },
      { roleKey: "data-analyst", label: "Data Analyst" },
      { roleKey: "ux-designer", label: "UX Designer" },
    ],
    questionSlug: "razorpay-engineering-interview-questions",
    hubNote: "ESOP-heavy comp — pre-IPO equity matters",
  },
  {
    slug: "phonepe",
    searchPhrase: "PhonePe Software Engineer Salary India 2026",
    metaDescription:
      "PhonePe salary for SWEs, PMs, and designers India 2026. Total CTC ranges verified from AmbitionBox and Glassdoor India.",
    roles: [
      { roleKey: "software-engineer", label: "Software Engineer" },
      { roleKey: "product-manager", label: "Product Manager" },
      { roleKey: "data-analyst", label: "Data Analyst" },
      { roleKey: "ux-designer", label: "UX Designer" },
    ],
    questionSlug: "phonepe-engineering-interview-questions",
    hubNote: "India's largest UPI app — competitive equity bands",
  },
  {
    slug: "flipkart",
    searchPhrase: "Flipkart Software Engineer Salary India 2026",
    metaDescription:
      "Flipkart salary for SWEs and PMs India 2026. Total CTC bands from AmbitionBox, Glassdoor, and Levels.fyi covering SDE-1 to Principal.",
    roles: [
      { roleKey: "software-engineer", label: "Software Engineer" },
      { roleKey: "product-manager", label: "Product Manager" },
      { roleKey: "data-analyst", label: "Data Analyst" },
    ],
    questionSlug: "flipkart-sde-interview-questions",
    hubNote: "Walmart-owned — RSU + strong bonus structure",
  },
  {
    slug: "swiggy",
    searchPhrase: "Swiggy Software Engineer Salary India 2026",
    metaDescription:
      "Swiggy salary for SWEs and PMs in India 2026. Total CTC ranges from AmbitionBox, Glassdoor, and Swiggy DRHP IPO filings.",
    roles: [
      { roleKey: "software-engineer", label: "Software Engineer" },
      { roleKey: "product-manager", label: "Product Manager" },
      { roleKey: "data-analyst", label: "Data Analyst" },
    ],
    questionSlug: "swiggy-engineering-interview-questions",
    hubNote: "Listed in 2024 — RSU liquidity now available",
  },
  {
    slug: "zomato",
    searchPhrase: "Zomato Software Engineer Salary India 2026",
    metaDescription:
      "Zomato salary for SWEs, PMs, and data roles in India 2026. Verified CTC bands from AmbitionBox, Glassdoor, and Zomato DRHP disclosures.",
    roles: [
      { roleKey: "software-engineer", label: "Software Engineer" },
      { roleKey: "product-manager", label: "Product Manager" },
      { roleKey: "data-analyst", label: "Data Analyst" },
    ],
    questionSlug: "zomato-product-interview-questions",
    hubNote: "Early-movers got significant RSU appreciation",
  },
  {
    slug: "meesho",
    searchPhrase: "Meesho Software Engineer Salary India 2026",
    metaDescription:
      "Meesho salary for SWEs and PMs India 2026. Total CTC ranges from AmbitionBox and Glassdoor — Tier 2/3 e-commerce growth play.",
    roles: [
      { roleKey: "software-engineer", label: "Software Engineer" },
      { roleKey: "product-manager", label: "Product Manager" },
    ],
    questionSlug: "meesho-engineering-interview-questions",
    hubNote: "Listed December 2025 — ESOP liquidity improving",
  },
  {
    slug: "google",
    searchPhrase: "Google Software Engineer Salary India 2026",
    metaDescription:
      "Google software engineer salary in India 2026 — L3 to L6. Total CTC ranges from Levels.fyi and AmbitionBox covering Bengaluru and Hyderabad offices.",
    roles: [
      { roleKey: "software-engineer", label: "Software Engineer" },
      { roleKey: "product-manager", label: "Product Manager" },
      { roleKey: "data-analyst", label: "Data Analyst" },
    ],
    questionSlug: "google-india-engineering-interview-questions",
    hubNote: "RSU + refreshes — total comp compounds fast at Google",
  },
  {
    slug: "amazon",
    searchPhrase: "Amazon Software Engineer Salary India 2026",
    metaDescription:
      "Amazon SDE salary in India 2026 — SDE-1 to SDE-3. Total CTC from Levels.fyi and AmbitionBox covering Bengaluru and Hyderabad.",
    roles: [
      { roleKey: "software-engineer", label: "Software Engineer" },
      { roleKey: "product-manager", label: "Product Manager" },
      { roleKey: "data-analyst", label: "Data Analyst" },
    ],
    questionSlug: "amazon-sde-leadership-principles-interview",
    hubNote: "Signing bonus front-loads year-1 — important for fresher negotiation",
  },
  {
    slug: "microsoft",
    searchPhrase: "Microsoft Software Engineer Salary India 2026",
    metaDescription:
      "Microsoft SWE salary India 2026 — SDE-1 to Principal. Total CTC from Levels.fyi, Glassdoor, and AmbitionBox covering Hyderabad and Bengaluru.",
    roles: [
      { roleKey: "software-engineer", label: "Software Engineer" },
      { roleKey: "product-manager", label: "Product Manager" },
      { roleKey: "data-analyst", label: "Data Analyst" },
    ],
    questionSlug: "microsoft-behavioral-interview-questions",
    hubNote: "RSU + ESPP — some of the highest total comp in India",
  },
  {
    slug: "cognizant",
    searchPhrase: "Cognizant Salary for Freshers India 2026",
    metaDescription:
      "Cognizant salary for freshers and experienced professionals in India 2026. Verified ranges from AmbitionBox and Glassdoor.",
    roles: [
      { roleKey: "software-engineer", label: "Software Engineer" },
      { roleKey: "business-analyst", label: "Business Analyst" },
    ],
    questionSlug: "cognizant-genc-interview-questions",
    hubNote: "GenC, GenC Next, GenC Elevate — three fresher bands",
  },
  {
    slug: "hcl",
    searchPhrase: "HCL Technologies Salary for Freshers India 2026",
    metaDescription:
      "HCL Technologies fresher salary India 2026. Graduate Trainee to Software Engineer bands verified from AmbitionBox and Glassdoor.",
    roles: [
      { roleKey: "software-engineer", label: "Software Engineer" },
      { roleKey: "business-analyst", label: "Business Analyst" },
    ],
    questionSlug: "hcl-freshers-interview-questions",
    hubNote: "HCL TechBee + campus route — know your track",
  },
  {
    slug: "capgemini",
    searchPhrase: "Capgemini Salary for Freshers India 2026",
    metaDescription:
      "Capgemini fresher salary India 2026. Analyst to Consultant bands verified from AmbitionBox and Glassdoor.",
    roles: [
      { roleKey: "software-engineer", label: "Software Engineer" },
      { roleKey: "business-analyst", label: "Business Analyst" },
    ],
    questionSlug: "capgemini-freshers-interview-questions",
    hubNote: "InfraServices vs. Insights & Data track differ",
  },
  {
    slug: "ltimindtree",
    searchPhrase: "LTIMindtree Salary for Freshers India 2026",
    metaDescription:
      "LTIMindtree fresher and mid-level salary India 2026. Engineer to Lead bands from AmbitionBox and Glassdoor.",
    roles: [
      { roleKey: "software-engineer", label: "Software Engineer" },
      { roleKey: "business-analyst", label: "Business Analyst" },
    ],
    questionSlug: "ltimindtree-freshers-interview-questions",
    hubNote: "Post-merger comp standardization still ongoing",
  },
  {
    slug: "freshworks",
    searchPhrase: "Freshworks Software Engineer Salary India 2026",
    metaDescription:
      "Freshworks salary for SWEs in India 2026. Total CTC bands from AmbitionBox and Glassdoor covering Chennai and Bengaluru offices.",
    roles: [
      { roleKey: "software-engineer", label: "Software Engineer" },
      { roleKey: "product-manager", label: "Product Manager" },
    ],
    questionSlug: "freshworks-sde-interview-questions",
    hubNote: "Nasdaq-listed — RSU + modest equity in SaaS scale",
  },
  {
    slug: "zoho",
    searchPhrase: "Zoho Software Engineer Salary India 2026",
    metaDescription:
      "Zoho salary for software engineers in India 2026. Verified ranges from AmbitionBox covering Chennai and Bengaluru offices.",
    roles: [
      { roleKey: "software-engineer", label: "Software Engineer" },
      { roleKey: "product-manager", label: "Product Manager" },
    ],
    questionSlug: "zoho-engineering-interview-questions",
    hubNote: "Bootstrapped — no equity, but stable & above-market fixed",
  },
  {
    slug: "deloitte",
    searchPhrase: "Deloitte India Salary 2026 — Fresher to Manager CTC",
    metaDescription:
      "Deloitte India salary 2026 — Analyst ₹6–11 LPA, Consultant ₹12–22 LPA, Senior Consultant ₹24–32 LPA, Manager ₹35–60 LPA. USI vs Consulting pay difference explained.",
    roles: [
      { roleKey: "software-engineer", label: "Analyst / SWE" },
      { roleKey: "consultant", label: "Consultant" },
      { roleKey: "business-analyst", label: "Business Analyst" },
    ],
    questionSlug: "deloitte-analyst-interview-questions",
    hubNote: "USI vs. Deloitte Consulting — very different comp",
  },
  {
    slug: "accenture",
    searchPhrase: "Accenture Salary for Freshers India 2026",
    metaDescription:
      "Accenture fresher and analyst salary India 2026. Associate Software Engineer to Consultant bands from AmbitionBox and Glassdoor.",
    roles: [
      { roleKey: "software-engineer", label: "Software Engineer" },
      { roleKey: "business-analyst", label: "Business Analyst" },
      { roleKey: "ux-designer", label: "UX Designer" },
    ],
    questionSlug: "accenture-behavioral-interview-questions",
    hubNote: "90-day notice period — plan your timeline early",
  },
  {
    slug: "ibm",
    searchPhrase: "IBM Software Engineer Salary India 2026",
    metaDescription:
      "IBM software engineer salary India 2026 — Band 6 to Band 10. Total CTC ranges from Levels.fyi covering Bengaluru, Hyderabad, and Pune offices.",
    roles: [
      { roleKey: "software-engineer", label: "Software Engineer" },
      { roleKey: "business-analyst", label: "Consultant / BA" },
    ],
    questionSlug: "ibm-consultant-interview-questions",
    hubNote: "RSU-heavy comp — IBM Band 6 fresher starts ₹17-24 LPA",
  },
  {
    slug: "goldman",
    searchPhrase: "Goldman Sachs Salary India 2026",
    metaDescription:
      "Goldman Sachs salary India 2026 — Software Engineer ₹20–110 LPA, IB Analyst ₹48–75 LPA across Bengaluru & Hyderabad. Cash-only comp (no RSU at India offices). Know your band before you negotiate.",
    roles: [
      { roleKey: "software-engineer", label: "Software Engineer / Analyst" },
      { roleKey: "data-scientist", label: "Data Scientist" },
      { roleKey: "business-analyst", label: "Business Analyst" },
      { roleKey: "finance", label: "Finance Analyst" },
    ],
    questionSlug: "goldman-sachs-interview-questions-india",
    hubNote: "No RSU/equity at India offices — total comp is cash-only",
    sitemapPriority: 0.78,
  },
  {
    slug: "jpmc",
    searchPhrase: "JP Morgan Chase (JPMC) Salary India 2026",
    metaDescription:
      "JP Morgan Chase salary India 2026 — Software Engineer ₹14–80 LPA, Business Analyst ₹4–35 LPA across Bengaluru, Mumbai & Hyderabad. No RSU at India offices. Negotiate smarter.",
    roles: [
      { roleKey: "software-engineer", label: "Software Engineer" },
      { roleKey: "data-scientist", label: "Data Scientist" },
      { roleKey: "business-analyst", label: "Business Analyst" },
      { roleKey: "finance", label: "Finance Analyst" },
    ],
    questionSlug: "jpmorgan-interview-questions-india",
    hubNote: "No RSU at India offices — compensation is base + annual bonus",
    sitemapPriority: 0.78,
  },
];

/** Lookup a salary page entry by company slug. */
export function getSalaryPage(slug: string): SalarySeoEntry | undefined {
  return SALARY_SEO_PAGES.find((p) => p.slug === slug);
}

/** All slugs — fed to generateStaticParams. */
export function getAllSalarySlugs(): string[] {
  return SALARY_SEO_PAGES.map((p) => p.slug);
}

/** Display name from company-labels, falling back to title-cased slug. */
export function salaryCompanyLabel(slug: string): string {
  return (
    COMPANY_LABEL[slug] ??
    slug.charAt(0).toUpperCase() + slug.slice(1)
  );
}
