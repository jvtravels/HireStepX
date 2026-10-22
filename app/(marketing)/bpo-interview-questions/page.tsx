import type { Metadata } from "next";
import Link from "next/link";
import { NavV2, MobileStickyCTA } from "@/marketing-v2/HomepageV2";
import { FooterDome } from "@/marketing-v2/FooterDome";
import { tokens as t, fonts } from "@/auth/_tokens";
import { buildBpoInterviewJsonLd, FAQ_ENTRIES } from "./_jsonld";

/*
 * /bpo-interview-questions — pillar page for the BPO / call center /
 * customer service hiring vertical. Not a company or focus tuple in
 * data/seo-pages.ts (that tree is corporate/tech-role-oriented) — this is
 * a distinct, high-volume audience. Ties directly to the English-fluency
 * pillar page, since the voice & accent round is the differentiator most
 * BPO candidates actually worry about. TalkDrill has a ranking page for
 * this exact query — direct competitive signal, not just a hypothetical gap.
 *
 * Target queries:
 *   "bpo interview questions and answers"
 *   "call center interview questions india"
 *   "customer service interview questions india"
 *   "voice process interview questions"
 *   "bpo fresher interview questions"
 *
 * Schema: Article + FAQPage + BreadcrumbList
 */

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "BPO Interview Questions & Answers (India) | HireStepX",
  description:
    "Common BPO and call center interview questions, what the voice & accent round checks for, and how to practice spoken English before the interview.",
  keywords: [
    "bpo interview questions and answers",
    "call center interview questions india",
    "customer service interview questions india",
    "voice process interview questions",
    "bpo fresher interview questions",
    "bpo interview preparation",
  ].join(", "),
  alternates: { canonical: "/bpo-interview-questions" },
  openGraph: {
    type: "article",
    title: "BPO Interview Questions & Answers (India) | HireStepX",
    description:
      "Common BPO and call center interview questions, what the voice & accent round checks for, and how to practice spoken English answers before the interview.",
    url: "https://hirestepx.com/bpo-interview-questions",
    siteName: "HireStepX",
    locale: "en_IN",
    images: [{ url: "https://hirestepx.com/opengraph-image", width: 1200, height: 630, alt: "BPO Interview Questions & Answers | HireStepX" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "BPO Interview Questions & Answers | HireStepX",
    description: "Common BPO and call center interview questions, and how to practice the voice & accent round.",
    images: ["https://hirestepx.com/opengraph-image"],
  },
};

const s = { fontFamily: fonts.sans };
const serif = { fontFamily: fonts.serif };

const ROUNDS = [
  {
    title: "Voice & accent round",
    desc: "You'll be asked to read a short passage or speak spontaneously so the recruiter can assess clarity, pace, and neutral pronunciation. This isn't about sounding foreign: it's about being consistently understood on a call with background noise and no visual cues to fall back on.",
  },
  {
    title: "HR / personal interview",
    desc: "Standard fit questions: why BPO, availability for shifts (including night shifts for international voice processes), and how you handle repetitive or high-pressure work.",
  },
  {
    title: "Situational / customer-handling round",
    desc: "You'll be given a scenario (an angry customer, a billing dispute, a request outside policy) and asked how you'd respond. Recruiters are listening for calm tone and structured thinking under pressure, not the 'correct' resolution.",
  },
];

const QUESTIONS = [
  { q: "Tell me about yourself.", tip: "Keep it under 90 seconds, in clear spoken English: this doubles as your voice & accent assessment even when it's framed as a general question." },
  { q: "Why do you want to work in a BPO / call center?", tip: "Avoid \"it's the only option available\"; talk about communication skills, structured work, or specific interest in customer service." },
  { q: "Are you comfortable working night shifts / rotational shifts?", tip: "Answer directly. Hesitation here is one of the fastest ways to be screened out for international voice processes." },
  { q: "How would you handle an angry customer?", tip: "Structure your answer: acknowledge, stay calm, focus on resolution within policy. Recruiters are scoring your tone as much as your content." },
  { q: "Describe a time you had to explain something complicated simply.", tip: "This is testing the actual skill of the job, clarity under time pressure, so answer it with a real, specific example." },
  { q: "What are your salary expectations?", tip: "Know the going rate for the specific process (voice, international voice, or non-voice) before the interview: ranges vary widely." },
];

export default async function BpoInterviewPage() {
  return (
    <>
      <NavV2 />

      {buildBpoInterviewJsonLd(FAQ_ENTRIES).map((html, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={html} />
      ))}

      <main id="main-content" style={{ ...s, background: t.cream, minHeight: "100vh" }}>

        {/* ── Hero ── */}
        <section aria-labelledby="bpo-hero" style={{ maxWidth: 760, margin: "0 auto", padding: "80px 24px 56px", textAlign: "center" }}>
          <p style={{ ...s, fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: t.copper, marginBottom: 20 }}>
            BPO & customer service hiring · India 2026
          </p>
          <h1
            id="bpo-hero"
            style={{ ...serif, fontSize: "clamp(36px, 6vw, 64px)", fontWeight: 400, lineHeight: 1.05, letterSpacing: "-0.03em", color: t.coal, margin: "0 0 20px" }}
          >
            BPO Interview<br />
            <span style={{ fontStyle: "italic", color: t.copper }}>Questions & Answers.</span>
          </h1>
          <p style={{ ...s, fontSize: 17, lineHeight: 1.65, color: t.inkSoft, maxWidth: 580, margin: "0 auto 36px" }}>
            The voice & accent round, HR round, and customer-handling scenario: what each one actually checks for, common questions, and how to practice spoken answers before the interview.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link
              href="/signup"
              style={{ ...s, background: t.copper, color: "#fff", padding: "13px 28px", borderRadius: 8, fontWeight: 600, fontSize: 15, textDecoration: "none", display: "inline-block" }}
            >
              Practice free, 2 sessions
            </Link>
            <Link
              href="/english-interview-practice"
              style={{ ...s, background: "transparent", color: t.coal, padding: "13px 28px", borderRadius: 8, fontWeight: 500, fontSize: 15, textDecoration: "none", border: `1px solid ${t.line}`, display: "inline-block" }}
            >
              English speaking practice
            </Link>
          </div>
        </section>

        {/* ── The rounds ── */}
        <section aria-labelledby="bpo-rounds" style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px 64px" }}>
          <h2 id="bpo-rounds" style={{ ...serif, fontSize: 28, fontWeight: 400, color: t.coal, marginBottom: 16, letterSpacing: "-0.02em" }}>
            The three rounds most BPO interviews follow
          </h2>
          <p style={{ ...s, fontSize: 16, lineHeight: 1.7, color: t.coal, marginBottom: 32 }}>
            Structure varies by company, but voice process hiring in India consistently tests these three things, usually in the same order.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {ROUNDS.map((c) => (
              <div key={c.title} style={{ background: t.creamRaised, border: `1px solid ${t.line}`, borderRadius: 10, padding: "20px 22px" }}>
                <p style={{ ...s, fontSize: 16, fontWeight: 600, color: t.coal, margin: "0 0 6px" }}>{c.title}</p>
                <p style={{ ...s, fontSize: 15, color: t.inkSoft, margin: 0, lineHeight: 1.6 }}>{c.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Common questions ── */}
        <section aria-labelledby="bpo-questions" style={{ background: t.creamRaised, padding: "56px 24px" }}>
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            <h2 id="bpo-questions" style={{ ...serif, fontSize: 28, fontWeight: 400, color: t.coal, marginBottom: 8, letterSpacing: "-0.02em" }}>
              Common BPO interview questions
            </h2>
            <p style={{ ...s, fontSize: 15, color: t.inkSoft, marginBottom: 32 }}>
              Delivery is weighted as heavily as content here: how you answer is part of what's being scored.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {QUESTIONS.map((item) => (
                <div key={item.q} style={{ borderBottom: `1px solid ${t.line}`, paddingBottom: 20 }}>
                  <p style={{ ...s, fontSize: 16, fontWeight: 600, color: t.coal, margin: "0 0 6px" }}>{item.q}</p>
                  <p style={{ ...s, fontSize: 15, color: t.inkSoft, margin: 0, lineHeight: 1.6 }}>{item.tip}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Practice angle ── */}
        <section aria-labelledby="bpo-practice" style={{ maxWidth: 720, margin: "0 auto", padding: "56px 24px" }}>
          <h2 id="bpo-practice" style={{ ...serif, fontSize: 28, fontWeight: 400, color: t.coal, marginBottom: 16, letterSpacing: "-0.02em" }}>
            Practice the thing that's actually being scored
          </h2>
          <p style={{ ...s, fontSize: 16, lineHeight: 1.7, color: t.coal, marginBottom: 16 }}>
            Reading BPO interview questions silently doesn't prepare you for a voice & accent round: the round exists specifically to hear you speak spontaneously under mild pressure, which reading can't rehearse.
          </p>
          <p style={{ ...s, fontSize: 16, lineHeight: 1.7, color: t.coal }}>
            HireStepX's AI interviewer asks these questions out loud and lets you answer by voice, the same as the real round, then scores clarity, pace, and structure so you know exactly what to tighten before the interview, as many times as you need, without waiting on a person to listen each time.
          </p>
        </section>

        {/* ── FAQ ── */}
        <section aria-labelledby="bpo-faq" style={{ background: t.creamRaised, padding: "56px 24px" }}>
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            <h2 id="bpo-faq" style={{ ...serif, fontSize: 28, fontWeight: 400, color: t.coal, marginBottom: 36, letterSpacing: "-0.02em" }}>
              BPO interviews: common questions
            </h2>
            <dl style={{ display: "flex", flexDirection: "column", gap: 28 }}>
              {FAQ_ENTRIES.map((item) => (
                <div key={item.q}>
                  <dt style={{ ...s, fontSize: 16, fontWeight: 600, color: t.coal, marginBottom: 8 }}>{item.q}</dt>
                  <dd style={{ ...s, fontSize: 15, color: t.inkSoft, lineHeight: 1.7, margin: 0 }}>{item.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ── Bottom CTA ── */}
        <section style={{ maxWidth: 720, margin: "0 auto", padding: "56px 24px 80px", textAlign: "center" }}>
          <h2 style={{ ...serif, fontSize: 32, fontWeight: 400, color: t.coal, marginBottom: 12, letterSpacing: "-0.02em" }}>
            Rehearse your voice & accent round
          </h2>
          <p style={{ ...s, fontSize: 16, color: t.inkSoft, marginBottom: 32, maxWidth: 480, margin: "0 auto 32px" }}>
            2 complete AI mock interview sessions, free. No credit card, no scheduling: practice speaking clearly before the real call.
          </p>
          <Link
            href="/signup"
            style={{ ...s, background: t.copper, color: "#fff", padding: "15px 36px", borderRadius: 8, fontWeight: 600, fontSize: 16, textDecoration: "none", display: "inline-block" }}
          >
            Practice free, 2 sessions included
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
                { label: "English Speaking Practice for Interviews", href: "/english-interview-practice" },
                { label: "AI Mock Interview Practice", href: "/ai-mock-interview" },
                { label: "Telephonic Interview Questions", href: "/telephonic-interview-questions" },
                { label: "How to Overcome Interview Anxiety", href: "/interview-anxiety" },
                { label: "Walk-in Interview Preparation", href: "/walk-in-interview-preparation" },
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
