import { breadcrumb, ldJson } from "@/marketing-v2/_schema";

/* Shared source of truth for /how-it-works's JSON-LD, used by both the
 * page (renders it) and scripts/generate-jsonld-csp-hashes.mts (hashes
 * the JSON-LD for the CSP header). Keeping this in one place guarantees
 * the hash always matches what the page actually renders. */

/* HowTo schema: Google may render this as a stepped rich result for the
 * query "how to practice interview with AI". Steps mirror the on-page flow
 * — keep them in sync if the section is edited. */
const HOWTO_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to practice an AI mock interview with HireStepX",
  description:
    "Five steps to go from no preparation to interview-ready with HireStepX's AI mock interviewer.",
  totalTime: "PT30M",
  estimatedCost: { "@type": "MonetaryAmount", currency: "INR", value: "0" },
  step: [
    { "@type": "HowToStep", position: 1, name: "Upload your resume", text: "Drop a PDF or DOCX. We parse skills, projects, and experience so the AI's questions match your background." },
    { "@type": "HowToStep", position: 2, name: "Pick a role and company", text: "Choose from 200+ Indian roles and 10 interview types: behavioral, technical, system design, PM case, salary negotiation, and more." },
    { "@type": "HowToStep", position: 3, name: "Practice a voice interview", text: "The AI interviewer speaks the question, listens to your answer, asks follow-ups when you're shallow, and pushes back on weak structure." },
    { "@type": "HowToStep", position: 4, name: "Read your scored report", text: "STAR breakdown, communication score, technical depth score, and a coached model answer for every question." },
    { "@type": "HowToStep", position: 5, name: "Come back when skill decays", text: "We track which interview skills are slipping and queue spaced repetition. 30 minutes a week holds the gain." },
  ],
};

/* Article schema — editorial signal for Top Stories / news eligibility.
   Was missing from this page; every other pillar page has one. */
const ARTICLE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "How AI Mock Interviews Work: 5-Step Practice Guide",
  description: "How HireStepX works: upload resume, pick target company and interview type, practice a voice interview with AI, get a scored STAR report, and repeat with spaced repetition.",
  image: "https://hirestepx.com/opengraph-image",
  author: { "@type": "Organization", name: "HireStepX", url: "https://hirestepx.com" },
  publisher: {
    "@type": "Organization",
    name: "HireStepX",
    logo: { "@type": "ImageObject", url: "https://hirestepx.com/wordmark.png" },
  },
  datePublished: "2026-01-01",
  dateModified: "2026-07-26",
  inLanguage: "en-IN",
  url: "https://hirestepx.com/how-it-works",
  mainEntityOfPage: { "@type": "WebPage", "@id": "https://hirestepx.com/how-it-works" },
  keywords: "AI mock interview, how AI interview works, interview practice India, STAR method scoring",
};

export function buildHowItWorksJsonLd(): { __html: string }[] {
  return [
    ldJson(breadcrumb([{ name: "How it works", path: "/how-it-works" }])),
    ldJson(HOWTO_SCHEMA),
    ldJson(ARTICLE_SCHEMA),
  ];
}
