import { getCityPageBySlug } from "../../../../data/city-pages";
import { breadcrumb, ldJson } from "@/marketing-v2/_schema";

/* Shared source of truth for /interview-prep/[city]'s JSON-LD, used by both
 * the page (renders it) and scripts/generate-jsonld-csp-hashes.mts (hashes
 * it for the CSP header). Keeping this in one place guarantees the hash
 * always matches what the page actually renders. */

export function buildInterviewPrepCityJsonLd(slug: string): { __html: string }[] | null {
  const page = getCityPageBySlug(slug);
  if (!page) return null;

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

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const breadcrumbSchema = breadcrumb([
    { name: "Interview Prep", path: "/interview-prep" },
    { name: page.displayName, path: `/interview-prep/${slug}` },
  ]);

  return [ldJson(faqSchema), ldJson(breadcrumbSchema)];
}
