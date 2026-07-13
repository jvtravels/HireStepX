import type { Metadata } from "next";
import { SEO_PAGES } from "../../../data/seo-pages";
import { QuestionsIndexPage } from "@/marketing-v2/QuestionPages";
import { breadcrumb, ldJson } from "@/marketing-v2/_schema";

/* /questions — directory listing of all question sets.
 *
 * One card per (company × focus) combination from SEO_PAGES. Sorted by
 * company so crawlers and users can browse predictably. Internal links to
 * every /questions/[slug] child page — the strongest on-page crawl signal
 * for getting thin long-tail pages indexed quickly.
 */

export const revalidate = 86400; /* 24 h */

export const metadata: Metadata = {
  title: "Interview Questions by Company & Role India 2026 | HireStepX",
  description:
    "Real, verified interview questions for Google, Amazon, TCS, Razorpay, Flipkart, McKinsey, and 60+ more companies. Practice answering them with AI voice feedback — 2 sessions free.",
  keywords: [
    "interview questions",
    "company interview questions",
    "tcs interview questions",
    "amazon interview questions",
    "google interview questions",
    "flipkart interview questions",
    "razorpay interview questions",
    "infosys campus interview",
    "ai mock interview",
  ].join(", "),
  alternates: { canonical: "/questions" },
  openGraph: {
    type: "website",
    title: "Interview Questions by Company & Role | HireStepX",
    description:
      "Real verified questions for 60+ companies. Practice answering them with AI voice feedback.",
    url: "https://hirestepx.com/questions",
    siteName: "HireStepX",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "Interview Questions by Company & Role | HireStepX",
    description: "Real verified questions for 60+ companies. Practice with AI voice feedback.",
  },
};

export default async function QuestionsIndexRoute() {
  const { headers } = await import("next/headers");
  const nonce = (await headers()).get("x-nonce") ?? "";
  /* ItemList schema — helps Google understand this is a curated collection
     and may generate a sitelinks-style display in the SERP. */
  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "HireStepX Interview Question Sets",
    description:
      "Curated interview question sets for top Indian and global companies. Each set includes real verified questions and AI-powered practice.",
    numberOfItems: SEO_PAGES.length,
    itemListElement: SEO_PAGES.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: p.searchPhrase,
      url: `https://hirestepx.com/questions/${p.slug}`,
    })),
  };

  return (
    <>
      {/* Structured data */}
      <script
        nonce={nonce || undefined}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />
      <script
        nonce={nonce || undefined}
        type="application/ld+json"
        dangerouslySetInnerHTML={ldJson(breadcrumb([{ name: "Questions", path: "/questions" }]))}
      />

      {/* Page body */}
      <QuestionsIndexPage
        pages={SEO_PAGES.map((p) => ({
          slug: p.slug,
          searchPhrase: p.searchPhrase,
          company: p.company,
          focus: p.focus,
          intro: p.intro,
          sitemapPriority: p.sitemapPriority,
        }))}
      />
    </>
  );
}
