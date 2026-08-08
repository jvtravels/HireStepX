import type { Metadata } from "next";
import Script from "next/script";
import { AboutV2 } from "@/marketing-v2/MarketingPagesV2";
import { buildAboutJsonLd } from "./_jsonld";

export const metadata: Metadata = {
  title: "About HireStepX | AI Mock Interview Platform",
  description:
    "India's AI mock interview platform. Voice interviews for TCS, Google, Flipkart, and 200+ companies. STAR scoring and skill-decay tracking. 2 sessions free.",
  keywords: [
    "about HireStepX",
    "AI mock interview platform India",
    "interview preparation company India",
    "HireStepX mission",
  ].join(", "),
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About HireStepX: India's AI Mock Interview Platform",
    description: "HireStepX helps Indian job seekers practice for TCS, Google, Flipkart, Amazon, and 200+ companies with AI voice interviews and scored feedback.",
    url: "https://hirestepx.com/about",
    type: "website",
    siteName: "HireStepX",
    locale: "en_IN",
    images: [{ url: "https://hirestepx.com/opengraph-image", width: 1200, height: 630, alt: "About HireStepX: India's AI Mock Interview Platform" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "About HireStepX: India's AI Mock Interview Platform 2026",
    description: "AI mock interviews for 200+ Indian companies. Voice interviews, STAR scoring, skill-decay tracking. Built for India.",
    images: ["https://hirestepx.com/opengraph-image"],
  },
};

export const revalidate = 3600;

export default async function Page() {
  return (
    <>
      {buildAboutJsonLd().map((html, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={html} />
      ))}
      <Script
        async
        src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7810403590527236"
        crossOrigin="anonymous"
        strategy="lazyOnload"
      />
      <AboutV2 />
    </>
  );
}
