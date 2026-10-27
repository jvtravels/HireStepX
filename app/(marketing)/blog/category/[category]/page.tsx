import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BLOG_META } from "@/blog-meta";
import { CATEGORY_BUCKETS, bucketToSlug, bucketDescription, bucketIntro, categoryBucket } from "@/blog-categories";
import { HubTemplate } from "@/home2/HubTemplate";
import { buildBlogCategoryJsonLd, bucketFromSlug, getAllBlogCategorySlugs } from "./_jsonld";

/* /blog/category/[category] — topic-bucket blog landing pages.
 *
 * One page per user-intent bucket (Company Guides, Freshers, Behavioral,
 * Technical, Career, Strategy — see src/blog-categories.ts). Targets
 * queries like "behavioral interview questions blog India" or "freshers
 * interview prep guides" that a single post can't fully cover.
 *
 * Generated at build time via generateStaticParams.
 * Schema: BreadcrumbList + ItemList
 */

/* Content is static data (BLOG_META buckets) — only changes on redeploy,
   which invalidates the ISR cache anyway. Long interval avoids racking up
   ISR writes every day (see Vercel Usage: ISR Writes). */
export const revalidate = 2592000; /* 30 days */

export async function generateStaticParams() {
  return getAllBlogCategorySlugs().map((category) => ({ category }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category: slug } = await params;
  const bucket = bucketFromSlug(slug);
  if (!bucket) return { title: "Not Found" };

  const title = `${bucket} Interview Guides: HireStepX Blog`;
  const description = bucketDescription(bucket);

  return {
    title: `${title} | India 2026`,
    description,
    alternates: { canonical: `/blog/category/${slug}` },
    openGraph: {
      title,
      description,
      url: `https://hirestepx.com/blog/category/${slug}`,
      type: "website",
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

export default async function BlogCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category: slug } = await params;
  const bucket = bucketFromSlug(slug);
  if (!bucket) notFound();

  const posts = BLOG_META
    .filter((p) => categoryBucket(p.category) === bucket)
    .sort((a, b) => (a.datePublished < b.datePublished ? 1 : -1));
  if (posts.length === 0) notFound();

  /* No CSP nonce here on purpose — a live per-request headers() read would
     force this ISR route fully dynamic (defeating `revalidate` and killing
     cache-control, which is what starved this route of Googlebot crawl
     budget). This JSON-LD content is deterministic per category, so its CSP
     allowance comes from a build-time content hash instead — see
     scripts/generate-jsonld-csp-hashes.mts and proxy.ts's buildCsp(). */
  const jsonLdScripts = buildBlogCategoryJsonLd(slug);
  if (!jsonLdScripts) notFound();

  return (
    <>
      {jsonLdScripts.map((html, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={html} />
      ))}
      <HubTemplate
        kicker={`${posts.length} ${posts.length === 1 ? "guide" : "guides"}`}
        title={`${bucket} Interview Guides`}
        dek={bucketIntro(bucket)}
        crumbs={[{ label: "Blog", href: "/blog" }, { label: bucket }]}
        sections={[
          {
            kind: "grid", id: "guides", title: `${bucket} guides`,
            items: posts.map((post) => ({ label: post.title, href: `/blog/${post.slug}`, meta: `${post.company} · ${post.readTime} · ${post.datePublished}` })),
            initial: 18, filter: posts.length > 18,
          },
          {
            kind: "grid", id: "topics", title: "Browse other topics",
            items: CATEGORY_BUCKETS.filter((b) => b !== bucket).map((b) => ({ label: b, href: `/blog/category/${bucketToSlug(b)}` })),
          },
        ]}
        close={{ kicker: "Practise", title: "Stop reading. Start practising.", body: "The AI interviewer asks real questions, listens to your voice answer, and grades your structure and delivery.", primary: ["Start free practice", "/signup?source=blog-category"] }}
      />
    </>
  );
}
