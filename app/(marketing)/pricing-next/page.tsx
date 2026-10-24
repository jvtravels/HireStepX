import type { Metadata } from "next";
import { PricingPage } from "@/home2/PricingPage";
import { JsonLd, PRICING_PRODUCT, breadcrumbs } from "@/home2/jsonld";

export const metadata: Metadata = { title: "Pricing: Pay Once in INR, No Subscription | HireStepX", description: "Pay once in INR, no subscription. Two free mock interview sessions, then simple one-time packs with UPI checkout. See what each pack includes before you pay.", alternates: { canonical: "/pricing" } };

export default function Page() {
  return (
    <>
      <JsonLd data={[breadcrumbs([["Pricing", "/pricing"]]), PRICING_PRODUCT]} />
      <PricingPage />
    </>
  );
}
