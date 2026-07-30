import type { Metadata } from "next";
import Link from "next/link";
import { breadcrumb, ldJson } from "@/marketing-v2/_schema";
import { NavV2, MobileStickyCTA } from "@/marketing-v2/HomepageV2";
import { FooterDome } from "@/marketing-v2/FooterDome";
import { tokens as t, fonts } from "@/auth/_tokens";

/*
 * /telephonic-interview-questions — pillar page for the phone-screening
 * round, a distinct interview format not covered by any company/focus
 * tuple in data/seo-pages.ts (those target behavioral/technical/hr content,
 * not modality). No visuals, no body language, no follow-up cues from the
 * interviewer's face — voice-only practice is a direct product fit.
 *
 * Target queries:
 *   "telephonic interview questions"
 *   "phone interview tips india"
 *   "telephonic round hr questions"
 *   "how to prepare for a telephonic interview"
 *   "phone screening interview questions india"
 *
 * Schema: Article + FAQPage + BreadcrumbList
 */

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Telephonic Interview Questions & Prep Tips (India) | HireStepX",
  description:
    "The telephonic round has no face, no body language, no screen — just your voice. Common telephonic interview questions, what recruiters actually screen for, and how to practice the format before the call.",
  keywords: [
    "telephonic interview questions",
    "phone interview tips india",
    "telephonic round hr questions",
    "how to prepare for a telephonic interview",
    "phone screening interview questions india",
    "telephonic interview preparation",
  ].join(", "),
  alternates: { canonical: "/telephonic-interview-questions" },
  openGraph: {
    type: "article",
    title: "Telephonic Interview Questions & Prep Tips (India) | HireStepX",
    description:
      "What recruiters screen for on a phone round, common telephonic interview questions, and how voice-only practice prepares you better than reading a script.",
    url: "https://hirestepx.com/telephonic-interview-questions",
    siteName: "HireStepX",
    locale: "en_IN",
    images: [{ url: "https://hirestepx.com/opengraph-image", width: 1200, height: 630, alt: "Telephonic Interview Questions & Prep Tips | HireStepX" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Telephonic Interview Questions & Prep Tips | HireStepX",
    description: "Common telephonic round questions and how to practice the format before the real call.",
    images: ["https://hirestepx.com/opengraph-image"],
  },
};

const s = { fontFamily: fonts.sans };
const serif = { fontFamily: fonts.serif };

const CHALLENGES = [
  {
    title: "No face, no body language",
    desc: "In person, a nod or a smile buys you a second to think. On a call, silence just sounds like silence. Recruiters read hesitation differently when there's no visual context to soften it.",
  },
  {
    title: "It's screening, not deciding",
    desc: "A telephonic round is usually 10-20 minutes to confirm basic fit — role understanding, notice period, salary expectations, communication clarity — before anyone invests time in a video or in-person round. Short, sharp answers matter more here than depth.",
  },
  {
    title: "Your voice is the entire signal",
    desc: "Tone, pace, and clarity carry all the weight a recruiter would otherwise get from posture and eye contact. A rushed or monotone answer reads as nervousness or disinterest, even if the content is strong.",
  },
];

const QUESTIONS = [
  { q: "Tell me about yourself.", tip: "Keep it to 60-90 seconds on a call — recruiters have several of these back to back and reward brevity here more than in a video round." },
  { q: "Why are you looking to change / why this role?", tip: "Have one clean reason ready. Rambling reads worse on audio than it would on video, where your expression could still signal confidence." },
  { q: "What's your current notice period?", tip: "Know this number exactly. A vague answer on a screening call is an easy reason to deprioritize you." },
  { q: "What are your salary expectations?", tip: "Have a range ready before the call, not mid-sentence. Fumbling a number on a phone screen sounds worse than it looks in person." },
  { q: "Walk me through your resume.", tip: "Practice saying your own timeline out loud — most candidates have never actually said it in one continuous pass before the call." },
  { q: "Are you open to relocation / this location?", tip: "A firm, immediate answer here matters more than the reasoning behind it on a short screening call." },
];

export default async function TelephonicInterviewPage() {
  const { headers } = await import("next/headers");
  const nonce = (await headers()).get("x-nonce") ?? "";

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What questions are asked in a telephonic interview?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Telephonic rounds are usually a quick screen: tell me about yourself, why you're looking to change roles, your current notice period, salary expectations, and a walkthrough of your resume. The goal is confirming basic fit fast, not evaluating depth — so short, clear answers matter more than they would in a later round.",
        },
      },
      {
        "@type": "Question",
        name: "How long does a telephonic interview usually last?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Most telephonic screening rounds run 10 to 20 minutes. Recruiters are moving through a shortlist and are listening for basic communication clarity and fit, not a full evaluation — that comes in the video or in-person round that follows.",
        },
      },
      {
        "@type": "Question",
        name: "How is a telephonic interview different from a video interview?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "There's no body language, no face, no visual reassurance — your tone, pace, and clarity carry the entire impression. Pauses that would read as thoughtful on video can read as hesitation on a call. Practicing answers out loud, without relying on a screen or notes in front of the interviewer, closes that gap.",
        },
      },
      {
        "@type": "Question",
        name: "Can I practice for a telephonic interview with AI?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes — voice-only AI mock interviews are a close match for the telephonic format specifically, since there's no camera in either case. Practicing your notice-period, salary, and 'tell me about yourself' answers out loud, at the pace and length a screening call actually rewards, is more useful preparation than reading through a question list silently.",
        },
      },
    ],
  };

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Telephonic Interview Questions & Prep Tips",
    description:
      "Common telephonic round questions, what recruiters actually screen for, and how to practice the voice-only format before the real call.",
    url: "https://hirestepx.com/telephonic-interview-questions",
    publisher: { "@type": "Organization", name: "HireStepX", url: "https://hirestepx.com" },
    author: { "@type": "Organization", name: "HireStepX" },
  };

  return (
    <>
      <NavV2 />

      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={ldJson(faqSchema)} />
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={ldJson(articleSchema)} />
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={ldJson(breadcrumb([{ name: "Telephonic Interview Questions", path: "/telephonic-interview-questions" }]))} />

      <main id="main-content" style={{ ...s, background: t.cream, minHeight: "100vh" }}>

        {/* ── Hero ── */}
        <section aria-labelledby="ti-hero" style={{ maxWidth: 760, margin: "0 auto", padding: "80px 24px 56px", textAlign: "center" }}>
          <p style={{ ...s, fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: t.copper, marginBottom: 20 }}>
            Telephonic round · India 2026
          </p>
          <h1
            id="ti-hero"
            style={{ ...serif, fontSize: "clamp(36px, 6vw, 64px)", fontWeight: 400, lineHeight: 1.05, letterSpacing: "-0.03em", color: t.coal, margin: "0 0 20px" }}
          >
            Telephonic Interview<br />
            <span style={{ fontStyle: "italic", color: t.copper }}>Questions & Prep.</span>
          </h1>
          <p style={{ ...s, fontSize: 17, lineHeight: 1.65, color: t.inkSoft, maxWidth: 580, margin: "0 auto 36px" }}>
            No face, no screen, no body language — just your voice and 15 minutes to prove you're worth a second round. Here's what recruiters actually ask, and how to prepare for a format most candidates never rehearse out loud.
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

        {/* ── Why it's different ── */}
        <section aria-labelledby="ti-why" style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px 64px" }}>
          <h2 id="ti-why" style={{ ...serif, fontSize: 28, fontWeight: 400, color: t.coal, marginBottom: 16, letterSpacing: "-0.02em" }}>
            Why the telephonic round catches candidates off guard
          </h2>
          <p style={{ ...s, fontSize: 16, lineHeight: 1.7, color: t.coal, marginBottom: 32 }}>
            Most interview prep assumes a face-to-face or video setting. A phone screen strips that away — and candidates who prepare answers silently, in their head, are usually saying them out loud for the very first time when the recruiter calls.
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

        {/* ── Common questions ── */}
        <section aria-labelledby="ti-questions" style={{ background: t.creamRaised, padding: "56px 24px" }}>
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            <h2 id="ti-questions" style={{ ...serif, fontSize: 28, fontWeight: 400, color: t.coal, marginBottom: 8, letterSpacing: "-0.02em" }}>
              Common telephonic interview questions
            </h2>
            <p style={{ ...s, fontSize: 15, color: t.inkSoft, marginBottom: 32 }}>
              The screening round rewards short, clear answers over depth — save the detail for the round that follows.
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
        <section aria-labelledby="ti-practice" style={{ maxWidth: 720, margin: "0 auto", padding: "56px 24px" }}>
          <h2 id="ti-practice" style={{ ...serif, fontSize: 28, fontWeight: 400, color: t.coal, marginBottom: 16, letterSpacing: "-0.02em" }}>
            Practice the format, not just the answers
          </h2>
          <p style={{ ...s, fontSize: 16, lineHeight: 1.7, color: t.coal, marginBottom: 16 }}>
            Reading through a list of telephonic questions doesn't train what a phone screen actually tests: saying your notice period, salary range, and resume walkthrough out loud, at a pace that sounds confident with zero visual cues to lean on.
          </p>
          <p style={{ ...s, fontSize: 16, lineHeight: 1.7, color: t.coal }}>
            HireStepX's AI interviewer is voice-only, the same as a real telephonic round — no camera, no visual prompts. It asks the questions, follows up in real time, and scores your answers on clarity and length so you know exactly how you'd sound on the actual call.
          </p>
        </section>

        {/* ── FAQ ── */}
        <section aria-labelledby="ti-faq" style={{ background: t.creamRaised, padding: "56px 24px" }}>
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            <h2 id="ti-faq" style={{ ...serif, fontSize: 28, fontWeight: 400, color: t.coal, marginBottom: 36, letterSpacing: "-0.02em" }}>
              Telephonic interviews — common questions
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
            Rehearse your telephonic answers out loud
          </h2>
          <p style={{ ...s, fontSize: 16, color: t.inkSoft, marginBottom: 32, maxWidth: 480, margin: "0 auto 32px" }}>
            2 complete voice-only AI mock interview sessions, free. No credit card, no scheduling — practice before the recruiter calls.
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
                { label: "English Speaking Practice for Interviews", href: "/english-interview-practice" },
                { label: "BPO Interview Questions & Answers", href: "/bpo-interview-questions" },
                { label: "Interview Preparation Guide India 2026", href: "/interview-prep" },
                { label: "STAR Method Guide India", href: "/blog/star-method-interview-answers-india" },
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
