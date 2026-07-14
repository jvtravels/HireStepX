import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSeoPageBySlug, getAllSeoSlugs, SEO_PAGES, type SeoPage } from "../../../../data/seo-pages";
import { QUESTION_BANK, type BankEntry } from "../../../../data/interview-question-bank";
import { QuestionSetPage } from "@/marketing-v2/QuestionPages";
import { breadcrumb, ldJson } from "@/marketing-v2/_schema";
import { NavV2, MobileStickyCTA } from "@/marketing-v2/HomepageV2";
import { FooterDome } from "@/marketing-v2/FooterDome";
import { COMPANY_LABEL } from "../../../../data/company-labels";
import { BLOG_META } from "../../../../src/blog-meta";

/* /questions/[slug] — static SEO pages for long-tail interview queries.
 *
 * Slug encoding mirrors the existing /companies/[slug] pattern so the two
 * routes can cross-link freely. The same slugs from data/seo-pages.ts power
 * both routes; /questions/<slug> is the canonical URL going forward (shorter,
 * more topically specific), while /companies/<slug> remains live.
 *
 * Strategy: own the "practice" intent layer that AmbitionBox / Glassdoor
 * underserve — those sites list questions; we let candidates practice
 * answering them with an AI that grades them in real time.
 */

export const revalidate = 86400; /* 24 h */

/* ─── Human-readable labels ─────────────────────────────────────────────── */

const FOCUS_LABEL: Record<string, string> = {
  behavioral: "Behavioural",
  technical: "Technical",
  "system-design": "System Design",
  "case-study": "Case Study",
  "campus-placement": "Campus Placement",
  hr: "HR Round",
  panel: "Panel Interview",
  "salary-negotiation": "Salary Negotiation",
  leadership: "Leadership",
  general: "General",
  management: "Management",
  "government-psu": "Government / PSU",
  strategic: "Strategic",
};


/* ─── Question fetching with tier fallback ──────────────────────────────── */

function questionsForPage(p: SeoPage): BankEntry[] {
  /* Tier 1: exact (company × focus × roleFamily) match. */
  const exact = QUESTION_BANK.filter(
    (q) =>
      q.company === p.company &&
      q.focus === p.focus &&
      (!p.roleFamily || q.roleFamily === p.roleFamily),
  );
  if (exact.length >= 4) return exact.slice(0, 12);

  /* Tier 2: drop roleFamily constraint, keep company + focus. */
  const noRole = QUESTION_BANK.filter(
    (q) => q.company === p.company && q.focus === p.focus,
  );
  if (noRole.length >= 4) return noRole.slice(0, 12);

  /* Tier 3: focus-only — same focus area across all companies. */
  return QUESTION_BANK.filter((q) => q.focus === p.focus).slice(0, 12);
}

/* ─── generateStaticParams — pre-renders every slug at build time ────────── */

export async function generateStaticParams() {
  return getAllSeoSlugs().map((slug) => ({ slug }));
}

/* ─── generateMetadata ───────────────────────────────────────────────────── */

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const page = getSeoPageBySlug(slug);
  if (!page) return { title: "Not Found" };

  /* Keep title under ~65 chars (Google's display window) by using a
     minimal suffix — the searchPhrase itself carries the keyword signal. */
  const title = `${page.searchPhrase} | HireStepX`;
  const description = `${page.intro.split(".")[0]}. Practice with AI voice feedback. 2 free sessions, no credit card.`;

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

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default async function QuestionsSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { headers } = await import("next/headers");
  const nonce = (await headers()).get("x-nonce") ?? "";
  const { slug } = await params;
  const page = getSeoPageBySlug(slug);
  if (!page) notFound();

  const questions = questionsForPage(page);
  const companyLabel = COMPANY_LABEL[page.company] ?? page.company;
  const focusLabel = FOCUS_LABEL[page.focus] ?? page.focus;

  /* FAQPage schema — structured Q&A data for Google's understanding.
     Note: FAQ rich results (visual accordion in SERP) were deprecated by
     Google on May 7, 2026. The schema is kept for structured-data signal;
     the HowTo schema below is the live rich-result opportunity.
     Content sourced exclusively from seo-pages.ts curated fields and the
     question bank (≥2-source verified). Framework answers attributed to
     HireStepX, not the company. */
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

  const howToSchema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: `How to prepare for ${companyLabel} ${focusLabel.toLowerCase()} interviews`,
    description: page.intro,
    step: howToSteps,
  };

  /* HowTo schema (recruitment process) — uses recruitmentSteps when present.
     Google surfaces this as "How it works" steps on job/interview queries.
     Kept separate from the preparation HowTo so both signal types coexist. */
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

  /* Article schema — signals editorial content, not a thin landing page.
     image is required for Google Discover/News eligibility. */
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: page.searchPhrase,
    description: page.intro,
    image: `https://hirestepx.com/questions/${slug}/opengraph-image`,
    author: { "@type": "Organization", name: "HireStepX", url: "https://hirestepx.com" },
    publisher: {
      "@type": "Organization",
      name: "HireStepX",
      logo: { "@type": "ImageObject", url: "https://hirestepx.com/wordmark.png" },
    },
    datePublished: "2026-06-21",
    dateModified: "2026-07-14",
    inLanguage: "en-IN",
    url: `https://hirestepx.com/questions/${slug}`,
    mainEntityOfPage: { "@type": "WebPage", "@id": `https://hirestepx.com/questions/${slug}` },
    articleSection: focusLabel,
    keywords: [page.metaKeywords[0], companyLabel, "interview preparation India"].join(", "),
  };

  /* Related pages: same company OR same focus area, up to 4. */
  const relatedPages = SEO_PAGES.filter(
    (p: SeoPage) =>
      p.slug !== slug &&
      (p.company === page.company || p.focus === page.focus),
  )
    .slice(0, 4)
    .map((p: SeoPage) => ({ slug: p.slug, searchPhrase: p.searchPhrase }));

  /* Related blog posts: same company (BLOG_META.company is title-case, SEO company is lowercase). */
  const relatedBlogPosts = BLOG_META
    .filter((post) => post.company.toLowerCase() === page.company)
    .slice(0, 3)
    .map((post) => ({ slug: post.slug, title: post.title }));

  return (
    <>
      {/* Structured data */}
      <script
        nonce={nonce || undefined}
        type="application/ld+json"
        dangerouslySetInnerHTML={ldJson(faqSchema)}
      />
      {howToSteps.length > 0 && (
        <script
          nonce={nonce || undefined}
          type="application/ld+json"
          dangerouslySetInnerHTML={ldJson(howToSchema)}
        />
      )}
      {recruitmentHowToSchema && (
        <script
          nonce={nonce || undefined}
          type="application/ld+json"
          dangerouslySetInnerHTML={ldJson(recruitmentHowToSchema)}
        />
      )}
      <script
        nonce={nonce || undefined}
        type="application/ld+json"
        dangerouslySetInnerHTML={ldJson(articleSchema)}
      />
      <script
        nonce={nonce || undefined}
        type="application/ld+json"
        dangerouslySetInnerHTML={ldJson(
          breadcrumb([
            { name: "Questions", path: "/questions" },
            { name: page.searchPhrase, path: `/questions/${slug}` },
          ]),
        )}
      />

      <NavV2 />
      {/* Page body */}
      <QuestionSetPage
        slug={slug}
        page={page}
        questions={questions}
        companyLabel={companyLabel}
        focusLabel={focusLabel}
        relatedPages={relatedPages}
        relatedBlogPosts={relatedBlogPosts}
      />
      <FooterDome />
      <MobileStickyCTA />
    </>
  );
}
