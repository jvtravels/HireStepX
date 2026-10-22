import { breadcrumb, ldJson } from "@/marketing-v2/_schema";

/* Shared source of truth for /contact's JSON-LD, used by both the page
 * (renders it) and scripts/generate-jsonld-csp-hashes.mts (hashes the
 * JSON-LD for the CSP header). Keeping this in one place guarantees the
 * hash always matches what the page actually renders. */

/* ContactPage schema — signals to Google what this page is and who to contact.
   Email addresses sourced from ContactV2 component (MarketingPagesV2.tsx line 1112-1119). */
const CONTACT_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "ContactPage",
  name: "Contact HireStepX",
  description: "Reach HireStepX for support, partnerships, or press enquiries.",
  url: "https://hirestepx.com/contact",
  publisher: {
    "@type": "Organization",
    name: "HireStepX",
    url: "https://hirestepx.com",
    email: "hello@hirestepx.com",
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: "hello@hirestepx.com",
        availableLanguage: ["English"],
        hoursAvailable: {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        },
      },
      {
        "@type": "ContactPoint",
        contactType: "press",
        email: "hello@hirestepx.com",
      },
    ],
  },
};

export function buildContactJsonLd(): { __html: string }[] {
  return [
    ldJson(breadcrumb([{ name: "Contact", path: "/contact" }])),
    { __html: JSON.stringify(CONTACT_SCHEMA) },
  ];
}
