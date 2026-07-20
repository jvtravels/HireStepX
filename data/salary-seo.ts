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
      "TCS fresher salary India 2026 — Ninja track ₹3.4 LPA, Digital ₹7–9 LPA, Prime ₹11.5 LPA. Which band will you land in? Full CTC breakdown by track + negotiation guide.",
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
      "Infosys fresher salary India 2026 — DSE ₹3.6–6.25 LPA, Specialist Programmer up to ₹21 LPA. Know which track you're on before accepting any offer.",
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
      "Wipro salary India 2026 — NLTH / Elite track freshers ₹3.5–6.5 LPA, experienced ₹6–28 LPA. Track comparison and what to negotiate in your offer letter.",
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
      "Razorpay salary India 2026 — SWE entry ₹10–29 LPA, mid ₹25–45 LPA, senior ₹50–70 LPA. Pre-IPO ESOP explained. Verified from Glassdoor, AmbitionBox & DRHP filings.",
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
      "PhonePe salary India 2026 — SWE entry ₹11–31 LPA, mid ₹20–55 LPA, senior ₹38–105 LPA. Pre-IPO ESOP with 4-year vesting. India's largest UPI app comp guide.",
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
      "Flipkart salary India 2026 — SDE-1 ₹12–35 LPA, SDE-2 ₹22–62 LPA, SDE-3 ₹44–119 LPA. ESOP vests over 4 years. Bengaluru & Gurugram negotiation guide.",
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
      "Swiggy salary India 2026 — SDE-1 ₹10–29 LPA, SDE-2 ₹19–52 LPA, SDE-3 ₹37–100 LPA. RSU liquid post-November 2024 IPO. Negotiate your joining bonus and fixed pay.",
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
      "Zomato salary India 2026 — SDE-1 ₹14–22 LPA, SDE-2 ₹24–40 LPA, SDE-3 ₹40–65 LPA. RSU vests over 4 years on a listed stock. Bengaluru comp guide.",
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
      "Meesho salary India 2026 — SDE-1 ₹16–24 LPA, SDE-2 ₹26–42 LPA, SDE-3 ₹42–68 LPA. RSU liquid since December 2025 IPO. Tier-2 e-commerce full comp guide.",
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
      "Google SWE salary India 2026 — L3 ₹30–49 LPA, L4 ₹50–88 LPA, L5 ₹80–130 LPA in Bengaluru. RSU vests 25-25-25-25. Level calibration is your biggest negotiation lever.",
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
      "Amazon SDE salary India 2026 — SDE-1 ₹22–32 LPA, SDE-2 ₹38–65 LPA, SDE-3 ₹65–110 LPA. Back-loaded RSU vesting (5-15-40-40). How to negotiate Y1+Y2 sign-on.",
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
      "Microsoft SWE salary India 2026 — L59/60 ₹28–42 LPA, L61 ₹45–75 LPA, L63 ₹75–120 LPA in Hyderabad. RSU vests over 5 years. Level calibration is the key negotiation lever.",
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
      "Cognizant fresher salary India 2026 — GenC ₹4 LPA, GenC Next ₹6.5 LPA. In-hand ₹28–32K/month. Track comparison and what to expect in your first year.",
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
      "HCL Technologies salary India 2026 — Graduate Trainee ₹3.5–5.5 LPA, mid-level ₹6–14 LPA, senior ₹14–28 LPA. TechBee program CTC breakdown and growth path.",
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
      "Capgemini salary India 2026 — fresher Analyst ₹3.8–6.5 LPA, mid-level ₹7–16 LPA, Senior Consultant ₹16–30 LPA. What to negotiate in your Capgemini offer.",
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
      "LTIMindtree salary India 2026 — fresher Engineer ₹4–7 LPA, mid-level ₹8–18 LPA, senior ₹18–35 LPA. Post-merger pay guide for LTI and Mindtree joiners.",
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
      "Freshworks salary India 2026 — SE entry ₹14–22 LPA, mid ₹22–38 LPA, senior ₹40–70 LPA. Nasdaq-listed RSU is liquid. Chennai & Bengaluru CTC comparison.",
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
      "Zoho salary India 2026 — Software Engineer ₹7.5–21 LPA fresher, ₹13–38 LPA mid-level. No equity — pure cash comp. Chennai & Bengaluru CTC guide.",
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
      "Accenture salary India 2026 — ASE fresher ₹4.5–6.5 LPA, Analyst ₹8–12 LPA, Consultant ₹12–22 LPA. Track comparison and what to negotiate in your offer letter.",
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
      "IBM software engineer salary India 2026 — Band 6 ₹18–24 LPA, Band 7-8 ₹24–38 LPA, Band 9-10 ₹38–65 LPA. Bengaluru, Hyderabad & Pune CTC guide.",
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
  {
    slug: "techmahindra",
    searchPhrase: "Tech Mahindra Salary for Freshers India 2026",
    metaDescription:
      "Tech Mahindra salary India 2026 — ELP fresher ₹4–7 LPA, mid-level ₹8–16 LPA, senior ₹16–28 LPA. 90-day notice period and bond details for new joiners.",
    roles: [
      { roleKey: "software-engineer", label: "Software Engineer" },
      { roleKey: "business-analyst", label: "Business Analyst" },
    ],
    questionSlug: "tech-mahindra-interview-questions-2026",
    hubNote: "ELP (Entry Level Programme) — 90-day notice, ₹50K bond penalty",
  },
  {
    slug: "mphasis",
    searchPhrase: "Mphasis Software Engineer Salary India 2026",
    metaDescription:
      "Mphasis salary India 2026 — SWE fresher ₹4–7 LPA, mid ₹9–18 LPA, senior ₹18–32 LPA. Blackstone-backed IT services firm. Bengaluru & Pune CTC guide.",
    roles: [
      { roleKey: "software-engineer", label: "Software Engineer" },
    ],
    questionSlug: "mphasis-interview-questions-freshers-2026",
    hubNote: "Blackstone ownership since 2016 — stable employer, moderate pay",
  },
  {
    slug: "paytm",
    searchPhrase: "Paytm Software Engineer Salary India 2026",
    metaDescription:
      "Paytm salary India 2026 — SDE-1 ₹12–18 LPA, SDE-2 ₹20–32 LPA, SDE-3 ₹32–52 LPA. Listed RSU. Post-RBI-action business context and negotiation guide.",
    roles: [
      { roleKey: "software-engineer", label: "Software Engineer" },
      { roleKey: "product-manager", label: "Product Manager" },
    ],
    questionSlug: "paytm-interview-questions-india-2026",
    hubNote: "Listed RSU (NSE/BSE) — volatile stock, solid cash comp",
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
