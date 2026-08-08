import { breadcrumb, ldJson } from "@/marketing-v2/_schema";
import { getBlogMetaBySlug } from "@/blog-meta";

/* Pure JSON-LD builder shared by the page (renders it) and
 * scripts/generate-jsonld-csp-hashes.mts (hashes it for the CSP header).
 * Keeping this logic in one place guarantees the hash always matches what
 * the page actually renders — duplicating it in the generator would drift. */

function slugToTitle(slug: string): string {
  return slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function slugAuthor(_slug: string): string {
  return "HireStepX Editorial Team";
}

export function buildBlogJsonLd(slug: string): { __html: string }[] {
  const meta = getBlogMetaBySlug(slug);
  const title = meta?.title ?? slugToTitle(slug);

  const articleSchema = meta ? {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: meta.title,
    description: meta.metaDescription,
    image: meta.heroImage,
    datePublished: meta.datePublished,
    dateModified: meta.datePublished,
    author: { "@type": "Organization", name: slugAuthor(slug), url: "https://hirestepx.com/about" },
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

  const faqSchema = (meta?.faqs && meta.faqs.length > 0) ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: meta.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  } : null;

  const scripts: { __html: string }[] = [
    ldJson(
      breadcrumb([
        { name: "Blog", path: "/blog" },
        { name: title, path: `/blog/${slug}` },
      ]),
    ),
  ];
  if (articleSchema) scripts.push(ldJson(articleSchema));
  if (faqSchema) scripts.push(ldJson(faqSchema));
  return scripts;
}
