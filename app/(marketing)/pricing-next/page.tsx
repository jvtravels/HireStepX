import type { Metadata } from "next";
import { PricingPage } from "@/home2/PricingPage";

export const metadata: Metadata = {
  title: "HireStepX pricing",
  robots: "noindex, nofollow",
  alternates: { canonical: "/pricing" },
};

export default function Page() {
  return <PricingPage />;
}
