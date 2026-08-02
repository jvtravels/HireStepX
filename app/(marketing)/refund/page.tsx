import type { Metadata } from "next";
import { RefundPolicyV2 } from "@/marketing-v2/MarketingPagesV2";

export const metadata: Metadata = {
  title: "Refund Policy | HireStepX",
  description: "HireStepX Refund Policy: when session credits are refunded, how to request one, and what is non-refundable. Refunds processed within 5–7 business days.",
  alternates: { canonical: "/refund" },
};

export const revalidate = 86400;

const BREADCRUMB_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://hirestepx.com/" },
    { "@type": "ListItem", position: 2, name: "Refund policy", item: "https://hirestepx.com/refund" },
  ],
};

export default async function Page() {
  const { headers } = await import("next/headers");
  const nonce = (await headers()).get("x-nonce") ?? "";
  return (
    <>
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB_SCHEMA) }} />
      <RefundPolicyV2 />
    </>
  );
}
