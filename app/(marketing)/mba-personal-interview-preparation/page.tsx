import type { Metadata } from "next";
import Link from "next/link";
import { breadcrumb, ldJson } from "@/marketing-v2/_schema";
import { NavV2, MobileStickyCTA } from "@/marketing-v2/HomepageV2";
import { FooterDome } from "@/marketing-v2/FooterDome";
import { tokens as t, fonts } from "@/auth/_tokens";

/*
 * /mba-personal-interview-preparation — pillar page for the MBA
 * admissions Personal Interview (PI) round after CAT/XAT/SNAP, a large,
 * distinct, annual-cycle audience (Oct-Feb admission season) with zero
 * overlap in seo-pages.ts (that tree is job-hiring, not admissions). PI
 * carries 30-50% weightage at many IIMs — high-stakes, high-search-intent
 * traffic, and "Why MBA" / "tell me about yourself" rehearsal is a direct
 * product fit.
 *
 * Target queries:
 *   "mba personal interview preparation"
 *   "cat pi questions"
 *   "why mba interview question"
 *   "mba interview questions and answers"
 *   "gdpi preparation"
 *
 * Schema: Article + FAQPage + BreadcrumbList
 */

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "MBA Personal Interview (PI) Preparation: CAT, XAT, SNAP | HireStepX",
  description:
    "The PI round carries 30-50% weightage at many IIMs. Common MBA personal interview questions, how the panel evaluates you differently from a job interview, and how to practice answering out loud.",
  keywords: [
    "mba personal interview preparation",
    "cat pi questions",
    "why mba interview question",
    "mba interview questions and answers",
    "gdpi preparation",
    "mba pi wat preparation",
  ].join(", "),
  alternates: { canonical: "/mba-personal-interview-preparation" },
  openGraph: {
    type: "article",
    title: "MBA Personal Interview (PI) Preparation: CAT, XAT, SNAP | HireStepX",
    description:
      "Common MBA PI questions, what the panel is actually evaluating, and how to practice answering out loud before the round that decides your admit.",
    url: "https://hirestepx.com/mba-personal-interview-preparation",
    siteName: "HireStepX",
    locale: "en_IN",
    images: [{ url: "https://hirestepx.com/opengraph-image", width: 1200, height: 630, alt: "MBA Personal Interview (PI) Preparation | HireStepX" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "MBA Personal Interview (PI) Preparation | HireStepX",
    description: "Common MBA PI questions and how to practice answering out loud before the round that decides your admit.",
    images: ["https://hirestepx.com/opengraph-image"],
  },
};

const s = { fontFamily: fonts.sans };
const serif = { fontFamily: fonts.serif };

const PANEL_FOCUS = [
  {
    title: "Clarity of thought, not just content",
    desc: "PI panels weigh how you structure and deliver an answer as heavily as the answer itself, since CAT/XAT already tested your aptitude, this round exists specifically to hear you think and speak in real time.",
  },
  {
    title: "Your \"why\" has to hold up under probing",
    desc: "\"Why MBA\" and \"why this campus\" are asked in some form at nearly every PI, and panels routinely follow up two or three times on the same answer to test whether it's genuine or rehearsed-and-shallow.",
  },
  {
    title: "Academics and work experience, cross-examined",
    desc: "Expect specific questions on your graduation subjects, final-year project, or current job responsibilities: vague or generic answers here are the most common reason strong CAT scorers underperform in PI.",
  },
];

const QUESTIONS = [
  { q: "Tell me about yourself.", tip: "Panels hear this dozens of times a day: a generic, resume-recited answer blends in. Lead with something specific that sets up your \"why MBA\" answer." },
  { q: "Why MBA, and why now?", tip: "Have a specific, personal answer ready, not a generic \"career growth\" line: panels probe this one hardest and follow up on vague answers." },
  { q: "Why this specific institute, over others you could apply to?", tip: "Research something concrete about the program (a specialization, a faculty area, an alumni outcome) rather than reciting rankings." },
  { q: "Explain your final-year project or a key work responsibility.", tip: "Be ready to go two or three questions deep on this: panels often use it to test whether you truly understand your own work." },
  { q: "Where do you see yourself in 5 years?", tip: "Tie the answer back to your stated reason for the MBA so the two don't contradict each other under follow-up." },
  { q: "Do you have any questions for the panel?", tip: "Always have one specific to the program ready: asking nothing reads as low genuine interest in a panel setting." },
];

export default async function MbaPersonalInterviewPage() {
  const { headers } = await import("next/headers");
  const nonce = (await headers()).get("x-nonce") ?? "";

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What questions are asked in an MBA personal interview?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "MBA PI questions fall into three buckets: HR/motivational (tell me about yourself, why MBA, why this institute), academic and work-experience questions (your graduation subjects, projects, current job responsibilities), and general awareness. Panels commonly follow up two or three times on the same question to test whether an answer is genuine or rehearsed-and-shallow.",
        },
      },
      {
        "@type": "Question",
        name: "How much weightage does the PI round carry in MBA admissions?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "It varies by institute, but the Personal Interview carries roughly 30-50% weightage of the final admission score at many IIMs, alongside CAT score, academic profile, and Written Ability Test (WAT). Since the exam already screens aptitude, the PI specifically evaluates communication, clarity of thought, and personality.",
        },
      },
      {
        "@type": "Question",
        name: "How do I answer \"Why MBA\" convincingly in a PI?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Give a specific, personal reason tied to your actual background rather than a generic 'career growth' or 'better opportunities' answer: panels hear the generic version constantly and probe it hardest. Be ready for two or three follow-up questions on the same point, since panels are testing whether the reasoning holds up, not just whether you have an answer prepared.",
        },
      },
      {
        "@type": "Question",
        name: "Can I practice for an MBA PI with AI mock interviews?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes, rehearsing your 'why MBA', 'why this institute', and academic/work-experience answers out loud, including handling follow-up questions, builds the real-time clarity a PI panel is evaluating. Most candidates prepare these answers only in writing or silently, so the first time they say them out loud under any pressure is in the actual interview. AI mock interview practice closes that gap with unlimited repetition and follow-up questions.",
        },
      },
    ],
  };

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "MBA Personal Interview (PI) Preparation",
    description:
      "Common MBA PI questions, what the panel is actually evaluating, and how to practice answering out loud before the round that decides your admit.",
    url: "https://hirestepx.com/mba-personal-interview-preparation",
    publisher: { "@type": "Organization", name: "HireStepX", url: "https://hirestepx.com" },
    author: { "@type": "Organization", name: "HireStepX" },
  };

  return (
    <>
      <NavV2 />

      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={ldJson(faqSchema)} />
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={ldJson(articleSchema)} />
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={ldJson(breadcrumb([{ name: "MBA Personal Interview Preparation", path: "/mba-personal-interview-preparation" }]))} />

      <main id="main-content" style={{ ...s, background: t.cream, minHeight: "100vh" }}>

        {/* ── Hero ── */}
        <section aria-labelledby="mba-hero" style={{ maxWidth: 760, margin: "0 auto", padding: "80px 24px 56px", textAlign: "center" }}>
          <p style={{ ...s, fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: t.copper, marginBottom: 20 }}>
            MBA admissions · CAT · XAT · SNAP · India 2026
          </p>
          <h1
            id="mba-hero"
            style={{ ...serif, fontSize: "clamp(36px, 6vw, 64px)", fontWeight: 400, lineHeight: 1.05, letterSpacing: "-0.03em", color: t.coal, margin: "0 0 20px" }}
          >
            MBA Personal<br />
            <span style={{ fontStyle: "italic", color: t.copper }}>Interview Preparation.</span>
          </h1>
          <p style={{ ...s, fontSize: 17, lineHeight: 1.65, color: t.inkSoft, maxWidth: 580, margin: "0 auto 36px" }}>
            The PI round can carry 30-50% weightage of your final admit score. What panels actually probe for, common questions, and how to rehearse "why MBA" until it holds up under follow-up.
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

        {/* ── What the panel evaluates ── */}
        <section aria-labelledby="mba-focus" style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px 64px" }}>
          <h2 id="mba-focus" style={{ ...serif, fontSize: 28, fontWeight: 400, color: t.coal, marginBottom: 16, letterSpacing: "-0.02em" }}>
            What a PI panel is actually evaluating
          </h2>
          <p style={{ ...s, fontSize: 16, lineHeight: 1.7, color: t.coal, marginBottom: 32 }}>
            CAT, XAT, or SNAP already confirmed your aptitude on paper. The PI exists to hear you reason and communicate in real time, which is why candidates with strong scores still underperform here if they've only ever prepared answers in writing.
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
        <section aria-labelledby="mba-questions" style={{ background: t.creamRaised, padding: "56px 24px" }}>
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            <h2 id="mba-questions" style={{ ...serif, fontSize: 28, fontWeight: 400, color: t.coal, marginBottom: 8, letterSpacing: "-0.02em" }}>
              Common MBA personal interview questions
            </h2>
            <p style={{ ...s, fontSize: 15, color: t.inkSoft, marginBottom: 32 }}>
              Expect follow-up questions on nearly every one of these: panels are testing depth, not just recall.
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
        <section aria-labelledby="mba-practice" style={{ maxWidth: 720, margin: "0 auto", padding: "56px 24px" }}>
          <h2 id="mba-practice" style={{ ...serif, fontSize: 28, fontWeight: 400, color: t.coal, marginBottom: 16, letterSpacing: "-0.02em" }}>
            Say "why MBA" out loud before the panel does
          </h2>
          <p style={{ ...s, fontSize: 16, lineHeight: 1.7, color: t.coal, marginBottom: 16 }}>
            Most PI candidates write their "why MBA" answer, review it silently, and never actually say it out loud until the interview, which is exactly when a panel's follow-up question exposes how rehearsed-but-shallow it really was.
          </p>
          <p style={{ ...s, fontSize: 16, lineHeight: 1.7, color: t.coal }}>
            HireStepX's AI interviewer asks your PI questions out loud, follows up in real time the way a panel would, and scores your answers on clarity and structure, so the first time your "why MBA" gets pressure-tested isn't in front of the actual admissions committee.
          </p>
        </section>

        {/* ── FAQ ── */}
        <section aria-labelledby="mba-faq" style={{ background: t.creamRaised, padding: "56px 24px" }}>
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            <h2 id="mba-faq" style={{ ...serif, fontSize: 28, fontWeight: 400, color: t.coal, marginBottom: 36, letterSpacing: "-0.02em" }}>
              MBA personal interviews: common questions
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
            Rehearse your PI answers out loud
          </h2>
          <p style={{ ...s, fontSize: 16, color: t.inkSoft, marginBottom: 32, maxWidth: 480, margin: "0 auto 32px" }}>
            2 complete AI mock interview sessions, free. No credit card, no scheduling: practice before the panel that decides your admit.
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
                { label: "How to Overcome Interview Anxiety", href: "/interview-anxiety" },
                { label: "Bank PO Interview Questions: SBI & IBPS", href: "/bank-po-interview-questions" },
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
