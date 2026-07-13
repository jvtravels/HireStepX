import type { Metadata } from "next";
import Link from "next/link";
import { SEO_PAGES } from "../../../data/seo-pages";
import { breadcrumb, ldJson } from "@/marketing-v2/_schema";
import { NavV2, MobileStickyCTA } from "@/marketing-v2/HomepageV2";
import { FooterDome } from "@/marketing-v2/FooterDome";

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
  },
};

/* ── Label maps ─────────────────────────────────────────────────────── */
const COMPANY_LABEL: Record<string, string> = {
  google: "Google", amazon: "Amazon", microsoft: "Microsoft", meta: "Meta",
  apple: "Apple", netflix: "Netflix", linkedin: "LinkedIn", adobe: "Adobe",
  flipkart: "Flipkart", razorpay: "Razorpay", swiggy: "Swiggy", zomato: "Zomato",
  phonepe: "PhonePe", paytm: "Paytm", cred: "CRED", zerodha: "Zerodha",
  meesho: "Meesho", oyo: "OYO", freshworks: "Freshworks", zoho: "Zoho",
  tcs: "TCS", infosys: "Infosys", wipro: "Wipro", cognizant: "Cognizant",
  accenture: "Accenture", ltimindtree: "LTIMindtree", hcl: "HCL",
  capgemini: "Capgemini", ibm: "IBM",
  mckinsey: "McKinsey", bcg: "BCG", bain: "Bain", deloitte: "Deloitte",
  goldman: "Goldman Sachs", jpmc: "JPMorgan",
};

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

  const s = { fontFamily: "var(--font-ui), system-ui, sans-serif" };
  const serif = { fontFamily: "var(--font-display), Georgia, serif" };
  const mono = { fontFamily: "var(--font-mono), monospace" };
  const copper = "#B45309";
  const coal = "#0E0C08";
  const sand = "#6E6759";
  const cream = "#FAF7F0";

  return (
    <>
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }} />
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={ldJson(breadcrumb([{ name: "Companies", path: "/companies" }]))} />

      <NavV2 />
      <main style={{ background: cream, color: coal, minHeight: "100dvh", padding: "48px 24px 80px", ...s }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>

          {/* Eyebrow */}
          <div style={{ ...mono, fontSize: 11, fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase", color: copper, marginBottom: 12 }}>
            {SEO_PAGES.length}+ Company Guides · 2026
          </div>

          {/* H1 */}
          <h1 style={{ ...serif, fontSize: "clamp(28px, 5vw, 44px)", fontWeight: 400, letterSpacing: "-0.015em", lineHeight: 1.12, margin: 0, textWrap: "balance" }}>
            Company Interview Questions, India 2026
          </h1>

          <p style={{ ...serif, fontStyle: "italic", fontSize: 18, lineHeight: 1.55, color: sand, marginTop: 16, maxWidth: 620, textWrap: "balance" }}>
            Each guide covers the exact interview format, real sample questions, coaching frameworks,
            and an AI mock interview tailored to that company.
          </p>

          {/* Search hint + CTA */}
          <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap", alignItems: "center" }}>
            <Link href="/signup?source=companies-index" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: copper, color: cream, textDecoration: "none",
              padding: "12px 22px", borderRadius: 999, fontSize: 14, fontWeight: 500,
            }}>
              Practice any company free — 2 sessions
            </Link>
            <Link href="/interview-prep" style={{
              color: copper, textDecoration: "none", fontSize: 13, fontWeight: 500,
            }}>
              Interview prep guide →
            </Link>
          </div>

          {/* Stats bar */}
          <div style={{
            display: "flex", gap: 0, marginTop: 32,
            borderTop: "1px solid rgba(20,17,10,0.08)", borderBottom: "1px solid rgba(20,17,10,0.08)",
            padding: "16px 0",
          }}>
            {[
              { label: "Companies", value: "55+" },
              { label: "Interview formats", value: "7" },
              { label: "Question sets", value: "100+" },
              { label: "Avg. prep time", value: "3–6 wks" },
            ].map((stat, i) => (
              <div key={stat.label} style={{
                flex: 1, textAlign: "center",
                borderRight: i < 3 ? "1px solid rgba(20,17,10,0.06)" : "none",
              }}>
                <div style={{ ...mono, fontSize: 20, fontWeight: 700, color: copper, letterSpacing: "-0.02em" }}>{stat.value}</div>
                <div style={{ fontSize: 11, color: sand, marginTop: 2, textTransform: "uppercase", letterSpacing: "0.06em" }}>{stat.label}</div>
              </div>
            ))}
          </div>

          {/* ── Company groups ────────────────────────────────────────── */}
          {GROUPS.map((group) => {
            const groupPages = SEO_PAGES.filter((p) => group.companies.includes(p.company));
            if (groupPages.length === 0) return null;

            /* Sort: sitemapPriority desc so highest-priority pages appear first */
            const sorted = [...groupPages].sort((a, b) => (b.sitemapPriority ?? 0.7) - (a.sitemapPriority ?? 0.7));

            return (
              <section key={group.id} id={group.id} style={{ marginTop: 52 }}>
                <h2 style={{ ...serif, fontSize: 24, fontWeight: 400, letterSpacing: "-0.01em", margin: "0 0 4px" }}>
                  {group.label}
                </h2>
                <p style={{ fontSize: 13, color: sand, margin: "0 0 18px", lineHeight: 1.6, maxWidth: 600 }}>
                  {group.description}
                </p>

                <ul style={{
                  listStyle: "none", padding: 0, margin: 0,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                  gap: 8,
                }}>
                  {sorted.map((page) => (
                    <li key={page.slug}>
                      <Link
                        href={`/companies/${page.slug}`}
                        style={{
                          display: "block", padding: "14px 16px",
                          background: "#FEFCF8",
                          border: "1px solid rgba(20,17,10,0.08)",
                          borderRadius: 10, textDecoration: "none", color: coal,
                          transition: "border-color 0.15s",
                        }}
                      >
                        {/* Company + focus pill */}
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                          <span style={{
                            ...mono, fontSize: 10, fontWeight: 700,
                            letterSpacing: "0.08em", textTransform: "uppercase", color: copper,
                          }}>
                            {COMPANY_LABEL[page.company] ?? page.company}
                          </span>
                          <span style={{
                            fontSize: 10, color: sand,
                            background: "rgba(110,103,89,0.10)", borderRadius: 4,
                            padding: "1px 6px", textTransform: "capitalize",
                          }}>
                            {FOCUS_LABEL[page.focus] ?? page.focus}
                          </span>
                        </div>

                        {/* Search phrase as link text */}
                        <div style={{
                          ...serif, fontSize: 14, lineHeight: 1.4, color: coal,
                          fontStyle: "italic",
                        }}>
                          {page.searchPhrase}
                        </div>

                        {/* Framework name */}
                        <div style={{ fontSize: 11, color: sand, marginTop: 4 }}>
                          Framework: {page.framework.name}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}

          {/* ── Browse all question sets ──────────────────────────────── */}
          <section style={{ marginTop: 52 }}>
            <h2 style={{ ...serif, fontSize: 22, fontWeight: 400, letterSpacing: "-0.01em", margin: "0 0 12px" }}>
              Browse by question type
            </h2>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                { label: "Campus Placement", href: "/questions?focus=campus-placement" },
                { label: "Technical DSA", href: "/questions?focus=technical" },
                { label: "System Design", href: "/questions?focus=system-design" },
                { label: "Behavioural", href: "/questions?focus=behavioral" },
                { label: "Case Study", href: "/questions?focus=case-study" },
                { label: "HR Round", href: "/questions?focus=hr" },
                { label: "All questions", href: "/questions" },
              ].map((tag) => (
                <Link key={tag.href} href={tag.href} style={{
                  display: "inline-block",
                  padding: "8px 16px", fontSize: 13, fontWeight: 500,
                  background: "#F4EFE3", color: coal, borderRadius: 999,
                  textDecoration: "none", border: "1px solid rgba(20,17,10,0.06)",
                }}>
                  {tag.label}
                </Link>
              ))}
            </div>
          </section>

          {/* ── Bottom CTA ───────────────────────────────────────────── */}
          <section style={{
            marginTop: 52, padding: "28px 24px",
            background: "#F4EFE3", borderRadius: 14, textAlign: "center",
          }}>
            <h2 style={{ ...serif, fontSize: 22, fontWeight: 400, margin: 0, letterSpacing: "-0.01em" }}>
              Pick your company. Start practicing.
            </h2>
            <p style={{ fontSize: 13, color: sand, margin: "8px 0 16px", lineHeight: 1.5, maxWidth: 440, marginInline: "auto" }}>
              The AI interviews you with that company&apos;s exact question style, listens to your voice,
              and scores your answer on structure and specificity.
            </p>
            <Link href="/signup?source=companies-index-cta" style={{
              display: "inline-flex", alignItems: "center",
              background: copper, color: cream, textDecoration: "none",
              padding: "12px 24px", borderRadius: 999, fontSize: 14, fontWeight: 500,
            }}>
              Start free — 2 mock interviews →
            </Link>
          </section>

        </div>
      </main>
      <FooterDome />
      <MobileStickyCTA />
    </>
  );
}
