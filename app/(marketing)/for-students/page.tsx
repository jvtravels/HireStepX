import type { Metadata } from "next";
import { ForStudentsV2 } from "@/marketing-v2/MarketingPagesV2";
import { breadcrumb, ldJson } from "@/marketing-v2/_schema";

export const metadata: Metadata = {
  title: "For students | HireStepX",
  description:
    "Campus placements, first-job interviews, internship rounds. AI mock interviews tuned for Indian students and freshers. 30% off with .ac.in / .edu.in email.",
  alternates: { canonical: "/for-students" },
};

export const dynamic = "force-static";
export const revalidate = 3600;

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={ldJson(breadcrumb([{ name: "For students", path: "/for-students" }]))} />
      <ForStudentsV2 />
    </>
  );
}
