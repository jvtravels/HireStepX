import type { Metadata } from "next";
import Script from "next/script";
import BlogPage from "@/BlogPage";
import { breadcrumb, ldJson } from "@/marketing-v2/_schema";
import { BLOG_META } from "@/blog-meta";

export const metadata: Metadata = {
  title: "Interview Prep Blog India 2026 | HireStepX",
  description:
    "Company interview guides for India 2026. TCS NQT, Google behavioral, Flipkart system design, Amazon leadership, campus placement, and salary negotiation.",
  keywords: [
    "interview preparation blog India",
    "TCS interview guide 2026",
    "Google interview questions India",
    "campus placement tips India",
    "fresher interview tips 2026",
    "behavioral interview India",
  ].join(", "),
  alternates: { canonical: "/blog" },
  openGraph: {
    type: "website",
    title: "Interview Preparation Blog India 2026 | HireStepX",
    description: "Guides for TCS, Google, Flipkart, Amazon, Deloitte and more. 2026 India job market.",
    url: "https://hirestepx.com/blog",
    siteName: "HireStepX",
    locale: "en_IN",
    images: [{ url: "https://hirestepx.com/opengraph-image", width: 1200, height: 630, alt: "HireStepX Interview Preparation Blog" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Interview Preparation Blog India 2026 | HireStepX",
    description: "Company-specific interview guides for Indian candidates. TCS, Google, Flipkart, Amazon, and 20+ more.",
    images: ["https://hirestepx.com/opengraph-image"],
  },
};

/* Accessing searchParams makes this page dynamic — intentional, mirrors
   app/(marketing)/questions/page.tsx. The ?page= param drives real
   crawlable pagination via <Link href="/blog?page=N"> in BlogIndex. */
const BLOG_ITEM_LIST_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "HireStepX Interview Preparation Blog",
  description: "Company-specific interview guides for Indian job seekers: TCS, Google, Flipkart, Amazon, and more.",
  url: "https://hirestepx.com/blog",
  numberOfItems: BLOG_META.length,
  itemListElement: BLOG_META.map((post, i) => ({
    "@type": "ListItem",
    position: i + 1,
    url: `https://hirestepx.com/blog/${post.slug}`,
    name: post.title,
  })),
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { headers } = await import("next/headers");
  const nonce = (await headers()).get("x-nonce") ?? "";
  const { page } = await searchParams;
  const pageNum = Math.max(1, parseInt(page ?? "1", 10) || 1);

  return (
    <>
      <script
        type="application/ld+json"
        nonce={nonce || undefined}
        dangerouslySetInnerHTML={ldJson(breadcrumb([{ name: "Blog", path: "/blog" }]))}
      />
      <script
        type="application/ld+json"
        nonce={nonce || undefined}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(BLOG_ITEM_LIST_SCHEMA) }}
      />
      <Script
        async
        src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7810403590527236"
        crossOrigin="anonymous"
        strategy="lazyOnload"
      />
      <BlogPage metas={BLOG_META} page={pageNum} />
    </>
  );
}
