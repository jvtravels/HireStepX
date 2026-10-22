import type { Metadata } from "next";
import { GrievanceOfficerV2 } from "@/marketing-v2/MarketingPagesV2";
import { buildGrievanceJsonLd } from "./_jsonld";

export const metadata: Metadata = {
  title: "Grievance Officer | HireStepX",
  description:
    "HireStepX Grievance Officer contact details, complaint timelines, and your rights under the IT Rules 2021 and DPDP Act 2023.",
  alternates: { canonical: "/grievance" },
};

export const revalidate = 86400;

export default async function Page() {
  return (
    <>
      {buildGrievanceJsonLd().map((html, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={html} />
      ))}
      <GrievanceOfficerV2 />
    </>
  );
}
