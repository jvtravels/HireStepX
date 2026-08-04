import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { BLOG_META } from "@/blog-meta";
import { CATEGORY_BUCKETS, bucketToSlug, bucketDescription, bucketIntro, categoryBucket } from "@/blog-categories";
import { NavV2, MobileStickyCTA } from "@/marketing-v2/HomepageV2";
import { FooterDome } from "@/marketing-v2/FooterDome";
import { breadcrumb, ldJson } from "@/marketing-v2/_schema";
import { tokens as t, fonts } from "@/auth/_tokens";

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

export const revalidate = 86400;

export async function generateStaticParams() {
  return CATEGORY_BUCKETS.map((bucket) => ({ category: bucketToSlug(bucket) }));
}

function bucketFromSlug(slug: string): string | null {
  return CATEGORY_BUCKETS.find((b) => bucketToSlug(b) === slug) ?? null;
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

  const { headers } = await import("next/headers");
  const nonce = (await headers()).get("x-nonce") ?? "";

  const posts = BLOG_META
    .filter((p) => categoryBucket(p.category) === bucket)
    .sort((a, b) => (a.datePublished < b.datePublished ? 1 : -1));
  if (posts.length === 0) notFound();

  const breadcrumbSchema = breadcrumb([
    { name: "Blog", path: "/blog" },
    { name: `${bucket} Guides`, path: `/blog/category/${slug}` },
  ]);

  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${bucket} Interview Guides: HireStepX Blog`,
    description: bucketDescription(bucket),
    url: `https://hirestepx.com/blog/category/${slug}`,
    numberOfItems: posts.length,
    itemListElement: posts.map((post, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `https://hirestepx.com/blog/${post.slug}`,
      name: post.title,
    })),
  };

  return (
    <>
      <script type="application/ld+json" nonce={nonce || undefined} dangerouslySetInnerHTML={ldJson(breadcrumbSchema)} />
      <script type="application/ld+json" nonce={nonce || undefined} dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }} />
      <NavV2 />
      <main style={{ background: "#fdfcf7", minHeight: "60vh" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "56px 24px 80px" }}>

          <nav aria-label="Breadcrumb" style={{ marginBottom: 32 }}>
            <span style={{ fontFamily: fonts.mono, fontSize: 11, color: t.inkSoft }}>
              <Link href="/blog" style={{ color: t.copper, textDecoration: "none" }}>Blog</Link>
              {" / "}
              <span>{bucket}</span>
            </span>
          </nav>

          <p style={{ fontFamily: fonts.mono, fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: t.inkSoft, textTransform: "uppercase", margin: "0 0 12px" }}>
            {posts.length} {posts.length === 1 ? "guide" : "guides"}
          </p>
          <h1 style={{ fontFamily: fonts.serif, fontSize: 36, fontWeight: 400, letterSpacing: "-0.02em", color: t.coal, margin: "0 0 12px", lineHeight: 1.2 }}>
            {bucket} Interview Guides
          </h1>
          <p style={{ fontFamily: fonts.serif, fontSize: 16, color: t.inkSoft, margin: "0 0 48px", lineHeight: 1.7, maxWidth: "68ch" }}>
            {bucketIntro(bucket)}
          </p>

          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 48px", display: "flex", flexDirection: "column", gap: 12 }}>
            {posts.map((post) => (
              <li key={post.slug}>
                <Link
                  href={`/blog/${post.slug}`}
                  style={{
                    display: "block",
                    padding: "18px 20px",
                    background: "#fff",
                    border: `1px solid ${t.line}`,
                    borderRadius: 12,
                    textDecoration: "none",
                    color: t.coal,
                  }}
                >
                  <div style={{ fontFamily: fonts.mono, fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: t.copper, marginBottom: 6 }}>
                    {post.company} · {post.datePublished}
                  </div>
                  <div style={{ fontFamily: fonts.serif, fontSize: 16, lineHeight: 1.4, color: t.coal, marginBottom: 6 }}>
                    {post.title}
                  </div>
                  <div style={{ fontSize: 13, color: t.inkSoft, lineHeight: 1.5 }}>
                    {post.metaDescription}
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <section style={{ borderTop: `1px solid ${t.line}`, paddingTop: 36 }}>
            <h2 style={{ fontFamily: fonts.serif, fontSize: 22, fontWeight: 400, color: t.coal, margin: "0 0 20px", letterSpacing: "-0.01em" }}>
              Browse other topics
            </h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {CATEGORY_BUCKETS.filter((b) => b !== bucket).map((b) => (
                <Link
                  key={b}
                  href={`/blog/category/${bucketToSlug(b)}`}
                  style={{
                    padding: "10px 16px", background: "#fff", border: `1px solid ${t.line}`,
                    borderRadius: 999, textDecoration: "none", color: t.coal, fontSize: 13, fontWeight: 500,
                  }}
                >
                  {b}
                </Link>
              ))}
            </div>
          </section>

        </div>
      </main>
      <FooterDome />
      <MobileStickyCTA />
    </>
  );
}
