import { breadcrumb } from "@/marketing-v2/_schema";
import { FAQ_ENTRIES, type FaqEntry } from "./_content";

/* Shared source of truth for /employers' JSON-LD, used by the page (renders
 * it) and scripts/generate-jsonld-csp-hashes.mts (hashes it for the CSP
 * manifest), so the hash always matches what is served. */

/** `<` is escaped so FAQ text can never close the script tag (Next.js JSON-LD guidance). */
function serialize(schema: Record<string, unknown>): { __html: string } {
  return { __html: JSON.stringify(schema).replace(/</g, "\\u003c") };
}

export function buildFaqSchema(entries: readonly FaqEntry[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: entries.map((e) => ({
      "@type": "Question",
      name: e.question,
      acceptedAnswer: { "@type": "Answer", text: e.answer },
    })),
  };
}

/* Brand entity for the employer landing page. Kept free of build-time env (legal
 * name, GSTIN) so the CSP hash computed by the generator script is identical to
 * what the page renders. */
export function buildOrganizationSchema(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "HireStepX",
    url: "https://hirestepx.com",
    logo: "https://hirestepx.com/wordmark.png",
    description: "AI mock interview platform for Indian candidates. Employers post a job free and pay only to unlock the contact details of matched candidates.",
    areaServed: { "@type": "Country", name: "India" },
    sameAs: ["https://www.linkedin.com/company/hirestepx", "https://twitter.com/hirestepx"],
    contactPoint: { "@type": "ContactPoint", contactType: "customer support", url: "https://hirestepx.com/contact", availableLanguage: ["English"] },
  };
}

export function buildEmployersJsonLd(): { __html: string }[] {
  return [
    serialize(breadcrumb([{ name: "For employers", path: "/employers" }])),
    serialize(buildFaqSchema(FAQ_ENTRIES)),
    serialize(buildOrganizationSchema()),
  ];
}
