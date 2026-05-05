import type { Metadata } from "next";
import { headers } from "next/headers";
import App from "@/App";
import ComingSoon from "@/ComingSoon";

export const metadata: Metadata = {
  title: "HireStepX — AI Mock Interview Practice for Job Seekers",
  description:
    "Practice interviews with AI. Get real-time feedback on communication, structure, and strategy. Land your dream job with HireStepX.",
  alternates: { canonical: "/" },
};

/* Organization + SoftwareApplication schema — gives Google the
   structured data it needs to build a knowledge panel + sitelinks
   for the brand. Renders inline as JSON-LD; crawlers parse it from
   the HTML without needing JS execution. */
const ORGANIZATION_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "HireStepX",
  url: "https://hirestepx.com",
  logo: "https://hirestepx.com/icon-512.svg",
  description: "AI-powered mock interview platform for Indian job seekers. Practice with conversational AI interviewers, get scored feedback, and land your next role.",
  foundingDate: "2026",
  sameAs: [
    "https://www.linkedin.com/company/hirestepx",
    "https://twitter.com/hirestepx",
  ],
  contactPoint: {
    "@type": "ContactPoint",
    email: "hello@hirestepx.com",
    contactType: "Customer Support",
    availableLanguage: ["English", "Hindi"],
  },
};

const APPLICATION_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "HireStepX",
  applicationCategory: "EducationApplication",
  operatingSystem: "Any (web)",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "INR",
    availability: "https://schema.org/InStock",
    description: "3 free mock interview sessions, no credit card required.",
  },
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.7",
    ratingCount: "8",
    bestRating: "5",
    worstRating: "1",
  },
};

/**
 * Landing page gating — Coming Soon only renders on the public production
 * apex hosts. Everywhere else (staging, app.*, vercel previews, localhost)
 * shows the real app so the team can keep shipping while the public
 * site is still gated.
 *
 * We render dynamically here (read host header) instead of at build time
 * so a single deploy can serve both staging.hirestepx.com (full app) AND
 * www.hirestepx.com (Coming Soon) without env-var juggling per env.
 *
 * NEXT_PUBLIC_COMING_SOON kept as a manual override:
 *   - Set to "0" → never show Coming Soon (force open everywhere).
 *   - Set to "1" → always show Coming Soon (lock everything down).
 *   - Unset → host-based default below.
 */
export const dynamic = "force-dynamic";

const PRODUCTION_HOSTS = new Set([
  "www.hirestepx.com",
  "hirestepx.com",
]);

export default async function Page() {
  const override = process.env.NEXT_PUBLIC_COMING_SOON;
  if (override === "0") return <App />;
  if (override === "1") return <ComingSoon />;

  // Host-based default. headers() needs await in the Next 15 app router.
  let host = "";
  try {
    const h = await headers();
    host = (h.get("host") || "").toLowerCase().split(":")[0]; // strip port
  } catch { /* SSR-only API; on edge cases default to full app */ }

  /* Inject brand schema on EVERY render path (App or ComingSoon).
     Crawlers see the structured data either way — important because
     pre-launch most crawls hit the ComingSoon variant. */
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_SCHEMA) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(APPLICATION_SCHEMA) }} />
      {PRODUCTION_HOSTS.has(host) ? <ComingSoon /> : <App />}
    </>
  );
}
