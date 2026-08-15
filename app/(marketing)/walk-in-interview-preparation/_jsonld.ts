import { breadcrumb, ldJson } from "@/marketing-v2/_schema";

/* Shared source of truth for /walk-in-interview-preparation's JSON-LD, used
 * by both the page (renders it) and scripts/generate-jsonld-csp-hashes.mts
 * (hashes the JSON-LD for the CSP header). Keeping this in one place
 * guarantees the hash always matches what the page actually renders.
 *
 * FAQ_ENTRIES lives here and is re-exported for page.tsx's visible FAQ
 * section, so the two never drift apart. */

type FaqEntry = { q: string; a: string };

export const FAQ_ENTRIES: FaqEntry[] = [
  {
    q: "How do I prepare for a walk-in interview with no notice?",
    a: "Focus on what you can control fast: carry printed resume copies and ID proof, rehearse your 'tell me about yourself' answer out loud so it's not being improvised for the first time in the queue, and research the company for the few minutes you'll likely spend waiting. Walk-in rounds reward candidates who show up prepared for a compressed interview, not a long exploratory one.",
  },
  {
    q: "What questions are usually asked in a walk-in interview?",
    a: "Walk-in interviews for freshers typically cover: tell me about yourself, why you're interested in the role or company, what you know about the company, expected salary, availability to join, and whether you have questions. The round is usually shorter than a scheduled interview, so concise answers matter more.",
  },
  {
    q: "What should I carry to a walk-in interview?",
    a: "Multiple printed copies of your resume, a government ID, and any certificates the job listing specifically mentions. Walk-in drives process candidates in the order they arrive, and missing documents can cost you your slot in the queue.",
  },
  {
    q: "Can I practice for a walk-in interview in advance if I don't know when it will happen?",
    a: "Yes, because walk-in interviews rely on the same core questions across most companies (tell me about yourself, why this role, expected salary, availability), practicing those answers out loud ahead of time pays off regardless of which specific drive you attend. AI mock interview practice lets you rehearse the exact opening questions that decide the first minute of a walk-in round.",
  },
];

export function buildWalkInInterviewJsonLd(faqEntries: FaqEntry[]): { __html: string }[] {
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
    headline: "Walk-in Interview Preparation & Tips",
    description:
      "How to prepare for a walk-in interview drive with almost no advance notice, plus the questions that come up most.",
    image: "https://hirestepx.com/opengraph-image",
    url: "https://hirestepx.com/walk-in-interview-preparation",
    publisher: { "@type": "Organization", name: "HireStepX", url: "https://hirestepx.com" },
    author: { "@type": "Organization", name: "HireStepX" },
    datePublished: "2026-07-31",
    dateModified: "2026-08-05",
  };

  return [
    ldJson(faqSchema),
    ldJson(articleSchema),
    ldJson(breadcrumb([{ name: "Walk-in Interview Preparation", path: "/walk-in-interview-preparation" }])),
  ];
}
