import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Script from "next/script";
import BlogPage from "@/BlogPage";
import { breadcrumb, ldJson } from "@/marketing-v2/_schema";
import { getBlogMetaBySlug, getBlogMetasBySlugs } from "@/blog-meta";
import { getBlogPostBySlug } from "../../../../data/blog-posts";

/* /blog/[slug] — per-post route.
 *
 * generateMetadata reads the lightweight server-safe blog-meta.ts registry
 * (not BlogPage.tsx which is "use client") to populate:
 *   - <title> with the real hand-written post title
 *   - meta description with the real metaDescription
 *   - OG image from heroImage
 *   - Article JSON-LD (needed for Google "Top Stories" carousel)
 *   - FAQPage JSON-LD (triggers rich accordion in SERP)
 *
 * If the slug isn't in the registry yet (ISR newcomer), falls back to the
 * slug-derived title so the page never has empty metadata.
 */

function slugToTitle(slug: string): string {
  return slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function slugAuthor(_slug: string): string {
  return "HireStepX Editorial Team";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const meta = getBlogMetaBySlug(slug);

  const title = meta?.title ?? `${slugToTitle(slug)} | HireStepX Blog`;
  const description = meta?.metaDescription ??
    `Read "${slugToTitle(slug)}" on the HireStepX blog: interview tips, career advice, and job search strategies for Indian candidates.`;
  const image = meta?.heroImage ?? "https://hirestepx.com/opengraph-image";

  /* Google truncates SERP titles around ~60 chars. The raw post title is
     already kept under that limit on its own, but appending " | HireStepX"
     pushed most of them back over — only add the suffix when it still fits. */
  const baseTitle = meta ? meta.title : slugToTitle(slug);
  const withSuffix = `${baseTitle} | HireStepX`;
  const pageTitle = withSuffix.length <= 60 ? withSuffix : baseTitle;

  return {
    title: pageTitle,
    description,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      title,
      description,
      url: `https://hirestepx.com/blog/${slug}`,
      type: "article",
      siteName: "HireStepX",
      locale: "en_IN",
      images: [{ url: image, width: 1200, height: 630, alt: title }],
      ...(meta?.datePublished ? { publishedTime: meta.datePublished } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

/* ISR: generate paths for known slugs at build time; any new slug
   falls through to ISR on first visit. */
export async function generateStaticParams() {
  const { getAllBlogSlugs } = await import("@/blog-meta");
  return getAllBlogSlugs().map((slug) => ({ slug }));
}

export const revalidate = 86400;
export const dynamicParams = true;

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);
  if (!post) notFound();

  const meta = getBlogMetaBySlug(slug);
  const title = meta?.title ?? slugToTitle(slug);
  const relatedPosts = getBlogMetasBySlugs(post.relatedSlugs);

  const { headers } = await import("next/headers");
  const nonce = (await headers()).get("x-nonce") ?? "";

  /* BlogPosting JSON-LD — the specific subtype required for "Top Stories"
     carousel eligibility. "Article" works but "BlogPosting" gets stronger
     signals for blog content. */
  const articleSchema = meta ? {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: meta.title,
    description: meta.metaDescription,
    image: meta.heroImage,
    datePublished: meta.datePublished,
    dateModified: meta.datePublished,
    author: { "@type": "Organization", name: slugAuthor(slug), url: "https://hirestepx.com/about" },
    publisher: {
      "@type": "Organization",
      name: "HireStepX",
      logo: { "@type": "ImageObject", url: "https://hirestepx.com/wordmark.png" },
    },
    inLanguage: "en-IN",
    articleSection: meta.category,
    url: `https://hirestepx.com/blog/${slug}`,
    keywords: [meta.company, meta.category, "interview preparation India", "mock interview", "HireStepX"].filter(Boolean).join(", "),
    mainEntityOfPage: { "@type": "WebPage", "@id": `https://hirestepx.com/blog/${slug}` },
    isPartOf: { "@type": "Blog", name: "HireStepX Blog", url: "https://hirestepx.com/blog" },
  } : null;

  /* FAQPage JSON-LD — structured Q&A data. Note: FAQ rich results
     (visual accordion in SERP) were deprecated May 7, 2026; Article schema
     carries the main editorial signal. Only injected when faqs are defined. */
  const faqSchema = (meta?.faqs && meta.faqs.length > 0) ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: meta.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  } : null;

  return (
    <>
      <Script
        async
        src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7810403590527236"
        crossOrigin="anonymous"
        strategy="lazyOnload"
      />
      <script
        type="application/ld+json"
        nonce={nonce || undefined}
        dangerouslySetInnerHTML={ldJson(
          breadcrumb([
            { name: "Blog", path: "/blog" },
            { name: title, path: `/blog/${slug}` },
          ]),
        )}
      />
      {articleSchema && (
        <script type="application/ld+json" nonce={nonce || undefined} dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      )}
      {faqSchema && (
        <script type="application/ld+json" nonce={nonce || undefined} dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      )}
      <BlogPage post={post} related={relatedPosts} />
    </>
  );
}
