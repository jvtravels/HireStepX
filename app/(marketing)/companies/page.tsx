import type { Metadata } from "next";
import Script from "next/script";
import Link from "next/link";
import { SEO_PAGES } from "../../../data/seo-pages";
import { COMPANY_LABEL as ALL_LABELS } from "../../../data/company-labels";
import { breadcrumb, ldJson } from "@/marketing-v2/_schema";
import { NavV2, MobileStickyCTA } from "@/marketing-v2/HomepageV2";
import { FooterDome } from "@/marketing-v2/FooterDome";
import { tokens as t, fonts } from "@/auth/_tokens";
import {
  editorialCSS,
  DarkBand,
  ctaPrimaryStyle,
} from "@/marketing-v2/_editorial";

/* /companies — index / hub page listing all 55+ company interview
 * question sets, grouped by company type.
 *
 * Job: act as the internal linking hub for the entire
 * /companies/[slug] tree. Every anchor from this page is a PageRank
 * signal for the leaf pages. Also targets "company interview
 * questions India 2026" head terms directly.
 *
 * Schema: ItemList (one ListItem per company group) + BreadcrumbList
 */

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Company Interview Questions: All Companies India 2026 | HireStepX",
  description:
    "Interview questions for 200+ companies in India, including TCS, Infosys, Google, Amazon, Flipkart, and Razorpay. Practice with AI voice mock interviews.",
  keywords: [
    "company interview questions India",
    "TCS interview questions 2026",
    "Google interview questions India",
    "Amazon interview questions India",
    "Flipkart interview questions",
    "interview questions all companies India",
  ].join(", "),
  alternates: { canonical: "/companies" },
  openGraph: {
    type: "website",
    title: "Company Interview Questions India 2026 | HireStepX",
    description: "Practice guides for 200+ companies: AI voice mock interviews available free.",
    url: "https://hirestepx.com/companies",
    siteName: "HireStepX",
    locale: "en_IN",
    images: [{ url: "https://hirestepx.com/opengraph-image", width: 1200, height: 630, alt: "HireStepX Company Interview Questions" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Company Interview Questions India 2026 | HireStepX",
    description: "Practice guides for 200+ companies: AI voice mock interviews available free.",
    images: ["https://hirestepx.com/opengraph-image"],
  },
};

/* ── Label maps ─────────────────────────────────────────────────────── */

const COMPANY_LABEL = ALL_LABELS;

const FOCUS_LABEL: Record<string, string> = {
  behavioral: "Behavioural", technical: "Technical", "system-design": "System Design",
  "case-study": "Case Study", "campus-placement": "Campus Placement",
  hr: "HR Round", "salary-negotiation": "Salary Negotiation",
  management: "Management", "government-psu": "Govt / PSU", strategic: "Strategic",
  general: "General", leadership: "Leadership", panel: "Panel", quant: "Quant",
};

/* ── Company groupings ──────────────────────────────────────────────── */
type GroupDef = { id: string; label: string; description: string; companies: string[] };

const GROUPS: GroupDef[] = [
  {
    id: "service-it",
    label: "Service IT",
    description: "India's largest employers. TCS, Infosys, and Wipro alone hire 100,000+ freshers per year. Focus: aptitude, CS fundamentals, HR.",
    companies: ["tcs", "infosys", "wipro", "cognizant", "accenture", "ltimindtree", "hcl", "capgemini", "ibm", "techmahindra", "mphasis", "persistent", "ntt-data", "globallogic", "thoughtworks"],
  },
  {
    id: "indian-product",
    label: "Indian Product",
    description: "Fast-scaling unicorns and product-first startups. Higher pay, harder interviews, more ownership.",
    companies: ["flipkart", "razorpay", "swiggy", "zomato", "phonepe", "paytm", "cred", "zerodha", "meesho", "oyo", "freshworks", "zoho", "nykaa", "mamaearth", "myntra", "bigbasket", "blinkit", "makemytrip", "ixigo", "dream11", "lenskart", "boat", "naukri", "sharechat", "truecaller", "groww", "dmart", "wakefit", "zepto", "udaan"],
  },
  {
    id: "faang",
    label: "FAANG & Global Tech",
    description: "The highest bar in the industry. 3–6 months of preparation needed for a competitive shot.",
    companies: ["google", "amazon", "microsoft", "meta", "apple", "netflix", "linkedin", "adobe", "uber", "stripe", "salesforce", "atlassian", "workday", "servicenow", "vmware", "nvidia", "openai", "anthropic", "perplexity", "postman", "chargebee", "clevertap", "moengage", "inmobi", "druva", "browserstack", "darwinbox"],
  },
  {
    id: "consulting-finance",
    label: "Consulting & Finance",
    description: "Case-study driven hiring with a completely different evaluation framework from tech.",
    companies: ["mckinsey", "bcg", "bain", "deloitte", "goldman", "jpmc", "ey", "kpmg", "pwc"],
  },
  {
    id: "fintech",
    label: "Fintech & WealthTech",
    description: "India's fastest-growing hiring segment. Payments APIs, lending platforms, wealthtech, and neo-banking.",
    companies: ["bajaj-finance", "fibe", "kreditbee", "moneyview", "rupeek", "fi-money", "niyo", "smallcase", "indmoney", "zeta", "nium", "upstox", "angel-one", "jupiter", "navi", "slice", "cashfree", "juspay", "pine-labs", "bharatpe", "acko", "policybazaar", "icici-lombard", "digit"],
  },
  {
    id: "banking",
    label: "Banking & Financial Services",
    description: "Indian private banks, global investment banks, and payments networks.",
    companies: ["hdfc-bank", "icici", "hdfc", "axis", "kotak", "sbi", "barclays", "hsbc", "citi", "deutsche-bank", "bny-mellon", "standard-chartered", "wells-fargo", "morgan-stanley", "mastercard", "visa-india", "fiserv"],
  },
  {
    id: "semiconductor",
    label: "Semiconductor & GCCs",
    description: "Chip design, embedded systems, and large enterprise tech Global Capability Centers.",
    companies: ["intel-india", "qualcomm", "arm-india", "mediatek", "bosch-india", "texas-instruments", "samsung", "samsung-india", "nvidia", "ericsson-india", "nokia-india", "cisco", "oracle", "sap-labs", "siemens-india", "walmart-global-tech", "lowes-india", "target-india"],
  },
  {
    id: "healthcare",
    label: "Healthcare & Diagnostics",
    description: "Health tech platforms at the intersection of clinical data and consumer software.",
    companies: ["apollo-247", "practo", "medibuddy", "tata-1mg", "dr-lal-pathlabs", "metropolis", "star-health", "curefit"],
  },
  {
    id: "logistics",
    label: "Logistics & Quick Commerce",
    description: "India's delivery infrastructure. Real-time systems, routing, and warehouse tech at national scale.",
    companies: ["delhivery", "shadowfax", "shiprocket", "rapido", "blackbuck", "moglix", "ninjacart"],
  },
  {
    id: "edtech",
    label: "EdTech & Skilling",
    description: "Built for India's 300M+ student population. Mobile-first learning at low bandwidth.",
    companies: ["scaler", "vedantu", "unacademy", "byjus", "physicswallah"],
  },
  {
    id: "d2c",
    label: "D2C & Consumer Brands",
    description: "Century-old FMCG giants and digital-native D2C brands hiring tech and analytics talent.",
    companies: ["godrej", "nestle", "hul", "itc", "p&g", "tata-steel", "purplle", "licious", "rebel-foods"],
  },
  {
    id: "ev",
    label: "EV & Mobility",
    description: "India's EV transition driving demand for embedded software and platform engineering.",
    companies: ["ola-electric", "ather-energy", "ola", "cars24", "spinny", "tata-motors", "mahindra", "bajaj"],
  },
  {
    id: "saas",
    label: "B2B SaaS & Dev Tools",
    description: "Global-from-day-one product companies built out of India, with high engineering culture and strong product sense.",
    companies: ["hasura", "gupshup", "exotel", "plivo", "intuit", "mindtickle", "sigmoid", "tracxn", "khatabook", "krutrim", "sarvam"],
  },
  {
    id: "quant",
    label: "Quant & Algo Trading",
    description: "The highest-paying roles in finance. Elite math, coding, and probability under time pressure.",
    companies: ["optiver", "millennium", "jane-street", "de-shaw", "citadel"],
  },
  {
    id: "campus-freshers",
    label: "Campus & Freshers",
    description: "HR round questions that appear in 95%+ of Indian campus drives, with structured answer frameworks for freshers.",
    companies: ["campus"],
  },
];

const GROUPS_PER_PAGE = 30;

export default async function CompaniesIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { headers } = await import("next/headers");
  const nonce = (await headers()).get("x-nonce") ?? "";
  const { page } = await searchParams;
  const pageNum = Math.max(1, parseInt(page ?? "1", 10) || 1);

  /* ── Flatten + paginate the 15 groups — same 30-per-page cap used on
     /questions and /interview-prep, so no single page load ever renders
     more than 30 company cards no matter how large a group is. */
  const groupsWithPages = GROUPS.map((g) => ({
    ...g,
    pages: [...SEO_PAGES.filter((p) => g.companies.includes(p.company))].sort(
      (a, b) => (b.sitemapPriority ?? 0.7) - (a.sitemapPriority ?? 0.7),
    ),
  })).filter((g) => g.pages.length > 0);

  const flat = groupsWithPages.flatMap((g) => g.pages.map((p) => ({ p, id: g.id })));
  const totalCompanyPages = Math.max(1, Math.ceil(flat.length / GROUPS_PER_PAGE));
  const safePage = Math.min(Math.max(1, pageNum), totalCompanyPages);
  const pageSlice = flat.slice((safePage - 1) * GROUPS_PER_PAGE, safePage * GROUPS_PER_PAGE);

  const groupAbsStart: Record<string, number> = {};
  let cursor = 0;
  for (const g of groupsWithPages) {
    groupAbsStart[g.id] = cursor;
    cursor += g.pages.length;
  }
  const groupStartPage = (id: string) => Math.floor(groupAbsStart[id] / GROUPS_PER_PAGE) + 1;
  const companyPageHref = (p: number, anchor?: string) => {
    const qs = p > 1 ? `?page=${p}` : "";
    return `/companies${qs}${anchor ? `#${anchor}` : ""}`;
  };

  const sections: { id: string; pages: typeof SEO_PAGES }[] = [];
  for (const item of pageSlice) {
    const last = sections[sections.length - 1];
    if (last && last.id === item.id) last.pages.push(item.p);
    else sections.push({ id: item.id, pages: [item.p] });
  }
  const globalStartOfPage = (safePage - 1) * GROUPS_PER_PAGE;

  /* ItemList schema — one ListItem per company group */
  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Company Interview Questions: India 2026",
    description: "Curated interview preparation guides for 200+ companies hiring in India",
    numberOfItems: SEO_PAGES.length,
    itemListElement: GROUPS.map((g, gi) => ({
      "@type": "ListItem",
      position: gi + 1,
      name: g.label,
      description: g.description,
      url: `https://hirestepx.com/companies#${g.id}`,
    })),
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      { "@type": "Question", name: "Which companies hire the most freshers in India?", acceptedAnswer: { "@type": "Answer", text: "TCS, Infosys, Wipro, Cognizant, and Accenture collectively hire over 150,000 freshers per year in India. Their interviews focus on aptitude, basic data structures, and HR rounds, with less emphasis on competitive coding than product companies like Flipkart or Razorpay." } },
      { "@type": "Question", name: "How different is a FAANG interview from a Service IT interview?", acceptedAnswer: { "@type": "Answer", text: "Service IT interviews (TCS, Infosys) are primarily aptitude tests, verbal ability, and one or two HR rounds. FAANG interviews (Google, Amazon, Microsoft) require 3–5 rounds of competitive DSA, system design, and behavioral interviews. Most candidates need 3–6 months of dedicated preparation for FAANG." } },
      { "@type": "Question", name: "What is the typical interview process at Indian product companies like Razorpay or Zerodha?", acceptedAnswer: { "@type": "Answer", text: "Indian product companies typically have 4–6 rounds: an online coding assessment, 1–2 DSA rounds, a system design round, an engineering manager round, and an HR round. Behavioral questions follow the STAR method. Preparation time is 6–12 weeks." } },
      { "@type": "Question", name: "How do consulting interviews (McKinsey, BCG, Deloitte) differ from tech interviews?", acceptedAnswer: { "@type": "Answer", text: "Consulting interviews have two main components: fit questions (leadership, teamwork) and case studies (market sizing, profitability analysis, business strategy). There is no coding. The evaluation framework is completely different from tech: verbal fluency and structured reasoning matter most." } },
      { "@type": "Question", name: "Can I use HireStepX to practice for multiple companies?", acceptedAnswer: { "@type": "Answer", text: "Yes. Each company on HireStepX has its own question set tuned to that company's known interview style: TCS NQT aptitude format, Google-style DSA, Amazon's leadership-principle behavioral questions. You get 2 free mock sessions per company and can switch companies any time." } },
    ],
  };

  return (
    <>
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }} />
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={ldJson(breadcrumb([{ name: "Companies", path: "/companies" }]))} />

      <style>{editorialCSS + `
        @media (max-width: 720px) {
          .co-group-split { flex-direction: column !important; gap: 32px !important; }
          .co-group-label { width: 100% !important; }
        }
      `}</style>
      <Script
        async
        src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7810403590527236"
        crossOrigin="anonymous"
        strategy="lazyOnload"
      />
      <NavV2 />
      <main style={{ background: t.cream, color: t.coal, minHeight: "100dvh", fontFamily: fonts.sans }}>

        {/* ── Hero — compact single-column ─────────────────────────── */}
        <header style={{ paddingTop: 72, paddingBottom: 64, borderBottom: `1px solid ${t.line}` }}>
          <div className="ed-container">
            <h1 style={{ fontFamily: fonts.serif, fontSize: "clamp(36px, 4.2vw, 54px)", fontWeight: 400, lineHeight: 1.08, letterSpacing: "-0.024em", color: t.coal, margin: "0 0 20px", maxWidth: "22ch" }}>
              Every company&apos;s interview,{" "}
              <em style={{ fontStyle: "italic", color: t.copper }}>decoded.</em>
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
              <Link href="/signup?source=companies-index" className="ed-cta" style={ctaPrimaryStyle("lg")}>
                Pick a company, start free <span className="ed-cta-arrow" aria-hidden>→</span>
              </Link>
              <span style={{ fontFamily: fonts.sans, fontSize: 14, color: t.inkFaint }}>
                {SEO_PAGES.length} guides · 2 free AI mocks per company
                {totalCompanyPages > 1 && ` · page ${safePage} of ${totalCompanyPages}`}
              </span>
            </div>
          </div>
        </header>

        {/* ── Category nav strip ────────────────────────────────────── */}
        {/* overflowX on the outer div (not the nav) so the constrained block
            width triggers horizontal scroll when 5 tabs exceed the viewport. */}
        <div style={{ position: "relative", borderBottom: `1px solid ${t.line}`, background: t.creamSoft }}>
          {/* Right fade signals horizontal scroll on narrower viewports */}
          <div aria-hidden style={{ position: "absolute", right: 0, top: 0, bottom: 1, width: 48, background: `linear-gradient(to right, transparent, ${t.creamSoft})`, pointerEvents: "none", zIndex: 1 }} />
          <div style={{ overflowX: "auto" as const }}>
          <div className="ed-container">
            <nav aria-label="Browse company categories" style={{ display: "flex", gap: 0 }}>
              {groupsWithPages.map((group, gi) => {
                const hint = group.companies
                  .filter((c) => SEO_PAGES.some((p) => p.company === c))
                  .slice(0, 2)
                  .map((c) => COMPANY_LABEL[c] ?? c)
                  .join(" · ");
                return (
                  <Link
                    key={group.id}
                    href={companyPageHref(groupStartPage(group.id), group.id)}
                    className="ed-cta ed-tab"
                    style={{ display: "flex", flexDirection: "column" as const, gap: 2, padding: "16px 24px 14px", textDecoration: "none", borderRight: gi < groupsWithPages.length - 1 ? `1px solid ${t.line}` : "none", flexShrink: 0, whiteSpace: "nowrap" as const }}
                  >
                    <span style={{ fontFamily: fonts.sans, fontSize: 13, fontWeight: 600, color: t.coal }}>{group.label}</span>
                    <span style={{ fontFamily: fonts.sans, fontSize: 11, color: t.inkFaint }}>{hint} · {group.pages.length}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
          </div>
        </div>

        {/* ── Company groups — paginated, 30 per page ─────────────────── */}
        {sections.map((section) => {
          const group = groupsWithPages.find((g) => g.id === section.id)!;
          const gi = groupsWithPages.indexOf(group);
          const continued = groupAbsStart[section.id] < globalStartOfPage;

          return (
            <section
              key={`${section.id}-${globalStartOfPage}`}
              id={continued ? undefined : section.id}
              className="ed-section ed-reveal"
              style={{
                paddingTop: 80,
                paddingBottom: 80,
                borderBottom: `1px solid ${t.line}`,
                background: t.cream,
                scrollMarginTop: 96,
              }}
            >
              <div className="ed-container">
                <div className="co-group-split" style={{ display: "flex", gap: 64, alignItems: "flex-start" }}>

                  {/* Left panel */}
                  <div className="co-group-label" style={{ flexShrink: 0, width: 256, position: "sticky", top: 24, alignSelf: "flex-start" }}>
                    <p style={{ fontFamily: fonts.sans, fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: t.inkFaint, margin: "0 0 12px" }}>
                      {String(gi + 1).padStart(2, "0")} / {String(groupsWithPages.length).padStart(2, "0")}
                    </p>
                    <h2 style={{ fontFamily: fonts.sans, fontSize: 18, fontWeight: 700, color: t.coal, margin: "0 0 12px", lineHeight: 1.3, letterSpacing: "-0.01em" }}>
                      {group.label}{continued ? " (continued)" : ""}
                    </h2>
                    <p style={{ fontFamily: fonts.sans, fontSize: 14, color: t.inkSoft, lineHeight: 1.65, margin: "0 0 18px" }}>
                      {group.description}
                    </p>
                    <span style={{ fontFamily: fonts.sans, fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: t.copper }}>
                      {group.pages.length} {group.pages.length === 1 ? "guide" : "guides"} total
                    </span>
                  </div>

                  {/* Right: scannable list rows */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {section.pages.map((page, i) => (
                      <Link
                        key={page.slug}
                        href={`/questions/${page.slug}`}
                        className="ed-cta ed-row"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 18,
                          padding: "14px 8px",
                          borderBottom: `1px solid ${t.line}`,
                          textDecoration: "none",
                          margin: "0 -8px",
                        }}
                      >
                        <span aria-hidden style={{ fontFamily: fonts.mono, fontSize: 12, color: t.inkFaint, lineHeight: 1, flexShrink: 0, minWidth: 22 }}>
                          {i + 1}
                        </span>
                        <span style={{ flex: 1, fontFamily: fonts.sans, fontSize: 15, fontWeight: 500, lineHeight: 1.4, color: t.coal }}>
                          {page.searchPhrase}
                        </span>
                        <span style={{ fontFamily: fonts.sans, fontSize: 11, fontWeight: 600, color: t.inkFaint, background: t.creamSoft, border: `1px solid ${t.line}`, borderRadius: 999, padding: "3px 10px", flexShrink: 0, whiteSpace: "nowrap" as const }}>
                          {FOCUS_LABEL[page.focus] ?? page.focus}
                        </span>
                        <span style={{ fontFamily: fonts.sans, fontSize: 13, fontWeight: 600, color: t.copper, flexShrink: 0 }} aria-hidden>→</span>
                      </Link>
                    ))}
                  </div>

                </div>
              </div>
            </section>
          );
        })}

        {/* ── Pagination — 30 companies per page ───────────────────────── */}
        {totalCompanyPages > 1 && (
          <nav
            aria-label="Company directory pages"
            style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, flexWrap: "wrap", padding: "32px 24px" }}
          >
            <span style={{ fontFamily: fonts.sans, fontSize: 13, color: t.inkFaint, marginRight: 10, whiteSpace: "nowrap" }}>
              {flat.length} companies · page {safePage} of {totalCompanyPages}
            </span>

            <Link
              href={companyPageHref(safePage - 1)}
              aria-disabled={safePage === 1}
              tabIndex={safePage === 1 ? -1 : undefined}
              style={{
                fontFamily: fonts.sans, fontSize: 13, fontWeight: 500,
                padding: "8px 16px", borderRadius: 8, border: `1.5px solid ${t.line}`,
                background: safePage === 1 ? t.creamSoft : "#fff",
                color: safePage === 1 ? t.inkFaint : t.coal,
                textDecoration: "none",
                pointerEvents: safePage === 1 ? "none" : "auto",
                opacity: safePage === 1 ? 0.45 : 1,
              }}
            >
              ← Prev
            </Link>

            {Array.from({ length: totalCompanyPages }, (_, i) => i + 1)
              .filter((n) => n === 1 || n === totalCompanyPages || Math.abs(n - safePage) <= 1)
              .reduce<(number | "…")[]>((acc, n) => {
                const prev = acc[acc.length - 1];
                if (typeof prev === "number" && n - prev > 1) acc.push("…");
                acc.push(n);
                return acc;
              }, [])
              .map((n, i) =>
                n === "…" ? (
                  <span key={`e-${i}`} style={{ fontFamily: fonts.sans, fontSize: 13, color: t.inkFaint, padding: "8px 4px" }}>…</span>
                ) : (
                  <Link
                    key={n}
                    href={companyPageHref(n)}
                    aria-current={safePage === n ? "page" : undefined}
                    style={{
                      fontFamily: fonts.sans, fontSize: 13, fontWeight: safePage === n ? 700 : 400,
                      minWidth: 36, height: 36, display: "inline-flex", alignItems: "center", justifyContent: "center",
                      borderRadius: 8, border: `1.5px solid ${safePage === n ? t.copper : t.line}`,
                      background: safePage === n ? t.copper : "#fff",
                      color: safePage === n ? "#fff" : t.coal,
                      textDecoration: "none",
                    }}
                  >
                    {n}
                  </Link>
                ),
              )}

            <Link
              href={companyPageHref(safePage + 1)}
              aria-disabled={safePage === totalCompanyPages}
              tabIndex={safePage === totalCompanyPages ? -1 : undefined}
              style={{
                fontFamily: fonts.sans, fontSize: 13, fontWeight: 500,
                padding: "8px 16px", borderRadius: 8, border: `1.5px solid ${t.line}`,
                background: safePage === totalCompanyPages ? t.creamSoft : "#fff",
                color: safePage === totalCompanyPages ? t.inkFaint : t.coal,
                textDecoration: "none",
                pointerEvents: safePage === totalCompanyPages ? "none" : "auto",
                opacity: safePage === totalCompanyPages ? 0.45 : 1,
              }}
            >
              Next →
            </Link>
          </nav>
        )}

        {/* ── FAQ section — page 1 only, avoids duplicating across pages ── */}
        {safePage === 1 && (
        <section style={{ paddingTop: 80, paddingBottom: 80, borderBottom: `1px solid ${t.line}`, background: t.creamSoft }}>
          <div className="ed-container">
            <p style={{ fontFamily: fonts.sans, fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: t.inkFaint, margin: "0 0 16px" }}>
              FAQ
            </p>
            <h2 style={{ fontFamily: fonts.serif, fontSize: "clamp(26px, 3vw, 36px)", fontWeight: 400, color: t.coal, margin: "0 0 48px", lineHeight: 1.15, letterSpacing: "-0.02em", maxWidth: "32ch" }}>
              Common questions about company interview prep
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 32 }}>
              {[
                {
                  q: "Which companies hire the most freshers in India?",
                  a: "TCS, Infosys, Wipro, Cognizant, and Accenture collectively hire over 150,000 freshers per year in India. Their interviews focus on aptitude, basic data structures, and HR rounds, with less emphasis on competitive coding than product companies like Flipkart or Razorpay.",
                },
                {
                  q: "How different is a FAANG interview from a Service IT interview?",
                  a: "Service IT interviews (TCS, Infosys) are primarily aptitude tests, verbal ability, and one or two HR rounds. FAANG interviews (Google, Amazon, Microsoft) require 3–5 rounds of competitive DSA, system design, and behavioral interviews. Most candidates need 3–6 months of dedicated preparation for FAANG.",
                },
                {
                  q: "What is the typical interview process at Indian product companies like Razorpay or Zerodha?",
                  a: "Indian product companies typically have 4–6 rounds: an online coding assessment, 1–2 DSA rounds, a system design round, an engineering manager round, and an HR round. Behavioral questions follow the STAR method. Preparation time is 6–12 weeks.",
                },
                {
                  q: "How do consulting interviews (McKinsey, BCG, Deloitte) differ from tech interviews?",
                  a: "Consulting interviews have two main components: fit questions (leadership, teamwork, 'tell me about yourself') and case studies (market sizing, profitability analysis, business strategy). There is no coding. The evaluation framework is completely different from tech: verbal fluency and structured reasoning matter most.",
                },
                {
                  q: "Can I use HireStepX to practice for multiple companies?",
                  a: "Yes. Each company on HireStepX has its own question set tuned to that company's known interview style: TCS NQT aptitude format, Google-style DSA, Amazon's leadership-principle behavioral questions. You get 2 free mock sessions per company and can switch companies any time.",
                },
              ].map(({ q, a }, i) => (
                <div key={i} style={{ borderTop: `2px solid ${t.coal}`, paddingTop: 20 }}>
                  <h3 style={{ fontFamily: fonts.sans, fontSize: 15, fontWeight: 700, color: t.coal, margin: "0 0 10px", lineHeight: 1.4 }}>
                    {q}
                  </h3>
                  <p style={{ fontFamily: fonts.sans, fontSize: 14, color: t.inkSoft, lineHeight: 1.7, margin: 0 }}>
                    {a}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
        )}

        {/* ── Closing band ──────────────────────────────────────────── */}
        <DarkBand eyebrow="Reading won't get you hired" title="Pick your company," accent="start answering." videoSrc="/cta.mp4">
          <p style={{ fontFamily: fonts.sans, fontSize: 16, color: t.creamMuted, lineHeight: 1.65, maxWidth: "38ch", margin: 0 }}>
            The AI interviews you in that company&apos;s exact question style, listens to your voice, and scores your answer in two minutes.
          </p>
          <Link href="/signup?source=companies-index-cta" className="ed-cta" style={ctaPrimaryStyle("lg")}>
            Start free: 2 mock interviews <span className="ed-cta-arrow" aria-hidden>→</span>
          </Link>
        </DarkBand>

      </main>
      <FooterDome />
      <MobileStickyCTA />
    </>
  );
}
