import type { Metadata } from "next";
import Script from "next/script";
import { notFound } from "next/navigation";
import { getSeoPageBySlug, getAllSeoSlugs } from "../../../../data/seo-pages";
import { QuestionSetPage } from "@/marketing-v2/QuestionPages";
import { NavV2, MobileStickyCTA } from "@/marketing-v2/HomepageV2";
import { FooterDome } from "@/marketing-v2/FooterDome";
import { buildQuestionsPageModel, isThinDuplicateQuestionsPage } from "./_jsonld";

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

/* Content is static data (data/seo-pages.ts) — only changes on redeploy,
   which invalidates the ISR cache anyway. Long interval avoids racking up
   ISR writes every day across ~326 pages (see Vercel Usage: ISR Writes). */
export const revalidate = 2592000; /* 30 days */

/* AdSense flagged the site for "Low value content" (policy 10015918):
 * pages must deliver what they promise, not misattribute content.
 * GSC Coverage (Sept 2026) had already sampled 11 of these into "Crawled
 * - currently not indexed", but the underlying cause is site-wide: any
 * tier-3 /questions/[slug] page falls back to the generic focus-only
 * question set (see questionsForPage in _jsonld.ts) — byte-identical
 * content shared across dozens of unrelated-company pages, claiming
 * "asked at {company}" attribution it can't back. That's 269 of 326
 * pages, not just the 11 GSC happened to sample. Noindexing all of them
 * (via isThinDuplicateQuestionsPage) closes the gap instead of playing
 * whack-a-mole per GSC report. Tier 1/2 pages (genuine company-specific
 * question sets) stay indexable. Revisit per-slug as company-specific
 * question banks are added — moving a slug to tier 1/2 makes it
 * indexable again automatically. */

/* ─── generateStaticParams — pre-renders every slug at build time ────────── */

export async function generateStaticParams() {
  return getAllSeoSlugs().map((slug) => ({ slug }));
}

/* ─── generateMetadata ───────────────────────────────────────────────────── */

/* Google truncates SERP titles/descriptions around ~60 and ~155 chars
   respectively. The intro's "first sentence" (naive split on ".") can run
   long when the intro itself contains abbreviations or is simply verbose,
   so this trims to the last full word that still fits instead of cutting
   mid-word or blowing past the limit. */
/* Cutting at the last word boundary can still land right before a
   conjunction/preposition (e.g. "...its lending and BFS-Direct" → "...its
   lending and"), leaving a dangling connector in the SERP snippet. Strip
   any such trailing stopwords after the word-boundary cut. */
const TRAILING_STOPWORD = /\s+(?:and|or|but|so|for|of|in|on|at|to|with|its|the|a|an|by|from|as)$/i;

function truncateAtWord(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  let result = (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[,;:]$/, "");
  let stripped = result.replace(TRAILING_STOPWORD, "");
  while (stripped !== result) {
    result = stripped;
    stripped = result.replace(TRAILING_STOPWORD, "");
  }
  return result;
}

/* Some intros' first sentence still overruns the SERP budget on its own
   (verbose company-context openers). Cutting at a raw word boundary there
   still lands mid-clause ("...core Java, Spring."). Prefer the last
   comma-clause boundary when there is one past 40% of the budget — a
   full clause reads as a complete (if shorter) thought. */
function truncateAtClause(text: string, maxLen: number): string {
  const cut = text.slice(0, maxLen);
  const lastComma = cut.lastIndexOf(", ");
  if (lastComma > maxLen * 0.4) return `${cut.slice(0, lastComma)}.`;
  return `${truncateAtWord(text, maxLen)}.`;
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const page = getSeoPageBySlug(slug);
  if (!page) return { title: "Not Found" };

  /* Keep the title under ~60 chars (Google's display window). The brand
     suffix is only worth appending when it still fits — a truncated
     "| HireStepX" is worse than no suffix at all. */
  const withSuffix = `${page.searchPhrase} | HireStepX`;
  const title = withSuffix.length <= 60 ? withSuffix : page.searchPhrase;

  /* Forcing the CTA suffix into a fixed ~88-char remainder mangles the
     intro's first sentence mid-clause on any company with a longer intro
     (e.g. "...hires engineers for its lending." — dropped its own object).
     Prefer the full, natural sentence over a shorter but broken one; only
     drop the CTA suffix, then hard-truncate, when there's genuinely no
     room even for the sentence on its own. */
  const descSuffix = " Practice with AI voice feedback. 2 free sessions, no credit card.";
  const firstSentence = page.intro.split(". ")[0];
  const descWithSuffix = `${firstSentence}.${descSuffix}`;
  const description =
    descWithSuffix.length <= 155 ? descWithSuffix
    : firstSentence.length + 1 <= 155 ? `${firstSentence}.`
    : truncateAtClause(firstSentence, 154);

  return {
    title,
    description,
    keywords: page.metaKeywords.join(", "),
    alternates: { canonical: `/questions/${slug}` },
    ...(isThinDuplicateQuestionsPage(slug) ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      type: "article",
      title,
      description,
      url: `https://hirestepx.com/questions/${slug}`,
      siteName: "HireStepX",
      locale: "en_IN",
      images: [{ url: "https://hirestepx.com/opengraph-image", width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["https://hirestepx.com/opengraph-image"],
    },
  };
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default async function QuestionsSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  /* No CSP nonce here on purpose — a live per-request headers() read would
     force this ISR route fully dynamic (defeating `revalidate` and killing
     cache-control, which is what starved this route of Googlebot crawl
     budget). This JSON-LD content is deterministic per slug, so its CSP
     allowance comes from a build-time content hash instead — see
     scripts/generate-jsonld-csp-hashes.mts and proxy.ts's buildCsp(). */
  const model = buildQuestionsPageModel(slug);
  if (!model) notFound();
  const { page, questions, questionsAreCompanySpecific, companyLabel, focusLabel, visibleFaqs, relatedPages, salaryPage, salaryTeaser, relatedBlogPosts, jsonLdScripts } = model;

  return (
    <>
      {jsonLdScripts.map((html, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={html} />
      ))}

      {/* Mediapartners-Google (AdSense's ad-serving crawler) evaluates pages
          where ads actually render for policy compliance, and isn't governed
          by the `robots: noindex` meta tag above — that only stops Google
          Search from indexing the page. Loading the ad script unconditionally
          here means every tier-3 thin/duplicate page kept serving ads and
          staying in scope for AdSense's "Low value content" review even
          after it was pulled from search results. Gate ad loading on the
          same tier check so thin pages stop serving ads outright. */}
      {!isThinDuplicateQuestionsPage(slug) && (
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7810403590527236"
          crossOrigin="anonymous"
          strategy="lazyOnload"
        />
      )}
      <NavV2 />
      {/* Page body */}
      <QuestionSetPage
        slug={slug}
        page={page}
        questions={questions}
        questionsAreCompanySpecific={questionsAreCompanySpecific}
        companyLabel={companyLabel}
        focusLabel={focusLabel}
        relatedPages={relatedPages}
        relatedBlogPosts={relatedBlogPosts}
        salaryPageSlug={salaryPage?.slug}
        salaryTeaser={salaryTeaser}
        faqs={visibleFaqs}
      />
      <FooterDome />
      <MobileStickyCTA />
    </>
  );
}
