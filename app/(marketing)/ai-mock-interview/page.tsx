import type { Metadata } from "next";
import Link from "next/link";
import { breadcrumb, ldJson } from "@/marketing-v2/_schema";
import { NavV2, MobileStickyCTA } from "@/marketing-v2/HomepageV2";
import { FooterDome } from "@/marketing-v2/FooterDome";
import { tokens as t, fonts } from "@/auth/_tokens";

/*
 * /ai-mock-interview — dedicated landing page for the highest-volume
 * non-branded keyword (1,700+ searches/month in India).
 *
 * Target queries:
 *   "ai mock interview"
 *   "ai mock interview free"
 *   "ai mock interview practice"
 *   "ai interview practice India"
 *   "free ai mock interview India"
 *   "best ai mock interview tool India"
 *
 * Schema: Article + FAQPage + HowTo + BreadcrumbList
 */

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "AI Mock Interview Practice — Free, Voice-Based | HireStepX",
  description:
    "Practice AI mock interviews for free. Voice-based AI interviewer asks company-specific questions, evaluates your answers on STAR structure, and scores communication. 2 free sessions, no card needed.",
  keywords: [
    "ai mock interview",
    "ai mock interview free",
    "ai mock interview practice",
    "ai interview practice india",
    "free ai mock interview india",
    "best ai mock interview tool india",
    "ai interview preparation",
    "mock interview ai feedback",
  ].join(", "),
  alternates: { canonical: "/ai-mock-interview" },
  openGraph: {
    type: "article",
    title: "AI Mock Interview Practice — Free, Voice-Based | HireStepX",
    description:
      "Practice AI mock interviews for free. Voice-based AI interviewer, STAR scoring, and company-specific questions for Google, TCS, Flipkart, and 50+ companies.",
    url: "https://hirestepx.com/ai-mock-interview",
    siteName: "HireStepX",
    locale: "en_IN",
    images: [{ url: "https://hirestepx.com/opengraph-image", width: 1200, height: 630, alt: "AI Mock Interview Practice | HireStepX" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Mock Interview Practice — Free | HireStepX",
    description: "Voice-based AI mock interviews with STAR scoring. 2 free sessions, no card. Practice for Google, TCS, Flipkart, and 50+ companies.",
    images: ["https://hirestepx.com/opengraph-image"],
  },
};

const s = { fontFamily: fonts.sans };
const serif = { fontFamily: fonts.serif };

const INTERVIEW_TYPES = [
  { label: "Behavioral", desc: "STAR-method Q&A with follow-ups", icon: "🎯" },
  { label: "Technical", desc: "CS fundamentals, system design, coding", icon: "💻" },
  { label: "HR Round", desc: "Tell me about yourself, strengths, goals", icon: "🤝" },
  { label: "Case Study", desc: "Product, business, and consulting cases", icon: "📊" },
  { label: "Campus Placement", desc: "Aptitude + GD + technical + HR", icon: "🎓" },
  { label: "Salary Negotiation", desc: "Offer negotiation with counter tactics", icon: "💰" },
];

const VS_ROWS = [
  { feature: "Available 24/7", ai: true, coach: false, chatgpt: false },
  { feature: "Voice-based (speaks + listens)", ai: true, coach: true, chatgpt: false },
  { feature: "Resume-personalised questions", ai: true, coach: true, chatgpt: false },
  { feature: "STAR structure scoring", ai: true, coach: false, chatgpt: false },
  { feature: "Company-specific questions", ai: true, coach: false, chatgpt: false },
  { feature: "Instant scored report", ai: true, coach: false, chatgpt: false },
  { feature: "Free to start", ai: true, coach: false, chatgpt: true },
  { feature: "Coached model answer", ai: true, coach: false, chatgpt: false },
  { feature: "Progress tracking", ai: true, coach: false, chatgpt: false },
];

const TOP_COMPANIES = [
  { label: "Google", slug: "google-behavioral-interview-questions" },
  { label: "Amazon", slug: "amazon-leadership-principles-interview" },
  { label: "Flipkart", slug: "flipkart-product-manager-interview" },
  { label: "TCS", slug: "tcs-ninja-interview-questions" },
  { label: "Razorpay", slug: "razorpay-product-manager-interview" },
  { label: "Goldman Sachs", slug: "goldman-sachs-finance-interview" },
  { label: "Infosys", slug: "infosys-behavioral-interview-questions" },
  { label: "Swiggy", slug: "swiggy-product-manager-interview" },
];

const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Upload your resume",
    desc: "The AI reads your experience and crafts role-specific questions — not generic ones from a bank.",
  },
  {
    step: "2",
    title: "Pick a company and interview type",
    desc: "Choose from 50+ companies and 10 interview formats: behavioral, technical, HR, case study, salary negotiation, and more.",
  },
  {
    step: "3",
    title: "Speak your answers",
    desc: "The AI interviewer asks questions by voice, listens to your spoken answer, and asks intelligent follow-up questions.",
  },
  {
    step: "4",
    title: "Get your scored report",
    desc: "STAR breakdown, communication score, filler-word count, pacing, and a coached model answer for every question.",
  },
];

export default async function AiMockInterviewPage() {
  const { headers } = await import("next/headers");
  const nonce = (await headers()).get("x-nonce") ?? "";

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What is an AI mock interview?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "An AI mock interview is a simulated job interview conducted by an AI system that acts as an interviewer. It asks you questions by voice, listens to your spoken answers, evaluates your responses on criteria like STAR structure and communication clarity, and delivers a scored report. Unlike text-based tools like ChatGPT, a voice-based AI mock interview closely replicates the pressure and format of a real interview.",
        },
      },
      {
        "@type": "Question",
        name: "Is AI mock interview practice effective?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. Research on deliberate practice consistently shows that repeated realistic simulation improves performance. AI mock interviews let you practice the same question 10 times at 2am without scheduling anyone — the volume and immediacy of feedback is the key advantage over human coaches. The STAR scoring gives you objective data on what specifically is weak (situation setup, action clarity, result quantification) rather than vague subjective impressions.",
        },
      },
      {
        "@type": "Question",
        name: "Is HireStepX AI mock interview free?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. HireStepX includes 2 complete AI mock interview sessions for free, with no credit card required. Each free session is a full voice interview with STAR scoring, a detailed performance report, and a coached model answer for every question. After your 2 free sessions, additional sessions are ₹9 each (credits never expire) or ₹39/month for the Sprint Pack (5 sessions).",
        },
      },
      {
        "@type": "Question",
        name: "How is AI mock interview different from practicing with ChatGPT?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "ChatGPT is text-only — it cannot speak questions, cannot hear your spoken answers, cannot score your communication delivery, and has no resume integration. HireStepX is purpose-built: voice-based (the AI speaks and listens), resume-personalised questions, STAR structure scoring, company-specific question banks, progress tracking across sessions, and a coached model answer after every response.",
        },
      },
      {
        "@type": "Question",
        name: "What companies can I practice AI mock interviews for?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "HireStepX supports 50+ target companies including Google, Amazon, Microsoft, Meta, Flipkart, Swiggy, Zomato, Razorpay, CRED, Meesho, PhonePe, Nykaa, Ola, Paytm, Goldman Sachs, McKinsey, Deloitte, TCS, Infosys, Wipro, Cognizant, Accenture, HCL, and Capgemini. Each company has a distinct interview pattern and question bank.",
        },
      },
      {
        "@type": "Question",
        name: "What types of AI mock interviews are available?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "HireStepX supports 10 interview types: Behavioral (STAR method), Technical (CS fundamentals, system design), Strategic, Case Study, Campus Placement, HR Round, Panel, Management, Salary Negotiation, and Government/PSU. Each supports 3 difficulty levels and mini (10-minute) or full (25-minute) session options.",
        },
      },
      {
        "@type": "Question",
        name: "Does the AI mock interview work on mobile?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes, HireStepX works on any modern browser including mobile. For the best AI mock interview experience — especially for voice recognition accuracy — a laptop or desktop with a microphone in a quiet room is recommended. Mobile works for quick practice but a headset significantly improves STT accuracy.",
        },
      },
    ],
  };

  const howToSchema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to do an AI mock interview on HireStepX",
    description: "Practice a full voice-based AI mock interview in 4 steps — free, no card needed.",
    step: HOW_IT_WORKS.map((s) => ({
      "@type": "HowToStep",
      name: s.title,
      text: s.desc,
    })),
  };

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "AI Mock Interview Practice — Free, Voice-Based",
    description:
      "How AI mock interviews work, how they compare to ChatGPT and human coaches, and how to start practicing for free on HireStepX.",
    url: "https://hirestepx.com/ai-mock-interview",
    publisher: { "@type": "Organization", name: "HireStepX", url: "https://hirestepx.com" },
    author: { "@type": "Organization", name: "HireStepX" },
  };

  return (
    <>
      <NavV2 />

      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={ldJson(faqSchema)} />
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={ldJson(howToSchema)} />
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={ldJson(articleSchema)} />
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={ldJson(breadcrumb([{ name: "AI Mock Interview", path: "/ai-mock-interview" }]))} />

      <main id="main-content" style={{ ...s, background: t.cream, minHeight: "100vh" }}>

        {/* ── Hero ── */}
        <section
          aria-labelledby="ami-hero"
          style={{ maxWidth: 760, margin: "0 auto", padding: "80px 24px 56px", textAlign: "center" }}
        >
          <p style={{ ...s, fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: t.copper, marginBottom: 20 }}>
            Free · Voice-based · No card needed
          </p>
          <h1
            id="ami-hero"
            style={{
              ...serif,
              fontSize: "clamp(36px, 6vw, 64px)",
              fontWeight: 400,
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              color: t.coal,
              margin: "0 0 20px",
            }}
          >
            AI Mock Interview<br />
            <span style={{ fontStyle: "italic", color: t.copper }}>Practice, Free.</span>
          </h1>
          <p style={{ ...s, fontSize: 17, lineHeight: 1.65, color: t.inkSoft, maxWidth: 580, margin: "0 auto 36px" }}>
            A voice-based AI interviewer asks company-specific questions, listens to your answers, and scores your STAR structure, communication, and depth. 2 full sessions free.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link
              href="/signup"
              style={{
                ...s,
                background: t.copper,
                color: "#fff",
                padding: "13px 28px",
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 15,
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              Start free — no card needed
            </Link>
            <Link
              href="/how-it-works"
              style={{
                ...s,
                background: "transparent",
                color: t.coal,
                padding: "13px 28px",
                borderRadius: 8,
                fontWeight: 500,
                fontSize: 15,
                textDecoration: "none",
                border: `1px solid ${t.line}`,
                display: "inline-block",
              }}
            >
              See how it works
            </Link>
          </div>
        </section>

        {/* ── What is an AI mock interview ── */}
        <section
          aria-labelledby="ami-what"
          style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px 64px" }}
        >
          <h2
            id="ami-what"
            style={{ ...serif, fontSize: 28, fontWeight: 400, color: t.coal, marginBottom: 16, letterSpacing: "-0.02em" }}
          >
            What is an AI mock interview?
          </h2>
          <p style={{ ...s, fontSize: 16, lineHeight: 1.7, color: t.coal, marginBottom: 16 }}>
            An AI mock interview is a simulated job interview run entirely by an AI system — no human interviewer, no scheduling, available at 2am before your real interview tomorrow. The AI acts as an interviewer: it speaks questions, listens to your spoken answers, asks intelligent follow-ups, and then evaluates your responses.
          </p>
          <p style={{ ...s, fontSize: 16, lineHeight: 1.7, color: t.coal, marginBottom: 16 }}>
            On HireStepX, the AI is personalized to your resume — it knows you worked at Company X, that you have Y years of experience, and what role you're interviewing for. Every question is company-specific, not pulled from a generic bank. The scored report after each session breaks down your STAR structure, communication clarity, filler word frequency, and pacing — with a coached model answer for every question you answered.
          </p>
          <p style={{ ...s, fontSize: 16, lineHeight: 1.7, color: t.coal }}>
            Unlike ChatGPT (text-only, no scoring, no resume integration, no progress tracking), a voice-based AI mock interview replicates the actual pressure of speaking in a real interview — which is where most preparation fails.
          </p>
        </section>

        {/* ── How it works ── */}
        <section
          aria-labelledby="ami-how"
          style={{ background: t.creamRaised, padding: "56px 24px" }}
        >
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            <h2
              id="ami-how"
              style={{ ...serif, fontSize: 28, fontWeight: 400, color: t.coal, marginBottom: 8, letterSpacing: "-0.02em" }}
            >
              How AI mock interviews work on HireStepX
            </h2>
            <p style={{ ...s, fontSize: 15, color: t.inkSoft, marginBottom: 36 }}>
              4 steps. The whole thing takes about 25 minutes for a full session.
            </p>
            <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 24 }}>
              {HOW_IT_WORKS.map((item) => (
                <li key={item.step} style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
                  <span
                    style={{
                      ...s,
                      background: t.copper,
                      color: "#fff",
                      borderRadius: "50%",
                      width: 32,
                      height: 32,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13,
                      fontWeight: 700,
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  >
                    {item.step}
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

        {/* ── Interview types ── */}
        <section
          aria-labelledby="ami-types"
          style={{ maxWidth: 720, margin: "0 auto", padding: "56px 24px" }}
        >
          <h2
            id="ami-types"
            style={{ ...serif, fontSize: 28, fontWeight: 400, color: t.coal, marginBottom: 8, letterSpacing: "-0.02em" }}
          >
            10 types of AI mock interviews
          </h2>
          <p style={{ ...s, fontSize: 15, color: t.inkSoft, marginBottom: 32 }}>
            Each supports 3 difficulty levels and mini (10 min) or full (25 min) sessions.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
              gap: 16,
            }}
          >
            {INTERVIEW_TYPES.map((type) => (
              <div
                key={type.label}
                style={{
                  background: t.creamRaised,
                  border: `1px solid ${t.line}`,
                  borderRadius: 10,
                  padding: "18px 20px",
                }}
              >
                <span style={{ fontSize: 22, display: "block", marginBottom: 10 }}>{type.icon}</span>
                <p style={{ ...s, fontSize: 15, fontWeight: 600, color: t.coal, margin: "0 0 4px" }}>{type.label}</p>
                <p style={{ ...s, fontSize: 13, color: t.inkSoft, margin: 0, lineHeight: 1.5 }}>{type.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── VS comparison ── */}
        <section
          aria-labelledby="ami-vs"
          style={{ background: t.creamRaised, padding: "56px 24px" }}
        >
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            <h2
              id="ami-vs"
              style={{ ...serif, fontSize: 28, fontWeight: 400, color: t.coal, marginBottom: 8, letterSpacing: "-0.02em" }}
            >
              AI mock interview vs. alternatives
            </h2>
            <p style={{ ...s, fontSize: 15, color: t.inkSoft, marginBottom: 28 }}>
              How HireStepX compares to a human career coach and ChatGPT.
            </p>
            <div style={{ overflowX: "auto" }}>
              <table
                style={{ width: "100%", borderCollapse: "collapse", ...s, fontSize: 14 }}
                aria-label="AI mock interview comparison"
              >
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "10px 14px", borderBottom: `2px solid ${t.line}`, color: t.inkSoft, fontWeight: 600 }}>Feature</th>
                    <th style={{ textAlign: "center", padding: "10px 14px", borderBottom: `2px solid ${t.line}`, color: t.copper, fontWeight: 700 }}>HireStepX AI</th>
                    <th style={{ textAlign: "center", padding: "10px 14px", borderBottom: `2px solid ${t.line}`, color: t.inkSoft, fontWeight: 600 }}>Human Coach</th>
                    <th style={{ textAlign: "center", padding: "10px 14px", borderBottom: `2px solid ${t.line}`, color: t.inkSoft, fontWeight: 600 }}>ChatGPT</th>
                  </tr>
                </thead>
                <tbody>
                  {VS_ROWS.map((row, i) => (
                    <tr key={row.feature} style={{ background: i % 2 === 0 ? t.cream : "transparent" }}>
                      <td style={{ padding: "10px 14px", color: t.coal }}>{row.feature}</td>
                      <td style={{ textAlign: "center", padding: "10px 14px", color: row.ai ? "#16a34a" : "#dc2626", fontWeight: 700 }}>{row.ai ? "✓" : "✗"}</td>
                      <td style={{ textAlign: "center", padding: "10px 14px", color: row.coach ? "#16a34a" : "#dc2626" }}>{row.coach ? "✓" : "✗"}</td>
                      <td style={{ textAlign: "center", padding: "10px 14px", color: row.chatgpt ? "#16a34a" : "#dc2626" }}>{row.chatgpt ? "✓" : "✗"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ ...s, fontSize: 13, color: t.inkSoft, marginTop: 16 }}>
              Human coach: ₹3,000–10,000/session. HireStepX: ₹9/session or ₹39/month for 5 sessions. 2 sessions free.
            </p>
          </div>
        </section>

        {/* ── Practice by company ── */}
        <section
          aria-labelledby="ami-companies"
          style={{ maxWidth: 720, margin: "0 auto", padding: "56px 24px" }}
        >
          <h2
            id="ami-companies"
            style={{ ...serif, fontSize: 28, fontWeight: 400, color: t.coal, marginBottom: 8, letterSpacing: "-0.02em" }}
          >
            Practice AI mock interviews for top companies
          </h2>
          <p style={{ ...s, fontSize: 15, color: t.inkSoft, marginBottom: 28 }}>
            Company-specific questions, interview patterns, and round-by-round guidance — not generic prep.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: 12,
              marginBottom: 24,
            }}
          >
            {TOP_COMPANIES.map((c) => (
              <Link
                key={c.label}
                href={`/questions/${c.slug}`}
                style={{
                  ...s,
                  display: "block",
                  background: t.creamRaised,
                  border: `1px solid ${t.line}`,
                  borderRadius: 8,
                  padding: "14px 16px",
                  textDecoration: "none",
                  fontSize: 14,
                  fontWeight: 600,
                  color: t.coal,
                  transition: "border-color 0.15s",
                }}
              >
                {c.label}
              </Link>
            ))}
          </div>
          <Link href="/companies" style={{ ...s, fontSize: 14, color: t.copper, textDecoration: "underline", fontWeight: 500 }}>
            See all 50+ companies →
          </Link>
        </section>

        {/* ── FAQ ── */}
        <section
          aria-labelledby="ami-faq"
          style={{ background: t.creamRaised, padding: "56px 24px" }}
        >
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            <h2
              id="ami-faq"
              style={{ ...serif, fontSize: 28, fontWeight: 400, color: t.coal, marginBottom: 36, letterSpacing: "-0.02em" }}
            >
              AI mock interview — common questions
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
        <section
          style={{ maxWidth: 720, margin: "0 auto", padding: "56px 24px 80px", textAlign: "center" }}
        >
          <h2
            style={{ ...serif, fontSize: 32, fontWeight: 400, color: t.coal, marginBottom: 12, letterSpacing: "-0.02em" }}
          >
            Start your AI mock interview — free
          </h2>
          <p style={{ ...s, fontSize: 16, color: t.inkSoft, marginBottom: 32, maxWidth: 480, margin: "0 auto 32px" }}>
            2 complete sessions. No credit card. Voice-based, resume-personalized, STAR-scored.
          </p>
          <Link
            href="/signup"
            style={{
              ...s,
              background: t.copper,
              color: "#fff",
              padding: "15px 36px",
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 16,
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            Practice free — 2 sessions included
          </Link>
          <p style={{ ...s, fontSize: 12, color: t.inkSoft, marginTop: 16 }}>
            Already have an account?{" "}
            <Link href="/login" style={{ color: t.copper, textDecoration: "underline" }}>Sign in</Link>
          </p>
        </section>

        {/* ── Related reading ── */}
        <section
          aria-label="Related guides"
          style={{ borderTop: `1px solid ${t.line}`, padding: "40px 24px 56px" }}
        >
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            <p style={{ ...s, fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: t.inkSoft, marginBottom: 16 }}>
              Related guides
            </p>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {[
                { label: "Interview Preparation Guide India 2026", href: "/interview-prep" },
                { label: "Campus Placement Preparation Guide", href: "/for-students" },
                { label: "How It Works — 5 Steps", href: "/how-it-works" },
                { label: "Salary Negotiation Tips India", href: "/blog/salary-negotiation-tips-india" },
                { label: "Behavioral Interview Questions India", href: "/questions/behavioral-interview-questions-india" },
                { label: "STAR Method Guide India", href: "/blog/star-method-interview-answers-india" },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  style={{ ...s, fontSize: 14, color: t.copper, textDecoration: "underline", lineHeight: 1.5 }}
                >
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
