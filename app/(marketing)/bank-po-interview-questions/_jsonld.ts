import { breadcrumb, ldJson } from "@/marketing-v2/_schema";

/* Shared source of truth for /bank-po-interview-questions's JSON-LD, used
 * by both the page (renders it) and scripts/generate-jsonld-csp-hashes.mts
 * (hashes the JSON-LD for the CSP header). Keeping this in one place
 * guarantees the hash always matches what the page actually renders.
 *
 * FAQ_ENTRIES lives here and is re-exported for page.tsx's visible FAQ
 * section, so the two never drift apart. */

type FaqEntry = { q: string; a: string };

export const FAQ_ENTRIES: FaqEntry[] = [
  {
    q: "What questions are asked in a bank PO interview?",
    a: "Bank PO interviews (SBI, IBPS) typically cover personal and motivational questions (tell us about yourself, why banking), banking and financial awareness (repo rate, monetary policy, types of accounts, recent banking news), and role-specific questions about a Probationary Officer's day-to-day responsibilities. It's a panel interview, usually the final stage after prelims and mains.",
  },
  {
    q: "How is a bank PO interview different from a corporate interview?",
    a: "It's conducted by a multi-member panel rather than one or two interviewers, and it combines personality assessment with domain knowledge (banking and financial awareness) rather than focusing on resume or work experience. Since the written exam already screened your aptitude, the interview weighs communication, composure, and current banking knowledge more heavily.",
  },
  {
    q: "How should I prepare banking awareness for the PO interview?",
    a: "Focus on current figures (repo rate, key policy rates), core concepts (types of accounts, NPA, monetary policy) explained simply, and recent banking-sector news from the weeks before your interview. Panels reward being current and able to explain a concept in plain language over memorized definitions.",
  },
  {
    q: "Can I practice for a bank PO panel interview with AI?",
    a: "Yes. Rehearsing your motivational and personality-round answers out loud (tell us about yourself, why banking, handling pressure) builds the composure a panel is directly evaluating, since most candidates have only reviewed these silently. AI mock interview practice lets you say your answers out loud and get a scored read on clarity and structure before facing a real multi-member panel.",
  },
];

export function buildBankPoInterviewJsonLd(faqEntries: FaqEntry[]): { __html: string }[] {
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
    headline: "Bank PO Interview Questions: SBI & IBPS Prep",
    description:
      "Common SBI and IBPS PO interview questions, what the panel evaluates, and how to practice answering out loud before the final round.",
    image: "https://hirestepx.com/opengraph-image",
    url: "https://hirestepx.com/bank-po-interview-questions",
    publisher: { "@type": "Organization", name: "HireStepX", url: "https://hirestepx.com" },
    author: { "@type": "Organization", name: "HireStepX" },
    datePublished: "2026-07-31",
    dateModified: "2026-08-05",
  };

  return [
    ldJson(faqSchema),
    ldJson(articleSchema),
    ldJson(breadcrumb([{ name: "Bank PO Interview Questions", path: "/bank-po-interview-questions" }])),
  ];
}
