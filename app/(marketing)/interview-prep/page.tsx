import type { Metadata } from "next";
import Link from "next/link";
import { SEO_PAGES } from "../../../data/seo-pages";
import { breadcrumb, ldJson } from "@/marketing-v2/_schema";
import { NavV2, MobileStickyCTA } from "@/marketing-v2/HomepageV2";
import { FooterDome } from "@/marketing-v2/FooterDome";
import { tokens as t, fonts } from "@/auth/_tokens";

/* /interview-prep — pillar page targeting broad "interview preparation
 * India" head terms. Acts as the hub for the entire company × focus
 * content tree. Every /companies/[slug] page is linked from here,
 * which is the strongest crawl-budget and topical-authority signal
 * available without off-site link building.
 *
 * Schema: Article + BreadcrumbList + FAQPage
 * Target queries: "interview preparation India 2026", "how to prepare
 *   for job interview India", "interview tips freshers India",
 *   "best mock interview platform India"
 */

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Interview Preparation Guide India 2026 — AI Mock Interviews | HireStepX",
  description:
    "Interview prep guide for India 2026. AI mock interviews for TCS, Infosys, Google, Amazon, Flipkart, and 50+ companies. All formats covered.",
  keywords: [
    "interview preparation India 2026",
    "how to prepare for job interview India",
    "interview tips freshers India",
    "mock interview practice India",
    "ai mock interview India",
    "campus placement preparation",
    "technical interview preparation",
    "behavioral interview preparation India",
  ].join(", "),
  alternates: { canonical: "/interview-prep" },
  openGraph: {
    type: "article",
    title: "Interview Preparation Guide India 2026 | HireStepX",
    description:
      "Complete interview preparation guide for Indian job seekers. AI mock interviews for 50+ companies, 2 sessions free.",
    url: "https://hirestepx.com/interview-prep",
    siteName: "HireStepX",
    locale: "en_IN",
    images: [{ url: "https://hirestepx.com/opengraph-image", width: 1200, height: 630, alt: "Interview Preparation Guide India 2026 | HireStepX" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Interview Preparation Guide India 2026 | HireStepX",
    description: "Complete guide + AI mock interview practice for 50+ Indian companies.",
    images: ["https://hirestepx.com/opengraph-image"],
  },
};

/* ── Company groupings ──────────────────────────────────────────────── */
const COMPANY_LABEL: Record<string, string> = {
  google: "Google", amazon: "Amazon", microsoft: "Microsoft", meta: "Meta",
  apple: "Apple", netflix: "Netflix", linkedin: "LinkedIn", adobe: "Adobe",
  flipkart: "Flipkart", razorpay: "Razorpay", swiggy: "Swiggy", zomato: "Zomato",
  phonepe: "PhonePe", paytm: "Paytm", cred: "CRED", zerodha: "Zerodha",
  meesho: "Meesho", oyo: "OYO", freshworks: "Freshworks", zoho: "Zoho",
  tcs: "TCS", infosys: "Infosys", wipro: "Wipro", cognizant: "Cognizant",
  accenture: "Accenture", ltimindtree: "LTIMindtree", hcl: "HCL",
  capgemini: "Capgemini", ibm: "IBM",
  mckinsey: "McKinsey", bcg: "BCG", bain: "Bain", deloitte: "Deloitte",
  goldman: "Goldman Sachs", jpmc: "JPMorgan",
};

const FOCUS_LABEL: Record<string, string> = {
  behavioral: "Behavioural", technical: "Technical", "system-design": "System Design",
  "case-study": "Case Study", "campus-placement": "Campus Placement",
  hr: "HR Round", "salary-negotiation": "Salary Negotiation",
};

const SERVICE_COMPANIES = ["tcs", "infosys", "wipro", "cognizant", "accenture", "ltimindtree", "hcl", "capgemini", "ibm"];
const PRODUCT_COMPANIES = ["flipkart", "razorpay", "swiggy", "zomato", "phonepe", "paytm", "cred", "zerodha", "meesho", "oyo", "freshworks", "zoho"];
const FAANG_COMPANIES = ["google", "amazon", "microsoft", "meta", "apple", "netflix", "linkedin", "adobe"];
const CONSULTING_COMPANIES = ["mckinsey", "bcg", "bain", "deloitte", "goldman", "jpmc"];

function pageGroup(companies: string[]) {
  return SEO_PAGES.filter((p) => companies.includes(p.company));
}

export default async function InterviewPrepPage() {
  const { headers } = await import("next/headers");
  const nonce = (await headers()).get("x-nonce") ?? "";
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "How do I prepare for a job interview in India in 2026?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Start by identifying the company type (service IT, product startup, FAANG, consulting). Each has a distinct format: service companies (TCS, Infosys, Wipro) emphasise aptitude and CS fundamentals; product companies (Flipkart, Razorpay, Swiggy) need DSA + system design; FAANG needs hard DSA + system design + behavioral; consulting needs case studies. Practice out loud with AI mock interviews, not just reading answers.",
        },
      },
      {
        "@type": "Question",
        name: "How many mock interviews should I do before the real one?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "At minimum 3: one baseline session (to identify your weaknesses), one targeted practice session (acting on that feedback), and one full simulation close to the interview date. More is better — most candidates see measurable improvement within 5 practice sessions.",
        },
      },
      {
        "@type": "Question",
        name: "What is the difference between technical and behavioral interview preparation?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Technical preparation focuses on data structures, algorithms, system design, and CS fundamentals — skills you demonstrate by solving problems. Behavioral preparation builds a story bank of 8–10 STAR (Situation, Task, Action, Result) examples from your experience, which you adapt across different questions. Both require practice out loud, not just note-taking.",
        },
      },
      {
        "@type": "Question",
        name: "How long does it take to prepare for campus placements in India?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "For service companies (TCS, Infosys, Wipro): 3–4 weeks of focused aptitude + coding practice. For product companies (Flipkart, CRED, Razorpay): 2–3 months of DSA + system design + behavioral preparation. Start early — most candidates underestimate how much practice is needed to answer clearly under pressure.",
        },
      },
      {
        "@type": "Question",
        name: "What is AI mock interview practice and does it actually help?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "AI mock interview practice (like HireStepX) simulates real interview conditions — the AI asks questions, listens to your voice answer, and grades your response on structure, specificity, and delivery. It's available 24/7, provides consistent scoring (unlike friends who may be too kind), and tracks improvement across sessions. Studies on deliberate practice consistently show that objective feedback loops accelerate skill acquisition compared to unstructured practice.",
        },
      },
    ],
  };

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Complete Interview Preparation Guide for India 2026",
    description: "Comprehensive guide covering how to prepare for job interviews at service companies, product startups, FAANG, and consulting firms in India — with AI mock interview practice.",
    image: "https://hirestepx.com/opengraph-image",
    author: { "@type": "Organization", name: "HireStepX", url: "https://hirestepx.com" },
    publisher: {
      "@type": "Organization", name: "HireStepX",
      logo: { "@type": "ImageObject", url: "https://hirestepx.com/wordmark.png" },
    },
    datePublished: "2026-01-01",
    dateModified: "2026-07-14",
    inLanguage: "en-IN",
    url: "https://hirestepx.com/interview-prep",
    mainEntityOfPage: { "@type": "WebPage", "@id": "https://hirestepx.com/interview-prep" },
    keywords: "interview preparation India 2026, mock interview India, campus placement preparation, AI mock interview",
    articleSection: "Interview Preparation",
  };

  const s = { fontFamily: fonts.sans };
  const serif = { fontFamily: fonts.serif };
  const mono = { fontFamily: fonts.mono };
  const copper = t.copper;
  const coal = t.coal;
  const sand = t.inkSoft;
  const cream = t.cream;
  const card = { background: t.creamRaised, border: `1px solid ${t.line}`, borderRadius: 10 };

  return (
    <>
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={ldJson(breadcrumb([{ name: "Interview Prep", path: "/interview-prep" }]))} />

      <NavV2 />
      <main style={{ background: cream, color: coal, minHeight: "100dvh", padding: "48px 24px 80px", ...s }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>

          {/* Eyebrow */}
          <div style={{ ...mono, fontSize: 11, fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase", color: copper, marginBottom: 12 }}>
            Complete Guide · 2026
          </div>

          {/* H1 */}
          <h1 style={{ ...serif, fontSize: "clamp(30px, 5vw, 48px)", fontWeight: 400, letterSpacing: "-0.015em", lineHeight: 1.12, margin: 0, color: coal, textWrap: "balance" }}>
            Interview Preparation Guide for India 2026
          </h1>

          <p style={{ ...serif, fontStyle: "italic", fontSize: 19, lineHeight: 1.55, color: sand, marginTop: 20, maxWidth: 680, textWrap: "balance" }}>
            Not all Indian interviews are the same. TCS wants aptitude. Razorpay wants system design.
            McKinsey wants case studies. This guide maps the terrain — and links you directly to practice
            for each company.
          </p>

          {/* Primary CTA */}
          <div style={{ display: "flex", gap: 12, marginTop: 28, flexWrap: "wrap" }}>
            <Link href="/signup?source=interview-prep" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: copper, color: cream, textDecoration: "none",
              padding: "14px 24px", borderRadius: 999, fontSize: 15, fontWeight: 500,
            }}>
              Start free mock interview → 2 sessions, no card
            </Link>
            <Link href="/questions" style={{
              display: "inline-flex", alignItems: "center",
              color: copper, textDecoration: "none", padding: "14px 16px", fontSize: 14, fontWeight: 500,
            }}>
              Browse all question sets
            </Link>
          </div>

          {/* ── Four interview types ─────────────────────────────────── */}
          <section style={{ marginTop: 56 }}>
            <h2 style={{ ...serif, fontSize: 28, fontWeight: 400, letterSpacing: "-0.01em", margin: "0 0 8px" }}>
              The four types of Indian interviews
            </h2>
            <p style={{ fontSize: 14, color: sand, margin: "0 0 24px", lineHeight: 1.6 }}>
              Preparation differs entirely by company type. Map your target before you prepare.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
              {[
                {
                  label: "Service IT Companies", companies: "TCS · Infosys · Wipro · Cognizant · Accenture · HCL · Capgemini",
                  format: "Aptitude test → CS fundamentals → HR",
                  tip: "The aptitude round eliminates 60–80% of candidates. Score well on reasoning and coding basics first.",
                  href: "/for-students",
                },
                {
                  label: "Indian Product Companies", companies: "Flipkart · Razorpay · Swiggy · CRED · Meesho · Zerodha",
                  format: "DSA (medium–hard) → System Design → Behavioral",
                  tip: "Bar is high. Expect 2 DSA problems in 45 min + a system design round tied to India-scale problems.",
                  href: "/questions/flipkart-sde-interview-questions",
                },
                {
                  label: "FAANG & Global Tech", companies: "Google · Amazon · Microsoft · Meta · Netflix · Adobe",
                  format: "Hard DSA → System Design → Behavioral (LP or Googleyness)",
                  tip: "The highest bar. DSA needs competitive-programming speed. Behavioral rounds are as important as coding.",
                  href: "/questions/google-india-engineering-interview-questions",
                },
                {
                  label: "Consulting & Finance", companies: "McKinsey · BCG · Deloitte · Goldman · JPMorgan",
                  format: "Case Study → Behavioral (PEI/LP) → Partner round",
                  tip: "Hypothesis-first thinking and structured problem-solving matter more than technical depth.",
                  href: "/questions/mckinsey-case-study-interview-questions",
                },
              ].map((type) => (
                <div key={type.label} style={{ ...card, padding: "20px 22px" }}>
                  <div style={{ ...mono, fontSize: 10, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: copper, marginBottom: 6 }}>
                    {type.label}
                  </div>
                  <p style={{ fontSize: 13, color: sand, margin: "0 0 10px", lineHeight: 1.5 }}>{type.companies}</p>
                  <p style={{ fontSize: 14, fontWeight: 500, color: coal, margin: "0 0 8px", lineHeight: 1.4 }}>{type.format}</p>
                  <p style={{ fontSize: 13, color: sand, margin: "0 0 14px", lineHeight: 1.55 }}>{type.tip}</p>
                  <Link href={type.href} style={{ color: copper, textDecoration: "none", fontSize: 13, fontWeight: 500 }}>
                    Practice this type →
                  </Link>
                </div>
              ))}
            </div>
          </section>

          {/* ── Preparation framework ────────────────────────────────── */}
          <section style={{ marginTop: 56 }}>
            <h2 style={{ ...serif, fontSize: 28, fontWeight: 400, letterSpacing: "-0.01em", margin: "0 0 8px" }}>
              A preparation framework that works
            </h2>
            <p style={{ fontSize: 14, color: sand, margin: "0 0 20px", lineHeight: 1.6 }}>
              Most candidates fail at Step 1 — they study what they already know instead of what they don't.
            </p>
            <ol style={{ padding: "0 0 0 0", margin: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 0 }}>
              {[
                { n: "01", title: "Baseline mock interview first", body: "Do one practice interview before any studying. This is uncomfortable but essential — it shows you exactly where you are, not where you think you are. Most candidates discover their real gap is delivery and structure, not content." },
                { n: "02", title: "Know your company's format cold", body: "TCS Ninja has 3 NQT rounds. Amazon has 16 Leadership Principles. Google has a 'Googleyness' round. CRED has a take-home assignment. Each format rewards different preparation — don't use generic content." },
                { n: "03", title: "Build a story bank (behavioral)", body: "Prepare 8–10 STAR (Situation, Task, Action, Result) stories covering: leadership, conflict, failure, initiative, teamwork, technical problem-solving, and learning something new. These same stories answer 90% of behavioral questions across all companies." },
                { n: "04", title: "Practice out loud, not on paper", body: "Reading answers and saying them are completely different skills. Record yourself. Count filler words. Time every answer — aim for 90 seconds to 2 minutes. The goal is naturally structured, not scripted." },
                { n: "05", title: "Company-specific deep dive (last 1 week)", body: "In the final week, simulate the exact interview format: same time limits, same question types, same pressure. Use company-specific question sets and frameworks, not generic prep materials." },
              ].map((step, i) => (
                <li key={step.n} style={{
                  display: "flex", gap: 20, padding: "20px 0",
                  borderBottom: i < 4 ? `1px solid ${t.line}` : "none",
                }}>
                  <div style={{ ...mono, fontSize: 22, fontWeight: 700, color: t.copperBorder, flexShrink: 0, lineHeight: 1 }}>{step.n}</div>
                  <div>
                    <h3 style={{ ...serif, fontSize: 18, fontWeight: 400, margin: "0 0 6px", letterSpacing: "-0.01em" }}>{step.title}</h3>
                    <p style={{ fontSize: 14, lineHeight: 1.65, color: sand, margin: 0 }}>{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* ── Preparation timelines ────────────────────────────────── */}
          <section style={{ marginTop: 56 }}>
            <h2 style={{ ...serif, fontSize: 28, fontWeight: 400, letterSpacing: "-0.01em", margin: "0 0 20px" }}>
              How long does preparation take?
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              {[
                { company: "TCS / Infosys / Wipro", time: "3–4 weeks", note: "Aptitude + CS fundamentals + HR prep. 2 hours/day." },
                { company: "Cognizant / Accenture / HCL", time: "3–4 weeks", note: "Same as above + communication practice for Accenture." },
                { company: "Flipkart / Razorpay / Swiggy", time: "6–10 weeks", note: "Medium–hard DSA + system design + behavioral. 3+ hrs/day." },
                { company: "Google / Amazon / Meta", time: "3–6 months", note: "Hard DSA, system design depth, 8–10 LP stories. Intensive." },
                { company: "McKinsey / BCG / Deloitte", time: "6–8 weeks", note: "Case practice daily (out loud), PEI story bank, casing partner." },
              ].map((row) => (
                <div key={row.company} style={{ ...card, padding: "16px 18px" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: coal, marginBottom: 4 }}>{row.company}</div>
                  <div style={{ ...mono, fontSize: 18, fontWeight: 700, color: copper, marginBottom: 6 }}>{row.time}</div>
                  <p style={{ fontSize: 12, color: sand, margin: 0, lineHeight: 1.55 }}>{row.note}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── Company-specific guides — Service IT ─────────────────── */}
          <CompanyGroup
            heading="Service IT — Campus & Fresher Guides"
            description="The highest-volume hiring segment in India. These companies hire 100,000+ freshers per year combined."
            pages={pageGroup(SERVICE_COMPANIES)}
            companyLabel={COMPANY_LABEL}
            focusLabel={FOCUS_LABEL}
          />

          {/* ── Company-specific guides — Indian Product ─────────────── */}
          <CompanyGroup
            heading="Indian Product Companies"
            description="Unicorns and fast-scaling startups. Higher pay, harder interviews, more ownership."
            pages={pageGroup(PRODUCT_COMPANIES)}
            companyLabel={COMPANY_LABEL}
            focusLabel={FOCUS_LABEL}
          />

          {/* ── Company-specific guides — FAANG ──────────────────────── */}
          <CompanyGroup
            heading="FAANG & Global Tech"
            description="The most competitive hiring bar. Long preparation lead time, significant pay premium."
            pages={pageGroup(FAANG_COMPANIES)}
            companyLabel={COMPANY_LABEL}
            focusLabel={FOCUS_LABEL}
          />

          {/* ── Company-specific guides — Consulting ─────────────────── */}
          <CompanyGroup
            heading="Consulting & Finance"
            description="Case-driven hiring with a structured evaluation rubric. Completely different format from tech."
            pages={pageGroup(CONSULTING_COMPANIES)}
            companyLabel={COMPANY_LABEL}
            focusLabel={FOCUS_LABEL}
          />

          {/* ── Freshers & Campus HR prep ─────────────────────────────── */}
          <section style={{ marginTop: 56 }}>
            <h2 style={{ ...serif, fontSize: 28, fontWeight: 400, letterSpacing: "-0.01em", margin: "0 0 8px" }}>
              Freshers &amp; Campus Placement — HR Prep
            </h2>
            <p style={{ fontSize: 14, color: sand, margin: "0 0 20px", lineHeight: 1.6 }}>
              Every campus interview ends with an HR round. These guides cover the questions that appear in 90%+ of Indian campus drives — with structured answer frameworks you can practice out loud.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
              {[
                {
                  title: "Why Should We Hire You?",
                  desc: "The most consequential question in campus interviews. Most freshers waste it with vague claims. Learn the Skills → Proof → Fit structure.",
                  href: "/questions/why-should-we-hire-you-answer-india",
                },
                {
                  title: "Tell Me About Yourself",
                  desc: "Opens every interview. The wrong structure is chronological. Learn the Present → Achievement → Future format that interviewers want.",
                  href: "/questions/tell-me-about-yourself-answer-freshers-india",
                },
                {
                  title: "Common HR Interview Questions",
                  desc: "10 questions that appear in 95%+ of fresher HR rounds — strength, weakness, 5-year goal, why this company, relocation, and more.",
                  href: "/questions/common-hr-interview-questions-freshers-india",
                },
              ].map((item) => (
                <Link key={item.href} href={item.href} style={{
                  ...card, padding: "20px 22px", textDecoration: "none", color: "inherit", display: "block",
                }}>
                  <div style={{ ...mono, fontSize: 10, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: copper, marginBottom: 8 }}>
                    HR Round · Freshers
                  </div>
                  <h3 style={{ ...serif, fontSize: 17, fontWeight: 400, margin: "0 0 8px", letterSpacing: "-0.01em", color: coal }}>
                    {item.title}
                  </h3>
                  <p style={{ fontSize: 13, color: sand, margin: "0 0 14px", lineHeight: 1.55 }}>{item.desc}</p>
                  <span style={{ color: copper, fontSize: 13, fontWeight: 500 }}>Practice with AI →</span>
                </Link>
              ))}
            </div>
            <p style={{ fontSize: 13, color: sand, margin: "16px 0 0", lineHeight: 1.5 }}>
              Preparing for a campus placement drive?{" "}
              <Link href="/for-students" style={{ color: copper, fontWeight: 500, textDecoration: "none" }}>
                See the full campus placement guide →
              </Link>
            </p>
          </section>

          {/* ── FAQ ──────────────────────────────────────────────────── */}
          <section style={{ marginTop: 56 }}>
            <h2 style={{ ...serif, fontSize: 28, fontWeight: 400, letterSpacing: "-0.01em", margin: "0 0 20px" }}>
              Frequently asked questions
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {faqSchema.mainEntity.map((faq, i) => (
                <div key={i} style={{
                  padding: "20px 0",
                  borderBottom: i < faqSchema.mainEntity.length - 1 ? `1px solid ${t.line}` : "none",
                }}>
                  <h3 style={{ ...serif, fontSize: 17, fontWeight: 400, margin: "0 0 8px", letterSpacing: "-0.01em" }}>
                    {faq.name}
                  </h3>
                  <p style={{ fontSize: 14, lineHeight: 1.65, color: sand, margin: 0 }}>
                    {faq.acceptedAnswer.text}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* ── Related reading — deep-dive company guides ────────────── */}
          <section style={{ marginTop: 56 }}>
            <h2 style={{ ...serif, fontSize: 28, fontWeight: 400, letterSpacing: "-0.01em", margin: "0 0 8px" }}>
              Company interview guides
            </h2>
            <p style={{ fontSize: 14, color: sand, margin: "0 0 20px", lineHeight: 1.6 }}>
              Each guide covers the full process for that company — rounds, format, what the interviewers evaluate, and what separates shortlisted candidates.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
              {([
                ["Freshworks SDE Interview 2026 — B2B SaaS & Customer-Success Engineering", "/blog/freshworks-interview-questions-india-2026"],
                ["PhonePe Engineering Interview 2026 — Scale, UPI & Builder Mindset", "/blog/phonepe-interview-questions-india-2026"],
                ["Meesho Engineering Interview 2026 — Social Commerce & Tier-3 India", "/blog/meesho-interview-questions-india-2026"],
                ["FAANG Interview Preparation India 2026", "/blog/faang-interview-preparation-india-2026"],
                ["System Design Interview Preparation India", "/blog/system-design-interview-preparation"],
                ["DSA 60-Day Preparation Plan India 2026", "/blog/dsa-60-day-preparation-plan"],
                ["Goldman Sachs India Interview Questions 2026", "/blog/goldman-sachs-india-interview-questions"],
                ["JP Morgan Interview Questions India 2026", "/blog/jp-morgan-interview-questions-india-2026"],
                ["Software Engineer Interview Checklist 2026", "/blog/software-engineer-interview-checklist-2026"],
                ["STAR Method Interview Answers India", "/blog/star-method-interview-answers"],
              ] as [string, string][]).map(([label, href]) => (
                <Link
                  key={href}
                  href={href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "14px 18px",
                    background: t.white,
                    border: `1px solid ${t.line}`,
                    borderRadius: 12,
                    fontSize: 14,
                    fontWeight: 500,
                    color: coal,
                    textDecoration: "none",
                    gap: 10,
                    lineHeight: 1.4,
                  }}
                >
                  <span style={{ color: copper, fontSize: 16, flexShrink: 0 }}>→</span>
                  {label}
                </Link>
              ))}
            </div>
          </section>

          {/* ── Bottom CTA ───────────────────────────────────────────── */}
          <section style={{
            marginTop: 56, padding: "32px 28px",
            background: t.creamSoft, borderRadius: 16, textAlign: "center",
          }}>
            <h2 style={{ ...serif, fontSize: 26, fontWeight: 400, margin: 0, letterSpacing: "-0.01em" }}>
              Stop reading. Start practicing.
            </h2>
            <p style={{ fontSize: 14, color: sand, margin: "10px 0 20px", lineHeight: 1.5, maxWidth: 480, marginInline: "auto" }}>
              Reading interview tips is not the same as interview practice. The AI interviewer asks
              questions, listens to your voice answer, and grades your structure and delivery — in 2 minutes.
            </p>
            <Link href="/signup?source=interview-prep-cta" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: copper, color: cream, textDecoration: "none",
              padding: "14px 28px", borderRadius: 999, fontSize: 15, fontWeight: 500,
            }}>
              Start free practice → 2 sessions, no card
            </Link>
          </section>

        </div>
      </main>
      <FooterDome />
      <MobileStickyCTA />
    </>
  );
}

/* Reusable company group section. */
function CompanyGroup({
  heading, description, pages, companyLabel, focusLabel,
}: {
  heading: string;
  description: string;
  pages: typeof SEO_PAGES;
  companyLabel: Record<string, string>;
  focusLabel: Record<string, string>;
}) {
  if (pages.length === 0) return null;
  return (
    <section style={{ marginTop: 56 }}>
      <h2 style={{ fontFamily: fonts.serif, fontSize: 26, fontWeight: 400, letterSpacing: "-0.01em", margin: "0 0 6px" }}>
        {heading}
      </h2>
      <p style={{ fontSize: 14, color: t.inkSoft, margin: "0 0 18px", lineHeight: 1.6 }}>{description}</p>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
        {pages.map((p) => (
          <li key={p.slug}>
            <Link href={`/questions/${p.slug}`} style={{
              display: "block", padding: "14px 16px",
              background: t.creamRaised, border: `1px solid ${t.line}`, borderRadius: 10,
              textDecoration: "none", color: t.coal,
            }}>
              <div style={{ fontFamily: fonts.mono, fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: t.copper, marginBottom: 4 }}>
                {companyLabel[p.company] ?? p.company} · {focusLabel[p.focus] ?? p.focus}
              </div>
              <div style={{ fontFamily: fonts.serif, fontSize: 15, lineHeight: 1.4, color: t.coal }}>
                {p.searchPhrase}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
