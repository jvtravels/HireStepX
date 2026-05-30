import type { Metadata } from "next";
import HomepageV2 from "@/marketing-v2/HomepageV2";

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
  offers: [
    { "@type": "Offer", price: "0", priceCurrency: "INR", name: "Free", description: "3 practice sessions" },
    { "@type": "Offer", price: "9", priceCurrency: "INR", name: "Per session", description: "Single mock interview session" },
    { "@type": "Offer", price: "49", priceCurrency: "INR", name: "Weekly", description: "10 sessions over 7 days" },
    { "@type": "Offer", price: "149", priceCurrency: "INR", name: "Monthly", description: "40 sessions over 30 days" },
  ],
};

/* Marketing homepage v2 is now live at apex. Static + revalidate so the
   page ships from the edge cache and the JSON-LD payload renders in the
   first byte for crawlers. The ComingSoon gate has been retired. */
export const dynamic = "force-static";
export const revalidate = 3600;

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_SCHEMA) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(APPLICATION_SCHEMA) }} />
      <HomepageV2 />
    </>
  );
}
