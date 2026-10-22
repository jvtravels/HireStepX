import type { Metadata } from "next";
import { ContactV2 } from "@/marketing-v2/MarketingPagesV2";
import { buildContactJsonLd } from "./_jsonld";

export const metadata: Metadata = {
  title: "Contact HireStepX: Support, Partnerships & Press",
  description:
    "Talk to HireStepX. Support, partnerships, press. We reply within one business day.",
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Contact HireStepX: Support, Partnerships & Press",
    description: "Reach HireStepX for support (hello@hirestepx.com) or press (hello@hirestepx.com). We reply within one business day.",
    url: "https://hirestepx.com/contact",
    type: "website",
    siteName: "HireStepX",
    locale: "en_IN",
    images: [{ url: "https://hirestepx.com/opengraph-image", width: 1200, height: 630, alt: "Contact HireStepX" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact HireStepX: Support, Partnerships & Press",
    description: "Reach HireStepX for support or press enquiries. We reply within one business day.",
    images: ["https://hirestepx.com/opengraph-image"],
  },
};

export const revalidate = 3600;

export default async function Page() {
  return (
    <>
      {buildContactJsonLd().map((html, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={html} />
      ))}
      <ContactV2 />
    </>
  );
}
