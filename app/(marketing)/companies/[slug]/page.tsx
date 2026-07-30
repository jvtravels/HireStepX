import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import Link from "next/link";
import Script from "next/script";
import { getSeoPageBySlug, getAllSeoSlugs, SEO_PAGES, type SeoPage } from "../../../../data/seo-pages";
import { QUESTION_BANK, type BankEntry } from "../../../../data/interview-question-bank";
import { BLOG_META } from "@/blog-meta";
import { tokens as t, fonts } from "../../../../src/auth/_tokens";
import { NavV2, MobileStickyCTA } from "@/marketing-v2/HomepageV2";
import { FooterDome } from "@/marketing-v2/FooterDome";
import { COMPANY_LABEL } from "../../../../data/company-labels";
import {
  editorialCSS,
  edEyebrow,
  edSansLead,
  ED_PADDING,
  SectionHead,
  SpecTimeline,
  DarkBand,
  ctaPrimaryStyle,
} from "@/marketing-v2/_editorial";
import { CompanyContextBox } from "@/marketing-v2/QuestionPages";
import { COMPANY_KNOWN_FACTS } from "../../../../data/company-known-facts";

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
  /* Darkened from t.warning (#A16207) — fails 4.5:1 AA on warning100 at this size/weight. */
  standard: { background: t.warning100, color: "#8F5A00", border: `1px solid ${t.warningLine}` },
  intense: { background: t.error100, color: t.error, border: "1px solid rgba(185,28,28,0.15)" },
};
const DIFFICULTY_LABEL: Record<string, string> = { warmup: "Easy", standard: "Medium", intense: "Hard" };

/* Fetch matching bank entries for a page. Falls back to dropping the
   role-family constraint when a company × focus combo is thin, but never
   crosses into another company's questions — a page must only ever show
   questions actually asked at that company, even if that means fewer
   than 8. */
function questionsForPage(p: SeoPage): BankEntry[] {
  const exact = QUESTION_BANK.filter(
    (q) => q.company === p.company && q.focus === p.focus && (!p.roleFamily || q.roleFamily === p.roleFamily),
  );
  if (exact.length >= 4) return exact.slice(0, 8);
  /* Drop role constraint, keep company + focus. */
  const noRole = QUESTION_BANK.filter((q) => q.company === p.company && q.focus === p.focus);
  return noRole.slice(0, 8);
}

export const revalidate = 86400; /* 24 h ISR — refresh content daily without a full rebuild */
export const dynamicParams = true; /* on-demand render for slugs not in generateStaticParams */

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
  if (!page) {
    const firstForCompany = SEO_PAGES.find(p => p.company === slug);
    if (firstForCompany) return generateMetadata({ params: Promise.resolve({ slug: firstForCompany.slug }) });
    return { title: "Not Found" };
  }
  const title = `${page.searchPhrase} — Practice Free | HireStepX`;
  const description = `${page.intro.split(".")[0]}. Practice with AI mock interviews + real-time feedback. 2 free sessions, no credit card.`;
  return {
    title,
    description,
    keywords: page.metaKeywords.join(", "),
    alternates: { canonical: `/questions/${slug}` },
    openGraph: {
      type: "article",
      title,
      description,
      url: `https://hirestepx.com/questions/${slug}`,
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
  if (!page) {
    /* If slug is a bare company name (e.g. "flipkart"), redirect to the first
       SEO page for that company rather than returning 404. */
    const firstForCompany = SEO_PAGES.find(p => p.company === slug);
    if (firstForCompany) permanentRedirect(`/companies/${firstForCompany.slug}`);
    notFound();
  }

  const questions = questionsForPage(page);
  const companyLabel = COMPANY_LABEL[page.company] ?? page.company;
  const focusLabel = FOCUS_LABEL[page.focus] ?? page.focus;

  /* FAQPage schema — structured Q&A data for Google's understanding.
     Note: FAQ rich results (expandable accordion) were deprecated by
     Google on May 7, 2026. Schema is kept for structured-data signal.
     All Q&A content sourced exclusively from hand-curated fields in
     seo-pages.ts (recruitmentSteps, interviewRounds, framework) —
     no generated or invented company claims. */
  type FaqEntry = { "@type": "Question"; name: string; acceptedAnswer: { "@type": "Answer"; text: string } };
  const faqEntries: FaqEntry[] = [];

  if (page.recruitmentSteps && page.recruitmentSteps.length > 0) {
    faqEntries.push({
      "@type": "Question",
      name: `What is the recruitment process at ${companyLabel}?`,
      acceptedAnswer: {
        "@type": "Answer",
        text: `The typical ${companyLabel} recruitment process has ${page.recruitmentSteps.length} stages: ${page.recruitmentSteps.join(" → ")}.`,
      },
    });
  }

  if (page.interviewRounds && page.interviewRounds.length > 0) {
    faqEntries.push({
      "@type": "Question",
      name: `What are the interview rounds at ${companyLabel}?`,
      acceptedAnswer: {
        "@type": "Answer",
        text: `${companyLabel} typically conducts ${page.interviewRounds.length} interview rounds: ${page.interviewRounds.join("; ")}.`,
      },
    });
  }

  faqEntries.push({
    "@type": "Question",
    name: `What framework should I use for ${companyLabel} ${focusLabel.toLowerCase()} interviews?`,
    acceptedAnswer: {
      "@type": "Answer",
      /* HireStepX's recommended framework — clearly attributed as advice,
         not as an official ${companyLabel} guideline. */
      text: `HireStepX recommends the ${page.framework.name} framework for this type of interview: ${page.framework.summary}`,
    },
  });

  questions.slice(0, 5).forEach((q) => {
    faqEntries.push({
      "@type": "Question",
      name: q.text,
      acceptedAnswer: {
        "@type": "Answer",
        text: `To answer this question well, HireStepX recommends the ${page.framework.name} approach: ${page.framework.summary} Ground your answer in a specific real example from your own experience.`,
      },
    });
  });

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqEntries,
  };

  /* Article schema — alongside FAQPage, signals "this is editorial
     content" rather than a thin landing page. image is required for
     Google Discover/News eligibility. */
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: page.searchPhrase,
    description: page.intro,
    image: `https://hirestepx.com/companies/${slug}/opengraph-image`,
    author: { "@type": "Organization", name: "HireStepX", url: "https://hirestepx.com" },
    publisher: { "@type": "Organization", name: "HireStepX", logo: { "@type": "ImageObject", url: "https://hirestepx.com/wordmark.png" } },
    datePublished: "2026-05-05",
    dateModified: "2026-07-14",
    inLanguage: "en-IN",
    /* Points at the canonical URL (see generateMetadata above), not the
       /companies alias this page is served from. */
    url: `https://hirestepx.com/questions/${slug}`,
    mainEntityOfPage: { "@type": "WebPage", "@id": `https://hirestepx.com/questions/${slug}` },
    articleSection: focusLabel,
    keywords: [page.metaKeywords[0], companyLabel, "interview preparation India"].join(", "),
  };

  /* HowTo schema (preparation) — framework summary split on → separators. */
  const howToSteps = page.framework.summary
    .split(/\s*→\s*/)
    .filter(Boolean)
    .map((step, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: step.split("(")[0].trim(),
      text: step,
    }));

  const howToSchema = howToSteps.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: `How to prepare for ${companyLabel} ${focusLabel.toLowerCase()} interviews`,
    description: page.intro,
    step: howToSteps,
  } : null;

  /* HowTo schema (recruitment process) — uses recruitmentSteps when present. */
  const recruitmentHowToSchema = page.recruitmentSteps && page.recruitmentSteps.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: `${companyLabel} interview process — step by step`,
    description: `A step-by-step breakdown of the ${companyLabel} ${focusLabel.toLowerCase()} interview process for candidates in India.`,
    step: page.recruitmentSteps.map((step, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: step.split("—")[0].split("(")[0].trim(),
      text: step,
    })),
  } : null;

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
      { "@type": "ListItem", position: 3, name: page.searchPhrase, item: `https://hirestepx.com/questions/${slug}` },
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
          url: `https://hirestepx.com/questions/${slug}`,
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
      {howToSchema && (
        <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }} />
      )}
      {recruitmentHowToSchema && (
        <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(recruitmentHowToSchema) }} />
      )}
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(courseListSchema) }} />

      <Script
        async
        src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7810403590527236"
        crossOrigin="anonymous"
        strategy="lazyOnload"
      />
      <style>{editorialCSS}</style>
      <NavV2 />
      <main style={{ background: t.cream, color: t.coal, minHeight: "100dvh", fontFamily: fonts.sans }}>

        {/* Single-column hero — matches /questions/[slug] pattern */}
        <header className="ed-hero" style={{ paddingTop: ED_PADDING.heroTop, paddingBottom: ED_PADDING.heroBottom, borderBottom: `1px solid ${t.line}` }}>
          <div className="ed-container">
            <p style={{ ...edEyebrow, color: t.inkFaint, margin: "0 0 24px" }}>
              {companyLabel} · {focusLabel}
            </p>
            <h1 style={{ fontFamily: fonts.serif, fontSize: "clamp(32px, 4.2vw, 56px)", fontWeight: 400, lineHeight: 1.06, letterSpacing: "-0.026em", color: t.coal, margin: "0 0 22px" }}>
              {page.searchPhrase}
            </h1>
            <p style={{ ...edSansLead, margin: "0 0 36px", maxWidth: "58ch" }}>
              {page.intro.split(".")[0].trim()}.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <Link href={practiceHref} className="ed-cta" style={ctaPrimaryStyle("lg")}>
                Practice free <span className="ed-cta-arrow" aria-hidden>→</span>
              </Link>
              <span style={{ fontFamily: fonts.sans, fontSize: 13, color: t.inkFaint }}>
                {questions.length} questions · {focusLabel} · 2 sessions free
              </span>
            </div>
          </div>
        </header>

        {/* Company context — verified facts; renders nothing when absent */}
        <CompanyContextBand company={page.company} companyLabel={companyLabel} />

        {/* Framework */}
        <section className="ed-section ed-reveal" style={{ paddingTop: ED_PADDING.sectionV, paddingBottom: ED_PADDING.sectionV, borderBottom: `1px solid ${t.line}` }}>
          <div className="ed-container">
            <SectionHead title={page.framework.name} />
            <div className="ed-reading">
              <p style={{ fontFamily: fonts.sans, fontSize: 17, lineHeight: 1.72, color: t.inkSoft, margin: 0 }}>
                {page.framework.summary}
              </p>
            </div>
          </div>
        </section>

        {/* Recruitment process — timeline */}
        {page.recruitmentSteps && page.recruitmentSteps.length > 0 && (
          <section className="ed-section ed-reveal" style={{ paddingTop: ED_PADDING.sectionV, paddingBottom: ED_PADDING.sectionV, background: t.creamSoft, borderBottom: `1px solid ${t.line}` }}>
            <div className="ed-container">
              <SectionHead
                index="01"
                title={`${companyLabel} recruitment process`}
                sub="The typical timeline candidates walk through, stage by stage."
              />
              <div className="ed-reading">
                <SpecTimeline items={page.recruitmentSteps.map((step) => ({ label: step }))} />
              </div>
            </div>
          </section>
        )}

        {/* Interview rounds — timeline */}
        {page.interviewRounds && page.interviewRounds.length > 0 && (
          <section className="ed-section ed-reveal" style={{ paddingTop: ED_PADDING.sectionV, paddingBottom: ED_PADDING.sectionV, borderBottom: `1px solid ${t.line}` }}>
            <div className="ed-container">
              <SectionHead index="02" title="Interview rounds" />
              <div className="ed-reading">
                <SpecTimeline items={page.interviewRounds.map((round) => ({ label: round }))} />
              </div>
            </div>
          </section>
        )}

        {/* STAR guide — behavioral / HR / campus-placement */}
        {(page.focus === "behavioral" || page.focus === "hr" || page.focus === "campus-placement") && (
          <section className="ed-section ed-reveal" style={{ paddingTop: ED_PADDING.sectionV, paddingBottom: ED_PADDING.sectionV, background: t.creamSoft, borderBottom: `1px solid ${t.line}` }}>
            <div className="ed-container">
              <SectionHead
                title="Every story,"
                accent="four beats."
                sub={`${companyLabel} interviewers score on structure and specificity. Run every behavioural answer through STAR.`}
              />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
                {[
                  ["S", "Situation", "Set context in one or two sentences. Just enough background for the story to land."],
                  ["T", "Task", "State YOUR specific responsibility, not the team's. What were you accountable for?"],
                  ["A", "Action", "The longest beat. The specific steps YOU took. Say 'I', not 'we'."],
                  ["R", "Result", "Quantify it: numbers, percentages, timelines. Then what you learnt."],
                ].map(([letter, label, text]) => (
                  <div key={label} style={{ background: t.white, border: `1px solid ${t.line}`, borderRadius: 14, padding: "20px 22px" }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
                      <span style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: 30, color: t.copper, lineHeight: 1 }}>{letter}</span>
                      <span style={{ fontFamily: fonts.sans, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: t.coal }}>{label}</span>
                    </div>
                    <p style={{ fontFamily: fonts.sans, fontSize: 14, color: t.inkSoft, lineHeight: 1.6, margin: 0 }}>{text}</p>
                  </div>
                ))}
              </div>
              <p style={{ fontFamily: fonts.sans, fontSize: 13, color: t.inkFaint, margin: "20px 0 0", lineHeight: 1.6, maxWidth: "62ch" }}>
                <strong style={{ color: t.coal }}>The most common miss:</strong> saying &quot;we did X&quot; throughout. Interviewers score your individual contribution, so practise saying &quot;I&quot; out loud in a mock session first.
              </p>
            </div>
          </section>
        )}

        {/* Question set */}
        <section className="ed-section ed-reveal" style={{ paddingTop: ED_PADDING.sectionV, paddingBottom: ED_PADDING.sectionV, borderBottom: `1px solid ${t.line}` }}>
          <div className="ed-container">
            <SectionHead
              title={`Real ${focusLabel.toLowerCase()} questions`}
              accent={`${companyLabel} asked.`}
              sub="Sourced from candidate post-mortems. Answer any one aloud and the AI scores it in two minutes."
            />
            <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {questions.map((q, i) => (
                <li
                  key={i}
                  className="ed-row"
                  style={{
                    display: "flex",
                    gap: 24,
                    alignItems: "flex-start",
                    padding: "24px 8px",
                    margin: "0 -8px",
                    borderBottom: `1px solid ${t.line}`,
                  }}
                >
                  {/* Number */}
                  <span style={{ flexShrink: 0, fontFamily: fonts.serif, fontStyle: "italic", fontSize: 22, color: t.copper, opacity: 0.6, lineHeight: 1, minWidth: 32, paddingTop: 3 }}>
                    {i + 1}
                  </span>
                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: fonts.serif, fontSize: 20, lineHeight: 1.4, color: t.coal, margin: "0 0 8px", letterSpacing: "-0.01em" }}>
                      {q.text}
                    </p>
                    {q.styleNote && (
                      <p style={{ fontFamily: fonts.sans, fontSize: 13, color: t.inkFaint, margin: "0 0 12px", lineHeight: 1.5, fontStyle: "italic" }}>
                        {q.styleNote}
                      </p>
                    )}
                    <Link href={practiceHref} className="ed-cta" style={{ color: t.copper, textDecoration: "none", fontFamily: fonts.sans, fontSize: 13, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}>
                      Answer this <span className="ed-cta-arrow" aria-hidden>→</span>
                    </Link>
                  </div>
                  {/* Difficulty chip */}
                  {q.difficulty && (
                    <span style={{ flexShrink: 0, alignSelf: "flex-start", ...DIFFICULTY_CHIP[q.difficulty], fontFamily: fonts.sans, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, padding: "3px 10px", borderRadius: 999, marginTop: 4 }}>
                      {DIFFICULTY_LABEL[q.difficulty] ?? q.difficulty}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Related links */}
        <section className="ed-section" style={{ paddingTop: ED_PADDING.sectionV, paddingBottom: ED_PADDING.sectionV, background: t.creamSoft }}>
          <div className="ed-container" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 40 }}>
            <RelatedBlogPosts companyLabel={companyLabel} />
            <RelatedLinks currentSlug={slug} />
          </div>
        </section>

        {/* Closing band */}
        <DarkBand eyebrow="Reading won't get you hired" title="Stop reading," accent="start answering." videoSrc="/cta.mp4">
          <p style={{ fontFamily: fonts.sans, fontSize: 16, color: t.creamMuted, lineHeight: 1.65, maxWidth: "38ch", margin: 0 }}>
            The AI asks {companyLabel}-style questions, listens to your voice, and scores your answer in two minutes. Two sessions free, no credit card.
          </p>
          <Link href={practiceHref} className="ed-cta" style={ctaPrimaryStyle("lg")}>
            Practice {companyLabel} interview free <span className="ed-cta-arrow" aria-hidden>→</span>
          </Link>
        </DarkBand>

      </main>
      <FooterDome />
      <MobileStickyCTA />
    </>
  );
}

/* CompanyContextBand — wraps CompanyContextBox in its own section band so
   verified company facts sit separate from the framework prep advice. Renders
   nothing when no known-facts entry exists for this company. */
function CompanyContextBand({ company, companyLabel }: { company: string; companyLabel: string }) {
  if (!COMPANY_KNOWN_FACTS[company]) return null;
  return (
    <section className="ed-section ed-reveal" style={{ paddingTop: 48, paddingBottom: 48, borderBottom: `1px solid ${t.line}`, background: t.creamSoft }}>
      <div className="ed-container ed-reading">
        <CompanyContextBox company={company} companyLabel={companyLabel} />
      </div>
    </section>
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
    <div>
      <p style={{ ...edEyebrow, color: t.inkFaint, marginBottom: 16 }}>In-depth guides</p>
      <ul role="list" style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
        {matched.map((m) => (
          <li key={m.slug}>
            <Link href={`/blog/${m.slug}`} className="ed-link" style={{ color: t.copper, fontFamily: fonts.sans, fontSize: 15, fontWeight: 500, lineHeight: 1.4 }}>
              {m.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* Render up to 4 related SEO pages — same company OR same focus area.
   Internal linking is one of the highest-ROI signals for indexing
   long-tail pages quickly. */
function RelatedLinks({ currentSlug }: { currentSlug: string }) {
  const current = SEO_PAGES.find((p: SeoPage) => p.slug === currentSlug);
  const related = current
    ? SEO_PAGES
        .filter((p: SeoPage) =>
          p.slug !== currentSlug &&
          (p.company === current.company || p.focus === current.focus),
        )
        .slice(0, 4)
    : [];
  return (
    <div>
      <p style={{ ...edEyebrow, color: t.inkFaint, marginBottom: 16 }}>Related interview prep</p>
      {related.length > 0 ? (
        <ul role="list" style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
          {related.map((p: SeoPage) => (
            <li key={p.slug}>
              <Link href={`/questions/${p.slug}`} className="ed-link" style={{ color: t.copper, fontFamily: fonts.sans, fontSize: 15, fontWeight: 500, lineHeight: 1.4 }}>
                {p.searchPhrase}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ fontFamily: fonts.sans, fontSize: 14, color: t.inkFaint, lineHeight: 1.5, margin: 0 }}>
          Guides for this company are still being written.{" "}
          <Link href="/questions" className="ed-link" style={{ color: t.copper, fontWeight: 500 }}>
            Browse all companies →
          </Link>
        </p>
      )}
    </div>
  );
}
