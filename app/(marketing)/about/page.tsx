import type { Metadata } from "next";
import { AboutV2 } from "@/marketing-v2/MarketingPagesV2";
import { breadcrumb, ldJson } from "@/marketing-v2/_schema";

export const metadata: Metadata = {
  title: "About HireStepX — India's AI Mock Interview Platform 2026 | HireStepX",
  description:
    "India's AI mock interview platform. Voice interviews for TCS, Google, Flipkart, and 50+ companies. STAR scoring and skill-decay tracking. 2 sessions free.",
  keywords: [
    "about HireStepX",
    "AI mock interview platform India",
    "interview preparation company India",
    "HireStepX mission",
  ].join(", "),
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About HireStepX — India's AI Mock Interview Platform",
    description: "HireStepX helps Indian job seekers practice for TCS, Google, Flipkart, Amazon, and 50+ companies with AI voice interviews and scored feedback.",
    url: "https://hirestepx.com/about",
    type: "website",
    siteName: "HireStepX",
    locale: "en_IN",
    images: [{ url: "https://hirestepx.com/opengraph-image", width: 1200, height: 630, alt: "About HireStepX — India's AI Mock Interview Platform" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "About HireStepX — India's AI Mock Interview Platform 2026",
    description: "AI mock interviews for 60+ Indian companies. Voice interviews, STAR scoring, skill-decay tracking. Built for India.",
    images: ["https://hirestepx.com/opengraph-image"],
  },
};

export const revalidate = 3600;

/* Organization schema — used by Google to build the Knowledge Panel
   for the HireStepX brand query. Without this, Google guesses the
   organization data from the homepage; with it, we control what it shows. */
const ORG_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "HireStepX",
  url: "https://hirestepx.com",
  logo: {
    "@type": "ImageObject",
    url: "https://hirestepx.com/wordmark.png",
    width: 200,
    height: 48,
  },
  description: "India's AI-powered mock interview platform. Practice for TCS, Google, Flipkart, Amazon, and 50+ companies with voice AI interviews and scored feedback.",
  foundingDate: "2024",
  foundingLocation: {
    "@type": "Place",
    name: "India",
    addressCountry: "IN",
  },
  areaServed: {
    "@type": "Country",
    name: "India",
  },
  knowsAbout: [
    "Interview Preparation",
    "Artificial Intelligence",
    "Career Coaching",
    "Campus Placement",
    "Mock Interviews",
  ],
  sameAs: [
    "https://www.linkedin.com/company/hirestepx",
    "https://twitter.com/hirestepx",
  ],
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    url: "https://hirestepx.com/contact",
    availableLanguage: ["English"],
  },
};

/* SoftwareApplication schema — makes HireStepX eligible for app-rich
   results in Google (star ratings, review count, price). */
const APP_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "HireStepX",
  applicationCategory: "EducationalApplication",
  operatingSystem: "Web",
  url: "https://hirestepx.com",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "INR",
    description: "2 free AI mock interview sessions, no credit card required",
  },
  description: "AI-powered mock interview platform for Indian job seekers. Practice for TCS, Google, Flipkart, Amazon, and 50+ companies with voice interviews and scored reports.",
  inLanguage: "en-IN",
  datePublished: "2024-01-01",
  dateModified: "2026-07-15",
  creator: { "@type": "Organization", name: "HireStepX", url: "https://hirestepx.com" },
};

export default async function Page() {
  const { headers } = await import("next/headers");
  const nonce = (await headers()).get("x-nonce") ?? "";

  return (
    <>
      <script type="application/ld+json" nonce={nonce || undefined} dangerouslySetInnerHTML={ldJson(breadcrumb([{ name: "About", path: "/about" }]))} />
      <script type="application/ld+json" nonce={nonce || undefined} dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_SCHEMA) }} />
      <script type="application/ld+json" nonce={nonce || undefined} dangerouslySetInnerHTML={{ __html: JSON.stringify(APP_SCHEMA) }} />
      <AboutV2 />
    </>
  );
}
