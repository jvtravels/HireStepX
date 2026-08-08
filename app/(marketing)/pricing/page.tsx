import type { Metadata } from "next";
import { PricingPageV2 } from "@/marketing-v2/MarketingPagesV2";
import { buildPricingJsonLd } from "./_jsonld";

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

export default async function Page() {
  return (
    <>
      {buildPricingJsonLd().map((html, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={html} />
      ))}
      <PricingPageV2 />
    </>
  );
}
