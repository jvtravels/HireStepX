import { breadcrumb, ldJson } from "@/marketing-v2/_schema";

/* Pure JSON-LD builder shared by the page (renders it) and
 * scripts/generate-jsonld-csp-hashes.mts (hashes it for the CSP header).
 * Keeping this logic in one place guarantees the hash always matches what
 * the page actually renders — duplicating it in the generator would drift. */

export function buildEnglishInterviewPracticeJsonLd(): { __html: string }[] {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "How can I improve my spoken English for interviews?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "The fastest way is repeated speaking practice under interview-like conditions, out loud, not silent review. Reading and understanding English is a different skill from forming a structured spoken answer in real time. Practicing your key stories (background, strengths, past projects) out loud multiple times closes that gap faster than grammar study alone.",
        },
      },
      {
        "@type": "Question",
        name: "Is it okay to mix Hindi and English in an interview?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Most Indian interviewers are comfortable with natural code-switching, a stray Hindi word or filler doesn't hurt you. What matters more is structure and clarity: a well-organized answer with occasional code-switching reads better than a stiff, over-rehearsed all-English answer that sounds memorized.",
        },
      },
      {
        "@type": "Question",
        name: "Can I practice interview English without a fluent English-speaking friend?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes, a voice-based AI mock interview gives you a live listener that asks real interview questions, listens to your spoken answer, and responds with follow-ups, without needing to schedule a person. HireStepX's voice model is built for Indian English and regional accents specifically, so it recognizes speech patterns a generic accent model would misread.",
        },
      },
      {
        "@type": "Question",
        name: "Does an Indian accent hurt my chances in an interview?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No, Indian interviewers overwhelmingly conduct interviews in Indian English and expect an Indian accent. What actually affects outcomes is clarity, pacing, and structure of the answer, not accent itself. Practice aimed at those three things (not accent neutralization) is the higher-value use of prep time.",
        },
      },
    ],
  };

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "English Speaking Practice for Job Interviews",
    description:
      "Why spoken English is the real gap for interview prep, and how voice-based AI practice trained on Indian English closes it.",
    image: "https://hirestepx.com/opengraph-image",
    url: "https://hirestepx.com/english-interview-practice",
    publisher: { "@type": "Organization", name: "HireStepX", url: "https://hirestepx.com" },
    author: { "@type": "Organization", name: "HireStepX" },
    datePublished: "2026-07-31",
    dateModified: "2026-08-05",
  };

  return [
    ldJson(faqSchema),
    ldJson(articleSchema),
    ldJson(breadcrumb([{ name: "English Interview Practice", path: "/english-interview-practice" }])),
  ];
}
