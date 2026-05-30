import type { Metadata } from "next";
import { ContactV2 } from "@/marketing-v2/MarketingPagesV2";

export const metadata: Metadata = {
  title: "Contact | HireStepX",
  description:
    "Talk to HireStepX. Support, sales for colleges, partnerships, press. We reply within one business day.",
  alternates: { canonical: "/contact" },
};

export const dynamic = "force-static";
export const revalidate = 3600;

export default function Page() {
  return <ContactV2 />;
}
