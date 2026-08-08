import { BLOG_META } from "@/blog-meta";
import { breadcrumb, ldJson } from "@/marketing-v2/_schema";
import { COMPANY_LABEL } from "../../../../../data/company-labels";

/* Shared source of truth for /blog/company/[slug]'s JSON-LD, used by both
 * the page (renders it) and scripts/generate-jsonld-csp-hashes.mts (hashes
 * it for the CSP header). Keeping this in one place guarantees the hash
 * always matches what the page actually renders. */

const GENERAL_COMPANIES = new Set([
  "General", "Interview Skills", "Role Guides", "Industry Insights",
  "Career Advice", "Career",
]);

export function companyToSlug(company: string): string {
  return company.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

/* Reverse-lookup COMPANY_LABEL to find the data key from display name. */
export function companyKeyFromLabel(label: string): string | null {
  const lower = label.toLowerCase();
  const entry = Object.entries(COMPANY_LABEL).find(([, v]) => v.toLowerCase() === lower);
  if (entry) return entry[0];
  return lower.replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || null;
}

/* Enumerates every company slug that has at least one non-general blog
   post, for generateStaticParams and the CSP hash generator to loop over. */
export function getAllBlogCompanySlugs(): string[] {
  const companies = [...new Set(
    BLOG_META
      .map((p) => p.company)
      .filter((c) => !GENERAL_COMPANIES.has(c)),
  )];
  return companies.map((c) => companyToSlug(c));
}

export function buildBlogCompanyJsonLd(slug: string): { __html: string }[] | null {
  const posts = BLOG_META.filter(
    (p) => companyToSlug(p.company) === slug && !GENERAL_COMPANIES.has(p.company),
  );
  if (posts.length === 0) return null;

  const company = posts[0].company;
  const companyKey = companyKeyFromLabel(company);
  const displayName = companyKey ? (COMPANY_LABEL[companyKey] ?? company) : company;

  const breadcrumbSchema = breadcrumb([
    { name: "Blog", path: "/blog" },
    { name: `${displayName} Guides`, path: `/blog/company/${slug}` },
  ]);

  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${displayName} Interview Guides, HireStepX Blog`,
    description: `All ${displayName} interview preparation articles on HireStepX`,
    url: `https://hirestepx.com/blog/company/${slug}`,
    numberOfItems: posts.length,
    itemListElement: posts.map((post, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `https://hirestepx.com/blog/${post.slug}`,
      name: post.title,
    })),
  };

  return [ldJson(breadcrumbSchema), ldJson(itemListSchema)];
}
