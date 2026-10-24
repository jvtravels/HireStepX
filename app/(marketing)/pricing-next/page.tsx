import type { Metadata } from "next";
import { PricingPage } from "@/home2/PricingPage";

export const metadata: Metadata = { title: "Pricing: Pay Once in INR, No Subscription | HireStepX", description: "Pay once in INR, no subscription. Two free mock interview sessions, then simple one-time packs with UPI checkout.", alternates: { canonical: "/pricing" } };

export default function Page() {
  return <PricingPage />;
}
