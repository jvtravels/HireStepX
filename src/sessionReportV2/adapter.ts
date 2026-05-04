/* Session Report V2 — adapter from prod `SessionReport` (mvp-6) to
   the V2 view-model (`InterviewResultData`).

   The view layer never touches `SessionReport` directly — every shape
   conversion (verdict rename, thought-bubble 6→3 collapse, length-
   verdict slug, length highlights, weakest-skill derivation, score-
   confidence number→union, etc.) happens here so the V2 component can
   stay a pure presentation component.

   Side-effect-free; all inputs in, view-model out. Unit-testable. */

import type {
  SessionReport,
  SessionReportPerQuestion,
  SessionReportRedFlag,
  SessionReportCrossSessionInsight,
} from "../dashboardData";
import type { DashboardSession } from "../dashboardTypes";
import type {
  AnswerSpan,
  CrossSessionInsight,
  DeliveryMetric,
  InterviewResultData,
  LengthVerdict,
  Question,
  RedFlag,
  Skill,
  ThoughtBubbleSegment,
  Verdict,
} from "./types";

/* ─── Top-level adapter ─────────────────────────────────────────────── */

export interface AdapterContext {
  /** The freshly-evaluated report from /api/evaluate-session. */
  report: SessionReport;
  /** The dashboard row that owns this session — supplies role/company/
   *  level/difficulty + transcript metadata that doesn't live on the
   *  report itself. */
  session: DashboardSession;
  /** Score history for the inline sparkline. Most-recent-LAST. */
  recentScores?: number[];
  /** Cohort percentile (0-100) — derived server-side or computed via
   *  `roleBenchmarks.bucketPercentile`. Optional. */
  percentile?: number;
  /** Days until the user's scheduled interview, if any (from
   *  AuthContext / profile). */
  daysUntilInterview?: number;
  /** Target role label override — falls back to session.role. */
  targetRole?: string;
  /** Target company override — falls back to session.company. */
  targetCompany?: string;
}

export function sessionReportToInterviewResult(
  ctx: AdapterContext
): InterviewResultData {
  const { report, session } = ctx;

  const company = ctx.targetCompany || session.company || "Your target";
  const role = ctx.targetRole || session.role || "Candidate";
  const level = report.calibration?.companyLabel?.split(" ").slice(-1)[0] || "—";
  const difficulty = capitalize(session.difficulty || "Standard");

  const scoreDelta = computeScoreDelta(ctx.recentScores);
  const weakestSkill = pickWeakestSkill(report.skills);

  return {
    overallScore: report.overallScore,
    verdict: report.band as Verdict,
    scoreDelta,
    percentile: ctx.percentile,
    recentScores: ctx.recentScores,
    readiness: report.readiness
      ? {
          pct: clamp(report.overallScore, 0, 100),
          etaWeeks: estimateWeeks(report.readiness.estimatedHours),
        }
      : undefined,
    daysUntilInterview: ctx.daysUntilInterview,
    company,
    role,
    level,
    difficulty,
    aiVerdict: report.verdict,
    strengths: report.wins.map((w) => w.text),
    improvements: report.fixes.map((f) => f.text),
    metrics: buildMetrics(report),
    skills: buildSkills(report.skills),
    weakestSkill: {
      name: weakestSkill?.name || "—",
      tip:
        weakestSkill
          ? `Focus your next session on ${weakestSkill.name.toLowerCase()} — it's your lowest signal at ${weakestSkill.score}/100.`
          : "Keep practising consistently.",
    },
    questions: report.perQuestion.map((q) => adaptQuestion(q, report.redFlags)),
    scoreConfidence: confidenceBucket(report.scoreConfidence),
    scoreConfidenceNote:
      report.scoreConfidence < 0.7
        ? "Score may move ±5 with more transcript signal."
        : undefined,
    calibration: report.calibration
      ? {
          companyLabel: report.calibration.companyLabel,
          note: report.calibration.note,
          bands: [
            { label: "Strong Hire", minScore: report.calibration.bands.strongHire },
            { label: "Hire", minScore: report.calibration.bands.hire },
            { label: "Lean Hire", minScore: report.calibration.bands.leanHire },
          ],
        }
      : undefined,
    priorSessionCount: report.priorSessionCount,
    crossSessionInsights: adaptInsights(report.crossSessionInsights),
    storyReuseFindings: report.storyReuseFindings.map((s) => ({
      storyLabel: s.storyLabel,
      body: s.concern,
    })),
    blindSpots: report.blindSpots.map((b) => ({
      title: b.competency,
      body: b.note,
    })),
    thoughtBubble: collapseThoughtBubble(report.thoughtBubble),
    readinessSentence: report.readiness
      ? `~${report.readiness.estimatedHours} hours over ~${report.readiness.estimatedSessions} sessions to reach the ${formatBand(report.readiness.targetBand)} band — ${report.readiness.confidence} confidence. ${report.readiness.rationale}`
      : undefined,
  };
}

/* ─── Field-level helpers ───────────────────────────────────────────── */

function computeScoreDelta(recent?: number[]): number {
  if (!recent || recent.length < 2) return 0;
  return recent[recent.length - 1] - recent[recent.length - 2];
}

function pickWeakestSkill(
  skills: Array<{ name: string; score: number; weight?: number }>
): { name: string; score: number } | null {
  if (!skills || skills.length === 0) return null;
  // Prefer weighted-low skill so headline matches the score the LLM
  // actually penalised. Fall back to raw min when weights are absent.
  return skills
    .slice()
    .sort((a, b) => (a.score * (a.weight ?? 1)) - (b.score * (b.weight ?? 1)))[0];
}

/** Map prod's 9 delivery numbers (4 core + 5 advanced) onto the 6 tiles
 *  the V2 design budgeted for. We keep the 4 core + medianLatency +
 *  selfCorrectionRate; hedging/lexicalDiversity/firstPersonRatio drop —
 *  per the audit, they're either redundant with red-flags or low-signal
 *  per pixel of report real estate. */
function buildMetrics(report: SessionReport): DeliveryMetric[] {
  const { coreMetrics, advancedDelivery } = report;
  return [
    {
      label: "Filler words / min",
      value: round1(coreMetrics.fillerPerMin),
      targetLabel: "Target 0–3",
      band: bandForFiller(coreMetrics.fillerPerMin),
    },
    {
      label: "Silence ratio",
      value: Math.round(coreMetrics.silenceRatio * 100),
      unit: "%",
      targetLabel: "Target 0–20%",
      band: bandForSilence(coreMetrics.silenceRatio),
    },
    {
      label: "Pace (WPM)",
      value: Math.round(coreMetrics.paceWpm),
      targetLabel: "Target 140–180",
      band: bandForPace(coreMetrics.paceWpm),
    },
    {
      label: "Energy",
      value: Math.round(coreMetrics.energy),
      unit: "/100",
      targetLabel: "Target 60–100",
      band: bandForEnergy(coreMetrics.energy),
    },
    {
      label: "Median latency",
      value: round1(advancedDelivery.medianLatencyMs / 1000),
      unit: "s",
      targetLabel: "Target <2.0s",
      band: bandForLatency(advancedDelivery.medianLatencyMs),
    },
    {
      label: "Self-correction rate",
      value: round1(advancedDelivery.selfCorrectionRate),
      unit: "/min",
      targetLabel: "Target <1.0",
      band: bandForSelfCorrection(advancedDelivery.selfCorrectionRate),
    },
  ];
}

function buildSkills(
  skills: Array<{ name: string; score: number; weight?: number }>
): Skill[] {
  // Prod schema doesn't carry roleAvg directly — leave undefined; the
  // marker just won't render. A future enhancement can join against
  // `roleBenchmarks` and inject roleAvg here.
  return skills.map((s) => ({ name: s.name, score: s.score }));
}

function adaptQuestion(
  q: SessionReportPerQuestion,
  allRedFlags: SessionReportRedFlag[]
): Question {
  const myFlags = allRedFlags.filter((f) => f.questionIdx === q.idx);
  return {
    index: q.idx + 1, // prod is 0-indexed; UX is 1-indexed
    text: q.question,
    score: q.score,
    band: q.verdict === "skipped" ? "weak" : q.verdict,
    answer: highlightAnswer(q.answerText),
    restructured: q.restructured ? plainSpans(q.restructured.text) : undefined,
    topPerformerAnswer: q.topPerformerAnswer
      ? plainSpans(q.topPerformerAnswer.text)
      : undefined,
    whatMakesItStrong: q.topPerformerAnswer?.whatMakesItStrong,
    star: {
      situation: q.starPresence.S,
      task: q.starPresence.T,
      action: q.starPresence.A,
      result: q.starPresence.R,
      // Prod schema doesn't carry "Learning" presence — derive from a
      // simple heuristic on the answer text. Best-effort; can be fed
      // by the LLM in a future schema bump.
      learning: /\b(learn(ed)?|takeaway|next time|in hindsight)\b/i.test(
        q.answerText
      ),
    },
    metrics: {
      wordCount: q.lengthVerdict?.wordCount ?? wordCount(q.answerText),
      // Prod doesn't track per-question seconds yet; estimate from word
      // count at ~150 WPM. Replace when the metric lands.
      responseSec: Math.round((wordCount(q.answerText) / 150) * 60),
      firstPersonRatioPct: Math.round(firstPersonRatio(q.answerText) * 100),
      quantificationCount: countQuantifications(q.answerText),
    },
    whyScored: q.explanation,
    redFlags: myFlags.length > 0 ? myFlags.map(adaptRedFlag) : undefined,
    lengthVerdict: q.lengthVerdict
      ? lengthVerdictSlug(q.lengthVerdict.verdict)
      : undefined,
    frequencyPct: q.frequencyPct ?? undefined,
    frequencyNote: q.frequencyNote || undefined,
    likelyFollowUp: q.likelyFollowUp
      ? `${q.likelyFollowUp.question} ${q.likelyFollowUp.why}`
      : undefined,
  };
}

function adaptRedFlag(rf: SessionReportRedFlag): RedFlag {
  return {
    type: rf.type,
    severity: rf.severity,
    title: rf.title,
    explanation: rf.explanation,
    quote: rf.quote || undefined,
  };
}

function lengthVerdictSlug(
  v: "too-brief" | "right" | "too-long"
): LengthVerdict {
  if (v === "too-brief") return "tooShort";
  if (v === "too-long") return "tooLong";
  return "justRight";
}

function adaptInsights(
  prod: SessionReportCrossSessionInsight[]
): CrossSessionInsight[] | undefined {
  if (!prod || prod.length === 0) return undefined;
  return prod.map((i) => ({
    kind: i.kind,
    title: i.text,
    body:
      i.metric && typeof i.delta === "number"
        ? `${i.metric}${i.delta >= 0 ? " +" : " "}${i.delta}.`
        : "",
  }));
}

/** Collapse prod's 6 thought-bubble states to the 3 the V2 design
 *  uses. Mapping:
 *    tracking, impressed, readyToMoveOn → engaged
 *    losingThread, probingForScope     → drifting
 *    concerned                         → concerned
 *  Then aggregate by share of session duration. */
export function collapseThoughtBubble(
  prod: SessionReport["thoughtBubble"]
): ThoughtBubbleSegment[] | undefined {
  if (!prod || prod.length === 0) return undefined;
  const totalMs = prod.reduce((acc, s) => acc + (s.endMs - s.startMs), 0);
  if (totalMs <= 0) return undefined;
  const buckets = { engaged: 0, drifting: 0, concerned: 0 };
  for (const s of prod) {
    const dur = s.endMs - s.startMs;
    if (s.state === "tracking" || s.state === "impressed" || s.state === "readyToMoveOn") {
      buckets.engaged += dur;
    } else if (s.state === "losingThread" || s.state === "probingForScope") {
      buckets.drifting += dur;
    } else {
      buckets.concerned += dur;
    }
  }
  const segments: ThoughtBubbleSegment[] = [];
  (["engaged", "drifting", "concerned"] as const).forEach((key) => {
    const pct = Math.round((buckets[key] / totalMs) * 100);
    if (pct > 0) segments.push({ state: key, pct });
  });
  return segments.length > 0 ? segments : undefined;
}

/** Score-confidence number → bucket for the chip. Above 0.85 we don't
 *  render a chip ("high"). Treat 0.6-0.85 as medium; below as low. */
export function confidenceBucket(n: number): "high" | "medium" | "low" {
  if (n >= 0.85) return "high";
  if (n >= 0.6) return "medium";
  return "low";
}

/* ─── Light NLP heuristics for highlight spans + word stats ─────────── */

const FILLERS = /\b(um+|uh+|like|you know|basically|literally|sort of|kind of|i mean)\b/gi;
const HEDGES = /\b(i think|i guess|maybe|probably|kinda|somewhat|i would say|sort of)\b/gi;
const QUANT = /(\d+(?:\.\d+)?\s*(?:%|x|×|hours?|days?|weeks?|months?|years?|\$|₹|k|m|b|million|billion|seconds?|users?|customers?|requests?|engineers?|members?))/gi;
const FIRST_PERSON = /\b(I|my|me|mine)\b/g;

/** Split an answer into highlight spans by running each regex pass-by-
 *  pass. Naive but cheap; the highlight is decorative — coaching value
 *  comes from the red-flags list. */
export function highlightAnswer(text: string): AnswerSpan[] {
  if (!text) return [{ text: "" }];
  const matches: Array<{ start: number; end: number; kind: AnswerSpan["highlight"] }> = [];
  collectMatches(text, FILLERS, "filler", matches);
  collectMatches(text, HEDGES, "hedge", matches);
  collectMatches(text, QUANT, "quantified", matches);
  // First-person highlight is too noisy at sentence scale; skip in V1.

  if (matches.length === 0) return [{ text }];
  matches.sort((a, b) => a.start - b.start);
  // Merge overlapping ranges, keeping the first kind that won the slot.
  const merged: typeof matches = [];
  for (const m of matches) {
    const last = merged[merged.length - 1];
    if (last && m.start < last.end) continue;
    merged.push(m);
  }
  const out: AnswerSpan[] = [];
  let cursor = 0;
  for (const m of merged) {
    if (cursor < m.start) out.push({ text: text.slice(cursor, m.start) });
    out.push({ text: text.slice(m.start, m.end), highlight: m.kind });
    cursor = m.end;
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor) });
  return out;
}

function collectMatches(
  text: string,
  re: RegExp,
  kind: AnswerSpan["highlight"],
  acc: Array<{ start: number; end: number; kind: AnswerSpan["highlight"] }>
) {
  // RegExp.exec with /g is stateful — reset before reuse.
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    acc.push({ start: m.index, end: m.index + m[0].length, kind });
    if (m.index === re.lastIndex) re.lastIndex++; // guard zero-width
  }
}

function plainSpans(text: string): AnswerSpan[] {
  // Restructured + exemplar text comes pre-formatted from the LLM —
  // we keep it as a single span for now. A future pass can run the
  // same highlight regexes if we want quantification highlights to
  // visually pop on the exemplar.
  return [{ text }];
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function firstPersonRatio(text: string): number {
  const total = wordCount(text);
  if (total === 0) return 0;
  const m = text.match(FIRST_PERSON);
  return (m?.length ?? 0) / total;
}

function countQuantifications(text: string): number {
  const m = text.match(QUANT);
  return m?.length ?? 0;
}

/* ─── Threshold bands ───────────────────────────────────────────────── */

function bandForFiller(v: number): DeliveryMetric["band"] {
  if (v <= 3) return "good";
  if (v <= 5) return "ok";
  return "needsWork";
}
function bandForSilence(v: number): DeliveryMetric["band"] {
  // v is a 0..1 ratio.
  if (v <= 0.2) return "good";
  if (v <= 0.3) return "ok";
  return "needsWork";
}
function bandForPace(v: number): DeliveryMetric["band"] {
  if (v >= 140 && v <= 180) return "good";
  if (v >= 120 && v <= 200) return "ok";
  return "needsWork";
}
function bandForEnergy(v: number): DeliveryMetric["band"] {
  if (v >= 60) return "good";
  if (v >= 40) return "ok";
  return "needsWork";
}
function bandForLatency(ms: number): DeliveryMetric["band"] {
  if (ms < 2000) return "good";
  if (ms < 3500) return "ok";
  return "needsWork";
}
function bandForSelfCorrection(perMin: number): DeliveryMetric["band"] {
  if (perMin < 1) return "good";
  if (perMin < 2) return "ok";
  return "needsWork";
}

/* ─── Misc ──────────────────────────────────────────────────────────── */

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
function estimateWeeks(hours: number): number {
  // ~3 focused sessions/week × ~1hr each → 3hrs/week effective practice.
  return Math.max(1, Math.round(hours / 3));
}
function formatBand(band: "strongHire" | "hire" | "leanHire"): string {
  if (band === "strongHire") return "Strong Hire";
  if (band === "hire") return "Hire";
  return "Lean Hire";
}
