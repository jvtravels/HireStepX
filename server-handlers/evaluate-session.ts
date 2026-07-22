/* Vercel Node Serverless Function — Interview Session Evaluation (MVP Report) */

// Runtime + duration are authoritatively set on the route segment
// (app/api/evaluate-session/route.ts): nodejs + maxDuration 60. App Router
// ignores this `config` export, so it's kept only as accurate documentation.
export const config = { runtime: "nodejs", maxDuration: 100 };

import { withAuthAndRateLimit, sanitizeForLLM, corsHeaders, withRequestId, hashStable } from "./_shared";
import { captureServerEvent, captureServerException, distinctIdFrom } from "./_posthog";
import { callLLM, extractJSON } from "./_llm";
import { classifyCompanyTier, tierPromptSuffix } from "./_company-tier";
import { formatScoringRubric, RECIPES } from "../data/focus-question-recipes";
import { resolveHrRoundRecipe, resolveHrSectorOverlay, resolveHrCompanyNorms } from "./_hr-round-overlays";
import type { HrCompanyNorms } from "../data/hr-company-norms";
import { detectStarPresence } from "../src/_star-detection";
import { detectCulturalRegister, summarizeIndianRegister } from "../src/_cultural-register";
import {
  summarizeReverseInterview,
  type ReverseInterviewSummary,
} from "../src/_reverse-interview";
import {
  GROUNDING_DIRECTIVE,
  FAIRNESS_DIRECTIVE,
  LENGTH_TARGETS_DIRECTIVE,
  SELF_CHECK_DIRECTIVE,
  getRubricWeight,
} from "./_evaluate-session-prompts";
import { PROBE_TEXTS } from "./_behavioral-followup-bank";
import { sanitizeVoiceValue } from "./_voice-sanitizer";
import { BEHAVIORAL_COMPETENCIES, COMPETENCY_LABELS } from "../data/behavioral-question-bank";
import {
  ROLE_SKILLS,
  resolveSkillAxes,
  DEFAULT_BANDS,
  applyBands,
  resolveCompanyProfile,
  resolveCalibrationLabel,
  computeCoreMetrics,
  computeAdvancedDelivery,
  filterGroundedItems,
  filterGroundedRedFlags,
  validateReportShape,
  computeBlendedOverall,
  computeStructuralAnchor,
  isStarShapedFocus,
  deriveSkillWeightsFromRubric,
  selectCanonicalHrSkills,
  HR_ROUND_SKILL_AXES,
  isUsableEvalReport,
  normalizeThoughtBubble,
  normalizeScoreConfidence,
  normalizeStoryReuse,
  normalizeBlindSpots,
  normalizeReadiness,
  normalizeResumeGrounding,
  normalizeCrossSessionInsights,
  normalizeCoaching,
  normalizeFocusMetrics,
  normalizeHrReport,
  buildNegotiationOfferFactsBlock,
  validateVerdictCoherence,
  type Coaching,
  type FocusMetric,
  type ResumeGroundingScore,
  type WinOrFix as WinOrFixH,
  type RedFlag as RedFlagH,
} from "./_evaluate-session-helpers";
import { formatSignatureMetricsPrompt, formatPerQuestionMetricsPrompt } from "../data/focus-signature-metrics";
import { buildDeterministicNegotiationReport, type NegOutcome } from "./_deterministic-neg-report";
import { isWalkAway } from "./_walkaway-detection";

declare const process: { env: Record<string, string | undefined> };
const GROQ_KEY = process.env.GROQ_API_KEY || "";
const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Bump on any schema change to perQuestion/redFlags/etc. Old cached reports
// with a different version are auto-invalidated on next view.
// mvp-9: added focusMetrics (per-focus signature strip on the session card).
const REPORT_VERSION = "mvp-9";

/**
 * Inputs — beyond sessionId + schema version — that change the *content* of a
 * report even for an identical transcript. Band calibration reads
 * targetCompany / role / difficulty (resolveCompanyProfile → applyBands), so a
 * report cached before the user edited any of these is stale. We fold them into
 * the cached row's identity so any edit is a cache MISS that recomputes.
 */
export interface ReportCacheIdentityInputs {
  targetCompany?: string | null;
  role?: string | null;
  difficulty?: string | null;
}

/**
 * The single source of truth for a cached report's identity. Written by
 * saveCachedReport and compared by loadCachedReport — never inline either side.
 * Returns a composite version string `<REPORT_VERSION>:<hash>` stored in the
 * existing `report_version` column, so a schema bump OR a calibration-input
 * change both invalidate the cache with no DB migration. Edge/WinterCG safe
 * (hashStable → crypto.subtle).
 */
export async function buildReportCacheVersion(inputs: ReportCacheIdentityInputs): Promise<string> {
  // Normalize so cosmetic differences (case, whitespace, null vs "") don't
  // cause spurious misses — but any real change flips the hash.
  const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();
  const canonical = JSON.stringify({
    c: norm(inputs.targetCompany),
    r: norm(inputs.role),
    d: norm(inputs.difficulty),
  });
  const hash = await hashStable(canonical);
  return `${REPORT_VERSION}:${hash}`;
}

/**
 * Try to read a cached report for this session. Returns null on any failure
 * (cache miss, network error, version mismatch) so the caller re-evaluates.
 * We verify user_id matches the caller so one user can't retrieve another's
 * report via a guessed sessionId. `identity` folds the calibration-affecting
 * inputs (company/role/difficulty) into the compare — see
 * buildReportCacheVersion — so editing any of them is a miss that recomputes.
 */
async function loadCachedReport(
  sessionId: string,
  userId: string,
  identity: ReportCacheIdentityInputs,
): Promise<SessionReport | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
  try {
    const expectedVersion = await buildReportCacheVersion(identity);
    const q = `sessions?id=eq.${encodeURIComponent(sessionId)}&user_id=eq.${encodeURIComponent(userId)}&select=report_json,report_version`;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${q}`, {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Accept": "application/json",
      },
    });
    if (!res.ok) return null;
    const rows = await res.json() as Array<{ report_json?: SessionReport; report_version?: string }>;
    const row = rows?.[0];
    if (!row?.report_json) return null;
    // Composite version encodes schema version AND calibration inputs; a schema
    // upgrade OR a company/role/difficulty edit both invalidate the cache here.
    if (row.report_version !== expectedVersion) return null;
    return row.report_json;
  } catch (err) {
    console.warn(`[evaluate-session] cache read failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/**
 * Persist the report on the session row. Fire-and-forget relative to the
 * response: we await it so the write completes before the edge isolate
 * terminates (same lesson as llm_usage), but failures don't block the
 * response — worst case, the user re-evaluates on next view.
 */
async function saveCachedReport(
  sessionId: string,
  userId: string,
  report: SessionReport,
  identity: ReportCacheIdentityInputs,
): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return;
  try {
    const reportVersion = await buildReportCacheVersion(identity);
    const q = `sessions?id=eq.${encodeURIComponent(sessionId)}&user_id=eq.${encodeURIComponent(userId)}`;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${q}`, {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        report_json: report,
        report_version: reportVersion,
        report_generated_at: new Date().toISOString(),
        // Reconcile the canonical sessions.score column with the report's
        // blended overall. save-session.ts first writes the QUICK eval
        // (/api/evaluate — raw LLM score) here; the report shows the richer
        // blended-and-anchored score (computeBlendedOverall). Without this
        // line the Sessions list / dashboard kept showing the quick number
        // while the report showed the blended one (e.g. 64 vs 51) for the
        // same session. Writing both in ONE atomic PATCH guarantees
        // report_json.overallScore and sessions.score can never diverge.
        score: report.overallScore,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[evaluate-session] cache write HTTP ${res.status}: ${body.slice(0, 200)}`);
    }
  } catch (err) {
    console.error(`[evaluate-session] cache write failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Load the user's 3 most-recent prior reports (excluding the current session)
 * so the LLM can reference longitudinal patterns — "you've improved on
 * quantification" or "pace is a persistent issue". We only ship the compact
 * coaching signal, NOT transcripts, for token economy + privacy.
 */
interface PriorReportSummary {
  sessionId: string;
  daysAgo: number;
  overallScore: number;
  band: string;
  topFixes: string[];          // just the fix text, for recurrence matching
  topWins: string[];
  coreMetrics: { fillerPerMin: number; silenceRatio: number; paceWpm: number; energy: number };
  weakestSkills: Array<{ name: string; score: number }>;
}

async function loadPriorReports(currentSessionId: string, userId: string, focus?: string): Promise<PriorReportSummary[]> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return [];
  try {
    /* Scope prior context to same focus when focus is set — cross-focus insights
       are misleading (behavioral patterns for a campus fresher, negotiation data
       for a behavioral session). For campus-placement the scope is strict: prior
       behavioral sessions from a 89-session SPD user dominate and produce wrong
       "persistent gaps" (STAR structure, Ownership) that don't apply to freshers. */
    const focusFilter = focus ? `&focus=eq.${encodeURIComponent(focus)}` : "";
    const q = `sessions?user_id=eq.${encodeURIComponent(userId)}&id=neq.${encodeURIComponent(currentSessionId)}&report_json=not.is.null${focusFilter}&order=created_at.desc&limit=3&select=id,created_at,report_json`;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${q}`, {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) return [];
    const rows = (await res.json()) as Array<{ id: string; created_at: string; report_json: SessionReport }>;
    const now = Date.now();
    return rows
      .filter((r) => r.report_json && typeof r.report_json === "object")
      .map((r) => {
        const rp = r.report_json;
        const sortedSkills = [...(rp.skills || [])].sort((a, b) => a.score - b.score).slice(0, 2);
        return {
          sessionId: r.id,
          daysAgo: Math.max(0, Math.floor((now - new Date(r.created_at).getTime()) / 86_400_000)),
          overallScore: rp.overallScore || 0,
          band: rp.band || "",
          topFixes: (rp.fixes || []).slice(0, 3).map((f) => f.text),
          topWins: (rp.wins || []).slice(0, 3).map((w) => w.text),
          coreMetrics: rp.coreMetrics || { fillerPerMin: 0, silenceRatio: 0, paceWpm: 0, energy: 0 },
          weakestSkills: sortedSkills.map((s) => ({ name: s.name, score: s.score })),
        };
      });
  } catch (err) {
    console.warn(`[evaluate-session] prior-reports fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}

/** MVP report schema — kept tight; additive V2 fields documented in PRD. */
interface EvaluateRequest {
  sessionId: string;
  transcript: Array<{ role: "interviewer" | "candidate"; text: string; startMs?: number; endMs?: number }>;
  meta: {
    role?: string;
    roleFamily?: "swe" | "pm" | "em" | "data" | "behavioral";
    type?: string; // interview focus type (behavioral, case-study, technical, etc.)
    focus?: string; // sub-focus slug (e.g. "campus-placement", "hr-round")
    targetCompany?: string | null;
    level?: string | null;
    difficulty?: "warmup" | "standard" | "hard";
    duration?: number; // seconds
    /** Live interviewer name + personality. Used to keep
        `topPerformerAnswer.text` in the same voice the candidate just
        heard. Without this the rich report sounds like a different
        coach than the one who ran the live session. */
    interviewerName?: string;
    interviewerPersonality?: string;
    /** Resume context surfaced to the evaluator so the rich report can
     *  reason about what the candidate actually has on their CV —
     *  flag missed-opportunity moments ("you never mentioned project X
     *  even though it's directly relevant to this role"), validate
     *  claimed experience against resume facts, and ground model-
     *  answer exemplars in the candidate's own background. Optional
     *  by design: resumeless practice flow still works. */
    resumeContext?: {
      topSkills?: string[];
      topProjects?: string[];
      headline?: string;
      careerTrajectory?: string;
      /** Extended grounding: enables missed-achievement flags, industry-
       *  context anchoring, and company-name credibility cross-checks. */
      keyAchievements?: string[];
      industries?: string[];
      companiesOnResume?: string[];
    };
  };
}

interface FollowUpQuestion {
  question: string;   // the next question an interviewer would likely ask
  why: string;        // why they'd ask it, given the candidate's answer
}

interface LengthVerdict {
  verdict: "too-brief" | "right" | "too-long";
  wordCount: number;
  targetRange: string;  // e.g. "120-240 words"
  note: string;         // one line, second-person
}

interface PerQuestionReport {
  idx: number;
  question: string;
  answerText: string;
  verdict: "strong" | "complete" | "partial" | "weak" | "skipped";
  score: number;
  starPresence: { S: boolean; T: boolean; A: boolean; R: boolean; L: boolean };
  /**
   * Indian-context cultural-register markers detected deterministically
   * on the candidate's answer (see src/_cultural-register.ts). The live
   * coach already runs these detectors during follow-up; surfacing them
   * on the report ensures voice continuity — the candidate sees the
   * same markers in the post-session view that the live coach treated
   * as non-penalty signals. Independent of the LLM's interpretation.
   */
  culturalRegister?: {
    hedgedDisagreement: boolean;
    indirectFailureFraming: boolean;
    relationalFraming: boolean;
    calendarAnchored: boolean;
    deferentialGratitude: boolean;
    pedigreeRecital: boolean;
  };
  /** Interviewer's likely follow-up — adaptive-thinking training. */
  likelyFollowUp: FollowUpQuestion | null;
  /** Answer-length analysis against an interviewer's attention window. */
  lengthVerdict: LengthVerdict | null;
  /**
   * Difficulty of the question *for the target role/level*. Warmup = opener,
   * standard = core loop question, hard = bar-raiser / senior-level probe.
   * Calibrates score interpretation: a 55 on a "hard" Q is different signal
   * from a 55 on "warmup".
   */
  difficulty: "warmup" | "standard" | "hard";
  /**
   * Estimated % of loops at the target company/role that ask this question
   * or a close variant. 0-100, or null when the LLM can't estimate.
   */
  frequencyPct: number | null;
  /** Short context line — e.g. "common opener", "bar-raiser variant", "role-specific". ≤60 chars. */
  frequencyNote: string;
  restructured: { text: string; citations: Array<{ markerIdx: number; sourceStart: number; sourceEnd: number }> } | null;
  /**
   * How a 90/100 candidate would answer this question. Unlike `restructured`
   * (grounded in the candidate's own words), this is a synthesized exemplar —
   * the LLM may invent realistic companies/numbers appropriate to the role
   * and level. The UI must label this clearly as a generated example so the
   * candidate doesn't think it's theirs.
   */
  topPerformerAnswer: {
    text: string;
    whatMakesItStrong: string[]; // 2-4 bullets: specific reasons this answer is 90/100
  } | null;
  explanation: string;
  /** Per-question focus-specific tiles — only present for non-behavioral focus
   *  types that have PER_QUESTION_METRIC_SPECS. Replaces generic 4-tile strip. */
  focusMetrics?: Array<{ label: string; value: string; tone: "good" | "watch" | "miss" | "neutral" }>;
}

interface WinOrFix {
  text: string;         // imperative for fixes, declarative for wins
  questionIdx: number;  // which perQuestion.idx this relates to, -1 if cross-cutting
  quote: string;        // verbatim substring of the candidate's words (validated)
}

type RedFlagType = "blame" | "missing_result" | "we_without_i" | "scope_drift" | "contradiction" | "vague";

interface RedFlag {
  type: RedFlagType;
  severity: "high" | "medium" | "low";
  title: string;              // e.g. "Missing result"
  explanation: string;        // 1 sentence in second person
  questionIdx: number;        // -1 for cross-cutting
  quote: string;              // verbatim substring (validated); "" for cross-cutting
}

interface AdvancedDelivery {
  hedgingPerMin: number;          // density of hedges per minute of speech
  lexicalDiversity: number;       // MTLD-lite: unique-word ratio, 0-1
  firstPersonRatio: number;       // I / (I + we) across candidate corpus
  medianLatencyMs: number;        // median gap between question end → candidate start
  selfCorrectionRate: number;     // "let me rephrase", "actually", restarts per minute
}

interface ThoughtBubbleSegment {
  startMs: number;
  endMs: number;
  state: "tracking" | "losingThread" | "probingForScope" | "readyToMoveOn" | "impressed" | "concerned";
  note: string; // ≤80 chars, second-person, honest
}

interface CrossSessionInsight {
  kind: "improvement" | "regression" | "persistent";
  text: string;                 // one sentence, second-person
  metric?: string;              // optional: "pace", "quantification", "Technical Depth"
  delta?: number;               // signed pt change from last session, if numeric
}

interface StoryReuseFinding {
  storyLabel: string;           // short label — e.g. "Catalyst IQ launch"
  questionIndices: number[];    // perQuestion.idx list where the story was reused
  concern: string;              // one sentence of coaching
}

interface BlindSpot {
  competency: string;           // e.g. "Conflict resolution"
  frequencyPct: number | null;  // how often this competency is tested at target role/company
  note: string;                 // one-line coaching on how to prep for it
}

interface ReadinessForecast {
  targetBand: "strongHire" | "hire" | "leanHire";
  estimatedHours: number;       // focused practice hours to reach target band
  estimatedSessions: number;    // estimated # of mock sessions
  confidence: "low" | "medium" | "high";
  rationale: string;            // one sentence explaining the estimate
}

interface SessionReport {
  version: "mvp-9";
  overallScore: number;
  /** LLM-self-reported 0-1 confidence in the overall score. Rendered as ±band. */
  scoreConfidence: number;
  band: "strongHire" | "hire" | "leanHire" | "noHire" | "strongNoHire";
  verdict: string;
  wins: WinOrFix[];
  fixes: WinOrFix[];
  redFlags: RedFlag[];
  coreMetrics: { fillerPerMin: number; silenceRatio: number; paceWpm: number; energy: number };
  advancedDelivery: AdvancedDelivery;
  skills: Array<{ name: string; score: number; weight?: number }>;
  perQuestion: PerQuestionReport[];
  thoughtBubble: ThoughtBubbleSegment[];
  calibration: {
    companyLabel: string;
    note: string;
    bands: { strongHire: number; hire: number; leanHire: number; noHire: number };
  };
  /**
   * India-context fairness applied during scoring. Deterministically detected
   * from the candidate's own words (src/_cultural-register.ts), this surfaces
   * the non-penalty treatment a Western-tuned scorer would silently mark down
   * (deferential gratitude, indirect failure framing, festival anchoring,
   * pedigree recital, etc.). Empty `markers` → the UI hides the surface, so
   * the "we adjusted for X" claim is only ever shown when X actually occurred.
   */
  fairnessSignals: { markers: string[]; notes: string[] };
  crossSessionInsights: CrossSessionInsight[];
  priorSessionCount: number;
  storyReuseFindings: StoryReuseFinding[];
  blindSpots: BlindSpot[];
  readiness: ReadinessForecast | null;
  /**
   * 0-100 sub-score measuring how often the candidate's answers cited
   * specific resume facts vs. spoke in generic claims. `null` when no
   * resumeContext was supplied to the evaluator (so the UI can hide the
   * axis instead of showing a misleading zero).
   */
  resumeGrounding: ResumeGroundingScore | null;
  /**
   * Closing-turn reverse-interview classification — pinned deterministically
   * (see src/_reverse-interview.ts). When the interviewer asked "any
   * questions for us?" and the transcript captured the candidate's reply,
   * this surfaces a green/yellow/red breakdown + verdict. `null` when no
   * reverse-interview turn is present in the transcript.
   */
  reverseInterview: ReverseInterviewSummary | null;
  /**
   * Plain-language coaching pair for the dashboard session card: one thing
   * the candidate did well and the single highest-leverage gap to fix next,
   * with a concrete rewrite example. Grounded in the transcript. `null` when
   * the LLM omitted or malformed the field (card falls back to wins/fixes).
   */
  coaching: Coaching | null;
  /**
   * Per-focus signature metrics — the three numbers that define quality in
   * THIS interview focus (anchor delta for negotiation, STAR coverage for
   * behavioral, capacity math for system design). Labels are pinned in
   * data/focus-signature-metrics.ts; the LLM fills value + tone. Empty array
   * when the focus has no spec or the model omitted them — the card then
   * shows no instrument strip and falls back to the coaching pair.
   */
  focusMetrics: FocusMetric[];
  /** HR-round logistics & motivation block — only present when meta.type === "hr-round". */
  hrReport?: {
    motivationBefore: string;
    motivationAfter: string;
    noticeDays: number | null;
    noticeFlexibility: "buyout-possible" | "strict" | "not-stated";
    compExpected: string | null;
    counterOfferRisk: "low" | "med" | "high" | "not-assessed";
    bgvGaps: string[];
    companyNorms: HrCompanyNorms | null;
  };
  model: string;
}

/* Pure helpers (applyBands, resolveCompanyProfile, computeCoreMetrics,
 * computeAdvancedDelivery, filterGroundedItems, filterGroundedRedFlags,
 * validateReportShape, computeBlendedOverall, and post-LLM normalizers)
 * extracted to ./_evaluate-session-helpers for unit testing. */

export default async function handler(req: Request): Promise<Response> {
  const t0 = Date.now();

  if (!GROQ_KEY && !GEMINI_KEY) {
    return new Response(JSON.stringify({ error: "LLM not configured" }), {
      status: 503,
      headers: withRequestId(corsHeaders(req)),
    });
  }

  const pre = await withAuthAndRateLimit(req, {
    endpoint: "evaluate-session",
    ipLimit: 10,
    userLimit: 5,
    checkQuota: true,
  });
  if (pre instanceof Response) return pre;
  const { headers, auth } = pre;

  try {
    const body = (await req.json()) as Partial<EvaluateRequest>;
    const { sessionId, transcript, meta } = body;

    if (!sessionId || typeof sessionId !== "string") {
      return new Response(JSON.stringify({ error: "sessionId required" }), { status: 400, headers });
    }
    if (!Array.isArray(transcript) || transcript.length === 0) {
      return new Response(JSON.stringify({ error: "transcript required" }), { status: 400, headers });
    }
    // Dead-session guard: transcript exists but the candidate never answered
    // (mic permission denied, STT failed, or page was closed before replying).
    // Running the LLM evaluation on interviewer-only transcripts produces a
    // misleading score around 30 with fabricated critique. Return a typed error
    // instead so the client can show a "mic not working" message.
    const candidateTurns = transcript.filter((t) => t.role === "candidate" && t.text?.trim().length > 0);
    const candidateTotalChars = candidateTurns.reduce((sum, t) => sum + (t.text?.trim().length ?? 0), 0);
    if (candidateTurns.length === 0 || candidateTotalChars < 20) {
      return new Response(JSON.stringify({
        error: "no_candidate_answers",
        message: "No answers were recorded. Check your microphone or switch to text mode and try again.",
      }), { status: 422, headers });
    }
    if (transcript.length > 200) {
      return new Response(JSON.stringify({ error: "transcript too long" }), { status: 413, headers });
    }

    // Try cache first — report is deterministic for (sessionId, REPORT_VERSION).
    // Saves ~8-12s of LLM latency and ~2500 tokens per re-open of the same report.
    if (auth.userId) {
      const tCache0 = Date.now();
      const cached = await loadCachedReport(sessionId, auth.userId, {
        targetCompany: meta?.targetCompany,
        role: meta?.role,
        difficulty: meta?.difficulty,
      });
      const tCache = Date.now() - tCache0;
      if (cached) {
        const totalMs = Date.now() - t0;
        console.warn(`[evaluate-session] CACHE HIT session=${sessionId.slice(0, 8)} lookup=${tCache}ms total=${totalMs}ms`);
        headers["X-Timing"] = `cacheLookup=${tCache},total=${totalMs},cached=1`;
        /* Sanitize on read too: reports cached before the register fix shipped
           still hold "delve"/"seamless"/etc. Cleaning here scrubs them on
           re-open without a migration. */
        const cleanCached = sanitizeVoiceValue(cached);
        return new Response(JSON.stringify({ report: cleanCached, cached: true }), { status: 200, headers });
      }
    }

    const roleFamily = (meta?.roleFamily as keyof typeof ROLE_SKILLS) || "behavioral";
    /* Focus type wins over role family — an HR round or a salary negotiation is
       graded on what the interviewer actually evaluated, not the candidate's
       role-family proxies (#99). See resolveSkillAxes in the helpers. */
    const skillAxes = resolveSkillAxes(meta?.type, roleFamily, meta?.focus);
    const durationSec = meta?.duration || 600;
    const coreMetrics = computeCoreMetrics(transcript, durationSec);
    const advancedDelivery = computeAdvancedDelivery(transcript, durationSec);

    // Resolve company calibration profile (falls back to default bands/weights).
    const companyProfile = resolveCompanyProfile(meta?.targetCompany);
    const bands = companyProfile?.bands ?? DEFAULT_BANDS;
    // Sector-aware label/note so Indian employers (TCS, Razorpay, HDFC, …) —
    // which aren't in the US-big-tech COMPANY_BANDS map — show the company the
    // user set plus the sector calibration actually applied, instead of a
    // misleading "Generic — set a target company" when one IS set.
    const calibrationSector =
      meta?.type === "hr-round" ? resolveHrSectorOverlay(meta?.targetCompany) : "none";
    // Sector-grounded India HR norms (notice/BGV/comp/dual-employment). Resolved
    // deterministically from the company — fed to the prompt as grounding AND
    // attached to the report so the render cites real sector facts instead of
    // one generic paragraph. null when no company / unknown sector.
    const hrNorms: HrCompanyNorms | null =
      meta?.type === "hr-round" ? resolveHrCompanyNorms(meta?.targetCompany) : null;
    const { companyLabel, companyNote } = resolveCalibrationLabel(
      meta?.targetCompany,
      companyProfile,
      calibrationSector,
    );

    // Cross-session memory: fetch the user's last 3 reports (structured
    // coaching signal only — no transcripts) so the LLM can call out
    // improvements, regressions, and persistent issues.
    const priorReports = auth.userId ? await loadPriorReports(sessionId, auth.userId, meta?.focus) : [];

    // Build transcript block — keep all turn indices intact (perQuestion[].idx
    // references them) but vary the per-turn char cap by position. The arc is
    // dominated by the opening turns (rapport / framing) and the closing turns
    // (final answers / wrap-up); long-winded middle turns can be safely
    // compressed without losing scoring signal. For a 20-turn interview every
    // turn is "edge" and gets the full cap; only longer sessions benefit.
    const TRANSCRIPT_EDGE_CAP = 1500;
    const TRANSCRIPT_MIDDLE_CAP = 400;
    const KEEP_FIRST = 6;
    const KEEP_LAST = 10;
    const transcriptBlock = transcript
      .map((t, i) => {
        const isEdge = i < KEEP_FIRST || i >= transcript.length - KEEP_LAST;
        const cap = isEdge ? TRANSCRIPT_EDGE_CAP : TRANSCRIPT_MIDDLE_CAP;
        return `[${i}] ${t.role === "interviewer" ? "INTERVIEWER" : "CANDIDATE"}: ${sanitizeForLLM(t.text, cap)}`;
      })
      .join("\n");

    // Compact prior-sessions block for the prompt. Omitted entirely if no history.
    const priorContextBlock = priorReports.length > 0
      ? `\nPRIOR SESSIONS (most recent first, for longitudinal coaching context):\n` +
        priorReports
          .map((p, i) =>
            `[${i + 1}] ${p.daysAgo}d ago · score ${p.overallScore}/100 (${p.band})\n` +
            `    pace: ${p.coreMetrics.paceWpm} wpm · fillers: ${p.coreMetrics.fillerPerMin}/min\n` +
            `    weakest skills: ${p.weakestSkills.map((s) => `${s.name} ${s.score}`).join(", ") || "—"}\n` +
            `    top fixes they were told: ${p.topFixes.map((f) => `"${f.slice(0, 90)}"`).join(" | ") || "—"}`,
          )
          .join("\n")
      : "";

    const tierSuffix = tierPromptSuffix(classifyCompanyTier(meta?.targetCompany));
    // Static prompt fragments live in _evaluate-session-prompts.ts so they
    // can be unit-tested for coverage and stay in the cacheable prefix.
    const groundingDirective = GROUNDING_DIRECTIVE;
    const fairnessDirective = FAIRNESS_DIRECTIVE;
    const lengthTargetsDirective = LENGTH_TARGETS_DIRECTIVE;
    const selfCheckDirective = SELF_CHECK_DIRECTIVE;
    const rubricWeight = getRubricWeight(meta?.type);
    /* Per-focus structured scoring rubric — see
       data/focus-question-recipes.ts. Each focus declares 4-5 weighted
       dimensions (e.g. case-study scores MECE 30% / quantification 25%
       / adaptability 20% / recommendation 15% / communication 10%).
       The eval LLM uses these as the scoring spine, so a strong
       case-study answer can no longer get a high overall score on
       behavioural-style "STAR completeness" alone. */
    let focusRubric = meta?.type ? formatScoringRubric(meta.type) : "";
    /* HR-round per-axis weights resolved from the sector/seniority overlay.
       Captured here so the SAME weights that shape the LLM prompt also weight
       the displayed composite score (see computeBlendedOverall below) — without
       this, the overlay was prompt-only decoration and every axis scored 1.0. */
    let hrSkillWeights: Record<string, number> = {};
    if (meta?.type === "hr-round") {
      const base = RECIPES["hr-round"];
      if (base?.scoringRubric) {
        const { recipe, context } = resolveHrRoundRecipe(base, {
          company: meta.targetCompany,
          expLevel: meta.level,
        });
        if (recipe.scoringRubric) {
          hrSkillWeights = deriveSkillWeightsFromRubric(recipe.scoringRubric);
          focusRubric = formatScoringRubric("hr-round", {
            dimensions: recipe.scoringRubric,
            sector: context.sector,
            seniority: context.seniority,
          });
        }
      }
    }
    /* Per-focus signature-metric instructions — the three numbers that
       define quality in this focus (see data/focus-signature-metrics.ts).
       Labels are pinned in code; the model fills value + tone. Lands in the
       dynamic section after the rubric so it doesn't break prompt caching. */
    const signatureMetricsPrompt = formatSignatureMetricsPrompt(meta?.focus || meta?.type);
    const perQuestionMetricsPrompt = formatPerQuestionMetricsPrompt(meta?.focus || meta?.type);
    /* Sector-grounded HR norms for the prompt. Dynamic (per-company) so it lands
       after the static blocks — keeps prompt caching intact. Gives the LLM real
       sector facts so its motivationAfter / bgvGaps guidance is company-true and
       doesn't contradict what the report will render deterministically. */
    const hrNormsPrompt = hrNorms
      ? `\n\nCOMPANY HR NORMS (${hrNorms.sectorLabel} — ground your notice/BGV/comp guidance in these; do NOT contradict them):
- Typical notice period: ${hrNorms.noticeNorm}. ${hrNorms.buyoutNote}
- BGV usually pulls: ${hrNorms.bgvDocs.join(", ")} (vendors: ${hrNorms.bgvFirms.join(", ")}).
- Comp reality: ${hrNorms.compNote}
- Dual employment: ${hrNorms.dualEmploymentNote}`
      : "";
    /* Salary-negotiation offer-facts + observed-tactics grounding (I-6 / I-9A).
       Extracted deterministically from THIS transcript, so it's dynamic and must
       land AFTER the static rules to preserve Groq's prefix cache. Surfaces only
       comp facts/tactics actually present — the trailing RULE forbids the model
       inventing comp structure or crediting unused tactics. Empty for non-neg. */
    const negotiationOfferFactsBlock =
      meta?.type === "salary-negotiation" ? buildNegotiationOfferFactsBlock(transcript) : "";
    /* Campus-placement calibration block — injected only for campus focus so
       the evaluator uses fresher-appropriate rubrics and exemplars. Placed here
       (dynamic section) so it doesn't break the prefix cache on other focus types. */
    const campusCalibrationBlock = meta?.focus === "campus-placement"
      ? `\n\nCAMPUS PLACEMENT / FRESHER CALIBRATION (MANDATORY — overrides any senior-hire defaults):
This interview is a CAMPUS PLACEMENT practice session for a student or fresh graduate. Apply every rule below without exception:

SCORING BAR: Calibrate to campus/fresher bar — NOT senior-hire. A score of 70 here means "strong fresher, likely to receive an offer". Academic projects, internship experience, and student club leadership are valid evidence. The ABSENCE of production experience is EXPECTED and must NEVER be penalised.

RUBRIC AXES: Replace "senior bar" references. The campus rubric is: (1) clear STAR structure, (2) personal ownership within a team context, (3) basic quantification ("improved test coverage by 30%", "led a team of 4"), (4) company/role-specific research awareness.

EXEMPLARS — CRITICAL RULES:
- Every topPerformerAnswer.text MUST be campus-appropriate. Use: final-year project, hackathon, internship, academic achievement, or student club leadership.
- NEVER write production SDE stories (incident response, on-call rotation, checkout error rates, production traffic numbers). A fresher would be caught fabricating these.
- VARY exemplars across all questions — each topPerformerAnswer.text must tell a DIFFERENT story/situation. Do not reuse the same project or incident across multiple questions.
- For intro/"tell me about yourself" questions: exemplar opens with degree, college, strongest project or internship, then pivots to why this company/role.

COACHING TONE: Coach within fresher context. Say "tie your final-year project to the business outcome more clearly" — not "reference your previous role's production impact". If CGPA is ≥7.5, coach the candidate to mention it proactively.

BGV / BACKGROUND-VERIFICATION FLAGS: Do NOT fire "company mentioned in interview isn't on resume" flags for campus/fresher sessions. Freshers mentioning internship companies, practice examples, or aspirational companies in answers is EXPECTED — it is not a BGV gap. Set bgvGaps to [] (empty array) for all campus placement sessions.`
      : "";
    // Prompt order is intentional: every static block (opener, directives,
    // CRITICAL RULES) is emitted before any per-call variable content. This
    // lets Groq's automatic prompt caching (which keys on the longest shared
    // prefix) reuse the bulk of the prompt across calls — same prompt body
    // billed at ~10% on subsequent hits. Per-call dynamic content (tier,
    // rubric, transcript, prior reports) lands after the cacheable prefix.
    const prompt = `You are a senior I/O-psychology-trained interview scorer. Produce a JSON report for this mock interview, calibrated to structured-interview rubrics (SHL UCF, STAR+L). Be honest and specific.

${groundingDirective}

${fairnessDirective}

${lengthTargetsDirective}

${selfCheckDirective}

CRITICAL RULES:
- VOICE & DICTION (applies to ALL prose fields, especially topPerformerAnswer.text and restructured.text): write the way a real candidate SPEAKS in an interview, not the way an LLM writes. Default to ordinary words, contractions, and short clauses.
  Banned LLM-isms (use the plain alternative):
    leverage → use; utilize → use; facilitate → help; demonstrate → show; ensure → make sure;
    delve / delve into / delving → look at, go through, get into;
    deep-dive / dive deep → look at, walk through; navigate → handle, deal with;
    drive impact / drive results / drive value — replace with a concrete verb (ship, hit, raise, cut);
    stakeholder alignment / cross-functional alignment → working with X and Y; getting X and Y on the same page;
    seamless / robust / scalable / world-class / best-in-class — drop them unless the candidate actually used the word;
    ideate / ideation → think up, brainstorm; circle back → follow up;
    additionally / furthermore / moreover → and, also, plus.
  Also banned: "Importantly," / "Notably," / "It's worth noting" sentence-openers; bureaucratic hedges like "in terms of" / "with respect to" / "as it relates to".
  Aim for: contractions ("I'd", "we're", "didn't"), specific verbs, the kind of phrasing a real senior would say to a hiring manager. A top-performer answer should sound like a sharp engineer/PM telling a story, NOT like a press release. If a sentence reads like it was generated, rewrite it.
- Pair each interviewer question with the candidate answer that follows it. Skip pairs where the candidate didn't answer (use verdict="skipped", restructured=null, topPerformerAnswer=null).
- GREETING/RAPPORT EXCLUSION: Do NOT create a perQuestion[] item for non-substantive conversational plumbing that carries no gradeable question — pure greetings and session-start beats ("Hi, thanks for joining", "Can you hear me okay?", "Shall we begin?", "Ready to start?", "Let's get started"), and the candidate's bare confirmation replies to them ("Yes, let's begin", "Sure", "I'm ready", "Yes I can hear you"). These are not interview questions; scoring them inflates the question count with meaningless 70-90 scores and misleads the candidate about what was actually evaluated. Score ONLY turns where the interviewer asks a substantive question (motivation, compensation, logistics/notice, self-awareness, culture/values, a behavioural or technical probe, etc.). The substantive opener — "Tell me about yourself" / "walk me through your background" — IS gradeable and MUST be scored; a bare "shall we begin" greeting is NOT.
- HARD RULE: if the candidate answer starts with the literal token "[SKIPPED" (case-sensitive), the candidate explicitly skipped that question. Force verdict="skipped", score=0, restructured=null. STILL emit a topPerformerAnswer (this is a coaching opportunity — show what a strong candidate would have said). Set explanation to a one-line note acknowledging the skip without judgment.
- TOO-SHORT-TO-EVALUATE RULE: if the candidate's answer is under 25 words, do NOT invent reasons it scored low ("not in English", "incomprehensible", "off-topic"). The answer is just short. Use verdict="weak", score in the 30-45 range, and explanation="Answer was too brief to evaluate fully — most weak-band scoring drivers (vagueness, no Action, no Result) can't be judged in 12 words. The top-performer example shows the structure to aim for next time." Be honest about the limits of evaluation; don't fabricate coherent-sounding critique from a fragment.
- LANGUAGE RULE: ONLY mark the answer as language-mismatched if it is GENUINELY in a non-English language (Hindi, regional, etc.). Twelve English words is NOT "not in English"; that's just a short English answer. Misclassifying short English answers as non-English destroys candidate trust in the report.
- INDIAN CONVERSATIONAL REGISTER — non-penalty signals. The candidate audience is primarily Indian. The following markers ARE legitimate behavioural signal in Indian English; do NOT score them as weakness, deflection, or filler in skill scores, flags, or per-question explanations:
    * "we / our team" pronoun usage in narration is cultural humility, NOT lack of ownership. Coach for personal contribution ("what was your specific slice?"); do NOT flag as low ownership.
    * Hedged disagreement ("with respect, I'd push back" / "may I gently challenge") is conviction in Indian register, NOT weak conviction.
    * "Sir" / "Ma'am" addressed to the interviewer is professional courtesy, NOT sycophancy.
    * Indirect failure framing ("there were some challenges with the timeline" / "the rollout had some issues") is the Indian register for ownership; treat the same way you'd treat "I missed the deadline" in American English.
    * Relational outcome markers ("kept the team aligned" / "preserved trust with stakeholders" / "brought everyone along") are legitimate Result content, NOT soft-skill filler. Count them toward STAR-R.
    * Festival / fiscal anchors (Diwali, BBD, Big Billion Days, Navratri, Eid, EOSS, quarter-end, FY close, March closing) are real operational context, NOT anecdotal padding. They strengthen Situation framing. When the candidate's Situation is anchored on a festival or quarter-end trade-off (festival-rush vs release, Diwali leave vs go-live, quarter-end revenue push vs team welfare), evaluate the answer on FOUR specific axes — these are the dimensions an Indian hiring manager actually weighs in this scenario family:
       (i) Team morale / leave fairness — did the candidate name how they protected team welfare or distributed the cost?
       (ii) Client / customer-trust impact — did they own the commitment vs renegotiate it transparently?
       (iii) Fairness across team members — was the load distributed or did one or two people shoulder it all?
       (iv) Personal credibility / promise-keeping — did the candidate honour what they themselves committed to upstream?
       Score the answer strong only when at least 3 of 4 axes are addressed. A pure "we worked through the weekend" answer that misses (i) (iii) (iv) is a WEAK festival-trade-off answer, even if outcomes look good.
    * Deferential gratitude ("thank you so much for this opportunity, sir" / "I really appreciate you taking the time" / "it's a privilege to speak with you") is Indian-context professional courtesy, NOT a low-confidence marker. Do NOT score "openings with thanks" as weak. Coach on substance, not on whether they thanked the interviewer.
    * Pedigree recital (10th/12th board percentages, CGPA, "I scored 92% in 12th") is a standard ritual in Indian services interviews (TCS, Infosys, Wipro, Cognizant, Accenture, Capgemini). Do NOT flag as padding, irrelevance, or insecurity — even for experienced lateral candidates, it's culturally expected in the academic-background opener. Score neutrally; coach toward weaving impact stories around it rather than away from it.
    * Career-ladder narrative ("joined X for fundamentals, moved to Y for speed, now want scale at Z") across 2-3 short stints is a legitimate Indian stability narrative — deliberate skill acquisition, NOT job-hopping. Do NOT flag as instability or commitment risk. If the candidate names the sequencing logic ("X gave me, Y gave me, now I want"), score as a coherent why-this-role answer; coach for the next-stint commitment (what would make them stay) rather than re-litigating the past moves.
- MEMORISED-STAR-IS-REWARDED RULE (cultural inversion vs Western rubric): Indian interview culture POSITIVELY values structured, clearly-rehearsed STAR delivery — clean S→T→A→R beats, visible preparation, and rote-clean transitions are signs of seriousness, not "canned-ness". Western coaching frameworks (Amazon LP, McKinsey PEI) penalise "sounds rehearsed"; that inheritance is WRONG for this audience. Do NOT:
    * deduct for "answer felt rehearsed" / "delivery sounded scripted" / "lacked spontaneity"
    * recommend "sound more conversational" or "make it feel less prepared"
    * flag clean STAR structure as a weakness in flags[] or per-question explanations
  DO instead: when the structure is clean but the content is thin, probe for personal slice, decision moments, and the trade-off they wrestled with — that's where real evaluation happens for Indian candidates. Polish + depth = strong; polish minus depth = weak, but the weakness is the missing depth, NOT the polish.
- Every skill score must be justified by transcript evidence.
- Restructured answer MUST NOT invent numbers, company names, or outcomes not present in the candidate's words. If quantification is missing, frame it as a gap ("you could add the exact % here") rather than making one up.
- TopPerformerAnswer IS allowed to invent realistic GENERIC details — that's its purpose. The structure depends on the QUESTION TYPE: STAR for behavioral, trade-offs for technical, framework + reasoning for case-study, and FORMAT-MATCHED for salary-negotiation / HR / logistics (number + reasons for salary expectations, concrete duration for notice period, etc. — NOT STAR). Across all types: quantified where the question warrants it, first-person ownership, role-appropriate scope. Aim for what a strong L5/Senior would say at the target company.
- NO FABRICATED COMPANY FACTS IN EXEMPLARS: "realistic details" means plausible GENERIC specifics (a metric, a team size, a timeline) — NOT verifiable, named facts about the target company that the candidate would be caught repeating. Do NOT invent internal project/initiative names ("Project Lighthouse"), product launches, executive names, org structures, or strategy specifics for the target company. Refer to the company's known strengths only in general terms a candidate could safely say ("HDFC's scale in retail banking", "the compliance rigor of a regulated bank") — never a specific named program you cannot verify. A model answer that puts a fake company fact in the candidate's mouth is worse than a generic one.
- TOPIC LOCK: Re-read the question before composing the exemplar. The exemplar must answer THIS question — not a different topic that came up earlier in the session. If question 5 asks about notice period, the exemplar discusses notice period (e.g. "I'm on a 60-day notice. I can probably negotiate down to 30 if there's a buyout, otherwise I'd plan for end of [month]"). It does NOT discuss salary expectations, strengths, or why-this-company. Wrong-topic exemplars destroy candidate trust in the report.
- NON-HALLUCINATION ON CANDIDATE PROFILE: You MUST NOT reference any candidate-profile signal that is false in the provided state. If a signal is false, do not mention the underlying topic in your critique. Do not assert, do not claim, do not mention if not present — do not infer or imagine candidate context (career gap, layoff, pregnancy, disability, caste, mental health, PIP, equity sophistication, hot-domain premium, etc.) unless the transcript itself contains the disclosure. Hallucinating sensitive context in the report is the canonical worst-case failure here and it is grounds for the report being rejected.
- BEHAVIOURAL-OPENER RULE (applies only when interview type = "behavioral"): The FIRST interviewer turn is NOT throat-clearing — it is the Tell-Me-About-Yourself / rapport-hook beat and MUST be included in perQuestion[] as a "warmup" difficulty item. Real Indian HR opens with this and grades it: structure (Present → Past → Future arc), brevity (60-120 words ideal), narrative coherence, and whether the candidate connects their background to the target role/company. Treat the candidate's reply to that first interviewer turn as their TMAY answer and score it. If the opener references a specific resume project ("I saw on your resume you worked on X — walk me through that"), grade whether the candidate actually walked you through that project (vs. dodging into a generic intro). Skipping the opener from perQuestion[] is a graded miss — real HRs always score TMAY.

BEHAVIOURAL-PROBE-BANK RULE (only for behavioural interviews):
When you populate the \`likelyFollowUp.question\` field, prefer one of the canonical real-interviewer probes from this list verbatim unless the candidate's specific answer demands a more contextual variant. The list: ${PROBE_TEXTS.map(p => `"${p}"`).join(", ")}.
Picking from this menu makes the follow-up suggestion feel like what an Indian product-co interviewer would actually say next.

BEHAVIOURAL-COMPETENCY-COVERAGE RULE (only for behavioural interviews):
When you populate the \`blindSpots\` field, draw labels ONLY from this fixed competency taxonomy: ${BEHAVIORAL_COMPETENCIES.map(c => `"${COMPETENCY_LABELS[c]}"`).join(", ")}.
This keeps the report's coverage signal deterministic across sessions and makes blindSpots actionable for spaced-repetition scheduling.
- Difficulty classification (for the target role/level, not absolute):
    * warmup  = common opener with expected structure (e.g. "Tell me about yourself", "Why this company?")
    * standard = core loop question probing a single competency (most behavioral + mid-complexity system design)
    * hard    = bar-raiser / scope-stretch / senior-level probe (multi-part system design, unusual ethical dilemmas, scope >$10M impact expected)
- frequencyPct is your best estimate of how common this question (or a near variant) is across the target company's loops for this role. "Tell me about yourself" ≈ 95. "Design a distributed rate limiter" ≈ 40 for SWE. Set null if uncertain.
- frequencyNote is one short phrase contextualizing the question — help the candidate understand whether to deeply prep this pattern or treat it as a one-off.
- Citations must reference real character offsets inside answerText.
- Keep verdict scores honest. Average mock interview scores 45-65.
- For crossSessionInsights: if no PRIOR SESSIONS block is provided, return an empty array — do NOT fabricate history. If prior data IS provided, prefer persistent/regression callouts over improvements (users need correction more than praise).
- likelyFollowUp must be specific to the candidate's actual answer, not generic. If they made a vague claim ("we improved performance"), the follow-up should probe scope ("by how much? on what metric?").
- lengthVerdict.wordCount must be the actual word count of answerText. Target range depends on question type: behavioral 120-240, system design 180-360, opener 60-120, deep-dive probe 150-300.
- storyReuseFindings only fires when the SAME underlying project/situation is used for DIFFERENT competencies (e.g. once for leadership, again for trade-offs). Two behavioral answers from different projects is fine; same project across two is a flag.
- scoreConfidence should reflect transcript quality and answer clarity. Short interviews (<3 turns), garbled transcripts, or highly ambiguous answers warrant <0.7.
- Return ONLY valid JSON — no markdown wrapping, no prose.

CONTEXT:
Role: ${sanitizeForLLM(meta?.role || "general", 80)}
Role family: ${roleFamily}
Company: ${sanitizeForLLM(meta?.targetCompany || "none", 80)}
Level: ${sanitizeForLLM(meta?.level || "mid", 40)}
Difficulty: ${meta?.difficulty || "standard"}
Duration (s): ${durationSec}${
      // Voice continuity: when the engine passes who ran the live session,
      // pin topPerformerAnswer/restructured prose to the same voice the
      // candidate just heard. Without this, the live coach sounds warm
      // and the post-session report sounds like a different LLM persona.
      (meta?.interviewerName?.trim() || meta?.interviewerPersonality?.trim())
        ? `\nLive interviewer: ${sanitizeForLLM(meta?.interviewerName || "Coach", 60)}${meta?.interviewerPersonality ? ` (${sanitizeForLLM(meta.interviewerPersonality, 60)})` : ""} — model exemplar/restructured prose to match this voice.`
        : ""
    }${(() => {
      /* Resume-grounded evaluation context. When the engine passes the
         candidate's actual resume facts, the evaluator can:
           1. Flag missed opportunities — strong project on the CV that
              the candidate never surfaced during the interview.
           2. Validate experience claims against the resume.
           3. Anchor topPerformerAnswer exemplars in the candidate's
              real background so the model answer feels like THEIR
              best version, not a generic ideal.
         Behavioural focus benefits most; other focuses get the same
         block but use it lightly. Skipped entirely when no resume. */
      const rc = meta?.resumeContext;
      if (!rc) return "";
      const skills = Array.isArray(rc.topSkills) ? rc.topSkills.slice(0, 8).map(s => sanitizeForLLM(String(s || ""), 50)).filter(Boolean) : [];
      const projects = Array.isArray(rc.topProjects) ? rc.topProjects.slice(0, 5).map(p => sanitizeForLLM(String(p || ""), 140)).filter(Boolean) : [];
      const headline = rc.headline ? sanitizeForLLM(String(rc.headline), 120) : "";
      const trajectory = rc.careerTrajectory ? sanitizeForLLM(String(rc.careerTrajectory), 200) : "";
      const achievements = Array.isArray(rc.keyAchievements)
        ? rc.keyAchievements.slice(0, 4).map(a => sanitizeForLLM(String(a || ""), 140)).filter(Boolean) : [];
      const industries = Array.isArray(rc.industries)
        ? rc.industries.slice(0, 3).map(i => sanitizeForLLM(String(i || ""), 60)).filter(Boolean) : [];
      const companies = Array.isArray(rc.companiesOnResume)
        ? rc.companiesOnResume.slice(0, 8).map(c => sanitizeForLLM(String(c || ""), 80)).filter(Boolean) : [];
      const lines: string[] = [];
      if (headline) lines.push(`Headline: ${headline}`);
      if (trajectory) lines.push(`Trajectory: ${trajectory}`);
      if (skills.length) lines.push(`Top skills: ${skills.join(", ")}`);
      if (projects.length) lines.push(`Notable projects: ${projects.join(" | ")}`);
      if (achievements.length) lines.push(`Key achievements on CV (flag if candidate never referenced these): ${achievements.map(a => `"${a}"`).join("; ")}`);
      if (industries.length) lines.push(`Industry background: ${industries.join(", ")} — anchor exemplars in these domains`);
      if (companies.length) lines.push(`Verified employers (flag credibility risk if candidate claims a company not on this list): ${companies.join(", ")}`);
      if (!lines.length) return "";
      return `\n\nCANDIDATE RESUME CONTEXT (use to flag missed-opportunity moments and ground exemplars in their real background — DO NOT fabricate experience beyond what's listed here):\n${lines.join("\n")}`;
    })()}

TRANSCRIPT (numbered turns):
"""
${transcriptBlock}
"""
${priorContextBlock}${tierSuffix ? `\n\n${tierSuffix}` : ""}${rubricWeight ? `\n\nRUBRIC WEIGHTS FOR THIS INTERVIEW TYPE:\n${rubricWeight}` : ""}${focusRubric}${signatureMetricsPrompt}${perQuestionMetricsPrompt}${hrNormsPrompt}${negotiationOfferFactsBlock}${campusCalibrationBlock}

RUBRIC — score each skill 0-100:
${skillAxes.map((s) => `- ${s}`).join("\n")}
In the "skills" array, return ALL of the axes above, one entry each, using each axis name EXACTLY as written (do not abbreviate, paraphrase, reorder-rename, or merge axes). The downstream score weighting keys on these exact names.

Return a JSON object with EXACTLY this shape:
{
  "overallScore": <0-100 integer, role-weighted composite of skills>,
  "verdict": "<one sentence, ≤140 chars, second-person, specific, honest>",
  "wins": [
    // 1-3 items. Concrete things the candidate did well. Each "quote" MUST be a verbatim
    // substring of one of their own answers. "text" is a short declarative sentence.
    { "text": "...", "questionIdx": <perQuestion idx>, "quote": "..." }
  ],
  "fixes": [
    // 1-3 items. Imperative phrasing ("Quantify the result with a % or $"). Each "quote"
    // MUST be a verbatim substring of one of the candidate's answers. If the fix applies
    // cross-question (e.g. pace), set questionIdx=-1 and quote="".
    { "text": "...", "questionIdx": <perQuestion idx or -1>, "quote": "..." }
  ],
  "redFlags": [
    // 0-4 items. Rejection-grade signals that typically sink a real-loop interview.
    // Only include items that are honestly present; empty array is fine.
    // type MUST be one of: blame, missing_result, we_without_i, scope_drift, contradiction, vague
    // - "blame": blaming teammates/managers/leadership for failures ("they didn't ...", "management wouldn't ...")
    // - "missing_result": behavioral answer with no measurable/quantified outcome
    // - "we_without_i": accomplishment stated in collective "we" without the candidate's specific contribution
    // - "scope_drift": answer wanders away from what was asked
    // - "contradiction": contradicts a prior answer in the same interview
    // - "vague": hand-wavy technical/strategic answer with no concrete specifics
    // severity MUST be one of: high (likely rejection), medium (strong concern), low (nitpick)
    // "quote" MUST be a verbatim substring of the candidate's words; cross-cutting flags
    // may use questionIdx=-1 with quote="".
    { "type": "<enum>", "severity": "<enum>", "title": "<≤40 chars>", "explanation": "<one sentence>", "questionIdx": <idx or -1>, "quote": "..." }
  ],
  "skills": [${skillAxes.map((s) => `{"name":"${s}","score":<0-100>}`).join(",")}],
  "thoughtBubble": [
    // 3-8 segments covering the whole interview in order. Each segment
    // describes what the interviewer is likely thinking during that stretch.
    // state MUST be one of: tracking, losingThread, probingForScope, readyToMoveOn, impressed, concerned
    // startMs/endMs are in milliseconds; if timestamps aren't known, use 0 and estimate based on turn indices.
    // note is a single short sentence in second person (≤80 chars), honest.
    { "startMs": <int>, "endMs": <int>, "state": "<enum>", "note": "<sentence>" }
  ],
  "perQuestion": [
    {
      "idx": <question turn index from transcript>,
      "question": "<full interviewer question text>",
      "answerText": "<candidate's verbatim answer>",
      "verdict": "<strong|complete|partial|weak|skipped>",
      "score": <0-100>,
      "starPresence": {"S": <bool>, "T": <bool>, "A": <bool>, "R": <bool>, "L": <bool>},
      "difficulty": "<warmup|standard|hard>",
      "frequencyPct": <0-100 integer estimate OR null if you can't estimate>,
      "frequencyNote": "<≤60 chars, e.g. 'common opener at FAANG', 'bar-raiser variant', 'role-specific probe'>",
      "restructured": {
        "text": "<rewrite the candidate's answer in STAR form, using ONLY facts from their own words; 80-160 words>",
        "citations": [{"markerIdx": <1-based marker>, "sourceStart": <char offset in answerText>, "sourceEnd": <char offset>}]
      },
      "topPerformerAnswer": {
        "text": "<a synthesized 90/100 answer to THIS EXACT QUESTION (read the question text again before writing — your exemplar must answer the SAME question, not a different one you remember from earlier in the session). Calibrated to the target role and company. You MAY invent realistic company names, metrics, and outcomes — the purpose is to show what excellence looks like. STRICT length: 80-130 words MAX (60-100 for short logistics questions like notice period). Real interview answers are conversational, not press releases. Choose structure based on the QUESTION TYPE: (a) BEHAVIORAL / 'tell me about a time' → STAR. (b) TECHNICAL / SYSTEM-DESIGN → trade-off articulation, depth tree. (c) CASE-STUDY → framework + structured reasoning. (d) SALARY-NEGOTIATION QUESTIONS — DO NOT use STAR; instead match the question's actual ask: salary expectations → number + 2-3 reasons (market data, current package, target progression); notice-period → concrete duration + flexibility note + buyout reference if relevant; counter-offer responses → mirror, anchor, lever; 'why this company' → 2-3 specific reasons grounded in research. (e) HR / WHY-COMPANY / WHY-LEAVE → motivation + specific company knowledge + future-fit. NEVER open with 'My background in X has given me…' or 'I'm particularly drawn to…' — LLM-resume openers, not how candidates speak. ANSWER THE QUESTION ASKED: if the interviewer asked about notice period, the exemplar must talk about notice period — not salary, not strengths, not why-this-company.>",
        "whatMakesItStrong": ["<reason 1, e.g. 'Leads with scope: 4M users affected'>", "<reason 2>", "<reason 3>"]
      },
      "likelyFollowUp": {
        "question": "<the next question a real interviewer would likely ask based on THIS candidate's answer to THIS question — specific, probing, one sentence>",
        "why": "<one sentence on what the interviewer is trying to learn by asking that follow-up>"
      },
      "lengthVerdict": {
        "verdict": "<too-brief|right|too-long>",
        "wordCount": <integer word count of the candidate's answer>,
        "targetRange": "<expected range for this type of question, e.g. '120-240 words' for behavioral or '180-360' for system design>",
        "note": "<one line coaching, second-person>"
      },
      "explanation": "<1-2 sentences on what worked/missed>"${perQuestionMetricsPrompt ? `,
      "focusMetrics": [
        // Per-question focus tiles — see PER-QUESTION FOCUS METRICS section above.
        // Exactly the labels listed there, in order. Short value string + tone.
        { "label": "...", "value": "...", "tone": "good|watch|miss|neutral" }
      ]` : ""}
    }
  ],
  "scoreConfidence": <0.0-1.0 — YOUR self-reported confidence in the overall score. Lower if transcript is short/noisy or if the candidate's intent was ambiguous. 0.8 is typical; 0.95 means very confident; 0.55 means treat score as indicative only.>,
  "storyReuseFindings": [
    // 0-3 items. Flag cases where the candidate used ONE story/project across
    // MULTIPLE questions that test DIFFERENT competencies. Real interviews
    // penalize this — it reads as a thin portfolio. Identify the story by a
    // short label and list the perQuestion indices where it reappeared.
    // Leave empty if no reuse detected.
    { "storyLabel": "<short label, e.g. 'Catalyst IQ launch'>", "questionIndices": [<int>, <int>], "concern": "<one sentence>" }
  ],
  "blindSpots": [
    // 2-5 competencies that are COMMONLY tested for the target role/company
    // but were NOT assessed in this session. Prevents overfitting to seen Qs.
    // frequencyPct is % of loops that test this at the target company (null if uncertain).
    { "competency": "<short, e.g. 'Conflict resolution'>", "frequencyPct": <0-100 or null>, "note": "<one line on how to prep for it>" }
  ],
  "readiness": {
    // Estimate practice volume to reach a target band. Use prior session
    // trajectory if available; otherwise give a first-timer estimate.
    // targetBand should be the next-higher band above the candidate's current one
    // (leanHire → hire; hire → strongHire; strongHire → strongHire as a stretch goal).
    // Be honest: 20-80 hours is typical; don't underestimate to flatter.
    "targetBand": "<strongHire|hire|leanHire>",
    "estimatedHours": <integer>,
    "estimatedSessions": <integer>,
    "confidence": "<low|medium|high>",
    "rationale": "<one sentence>"
  },
  "resumeGrounding": ${meta?.resumeContext ? `{
    // ONLY include this object when CANDIDATE RESUME CONTEXT was provided above.
    // Score 0-100: how often the candidate ANCHORED answers in resume specifics
    // (named companies, projects, technologies, metrics that appear on their CV)
    // vs. spoke in generic claims ("I led initiatives", "I improved performance").
    // Calibration:
    //   0-39  = barely references the resume; mostly generic
    //   40-69 = some grounding but several wasted opportunities (e.g. told a
    //           generic leadership story when a real on-CV project would have landed harder)
    //   70-100 = consistently anchors answers in real, on-resume specifics
    // rationale is one sentence in second person, naming the strongest miss or hit.
    "score": <0-100 integer>,
    "rationale": "<one sentence, ≤200 chars>"
  }` : "null /* no resume context provided */"},
  "crossSessionInsights": [
    // 0-4 items. ONLY populate if PRIOR SESSIONS context is present above —
    // otherwise return []. These are the coaching signals that turn the report
    // from a scorecard into a coach. Each item is ONE of:
    // - "improvement": something measurably better than last session
    // - "regression": something measurably worse than last session
    // - "persistent": a weakness that appears in BOTH this session AND prior sessions
    //   (i.e. the candidate was told to fix it and hasn't)
    // Write in second person, specific, honest. Example:
    //   { "kind": "persistent", "text": "You were told to quantify results two sessions ago — still missing in 4/5 answers this time.", "metric": "quantification" }
    //   { "kind": "improvement", "text": "Fillers dropped from 6.2/min to 2.8/min — your hardest-won gain.", "metric": "fillers", "delta": -3.4 }
    //   { "kind": "regression", "text": "Pace climbed back to 201 wpm — the rushed delivery cost you on Q3.", "metric": "pace", "delta": 18 }
    { "kind": "<enum>", "text": "<sentence>", "metric": "<optional short>", "delta": <optional number> }
  ],
  "coaching": {
    // PLAIN-LANGUAGE coaching for the candidate's dashboard card. This is read
    // by non-expert users at a glance — write like a friendly mentor, NOT an
    // interview-jargon rubric. NO acronyms (no "STAR", "MECE", "TAM"), NO
    // grading vocabulary. Every field below MUST be grounded in what THIS
    // candidate actually said in the transcript — never generic advice.
    "strength": {
      // The single most encouraging true thing they did. headline ≤6 words,
      // plain ("Clear, well-structured answers"). meaning: one sentence in
      // second person saying WHY, referencing their actual answers (≤140 chars).
      "headline": "<≤6 words, plain language>",
      "meaning": "<one sentence, second person, grounded in their answers, ≤140 chars>"
    },
    "gap": {
      // The ONE highest-leverage thing to fix next — the change that would
      // most raise their score. headline ≤6 words, plain and actionable
      // ("Add numbers to your results"). meaning: one sentence naming what
      // they actually did, quoting/paraphrasing their words (≤140 chars).
      // example: a concrete rewrite they could say instead — short, in their
      // voice, starting with "Try:" (≤140 chars).
      "headline": "<≤6 words, plain actionable language>",
      "meaning": "<one sentence naming what they did, grounded in transcript, ≤140 chars>",
      "example": "<concrete rewrite, starts with 'Try:', ≤140 chars>"
    }
  }${signatureMetricsPrompt ? `,
  "focusMetrics": [
    // Per-focus signature strip — see FOCUS SIGNATURE METRICS above for the
    // EXACT labels, value formats, and tone rules for this focus. Echo each
    // label verbatim; "value" is a SHORT display string (e.g. "88%", "0 / 1",
    // "Not stated"); "tone" is one of good|watch|miss|neutral. Omit a metric
    // only if the round genuinely produced no signal for it.
    { "label": "<pinned label>", "value": "<short string>", "tone": "<good|watch|miss|neutral>" }
  ]` : ""}${meta?.type === "hr-round" ? `,
  "hrReport": {
    // HR-round-specific extraction — add ONLY for hr-round sessions.
    // motivationBefore: verbatim excerpt (≤120 chars) of what the candidate said for "why this company / why this role". Keep it raw — quote their actual words.
    // motivationAfter: a 1-2 sentence rewrite that would land better. Sound like a real candidate, NOT an LLM. No banned vocab (leverage / utilize / ensure / demonstrate). MUST name at least one CONCRETE, SPECIFIC hook about the target company — a named product, business line, team, leader, customer segment, or recent initiative — and tie it to something THIS candidate can actually contribute given their background. If the transcript supplied a specific, use it; otherwise invent a realistic, plausible specific for that company (the same "you may invent realistic detail" license used for exemplar answers) rather than staying generic. HARD BAN on motivation filler that names nothing: "achieve my career goals", "grow my career", "this role aligns with", "help me grow", "excited about the company's growth/focus on digital transformation", "take my career to the next level". A rewrite that could be pasted for any company is WRONG — it must only make sense for THIS company.
    // noticeDays: integer days the candidate stated as their notice period (e.g. 60, 90), or null if not stated.
    // noticeFlexibility: "buyout-possible" if they said they could buy out / discussed a signing bonus offset; "strict" if they said they must serve the full period; "not-stated" if the topic came up but they didn't clarify.
    // compExpected: what they said as their target CTC or hike — short string like "35–42L" or "20% hike" or null if not stated.
    // counterOfferRisk: ONLY judge this if the interviewer actually probed commitment / other-offers / counter-offers. "low" if they were clear and definitive they won't take a counter-offer; "high" if they were vague, non-committal, or implied they might entertain one; "med" if probed but genuinely ambiguous. Use "not-assessed" when the topic never came up in the conversation — do NOT guess a risk level from silence.
    // bgvGaps: an array of doc gaps the candidate EXPLICITLY admitted during the BGV discussion (e.g. ["Missing relieving letter from prior employer", "Form-16 FY24 not yet downloaded"]). Never infer or invent a gap. Empty array [] if no gaps were admitted or BGV wasn't covered.
    "motivationBefore": "<their actual words, ≤120 chars>",
    "motivationAfter": "<stronger rewrite, sounds like a candidate, ≤150 chars>",
    "noticeDays": <integer days or null>,
    "noticeFlexibility": "<buyout-possible|strict|not-stated>",
    "compExpected": "<string like '35-42L' or null>",
    "counterOfferRisk": "<low|med|high|not-assessed>",
    "bgvGaps": ["<gap 1>", "<gap 2>"]
  }` : ""}
}

Apply all the CRITICAL RULES above to every field. Return ONLY valid JSON — no markdown wrapping, no prose.`;

    const tLLM0 = Date.now();
    // maxTokens 2500 (down from 5500). Audit of llm_usage shows real
    // completions are 900–1,600 tokens; 5500 was wildly over-provisioned.
    // The reason this matters: Groq's free-tier TPM cap on llama-3.3-70b
    // is ~12,000 tokens/minute and Groq counts (prompt + max_tokens), not
    // actual output. mvp-9's prompt growth pushed prompt+5500 over 12K,
    // triggering HTTP 413 "Request too large" on EVERY call — which then
    // fell through to Gemini and exhausted that quota too. 2500 keeps
    // total request budget around 8.8K, well under the TPM ceiling, with
    // 50% headroom over the historical p100 completion size.
    // A provider outage must degrade like an unparseable response, NOT a 500.
    // callLLM THROWS when every provider fails (quota/timeout/overload). If we
    // let that throw bubble to the outer catch, the user gets a scary
    // "Evaluation error" 500 — even though the next block already handles the
    // identical "no usable report" outcome gracefully with a retryable 503.
    // So guard the primary call and route a thrown outage into the same
    // retry-then-503 path. result stays null until a call actually succeeds.
    let result: Awaited<ReturnType<typeof callLLM>> | null = null;
    try {
      result = await callLLM(
        // Groq (primary) stays at 2500 — its tight free-tier TPM counts
        // prompt+max_tokens and a terse Groq report fits in ~2200. The fallbacks
        // (Gemini/Cerebras) get a much larger budget: gemini-2.5-flash is far
        // more verbose for the SAME schema and truncated the HR-round report at
        // both 2500 AND 4000 (observed completions pinned at the cap → unparseable
        // JSON → empty report). A complete report is ~5100 completion tokens, so
        // 8000 fits gemini-2.5-flash's 8192 ceiling with headroom.
        { prompt, temperature: 0.25, maxTokens: 2500, fallbackMaxTokens: 8000, jsonMode: true },
        // 50s overall: a complete gemini-2.5-flash report runs ~20-24s normally
        // but spikes past 35s under provider throttling — a 35s cap aborted
        // working calls. Groq stays capped at 15s (groqTimeoutMs) so a real
        // Groq incident still fails over fast. Bounded by the 100s maxDuration.
        50000,
        { userId: auth.userId, endpoint: "evaluate-session", groqTimeoutMs: 15000, sessionId: body.sessionId },
      );
    } catch (primaryErr) {
      console.error(`[evaluate-session] Primary LLM call failed (all providers): ${primaryErr instanceof Error ? primaryErr.message.slice(0, 150) : String(primaryErr)}`);
    }
    const tLLM = Date.now() - tLLM0;

    let parsed = result ? extractJSON<Partial<SessionReport>>(result.text) : null;
    // Strict-JSON variant of the prompt, reused by both the temperature-0 retry
    // and the last-resort 8b tier below.
    const strictPrompt = prompt + "\n\nIMPORTANT: Return ONLY the JSON object. No prose before or after. Start with { and end with }.";
    if (!isUsableEvalReport(parsed, meta?.type)) {
      // First attempt yielded no usable report — the provider chain threw
      // (outage), the model wrapped/truncated the JSON, OR it returned
      // syntactically-valid-but-empty JSON (a verbose fallback model truncating
      // at its token cap leaves skills/hrReport unset). Either way, retry once
      // with a strict prefix at temperature 0 before giving up on a 25-minute
      // interview the user can't easily replay.
      console.warn(`[evaluate-session] No usable report on first attempt (model: ${result?.model ?? "none"}); retrying strict.`);
      try {
        const retry = await callLLM(
          // Match the primary's fallback budget — when the retry is the real
          // attempt (primary hit a fast outage/429), the verbose fallback needs
          // the same 8000-token room and time to produce a complete report.
          { prompt: strictPrompt, temperature: 0, maxTokens: 2500, fallbackMaxTokens: 8000, jsonMode: true },
          // 40s: when the retry is the real attempt (primary failed fast), the
          // verbose fallback needs room to finish. primary(50) + retry(40) +
          // overhead stays under the 100s maxDuration.
          40000,
          { userId: auth.userId, endpoint: "evaluate-session-retry", groqTimeoutMs: 12000, sessionId: body.sessionId },
        );
        const retryParsed = extractJSON<Partial<SessionReport>>(retry.text);
        // Only accept the retry if it cleared the same usability bar — a second
        // empty/truncated object is no better than the first.
        if (isUsableEvalReport(retryParsed, meta?.type)) {
          parsed = retryParsed;
          result = retry; // downstream model/timing logging reflects the call that actually produced the report
        }
      } catch (retryErr) {
        console.error(`[evaluate-session] Retry call failed:`, retryErr);
      }
    }

    if (!parsed || !result || !isUsableEvalReport(parsed, meta?.type)) {
      // LAST RESORT — degrade MODEL QUALITY, not the whole report. The two
      // attempts above run the 70b-class chain (groq-70b → gemini-flash →
      // cerebras-70b). When that entire tier is down/quota'd but Groq's 8b is
      // still serving (it powers negotiate-turn + /api/evaluate, so it's the
      // most reliably-up provider), a terser 8b report that clears
      // isUsableEvalReport beats a 503 dead-end on a 25-minute interview.
      // Time-budget guarded against the 100s maxDuration so we never overrun.
      const elapsedMs = Date.now() - t0;
      if (elapsedMs < 70_000) {
        console.warn(`[evaluate-session] 70b chain exhausted at ${elapsedMs}ms; last-resort 8b attempt.`);
        try {
          const fastRetry = await callLLM(
            { prompt: strictPrompt, temperature: 0, maxTokens: 2500, fallbackMaxTokens: 8000, jsonMode: true, fast: true },
            20000,
            { userId: auth.userId, endpoint: "evaluate-session-fast", groqTimeoutMs: 12000, sessionId: body.sessionId },
          );
          const fastParsed = extractJSON<Partial<SessionReport>>(fastRetry.text);
          if (isUsableEvalReport(fastParsed, meta?.type)) {
            parsed = fastParsed;
            result = fastRetry;
          }
        } catch (fastErr) {
          console.error(`[evaluate-session] Last-resort 8b attempt failed:`, fastErr);
        }
      }
    }

    if (
      (!parsed || !result || !isUsableEvalReport(parsed, meta?.type)) &&
      meta?.type === "salary-negotiation"
    ) {
      // DETERMINISTIC FALLBACK (#PRI-51) — salary-negotiation only. Every LLM
      // tier above is down/quota'd, but the report assembly below needs the LLM
      // ONLY for the `parsed` slice (skills/overallScore/verdict/wins/fixes);
      // everything else (metrics, bands, Deal Summary) is deterministic. So
      // synthesize that slice from transcript signals and fall through to the
      // SAME tested assembly instead of 503-ing a 25-minute interview. The
      // candidate gets a real, honest report flagged as an estimate
      // (scoreConfidence 0.4) rather than a retry dead-end. HR/behavioral keep
      // the 503 path — their value (8-axis rubric, hrReport) can't be faithfully
      // synthesized without the model.
      console.warn(`[evaluate-session] LLM chain exhausted for salary-negotiation; synthesizing deterministic report for user ${auth.userId}.`);
      // S13-B10 — thread the authoritative session outcome into the deadlock
      // gate. The request carries only the transcript + meta (no persisted
      // kernel state, no band), so the full four-way outcome (which needs
      // NegotiationState.phase) is NOT reconstructable here — a `stalemate`
      // (ran out of turns) is a kernel-state fact a keyword scan cannot
      // honestly infer, and the band required to replay the transcript
      // through the kernel isn't in the request. But `walked-away` IS
      // transcript-honest: it's an explicit candidate exit, detected by
      // `isWalkAway` — the kernel's OWN single source of truth for walk-away
      // (_walkaway-detection.ts), not an ad-hoc regex. Threading it lights
      // the deadlock gate so the walk-away-floor coaching is suppressed on a
      // session the candidate explicitly ended (the impasse, not a missing
      // floor, is the story). Acceptance stays undefined here — the gate only
      // keys on deadlock (walked-away | stalemate), so an unknown accept has
      // no effect on the suppressed coaching.
      const negOutcome: NegOutcome | undefined = transcript.some(
        (t) => t.role === "candidate" && isWalkAway(t.text),
      )
        ? "walked-away"
        : undefined;
      parsed = buildDeterministicNegotiationReport(transcript, negOutcome);
      result = { text: "", model: "deterministic-neg-fallback", fallback: true, latencyMs: 0 };
    }

    if (!parsed || !result || !isUsableEvalReport(parsed, meta?.type)) {
      // All attempts failed (provider outage, unparseable output, or a
      // syntactically-valid-but-empty report). Return 503 (not 500) with
      // transcript_saved so the client shows "Your session is saved — retry
      // evaluation" rather than implying data loss or showing a blank report.
      console.error(`[evaluate-session] Could not generate report for user ${auth.userId} (outage or unusable output).`);
      return new Response(
        JSON.stringify({ error: "Couldn't generate your report right now. Your transcript is saved — please retry in a moment.", retryable: true, transcript_saved: true }),
        { status: 503, headers },
      );
    }

    // Build final report — merge deterministic metrics with LLM output.
    // Apply company calibration: re-weight skills + use company-specific bands.
    // For HR rounds, reconcile any drifted skill names back to the canonical
    // axes BEFORE blending: a paraphrased name ("Logistics" vs "Logistics
    // clarity") would otherwise miss its overlay weight (skillWeights[name]
    // undefined -> 1.0, discarding the sector/seniority calibration) and render
    // a mislabeled dimension. isUsableEvalReport already guaranteed all 8 axes
    // are present (tolerant match), so this only normalizes spelling.
    const allSkills = Array.isArray(parsed.skills) ? parsed.skills : [];
    // For HR rounds, reconcile drifted names on the FULL array first, then
    // PROJECT onto the canonical axis order (see selectCanonicalHrSkills). A blind
    // slice(0,8) before reconcile could drop a canonical axis (rendering 7 weighted
    // dims) if the LLM ignored the prompt and returned a junk entry inside the
    // first 8 with a real axis at index >= 8 — even though isUsableEvalReport
    // validated coverage on the full array. Non-HR focuses keep the historical
    // first-8 behaviour.
    const rawSkills = meta?.type === "hr-round"
      ? selectCanonicalHrSkills(allSkills, HR_ROUND_SKILL_AXES)
      : allSkills.slice(0, 8);
    /* HR rounds weight the displayed composite by the resolved rubric (sector/
       seniority overlay); everything else uses the company role-family weights.
       Falling back to {} = equal 1.0 weighting. */
    const skillWeights = meta?.type === "hr-round"
      ? hrSkillWeights
      : (companyProfile?.skillWeights ?? {});
    const llmOverall = typeof parsed.overallScore === "number" ? parsed.overallScore : 50;
    // Deterministic structural anchor stabilizes the score run-to-run on
    // identical transcripts (see computeStructuralAnchor / computeBlendedOverall).
    // It measures STAR-pillar presence, so it only applies to STAR-shaped
    // focuses — HR/negotiation answers aren't STAR and the anchor would
    // systematically under-score them (see isStarShapedFocus).
    const structuralAnchor = isStarShapedFocus(meta?.type)
      ? computeStructuralAnchor(transcript)
      : undefined;
    const { weightedSkills, overallScore, anchorClamped, anchorDelta } = computeBlendedOverall(
      rawSkills,
      skillWeights,
      llmOverall,
      structuralAnchor,
    );
    const candidateCorpus = transcript.filter((t) => t.role === "candidate").map((t) => t.text).join("\n");
    // India-context fairness — aggregate the deterministic cultural-register
    // detections across every candidate answer into one report-level summary
    // we can surface (makes the non-penalty scoring visible to the candidate).
    const fairnessSignals = summarizeIndianRegister(
      transcript
        .filter((t) => t.role === "candidate")
        .map((t) => detectCulturalRegister(t.text || "")),
    );

    const thoughtBubble = normalizeThoughtBubble((parsed as Record<string, unknown>).thoughtBubble);
    const scoreConfidence = normalizeScoreConfidence((parsed as Record<string, unknown>).scoreConfidence);
    const storyReuseFindings = normalizeStoryReuse((parsed as Record<string, unknown>).storyReuseFindings);

    const report: SessionReport = {
      version: "mvp-9",
      overallScore,
      scoreConfidence,
      band: applyBands(overallScore, bands),
      /* I-12 — reconcile the verdict prose with the numeric scores. When the
         LLM's one-liner claims strength on a low score (or a weakness with no
         low skill), validateVerdictCoherence swaps in a deterministic
         score-derived sentence so the headline never contradicts the numbers. */
      verdict: validateVerdictCoherence(
        typeof parsed.verdict === "string" ? parsed.verdict.slice(0, 200) : "",
        overallScore,
        weightedSkills,
      ),
      wins: filterGroundedItems(parsed.wins as WinOrFixH[] | undefined, candidateCorpus),
      fixes: filterGroundedItems(parsed.fixes as WinOrFixH[] | undefined, candidateCorpus),
      redFlags: filterGroundedRedFlags((parsed as Record<string, unknown>).redFlags as RedFlagH[] | undefined, candidateCorpus) as RedFlag[],
      coreMetrics,
      advancedDelivery,
      skills: weightedSkills,
      perQuestion: Array.isArray(parsed.perQuestion)
        ? (parsed.perQuestion as PerQuestionReport[])
            .slice(0, 30)
            .map((pq) => {
              const validDifficulty = ["warmup", "standard", "hard"];
              const validLength = ["too-brief", "right", "too-long"];
              const diff: PerQuestionReport["difficulty"] = validDifficulty.includes(pq.difficulty) ? pq.difficulty : "standard";
              const freqRaw = pq.frequencyPct;
              const freq: number | null =
                typeof freqRaw === "number" && isFinite(freqRaw) && freqRaw >= 0 && freqRaw <= 100
                  ? Math.round(freqRaw)
                  : null;
              // likelyFollowUp — accept only if both fields are non-empty strings
              const fu = pq.likelyFollowUp;
              const likelyFollowUp: FollowUpQuestion | null =
                fu && typeof fu.question === "string" && fu.question.trim() && typeof fu.why === "string" && fu.why.trim()
                  ? { question: fu.question.slice(0, 300), why: fu.why.slice(0, 200) }
                  : null;
              // lengthVerdict — sanity-check word count against actual answer
              const lv = pq.lengthVerdict;
              const actualWc = (pq.answerText || "").trim().split(/\s+/).filter(Boolean).length;
              const lengthVerdict: LengthVerdict | null =
                lv && validLength.includes(lv.verdict)
                  ? {
                      verdict: lv.verdict,
                      wordCount: actualWc, // prefer our count; LLM's may drift
                      targetRange: typeof lv.targetRange === "string" ? lv.targetRange.slice(0, 40) : "",
                      note: typeof lv.note === "string" ? lv.note.slice(0, 140) : "",
                    }
                  : null;
              /* Deterministic STAR detection — override whatever the LLM
                 reported with the shared regex set (src/_star-detection.ts).
                 The LLM's starPresence can drift from the live coach's
                 detection on the SAME text, eroding trust ("coach said
                 Result was missing, report says it was present"). Pinning
                 both surfaces to one detector keeps the story coherent.
                 S44-B14 (2026-07-23) — skip STAR entirely for salary-negotiation
                 sessions. Negotiation answers (counter-offers, interest
                 statements, comp expectations) have no S/T/A/R structure;
                 running the detector produces random boolean noise and the
                 per-question STAR strip shows misleading "missing" labels
                 on well-formed negotiation replies. */
              const starPresence = meta?.type === "salary-negotiation"
                ? { S: false, T: false, A: false, R: false, L: false }
                : (() => {
                  const det = detectStarPresence(pq.answerText || "");
                  return {
                    S: det.situation,
                    T: det.task,
                    A: det.action,
                    R: det.result,
                    /* STAR+L: Learning. Pin to the deterministic detector so the
                       live coach + report agree on whether a takeaway was
                       articulated. Particularly load-bearing on failure /
                       mistake questions — see _star-detection.ts. */
                    L: Boolean(det.learning),
                  };
                })();
              /* Same logic for cultural-register markers: pin the report
                 to the deterministic detector so the candidate sees the
                 same non-penalty signals the live coach treated as such.
                 The LLM's interpretation already factored these into its
                 prompt-side rules (see INDIAN CONVERSATIONAL REGISTER block
                 in CRITICAL RULES); we surface the booleans on the report
                 shape so downstream consumers (UI tooltips, future
                 rubric-debug view) can render them without re-detecting. */
              const culturalRegister = detectCulturalRegister(pq.answerText || "");
              return {
                ...pq,
                difficulty: diff,
                frequencyPct: freq,
                frequencyNote: typeof pq.frequencyNote === "string" ? pq.frequencyNote.slice(0, 80) : "",
                likelyFollowUp,
                lengthVerdict,
                starPresence,
                culturalRegister,
              };
            })
        : [],
      thoughtBubble,
      calibration: { companyLabel, note: companyNote, bands },
      fairnessSignals,
      crossSessionInsights: normalizeCrossSessionInsights(
        (parsed as Record<string, unknown>).crossSessionInsights,
        priorReports.length,
      ),
      priorSessionCount: priorReports.length,
      storyReuseFindings,
      blindSpots: normalizeBlindSpots((parsed as Record<string, unknown>).blindSpots),
      readiness: normalizeReadiness(
        (parsed as Record<string, unknown>).readiness,
        applyBands(overallScore, bands),
      ),
      /* Resume-grounding sub-score — only emitted when the engine passed
         a resumeContext block. Without resume facts in the prompt the LLM
         has nothing to score against, so we hard-null the axis instead of
         letting it hallucinate a number. */
      resumeGrounding: meta?.resumeContext
        ? normalizeResumeGrounding((parsed as Record<string, unknown>).resumeGrounding)
        : null,
      /* Reverse-interview classification — find the perQuestion whose
         interviewer prompt looks like the reverse-interview turn
         ("any questions for us?" / "questions for me?") and summarise
         the candidate's reply via the shared regex helper. Pinned
         deterministically so the report and the live coach agree on
         whether the closing turn helped or hurt the candidate. */
      reverseInterview: (() => {
        const REVERSE_PROMPT_RE = /\b(?:any\s+questions\s+(?:for\s+us|you\s+have)|questions\s+for\s+(?:me|us)|do\s+you\s+have\s+any\s+questions)\b/i;
        const perQ = Array.isArray((parsed as { perQuestion?: unknown[] }).perQuestion)
          ? ((parsed as { perQuestion: Array<{ question?: string; answerText?: string }> }).perQuestion)
          : [];
        const turn = perQ.find((pq) => typeof pq?.question === "string" && REVERSE_PROMPT_RE.test(pq.question));
        if (!turn) return null;
        return summarizeReverseInterview(turn.answerText || "");
      })(),
      /* Plain-language coaching pair for the dashboard session card.
         normalizeCoaching returns null on omission/malformation, so the
         card degrades to the legacy wins/fixes one-liners. */
      coaching: normalizeCoaching((parsed as Record<string, unknown>).coaching),
      /* Per-focus signature strip — normalizer keeps only metrics whose
         label matches the pinned spec for this focus, in canonical order.
         Empty array for focuses without a spec or when the model omitted
         them; the card degrades to the coaching pair. */
      focusMetrics: normalizeFocusMetrics((parsed as Record<string, unknown>).focusMetrics, meta?.focus || meta?.type),
      /* HR-round enrichment — only populated when meta.type === "hr-round"
         and the LLM returned the hrReport block. normalizeHrReport returns
         null when either the LLM omitted the block or both motivation fields
         are empty (i.e. nothing useful to show). Non-HR sessions get undefined. */
      hrReport: meta?.type === "hr-round"
        ? normalizeHrReport(
            (parsed as Record<string, unknown>).hrReport,
            transcript.map((t) => t.text || "").join("\n"),
            hrNorms,
          ) ?? undefined
        : undefined,
      model: result.model,
    };

    if (!validateReportShape(report, transcript)) {
      console.warn(`[evaluate-session] validation failed for session=${sessionId.slice(0, 8)}; returning anyway with warning`);
    }

    /* Deterministic register enforcement — strip the unambiguous AI tells the
       VOICE_DICTION_DIRECTIVE can't reliably suppress, across every prose
       field (verdict, wins/fixes, coaching, perQuestion notes, idealAnswers).
       Done BEFORE caching so the persisted copy is clean too. */
    const cleanReport = sanitizeVoiceValue(report) as SessionReport;

    // Persist to cache so re-opens are instant. Awaited so the edge isolate
    // doesn't terminate mid-write (same lesson as llm_usage in _llm.ts).
    // Cache failures are non-fatal — the user still gets their report.
    if (auth.userId) await saveCachedReport(sessionId, auth.userId, cleanReport, {
      targetCompany: meta?.targetCompany,
      role: meta?.role,
      difficulty: meta?.difficulty,
    });

    const totalMs = Date.now() - t0;
    console.warn(`[evaluate-session] OK session=${sessionId.slice(0, 8)} score=${overallScore} band=${report.band} llm=${tLLM}ms total=${totalMs}ms model=${result.model}`);
    headers["X-Timing"] = `llm=${tLLM},total=${totalMs},model=${result.model}`;

    await captureServerEvent("session_evaluated", distinctIdFrom(req, auth.userId), {
      session_id: sessionId,
      overall_score: overallScore,
      band: report.band,
      llm_ms: tLLM,
      total_ms: totalMs,
      model: result.model,
      interview_focus: typeof meta?.type === "string" ? meta.type : "",
      role: typeof meta?.role === "string" ? meta.role.slice(0, 100) : "",
      company: typeof meta?.targetCompany === "string" ? meta.targetCompany.slice(0, 60) : "",
      // Token counts for LLM COGS tracking. Populated from provider usage
      // metadata — null when the provider didn't return usage (rare).
      prompt_tokens: result.tokensUsed?.prompt ?? null,
      completion_tokens: result.tokensUsed?.completion ?? null,
      total_tokens: result.tokensUsed?.total ?? null,
      // Derived COGS estimate in INR at current Groq rates.
      // Groq llama-3.3-70b: ~$0.59/1M input + $0.79/1M output tokens @ ₹84.
      // Gemini 2.5 flash: ~$0.30/1M input + $2.50/1M output @ ₹84 (free up to quota).
      // This is a point-in-time approximation for trending, not billing.
      llm_cost_inr_est: (() => {
        const p = result.tokensUsed?.prompt ?? 0;
        const c = result.tokensUsed?.completion ?? 0;
        if (!p && !c) return null;
        const model = result.model ?? "";
        if (model.includes("gemini")) {
          return Math.round(((p / 1_000_000) * 0.30 + (c / 1_000_000) * 2.50) * 84 * 100) / 100;
        }
        // Groq Llama 3.3 70B / Cerebras
        return Math.round(((p / 1_000_000) * 0.59 + (c / 1_000_000) * 0.79) * 84 * 100) / 100;
      })(),
    }, req);

    // PRI-36 — measure how often the deterministic structural anchor has to
    // override the LLM score (|blend − anchor| > ANCHOR_MAX_DEVIATION). A high
    // rate means the LLM and the structure systematically disagree and the
    // anchor calibration (base/weight) needs tuning.
    if (anchorClamped) {
      await captureServerEvent("score_anchor_clamped", distinctIdFrom(req, auth.userId), {
        session_id: sessionId,
        overall_score: overallScore,
        structural_anchor: structuralAnchor,
        llm_overall: llmOverall,
        anchor_delta: anchorDelta,
      }, req);
    }

    return new Response(JSON.stringify({ report: cleanReport, cached: false }), { status: 200, headers });
  } catch (err) {
    const totalMs = Date.now() - t0;
    const isTimeout = err instanceof Error && (err.name === "AbortError" || err.message.includes("abort"));
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[evaluate-session] FAILED after ${totalMs}ms (${isTimeout ? "timeout" : "error"}): ${msg.slice(0, 200)}`);
    void captureServerException(err, undefined, { endpoint: "evaluate-session", isTimeout, totalMs });
    return new Response(
      JSON.stringify({ error: isTimeout ? "Evaluation timed out — try again" : `Evaluation error: ${msg.slice(0, 100)}`, retryable: true }),
      { status: isTimeout ? 504 : 500, headers },
    );
  }
}
