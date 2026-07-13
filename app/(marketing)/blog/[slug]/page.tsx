import type { Metadata } from "next";
import BlogPage from "@/BlogPage";
import { breadcrumb, ldJson } from "@/marketing-v2/_schema";
import { getBlogMetaBySlug } from "@/blog-meta";

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
  const image = meta?.heroImage ?? "https://hirestepx.com/og-default.png";

  return {
    title: `${meta ? meta.title : slugToTitle(slug)} | HireStepX`,
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
  const meta = getBlogMetaBySlug(slug);
  const title = meta?.title ?? slugToTitle(slug);

  const { headers } = await import("next/headers");
  const nonce = (await headers()).get("x-nonce") ?? "";

  /* Article JSON-LD — required for eligibility in Google's "Top Stories"
     carousel and article-rich results. */
  const articleSchema = meta ? {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: meta.title,
    description: meta.metaDescription,
    image: meta.heroImage,
    datePublished: meta.datePublished,
    dateModified: "2026-07-13",
    author: { "@type": "Organization", name: "HireStepX", url: "https://hirestepx.com" },
    publisher: {
      "@type": "Organization",
      name: "HireStepX",
      logo: { "@type": "ImageObject", url: "https://hirestepx.com/wordmark.png" },
    },
    inLanguage: "en-IN",
    url: `https://hirestepx.com/blog/${slug}`,
    keywords: [meta.company, meta.category, "interview preparation India", "mock interview"].join(", "),
    mainEntityOfPage: { "@type": "WebPage", "@id": `https://hirestepx.com/blog/${slug}` },
  } : null;

  /* FAQPage JSON-LD — triggers rich accordion in Google SERP. Only injected
     when the post has faqs defined and the array is non-empty. */
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
      <BlogPage />
    </>
  );
}
