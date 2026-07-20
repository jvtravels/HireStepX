import type { Metadata } from "next";
import Link from "next/link";
import { breadcrumb, ldJson } from "@/marketing-v2/_schema";
import { NavV2, MobileStickyCTA } from "@/marketing-v2/HomepageV2";
import { FooterDome } from "@/marketing-v2/FooterDome";
import { tokens as t, fonts } from "@/auth/_tokens";

/* /for-students — dedicated campus placement landing page.
 * Targets: "campus placement interview preparation India 2026",
 *   "fresher interview guide India", "placement preparation 2026",
 *   "how to crack campus placement India"
 *
 * Schema: Article + FAQPage + BreadcrumbList
 * All content sourced from existing seo-pages data and blog-meta content.
 */

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Campus Placement Interview Preparation Guide India 2026 | HireStepX",
  description:
    "Campus placement guide for India 2026. Aptitude, technical, GD, and HR rounds for TCS, Infosys, Wipro, Cognizant, Accenture, and Capgemini.",
  keywords: [
    "campus placement interview preparation India 2026",
    "fresher interview preparation India",
    "campus placement guide India",
    "how to crack campus placement",
    "tcs placement preparation 2026",
    "infosys placement interview tips",
    "fresher interview tips India",
    "campus hr interview questions India",
  ].join(", "),
  alternates: { canonical: "/for-students" },
  openGraph: {
    type: "article",
    title: "Campus Placement Interview Preparation Guide India 2026 | HireStepX",
    description:
      "Complete campus placement guide for Indian freshers. AI mock interviews for TCS, Infosys, Wipro, Cognizant, Accenture, HCL, Capgemini — 2 sessions free.",
    url: "https://hirestepx.com/for-students",
    siteName: "HireStepX",
    locale: "en_IN",
    images: [{ url: "https://hirestepx.com/opengraph-image", width: 1200, height: 630, alt: "Campus Placement Interview Preparation Guide India 2026 | HireStepX" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Campus Placement Interview Preparation Guide India 2026 | HireStepX",
    description: "Complete campus placement guide for Indian freshers. AI mock interviews for 7 top service companies.",
    images: ["https://hirestepx.com/opengraph-image"],
  },
};

const s = { fontFamily: fonts.sans };
const serif = { fontFamily: fonts.serif };
const mono = { fontFamily: fonts.mono };
const copper = t.copper;
const coal = t.coal;
const sand = t.inkSoft;
const cream = t.cream;
const card = { background: t.creamRaised, border: `1px solid ${t.line}`, borderRadius: 10 };

/* ── Service company question sets (only confirmed real slugs) ── */
const SERVICE_COMPANY_GUIDES = [
  {
    label: "TCS", focus: "Campus Placement",
    slug: "tcs-ninja-interview-questions",
    desc: "NQT → Ninja → Digital → Prime tracks. Aptitude + CS fundamentals.",
    salary: "/salary/tcs",
  },
  {
    label: "Infosys", focus: "Behavioral",
    slug: "infosys-behavioral-interview-questions",
    desc: "Systems Engineer track. HR round + values alignment.",
    salary: "/salary/infosys",
  },
  {
    label: "Wipro", focus: "Behavioral",
    slug: "wipro-behavioral-interview-questions",
    desc: "NLTH, Elite, and Turbo tracks. Reasoning + coding + HR.",
    salary: "/salary/wipro",
  },
  {
    label: "Cognizant", focus: "Campus",
    slug: "cognizant-genc-interview-questions",
    desc: "GenC, GenC Next, GenC Elevate — three fresher bands.",
    salary: "/salary/cognizant",
  },
  {
    label: "Accenture", focus: "Behavioral",
    slug: "accenture-behavioral-interview-questions",
    desc: "Communication + teamwork + values. Scenario-based HR.",
    salary: null,
  },
  {
    label: "HCL Technologies", focus: "Campus",
    slug: "hcl-freshers-interview-questions",
    desc: "HCL TechBee + campus route. Graduate Trainee band.",
    salary: "/salary/hcl",
  },
  {
    label: "Capgemini", focus: "Campus",
    slug: "capgemini-freshers-interview-questions",
    desc: "InfraServices vs Insights & Data track — different tests.",
    salary: "/salary/capgemini",
  },
  {
    label: "LTIMindtree", focus: "Campus",
    slug: "ltimindtree-freshers-interview-questions",
    desc: "Post-merger comp standardisation. Engineer track.",
    salary: "/salary/ltimindtree",
  },
  {
    label: "Deloitte", focus: "Fresher",
    slug: "deloitte-analyst-interview-questions",
    desc: "USI Analyst track. Case + behavioral + aptitude.",
    salary: "/salary/deloitte",
  },
];

/* ── HR prep links (confirmed real question page slugs) ── */
const HR_PREP = [
  {
    title: "Tell Me About Yourself",
    desc: "Opens every campus interview. The wrong structure is chronological. Learn Present → Achievement → Future.",
    href: "/questions/tell-me-about-yourself-answer-freshers-india",
  },
  {
    title: "Why Should We Hire You?",
    desc: "The most consequential campus question. Avoid vague claims. Use the Skills → Proof → Fit structure.",
    href: "/questions/why-should-we-hire-you-answer-india",
  },
  {
    title: "Common HR Questions for Freshers",
    desc: "10 questions in 90%+ of fresher HR rounds — strength, weakness, 5-year goal, relocation, salary expectation.",
    href: "/questions/common-hr-interview-questions-freshers-india",
  },
];

/* ── Campus blog posts (confirmed real slugs) ── */
const CAMPUS_BLOG_POSTS = [
  { label: "How to Pass the TCS NQT 2026", href: "/blog/how-to-pass-tcs-nqt-2026" },
  { label: "TCS Interview Questions for Freshers", href: "/blog/tcs-interview-questions-freshers-2026" },
  { label: "Infosys Interview Questions 2026", href: "/blog/infosys-interview-questions-2026" },
  { label: "Wipro Interview Questions & Answers", href: "/blog/wipro-interview-questions-answers" },
  { label: "Wipro Elite NLTH Preparation 2026", href: "/blog/wipro-elite-nlth-preparation-2026" },
  { label: "Cognizant Interview Questions 2026", href: "/blog/cognizant-interview-questions-freshers-2026" },
  { label: "Accenture Interview Questions 2026", href: "/blog/accenture-interview-questions-freshers-2026" },
  { label: "HCL, Accenture & Capgemini Comparison", href: "/blog/hcl-accenture-capgemini-interview-comparison" },
  { label: "Campus Placement Interview Tips", href: "/blog/campus-placement-interview-tips" },
  { label: "Group Discussion Topics for Campus 2026", href: "/blog/group-discussion-topics-campus-placement-2026" },
  { label: "Resume Tips for Freshers India 2026", href: "/blog/resume-tips-freshers-india-2026" },
  { label: "Fresher Salary Guide India 2026", href: "/blog/fresher-salary-india-2026" },
];

export default async function ForStudentsPage() {
  const { headers } = await import("next/headers");
  const nonce = (await headers()).get("x-nonce") ?? "";

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "How early should I start preparing for campus placements in India?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Start 3–4 months before your placement season for service companies (TCS, Infosys, Wipro). For product companies (Flipkart, Swiggy, CRED), start 6–8 months early due to the higher DSA and system design bar. The aptitude round for service companies eliminates 60–80% of candidates — this is the highest-leverage area to prepare first.",
        },
      },
      {
        "@type": "Question",
        name: "What CGPA is required for campus placements in India?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Most service companies have a 6.0 CGPA minimum; many have 6.5 or 7.0. TCS requires 60% throughout academics with no active backlogs. Some product companies don't have a CGPA filter at all — check each company's specific eligibility criteria on their careers page or official campus portal before assuming you're ineligible.",
        },
      },
      {
        "@type": "Question",
        name: "What rounds are in a typical campus placement process?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "A typical Indian campus placement process has 3–5 rounds: (1) Aptitude / Online Test — reasoning, quantitative, verbal, and basic coding questions that eliminate most applicants; (2) Technical Interview — CS fundamentals, data structures, and sometimes a coding problem; (3) Group Discussion (some companies); (4) HR Round — behavioral questions including 'tell me about yourself', 'why should we hire you', and salary expectation; (5) Offer roll-out.",
        },
      },
      {
        "@type": "Question",
        name: "Which companies hire the most freshers in India?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "TCS, Infosys, Wipro, Cognizant, Accenture, HCL Technologies, and Capgemini are the largest campus recruiters in India, collectively hiring more than 100,000 freshers per year. Each company has a distinct aptitude test format: TCS uses the NQT, Wipro uses the NLTH assessment, and Cognizant uses the GenC/GenC Next format.",
        },
      },
      {
        "@type": "Question",
        name: "What is the most important thing to prepare for an HR interview in campus placements?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "The three questions that appear in 95%+ of fresher HR rounds are: 'Tell me about yourself', 'Why should we hire you?', and 'What is your greatest strength?' Prepare a structured 60–90 second answer for 'tell me about yourself' using the Present → Achievement → Future format, not a chronological biography. The 'why should we hire you' answer needs the Skills → Proof → Fit structure with at least one specific, measurable proof point.",
        },
      },
    ],
  };

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Campus Placement Interview Preparation Guide India 2026",
    description: "Complete campus placement interview preparation guide for Indian college students covering aptitude, technical, group discussion, and HR rounds for TCS, Infosys, Wipro, Cognizant, Accenture, HCL, and Capgemini.",
    image: "https://hirestepx.com/opengraph-image",
    author: { "@type": "Organization", name: "HireStepX", url: "https://hirestepx.com" },
    publisher: {
      "@type": "Organization", name: "HireStepX",
      logo: { "@type": "ImageObject", url: "https://hirestepx.com/wordmark.png" },
    },
    datePublished: "2026-01-01",
    dateModified: "2026-07-15",
    inLanguage: "en-IN",
    url: "https://hirestepx.com/for-students",
    mainEntityOfPage: { "@type": "WebPage", "@id": "https://hirestepx.com/for-students" },
    keywords: "campus placement interview preparation India 2026, fresher interview India, campus placement guide",
    articleSection: "Campus Placement",
  };

  return (
    <>
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={ldJson(breadcrumb([{ name: "For Students", path: "/for-students" }]))} />

      <NavV2 />
      <main style={{ background: cream, color: coal, minHeight: "100dvh", padding: "48px 24px 80px", ...s }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>

          {/* Eyebrow */}
          <div style={{ ...mono, fontSize: 11, fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase", color: copper, marginBottom: 12 }}>
            Campus Placement Guide · 2026
          </div>

          {/* H1 */}
          <h1 style={{ ...serif, fontSize: "clamp(28px, 5vw, 46px)", fontWeight: 400, letterSpacing: "-0.015em", lineHeight: 1.12, margin: 0, color: coal, textWrap: "balance" }}>
            Campus Placement Interview Preparation Guide India 2026
          </h1>

          <p style={{ ...serif, fontStyle: "italic", fontSize: 18, lineHeight: 1.55, color: sand, marginTop: 20, maxWidth: 680, textWrap: "balance" }}>
            TCS, Infosys, Wipro, Cognizant, Accenture, HCL, and Capgemini hire over 100,000 freshers
            every year. Their interviews follow predictable patterns — and this guide covers each one.
          </p>

          {/* Primary CTAs */}
          <div style={{ display: "flex", gap: 12, marginTop: 28, flexWrap: "wrap" }}>
            <Link href="/signup?source=for-students" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: copper, color: cream, textDecoration: "none",
              padding: "14px 24px", borderRadius: 999, fontSize: 15, fontWeight: 500,
            }}>
              Start free mock interview → 2 sessions, no card
            </Link>
            <Link href="/questions?focus=campus-placement" style={{
              display: "inline-flex", alignItems: "center",
              color: copper, textDecoration: "none", padding: "14px 16px", fontSize: 14, fontWeight: 500,
            }}>
              Browse campus placement questions
            </Link>
          </div>

          {/* ── What campus placements look like ─────────────────────── */}
          <section style={{ marginTop: 56 }}>
            <h2 style={{ ...serif, fontSize: 28, fontWeight: 400, letterSpacing: "-0.01em", margin: "0 0 8px" }}>
              What campus placements actually look like
            </h2>
            <p style={{ fontSize: 14, color: sand, margin: "0 0 24px", lineHeight: 1.6 }}>
              Most service companies follow the same 4-round structure. Understanding it before you start
              preparing saves weeks.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {[
                {
                  n: "01", title: "Aptitude / Online Test",
                  body: "This eliminates 60–80% of applicants. It covers quantitative reasoning, logical reasoning, verbal ability, and basic coding questions. TCS uses the NQT, Wipro uses the NLTH assessment, Cognizant uses the GenC/GenC Next format. Each company's test has a different format — practice the specific format for your target company, not generic aptitude.",
                },
                {
                  n: "02", title: "Technical Interview (45–60 min)",
                  body: "CS fundamentals (OS, DBMS, networking, OOP), data structures, and sometimes a live coding problem. Interviewers at this stage focus on whether you can explain your project clearly and whether you know the basics of your primary programming language. Freshers are not expected to know system design.",
                },
                {
                  n: "03", title: "Group Discussion (some companies)",
                  body: "Accenture and some Cognizant campuses include a group discussion round. GD scores you on communication clarity, ability to build on others' points, and not dominating or staying silent. Prepare 2–3 talking points per topic rather than memorising full speeches.",
                },
                {
                  n: "04", title: "HR Interview (30 min)",
                  body: "Every campus process ends here. Three questions appear in 95%+ of fresher HR rounds: 'Tell me about yourself', 'Why should we hire you?', and 'Where do you see yourself in 5 years?' Each has a specific structure that scores well — practice them aloud before the interview, not just in your head.",
                },
              ].map((step, i) => (
                <div key={step.n} style={{
                  display: "flex", gap: 20, padding: "20px 0",
                  borderBottom: i < 3 ? `1px solid ${t.line}` : "none",
                }}>
                  <div style={{ ...mono, fontSize: 22, fontWeight: 700, color: t.copperBorder, flexShrink: 0, lineHeight: 1 }}>{step.n}</div>
                  <div>
                    <h3 style={{ ...serif, fontSize: 18, fontWeight: 400, margin: "0 0 6px", letterSpacing: "-0.01em" }}>{step.title}</h3>
                    <p style={{ fontSize: 14, lineHeight: 1.65, color: sand, margin: 0 }}>{step.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Company-specific practice ─────────────────────────────── */}
          <section style={{ marginTop: 56 }}>
            <h2 style={{ ...serif, fontSize: 28, fontWeight: 400, letterSpacing: "-0.01em", margin: "0 0 8px" }}>
              Company-specific practice guides
            </h2>
            <p style={{ fontSize: 14, color: sand, margin: "0 0 20px", lineHeight: 1.6 }}>
              Each service company has a different aptitude test format and interview style.
              Use the guide for your specific target company.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
              {SERVICE_COMPANY_GUIDES.map((co) => (
                <div key={co.slug} style={{ ...card, padding: "16px 18px" }}>
                  <div style={{ ...mono, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: copper, marginBottom: 4 }}>
                    {co.label} · {co.focus}
                  </div>
                  <p style={{ fontSize: 13, color: sand, margin: "0 0 12px", lineHeight: 1.5 }}>{co.desc}</p>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <Link href={`/questions/${co.slug}`} style={{ color: copper, textDecoration: "none", fontSize: 13, fontWeight: 500 }}>
                      Practice interview →
                    </Link>
                    {co.salary && (
                      <Link href={co.salary} style={{ color: sand, textDecoration: "none", fontSize: 13 }}>
                        Salary guide
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── HR interview prep ─────────────────────────────────────── */}
          <section style={{ marginTop: 56 }}>
            <h2 style={{ ...serif, fontSize: 28, fontWeight: 400, letterSpacing: "-0.01em", margin: "0 0 8px" }}>
              HR interview preparation for freshers
            </h2>
            <p style={{ fontSize: 14, color: sand, margin: "0 0 20px", lineHeight: 1.6 }}>
              Every campus process ends with an HR round. These three questions appear in 95%+ of
              fresher HR interviews across all service companies.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
              {HR_PREP.map((item) => (
                <Link key={item.href} href={item.href} style={{
                  ...card, padding: "20px 22px", textDecoration: "none", color: "inherit", display: "block",
                }}>
                  <div style={{ ...mono, fontSize: 10, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: copper, marginBottom: 8 }}>
                    HR Round · Freshers
                  </div>
                  <h3 style={{ ...serif, fontSize: 16, fontWeight: 400, margin: "0 0 8px", letterSpacing: "-0.01em", color: coal }}>
                    {item.title}
                  </h3>
                  <p style={{ fontSize: 13, color: sand, margin: "0 0 14px", lineHeight: 1.55 }}>{item.desc}</p>
                  <span style={{ color: copper, fontSize: 13, fontWeight: 500 }}>Practice with AI →</span>
                </Link>
              ))}
            </div>
          </section>

          {/* ── Preparation timeline ──────────────────────────────────── */}
          <section style={{ marginTop: 56 }}>
            <h2 style={{ ...serif, fontSize: 28, fontWeight: 400, letterSpacing: "-0.01em", margin: "0 0 8px" }}>
              How long does preparation take?
            </h2>
            <p style={{ fontSize: 14, color: sand, margin: "0 0 20px", lineHeight: 1.6 }}>
              Service company placements have a shorter prep window than product companies.
              Allocate your time by round.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              {[
                { round: "Aptitude / Online Test", time: "3–4 weeks", note: "Daily practice sets: quantitative, reasoning, verbal. Use company-specific mock tests." },
                { round: "Technical Interview", time: "2–3 weeks", note: "CS fundamentals: OS, DBMS, OOP, CN. One coding problem per day in your primary language." },
                { round: "HR Interview", time: "3–5 days", note: "Prepare 5 structured answers, practice aloud. Time your 'tell me about yourself' — must be under 90 seconds." },
              ].map((row) => (
                <div key={row.round} style={{ ...card, padding: "16px 18px" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: coal, marginBottom: 4 }}>{row.round}</div>
                  <div style={{ ...mono, fontSize: 18, fontWeight: 700, color: copper, marginBottom: 6 }}>{row.time}</div>
                  <p style={{ fontSize: 12, color: sand, margin: 0, lineHeight: 1.55 }}>{row.note}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── Blog resources ────────────────────────────────────────── */}
          <section style={{ marginTop: 56 }}>
            <h2 style={{ ...serif, fontSize: 28, fontWeight: 400, letterSpacing: "-0.01em", margin: "0 0 8px" }}>
              Campus placement blog resources
            </h2>
            <p style={{ fontSize: 14, color: sand, margin: "0 0 16px", lineHeight: 1.6 }}>
              Deep-dive articles for specific companies and topics.
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 8 }}>
              {CAMPUS_BLOG_POSTS.map((post) => (
                <li key={post.href}>
                  <Link href={post.href} style={{
                    display: "block", padding: "12px 16px",
                    background: t.creamRaised, border: `1px solid ${t.line}`, borderRadius: 8,
                    textDecoration: "none", color: coal, fontSize: 13, lineHeight: 1.4,
                  }}>
                    {post.label} →
                  </Link>
                </li>
              ))}
            </ul>
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

          {/* ── Bottom CTA ───────────────────────────────────────────── */}
          <section style={{
            marginTop: 56, padding: "32px 28px",
            background: t.creamSoft, borderRadius: 16, textAlign: "center",
          }}>
            <h2 style={{ ...serif, fontSize: 26, fontWeight: 400, margin: 0, letterSpacing: "-0.01em" }}>
              Practice before placement season begins.
            </h2>
            <p style={{ fontSize: 14, color: sand, margin: "10px 0 20px", lineHeight: 1.5, maxWidth: 480, marginInline: "auto" }}>
              The AI interviewer asks the same questions you'll face — aptitude, technical, and HR.
              It scores your answers and gives you specific feedback. Two sessions free, no card required.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/signup?source=for-students-cta" style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: copper, color: cream, textDecoration: "none",
                padding: "14px 28px", borderRadius: 999, fontSize: 15, fontWeight: 500,
              }}>
                Start free practice → 2 sessions, no card
              </Link>
              <Link href="/interview-prep" style={{
                display: "inline-flex", alignItems: "center",
                color: copper, textDecoration: "none", padding: "14px 16px", fontSize: 14, fontWeight: 500,
              }}>
                Full interview prep guide
              </Link>
              <Link href="/ai-mock-interview" style={{
                display: "inline-flex", alignItems: "center",
                color: copper, textDecoration: "none", padding: "14px 16px", fontSize: 14, fontWeight: 500,
              }}>
                How AI mock interviews work
              </Link>
            </div>
          </section>

        </div>
      </main>
      <FooterDome />
      <MobileStickyCTA />
    </>
  );
}
