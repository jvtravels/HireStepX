import type { Metadata } from "next";
import { RefundPolicyV2 } from "@/marketing-v2/MarketingPagesV2";

export const metadata: Metadata = {
  title: "Refund Policy | HireStepX",
  description: "When refunds apply, how to request one, and what we don't refund.",
  alternates: { canonical: "/refund-policy" },
};

export const dynamic = "force-static";
export const revalidate = 86400;

export default function Page() {
  return <RefundPolicyV2 />;
}
