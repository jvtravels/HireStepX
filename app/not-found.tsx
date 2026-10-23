import type { Metadata } from "next";
import { NotFoundV2 } from "@/marketing-v2/MarketingPagesV2";
import MarketingShell from "./(marketing)/MarketingShell";
import NotFoundSwitch from "./NotFoundSwitch";

export const metadata: Metadata = {
  title: "Page Not Found | HireStepX",
  description: "The page you're looking for doesn't exist. Practice AI mock interviews for TCS, Google, Flipkart, and 200+ companies.",
  robots: "noindex",
};

export default function NotFound() {
  return (
    <MarketingShell>
      <NotFoundSwitch>
        <NotFoundV2 />
      </NotFoundSwitch>
    </MarketingShell>
  );
}
