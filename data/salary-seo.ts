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
    questionSlug: "paytm-engineering-interview-questions",
    hubNote: "Listed RSU (NSE/BSE) — volatile stock, solid cash comp",
  },
  {
    slug: "cred",
    searchPhrase: "CRED Software Engineer Salary India 2026",
    metaDescription:
      "CRED salary India 2026 — SDE-1 ₹12–34 LPA, SDE-2 ₹22–60 LPA, senior ₹42–114 LPA. Pre-IPO ESOP. Highest interview bar in Indian fintech. Full comp guide.",
    roles: [
      { roleKey: "software-engineer", label: "Software Engineer" },
      { roleKey: "product-manager", label: "Product Manager" },
      { roleKey: "ux-designer", label: "UX/Product Designer" },
    ],
    questionSlug: "cred-engineering-interview-questions",
    hubNote: "Pre-IPO ESOP — secondary sales have occurred but liquidity not guaranteed",
    sitemapPriority: 0.78,
  },
  {
    slug: "meta",
    searchPhrase: "Meta India Software Engineer Salary 2026",
    metaDescription:
      "Meta India salary 2026 — SWE E4 ₹38–68 LPA, E5 ₹58–95 LPA, E6 ₹90–160 LPA in Bengaluru. RSU vests quarterly (no cliff post-2022). Level calibration and refresher cadence guide.",
    roles: [
      { roleKey: "software-engineer", label: "Software Engineer" },
      { roleKey: "product-manager", label: "Product Manager" },
      { roleKey: "data-scientist", label: "Data Scientist" },
    ],
    questionSlug: "meta-engineering-interview-questions",
    hubNote: "RSU cliff in yr 1 — total comp skews yr 2–4",
    sitemapPriority: 0.82,
  },
  {
    slug: "uber",
    searchPhrase: "Uber India Software Engineer Salary 2026",
    metaDescription:
      "Uber India salary 2026 — SWE entry ₹28–48 LPA, mid ₹45–80 LPA, senior ₹70–130 LPA in Bengaluru. Listed UBER equity explained. CTC breakdown for SWE, PM & ML roles.",
    roles: [
      { roleKey: "software-engineer", label: "Software Engineer" },
      { roleKey: "product-manager", label: "Product Manager" },
      { roleKey: "data-scientist", label: "Data Scientist" },
      { roleKey: "ml-engineer", label: "ML Engineer" },
    ],
    questionSlug: undefined,
    hubNote: "Stock appreciation matters — UBER listed equity",
    sitemapPriority: 0.78,
  },
  {
    slug: "oracle",
    searchPhrase: "Oracle India Software Engineer Salary 2026",
    metaDescription:
      "Oracle India salary 2026 — SWE entry ₹16–28 LPA, mid ₹28–52 LPA, senior ₹50–90 LPA across Bengaluru & Hyderabad. ORCL RSU explained. Enterprise SaaS comp guide.",
    roles: [
      { roleKey: "software-engineer", label: "Software Engineer" },
      { roleKey: "product-manager", label: "Product Manager" },
      { roleKey: "data-analyst", label: "Data Analyst" },
    ],
    questionSlug: undefined,
    hubNote: "ORCL RSU + above-average fixed for enterprise; slower growth than startups",
    sitemapPriority: 0.77,
  },
  {
    slug: "adobe",
    searchPhrase: "Adobe India Software Engineer Salary 2026",
    metaDescription:
      "Adobe India salary 2026 — SWE entry ₹26–44 LPA, mid ₹42–72 LPA, senior ₹68–115 LPA in Noida & Bengaluru. ADBE RSU + ESPP breakdown. Creative Cloud & enterprise CTC guide.",
    roles: [
      { roleKey: "software-engineer", label: "Software Engineer" },
      { roleKey: "product-manager", label: "Product Manager" },
      { roleKey: "ux-designer", label: "UX Designer" },
    ],
    questionSlug: "adobe-engineering-interview-questions",
    hubNote: "ADBE RSU strong historically — creative domain + SaaS comp",
    sitemapPriority: 0.78,
  },
  {
    slug: "atlassian",
    searchPhrase: "Atlassian India Software Engineer Salary 2026",
    metaDescription:
      "Atlassian India salary 2026 — SWE entry ₹24–42 LPA, mid ₹40–70 LPA, senior ₹65–110 LPA in Bengaluru. TEAM stock RSU explained. ITSM & DevTools team CTC breakdown.",
    roles: [
      { roleKey: "software-engineer", label: "Software Engineer" },
      { roleKey: "product-manager", label: "Product Manager" },
      { roleKey: "ux-designer", label: "UX Designer" },
    ],
    questionSlug: undefined,
    hubNote: "TEAM stock volatile post-2022 — verify RSU grant price at offer",
    sitemapPriority: 0.76,
  },
  {
    slug: "groww",
    searchPhrase: "Groww Software Engineer Salary India 2026",
    metaDescription:
      "Groww salary India 2026 — SWE entry ₹14–26 LPA, mid ₹25–48 LPA, senior ₹45–80 LPA. Pre-IPO ESOP at ~$8B valuation. Bengaluru fintech unicorn full CTC guide.",
    roles: [
      { roleKey: "software-engineer", label: "Software Engineer" },
      { roleKey: "product-manager", label: "Product Manager" },
      { roleKey: "data-analyst", label: "Data Analyst" },
    ],
    questionSlug: undefined,
    hubNote: "Pre-IPO ESOP — secondary market trades at ~$8B valuation",
    sitemapPriority: 0.77,
  },
  {
    slug: "zerodha",
    searchPhrase: "Zerodha Software Engineer Salary India 2026",
    metaDescription:
      "Zerodha salary India 2026 — SWE entry ₹12–22 LPA, mid ₹20–38 LPA, senior ₹35–65 LPA. Bootstrapped — no equity, pure cash comp. India's most profitable broker CTC guide.",
    roles: [
      { roleKey: "software-engineer", label: "Software Engineer" },
      { roleKey: "product-manager", label: "Product Manager" },
      { roleKey: "data-analyst", label: "Data Analyst" },
    ],
    questionSlug: "zerodha-engineering-interview-questions",
    hubNote: "Bootstrapped — zero equity, but India's most profitable startup; best fixed pay for this tier",
    sitemapPriority: 0.76,
  },
  {
    slug: "intuit",
    searchPhrase: "Intuit India Software Engineer Salary 2026",
    metaDescription:
      "Intuit India salary 2026 — SWE entry ₹22–38 LPA, mid ₹36–65 LPA, senior ₹60–100 LPA in Bengaluru. INTU RSU explained. Quickbooks & TurboTax engineering CTC guide.",
    roles: [
      { roleKey: "software-engineer", label: "Software Engineer" },
      { roleKey: "product-manager", label: "Product Manager" },
      { roleKey: "data-analyst", label: "Data Analyst" },
    ],
    questionSlug: undefined,
    hubNote: "INTU RSU — strong eng culture, solid total comp for Tier-2 FAANG",
    sitemapPriority: 0.75,
  },
  {
    slug: "walmart-global-tech",
    searchPhrase: "Walmart Global Tech India Software Engineer Salary 2026",
    metaDescription:
      "Walmart Global Tech salary India 2026 — SWE entry ₹22–36 LPA, mid ₹35–62 LPA, senior ₹58–100 LPA in Bengaluru. WMT-listed RSU liquidity guide. Full CTC breakdown.",
    roles: [
      { roleKey: "software-engineer", label: "Software Engineer" },
      { roleKey: "product-manager", label: "Product Manager" },
      { roleKey: "data-analyst", label: "Data Analyst" },
    ],
    questionSlug: undefined,
    hubNote: "WMT stock stable — RSU liquidity is solid for non-FAANG",
    sitemapPriority: 0.75,
  },
  {
    slug: "persistent",
    searchPhrase: "Persistent Systems Software Engineer Salary India 2026",
    metaDescription:
      "Persistent Systems salary India 2026 — SWE fresher ₹5.5–11 LPA, mid ₹11–22 LPA, senior ₹22–40 LPA. Healthcare IT & BFS specialist. Pune & Nagpur CTC guide.",
    roles: [
      { roleKey: "software-engineer", label: "Software Engineer" },
      { roleKey: "business-analyst", label: "Business Analyst" },
      { roleKey: "devops-sre", label: "DevOps / SRE" },
    ],
    questionSlug: undefined,
    hubNote: "Strong in healthcare IT and BFS — above-market for pure IT services",
    sitemapPriority: 0.72,
  },
  {
    slug: "salesforce",
    searchPhrase: "Salesforce India Software Engineer Salary 2026",
    metaDescription:
      "Salesforce India salary 2026 — SWE entry ₹27–38 LPA, mid ₹45–80 LPA, senior ₹75–130 LPA. CRM RSU with annual cliff (unusual). Bengaluru & Hyderabad CTC guide.",
    roles: [
      { roleKey: "software-engineer", label: "Software Engineer" },
      { roleKey: "product-manager", label: "Product Manager" },
      { roleKey: "ux-designer", label: "UX Designer" },
    ],
    hubNote: "CRM RSU vests annually not quarterly — verify vest schedule before signing",
    sitemapPriority: 0.77,
  },
  {
    slug: "oyo",
    searchPhrase: "OYO Software Engineer Salary India 2026",
    metaDescription:
      "OYO salary India 2026 — SWE entry ₹12–24 LPA, mid ₹22–45 LPA, senior ₹40–75 LPA. Pre-IPO ESOP. Travel tech unicorn Gurgaon & Bengaluru CTC guide.",
    roles: [
      { roleKey: "software-engineer", label: "Software Engineer" },
      { roleKey: "product-manager", label: "Product Manager" },
    ],
    questionSlug: "oyo-engineering-interview-questions",
    hubNote: "Pre-IPO ESOP — OYO IPO timeline uncertain; verify ESOP liquidity before signing",
    sitemapPriority: 0.73,
  },
  {
    slug: "nykaa",
    searchPhrase: "Nykaa Software Engineer Salary India 2026",
    metaDescription:
      "Nykaa salary India 2026 — SWE entry ₹10–22 LPA, mid ₹20–42 LPA, senior ₹38–70 LPA. NSE-listed RSU (FSN E-Commerce). Beauty ecommerce + fintech CTC guide.",
    roles: [
      { roleKey: "software-engineer", label: "Software Engineer" },
      { roleKey: "product-manager", label: "Product Manager" },
      { roleKey: "ux-designer", label: "UX Designer" },
    ],
    hubNote: "FSN RSU listed on NSE — check stock trajectory before ESOP value estimates",
    sitemapPriority: 0.73,
  },
  {
    slug: "myntra",
    searchPhrase: "Myntra Software Engineer Salary India 2026",
    metaDescription:
      "Myntra salary India 2026 — SWE entry ₹14–28 LPA, mid ₹26–52 LPA, senior ₹48–85 LPA. ESOP (Flipkart group). Fashion ecommerce engineering Bengaluru CTC guide.",
    roles: [
      { roleKey: "software-engineer", label: "Software Engineer" },
      { roleKey: "product-manager", label: "Product Manager" },
      { roleKey: "ux-designer", label: "UX Designer" },
    ],
    hubNote: "Flipkart-group ESOP — liquidity tied to Flipkart/Walmart exit event",
    sitemapPriority: 0.74,
  },
  {
    slug: "dream11",
    searchPhrase: "Dream11 Software Engineer Salary India 2026",
    metaDescription:
      "Dream11 salary India 2026 — SWE entry ₹18–34 LPA, mid ₹32–62 LPA, senior ₹55–95 LPA. Pre-IPO ESOP. India's top fantasy sports platform Mumbai CTC guide.",
    roles: [
      { roleKey: "software-engineer", label: "Software Engineer" },
      { roleKey: "product-manager", label: "Product Manager" },
      { roleKey: "ml-engineer", label: "ML Engineer" },
    ],
    hubNote: "Pre-IPO ESOP — Dream Sports valued at ~$8B; secondary transactions have occurred",
    sitemapPriority: 0.75,
  },
  {
    slug: "rapido",
    searchPhrase: "Rapido Software Engineer Salary India 2026",
    metaDescription:
      "Rapido salary India 2026 — SWE entry ₹12–24 LPA, mid ₹22–44 LPA, senior ₹38–68 LPA. Pre-IPO ESOP. India's largest bike taxi platform Bengaluru CTC guide.",
    roles: [
      { roleKey: "software-engineer", label: "Software Engineer" },
      { roleKey: "product-manager", label: "Product Manager" },
      { roleKey: "data-analyst", label: "Data Analyst" },
    ],
    hubNote: "Pre-IPO ESOP — Rapido raised Series E in 2024; IPO timeline not announced",
    sitemapPriority: 0.70,
  },
  {
    slug: "icici",
    searchPhrase: "ICICI Bank Software Engineer Salary India 2026",
    metaDescription:
      "ICICI Bank salary India 2026 — IT Analyst entry ₹5–9 LPA, mid ₹12–22 LPA, senior ₹22–40 LPA. No equity. India's 2nd-largest private bank tech team CTC guide.",
    roles: [
      { roleKey: "software-engineer", label: "Software Engineer / IT Analyst" },
      { roleKey: "sales", label: "Relationship Manager" },
    ],
    hubNote: "Banking IT — no equity, but stable employment; domain knowledge of BFSI systems valued",
    sitemapPriority: 0.70,
  },
  /* ── Finance & Quant ─────────────────────────────────────────── */
  {
    slug: "morgan-stanley",
    searchPhrase: "Morgan Stanley India Software Engineer Salary 2026",
    metaDescription:
      "Morgan Stanley India salary 2026 — SWE entry ₹18–28 LPA, mid ₹32–50 LPA, senior ₹55–90 LPA plus RSU. Mumbai technology campus CTC breakdown and negotiation guide.",
    roles: [
      { roleKey: "software-engineer", label: "Software Engineer" },
      { roleKey: "finance", label: "Investment Banking Analyst" },
    ],
    questionSlug: undefined,
    hubNote: "No joining bonus at India offices — negotiate base + RSU cliff schedule",
    sitemapPriority: 0.74,
  },
  {
    slug: "hdfc-bank",
    searchPhrase: "HDFC Bank Salary India 2026",
    metaDescription:
      "HDFC Bank salary India 2026 — Relationship Manager entry ₹4–7 LPA, VP ₹30–60 LPA. Business Analyst ₹6–12 LPA. No equity. India's largest private bank CTC breakdown.",
    roles: [
      { roleKey: "finance", label: "Relationship Manager" },
      { roleKey: "business-analyst", label: "Business Analyst" },
    ],
    questionSlug: undefined,
    hubNote: "No equity — banking stability + variable performance bonus; PF contribution included in CTC",
    sitemapPriority: 0.70,
  },
  {
    slug: "tower-research",
    searchPhrase: "Tower Research Capital India Salary 2026",
    metaDescription:
      "Tower Research Capital India salary 2026 — Quant Researcher entry ₹50–80 LPA, mid ₹80–140 LPA, senior ₹140–240 LPA. Pure cash, no equity. Gurgaon HFT firm CTC guide.",
    roles: [
      { roleKey: "data-scientist", label: "Quantitative Researcher" },
    ],
    questionSlug: undefined,
    hubNote: "Pure cash comp — no equity, heavy performance bonus; highest fresher comp in India for quant",
    sitemapPriority: 0.76,
  },
  {
    slug: "jane-street",
    searchPhrase: "Jane Street India Quant Researcher Salary 2026",
    metaDescription:
      "Jane Street India salary 2026 — Quant Trader/Researcher entry ₹70–130 LPA, mid ₹200–400 LPA. Pure cash + performance bonus. Mumbai. India's highest-paying fresher role for IIT toppers.",
    roles: [
      { roleKey: "data-scientist", label: "Quantitative Researcher / Trader" },
    ],
    questionSlug: undefined,
    hubNote: "Highest comp for India freshers — pure cash, no equity; only 10–15 India hires per year",
    sitemapPriority: 0.78,
  },
  {
    slug: "de-shaw",
    searchPhrase: "DE Shaw India Quant Analyst Salary 2026",
    metaDescription:
      "DE Shaw India salary 2026 — Quant Analyst entry ₹35–60 LPA, mid ₹80–180 LPA. Pure cash + heavy performance bonus. Hyderabad offices. IIT-targeted fresher recruiting guide.",
    roles: [
      { roleKey: "data-scientist", label: "Quantitative Analyst" },
    ],
    questionSlug: undefined,
    hubNote: "Pure cash + heavy performance bonus — no equity at India offices; Hyderabad campus focus",
    sitemapPriority: 0.76,
  },
  /* ── Big Tech Wave 6 ──────────────────────────────────────── */
  {
    slug: "apple",
    searchPhrase: "Apple India Software Engineer Salary 2026",
    metaDescription:
      "Apple India salary 2026 — SWE entry ₹30–44 LPA, mid ₹50–80 LPA, senior ₹85–140 LPA. ML Engineer entry ₹20–51 LPA. Apple Silicon / Apple Intelligence Bengaluru campus RSU guide.",
    roles: [
      { roleKey: "software-engineer", label: "Software Engineer" },
      { roleKey: "ml-engineer", label: "ML Engineer" },
      { roleKey: "firmware-engineer", label: "Firmware Engineer" },
      { roleKey: "product-manager", label: "Product Manager" },
    ],
    questionSlug: undefined,
    hubNote: "No joining bonus at ICT2 — negotiate RSU grant size and first appraisal date in writing",
    sitemapPriority: 0.83,
  },
  {
    slug: "stripe",
    searchPhrase: "Stripe India Software Engineer Salary 2026",
    metaDescription:
      "Stripe India salary 2026 — SWE entry ₹32–48 LPA, mid ₹50–85 LPA, senior ₹85–140 LPA plus RSU. Bengaluru payments infrastructure team CTC and negotiation guide.",
    roles: [
      { roleKey: "software-engineer", label: "Software Engineer" },
      { roleKey: "ml-engineer", label: "ML Engineer" },
    ],
    questionSlug: undefined,
    hubNote: "Writing-clarity bar higher than FAANG peers — Stripe weights culture-fit in offers",
    sitemapPriority: 0.79,
  },
  {
    slug: "databricks",
    searchPhrase: "Databricks India Software Engineer Salary 2026",
    metaDescription:
      "Databricks India salary 2026 — SWE entry ₹35–75 LPA, mid ₹60–100 LPA, senior ₹95–155 LPA. Pre-IPO RSU liquid via tender offers. Bengaluru GCC CTC guide.",
    roles: [
      { roleKey: "software-engineer", label: "Software Engineer" },
      { roleKey: "ml-engineer", label: "ML Engineer" },
      { roleKey: "data-scientist", label: "Data Scientist" },
    ],
    questionSlug: undefined,
    hubNote: "Pre-IPO RSU — confirm next tender offer date before signing; last tender 2024 at ~$50/share",
    sitemapPriority: 0.80,
  },
  /* ── MBB Consulting ──────────────────────────────────────────── */
  {
    slug: "mckinsey",
    searchPhrase: "McKinsey India Consultant Salary 2026",
    metaDescription:
      "McKinsey India salary 2026 — Business Analyst entry ₹16–24 LPA, Associate (post-MBA) ₹32–50 LPA, Engagement Manager ₹60–95 LPA. No equity. India case interview prep.",
    roles: [
      { roleKey: "consultant", label: "Strategy Consultant" },
    ],
    questionSlug: "mckinsey-case-study-interview-questions",
    hubNote: "Base is fixed for MBA entry — negotiate bonus target and early performance review cycle",
    sitemapPriority: 0.80,
  },
  {
    slug: "bcg",
    searchPhrase: "BCG India Consultant Salary 2026",
    metaDescription:
      "BCG India salary 2026 — Associate entry ₹16–24 LPA, Consultant (post-MBA) ₹30–48 LPA, Project Leader ₹55–90 LPA. No equity. BCG case interview prep guide India.",
    roles: [
      { roleKey: "consultant", label: "Strategy Consultant" },
    ],
    questionSlug: "bcg-case-interview-practice",
    hubNote: "BCG bonus ceiling highest among MBB — negotiate performance-bonus cap explicitly at offer stage",
    sitemapPriority: 0.80,
  },
  {
    slug: "bain",
    searchPhrase: "Bain & Company India Consultant Salary 2026",
    metaDescription:
      "Bain & Company India salary 2026 — AC entry ₹16–25 LPA, Consultant (post-MBA) ₹32–52 LPA, Manager ₹60–95 LPA. No equity. Bain case interview prep guide India.",
    roles: [
      { roleKey: "consultant", label: "Strategy Consultant" },
    ],
    questionSlug: undefined,
    hubNote: "Bain India bonus ceiling highest in MBB globally — benchmark against McKinsey before signing",
    sitemapPriority: 0.79,
  },
  /* ── Quick Commerce ────────────────────────────────────────── */
  {
    slug: "zepto",
    searchPhrase: "Zepto Software Engineer Salary India 2026",
    metaDescription:
      "Zepto salary India 2026 — SWE entry ₹22–32 LPA, mid ₹32–50 LPA, senior ₹50–80 LPA. Pre-IPO ESOP. India's fastest-growing quick commerce unicorn. Mumbai CTC guide.",
    roles: [
      { roleKey: "software-engineer", label: "Software Engineer" },
      { roleKey: "operations", label: "Operations Manager" },
    ],
    questionSlug: undefined,
    hubNote: "Pre-IPO ESOP (Series-G ₹70,000 Cr valuation 2024) — IPO expected but timeline not confirmed",
    sitemapPriority: 0.74,
  },
  /* ── AI Companies ───────────────────────────────────────────── */
  {
    slug: "openai",
    searchPhrase: "OpenAI India AI Engineer Salary 2026",
    metaDescription:
      "OpenAI India salary 2026 — AI Engineer mid ₹100–200 LPA, senior ₹200–350 LPA plus RSU. Fewer than 20 India hires per year. Research-quality bar. SF-anchored CTC guide.",
    roles: [
      { roleKey: "ai-engineer", label: "AI Engineer / Researcher" },
    ],
    questionSlug: undefined,
    hubNote: "Research-paper quality bar — fewer than 20 India hires per year; LeetCode prep is insufficient",
    sitemapPriority: 0.79,
  },
  /* ── EdTech ────────────────────────────────────────────────── */
  {
    slug: "unacademy",
    searchPhrase: "Unacademy Software Engineer Salary India 2026",
    metaDescription:
      "Unacademy salary India 2026 — SWE entry ₹8–14 LPA, mid ₹16–26 LPA, senior ₹26–42 LPA. ESOP credibility low post-2024 reset. Bengaluru edtech CTC guide.",
    roles: [
      { roleKey: "software-engineer", label: "Software Engineer" },
      { roleKey: "teacher", label: "Educator / Content Expert" },
    ],
    questionSlug: undefined,
    hubNote: "ESOP credibility low post-2024 reset — negotiate cash-heavy; discount ESOP in offer valuation",
    sitemapPriority: 0.68,
  },
  {
    slug: "physicswallah",
    searchPhrase: "PhysicsWallah Software Engineer Salary India 2026",
    metaDescription:
      "PhysicsWallah (PW) salary India 2026 — SWE entry ₹10–16 LPA, mid ₹18–30 LPA, senior ₹30–48 LPA. ESOP credibility improved post-IPO signal. Most stable edtech employer 2026.",
    roles: [
      { roleKey: "software-engineer", label: "Software Engineer" },
      { roleKey: "teacher", label: "Educator / Content Expert" },
    ],
    questionSlug: undefined,
    hubNote: "Safest ESOP among Indian edtech — PW IPO signal lifted equity credibility vs Unacademy/Byju's",
    sitemapPriority: 0.69,
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
