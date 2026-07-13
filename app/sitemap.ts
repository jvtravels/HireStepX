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
  const seoPagesLastModified = new Date("2026-07-13");

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${baseUrl}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${baseUrl}/how-it-works`, lastModified: now, changeFrequency: "monthly", priority: 0.85 },
    { url: `${baseUrl}/for-students`, lastModified: now, changeFrequency: "monthly", priority: 0.85 },
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

  /* The programmatic SEO pages (/companies/[slug]).
     Each gets its sitemapPriority from the seo-pages config (0.4–0.95)
     so high-intent combos rank above niche ones in Google's crawl queue. */
  const seoEntries: MetadataRoute.Sitemap = SEO_PAGES.map((p) => ({
    url: `${baseUrl}/companies/${p.slug}`,
    lastModified: seoPagesLastModified,
    changeFrequency: "monthly" as const,
    priority: p.sitemapPriority ?? 0.7,
  }));

  /* /questions index + /questions/[slug] — mirrors the /companies tree.
     Same SEO_PAGES data, different URL prefix. Submitting both helps
     Google discover all long-tail question sets quickly. */
  const questionsIndex: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/questions`,
      lastModified: seoPagesLastModified,
      changeFrequency: "monthly" as const,
      priority: 0.75,
    },
  ];
  const questionEntries: MetadataRoute.Sitemap = SEO_PAGES.map((p) => ({
    url: `${baseUrl}/questions/${p.slug}`,
    lastModified: seoPagesLastModified,
    changeFrequency: "monthly" as const,
    priority: p.sitemapPriority ?? 0.7,
  }));

  /* Blog posts — static list kept in sync with the posts array in
     BlogPage.tsx. The blog uses ISR (dynamicParams: true) so posts
     aren't known at build time; we enumerate them here so Google
     discovers all articles without waiting for organic crawling. */
  const blogSlugs = [
    "top-10-google-interview-questions",
    "flipkart-interview-prep-guide",
    "behavioral-interview-questions-freshers",
    "razorpay-interview-experience",
    "ace-case-study-interviews",
    "tcs-interview-questions-freshers-2026",
    "infosys-interview-questions-2026",
    "how-to-introduce-yourself-in-interview",
    "tell-me-about-yourself-best-answer",
    "wipro-interview-questions-answers",
    "hr-interview-questions-answers-india",
    "amazon-leadership-principles-interview",
    "system-design-interview-preparation",
    "salary-negotiation-tips-india",
    "campus-placement-interview-tips",
    "mock-interview-practice-guide",
    "star-method-interview-answers",
    "cognizant-interview-questions-freshers-2026",
    "accenture-interview-questions-freshers-2026",
    "product-manager-interview-questions-india",
    "hcl-accenture-capgemini-interview-comparison",
    "deloitte-interview-questions-freshers-2026",
    "group-discussion-topics-campus-placement-2026",
    "how-to-pass-tcs-nqt-2026",
    "zoho-interview-questions-freshers-2026",
    "software-engineer-interview-checklist-2026",
    "java-interview-questions-freshers-india-2026",
    "resume-tips-freshers-india-2026",
    "data-analyst-interview-questions-india-2026",
    "zomato-product-manager-interview-2026",
    "python-interview-questions-freshers-india-2026",
    "goldman-sachs-india-interview-questions",
    "frontend-developer-interview-questions-india-2026",
    "product-company-vs-service-company-india-career",
    "swiggy-interview-questions-2026",
    "microsoft-india-interview-questions-2026",
    "sql-interview-questions-freshers-india-2026",
    "python-developer-salary-india-2026",
    "data-analyst-salary-india-2026",
    "how-to-crack-tcs-ion-nqt-2026",
    "faang-interview-preparation-india-2026",
    "wipro-elite-nlth-preparation-2026",
    "react-developer-salary-india-2026",
    "jp-morgan-interview-questions-india-2026",
  ];
  const blogEntries: MetadataRoute.Sitemap = blogSlugs.map((slug) => ({
    url: `${baseUrl}/blog/${slug}`,
    lastModified: seoPagesLastModified,
    changeFrequency: "monthly" as const,
    priority: 0.75,
  }));

  return [...staticEntries, ...questionsIndex, ...questionEntries, ...seoEntries, ...blogEntries];
}
