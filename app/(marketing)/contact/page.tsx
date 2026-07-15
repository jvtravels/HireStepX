import type { Metadata } from "next";
import { ContactV2 } from "@/marketing-v2/MarketingPagesV2";
import { breadcrumb, ldJson } from "@/marketing-v2/_schema";

export const metadata: Metadata = {
  title: "Contact HireStepX — Support, Partnerships & Press",
  description:
    "Talk to HireStepX. Support, partnerships, press. We reply within one business day.",
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Contact HireStepX — Support, Partnerships & Press",
    description: "Reach HireStepX for support (hello@hirestepx.com) or press (hello@hirestepx.com). We reply within one business day.",
    url: "https://hirestepx.com/contact",
    type: "website",
    siteName: "HireStepX",
    locale: "en_IN",
    images: [{ url: "https://hirestepx.com/opengraph-image", width: 1200, height: 630, alt: "Contact HireStepX" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact HireStepX — Support, Partnerships & Press",
    description: "Reach HireStepX for support or press enquiries. We reply within one business day.",
    images: ["https://hirestepx.com/opengraph-image"],
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
    email: "hello@hirestepx.com",
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: "hello@hirestepx.com",
        availableLanguage: ["English"],
        hoursAvailable: {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        },
      },
      {
        "@type": "ContactPoint",
        contactType: "press",
        email: "hello@hirestepx.com",
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
