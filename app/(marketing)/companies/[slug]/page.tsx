import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getSeoPageBySlug, getAllSeoSlugs, SEO_PAGES, type SeoPage } from "../../../../data/seo-pages";
import { QUESTION_BANK, type BankEntry } from "../../../../data/interview-question-bank";

/* Programmatic SEO landing pages — /companies/{slug}.
 *
 * Each URL is a long-tail interview-prep page targeting queries like
 * "Razorpay PM Interview Questions" that AmbitionBox/Glassdoor rank
 * for but don't serve well — they list questions, we let candidates
 * PRACTICE answering them with AI feedback. Different intent, same
 * keyword.
 *
 * Generated at build time via generateStaticParams. Each page has:
 *   • A meaningful H1 mirroring the search phrase
 *   • Hand-written intro paragraph (avoids Helpful Content penalty)
 *   • 4-8 real questions from the curated bank
 *   • One framework hint
 *   • Salary signal (where applicable)
 *   • FAQPage schema (gets you rich snippets in Google mobile)
 *   • CTA deep-linking into the practice flow
 */

const FOCUS_LABEL: Record<string, string> = {
  "behavioral": "Behavioural",
  "technical": "Technical",
  "system-design": "System Design",
  "case-study": "Case Study",
  "campus-placement": "Campus Placement",
  "hr": "HR Round",
  "panel": "Panel Interview",
  "salary-negotiation": "Salary Negotiation",
  "leadership": "Leadership",
  "general": "General",
};

const COMPANY_LABEL: Record<string, string> = {
  google: "Google", amazon: "Amazon", microsoft: "Microsoft", meta: "Meta",
  flipkart: "Flipkart", razorpay: "Razorpay", swiggy: "Swiggy", zomato: "Zomato",
  phonepe: "PhonePe", paytm: "Paytm",
  tcs: "TCS", infosys: "Infosys", wipro: "Wipro",
  uber: "Uber", atlassian: "Atlassian",
};

/* Fetch matching bank entries for a page. Uses tier fallback so pages
   never render with zero questions even if the (company × focus)
   combo has thin coverage. */
function questionsForPage(p: SeoPage): BankEntry[] {
  const exact = QUESTION_BANK.filter(
    (q) => q.company === p.company && q.focus === p.focus && (!p.roleFamily || q.roleFamily === p.roleFamily),
  );
  if (exact.length >= 4) return exact.slice(0, 8);
  /* Fallback 1: drop role constraint, keep company + focus. */
  const noRole = QUESTION_BANK.filter((q) => q.company === p.company && q.focus === p.focus);
  if (noRole.length >= 4) return noRole.slice(0, 8);
  /* Fallback 2: focus only — same focus across companies. */
  const focusOnly = QUESTION_BANK.filter((q) => q.focus === p.focus);
  return focusOnly.slice(0, 8);
}

/* Static params — pre-renders all SEO pages at build time so they're
   served as static HTML for fast LCP + crawl-friendliness. */
export async function generateStaticParams() {
  return getAllSeoSlugs().map((slug) => ({ slug }));
}

/* Per-page metadata — Title + Description + OG + canonical. The title
   mirrors the searchPhrase so SERP CTR is maximized. */
export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const page = getSeoPageBySlug(slug);
  if (!page) return { title: "Not Found" };
  const title = `${page.searchPhrase} — Practice Free | HireStepX`;
  const description = `${page.intro.split(".")[0]}. Practice with AI mock interviews + real-time feedback. 2 free sessions, no credit card.`;
  return {
    title,
    description,
    keywords: page.metaKeywords.join(", "),
    alternates: { canonical: `/companies/${slug}` },
    openGraph: {
      type: "article",
      title,
      description,
      url: `https://hirestepx.com/companies/${slug}`,
      siteName: "HireStepX",
      locale: "en_IN",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

/* The page itself. */
export default async function CompanySeoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = getSeoPageBySlug(slug);
  if (!page) notFound();

  const questions = questionsForPage(page);
  const companyLabel = COMPANY_LABEL[page.company] ?? page.company;
  const focusLabel = FOCUS_LABEL[page.focus] ?? page.focus;

  /* FAQPage schema — gets you the expandable accordion in Google's
     mobile SERP. Single biggest rich-result lever for this kind of
     long-tail page. */
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: questions.map((q) => ({
      "@type": "Question",
      name: q.text,
      acceptedAnswer: {
        "@type": "Answer",
        text: `${page.framework.name}: ${page.framework.summary} Practice this question with HireStepX to get AI-graded feedback on your answer structure, delivery, and specificity.`,
      },
    })),
  };

  /* Article schema — alongside FAQPage, signals "this is editorial
     content" rather than a thin landing page. */
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: page.searchPhrase,
    description: page.intro,
    author: { "@type": "Organization", name: "HireStepX" },
    publisher: { "@type": "Organization", name: "HireStepX", logo: { "@type": "ImageObject", url: "https://hirestepx.com/wordmark.png" } },
    datePublished: "2026-05-05",
    dateModified: "2026-05-05",
    inLanguage: "en-IN",
  };

  /* Deep-link into the interview setup with company + role pre-filled
     so the user can practice immediately. */
  const practiceHref = `/signup?source=seo&company=${encodeURIComponent(page.company)}&focus=${encodeURIComponent(page.focus)}${page.roleFamily ? `&role=${encodeURIComponent(page.roleFamily)}` : ""}`;

  return (
    <>
      {/* Schema injection — placed at top so crawlers see them quickly. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />

      <main style={{
        background: "#FAF7F0", color: "#0E0C08", minHeight: "100dvh",
        fontFamily: "var(--font-ui), system-ui, sans-serif", padding: "48px 24px 80px",
      }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          {/* Eyebrow */}
          <div style={{
            fontFamily: "var(--font-mono), monospace", fontSize: 11, fontWeight: 600,
            letterSpacing: "0.10em", textTransform: "uppercase",
            color: "#B45309", marginBottom: 12,
          }}>
            {companyLabel} · {focusLabel}
          </div>

          {/* H1 mirrors searchPhrase exactly */}
          <h1 style={{
            fontFamily: "var(--font-display), Georgia, serif", fontSize: "clamp(28px, 5vw, 44px)",
            fontWeight: 400, letterSpacing: "-0.015em", lineHeight: 1.15, margin: 0,
            color: "#0E0C08", textWrap: "balance",
          }}>
            {page.searchPhrase}
          </h1>

          {/* Hand-written intro */}
          <p style={{
            fontFamily: "var(--font-display), Georgia, serif", fontStyle: "italic",
            fontSize: 18, lineHeight: 1.55, color: "#3E3A6E", marginTop: 20, textWrap: "balance",
          }}>
            {page.intro}
          </p>

          {/* CTA — primary conversion path */}
          <div style={{ display: "flex", gap: 12, marginTop: 28, flexWrap: "wrap" }}>
            <Link href={practiceHref} style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "#312E81", color: "#FAF7F0", textDecoration: "none",
              padding: "14px 24px", borderRadius: 999,
              fontFamily: "var(--font-ui)", fontSize: 15, fontWeight: 500,
            }}>
              Practice this interview free → 2 sessions, no card
            </Link>
            <Link href="/pricing" style={{
              display: "inline-flex", alignItems: "center",
              color: "#312E81", textDecoration: "none",
              padding: "14px 16px",
              fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 500,
            }}>
              See pricing
            </Link>
          </div>

          {/* Framework callout */}
          <section style={{
            background: "#FFFFFF", border: "1px solid rgba(20,17,10,0.08)",
            borderRadius: 12, padding: "20px 24px", marginTop: 36,
          }}>
            <div style={{
              fontFamily: "var(--font-mono), monospace", fontSize: 10, fontWeight: 700,
              letterSpacing: "0.10em", textTransform: "uppercase", color: "#6E6759",
            }}>
              Framework
            </div>
            <h2 style={{
              fontFamily: "var(--font-display), serif", fontSize: 22, fontWeight: 400,
              margin: "6px 0 8px", letterSpacing: "-0.01em",
            }}>
              {page.framework.name}
            </h2>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: "#3E3A6E", margin: 0 }}>
              {page.framework.summary}
            </p>
          </section>

          {/* Question list — the meat. Each has been verified ≥2x against
              real candidate post-mortems per the seo-pages curation rules. */}
          <section style={{ marginTop: 40 }}>
            <h2 style={{
              fontFamily: "var(--font-display), serif", fontSize: 26, fontWeight: 400,
              letterSpacing: "-0.01em", margin: "0 0 16px",
            }}>
              Real {focusLabel.toLowerCase()} questions {companyLabel} asked
            </h2>
            <p style={{ fontSize: 14, color: "#6E6759", margin: "0 0 20px", lineHeight: 1.6 }}>
              Each question is a starting point. Click <em>Practice</em> to get an AI interviewer
              to ask it conversationally, listen to your answer, and grade you on structure,
              specificity, and delivery — in 2 minutes.
            </p>
            <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
              {questions.map((q, i) => (
                <li key={i} style={{
                  background: "#FFFFFF", border: "1px solid rgba(20,17,10,0.08)",
                  borderRadius: 10, padding: "16px 20px",
                  display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16,
                  flexWrap: "wrap",
                }}>
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <div style={{
                      fontFamily: "var(--font-mono), monospace", fontSize: 10, fontWeight: 600,
                      color: "#A39C8B", marginBottom: 4,
                    }}>
                      Q{i + 1}{q.difficulty ? ` · ${q.difficulty}` : ""}
                    </div>
                    <p style={{
                      fontFamily: "var(--font-display), serif", fontSize: 17, lineHeight: 1.45,
                      color: "#0E0C08", margin: 0,
                    }}>
                      {q.text}
                    </p>
                    {q.styleNote && (
                      <p style={{ fontSize: 12, fontStyle: "italic", color: "#6E6759", marginTop: 8, marginBottom: 0 }}>
                        {q.styleNote}
                      </p>
                    )}
                  </div>
                  <Link href={practiceHref} style={{
                    color: "#312E81", textDecoration: "none", fontSize: 13, fontWeight: 500,
                    fontFamily: "var(--font-ui)", whiteSpace: "nowrap", padding: "6px 0",
                  }}>
                    Practice →
                  </Link>
                </li>
              ))}
            </ol>
          </section>

          {/* Bottom CTA — second chance to convert. */}
          <section style={{
            marginTop: 56, padding: "28px 24px",
            background: "#F4EFE3", borderRadius: 16, textAlign: "center",
          }}>
            <h2 style={{
              fontFamily: "var(--font-display), serif", fontSize: 24, fontWeight: 400,
              margin: 0, letterSpacing: "-0.01em",
            }}>
              Ready to practice {companyLabel}-style questions?
            </h2>
            <p style={{ fontSize: 14, color: "#3E3A6E", margin: "10px 0 18px", lineHeight: 1.5 }}>
              The AI interviewer asks {companyLabel}-style questions, listens to your voice answer,
              and gives you scored feedback in 2 minutes. 2 sessions free.
            </p>
            <Link href={practiceHref} style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "#312E81", color: "#FAF7F0", textDecoration: "none",
              padding: "14px 28px", borderRadius: 999,
              fontFamily: "var(--font-ui)", fontSize: 15, fontWeight: 500,
            }}>
              Start free practice →
            </Link>
          </section>

          {/* Internal links — boosts SEO via crawl graph + helps users
              discover related pages. Show up to 4 sibling pages from
              SEO_PAGES (excluding self). */}
          <section style={{ marginTop: 56, paddingTop: 24, borderTop: "1px solid rgba(20,17,10,0.08)" }}>
            <h3 style={{
              fontFamily: "var(--font-mono), monospace", fontSize: 11, fontWeight: 600,
              letterSpacing: "0.10em", textTransform: "uppercase", color: "#6E6759",
              margin: "0 0 14px",
            }}>
              Related interview prep
            </h3>
            <RelatedLinks currentSlug={slug} />
          </section>
        </div>
      </main>
    </>
  );
}

/* Render up to 4 related SEO pages — same company OR same focus area.
   Internal linking is one of the highest-ROI signals for indexing
   long-tail pages quickly. */
function RelatedLinks({ currentSlug }: { currentSlug: string }) {
  const current = SEO_PAGES.find((p: SeoPage) => p.slug === currentSlug);
  if (!current) return null;
  const related = SEO_PAGES
    .filter((p: SeoPage) =>
      p.slug !== currentSlug &&
      (p.company === current.company || p.focus === current.focus),
    )
    .slice(0, 4);
  if (related.length === 0) return null;
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
      {related.map((p: SeoPage) => (
        <li key={p.slug}>
          <Link href={`/companies/${p.slug}`} style={{
            color: "#312E81", textDecoration: "none", fontSize: 14,
            fontFamily: "var(--font-ui)", fontWeight: 500,
          }}>
            → {p.searchPhrase}
          </Link>
        </li>
      ))}
    </ul>
  );
}
