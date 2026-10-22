import { breadcrumb, ldJson } from "@/marketing-v2/_schema";

/* Shared source of truth for /telephonic-interview-questions's JSON-LD,
 * used by both the page (renders it, including looping over
 * faqSchema.mainEntity for the visible FAQ section) and
 * scripts/generate-jsonld-csp-hashes.mts (hashes the JSON-LD for the CSP
 * header). Keeping this in one place guarantees the hash always matches
 * what the page actually renders. */

export const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What questions are asked in a telephonic interview?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Telephonic rounds are usually a quick screen: tell me about yourself, why you're looking to change roles, your current notice period, salary expectations, and a walkthrough of your resume. The goal is confirming basic fit fast, not evaluating depth, so short, clear answers matter more than they would in a later round.",
      },
    },
    {
      "@type": "Question",
      name: "How long does a telephonic interview usually last?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Most telephonic screening rounds run 10 to 20 minutes. Recruiters are moving through a shortlist and are listening for basic communication clarity and fit, not a full evaluation: that comes in the video or in-person round that follows.",
      },
    },
    {
      "@type": "Question",
      name: "How is a telephonic interview different from a video interview?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "There's no body language, no face, no visual reassurance: your tone, pace, and clarity carry the entire impression. Pauses that would read as thoughtful on video can read as hesitation on a call. Practicing answers out loud, without relying on a screen or notes in front of the interviewer, closes that gap.",
      },
    },
    {
      "@type": "Question",
      name: "Can I practice for a telephonic interview with AI?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes, voice-only AI mock interviews are a close match for the telephonic format specifically, since there's no camera in either case. Practicing your notice-period, salary, and 'tell me about yourself' answers out loud, at the pace and length a screening call actually rewards, is more useful preparation than reading through a question list silently.",
      },
    },
  ],
};

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Telephonic Interview Questions & Prep Tips",
  description:
    "Common telephonic round questions, what recruiters actually screen for, and how to practice the voice-only format before the real call.",
  image: "https://hirestepx.com/opengraph-image",
  url: "https://hirestepx.com/telephonic-interview-questions",
  publisher: { "@type": "Organization", name: "HireStepX", url: "https://hirestepx.com" },
  author: { "@type": "Organization", name: "HireStepX" },
  datePublished: "2026-07-31",
  dateModified: "2026-08-05",
};

export function buildTelephonicInterviewJsonLd(): { __html: string }[] {
  return [
    ldJson(faqSchema),
    ldJson(articleSchema),
    ldJson(breadcrumb([{ name: "Telephonic Interview Questions", path: "/telephonic-interview-questions" }])),
  ];
}
