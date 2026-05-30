import type { Metadata } from "next";
import { HowItWorksV2 } from "@/marketing-v2/MarketingPagesV2";

export const metadata: Metadata = {
  title: "How it works | HireStepX",
  description:
    "Upload resume, pick a role and company, practice a voice interview, get a scored STAR report, and track skill decay. Five steps from cold start to interview-ready.",
  alternates: { canonical: "/how-it-works" },
};

export const dynamic = "force-static";
export const revalidate = 3600;

export default function Page() {
  return <HowItWorksV2 />;
}
