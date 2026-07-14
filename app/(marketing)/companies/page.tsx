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
          .co-hero-split { flex-direction: column !important; gap: 40px !important; }
          .co-hero-nav { width: 100% !important; }
        }
      `}</style>
      <NavV2 />
      <main style={{ background: t.cream, color: t.coal, minHeight: "100dvh", fontFamily: fonts.sans }}>

        {/* ── Hero — two-column ─────────────────────────────────────── */}
        <header style={{ paddingTop: 96, paddingBottom: 88, borderBottom: `1px solid ${t.line}` }}>
          <div className="ed-container">
            <div className="co-hero-split" style={{ display: "flex", gap: 72, alignItems: "flex-start" }}>

              {/* Left — headline + CTA */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: fonts.sans, fontSize: 11, fontWeight: 700, letterSpacing: "0.13em", textTransform: "uppercase" as const, color: t.copper, margin: "0 0 20px" }}>
                  Company interview prep · India 2026
                </p>
                <h1 style={{ fontFamily: fonts.serif, fontSize: "clamp(40px, 5vw, 62px)", fontWeight: 400, lineHeight: 1.06, letterSpacing: "-0.025em", color: t.coal, margin: "0 0 28px" }}>
                  Every company&apos;s<br />
                  interview,{" "}
                  <em style={{ fontStyle: "italic", color: t.copper }}>decoded.</em>
                </h1>
                <p style={{ fontFamily: fonts.sans, fontStyle: "normal", fontSize: 16, fontWeight: 400, lineHeight: 1.65, color: t.inkSoft, margin: "0 0 36px", maxWidth: "40ch" }}>
                  Format, real questions, scoring framework, and 2 free AI mocks — one guide per company.
                </p>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                  <Link href="/signup?source=companies-index" className="ed-cta" style={ctaPrimaryStyle("lg")}>
                    Pick a company, start free <span className="ed-cta-arrow" aria-hidden>→</span>
                  </Link>
                  <Link href="/questions" style={ctaGhostStyle("lg")}>
                    Browse all guides
                  </Link>
                </div>
              </div>

              {/* Right — browse panel */}
              <nav className="co-hero-nav" aria-label="Browse company categories" style={{ flexShrink: 0, width: 348, background: t.creamSoft, border: `1px solid ${t.line}`, borderRadius: 16, overflow: "hidden" }}>

                {/* Panel header */}
                <div style={{ padding: "22px 24px 18px", borderBottom: `1px solid ${t.line}` }}>
                  <p style={{ fontFamily: fonts.sans, fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: t.inkFaint, margin: "0 0 4px" }}>
                    Browse by category
                  </p>
                  <p style={{ fontFamily: fonts.sans, fontSize: 13, color: t.inkSoft, margin: 0 }}>
                    {SEO_PAGES.length} guides · jump to any section
                  </p>
                </div>

                {/* Category rows */}
                {([
                  { group: GROUPS[0], hint: "TCS · Infosys · Wipro" },
                  { group: GROUPS[1], hint: "Flipkart · Razorpay · Swiggy" },
                  { group: GROUPS[2], hint: "Google · Amazon · Microsoft" },
                  { group: GROUPS[3], hint: "McKinsey · BCG · Deloitte" },
                  { group: GROUPS[4], hint: "HR rounds · Campus drives" },
                ] as const).map(({ group, hint }, gi, arr) => {
                  const count = SEO_PAGES.filter((p) => group.companies.includes(p.company)).length;
                  return (
                    <Link
                      key={group.id}
                      href={`#${group.id}`}
                      className="ed-cta"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "14px 24px",
                        textDecoration: "none",
                        borderBottom: gi < arr.length - 1 ? `1px solid ${t.line}` : "none",
                      }}
                    >
                      <span style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: 15, color: t.copper, opacity: 0.6, lineHeight: 1, flexShrink: 0, width: 16, paddingTop: 1 }}>
                        {gi + 1}
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontFamily: fonts.sans, fontSize: 13, fontWeight: 600, color: t.coal, lineHeight: 1.3 }}>
                          {group.label}
                        </span>
                        <span style={{ display: "block", fontFamily: fonts.sans, fontSize: 11, color: t.inkFaint, lineHeight: 1.4, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {hint}
                        </span>
                      </span>
                      <span style={{ fontFamily: fonts.sans, fontSize: 12, fontWeight: 600, color: t.inkFaint, flexShrink: 0, display: "flex", alignItems: "center", gap: 5 }}>
                        {count} guides <span className="ed-cta-arrow" aria-hidden>→</span>
                      </span>
                    </Link>
                  );
                })}

              </nav>

            </div>
          </div>
        </header>

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
                  <div className="co-group-label" style={{ flexShrink: 0, width: 256 }}>
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

                  {/* Right: card grid */}
                  <div style={{ flex: 1, minWidth: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                    {sorted.map((page) => (
                      <Link
                        key={page.slug}
                        href={`/questions/${page.slug}`}
                        className="ed-card ed-cta"
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 12,
                          padding: "24px 24px",
                          background: t.white,
                          border: `1px solid ${t.line}`,
                          borderRadius: 14,
                          textDecoration: "none",
                        }}
                      >
                        <span style={{ fontFamily: fonts.sans, fontSize: 10, fontWeight: 600, color: t.inkFaint, background: t.creamSoft, border: `1px solid ${t.lineStrong}`, borderRadius: 999, padding: "3px 9px", alignSelf: "flex-start", textTransform: "capitalize" as const }}>
                          {FOCUS_LABEL[page.focus] ?? page.focus}
                        </span>
                        <span style={{ fontFamily: fonts.serif, fontSize: 17, lineHeight: 1.4, color: t.coal, letterSpacing: "-0.01em", flex: 1 }}>
                          {page.searchPhrase}
                        </span>
                        <span style={{ fontFamily: fonts.sans, fontSize: 12, fontWeight: 600, color: t.copper, display: "inline-flex", alignItems: "center", gap: 5 }}>
                          Practice free <span className="ed-cta-arrow" aria-hidden>→</span>
                        </span>
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
