/* Shared source of truth for /refund's JSON-LD, used by both the page
 * (renders it) and scripts/generate-jsonld-csp-hashes.mts (hashes the
 * JSON-LD for the CSP header). Keeping this in one place guarantees the
 * hash always matches what the page actually renders. */

const BREADCRUMB_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://hirestepx.com/" },
    { "@type": "ListItem", position: 2, name: "Refund policy", item: "https://hirestepx.com/refund" },
  ],
};

export function buildRefundJsonLd(): { __html: string }[] {
  return [{ __html: JSON.stringify(BREADCRUMB_SCHEMA) }];
}
