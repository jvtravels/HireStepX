import type { Metadata } from "next";
import BlogPage from "@/BlogPage";
import { breadcrumb, ldJson } from "@/marketing-v2/_schema";
import { getBlogMetaBySlug, BLOG_META } from "@/blog-meta";
import { SEO_PAGES } from "../../../../data/seo-pages";
import { SALARY_SEO_PAGES } from "../../../../data/salary-seo";
import { COMPANY_LABEL } from "../../../../data/company-labels";

/* /blog/[slug] — per-post route.
 *
 * generateMetadata reads the lightweight server-safe blog-meta.ts registry
 * (not BlogPage.tsx which is "use client") to populate:
 *   - <title> with the real hand-written post title
 *   - meta description with the real metaDescription
 *   - OG image from heroImage
 *   - Article JSON-LD (needed for Google "Top Stories" carousel)
 *   - FAQPage JSON-LD (triggers rich accordion in SERP)
 *
 * If the slug isn't in the registry yet (ISR newcomer), falls back to the
 * slug-derived title so the page never has empty metadata.
 */

/* Company values that represent general topics, not a specific company. */
const GENERAL_COMPANIES = new Set([
  "General", "Interview Skills", "Role Guides", "Industry Insights",
  "Career Advice", "Career",
]);

/* Pick up to 3 related posts for internal linking.
   Priority: same company → same category → exclude current slug. */
function relatedPosts(currentSlug: string, company: string, category: string) {
  const isGeneral = GENERAL_COMPANIES.has(company);
  const byCompany = isGeneral ? [] : BLOG_META.filter(
    (p) => p.slug !== currentSlug && p.company === company
  ).slice(0, 3);

  const needed = 3 - byCompany.length;
  const seenSlugs = new Set([currentSlug, ...byCompany.map((p) => p.slug)]);
  const byCategory = needed > 0
    ? BLOG_META.filter(
        (p) => !seenSlugs.has(p.slug) && p.category === category
      ).slice(0, needed)
    : [];

  return [...byCompany, ...byCategory];
}

/* Reverse-lookup COMPANY_LABEL to find the data key ("tcs", "flipkart", …)
   from the display name stored in BlogMeta.company ("TCS", "Flipkart", …). */
function companyKeyFromLabel(label: string): string | null {
  const lower = label.toLowerCase();
  const entry = Object.entries(COMPANY_LABEL).find(([, v]) => v.toLowerCase() === lower);
  if (entry) return entry[0];
  // Fallback: slug-ify the label (handles cases not yet in COMPANY_LABEL)
  const slug = lower.replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  return slug || null;
}

function slugToTitle(slug: string): string {
  return slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const EDITORIAL_AUTHORS = [
  "Priya Sharma",
  "Rahul Mehta",
  "Ankita Nair",
  "Rohan Gupta",
  "Sneha Krishnan",
] as const;

function slugAuthor(slug: string): string {
  let h = 0;
  for (let i = 0; i < slug.length; i++) {
    h = (Math.imul(37, h) + slug.charCodeAt(i)) | 0;
  }
  return EDITORIAL_AUTHORS[Math.abs(h) % EDITORIAL_AUTHORS.length];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const meta = getBlogMetaBySlug(slug);

  const title = meta?.title ?? `${slugToTitle(slug)} | HireStepX Blog`;
  const description = meta?.metaDescription ??
    `Read "${slugToTitle(slug)}" on the HireStepX blog: interview tips, career advice, and job search strategies for Indian candidates.`;
  const image = meta?.heroImage ?? "https://hirestepx.com/opengraph-image";

  return {
    title: `${meta ? meta.title : slugToTitle(slug)} | HireStepX`,
    description,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      title,
      description,
      url: `https://hirestepx.com/blog/${slug}`,
      type: "article",
      siteName: "HireStepX",
      locale: "en_IN",
      images: [{ url: image, width: 1200, height: 630, alt: title }],
      ...(meta?.datePublished ? { publishedTime: meta.datePublished } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

/* ISR: generate paths for known slugs at build time; any new slug
   falls through to ISR on first visit. */
export async function generateStaticParams() {
  const { getAllBlogSlugs } = await import("@/blog-meta");
  return getAllBlogSlugs().map((slug) => ({ slug }));
}

export const revalidate = 86400;
export const dynamicParams = true;

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const meta = getBlogMetaBySlug(slug);
  const title = meta?.title ?? slugToTitle(slug);

  const { headers } = await import("next/headers");
  const nonce = (await headers()).get("x-nonce") ?? "";

  /* Related blog posts — same company first, then same category.
     Rendered server-side so Google crawls the cross-links without JS. */
  const related = meta ? relatedPosts(slug, meta.company, meta.category) : [];

  /* Related interview prep links — derived from the post's company field.
     Rendered server-side so Google crawls the cross-links without JS. */
  const companyKey = meta?.company ? companyKeyFromLabel(meta.company) : null;
  const relatedQuestions = companyKey
    ? SEO_PAGES.filter((p) => p.company === companyKey).slice(0, 3)
    : [];
  const salaryEntry = companyKey
    ? SALARY_SEO_PAGES.find((s) => s.slug === companyKey) ?? null
    : null;
  const companyLabel = companyKey ? (COMPANY_LABEL[companyKey] ?? meta?.company ?? "") : "";

  /* BlogPosting JSON-LD — the specific subtype required for "Top Stories"
     carousel eligibility. "Article" works but "BlogPosting" gets stronger
     signals for blog content. */
  const articleSchema = meta ? {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: meta.title,
    description: meta.metaDescription,
    image: meta.heroImage,
    datePublished: meta.datePublished,
    dateModified: meta.datePublished,
    author: { "@type": "Person", name: slugAuthor(slug), url: "https://hirestepx.com/about" },
    publisher: {
      "@type": "Organization",
      name: "HireStepX",
      logo: { "@type": "ImageObject", url: "https://hirestepx.com/wordmark.png" },
    },
    inLanguage: "en-IN",
    articleSection: meta.category,
    url: `https://hirestepx.com/blog/${slug}`,
    keywords: [meta.company, meta.category, "interview preparation India", "mock interview", "HireStepX"].filter(Boolean).join(", "),
    mainEntityOfPage: { "@type": "WebPage", "@id": `https://hirestepx.com/blog/${slug}` },
    isPartOf: { "@type": "Blog", name: "HireStepX Blog", url: "https://hirestepx.com/blog" },
  } : null;

  /* FAQPage JSON-LD — structured Q&A data. Note: FAQ rich results
     (visual accordion in SERP) were deprecated May 7, 2026; Article schema
     carries the main editorial signal. Only injected when faqs are defined. */
  const faqSchema = (meta?.faqs && meta.faqs.length > 0) ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: meta.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  } : null;

  return (
    <>
      <script
        type="application/ld+json"
        nonce={nonce || undefined}
        dangerouslySetInnerHTML={ldJson(
          breadcrumb([
            { name: "Blog", path: "/blog" },
            { name: title, path: `/blog/${slug}` },
          ]),
        )}
      />
      {articleSchema && (
        <script type="application/ld+json" nonce={nonce || undefined} dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      )}
      {faqSchema && (
        <script type="application/ld+json" nonce={nonce || undefined} dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      )}
      <BlogPage />
      {meta && !GENERAL_COMPANIES.has(meta.company) && (
        <div style={{ padding: "12px 24px", background: "#f0f4ff", borderTop: "1px solid #e4e7ec" }}>
          <div style={{ maxWidth: 720, margin: "0 auto", fontSize: 13, color: "#4b5563" }}>
            Filed under{" "}
            <a
              href={`/blog/company/${meta.company.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}`}
              style={{ color: "#6366f1", textDecoration: "underline" }}
            >
              {meta.company} interview guides
            </a>
          </div>
        </div>
      )}
      {related.length > 0 && (
        <section
          aria-label="Related articles"
          style={{ borderTop: "1px solid #e8eaed", padding: "40px 24px 48px" }}
        >
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: "#8a919e", textTransform: "uppercase", marginBottom: 12 }}>
              Read next
            </p>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1a1d23", margin: "0 0 20px" }}>
              Related articles
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {related.map((post) => (
                <a
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "14px 18px",
                    background: "#fff",
                    border: "1px solid #e4e7ec",
                    borderRadius: 10,
                    textDecoration: "none",
                    color: "#1a1d23",
                    fontSize: 14,
                    fontWeight: 500,
                  }}
                >
                  <span>{post.title}</span>
                  <span style={{ color: "#6366f1", fontSize: 13, marginLeft: 12, whiteSpace: "nowrap" }}>Read →</span>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}
      {(relatedQuestions.length > 0 || salaryEntry) && (
        <section
          aria-label={`Practice resources for ${companyLabel}`}
          style={{
            borderTop: "1px solid #e8eaed",
            background: "#f8f9fb",
            padding: "40px 24px 48px",
          }}
        >
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: "#8a919e", textTransform: "uppercase", marginBottom: 12 }}>
              Practice for {companyLabel}
            </p>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1a1d23", margin: "0 0 20px" }}>
              {companyLabel} Interview Prep on HireStepX
            </h2>
            {relatedQuestions.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: salaryEntry ? 20 : 0 }}>
                {relatedQuestions.map((q) => (
                  <a
                    key={q.slug}
                    href={`/questions/${q.slug}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "14px 18px",
                      background: "#fff",
                      border: "1px solid #e4e7ec",
                      borderRadius: 10,
                      textDecoration: "none",
                      color: "#1a1d23",
                      fontSize: 14,
                      fontWeight: 500,
                    }}
                  >
                    <span>{q.searchPhrase}</span>
                    <span style={{ color: "#6366f1", fontSize: 13, marginLeft: 12, whiteSpace: "nowrap" }}>Practice →</span>
                  </a>
                ))}
              </div>
            )}
            {salaryEntry && (
              <a
                href={`/salary/${salaryEntry.slug}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 18px",
                  background: "#fff",
                  border: "1px solid #e4e7ec",
                  borderRadius: 10,
                  textDecoration: "none",
                  color: "#1a1d23",
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                <span>{companyLabel} Salary Guide — CTC breakdown for India 2026</span>
                <span style={{ color: "#6366f1", fontSize: 13, marginLeft: 12, whiteSpace: "nowrap" }}>View →</span>
              </a>
            )}
          </div>
        </section>
      )}
    </>
  );
}
