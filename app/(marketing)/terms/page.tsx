import type { Metadata } from "next";
import { TermsV2 } from "@/marketing-v2/MarketingPagesV2";
import { breadcrumb, ldJson } from "@/marketing-v2/_schema";

export const metadata: Metadata = {
  title: "Terms of Service | HireStepX",
  description: "The terms that govern your use of HireStepX.",
  alternates: { canonical: "/terms" },
};

export const dynamic = "force-static";
export const revalidate = 86400;

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={ldJson(breadcrumb([{ name: "Terms", path: "/terms" }]))} />
      <TermsV2 />
    </>
  );
}
