import type { Metadata } from "next";
import Link from "next/link";
import { breadcrumb, ldJson } from "@/marketing-v2/_schema";
import { NavV2, MobileStickyCTA } from "@/marketing-v2/HomepageV2";
import { FooterDome } from "@/marketing-v2/FooterDome";
import { tokens as t, fonts } from "@/auth/_tokens";

/*
 * /walk-in-interview-preparation — pillar page for walk-in interview
 * queries. A distinct context (bulk hiring, no appointment, interview
 * happens same-day as arrival) not covered by any company/focus tuple in
 * data/seo-pages.ts. High volume in IT/BPO fresher hiring specifically.
 *
 * Target queries:
 *   "walk-in interview tips"
 *   "how to prepare for a walk-in interview"
 *   "walk-in interview preparation freshers"
 *   "walk in interview questions india"
 *
 * Schema: Article + FAQPage + BreadcrumbList
 */

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Walk-in Interview Preparation & Tips (India) | HireStepX",
  description:
    "No appointment, no advance notice: the interview happens the moment you're called. How to prepare for a walk-in drive, plus common questions.",
  keywords: [
    "walk-in interview tips",
    "how to prepare for a walk-in interview",
    "walk-in interview preparation freshers",
    "walk in interview questions india",
    "walk-in drive interview preparation",
  ].join(", "),
  alternates: { canonical: "/walk-in-interview-preparation" },
  openGraph: {
    type: "article",
    title: "Walk-in Interview Preparation & Tips (India) | HireStepX",
    description:
      "How to get ready for a walk-in interview drive with almost no notice: what to carry, what to expect, and the questions that come up most.",
    url: "https://hirestepx.com/walk-in-interview-preparation",
    siteName: "HireStepX",
    locale: "en_IN",
    images: [{ url: "https://hirestepx.com/opengraph-image", width: 1200, height: 630, alt: "Walk-in Interview Preparation & Tips | HireStepX" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Walk-in Interview Preparation & Tips | HireStepX",
    description: "How to prepare for a walk-in interview drive with almost no advance notice.",
    images: ["https://hirestepx.com/opengraph-image"],
  },
};

const s = { fontFamily: fonts.sans };
const serif = { fontFamily: fonts.serif };

const PREP_STEPS = [
  {
    title: "Carry documents before you need them",
    desc: "Multiple printed resume copies, ID proof, and any certificates the listing mentions. Walk-in drives move fast, and missing paperwork is the easiest way to lose your slot without ever being interviewed.",
  },
  {
    title: "Research in the queue, not after",
    desc: "You often have 30-60 minutes of waiting before your turn. Use it: read the company's about page, note two things about the role, and skim recent news. This is real prep time most candidates waste scrolling their phone.",
  },
  {
    title: "Rehearse your opening answer specifically",
    desc: "\"Tell me about yourself\" and \"why this company\" come up in nearly every walk-in round, often back to back with other candidates being interviewed the same hour. A rehearsed, confident opening is what separates you fastest.",
  },
  {
    title: "Expect a compressed interview",
    desc: "Walk-in interviews are usually shorter than a scheduled round because recruiters are moving through volume. Concise, complete answers matter more here than in a longer, exploratory interview.",
  },
];

const QUESTIONS = [
  "Tell me about yourself.",
  "Why are you interested in this role / company?",
  "What do you know about us?",
  "What's your expected salary?",
  "When can you join?",
  "Do you have any questions for us?",
];

export default async function WalkInInterviewPage() {
  const { headers } = await import("next/headers");
  const nonce = (await headers()).get("x-nonce") ?? "";

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "How do I prepare for a walk-in interview with no notice?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Focus on what you can control fast: carry printed resume copies and ID proof, rehearse your 'tell me about yourself' answer out loud so it's not being improvised for the first time in the queue, and research the company for the few minutes you'll likely spend waiting. Walk-in rounds reward candidates who show up prepared for a compressed interview, not a long exploratory one.",
        },
      },
      {
        "@type": "Question",
        name: "What questions are usually asked in a walk-in interview?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Walk-in interviews for freshers typically cover: tell me about yourself, why you're interested in the role or company, what you know about the company, expected salary, availability to join, and whether you have questions. The round is usually shorter than a scheduled interview, so concise answers matter more.",
        },
      },
      {
        "@type": "Question",
        name: "What should I carry to a walk-in interview?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Multiple printed copies of your resume, a government ID, and any certificates the job listing specifically mentions. Walk-in drives process candidates in the order they arrive, and missing documents can cost you your slot in the queue.",
        },
      },
      {
        "@type": "Question",
        name: "Can I practice for a walk-in interview in advance if I don't know when it will happen?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes, because walk-in interviews rely on the same core questions across most companies (tell me about yourself, why this role, expected salary, availability), practicing those answers out loud ahead of time pays off regardless of which specific drive you attend. AI mock interview practice lets you rehearse the exact opening questions that decide the first minute of a walk-in round.",
        },
      },
    ],
  };

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Walk-in Interview Preparation & Tips",
    description:
      "How to prepare for a walk-in interview drive with almost no advance notice, plus the questions that come up most.",
    image: "https://hirestepx.com/opengraph-image",
    url: "https://hirestepx.com/walk-in-interview-preparation",
    publisher: { "@type": "Organization", name: "HireStepX", url: "https://hirestepx.com" },
    author: { "@type": "Organization", name: "HireStepX" },
    datePublished: "2026-07-31",
    dateModified: "2026-08-05",
  };

  return (
    <>
      <NavV2 />

      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={ldJson(faqSchema)} />
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={ldJson(articleSchema)} />
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={ldJson(breadcrumb([{ name: "Walk-in Interview Preparation", path: "/walk-in-interview-preparation" }]))} />

      <main id="main-content" style={{ ...s, background: t.cream, minHeight: "100vh" }}>

        {/* ── Hero ── */}
        <section aria-labelledby="wi-hero" style={{ maxWidth: 760, margin: "0 auto", padding: "80px 24px 56px", textAlign: "center" }}>
          <p style={{ ...s, fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: t.copper, marginBottom: 20 }}>
            Walk-in drives · India 2026
          </p>
          <h1
            id="wi-hero"
            style={{ ...serif, fontSize: "clamp(36px, 6vw, 64px)", fontWeight: 400, lineHeight: 1.05, letterSpacing: "-0.03em", color: t.coal, margin: "0 0 20px" }}
          >
            Walk-in Interview<br />
            <span style={{ fontStyle: "italic", color: t.copper }}>Preparation.</span>
          </h1>
          <p style={{ ...s, fontSize: 17, lineHeight: 1.65, color: t.inkSoft, maxWidth: 580, margin: "0 auto 36px" }}>
            No appointment, no scheduled slot: you're interviewed the moment your turn comes. What to carry, how to use the wait, and the questions that decide most walk-in rounds.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link
              href="/signup"
              style={{ ...s, background: t.copper, color: "#fff", padding: "13px 28px", borderRadius: 8, fontWeight: 600, fontSize: 15, textDecoration: "none", display: "inline-block" }}
            >
              Practice free, 2 sessions
            </Link>
            <Link
              href="/ai-mock-interview"
              style={{ ...s, background: "transparent", color: t.coal, padding: "13px 28px", borderRadius: 8, fontWeight: 500, fontSize: 15, textDecoration: "none", border: `1px solid ${t.line}`, display: "inline-block" }}
            >
              How AI mock interviews work
            </Link>
          </div>
        </section>

        {/* ── Prep steps ── */}
        <section aria-labelledby="wi-steps" style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px 64px" }}>
          <h2 id="wi-steps" style={{ ...serif, fontSize: 28, fontWeight: 400, color: t.coal, marginBottom: 16, letterSpacing: "-0.02em" }}>
            How to prepare with almost no notice
          </h2>
          <p style={{ ...s, fontSize: 16, lineHeight: 1.7, color: t.coal, marginBottom: 32 }}>
            Walk-in drives compress an entire hiring process into a single visit. You can't control the queue length, but you can control everything up to the moment you're called in.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {PREP_STEPS.map((c) => (
              <div key={c.title} style={{ background: t.creamRaised, border: `1px solid ${t.line}`, borderRadius: 10, padding: "20px 22px" }}>
                <p style={{ ...s, fontSize: 16, fontWeight: 600, color: t.coal, margin: "0 0 6px" }}>{c.title}</p>
                <p style={{ ...s, fontSize: 15, color: t.inkSoft, margin: 0, lineHeight: 1.6 }}>{c.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Common questions ── */}
        <section aria-labelledby="wi-questions" style={{ background: t.creamRaised, padding: "56px 24px" }}>
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            <h2 id="wi-questions" style={{ ...serif, fontSize: 28, fontWeight: 400, color: t.coal, marginBottom: 8, letterSpacing: "-0.02em" }}>
              Questions that come up most in walk-in rounds
            </h2>
            <p style={{ ...s, fontSize: 15, color: t.inkSoft, marginBottom: 32 }}>
              Walk-in interviews are usually shorter than scheduled ones: these six decide most of them.
            </p>
            <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 16 }}>
              {QUESTIONS.map((q, i) => (
                <li key={q} style={{ display: "flex", gap: 16, alignItems: "center" }}>
                  <span style={{ ...s, background: t.copper, color: "#fff", borderRadius: "50%", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                    {i + 1}
                  </span>
                  <p style={{ ...s, fontSize: 16, color: t.coal, margin: 0 }}>{q}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Practice angle ── */}
        <section aria-labelledby="wi-practice" style={{ maxWidth: 720, margin: "0 auto", padding: "56px 24px" }}>
          <h2 id="wi-practice" style={{ ...serif, fontSize: 28, fontWeight: 400, color: t.coal, marginBottom: 16, letterSpacing: "-0.02em" }}>
            The prep you can do before you even know the date
          </h2>
          <p style={{ ...s, fontSize: 16, lineHeight: 1.7, color: t.coal, marginBottom: 16 }}>
            Because most walk-in interviews lean on the same handful of opening questions across companies, rehearsing them out loud in advance pays off regardless of which drive you end up attending, even one you only heard about that morning.
          </p>
          <p style={{ ...s, fontSize: 16, lineHeight: 1.7, color: t.coal }}>
            HireStepX's AI interviewer runs full mock sessions on the exact opening questions (tell me about yourself, why this role, expected salary) with follow-up questions in real time, so your answers are rehearsed and confident before you're ever called in.
          </p>
        </section>

        {/* ── FAQ ── */}
        <section aria-labelledby="wi-faq" style={{ background: t.creamRaised, padding: "56px 24px" }}>
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            <h2 id="wi-faq" style={{ ...serif, fontSize: 28, fontWeight: 400, color: t.coal, marginBottom: 36, letterSpacing: "-0.02em" }}>
              Walk-in interviews: common questions
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
            Rehearse the questions before the drive
          </h2>
          <p style={{ ...s, fontSize: 16, color: t.inkSoft, marginBottom: 32, maxWidth: 480, margin: "0 auto 32px" }}>
            2 complete AI mock interview sessions, free. No credit card, no scheduling: practice the night before, or the morning of.
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
                { label: "AI Mock Interview Practice", href: "/ai-mock-interview" },
                { label: "Telephonic Interview Questions", href: "/telephonic-interview-questions" },
                { label: "How to Overcome Interview Anxiety", href: "/interview-anxiety" },
                { label: "Interview Preparation Guide India 2026", href: "/interview-prep" },
                { label: "Campus Placement Preparation Guide", href: "/for-students" },
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
