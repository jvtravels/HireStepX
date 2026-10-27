import type { Metadata } from "next";
import ConsentGatedAdSense from "../../ConsentGatedAdSense";
import { HubTemplate, type HubSection } from "@/home2/HubTemplate";
import { buildAiMockInterviewJsonLd, FAQ_ENTRIES, HOW_IT_WORKS } from "./_jsonld";
import { questionHref } from "../../../src/seoLinks";

/*
 * /ai-mock-interview — dedicated landing page for the highest-volume
 * non-branded keyword (1,700+ searches/month in India).
 *
 * Target queries:
 *   "ai mock interview"
 *   "ai mock interview free"
 *   "ai mock interview practice"
 *   "ai interview practice India"
 *   "free ai mock interview India"
 *   "best ai mock interview tool India"
 *
 * Schema: Article + FAQPage + HowTo + BreadcrumbList
 */

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "AI Mock Interview Practice: Free, Voice-Based | HireStepX",
  description:
    "Practice AI mock interviews free. Voice AI asks company-specific questions and scores your answers on STAR structure and communication. 2 free sessions.",
  keywords: [
    "ai mock interview",
    "ai mock interview free",
    "ai mock interview practice",
    "ai interview practice india",
    "free ai mock interview india",
    "best ai mock interview tool india",
    "ai interview preparation",
    "mock interview ai feedback",
  ].join(", "),
  alternates: { canonical: "/ai-mock-interview" },
  openGraph: {
    type: "article",
    title: "AI Mock Interview Practice: Free, Voice-Based | HireStepX",
    description:
      "Practice AI mock interviews for free. Voice-based AI interviewer, STAR scoring, and company-specific questions for Google, TCS, Flipkart, and 200+ companies.",
    url: "https://hirestepx.com/ai-mock-interview",
    siteName: "HireStepX",
    locale: "en_IN",
    images: [{ url: "https://hirestepx.com/opengraph-image", width: 1200, height: 630, alt: "AI Mock Interview Practice | HireStepX" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Mock Interview Practice, Free | HireStepX",
    description: "Voice-based AI mock interviews with STAR scoring. 2 free sessions, no card. Practice for Google, TCS, Flipkart, and 200+ companies.",
    images: ["https://hirestepx.com/opengraph-image"],
  },
};

const TOP_COMPANIES = [
  { label: "Google", slug: "google-behavioral-interview-questions" },
  { label: "Amazon", slug: "amazon-leadership-principles-interview" },
  { label: "Microsoft", slug: "microsoft-india-sde-interview-questions" },
  { label: "Meta", slug: "meta-engineering-interview-questions" },
  { label: "Flipkart", slug: "flipkart-pm-interview-questions" },
  { label: "TCS", slug: "tcs-ninja-interview-questions" },
  { label: "Infosys", slug: "infosys-behavioral-interview-questions" },
  { label: "Wipro", slug: "wipro-freshers-interview-questions" },
  { label: "Razorpay", slug: "razorpay-pm-interview-questions" },
  { label: "Swiggy", slug: "swiggy-pm-interview-questions" },
  { label: "Goldman Sachs", slug: "goldman-sachs-interview-questions-india" },
  { label: "J.P. Morgan", slug: "jpmorgan-interview-questions-india" },
  { label: "HDFC Bank", slug: "hdfc-bank-software-engineer-interview-questions" },
  { label: "Upstox", slug: "upstox-swe-interview-questions" },
  { label: "Zerodha", slug: "zerodha-engineering-interview-questions" },
  { label: "Meesho", slug: "meesho-engineering-interview-questions" },
  { label: "Optiver", slug: "optiver-quant-interview-questions" },
  { label: "Scaler", slug: "scaler-software-engineer-interview-questions" },
];

const INTERVIEW_TYPES = [
  { label: "Behavioral", meta: "STAR-method questions with follow-ups" },
  { label: "Technical", meta: "CS fundamentals, system design, coding" },
  { label: "HR round", meta: "Tell me about yourself, strengths, goals" },
  { label: "Case study", meta: "Product, business and consulting cases" },
  { label: "Campus placement", meta: "Aptitude, group discussion, technical, HR" },
  { label: "Salary negotiation", meta: "Offer negotiation with counter tactics" },
];

const sections: HubSection[] = [
  {
    kind: "steps", id: "how-it-works", title: "How an AI mock interview works",
    items: HOW_IT_WORKS.map((h) => ({ title: h.title, body: h.desc })),
  },
  {
    kind: "table", id: "types", title: "Interview types you can practise",
    sub: "Ten formats, each at three difficulty levels. These are the six most used.",
    head: ["Type", "What you practise"],
    rows: INTERVIEW_TYPES.map((t) => [t.label, t.meta]),
  },
  {
    kind: "table", id: "compare", title: "AI mock interview vs a human coach vs ChatGPT",
    head: ["", "HireStepX", "Human coach", "ChatGPT"],
    rows: [
      ["Available 24/7", "Yes", "No", "Yes"],
      ["Speaks and listens", "Yes", "Yes", "No"],
      ["Questions from your resume", "Yes", "Yes", "No"],
      ["STAR structure scoring", "Yes", "No", "No"],
      ["Company-specific questions", "Yes", "No", "No"],
      ["Instant scored report", "Yes", "No", "No"],
      ["Coached model answer", "Yes", "No", "No"],
      ["Progress tracking", "Yes", "No", "No"],
      ["Free to start", "Yes", "No", "Yes"],
    ],
  },
  {
    kind: "grid", id: "companies", title: "Practise for a specific company",
    sub: "Questions and rounds for the employers Indian candidates ask about most.",
    items: [
      ...TOP_COMPANIES.map((c) => ({ label: `${c.label} interview questions`, href: questionHref(c.slug) })),
      { label: "Browse all 200+ companies", href: "/companies" },
    ],
  },
  {
    kind: "grid", id: "related", title: "Keep preparing",
    items: [
      { label: "Interview preparation guide", href: "/interview-prep", meta: "Timelines and company-by-company plans" },
      { label: "Practice questions", href: "/questions", meta: "Every question set, by company and role" },
      { label: "STAR method answers", href: "/blog/star-method-interview-answers", meta: "Structure answers that score" },
      { label: "Best AI mock interview tools in India", href: "/blog/best-ai-mock-interview-tools-india-2026", meta: "What to look for when choosing" },
      { label: "Interview anxiety", href: "/interview-anxiety", meta: "Practise until it stops feeling new" },
      { label: "English interview practice", href: "/english-interview-practice", meta: "Fluency and clarity under pressure" },
    ],
  },
];

export default async function AiMockInterviewPage() {
  return (
    <>
      <ConsentGatedAdSense />
      {buildAiMockInterviewJsonLd(FAQ_ENTRIES, HOW_IT_WORKS).map((html, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={html} />
      ))}
      <HubTemplate
        kicker="Free · Voice-based · India 2026"
        title="AI mock interview practice, free"
        dek="An AI interviewer asks company-specific questions out loud, listens to your answers, and scores your STAR structure and delivery. Two full sessions are free, with no card."
        crumbs={[{ label: "AI mock interview" }]}
        stats={[{ label: "Companies", value: "200+" }, { label: "Interview types", value: "10" }, { label: "Free sessions", value: "2" }]}
        cta={["Start free mock interview", "/signup?source=ai-mock-interview"]}
        sections={sections}
        faqs={FAQ_ENTRIES}
        close={{ kicker: "Practise", title: "Speak the answer. See the score.", body: "Two complete voice interviews are free: a scored report and a coached model answer for every question.", primary: ["Start free: 2 mock interviews", "/signup?source=ai-mock-interview-cta"] }}
      />
    </>
  );
}
