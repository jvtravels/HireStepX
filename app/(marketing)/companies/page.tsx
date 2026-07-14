import type { Metadata } from "next";
import Link from "next/link";
import { SEO_PAGES } from "../../../data/seo-pages";
import { breadcrumb, ldJson } from "@/marketing-v2/_schema";
import { NavV2, MobileStickyCTA } from "@/marketing-v2/HomepageV2";
import { FooterDome } from "@/marketing-v2/FooterDome";
import { tokens as t, fonts } from "@/auth/_tokens";
import { COMPANY_LABEL } from "../../../data/company-labels";
import {
  editorialCSS,
  EditorialHero,
  SectionHead,
  DarkBand,
  ctaPrimaryStyle,
  ctaGhostStyle,
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

        <EditorialHero
          eyebrow="Company interview prep · India 2026"
          titleLead="Every company's interview,"
          accent="decoded."
          lead="Fifty-plus hiring guides. Each one lays out the exact interview format, real questions candidates were asked, the framework that scores, and an AI mock tailored to that company."
        >
          <Link href="/signup?source=companies-index" className="ed-cta" style={ctaPrimaryStyle("lg")}>
            Practice any company free <span className="ed-cta-arrow" aria-hidden>→</span>
          </Link>
          <Link href="/interview-prep" style={ctaGhostStyle("lg")}>
            Interview prep guide
          </Link>
        </EditorialHero>

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
                background: gi % 2 === 1 ? t.creamSoft : t.cream,
              }}
            >
              <div className="ed-container">
                {/* Two-column: editorial anchor left, card grid right */}
                <div className="co-group-split" style={{ display: "flex", gap: 64, alignItems: "flex-start" }}>

                  {/* Left panel — sticky anchor */}
                  <div className="co-group-label" style={{ flexShrink: 0, width: 256 }}>
                    <span style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: 72, color: t.copper, opacity: 0.25, lineHeight: 1, display: "block", marginBottom: 16 }}>
                      {gi + 1}
                    </span>
                    <h2 style={{ fontFamily: fonts.sans, fontSize: 18, fontWeight: 700, color: t.coal, margin: "0 0 12px", lineHeight: 1.3, letterSpacing: "-0.01em" }}>
                      {group.label}
                    </h2>
                    <p style={{ fontFamily: fonts.sans, fontSize: 14, color: t.inkSoft, lineHeight: 1.65, margin: "0 0 18px" }}>
                      {group.description}
                    </p>
                    <span style={{ fontFamily: fonts.sans, fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: t.inkFaint }}>
                      {sorted.length} {sorted.length === 1 ? "guide" : "guides"}
                    </span>
                  </div>

                  {/* Right: card grid */}
                  <div style={{ flex: 1, minWidth: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                    {sorted.map((page) => (
                      <Link
                        key={page.slug}
                        href={`/questions/${page.slug}`}
                        className="ed-card ed-cta"
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 10,
                          padding: "20px 22px",
                          background: "transparent",
                          border: `1px solid ${t.line}`,
                          borderRadius: 14,
                          textDecoration: "none",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontFamily: fonts.sans, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: t.copper }}>
                            {COMPANY_LABEL[page.company] ?? page.company}
                          </span>
                          <span style={{ fontFamily: fonts.sans, fontSize: 10, fontWeight: 600, color: t.inkFaint, background: t.creamSoft, border: `1px solid ${t.lineStrong}`, borderRadius: 999, padding: "2px 8px", textTransform: "capitalize" as const }}>
                            {FOCUS_LABEL[page.focus] ?? page.focus}
                          </span>
                        </div>
                        <span style={{ fontFamily: fonts.serif, fontSize: 17, lineHeight: 1.35, color: t.coal, letterSpacing: "-0.01em", flex: 1 }}>
                          {page.searchPhrase}
                        </span>
                        <span style={{ fontFamily: fonts.sans, fontSize: 12, fontWeight: 600, color: t.copper, display: "inline-flex", alignItems: "center", gap: 5 }}>
                          Prepare <span className="ed-cta-arrow" aria-hidden>→</span>
                        </span>
                      </Link>
                    ))}
                  </div>

                </div>
              </div>
            </section>
          );
        })}

        {/* ── Browse by question type ───────────────────────────────── */}
        <section className="ed-section ed-reveal" style={{ paddingTop: 76, paddingBottom: 76 }}>
          <div className="ed-container">
            <SectionHead
              eyebrow="Or start from the format"
              title="Browse by question type"
            />
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {[
                { label: "Campus Placement", href: "/questions?focus=campus-placement" },
                { label: "Technical DSA", href: "/questions?focus=technical" },
                { label: "System Design", href: "/questions?focus=system-design" },
                { label: "Behavioural", href: "/questions?focus=behavioral" },
                { label: "Case Study", href: "/questions?focus=case-study" },
                { label: "HR Round", href: "/questions?focus=hr" },
                { label: "All questions", href: "/questions" },
              ].map((tag) => (
                <Link key={tag.href} href={tag.href} className="ed-card" style={{
                  display: "inline-block",
                  padding: "11px 18px", fontSize: 14, fontWeight: 600,
                  background: t.white, color: t.coal, borderRadius: 999,
                  textDecoration: "none", border: `1px solid ${t.lineStrong}`,
                  fontFamily: fonts.sans,
                }}>
                  {tag.label}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ── Closing band ──────────────────────────────────────────── */}
        <DarkBand eyebrow="Reading won't get you hired" title="Pick your company," accent="start answering.">
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
