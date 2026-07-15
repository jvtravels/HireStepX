/* HireStepX — /questions/* page components
 *
 * QuestionSetPage  — individual question-set page (/questions/[slug])
 * QuestionsIndexPage — directory listing (/questions)
 *
 * These are SERVER components (no "use client") — they render to static
 * HTML at build time via force-static + generateStaticParams. That means
 * no client-side JS, fast LCP, and max crawlability.
 *
 * Visual language: cream background, coal ink, copper accents, Instrument
 * Serif for display + Satoshi for UI — same token stack as the rest of the
 * marketing site. No raw hex values; all colours from src/auth/_tokens.ts.
 */

import type { CSSProperties } from "react";
import Link from "next/link";
import { tokens as t, fonts } from "../auth/_tokens";
import {
  editorialCSS,
  SectionHead,
  SpecTimeline,
  DarkBand,
  ctaPrimaryStyle,
  edEyebrow,
  ED_PADDING,
} from "./_editorial";
import { COMPANY_LABEL } from "../../data/company-labels";
import { COMPANY_KNOWN_FACTS } from "../../data/company-known-facts";
import type { BankEntry } from "../../data/interview-question-bank";
import { SEO_PAGES } from "../../data/seo-pages";
import type { SeoPage } from "../../data/seo-pages";

/* ─── Shared layout primitives ─────────────────────────────────────────── */

const pageShell: CSSProperties = {
  background: t.cream,
  color: t.coal,
  minHeight: "100dvh",
  fontFamily: fonts.sans,
};

/* ─── Difficulty chip ───────────────────────────────────────────────────── */

const DIFFICULTY_STYLES: Record<string, CSSProperties> = {
  warmup: {
    background: t.success100,
    color: t.success,
    border: "1px solid rgba(21,128,61,0.15)",
  },
  standard: {
    background: t.warning100,
    color: t.warning,
    border: `1px solid ${t.warningLine}`,
  },
  intense: {
    background: t.error100,
    color: t.error,
    border: "1px solid rgba(185,28,28,0.15)",
  },
};

const DIFFICULTY_LABEL: Record<string, string> = {
  warmup: "Easy",
  standard: "Medium",
  intense: "Hard",
};

function DifficultyChip({ difficulty }: { difficulty?: string }) {
  if (!difficulty) return null;
  const style = DIFFICULTY_STYLES[difficulty] ?? {};
  return (
    <span
      style={{
        ...style,
        fontFamily: fonts.sans,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        padding: "2px 8px",
        borderRadius: 999,
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {DIFFICULTY_LABEL[difficulty] ?? difficulty}
    </span>
  );
}

/* ─── Single question card ──────────────────────────────────────────────── */

interface QuestionCardProps {
  question: BankEntry;
  index: number;
  practiceHref: string;
  showSignupGate: boolean;
}

function QuestionCard({ question, index, practiceHref }: Omit<QuestionCardProps, "showSignupGate">) {
  return (
    <li
      className="ed-row"
      style={{
        position: "relative",
        display: "flex",
        gap: 20,
        padding: "20px 8px",
        margin: "0 -8px",
        borderBottom: `1px solid ${t.line}`,
        overflow: "hidden",
      }}
    >
      {/* Large serif number */}
      <span style={{ fontFamily: fonts.serif, fontSize: 28, fontWeight: 400, color: t.copper, lineHeight: 1, flexShrink: 0, minWidth: 38, opacity: 0.55 }}>
        {String(index + 1).padStart(2, "0")}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Difficulty chip */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <DifficultyChip difficulty={question.difficulty} />
        </div>

        {/* Question text */}
        <p style={{ fontFamily: fonts.serif, fontSize: 17, lineHeight: 1.5, color: t.coal, margin: 0 }}>
          {question.text}
        </p>
      </div>

      {/* Inline practice link */}
      <Link
        href={practiceHref}
        style={{ flexShrink: 0, color: t.copper, textDecoration: "none", fontFamily: fonts.sans, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", padding: "8px 0 8px 12px" }}
      >
        Practice free →
      </Link>
    </li>
  );
}

/* Single paywall gate that overlays the bottom portion of the question list */
function QuestionGate({ practiceHref, hiddenCount }: { practiceHref: string; hiddenCount: number }) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: "min(520px, 80%)",
        pointerEvents: "none",
        zIndex: 3,
      }}
    >
      {/* Gradient fade from transparent → cream */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: `linear-gradient(to bottom, transparent 0%, ${t.cream} 42%)`,
      }} />
      {/* CTA panel — sits in the lower half */}
      <div style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-end",
        paddingBottom: 32,
        gap: 14,
        pointerEvents: "auto",
      }}>
        <p style={{ fontFamily: fonts.sans, fontSize: 14, color: t.inkSoft, margin: 0, textAlign: "center" }}>
          {hiddenCount} more question{hiddenCount !== 1 ? "s" : ""} — sign up to unlock all
        </p>
        <Link
          href={practiceHref}
          className="ed-cta"
          style={{ ...ctaPrimaryStyle("lg"), textDecoration: "none" }}
        >
          Sign up free — unlock all questions <span className="ed-cta-arrow" aria-hidden>→</span>
        </Link>
      </div>
    </div>
  );
}


/* CompanyContextBox — renders verified company facts (description /
   products / competitors / scale) from COMPANY_KNOWN_FACTS. Only the
   neutral, publicly-verifiable fields are surfaced; interview-signal
   `notes`/`themes`/`techHints` are deliberately omitted. Renders nothing
   when the company has no known-facts entry. */
export function CompanyContextBox({ company, companyLabel }: { company: string; companyLabel: string }) {
  const facts = COMPANY_KNOWN_FACTS[company];
  if (!facts) return null;

  const rows: Array<{ label: string; value: string }> = [];
  if (facts.products?.length) rows.push({ label: "Products", value: facts.products.join(" · ") });
  if (facts.competitors?.length) rows.push({ label: "Competitors", value: facts.competitors.join(" · ") });
  if (facts.scale) rows.push({ label: "Scale", value: facts.scale });

  return (
    <section style={{ marginTop: 36, background: t.creamSoft, border: `1px solid ${t.line}`, borderRadius: 12, padding: "20px 22px" }}>
      <p style={{ fontFamily: fonts.sans, fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: t.copper, margin: "0 0 10px" }}>
        About {companyLabel}
      </p>
      <p style={{ fontFamily: fonts.sans, fontSize: 15, lineHeight: 1.65, color: t.inkSoft, margin: 0 }}>
        {facts.description}
      </p>
      {rows.length > 0 && (
        <dl style={{ margin: "16px 0 0", display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map(({ label, value }) => (
            <div key={label} style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
              <dt style={{ flexShrink: 0, minWidth: 96, fontFamily: fonts.sans, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: t.inkFaint }}>
                {label}
              </dt>
              <dd style={{ flex: 1, minWidth: 200, margin: 0, fontFamily: fonts.sans, fontSize: 13.5, lineHeight: 1.55, color: t.coal }}>
                {value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

/* ─── QuestionSetPage — the main export for /questions/[slug] ─────────── */

export interface QuestionSetPageProps {
  slug: string;
  page: SeoPage;
  questions: BankEntry[];
  companyLabel: string;
  focusLabel: string;
  relatedPages: { slug: string; searchPhrase: string }[];
  relatedBlogPosts?: { slug: string; title: string }[];
  salaryPageSlug?: string;
}

export function QuestionSetPage({
  slug: _slug,
  page,
  questions,
  companyLabel,
  focusLabel,
  relatedPages,
  relatedBlogPosts = [],
  salaryPageSlug,
}: QuestionSetPageProps) {
  const practiceHref = `/signup?source=questions-seo&company=${encodeURIComponent(page.company)}&focus=${encodeURIComponent(page.focus)}${page.roleFamily ? `&role=${encodeURIComponent(page.roleFamily)}` : ""}`;

  /* Show first 5 free; gate the rest behind a signup prompt. */
  const showSignupGate = questions.length > 5;

  /* Difficulty breakdown for the stats sidebar */
  const diffCounts = { easy: 0, medium: 0, hard: 0 };
  for (const q of questions) {
    if (q.difficulty === "warmup") diffCounts.easy++;
    else if (q.difficulty === "intense") diffCounts.hard++;
    else diffCounts.medium++;
  }
  const roundCount = page.interviewRounds?.length ?? page.recruitmentSteps?.length ?? null;

  /* First sentence of intro — shown in hero, full intro in body */
  const introFirst = (() => {
    const dot = page.intro.indexOf(". ");
    return dot > -1 ? page.intro.slice(0, dot + 1) : page.intro.slice(0, 180);
  })();

  return (
    <>
      <style>{editorialCSS + `
        @media (max-width: 900px) {
          .qs-body { flex-direction: column !important; }
          .qs-sidebar { position: static !important; width: 100% !important; }
        }
      `}</style>
      <main style={pageShell}>

        {/* ── Hero — two-column split ───────────────────────────────────── */}
        <header style={{ background: t.cream, paddingTop: 80, paddingBottom: 64, borderBottom: `1px solid ${t.line}` }}>
          <div className="ed-container">

            {/* Back link */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32 }}>
              <Link href="/questions" style={{ fontFamily: fonts.sans, fontSize: 13, color: t.inkFaint, textDecoration: "none" }}>
                ← All companies
              </Link>
              <span style={{ color: t.line }}>·</span>
              <span style={{ fontFamily: fonts.sans, fontSize: 13, fontWeight: 600, color: t.coal }}>{companyLabel}</span>
              <span style={{ color: t.line }}>·</span>
              <span style={{ fontFamily: fonts.sans, fontSize: 13, color: t.inkFaint }}>{focusLabel}</span>
            </div>

            <h1 style={{
              fontFamily: fonts.serif,
              fontSize: "clamp(32px, 4.2vw, 56px)",
              fontWeight: 400, lineHeight: 1.06,
              letterSpacing: "-0.026em",
              color: t.coal, margin: "0 0 22px",
            }}>
              {page.searchPhrase}
            </h1>
            <p style={{ fontFamily: fonts.sans, fontSize: 17, lineHeight: 1.65, color: t.inkSoft, margin: "0 0 36px", maxWidth: "58ch" }}>
              {introFirst}
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <Link href={practiceHref} className="ed-cta" style={ctaPrimaryStyle("lg")}>
                Practice with AI voice feedback <span className="ed-cta-arrow" aria-hidden>→</span>
              </Link>
              <span style={{ fontFamily: fonts.sans, fontSize: 13, color: t.inkFaint }}>
                {questions.length} questions · {focusLabel} · 2 sessions free
              </span>
            </div>
          </div>
        </header>

        {/* ── Two-column body ───────────────────────────────────────────── */}
        <div className="ed-container qs-body" style={{ display: "flex", gap: 64, paddingTop: 64, paddingBottom: 80, alignItems: "flex-start" }}>

          {/* Left: main content */}
          <div style={{ flex: 1, minWidth: 0 }}>

            <CompanyContextBox company={page.company} companyLabel={companyLabel} />

            {/* Recruitment process */}
            {page.recruitmentSteps && page.recruitmentSteps.length > 0 && (
              <section className="ed-reveal" style={{ marginTop: 56 }}>
                <SectionHead title={`${companyLabel} recruitment process`} />
                <SpecTimeline items={page.recruitmentSteps.map((step) => ({ label: step }))} />
              </section>
            )}

            {/* Interview rounds */}
            {page.interviewRounds && page.interviewRounds.length > 0 && (
              <section className="ed-reveal" style={{ marginTop: 48 }}>
                <SectionHead title="What to expect in each round" />
                <SpecTimeline
                  items={page.interviewRounds.map((round, i) => {
                    const colonIdx = round.indexOf(":");
                    const title = colonIdx > -1 ? round.slice(0, colonIdx) : `Round ${i + 1}`;
                    const detail = colonIdx > -1 ? round.slice(colonIdx + 1).trim() : round;
                    return { label: title, body: detail };
                  })}
                />
              </section>
            )}

            {/* STAR method — behavioral / HR / campus */}
            {(page.focus === "behavioral" || page.focus === "hr" || page.focus === "campus-placement") && (
              <section className="ed-reveal" style={{ marginTop: 48 }}>
                <SectionHead title="How to structure your answers" />
                <div style={{ background: t.creamSoft, border: `1px solid ${t.copperMid}`, borderRadius: 16, padding: "24px 26px" }}>
                  <p style={{ fontFamily: fonts.sans, fontSize: 14, color: t.inkSoft, margin: "0 0 18px", lineHeight: 1.6 }}>
                    {companyLabel} interviewers score answers on structure and specificity, not just content. Use the STAR method for every behavioural question.
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 20 }}>
                    {[
                      { letter: "S", label: "Situation", text: "Set up the context in 1–2 sentences. Give just enough background for the story to make sense." },
                      { letter: "T", label: "Task", text: "State your personal responsibility. What were YOU specifically accountable for, not the team." },
                      { letter: "A", label: "Action", text: "This is the longest part. Describe the specific steps you took. Use 'I' not 'we'." },
                      { letter: "R", label: "Result", text: "Quantify if possible: numbers, percentages, timeline improvement. Then say what you learnt." },
                    ].map(({ letter, label, text }) => (
                      <div key={letter} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <span style={{ fontFamily: fonts.serif, fontSize: 30, fontStyle: "italic", fontWeight: 400, color: t.copper, lineHeight: 1 }}>{letter}</span>
                        <span style={{ fontFamily: fonts.sans, fontSize: 11, fontWeight: 700, color: t.coal, letterSpacing: "0.06em", textTransform: "uppercase" as const }}>{label}</span>
                        <span style={{ fontFamily: fonts.sans, fontSize: 13, color: t.inkSoft, lineHeight: 1.55 }}>{text}</span>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontFamily: fonts.sans, fontSize: 12, color: t.inkFaint, margin: "20px 0 0", lineHeight: 1.55, borderTop: `1px solid ${t.line}`, paddingTop: 14 }}>
                    <strong style={{ color: t.coal }}>Common mistake:</strong> Saying &quot;we did X&quot; throughout. Interviewers score your individual contribution. If you can&apos;t separate what you did from what the team did, it signals low ownership.
                  </p>
                </div>
                {(page.focus === "campus-placement" || page.focus === "hr") && (
                  <p style={{ fontFamily: fonts.sans, fontSize: 13, color: t.inkFaint, margin: "16px 0 0", lineHeight: 1.5 }}>
                    Preparing for a campus placement drive?{" "}
                    <Link href="/for-students" style={{ color: t.copper, fontWeight: 500, textDecoration: "none" }}>See the full campus placement guide →</Link>
                  </p>
                )}
              </section>
            )}

            {/* Question list */}
            <section className="ed-reveal" style={{ marginTop: 56 }}>
              <SectionHead
                title={`${focusLabel} questions ${companyLabel} asked`}
                sub="Verified from 2+ candidate post-mortems. Hit Practice to answer any one with AI voice feedback."
              />
              <div style={{ position: "relative" }}>
                <ol role="list" style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                  {questions.map((q, i) => (
                    <QuestionCard key={i} question={q} index={i} practiceHref={practiceHref} />
                  ))}
                </ol>
                {showSignupGate && questions.length > 5 && (
                  <QuestionGate practiceHref={practiceHref} hiddenCount={questions.length - 5} />
                )}
              </div>
            </section>

          </div>

          {/* Right: sticky sidebar */}
          <div className="qs-sidebar" style={{ flexShrink: 0, width: 280, position: "sticky", top: 24, display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Dark CTA card */}
            <div style={{ background: t.coal, borderRadius: 16, padding: "28px 24px" }}>
              <p style={{ fontFamily: fonts.serif, fontSize: 20, fontWeight: 400, color: t.cream, lineHeight: 1.3, margin: "0 0 18px", letterSpacing: "-0.01em" }}>
                Practice answering these out loud.
              </p>
              <Link href={practiceHref} className="ed-cta" style={{ ...ctaPrimaryStyle("md"), display: "block", textAlign: "center" as const, textDecoration: "none" }}>
                Start free — 2 sessions →
              </Link>
              <p style={{ fontFamily: fonts.sans, fontSize: 12, color: t.inkFaint, margin: "10px 0 0", textAlign: "center" as const }}>
                No credit card required
              </p>
            </div>

            {/* Framework card */}
            <div style={{ background: t.creamSoft, border: `1px solid ${t.line}`, borderRadius: 16, padding: "22px 22px" }}>
              <div style={{ fontFamily: fonts.sans, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: t.inkFaint, marginBottom: 10 }}>
                Answer framework
              </div>
              <div style={{ fontFamily: fonts.serif, fontSize: 17, fontWeight: 400, color: t.coal, lineHeight: 1.3, marginBottom: 12 }}>
                {page.framework.name}
              </div>
              <p style={{ fontFamily: fonts.sans, fontSize: 13, color: t.inkSoft, lineHeight: 1.6, margin: 0 }}>
                {page.framework.summary.length > 160
                  ? page.framework.summary.slice(0, page.framework.summary.lastIndexOf(" ", 160)) + "…"
                  : page.framework.summary}
              </p>
            </div>

            {/* Stats card */}
            <div style={{ background: t.creamSoft, border: `1px solid ${t.line}`, borderRadius: 16, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontFamily: fonts.sans, fontSize: 13, color: t.inkSoft }}>Questions</span>
                <span style={{ fontFamily: fonts.serif, fontSize: 22, fontWeight: 400, color: t.coal, letterSpacing: "-0.02em" }}>{questions.length}</span>
              </div>
              {roundCount && roundCount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderTop: `1px solid ${t.line}`, paddingTop: 14 }}>
                  <span style={{ fontFamily: fonts.sans, fontSize: 13, color: t.inkSoft }}>Interview rounds</span>
                  <span style={{ fontFamily: fonts.serif, fontSize: 22, fontWeight: 400, color: t.coal, letterSpacing: "-0.02em" }}>{roundCount}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderTop: `1px solid ${t.line}`, paddingTop: 14 }}>
                <span style={{ fontFamily: fonts.sans, fontSize: 13, color: t.inkSoft }}>Difficulty</span>
                <span style={{ fontFamily: fonts.sans, fontSize: 13, fontWeight: 600, color: t.coal }}>
                  {diffCounts.hard > diffCounts.easy ? "Hard" : diffCounts.easy > diffCounts.hard ? "Easy" : "Mixed"}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderTop: `1px solid ${t.line}`, paddingTop: 14 }}>
                <span style={{ fontFamily: fonts.sans, fontSize: 13, color: t.inkSoft }}>Focus</span>
                <span style={{ fontFamily: fonts.sans, fontSize: 13, fontWeight: 600, color: t.coal }}>{focusLabel}</span>
              </div>
            </div>

            {/* Related links */}
            {(relatedPages.length > 0 || relatedBlogPosts.length > 0 || salaryPageSlug) && (
              <div style={{ borderTop: `1px solid ${t.line}`, paddingTop: 20 }}>
                <div style={{ fontFamily: fonts.sans, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: t.inkFaint, marginBottom: 12 }}>
                  Related prep
                </div>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                  {relatedPages.map((p) => (
                    <li key={p.slug}>
                      <Link href={`/questions/${p.slug}`} className="ed-link" style={{ fontFamily: fonts.sans, fontSize: 13, color: t.copper, textDecoration: "none", lineHeight: 1.4, display: "block" }}>
                        {p.searchPhrase}
                      </Link>
                    </li>
                  ))}
                  {relatedBlogPosts.map((post) => (
                    <li key={post.slug}>
                      <Link href={`/blog/${post.slug}`} className="ed-link" style={{ fontFamily: fonts.sans, fontSize: 13, color: t.copper, textDecoration: "none", lineHeight: 1.4, display: "block" }}>
                        {post.title}
                      </Link>
                    </li>
                  ))}
                  {salaryPageSlug && (
                    <li>
                      <Link href={`/salary/${salaryPageSlug}`} className="ed-link" style={{ fontFamily: fonts.sans, fontSize: 13, color: t.copper, textDecoration: "none", lineHeight: 1.4, display: "block" }}>
                        {companyLabel} Salary Guide India 2026 →
                      </Link>
                    </li>
                  )}
                </ul>
              </div>
            )}

          </div>

        </div>

        {/* Closing CTA */}
        <DarkBand eyebrow="Reading won't get you hired" title="Stop reading," accent="start answering." videoSrc="/cta.mp4">
          <p style={{ fontFamily: fonts.sans, fontSize: 16, color: t.creamMuted, lineHeight: 1.65, maxWidth: "36ch", margin: 0 }}>
            The AI asks {companyLabel}-style questions, listens to your voice, and scores your answer in two minutes.
            {" "}2 sessions free, no card.
          </p>
          <Link href={practiceHref} className="ed-cta" style={ctaPrimaryStyle("lg")}>
            Start free practice <span className="ed-cta-arrow" aria-hidden>→</span>
          </Link>
        </DarkBand>

      </main>
    </>
  );
}

/* ─── QuestionsIndexPage — directory listing at /questions ──────────────── */

export interface QuestionsIndexPageProps {
  pages: Array<{
    slug: string;
    searchPhrase: string;
    company: string;
    focus: string;
    intro: string;
    sitemapPriority?: number;
  }>;
  activeFilter?: string;
}

const FOCUS_DISPLAY: Record<string, string> = {
  behavioral: "Behavioural", technical: "Technical", "system-design": "System Design",
  "case-study": "Case Study", "campus-placement": "Campus Placement",
  hr: "HR Round", "salary-negotiation": "Salary Negotiation",
  leadership: "Leadership", general: "General", management: "Management",
  "government-psu": "Government / PSU", strategic: "Strategic",
};

export function QuestionsIndexPage({ pages, activeFilter }: QuestionsIndexPageProps) {
  /* Group by company for a cleaner layout. */
  const grouped = pages.reduce<Record<string, typeof pages>>((acc, p) => {
    const key = p.company;
    (acc[key] ??= []).push(p);
    return acc;
  }, {});

  const companies = Object.keys(grouped).sort();

  return (
    <>
      <style>{editorialCSS}</style>
      <main style={pageShell}>
        {/* ── Two-column hero ───────────────────────────────────────── */}
        <header style={{ paddingTop: ED_PADDING.heroTop, paddingBottom: ED_PADDING.heroBottom, borderBottom: `1px solid ${t.line}`, background: t.cream }}>
          <div className="ed-container">
            <div style={{ display: "flex", gap: 72, alignItems: "flex-start" }}>

              {/* Left: heading + lead + CTA */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ ...edEyebrow, margin: "0 0 20px" }}>Interview questions · India 2026</p>
                <h1 style={{ fontFamily: fonts.serif, fontSize: "clamp(38px, 4.8vw, 60px)", fontWeight: 400, lineHeight: 1.05, letterSpacing: "-0.028em", color: t.coal, margin: "0 0 24px" }}>
                  Real interview questions,{" "}
                  <em style={{ fontStyle: "italic", color: t.copper }}>answered out loud.</em>
                </h1>
                <p style={{ fontFamily: fonts.sans, fontSize: 16, lineHeight: 1.65, color: t.inkSoft, margin: "0 0 36px", maxWidth: "44ch" }}>
                  {pages.length} question sets across the top Indian and global companies — verified questions you can practice answering with an AI interviewer in two minutes.
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                  <Link href="/signup?source=questions-index" className="ed-cta" style={ctaPrimaryStyle("lg")}>
                    Start free practice <span className="ed-cta-arrow" aria-hidden>→</span>
                  </Link>
                  <span style={{ fontFamily: fonts.sans, fontSize: 14, color: t.inkFaint }}>2 sessions, no card</span>
                </div>
              </div>

              {/* Right: company category stat panel */}
              <nav aria-label="Browse company categories" style={{ flexShrink: 0, width: 340, background: t.creamSoft, border: `1px solid ${t.line}`, borderRadius: 16, overflow: "hidden" }}>
                <div style={{ padding: "22px 24px 18px", borderBottom: `1px solid ${t.line}` }}>
                  <p style={{ fontFamily: fonts.serif, fontSize: 40, fontWeight: 400, color: t.coal, lineHeight: 1, margin: "0 0 4px", letterSpacing: "-0.02em" }}>
                    {pages.length}
                  </p>
                  <p style={{ fontFamily: fonts.sans, fontSize: 13, color: t.inkFaint, margin: 0 }}>
                    question sets · 30+ companies
                  </p>
                </div>
                {[
                  { label: "Service IT", hint: "TCS · Infosys · Wipro", focus: "campus-placement" },
                  { label: "Indian Product", hint: "Flipkart · Razorpay · Swiggy", focus: "technical" },
                  { label: "FAANG & Global", hint: "Google · Amazon · Microsoft", focus: "system-design" },
                  { label: "Consulting", hint: "McKinsey · BCG · Deloitte", focus: "case-study" },
                  { label: "Freshers & HR", hint: "All campus drives · HR rounds", focus: "hr" },
                ].map(({ label, hint, focus }, i, arr) => (
                  <Link
                    key={label}
                    href={`/questions?focus=${focus}`}
                    className="ed-cta ed-row"
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 24px", textDecoration: "none", borderBottom: i < arr.length - 1 ? `1px solid ${t.line}` : "none", borderRadius: 0 }}
                  >
                    <span style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: 14, color: t.copper, opacity: 0.6, lineHeight: 1, flexShrink: 0, width: 16 }}>{i + 1}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontFamily: fonts.sans, fontSize: 13, fontWeight: 600, color: t.coal, lineHeight: 1.3 }}>{label}</span>
                      <span style={{ display: "block", fontFamily: fonts.sans, fontSize: 11, color: t.inkFaint, marginTop: 1 }}>{hint}</span>
                    </span>
                    <span style={{ fontFamily: fonts.sans, fontSize: 12, color: t.copper, flexShrink: 0 }} aria-hidden>→</span>
                  </Link>
                ))}
              </nav>

            </div>
          </div>
        </header>

        <div className="ed-container" style={{ paddingTop: 56, paddingBottom: 8 }}>
          {/* Filter chip bar — browse by question type */}
          {(() => {
            /* Count pages per focus across ALL SEO pages (not just filtered set) */
            const focusCounts = SEO_PAGES.reduce<Record<string, number>>((acc, p) => {
              acc[p.focus] = (acc[p.focus] ?? 0) + 1;
              return acc;
            }, {});
            /* Order chips by relevance to Indian freshers */
            const CHIP_ORDER = [
              "campus-placement", "hr", "behavioral", "technical",
              "system-design", "case-study", "salary-negotiation",
            ];
            return (
              <div style={{ marginBottom: 48 }}>
                <p style={{ fontFamily: fonts.sans, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.inkFaint, margin: "0 0 14px" }}>
                  Browse by type
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {/* All chip */}
                  <Link
                    href="/questions"
                    className={`ed-cta${!activeFilter ? "" : " ed-tab"}`}
                    style={{
                      fontFamily: fonts.sans, fontSize: 13, fontWeight: 600,
                      padding: "6px 14px", borderRadius: 999, textDecoration: "none",
                      border: `1px solid ${!activeFilter ? t.copper : t.line}`,
                      background: !activeFilter ? t.copper : "transparent",
                      color: !activeFilter ? "#fff" : t.inkSoft,
                      whiteSpace: "nowrap",
                    }}
                  >
                    All · {SEO_PAGES.length}
                  </Link>
                  {CHIP_ORDER.filter(f => focusCounts[f]).map(f => {
                    const isActive = activeFilter === f;
                    return (
                      <Link
                        key={f}
                        href={`/questions?focus=${f}`}
                        className={`ed-cta${isActive ? "" : " ed-tab"}`}
                        style={{
                          fontFamily: fonts.sans, fontSize: 13, fontWeight: 600,
                          padding: "6px 14px", borderRadius: 999, textDecoration: "none",
                          border: `1px solid ${isActive ? t.copper : t.line}`,
                          background: isActive ? t.copper : "transparent",
                          color: isActive ? "#fff" : t.inkSoft,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {FOCUS_DISPLAY[f] ?? f} · {focusCounts[f]}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Grouped question sets — compact rule-divider per company */}
          {companies.map((company) => (
            <section key={company} className="ed-reveal" style={{ marginBottom: 40 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 4, paddingTop: 16 }}>
                <span style={{ fontFamily: fonts.sans, fontSize: 13, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: t.coal, whiteSpace: "nowrap" }}>
                  {COMPANY_LABEL[company] ?? company.charAt(0).toUpperCase() + company.slice(1)}
                </span>
                <span style={{ fontFamily: fonts.sans, fontSize: 11, fontWeight: 600, color: t.inkFaint, whiteSpace: "nowrap" }}>
                  · {grouped[company].length} {grouped[company].length === 1 ? "set" : "sets"}
                </span>
                <div style={{ flex: 1, height: 1, background: t.line }} />
              </div>
              <ol role="list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {grouped[company].map((p, i) => (
                  <li key={p.slug}>
                    <Link
                      href={`/questions/${p.slug}`}
                      className="ed-cta ed-row"
                      style={{
                        display: "flex",
                        gap: 22,
                        padding: "18px 8px",
                        borderBottom: `1px solid ${t.line}`,
                        textDecoration: "none",
                        alignItems: "flex-start",
                        margin: "0 -8px",
                      }}
                    >
                      <span style={{ fontFamily: fonts.serif, fontSize: 22, fontStyle: "italic", color: t.copper, opacity: 0.5, lineHeight: 1, flexShrink: 0, minWidth: 34 }}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontFamily: fonts.sans, fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: t.inkFaint }}>
                          {p.focus.replace(/-/g, " ")}
                        </span>
                        <p style={{ fontFamily: fonts.serif, fontSize: 18, lineHeight: 1.32, color: t.coal, margin: "5px 0 0", letterSpacing: "-0.01em" }}>
                          {p.searchPhrase}
                        </p>
                      </div>
                      <span style={{ fontFamily: fonts.sans, fontSize: 13, fontWeight: 600, color: t.copper, flexShrink: 0, paddingTop: 3, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 6 }}>
                        View <span className="ed-cta-arrow" aria-hidden>→</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>

        {/* Closing CTA — full-bleed coal band */}
        <DarkBand eyebrow="Stop just reading" title="Start" accent="answering." videoSrc="/cta.mp4">
          <p style={{ fontFamily: fonts.sans, fontSize: 16, color: t.creamMuted, lineHeight: 1.65, maxWidth: "36ch", margin: 0 }}>
            AI voice interviewer, real-time answer scoring, STAR framework coaching. 2 free sessions, no credit card required.
          </p>
          <Link href="/signup?source=questions-index-bottom" className="ed-cta" style={ctaPrimaryStyle("lg")}>
            Start free practice <span className="ed-cta-arrow" aria-hidden>→</span>
          </Link>
        </DarkBand>
      </main>
    </>
  );
}
