import type { Metadata } from "next";
import { AboutV2 } from "@/marketing-v2/MarketingPagesV2";
import { breadcrumb, ldJson } from "@/marketing-v2/_schema";

export const metadata: Metadata = {
  title: "About | HireStepX",
  description:
    "HireStepX is an India-first AI mock interview platform. Our mission, our values, and the team building career infrastructure for the next million job seekers.",
  alternates: { canonical: "/about" },
};

export const dynamic = "force-static";
export const revalidate = 3600;

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={ldJson(breadcrumb([{ name: "About", path: "/about" }]))} />
      <AboutV2 />
    </>
  );
}
