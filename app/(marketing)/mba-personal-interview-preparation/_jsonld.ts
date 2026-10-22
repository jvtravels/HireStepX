import { breadcrumb, ldJson } from "@/marketing-v2/_schema";

/* Shared source of truth for /mba-personal-interview-preparation's JSON-LD,
 * used by both the page (renders it) and
 * scripts/generate-jsonld-csp-hashes.mts (hashes the JSON-LD for the CSP
 * header). Keeping this in one place guarantees the hash always matches
 * what the page actually renders.
 *
 * FAQ_ENTRIES lives here and is re-exported for page.tsx's visible FAQ
 * section, so the two never drift apart. */

type FaqEntry = { q: string; a: string };

export const FAQ_ENTRIES: FaqEntry[] = [
  {
    q: "What questions are asked in an MBA personal interview?",
    a: "MBA PI questions fall into three buckets: HR/motivational (tell me about yourself, why MBA, why this institute), academic and work-experience questions (your graduation subjects, projects, current job responsibilities), and general awareness. Panels commonly follow up two or three times on the same question to test whether an answer is genuine or rehearsed-and-shallow.",
  },
  {
    q: "How much weightage does the PI round carry in MBA admissions?",
    a: "It varies by institute, but the Personal Interview carries roughly 30-50% weightage of the final admission score at many IIMs, alongside CAT score, academic profile, and Written Ability Test (WAT). Since the exam already screens aptitude, the PI specifically evaluates communication, clarity of thought, and personality.",
  },
  {
    q: "How do I answer \"Why MBA\" convincingly in a PI?",
    a: "Give a specific, personal reason tied to your actual background rather than a generic 'career growth' or 'better opportunities' answer: panels hear the generic version constantly and probe it hardest. Be ready for two or three follow-up questions on the same point, since panels are testing whether the reasoning holds up, not just whether you have an answer prepared.",
  },
  {
    q: "Can I practice for an MBA PI with AI mock interviews?",
    a: "Yes, rehearsing your 'why MBA', 'why this institute', and academic/work-experience answers out loud, including handling follow-up questions, builds the real-time clarity a PI panel is evaluating. Most candidates prepare these answers only in writing or silently, so the first time they say them out loud under any pressure is in the actual interview. AI mock interview practice closes that gap with unlimited repetition and follow-up questions.",
  },
];

export function buildMbaPersonalInterviewJsonLd(faqEntries: FaqEntry[]): { __html: string }[] {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqEntries.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "MBA Personal Interview (PI) Preparation",
    description:
      "Common MBA PI questions, what the panel is actually evaluating, and how to practice answering out loud before the round that decides your admit.",
    image: "https://hirestepx.com/opengraph-image",
    url: "https://hirestepx.com/mba-personal-interview-preparation",
    publisher: { "@type": "Organization", name: "HireStepX", url: "https://hirestepx.com" },
    author: { "@type": "Organization", name: "HireStepX" },
    datePublished: "2026-07-31",
    dateModified: "2026-08-05",
  };

  return [
    ldJson(faqSchema),
    ldJson(articleSchema),
    ldJson(breadcrumb([{ name: "MBA Personal Interview Preparation", path: "/mba-personal-interview-preparation" }])),
  ];
}
