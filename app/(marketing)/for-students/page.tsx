import type { Metadata } from "next";
import { ForStudentsV2 } from "@/marketing-v2/MarketingPagesV2";
import { breadcrumb, ldJson } from "@/marketing-v2/_schema";

export const metadata: Metadata = {
  title: "AI Mock Interviews for Campus Placements India 2026 — Free for Students | HireStepX",
  description:
    "Prepare for TCS NQT, Infosys InfyTQ, Wipro NLTH, and first-job interviews with AI mock interviews. Free 2 sessions + 30% student discount with .ac.in email. Practice behavioral, technical, and HR rounds with voice feedback.",
  keywords: [
    "campus placement interview preparation India 2026",
    "TCS NQT preparation",
    "Infosys campus placement",
    "AI mock interview for students India",
    "fresher interview practice",
    "college placement interview preparation",
    "first job interview India 2026",
  ].join(", "),
  alternates: { canonical: "/for-students" },
  openGraph: {
    title: "AI Mock Interviews for Campus Placements India 2026 | HireStepX for Students",
    description: "Practice TCS NQT, Infosys SP, Wipro NLTH, and first-job interviews with AI mock interviews. Free 2 sessions + 30% discount with college email.",
    url: "https://hirestepx.com/for-students",
    type: "website",
    siteName: "HireStepX",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Mock Interviews for Campus Placements India 2026 | HireStepX",
    description: "TCS NQT, Infosys SP, Wipro NLTH — AI mock interview practice for campus placements. Free 2 sessions + 30% student discount.",
  },
};

export const revalidate = 3600;

export default async function Page() {
  const { headers } = await import("next/headers");
  const nonce = (await headers()).get("x-nonce") ?? "";
  return (
    <>
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={ldJson(breadcrumb([{ name: "For students", path: "/for-students" }]))} />
      <ForStudentsV2 />
    </>
  );
}
