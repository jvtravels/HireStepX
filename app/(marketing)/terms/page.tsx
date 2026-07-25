import type { Metadata } from "next";
import { TermsV2 } from "@/marketing-v2/MarketingPagesV2";
import { breadcrumb, ldJson } from "@/marketing-v2/_schema";

export const metadata: Metadata = {
  title: "Terms of Service | HireStepX",
  description: "HireStepX Terms of Service. Usage rules, payment terms, refund eligibility, account suspension, and your rights as a user in India.",
  alternates: { canonical: "/terms" },
};

export const revalidate = 86400;

export default async function Page() {
  const { headers } = await import("next/headers");
  const nonce = (await headers()).get("x-nonce") ?? "";
  return (
    <>
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={ldJson(breadcrumb([{ name: "Terms", path: "/terms" }]))} />
      <TermsV2 />
    </>
  );
}
