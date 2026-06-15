import type { MetadataRoute } from "next";

/* Robots.txt — controls what crawlers can index. The disallow list keeps
   authenticated/private surfaces out of search results. Authenticated
   surfaces don't render meaningful content for an unauthenticated bot
   anyway, but explicit blocking saves crawl budget and keeps SERP
   noise down (no "/dashboard" pages competing with the marketing
   landing for brand queries). */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = "https://hirestepx.com";

  /* Preview/staging deploys block all crawling — they must never be
     indexed. Pairs with the noindex <meta> in app/layout.tsx (the meta
     tag is the stronger signal; this just saves crawl budget). */
  if (process.env.VERCEL_ENV !== "production") {
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
    };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/dashboard",
          "/dashboard/",
          "/interview",
          "/interview/",
          "/onboarding",
          "/onboarding/",
          "/session/",
          "/sessions",
          "/calendar",
          "/settings",
          "/profile/",
          "/resume",
          "/auth/",
          "/reset-password",
          "/forgot-password",
          /* Share-token URLs are public-by-design but ephemeral —
             no SEO value, all crawl-budget cost. */
          "/report/share/",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
