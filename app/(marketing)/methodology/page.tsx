import type { Metadata } from "next";
import { MethodologyV2 } from "@/marketing-v2/MarketingPagesV2";
import { buildMethodologyJsonLd } from "./_jsonld";

export const metadata: Metadata = {
  title: "Methodology | HireStepX",
  description: "How HireStepX sources and labels interview questions and salary data: officially documented, candidate-reported, common practice, or HireStepX practice questions.",
  alternates: { canonical: "/methodology" },
};

export const revalidate = 86400;

export default async function Page() {
  return (
    <>
      {buildMethodologyJsonLd().map((html, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={html} />
      ))}
      <MethodologyV2 />
    </>
  );
}
