import type { Metadata } from "next";
import { PrivacyV2 } from "@/marketing-v2/MarketingPagesV2";
import { buildPrivacyJsonLd } from "./_jsonld";

export const metadata: Metadata = {
  title: "Privacy Policy | HireStepX",
  description:
    "How HireStepX collects, uses, and protects your interview data. DPDP Act 2023 aligned. Delete everything anytime from Settings.",
  alternates: { canonical: "/privacy" },
};

export const revalidate = 86400;

export default async function Page() {
  return (
    <>
      {buildPrivacyJsonLd().map((html, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={html} />
      ))}
      <PrivacyV2 />
    </>
  );
}
