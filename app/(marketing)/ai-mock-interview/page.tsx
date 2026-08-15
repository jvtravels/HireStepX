import type { Metadata } from "next";
import Script from "next/script";
import Link from "next/link";
import { NavV2, MobileStickyCTA } from "@/marketing-v2/HomepageV2";
import { FooterDome } from "@/marketing-v2/FooterDome";
import { FAQItem } from "@/marketing-v2/MarketingPagesV2";
import { DarkBand, ctaPrimaryStyle, editorialCSS } from "@/marketing-v2/_editorial";
import { tokens as t, fonts } from "@/auth/_tokens";
import { buildAiMockInterviewJsonLd, FAQ_ENTRIES, HOW_IT_WORKS } from "./_jsonld";

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
  title: "AI Mock Interview Practice: Free, Voice-Based | HireStepX",
  description:
    "Practice AI mock interviews free. Voice AI asks company-specific questions and scores your answers on STAR structure and communication. 2 free sessions.",
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
    title: "AI Mock Interview Practice: Free, Voice-Based | HireStepX",
    description:
      "Practice AI mock interviews for free. Voice-based AI interviewer, STAR scoring, and company-specific questions for Google, TCS, Flipkart, and 200+ companies.",
    url: "https://hirestepx.com/ai-mock-interview",
    siteName: "HireStepX",
    locale: "en_IN",
    images: [{ url: "https://hirestepx.com/opengraph-image", width: 1200, height: 630, alt: "AI Mock Interview Practice | HireStepX" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Mock Interview Practice, Free | HireStepX",
    description: "Voice-based AI mock interviews with STAR scoring. 2 free sessions, no card. Practice for Google, TCS, Flipkart, and 200+ companies.",
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
  { label: "Microsoft", slug: "microsoft-india-sde-interview-questions" },
  { label: "Meta", slug: "meta-engineering-interview-questions" },
  { label: "Flipkart", slug: "flipkart-product-manager-interview" },
  { label: "TCS", slug: "tcs-ninja-interview-questions" },
  { label: "Infosys", slug: "infosys-behavioral-interview-questions" },
  { label: "Wipro", slug: "wipro-freshers-interview-questions" },
  { label: "Razorpay", slug: "razorpay-product-manager-interview" },
  { label: "Swiggy", slug: "swiggy-product-manager-interview" },
  { label: "Goldman Sachs", slug: "goldman-sachs-finance-interview" },
  { label: "J.P. Morgan", slug: "jpmorgan-interview-questions-india" },
  { label: "HDFC Bank", slug: "hdfc-bank-software-engineer-interview-questions" },
  { label: "Upstox", slug: "upstox-swe-interview-questions" },
  { label: "Zerodha", slug: "zerodha-engineering-interview-questions" },
  { label: "Meesho", slug: "meesho-engineering-interview-questions" },
  { label: "Optiver", slug: "optiver-quant-interview-questions" },
  { label: "Scaler", slug: "scaler-software-engineer-interview-questions" },
];

export default async function AiMockInterviewPage() {
  return (
    <>
      <Script
        async
        src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7810403590527236"
        crossOrigin="anonymous"
        strategy="lazyOnload"
      />
      <style>{editorialCSS}</style>
      <NavV2 />

      {buildAiMockInterviewJsonLd(FAQ_ENTRIES, HOW_IT_WORKS).map((html, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={html} />
      ))}

      <main id="main-content" style={{ ...s, background: t.cream, minHeight: "100vh" }}>

        {/* ── Hero ── */}
        <section
          aria-labelledby="ami-hero"
          style={{ maxWidth: 760, margin: "0 auto", padding: "80px 24px 56px", textAlign: "center" }}
        >
          <p style={{ ...s, fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: t.copper, marginBottom: 20 }}>
            Free · Voice-based · India 2026
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
              Start free, no card needed
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
            An AI mock interview is a simulated job interview run entirely by an AI system: no human interviewer, no scheduling, available at 2am before your real interview tomorrow. The AI acts as an interviewer: it speaks questions, listens to your spoken answers, asks intelligent follow-ups, and then evaluates your responses.
          </p>
          <p style={{ ...s, fontSize: 16, lineHeight: 1.7, color: t.coal, marginBottom: 16 }}>
            On HireStepX, the AI is personalized to your resume: it knows you worked at Company X, that you have Y years of experience, and what role you're interviewing for. Every question is company-specific, not pulled from a generic bank. The scored report after each session breaks down your STAR structure, communication clarity, filler word frequency, and pacing, with a coached model answer for every question you answered.
          </p>
          <p style={{ ...s, fontSize: 16, lineHeight: 1.7, color: t.coal }}>
            Unlike ChatGPT (text-only, no scoring, no resume integration, no progress tracking), a voice-based AI mock interview replicates the actual pressure of speaking in a real interview, which is where most preparation fails.
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
            Company-specific questions, interview patterns, and round-by-round guidance, not generic prep.
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
            See all 200+ companies →
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
              AI mock interview: common questions
            </h2>
            <style>{`
              .mv2p-faq[open] .mv2p-faq-marker { transform: rotate(45deg); }
              .mv2p-faq-marker { transition: transform 180ms cubic-bezier(0.16, 1, 0.3, 1); }
              @media (prefers-reduced-motion: reduce) {
                .mv2p-faq-marker { transition: none !important; }
              }
            `}</style>
            <div style={{ background: t.cream, border: `1px solid ${t.line}`, borderRadius: 10 }}>
              {FAQ_ENTRIES.map((item, i) => (
                <FAQItem key={item.q} q={item.q} a={item.a} first={i === 0} />
              ))}
            </div>
          </div>
        </section>

        {/* ── Related reading ── */}
        <section
          aria-label="Related guides"
          style={{ borderTop: `1px solid ${t.line}`, padding: "56px 24px 72px" }}
        >
          <style>{`
            .ami-rel-link { position: relative; text-decoration: none; color: ${t.coal}; }
            .ami-rel-link::after { content: ""; position: absolute; left: 0; bottom: -2px; height: 1px; width: 100%; background: ${t.copper}; transform: scaleX(0); transform-origin: left; transition: transform 0.3s ease; }
            .ami-rel-link:hover { color: ${t.copper}; }
            .ami-rel-link:hover::after { transform: scaleX(1); }
            .ami-rel-link:focus-visible { outline: 2px solid ${t.copper}; outline-offset: 3px; border-radius: 3px; }
            @media (prefers-reduced-motion: reduce) {
              .ami-rel-link::after { transition: none !important; }
            }
          `}</style>
          <div style={{ maxWidth: 880, margin: "0 auto" }}>
            <p style={{ ...s, fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: t.inkFaint, marginBottom: 32 }}>
              Related guides
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "36px 32px",
              }}
            >
              {[
                {
                  group: "Interview formats",
                  links: [
                    { label: "Telephonic Interview Questions", href: "/telephonic-interview-questions" },
                    { label: "Walk-in Interview Preparation", href: "/walk-in-interview-preparation" },
                    { label: "One-Way Video Interview Practice", href: "/one-way-video-interview-practice" },
                    { label: "BPO Interview Questions & Answers", href: "/bpo-interview-questions" },
                    { label: "Bank PO Interview Questions: SBI & IBPS", href: "/bank-po-interview-questions" },
                    { label: "MBA Personal Interview (PI) Preparation", href: "/mba-personal-interview-preparation" },
                  ],
                },
                {
                  group: "Preparation guides",
                  links: [
                    { label: "How to Overcome Interview Anxiety", href: "/interview-anxiety" },
                    { label: "English Speaking Practice for Interviews", href: "/english-interview-practice" },
                    { label: "Interview Preparation Guide India 2026", href: "/interview-prep" },
                    { label: "Campus Placement Preparation Guide", href: "/for-students" },
                    { label: "Behavioral Interview Questions India", href: "/questions/behavioral-interview-questions-india" },
                    { label: "STAR Method Guide India", href: "/blog/star-method-interview-answers-india" },
                    { label: "Salary Negotiation Tips India", href: "/blog/salary-negotiation-tips-india" },
                    { label: "How It Works: 5 Steps", href: "/how-it-works" },
                  ],
                },
                {
                  group: "Salary guides 2026",
                  links: [
                    { label: "TCS", href: "/salary/tcs" },
                    { label: "Infosys", href: "/salary/infosys" },
                    { label: "Google India", href: "/salary/google" },
                    { label: "Amazon India", href: "/salary/amazon" },
                    { label: "Flipkart", href: "/salary/flipkart" },
                    { label: "Wipro", href: "/salary/wipro" },
                  ],
                },
              ].map((section) => (
                <div key={section.group}>
                  <p style={{ ...s, fontSize: 12, fontWeight: 600, color: t.inkFaint, margin: "0 0 14px" }}>
                    {section.group}
                  </p>
                  <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                    {section.links.map((link) => (
                      <li key={link.href}>
                        <Link href={link.href} className="ami-rel-link" style={{ ...s, fontSize: 14, lineHeight: 1.5 }}>
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* ── Closing video CTA — sits directly above the footer ── */}
      <DarkBand eyebrow="Free · 2 sessions · no card" title="Start your AI mock interview," accent="free." videoSrc="/cta.mp4">
        <p style={{ fontFamily: fonts.sans, fontSize: 16, color: t.creamMuted, lineHeight: 1.65, maxWidth: "40ch", margin: 0 }}>
          2 complete sessions. No credit card. Voice-based, resume-personalized, STAR-scored.
        </p>
        <Link href="/signup" className="ed-cta" style={ctaPrimaryStyle("lg")}>
          Practice free, 2 sessions included <span className="ed-cta-arrow" aria-hidden>→</span>
        </Link>
        <p style={{ fontFamily: fonts.sans, fontSize: 13, color: t.creamMuted, margin: 0 }}>
          Already have an account?{" "}
          <Link href="/login" style={{ color: t.cream, textDecoration: "underline" }}>Sign in</Link>
        </p>
      </DarkBand>

      <FooterDome />
      <MobileStickyCTA />
    </>
  );
}
