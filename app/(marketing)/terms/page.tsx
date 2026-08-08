import type { Metadata } from "next";
import { TermsV2 } from "@/marketing-v2/MarketingPagesV2";
import { buildTermsJsonLd } from "./_jsonld";

export const metadata: Metadata = {
  title: "Terms of Service | HireStepX",
  description: "HireStepX Terms of Service. Usage rules, payment terms, refund eligibility, account suspension, and your rights as a user in India.",
  alternates: { canonical: "/terms" },
};

export const revalidate = 86400;

export default async function Page() {
  return (
    <>
      {buildTermsJsonLd().map((html, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={html} />
      ))}
      <TermsV2 />
    </>
  );
}
