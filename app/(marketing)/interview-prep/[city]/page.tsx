import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CITY_PAGES, getCityPageBySlug, getAllCitySlugs } from "../../../../data/city-pages";
import { SEO_PAGES } from "../../../../data/seo-pages";
import { COMPANY_LABEL } from "../../../../data/company-labels";
import { HubTemplate } from "@/home2/HubTemplate";
import { buildInterviewPrepCityJsonLd } from "./_jsonld";
import { questionHref } from "../../../../src/seoLinks";

/* /interview-prep/[city] — city-specific interview prep landing pages.
 *
 * Targets location-qualified queries ("interview preparation Bengaluru",
 * "mock interview practice Hyderabad") that the company × focus SEO tree
 * (data/seo-pages.ts) doesn't serve, since those pages target a specific
 * employer rather than a candidate searching by city.
 *
 * Company lists in data/city-pages.ts are grounded in real office
 * locations from data/company-known-facts.ts, not invented.
 *
 * Schema: BreadcrumbList + FAQPage
 */

/* Content is static data (data/city-pages.ts) — only changes on redeploy,
   which invalidates the ISR cache anyway. Long interval avoids racking up
   ISR writes every day (see Vercel Usage: ISR Writes). */
export const revalidate = 2592000; /* 30 days */

export async function generateStaticParams() {
  return getAllCitySlugs().map((city) => ({ city }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const { city: slug } = await params;
  const page = getCityPageBySlug(slug);
  if (!page) return { title: "Not Found" };

  const title = `${page.displayName} Interview Prep 2026 | HireStepX`;
  const description = `Prepare for interviews at companies hiring in ${page.city}. Role- and company-specific AI mock interviews, scored feedback, 2 free sessions.`;

  return {
    title,
    description,
    alternates: { canonical: `/interview-prep/${slug}` },
    openGraph: {
      title,
      description,
      url: `https://hirestepx.com/interview-prep/${slug}`,
      type: "website",
      siteName: "HireStepX",
      locale: "en_IN",
      images: [{ url: "https://hirestepx.com/opengraph-image", width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["https://hirestepx.com/opengraph-image"],
    },
  };
}

export default async function CityInterviewPrepPage({
  params,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city: slug } = await params;
  const page = getCityPageBySlug(slug);
  if (!page) notFound();

  /* No CSP nonce here on purpose — a live per-request headers() read would
     force this ISR route fully dynamic (defeating `revalidate` and killing
     cache-control, which is what starved this route of Googlebot crawl
     budget). This JSON-LD content is deterministic per city, so its CSP
     allowance comes from a build-time content hash instead — see
     scripts/generate-jsonld-csp-hashes.mts and proxy.ts's buildCsp(). */
  const jsonLdScripts = buildInterviewPrepCityJsonLd(slug);
  if (!jsonLdScripts) notFound();

  const companyLinks = page.companies
    .map((key) => {
      const seoPage = SEO_PAGES.find((p) => p.company === key);
      if (!seoPage) return null;
      return { key, label: COMPANY_LABEL[key] ?? key, slug: seoPage.slug };
    })
    .filter((c): c is { key: string; label: string; slug: string } => c !== null);

  const faqs = [
    {
      q: `Which companies hire for tech and business roles in ${page.city}?`,
      a: `${page.hiringContext}`,
    },
    {
      q: `How should I prepare differently for a ${page.city} interview versus another Indian city?`,
      a: `The company mix matters more than the city itself. ${page.city}'s hiring is concentrated in specific sectors (see above), so target your prep at the actual employer and role rather than generic "city interview tips": the format, rubric, and difficulty are set by the company, not the location.`,
    },
    {
      q: `Can I practice interviews for ${page.city} companies with HireStepX?`,
      a: `Yes. HireStepX's question banks are built per company and role, not per city, so you practice the exact interview format used by any company hiring in ${page.city} that HireStepX covers, with scored feedback after every session.`,
    },
  ];

  return (
    <>
      {jsonLdScripts.map((html, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={html} />
      ))}
      <HubTemplate
        kicker="City guide · 2026"
        title={`Interview preparation in ${page.displayName}`}
        dek={page.intro}
        crumbs={[{ label: "Interview prep", href: "/interview-prep" }, { label: page.displayName }]}
        stats={[{ label: "Companies covered", value: String(companyLinks.length) }, { label: "Free sessions", value: "2" }]}
        cta={["Start free mock interview", "/signup?source=interview-prep-city"]}
        sections={[
          { kind: "text", id: "hiring", title: `What hiring in ${page.city} actually looks like`, paragraphs: [page.hiringContext] },
          {
            kind: "grid", id: "companies", title: `Companies hiring in ${page.city}`,
            sub: "Practise the exact interview format for each company below. Question banks are built per company and role, not generic.",
            items: companyLinks.map((c) => ({ label: c.label, href: questionHref(c.slug) })), initial: 18, filter: companyLinks.length > 18,
          },
          { kind: "grid", id: "cities", title: "Other cities", items: CITY_PAGES.filter((c) => c.slug !== slug).map((c) => ({ label: c.city, href: `/interview-prep/${c.slug}` })) },
        ]}
        faqs={faqs}
        close={{ kicker: "Practise", title: "Stop reading. Start practising.", body: "The AI interviewer asks real questions, listens to your voice answer, and grades your structure and delivery.", primary: ["Start free practice", "/signup?source=interview-prep-city-cta"] }}
      />
    </>
  );
}
