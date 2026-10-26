import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BLOG_META } from "@/blog-meta";
import { SEO_PAGES } from "../../../../../data/seo-pages";
import { SALARY_SEO_PAGES, salaryCompanyLabel } from "../../../../../data/salary-seo";
import { COMPANY_LABEL } from "../../../../../data/company-labels";
import { HubTemplate } from "@/home2/HubTemplate";
import {
  buildBlogCompanyJsonLd,
  companyToSlug,
  companyKeyFromLabel,
  getAllBlogCompanySlugs,
} from "./_jsonld";
import { questionHref } from "../../../../../src/seoLinks";

/* /blog/company/[slug] — company-specific blog category pages.
 *
 * One page per company that has at least one post in BLOG_META.
 * Targets queries like "TCS interview questions blog India 2026",
 * "Infosys interview tips", etc.
 *
 * Generated at build time via generateStaticParams.
 * Schema: BreadcrumbList + ItemList
 */

const GENERAL_COMPANIES = new Set([
  "General", "Interview Skills", "Role Guides", "Industry Insights",
  "Career Advice", "Career",
]);

/* Content is static data (BLOG_META) — only changes on redeploy, which
   invalidates the ISR cache anyway. Long interval avoids racking up ISR
   writes every day across every company page (see Vercel Usage: ISR Writes). */
export const revalidate = 2592000; /* 30 days */

export async function generateStaticParams() {
  return getAllBlogCompanySlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = BLOG_META.find(
    (p) => companyToSlug(p.company) === slug && !GENERAL_COMPANIES.has(p.company),
  );
  if (!post) return { title: "Not Found" };

  const companyKey = companyKeyFromLabel(post.company);
  const displayName = companyKey ? (COMPANY_LABEL[companyKey] ?? post.company) : post.company;

  return {
    title: `${displayName} Interview Questions & Tips 2026 | HireStepX Blog`,
    description: `All ${displayName} interview guides on HireStepX: preparation tips, question breakdowns, and strategy for ${displayName} roles in India 2026.`,
    alternates: { canonical: `/blog/company/${slug}` },
    // Thin list-of-links page: it has no unique content beyond linking out to the
    // real articles/salary/questions pages for this company, so it was competing
    // with (and losing to) those pages for the same query intent — GSC showed
    // all 49 instances stuck at position 40-77 with a 0.6% CTR. noindex stops it
    // from cannibalizing search visibility while `follow` keeps passing link
    // equity to the pages that actually rank.
    robots: { index: false, follow: true },
    openGraph: {
      title: `${displayName} Interview Guides, HireStepX Blog`,
      description: `All ${displayName} interview guides on HireStepX: preparation tips, question breakdowns, and strategy for ${displayName} roles in India 2026.`,
      url: `https://hirestepx.com/blog/company/${slug}`,
      type: "website",
      siteName: "HireStepX",
      locale: "en_IN",
      images: [{ url: "https://hirestepx.com/opengraph-image", width: 1200, height: 630, alt: `${displayName} Interview Guides, HireStepX` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${displayName} Interview Guides, HireStepX Blog`,
      description: `All ${displayName} interview preparation articles on HireStepX: tips, question breakdowns, and strategy for India 2026.`,
      images: ["https://hirestepx.com/opengraph-image"],
    },
  };
}

export default async function BlogCompanyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const posts = BLOG_META.filter(
    (p) => companyToSlug(p.company) === slug && !GENERAL_COMPANIES.has(p.company),
  );
  if (posts.length === 0) notFound();

  const company = posts[0].company;
  const companyKey = companyKeyFromLabel(company);
  const displayName = companyKey ? (COMPANY_LABEL[companyKey] ?? company) : company;

  const questionPages = companyKey
    ? SEO_PAGES.filter((p) => p.company === companyKey).slice(0, 3)
    : [];
  const salaryEntry = companyKey
    ? SALARY_SEO_PAGES.find((s) => s.slug === companyKey) ?? null
    : null;

  /* No CSP nonce here on purpose — a live per-request headers() read would
     force this ISR route fully dynamic (defeating `revalidate` and killing
     cache-control, which is what starved this route of Googlebot crawl
     budget). This JSON-LD content is deterministic per company, so its CSP
     allowance comes from a build-time content hash instead — see
     scripts/generate-jsonld-csp-hashes.mts and proxy.ts's buildCsp(). */
  const jsonLdScripts = buildBlogCompanyJsonLd(slug);
  if (!jsonLdScripts) notFound();

  return (
    <>
      {jsonLdScripts.map((html, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={html} />
      ))}
      <HubTemplate
        kicker={`${posts.length} ${posts.length === 1 ? "guide" : "guides"}`}
        title={`${displayName} Interview Questions & Tips`}
        dek={`All ${displayName} interview preparation guides on HireStepX: question breakdowns, preparation strategy, and role-specific tips for Indian candidates in 2026.`}
        crumbs={[{ label: "Blog", href: "/blog" }, { label: displayName }]}
        sections={[
          {
            kind: "grid", id: "guides", title: `${displayName} interview guides`,
            items: posts.map((post) => ({ label: post.title, href: `/blog/${post.slug}`, meta: `${post.category} · ${post.readTime} · ${post.datePublished}` })),
            initial: 18, filter: posts.length > 18,
          },
          ...(questionPages.length > 0 || salaryEntry ? [{
            kind: "grid" as const, id: "practice", title: `Practice ${displayName} interviews on HireStepX`,
            items: [
              ...questionPages.map((q) => ({ label: q.searchPhrase, href: questionHref(q.slug), meta: "Practice" })),
              ...(salaryEntry ? [{ label: `${salaryCompanyLabel(salaryEntry.slug)} Salary Guide, India 2026 CTC breakdown`, href: `/salary/${salaryEntry.slug}`, meta: "View" }] : []),
            ],
          }] : []),
        ]}
        close={{ kicker: "Practise", title: "Stop reading. Start practising.", body: "The AI interviewer asks real questions, listens to your voice answer, and grades your structure and delivery.", primary: ["Start free practice", "/signup?source=blog-company"] }}
      />
    </>
  );
}
