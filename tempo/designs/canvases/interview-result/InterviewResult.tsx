/* HireStepX — Interview result canvas
   Best-in-class post-session results screen. Goal: deliver feedback that
   feels coach-grade, not LLM-generic, and that justifies the price.

   Compared to the user's reference design we elevate by:
     • Cream + indigo + copper brand tokens (matches auth surfaces) so the
       report feels like a continuation of the product, not a different app
     • Fraunces serif for the hero score — anchors editorial gravitas
     • Sticky "Focus on weakest skill" callout next to the bar chart so
       insight + action live together, not separated by scroll
     • Per-question coaching note has a distinct "Why it scored low" frame
       — separates DIAGNOSIS (what the LLM saw) from PRESCRIPTION (retry CTA)
     • Highlight legend lives inline under the answer, not in a side rail —
       readers don't context-switch
     • "Was this report helpful?" feedback row at the bottom gives us a
       cheap signal on rubric quality

   Sections (top → bottom):
     1. Header — back, download PDF, share
     2. Hero — score gauge + verdict + delta vs last + AI verdict + strengths/improvements
     3. Core delivery metrics — 4 tile row (filler/silence/pace/energy)
     4. Skills breakdown — horizontal bars + sticky weakest-skill callout
     5. Per-question review — expandable cards (first one open with full coaching)
     6. Recommended next steps — 3 action cards
     7. Helpful? thumbs feedback + privacy line

   The component is fully prop-driven; the canvas storyboard injects mock
   data. In production this surface would be wired to /api/evaluate-session
   output (SessionReport shape from src/dashboardData.ts). */

"use client";

import React, { useState } from "react";
import { tokens as t, fonts as f, shadows } from "../design-system/_tokens";
import { INTERVIEW_RESULT_STYLES } from "./_styles";

/* ─── Domain types ─────────────────────────────────────────────────── */

export type Verdict = "strongHire" | "hire" | "leanHire" | "noHire" | "strongNoHire";

export interface DeliveryMetric {
  label: string;
  value: number;
  unit?: string;
  targetLabel: string; // e.g. "Target 0–3"
  band: "good" | "ok" | "needsWork";
}

export interface Skill {
  name: string;
  /** 0-100 candidate score. */
  score: number;
  /** 0-100 role-cohort average; rendered as overlay marker. */
  roleAvg?: number;
}

export type HighlightKind = "filler" | "hedge" | "quantified" | "firstPerson";

export interface AnswerSpan {
  text: string;
  highlight?: HighlightKind;
}

export interface Question {
  index: number;
  text: string;
  score: number;
  band: "weak" | "partial" | "strong" | "complete";
  answer: AnswerSpan[];
  /** AI-rewritten version of the candidate's answer in clean STAR
   *  structure, preserving their language and specifics. Distinct
   *  from `topPerformerAnswer` which is aspirational. */
  restructured?: AnswerSpan[];
  /** Aspirational answer at the role bar — what an L4-equivalent
   *  candidate at this company would say. Pedagogically the most
   *  valuable column; surfaces side-by-side with the user's answer. */
  topPerformerAnswer?: AnswerSpan[];
  star: { situation: boolean; task: boolean; action: boolean; result: boolean; learning: boolean };
  metrics: { wordCount: number; responseSec: number; firstPersonRatioPct: number; quantificationCount: number };
  /** Coaching note — framing flips with band. Weak/partial reads as
   *  "why it scored low + what to fix"; strong/complete reads as
   *  "why it landed + how to keep it". The component picks the
   *  heading from band so high-scoring questions also get an
   *  actionable replication signal. */
  whyScored: string;
}

export interface InterviewResultData {
  overallScore: number;          // 0-100
  verdict: Verdict;
  scoreDelta: number;            // signed; e.g. +16 vs last interview
  /** Cohort-percentile (0-100). "You did better than X% of L4 frontend
   *  candidates targeting Google." Computed server-side from the
   *  bucket of comparable sessions. */
  percentile?: number;
  /** Recent score history (most recent last) for the inline sparkline.
   *  4-6 entries lands best — shorter is noisy, longer wraps. */
  recentScores?: number[];
  /** Readiness number — "how close am I to the role bar?". Derived
   *  from overall score + role-cohort gap; the headline number users
   *  actually want, distinct from this session's score. */
  readiness?: { pct: number; etaWeeks: number };
  /** Days until the user's scheduled interview, if any. Used by the
   *  Next Steps section to swap the generic "Try weakest" card with a
   *  date-aware prep plan. */
  daysUntilInterview?: number;
  company: string;
  role: string;
  level: string;
  difficulty: string;
  aiVerdict: string;             // 1-3 sentence summary
  strengths: string[];
  improvements: string[];
  metrics: DeliveryMetric[];     // expect length 4
  skills: Skill[];
  weakestSkill: { name: string; tip: string };
  questions: Question[];
}

/* ─── Defaults / mock ──────────────────────────────────────────────── */

export const DEFAULT_RESULT: InterviewResultData = {
  overallScore: 72,
  verdict: "hire",
  scoreDelta: 16,
  percentile: 68,
  recentScores: [42, 48, 56, 56, 72],
  readiness: { pct: 72, etaWeeks: 2 },
  daysUntilInterview: 9,
  company: "Google",
  role: "Frontend Developer",
  level: "L4",
  difficulty: "Hard",
  aiVerdict:
    "You communicate clearly and structure answers well. Your responses miss measurable impact and depth in technical reasoning at times — quantify outcomes and probe trade-offs harder.",
  strengths: [
    "Strong problem framing in Q2",
    "Clear and structured communication",
    "Good understanding of fundamentals",
  ],
  improvements: [
    "Add measurable outcomes in Q1, Q3",
    "Go deeper into trade-offs in Q4",
    "Reduce filler words and speak slower",
  ],
  metrics: [
    { label: "Filler words / min", value: 4.2, targetLabel: "Target 0–3", band: "needsWork" },
    { label: "Silence ratio", value: 18, unit: "%", targetLabel: "Target 0–20%", band: "good" },
    { label: "Pace (WPM)", value: 172, targetLabel: "Target 140–180", band: "good" },
    { label: "Energy", value: 68, unit: "/100", targetLabel: "Target 60–100", band: "good" },
  ],
  skills: [
    { name: "Technical Depth", score: 78, roleAvg: 66 },
    { name: "Problem Framing", score: 72, roleAvg: 64 },
    { name: "Communication", score: 70, roleAvg: 60 },
    { name: "Trade-off Reasoning", score: 65, roleAvg: 60 },
    { name: "Ownership", score: 62, roleAvg: 64 },
  ],
  weakestSkill: {
    name: "Trade-off Reasoning",
    tip: "Strengthen your depth in system design and edge-case discussion.",
  },
  questions: [
    {
      index: 1,
      text: "Tell me about a time you solved a difficult problem.",
      score: 48,
      band: "weak",
      answer: [
        { text: "So in my last company we had this dashboard which was slow and users were complaining " },
        { text: "like", highlight: "filler" },
        { text: " a lot. " },
        { text: "I think", highlight: "hedge" },
        { text: " we were using some old api and it was not good. So we " },
        { text: "basically", highlight: "filler" },
        { text: " changed a few things and it " },
        { text: "improved", highlight: "quantified" },
        { text: "." },
      ],
      star: { situation: true, task: true, action: true, result: false, learning: false },
      metrics: { wordCount: 78, responseSec: 168, firstPersonRatioPct: 22, quantificationCount: 0 },
      whyScored:
        "Missing a clear result with numbers. Add measurable impact (load-time delta, complaint volume change) and one sentence on what you took away from the project.",
      restructured: [
        { text: "At my last company, our analytics dashboard was loading in over 8 seconds and we were getting weekly complaints from operations. " },
        { text: "I was the only frontend engineer assigned, so I owned the investigation. " },
        { text: "I profiled the page, found we were calling a deprecated v1 API that fan-outs to 12 backend services, and rewrote it against the v3 batch endpoint. I also added optimistic skeleton loaders so the perceived wait dropped before the real fix landed. " },
        { text: "Load time went from 8.4s to 1.6s — an 81% improvement", highlight: "quantified" },
        { text: " — and dashboard-related complaints dropped to zero over the next month. " },
        { text: "What I took away: profiling first, fixing second. I'd been about to add a cache before I had any data on where time was actually going." },
      ],
      topPerformerAnswer: [
        { text: "I'll give you a recent one. Our customer-facing pricing dashboard was loading in 8s p95, which was tanking conversion on the trial signup funnel — we'd lost about " },
        { text: "12% of intent-to-trial conversions over the prior quarter", highlight: "quantified" },
        { text: ". I scoped this as a 2-week fix, not a 6-week rewrite, so I had to be surgical about what to touch. " },
        { text: "I instrumented Real-User-Monitoring across the page, identified that 70% of the latency was in a single API fan-out, and replaced it with a server-side batch + edge-cached response. I also added a graceful skeleton state for the remaining 1.5s. " },
        { text: "We shipped in 9 days. p95 dropped to 1.2s, conversion recovered to baseline within two weeks", highlight: "quantified" },
        { text: ". The trade-off I deliberately accepted: the new endpoint is slightly stale (60s TTL), which is fine for pricing but I documented it for the team. " },
        { text: "The lesson I keep coming back to: instrument before you optimize. I'd guessed it was the chart library; it was actually the data-fetch waterfall." },
      ],
    },
    {
      index: 2,
      text: "How do you handle tight deadlines?",
      score: 82,
      band: "strong",
      answer: [{ text: "(answer collapsed — expand to view)" }],
      star: { situation: true, task: true, action: true, result: true, learning: true },
      metrics: { wordCount: 142, responseSec: 195, firstPersonRatioPct: 38, quantificationCount: 3 },
      whyScored: "Strong STAR coverage with quantified delivery outcomes.",
    },
    {
      index: 3,
      text: "Describe a project you are proud of.",
      score: 58,
      band: "partial",
      answer: [{ text: "(answer collapsed — expand to view)" }],
      star: { situation: true, task: true, action: true, result: false, learning: false },
      metrics: { wordCount: 96, responseSec: 145, firstPersonRatioPct: 24, quantificationCount: 1 },
      whyScored: "Story is well-told but the impact is fuzzy. Lead with the outcome, then the journey.",
    },
    {
      index: 4,
      text: "How do you approach system design?",
      score: 60,
      band: "partial",
      answer: [{ text: "(answer collapsed — expand to view)" }],
      star: { situation: true, task: true, action: true, result: false, learning: true },
      metrics: { wordCount: 120, responseSec: 188, firstPersonRatioPct: 31, quantificationCount: 1 },
      whyScored: "Trade-offs were stated but not quantified. Practise giving rough numbers — RPS, latency, storage — even when estimating.",
    },
    {
      index: 5,
      text: "How do you ensure code quality?",
      score: 72,
      band: "complete",
      answer: [{ text: "(answer collapsed — expand to view)" }],
      star: { situation: true, task: true, action: true, result: true, learning: false },
      metrics: { wordCount: 110, responseSec: 156, firstPersonRatioPct: 35, quantificationCount: 2 },
      whyScored: "Solid structured answer; one missing element is the learning takeaway.",
    },
    {
      index: 6,
      text: "Do you have any questions for us?",
      score: 75,
      band: "complete",
      answer: [{ text: "(answer collapsed — expand to view)" }],
      star: { situation: false, task: false, action: false, result: false, learning: false },
      metrics: { wordCount: 64, responseSec: 92, firstPersonRatioPct: 18, quantificationCount: 0 },
      whyScored: "Asked thoughtful questions about team rituals and on-call. Could push further into product strategy.",
    },
  ],
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
  /* Half-doughnut. 180° arc; pct of arc filled.
     Designed for 280×140 canvas; pure SVG so it scales clean. */
  const r = 110;
  const cx = 140;
  const cy = 140;
  const len = Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const filled = len * pct;
  return (
    <svg width="280" height="160" viewBox="0 0 280 160" aria-hidden="true">
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
  return (
    <svg className="ir-spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-label="Recent session scores">
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

/* ─── Sections ─────────────────────────────────────────────────────── */

function Header() {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "20px 32px",
      }}
    >
      <button
        type="button"
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
        Back to Interviews
      </button>
      <div style={{ display: "flex", gap: 10 }}>
        <button type="button" className="ir-cta-ghost">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download PDF
        </button>
        <button type="button" className="ir-cta-ghost">
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
      style={{
        background: t.white,
        border: `1px solid ${t.line}`,
        borderRadius: 16,
        padding: 28,
        boxShadow: shadows.card,
      }}
    >
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
          <div style={{ position: "relative", display: "inline-block" }}>
            <ScoreGauge score={data.overallScore} color={verdict.color} />
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 36,
                textAlign: "center",
                fontFamily: f.serif,
                fontSize: 64,
                lineHeight: 1,
                color: t.coal,
                letterSpacing: "-0.02em",
              }}
            >
              {data.overallScore}
              <span style={{ fontSize: 24, color: t.inkFaint, marginLeft: 4, fontFamily: f.mono }}>/100</span>
            </div>
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

function CoreMetricsSection({ metrics }: { metrics: DeliveryMetric[] }) {
  return (
    <section
      style={{
        background: t.white,
        border: `1px solid ${t.line}`,
        borderRadius: 16,
        padding: 28,
        boxShadow: shadows.card,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
        <h2 style={{ fontFamily: f.serif, fontSize: 22, fontWeight: 400, color: t.coal, margin: 0, letterSpacing: "-0.01em" }}>
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
      style={{
        background: t.white,
        border: `1px solid ${t.line}`,
        borderRadius: 16,
        padding: 28,
        boxShadow: shadows.card,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <h2 style={{ fontFamily: f.serif, fontSize: 22, fontWeight: 400, color: t.coal, margin: 0, letterSpacing: "-0.01em" }}>
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
                <div className="ir-skill-bar-wrap" style={{ background: t.line }}>
                  <div className="ir-skill-bar-bg" style={{ background: t.line }} />
                  <div
                    className="ir-skill-bar-fg"
                    style={{
                      width: `${pct}%`,
                      background: `linear-gradient(90deg, ${t.indigoDeep} 0%, ${t.indigo} 100%)`,
                    }}
                  />
                  {avgPct !== null && (
                    <div className="ir-skill-bar-marker" style={{ left: `calc(${avgPct}% - 1px)` }} />
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
  return (
    <div style={{ padding: "0 18px 18px" }}>
      {/* Tab strip — Answer / Restructured / Top Performer */}
      <div role="tablist" aria-label="Per-question detail" style={{ borderBottom: `1px solid ${t.line}`, marginBottom: 16 }}>
        <button type="button" role="tab" aria-selected={tab === "answer"} className="ir-tab-btn" onClick={() => setTab("answer")}>
          Your Answer
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "restructured"}
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
          aria-selected={tab === "exemplar"}
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

      <div className="ir-pq-detail-grid" style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", gap: 18 }}>
        {/* Answer column — content driven by selected tab. The exemplar
            tab has a distinct frame (sage tint + corner badge) so the
            user's eye knows this isn't their own answer. */}
        <div>
          {tab === "answer" && (
            <>
              <AnswerBody spans={q.answer} />
              <HighlightLegend />
            </>
          )}
          {tab === "restructured" && q.restructured && (
            <>
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
            </>
          )}
          {tab === "exemplar" && q.topPerformerAnswer && (
            <>
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
            </>
          )}
        </div>

        {/* STAR + metrics column — invariant across tabs */}
        <div
          style={{
            background: t.white,
            border: `1px solid ${t.line}`,
            borderRadius: 12,
            padding: "16px 18px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div style={{ display: "flex", gap: 14, justifyContent: "space-around" }}>
            <StarChip active={q.star.situation} letter="S" label="Situation" />
            <StarChip active={q.star.task} letter="T" label="Task" />
            <StarChip active={q.star.action} letter="A" label="Action" />
            <StarChip active={q.star.result} letter="R" label="Result" />
            <StarChip active={q.star.learning} letter="L" label="Learning" />
          </div>
          <div style={{ height: 1, background: t.line }} />
          <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "1fr auto", rowGap: 8, columnGap: 12, fontFamily: f.sans, fontSize: 12, color: t.inkSoft }}>
            <dt>Word Count</dt>
            <dd style={{ margin: 0, color: t.coal, fontFamily: f.mono, fontSize: 13 }}>{q.metrics.wordCount} words</dd>
            <dt>Response Length</dt>
            <dd style={{ margin: 0, color: t.coal, fontFamily: f.mono, fontSize: 13 }}>{q.metrics.responseSec.toFixed(1)} sec</dd>
            <dt>First-Person Ratio</dt>
            <dd style={{ margin: 0, color: t.coal, fontFamily: f.mono, fontSize: 13 }}>{q.metrics.firstPersonRatioPct}%</dd>
            <dt>Quantification Count</dt>
            <dd style={{ margin: 0, color: q.metrics.quantificationCount === 0 ? t.error : t.coal, fontFamily: f.mono, fontSize: 13, fontWeight: 600 }}>
              {q.metrics.quantificationCount}
            </dd>
          </dl>
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
          <p style={{ fontFamily: f.sans, fontSize: 14, color: t.coal, lineHeight: 1.55, margin: 0, flex: 1 }}>
            {q.whyScored}
          </p>
          <button type="button" className="ir-cta-primary" style={{ alignSelf: "flex-start" }}>
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
  return (
    <section
      style={{
        background: t.white,
        border: `1px solid ${t.line}`,
        borderRadius: 16,
        padding: 0,
        boxShadow: shadows.card,
        overflow: "hidden",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          padding: "24px 28px 16px",
        }}
      >
        <h2 style={{ fontFamily: f.serif, fontSize: 22, fontWeight: 400, color: t.coal, margin: 0, letterSpacing: "-0.01em" }}>
          Per-Question Review <span style={{ color: t.inkFaint, fontSize: 16, marginLeft: 6 }}>({questions.length})</span>
        </h2>
        <button type="button" style={{ background: "transparent", border: "none", color: t.indigo, fontFamily: f.sans, fontSize: 12, cursor: "pointer", fontWeight: 500 }}>
          Expand all
        </button>
      </header>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {questions.map((q, idx) => {
          const open = openIdx === idx;
          const band = BAND_META[q.band];
          return (
            <li key={q.index} style={{ borderTop: `1px solid ${t.line}` }}>
              <button
                type="button"
                className="ir-q-card-trigger"
                aria-expanded={open}
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
                <span style={{ flex: 1, fontFamily: f.sans, fontSize: 14, color: t.coal, fontWeight: open ? 600 : 500 }}>
                  {q.text}
                </span>
                <span
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
              {open && <QuestionDetail q={q} />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function NextStepsSection({ daysUntilInterview }: { daysUntilInterview?: number }) {
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

  const cards = [
    firstCard,
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
      ),
      iconBg: t.indigo100,
      iconColor: t.indigo,
      title: "Save top story to Notebook",
      desc: "Save Q2 as a strong story for future interviews.",
      cta: "Save story",
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
      desc: "Focus on Trade-off Reasoning with a 5-question drill.",
      cta: "Start drill",
    },
  ];
  return (
    <section
      style={{
        background: t.white,
        border: `1px solid ${t.line}`,
        borderRadius: 16,
        padding: 28,
        boxShadow: shadows.card,
      }}
    >
      <h2 style={{ fontFamily: f.serif, fontSize: 22, fontWeight: 400, color: t.coal, margin: "0 0 18px", letterSpacing: "-0.01em" }}>
        Recommended Next Steps
      </h2>
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
              style={{
                background: "transparent",
                border: "none",
                color: t.indigo,
                fontFamily: f.sans,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
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

function FooterSection() {
  /* The thumbs are direction-only. The follow-up tag row appears
     after a thumb-down so we can capture WHY (too harsh / too
     generous / vague / not actionable) — the calibration team
     needs that signal more than a binary helpful/not vote. */
  const [thumb, setThumb] = useState<"up" | "down" | null>(null);
  const [reason, setReason] = useState<string | null>(null);
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
    </footer>
  );
}

/* ─── Main component ──────────────────────────────────────────────── */

export interface InterviewResultProps {
  data?: InterviewResultData;
}

export default function InterviewResult({ data = DEFAULT_RESULT }: InterviewResultProps) {
  return (
    <>
      <style>{INTERVIEW_RESULT_STYLES}</style>
      <div
        style={{
          background: t.cream,
          minHeight: "100vh",
          fontFamily: f.sans,
          color: t.coal,
          paddingBottom: 48,
        }}
      >
        <Header />
        <main
          style={{
            maxWidth: 1240,
            margin: "0 auto",
            padding: "0 32px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <HeroSection data={data} />
          <CoreMetricsSection metrics={data.metrics} />
          <SkillsSection skills={data.skills} weakest={data.weakestSkill} />
          <PerQuestionSection questions={data.questions} />
          <NextStepsSection daysUntilInterview={data.daysUntilInterview} />
          <FooterSection />
        </main>
      </div>
    </>
  );
}
