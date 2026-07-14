import type { MetadataRoute } from "next";
import { SEO_PAGES } from "../data/seo-pages";
import { getAllBlogSlugs } from "../src/blog-meta";
import { getAllSalarySlugs } from "../data/salary-seo";

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
  /* Bumped 2026-07-15: all 67 SEO pages now have interviewRounds field with
     round-by-round preparation guidance; canonical URL consolidated to /questions/;
     filter chip bar added to /questions index with campus-placement, hr, behavioral
     focus chips prominent for Indian fresher demographic. */
  const seoPagesLastModified = new Date("2026-07-15");

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${baseUrl}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${baseUrl}/how-it-works`, lastModified: now, changeFrequency: "monthly", priority: 0.85 },
    /* Pillar pages — high topical authority, link to all company/focus trees */
    { url: `${baseUrl}/interview-prep`, lastModified: now, changeFrequency: "monthly", priority: 0.92 },
    { url: `${baseUrl}/companies`, lastModified: now, changeFrequency: "monthly", priority: 0.88 },
    { url: `${baseUrl}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.85 },
    { url: `${baseUrl}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${baseUrl}/signup`, lastModified: now, changeFrequency: "yearly", priority: 0.6 },
    { url: `${baseUrl}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/refund`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
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

  /* Blog posts — sourced directly from blog-meta.ts registry so new
     posts are automatically included without a manual sync step here. */
  const blogEntries: MetadataRoute.Sitemap = getAllBlogSlugs().map((slug) => ({
    url: `${baseUrl}/blog/${slug}`,
    lastModified: seoPagesLastModified,
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

  return [...staticEntries, ...questionsIndex, ...questionEntries, ...blogEntries, ...salaryIndex, ...salaryEntries];
}
