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
import BehavioralReport from "./BehavioralReport";

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

/** Red-flag types mirror the production SessionReportRedFlagType union.
 *  Surfacing these inline on the question card (count badge) and in the
 *  expanded coach column (titled list with quote) is the highest-signal
 *  diagnosis we can give — these are the patterns hiring managers
 *  actually flag in debriefs. */
export type RedFlagType =
  | "blame" | "missing_result" | "we_without_i"
  | "scope_drift" | "contradiction" | "vague";

export interface RedFlag {
  type: RedFlagType;
  severity: "high" | "medium" | "low";
  title: string;
  explanation: string;
  /** Verbatim slice of the candidate's answer that triggered the flag.
   *  Concrete evidence beats abstract critique 10:1. */
  quote?: string;
}

export type LengthVerdict = "tooShort" | "justRight" | "tooLong";

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
  /** 2-3 short bullets explaining what makes the exemplar strong.
   *  Renders under the exemplar tab so the user has a decoder for
   *  what to pattern-match — not just admire the prose. */
  whatMakesItStrong?: string[];
  star: { situation: boolean; task: boolean; action: boolean; result: boolean; learning: boolean };
  metrics: { wordCount: number; responseSec: number; firstPersonRatioPct: number; quantificationCount: number };
  /** Optional focus-aware metric tiles that REPLACE the default 4
   *  (Words / Length / First-person / Quantified) when present. Used
   *  when the interview focus has different signals worth surfacing —
   *  e.g. salary-negotiation should show "Counter named", "Package
   *  items", "BATNA mention", "Phases reached" instead of generic
   *  word count + first-person ratio.
   *
   *  When omitted, the default 4-tile layout renders unchanged so
   *  existing usages aren't affected. The label/value pair drives the
   *  uppercase mono header + numeric value below. `tone` controls the
   *  value's color; pass t.error for "this is a red flag" tiles. */
  focusMetrics?: Array<{ label: string; value: string; tone?: string }>;
  /** Coaching note — framing flips with band. Weak/partial reads as
   *  "why it scored low + what to fix"; strong/complete reads as
   *  "why it landed + how to keep it". The component picks the
   *  heading from band so high-scoring questions also get an
   *  actionable replication signal. */
  whyScored: string;
  /** Question-level red flags (blame, vagueness, scope drift, etc.).
   *  Renders as a count badge on the trigger and a titled list with
   *  quote in the expanded panel. Empty / undefined = no flags. */
  redFlags?: RedFlag[];
  /** Length verdict — too short / just right / too long. Tied to band:
   *  60-word answers usually score weak regardless of content. */
  lengthVerdict?: LengthVerdict;
  /** Frequency this question (or its template) is asked at this
   *  company/role/level. Drives a "high-frequency" pill on the
   *  trigger so users prioritize practice. */
  frequencyPct?: number;
  frequencyNote?: string;
  /** Likely follow-up the interviewer would press on — only renders
   *  on weak/partial bands in the coach column. Pre-empts the
   *  question the user will get asked next. */
  likelyFollowUp?: string;
  /** Behavioral signal pills shown on the trigger row — focus-specific
   *  micro-tags ("⚠ rehearsed", "✓ ownership", "✗ result") that prep
   *  the user for what they'll find when they expand. Only rendered
   *  when present; other focuses ignore this. */
  behavioralSignals?: Array<{
    tone: "good" | "warn" | "bad";
    label: string;
  }>;
}

export interface CalibrationBand {
  label: string;
  minScore: number;
}

export interface Calibration {
  /** "Google L4", "Stripe Senior", etc. Surfaces in the banner
   *  to anchor what "Hire" means in this context. */
  companyLabel: string;
  /** One-line calibration note — typically explains the role-bar
   *  shift relative to the platform default. */
  note?: string;
  bands: CalibrationBand[];
}

export interface CrossSessionInsight {
  kind: "regression" | "persistent" | "improvement";
  title: string;
  body: string;
}

export interface StoryReuseFinding {
  storyLabel: string;
  body: string;
}

export interface BlindSpot {
  title: string;
  body: string;
}

export type ThoughtBubbleState = "engaged" | "drifting" | "concerned";

export interface ThoughtBubbleSegment {
  state: ThoughtBubbleState;
  /** % of total session duration this state covered. Sum across
   *  segments should be 100. */
  pct: number;
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
  /** Score confidence — when the LLM hedges on a session ("medium" /
   *  "low"), we surface a chip next to the verdict so users know to
   *  weight it accordingly. "high" or undefined = no chip. */
  scoreConfidence?: "high" | "medium" | "low";
  scoreConfidenceNote?: string;
  /** Calibration — anchors what "Hire" / "Lean Hire" / etc. means at
   *  this specific company+level. Single-line banner under the
   *  verdict pill. */
  calibration?: Calibration;
  /** Number of prior sessions in this role context. ≥3 unlocks the
   *  trend-strip section. */
  priorSessionCount?: number;
  /** Cross-session insights — regressions, persistent gaps,
   *  improvements. Aggregated into the Coach's Notes section. */
  crossSessionInsights?: CrossSessionInsight[];
  /** Story reuse — when the user leans on the same anecdote across
   *  sessions, the coach flags it ("you've used the dashboard story
   *  in 3 of 4 sessions"). */
  storyReuseFindings?: StoryReuseFinding[];
  /** Blind spots — topics the user hasn't been pressed on yet but
   *  should expect at this role bar. */
  blindSpots?: BlindSpot[];
  /** Thought-bubble timeline — opt-in horizontal track showing
   *  interviewer-state across the session. Collapsed by default. */
  thoughtBubble?: ThoughtBubbleSegment[];
  /** Granular readiness sentence — overrides the default 5-stat block
   *  with a one-line "X hours over Y sessions" estimate. Higher signal
   *  than the percentages it replaces. */
  readinessSentence?: string;
  /** Behavioral-focus sub-blocks. Optional, rendered only when present
   *  — keeps the other 10 focuses (technical/case/salary/etc.) untouched.
   *  Mirrors the analyzer's `meta.behavioral` shape so the surface
   *  becomes a direct projection of what `analyzers/behavioral.ts`
   *  already computes per session. */
  behavioral?: BehavioralMeta;
}

/* ─── Behavioral focus sub-blocks ──────────────────────────────────── */

export interface StarMatrixRow {
  q: number;
  S: boolean;
  T: boolean;
  A: boolean;
  R: boolean;
}

export interface BehavioralMeta {
  /** STAR completeness matrix across all behavioral turns. Renders as
   *  a 4×N grid (rows = S/T/A/R, cols = questions). The single most
   *  legible behavioral signal — surfaces "Result missing in 4/6" at
   *  a glance. */
  starMatrix: StarMatrixRow[];
  /** Per-question conflict-shaped stem stats. Renders when at least
   *  one conflict question was asked. `coachLine` is the templated
   *  coaching copy — when absent, the card falls back to a generic
   *  default. */
  conflict?: {
    asked: number;
    oneSided: number;
    balanced: number;
    jumpQuestions: number[];
    coachLine?: string;
  };
  /** Failure-story diagnostic — only if a failure question was asked
   *  AND the candidate owned it. The three signals mirror
   *  `classifyFailureResponse` + `hasConcreteFailureMiss`. */
  failure?: {
    questionIndex: number;
    ownership: boolean;
    specific: boolean;
    learning: boolean;
    coachQuote: string;
  };
  /** Delivery shape per turn. Same crisp/hedged/rambling categorization
   *  used by `_behavioral-probing.ts`. The bar chart renders one segment
   *  per substantive answer, weighted by seconds. */
  delivery?: Array<{ q: number; shape: "crisp" | "hedged" | "rambling"; seconds: number }>;
  /** AI-accountability counters from `meta.behavioral.probing`. */
  aiAccountability?: {
    depthProbes: number;
    vagueAccepted: number;
    ownershipProbes: number;
    deflected: number;
    counterpartyProbes?: number;
    counterpartySkipped?: number;
  };
  /** The single habit to fix — drives the prebias dimension for the
   *  next session via BEHAVIORAL_PRIOR_FLAG_TO_DIMENSION. */
  oneHabit?: { headline: string; rationale: string; prebiasDimension: string };
  /** Persona the AI voice played this session. Names the rubric
   *  ("Bar-Raiser pushes harder", "Indian HM expects ownership first")
   *  so the coaching downstream is calibrated to the actual interviewer
   *  archetype, not generic. */
  persona?: {
    voice: "Hiring Manager" | "HR Partner" | "Director" | "Bar Raiser" | "Founder";
    companyTier: string;
    rubricNote: string;
  };
  /** Track-calibrated competency radar (Amazon LP / Google / Indian-product /
   *  Services-lateral / Startup). `you` = this session, `prior` = last
   *  session's score for the same axis (drives the faded ghost polygon
   *  used for skill-decay comparison). All axes 0..100. */
  competencyRadar?: {
    track: string;
    axes: Array<{ name: string; you: number; prior?: number }>;
    anchor?: string;
    gap?: string;
  };
  /** Opt into the research-driven full BehavioralReport layout. When
   *  true, the standard InterviewResult body is replaced by the
   *  behavioral-native 4-region report (Hero / Top Moments / Compare
   *  block / Coaching row). When false/undefined the legacy
   *  BehavioralFocusSection injects into the standard layout. */
  fullLayout?: boolean;
  /** Session metadata for the report header. */
  sessionMeta?: { completedDate: string; questionCount: number; durationMin: number };
  /** One-line verbal verdict next to the score gauge ("Strong
   *  potential. Sharpen your storytelling."). */
  verbalVerdict?: string;
  /** 6-8 top-of-hero summary stats (Communication / Story Structure /
   *  Impact & Results / Confidence / Interviewer Rating / etc.). */
  atAGlance?: Array<{
    label: string;
    value: string;
    suffix?: string;
    tone?: "good" | "neutral" | "needsWork";
  }>;
  /** Single named gap with one CTA — replaces the bulleted "improvements"
   *  list in the hero. */
  biggestGap?: { title: string; body: string; ctaLabel: string };
  /** Top behavioural moments timeline — 5-6 timestamped chips with
   *  band colour. `isHighlight` marks the strongest moment with a
   *  star. Time in mm:ss. */
  topMoments?: Array<{
    time: string;
    title: string;
    body: string;
    band: "strong" | "needsWork" | "neutral";
    isHighlight?: boolean;
  }>;
  /** Single Q: your-answer-vs-stronger-answer compare block. */
  answerCompare?: {
    questionIndex: number;
    questionText: string;
    yourAnswer: string;
    yourScore: number;
    stronger: { S: string; T: string; A: string; R: string };
    strongerScore: number;
    impactLine: string;
    /** Per-letter scores out of 10 for the candidate's answer. */
    starScores: { S: number; T: number; A: number; R: number };
  };
  /** Behavioural score breakdown bars (Story structure · Ownership ·
   *  Clarity of thinking · Impact/results · Confidence under pressure ·
   *  Specificity). 0..100. */
  scoreBreakdown?: Array<{ label: string; score: number }>;
  /** Risky phrases the candidate actually said + stronger alternatives. */
  riskyPhrases?: Array<{ weak: string; strong: string }>;
  /** Forward-looking readiness for likely follow-ups. */
  followupReadiness?: Array<{ dimension: string; band: "good" | "needsWork" | "weak" }>;
  /** Highlight one question that landed best. */
  strongestStory?: {
    questionIndex: number;
    questionText: string;
    strengths: string[];
    impactPotential: "Low" | "Medium" | "High";
    whatToImprove: string;
  };
  /** 3-card "what to practise next" action list. */
  nextPracticeFocus?: Array<{ title: string; body: string }>;
  /** Footer trophy strip — persuasive line + recommended next mock. */
  footerStrip?: {
    headline: string;
    body: string;
    recommendedMock: string;
    ctaLabel: string;
  };
  /** Per-question status table — replaces the per-question signal pills. */
  questionReview?: Array<{
    index: number;
    text: string;
    status: "strong" | "good" | "needsWork" | "weak";
    score: number;
  }>;
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
    { label: "Median latency", value: 1.8, unit: "s", targetLabel: "Target <2.0s", band: "good" },
    { label: "Self-correction rate", value: 0.6, unit: "/min", targetLabel: "Target <1.0", band: "good" },
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
      lengthVerdict: "tooShort",
      frequencyPct: 84,
      frequencyNote: "Asked in 84% of behavioral rounds at this level",
      likelyFollowUp: "What would you do differently if you had to do it over again? Practitioners who blank on this have given a story without internalising the lesson.",
      redFlags: [
        {
          type: "missing_result",
          severity: "high",
          title: "No quantified result",
          explanation: "The answer ends without a measurable outcome. Always close with a number — load time, % change, $-impact, count.",
          quote: "we basically changed a few things and it improved.",
        },
        {
          type: "vague",
          severity: "medium",
          title: "Vague action description",
          explanation: "\"Some old API\" and \"changed a few things\" lose the interviewer. Name the API, name the change.",
          quote: "we were using some old api and it was not good.",
        },
      ],
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
      whatMakesItStrong: [
        "Opens with business impact (12% conversion drop), not technical preamble.",
        "Names a deliberate trade-off (60s TTL staleness) and explains why it's acceptable.",
        "Closes with a reusable lesson, not a generic platitude.",
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
      lengthVerdict: "justRight",
      frequencyPct: 71,
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
      lengthVerdict: "justRight",
      frequencyPct: 62,
      likelyFollowUp: "If the project failed, would you still be proud of it? Tests whether you've separated process pride from outcome pride.",
      redFlags: [
        {
          type: "we_without_i",
          severity: "medium",
          title: "\"We\" without \"I\"",
          explanation: "Three uses of \"we\" with no clarifying \"I owned X\". Interviewers can't grade what they can't attribute.",
          quote: "we shipped it and we got really good feedback.",
        },
      ],
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
      lengthVerdict: "justRight",
      frequencyPct: 92,
      frequencyNote: "Near-universal at L4 frontend rounds",
      likelyFollowUp: "How would your design change if the read-write ratio flipped? Common probe to test whether your trade-offs were principled or memorised.",
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
      lengthVerdict: "justRight",
      frequencyPct: 48,
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
      lengthVerdict: "justRight",
      frequencyPct: 100,
      frequencyNote: "Always asked — how you handle this colours the whole impression",
    },
  ],
  scoreConfidence: "medium",
  scoreConfidenceNote: "Two short answers limit signal — score may move ±5 with longer responses",
  calibration: {
    companyLabel: "Google L4 Frontend",
    note: "L4 bar at Google trends ~6 points stricter than the platform default",
    bands: [
      { label: "Strong Hire", minScore: 85 },
      { label: "Hire", minScore: 72 },
      { label: "Lean Hire", minScore: 60 },
    ],
  },
  priorSessionCount: 4,
  crossSessionInsights: [
    {
      kind: "improvement",
      title: "Filler rate down 38% over 4 sessions",
      body: "From 6.8/min in your first session to 4.2/min today. Keep the same warm-up reading aloud.",
    },
    {
      kind: "persistent",
      title: "Quantification still your weakest signal",
      body: "Across 4 sessions, only 22% of your answers close with a number. This is the single change that lifts you from Hire to Strong Hire.",
    },
    {
      kind: "regression",
      title: "First-person ratio dropped on Q1, Q3",
      body: "You used \"we\" 11 times today vs 4 in session #3. Watch the pronouns — they're the easiest leak in behavioural rounds.",
    },
  ],
  storyReuseFindings: [
    {
      storyLabel: "Dashboard performance fix",
      body: "Used in 3 of your last 4 sessions. Strong story, but pair it with a second one (system migration, cross-team negotiation) before your real round.",
    },
  ],
  blindSpots: [
    {
      title: "Conflict-with-manager scenarios",
      body: "Not asked yet, but trends 64% at Google L4. Prepare one short story before your scheduled interview.",
    },
    {
      title: "Tech-stack opinion questions",
      body: "Expect \"why React over Vue?\" — be ready to defend the choice without disparaging alternatives.",
    },
  ],
  thoughtBubble: [
    { state: "engaged", pct: 58 },
    { state: "drifting", pct: 28 },
    { state: "concerned", pct: 14 },
  ],
  readinessSentence:
    "~12 hours over ~6 sessions to reach the Hire band consistently — medium confidence based on your 4-session pattern.",
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
function JumpNav({ hasBehavioral = false }: { hasBehavioral?: boolean }) {
  const baseItems = [
    { num: "01", label: "Overview", href: "#ir-section-hero" },
    { num: "02", label: hasBehavioral ? "Signals" : "Delivery", href: "#ir-section-metrics" },
    { num: "03", label: "Skills", href: "#ir-section-skills" },
  ];
  const behavioralItem = hasBehavioral
    ? [{ num: "04", label: "Behavioral", href: "#ir-section-behavioral" }]
    : [];
  const startIdx = 4 + behavioralItem.length;
  const tail = [
    { num: String(startIdx).padStart(2, "0"), label: "Questions", href: "#ir-section-questions" },
    { num: String(startIdx + 1).padStart(2, "0"), label: "Coach Notes", href: "#ir-section-coach-notes" },
    { num: String(startIdx + 2).padStart(2, "0"), label: "Next Steps", href: "#ir-section-next" },
  ];
  const items = [...baseItems, ...behavioralItem, ...tail];
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
  /* Score-band accent — explicit top stripe so the band reads at a
     glance independent of the verdict pill. Copper at <40 (not red,
     never red — softens the room), emerald at >85, otherwise the
     verdict color. */
  const bandAccent =
    data.overallScore < 40 ? t.copper : data.overallScore > 85 ? t.success : verdict.color;
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
        borderTop: `4px solid ${bandAccent}`,
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
          <div style={{ position: "relative", display: "inline-block" }}>
            <ScoreGauge score={data.overallScore} color={bandAccent} />
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

function CoreMetricsSection({
  metrics,
  eyebrowLabel = "How you delivered",
  heading = "Core Delivery Metrics",
}: {
  metrics: DeliveryMetric[];
  eyebrowLabel?: string;
  heading?: string;
}) {
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
      <SectionEyebrow num="02" label={eyebrowLabel} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
        <h2 id="ir-metrics-heading" style={{ fontFamily: f.serif, fontSize: 22, fontWeight: 400, color: t.coal, margin: 0, letterSpacing: "-0.01em" }}>
          {heading}
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
              flex-wraps on narrower viewports so nothing truncates.
              Focus-aware override: if Question.focusMetrics is provided
              (e.g. for salary-neg / technical / case-study sessions),
              render those tiles instead of the generic 4. */}
          {(q.focusMetrics ?? [
            { label: "Words", value: `${q.metrics.wordCount}`, tone: t.coal },
            { label: "Length", value: `${q.metrics.responseSec.toFixed(1)}s`, tone: t.coal },
            { label: "First-person", value: `${q.metrics.firstPersonRatioPct}%`, tone: t.coal },
            { label: "Quantified", value: `${q.metrics.quantificationCount}`, tone: q.metrics.quantificationCount === 0 ? t.error : t.coal },
          ]).map((m) => (
            <div key={m.label} style={{ display: "flex", flexDirection: "column", minWidth: 64 }}>
              <span style={{ fontFamily: f.mono, fontSize: 9, fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase", color: t.inkSoft }}>{m.label}</span>
              <span style={{ fontFamily: f.mono, fontSize: 14, fontWeight: 600, color: m.tone ?? t.coal, marginTop: 2 }}>{m.value}</span>
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
                {q.behavioralSignals?.map((s, i) => {
                  const palette =
                    s.tone === "good"
                      ? { bg: t.success100, fg: t.success, glyph: "✓" }
                      : s.tone === "warn"
                      ? { bg: "rgba(202,138,4,0.12)", fg: "#A16207", glyph: "⚠" }
                      : { bg: t.copper100, fg: t.copper, glyph: "✗" };
                  return (
                    <span
                      key={i}
                      className="ir-q-trigger-band"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        background: palette.bg,
                        color: palette.fg,
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "3px 8px",
                        borderRadius: 999,
                        whiteSpace: "nowrap",
                      }}
                    >
                      <span aria-hidden="true">{palette.glyph}</span>
                      {s.label}
                    </span>
                  );
                })}
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

function NextStepsSection({ daysUntilInterview, readinessSentence }: { daysUntilInterview?: number; readinessSentence?: string }) {
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

/* ─── Behavioral focus section ─────────────────────────────────────── */

/* Behavioral-only diagnostic block. Renders five sub-sections that
   project meta.behavioral directly into the report:
     • STAR completeness matrix (4 × N grid)
     • Conflict narration card  (when conflict.asked > 0)
     • Failure-story card        (when failure present)
     • Delivery timeline         (when delivery has entries)
     • AI-accountability strip   (when aiAccountability present)
     • One-habit prebias CTA card

   All sub-sections degrade independently: if the analyzer didn't
   produce conflict data, the conflict card is hidden — never an
   empty shell. Same edge-state rule the spec calls out. */
function BehavioralFocusSection({ b, score }: { b: BehavioralMeta; score: number }) {
  const lowBand = score < 40;
  const ctaCopy = lowBand
    ? "Try this one habit next session →"
    : "Practice this pattern →";
  const ctaEyebrowAccent = lowBand ? "#FBD38D" : "#FED7AA";
  const SHAPE_COLOR: Record<"crisp" | "hedged" | "rambling", string> = {
    crisp: t.success,
    hedged: "#CA8A04",
    rambling: t.copper,
  };
  return (
    <section
      id="ir-section-behavioral"
      aria-labelledby="ir-behavioral-eyebrow"
      style={{
        background: t.cream,
        border: `1px solid ${t.creamSoft}`,
        borderRadius: 16,
        padding: 24,
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      <div id="ir-behavioral-eyebrow">
        <SectionEyebrow num="4·" label="Behavioral diagnostic" />
      </div>

      {/* Persona ribbon — names the AI voice + tier so the coaching
          downstream reads as calibrated to a real interviewer archetype,
          not a generic rubric. */}
      {b.persona && (
        <div
          style={{
            background: t.indigoDeep,
            color: "white",
            borderRadius: 10,
            padding: "10px 16px",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 14,
            fontSize: 13,
          }}
        >
          <span
            style={{
              fontSize: 10,
              letterSpacing: 1.5,
              fontWeight: 700,
              color: "#FED7AA",
            }}
          >
            PERSONA
          </span>
          <span>
            You interviewed with a <strong>{b.persona.voice}</strong> at a{" "}
            <strong>{b.persona.companyTier}</strong>.
          </span>
          <span style={{ opacity: 0.78, fontSize: 12 }}>{b.persona.rubricNote}</span>
        </div>
      )}

      {/* STAR matrix — collapses to a one-line note for early sessions
          with <3 substantive answers (charting STAR completeness with
          1–2 data points just adds noise). */}
      {b.starMatrix.length < 3 ? (
        <div
          style={{
            background: "white",
            border: `1px dashed ${t.creamSoft}`,
            borderRadius: 10,
            padding: "14px 18px",
            fontSize: 13,
            color: t.indigoGray,
            lineHeight: 1.5,
          }}
        >
          Only {b.starMatrix.length} behavioral turn
          {b.starMatrix.length === 1 ? "" : "s"} this session — too few to chart STAR completeness.
          Ask 3+ stem questions next session to unlock the matrix.
        </div>
      ) : (
      <div style={{ overflowX: "auto" }}>
        <div style={{ marginBottom: 12 }}>
          <h3 style={{ fontFamily: f.sans, fontSize: 16, fontWeight: 600, color: t.coal, margin: 0 }}>
            STAR completeness across {b.starMatrix.length} answers
          </h3>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `64px repeat(${b.starMatrix.length}, minmax(40px, 1fr)) minmax(170px, 220px)`,
            gap: 6,
            minWidth: 64 + b.starMatrix.length * 46 + 170,
          }}
        >
          <div />
          {b.starMatrix.map((row) => (
            <div key={`h-${row.q}`} style={{ textAlign: "center", fontSize: 11, color: t.indigoGray, fontWeight: 600 }}>
              Q{row.q}
            </div>
          ))}
          <div />
          {(["S", "T", "A", "R"] as const).map((k) => {
            const labelMap = { S: "Situation", T: "Task", A: "Action", R: "Result" };
            const missing = b.starMatrix.filter((r) => !r[k]).length;
            const total = b.starMatrix.length;
            const coach =
              missing === 0
                ? "Solid across every turn."
                : missing >= total / 2
                ? `Missed in ${missing}/${total} — load-bearing gap.`
                : `Missed in ${missing}/${total}.`;
            return (
              <React.Fragment key={k}>
                <div style={{ display: "flex", alignItems: "center", fontFamily: f.sans, fontSize: 13, fontWeight: 600, color: t.coal }}>
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: t.indigo100,
                      color: t.indigo,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      marginRight: 8,
                    }}
                  >
                    {k}
                  </span>
                  {labelMap[k]}
                </div>
                {b.starMatrix.map((row) => {
                  const ok = row[k];
                  return (
                    <div
                      key={`${k}-${row.q}`}
                      style={{
                        height: 40,
                        borderRadius: 6,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: ok ? t.success100 : t.copper100,
                        color: ok ? t.success : t.copper,
                        fontSize: 18,
                        fontWeight: 700,
                        border: `1px solid ${ok ? "rgba(21,128,61,0.18)" : "rgba(180,83,9,0.22)"}`,
                      }}
                      aria-label={`Q${row.q} ${labelMap[k]} ${ok ? "present" : "missing"}`}
                    >
                      {ok ? "✓" : "✗"}
                    </div>
                  );
                })}
                <div style={{ fontSize: 12, color: t.indigoGray, display: "flex", alignItems: "center", paddingLeft: 8 }}>
                  {coach}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
      )}

      {/* Track-calibrated competency radar — current session solid indigo,
          prior session faded gray ghost for skill-decay comparison. */}
      {b.competencyRadar && b.competencyRadar.axes.length >= 3 && (
        <BehavioralRadar radar={b.competencyRadar} />
      )}

      {/* 3-col diagnostic cards */}
      {(b.failure || b.conflict || (b.delivery && b.delivery.length > 0)) && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {b.failure && (
            <div
              style={{
                background: "white",
                border: `1px solid ${t.creamSoft}`,
                borderRadius: 12,
                padding: 18,
                borderTop: `3px solid ${b.failure.specific ? t.success : t.copper}`,
              }}
            >
              <div style={{ fontSize: 11, color: t.indigoGray, letterSpacing: 1.2, fontWeight: 700, marginBottom: 12 }}>
                FAILURE STORY · Q{b.failure.questionIndex}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
                <BehavioralSignal ok={b.failure.ownership} label="Ownership" />
                <BehavioralSignal ok={b.failure.specific} label="Specific" />
                <BehavioralSignal ok={b.failure.learning} label="Learning" />
              </div>
              <div style={{ fontSize: 12, color: t.coal, lineHeight: 1.55 }}>{b.failure.coachQuote}</div>
            </div>
          )}
          {b.conflict && b.conflict.asked > 0 && (
            <div
              style={{
                background: "white",
                border: `1px solid ${t.creamSoft}`,
                borderRadius: 12,
                padding: 18,
                borderTop: `3px solid ${b.conflict.balanced > 0 ? t.success : t.copper}`,
              }}
            >
              <div style={{ fontSize: 11, color: t.indigoGray, letterSpacing: 1.2, fontWeight: 700, marginBottom: 12 }}>
                CONFLICT NARRATION
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
                <BehavioralStat n={b.conflict.asked} label="Asked" />
                <BehavioralStat n={b.conflict.oneSided} label="One-sided" bad={b.conflict.oneSided > 0} />
                <BehavioralStat n={b.conflict.balanced} label="Balanced" bad={b.conflict.balanced === 0} good={b.conflict.balanced > 0} />
              </div>
              <div style={{ fontSize: 12, color: t.coal, lineHeight: 1.55 }}>
                {b.conflict.coachLine ?? (
                  <>
                    Name what <em>they</em> wanted before what you did. Bar-raiser expects the counterparty frame inside the first 15 seconds.
                  </>
                )}
              </div>
              {b.conflict.jumpQuestions.length > 0 && (
                <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                  {b.conflict.jumpQuestions.map((q) => (
                    <span
                      key={q}
                      style={{
                        background: t.indigo100,
                        color: t.indigo,
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "3px 10px",
                        borderRadius: 999,
                      }}
                    >
                      Jump → Q{q}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          {b.delivery && b.delivery.length > 0 && (
            <div
              style={{
                background: "white",
                border: `1px solid ${t.creamSoft}`,
                borderRadius: 12,
                padding: 18,
                borderTop: `3px solid ${b.delivery.some((d) => d.shape === "rambling") ? t.copper : t.success}`,
              }}
            >
              <div style={{ fontSize: 11, color: t.indigoGray, letterSpacing: 1.2, fontWeight: 700, marginBottom: 12 }}>
                DELIVERY TIMELINE
              </div>
              <div style={{ display: "flex", height: 36, borderRadius: 6, overflow: "hidden", border: `1px solid ${t.creamSoft}`, marginBottom: 10 }}>
                {b.delivery.map((s, i) => (
                  <div
                    key={i}
                    style={{
                      flex: s.seconds,
                      background: SHAPE_COLOR[s.shape],
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    Q{s.q}
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 12, fontSize: 11, color: t.indigoGray }}>
                <BehavioralLegend c={t.success} label="crisp" />
                <BehavioralLegend c="#CA8A04" label="hedged" />
                <BehavioralLegend c={t.copper} label="rambling" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI accountability strip */}
      {b.aiAccountability && (
        <div
          style={{
            background: t.creamSoft,
            borderRadius: 10,
            padding: "12px 18px",
            display: "flex",
            flexWrap: "wrap",
            gap: 24,
            fontSize: 12,
            color: t.coal,
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 10, letterSpacing: 1.2, color: t.indigoGray, fontWeight: 700 }}>AI ACCOUNTABILITY</span>
          <span>Depth probes <strong>{b.aiAccountability.depthProbes}</strong> · vague accepted <strong>{b.aiAccountability.vagueAccepted}</strong></span>
          <span>Ownership probes <strong>{b.aiAccountability.ownershipProbes}</strong> · deflected <strong>{b.aiAccountability.deflected}</strong></span>
          {typeof b.aiAccountability.counterpartyProbes === "number" && (
            <span>
              Counterparty probes <strong>{b.aiAccountability.counterpartyProbes}</strong> · skipped <strong>{b.aiAccountability.counterpartySkipped ?? 0}</strong>
            </span>
          )}
        </div>
      )}

      {/* One-habit-to-fix prebias CTA — copy softens when overall band
          is low (<40) so the report doesn't read as a scolding. */}
      {b.oneHabit && (
        <div
          style={{
            background: `linear-gradient(180deg, ${t.indigoDeep} 0%, ${t.indigo} 100%)`,
            color: "white",
            borderRadius: 14,
            padding: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
          }}
        >
          <div>
            <div style={{ fontSize: 10, letterSpacing: 1.5, color: ctaEyebrowAccent, fontWeight: 700 }}>
              {lowBand ? "ONE THING TO TRY NEXT" : "ONE HABIT TO FIX"}
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, marginTop: 4 }}>{b.oneHabit.headline}</div>
            <div style={{ fontSize: 13, opacity: 0.82, marginTop: 4, lineHeight: 1.55 }}>{b.oneHabit.rationale}</div>
            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 8 }}>
              Next session auto-prebias → <strong style={{ color: ctaEyebrowAccent }}>{b.oneHabit.prebiasDimension}</strong>
            </div>
          </div>
          <button
            style={{
              background: "white",
              color: t.indigoDeep,
              border: 0,
              borderRadius: 10,
              padding: "12px 18px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
              fontFamily: f.sans,
            }}
          >
            {ctaCopy}
          </button>
        </div>
      )}
    </section>
  );
}

function BehavioralRadar({
  radar,
}: {
  radar: NonNullable<BehavioralMeta["competencyRadar"]>;
}) {
  const size = 360;
  const cx = size / 2;
  const cy = size / 2;
  const r = 118;
  /* Labels sit on a larger ring than the polygon so scores at 95+
     don't collide with the axis text. Pulled out further at the
     diagonals where the bounding box is most cramped. */
  const labelR = 142;
  const n = radar.axes.length;
  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const point = (i: number, v: number) => {
    const rr = (Math.max(0, Math.min(100, v)) / 100) * r;
    return [cx + rr * Math.cos(angle(i)), cy + rr * Math.sin(angle(i))];
  };
  const labelPoint = (i: number) => [
    cx + labelR * Math.cos(angle(i)),
    cy + labelR * Math.sin(angle(i)),
  ];
  const pathFor = (key: "you" | "prior") => {
    const pts = radar.axes
      .map((a, i) => {
        const v = key === "you" ? a.you : a.prior;
        if (typeof v !== "number") return null;
        const [x, y] = point(i, v);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .filter((p): p is string => p !== null);
    if (pts.length < 3) return "";
    return `M ${pts.join(" L ")} Z`;
  };
  const hasPrior = radar.axes.some((a) => typeof a.prior === "number");

  return (
    <div
      className="ir-radar-grid"
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(280px, 360px) 1fr",
        gap: 24,
        background: "white",
        border: `1px solid ${t.creamSoft}`,
        borderRadius: 12,
        padding: 20,
        alignItems: "center",
      }}
    >
      <div style={{ display: "flex", justifyContent: "center" }}>
        {/* Screen-reader mirror of the radar data — the SVG is a pure
            visual; this list is what AT users actually read. */}
        <ul
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: "hidden",
            clip: "rect(0,0,0,0)",
            whiteSpace: "nowrap",
            border: 0,
          }}
        >
          <li>Track: {radar.track}</li>
          {radar.axes.map((a) => (
            <li key={a.name}>
              {a.name}: {a.you} out of 100
              {typeof a.prior === "number" ? ` (prior session ${a.prior})` : ""}
            </li>
          ))}
        </ul>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={`Competency radar — ${radar.track}`}
        >
          {/* Concentric web rings */}
          {[0.25, 0.5, 0.75, 1].map((ratio) => (
            <polygon
              key={ratio}
              points={radar.axes
                .map((_, i) => {
                  const [x, y] = point(i, ratio * 100);
                  return `${x.toFixed(1)},${y.toFixed(1)}`;
                })
                .join(" ")}
              fill="none"
              stroke={t.creamSoft}
              strokeWidth={1}
            />
          ))}
          {/* Spokes */}
          {radar.axes.map((_, i) => {
            const [x, y] = point(i, 100);
            return (
              <line
                key={i}
                x1={cx}
                y1={cy}
                x2={x}
                y2={y}
                stroke={t.creamSoft}
                strokeWidth={1}
              />
            );
          })}
          {/* Prior session ghost (dashed) */}
          {hasPrior && (
            <path
              className="ir-radar-ghost"
              d={pathFor("prior")}
              fill="rgba(71,85,105,0.10)"
              stroke="rgba(71,85,105,0.55)"
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />
          )}
          {/* Current session — solid indigo, draws axis-by-axis on mount */}
          <path
            className="ir-radar-you"
            d={pathFor("you")}
            fill={`${t.indigo}22`}
            stroke={t.indigo}
            strokeWidth={2}
          />
          {/* Vertices on current session */}
          {radar.axes.map((a, i) => {
            const [x, y] = point(i, a.you);
            return <circle key={i} cx={x} cy={y} r={3} fill={t.indigo} />;
          })}
          {/* Axis labels — anchored on the outer label ring so high
              vertex scores never clip the text. */}
          {radar.axes.map((a, i) => {
            const [x, y] = labelPoint(i);
            const cos = Math.cos(angle(i));
            const sin = Math.sin(angle(i));
            const anchor = cos > 0.25 ? "start" : cos < -0.25 ? "end" : "middle";
            const baseline = sin > 0.4 ? "hanging" : sin < -0.4 ? "auto" : "middle";
            return (
              <text
                key={i}
                x={x}
                y={y}
                textAnchor={anchor}
                dominantBaseline={baseline}
                fontSize={11}
                fontWeight={600}
                fill={t.indigoGray}
              >
                {a.name}
              </text>
            );
          })}
        </svg>
      </div>
      <div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: t.indigo100,
            color: t.indigo,
            padding: "4px 10px",
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.4,
            marginBottom: 10,
          }}
        >
          TRACK · {radar.track}
        </div>
        <h3
          style={{
            fontFamily: f.sans,
            fontSize: 16,
            fontWeight: 600,
            color: t.coal,
            margin: "0 0 8px",
          }}
        >
          Competency profile vs last session
        </h3>
        {radar.anchor && (
          <div
            style={{
              fontSize: 13,
              color: t.coal,
              lineHeight: 1.55,
              marginBottom: 6,
            }}
          >
            <strong style={{ color: t.success }}>Anchor</strong> · {radar.anchor}
          </div>
        )}
        {radar.gap && (
          <div style={{ fontSize: 13, color: t.coal, lineHeight: 1.55 }}>
            <strong style={{ color: t.copper }}>Gap</strong> · {radar.gap}
          </div>
        )}
        <div
          style={{
            display: "flex",
            gap: 14,
            marginTop: 14,
            fontSize: 11,
            color: t.indigoGray,
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                width: 12,
                height: 4,
                background: t.indigo,
                borderRadius: 2,
              }}
            />
            This session
          </span>
          {hasPrior && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  width: 12,
                  height: 4,
                  background:
                    "repeating-linear-gradient(90deg, rgba(71,85,105,0.55) 0 3px, transparent 3px 6px)",
                }}
              />
              Last session
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function BehavioralSignal({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div
      style={{
        background: ok ? t.success100 : t.copper100,
        border: `1px solid ${ok ? "rgba(21,128,61,0.18)" : "rgba(180,83,9,0.22)"}`,
        borderRadius: 8,
        padding: "8px 6px",
        textAlign: "center",
      }}
    >
      <div style={{ color: ok ? t.success : t.copper, fontSize: 18, fontWeight: 700, lineHeight: 1 }}>{ok ? "✓" : "✗"}</div>
      <div style={{ fontSize: 11, color: t.coal, marginTop: 4 }}>{label}</div>
    </div>
  );
}

function BehavioralStat({ n, label, bad, good }: { n: number; label: string; bad?: boolean; good?: boolean }) {
  const color = good ? t.success : bad ? t.copper : t.coal;
  return (
    <div style={{ background: t.cream, border: `1px solid ${t.creamSoft}`, borderRadius: 8, padding: "8px 6px", textAlign: "center" }}>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{n}</div>
      <div style={{ fontSize: 11, color: t.indigoGray, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function BehavioralLegend({ c, label }: { c: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: c }} />
      {label}
    </span>
  );
}

/* ─── Main component ──────────────────────────────────────────────── */

export interface InterviewResultProps {
  data?: InterviewResultData;
}

export default function InterviewResult({ data = DEFAULT_RESULT }: InterviewResultProps) {
  // Research-driven full layout for behavioural focus — opted into via
  // `data.behavioral.fullLayout`. Replaces the standard report body with
  // the 4-region BehavioralReport. Leaves the other 10 focus types
  // (technical, system-design, negotiation, etc.) untouched.
  if (data.behavioral?.fullLayout) {
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
          <a href="#ir-main" className="ir-skip-link">
            Skip to report
          </a>
          <Header />
          <main
            id="ir-main"
            aria-label="Behavioural interview report"
            style={{
              maxWidth: 1240,
              margin: "0 auto",
              padding: "0 32px",
            }}
          >
            <BehavioralReport data={data} />
          </main>
        </div>
      </>
    );
  }
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
        {/* Skip link — keyboard users tabbing into the page can jump
            directly past the header + jump-nav to the report content.
            Visually hidden until focused; standard a11y pattern. */}
        <a href="#ir-section-hero" className="ir-skip-link">
          Skip to report
        </a>
        <Header />
        <main
          id="ir-main"
          aria-label="Interview report"
          style={{
            maxWidth: 1240,
            margin: "0 auto",
            padding: "0 32px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <JumpNav hasBehavioral={!!data.behavioral} />
          <HeroSection data={data} />
          {data.priorSessionCount !== undefined && data.priorSessionCount >= 3 && data.crossSessionInsights && (
            <TrendStrip
              priorSessionCount={data.priorSessionCount}
              insights={data.crossSessionInsights}
            />
          )}
          <CoreMetricsSection
            metrics={data.metrics}
            eyebrowLabel={data.behavioral ? "How you told the story" : "How you delivered"}
            heading={data.behavioral ? "Behavioral signals" : "Core Delivery Metrics"}
          />
          <SkillsSection skills={data.skills} weakest={data.weakestSkill} />
          {data.behavioral && (
            <BehavioralFocusSection b={data.behavioral} score={data.overallScore} />
          )}
          {data.thoughtBubble && data.thoughtBubble.length > 0 && (
            <ThoughtBubbleSection segments={data.thoughtBubble} />
          )}
          <PerQuestionSection questions={data.questions} />
          <CoachNotesSection
            insights={data.crossSessionInsights}
            storyReuse={data.storyReuseFindings}
            blindSpots={data.blindSpots}
          />
          <NextStepsSection
            daysUntilInterview={data.daysUntilInterview}
            readinessSentence={data.readinessSentence}
          />
          <FooterSection />
        </main>
      </div>
    </>
  );
}
