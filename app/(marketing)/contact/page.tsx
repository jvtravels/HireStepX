import type { Metadata } from "next";
import { ContactV2 } from "@/marketing-v2/MarketingPagesV2";
import { breadcrumb, ldJson } from "@/marketing-v2/_schema";

export const metadata: Metadata = {
  title: "Contact | HireStepX",
  description:
    "Talk to HireStepX. Support, partnerships, press. We reply within one business day.",
  alternates: { canonical: "/contact" },
};

export const dynamic = "force-static";
export const revalidate = 3600;

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={ldJson(breadcrumb([{ name: "Contact", path: "/contact" }]))} />
      <ContactV2 />
    </>
  );
}
