import { breadcrumb, ldJson } from "@/marketing-v2/_schema";

/* Shared source of truth for /one-way-video-interview-practice's JSON-LD,
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
    q: "What is a one-way video interview?",
    a: "A one-way (asynchronous) video interview is a recorded round where you answer preset questions to a camera on a timer, with no live interviewer present. A recruiter reviews the recording afterward. It's increasingly common as a first round at Indian IT and GCC companies to screen high volumes of applicants efficiently.",
  },
  {
    q: "How is a one-way video interview different from a live video interview?",
    a: "There's no interviewer reacting in real time, no follow-up questions, and usually a hard time limit with limited retakes per question. You're being evaluated on delivery and structure alone, with none of the rapport or reassurance cues a live conversation provides.",
  },
  {
    q: "How many times can I redo my answer in a one-way interview?",
    a: "It depends on the platform the company uses, but most allow only one or two attempts per question, and some give none at all. That makes rehearsing the answer's structure in advance more important than in a live interview, where a stumble can be recovered from mid-conversation.",
  },
  {
    q: "How can I practice for a one-way video interview?",
    a: "Practice answering out loud on a timer, addressing a camera lens directly instead of a person, since both are unfamiliar skills most candidates have never rehearsed. AI mock interview practice simulates this well: no live interviewer, a real question, and a scored review of your delivery afterward, the same shape as the actual format.",
  },
];

export function buildOneWayVideoInterviewJsonLd(faqEntries: FaqEntry[]): { __html: string }[] {
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
    headline: "One-Way Video Interview Practice & Tips",
    description:
      "How to prepare for a one-way, asynchronous video interview with no live interviewer, and how to practice talking to a camera before the real one.",
    image: "https://hirestepx.com/opengraph-image",
    url: "https://hirestepx.com/one-way-video-interview-practice",
    publisher: { "@type": "Organization", name: "HireStepX", url: "https://hirestepx.com" },
    author: { "@type": "Organization", name: "HireStepX" },
    datePublished: "2026-07-31",
    dateModified: "2026-08-05",
  };

  return [
    ldJson(faqSchema),
    ldJson(articleSchema),
    ldJson(breadcrumb([{ name: "One-Way Video Interview Practice", path: "/one-way-video-interview-practice" }])),
  ];
}
