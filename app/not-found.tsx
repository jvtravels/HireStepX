import type { Metadata } from "next";
import { NotFoundV2 } from "@/marketing-v2/MarketingPagesV2";
import MarketingShell from "./(marketing)/MarketingShell";

export const metadata: Metadata = {
  title: "Page Not Found | HireStepX",
  description: "The page you're looking for doesn't exist. Practice AI mock interviews for TCS, Google, Flipkart, and 50+ companies.",
  robots: "noindex",
};

export default function NotFound() {
  return (
    <MarketingShell>
      <NotFoundV2 />
    </MarketingShell>
  );
}
