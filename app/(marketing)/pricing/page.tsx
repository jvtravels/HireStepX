import type { Metadata } from "next";
import { PricingPageV2 } from "@/marketing-v2/MarketingPagesV2";

export const metadata: Metadata = {
  title: "Pricing | HireStepX",
  description:
    "Free 3 sessions, ₹9/session, ₹49/week (7 sessions). UPI accepted. 30% student discount on .ac.in / .edu.in.",
  alternates: { canonical: "/pricing" },
};

export const dynamic = "force-static";
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
  { name: "Free",        price: "0",  description: "3 practice sessions, no card required", anchor: "free" },
  { name: "Per session", price: "9",  description: "Single mock interview session",         anchor: "per-session" },
  { name: "Weekly",      price: "49", description: "7 sessions over 7 days",                anchor: "weekly" },
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

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB_SCHEMA) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(PRICING_SCHEMA) }} />
      <PricingPageV2 />
    </>
  );
}
