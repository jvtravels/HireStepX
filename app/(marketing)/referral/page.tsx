import type { Metadata } from "next";
import { ReferralPageV2 } from "@/marketing-v2/MarketingPagesV2";
import { breadcrumb, ldJson } from "@/marketing-v2/_schema";

export const metadata: Metadata = {
  title: "Refer a Friend — Give a Session, Get a Session | HireStepX",
  description:
    "Refer a friend to HireStepX and both of you earn a free session. Your friend gets ₹9 off their first mock interview — you get ₹9 credit once they practise. No codes, no hassle.",
  keywords: [
    "HireStepX referral program",
    "refer a friend interview prep India",
    "earn free mock interview session",
    "HireStepX discount",
  ].join(", "),
  alternates: { canonical: "/referral" },
  openGraph: {
    title: "Refer a Friend to HireStepX — Both of You Get a Session",
    description:
      "Share your referral link. Your friend gets ₹9 off their first session. You earn ₹9 credit. No limit on referrals.",
    url: "https://hirestepx.com/referral",
    type: "website",
    siteName: "HireStepX",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "Refer a Friend to HireStepX — Give a Session, Get a Session",
    description:
      "Share your referral link. Both you and your friend earn ₹9 credit toward AI mock interview sessions.",
  },
};

export const revalidate = 86400;

export default async function Page() {
  const { headers } = await import("next/headers");
  const nonce = (await headers()).get("x-nonce") ?? "";
  return (
    <>
      <script
        nonce={nonce || undefined}
        type="application/ld+json"
        dangerouslySetInnerHTML={ldJson(breadcrumb([{ name: "Refer a friend", path: "/referral" }]))}
      />
      <ReferralPageV2 />
    </>
  );
}
