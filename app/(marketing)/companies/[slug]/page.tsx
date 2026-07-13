import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getSeoPageBySlug, getAllSeoSlugs, SEO_PAGES, type SeoPage } from "../../../../data/seo-pages";
import { QUESTION_BANK, type BankEntry } from "../../../../data/interview-question-bank";
import { BLOG_META } from "@/blog-meta";
import { tokens as t, fonts } from "../../../../src/auth/_tokens";
import { NavV2, MobileStickyCTA } from "@/marketing-v2/HomepageV2";
import { FooterDome } from "@/marketing-v2/FooterDome";
import { COMPANY_LABEL } from "../../../../data/company-labels";

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


const DIFFICULTY_CHIP: Record<string, { background: string; color: string; border: string }> = {
  warmup: { background: t.success100, color: t.success, border: "1px solid rgba(21,128,61,0.15)" },
  standard: { background: t.warning100, color: t.warning, border: `1px solid ${t.warningLine}` },
  intense: { background: t.error100, color: t.error, border: "1px solid rgba(185,28,28,0.15)" },
};
const DIFFICULTY_LABEL: Record<string, string> = { warmup: "Easy", standard: "Medium", intense: "Hard" };

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
  const { headers } = await import("next/headers");
  const nonce = (await headers()).get("x-nonce") ?? "";
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
    dateModified: "2026-07-12",
    inLanguage: "en-IN",
  };

  /* Deep-link into the interview setup with company + role pre-filled
     so the user can practice immediately. */
  const practiceHref = `/signup?source=seo&company=${encodeURIComponent(page.company)}&focus=${encodeURIComponent(page.focus)}${page.roleFamily ? `&role=${encodeURIComponent(page.roleFamily)}` : ""}`;

  /* BreadcrumbList — helps Google display the site hierarchy in search
     results. Cheap signal, high visible impact. */
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://hirestepx.com" },
      { "@type": "ListItem", position: 2, name: "Companies", item: "https://hirestepx.com/companies" },
      { "@type": "ListItem", position: 3, name: page.searchPhrase, item: `https://hirestepx.com/companies/${slug}` },
    ],
  };

  /* Course List schema — earns Google SERP carousel (education
     intent). Requires 3+ Course items from same provider. */
  const courseListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${companyLabel} ${focusLabel} Interview Preparation`,
    description: `Structured practice modules to prepare for ${companyLabel} ${focusLabel.toLowerCase()} interviews.`,
    itemListElement: [
      {
        "@type": "ListItem", position: 1,
        item: {
          "@type": "Course",
          name: `${companyLabel} Interview Overview & Process`,
          description: `Understand ${companyLabel}'s hiring process, interview rounds, and what evaluators look for.`,
          provider: { "@type": "Organization", name: "HireStepX", sameAs: "https://hirestepx.com" },
          educationalLevel: "Intermediate",
          url: `https://hirestepx.com/companies/${slug}`,
        },
      },
      {
        "@type": "ListItem", position: 2,
        item: {
          "@type": "Course",
          name: `${focusLabel} Practice Questions — ${companyLabel} Style`,
          description: `Practice ${questions.length} real ${focusLabel.toLowerCase()} questions asked at ${companyLabel} with AI-graded feedback.`,
          provider: { "@type": "Organization", name: "HireStepX", sameAs: "https://hirestepx.com" },
          educationalLevel: "Intermediate",
          url: `https://hirestepx.com/questions/${slug}`,
        },
      },
      {
        "@type": "ListItem", position: 3,
        item: {
          "@type": "Course",
          name: `${page.framework.name} Framework — Applied`,
          description: `Apply the ${page.framework.name} framework to ${companyLabel} interview scenarios with structured AI coaching.`,
          provider: { "@type": "Organization", name: "HireStepX", sameAs: "https://hirestepx.com" },
          educationalLevel: "Intermediate",
          url: practiceHref,
        },
      },
    ],
  };

  return (
    <>
      {/* Schema injection — placed at top so crawlers see them quickly. */}
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(courseListSchema) }} />

      <NavV2 />
      <main style={{ background: t.cream, color: t.coal, minHeight: "100dvh", fontFamily: fonts.sans }}>
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "56px 24px 96px" }}>

          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" style={{ fontFamily: fonts.sans, fontSize: 13, color: t.inkFaint, marginBottom: 32 }}>
            <Link href="/" style={{ color: t.inkFaint, textDecoration: "none" }}>Home</Link>
            {" / "}
            <Link href="/companies" style={{ color: t.inkFaint, textDecoration: "none" }}>Companies</Link>
            {" / "}
            <span aria-current="page" style={{ color: t.coal }}>{companyLabel}</span>
          </nav>

          {/* H1 mirrors searchPhrase exactly */}
          <h1 style={{ fontFamily: fonts.serif, fontSize: "clamp(30px, 5vw, 48px)", fontWeight: 400, letterSpacing: "-0.02em", lineHeight: 1.1, color: t.coal, margin: "12px 0 0", textWrap: "balance" as const }}>
            {page.searchPhrase}
          </h1>

          {/* Hand-written intro */}
          <p style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: 18, lineHeight: 1.6, color: t.inkSoft, marginTop: 20, marginBottom: 0, maxWidth: "68ch", textWrap: "balance" as const }}>
            {page.intro}
          </p>

          {/* Primary CTA */}
          <div style={{ display: "flex", gap: 12, marginTop: 28, flexWrap: "wrap", alignItems: "center" }}>
            <Link href={practiceHref} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: t.copper, color: t.cream, textDecoration: "none", padding: "14px 22px", borderRadius: 999, fontFamily: fonts.sans, fontSize: 15, fontWeight: 600 }}>
              Practice this interview free →
            </Link>
            <span style={{ color: t.inkFaint, fontFamily: fonts.sans, fontSize: 14 }}>
              2 sessions, no credit card
            </span>
          </div>

          {/* Framework */}
          <section style={{ marginTop: 48 }}>
            <p style={{ fontFamily: fonts.sans, fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: t.copper, margin: "0 0 10px" }}>
              Framework to use
            </p>
            <h2 style={{ fontFamily: fonts.serif, fontSize: 24, fontWeight: 400, letterSpacing: "-0.01em", margin: "0 0 10px", color: t.coal }}>
              {page.framework.name}
            </h2>
            <p style={{ fontFamily: fonts.sans, fontSize: 15, lineHeight: 1.65, color: t.inkSoft, margin: 0 }}>
              {page.framework.summary}
            </p>
          </section>

          {/* Recruitment Process */}
          {page.recruitmentSteps && page.recruitmentSteps.length > 0 && (
            <>
              <hr style={{ border: 0, borderTop: `1px solid ${t.line}`, margin: "40px 0" }} />
              <section>
                <h2 style={{ fontFamily: fonts.serif, fontSize: 26, fontWeight: 400, letterSpacing: "-0.01em", margin: "0 0 6px", color: t.coal }}>
                  {companyLabel} Recruitment Process
                </h2>
                <p style={{ fontFamily: fonts.sans, fontSize: 14, color: t.inkFaint, margin: "0 0 20px", lineHeight: 1.6 }}>
                  Typical timeline from application to offer.
                </p>
                <ol role="list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {page.recruitmentSteps.map((step, i) => (
                    <li key={i} style={{ display: "flex", gap: 20, padding: "16px 0", borderBottom: `1px solid ${t.line}` }}>
                      <span style={{ fontFamily: fonts.serif, fontSize: 24, fontWeight: 400, color: t.copper, lineHeight: 1, flexShrink: 0, minWidth: 32, opacity: 0.65 }}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span style={{ fontFamily: fonts.sans, fontSize: 15, lineHeight: 1.55, color: t.coal, paddingTop: 4 }}>
                        {step}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            </>
          )}

          {/* Interview Rounds */}
          {page.interviewRounds && page.interviewRounds.length > 0 && (
            <>
              <hr style={{ border: 0, borderTop: `1px solid ${t.line}`, margin: "40px 0" }} />
              <section>
                <h2 style={{ fontFamily: fonts.serif, fontSize: 26, fontWeight: 400, letterSpacing: "-0.01em", margin: "0 0 20px", color: t.coal }}>
                  Interview Rounds
                </h2>
                <ol role="list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {page.interviewRounds.map((round, i) => (
                    <li key={i} style={{ display: "flex", gap: 20, padding: "16px 0", borderBottom: `1px solid ${t.line}` }}>
                      <span style={{ fontFamily: fonts.serif, fontSize: 24, fontWeight: 400, color: t.copper, lineHeight: 1, flexShrink: 0, minWidth: 32, opacity: 0.65 }}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span style={{ fontFamily: fonts.sans, fontSize: 14, lineHeight: 1.6, color: t.coal, paddingTop: 4 }}>
                        {round}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            </>
          )}

          {/* Question list */}
          <hr style={{ border: 0, borderTop: `1px solid ${t.line}`, margin: "40px 0" }} />
          <section>
            <h2 style={{ fontFamily: fonts.serif, fontSize: 26, fontWeight: 400, letterSpacing: "-0.01em", margin: "0 0 8px", color: t.coal }}>
              Real {focusLabel.toLowerCase()} questions {companyLabel} asked
            </h2>
            <p style={{ fontFamily: fonts.sans, fontSize: 14, color: t.inkFaint, margin: "0 0 24px", lineHeight: 1.6 }}>
              Verified from candidate post-mortems. Click Practice to answer with AI voice feedback.
            </p>
            <ol role="list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {questions.map((q, i) => (
                <li key={i} style={{ display: "flex", gap: 20, padding: "20px 0", borderBottom: `1px solid ${t.line}` }}>
                  <span style={{ fontFamily: fonts.serif, fontSize: 28, fontWeight: 400, color: t.copper, lineHeight: 1, flexShrink: 0, minWidth: 38, opacity: 0.55 }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {q.difficulty && (
                      <span style={{ ...DIFFICULTY_CHIP[q.difficulty], fontFamily: fonts.sans, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, padding: "2px 8px", borderRadius: 999, display: "inline-block", marginBottom: 8 }}>
                        {DIFFICULTY_LABEL[q.difficulty] ?? q.difficulty}
                      </span>
                    )}
                    <p style={{ fontFamily: fonts.serif, fontSize: 17, lineHeight: 1.5, color: t.coal, margin: 0 }}>
                      {q.text}
                    </p>
                    {q.styleNote && (
                      <p style={{ fontFamily: fonts.sans, fontSize: 12, fontStyle: "italic", color: t.inkSoft, margin: "8px 0 0" }}>
                        {q.styleNote}
                      </p>
                    )}
                  </div>
                  <Link href={practiceHref} style={{ flexShrink: 0, color: t.copper, textDecoration: "none", fontFamily: fonts.sans, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", padding: "8px 0 8px 12px" }}>
                    Practice →
                  </Link>
                </li>
              ))}
            </ol>
          </section>

          {/* Bottom CTA — blog-style editorial split */}
          <div style={{ marginTop: 88, borderTop: `1px solid ${t.lineStrong}`, paddingTop: 56, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 40, flexWrap: "wrap" }}>
            <p style={{ fontFamily: fonts.serif, fontSize: "clamp(32px, 4vw, 54px)", fontWeight: 400, color: t.coal, letterSpacing: "-0.025em", lineHeight: 1.02, maxWidth: "16ch", textWrap: "balance" as const, margin: 0 }}>
              Stop just reading,{" "}
              <span style={{ fontStyle: "italic", color: t.copper }}>start answering</span>.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "flex-start", minWidth: "min(260px, 100%)" }}>
              <p style={{ fontFamily: fonts.sans, fontSize: 15, color: t.inkSoft, lineHeight: 1.6, maxWidth: "36ch", margin: 0 }}>
                The AI interviewer asks {companyLabel}-style questions, listens to your voice, and scores your answer in 2 minutes. 2 sessions free, no credit card.
              </p>
              <Link href={practiceHref} style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: fonts.sans, fontSize: 15, fontWeight: 600, padding: "14px 28px", borderRadius: 999, textDecoration: "none", background: t.indigo, color: t.white, flexShrink: 0 }}>
                Practice {companyLabel} interview free <span aria-hidden>→</span>
              </Link>
            </div>
          </div>

          {/* Blog back-links */}
          <RelatedBlogPosts companyLabel={companyLabel} />

          {/* Internal links */}
          <section style={{ marginTop: 40, paddingTop: 24, borderTop: `1px solid ${t.line}` }}>
            <h3 style={{ fontFamily: fonts.sans, fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: t.inkFaint, margin: "0 0 14px" }}>
              Related interview prep
            </h3>
            <RelatedLinks currentSlug={slug} />
          </section>
        </div>
      </main>
      <FooterDome />
      <MobileStickyCTA />
    </>
  );
}

/* Blog back-links — finds articles in BLOG_META that match the company
   label and renders them as readable links. Adds a genuine editorial
   anchor from each company page to the blog cluster. */
function RelatedBlogPosts({ companyLabel }: { companyLabel: string }) {
  const matched = BLOG_META.filter(
    (m) => m.company === companyLabel || m.company === "Campus" && companyLabel === "TCS",
  ).slice(0, 3);
  if (matched.length === 0) return null;
  return (
    <section style={{ marginTop: 40, paddingTop: 24, borderTop: `1px solid ${t.line}` }}>
      <h3 style={{ fontFamily: fonts.sans, fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: t.inkFaint, margin: "0 0 14px" }}>
        In-depth guides
      </h3>
      <ul role="list" style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        {matched.map((m) => (
          <li key={m.slug}>
            <Link href={`/blog/${m.slug}`} style={{ color: t.copper, textDecoration: "none", fontFamily: fonts.sans, fontSize: 14, fontWeight: 500 }}>
              → {m.title}
            </Link>
          </li>
        ))}
      </ul>
    </section>
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
    <ul role="list" style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
      {related.map((p: SeoPage) => (
        <li key={p.slug}>
          <Link href={`/companies/${p.slug}`} style={{ color: t.copper, textDecoration: "none", fontFamily: fonts.sans, fontSize: 14, fontWeight: 500 }}>
            → {p.searchPhrase}
          </Link>
        </li>
      ))}
    </ul>
  );
}
