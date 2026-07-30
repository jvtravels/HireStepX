import type { Metadata } from "next";
import Link from "next/link";
import { breadcrumb, ldJson } from "@/marketing-v2/_schema";
import { NavV2, MobileStickyCTA } from "@/marketing-v2/HomepageV2";
import { FooterDome } from "@/marketing-v2/FooterDome";
import { tokens as t, fonts } from "@/auth/_tokens";

/*
 * /bank-po-interview-questions — pillar page for the bank PO / government
 * banking exam interview vertical (SBI, IBPS PO/Clerk). A large, distinct
 * audience from the corporate/tech roles in seo-pages.ts: a personality
 * + banking-awareness interview that's the final stage after prelims and
 * mains, not a resume-screening conversation. Zero overlap with existing
 * company pages (those cover corporate hiring, not competitive banking
 * exams).
 *
 * Target queries:
 *   "bank po interview questions"
 *   "sbi po interview questions"
 *   "ibps po interview preparation"
 *   "bank interview questions and answers india"
 *   "banking awareness interview questions"
 *
 * Schema: Article + FAQPage + BreadcrumbList
 */

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Bank PO Interview Questions — SBI & IBPS Prep (India) | HireStepX",
  description:
    "The bank PO interview is a personality and banking-awareness round, not a resume screen. Common SBI and IBPS PO interview questions, what the panel evaluates, and how to practice answering out loud.",
  keywords: [
    "bank po interview questions",
    "sbi po interview questions",
    "ibps po interview preparation",
    "bank interview questions and answers india",
    "banking awareness interview questions",
    "bank po interview preparation",
  ].join(", "),
  alternates: { canonical: "/bank-po-interview-questions" },
  openGraph: {
    type: "article",
    title: "Bank PO Interview Questions — SBI & IBPS Prep (India) | HireStepX",
    description:
      "Common SBI and IBPS PO interview questions, what the panel evaluates, and how to practice answering out loud before the final round.",
    url: "https://hirestepx.com/bank-po-interview-questions",
    siteName: "HireStepX",
    locale: "en_IN",
    images: [{ url: "https://hirestepx.com/opengraph-image", width: 1200, height: 630, alt: "Bank PO Interview Questions — SBI & IBPS Prep | HireStepX" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Bank PO Interview Questions — SBI & IBPS Prep | HireStepX",
    description: "Common bank PO interview questions and how to practice the final panel round.",
    images: ["https://hirestepx.com/opengraph-image"],
  },
};

const s = { fontFamily: fonts.sans };
const serif = { fontFamily: fonts.serif };

const PANEL_FOCUS = [
  {
    title: "Personality and communication",
    desc: "The panel is assessing composure, clarity, and how you carry yourself under a multi-member interview — this round exists specifically because the written exam already tested your knowledge.",
  },
  {
    title: "Banking and financial awareness",
    desc: "Expect direct questions on current repo rate, monetary policy basics, types of accounts, NPA, and recent banking-sector news. Depth matters less than being current and able to explain a concept simply.",
  },
  {
    title: "Role and career motivation",
    desc: "Why banking, why this specific bank, and how you see a PO role day-to-day. Generic answers are the most common reason otherwise-strong candidates score low here.",
  },
];

const QUESTIONS = [
  { q: "Tell us about yourself.", tip: "For a panel of 3-5 people, keep this structured and under 2 minutes — rambling reads as poor communication skill, which is explicitly part of what's being scored." },
  { q: "Why do you want to join the banking sector?", tip: "Avoid \"stability\" as your only reason — panels hear it constantly. Tie it to something specific about the work itself." },
  { q: "What is the current repo rate, and what does it mean?", tip: "Know the current number before the interview and be able to explain the concept in one or two plain sentences, not a textbook definition." },
  { q: "What are the key responsibilities of a Probationary Officer?", tip: "Research this specifically — customer service, credit appraisal, and branch operations exposure — rather than guessing generically." },
  { q: "Describe a situation where you handled pressure or a difficult decision.", tip: "Use a real, specific example. Panels probe vague answers here more than almost any other question." },
  { q: "Do you have any questions for us?", tip: "Always have one ready — asking nothing reads as low genuine interest in a multi-member panel setting." },
];

export default async function BankPoInterviewPage() {
  const { headers } = await import("next/headers");
  const nonce = (await headers()).get("x-nonce") ?? "";

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What questions are asked in a bank PO interview?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Bank PO interviews (SBI, IBPS) typically cover personal and motivational questions (tell us about yourself, why banking), banking and financial awareness (repo rate, monetary policy, types of accounts, recent banking news), and role-specific questions about a Probationary Officer's day-to-day responsibilities. It's a panel interview, usually the final stage after prelims and mains.",
        },
      },
      {
        "@type": "Question",
        name: "How is a bank PO interview different from a corporate interview?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "It's conducted by a multi-member panel rather than one or two interviewers, and it combines personality assessment with domain knowledge (banking and financial awareness) rather than focusing on resume or work experience. Since the written exam already screened your aptitude, the interview weighs communication, composure, and current banking knowledge more heavily.",
        },
      },
      {
        "@type": "Question",
        name: "How should I prepare banking awareness for the PO interview?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Focus on current figures (repo rate, key policy rates), core concepts (types of accounts, NPA, monetary policy) explained simply, and recent banking-sector news from the weeks before your interview. Panels reward being current and able to explain a concept in plain language over memorized definitions.",
        },
      },
      {
        "@type": "Question",
        name: "Can I practice for a bank PO panel interview with AI?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes — rehearsing your motivational and personality-round answers out loud (tell us about yourself, why banking, handling pressure) builds the composure a panel is directly evaluating, since most candidates have only reviewed these silently. AI mock interview practice lets you say your answers out loud and get a scored read on clarity and structure before facing a real multi-member panel.",
        },
      },
    ],
  };

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Bank PO Interview Questions — SBI & IBPS Prep",
    description:
      "Common SBI and IBPS PO interview questions, what the panel evaluates, and how to practice answering out loud before the final round.",
    url: "https://hirestepx.com/bank-po-interview-questions",
    publisher: { "@type": "Organization", name: "HireStepX", url: "https://hirestepx.com" },
    author: { "@type": "Organization", name: "HireStepX" },
  };

  return (
    <>
      <NavV2 />

      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={ldJson(faqSchema)} />
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={ldJson(articleSchema)} />
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={ldJson(breadcrumb([{ name: "Bank PO Interview Questions", path: "/bank-po-interview-questions" }]))} />

      <main id="main-content" style={{ ...s, background: t.cream, minHeight: "100vh" }}>

        {/* ── Hero ── */}
        <section aria-labelledby="bpi-hero" style={{ maxWidth: 760, margin: "0 auto", padding: "80px 24px 56px", textAlign: "center" }}>
          <p style={{ ...s, fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: t.copper, marginBottom: 20 }}>
            Bank PO interviews · SBI & IBPS · India 2026
          </p>
          <h1
            id="bpi-hero"
            style={{ ...serif, fontSize: "clamp(36px, 6vw, 64px)", fontWeight: 400, lineHeight: 1.05, letterSpacing: "-0.03em", color: t.coal, margin: "0 0 20px" }}
          >
            Bank PO Interview<br />
            <span style={{ fontStyle: "italic", color: t.copper }}>Questions & Prep.</span>
          </h1>
          <p style={{ ...s, fontSize: 17, lineHeight: 1.65, color: t.inkSoft, maxWidth: 580, margin: "0 auto 36px" }}>
            The final panel round after prelims and mains — personality, banking awareness, and role motivation. What SBI and IBPS panels actually evaluate, and how to prepare answers you can say out loud with confidence.
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

        {/* ── What the panel evaluates ── */}
        <section aria-labelledby="bpi-focus" style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px 64px" }}>
          <h2 id="bpi-focus" style={{ ...serif, fontSize: 28, fontWeight: 400, color: t.coal, marginBottom: 16, letterSpacing: "-0.02em" }}>
            What the interview panel actually evaluates
          </h2>
          <p style={{ ...s, fontSize: 16, lineHeight: 1.7, color: t.coal, marginBottom: 32 }}>
            By the time you reach the interview, the written exam has already confirmed your aptitude. This round tests three different things — and candidates who prepare only banking facts, and never rehearse the personality questions out loud, are the ones who underperform relative to their written score.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {PANEL_FOCUS.map((c) => (
              <div key={c.title} style={{ background: t.creamRaised, border: `1px solid ${t.line}`, borderRadius: 10, padding: "20px 22px" }}>
                <p style={{ ...s, fontSize: 16, fontWeight: 600, color: t.coal, margin: "0 0 6px" }}>{c.title}</p>
                <p style={{ ...s, fontSize: 15, color: t.inkSoft, margin: 0, lineHeight: 1.6 }}>{c.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Common questions ── */}
        <section aria-labelledby="bpi-questions" style={{ background: t.creamRaised, padding: "56px 24px" }}>
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            <h2 id="bpi-questions" style={{ ...serif, fontSize: 28, fontWeight: 400, color: t.coal, marginBottom: 8, letterSpacing: "-0.02em" }}>
              Common bank PO interview questions
            </h2>
            <p style={{ ...s, fontSize: 15, color: t.inkSoft, marginBottom: 32 }}>
              A mix of personality, motivation, and banking-awareness questions — panels move through all three in one sitting.
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
        <section aria-labelledby="bpi-practice" style={{ maxWidth: 720, margin: "0 auto", padding: "56px 24px" }}>
          <h2 id="bpi-practice" style={{ ...serif, fontSize: 28, fontWeight: 400, color: t.coal, marginBottom: 16, letterSpacing: "-0.02em" }}>
            Rehearse the personality round, not just the facts
          </h2>
          <p style={{ ...s, fontSize: 16, lineHeight: 1.7, color: t.coal, marginBottom: 16 }}>
            Most bank PO candidates over-index on memorizing banking awareness and under-practice saying their motivational answers out loud — which is exactly the part a multi-member panel is scoring hardest for composure and clarity.
          </p>
          <p style={{ ...s, fontSize: 16, lineHeight: 1.7, color: t.coal }}>
            HireStepX's AI interviewer asks the same personality and motivation questions a bank PO panel would, follows up in real time, and scores your answers on structure and clarity — so your first time saying "why banking" out loud isn't in front of the actual panel.
          </p>
        </section>

        {/* ── FAQ ── */}
        <section aria-labelledby="bpi-faq" style={{ background: t.creamRaised, padding: "56px 24px" }}>
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            <h2 id="bpi-faq" style={{ ...serif, fontSize: 28, fontWeight: 400, color: t.coal, marginBottom: 36, letterSpacing: "-0.02em" }}>
              Bank PO interviews — common questions
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
            Practice your panel round out loud
          </h2>
          <p style={{ ...s, fontSize: 16, color: t.inkSoft, marginBottom: 32, maxWidth: 480, margin: "0 auto 32px" }}>
            2 complete AI mock interview sessions, free. No credit card, no scheduling — practice before the SBI or IBPS panel.
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
                { label: "Walk-in Interview Preparation", href: "/walk-in-interview-preparation" },
                { label: "Interview Preparation Guide India 2026", href: "/interview-prep" },
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
