import { breadcrumb, ldJson } from "@/marketing-v2/_schema";

/* Shared source of truth for /bpo-interview-questions's JSON-LD, used by
 * both the page (renders it) and scripts/generate-jsonld-csp-hashes.mts
 * (hashes the JSON-LD for the CSP header). Keeping this in one place
 * guarantees the hash always matches what the page actually renders.
 *
 * FAQ_ENTRIES lives here and is re-exported for page.tsx's visible FAQ
 * section, so the two never drift apart. */

type FaqEntry = { q: string; a: string };

export const FAQ_ENTRIES: FaqEntry[] = [
  {
    q: "What questions are asked in a BPO interview?",
    a: "BPO interviews typically include a voice & accent check, general HR questions (why BPO, shift availability, salary expectations), and a situational round testing how you'd handle a difficult customer. The voice & accent portion evaluates clarity and pace, not a specific accent: being consistently understood matters more than sounding a particular way.",
  },
  {
    q: "What is a voice and accent round in a BPO interview?",
    a: "It's a short spoken-English assessment where you read a passage or answer questions out loud, and the recruiter evaluates clarity, pace, and neutral pronunciation. It exists because call center work depends entirely on being understood over the phone, often with background noise and no visual cues to compensate for unclear speech.",
  },
  {
    q: "How can I prepare my English for a BPO interview?",
    a: "Practice speaking out loud, not reading silently: the skill being tested is spontaneous spoken clarity, not vocabulary. Record yourself answering common questions and listen for pace and filler words, or practice with an AI voice interviewer that gives you unlimited repetition without judgment, since most candidates don't have a patient listener available on demand.",
  },
  {
    q: "Is a BPO interview different from a corporate interview?",
    a: "Yes, delivery is weighted more heavily than in most corporate interviews, since the job itself is entirely voice-based. Content still matters in the situational round, but clarity, tone, and calm pacing under a customer-handling scenario are evaluated as directly as the answer itself.",
  },
];

export function buildBpoInterviewJsonLd(faqEntries: FaqEntry[]): { __html: string }[] {
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
    headline: "BPO Interview Questions & Answers",
    description:
      "Common BPO and call center interview questions, what the voice & accent round checks for, and how to practice spoken English answers before the interview.",
    image: "https://hirestepx.com/opengraph-image",
    url: "https://hirestepx.com/bpo-interview-questions",
    publisher: { "@type": "Organization", name: "HireStepX", url: "https://hirestepx.com" },
    author: { "@type": "Organization", name: "HireStepX" },
    datePublished: "2026-07-31",
    dateModified: "2026-08-05",
  };

  return [
    ldJson(faqSchema),
    ldJson(articleSchema),
    ldJson(breadcrumb([{ name: "BPO Interview Questions", path: "/bpo-interview-questions" }])),
  ];
}
