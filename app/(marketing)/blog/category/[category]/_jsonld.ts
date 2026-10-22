import { BLOG_META } from "@/blog-meta";
import { CATEGORY_BUCKETS, bucketToSlug, bucketDescription, categoryBucket } from "@/blog-categories";
import { breadcrumb, ldJson } from "@/marketing-v2/_schema";

/* Shared source of truth for /blog/category/[category]'s JSON-LD, used by
 * both the page (renders it) and scripts/generate-jsonld-csp-hashes.mts
 * (hashes it for the CSP header). Keeping this in one place guarantees the
 * hash always matches what the page actually renders. */

export function bucketFromSlug(slug: string): string | null {
  return CATEGORY_BUCKETS.find((b) => bucketToSlug(b) === slug) ?? null;
}

/* Enumerates every category slug, for generateStaticParams and the CSP
   hash generator to loop over. */
export function getAllBlogCategorySlugs(): string[] {
  return CATEGORY_BUCKETS.map((bucket) => bucketToSlug(bucket));
}

export function buildBlogCategoryJsonLd(slug: string): { __html: string }[] | null {
  const bucket = bucketFromSlug(slug);
  if (!bucket) return null;

  const posts = BLOG_META
    .filter((p) => categoryBucket(p.category) === bucket)
    .sort((a, b) => (a.datePublished < b.datePublished ? 1 : -1));
  if (posts.length === 0) return null;

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

  return [ldJson(breadcrumbSchema), ldJson(itemListSchema)];
}
