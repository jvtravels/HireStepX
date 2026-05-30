import type { Metadata } from "next";
import { PricingPageV2 } from "@/marketing-v2/MarketingPagesV2";

export const metadata: Metadata = {
  title: "Pricing | HireStepX",
  description:
    "Honest INR pricing for AI mock interviews. Free 3 sessions, ₹49 weekly, ₹149/mo Pro, ₹1430/yr Pro. UPI accepted. 30% student discount on .ac.in / .edu.in addresses.",
  alternates: { canonical: "/pricing-v2" },
};

export const dynamic = "force-static";
export const revalidate = 3600;

export default function Page() {
  return <PricingPageV2 />;
}
