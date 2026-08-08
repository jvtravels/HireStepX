import type { Metadata } from "next";
import Script from "next/script";
import { HowItWorksV2 } from "@/marketing-v2/MarketingPagesV2";
import { buildHowItWorksJsonLd } from "./_jsonld";

export const metadata: Metadata = {
  title: "How AI Mock Interviews Work | HireStepX",
  description:
    "How HireStepX works: upload resume, pick a company, practice a voice interview with AI, get a scored STAR report. Start free, no card needed.",
  keywords: [
    "how AI mock interview works",
    "AI interview practice India",
    "mock interview practice guide",
    "interview preparation steps India",
    "AI interview feedback India 2026",
  ].join(", "),
  alternates: { canonical: "/how-it-works" },
  openGraph: {
    title: "How HireStepX AI Mock Interviews Work: 5 Steps to Interview-Ready",
    description: "Upload resume → pick target company → practice voice interview with AI → get scored STAR report → repeat. Start free, no card.",
    url: "https://hirestepx.com/how-it-works",
    type: "website",
    siteName: "HireStepX",
    locale: "en_IN",
    images: [{ url: "https://hirestepx.com/opengraph-image", width: 1200, height: 630, alt: "How HireStepX AI Mock Interviews Work" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "How AI Mock Interviews Work: HireStepX 5-Step Guide India 2026",
    description: "Upload resume, pick role + company, practice voice interview with AI, get scored report. 2 sessions free.",
    images: ["https://hirestepx.com/opengraph-image"],
  },
};

export const revalidate = 86400;

export default async function Page() {
  return (
    <>
      {buildHowItWorksJsonLd().map((html, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={html} />
      ))}
      <Script
        async
        src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7810403590527236"
        crossOrigin="anonymous"
        strategy="lazyOnload"
      />
      <HowItWorksV2 />
    </>
  );
}
