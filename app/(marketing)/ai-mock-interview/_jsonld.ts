import { breadcrumb, ldJson } from "@/marketing-v2/_schema";

/* Shared source of truth for /ai-mock-interview's JSON-LD, used by both the
 * page (renders it) and scripts/generate-jsonld-csp-hashes.mts (hashes the
 * JSON-LD for the CSP header). Keeping this in one place guarantees the
 * hash always matches what the page actually renders.
 *
 * FAQ_ENTRIES and HOW_IT_WORKS live here and are re-exported for page.tsx's
 * visible sections, so the two never drift apart. */

type HowItWorksStep = { step: string; title: string; desc: string };
type FaqEntry = { q: string; a: string };

export const HOW_IT_WORKS: HowItWorksStep[] = [
  {
    step: "1",
    title: "Upload your resume",
    desc: "The AI reads your experience and crafts role-specific questions, not generic ones from a bank.",
  },
  {
    step: "2",
    title: "Pick a company and interview type",
    desc: "Choose from 200+ companies and 10 interview formats: behavioral, technical, HR, case study, salary negotiation, and more.",
  },
  {
    step: "3",
    title: "Speak your answers",
    desc: "The AI interviewer asks questions by voice, listens to your spoken answer, and asks intelligent follow-up questions.",
  },
  {
    step: "4",
    title: "Get your scored report",
    desc: "STAR breakdown, communication score, filler-word count, pacing, and a coached model answer for every question.",
  },
];

export const FAQ_ENTRIES: FaqEntry[] = [
  {
    q: "What is an AI mock interview?",
    a: "An AI mock interview is a simulated job interview conducted by an AI system that acts as an interviewer. It asks you questions by voice, listens to your spoken answers, evaluates your responses on criteria like STAR structure and communication clarity, and delivers a scored report. Unlike text-based tools like ChatGPT, a voice-based AI mock interview closely replicates the pressure and format of a real interview.",
  },
  {
    q: "Is AI mock interview practice effective?",
    a: "Yes. Research on deliberate practice consistently shows that repeated realistic simulation improves performance. AI mock interviews let you practice the same question 10 times at 2am without scheduling anyone: the volume and immediacy of feedback is the key advantage over human coaches. The STAR scoring gives you objective data on what specifically is weak (situation setup, action clarity, result quantification) rather than vague subjective impressions.",
  },
  {
    q: "Is HireStepX AI mock interview free?",
    a: "Yes. HireStepX includes 2 complete AI mock interview sessions for free, with no credit card required. Each free session is a full voice interview with STAR scoring, a detailed performance report, and a coached model answer for every question. After your 2 free sessions, additional sessions are ₹9 each (credits never expire) or ₹39/month for the Sprint Pack (5 sessions).",
  },
  {
    q: "How is AI mock interview different from practicing with ChatGPT?",
    a: "ChatGPT is text-only, it cannot speak questions, cannot hear your spoken answers, cannot score your communication delivery, and has no resume integration. HireStepX is purpose-built: voice-based (the AI speaks and listens), resume-personalised questions, STAR structure scoring, company-specific question banks, progress tracking across sessions, and a coached model answer after every response.",
  },
  {
    q: "What companies can I practice AI mock interviews for?",
    a: "HireStepX supports 200+ target companies including Google, Amazon, Microsoft, Meta, Flipkart, Swiggy, Zomato, Razorpay, CRED, Meesho, PhonePe, Nykaa, Ola, Paytm, Goldman Sachs, McKinsey, Deloitte, TCS, Infosys, Wipro, Cognizant, Accenture, HCL, and Capgemini. Each company has a distinct interview pattern and question bank.",
  },
  {
    q: "What types of AI mock interviews are available?",
    a: "HireStepX supports 10 interview types: Behavioral (STAR method), Technical (CS fundamentals, system design), Strategic, Case Study, Campus Placement, HR Round, Panel, Management, Salary Negotiation, and Government/PSU. Each supports 3 difficulty levels and mini (10-minute) or full (25-minute) session options.",
  },
  {
    q: "Does the AI mock interview work on mobile?",
    a: "Yes, HireStepX works on any modern browser including mobile. For the best AI mock interview experience (especially for voice recognition accuracy), a laptop or desktop with a microphone in a quiet room is recommended. Mobile works for quick practice but a headset significantly improves STT accuracy.",
  },
];

export function buildAiMockInterviewJsonLd(
  faqEntries: FaqEntry[],
  howItWorks: HowItWorksStep[],
): { __html: string }[] {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqEntries.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  const howToSchema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to do an AI mock interview on HireStepX",
    description: "Practice a full voice-based AI mock interview in 4 steps, free, no card needed.",
    step: howItWorks.map((s) => ({
      "@type": "HowToStep",
      name: s.title,
      text: s.desc,
    })),
  };

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "AI Mock Interview Practice: Free, Voice-Based",
    description:
      "How AI mock interviews work, how they compare to ChatGPT and human coaches, and how to start practicing for free on HireStepX.",
    image: "https://hirestepx.com/opengraph-image",
    url: "https://hirestepx.com/ai-mock-interview",
    publisher: { "@type": "Organization", name: "HireStepX", url: "https://hirestepx.com" },
    author: { "@type": "Organization", name: "HireStepX" },
    datePublished: "2026-07-20",
    dateModified: "2026-08-05",
  };

  return [
    ldJson(faqSchema),
    ldJson(howToSchema),
    ldJson(articleSchema),
    ldJson(breadcrumb([{ name: "AI Mock Interview", path: "/ai-mock-interview" }])),
  ];
}
