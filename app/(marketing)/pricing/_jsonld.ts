/* Shared source of truth for /pricing's JSON-LD, used by both the page
 * (renders it) and scripts/generate-jsonld-csp-hashes.mts (hashes the
 * JSON-LD for the CSP header). Keeping this in one place guarantees the
 * hash always matches what the page actually renders. */

/* Per-page JSON-LD:
 * - BreadcrumbList lets Google render Home › Pricing in the SERP.
 * - Product+Offer ItemList exposes the four SKUs as a rich result candidate
 *   ("priced from ₹0" snippet). Keep tier list in sync with the on-page table. */
const BREADCRUMB_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://hirestepx.com/" },
    { "@type": "ListItem", position: 2, name: "Pricing", item: "https://hirestepx.com/pricing" },
  ],
};

/* Source of truth for the pricing schema. lowPrice / highPrice /
 * offerCount are derived from this array so the schema can't drift
 * out of sync with the on-page table when a tier is added or removed. */
const PRICING_TIERS = [
  { name: "Free",         price: "0",  description: "2 practice sessions, no card required",                          anchor: "free" },
  { name: "Per session",  price: "9",  description: "Single mock interview session, credit never expires",             anchor: "per-session" },
  { name: "Sprint Pack",  price: "39", description: "5 sessions per month, auto-renews monthly, cancel any time",     anchor: "sprint-pack" },
  // Monthly plan temporarily hidden — keep data here for when it returns
  // { name: "Monthly", price: "149", description: "40 sessions over 30 days", anchor: "monthly" },
] as const;

const tierPrices = PRICING_TIERS.map((t) => Number(t.price));
const PRICING_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "HireStepX AI Mock Interview Practice",
  description:
    "AI-powered voice mock interviews with STAR scoring, company-specific question banks, and skill-decay tracking.",
  brand: { "@type": "Brand", name: "HireStepX" },
  offers: {
    "@type": "AggregateOffer",
    priceCurrency: "INR",
    lowPrice: String(Math.min(...tierPrices)),
    highPrice: String(Math.max(...tierPrices)),
    offerCount: PRICING_TIERS.length,
    offers: PRICING_TIERS.map((tier) => ({
      "@type": "Offer",
      name: tier.name,
      price: tier.price,
      priceCurrency: "INR",
      description: tier.description,
      url: `https://hirestepx.com/pricing#${tier.anchor}`,
    })),
  },
};

export function buildPricingJsonLd(): { __html: string }[] {
  return [
    { __html: JSON.stringify(BREADCRUMB_SCHEMA) },
    { __html: JSON.stringify(PRICING_SCHEMA) },
  ];
}
