/* HireStepX — Session Report (production view)
   Best-in-class post-session results screen. Ported from the
   `interview-result` Tempo canvas. Goal: deliver feedback that feels
   coach-grade, not LLM-generic, and that justifies the price.

   This is the presentation layer. It is pure — props in, JSX out.
   The adapter at `./adapter.ts` translates the production SessionReport
   schema into the InterviewResultData view-model this component
   consumes. Production-only wiring (loading, error, abort, share,
   PDF, analytics) lives at `./SessionReport.tsx` (the entry).

   Sections (top → bottom):
     1. Header — back, download PDF, share
     2. Hero — score gauge + verdict + delta vs last + AI verdict + strengths/improvements
     3. (optional) Trend strip — cross-session deltas
     4. Core delivery metrics — 6 tile row
     5. Skills breakdown — horizontal bars + sticky weakest-skill callout
     6. (optional) Thought-bubble timeline — collapsed by default
     7. Per-question review — expandable cards w/ coaching column
     8. (optional) Coach's Notes — cross-session aggregations
     9. Next Steps — 3 action cards
    10. Helpful? thumbs feedback + privacy line */

"use client";

import { useState } from "react";
import { t, f, shadows } from "./tokens";
import { SESSION_REPORT_STYLES } from "./styles";
import { NegotiationFullReport } from "./NegotiationFullReport";
import type { CredibilitySummary } from "../_credibilityCallout";
import type {
  AnswerSpan,
  BiasFinding,
  BlindSpot,
  Calibration,
  CrossSessionInsight,
  DeliveryMetric,
  HighlightKind,
  InterviewResultData,
  Question,
  Skill,
  StoryReuseFinding,
  ThoughtBubbleSegment,
  Verdict,
} from "./types";

// Re-export types so call-sites importing from this entry stay happy.
export type {
  AnswerSpan,
  BiasFinding,
  BlindSpot,
  Calibration,
  CrossSessionInsight,
  DeliveryMetric,
  HighlightKind,
  InterviewResultData,
  Question,
  Skill,
  StoryReuseFinding,
  ThoughtBubbleSegment,
  Verdict,
};

/* ─── Helpers ──────────────────────────────────────────────────────── */

const VERDICT_META: Record<Verdict, { label: string; bg: string; color: string }> = {
  strongHire:   { label: "Strong Hire",     bg: "rgba(21,128,61,0.10)",   color: t.success },
  hire:         { label: "Hire",            bg: "rgba(21,128,61,0.06)",   color: t.success },
  leanHire:     { label: "Lean Hire",       bg: "rgba(212,179,127,0.10)", color: t.copper },
  noHire:       { label: "No Hire",         bg: "rgba(196,112,90,0.10)",  color: t.error },
  strongNoHire: { label: "Strong No Hire",  bg: "rgba(196,112,90,0.14)",  color: t.error },
};

const BAND_META: Record<Question["band"], { label: string; color: string }> = {
  weak:     { label: "Weak",     color: t.error },
  partial:  { label: "Partial",  color: t.copper },
  complete: { label: "Complete", color: t.success },
  strong:   { label: "Strong",   color: t.success },
};

function MetricBand({ band }: { band: DeliveryMetric["band"] }) {
  const meta =
    band === "good"
      ? { label: "Good", color: t.success, bg: "rgba(21,128,61,0.10)" }
      : band === "ok"
        ? { label: "On Target", color: t.copper, bg: "rgba(180,83,9,0.10)" }
        : { label: "Needs Work", color: t.error, bg: "rgba(196,112,90,0.12)" };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 10px",
        borderRadius: 999,
        background: meta.bg,
        color: meta.color,
        fontFamily: f.sans,
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      {meta.label}
    </span>
  );
}

function ScoreGauge({ score, color }: { score: number; color: string }) {
  /* Half-doughnut with the score number rendered INSIDE the SVG so
     positioning is bulletproof across viewport widths. The previous
     version positioned the score with absolute CSS over the SVG
     parent — scaling and overflow caused the number to drift above
     the arc on narrow screens (user-reported #7). Now everything is
     in the same SVG coordinate system. */
  const r = 110;
  const cx = 140;
  const cy = 140;
  const len = Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const filled = len * pct;
  return (
    <svg
      width="280"
      height="170"
      viewBox="0 0 280 170"
      role="img"
      aria-label={`Score ${score} out of 100`}
    >
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        stroke={t.line}
        strokeWidth="14"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        stroke={color}
        strokeWidth="14"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${len}`}
        fill="none"
      />
      {/* Score number — anchored in SVG coords so it can never
          drift outside the arc regardless of CSS scaling. */}
      <text
        x={cx}
        y={cy - 14}
        textAnchor="middle"
        fontFamily={f.serif}
        fontSize="60"
        fill={t.coal}
        style={{ letterSpacing: "-0.02em" }}
      >
        {score}
      </text>
      <text
        x={cx}
        y={cy + 14}
        textAnchor="middle"
        fontFamily={f.mono}
        fontSize="14"
        fill={t.inkFaint}
      >
        / 100
      </text>
    </svg>
  );
}

/** Inline sparkline for the recent-score trend. Replaces the
 *  text-only "+16 vs last interview" delta with a 4-6 point shape so
 *  users see the trajectory, not just the latest delta. The current
 *  point is copper-coded so it stands apart from the indigo line. */
function Sparkline({ points }: { points: number[] }) {
  if (!points || points.length < 2) return null;
  const w = 96;
  const h = 28;
  const pad = 3;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  const min = Math.min(...points, 30);
  const max = Math.max(...points, 90);
  const range = Math.max(1, max - min);
  const xs = points.map((_, i) => pad + (i / (points.length - 1)) * innerW);
  const ys = points.map((p) => pad + innerH - ((p - min) / range) * innerH);
  const path = points.map((_, i) => `${i === 0 ? "M" : "L"} ${xs[i].toFixed(1)} ${ys[i].toFixed(1)}`).join(" ");
  const area = `${path} L ${xs[xs.length - 1].toFixed(1)} ${(h - pad).toFixed(1)} L ${xs[0].toFixed(1)} ${(h - pad).toFixed(1)} Z`;
  // Build an accessible name with the actual values so screen-reader
  // users can hear "Recent session scores: 42, 48, 56, 56, 72" instead
  // of just "Recent session scores".
  const trend = points[points.length - 1] - points[0];
  const trendVerb = trend > 0 ? "trending up" : trend < 0 ? "trending down" : "flat";
  const a11y = `Recent session scores: ${points.join(", ")}. Currently ${points[points.length - 1]}, ${trendVerb} from ${points[0]}.`;
  return (
    <svg
      className="ir-spark"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={a11y}
    >
      <title>{a11y}</title>
      <path className="ir-spark-area" d={area} />
      <path className="ir-spark-line" d={path} />
      {points.map((_, i) => (
        <circle
          key={i}
          className={i === points.length - 1 ? "ir-spark-dot-current" : "ir-spark-dot"}
          cx={xs[i]}
          cy={ys[i]}
          r={i === points.length - 1 ? 2.5 : 1.6}
        />
      ))}
    </svg>
  );
}

/** Section eyebrow — small "01", "02"... numeric label + dividing
 *  rule. Gives users a sense of progression through the report and
 *  acts as a low-weight visual anchor on each section card without
 *  competing with the section heading. */
function SectionEyebrow({ num, label }: { num: string; label: string }) {
  return (
    <div className="ir-section-eyebrow">
      <span className="ir-section-num">{num} · {label.toUpperCase()}</span>
      <span className="ir-section-rule" aria-hidden="true" />
    </div>
  );
}

/** Sticky jump-to-section nav at the top of <main>. Power users
 *  reviewing their 5th report skip directly to per-question without
 *  scrolling past every section card. Renders nothing on screens
 *  too narrow to fit the row (handled by overflow-x in CSS). */
function JumpNav() {
  const items = [
    { num: "01", label: "Overview", href: "#ir-section-hero" },
    { num: "02", label: "Delivery", href: "#ir-section-metrics" },
    { num: "03", label: "Skills", href: "#ir-section-skills" },
    { num: "04", label: "Questions", href: "#ir-section-questions" },
    { num: "05", label: "Coach Notes", href: "#ir-section-coach-notes" },
    { num: "06", label: "Next Steps", href: "#ir-section-next" },
  ];
  return (
    <nav aria-label="Jump to section" className="ir-jump-nav">
      <div className="ir-jump-nav-inner">
        {items.map((i) => (
          <a key={i.href} href={i.href} className="ir-jump-link">
            <span className="ir-jump-link-num">{i.num}</span>
            {i.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

/** Readiness badge — the "how close am I to the role bar" signal.
 *  Sits above the score gauge so it reads as the headline number,
 *  not the session score. For interview-prep users this is more
 *  useful than the per-session score. */
function ReadinessHeadline({
  readiness,
  daysUntil,
  role,
  level,
  company,
}: {
  readiness: { pct: number; etaWeeks: number };
  daysUntil?: number;
  role: string;
  level: string;
  company: string;
}) {
  const color =
    readiness.pct >= 80 ? t.success : readiness.pct >= 60 ? t.copper : t.error;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "12px 18px",
        borderRadius: 12,
        background: "linear-gradient(135deg, rgba(212,179,127,0.06), rgba(49,46,129,0.04))",
        border: `1px solid ${t.line}`,
        marginBottom: 18,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontFamily: f.mono, fontSize: 11, color: t.inkSoft, letterSpacing: "0.10em", textTransform: "uppercase", fontWeight: 600 }}>
          Readiness
        </span>
        <span style={{ fontFamily: f.serif, fontSize: 28, color, lineHeight: 1, letterSpacing: "-0.01em" }}>
          {readiness.pct}%
        </span>
      </div>
      <span style={{ height: 22, width: 1, background: t.line }} aria-hidden="true" />
      <p style={{ fontFamily: f.sans, fontSize: 13, color: t.coal, margin: 0, flex: 1, minWidth: 240, lineHeight: 1.45 }}>
        For <strong style={{ color: t.coal, fontWeight: 600 }}>{level} {role}</strong> at <strong>{company}</strong>.
        {readiness.pct >= 80 ? (
          <> You&apos;re interview-ready — focus on consistency.</>
        ) : (
          <> ~{readiness.etaWeeks} {readiness.etaWeeks === 1 ? "week" : "weeks"} of focused prep to close the gap.</>
        )}
      </p>
      {typeof daysUntil === "number" && daysUntil > 0 && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 12px",
            borderRadius: 999,
            background: t.copperSoft,
            color: t.copper,
            fontFamily: f.mono,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.06em",
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          INTERVIEW IN {daysUntil}D
        </span>
      )}
    </div>
  );
}

/** Calibration banner — single-line context for what the verdict
 *  actually means at this company/level. Anchors abstract bands
 *  ("Hire") in concrete score thresholds users can defend in a
 *  conversation. Renders inline under the verdict pill. */
function CalibrationBanner({ calibration }: { calibration: Calibration }) {
  return (
    <span className="ir-calibration" role="note" aria-label="Calibration context">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2v20M2 12h20" />
      </svg>
      <span>
        Calibrated to <strong style={{ fontWeight: 600 }}>{calibration.companyLabel}</strong>
      </span>
      <span className="ir-calibration-bands">
        {calibration.bands.map((b, i) => (
          <span key={b.label}>
            {i > 0 ? " · " : " — "}
            {b.label} ≥ {b.minScore}
          </span>
        ))}
      </span>
    </span>
  );
}

/** Score-confidence chip — only fires when LLM confidence is medium
 *  or low. Tells users "this score is hedged" so they don't over-
 *  index on a single session. */
function ScoreConfidenceChip({ level, note }: { level: "medium" | "low"; note?: string }) {
  return (
    <span className="ir-confidence-chip" title={note} aria-label={`Score confidence: ${level}${note ? ". " + note : ""}`}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="13" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      {level === "low" ? "Low confidence" : "Medium confidence"}
    </span>
  );
}

/** Trend strip — cross-session deltas in a single line. Renders only
 *  when priorSessionCount ≥ 3 (need at least 3 prior + this = 4 for
 *  trend to be meaningful). Sits between Hero and Core Metrics so
 *  the "are things getting better?" answer comes immediately after
 *  the headline score. */
function TrendStrip({
  priorSessionCount,
  insights,
}: {
  priorSessionCount: number;
  insights: CrossSessionInsight[];
}) {
  // Pull the most signal-rich items: 1 improvement + 1 persistent + 1 regression
  const improvements = insights.filter((i) => i.kind === "improvement").slice(0, 1);
  const persistent = insights.filter((i) => i.kind === "persistent").slice(0, 1);
  const regressions = insights.filter((i) => i.kind === "regression").slice(0, 1);
  const items = [...improvements, ...persistent, ...regressions];
  if (items.length === 0) return null;
  return (
    <section
      aria-label="Cross-session trend"
      className="ir-trend-strip"
      style={{ scrollMarginTop: 72 }}
    >
      <span className="ir-trend-eyebrow">Across {priorSessionCount + 1} sessions</span>
      {items.map((it) => {
        const cls =
          it.kind === "improvement" ? "ir-trend-delta-up"
          : it.kind === "regression" ? "ir-trend-delta-down"
          : "ir-trend-delta-flat";
        const arrow = it.kind === "improvement" ? "↑" : it.kind === "regression" ? "↓" : "→";
        return (
          <span key={it.title} className="ir-trend-item">
            <span className={cls}>{arrow}</span>
            <span style={{ fontWeight: 600 }}>{it.title}</span>
          </span>
        );
      })}
    </section>
  );
}

/* ─── Sections ─────────────────────────────────────────────────────── */

function Header({
  onBack,
  onDownloadPdf,
  onShare,
}: {
  onBack?: () => void;
  onDownloadPdf?: () => void;
  onShare?: () => void;
}) {
  return (
    <header
      className="ir-print-hide"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "20px 32px",
      }}
    >
      <button
        type="button"
        onClick={onBack}
        style={{
          background: "transparent",
          border: "none",
          fontFamily: f.sans,
          fontSize: 14,
          fontWeight: 500,
          color: t.coal,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: 0,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        Back to Dashboard
      </button>
      <div style={{ display: "flex", gap: 10 }}>
        <button type="button" className="ir-cta-ghost" onClick={onDownloadPdf}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download PDF
        </button>
        <button type="button" className="ir-cta-ghost" onClick={onShare}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          Share Report
        </button>
      </div>
    </header>
  );
}

function HeroSection({ data }: { data: InterviewResultData }) {
  const verdict = VERDICT_META[data.verdict];
  return (
    <section
      id="ir-section-hero"
      aria-labelledby="ir-hero-heading"
      style={{
        background: t.white,
        border: `1px solid ${t.line}`,
        borderRadius: 16,
        padding: 28,
        boxShadow: shadows.card,
        scrollMarginTop: 72, // accommodate sticky jump-nav on anchor scroll
      }}
    >
      {/* Visually hidden h1 — the report's primary heading. SR users hear
          this as the page title; sighted users see the readiness headline +
          score gauge as the visual primary. */}
      <h1 id="ir-hero-heading" style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 }}>
        Interview Report — {data.role} at {data.company}, scored {data.overallScore} out of 100
      </h1>
      {/* Readiness headline — the "how close am I to the role bar" signal.
          Sits above session score because for an interview-prep product
          it's the headline number users actually want, not "how this
          session went". Falls through silently if no readiness data. */}
      {data.readiness && (
        <ReadinessHeadline
          readiness={data.readiness}
          daysUntil={data.daysUntilInterview}
          role={data.role}
          level={data.level}
          company={data.company}
        />
      )}

      {/* Top row: company / role / level / difficulty pills */}
      <div className="ir-pill-bar" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
        <span className="ir-pill">
          <span style={{ fontSize: 13 }}>🟢</span>
          {data.company}
          <span style={{ color: t.inkSoft, fontSize: 11, marginLeft: 4 }}>Company</span>
        </span>
        <span className="ir-pill">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.indigo} strokeWidth="2" aria-hidden="true">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
          {data.role}
          <span style={{ color: t.inkSoft, fontSize: 11, marginLeft: 4 }}>Role</span>
        </span>
        <span className="ir-pill">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.copper} strokeWidth="2" aria-hidden="true">
            <line x1="12" y1="20" x2="12" y2="10" />
            <line x1="18" y1="20" x2="18" y2="4" />
            <line x1="6" y1="20" x2="6" y2="16" />
          </svg>
          {data.level}
          <span style={{ color: t.inkSoft, fontSize: 11, marginLeft: 4 }}>Level</span>
        </span>
        <span className="ir-pill">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.error} strokeWidth="2" aria-hidden="true">
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          {data.difficulty}
          <span style={{ color: t.inkSoft, fontSize: 11, marginLeft: 4 }}>Difficulty</span>
        </span>
      </div>

      <div className="ir-hero-grid" style={{ display: "grid", gridTemplateColumns: "minmax(260px, 1fr) 2fr", gap: 32, alignItems: "center" }}>
        {/* Score gauge column */}
        <div>
          <div style={{ fontFamily: f.mono, fontSize: 11, color: t.inkSoft, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
            Overall Score
          </div>
          {/* Score number rendered inside the SVG (see ScoreGauge above) —
              no overlay div needed. The previous CSS-overlay approach
              caused the number to drift above the arc on narrow widths. */}
          <div style={{ display: "inline-block" }}>
            <ScoreGauge score={data.overallScore} color={verdict.color} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8, flexWrap: "wrap" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "6px 14px",
                borderRadius: 999,
                background: verdict.bg,
                color: verdict.color,
                fontFamily: f.sans,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {verdict.label}
            </span>
            {data.scoreConfidence && data.scoreConfidence !== "high" && (
              <ScoreConfidenceChip level={data.scoreConfidence} note={data.scoreConfidenceNote} />
            )}
            {/* Sparkline replaces the text-only delta — shows trajectory
                across recent sessions, not just one-back comparison.
                Falls back to the text delta if recentScores is missing. */}
            {data.recentScores && data.recentScores.length >= 2 ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: f.sans, fontSize: 13, color: t.inkSoft }}>
                <Sparkline points={data.recentScores} />
                {data.scoreDelta !== 0 && (
                  <span style={{ color: data.scoreDelta > 0 ? t.success : t.error, fontWeight: 600 }}>
                    {data.scoreDelta > 0 ? "↑" : "↓"} {Math.abs(data.scoreDelta)}
                  </span>
                )}
              </span>
            ) : data.scoreDelta !== 0 ? (
              <span style={{ fontFamily: f.sans, fontSize: 13, color: data.scoreDelta > 0 ? t.success : t.error, fontWeight: 600 }}>
                {data.scoreDelta > 0 ? "↑" : "↓"} {Math.abs(data.scoreDelta)} pts
                <span style={{ color: t.inkSoft, fontWeight: 400, marginLeft: 4 }}>vs last</span>
              </span>
            ) : null}
          </div>
          {/* Percentile sub-stat — turns the gauge from chrome that
              duplicates the number into a line that adds new info:
              "you're better than X% of comparable candidates". This
              is what users actually want from the cohort comparison. */}
          {typeof data.percentile === "number" && (
            <p style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, lineHeight: 1.5, margin: "12px 0 0" }}>
              <span style={{ color: t.coal, fontWeight: 600, fontFamily: f.serif, fontSize: 16 }}>Top {100 - data.percentile}%</span>{" "}
              of {data.level} {data.role.split(" ").slice(0, 2).join(" ")} candidates targeting {data.company}.
            </p>
          )}
        </div>

        {/* Verdict + strengths/improvements column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              background: t.creamSoft,
              border: `1px solid ${t.line}`,
              borderRadius: 12,
              padding: "18px 22px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.copper} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <span style={{ fontFamily: f.mono, fontSize: 11, color: t.copper, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>
                AI Interview Verdict
              </span>
            </div>
            <p style={{ fontFamily: f.serif, fontSize: 19, color: t.coal, lineHeight: 1.45, margin: 0 }}>
              {data.aiVerdict}
            </p>
            {data.calibration && (
              <div style={{ marginTop: 12 }}>
                <CalibrationBanner calibration={data.calibration} />
                {data.calibration.note && (
                  <p style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, lineHeight: 1.45, margin: "6px 0 0" }}>
                    {data.calibration.note}.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="ir-strengths-improvements" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            <div>
              <div style={{ fontFamily: f.mono, fontSize: 11, color: t.success, letterSpacing: "0.10em", textTransform: "uppercase", marginBottom: 10, fontWeight: 600 }}>
                Top Strengths
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                {data.strengths.map((s) => (
                  <li key={s} style={{ display: "flex", gap: 8, fontFamily: f.sans, fontSize: 14, color: t.coal, lineHeight: 1.4 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.success} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: 3 }}>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div style={{ fontFamily: f.mono, fontSize: 11, color: t.copper, letterSpacing: "0.10em", textTransform: "uppercase", marginBottom: 10, fontWeight: 600 }}>
                Top Improvements
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                {data.improvements.map((s) => (
                  <li key={s} style={{ display: "flex", gap: 8, fontFamily: f.sans, fontSize: 14, color: t.coal, lineHeight: 1.4 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.copper} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: 3 }}>
                      <line x1="12" y1="8" x2="12" y2="13" />
                      <line x1="12" y1="16" x2="12" y2="16.01" />
                      <circle cx="12" cy="12" r="9" />
                    </svg>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* The legacy salary-negotiation section (offer trajectory + accepted-deal
   email + transcript export) was replaced by NegotiationFullReport in
   ./NegotiationFullReport.tsx — a 12-panel deep-dive that includes
   TL;DR, phase ladder, concession analysis, anchor bracket, cohort
   placement, NPV math, archetype + drills. The offer trajectory and
   transcript export are preserved inside the new component. */

/* ─── Kernel Negotiation Quality (Phase 3 wire-up) ──────────────────
 * Renders the metrics computed by _negotiation-metrics.ts from the
 * persisted kernel move history. Distinct from NegotiationFullReport
 * (which is transcript-derived heuristics). This card is the source-
 * of-truth view because it's grounded in the actual lever/number
 * decisions the kernel made, not regex extraction over the AI's prose.
 */
type KernelMetrics = NonNullable<InterviewResultData["kernelMetrics"]>;

/* ─── Tactic + info-intent labels ─────────────────────────────────
 * Plain-English descriptions of the Voss-style tactics and info
 * intents the kernel detects. Used by the "Tactics you used /
 * missed" panel below the tiles. Keep these short — they're chip
 * labels with a one-line elaboration, not full lessons. */
const TACTIC_LABELS: Record<string, { name: string; what: string }> = {
  "calibrated": { name: "Calibrated question", what: "Asked a 'how' / 'what' question that made the recruiter solve the problem with you." },
  "label": { name: "Label", what: "Named what the other side was feeling ('it sounds like budget is tight…') to defuse and unlock info." },
  "mirror": { name: "Mirror", what: "Repeated their last 1–3 words to keep them talking and reveal more." },
  "sign-today-bundle": { name: "Sign-today bundle", what: "Offered to close today *if* a specific lever moves — turns urgency into leverage." },
  "deflect-current-ctc": { name: "Deflected current CTC", what: "Side-stepped the 'what's your current package?' anchor and re-asked about the role." },
};
const INFO_LABELS: Record<string, string> = {
  "clawback-period": "Joining-bonus clawback (years + pro-ration)",
  "variable-history": "Historical variable payout %",
  "vest-schedule": "Equity vest schedule & cliff",
  "strike-price": "Equity strike / FMV",
  "in-hand-monthly": "In-hand monthly after tax",
  "exercise-window": "Post-exit exercise window",
  "acceleration": "Single/double-trigger acceleration",
  "fixed-vs-variable": "Fixed-vs-variable split",
  "perks-non-cash": "Non-cash perks (insurance, learning, etc.)",
};
const ALL_TACTICS = Object.keys(TACTIC_LABELS);

function KernelTacticsPanel({ m }: { m: KernelMetrics }) {
  const used = (m.vossTacticsUsed ?? []).filter((tk) => TACTIC_LABELS[tk]);
  const usedSet = new Set(used);
  const missed = ALL_TACTICS.filter((tk) => !usedSet.has(tk));
  const asked = (m.infoAsked ?? []).filter((k) => INFO_LABELS[k]);
  const showCallouts = !!m.walkAwayReturned || !!m.hardBandCap || (m.marketMode && m.marketMode !== "neutral");
  /* If there's nothing at all to show — no tactics, no intents, no
     callouts — render nothing. The existing tiles still convey the
     headline. */
  if (used.length === 0 && asked.length === 0 && !showCallouts) return null;
  const Chip = ({ children, tone }: { children: React.ReactNode; tone: "good" | "muted" }) => (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "5px 10px", borderRadius: 999,
      fontFamily: f.sans, fontSize: 12, fontWeight: 500,
      background: tone === "good" ? "#ecfdf5" : t.creamSoft,
      color: tone === "good" ? "#065f46" : t.inkSoft,
      border: `1px solid ${tone === "good" ? "#a7f3d0" : t.line}`,
    }}>{children}</span>
  );
  return (
    <div style={{ marginTop: 22, display: "grid", gap: 22 }}>
      {(used.length > 0 || missed.length > 0) && (
        <div>
          <h3 style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 600, color: t.coal, margin: "0 0 8px", letterSpacing: 0.2, textTransform: "uppercase" }}>
            Tactics
          </h3>
          {used.length > 0 && (
            <>
              <p style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, margin: "0 0 6px" }}>You used:</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                {used.map((tk) => <Chip key={tk} tone="good">{TACTIC_LABELS[tk].name}</Chip>)}
              </div>
              <ul style={{ margin: "0 0 14px", paddingLeft: 18, fontFamily: f.sans, fontSize: 12.5, color: t.inkSoft, lineHeight: 1.55 }}>
                {used.map((tk) => <li key={tk}><strong style={{ color: t.coal }}>{TACTIC_LABELS[tk].name}.</strong> {TACTIC_LABELS[tk].what}</li>)}
              </ul>
            </>
          )}
          {missed.length > 0 && (
            <>
              <p style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, margin: "0 0 6px" }}>
                {used.length > 0 ? "You didn't try:" : "Tactics worth practicing next session:"}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {missed.map((tk) => <Chip key={tk} tone="muted">{TACTIC_LABELS[tk].name}</Chip>)}
              </div>
            </>
          )}
        </div>
      )}
      {asked.length > 0 && (
        <div>
          <h3 style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 600, color: t.coal, margin: "0 0 8px", letterSpacing: 0.2, textTransform: "uppercase" }}>
            Questions you raised
          </h3>
          <p style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, margin: "0 0 6px" }}>
            Specific levers you pried open — each is a number-mover most candidates skip.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {asked.map((k) => <Chip key={k} tone="good">{INFO_LABELS[k]}</Chip>)}
          </div>
        </div>
      )}
      {showCallouts && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {m.marketMode === "soft" && (
            <div style={{ padding: "8px 12px", background: t.creamSoft, border: `1px solid ${t.line}`, borderRadius: 8, fontFamily: f.sans, fontSize: 12, color: t.inkSoft }}>
              Simulated <strong style={{ color: t.coal }}>soft market</strong> — recruiters concede ~30% less than baseline. Cash gains here are harder-won than the % suggests.
            </div>
          )}
          {m.marketMode === "hot" && (
            <div style={{ padding: "8px 12px", background: t.creamSoft, border: `1px solid ${t.line}`, borderRadius: 8, fontFamily: f.sans, fontSize: 12, color: t.inkSoft }}>
              Simulated <strong style={{ color: t.coal }}>hot market</strong> — recruiters concede ~30% more than baseline. Match this anchoring discipline in a normal market.
            </div>
          )}
          {m.hardBandCap && (
            <div style={{ padding: "8px 12px", background: t.creamSoft, border: `1px solid ${t.line}`, borderRadius: 8, fontFamily: f.sans, fontSize: 12, color: t.inkSoft }}>
              <strong style={{ color: t.coal }}>Hard band cap.</strong> The simulated company had a fixed fitment grid (services-co pattern). The kernel redirected to joining bonus, equity, and benefits — the right play.
            </div>
          )}
          {m.walkAwayReturned && (
            <div style={{ padding: "8px 12px", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 8, fontFamily: f.sans, fontSize: 12, color: "#78350f" }}>
              <strong>You walked away and came back.</strong> This works, but the recruiter prices in your reduced leverage — concession rate halves after a return.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function KernelNegotiationQualitySection({ m }: { m: KernelMetrics }) {
  const outcomeLabel = {
    "accepted": "Accepted",
    "walked-away": "Walked away",
    "stalemate": "Stalemate",
    "in-progress": "In progress",
  }[m.outcome];
  const outcomeColor = m.outcome === "accepted" ? "#16a34a"
    : m.outcome === "walked-away" ? "#dc2626"
    : m.outcome === "stalemate" ? "#d97706"
    : t.inkSoft;
  const anchorLabel = m.anchorTurn == null
    ? "Never anchored"
    : m.anchorTurn <= 1 ? `Turn ${m.anchorTurn} (early)`
    : m.anchorTurn <= 3 ? `Turn ${m.anchorTurn}`
    : `Turn ${m.anchorTurn} (late)`;
  const traversalPct = m.bandTraversal == null ? null : Math.round(m.bandTraversal * 100);
  const tiles: Array<{ label: string; value: string; sub?: string }> = [
    { label: "Quality score", value: `${m.score}`, sub: "/100" },
    { label: "Outcome", value: outcomeLabel },
    { label: "Anchored at", value: anchorLabel },
    { label: "LPA gained", value: `₹${m.lpaGained}`, sub: `LPA · ${m.lpaPerTurn}/turn` },
    { label: "Band traversal", value: traversalPct == null ? "—" : `${traversalPct}%`, sub: traversalPct == null ? "no spread" : "of ceiling" },
    { label: "Lever diversity", value: `${m.leverDiversity}`, sub: `lever${m.leverDiversity === 1 ? "" : "s"} explored` },
  ];
  return (
    <section
      id="ir-section-kernel-neg"
      aria-labelledby="ir-kernel-neg-heading"
      style={{
        background: t.white,
        border: `1px solid ${t.line}`,
        borderRadius: 16,
        padding: 28,
        boxShadow: shadows.card,
        scrollMarginTop: 72,
      }}
    >
      <SectionEyebrow num="N1" label="Negotiation quality" />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <h2 id="ir-kernel-neg-heading" style={{ fontFamily: f.serif, fontSize: 22, fontWeight: 400, color: t.coal, margin: 0, letterSpacing: "-0.01em" }}>
          How you negotiated
        </h2>
        <span style={{ fontFamily: f.mono, fontSize: 11, color: outcomeColor, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          {outcomeLabel}
        </span>
      </div>
      <p style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, margin: "0 0 18px", lineHeight: 1.55 }}>
        Computed from the {m.totalTurns} kernel-tracked turns in this session — the actual lever picks and counters,
        not transcript regex. Anchoring early, climbing the band, and exploring multiple levers all lift the score.
      </p>
      <div className="ir-tile-grid">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            style={{
              background: t.creamSoft,
              border: `1px solid ${t.line}`,
              borderRadius: 12,
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <span style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft }}>{tile.label}</span>
            <div style={{ fontFamily: f.serif, fontSize: 32, color: t.coal, lineHeight: 1, letterSpacing: "-0.02em" }}>
              {tile.value}
              {tile.sub && tile.label === "Quality score" && (
                <span style={{ fontSize: 16, color: t.inkSoft, marginLeft: 2, fontFamily: f.mono }}>{tile.sub}</span>
              )}
            </div>
            {tile.sub && tile.label !== "Quality score" && (
              <div style={{ fontFamily: f.mono, fontSize: 11, color: t.inkSoft, letterSpacing: "0.04em" }}>{tile.sub}</div>
            )}
          </div>
        ))}
      </div>
      {m.overBandViolation && (
        <div style={{
          marginTop: 14,
          padding: "10px 14px",
          background: "#fef2f2",
          border: "1px solid #fecaca",
          borderRadius: 8,
          fontFamily: f.sans,
          fontSize: 12,
          color: "#991b1b",
        }}>
          Kernel anomaly: AI offered above the band ceiling on at least one turn. This shouldn't happen — please report.
        </div>
      )}
      <KernelTacticsPanel m={m} />
    </section>
  );
}

function CoreMetricsSection({ metrics }: { metrics: DeliveryMetric[] }) {
  return (
    <section
      id="ir-section-metrics"
      aria-labelledby="ir-metrics-heading"
      style={{
        background: t.white,
        border: `1px solid ${t.line}`,
        borderRadius: 16,
        padding: 28,
        boxShadow: shadows.card,
        scrollMarginTop: 72,
      }}
    >
      <SectionEyebrow num="02" label="How you delivered" />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
        <h2 id="ir-metrics-heading" style={{ fontFamily: f.serif, fontSize: 22, fontWeight: 400, color: t.coal, margin: 0, letterSpacing: "-0.01em" }}>
          Core Delivery Metrics
        </h2>
        <button
          type="button"
          style={{
            background: "transparent",
            border: "none",
            fontFamily: f.sans,
            fontSize: 12,
            color: t.indigo,
            cursor: "pointer",
            padding: 0,
            fontWeight: 500,
          }}
        >
          How are these calculated?
        </button>
      </div>
      <div className="ir-tile-grid">
        {metrics.map((m) => (
          <div
            key={m.label}
            style={{
              background: t.creamSoft,
              border: `1px solid ${t.line}`,
              borderRadius: 12,
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft }}>{m.label}</span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={t.inkFaint} strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </div>
            <div style={{ fontFamily: f.serif, fontSize: 36, color: t.coal, lineHeight: 1, letterSpacing: "-0.02em" }}>
              {m.value}
              {m.unit && <span style={{ fontSize: 18, color: t.inkSoft, marginLeft: 2, fontFamily: f.mono }}>{m.unit}</span>}
            </div>
            <div style={{ fontFamily: f.mono, fontSize: 11, color: t.inkSoft, letterSpacing: "0.04em" }}>
              {m.targetLabel}
            </div>
            <div>
              <MetricBand band={m.band} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SkillsSection({ skills, weakest }: { skills: Skill[]; weakest: { name: string; tip: string } }) {
  const max = 100;
  return (
    <section
      id="ir-section-skills"
      aria-labelledby="ir-skills-heading"
      style={{
        background: t.white,
        border: `1px solid ${t.line}`,
        borderRadius: 16,
        padding: 28,
        boxShadow: shadows.card,
        scrollMarginTop: 72,
      }}
    >
      <SectionEyebrow num="03" label="Where you stand vs role bar" />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <h2 id="ir-skills-heading" style={{ fontFamily: f.serif, fontSize: 22, fontWeight: 400, color: t.coal, margin: 0, letterSpacing: "-0.01em" }}>
          Skills Breakdown
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontFamily: f.sans, fontSize: 12, color: t.inkSoft }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 16, height: 4, background: t.indigo, borderRadius: 2 }} />
            You
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 2, height: 12, background: t.inkSoft, borderRadius: 1 }} />
            Role Average
          </span>
        </div>
      </div>
      <div className="ir-skills-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 280px", gap: 28, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {skills.map((s) => {
            const pct = (s.score / max) * 100;
            const avgPct = s.roleAvg ? (s.roleAvg / max) * 100 : null;
            const delta = s.roleAvg ? s.score - s.roleAvg : null;
            return (
              <div key={s.name} className="ir-skill-row" style={{ display: "grid", gridTemplateColumns: "180px 1fr 60px 50px", gap: 14, alignItems: "center" }}>
                <span className="ir-skill-name" style={{ fontFamily: f.sans, fontSize: 13, color: t.coal }}>{s.name}</span>
                <div
                  className="ir-skill-bar-wrap"
                  style={{ background: t.line }}
                  role="progressbar"
                  aria-label={`${s.name} score`}
                  aria-valuenow={s.score}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuetext={
                    s.roleAvg !== undefined
                      ? `${s.score} out of 100. Role average is ${s.roleAvg}.`
                      : `${s.score} out of 100.`
                  }
                >
                  <div className="ir-skill-bar-bg" style={{ background: t.line }} />
                  <div
                    className="ir-skill-bar-fg"
                    style={{
                      width: `${pct}%`,
                      background: `linear-gradient(90deg, ${t.indigoDeep} 0%, ${t.indigo} 100%)`,
                    }}
                  />
                  {avgPct !== null && (
                    <div className="ir-skill-bar-marker" style={{ left: `calc(${avgPct}% - 1px)` }} aria-hidden="true" />
                  )}
                </div>
                <span className="ir-skill-score" style={{ fontFamily: f.mono, fontSize: 14, color: t.coal, textAlign: "right", fontWeight: 600 }}>
                  {s.score}
                </span>
                <span
                  className="ir-skill-delta"
                  style={{
                    fontFamily: f.mono,
                    fontSize: 12,
                    color: delta === null ? t.inkFaint : delta >= 0 ? t.success : t.error,
                    fontWeight: 600,
                    textAlign: "right",
                  }}
                >
                  {delta === null ? "—" : delta >= 0 ? `+${delta}` : delta}
                </span>
              </div>
            );
          })}
        </div>
        <aside
          style={{
            background: t.copperSoft,
            border: `1px solid ${t.copper100}`,
            borderRadius: 12,
            padding: "18px 20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.copper} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="6" />
              <circle cx="12" cy="12" r="2" />
            </svg>
            <span style={{ fontFamily: f.mono, fontSize: 11, color: t.copper, letterSpacing: "0.10em", textTransform: "uppercase", fontWeight: 600 }}>
              Focus on {weakest.name}
            </span>
          </div>
          <p style={{ fontFamily: f.sans, fontSize: 13, color: t.coal, lineHeight: 1.5, margin: "0 0 14px" }}>
            {weakest.tip}
          </p>
          <button type="button" className="ir-cta-primary" style={{ width: "100%", justifyContent: "center" }}>
            Drill this skill
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </aside>
      </div>
    </section>
  );
}

function StarChip({ active, letter, label }: { active: boolean; letter: string; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <span
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: active ? "rgba(21,128,61,0.16)" : t.line,
          color: active ? t.success : t.inkFaint,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: f.mono,
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        {letter}
      </span>
      <span style={{ fontFamily: f.sans, fontSize: 10, color: t.inkSoft }}>{label}</span>
    </div>
  );
}

function HighlightLegend() {
  const items: { kind: HighlightKind; label: string }[] = [
    { kind: "filler", label: "Filler / Hesitation" },
    { kind: "hedge", label: "Hedging" },
    { kind: "quantified", label: "Impact / Quantified" },
    { kind: "firstPerson", label: "First Person" },
  ];
  const colorFor = (k: HighlightKind) =>
    k === "filler" ? "rgba(212,179,127,0.30)"
    : k === "hedge" ? "rgba(110,103,89,0.18)"
    : k === "quantified" ? "rgba(21,128,61,0.18)"
    : "rgba(49,46,129,0.10)";
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 12 }}>
      {items.map((i) => (
        <span
          key={i.kind}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontFamily: f.sans,
            fontSize: 11,
            color: t.inkSoft,
          }}
        >
          <span style={{ width: 10, height: 10, borderRadius: 2, background: colorFor(i.kind) }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

/** Render a single answer body — handles plain string + highlighted
 *  spans the same way. Used for the user's answer, the AI-restructured
 *  version, and the top-performer exemplar. */
function AnswerBody({
  spans,
  bg,
  border,
}: {
  spans: AnswerSpan[];
  bg?: string;
  border?: string;
}) {
  return (
    <div
      style={{
        background: bg ?? t.creamSoft,
        border: `1px solid ${border ?? t.line}`,
        borderRadius: 12,
        padding: "16px 18px",
        fontFamily: f.sans,
        fontSize: 14,
        lineHeight: 1.7,
        color: t.coal,
      }}
    >
      {spans.map((span, i) => (
        <span
          key={i}
          className={
            span.highlight === "filler" ? "ir-highlight-filler"
            : span.highlight === "hedge" ? "ir-highlight-hedge"
            : span.highlight === "quantified" ? "ir-highlight-quant"
            : span.highlight === "firstPerson" ? "ir-highlight-first"
            : undefined
          }
        >
          {span.text}
        </span>
      ))}
    </div>
  );
}

function QuestionDetail({ q }: { q: Question }) {
  /* Tabs now drive the LEFT column content (Answer / Restructured /
     Top Performer). The middle (STAR + metrics) and right (coaching)
     columns stay constant — they're about the user's answer regardless
     of which version is being inspected. The Top Performer tab is the
     pedagogically most valuable surface (Final Round AI's moat); we
     render it as a distinct column so candidates can compare side-by-
     side, not just read coaching prose. */
  const [tab, setTab] = useState<"answer" | "restructured" | "exemplar">("answer");
  const isStrong = q.band === "strong" || q.band === "complete";
  const coachHeading = isStrong ? "Why it landed" : "Why it scored low";
  const coachColor = isStrong ? t.success : t.copper;
  const coachBg = isStrong ? "rgba(21,128,61,0.05)" : "rgba(212,179,127,0.06)";
  const coachBorder = isStrong ? "rgba(21,128,61,0.18)" : t.copper100;
  /* Stable IDs for the tab/panel ARIA wiring. Using the question
     index so multiple expanded panels in the report don't collide. */
  const idBase = `ir-tab-${q.index}`;
  return (
    <div style={{ padding: "0 18px 18px" }}>
      {/* Tab strip — Answer / Restructured / Top Performer */}
      <div role="tablist" aria-label={`Question ${q.index} answer views`} style={{ borderBottom: `1px solid ${t.line}`, marginBottom: 16 }}>
        <button
          type="button"
          role="tab"
          id={`${idBase}-answer-tab`}
          aria-selected={tab === "answer"}
          aria-controls={`${idBase}-answer-panel`}
          tabIndex={tab === "answer" ? 0 : -1}
          className="ir-tab-btn"
          onClick={() => setTab("answer")}
        >
          Your Answer
        </button>
        <button
          type="button"
          role="tab"
          id={`${idBase}-restructured-tab`}
          aria-selected={tab === "restructured"}
          aria-controls={`${idBase}-restructured-panel`}
          tabIndex={tab === "restructured" ? 0 : -1}
          className="ir-tab-btn"
          onClick={() => setTab("restructured")}
          disabled={!q.restructured}
          style={!q.restructured ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
        >
          Restructured (STAR)
        </button>
        <button
          type="button"
          role="tab"
          id={`${idBase}-exemplar-tab`}
          aria-selected={tab === "exemplar"}
          aria-controls={`${idBase}-exemplar-panel`}
          tabIndex={tab === "exemplar" ? 0 : -1}
          className="ir-tab-btn"
          onClick={() => setTab("exemplar")}
          disabled={!q.topPerformerAnswer}
          style={!q.topPerformerAnswer ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
        >
          Top Performer Answer
          <span
            style={{
              marginLeft: 6,
              padding: "1px 6px",
              borderRadius: 999,
              background: t.copperSoft,
              color: t.copper,
              fontFamily: f.mono,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.06em",
            }}
          >
            EXEMPLAR
          </span>
        </button>
      </div>

      {/* The previous 3-column grid (1.5fr 1fr 1fr) created severe vertical
          imbalance: the answer column was short, the metrics column was
          medium, and the coaching column was very tall — leaving big dead
          whitespace on the left and right while the middle felt cramped.
          New layout: 2 columns. Left holds the answer + STAR/metrics strip
          stacked, right holds the coaching panel. Both columns now carry
          comparable content density so heights align naturally. */}
      <div className="ir-pq-detail-grid" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 18, alignItems: "start" }}>
        {/* LEFT column — answer (tab-driven) + horizontal STAR/metrics strip
            stacked underneath. The metrics strip used to be its own column;
            it's a more honest fit as a footer to the answer because it
            describes the answer. Each tab content lives inside a
            role="tabpanel" wired to its trigger via aria-labelledby. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          {tab === "answer" && (
            <div role="tabpanel" id={`${idBase}-answer-panel`} aria-labelledby={`${idBase}-answer-tab`}>
              <AnswerBody spans={q.answer} />
              <HighlightLegend />
            </div>
          )}
          {tab === "restructured" && q.restructured && (
            <div role="tabpanel" id={`${idBase}-restructured-panel`} aria-labelledby={`${idBase}-restructured-tab`}>
              <div style={{ position: "relative" }}>
                <span
                  style={{
                    position: "absolute",
                    top: 12,
                    right: 12,
                    padding: "3px 8px",
                    borderRadius: 999,
                    background: t.indigo100,
                    color: t.indigo,
                    fontFamily: f.mono,
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                  }}
                >
                  AI-RESTRUCTURED
                </span>
                <AnswerBody spans={q.restructured} bg={t.white} border={t.line} />
              </div>
              <p style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, lineHeight: 1.55, margin: "10px 0 0" }}>
                Same content as your answer, reorganized into clean STAR. Save this as your reference version.
              </p>
            </div>
          )}
          {tab === "exemplar" && q.topPerformerAnswer && (
            <div role="tabpanel" id={`${idBase}-exemplar-panel`} aria-labelledby={`${idBase}-exemplar-tab`}>
              <div style={{ position: "relative" }}>
                <span
                  style={{
                    position: "absolute",
                    top: 12,
                    right: 12,
                    padding: "3px 8px",
                    borderRadius: 999,
                    background: "rgba(21,128,61,0.10)",
                    color: t.success,
                    fontFamily: f.mono,
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                  }}
                >
                  EXEMPLAR
                </span>
                <AnswerBody
                  spans={q.topPerformerAnswer}
                  bg="rgba(21,128,61,0.04)"
                  border="rgba(21,128,61,0.20)"
                />
              </div>
              <p style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, lineHeight: 1.55, margin: "10px 0 0" }}>
                What an L4-equivalent candidate at this company would say. Use it as a reference shape, not a script — the goal is to internalize the structure.
              </p>
              {q.whatMakesItStrong && q.whatMakesItStrong.length > 0 && (
                <>
                  <div style={{ fontFamily: f.mono, fontSize: 11, color: t.success, letterSpacing: "0.10em", textTransform: "uppercase", fontWeight: 600, marginTop: 14 }}>
                    What makes it strong
                  </div>
                  <ul className="ir-strong-list">
                    {q.whatMakesItStrong.map((bullet) => (
                      <li key={bullet} className="ir-strong-list-item">
                        <span className="ir-strong-list-marker" aria-hidden="true" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>

        {/* STAR + metrics — now a HORIZONTAL strip under the answer.
            STAR chips on the left, metric tiles flowing on the right
            with vertical dividers between them. Reads as one band of
            quick-glance numbers describing the answer above it,
            instead of a 200px-wide column of dt/dd rows competing for
            visual weight with the coaching panel beside it. */}
        <div
          className="ir-pq-metrics-strip"
          style={{
            background: t.white,
            border: `1px solid ${t.line}`,
            borderRadius: 12,
            padding: "12px 16px",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", gap: 8 }}>
            <StarChip active={q.star.situation} letter="S" label="Situation" />
            <StarChip active={q.star.task} letter="T" label="Task" />
            <StarChip active={q.star.action} letter="A" label="Action" />
            <StarChip active={q.star.result} letter="R" label="Result" />
            <StarChip active={q.star.learning} letter="L" label="Learning" />
          </div>
          <span aria-hidden="true" style={{ width: 1, alignSelf: "stretch", background: t.line }} />
          {/* Each metric: stacked label-over-value tile. Mono numerals stay
              prominent; small uppercase label sits quietly above. The strip
              flex-wraps on narrower viewports so nothing truncates. */}
          {[
            { label: "Words", value: `${q.metrics.wordCount}`, tone: t.coal },
            { label: "Length", value: `${q.metrics.responseSec.toFixed(1)}s`, tone: t.coal },
            { label: "First-person", value: `${q.metrics.firstPersonRatioPct}%`, tone: t.coal },
            { label: "Quantified", value: `${q.metrics.quantificationCount}`, tone: q.metrics.quantificationCount === 0 ? t.error : t.coal },
          ].map((m) => (
            <div key={m.label} style={{ display: "flex", flexDirection: "column", minWidth: 64 }}>
              <span style={{ fontFamily: f.mono, fontSize: 9, fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase", color: t.inkSoft }}>{m.label}</span>
              <span style={{ fontFamily: f.mono, fontSize: 14, fontWeight: 600, color: m.tone, marginTop: 2 }}>{m.value}</span>
            </div>
          ))}
        </div>
        </div>

        {/* Coaching column — heading flips by band so high-scoring
            questions get a "why it landed + how to keep it" treatment
            instead of repeating "why it scored low" against a green
            score. Sage tint when strong, copper tint when weak. */}
        <div
          style={{
            background: coachBg,
            border: `1px solid ${coachBorder}`,
            borderRadius: 12,
            padding: "16px 18px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div style={{ fontFamily: f.mono, fontSize: 11, color: coachColor, letterSpacing: "0.10em", textTransform: "uppercase", fontWeight: 600 }}>
            {coachHeading}
          </div>
          <p style={{ fontFamily: f.sans, fontSize: 14, color: t.coal, lineHeight: 1.55, margin: 0 }}>
            {q.whyScored}
          </p>
          {q.redFlags && q.redFlags.length > 0 && (
            <ul className="ir-redflag-list" aria-label="Red flags">
              {q.redFlags.map((rf) => (
                <li key={rf.title} className="ir-redflag-item">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={t.error} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }}>
                    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <span style={{ flex: 1 }}>
                    <span className="ir-redflag-item-title">{rf.title}.</span>{" "}
                    {rf.explanation}
                    {rf.quote && <span className="ir-redflag-item-quote">&ldquo;{rf.quote}&rdquo;</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {!isStrong && q.likelyFollowUp && (
            <div className="ir-likely-followup">
              <span className="ir-likely-followup-eyebrow">Likely follow-up</span>
              {q.likelyFollowUp}
            </div>
          )}
          <button type="button" className="ir-cta-primary" style={{ alignSelf: "flex-start", marginTop: "auto" }}>
            {isStrong ? "Save to Notebook" : "Try this question again"}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {isStrong ? (
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              ) : (
                <>
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15A9 9 0 1 1 5.64 5.64L1 10" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function PerQuestionSection({ questions }: { questions: Question[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(0); // first card open by default
  /* Progressive disclosure — for the average 5-6 question session,
     showing all rows expanded is fine. But Pro users do panel/long
     sessions of 10+ questions; rendering all of them by default
     overwhelms the report. Show 3 expanded triggers; defer the rest
     behind a single "Show N more questions" reveal. */
  const PRIMARY_COUNT = 3;
  const [showAll, setShowAll] = useState<boolean>(questions.length <= PRIMARY_COUNT);
  const visible = showAll ? questions : questions.slice(0, PRIMARY_COUNT);
  const hiddenCount = questions.length - visible.length;
  const handleExpandAll = () => {
    setShowAll(true);
    setOpenIdx(null);
  };
  return (
    <section
      id="ir-section-questions"
      aria-labelledby="ir-questions-heading"
      style={{
        background: t.white,
        border: `1px solid ${t.line}`,
        borderRadius: 16,
        padding: 0,
        boxShadow: shadows.card,
        overflow: "hidden",
        scrollMarginTop: 72,
      }}
    >
      <div style={{ padding: "24px 28px 0" }}>
        <SectionEyebrow num="04" label="Question by question" />
      </div>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          padding: "0 28px 16px",
        }}
      >
        <h2 id="ir-questions-heading" style={{ fontFamily: f.serif, fontSize: 22, fontWeight: 400, color: t.coal, margin: 0, letterSpacing: "-0.01em" }}>
          Per-Question Review <span style={{ color: t.inkFaint, fontSize: 16, marginLeft: 6 }}>({questions.length})</span>
        </h2>
        {showAll ? (
          <button
            type="button"
            onClick={() => setOpenIdx(null)}
            style={{ background: "transparent", border: "none", color: t.indigo, fontFamily: f.sans, fontSize: 12, cursor: "pointer", fontWeight: 500 }}
          >
            Collapse all
          </button>
        ) : null}
      </header>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {visible.map((q, idx) => {
          const open = openIdx === idx;
          const band = BAND_META[q.band];
          const panelId = `ir-q-panel-${q.index}`;
          return (
            <li key={q.index} style={{ borderTop: `1px solid ${t.line}` }}>
              <button
                type="button"
                className="ir-q-card-trigger"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpenIdx(open ? null : idx)}
              >
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: open ? t.indigo : t.creamSoft,
                    color: open ? t.cream : t.coal,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: f.mono,
                    fontSize: 13,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {q.index}
                </span>
                <span className="ir-q-trigger-text" style={{ flex: 1, fontFamily: f.sans, fontSize: 14, color: t.coal, fontWeight: open ? 600 : 500 }}>
                  {q.text}
                </span>
                {/* Inline meta pills — frequency / length verdict / red-flag
                    count. These are 1-glance qualifiers that change how a
                    user prioritises this question card. Hidden on narrow
                    viewports where they'd cause the trigger row to wrap. */}
                {q.frequencyPct !== undefined && q.frequencyPct >= 70 && (
                  <span
                    className="ir-q-meta-pill high-freq ir-q-trigger-band"
                    title={q.frequencyNote ?? `${q.frequencyPct}% of rounds`}
                  >
                    {q.frequencyPct}% asked
                  </span>
                )}
                {q.lengthVerdict && q.lengthVerdict !== "justRight" && (
                  <span
                    className={`ir-q-meta-pill ${q.lengthVerdict === "tooShort" ? "too-short" : "too-long"} ir-q-trigger-band`}
                  >
                    {q.lengthVerdict === "tooShort" ? "Too short" : "Too long"}
                  </span>
                )}
                {q.redFlags && q.redFlags.length > 0 && (
                  <span
                    className="ir-q-redflag-badge ir-q-trigger-band"
                    aria-label={`${q.redFlags.length} red flag${q.redFlags.length === 1 ? "" : "s"}`}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    {q.redFlags.length} flag{q.redFlags.length === 1 ? "" : "s"}
                  </span>
                )}
                <span
                  className="ir-q-trigger-band"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "3px 10px",
                    borderRadius: 999,
                    background: band.color === t.error ? "rgba(196,112,90,0.10)" : band.color === t.copper ? "rgba(180,83,9,0.10)" : "rgba(21,128,61,0.10)",
                    color: band.color,
                    fontFamily: f.sans,
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  {band.label}
                </span>
                <span style={{ fontFamily: f.mono, fontSize: 13, color: t.coal, fontWeight: 600, minWidth: 60, textAlign: "right" }}>
                  {q.score} <span style={{ color: t.inkFaint, fontWeight: 400 }}>/100</span>
                </span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={t.inkSoft}
                  strokeWidth="2"
                  strokeLinecap="round"
                  style={{ transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform 200ms ease", flexShrink: 0 }}
                  aria-hidden="true"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {/* tabpanel role + id wires up to the trigger's
                  aria-controls so screen readers announce the
                  detail panel as the controlled region. */}
              <div id={panelId} role="region" hidden={!open}>
                {open && <QuestionDetail q={q} />}
              </div>
            </li>
          );
        })}
      </ul>
      {/* Progressive-disclosure reveal — only renders when there are
          questions beyond the primary 3. Long-session reports (panel
          / 10+ Q) stay scannable on first load. */}
      {hiddenCount > 0 && (
        <div
          style={{
            borderTop: `1px solid ${t.line}`,
            padding: "14px 28px",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <button
            type="button"
            className="ir-cta-ghost"
            onClick={handleExpandAll}
            aria-label={`Show ${hiddenCount} more question${hiddenCount === 1 ? "" : "s"}`}
          >
            Show {hiddenCount} more question{hiddenCount === 1 ? "" : "s"}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      )}
    </section>
  );
}

/** Coach's Notes — conditional aggregation of cross-session insights,
 *  story-reuse findings, and blind spots. Renders nothing when none
 *  of those data points are present (first session, single-session
 *  view, etc.). When it does fire it gives users the "what would my
 *  coach say if they reviewed all my sessions?" perspective that's
 *  hard to get from a per-session report. */
function CoachNotesSection({
  insights,
  storyReuse,
  blindSpots,
}: {
  insights?: CrossSessionInsight[];
  storyReuse?: StoryReuseFinding[];
  blindSpots?: BlindSpot[];
}) {
  const hasInsights = insights && insights.length > 0;
  const hasStoryReuse = storyReuse && storyReuse.length > 0;
  const hasBlindSpots = blindSpots && blindSpots.length > 0;
  if (!hasInsights && !hasStoryReuse && !hasBlindSpots) return null;
  return (
    <section
      id="ir-section-coach-notes"
      aria-labelledby="ir-coach-notes-heading"
      style={{
        background: t.white,
        border: `1px solid ${t.line}`,
        borderRadius: 16,
        padding: 28,
        boxShadow: shadows.card,
        scrollMarginTop: 72,
      }}
    >
      <SectionEyebrow num="05" label="What your coach would say" />
      <h2
        id="ir-coach-notes-heading"
        style={{ fontFamily: f.serif, fontSize: 22, fontWeight: 400, color: t.coal, margin: "0 0 6px", letterSpacing: "-0.01em" }}
      >
        Coach&apos;s Notes
      </h2>
      <p style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, margin: "0 0 18px", lineHeight: 1.5 }}>
        Patterns we&apos;ve noticed across your last few sessions — the perspective a human coach would bring.
      </p>
      <div className="ir-coach-notes-grid">
        {hasInsights && insights!.map((it) => (
          <article
            key={it.title}
            className={`ir-coach-note-card ${it.kind === "regression" ? "regression" : "persistent"}`}
          >
            <div className="ir-coach-note-eyebrow">
              {it.kind === "regression" ? "↓ Regression" : it.kind === "improvement" ? "↑ Improvement" : "Persistent gap"}
            </div>
            <h3 className="ir-coach-note-title">{it.title}</h3>
            <p className="ir-coach-note-body">{it.body}</p>
          </article>
        ))}
        {hasStoryReuse && storyReuse!.map((s) => (
          <article key={s.storyLabel} className="ir-coach-note-card story-reuse">
            <div className="ir-coach-note-eyebrow">↻ Story reuse</div>
            <h3 className="ir-coach-note-title">{s.storyLabel}</h3>
            <p className="ir-coach-note-body">{s.body}</p>
          </article>
        ))}
        {hasBlindSpots && blindSpots!.map((b) => (
          <article key={b.title} className="ir-coach-note-card blind-spot">
            <div className="ir-coach-note-eyebrow">◌ Blind spot</div>
            <h3 className="ir-coach-note-title">{b.title}</h3>
            <p className="ir-coach-note-body">{b.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

/** Thought-bubble timeline — opt-in horizontal stacked bar showing
 *  interviewer-state across the session ("engaged" / "drifting" /
 *  "concerned"). Collapsed behind a toggle by default because it's
 *  high-novelty / low-frequency-of-need; users who want it deeply,
 *  expand it. We collapse the production 6-state model to 3 because
 *  more bands wash visually at this scale. */
function ThoughtBubbleSection({ segments }: { segments: ThoughtBubbleSegment[] }) {
  const [open, setOpen] = useState(false);
  if (!segments || segments.length === 0) return null;
  const totalPct = segments.reduce((acc, s) => acc + s.pct, 0);
  return (
    <section
      aria-label="Interviewer attention timeline"
      style={{
        background: t.white,
        border: `1px solid ${t.line}`,
        borderRadius: 16,
        padding: "16px 22px",
        boxShadow: shadows.card,
        scrollMarginTop: 72,
      }}
    >
      <button
        type="button"
        className="ir-thought-toggle"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {open ? "Hide" : "Show"} interviewer&apos;s attention timeline
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform 200ms" }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div style={{ marginTop: 10 }}>
          <p style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, margin: "0 0 4px", lineHeight: 1.5 }}>
            Modelled from latency patterns, hedging density, and your transitions. Approximate — read it as a sketch, not a transcript.
          </p>
          <div
            className="ir-thought-track"
            role="img"
            aria-label={`Interviewer attention: ${segments.map((s) => `${s.pct}% ${s.state}`).join(", ")}`}
          >
            {segments.map((s, i) => (
              <div
                key={i}
                className={`ir-thought-seg-${s.state}`}
                style={{ width: `${(s.pct / Math.max(totalPct, 1)) * 100}%` }}
                title={`${s.pct}% ${s.state}`}
              />
            ))}
          </div>
          <div className="ir-thought-legend" aria-hidden="true">
            <span><span className="ir-thought-legend-swatch ir-thought-seg-engaged" />Engaged</span>
            <span><span className="ir-thought-legend-swatch ir-thought-seg-drifting" />Drifting</span>
            <span><span className="ir-thought-legend-swatch ir-thought-seg-concerned" />Concerned</span>
          </div>
        </div>
      )}
    </section>
  );
}

/** Bias / perception-optimizer panel — surfaces language-pattern hits
 *  research has empirically tied to lower hiring outcomes. Framed as
 *  a perception optimizer; renders nothing when no patterns fired so
 *  first-session reports stay clean. HireStepX-specific differentiator
 *  for the Indian-candidate market — no other AI mock-interview tool
 *  ships this. */
function BiasSection({ findings }: { findings: BiasFinding[] }) {
  if (!findings || findings.length === 0) return null;
  return (
    <section
      id="ir-section-bias"
      aria-labelledby="ir-bias-heading"
      style={{
        background: t.white,
        border: `1px solid ${t.line}`,
        borderRadius: 16,
        padding: 28,
        boxShadow: shadows.card,
        scrollMarginTop: 72,
      }}
    >
      <SectionEyebrow num="06" label="Perception optimizer" />
      <h2
        id="ir-bias-heading"
        style={{
          fontFamily: f.serif,
          fontSize: 22,
          fontWeight: 400,
          color: t.coal,
          margin: "0 0 6px",
          letterSpacing: "-0.01em",
        }}
      >
        Language patterns to watch
      </h2>
      <p style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, margin: "0 0 4px", lineHeight: 1.55 }}>
        Research-backed patterns that tend to lower hiring perception. Not a judgment — a perception optimizer.
      </p>
      <div className="ir-bias-grid">
        {findings.map((b) => (
          <div key={b.kind} className="ir-bias-card">
            <div className="ir-bias-card-head">
              <span className="ir-bias-count">{b.count}×</span>
              <span className="ir-bias-label">{b.label}</span>
            </div>
            {b.example && (
              <span className="ir-bias-example">&ldquo;{b.example}&rdquo;</span>
            )}
            <span className="ir-bias-tip">{b.suggestion}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── Reverse-interview closing-turn card ─────────────────────────────
 *
 * Renders when the candidate got the "do you have any questions for us?"
 * closing turn AND the evaluator was able to classify their reply. The
 * shape comes from src/_reverse-interview.ts via the wire SessionReport
 * → adapter → InterviewResultData.
 *
 * Indian recruiters weigh this turn heavily — salary-in-round-1 / leave-
 * policy / WFH-aggressive questions are documented offer-killers. So we
 * surface verdict + per-question buckets explicitly, with reason codes
 * humanised for the candidate.
 */
const REVERSE_REASON_LABELS: Record<string, string> = {
  success_definition: "Asked what success looks like in 30–90 days",
  team_structure: "Asked how the team is structured",
  current_challenge: "Asked about the team's hardest current problem",
  decision_making_process: "Asked how technical decisions get made",
  variable_payout_history: "Asked about variable / bonus payout history",
  expected_contribution: "Asked what you'd be expected to bring",
  tech_debt_or_tradeoffs: "Asked how the team thinks about tech-debt / trade-offs",
  honest_reflection_invite: "Asked the interviewer for an honest reflection",
  services_structure_probe: "Asked about onshore / offshore / client split",
  salary_too_early: "Asked about salary / CTC in this round",
  wfh_aggressive: "Asked for WFH 'full time / always' upfront",
  promotion_timeline_entitled: "Asked 'when will I get promoted / hiked?'",
  leave_policy_pre_offer: "Asked about leave / attendance policy pre-offer",
  attendance_strictness: "Asked how strict attendance / timing is",
  anti_work_signalling: "Asked about weekends / night-shifts / overtime",
  joining_bonus_negotiation_too_early: "Tried to negotiate joining bonus here",
  generic_culture: "Asked a generic 'what's the culture like'",
  process_basics: "Asked about next steps / process timeline",
  generic_closer: "Closed with 'anything else I should know?'",
  unclassified: "Question didn't match a known shape",
  empty: "No question was asked",
};

const REVERSE_VERDICT_COPY: Record<"strong" | "neutral" | "weak" | "red_flag", {
  title: string;
  oneLiner: string;
  tone: "good" | "ok" | "warn" | "bad";
}> = {
  strong: {
    title: "Strong close",
    oneLiner: "You asked at least one substantive role / team question — that's the senior-judgement signal Indian hiring managers look for here.",
    tone: "good",
  },
  neutral: {
    title: "Neutral close",
    oneLiner: "Your closing questions were generic. They didn't hurt, but a real-role probe (success criteria, team shape, decision-making) would lift this turn from neutral to strong.",
    tone: "ok",
  },
  weak: {
    title: "Low-engagement close",
    oneLiner: "You said little / nothing when invited. Indian recruiters read silence here as low interest. Always have one substantive question ready.",
    tone: "warn",
  },
  red_flag: {
    title: "Closing-turn red flag",
    oneLiner: "One of your questions is a documented offer-killer in Indian loops at this stage. Reshape it for round 2 — these belong with HR after the offer, not with the panel before.",
    tone: "bad",
  },
};

function ReverseInterviewSection({
  reverse,
}: {
  reverse: NonNullable<InterviewResultData["reverseInterview"]>;
}) {
  const copy = REVERSE_VERDICT_COPY[reverse.verdict];
  const accent =
    copy.tone === "good" ? t.success
    : copy.tone === "ok" ? t.indigo
    : copy.tone === "warn" ? t.warning
    : t.error;
  return (
    <section
      id="ir-section-reverse"
      aria-labelledby="ir-reverse-heading"
      style={{
        background: t.white,
        border: `1px solid ${t.line}`,
        borderRadius: 16,
        padding: 28,
        boxShadow: shadows.card,
        scrollMarginTop: 72,
      }}
    >
      <SectionEyebrow num="07" label="Reverse interview" />
      <h2
        id="ir-reverse-heading"
        style={{
          fontFamily: f.serif,
          fontSize: 22,
          fontWeight: 400,
          color: t.coal,
          margin: "0 0 6px",
          letterSpacing: "-0.01em",
        }}
      >
        {copy.title}
      </h2>
      <p style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, margin: "0 0 16px", lineHeight: 1.55 }}>
        {copy.oneLiner}
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <span style={{ fontFamily: f.sans, fontSize: 12, padding: "4px 10px", borderRadius: 999, background: "rgba(80,150,100,0.10)", color: t.success, fontWeight: 600 }}>
          {reverse.counts.green} strong
        </span>
        <span style={{ fontFamily: f.sans, fontSize: 12, padding: "4px 10px", borderRadius: 999, background: "rgba(180,140,60,0.10)", color: t.warning, fontWeight: 600 }}>
          {reverse.counts.yellow} neutral
        </span>
        <span style={{ fontFamily: f.sans, fontSize: 12, padding: "4px 10px", borderRadius: 999, background: "rgba(196,112,90,0.10)", color: t.error, fontWeight: 600 }}>
          {reverse.counts.red} risky
        </span>
      </div>
      {reverse.classifications.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {reverse.classifications.map((c, i) => {
            const dotColor = c.bucket === "green" ? t.success : c.bucket === "red" ? t.error : t.warning;
            return (
              <li
                key={i}
                style={{
                  fontFamily: f.sans,
                  fontSize: 13,
                  color: t.coal,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 12px",
                  background: t.cream,
                  borderRadius: 8,
                  borderLeft: `3px solid ${dotColor}`,
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor, flexShrink: 0 }} aria-hidden="true" />
                <span>{REVERSE_REASON_LABELS[c.reason] || c.reason}</span>
              </li>
            );
          })}
        </ul>
      )}
      <p
        style={{
          fontFamily: f.sans,
          fontSize: 12,
          color: accent,
          margin: "14px 0 0",
          fontStyle: "italic",
        }}
      >
        Verdict: {reverse.verdict.replace("_", " ")}
      </p>
    </section>
  );
}

function NextStepsSection({
  daysUntilInterview,
  readinessSentence,
  weakestSkill,
  onTryWeakestQuestion,
  onDrillSkill,
  onSaveTopStory,
}: {
  daysUntilInterview?: number;
  readinessSentence?: string;
  weakestSkill?: string;
  onTryWeakestQuestion?: () => void;
  onDrillSkill?: () => void;
  onSaveTopStory?: () => void;
}) {
  /* The first card is date-aware. When the user has a scheduled
     interview, generic "try weakest question" gives way to a date-
     pinned prep plan ("Your interview is in 4 days — here's a 3-
     session schedule"). Calendar feature is in production already —
     this surface ties to it. Falls back to the generic card otherwise. */
  const hasScheduledInterview = typeof daysUntilInterview === "number" && daysUntilInterview > 0;
  const sessionsToFit = hasScheduledInterview
    ? Math.min(6, Math.max(2, Math.floor((daysUntilInterview as number) * 0.6)))
    : 0;

  const firstCard = hasScheduledInterview
    ? {
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        ),
        iconBg: "rgba(196,112,90,0.10)",
        iconColor: t.error,
        title: `Build your ${daysUntilInterview}-day prep plan`,
        desc: `Your interview is ${daysUntilInterview} days away. Schedule ${sessionsToFit} focused sessions on your weakest skill.`,
        cta: "Schedule now",
      }
    : {
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="2" />
          </svg>
        ),
        iconBg: "rgba(196,112,90,0.10)",
        iconColor: t.error,
        title: "Try your weakest question again",
        desc: "Improve your answer for Q1 and see your score go up.",
        cta: "Retry now",
      };

  const firstCardWithHandler = { ...firstCard, onClick: onTryWeakestQuestion };
  const cards = [
    firstCardWithHandler,
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
      ),
      iconBg: t.indigo100,
      iconColor: t.indigo,
      title: "Save top story to Notebook",
      desc: "Save your strongest answer as a reusable narrative.",
      cta: "Save story",
      onClick: onSaveTopStory,
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
      ),
      iconBg: "rgba(49,46,129,0.08)",
      iconColor: t.indigo,
      title: "Drill your weakest skill",
      desc: weakestSkill
        ? `Focus on ${weakestSkill} with a 5-question drill.`
        : "Run a focused drill on your lowest skill.",
      cta: "Start drill",
      onClick: onDrillSkill,
    },
  ];
  return (
    <section
      id="ir-section-next"
      aria-labelledby="ir-next-heading"
      style={{
        background: t.white,
        border: `1px solid ${t.line}`,
        borderRadius: 16,
        padding: 28,
        boxShadow: shadows.card,
        scrollMarginTop: 72,
      }}
    >
      <SectionEyebrow num="06" label="What to do now" />
      <h2 id="ir-next-heading" style={{ fontFamily: f.serif, fontSize: 22, fontWeight: 400, color: t.coal, margin: "0 0 6px", letterSpacing: "-0.01em" }}>
        Recommended Next Steps
      </h2>
      {readinessSentence && (
        <p
          style={{
            fontFamily: f.sans,
            fontSize: 14,
            color: t.coal,
            margin: "0 0 18px",
            lineHeight: 1.55,
            paddingLeft: 12,
            borderLeft: `2px solid ${t.copper}`,
          }}
        >
          {readinessSentence}
        </p>
      )}
      <div className="ir-next-steps-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        {cards.map((c) => (
          <div
            key={c.title}
            style={{
              background: t.creamSoft,
              border: `1px solid ${t.line}`,
              borderRadius: 12,
              padding: "18px 20px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <span
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: c.iconBg,
                color: c.iconColor,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {c.icon}
            </span>
            <h3 style={{ fontFamily: f.sans, fontSize: 15, fontWeight: 600, color: t.coal, margin: 0 }}>{c.title}</h3>
            <p style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, lineHeight: 1.5, margin: 0, flex: 1 }}>
              {c.desc}
            </p>
            <button
              type="button"
              onClick={c.onClick}
              disabled={!c.onClick}
              style={{
                background: "transparent",
                border: "none",
                color: c.onClick ? t.indigo : t.inkFaint,
                fontFamily: f.sans,
                fontSize: 13,
                fontWeight: 600,
                cursor: c.onClick ? "pointer" : "not-allowed",
                padding: 0,
                alignSelf: "flex-start",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {c.cta}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function FooterSection({
  onTrustAnswer,
  onUsefulAnswer,
}: {
  onTrustAnswer?: (value: "yes" | "no") => void;
  onUsefulAnswer?: (value: "yes" | "no") => void;
}) {
  /* The thumbs are direction-only. The follow-up tag row appears
     after a thumb-down so we can capture WHY (too harsh / too
     generous / vague / not actionable). The trust + usefulness 2-
     question polls below are separate — they fire structured analytics
     events the rubric team relies on for quarterly LLM-prompt re-tuning. */
  const [thumb, setThumb] = useState<"up" | "down" | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [trust, setTrust] = useState<"yes" | "no" | null>(null);
  const [useful, setUseful] = useState<"yes" | "no" | null>(null);
  const reasons = thumb === "down"
    ? ["Score felt too harsh", "Score felt too generous", "Feedback was vague", "Wrong about my answer"]
    : ["The score felt fair", "Coaching was specific", "I'll try the retry CTA"];
  return (
    <footer
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "8px 4px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: f.sans, fontSize: 12, color: t.inkSoft }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.copper} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 2 4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4z" />
            <polyline points="9 12 11 14 15 10" />
          </svg>
          Your data is private and secure.
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: f.sans, fontSize: 12, color: t.inkSoft }}>
          Was this report helpful?
          <button
            type="button"
            className={`ir-thumb-btn${thumb === "up" ? " active" : ""}`}
            aria-label="Helpful"
            aria-pressed={thumb === "up"}
            onClick={() => { setThumb(thumb === "up" ? null : "up"); setReason(null); }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
            </svg>
          </button>
          <button
            type="button"
            className={`ir-thumb-btn${thumb === "down" ? " active" : ""}`}
            aria-label="Not helpful"
            aria-pressed={thumb === "down"}
            onClick={() => { setThumb(thumb === "down" ? null : "down"); setReason(null); }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zM17 2h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3" />
            </svg>
          </button>
        </div>
      </div>
      {/* Reason tag row — only shown after a thumb is selected so we
          don't waste the user's attention on a default-state survey. */}
      {thumb && (
        <div
          className="ir-feedback-row"
          role="group"
          aria-label="What was off?"
          style={{ justifyContent: "flex-end", paddingTop: 4 }}
        >
          <span style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft }}>
            {thumb === "down" ? "What was off?" : "What worked?"}
          </span>
          {reasons.map((r) => (
            <button
              key={r}
              type="button"
              className={`ir-feedback-tag${reason === r ? " active" : ""}`}
              aria-pressed={reason === r}
              onClick={() => setReason(reason === r ? null : r)}
            >
              {r}
            </button>
          ))}
          {reason && (
            <span style={{ fontFamily: f.sans, fontSize: 11, color: t.success, fontWeight: 500 }}>
              ✓ Thanks — recorded
            </span>
          )}
        </div>
      )}
      {/* Trust + usefulness dual-poll. Separate from the thumbs — these
          fire `report_trust_poll_submitted` + `report_usefulness_poll_submitted`
          analytics events that the calibration pipeline consumes for
          quarterly LLM-prompt re-tuning. */}
      <div className="ir-poll-row" style={{ paddingTop: 6, justifyContent: "space-between" }}>
        <div className="ir-poll-row">
          <span>Did this score feel fair?</span>
          <button
            type="button"
            className={`ir-poll-yes${trust === "yes" ? " active" : ""}`}
            aria-pressed={trust === "yes"}
            onClick={() => { setTrust("yes"); onTrustAnswer?.("yes"); }}
          >
            Yes
          </button>
          <button
            type="button"
            className={`ir-poll-no${trust === "no" ? " active" : ""}`}
            aria-pressed={trust === "no"}
            onClick={() => { setTrust("no"); onTrustAnswer?.("no"); }}
          >
            No
          </button>
        </div>
        <div className="ir-poll-row">
          <span>Will you act on this feedback?</span>
          <button
            type="button"
            className={`ir-poll-yes${useful === "yes" ? " active" : ""}`}
            aria-pressed={useful === "yes"}
            onClick={() => { setUseful("yes"); onUsefulAnswer?.("yes"); }}
          >
            Yes
          </button>
          <button
            type="button"
            className={`ir-poll-no${useful === "no" ? " active" : ""}`}
            aria-pressed={useful === "no"}
            onClick={() => { setUseful("no"); onUsefulAnswer?.("no"); }}
          >
            No
          </button>
        </div>
      </div>
    </footer>
  );
}

/* ─── Credibility callout ────────────────────────────────────────────
 *  Surfaces the Wave-7/8.x resume cross-checks from the campus-
 *  placement analyzer (claimed company / branch / grad year / college /
 *  CGPA / internship duration). These are the highest-cost mistakes a
 *  candidate can make — every one mirrors an Indian BGV team's actual
 *  cross-check against the offer letter / transcript / degree
 *  certificate. We render them in a dedicated red-headlined panel near
 *  the top of the report so they don't disappear into the rubric-gap
 *  list. Quietly omitted when no credibility flags fired (the happy
 *  path for ~70% of campus-placement sessions). */
function CredibilitySection({ summary }: { summary: CredibilitySummary }) {
  if (!summary.hasIssues) return null;
  return (
    <section
      id="ir-section-credibility"
      aria-label="Credibility — resume vs transcript"
      style={{
        background: "rgba(196,112,90,0.06)",
        border: `1px solid ${t.error}`,
        borderRadius: 14,
        padding: "20px 22px",
        boxShadow: shadows.card,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 24,
            height: 24,
            padding: "0 8px",
            borderRadius: 999,
            background: t.error,
            color: "#fff",
            fontFamily: f.sans,
            fontSize: 12,
            fontWeight: 700,
          }}
          aria-label={`${summary.count} credibility issue${summary.count === 1 ? "" : "s"}`}
        >
          {summary.count}
        </span>
        <h2
          style={{
            margin: 0,
            fontFamily: f.serif,
            fontSize: 20,
            fontWeight: 600,
            color: t.coal,
          }}
        >
          BGV-risk audit — fix before the next interview
        </h2>
      </header>
      <p
        style={{
          margin: 0,
          fontFamily: f.sans,
          fontSize: 13,
          lineHeight: 1.55,
          color: t.coal,
          opacity: 0.85,
        }}
      >
        What you said in the interview drifted from what your resume
        claims. Indian recruiters cross-check these against the
        offer letter, transcript, and degree certificate during
        background verification — each one is an instant-disqualifier
        if it surfaces post-offer.
      </p>
      <ul
        style={{
          margin: 0,
          padding: 0,
          listStyle: "none",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {summary.items.map((item) => (
          <li
            key={item.flag}
            style={{
              background: "#fff",
              border: `1px solid rgba(196,112,90,0.30)`,
              borderRadius: 10,
              padding: "12px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <div
              style={{
                fontFamily: f.sans,
                fontSize: 14,
                fontWeight: 600,
                color: t.coal,
              }}
            >
              {item.label}
            </div>
            {item.evidence ? (
              <div
                style={{
                  fontFamily: f.mono ?? f.sans,
                  fontSize: 12,
                  color: t.coal,
                  opacity: 0.78,
                  lineHeight: 1.5,
                }}
              >
                {item.evidence.observed}
              </div>
            ) : item.description ? (
              <div
                style={{
                  fontFamily: f.sans,
                  fontSize: 12,
                  color: t.coal,
                  opacity: 0.78,
                  lineHeight: 1.5,
                }}
              >
                {item.description}
              </div>
            ) : null}
            <div
              style={{
                marginTop: 4,
                padding: "8px 10px",
                borderRadius: 6,
                background: "rgba(21,128,61,0.06)",
                fontFamily: f.sans,
                fontSize: 12,
                color: t.success,
                lineHeight: 1.5,
              }}
            >
              <strong style={{ fontWeight: 600 }}>Fix:</strong> {item.action}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ─── Main component ──────────────────────────────────────────────── */

export interface SessionReportViewProps {
  data: InterviewResultData;
  /** Back navigation handler — wired by `dashboardComponents.tsx` to
   *  return to the dashboard. Optional so the canvas/storybook usage
   *  still works without a navigation stack. */
  onBack?: () => void;
  /** PDF download handler — typically `() => window.print()`. */
  onDownloadPdf?: () => void;
  /** Share-link handler — POSTs to /api/share-report and copies the
   *  resulting URL to clipboard. */
  onShare?: () => void;
  /** "Try this question again" — invoked from the Next-Steps first
   *  card. Production routes to /session/new with the weakest question
   *  pre-loaded. */
  onTryQuestionAgain?: (questionIdx: number) => void;
  /** "Drill weakest skill" — invoked from the Next-Steps third card.
   *  Production routes to a focused 5-question drill. */
  onDrillSkill?: (skillName: string) => void;
  /** "Save top story to Notebook" — invoked from the Next-Steps middle
   *  card. Production calls saveStoryToNotebook on the highest-scoring
   *  question. */
  onSaveTopStory?: (questionIdx: number) => void;
  /** Trust + usefulness 2-question polls. Both fire to analytics. */
  onTrustAnswer?: (value: "yes" | "no") => void;
  onUsefulAnswer?: (value: "yes" | "no") => void;
  /** Resume cross-check summary from `session_insights`. When present
   *  AND `hasIssues` is true, the report renders a dedicated BGV-risk
   *  panel between Hero and the cross-session strip. Omitted (or
   *  `hasIssues: false`) renders nothing — happy path is silent. */
  credibility?: CredibilitySummary;
}

export default function SessionReportView({
  data,
  onBack,
  onDownloadPdf,
  onShare,
  onTryQuestionAgain,
  onDrillSkill,
  onSaveTopStory,
  onTrustAnswer,
  onUsefulAnswer,
  credibility,
}: SessionReportViewProps) {
  // Pick the highest-scoring question so the "Save top story" CTA
  // points at the right answer. Falls back to the first question.
  const topStoryIdx =
    data.questions.length > 0
      ? data.questions.reduce(
          (best, q) => (q.score > best.score ? q : best),
          data.questions[0]
        ).index
      : 1;
  return (
    <>
      <style>{SESSION_REPORT_STYLES}</style>
      <div
        style={{
          background: t.cream,
          minHeight: "100vh",
          fontFamily: f.sans,
          color: t.coal,
          paddingBottom: 48,
        }}
      >
        {/* Skip link — keyboard users tabbing into the page can jump
            directly past the header + jump-nav to the report content.
            Visually hidden until focused; standard a11y pattern. */}
        <a href="#ir-section-hero" className="ir-skip-link">
          Skip to report
        </a>
        <Header onBack={onBack} onDownloadPdf={onDownloadPdf} onShare={onShare} />
        <main
          id="ir-main"
          aria-label="Interview report"
          className="ir-main-container"
          style={{
            maxWidth: 1240,
            margin: "0 auto",
            padding: "0 clamp(14px, 4vw, 32px)",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <JumpNav />
          <HeroSection data={data} />
          {credibility && credibility.hasIssues && (
            <CredibilitySection summary={credibility} />
          )}
          {data.negotiationOutcome && (
            <NegotiationFullReport
              outcome={data.negotiationOutcome}
              role={data.role}
              company={data.company}
              questions={data.questions}
              daysUntilInterview={data.daysUntilInterview}
              priorSessionCount={data.priorSessionCount}
            />
          )}
          {data.kernelMetrics && (
            <KernelNegotiationQualitySection m={data.kernelMetrics} />
          )}
          {data.priorSessionCount !== undefined && data.priorSessionCount >= 3 && data.crossSessionInsights && (
            <TrendStrip
              priorSessionCount={data.priorSessionCount}
              insights={data.crossSessionInsights}
            />
          )}
          <CoreMetricsSection metrics={data.metrics} />
          <SkillsSection skills={data.skills} weakest={data.weakestSkill} />
          {data.thoughtBubble && data.thoughtBubble.length > 0 && (
            <ThoughtBubbleSection segments={data.thoughtBubble} />
          )}
          <PerQuestionSection questions={data.questions} />
          <CoachNotesSection
            insights={data.crossSessionInsights}
            storyReuse={data.storyReuseFindings}
            blindSpots={data.blindSpots}
          />
          {data.biasFindings && data.biasFindings.length > 0 && (
            <BiasSection findings={data.biasFindings} />
          )}
          {data.reverseInterview && (
            <ReverseInterviewSection reverse={data.reverseInterview} />
          )}
          <NextStepsSection
            daysUntilInterview={data.daysUntilInterview}
            readinessSentence={data.readinessSentence}
            weakestSkill={data.weakestSkill?.name}
            onTryWeakestQuestion={
              onTryQuestionAgain
                ? () => onTryQuestionAgain(data.questions[0]?.index ?? 1)
                : undefined
            }
            onDrillSkill={
              onDrillSkill && data.weakestSkill
                ? () => onDrillSkill(data.weakestSkill.name)
                : undefined
            }
            onSaveTopStory={
              onSaveTopStory ? () => onSaveTopStory(topStoryIdx) : undefined
            }
          />
          <FooterSection
            onTrustAnswer={onTrustAnswer}
            onUsefulAnswer={onUsefulAnswer}
          />
        </main>
      </div>
    </>
  );
}
