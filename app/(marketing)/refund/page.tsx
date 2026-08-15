import type { Metadata } from "next";
import { RefundPolicyV2 } from "@/marketing-v2/MarketingPagesV2";
import { buildRefundJsonLd } from "./_jsonld";

export const metadata: Metadata = {
  title: "Refund Policy | HireStepX",
  description: "HireStepX Refund Policy: when session credits are refunded, how to request one, and what is non-refundable. Refunds processed within 5–7 business days.",
  alternates: { canonical: "/refund" },
};

export const revalidate = 86400;

export default async function Page() {
  return (
    <>
      {buildRefundJsonLd().map((html, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={html} />
      ))}
      <RefundPolicyV2 />
    </>
  );
}
