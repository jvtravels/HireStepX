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
import { pickIdealAnswerSnippet } from "./_idealAnswerSnippets";
import type {
  AnswerSpan,
  BehavioralFullReportData,
  BehavioralStarRow,
  BehavioralTranscriptRow,
  BiasFinding,
  CrossSessionInsight,
  DeliveryMetric,
  FocusBannerData,
  HrReportData,
  InterviewResultData,
  LengthVerdict,
  Question,
  RedFlag,
  Skill,
  ThoughtBubbleSegment,
  Verdict,
} from "./types";
import {
  coachOneHabit,
  coachConflict,
  coachFailureQuote,
  type BehavioralFlag,
} from "../../tempo/designs/canvases/interview-result-focus/_behavioral-coach";
import type { AnalyzerMeta } from "../../server-handlers/analyzers/_types";

/* ─── Focus banner chrome constants ────────────────────────────────────
   Icon/label/tagline/accent per focus type. Keys match the focus-type
   strings from focus-signature-metrics.ts (and from session.type /
   session.focus). The `headlineFallbackLabel` is shown when the evaluator
   hasn't yet produced focusMetrics for this session (older rows). */

interface FocusChrome {
  icon: string;
  label: string;
  tagline: string;
  /** Fallback label for the headline metric when focusMetrics is empty. */
  headlineFallbackLabel: string;
  accent: string;
  accentSoft: string;
}

const FOCUS_CHROME: Record<string, FocusChrome> = {
  behavioral: {
    icon: "🗣",
    label: "Behavioral Round",
    tagline: "Did you tell stories with specifics, ownership, and clear outcomes?",
    headlineFallbackLabel: "STAR coverage",
    accent: "#312E81",
    accentSoft: "#E5E2F2",
  },
  technical: {
    icon: "⚙",
    label: "Technical Round · DSA",
    tagline: "Did you walk through approaches and state the complexity, not just code the answer?",
    headlineFallbackLabel: "Complexity stated",
    accent: "#0F766E",
    accentSoft: "#CCFBF1",
  },
  "case-study": {
    icon: "📊",
    label: "Case Study · Product",
    tagline: "Did you use a framework, name a real customer, and drive to a recommendation with a metric?",
    headlineFallbackLabel: "Frameworks named",
    accent: "#9333EA",
    accentSoft: "#F3E8FF",
  },
  "salary-negotiation": {
    icon: "💰",
    label: "Salary Negotiation",
    tagline: "Did you push back on the offer, or accept too quickly?",
    headlineFallbackLabel: "Anchor strength",
    accent: "#B45309",
    accentSoft: "#FEF3C7",
  },
  "system-design": {
    icon: "🏗",
    label: "System Design",
    tagline: "Did you ask about scale + capacity before drawing boxes? Did you call out failure modes?",
    headlineFallbackLabel: "Capacity stated",
    accent: "#1D4ED8",
    accentSoft: "#DBEAFE",
  },
  strategic: {
    icon: "🎯",
    label: "Strategic / Leadership",
    tagline: "Did you map stakeholders, name your vision, and own the bet you'd be making?",
    headlineFallbackLabel: "Stakeholder scope",
    accent: "#1E1B4B",
    accentSoft: "#E5E2F2",
  },
  "campus-placement": {
    icon: "🎓",
    label: "Campus Placement · Fresher",
    tagline: "Did you say 'I built X' or 'we built X'? Did you explain why you picked your tech stack?",
    headlineFallbackLabel: "First-person",
    accent: "#BE185D",
    accentSoft: "#FCE7F3",
  },
  "hr-round": {
    icon: "🤝",
    label: "HR Round",
    tagline: "HR grades you on multiple axes — motivation, compliance, commitment, stability, and more. One zero kills the offer.",
    headlineFallbackLabel: "Red flags",
    accent: "#B91C1C",
    accentSoft: "#FEE2E2",
  },
  panel: {
    icon: "👥",
    label: "Panel Interview",
    tagline: "Did you change tone for each panelist (HR / tech lead / hiring manager) and bridge between them?",
    headlineFallbackLabel: "Panelists engaged",
    accent: "#374151",
    accentSoft: "#E5E7EB",
  },
  "government-psu": {
    icon: "🏛",
    label: "Government / PSU Board",
    tagline: "Did you cite specific schemes, rulings, and policies — not just principles in the abstract?",
    headlineFallbackLabel: "Schemes cited",
    accent: "#7C2D12",
    accentSoft: "#FED7AA",
  },
  management: {
    icon: "📋",
    label: "Management Round",
    tagline: "Did you own a hard call, quantify your scope, and show how you developed your people?",
    headlineFallbackLabel: "Decision ownership",
    accent: "#064E3B",
    accentSoft: "#D1FAE5",
  },
};
/* alias */
FOCUS_CHROME.managerial = FOCUS_CHROME.management;

/** Normalize session.focus / session.type to the FOCUS_CHROME key.
 *  Handles the many spellings that arrive from the frontend. */
function normalizeFocusKey(raw: string): string {
  const s = raw.toLowerCase().trim();
  if (/\bsalary\b|\bnegotiat/.test(s)) return "salary-negotiation";
  if (/\bcase.?stud/.test(s)) return "case-study";
  if (/\bsystem.?design|\barch(itecture)?/.test(s)) return "system-design";
  if (/\bcampus|\bfresher/.test(s)) return "campus-placement";
  if (/\bhr.?round|\bhr\b/.test(s)) return "hr-round";
  if (/\bgovernment|\bpsu|\bupsc|\bssc/.test(s)) return "government-psu";
  if (/\bpanel/.test(s)) return "panel";
  if (/\bstrategic|\bleadership/.test(s)) return "strategic";
  if (/\bmanage?rial|\bmanagement/.test(s)) return "management";
  if (/\btechnical|\bdsa|\bcoding/.test(s)) return "technical";
  if (/\bbehavioral|\bbehavioural/.test(s)) return "behavioral";
  return s; // pass through — may not match a chrome key
}

type SessionFocusMetricInput = { label: string; value: string; tone: "good" | "watch" | "miss" | "neutral" };

/** Build the FocusBannerData for the report header. Returns undefined when:
 *  - the session focus type is not in the chrome registry
 *  - the focus is behavioral (BehavioralFullReport owns its own hero)
 *  The headline metric is the first focusMetric from the evaluator, or a
 *  fallback label when the evaluator hasn't produced metrics yet.
 *  Metric source precedence: report.focusMetrics → session.focusMetrics
 *  (report is freshest; session.focusMetrics is populated by DashboardContext
 *  but absent for sessions opened via /session/[id] before the re-evaluate). */
function buildFocusBanner(
  session: DashboardSession,
  report?: SessionReport,
): FocusBannerData | undefined {
  const rawFocus = session.focus || session.type || "";
  if (!rawFocus) return undefined;
  const key = normalizeFocusKey(rawFocus);
  // Behavioral report has its own hero via BehavioralFullReport — skip banner.
  if (key === "behavioral") return undefined;
  const chrome = FOCUS_CHROME[key];
  if (!chrome) return undefined;

  // Prefer focusMetrics from the evaluated report (freshest), fall back to
  // session.focusMetrics (populated by DashboardContext on dashboard visits).
  const rawMetrics: unknown[] =
    (report?.focusMetrics && report.focusMetrics.length > 0)
      ? report.focusMetrics
      : (session.focusMetrics ?? []);

  const evalMetrics: SessionFocusMetricInput[] = rawMetrics.filter(
    (m): m is SessionFocusMetricInput => {
      if (typeof m !== "object" || m === null) return false;
      const r = m as Record<string, unknown>;
      return (
        typeof r.label === "string" &&
        typeof r.value === "string" &&
        (r.tone === "good" || r.tone === "watch" || r.tone === "miss" || r.tone === "neutral")
      );
    },
  );

  const headlineMetric: FocusBannerData["headlineMetric"] = evalMetrics.length > 0
    ? { label: evalMetrics[0].label, value: evalMetrics[0].value, tone: evalMetrics[0].tone }
    : { label: chrome.headlineFallbackLabel, value: "—", tone: "neutral" };

  // Salary-neg accent adapts to outcome: strong negotiators get a green
  // accent (canvas SALARY_NEG_STRONG_CHROME) when gapClosurePct ≥ 50%.
  // gapClosurePct lives on negotiationOutcome which is built by the same
  // adapter call, so we derive it inline here instead of cross-calling.
  let accent = chrome.accent;
  let accentSoft = chrome.accentSoft;
  if (key === "salary-negotiation" && report) {
    const answers = report.perQuestion.map((q) => q.answerText || "").join(" ");
    const acceptedRe = /\b(i accept|i.?ll accept|accept the offer|sounds good|that works for me|i.?m happy with|agreed)\b/i;
    const offerRe = /(?:extend|offering?|move to|stretch to|come up to|total ctc|can do)\s*(?:you\s*)?₹\s*(\d+(?:\.\d+)?)\s*(?:LPA|lpa|lakhs?)/i;
    const askRe = /\b(?:expecting|target|want|asking|hoping|looking for|would like|i.?d like)\s*(?:₹\s*)?(\d+(?:\.\d+)?)\s*(?:LPA|lpa|lakhs?)/gi;
    const accepted = acceptedRe.test(answers);
    let candidateAsk: number | null = null;
    let am: RegExpExecArray | null;
    askRe.lastIndex = 0;
    while ((am = askRe.exec(answers)) !== null) {
      const v = parseFloat(am[1]);
      if (Number.isFinite(v) && v >= 3 && v <= 500) {
        candidateAsk = candidateAsk === null ? v : Math.max(candidateAsk, v);
      }
    }
    const allOfferMatches: number[] = [];
    const lines = (report.perQuestion.map((q) => q.question || "")).join(" ");
    const offerGlobal = new RegExp(offerRe.source, "gi");
    let om: RegExpExecArray | null;
    while ((om = offerGlobal.exec(lines)) !== null) {
      const v = parseFloat(om[1]);
      if (Number.isFinite(v) && v > 0) allOfferMatches.push(v);
    }
    if (allOfferMatches.length > 0 && candidateAsk !== null) {
      const gap = candidateAsk - allOfferMatches[0];
      const latest = allOfferMatches[allOfferMatches.length - 1];
      const gapClosure = gap > 0 ? Math.round(((latest - allOfferMatches[0]) / gap) * 100) : 0;
      if (accepted && gapClosure >= 50) {
        accent = "#15803D"; // strong negotiator — green
        accentSoft = "#DCFCE7";
      }
    }
  }

  return {
    icon: chrome.icon,
    label: chrome.label,
    tagline: chrome.tagline,
    headlineMetric,
    allMetrics: evalMetrics,
    accent,
    accentSoft,
  };
}

/* ─── HR-round report builder ───────────────────────────────────────── */

/** Maps the `report.hrReport` field (from evaluate-session) to the
 *  view-model's `HrReportData`. Returns undefined when the field is
 *  absent (non-HR sessions) or the evaluator couldn't extract the data
 *  (short sessions, BGV not discussed, etc.). */
function buildHrReport(report: SessionReport): HrReportData | undefined {
  const raw = report.hrReport;
  if (!raw) return undefined;
  // Validate the minimum required pair before passing through.
  if (!raw.motivationBefore && !raw.motivationAfter) return undefined;
  return {
    motivationBefore: raw.motivationBefore ?? "",
    motivationAfter: raw.motivationAfter ?? "",
    noticeDays: typeof raw.noticeDays === "number" ? raw.noticeDays : null,
    noticeFlexibility: raw.noticeFlexibility ?? "not-stated",
    compExpected: raw.compExpected ?? null,
    counterOfferRisk: raw.counterOfferRisk ?? "not-assessed",
    bgvGaps: Array.isArray(raw.bgvGaps) ? raw.bgvGaps : [],
    companyNorms: raw.companyNorms ?? null,
  };
}

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
  /** Resume improvement bullets from the AI resume analysis — surfaced
   *  in the Next Steps section to connect coaching with resume quality. */
  resumeImprovements?: string[];
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
  const isHrRound =
    /hr.?round|\bhr\b/i.test(session.type || "") ||
    /hr.?round|\bhr\b/i.test(session.focus || "");

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
    fairnessSignals:
      report.fairnessSignals && report.fairnessSignals.notes.length > 0
        ? { notes: report.fairnessSignals.notes }
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
    resumeImprovements: Array.isArray(ctx.resumeImprovements) && ctx.resumeImprovements.length > 0
      ? ctx.resumeImprovements.slice(0, 3)
      : undefined,
    negotiationOutcome: isNegotiation
      ? attachPowerContext(
          attachLowballEvent(
            buildNegotiationOutcome(report, session.negotiationMetrics),
            session.negotiationMetrics?.lowballEvent,
          ),
          session.negotiationMetrics?.powerContext,
        )
      : undefined,
    kernelMetrics: isNegotiation ? session.negotiationMetrics : undefined,
    focusBanner: buildFocusBanner(session, report),
    hrReport: isHrRound ? buildHrReport(report) : undefined,
  };
}

/** Adopt the negotiation outcome from the kernel's authoritative final
 *  state (persisted on `negotiationMetrics`) instead of re-parsing the
 *  transcript. The kernel KNOWS the offer trajectory, the candidate's
 *  ask, and whether the deal closed — the regex heuristic below silently
 *  failed on real sessions (a session that closed at ₹25.2L rendered
 *  "0 of 5 stages, didn't close, no counter named"). Mirrors the
 *  adoptKernelBand fix for the Deal Summary band.
 *
 *  Returns null for legacy rows persisted before the trajectory fields
 *  were added (initialOfferLpa / offerTrajectoryLpa absent) — the caller
 *  then falls back to the transcript heuristic. */
function adoptKernelOutcome(
  km: NonNullable<DashboardSession["negotiationMetrics"]>,
): InterviewResultData["negotiationOutcome"] | null {
  if (km.offerTrajectoryLpa == null || typeof km.initialOfferLpa !== "number") {
    return null; // legacy row — no authoritative trajectory persisted
  }
  const outcome: "accepted" | "walked_away" | "no_agreement" =
    km.outcome === "accepted" ? "accepted"
    : km.outcome === "walked-away" ? "walked_away"
    : "no_agreement"; // stalemate / in-progress → no close

  const trajectory = km.offerTrajectoryLpa;
  const offers = trajectory.map((total, i) => ({
    turn: i + 1,
    total,
    question: "",
  }));
  const candidateAsk = km.candidateAskLpa ?? null;
  const latest = trajectory.length > 0
    ? trajectory[trajectory.length - 1]
    : (typeof km.finalOfferLpa === "number" ? km.finalOfferLpa : null);
  const finalTotal = outcome === "accepted"
    ? (typeof km.finalOfferLpa === "number" ? km.finalOfferLpa : latest)
    : null;

  // PRI-52 (2026-06-21): gap closure must measure movement off the FIRST offer
  // the AI actually made — trajectory[0] — not km.initialOfferLpa, which is the
  // band FLOOR (market P35) and was never offered. Anchoring the denominator on
  // the floor understated the opening and inflated the apparent closure. Fall
  // back to the band floor only when no cash offer was ever made.
  const firstOfferMade = trajectory.length > 0 ? trajectory[0] : km.initialOfferLpa;
  let gapClosurePct: number | null = null;
  if (candidateAsk !== null && latest !== null && candidateAsk > firstOfferMade) {
    gapClosurePct = Math.max(0, Math.min(100, Math.round(
      ((latest - firstOfferMade) / (candidateAsk - firstOfferMade)) * 100,
    )));
  }

  return { offers, finalTotal, outcome, candidateAsk, gapClosurePct };
}

/** Derive the offer trajectory + deal outcome. Prefers the kernel's
 *  authoritative final state (`negotiationMetrics`); falls back to a
 *  heuristic transcript scan only for legacy rows that predate the
 *  persisted trajectory. The heuristic is deterministic: scan AI text
 *  for ₹X LPA totals (only the "total / offer" mentions, not component
 *  breakdowns), scan candidate text for explicit acceptance / walk-away
 *  / target numbers. Drives the salary-neg report section. */
export function buildNegotiationOutcome(
  report: SessionReport,
  kernelMetrics?: DashboardSession["negotiationMetrics"],
): InterviewResultData["negotiationOutcome"] {
  if (kernelMetrics) {
    const adopted = adoptKernelOutcome(kernelMetrics);
    if (adopted) return adopted;
  }
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

  // Candidate's highest stated target (their ask). The cue set mirrors the
  // kernel's TARGET_CUE_PRESENCE (_number-role-classifier) so a counter the
  // kernel would bind is the same one the report's stage-tracker credits.
  // finding #112 (2026-06-20) — the prior pattern wrote a bare `target`,
  // which `\btarget\b` could not match inside "targeting 65 LPA fixed"
  // (the spoken form): the report then read "NO COUNTER NAMED" even though
  // the candidate anchored hard twice. Inflect the verbs and widen the cue
  // set (aiming/need/i need/settle for/at least/minimum) to close the gap.
  let candidateAsk: number | null = null;
  const askRe = /\b(?:expect(?:ing|ed)?|target(?:ing|ed|s)?|aim(?:ing)?(?:\s+for)?|want(?:ing|ed|s)?|asking(?:\s+for)?|hoping(?:\s+for)?|looking\s+(?:for|at)|would\s+like|i.?d\s+like|i\s+need|need(?:ing|ed|s)?|settle\s+for|closer\s+to|at\s+least|minimum\s+(?:of\s+)?)\s*(?:₹\s*)?(\d+(?:\.\d+)?)\s*(?:LPA|lpa|lakhs?)/gi;
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
  // stated ask that the final offer closed. Surfaced honestly as
  // "you closed 65% of the gap" — NOT as a cohort percentile (we have
  // no cohort data). Renamed from `percentileWithinBand` 2026-05-30.
  let gapClosurePct: number | null = null;
  if (offers.length > 0) {
    const initialOffer = offers[0].total;
    const latestOffer = offers[offers.length - 1].total;
    if (candidateAsk !== null && candidateAsk > initialOffer) {
      gapClosurePct = Math.max(0, Math.min(100, Math.round(
        ((latestOffer - initialOffer) / (candidateAsk - initialOffer)) * 100,
      )));
    }
  }

  return { offers, finalTotal, outcome, candidateAsk, gapClosurePct };
}

/** Splice the kernel-derived calibrated-surprise lowball event onto the
 *  outcome. The kernel computes it via buildLowballEvent(finalState)
 *  upstream (see useInterviewEngine); the adapter just threads it
 *  through so the panel can render. */
function attachLowballEvent(
  outcome: InterviewResultData["negotiationOutcome"],
  lowballEvent: NonNullable<DashboardSession["negotiationMetrics"]>["lowballEvent"],
): InterviewResultData["negotiationOutcome"] {
  if (!outcome || !lowballEvent) return outcome;
  return { ...outcome, lowballEvent };
}

/** Recruiter-power-dynamics feature (2026-05-29) — splice the kernel-derived
 *  power context onto the outcome. The engine computes it via
 *  `buildPowerContext(finalState)` upstream (see useInterviewEngine); the
 *  adapter just threads it through. */
function attachPowerContext(
  outcome: InterviewResultData["negotiationOutcome"],
  powerContext: NonNullable<DashboardSession["negotiationMetrics"]>["powerContext"],
): InterviewResultData["negotiationOutcome"] {
  if (!outcome || !powerContext) return outcome;
  return { ...outcome, powerContext };
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
      // STAR+L: prefer the deterministic detector's `L` flag now that
      // evaluate-session.ts populates it (src/_star-detection.ts shares
      // the regex with the live coach). Legacy reports stored before
      // the bump won't carry `L`; fall back to the original inline
      // heuristic so historical sessions still render a sensible value.
      learning:
        (q.starPresence as { L?: boolean }).L ??
        /\b(learn(ed)?|takeaway|next time|in hindsight)\b/i.test(q.answerText),
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
    idealAnswerSnippet: pickIdealAnswerSnippet(
      stripProsodyMarkup(q.question),
      isSkipped || q.verdict === "skipped" ? "weak" : q.verdict
    ),
    focusMetrics: q.focusMetrics?.length
      ? q.focusMetrics.map((m) => ({
          label: m.label,
          value: m.value,
          tone: m.tone as "good" | "watch" | "miss" | "neutral",
        }))
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

/* ─── BehavioralFullReportData adapter ─────────────────────────────────
   Builds the prop bag for the diagnostic-first behavioral report.

   The input is the analyzer's `meta.behavioral` payload (shape defined
   in `server-handlers/analyzers/_types.ts`) plus a thin session context
   for hero / persona / track / cohort context. Edge-state detection
   lives here so the component's JSX stays pure render:
     - no failure question asked → `failure` is null
     - no conflict question asked → `conflict` is null
     - < 3 substantive answers → `starBreakdown` is empty
     - first-ever session → `scoreDelta` is null, `radar.prev` is null

   The function returns nullable sub-objects, never `undefined`, so the
   component renders with `if (x)` rather than `if (x != null)` —
   matches the discriminated-union pattern used elsewhere in src/. */

export interface BehavioralFullReportContext {
  /** The freshly-evaluated report (used for score + verdict + percentile). */
  report: SessionReport;
  /** Dashboard session row — supplies persona/track/duration context. */
  session: DashboardSession;
  /** Recent scores, most-recent-LAST. Length 1 → first-ever session. */
  recentScores?: number[];
  /** Cohort percentile (0..100) for this candidate's track. */
  percentile?: number | null;
  /** Number-this-session — defaults to recentScores.length. */
  sessionNumber?: number;
  /** Persona overrides — typically derived from session.type. */
  personaVoice?: string;
  /** LPA band label, e.g. "₹38 LPA". */
  lpaBand?: string;
  /** Analyzer flags surfaced for this session. Drives the dominant
   *  one-habit pick; empty array falls back to a generic STAR habit. */
  flags?: ReadonlyArray<string>;
}

type BehavioralMeta = NonNullable<AnalyzerMeta["behavioral"]>;

/** Convert analyzer flag string into the coach-registry's narrower
 *  BehavioralFlag union. Returns null if the flag isn't in the
 *  registry — the caller falls back to the next-strongest flag. */
function asCoachFlag(flag: string): BehavioralFlag | null {
  const supported: ReadonlyArray<BehavioralFlag> = [
    "one_sided_conflict_narrative",
    "weak_specificity_in_failure_story",
    "we_without_i",
    "result_missing",
    "rambling_answers",
    "rehearsed_answers",
    "low_conviction_delivery",
    "weak_star_structure",
  ];
  return (supported as ReadonlyArray<string>).includes(flag)
    ? (flag as BehavioralFlag)
    : null;
}

/** Pick the dominant flag for the one-habit block. Order biases toward
 *  conflict / failure first (highest user-visible impact), then
 *  delivery, then structural. Falls back to a generic STAR-coherence
 *  habit if nothing matches. */
function pickDominantCoachFlag(
  flags: ReadonlyArray<string>,
): BehavioralFlag {
  const priority: BehavioralFlag[] = [
    "one_sided_conflict_narrative",
    "weak_specificity_in_failure_story",
    "result_missing",
    "we_without_i",
    "rambling_answers",
    "low_conviction_delivery",
    "rehearsed_answers",
    "weak_star_structure",
  ];
  for (const candidate of priority) {
    if (flags.some((f) => asCoachFlag(f) === candidate)) return candidate;
  }
  return "weak_star_structure";
}

/* Topic labels for transcript rows — falls back to "Question N" when
 * the per-question row doesn't carry a topic. Kept short so the
 * transcript-replay row stays one-line. */
function topicForQuestion(question: string | null | undefined, idx: number): string {
  if (!question) return `Question ${idx + 1}`;
  const cleaned = stripProsodyMarkup(question).trim();
  return cleaned.length > 64 ? `${cleaned.slice(0, 61)}…` : cleaned;
}

function softCtaCopy(score: number, oneHabitDimension: string): {
  primary: string;
  sub: string;
} {
  if (score < 40) {
    return {
      primary: "Reset with a focused drill",
      sub: `This round didn't land — start small. A 10-minute drill on ${oneHabitDimension} resets the muscle.`,
    };
  }
  if (score > 85) {
    return {
      primary: "Start next session",
      sub: `Strong round. Next session biases toward ${oneHabitDimension} to keep stretching.`,
    };
  }
  return {
    primary: "Start next session",
    sub: `Next session biased toward ${oneHabitDimension}. Practice when you have 25 quiet minutes.`,
  };
}

export function toBehavioralFullReportData(
  ctx: BehavioralFullReportContext,
  behavioralMeta: BehavioralMeta | null | undefined,
): BehavioralFullReportData {
  const { report, session, recentScores, percentile, sessionNumber } = ctx;
  const meta: BehavioralMeta = behavioralMeta ?? {
    starBreakdown: [],
  };

  const star = meta.starBreakdown ?? [];
  const substantiveAnswers = star.length;
  const isFirstSession = !recentScores || recentScores.length <= 1;
  const scoreDelta = isFirstSession || !recentScores || recentScores.length < 2
    ? null
    : recentScores[recentScores.length - 1] - recentScores[recentScores.length - 2];

  /* Persona — derive from session metadata, falling back to opinionated
   * defaults. Voice defaults to "Hiring Manager" because behavioral
   * sessions almost always run as HM-style — the analyzer doesn't know
   * the persona but the report should still read like one. */
  const persona: BehavioralFullReportData["persona"] = {
    voice: ctx.personaVoice || "Hiring Manager",
    tier: session.company ? `${session.company}-tier` : "your target tier",
    role: session.role || "Candidate",
    lpaBand: ctx.lpaBand || "—",
  };

  /* Dominant flag drives the one-habit block. We thread through a per-
   * session context so the coach copy lands grounded ("In Q2 you…"). */
  const dominantFlag = pickDominantCoachFlag(ctx.flags ?? []);
  const failureTurnIdx = star.findIndex((s) => s.missing.includes("R"));
  const oneHabit = coachOneHabit(dominantFlag, {
    questionIndex: failureTurnIdx >= 0 ? failureTurnIdx + 1 : undefined,
    personaVoice: persona.voice,
    companyTier: persona.tier,
  });

  /* STAR breakdown rows — collapse to empty when too few substantive
   * answers (the component renders a one-line note in that case). */
  const starBreakdown: BehavioralStarRow[] = substantiveAnswers >= 3
    ? star.map((row, idx) => {
        const qid = `Q${idx + 1}`;
        const topic = topicForQuestion(
          report.perQuestion[idx]?.question,
          idx,
        );
        return {
          questionId: qid,
          topic,
          s: row.present.includes("S"),
          t: row.present.includes("T"),
          a: row.present.includes("A"),
          r: row.present.includes("R"),
        };
      })
    : [];

  /* Failure card — null when no failure question was asked. The coach
   * quote pulls from the registry (one source of truth). */
  const probing = meta.probing;
  const failure: BehavioralFullReportData["failure"] = probing?.failureQuestionAsked
    ? {
        ownership: probing.failureResponse === "owns",
        ownershipNote: probing.failureResponse === "owns"
          ? "Named the call as yours, not the team's."
          : probing.failureResponse === "deflects"
          ? "Routed blame outward — own the miss first."
          : "Neutral framing — name your call explicitly.",
        concreteMiss: probing.failureResponseHadConcreteMiss === true,
        concreteMissNote: probing.failureResponseHadConcreteMiss === true
          ? "Named a specific assumption / system / risk."
          : "Stayed at 'an edge case' — name the actual miss.",
        learning: (probing.learningReflections ?? 0) > 0,
        learningNote: (probing.learningReflections ?? 0) > 0
          ? "Drew a forward principle from the miss."
          : "Close with what you'd do differently next time.",
        coachQuote: coachFailureQuote({
          questionIndex: failureTurnIdx >= 0 ? failureTurnIdx + 1 : undefined,
          personaVoice: persona.voice,
        }),
        statusLabel: probing.failureResponse === "owns"
          ? probing.failureResponseHadConcreteMiss
            ? "Owns + specific"
            : "Owns, not specific"
          : probing.failureResponse === "deflects"
          ? "Deflects"
          : "Neutral",
        statusTone: probing.failureResponse === "owns" && probing.failureResponseHadConcreteMiss
          ? "ok"
          : "gap",
      }
    : null;

  /* Conflict card — null when no conflict question was asked. */
  const conflictMeta = meta.conflict;
  const conflict: BehavioralFullReportData["conflict"] = conflictMeta && conflictMeta.conflictQuestionsAsked > 0
    ? {
        asked: conflictMeta.conflictQuestionsAsked,
        oneSided: conflictMeta.oneSidedConflictHits,
        balanced: Math.max(
          0,
          conflictMeta.conflictQuestionsAsked - conflictMeta.oneSidedConflictHits,
        ),
        coachLine: coachConflict({
          personaVoice: persona.voice,
          companyTier: persona.tier,
        }),
        jumpToQuestionIds: star
          .map((_, idx) => `Q${idx + 1}`)
          .slice(0, conflictMeta.conflictQuestionsAsked)
          .slice(0, 2),
        statusLabel: conflictMeta.oneSidedConflictHits >= conflictMeta.conflictQuestionsAsked
          ? `One-sided ${conflictMeta.oneSidedConflictHits}/${conflictMeta.conflictQuestionsAsked}`
          : `Balanced ${conflictMeta.conflictQuestionsAsked - conflictMeta.oneSidedConflictHits}/${conflictMeta.conflictQuestionsAsked}`,
        statusTone: conflictMeta.oneSidedConflictHits >= conflictMeta.conflictQuestionsAsked
          ? "gap"
          : conflictMeta.oneSidedConflictHits === 0
          ? "ok"
          : "neutral",
      }
    : null;

  /* Delivery — derive per-question tone segments from per-question
   * rambling/hedge signal, falling back to "crisp" when neither fires. */
  const deliveryMeta = meta.delivery ?? {
    rehearsedOpenerHits: 0,
    lowConvictionHits: 0,
    ramblingHits: 0,
  };
  const segments: BehavioralFullReportData["delivery"]["segments"] = star.map(
    (row, idx) => {
      const tone: "crisp" | "hedged" | "ramble" =
        row.text_preview.length >= 1500
          ? "ramble"
          : !row.present.includes("R") || !row.quantified
          ? "hedged"
          : "crisp";
      return { questionId: `Q${idx + 1}`, tone };
    },
  );
  const delivery: BehavioralFullReportData["delivery"] = {
    rehearsedHits: deliveryMeta.rehearsedOpenerHits,
    hedgedHits: deliveryMeta.lowConvictionHits,
    ramblingHits: deliveryMeta.ramblingHits,
    segments,
    coachLine: deliveryMeta.ramblingHits >= 2
      ? `Crisp early, loose late. Compress Situation/Task to 20s combined — ${persona.voice}s lose the thread past 90s.`
      : deliveryMeta.lowConvictionHits >= 2
      ? `Hedging stacked across ${deliveryMeta.lowConvictionHits} answers. Drop 'I think' / 'kind of' from claims you actually own.`
      : `Delivery rhythm tracked well across the round.`,
    statusLabel: deliveryMeta.ramblingHits >= 2
      ? "Stamina gap"
      : deliveryMeta.lowConvictionHits >= 2
      ? "Hedging pattern"
      : "Stable",
    statusTone: deliveryMeta.ramblingHits >= 2 || deliveryMeta.lowConvictionHits >= 2
      ? "gap"
      : "ok",
  };

  /* Radar — driven by `topCompetencies` + `competencyCounts`. We map
   * the count → a 0..10 axis value via a soft cap; if the analyzer
   * surfaced a richer competency set, the top 7 wins. Prev is null on
   * first session (component hides the ghost polygon). */
  const competencyCounts = meta.competencyCounts ?? {};
  const sortedAxes = Object.entries(competencyCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7);
  const axes = sortedAxes.length > 0
    ? sortedAxes.map(([k]) => k)
    : [
        "Customer obsession",
        "Ownership",
        "Stakeholder mgmt",
        "Data fluency",
        "Roadmap clarity",
        "Conflict navigation",
        "Outcome quantification",
      ];
  const youValues = axes.map((axis) => {
    const n = competencyCounts[axis] ?? 0;
    // 1 hit ≈ 5.0, 2 ≈ 6.5, 3 ≈ 7.5, 4+ ≈ 8+, capped at 10.
    return Math.min(10, 3 + n * 1.6);
  });
  const radar: BehavioralFullReportData["radar"] = {
    axes,
    you: youValues,
    prev: isFirstSession
      ? null
      : axes.map((_, i) => Math.max(0, youValues[i] - 0.6)),
    track: report.calibration?.companyLabel || "your track",
    summary: meta.topCompetencies && meta.topCompetencies.length > 0
      ? `Top demonstrated: ${meta.topCompetencies.slice(0, 3).join(", ")}.`
      : "Competency signal was thin this round — anchor next stories to one or two strengths.",
    ups: (meta.topCompetencies ?? []).slice(0, 3),
    downs: axes.slice(-2).filter((a) => !meta.topCompetencies?.includes(a)),
    statusLabel: (meta.topCompetencies?.length ?? 0) >= 3 ? "Strong signals" : "Mixed signals",
    statusTone: (meta.topCompetencies?.length ?? 0) >= 3 ? "ok" : "neutral",
  };

  /* Evidence audit. We don't have the actual unevidenced quotes on
   * the analyzer meta (only counts), so we pull short previews from
   * starBreakdown entries that quoted a number but didn't have R. */
  const evidenceMeta = meta.evidence ?? {
    metricAnswersCount: 0,
    metricAnswersUnevidenced: 0,
    aiAcceptedUnevidencedMetric: 0,
  };
  const unevidencedQuotes = star
    .filter((row) => row.quantified && !row.present.includes("R"))
    .slice(0, 2)
    .map((row) => row.text_preview);
  const evidence: BehavioralFullReportData["evidence"] = {
    metricClaims: evidenceMeta.metricAnswersCount,
    evidenced: Math.max(
      0,
      evidenceMeta.metricAnswersCount - evidenceMeta.metricAnswersUnevidenced,
    ),
    floating: evidenceMeta.metricAnswersUnevidenced,
    unevidencedQuotes,
    fixTechnique:
      "Anchor before percent. 'From 8.4% to 11.1% in the 30-day window' lands. Bar-Raisers stop probing once the anchor lands.",
    statusLabel: evidenceMeta.metricAnswersUnevidenced > 0
      ? `${evidenceMeta.metricAnswersUnevidenced} floating claim${evidenceMeta.metricAnswersUnevidenced === 1 ? "" : "s"}`
      : "All evidenced",
    statusTone: evidenceMeta.metricAnswersUnevidenced > 0 ? "gap" : "ok",
  };

  const aiAccountability: BehavioralFullReportData["aiAccountability"] = {
    depthProbes: probing?.aiProbedDepth ?? 0,
    vagueAccepted: probing?.aiAcceptedVague ?? 0,
    ownershipProbes: probing?.aiProbedOwnership ?? 0,
    deflected: 0,
  };

  const transcript: BehavioralTranscriptRow[] = star.map((row, idx) => {
    const qid = `Q${idx + 1}`;
    const pills: BehavioralTranscriptRow["pills"] = [];
    if (row.present.includes("A") && row.present.includes("R")) {
      pills.push({ label: "✓ complete arc", tone: "ok" });
    }
    if (!row.present.includes("R")) {
      pills.push({ label: "✗ result missing", tone: "gap" });
    }
    if (row.quantified) {
      pills.push({ label: "✓ quantified", tone: "ok" });
    }
    if ((row.competencies?.length ?? 0) > 0) {
      pills.push({
        label: `✓ ${row.competencies![0]}`,
        tone: "ok",
      });
    }
    return {
      questionId: qid,
      topic: topicForQuestion(report.perQuestion[idx]?.question, idx),
      pills,
    };
  });

  const cta = softCtaCopy(report.overallScore, oneHabit.prebiasDimension);

  return {
    score: report.overallScore,
    scoreDelta,
    verdict: report.verdict,
    percentile: percentile ?? null,
    track: report.calibration?.companyLabel || "your track",
    persona,
    sessionMeta: {
      number: sessionNumber ?? (recentScores?.length ?? 1),
      dateISO: session.date ?? new Date().toISOString().slice(0, 10),
      durationMin: Math.max(
        1,
        Math.round(
          (typeof session.duration === "string"
            ? parseInt(session.duration.match(/(\d+)/)?.[1] ?? "0", 10) * 60
            : 0) / 60,
        ),
      ),
      substantiveAnswers,
    },
    oneHabit,
    starBreakdown,
    failure,
    conflict,
    delivery,
    radar,
    evidence,
    aiAccountability,
    transcript,
    ctaPrimaryLabel: cta.primary,
    ctaSubcopy: cta.sub,
    isFirstSession,
  };
}
