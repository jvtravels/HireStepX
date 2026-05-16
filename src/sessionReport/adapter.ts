/* Session Report — adapter from prod `SessionReport` (mvp-6) to
   the view-model (`InterviewResultData`).

   The view layer never touches `SessionReport` directly — every shape
   conversion (verdict rename, thought-bubble 6→3 collapse, length-
   verdict slug, length highlights, weakest-skill derivation, score-
   confidence number→union, etc.) happens here so the view component can
   stay a pure presentation component.

   Side-effect-free; all inputs in, view-model out. Unit-testable. */

import type {
  SessionReport,
  SessionReportPerQuestion,
  SessionReportRedFlag,
  SessionReportCrossSessionInsight,
} from "../dashboardData";
import type { DashboardSession } from "../dashboardTypes";
import { detectBias, countBias, BIAS_LABELS, type BiasPatternKind } from "../biasDetector";
import { stripProsodyMarkup } from "../_prosody";
import type {
  AnswerSpan,
  BiasFinding,
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
  /** Non-native English flag — softens the bias detector for hedging
   *  patterns that are politeness, not authority erosion. */
  nonNativeEnglish?: boolean;
}

export function sessionReportToInterviewResult(
  ctx: AdapterContext
): InterviewResultData {
  const { report, session } = ctx;

  const company = ctx.targetCompany || session.company || "Your target";
  const role = ctx.targetRole || session.role || "Candidate";
  const level = report.calibration?.companyLabel?.split(" ").slice(-1)[0] || "—";
  const difficulty = capitalize(session.difficulty || "Standard");
  const isNegotiation =
    /negotiat|salary/i.test(session.type || "") ||
    /negotiat|salary/i.test(session.focus || "");

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
    metrics: isNegotiation ? buildNegotiationMetrics(report) : buildMetrics(report),
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
    biasFindings: buildBiasFindings(report.perQuestion, ctx.nonNativeEnglish),
    reverseInterview: report.reverseInterview
      ? {
          verdict: report.reverseInterview.verdict,
          counts: report.reverseInterview.counts,
          classifications: report.reverseInterview.classifications,
        }
      : undefined,
    negotiationOutcome: isNegotiation ? buildNegotiationOutcome(report) : undefined,
    kernelMetrics: isNegotiation ? session.negotiationMetrics : undefined,
  };
}

/** Derive the offer trajectory + deal outcome from the per-question
 *  transcript. Heuristic but deterministic: scan AI text for ₹X LPA
 *  totals (only the "total / offer" mentions, not component breakdowns),
 *  scan candidate text for explicit acceptance / walk-away / target
 *  numbers. Drives the salary-neg report section. */
function buildNegotiationOutcome(report: SessionReport): InterviewResultData["negotiationOutcome"] {
  const offers: Array<{ turn: number; total: number; question: string }> = [];
  const totalRe = /(?:offer(?:ing)?(?:\s+(?:you|to))?|extend(?:ing)?(?:\s+an?)?\s+offer|total(?:\s+ctc)?|stretch\s+to|move\s+to|land\s+at|come\s+up\s+to|i\s+can\s+do)\s*(?:you\s*)?₹\s*(\d+(?:\.\d+)?)\s*(?:LPA|lpa|lakhs?)/i;
  report.perQuestion.forEach((q, idx) => {
    if (!q.question) return;
    const m = totalRe.exec(q.question);
    if (m) {
      const v = parseFloat(m[1]);
      if (Number.isFinite(v) && v > 0) {
        offers.push({ turn: idx + 1, total: v, question: q.question });
      }
    }
  });

  // Outcome derivation
  const allAnswers = report.perQuestion.map((q) => q.answerText || "").join(" ");
  const acceptedRe = /\b(i accept|i.?ll accept|accept the offer|sounds good|that works for me|it.?s a deal|i.?m happy with|fine with me|i agree|agreed|let.?s go ahead|happy to accept)\b/i;
  const walkRe = /\b(walk away|walking away|i.?m out|not interested|i.?ll pass|no deal|withdraw|decline the offer|i decline|pull out|not worth|won.?t work|move on|have to pass)\b/i;
  let outcome: "accepted" | "walked_away" | "no_agreement" = "no_agreement";
  if (acceptedRe.test(allAnswers)) outcome = "accepted";
  else if (walkRe.test(allAnswers)) outcome = "walked_away";

  // Candidate's highest stated target (their ask)
  let candidateAsk: number | null = null;
  const askRe = /\b(?:expecting|target|want|asking|hoping|looking for|would like|i.?d like)\s*(?:₹\s*)?(\d+(?:\.\d+)?)\s*(?:LPA|lpa|lakhs?)/gi;
  let am: RegExpExecArray | null;
  while ((am = askRe.exec(allAnswers)) !== null) {
    const v = parseFloat(am[1]);
    if (Number.isFinite(v) && v >= 3 && v <= 500) {
      candidateAsk = candidateAsk === null ? v : Math.max(candidateAsk, v);
    }
  }

  const finalTotal = outcome === "accepted" && offers.length > 0
    ? offers[offers.length - 1].total
    : null;

  // % of the gap between the AI's initial offer and the candidate's
  // stated ask that the final offer closed. Useful for "you closed
  // 65% of the gap" framing in the report.
  let percentileWithinBand: number | null = null;
  if (offers.length > 0) {
    const initialOffer = offers[0].total;
    const latestOffer = offers[offers.length - 1].total;
    if (candidateAsk !== null && candidateAsk > initialOffer) {
      percentileWithinBand = Math.max(0, Math.min(100, Math.round(
        ((latestOffer - initialOffer) / (candidateAsk - initialOffer)) * 100,
      )));
    }
  }

  return { offers, finalTotal, outcome, candidateAsk, percentileWithinBand };
}

/** Aggregate bias-pattern hits across all answers, attach a
 *  representative example for each non-zero kind, emit only kinds that
 *  fired. Returns undefined when no bias signal — panel collapses to
 *  nothing in that case. */
function buildBiasFindings(
  perQuestion: SessionReportPerQuestion[],
  nonNativeEnglish: boolean | undefined
): BiasFinding[] | undefined {
  const opts = { nonNativeEnglish };
  const allAnswers = perQuestion.map((q) => q.answerText || "");
  const counts = countBias(allAnswers, opts);
  const findings: BiasFinding[] = [];
  (Object.keys(counts) as BiasPatternKind[]).forEach((kind) => {
    const n = counts[kind];
    if (n === 0) return;
    let example: string | undefined;
    let suggestion = "";
    for (const answer of allAnswers) {
      const hits = detectBias(answer, opts);
      const first = hits.find((h) => h.kind === kind);
      if (first) {
        example = first.text;
        suggestion = first.suggestion;
        break;
      }
    }
    findings.push({
      kind,
      label: BIAS_LABELS[kind],
      count: n,
      example,
      suggestion,
    });
  });
  return findings.length > 0 ? findings : undefined;
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
 *  the canvas design budgeted for. We keep the 4 core + medianLatency +
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

/** Negotiation-specific delivery metrics. The interview-result canvas
 *  storyboard already showed a different metric set for negotiations
 *  (anchor strength, concession rate, silence held, disclosure leaks).
 *  Best-effort derivations from the candidate's transcript text — these
 *  are heuristic and replaceable when the LLM scoring pipeline starts
 *  emitting first-class negotiation signals on `report`. */
function buildNegotiationMetrics(report: SessionReport): DeliveryMetric[] {
  const candidateAnswers = report.perQuestion.map((q) => q.answerText || "");
  const allText = candidateAnswers.join(" ");

  // Anchor strength — % of negotiation answers where the candidate stated
  // a specific number anchor (₹X LPA / X lakhs). High = anchored hard.
  const anchorRe = /(?:₹\s*)?\d+(?:\.\d+)?\s*(?:LPA|lpa|lakhs?|cr|crore|l\b)/i;
  const answersWithAnchor = candidateAnswers.filter((t) => anchorRe.test(t)).length;
  const anchorStrength = candidateAnswers.length > 0
    ? Math.round((answersWithAnchor / candidateAnswers.length) * 100)
    : 0;

  // Concession rate — count "I'd be open to / I can lower / how about / fine
  // with X" type concessions. Low concession = strong negotiator.
  const concessionRe = /\b(i.?d\s+be\s+open|i\s+can\s+lower|fine\s+with|how\s+about|let.?s\s+meet\s+at|i.?ll\s+take|happy\s+with|i\s+accept)\b/gi;
  const concessions = (allText.match(concessionRe) || []).length;
  const concessionRate = Math.min(100, concessions * 10);

  // Disclosure leaks — count times candidate volunteered current CTC or
  // hard target without a deflect. Detection heuristic: "my current ctc",
  // "i make / i earn / i'm at ₹X".
  const leakRe = /\b(my\s+current\s+(ctc|salary|package)|i\s+(make|earn|.?m\s+at|currently\s+make)|currently\s+earning)\b/gi;
  const leaks = (allText.match(leakRe) || []).length;

  // Silence tolerance proxy — use median latency as the closest existing
  // signal. A candidate who pauses before responding to pushback often
  // performs better than one who rushes. Above 1.5s median = composed.
  const medianLatencySec = round1(report.advancedDelivery.medianLatencyMs / 1000);

  return [
    {
      label: "Anchor strength",
      value: anchorStrength,
      unit: "/100",
      targetLabel: "Target 70+",
      band: anchorStrength >= 70 ? "good" : anchorStrength >= 50 ? "ok" : "needsWork",
    },
    {
      label: "Concession rate",
      value: concessionRate,
      unit: "%",
      targetLabel: "Target <15%",
      band: concessionRate < 15 ? "good" : concessionRate < 30 ? "ok" : "needsWork",
    },
    {
      label: "Median latency",
      value: medianLatencySec,
      unit: "s",
      targetLabel: "Target 1.5–4s",
      band: medianLatencySec >= 1.5 && medianLatencySec <= 4 ? "good" : medianLatencySec < 1 ? "needsWork" : "ok",
    },
    {
      label: "Disclosure leaks",
      value: leaks,
      targetLabel: "Target 0",
      band: leaks === 0 ? "good" : leaks <= 1 ? "ok" : "needsWork",
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
  // A skipped question is a free coaching surface — we keep the
  // exemplar/restructured content but replace the candidate's answer
  // body with an explicit "Skipped" line so the report doesn't show
  // the "[SKIPPED — reason: …]" sentinel verbatim.
  const isSkipped = q.verdict === "skipped" || /^\[SKIPPED/i.test(q.answerText || "");
  const skipReasonMatch = (q.answerText || "").match(/reason:\s*([a-z_]+)/i);
  const skipReasonLabel: Record<string, string> = {
    too_easy: "marked it too easy",
    too_hard: "marked it too hard",
    not_relevant: "marked it not relevant",
    already_answered: "said they'd already covered this",
    no_reason: "skipped without a reason",
  };
  const reasonText = skipReasonMatch ? (skipReasonLabel[skipReasonMatch[1]] || "skipped") : "skipped";
  return {
    index: q.idx + 1, // prod is 0-indexed; UX is 1-indexed
    // Strip TTS prosody directives ([pause], _emphasis_, etc.) — the LLM
    // injects them so the spoken question sounds natural, but they leak
    // through into the report transcript verbatim.
    text: stripProsodyMarkup(q.question),
    score: isSkipped ? 0 : q.score,
    // band is the report's color/label — coerce "skipped" to "weak"
    // for the band tone (copper/error). The skipped state itself is
    // signaled by the answer-body line and a 0 score in the row.
    band: isSkipped || q.verdict === "skipped" ? "weak" : q.verdict,
    answer: isSkipped
      ? [{ text: `(Skipped — you ${reasonText}. Counted as 0/100.)` }]
      : highlightAnswer(q.answerText),
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
      ? stripProsodyMarkup(`${q.likelyFollowUp.question} ${q.likelyFollowUp.why}`)
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

/** Collapse prod's 6 thought-bubble states to the 3 the canvas design
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
