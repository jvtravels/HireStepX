import type { Metadata } from "next";
import { ContactV2 } from "@/marketing-v2/MarketingPagesV2";
import { breadcrumb, ldJson } from "@/marketing-v2/_schema";

export const metadata: Metadata = {
  title: "Contact | HireStepX",
  description:
    "Talk to HireStepX. Support, partnerships, press. We reply within one business day.",
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Contact HireStepX — Support, Partnerships & Press",
    description: "Reach HireStepX for support (support@hirestepx.com) or press (press@hirestepx.com). We reply within one business day.",
    url: "https://hirestepx.com/contact",
    type: "website",
    siteName: "HireStepX",
    locale: "en_IN",
  },
};

export const revalidate = 3600;

/* ContactPage schema — signals to Google what this page is and who to contact.
   Email addresses sourced from ContactV2 component (MarketingPagesV2.tsx line 1112-1119). */
const CONTACT_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "ContactPage",
  name: "Contact HireStepX",
  description: "Reach HireStepX for support, partnerships, or press enquiries.",
  url: "https://hirestepx.com/contact",
  publisher: {
    "@type": "Organization",
    name: "HireStepX",
    url: "https://hirestepx.com",
    email: "support@hirestepx.com",
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: "support@hirestepx.com",
        availableLanguage: ["English", "Hindi"],
        hoursAvailable: {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        },
      },
      {
        "@type": "ContactPoint",
        contactType: "press",
        email: "press@hirestepx.com",
      },
    ],
  },
};

export default async function Page() {
  const { headers } = await import("next/headers");
  const nonce = (await headers()).get("x-nonce") ?? "";
  return (
    <>
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={ldJson(breadcrumb([{ name: "Contact", path: "/contact" }]))} />
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(CONTACT_SCHEMA) }} />
      <ContactV2 />
    </>
  );
}
