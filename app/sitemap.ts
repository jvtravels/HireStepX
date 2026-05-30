import type { MetadataRoute } from "next";
import { SEO_PAGES } from "../data/seo-pages";

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
  const seoPagesLastModified = new Date("2026-05-05");

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${baseUrl}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${baseUrl}/how-it-works`, lastModified: now, changeFrequency: "monthly", priority: 0.85 },
    { url: `${baseUrl}/for-students`, lastModified: now, changeFrequency: "monthly", priority: 0.85 },
    { url: `${baseUrl}/compare/chatgpt`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${baseUrl}/signup`, lastModified: now, changeFrequency: "yearly", priority: 0.6 },
    { url: `${baseUrl}/forgot-password`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${baseUrl}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/refund`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  /* The programmatic SEO pages. Each gets its sitemapPriority from
     the seo-pages config (0.4–0.95) so high-intent combos rank above
     niche ones in Google's crawl queue. */
  const seoEntries: MetadataRoute.Sitemap = SEO_PAGES.map((p) => ({
    url: `${baseUrl}/companies/${p.slug}`,
    lastModified: seoPagesLastModified,
    changeFrequency: "monthly" as const,
    priority: p.sitemapPriority ?? 0.7,
  }));

  return [...staticEntries, ...seoEntries];
}
