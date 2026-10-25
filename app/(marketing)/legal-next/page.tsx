import type { Metadata } from "next";
import { pageMeta } from "@/home2/pageMeta";
import { LegalHubPage } from "@/home2/LegalCanvas";

export const metadata: Metadata = pageMeta({
  title: "Legal: Privacy, Terms and Refund Policies | HireStepX",
  description: "Read how HireStepX handles your data, the rules for using the service and when credits are refunded. Includes your DPDP rights and how to reach us.",
  path: "/legal",
});

export default function Page() {
  return <LegalHubPage />;
}
