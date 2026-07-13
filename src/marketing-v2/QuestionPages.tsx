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
import type { BankEntry } from "../../data/interview-question-bank";
import type { SeoPage } from "../../data/seo-pages";

/* ─── Shared layout primitives ─────────────────────────────────────────── */

const pageShell: CSSProperties = {
  background: t.cream,
  color: t.coal,
  minHeight: "100dvh",
  fontFamily: fonts.sans,
};

const pageInner: CSSProperties = {
  maxWidth: 800,
  margin: "0 auto",
  padding: "56px 24px 96px",
};

const eyebrowStyle: CSSProperties = {
  fontFamily: fonts.sans,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: t.copper,
  margin: 0,
};

const h1Style: CSSProperties = {
  fontFamily: fonts.serif,
  fontSize: "clamp(30px, 5vw, 48px)",
  fontWeight: 400,
  letterSpacing: "-0.02em",
  lineHeight: 1.1,
  color: t.coal,
  margin: "12px 0 0",
  textWrap: "balance" as const,
};

const introStyle: CSSProperties = {
  fontFamily: fonts.serif,
  fontStyle: "italic",
  fontSize: 18,
  lineHeight: 1.6,
  color: t.indigoGray,
  marginTop: 20,
  marginBottom: 0,
  maxWidth: "68ch",
  textWrap: "balance" as const,
};

const dividerStyle: CSSProperties = {
  border: 0,
  borderTop: `1px solid ${t.line}`,
  margin: "40px 0",
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
          style={{ flexShrink: 0, color: t.copper, textDecoration: "none", fontFamily: fonts.sans, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", paddingTop: 4 }}
        >
          Practice →
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

/* ─── Bottom CTA section ────────────────────────────────────────────────── */

function BottomCTA({
  companyLabel,
  practiceHref,
  totalCount,
}: {
  companyLabel: string;
  practiceHref: string;
  totalCount: number;
}) {
  return (
    <div style={{ marginTop: 88, borderTop: `1px solid ${t.lineStrong}`, paddingTop: 56, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 40, flexWrap: "wrap" }}>
      <p style={{ fontFamily: fonts.serif, fontSize: "clamp(32px, 4vw, 54px)", fontWeight: 400, color: t.coal, letterSpacing: "-0.025em", lineHeight: 1.02, maxWidth: "16ch", textWrap: "balance" as const, margin: 0 }}>
        Stop just reading,{" "}
        <span style={{ fontStyle: "italic", color: t.copper }}>start answering</span>.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "flex-start", minWidth: 260 }}>
        <p style={{ fontFamily: fonts.sans, fontSize: 15, color: t.inkSoft, lineHeight: 1.6, maxWidth: "36ch", margin: 0 }}>
          The AI interviewer asks {companyLabel}-style questions, listens to your voice, and scores your answer in 2 minutes.
          {totalCount > 5 && ` All ${totalCount} questions unlock after signup.`}
          {" "}2 sessions free, no card.
        </p>
        <Link href={practiceHref} style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: fonts.sans, fontSize: 15, fontWeight: 600, padding: "14px 28px", borderRadius: 999, textDecoration: "none", background: t.indigo, color: t.white, flexShrink: 0 }}>
          Start free practice <span aria-hidden>→</span>
        </Link>
      </div>
    </div>
  );
}

/* ─── RelatedLinksSection — exported so the page layer can inject SEO_PAGES */

export function RelatedLinksSection({
  relatedPages,
}: {
  relatedPages: { slug: string; searchPhrase: string }[];
}) {
  if (relatedPages.length === 0) return null;
  return (
    <section style={{ marginTop: 48, paddingTop: 24, borderTop: `1px solid ${t.line}` }}>
      <h3
        style={{
          fontFamily: fonts.sans,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: t.inkFaint,
          margin: "0 0 14px",
        }}
      >
        Related interview prep
      </h3>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {relatedPages.map((p) => (
          <li key={p.slug}>
            <Link
              href={`/questions/${p.slug}`}
              style={{ color: t.copper, textDecoration: "none", fontFamily: fonts.sans, fontSize: 14, fontWeight: 500 }}
            >
              → {p.searchPhrase}
            </Link>
          </li>
        ))}
      </ul>
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
}

export function QuestionSetPage({
  slug: _slug,
  page,
  questions,
  companyLabel,
  focusLabel,
  relatedPages,
}: QuestionSetPageProps) {
  const practiceHref = `/signup?source=questions-seo&company=${encodeURIComponent(page.company)}&focus=${encodeURIComponent(page.focus)}${page.roleFamily ? `&role=${encodeURIComponent(page.roleFamily)}` : ""}`;

  /* Show first 5 free; gate the rest behind a signup prompt. */
  const showSignupGate = questions.length > 5;

  return (
    <main style={pageShell}>
      <div style={pageInner}>
        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          style={{ fontFamily: fonts.sans, fontSize: 13, color: t.inkFaint, marginBottom: 28 }}
        >
          <Link href="/" style={{ color: t.inkFaint, textDecoration: "none" }}>
            Home
          </Link>
          {" / "}
          <Link href="/questions" style={{ color: t.inkFaint, textDecoration: "none" }}>
            Questions
          </Link>
          {" / "}
          <span style={{ color: t.coal }}>{page.searchPhrase}</span>
        </nav>

        {/* Eyebrow */}
        <p style={eyebrowStyle}>
          {companyLabel} · {focusLabel}
        </p>

        {/* H1 mirrors search phrase exactly for SERP CTR */}
        <h1 style={h1Style}>{page.searchPhrase}</h1>

        {/* Hand-written intro — avoids Helpful Content penalty */}
        <p style={introStyle}>{page.intro}</p>

        {/* Primary CTA — above the fold */}
        <div style={{ display: "flex", gap: 12, marginTop: 28, flexWrap: "wrap", alignItems: "center" }}>
          <Link
            href={practiceHref}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, background: t.copper, color: t.cream, textDecoration: "none", padding: "13px 22px", borderRadius: 999, fontFamily: fonts.sans, fontSize: 15, fontWeight: 600 }}
          >
            Practice these questions with AI voice feedback →
          </Link>
          <span style={{ color: t.inkFaint, fontFamily: fonts.sans, fontSize: 14 }}>
            2 sessions, no credit card
          </span>
        </div>

        {/* Framework callout */}
        <FrameworkBox name={page.framework.name} summary={page.framework.summary} />

        <hr style={dividerStyle} />

        {/* Question list */}
        <section>
          <h2
            style={{
              fontFamily: fonts.serif,
              fontSize: "clamp(20px, 3vw, 28px)",
              fontWeight: 400,
              letterSpacing: "-0.01em",
              color: t.coal,
              margin: "0 0 8px",
            }}
          >
            Real {focusLabel.toLowerCase()} questions {companyLabel} asked
          </h2>
          <p style={{ fontFamily: fonts.sans, fontSize: 14, color: t.inkFaint, margin: "0 0 24px", lineHeight: 1.6 }}>
            Verified from 2+ candidate post-mortems. Click <em>Practice</em> to answer any
            question with AI voice feedback.
            {showSignupGate && " First 5 shown free — sign up to unlock all."}
          </p>

          <ol
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
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

        {/* Bottom CTA */}
        <BottomCTA
          companyLabel={companyLabel}
          practiceHref={practiceHref}
          totalCount={questions.length}
        />

        {/* Related links — internal link graph for crawlability */}
        <RelatedLinksSection relatedPages={relatedPages} />
      </div>
    </main>
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
}

export function QuestionsIndexPage({ pages }: QuestionsIndexPageProps) {
  /* Group by company for a cleaner layout. */
  const grouped = pages.reduce<Record<string, typeof pages>>((acc, p) => {
    const key = p.company;
    (acc[key] ??= []).push(p);
    return acc;
  }, {});

  const companies = Object.keys(grouped).sort();

  return (
    <main style={pageShell}>
      <div style={pageInner}>
        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          style={{ fontFamily: fonts.sans, fontSize: 13, color: t.inkFaint, marginBottom: 28 }}
        >
          <Link href="/" style={{ color: t.inkFaint, textDecoration: "none" }}>
            Home
          </Link>
          {" / "}
          <span style={{ color: t.coal }}>Interview Questions</span>
        </nav>

        {/* Page header */}
        <p style={eyebrowStyle}>Interview Question Library</p>
        <h1 style={h1Style}>
          Real interview questions —{" "}
          <span style={{ color: t.copper, fontStyle: "italic" }}>practice them with AI</span>
        </h1>
        <p style={{ ...introStyle, marginTop: 16 }}>
          {pages.length} question sets covering the top Indian and global companies. Each page
          lists real, verified questions — then lets you practice answering them with an AI
          interviewer that listens, grades, and coaches you in 2 minutes.
        </p>

        {/* CTA */}
        <div style={{ display: "flex", gap: 12, marginTop: 28, flexWrap: "wrap" }}>
          <Link
            href="/signup?source=questions-index"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, background: t.copper, color: t.cream, textDecoration: "none", padding: "13px 22px", borderRadius: 999, fontFamily: fonts.sans, fontSize: 15, fontWeight: 600 }}
          >
            Start free practice — 2 sessions, no card →
          </Link>
        </div>

        <hr style={{ ...dividerStyle, marginTop: 48 }} />

        {/* Grouped question-set cards */}
        {companies.map((company) => (
          <section key={company} style={{ marginBottom: 48 }}>
            <h2
              style={{
                fontFamily: fonts.sans,
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.10em",
                textTransform: "uppercase",
                color: t.copper,
                margin: "0 0 16px",
              }}
            >
              {company.toUpperCase()}
            </h2>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: 12,
              }}
            >
              {grouped[company].map((p) => (
                <li key={p.slug}>
                  <Link
                    href={`/questions/${p.slug}`}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      background: t.white,
                      border: `1px solid ${t.line}`,
                      borderRadius: 10,
                      padding: "16px 18px",
                      textDecoration: "none",
                      color: "inherit",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: fonts.sans,
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.10em",
                        textTransform: "uppercase",
                        color: t.copper,
                      }}
                    >
                      {p.focus.replace(/-/g, " ")}
                    </span>
                    <span
                      style={{
                        fontFamily: fonts.serif,
                        fontSize: 16,
                        fontWeight: 400,
                        lineHeight: 1.3,
                        color: t.coal,
                      }}
                    >
                      {p.searchPhrase}
                    </span>
                    <span
                      style={{
                        fontFamily: fonts.sans,
                        fontSize: 12,
                        color: t.inkFaint,
                        lineHeight: 1.5,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {p.intro}
                    </span>
                    <span
                      style={{
                        fontFamily: fonts.sans,
                        fontSize: 12,
                        fontWeight: 600,
                        color: t.indigo,
                        marginTop: 4,
                      }}
                    >
                      View questions →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}

        {/* Bottom CTA — blog-style editorial split */}
        <div style={{ marginTop: 88, borderTop: `1px solid ${t.lineStrong}`, paddingTop: 56, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 40, flexWrap: "wrap" }}>
          <p style={{ fontFamily: fonts.serif, fontSize: "clamp(32px, 4vw, 54px)", fontWeight: 400, color: t.coal, letterSpacing: "-0.025em", lineHeight: 1.02, maxWidth: "16ch", textWrap: "balance" as const, margin: 0 }}>
            Stop just reading,{" "}
            <span style={{ fontStyle: "italic", color: t.copper }}>start answering</span>.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "flex-start", minWidth: 260 }}>
            <p style={{ fontFamily: fonts.sans, fontSize: 15, color: t.inkSoft, lineHeight: 1.6, maxWidth: "36ch", margin: 0 }}>
              AI voice interviewer, real-time answer scoring, STAR framework coaching. 2 free sessions, no credit card required.
            </p>
            <Link href="/signup?source=questions-index-bottom" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: fonts.sans, fontSize: 15, fontWeight: 600, padding: "14px 28px", borderRadius: 999, textDecoration: "none", background: t.indigo, color: t.white, flexShrink: 0 }}>
              Start free practice <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
