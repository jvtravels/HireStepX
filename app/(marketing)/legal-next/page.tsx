import type { Metadata } from "next";
import { LegalHubPage } from "@/home2/LegalCanvas";

export const metadata: Metadata = { title: "Legal | HireStepX", robots: "noindex, nofollow", alternates: { canonical: "/legal" } };

export default function Page() {
  return <LegalHubPage />;
}
