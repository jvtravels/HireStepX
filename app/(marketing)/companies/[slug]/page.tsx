import { notFound, permanentRedirect } from "next/navigation";
import { getSeoPageBySlug, getAllSeoSlugs, SEO_PAGES } from "../../../../data/seo-pages";

/* /companies/[slug] — legacy alias for /questions/[slug].
 *
 * This route used to fully re-render the /questions/[slug] page content
 * (same FAQ/Article/HowTo schema, same copy) with its canonical tag pointing
 * at /questions/[slug]. That left a second, fully-rendered HTML document at
 * a non-canonical URL for every one of the ~250 SEO pages — dependent on
 * Google always honouring the canonical hint rather than indexing both.
 *
 * No internal link anywhere in the app points at /companies/[slug] — the
 * /companies index links straight to /questions/[slug], and this route was
 * never in the sitemap. The only traffic this URL still gets is stale
 * external links / already-indexed Google results, so a real 301 is a
 * strict improvement over duplicate rendering: it consolidates any
 * remaining link equity onto the canonical URL instead of leaving a
 * second copy for crawlers to find.
 */
export async function generateStaticParams() {
  return getAllSeoSlugs().map((slug) => ({ slug }));
}

export const dynamicParams = true;

export default async function CompanySeoPageRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = getSeoPageBySlug(slug);
  if (page) permanentRedirect(`/questions/${slug}`);

  /* Bare company slug (e.g. /companies/flipkart) — redirect to that
     company's first SEO page under /questions, not another /companies/ URL. */
  const firstForCompany = SEO_PAGES.find((p) => p.company === slug);
  if (firstForCompany) permanentRedirect(`/questions/${firstForCompany.slug}`);

  notFound();
}
