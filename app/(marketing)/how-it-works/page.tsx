import type { Metadata } from "next";
import { HowItWorksV2 } from "@/marketing-v2/MarketingPagesV2";
import { breadcrumb, ldJson } from "@/marketing-v2/_schema";

export const metadata: Metadata = {
  title: "How it works | HireStepX",
  description:
    "Five steps from cold start to interview-ready: upload resume, pick role and company, practice voice interview, read a scored STAR report, repeat as skills decay.",
  alternates: { canonical: "/how-it-works" },
  openGraph: {
    title: "How HireStepX Works — AI Mock Interviews in 5 Steps",
    description: "Upload your resume, pick your target company and role, practice a voice interview with AI, get a scored STAR report, and repeat as skills decay.",
    url: "https://hirestepx.com/how-it-works",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "How HireStepX Works — AI Mock Interviews in 5 Steps",
    description: "Upload resume, pick role, practice voice interview with AI, get scored report. Start free.",
  },
};

export const dynamic = "force-static";
export const revalidate = 3600;

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

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={ldJson(breadcrumb([{ name: "How it works", path: "/how-it-works" }]))} />
      <script type="application/ld+json" dangerouslySetInnerHTML={ldJson(HOWTO_SCHEMA)} />
      <HowItWorksV2 />
    </>
  );
}
