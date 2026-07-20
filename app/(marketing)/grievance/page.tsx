import type { Metadata } from "next";
import { GrievanceOfficerV2 } from "@/marketing-v2/MarketingPagesV2";
import { breadcrumb, ldJson } from "@/marketing-v2/_schema";

export const metadata: Metadata = {
  title: "Grievance Officer | HireStepX",
  description:
    "HireStepX Grievance Officer contact details, complaint timelines, and your rights under the IT Rules 2021 and DPDP Act 2023.",
  alternates: { canonical: "/grievance" },
};

export const revalidate = 86400;

export default async function Page() {
  const { headers } = await import("next/headers");
  const nonce = (await headers()).get("x-nonce") ?? "";
  return (
    <>
      <script
        nonce={nonce || undefined}
        type="application/ld+json"
        dangerouslySetInnerHTML={ldJson(
          breadcrumb([{ name: "Grievance Officer", path: "/grievance" }])
        )}
      />
      <GrievanceOfficerV2 />
    </>
  );
}
