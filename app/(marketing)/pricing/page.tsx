import type { Metadata } from "next";
import { PricingPageV2 } from "@/marketing-v2/MarketingPagesV2";
import { fetchProductRatingAggregate } from "../../../server-handlers/_product-rating-helpers";

export const metadata: Metadata = {
  title: "Pricing: Start Free, ₹9 per session | HireStepX",
  description:
    "2 free AI mock interviews, no card needed. ₹9 per session (credits never expire) or Sprint Pack: 5 sessions for ₹39/month. Pay by UPI, card, or netbanking.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "HireStepX Pricing: Start Free, ₹9 per session",
    description: "2 free AI mock interviews, no card needed. ₹9 per session or Sprint Pack: 5 sessions for ₹39/month. Pay by UPI, card, or netbanking.",
    url: "https://hirestepx.com/pricing",
    type: "website",
    siteName: "HireStepX",
    locale: "en_IN",
    images: [{ url: "https://hirestepx.com/opengraph-image", width: 1200, height: 630, alt: "HireStepX Pricing: Start Free, ₹9 per session" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "HireStepX Pricing: Start Free, ₹9 per session",
    description: "2 free AI mock interviews, no card needed. ₹9 per session or Sprint Pack: 5 sessions for ₹39/month.",
    images: ["https://hirestepx.com/opengraph-image"],
  },
};

export const revalidate = 3600;

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

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export default async function Page() {
  const { headers } = await import("next/headers");
  const nonce = (await headers()).get("x-nonce") ?? "";

  /* aggregateRating is only ever real: fetchProductRatingAggregate reads
   * genuine 1-5 star submissions (product_ratings, collected on the
   * session report screen) and returns null below its K-anonymity floor.
   * Google flags Product schema without aggregateRating/review as
   * "could be improved" — never fabricate one to silence that; omit the
   * field until there's a real, non-gameable sample. */
  const ratingAggregate = await fetchProductRatingAggregate({
    supabaseUrl: SUPABASE_URL,
    serviceKey: SUPABASE_SERVICE_KEY,
  });

  const PRICING_SCHEMA = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "HireStepX AI Mock Interview Practice",
    description:
      "AI-powered voice mock interviews with STAR scoring, company-specific question banks, and skill-decay tracking.",
    brand: { "@type": "Brand", name: "HireStepX" },
    ...(ratingAggregate && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: String(ratingAggregate.average),
        reviewCount: String(ratingAggregate.count),
        bestRating: "5",
        worstRating: "1",
      },
    }),
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

  return (
    <>
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB_SCHEMA) }} />
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(PRICING_SCHEMA) }} />
      <PricingPageV2 />
    </>
  );
}
