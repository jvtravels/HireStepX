import type { Metadata } from "next";
import Link from "next/link";
import { breadcrumb, ldJson } from "@/marketing-v2/_schema";
import { NavV2, MobileStickyCTA } from "@/marketing-v2/HomepageV2";
import { FooterDome } from "@/marketing-v2/FooterDome";
import { tokens as t, fonts } from "@/auth/_tokens";

/*
 * /interview-anxiety — pillar page for interview nervousness/anxiety
 * queries. Zero AI-mock-interview competitors surface for this term today
 * (owned by generic career-advice sites: Indeed, ChoosingTherapy) — this
 * page exists to both rank on its own and funnel into the product, since
 * repeated low-stakes practice is a genuine, product-native answer to the
 * "how do I stop being nervous" question that pure-advice content can't offer.
 *
 * Target queries:
 *   "interview anxiety"
 *   "how to overcome interview anxiety"
 *   "nervous before interview"
 *   "interview confidence tips India"
 *   "scared of interviews"
 *
 * Schema: Article + FAQPage + BreadcrumbList
 */

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "How to Overcome Interview Anxiety — Practice-Based Tips | HireStepX",
  description:
    "Interview nerves come from facing the unknown too few times. Practical techniques to calm interview anxiety, plus how repeated AI mock interview practice builds real confidence before the day that counts.",
  keywords: [
    "interview anxiety",
    "how to overcome interview anxiety",
    "nervous before interview",
    "interview confidence tips india",
    "scared of interviews",
    "interview nervousness tips",
    "how to stop being nervous in interview",
  ].join(", "),
  alternates: { canonical: "/interview-anxiety" },
  openGraph: {
    type: "article",
    title: "How to Overcome Interview Anxiety — Practice-Based Tips | HireStepX",
    description:
      "Why interview anxiety happens, techniques that actually reduce it, and how repeated AI mock interview practice builds real confidence before the real one.",
    url: "https://hirestepx.com/interview-anxiety",
    siteName: "HireStepX",
    locale: "en_IN",
    images: [{ url: "https://hirestepx.com/opengraph-image", width: 1200, height: 630, alt: "How to Overcome Interview Anxiety | HireStepX" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "How to Overcome Interview Anxiety | HireStepX",
    description: "Why interview nerves happen, and the practice-based techniques that actually reduce them.",
    images: ["https://hirestepx.com/opengraph-image"],
  },
};

const s = { fontFamily: fonts.sans };
const serif = { fontFamily: fonts.serif };

const CAUSES = [
  {
    title: "The format is unfamiliar",
    desc: "Most candidates last spoke under interview conditions months or years ago. Your brain treats an unfamiliar, evaluative situation as a threat — that's the biology behind the racing heart, not a character flaw.",
  },
  {
    title: "The stakes feel binary",
    desc: "One conversation deciding an offer or a rejection raises the perceived cost of any single mistake, which raises anxiety proportionally. Interviewers actually forgive far more than candidates assume.",
  },
  {
    title: "You don't know what's coming",
    desc: "Uncertainty is the single biggest driver of interview anxiety. Not knowing the next question, the interviewer's tone, or how long you'll be expected to talk keeps your nervous system on alert the whole time.",
  },
];

const TECHNIQUES = [
  {
    title: "Rehearse out loud, not in your head",
    desc: "Silently reviewing your STAR stories feels like preparation but doesn't train the actual skill: speaking fluently under mild pressure. Say your answers out loud, every time — to a mirror, a friend, or an AI interviewer.",
  },
  {
    title: "Slow your breathing before you start",
    desc: "Four seconds in, hold for two, six seconds out. Repeat for a minute before the call connects. This lowers heart rate directly and takes the edge off the first, hardest question.",
  },
  {
    title: "Prepare the opening answer word-for-word",
    desc: "\"Tell me about yourself\" is asked in some form in nearly every interview. Having this one answer fully rehearsed removes the worst of the early-interview adrenaline spike, because you're not improvising while still nervous.",
  },
  {
    title: "Normalize the follow-up question",
    desc: "A follow-up isn't a sign you got it wrong — interviewers probe good answers too. Expecting it in advance stops it from reading as a warning sign mid-interview.",
  },
  {
    title: "Practice at the volume that removes surprise",
    desc: "Anxiety fades with exposure, not willpower. Ten real practice rounds against unpredictable questions do more for calm than any single relaxation technique, because uncertainty — the actual driver — goes down with repetition.",
  },
];

export default async function InterviewAnxietyPage() {
  const { headers } = await import("next/headers");
  const nonce = (await headers()).get("x-nonce") ?? "";

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Why do I get so nervous before interviews?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Interview anxiety is your nervous system responding to three things at once: an unfamiliar format, high perceived stakes, and genuine uncertainty about what's coming next. It is a normal physiological response, not a sign you are unprepared or unsuited for the role. The uncertainty component is the one most within your control — it drops sharply with repeated, realistic practice.",
        },
      },
      {
        "@type": "Question",
        name: "How can I calm my nerves right before an interview?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Slow, deliberate breathing (4 seconds in, hold 2, 6 seconds out) for a minute beforehand lowers heart rate directly. Having your opening 'tell me about yourself' answer fully rehearsed removes the hardest, most improvised moment of the interview. Arriving 10 minutes early rather than rushing in also measurably reduces pre-interview cortisol.",
        },
      },
      {
        "@type": "Question",
        name: "Does mock interview practice actually reduce anxiety?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes — anxiety driven by uncertainty fades with exposure. Practicing out loud against realistic, unpredictable questions repeatedly is what actually lowers the uncertainty component of interview anxiety, unlike silently reviewing notes. AI mock interviews let you get that repetition — including live follow-up questions — without scheduling a person each time, at 2am the night before if needed.",
        },
      },
      {
        "@type": "Question",
        name: "Is it normal to blank out during an interview?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes, and it happens most often on questions you haven't said out loud before. It's rarely about not knowing the answer — it's the gap between having an idea and having rehearsed saying it under pressure. Practicing your key stories out loud in advance, several times, closes that gap.",
        },
      },
      {
        "@type": "Question",
        name: "How many mock interviews should I do before a real one?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "There's no fixed number, but the anxiety-reduction effect compounds with repetition — most candidates notice a real drop in nervousness by their third or fourth full practice session, particularly once they've been asked unexpected follow-up questions and recovered from them at least once.",
        },
      },
    ],
  };

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "How to Overcome Interview Anxiety",
    description:
      "Why interview anxiety happens, techniques that reduce it, and how repeated practice builds real confidence before the interview that counts.",
    url: "https://hirestepx.com/interview-anxiety",
    publisher: { "@type": "Organization", name: "HireStepX", url: "https://hirestepx.com" },
    author: { "@type": "Organization", name: "HireStepX" },
  };

  return (
    <>
      <NavV2 />

      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={ldJson(faqSchema)} />
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={ldJson(articleSchema)} />
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={ldJson(breadcrumb([{ name: "Interview Anxiety", path: "/interview-anxiety" }]))} />

      <main id="main-content" style={{ ...s, background: t.cream, minHeight: "100vh" }}>

        {/* ── Hero ── */}
        <section aria-labelledby="ia-hero" style={{ maxWidth: 760, margin: "0 auto", padding: "80px 24px 56px", textAlign: "center" }}>
          <p style={{ ...s, fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: t.copper, marginBottom: 20 }}>
            Interview confidence · India 2026
          </p>
          <h1
            id="ia-hero"
            style={{ ...serif, fontSize: "clamp(36px, 6vw, 64px)", fontWeight: 400, lineHeight: 1.05, letterSpacing: "-0.03em", color: t.coal, margin: "0 0 20px" }}
          >
            How to Overcome<br />
            <span style={{ fontStyle: "italic", color: t.copper }}>Interview Anxiety.</span>
          </h1>
          <p style={{ ...s, fontSize: 17, lineHeight: 1.65, color: t.inkSoft, maxWidth: 580, margin: "0 auto 36px" }}>
            Interview nerves come from uncertainty, not incompetence. Here's why it happens, the techniques that actually help, and how practice closes the gap that willpower can't.
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

        {/* ── Why it happens ── */}
        <section aria-labelledby="ia-why" style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px 64px" }}>
          <h2 id="ia-why" style={{ ...serif, fontSize: 28, fontWeight: 400, color: t.coal, marginBottom: 16, letterSpacing: "-0.02em" }}>
            Why interview anxiety happens
          </h2>
          <p style={{ ...s, fontSize: 16, lineHeight: 1.7, color: t.coal, marginBottom: 32 }}>
            Interview anxiety isn't a sign you're underprepared on paper — it's your nervous system reacting to an unfamiliar, high-stakes, uncertain situation. Understanding the three drivers makes them easier to address individually.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {CAUSES.map((c) => (
              <div key={c.title} style={{ background: t.creamRaised, border: `1px solid ${t.line}`, borderRadius: 10, padding: "20px 22px" }}>
                <p style={{ ...s, fontSize: 16, fontWeight: 600, color: t.coal, margin: "0 0 6px" }}>{c.title}</p>
                <p style={{ ...s, fontSize: 15, color: t.inkSoft, margin: 0, lineHeight: 1.6 }}>{c.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Techniques ── */}
        <section aria-labelledby="ia-tech" style={{ background: t.creamRaised, padding: "56px 24px" }}>
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            <h2 id="ia-tech" style={{ ...serif, fontSize: 28, fontWeight: 400, color: t.coal, marginBottom: 8, letterSpacing: "-0.02em" }}>
              Techniques that actually reduce interview anxiety
            </h2>
            <p style={{ ...s, fontSize: 15, color: t.inkSoft, marginBottom: 32 }}>
              In order of impact — the last one does the most, but it's also the one candidates skip.
            </p>
            <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 24 }}>
              {TECHNIQUES.map((item, i) => (
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
        <section aria-labelledby="ia-practice" style={{ maxWidth: 720, margin: "0 auto", padding: "56px 24px" }}>
          <h2 id="ia-practice" style={{ ...serif, fontSize: 28, fontWeight: 400, color: t.coal, marginBottom: 16, letterSpacing: "-0.02em" }}>
            Why practice beats willpower
          </h2>
          <p style={{ ...s, fontSize: 16, lineHeight: 1.7, color: t.coal, marginBottom: 16 }}>
            Breathing exercises and reframing help in the moment, but the underlying driver — not knowing what's coming — only goes down with repetition. Every mock interview you do out loud, especially one with unpredictable follow-up questions, is a rehearsal for the uncertainty itself, not just the content.
          </p>
          <p style={{ ...s, fontSize: 16, lineHeight: 1.7, color: t.coal }}>
            HireStepX's AI interviewer asks company-specific questions by voice and follows up in real time, the way a real interviewer would — so you can get that repetition at 2am before tomorrow's interview, without scheduling a person or feeling judged for stumbling. Each session ends with a scored report so you can see the anxiety-driving gaps (long pauses, filler words, incomplete answers) shrink session over session.
          </p>
        </section>

        {/* ── FAQ ── */}
        <section aria-labelledby="ia-faq" style={{ background: t.creamRaised, padding: "56px 24px" }}>
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            <h2 id="ia-faq" style={{ ...serif, fontSize: 28, fontWeight: 400, color: t.coal, marginBottom: 36, letterSpacing: "-0.02em" }}>
              Interview anxiety — common questions
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
            Build confidence with real practice
          </h2>
          <p style={{ ...s, fontSize: 16, color: t.inkSoft, marginBottom: 32, maxWidth: 480, margin: "0 auto 32px" }}>
            2 complete AI mock interview sessions, free. No credit card, no scheduling — practice the moment the nerves show up.
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
                { label: "English Speaking Practice for Interviews", href: "/english-interview-practice" },
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
