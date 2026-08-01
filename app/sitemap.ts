import type { MetadataRoute } from "next";
import { SEO_PAGES, SEO_PAGES_LAST_MODIFIED } from "../data/seo-pages";
import { getAllBlogSlugs, BLOG_META } from "../src/blog-meta";
import { CATEGORY_BUCKETS, bucketToSlug } from "../src/blog-categories";
import { getAllSalarySlugs } from "../data/salary-seo";
import { getAllCitySlugs } from "../data/city-pages";

/* sitemap.xml — generated at build time. Includes:
 *   - Static marketing/legal pages (landing, pricing, privacy, terms, refund)
 *   - Auth flow pages (login, signup, forgot-password)
 *   - Programmatic SEO pages (one URL per company × focus tuple in
 *     data/seo-pages.ts — these are the long-tail traffic engine)
 *
 * Excluded (per robots.ts disallow + here for redundancy):
 *   - All authenticated surfaces (/dashboard, /interview, /session/*)
 *   - All API routes
 *   - Share-token pages (ephemeral)
 *
 * Updates: Next.js 15 regenerates this on every deploy. The
 * lastModified field is "now" for static pages — the pages don't
 * actually change content per-deploy, but Google's "freshness signal"
 * benefits from a recent timestamp without us having to manually
 * track per-page mod times. SEO pages get a stable lastModified so
 * Google doesn't think we're churning content (which hurts ranking).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://hirestepx.com";
  const now = new Date();
  /* Stable date for SEO pages — bumped only when SEO_PAGES changes
     materially (new pages, intro rewrites). Hardcoded so the build
     isn't a freshness signal in itself. */
  /* Bumped 2026-07-21: +189 interview prep pages across Waves 4-6b covering 193 companies:
     fintech, banking, GCCs, semiconductor, healthcare, logistics, EdTech, D2C, EV, B2B SaaS,
     quant — plus all salary-to-interview questionSlug cross-links wired up.
     Source of truth: data/seo-pages.ts SEO_PAGES_LAST_MODIFIED. */
  const seoPagesLastModified = new Date(SEO_PAGES_LAST_MODIFIED);

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${baseUrl}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${baseUrl}/how-it-works`, lastModified: now, changeFrequency: "monthly", priority: 0.85 },
    /* Pillar pages — high topical authority, link to all company/focus trees */
    { url: `${baseUrl}/ai-mock-interview`, lastModified: now, changeFrequency: "monthly", priority: 0.93 },
    { url: `${baseUrl}/interview-prep`, lastModified: now, changeFrequency: "monthly", priority: 0.92 },
    { url: `${baseUrl}/interview-anxiety`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/english-interview-practice`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/telephonic-interview-questions`, lastModified: now, changeFrequency: "monthly", priority: 0.75 },
    { url: `${baseUrl}/walk-in-interview-preparation`, lastModified: now, changeFrequency: "monthly", priority: 0.75 },
    { url: `${baseUrl}/one-way-video-interview-practice`, lastModified: now, changeFrequency: "monthly", priority: 0.75 },
    { url: `${baseUrl}/bpo-interview-questions`, lastModified: now, changeFrequency: "monthly", priority: 0.75 },
    { url: `${baseUrl}/bank-po-interview-questions`, lastModified: now, changeFrequency: "monthly", priority: 0.75 },
    { url: `${baseUrl}/mba-personal-interview-preparation`, lastModified: now, changeFrequency: "monthly", priority: 0.75 },
    { url: `${baseUrl}/for-students`, lastModified: now, changeFrequency: "monthly", priority: 0.90 },
    { url: `${baseUrl}/companies`, lastModified: now, changeFrequency: "monthly", priority: 0.88 },
    { url: `${baseUrl}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.85 },
    { url: `${baseUrl}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${baseUrl}/signup`, lastModified: now, changeFrequency: "yearly", priority: 0.6 },
    { url: `${baseUrl}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/refund`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/grievance`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/referral`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];

  /* /questions index + /questions/[slug] — the canonical URL tree for all
     programmatic SEO pages. /companies/[slug] also exists but canonicalizes
     to /questions/[slug], so only this tree is submitted to the sitemap. */
  const questionsIndex: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/questions`,
      lastModified: seoPagesLastModified,
      changeFrequency: "weekly" as const,
      priority: 0.88,
    },
  ];
  const questionEntries: MetadataRoute.Sitemap = SEO_PAGES.map((p) => ({
    url: `${baseUrl}/questions/${p.slug}`,
    lastModified: seoPagesLastModified,
    changeFrequency: "monthly" as const,
    priority: p.sitemapPriority ?? 0.7,
  }));

  /* Blog posts — each post uses its own datePublished so Google's freshness
     signal reflects actual content age, not the deploy timestamp. */
  const blogMetaMap = new Map(BLOG_META.map((m) => [m.slug, m]));
  const blogEntries: MetadataRoute.Sitemap = getAllBlogSlugs().map((slug) => ({
    url: `${baseUrl}/blog/${slug}`,
    lastModified: new Date(blogMetaMap.get(slug)?.datePublished ?? seoPagesLastModified),
    changeFrequency: "monthly" as const,
    priority: 0.75,
  }));

  /* Salary guide pages — /salary hub + /salary/[company]. Added 2026-07-15. */
  const salaryIndex: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/salary`,
      lastModified: seoPagesLastModified,
      changeFrequency: "monthly" as const,
      priority: 0.85,
    },
  ];
  const salaryEntries: MetadataRoute.Sitemap = getAllSalarySlugs().map((slug) => ({
    url: `${baseUrl}/salary/${slug}`,
    lastModified: seoPagesLastModified,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  /* /blog/category/[category] — topic-bucket blog landing pages. */
  const blogCategoryEntries: MetadataRoute.Sitemap = CATEGORY_BUCKETS.map((bucket) => ({
    url: `${baseUrl}/blog/category/${bucketToSlug(bucket)}`,
    lastModified: seoPagesLastModified,
    changeFrequency: "monthly" as const,
    priority: 0.65,
  }));

  /* /interview-prep/[city] — city-specific interview prep pages. */
  const cityEntries: MetadataRoute.Sitemap = getAllCitySlugs().map((slug) => ({
    url: `${baseUrl}/interview-prep/${slug}`,
    lastModified: seoPagesLastModified,
    changeFrequency: "monthly" as const,
    priority: 0.75,
  }));

  return [...staticEntries, ...questionsIndex, ...questionEntries, ...blogEntries, ...salaryIndex, ...salaryEntries, ...blogCategoryEntries, ...cityEntries];
}
