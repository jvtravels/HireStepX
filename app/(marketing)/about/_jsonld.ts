import { breadcrumb, ldJson } from "@/marketing-v2/_schema";

/* Shared source of truth for /about's JSON-LD, used by both the page
 * (renders it) and scripts/generate-jsonld-csp-hashes.mts (hashes the
 * JSON-LD for the CSP header). Keeping this in one place guarantees the
 * hash always matches what the page actually renders. */

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
  description: "India's AI-powered mock interview platform. Practice for TCS, Google, Flipkart, Amazon, and 200+ companies with voice AI interviews and scored feedback.",
  foundingDate: "2024",
  foundingLocation: {
    "@type": "Place",
    name: "Bengaluru, India",
    addressCountry: "IN",
  },
  address: {
    "@type": "PostalAddress",
    addressLocality: "Bengaluru",
    addressRegion: "Karnataka",
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
  description: "AI-powered mock interview platform for Indian job seekers. Practice for TCS, Google, Flipkart, Amazon, and 200+ companies with voice interviews and scored reports.",
  inLanguage: "en-IN",
  datePublished: "2024-01-01",
  dateModified: "2026-07-15",
  creator: { "@type": "Organization", name: "HireStepX", url: "https://hirestepx.com" },
};

export function buildAboutJsonLd(): { __html: string }[] {
  return [
    ldJson(breadcrumb([{ name: "About", path: "/about" }])),
    ldJson(ORG_SCHEMA),
    ldJson(APP_SCHEMA),
  ];
}
