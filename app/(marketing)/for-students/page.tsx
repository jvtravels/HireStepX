import type { Metadata } from "next";
import { ForStudentsV2 } from "@/marketing-v2/MarketingPagesV2";
import { breadcrumb, ldJson } from "@/marketing-v2/_schema";

export const metadata: Metadata = {
  title: "AI Mock Interviews for Campus Placements India 2026 — Free for Students | HireStepX",
  description:
    "Prepare for TCS NQT, Infosys InfyTQ, Wipro NLTH, and first-job interviews with AI mock interviews. Free 2 sessions + 30% student discount with .ac.in email. Practice behavioral, technical, and HR rounds with voice feedback.",
  keywords: [
    "campus placement interview preparation India 2026",
    "TCS NQT preparation",
    "Infosys campus placement",
    "AI mock interview for students India",
    "fresher interview practice",
    "college placement interview preparation",
    "first job interview India 2026",
  ].join(", "),
  alternates: { canonical: "/for-students" },
  openGraph: {
    title: "AI Mock Interviews for Campus Placements India 2026 | HireStepX for Students",
    description: "Practice TCS NQT, Infosys SP, Wipro NLTH, and first-job interviews with AI mock interviews. Free 2 sessions + 30% discount with college email.",
    url: "https://hirestepx.com/for-students",
    type: "website",
    siteName: "HireStepX",
    locale: "en_IN",
    images: [{ url: "https://hirestepx.com/og-default.png", width: 1200, height: 630, alt: "AI Mock Interviews for Campus Placements India 2026 | HireStepX" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Mock Interviews for Campus Placements India 2026 | HireStepX",
    description: "TCS NQT, Infosys SP, Wipro NLTH — AI mock interview practice for campus placements. Free 2 sessions + 30% student discount.",
    images: ["https://hirestepx.com/og-default.png"],
  },
};

export const revalidate = 3600;

/* Schemas injected server-side so they appear in the initial HTML payload.
   All FAQ answers are sourced from the verified page content in ForStudentsV2
   — no claims introduced here that aren't on the page. */
const ARTICLE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "AI Mock Interviews for Campus Placements India 2026",
  description: "AI mock interview practice for TCS NQT, Infosys InfyTQ, Wipro NLTH, and campus placement interviews. 2 free sessions, no credit card. 30% student discount with .ac.in email.",
  image: "https://hirestepx.com/og-default.png",
  author: { "@type": "Organization", name: "HireStepX", url: "https://hirestepx.com" },
  publisher: { "@type": "Organization", name: "HireStepX", logo: { "@type": "ImageObject", url: "https://hirestepx.com/wordmark.png" } },
  datePublished: "2026-01-01",
  dateModified: "2026-07-14",
  inLanguage: "en-IN",
  url: "https://hirestepx.com/for-students",
  mainEntityOfPage: { "@type": "WebPage", "@id": "https://hirestepx.com/for-students" },
  keywords: "campus placement interview preparation India 2026, TCS NQT preparation, AI mock interview for students India",
  articleSection: "Campus Placement",
};

const FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Is HireStepX free for students?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "HireStepX offers 2 free mock interview sessions with no credit card required. Students with a .ac.in or .edu.in college email receive 30% off the Sprint Pack (5 sessions).",
      },
    },
    {
      "@type": "Question",
      name: "Which campus placement rounds does HireStepX help prepare for?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "HireStepX covers TCS Digital, Infosys System Engineer and Power Programmer tracks, Wipro Elite NTH, Capgemini, plus off-campus rounds at companies like CRED, Razorpay, Zomato, and Flipkart — including HR, behavioral, and technical rounds.",
      },
    },
    {
      "@type": "Question",
      name: "How does AI mock interview practice work on HireStepX?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The AI interviewer asks company-specific questions, listens to your spoken answer in real time, and produces a scored report grading your answer on structure, specificity, and delivery. Your first 2 sessions are free with no credit card required.",
      },
    },
    {
      "@type": "Question",
      name: "Does HireStepX cover government and PSU interview preparation?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. HireStepX includes preparation for ISRO scientist-engineer interviews, RBI Grade B, and GATE-PSU technical rounds, which follow a distinct format from private-sector campus interviews.",
      },
    },
  ],
};

export default async function Page() {
  const { headers } = await import("next/headers");
  const nonce = (await headers()).get("x-nonce") ?? "";
  return (
    <>
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={ldJson(breadcrumb([{ name: "For students", path: "/for-students" }]))} />
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ARTICLE_SCHEMA) }} />
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_SCHEMA) }} />
      <ForStudentsV2 />
    </>
  );
}
