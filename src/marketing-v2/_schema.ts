/* Shared structured-data helpers for marketing pages. Each page injects
 * its own breadcrumb (Home → Page) so Google can render the path in the
 * SERP. Page-specific schemas (HowTo, Product, etc.) live in the page
 * file that owns them. */

const BASE = "https://hirestepx.com";

export type BreadcrumbItem = { name: string; path: string };

/** Returns a BreadcrumbList JSON-LD object for the given trail.
 *  The first item is always Home; pass only the segments after it. */
export function breadcrumb(items: BreadcrumbItem[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${BASE}/` },
      ...items.map((it, i) => ({
        "@type": "ListItem",
        position: i + 2,
        name: it.name,
        item: `${BASE}${it.path}`,
      })),
    ],
  };
}

/** Serializes a JSON-LD payload as the inner HTML of a <script> tag. */
export function ldJson(schema: Record<string, unknown>): { __html: string } {
  return { __html: JSON.stringify(schema) };
}
