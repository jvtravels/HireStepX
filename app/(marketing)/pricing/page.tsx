import type { Metadata } from "next";
import { PricingPageV2 } from "@/marketing-v2/MarketingPagesV2";
import { buildPricingJsonLd, buildPricingProductSchema } from "./_jsonld";
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

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export default async function Page() {
  const [breadcrumbHtml] = buildPricingJsonLd();
  const ratingAggregate = await fetchProductRatingAggregate({
    supabaseUrl: SUPABASE_URL,
    serviceKey: SUPABASE_SERVICE_KEY,
  });
  const productHtml = { __html: JSON.stringify(buildPricingProductSchema(ratingAggregate)) };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={breadcrumbHtml} />
      <script type="application/ld+json" dangerouslySetInnerHTML={productHtml} />
      <PricingPageV2 />
    </>
  );
}
