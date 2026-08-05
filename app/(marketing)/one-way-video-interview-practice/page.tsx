import type { Metadata } from "next";
import Link from "next/link";
import { breadcrumb, ldJson } from "@/marketing-v2/_schema";
import { NavV2, MobileStickyCTA } from "@/marketing-v2/HomepageV2";
import { FooterDome } from "@/marketing-v2/FooterDome";
import { tokens as t, fonts } from "@/auth/_tokens";

/*
 * /one-way-video-interview-practice — pillar page for asynchronous
 * (HireVue-style) video interview prep, an increasingly common first
 * round at Indian IT/GCC companies. Distinct format: record answers to a
 * camera with no live interviewer, often on a timer, no do-overs.
 * Strongest product fit of the second keyword-gap batch — talking to a
 * camera with no live feedback is exactly what AI mock practice simulates.
 *
 * Target queries:
 *   "one way video interview"
 *   "asynchronous video interview practice"
 *   "recorded video interview tips india"
 *   "how to prepare for a one way interview"
 *   "hirevue interview practice india"
 *
 * Schema: Article + FAQPage + BreadcrumbList
 */

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "One-Way Video Interview Practice & Tips (India) | HireStepX",
  description:
    "No interviewer on the other end, no live cues, often one take per question. How to prepare for a one-way video interview and practice talking to a camera.",
  keywords: [
    "one way video interview",
    "asynchronous video interview practice",
    "recorded video interview tips india",
    "how to prepare for a one way interview",
    "hirevue interview practice india",
    "one way interview questions",
  ].join(", "),
  alternates: { canonical: "/one-way-video-interview-practice" },
  openGraph: {
    type: "article",
    title: "One-Way Video Interview Practice & Tips (India) | HireStepX",
    description:
      "How to prepare for a one-way, asynchronous video interview (no live interviewer, often one take per question), and how to practice talking to a camera before the real one.",
    url: "https://hirestepx.com/one-way-video-interview-practice",
    siteName: "HireStepX",
    locale: "en_IN",
    images: [{ url: "https://hirestepx.com/opengraph-image", width: 1200, height: 630, alt: "One-Way Video Interview Practice & Tips | HireStepX" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "One-Way Video Interview Practice & Tips | HireStepX",
    description: "How to prepare for a one-way, asynchronous video interview with no live interviewer.",
    images: ["https://hirestepx.com/opengraph-image"],
  },
};

const s = { fontFamily: fonts.sans };
const serif = { fontFamily: fonts.serif };

const CHALLENGES = [
  {
    title: "No one to read the room for",
    desc: "There's no nod, no follow-up, no reaction at all while you're answering: just a camera and a timer. Candidates who rely on interviewer feedback to pace themselves have nothing to adjust to.",
  },
  {
    title: "Usually one take, sometimes a hard time limit",
    desc: "Most platforms give you a set number of attempts, often just one, and a countdown per question. There's no natural pause to collect your thoughts the way a live conversation allows.",
  },
  {
    title: "You're being judged on delivery alone",
    desc: "With no interviewer to build rapport with, tone, eye contact with the lens, and pacing carry more of the impression than they would in a live round, and it's the part candidates practice least, because they've never had to talk to a camera with a timer running.",
  },
];

const TIPS = [
  {
    title: "Look at the lens, not the preview window",
    desc: "Watching your own video feed while answering reads as looking away on camera. Cover or ignore the preview and address the lens directly, the way you'd hold eye contact with a person.",
  },
  {
    title: "Rehearse with a real timer running",
    desc: "Most one-way platforms give 60-120 seconds per question. Practicing without a countdown means your first real attempt at pacing happens during the actual interview.",
  },
  {
    title: "Prepare structure, not a script",
    desc: "Reading from notes is obvious on camera and platforms often flag eye movement. Prepare the shape of your answer (situation, action, result) and let the words be spontaneous within it.",
  },
  {
    title: "Do a full technical check beforehand",
    desc: "Lighting facing you, camera at eye level, mic tested, stable internet. A one-way interview gives you no interviewer to flag a technical issue mid-answer: it's on you to catch it first.",
  },
];

export default async function OneWayVideoInterviewPage() {
  const { headers } = await import("next/headers");
  const nonce = (await headers()).get("x-nonce") ?? "";

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What is a one-way video interview?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "A one-way (asynchronous) video interview is a recorded round where you answer preset questions to a camera on a timer, with no live interviewer present. A recruiter reviews the recording afterward. It's increasingly common as a first round at Indian IT and GCC companies to screen high volumes of applicants efficiently.",
        },
      },
      {
        "@type": "Question",
        name: "How is a one-way video interview different from a live video interview?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "There's no interviewer reacting in real time, no follow-up questions, and usually a hard time limit with limited retakes per question. You're being evaluated on delivery and structure alone, with none of the rapport or reassurance cues a live conversation provides.",
        },
      },
      {
        "@type": "Question",
        name: "How many times can I redo my answer in a one-way interview?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "It depends on the platform the company uses, but most allow only one or two attempts per question, and some give none at all. That makes rehearsing the answer's structure in advance more important than in a live interview, where a stumble can be recovered from mid-conversation.",
        },
      },
      {
        "@type": "Question",
        name: "How can I practice for a one-way video interview?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Practice answering out loud on a timer, addressing a camera lens directly instead of a person, since both are unfamiliar skills most candidates have never rehearsed. AI mock interview practice simulates this well: no live interviewer, a real question, and a scored review of your delivery afterward, the same shape as the actual format.",
        },
      },
    ],
  };

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "One-Way Video Interview Practice & Tips",
    description:
      "How to prepare for a one-way, asynchronous video interview with no live interviewer, and how to practice talking to a camera before the real one.",
    url: "https://hirestepx.com/one-way-video-interview-practice",
    publisher: { "@type": "Organization", name: "HireStepX", url: "https://hirestepx.com" },
    author: { "@type": "Organization", name: "HireStepX" },
  };

  return (
    <>
      <NavV2 />

      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={ldJson(faqSchema)} />
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={ldJson(articleSchema)} />
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={ldJson(breadcrumb([{ name: "One-Way Video Interview Practice", path: "/one-way-video-interview-practice" }]))} />

      <main id="main-content" style={{ ...s, background: t.cream, minHeight: "100vh" }}>

        {/* ── Hero ── */}
        <section aria-labelledby="ow-hero" style={{ maxWidth: 760, margin: "0 auto", padding: "80px 24px 56px", textAlign: "center" }}>
          <p style={{ ...s, fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: t.copper, marginBottom: 20 }}>
            Asynchronous video rounds · India 2026
          </p>
          <h1
            id="ow-hero"
            style={{ ...serif, fontSize: "clamp(36px, 6vw, 64px)", fontWeight: 400, lineHeight: 1.05, letterSpacing: "-0.03em", color: t.coal, margin: "0 0 20px" }}
          >
            One-Way Video<br />
            <span style={{ fontStyle: "italic", color: t.copper }}>Interview Practice.</span>
          </h1>
          <p style={{ ...s, fontSize: 17, lineHeight: 1.65, color: t.inkSoft, maxWidth: 580, margin: "0 auto 36px" }}>
            No interviewer on the other end, just a camera, a timer, and one take. What makes one-way interviews different, and how to rehearse the one skill they actually test: talking to a lens like it's a person.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link
              href="/signup"
              style={{ ...s, background: t.copper, color: "#fff", padding: "13px 28px", borderRadius: 8, fontWeight: 600, fontSize: 15, textDecoration: "none", display: "inline-block" }}
            >
              Practice free: 2 sessions
            </Link>
            <Link
              href="/ai-mock-interview"
              style={{ ...s, background: "transparent", color: t.coal, padding: "13px 28px", borderRadius: 8, fontWeight: 500, fontSize: 15, textDecoration: "none", border: `1px solid ${t.line}`, display: "inline-block" }}
            >
              How AI mock interviews work
            </Link>
          </div>
        </section>

        {/* ── Why it's different ── */}
        <section aria-labelledby="ow-why" style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px 64px" }}>
          <h2 id="ow-why" style={{ ...serif, fontSize: 28, fontWeight: 400, color: t.coal, marginBottom: 16, letterSpacing: "-0.02em" }}>
            Why one-way interviews feel harder than a live round
          </h2>
          <p style={{ ...s, fontSize: 16, lineHeight: 1.7, color: t.coal, marginBottom: 32 }}>
            It's not the questions that trip candidates up: it's the format. Talking confidently to a silent camera on a countdown is a genuinely different skill from a live conversation, and almost nobody has practiced it before their first real one-way round.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {CHALLENGES.map((c) => (
              <div key={c.title} style={{ background: t.creamRaised, border: `1px solid ${t.line}`, borderRadius: 10, padding: "20px 22px" }}>
                <p style={{ ...s, fontSize: 16, fontWeight: 600, color: t.coal, margin: "0 0 6px" }}>{c.title}</p>
                <p style={{ ...s, fontSize: 15, color: t.inkSoft, margin: 0, lineHeight: 1.6 }}>{c.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Tips ── */}
        <section aria-labelledby="ow-tips" style={{ background: t.creamRaised, padding: "56px 24px" }}>
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            <h2 id="ow-tips" style={{ ...serif, fontSize: 28, fontWeight: 400, color: t.coal, marginBottom: 8, letterSpacing: "-0.02em" }}>
              How to prepare for a one-way video interview
            </h2>
            <p style={{ ...s, fontSize: 15, color: t.inkSoft, marginBottom: 32 }}>
              None of this is about the answer content: it's about the delivery skill the format actually tests.
            </p>
            <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 24 }}>
              {TIPS.map((item, i) => (
                <li key={item.title} style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
                  <span style={{ ...s, background: t.copper, color: "#fff", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0, marginTop: 2 }}>
                    {i + 1}
                  </span>
                  <div>
                    <p style={{ ...s, fontSize: 16, fontWeight: 600, color: t.coal, margin: "0 0 4px" }}>{item.title}</p>
                    <p style={{ ...s, fontSize: 15, color: t.inkSoft, margin: 0, lineHeight: 1.6 }}>{item.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Practice angle ── */}
        <section aria-labelledby="ow-practice" style={{ maxWidth: 720, margin: "0 auto", padding: "56px 24px" }}>
          <h2 id="ow-practice" style={{ ...serif, fontSize: 28, fontWeight: 400, color: t.coal, marginBottom: 16, letterSpacing: "-0.02em" }}>
            The closest practice to the real format
          </h2>
          <p style={{ ...s, fontSize: 16, lineHeight: 1.7, color: t.coal, marginBottom: 16 }}>
            A one-way interview's core challenge, answering out loud with no live person reacting, is exactly what AI mock interview practice already simulates. There's no camera feed to fixate on and no interviewer to read for cues, so the discomfort of "performing" to a silent recorder is one you can get used to beforehand instead of on the day it counts.
          </p>
          <p style={{ ...s, fontSize: 16, lineHeight: 1.7, color: t.coal }}>
            HireStepX asks a real question, gives you the same kind of time pressure, and scores your answer's structure and delivery afterward, so the first time you talk to a silent, unreacting interface isn't during the actual one-way round.
          </p>
        </section>

        {/* ── FAQ ── */}
        <section aria-labelledby="ow-faq" style={{ background: t.creamRaised, padding: "56px 24px" }}>
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            <h2 id="ow-faq" style={{ ...serif, fontSize: 28, fontWeight: 400, color: t.coal, marginBottom: 36, letterSpacing: "-0.02em" }}>
              One-way video interviews: common questions
            </h2>
            <dl style={{ display: "flex", flexDirection: "column", gap: 28 }}>
              {faqSchema.mainEntity.map((item) => (
                <div key={item.name}>
                  <dt style={{ ...s, fontSize: 16, fontWeight: 600, color: t.coal, marginBottom: 8 }}>{item.name}</dt>
                  <dd style={{ ...s, fontSize: 15, color: t.inkSoft, lineHeight: 1.7, margin: 0 }}>{item.acceptedAnswer.text}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ── Bottom CTA ── */}
        <section style={{ maxWidth: 720, margin: "0 auto", padding: "56px 24px 80px", textAlign: "center" }}>
          <h2 style={{ ...serif, fontSize: 32, fontWeight: 400, color: t.coal, marginBottom: 12, letterSpacing: "-0.02em" }}>
            Get comfortable talking to a camera first
          </h2>
          <p style={{ ...s, fontSize: 16, color: t.inkSoft, marginBottom: 32, maxWidth: 480, margin: "0 auto 32px" }}>
            2 complete AI mock interview sessions, free. No credit card, no scheduling: practice the delivery before the one-take round.
          </p>
          <Link
            href="/signup"
            style={{ ...s, background: t.copper, color: "#fff", padding: "15px 36px", borderRadius: 8, fontWeight: 600, fontSize: 16, textDecoration: "none", display: "inline-block" }}
          >
            Practice free: 2 sessions included
          </Link>
        </section>

        {/* ── Related reading ── */}
        <section aria-label="Related guides" style={{ borderTop: `1px solid ${t.line}`, padding: "40px 24px 56px" }}>
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            <p style={{ ...s, fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: t.inkSoft, marginBottom: 16 }}>
              Related guides
            </p>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {[
                { label: "AI Mock Interview Practice", href: "/ai-mock-interview" },
                { label: "How to Overcome Interview Anxiety", href: "/interview-anxiety" },
                { label: "Telephonic Interview Questions", href: "/telephonic-interview-questions" },
                { label: "Walk-in Interview Preparation", href: "/walk-in-interview-preparation" },
                { label: "Interview Preparation Guide India 2026", href: "/interview-prep" },
                { label: "How It Works: 5 Steps", href: "/how-it-works" },
              ].map((link) => (
                <Link key={link.href} href={link.href} style={{ ...s, fontSize: 14, color: t.copper, textDecoration: "underline", lineHeight: 1.5 }}>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <FooterDome />
      <MobileStickyCTA />
    </>
  );
}
