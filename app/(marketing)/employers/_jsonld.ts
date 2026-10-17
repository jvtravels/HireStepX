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

export function buildEmployersJsonLd(): { __html: string }[] {
  return [
    serialize(breadcrumb([{ name: "For employers", path: "/employers" }])),
    serialize(buildFaqSchema(FAQ_ENTRIES)),
  ];
}
