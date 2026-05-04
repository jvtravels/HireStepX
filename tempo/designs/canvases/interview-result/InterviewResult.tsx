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
  star: { situation: boolean; task: boolean; action: boolean; result: boolean; learning: boolean };
  metrics: { wordCount: number; responseSec: number; firstPersonRatioPct: number; quantificationCount: number };
  whyScored: string;
}

export interface InterviewResultData {
  overallScore: number;          // 0-100
  verdict: Verdict;
  scoreDelta: number;            // signed; e.g. +16 vs last interview
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
      {/* Top row: company / role / level / difficulty pills */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
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

      <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 1fr) 2fr", gap: 32, alignItems: "center" }}>
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
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8 }}>
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
            {data.scoreDelta !== 0 && (
              <span style={{ fontFamily: f.sans, fontSize: 13, color: data.scoreDelta > 0 ? t.success : t.error, fontWeight: 600 }}>
                {data.scoreDelta > 0 ? "↑" : "↓"} {Math.abs(data.scoreDelta)} pts
                <span style={{ color: t.inkSoft, fontWeight: 400, marginLeft: 4 }}>vs last interview</span>
              </span>
            )}
          </div>
          <p style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, lineHeight: 1.55, marginTop: 14, margin: "14px 0 0" }}>
            Great effort! You&apos;re close to being interview-ready.
          </p>
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

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
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
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 280px", gap: 28, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {skills.map((s) => {
            const pct = (s.score / max) * 100;
            const avgPct = s.roleAvg ? (s.roleAvg / max) * 100 : null;
            const delta = s.roleAvg ? s.score - s.roleAvg : null;
            return (
              <div key={s.name} style={{ display: "grid", gridTemplateColumns: "180px 1fr 60px 50px", gap: 14, alignItems: "center" }}>
                <span style={{ fontFamily: f.sans, fontSize: 13, color: t.coal }}>{s.name}</span>
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
                <span style={{ fontFamily: f.mono, fontSize: 14, color: t.coal, textAlign: "right", fontWeight: 600 }}>
                  {s.score}
                </span>
                <span
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

function QuestionDetail({ q }: { q: Question }) {
  const [tab, setTab] = useState<"answer" | "star" | "analysis">("answer");
  return (
    <div style={{ padding: "0 18px 18px" }}>
      {/* Tab strip */}
      <div role="tablist" aria-label="Per-question detail" style={{ borderBottom: `1px solid ${t.line}`, marginBottom: 16 }}>
        <button type="button" role="tab" aria-selected={tab === "answer"} className="ir-tab-btn" onClick={() => setTab("answer")}>Your Answer</button>
        <button type="button" role="tab" aria-selected={tab === "star"} className="ir-tab-btn" onClick={() => setTab("star")}>Restructured (STAR)</button>
        <button type="button" role="tab" aria-selected={tab === "analysis"} className="ir-tab-btn" onClick={() => setTab("analysis")}>Analysis</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", gap: 18 }}>
        {/* Answer column */}
        <div>
          <div
            style={{
              background: t.creamSoft,
              border: `1px solid ${t.line}`,
              borderRadius: 12,
              padding: "16px 18px",
              fontFamily: f.sans,
              fontSize: 14,
              lineHeight: 1.7,
              color: t.coal,
            }}
          >
            {q.answer.map((span, i) => (
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
          <HighlightLegend />
        </div>

        {/* STAR + metrics column */}
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

        {/* Coaching column */}
        <div
          style={{
            background: "rgba(212, 179, 127, 0.06)",
            border: `1px solid ${t.copper100}`,
            borderRadius: 12,
            padding: "16px 18px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div style={{ fontFamily: f.mono, fontSize: 11, color: t.copper, letterSpacing: "0.10em", textTransform: "uppercase", fontWeight: 600 }}>
            Why it scored low
          </div>
          <p style={{ fontFamily: f.sans, fontSize: 14, color: t.coal, lineHeight: 1.55, margin: 0, flex: 1 }}>
            {q.whyScored}
          </p>
          <button type="button" className="ir-cta-primary" style={{ alignSelf: "flex-start" }}>
            Try this question again
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15A9 9 0 1 1 5.64 5.64L1 10" />
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

function NextStepsSection() {
  const cards = [
    {
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
    },
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
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
  return (
    <footer
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "8px 4px",
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
        <button type="button" className="ir-thumb-btn" aria-label="Helpful">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
          </svg>
        </button>
        <button type="button" className="ir-thumb-btn" aria-label="Not helpful">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zM17 2h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3" />
          </svg>
        </button>
      </div>
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
          <NextStepsSection />
          <FooterSection />
        </main>
      </div>
    </>
  );
}
