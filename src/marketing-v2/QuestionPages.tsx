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
  EditorialHero,
  SectionHead,
  SpecTimeline,
  DarkBand,
  ctaPrimaryStyle,
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

function QuestionCard({ question, index, practiceHref, showSignupGate }: QuestionCardProps) {
  const isBlurred = showSignupGate && index >= 5;

  return (
    <li
      style={{
        position: "relative",
        display: "flex",
        gap: 20,
        padding: "20px 0",
        borderBottom: `1px solid ${t.line}`,
        overflow: "hidden",
      }}
    >
      {/* Blur gate overlay for questions 6+ */}
      {isBlurred && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backdropFilter: "blur(6px)",
            background: "rgba(250,247,240,0.78)",
            zIndex: 2,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
          }}
        >
          <p style={{ fontFamily: fonts.sans, fontSize: 14, color: t.inkSoft, margin: 0, textAlign: "center" }}>
            Sign up to see this question + practice with voice AI
          </p>
          <Link
            href={practiceHref}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, background: t.copper, color: t.cream, textDecoration: "none", padding: "10px 20px", borderRadius: 999, fontFamily: fonts.sans, fontSize: 13, fontWeight: 600 }}
          >
            Sign up free →
          </Link>
        </div>
      )}

      {/* Large serif number */}
      <span style={{ fontFamily: fonts.serif, fontSize: 28, fontWeight: 400, color: t.copper, lineHeight: 1, flexShrink: 0, minWidth: 38, opacity: 0.55 }}>
        {String(index + 1).padStart(2, "0")}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Difficulty chip */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <DifficultyChip difficulty={question.difficulty} />
        </div>

        {/* Question text — no answers, to create desire to practice */}
        <p style={{ fontFamily: fonts.serif, fontSize: 17, lineHeight: 1.5, color: t.coal, margin: 0 }}>
          {question.text}
        </p>
      </div>

      {/* Inline practice link */}
      {!isBlurred && (
        <Link
          href={practiceHref}
          style={{ flexShrink: 0, color: t.copper, textDecoration: "none", fontFamily: fonts.sans, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", padding: "8px 0 8px 12px" }}
        >
          Practice free →
        </Link>
      )}
    </li>
  );
}

/* ─── Framework callout box ─────────────────────────────────────────────── */

function FrameworkBox({ name, summary }: { name: string; summary: string }) {
  return (
    <section style={{ marginTop: 40 }}>
      <p style={{ fontFamily: fonts.sans, fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: t.copper, margin: "0 0 10px" }}>
        Framework to use
      </p>
      <h2 style={{ fontFamily: fonts.serif, fontSize: 22, fontWeight: 400, margin: "0 0 10px", letterSpacing: "-0.01em", color: t.coal }}>
        {name}
      </h2>
      <p style={{ fontFamily: fonts.sans, fontSize: 15, lineHeight: 1.65, color: t.inkSoft, margin: 0 }}>
        {summary}
      </p>
    </section>
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
}

export function QuestionSetPage({
  slug: _slug,
  page,
  questions,
  companyLabel,
  focusLabel,
  relatedPages,
  relatedBlogPosts = [],
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
      <style>{editorialCSS}</style>
      <main style={pageShell}>

        {/* ── Custom two-column hero ─────────────────────────────────── */}
        <header className="ed-hero" style={{ background: t.cream }}>
          <div className="ed-container">

            {/* Breadcrumb */}
            <nav aria-label="Breadcrumb" style={{ fontFamily: fonts.sans, fontSize: 13, color: t.inkFaint, marginBottom: 28 }}>
              <Link href="/" style={{ color: t.inkFaint, textDecoration: "none" }}>Home</Link>
              {" / "}
              <Link href="/questions" style={{ color: t.inkFaint, textDecoration: "none" }}>Questions</Link>
              {" / "}
              <span aria-current="page">{focusLabel}</span>
            </nav>

            {/* Two-column split */}
            <div className="ed-split" style={{ display: "flex", gap: 72, alignItems: "flex-start" }}>

              {/* Left: eyebrow → h1 → lead → CTA */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontFamily: fonts.sans, fontSize: 12, fontWeight: 700,
                  letterSpacing: "0.12em", textTransform: "uppercase",
                  color: t.inkFaint, margin: "0 0 18px",
                }}>
                  {companyLabel} · {focusLabel}
                </p>
                <h1 style={{
                  fontFamily: fonts.serif,
                  fontSize: "clamp(36px, 5vw, 58px)",
                  fontWeight: 400, lineHeight: 1.05,
                  letterSpacing: "-0.028em",
                  color: t.coal, margin: "0 0 22px",
                  maxWidth: "20ch",
                }}>
                  {page.searchPhrase}
                </h1>
                <p style={{
                  fontFamily: fonts.sans, fontSize: 16, lineHeight: 1.65,
                  color: t.inkSoft, margin: "0 0 32px", maxWidth: "46ch",
                }}>
                  {introFirst}
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                  <Link href={practiceHref} className="ed-cta" style={ctaPrimaryStyle("lg")}>
                    Practice with AI voice feedback <span className="ed-cta-arrow" aria-hidden>→</span>
                  </Link>
                  <span style={{ fontFamily: fonts.sans, fontSize: 14, color: t.inkFaint }}>
                    2 sessions free, no card
                  </span>
                </div>
              </div>

              {/* Right: stats sidebar */}
              <div style={{
                flexShrink: 0, width: 240,
                background: t.creamSoft, border: `1px solid ${t.line}`,
                borderRadius: 16, padding: "24px 26px",
                display: "flex", flexDirection: "column", gap: 20,
              }}>
                {/* Question count */}
                <div>
                  <div style={{ fontFamily: fonts.serif, fontSize: 36, fontWeight: 400, color: t.coal, lineHeight: 1, letterSpacing: "-0.02em" }}>
                    {questions.length}
                  </div>
                  <div style={{ fontFamily: fonts.sans, fontSize: 12, color: t.inkFaint, marginTop: 4 }}>
                    verified questions
                  </div>
                </div>
                {/* Difficulty split */}
                <div style={{ borderTop: `1px solid ${t.line}`, paddingTop: 18, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontFamily: fonts.sans, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.inkFaint, marginBottom: 4 }}>
                    Difficulty
                  </div>
                  {diffCounts.easy > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontFamily: fonts.sans, fontSize: 13, color: t.inkSoft }}>
                      <span>Easy</span><span style={{ fontWeight: 600, color: t.coal }}>{diffCounts.easy}</span>
                    </div>
                  )}
                  {diffCounts.medium > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontFamily: fonts.sans, fontSize: 13, color: t.inkSoft }}>
                      <span>Medium</span><span style={{ fontWeight: 600, color: t.coal }}>{diffCounts.medium}</span>
                    </div>
                  )}
                  {diffCounts.hard > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontFamily: fonts.sans, fontSize: 13, color: t.inkSoft }}>
                      <span>Hard</span><span style={{ fontWeight: 600, color: t.coal }}>{diffCounts.hard}</span>
                    </div>
                  )}
                </div>
                {/* Rounds */}
                {roundCount !== null && roundCount > 0 && (
                  <div style={{ borderTop: `1px solid ${t.line}`, paddingTop: 18 }}>
                    <div style={{ fontFamily: fonts.serif, fontSize: 24, fontWeight: 400, color: t.coal, lineHeight: 1, letterSpacing: "-0.015em" }}>
                      {roundCount}
                    </div>
                    <div style={{ fontFamily: fonts.sans, fontSize: 12, color: t.inkFaint, marginTop: 4 }}>
                      interview rounds
                    </div>
                  </div>
                )}
                {/* Focus label */}
                <div style={{ borderTop: `1px solid ${t.line}`, paddingTop: 18 }}>
                  <div style={{ fontFamily: fonts.sans, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.inkFaint, marginBottom: 6 }}>
                    Focus
                  </div>
                  <div style={{ fontFamily: fonts.sans, fontSize: 14, fontWeight: 500, color: t.coal }}>
                    {focusLabel}
                  </div>
                </div>
              </div>

            </div>
          </div>
        </header>

        <div className="ed-container" style={{ paddingTop: 60, paddingBottom: 8 }}>
          {/* Framework + verified company context — narrow reading column */}
          <div className="ed-reading">
            <FrameworkBox name={page.framework.name} summary={page.framework.summary} />
            <CompanyContextBox company={page.company} companyLabel={companyLabel} />
          </div>

          {/* Recruitment process — numbered timeline */}
          {page.recruitmentSteps && page.recruitmentSteps.length > 0 && (
            <section className="ed-reveal" style={{ marginTop: 64 }}>
              <SectionHead eyebrow="How they hire" title={`${companyLabel} recruitment process`} />
              <div className="ed-reading">
                <SpecTimeline items={page.recruitmentSteps.map((step) => ({ label: step }))} />
              </div>
            </section>
          )}

          {/* Interview rounds — numbered timeline with detail */}
          {page.interviewRounds && page.interviewRounds.length > 0 && (
            <section className="ed-reveal" style={{ marginTop: 56 }}>
              <SectionHead eyebrow="Round by round" title="What to expect in each round" />
              <div className="ed-reading">
                <SpecTimeline
                  items={page.interviewRounds.map((round, i) => {
                    /* Split "Round Title (duration):" from the detail text */
                    const colonIdx = round.indexOf(":");
                    const title = colonIdx > -1 ? round.slice(0, colonIdx) : `Round ${i + 1}`;
                    const detail = colonIdx > -1 ? round.slice(colonIdx + 1).trim() : round;
                    return { label: title, body: detail };
                  })}
                />
              </div>
            </section>
          )}

          {/* How to answer — STAR structure guide for behavioral/HR/campus-placement */}
          {(page.focus === "behavioral" || page.focus === "hr" || page.focus === "campus-placement") && (
            <section className="ed-reveal" style={{ marginTop: 56 }}>
              <SectionHead eyebrow="The scoring rubric" title="How to structure your answers" />
              <div
                className="ed-reading"
                style={{
                  background: t.creamSoft,
                  border: `1px solid ${t.copperMid}`,
                  borderRadius: 16,
                  padding: "24px 26px",
                }}
              >
                <p style={{ fontFamily: fonts.sans, fontSize: 14, color: t.inkSoft, margin: "0 0 18px", lineHeight: 1.6 }}>
                  {companyLabel} interviewers score answers on structure and specificity, not just content. Use the STAR method for every behavioral question.
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 20 }}>
                  {[
                    { letter: "S", label: "Situation", text: "Set up the context in 1–2 sentences. Give just enough background for the story to make sense." },
                    { letter: "T", label: "Task", text: "State your personal responsibility. What were YOU specifically accountable for, not the team." },
                    { letter: "A", label: "Action", text: "This is the longest part. Describe the specific steps you took. Use 'I' not 'we'." },
                    { letter: "R", label: "Result", text: "Quantify if possible: numbers, percentages, timeline improvement. Then say what you learnt." },
                  ].map(({ letter, label, text }) => (
                    <div key={letter} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <span style={{ fontFamily: fonts.serif, fontSize: 30, fontStyle: "italic", fontWeight: 400, color: t.copper, lineHeight: 1 }}>
                        {letter}
                      </span>
                      <span style={{ fontFamily: fonts.sans, fontSize: 11, fontWeight: 700, color: t.coal, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                        {label}
                      </span>
                      <span style={{ fontFamily: fonts.sans, fontSize: 13, color: t.inkSoft, lineHeight: 1.55 }}>
                        {text}
                      </span>
                    </div>
                  ))}
                </div>
                <p
                  style={{
                    fontFamily: fonts.sans,
                    fontSize: 12,
                    color: t.inkFaint,
                    margin: "20px 0 0",
                    lineHeight: 1.55,
                    borderTop: `1px solid ${t.line}`,
                    paddingTop: 14,
                  }}
                >
                  <strong style={{ color: t.coal }}>Common mistake:</strong> Saying &quot;we did X&quot; throughout. Interviewers score your individual contribution. If you can&apos;t separate what you did from what the team did, it signals low ownership. Practise saying &quot;I&quot; in mock sessions first.
                </p>
              </div>
              {(page.focus === "campus-placement" || page.focus === "hr") && (
                <p style={{ fontFamily: fonts.sans, fontSize: 13, color: t.inkFaint, margin: "16px 0 0", lineHeight: 1.5 }}>
                  Preparing for a campus placement drive?{" "}
                  <Link href="/for-students" style={{ color: t.copper, fontWeight: 500, textDecoration: "none" }}>
                    See the full students guide →
                  </Link>
                </p>
              )}
            </section>
          )}

          {/* Question list */}
          <section className="ed-reveal" style={{ marginTop: 64 }}>
            <SectionHead
              eyebrow="Real, verified questions"
              title={`${focusLabel} questions ${companyLabel} asked`}
              sub={`Verified from 2+ candidate post-mortems. Hit Practice to answer any one with AI voice feedback.${showSignupGate ? " First 5 shown free — sign up to unlock all." : ""}`}
            />
            <ol
              role="list"
              className="ed-reading"
              style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}
            >
              {questions.map((q, i) => (
                <QuestionCard
                  key={i}
                  question={q}
                  index={i}
                  practiceHref={practiceHref}
                  showSignupGate={showSignupGate}
                />
              ))}
            </ol>
          </section>
        </div>

        {/* Closing CTA — full-bleed coal band */}
        <DarkBand eyebrow="Reading won't get you hired" title="Stop reading," accent="start answering.">
          <p style={{ fontFamily: fonts.sans, fontSize: 16, color: t.creamMuted, lineHeight: 1.65, maxWidth: "36ch", margin: 0 }}>
            The AI asks {companyLabel}-style questions, listens to your voice, and scores your answer in two minutes.
            {questions.length > 5 && ` All ${questions.length} questions unlock after signup.`}
            {" "}2 sessions free, no card.
          </p>
          <Link href={practiceHref} className="ed-cta" style={ctaPrimaryStyle("lg")}>
            Start free practice <span className="ed-cta-arrow" aria-hidden>→</span>
          </Link>
        </DarkBand>

        {/* Internal link graph — related question sets + guides */}
        <div className="ed-container" style={{ paddingTop: 56, paddingBottom: 88 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: relatedBlogPosts.length > 0 ? "1fr 1fr" : "1fr",
              gap: "0 64px",
              borderTop: `1px solid ${t.line}`,
              paddingTop: 32,
            }}
          >
            {relatedPages.length > 0 && (
              <section>
                <h3
                  style={{
                    fontFamily: fonts.sans,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: t.inkFaint,
                    margin: "0 0 16px",
                  }}
                >
                  Related interview prep
                </h3>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                  {relatedPages.map((p) => (
                    <li key={p.slug}>
                      <Link
                        href={`/questions/${p.slug}`}
                        className="ed-link"
                        style={{ color: t.copper, fontFamily: fonts.sans, fontSize: 15, fontWeight: 500, lineHeight: 1.4 }}
                      >
                        {p.searchPhrase}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {relatedBlogPosts.length > 0 && (
              <section style={{ borderLeft: relatedPages.length > 0 ? `1px solid ${t.line}` : "none", paddingLeft: relatedPages.length > 0 ? 64 : 0 }}>
                <h3
                  style={{
                    fontFamily: fonts.sans,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: t.inkFaint,
                    margin: "0 0 16px",
                  }}
                >
                  Read our guides
                </h3>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                  {relatedBlogPosts.map((post) => (
                    <li key={post.slug}>
                      <Link
                        href={`/blog/${post.slug}`}
                        className="ed-link"
                        style={{ color: t.copper, fontFamily: fonts.sans, fontSize: 15, fontWeight: 500, lineHeight: 1.4 }}
                      >
                        {post.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
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
        <EditorialHero
          eyebrow="Interview questions · India 2026"
          titleLead="Real interview questions,"
          accent="answered out loud."
          lead={`${pages.length} question sets across the top Indian and global companies. Each lists real, verified questions, then lets you practice answering them with an AI interviewer that listens, grades, and coaches you in two minutes.`}
          meta={
            <nav aria-label="Breadcrumb" style={{ fontFamily: fonts.sans, fontSize: 13, color: t.inkFaint }}>
              <Link href="/" style={{ color: t.inkFaint, textDecoration: "none" }}>Home</Link>
              {" / "}
              <span aria-current="page" style={{ color: t.copper }}>Interview Questions</span>
            </nav>
          }
        >
          <Link href="/signup?source=questions-index" className="ed-cta" style={ctaPrimaryStyle("lg")}>
            Start free practice <span className="ed-cta-arrow" aria-hidden>→</span>
          </Link>
          <span style={{ fontFamily: fonts.sans, fontSize: 14, color: t.inkFaint }}>
            2 sessions, no card
          </span>
        </EditorialHero>

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
                    className="ed-cta"
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
                        className="ed-cta"
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

          {/* Grouped question sets — one editorial masthead per company */}
          {companies.map((company) => (
            <section key={company} className="ed-reveal" style={{ marginBottom: 56 }}>
              <SectionHead
                eyebrow={`${grouped[company].length} question ${grouped[company].length === 1 ? "set" : "sets"}`}
                title={COMPANY_LABEL[company] ?? company.charAt(0).toUpperCase() + company.slice(1)}
              />
              <ol role="list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {grouped[company].map((p, i) => (
                  <li key={p.slug}>
                    <Link
                      href={`/questions/${p.slug}`}
                      className="ed-cta"
                      style={{
                        display: "flex",
                        gap: 22,
                        padding: "18px 0",
                        borderBottom: `1px solid ${t.line}`,
                        textDecoration: "none",
                        alignItems: "flex-start",
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
        <DarkBand eyebrow="Stop just reading" title="Start" accent="answering.">
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
