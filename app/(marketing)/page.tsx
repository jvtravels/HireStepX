import type { Metadata } from "next";
import { headers } from "next/headers";
import HomepageV2 from "@/marketing-v2/HomepageV2";
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
  logo: "https://hirestepx.com/wordmark.png",
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
  applicationCategory: "EducationalApplication",
  operatingSystem: "Any (web)",
  offers: [
    { "@type": "Offer", price: "0", priceCurrency: "INR", name: "Free", description: "2 practice sessions" },
    { "@type": "Offer", price: "9", priceCurrency: "INR", name: "Per session", description: "Single mock interview session" },
    { "@type": "Offer", price: "39", priceCurrency: "INR", name: "Sprint Pack", description: "5 sessions per month, renews monthly, cancel any time" },
  ],
};

/* Pre-launch "Coming Soon" gate (restored 2026-06-16).
 *
 * Coming Soon renders ONLY on the public production apex hosts. Everywhere
 * else (staging, app.*, vercel previews, localhost) shows the real
 * marketing site so the team can keep shipping while the public site is
 * gated. Rendered dynamically (read host header) so a single deploy serves
 * both staging (full site) and www (Coming Soon) without per-env juggling.
 *
 * NEXT_PUBLIC_COMING_SOON manual override (kept in sync with middleware.ts):
 *   - "0" → never gate (force the real site everywhere → public launch)
 *   - "1" → always gate (lock everything down)
 *   - unset → host-based default below
 *
 * The brand JSON-LD is injected on EVERY path so crawlers get the
 * structured data whether they hit Coming Soon or the full homepage. */
export const dynamic = "force-dynamic";

const PRODUCTION_HOSTS = new Set(["hirestepx.com", "www.hirestepx.com"]);

export default async function Page() {
  const override = process.env.NEXT_PUBLIC_COMING_SOON;

  let gated: boolean;
  if (override === "0") {
    gated = false;
  } else if (override === "1") {
    gated = true;
  } else {
    // Host-based default. headers() needs await in the Next 15 app router.
    let host = "";
    try {
      const h = await headers();
      host = (h.get("host") || "").toLowerCase().split(":")[0]; // strip port
    } catch { /* SSR-only API; on edge cases default to the full site */ }
    gated = PRODUCTION_HOSTS.has(host);
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_SCHEMA) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(APPLICATION_SCHEMA) }} />
      {gated ? <ComingSoon /> : <HomepageV2 />}
    </>
  );
}
