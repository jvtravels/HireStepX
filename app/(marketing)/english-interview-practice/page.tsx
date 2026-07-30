import type { Metadata } from "next";
import Link from "next/link";
import { breadcrumb, ldJson } from "@/marketing-v2/_schema";
import { NavV2, MobileStickyCTA } from "@/marketing-v2/HomepageV2";
import { FooterDome } from "@/marketing-v2/FooterDome";
import { tokens as t, fonts } from "@/auth/_tokens";

/*
 * /english-interview-practice — pillar page for bilingual / English-speaking
 * interview practice queries. Search results for this space are dominated
 * by YouTube channels and static Hindi-vocabulary guides (Talkpal, Awal,
 * hindi.learnex.in) — none of them are a voice AI product built for the
 * actual code-switched English Indian interviewers use. HireStepX's voice
 * model is trained on Indian English and regional accents, which is a real
 * product fit for this query space, not just a keyword swap.
 *
 * Target queries:
 *   "english speaking practice for job interview"
 *   "interview preparation in hindi"
 *   "how to speak fluent english in interview"
 *   "interview english practice india"
 */

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "English Speaking Practice for Job Interviews | HireStepX",
  description:
    "Practice interviews out loud with an AI voice interviewer trained on Indian English and regional accents. Get comfortable speaking under pressure before the real interview — free.",
  keywords: [
    "english speaking practice for job interview",
    "interview preparation in hindi",
    "how to speak fluent english in interview",
    "interview english practice india",
    "english speaking practice job interview india",
    "improve spoken english for interview",
  ].join(", "),
  alternates: { canonical: "/english-interview-practice" },
  openGraph: {
    type: "article",
    title: "English Speaking Practice for Job Interviews | HireStepX",
    description:
      "Practice interviews out loud with a voice AI trained on Indian English and regional accents — build real speaking confidence before the interview that counts.",
    url: "https://hirestepx.com/english-interview-practice",
    siteName: "HireStepX",
    locale: "en_IN",
    images: [{ url: "https://hirestepx.com/opengraph-image", width: 1200, height: 630, alt: "English Speaking Practice for Job Interviews | HireStepX" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "English Speaking Practice for Job Interviews | HireStepX",
    description: "Voice AI interview practice trained on Indian English and regional accents.",
    images: ["https://hirestepx.com/opengraph-image"],
  },
};

const s = { fontFamily: fonts.sans };
const serif = { fontFamily: fonts.serif };

const CHALLENGES = [
  {
    title: "Reading fluently isn't the same as speaking fluently",
    desc: "Most candidates can read and understand English interview questions with ease. The gap shows up in real time: forming a structured spoken answer, under mild pressure, without a script in front of you.",
  },
  {
    title: "Real interviews mix languages, most prep material doesn't",
    desc: "Indian interviews often involve natural code-switching — fillers like \"actually\", \"basically\", or a stray \"matlab\" mid-answer. Practicing against rigid, textbook-English scripts doesn't prepare you for how the conversation actually sounds.",
  },
  {
    title: "There's rarely anyone to practice with",
    desc: "Practicing spoken English out loud requires a listener. Friends and family get exhausted after a few rounds; a fluent English-speaking peer for regular sessions isn't available to everyone, especially outside metro cities.",
  },
];

const HOW_IT_HELPS = [
  { label: "Indian-English voice model", desc: "Trained on Indian speech patterns and regional accents, not a generic US/UK accent that doesn't match how the interview will actually sound." },
  { label: "Speak, don't type", desc: "Every answer is spoken out loud to the AI interviewer, the same skill the real interview tests, unlike text-based tools." },
  { label: "Unlimited repetition", desc: "Practice the same answer, or a fresh set of questions, as many times as it takes to get fluent — no listener fatigue, no scheduling." },
  { label: "Feedback on delivery, not just content", desc: "The scored report flags filler-word frequency, pacing, and clarity alongside STAR structure — the specific things that make spoken English feel less confident." },
];

export default async function EnglishInterviewPracticePage() {
  const { headers } = await import("next/headers");
  const nonce = (await headers()).get("x-nonce") ?? "";

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "How can I improve my spoken English for interviews?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "The fastest way is repeated speaking practice under interview-like conditions, out loud, not silent review. Reading and understanding English is a different skill from forming a structured spoken answer in real time. Practicing your key stories (background, strengths, past projects) out loud multiple times closes that gap faster than grammar study alone.",
        },
      },
      {
        "@type": "Question",
        name: "Is it okay to mix Hindi and English in an interview?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Most Indian interviewers are comfortable with natural code-switching — a stray Hindi word or filler doesn't hurt you. What matters more is structure and clarity: a well-organized answer with occasional code-switching reads better than a stiff, over-rehearsed all-English answer that sounds memorized.",
        },
      },
      {
        "@type": "Question",
        name: "Can I practice interview English without a fluent English-speaking friend?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes — a voice-based AI mock interview gives you a live listener that asks real interview questions, listens to your spoken answer, and responds with follow-ups, without needing to schedule a person. HireStepX's voice model is built for Indian English and regional accents specifically, so it recognizes speech patterns a generic accent model would misread.",
        },
      },
      {
        "@type": "Question",
        name: "Does an Indian accent hurt my chances in an interview?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No — Indian interviewers overwhelmingly conduct interviews in Indian English and expect an Indian accent. What actually affects outcomes is clarity, pacing, and structure of the answer, not accent itself. Practice aimed at those three things (not accent neutralization) is the higher-value use of prep time.",
        },
      },
    ],
  };

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "English Speaking Practice for Job Interviews",
    description:
      "Why spoken English is the real gap for interview prep, and how voice-based AI practice trained on Indian English closes it.",
    url: "https://hirestepx.com/english-interview-practice",
    publisher: { "@type": "Organization", name: "HireStepX", url: "https://hirestepx.com" },
    author: { "@type": "Organization", name: "HireStepX" },
  };

  return (
    <>
      <NavV2 />

      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={ldJson(faqSchema)} />
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={ldJson(articleSchema)} />
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={ldJson(breadcrumb([{ name: "English Interview Practice", path: "/english-interview-practice" }]))} />

      <main id="main-content" style={{ ...s, background: t.cream, minHeight: "100vh" }}>

        {/* ── Hero ── */}
        <section aria-labelledby="eip-hero" style={{ maxWidth: 760, margin: "0 auto", padding: "80px 24px 56px", textAlign: "center" }}>
          <p style={{ ...s, fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: t.copper, marginBottom: 20 }}>
            Built for Indian English · India 2026
          </p>
          <h1
            id="eip-hero"
            style={{ ...serif, fontSize: "clamp(36px, 6vw, 64px)", fontWeight: 400, lineHeight: 1.05, letterSpacing: "-0.03em", color: t.coal, margin: "0 0 20px" }}
          >
            English Speaking Practice<br />
            <span style={{ fontStyle: "italic", color: t.copper }}>for Interviews.</span>
          </h1>
          <p style={{ ...s, fontSize: 17, lineHeight: 1.65, color: t.inkSoft, maxWidth: 580, margin: "0 auto 36px" }}>
            Understanding English isn't the same as speaking it fluently under pressure. Practice out loud with a voice AI trained on Indian English and regional accents — free.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link
              href="/signup"
              style={{ ...s, background: t.copper, color: "#fff", padding: "13px 28px", borderRadius: 8, fontWeight: 600, fontSize: 15, textDecoration: "none", display: "inline-block" }}
            >
              Practice free — 2 sessions
            </Link>
            <Link
              href="/ai-mock-interview"
              style={{ ...s, background: "transparent", color: t.coal, padding: "13px 28px", borderRadius: 8, fontWeight: 500, fontSize: 15, textDecoration: "none", border: `1px solid ${t.line}`, display: "inline-block" }}
            >
              How AI mock interviews work
            </Link>
          </div>
        </section>

        {/* ── The real gap ── */}
        <section aria-labelledby="eip-gap" style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px 64px" }}>
          <h2 id="eip-gap" style={{ ...serif, fontSize: 28, fontWeight: 400, color: t.coal, marginBottom: 16, letterSpacing: "-0.02em" }}>
            Where spoken English actually breaks down
          </h2>
          <p style={{ ...s, fontSize: 16, lineHeight: 1.7, color: t.coal, marginBottom: 32 }}>
            Most candidates preparing for interviews in India read and understand English comfortably. The real gap shows up when speaking — forming a clear, structured answer out loud, in real time, without a script.
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

        {/* ── How AI practice helps ── */}
        <section aria-labelledby="eip-help" style={{ background: t.creamRaised, padding: "56px 24px" }}>
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            <h2 id="eip-help" style={{ ...serif, fontSize: 28, fontWeight: 400, color: t.coal, marginBottom: 8, letterSpacing: "-0.02em" }}>
              Why voice AI practice fits this problem
            </h2>
            <p style={{ ...s, fontSize: 15, color: t.inkSoft, marginBottom: 32 }}>
              Speaking practice needs a listener who's available whenever you are — and understands how the answer will actually sound.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
              {HOW_IT_HELPS.map((item) => (
                <div key={item.label} style={{ background: t.cream, border: `1px solid ${t.line}`, borderRadius: 10, padding: "18px 20px" }}>
                  <p style={{ ...s, fontSize: 15, fontWeight: 600, color: t.coal, margin: "0 0 6px" }}>{item.label}</p>
                  <p style={{ ...s, fontSize: 14, color: t.inkSoft, margin: 0, lineHeight: 1.6 }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Code-switching note ── */}
        <section aria-labelledby="eip-code" style={{ maxWidth: 720, margin: "0 auto", padding: "56px 24px" }}>
          <h2 id="eip-code" style={{ ...serif, fontSize: 28, fontWeight: 400, color: t.coal, marginBottom: 16, letterSpacing: "-0.02em" }}>
            You don't need to sound like a textbook
          </h2>
          <p style={{ ...s, fontSize: 16, lineHeight: 1.7, color: t.coal, marginBottom: 16 }}>
            Real Indian interviews rarely sound like a language-learning app. Interviewers are used to natural code-switching: a filler word, a stray Hindi phrase mid-answer, a slight regional cadence. Practicing against a rigid, all-English script that doesn't allow for that mismatch prepares you for an interview that doesn't exist.
          </p>
          <p style={{ ...s, fontSize: 16, lineHeight: 1.7, color: t.coal }}>
            What consistently matters more than accent or occasional code-switching is structure and clarity — an answer that's easy to follow, paced well, and doesn't ramble. That's what a scored practice session should actually measure, and what HireStepX's report breaks down after every question.
          </p>
        </section>

        {/* ── FAQ ── */}
        <section aria-labelledby="eip-faq" style={{ background: t.creamRaised, padding: "56px 24px" }}>
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            <h2 id="eip-faq" style={{ ...serif, fontSize: 28, fontWeight: 400, color: t.coal, marginBottom: 36, letterSpacing: "-0.02em" }}>
              English interview practice — common questions
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
            Practice speaking, out loud, for free
          </h2>
          <p style={{ ...s, fontSize: 16, color: t.inkSoft, marginBottom: 32, maxWidth: 480, margin: "0 auto 32px" }}>
            2 complete AI mock interview sessions. Voice-based, built for Indian English, no credit card needed.
          </p>
          <Link
            href="/signup"
            style={{ ...s, background: t.copper, color: "#fff", padding: "15px 36px", borderRadius: 8, fontWeight: 600, fontSize: 16, textDecoration: "none", display: "inline-block" }}
          >
            Practice free — 2 sessions included
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
                { label: "One-Way Video Interview Practice", href: "/one-way-video-interview-practice" },
                { label: "Interview Preparation Guide India 2026", href: "/interview-prep" },
                { label: "STAR Method Guide India", href: "/blog/star-method-interview-answers-india" },
                { label: "Campus Placement Preparation Guide", href: "/for-students" },
                { label: "How It Works — 5 Steps", href: "/how-it-works" },
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
