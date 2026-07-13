import type { Metadata } from "next";
import Link from "next/link";
import { SEO_PAGES } from "../../../data/seo-pages";
import { breadcrumb, ldJson } from "@/marketing-v2/_schema";
import { NavV2, MobileStickyCTA } from "@/marketing-v2/HomepageV2";
import { FooterDome } from "@/marketing-v2/FooterDome";
import { tokens as t, fonts } from "@/auth/_tokens";
import { COMPANY_LABEL } from "../../../data/company-labels";

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

  return (
    <>
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }} />
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={ldJson(breadcrumb([{ name: "Companies", path: "/companies" }]))} />

      <NavV2 />
      <main style={{ background: t.cream, color: t.coal, minHeight: "100dvh", padding: "48px 24px 80px", fontFamily: fonts.sans }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>

          {/* H1 */}
          <h1 style={{ fontFamily: fonts.serif, fontSize: "clamp(28px, 5vw, 44px)", fontWeight: 400, letterSpacing: "-0.015em", lineHeight: 1.12, margin: 0, textWrap: "balance" as const, color: t.coal }}>
            Company Interview Questions, India 2026
          </h1>

          <p style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: 18, lineHeight: 1.55, color: t.inkSoft, marginTop: 16, maxWidth: 620, textWrap: "balance" as const }}>
            Each guide covers the exact interview format, real sample questions, coaching frameworks,
            and an AI mock interview tailored to that company.
          </p>

          {/* CTA row */}
          <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap", alignItems: "center" }}>
            <Link href="/signup?source=companies-index" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: t.copper, color: t.cream, textDecoration: "none",
              padding: "14px 22px", borderRadius: 999, fontSize: 14, fontWeight: 500,
              fontFamily: fonts.sans,
            }}>
              Practice any company free — 2 sessions
            </Link>
            <Link href="/interview-prep" style={{ color: t.copper, textDecoration: "none", fontSize: 13, fontWeight: 500, fontFamily: fonts.sans }}>
              Interview prep guide →
            </Link>
          </div>

          {/* ── Company groups ────────────────────────────────────────── */}
          {GROUPS.map((group) => {
            const groupPages = SEO_PAGES.filter((p) => group.companies.includes(p.company));
            if (groupPages.length === 0) return null;

            const sorted = [...groupPages].sort((a, b) => (b.sitemapPriority ?? 0.7) - (a.sitemapPriority ?? 0.7));

            return (
              <section key={group.id} id={group.id} style={{ marginTop: 56 }}>
                <h2 style={{ fontFamily: fonts.serif, fontSize: 26, fontWeight: 400, letterSpacing: "-0.01em", margin: "0 0 6px", color: t.coal }}>
                  {group.label}
                </h2>
                <p style={{ fontFamily: fonts.sans, fontSize: 13, color: t.inkSoft, margin: "0 0 20px", lineHeight: 1.6, maxWidth: 600 }}>
                  {group.description}
                </p>

                <ol role="list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {sorted.map((page, i) => (
                    <li key={page.slug}>
                      <Link
                        href={`/companies/${page.slug}`}
                        style={{
                          display: "flex",
                          gap: 20,
                          padding: "16px 0",
                          borderBottom: `1px solid ${t.line}`,
                          textDecoration: "none",
                          alignItems: "flex-start",
                        }}
                      >
                        <span style={{ fontFamily: fonts.serif, fontSize: 22, color: t.copper, opacity: 0.45, lineHeight: 1, flexShrink: 0, minWidth: 36 }}>
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <span style={{ fontFamily: fonts.sans, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: t.coal }}>
                              {COMPANY_LABEL[page.company] ?? page.company}
                            </span>
                            <span style={{ fontFamily: fonts.sans, fontSize: 10, color: t.inkFaint, background: t.creamSoft, borderRadius: 4, padding: "1px 6px", textTransform: "capitalize" }}>
                              {FOCUS_LABEL[page.focus] ?? page.focus}
                            </span>
                          </div>
                          <span style={{ fontFamily: fonts.serif, fontSize: 15, fontStyle: "italic", lineHeight: 1.4, color: t.coal }}>
                            {page.searchPhrase}
                          </span>
                        </div>
                        <span style={{ fontFamily: fonts.sans, fontSize: 12, fontWeight: 600, color: t.copper, flexShrink: 0, paddingTop: 2, whiteSpace: "nowrap" }}>
                          Prepare →
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </section>
            );
          })}

          {/* ── Browse by question type ───────────────────────────────── */}
          <section style={{ marginTop: 56 }}>
            <h2 style={{ fontFamily: fonts.serif, fontSize: 20, fontWeight: 400, letterSpacing: "-0.01em", margin: "0 0 14px", color: t.coal }}>
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
                  padding: "10px 16px", fontSize: 13, fontWeight: 500,
                  background: t.creamSoft, color: t.coal, borderRadius: 999,
                  textDecoration: "none", border: `1px solid ${t.line}`,
                  fontFamily: fonts.sans,
                }}>
                  {tag.label}
                </Link>
              ))}
            </div>
          </section>

          {/* ── Bottom CTA — editorial split ─────────────────────────── */}
          <section style={{
            marginTop: 72,
            borderTop: `1px solid ${t.lineStrong}`,
            paddingTop: 56,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 40,
            flexWrap: "wrap",
          }}>
            <p style={{ fontFamily: fonts.serif, fontSize: "clamp(32px, 4vw, 54px)", fontWeight: 400, color: t.coal, letterSpacing: "-0.025em", lineHeight: 1.02, maxWidth: "16ch", textWrap: "balance" as const, margin: 0 }}>
              Pick your company,{" "}
              <span style={{ fontStyle: "italic", color: t.copper }}>start practicing</span>.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "flex-start", minWidth: "min(260px, 100%)" }}>
              <p style={{ fontFamily: fonts.sans, fontSize: 15, color: t.inkSoft, lineHeight: 1.6, maxWidth: "36ch", margin: 0 }}>
                The AI interviews you with that company&apos;s exact question style, listens to your voice, and scores your answer in 2 minutes.
              </p>
              <Link href="/signup?source=companies-index-cta" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: fonts.sans, fontSize: 15, fontWeight: 600, padding: "14px 28px", borderRadius: 999, textDecoration: "none", background: t.indigo, color: t.white, flexShrink: 0 }}>
                Start free — 2 mock interviews <span aria-hidden>→</span>
              </Link>
            </div>
          </section>

        </div>
      </main>
      <FooterDome />
      <MobileStickyCTA />
    </>
  );
}
