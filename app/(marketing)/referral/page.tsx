import type { Metadata } from "next";
import { ReferralPageV2 } from "@/marketing-v2/MarketingPagesV2";
import { buildReferralJsonLd } from "./_jsonld";

export const metadata: Metadata = {
  title: "Refer a Friend: Give a Session, Get a Session | HireStepX",
  description:
    "Refer a friend to HireStepX, and both of you get a free session credit. Share your link, they practise, you earn a free session. No codes, no hassle.",
  keywords: [
    "HireStepX referral program",
    "refer a friend interview prep India",
    "earn free mock interview session",
    "HireStepX discount",
  ].join(", "),
  alternates: { canonical: "/referral" },
  openGraph: {
    title: "Refer a Friend to HireStepX: Both of You Get a Session",
    description:
      "Share your referral link. Both of you get a free session credit. No limit on referrals.",
    url: "https://hirestepx.com/referral",
    type: "website",
    siteName: "HireStepX",
    locale: "en_IN",
    images: [{ url: "https://hirestepx.com/opengraph-image", width: 1200, height: 630, alt: "Refer a Friend to HireStepX" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Refer a Friend to HireStepX: Give a Session, Get a Session",
    description:
      "Share your referral link. Both you and your friend earn a free AI mock interview session. No codes, no hassle.",
    images: ["https://hirestepx.com/opengraph-image"],
  },
};

export const revalidate = 86400;

export default async function Page() {
  return (
    <>
      {buildReferralJsonLd().map((html, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={html} />
      ))}
      <ReferralPageV2 />
    </>
  );
}
