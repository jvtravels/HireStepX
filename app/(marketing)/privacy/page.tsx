import type { Metadata } from "next";
import { PrivacyV2 } from "@/marketing-v2/MarketingPagesV2";

export const metadata: Metadata = {
  title: "Privacy Policy | HireStepX",
  description:
    "How HireStepX collects, uses, and protects your interview data. DPDP Act 2023 aligned. Delete everything anytime from Settings.",
  alternates: { canonical: "/privacy" },
};

export const dynamic = "force-static";
export const revalidate = 86400;

export default function Page() {
  return <PrivacyV2 />;
}
