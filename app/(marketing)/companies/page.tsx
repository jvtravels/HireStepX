import type { Metadata } from "next";
import Link from "next/link";
import { SEO_PAGES } from "../../../data/seo-pages";
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
  title: "Company Interview Questions — All Companies India 2026 | HireStepX",
  description:
    "Interview questions and preparation guides for 50+ companies in India — TCS, Infosys, Google, Amazon, Flipkart, Razorpay, McKinsey, and more. Practice with AI voice mock interviews.",
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
    description: "Practice guides for 50+ companies — AI voice mock interviews available free.",
    url: "https://hirestepx.com/companies",
    siteName: "HireStepX",
    locale: "en_IN",
    images: [{ url: "https://hirestepx.com/opengraph-image", width: 1200, height: 630, alt: "HireStepX Company Interview Questions" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Company Interview Questions India 2026 | HireStepX",
    description: "Practice guides for 50+ companies — AI voice mock interviews available free.",
    images: ["https://hirestepx.com/opengraph-image"],
  },
};

/* ── Label maps ─────────────────────────────────────────────────────── */

const FOCUS_LABEL: Record<string, string> = {
  behavioral: "Behavioural", technical: "Technical", "system-design": "System Design",
  "case-study": "Case Study", "campus-placement": "Campus Placement",
  hr: "HR Round", "salary-negotiation": "Salary Negotiation",
};

/* ── Company groupings ──────────────────────────────────────────────── */
type GroupDef = { id: string; label: string; description: string; companies: string[] };

const GROUPS: GroupDef[] = [
  {
    id: "service-it",
    label: "Service IT Companies",
    description: "India's largest employers. TCS, Infosys, and Wipro alone hire 100,000+ freshers per year. Focus: aptitude, CS fundamentals, HR.",
    companies: ["tcs", "infosys", "wipro", "cognizant", "accenture", "ltimindtree", "hcl", "capgemini", "ibm"],
  },
  {
    id: "indian-product",
    label: "Indian Product Companies",
    description: "Fast-scaling unicorns and product-first startups. Higher pay, harder interviews, more ownership.",
    companies: ["flipkart", "razorpay", "swiggy", "zomato", "phonepe", "paytm", "cred", "zerodha", "meesho", "oyo", "freshworks", "zoho"],
  },
  {
    id: "faang",
    label: "FAANG & Global Tech",
    description: "The highest bar in the industry. 3–6 months of preparation needed for a competitive shot.",
    companies: ["google", "amazon", "microsoft", "meta", "apple", "netflix", "linkedin", "adobe"],
  },
  {
    id: "consulting-finance",
    label: "Consulting & Finance",
    description: "Case-study driven hiring with a completely different evaluation framework from tech.",
    companies: ["mckinsey", "bcg", "bain", "deloitte", "goldman", "jpmc"],
  },
  {
    id: "campus-freshers",
    label: "Freshers & Campus HR Prep",
    description: "HR round questions that appear in 95%+ of Indian campus drives — with structured answer frameworks for freshers.",
    companies: ["campus"],
  },
];

export default async function CompaniesIndexPage() {
  const { headers } = await import("next/headers");
  const nonce = (await headers()).get("x-nonce") ?? "";
  /* ItemList schema — one ListItem per company group */
  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Company Interview Questions — India 2026",
    description: "Curated interview preparation guides for 50+ companies hiring in India",
    numberOfItems: SEO_PAGES.length,
    itemListElement: GROUPS.map((g, gi) => ({
      "@type": "ListItem",
      position: gi + 1,
      name: g.label,
      description: g.description,
      url: `https://hirestepx.com/companies#${g.id}`,
    })),
  };

  return (
    <>
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }} />
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={ldJson(breadcrumb([{ name: "Companies", path: "/companies" }]))} />

      <style>{editorialCSS + `
        @media (max-width: 720px) {
          .co-group-split { flex-direction: column !important; gap: 32px !important; }
          .co-group-label { width: 100% !important; }
        }
      `}</style>
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
              </span>
            </div>
          </div>
        </header>

        {/* ── Category nav strip ────────────────────────────────────── */}
        <div style={{ borderBottom: `1px solid ${t.line}`, background: t.creamSoft }}>
          <div className="ed-container">
            <nav aria-label="Browse company categories" style={{ display: "flex", gap: 0, overflowX: "auto" as const }}>
              {([
                { group: GROUPS[0], hint: "TCS · Infosys · Wipro" },
                { group: GROUPS[1], hint: "Flipkart · Razorpay · Swiggy" },
                { group: GROUPS[2], hint: "Google · Amazon · Microsoft" },
                { group: GROUPS[3], hint: "McKinsey · BCG · Deloitte" },
                { group: GROUPS[4], hint: "HR rounds · Campus drives" },
              ] as const).map(({ group, hint }, gi) => {
                const count = SEO_PAGES.filter((p) => group.companies.includes(p.company)).length;
                return (
                  <Link
                    key={group.id}
                    href={`#${group.id}`}
                    className="ed-cta ed-tab"
                    style={{ display: "flex", flexDirection: "column" as const, gap: 2, padding: "16px 24px 14px", textDecoration: "none", borderRight: gi < GROUPS.length - 1 ? `1px solid ${t.line}` : "none", flexShrink: 0, whiteSpace: "nowrap" as const }}
                  >
                    <span style={{ fontFamily: fonts.sans, fontSize: 13, fontWeight: 600, color: t.coal }}>{group.label}</span>
                    <span style={{ fontFamily: fonts.sans, fontSize: 11, color: t.inkFaint }}>{hint} · {count} guides</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        {/* ── Company groups ────────────────────────────────────────── */}
        {GROUPS.map((group, gi) => {
          const groupPages = SEO_PAGES.filter((p) => group.companies.includes(p.company));
          if (groupPages.length === 0) return null;

          const sorted = [...groupPages].sort((a, b) => (b.sitemapPriority ?? 0.7) - (a.sitemapPriority ?? 0.7));

          return (
            <section
              key={group.id}
              id={group.id}
              className="ed-section ed-reveal"
              style={{
                paddingTop: 80,
                paddingBottom: 80,
                borderBottom: `1px solid ${t.line}`,
                background: t.cream,
              }}
            >
              <div className="ed-container">
                <div className="co-group-split" style={{ display: "flex", gap: 64, alignItems: "flex-start" }}>

                  {/* Left panel */}
                  <div className="co-group-label" style={{ flexShrink: 0, width: 256, position: "sticky", top: 24, alignSelf: "flex-start" }}>
                    <p style={{ fontFamily: fonts.sans, fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: t.inkFaint, margin: "0 0 12px" }}>
                      {String(gi + 1).padStart(2, "0")} / {String(GROUPS.length).padStart(2, "0")}
                    </p>
                    <h2 style={{ fontFamily: fonts.sans, fontSize: 18, fontWeight: 700, color: t.coal, margin: "0 0 12px", lineHeight: 1.3, letterSpacing: "-0.01em" }}>
                      {group.label}
                    </h2>
                    <p style={{ fontFamily: fonts.sans, fontSize: 14, color: t.inkSoft, lineHeight: 1.65, margin: "0 0 18px" }}>
                      {group.description}
                    </p>
                    <span style={{ fontFamily: fonts.sans, fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: t.copper }}>
                      {sorted.length} {sorted.length === 1 ? "guide" : "guides"}
                    </span>
                  </div>

                  {/* Right: scannable list rows */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {sorted.map((page, i) => (
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
                        <span style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: 15, color: t.copper, opacity: 0.55, lineHeight: 1, flexShrink: 0, minWidth: 22 }}>
                          {i + 1}
                        </span>
                        <span style={{ flex: 1, fontFamily: fonts.serif, fontSize: 16, lineHeight: 1.35, color: t.coal, letterSpacing: "-0.01em" }}>
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

        {/* ── Closing band ──────────────────────────────────────────── */}
        <DarkBand eyebrow="Reading won't get you hired" title="Pick your company," accent="start answering." videoSrc="/cta.mp4">
          <p style={{ fontFamily: fonts.sans, fontSize: 16, color: t.creamMuted, lineHeight: 1.65, maxWidth: "38ch", margin: 0 }}>
            The AI interviews you in that company&apos;s exact question style, listens to your voice, and scores your answer in two minutes.
          </p>
          <Link href="/signup?source=companies-index-cta" className="ed-cta" style={ctaPrimaryStyle("lg")}>
            Start free — 2 mock interviews <span className="ed-cta-arrow" aria-hidden>→</span>
          </Link>
        </DarkBand>

      </main>
      <FooterDome />
      <MobileStickyCTA />
    </>
  );
}
