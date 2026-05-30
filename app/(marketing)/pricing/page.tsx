import type { Metadata } from "next";
import { PricingPageV2 } from "@/marketing-v2/MarketingPagesV2";

export const metadata: Metadata = {
  title: "Pricing | HireStepX",
  description:
    "Free 3 sessions, ₹9/session, ₹49/week (10 sessions), ₹149/month (40 sessions). UPI accepted. 30% student discount on .ac.in / .edu.in.",
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
    lowPrice: "0",
    highPrice: "149",
    offerCount: 4,
    offers: [
      { "@type": "Offer", name: "Free", price: "0", priceCurrency: "INR", description: "3 practice sessions, no card required", url: "https://hirestepx.com/pricing#free" },
      { "@type": "Offer", name: "Per session", price: "9", priceCurrency: "INR", description: "Single mock interview session", url: "https://hirestepx.com/pricing#per-session" },
      { "@type": "Offer", name: "Weekly", price: "49", priceCurrency: "INR", description: "10 sessions over 7 days", url: "https://hirestepx.com/pricing#weekly" },
      { "@type": "Offer", name: "Monthly", price: "149", priceCurrency: "INR", description: "40 sessions over 30 days", url: "https://hirestepx.com/pricing#monthly" },
    ],
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
