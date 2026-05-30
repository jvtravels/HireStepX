import type { Metadata } from "next";
import { ForStudentsV2 } from "@/marketing-v2/MarketingPagesV2";

export const metadata: Metadata = {
  title: "For students | HireStepX",
  description:
    "Campus placements, first-job interviews, internship rounds. AI mock interviews tuned for Indian students and freshers. 30% off with .ac.in / .edu.in email.",
  alternates: { canonical: "/for-students" },
};

export const dynamic = "force-static";
export const revalidate = 3600;

export default function Page() {
  return <ForStudentsV2 />;
}
