/* Vercel Edge Function — Interview Session Evaluation (MVP Report) */

export const config = { runtime: "edge", maxDuration: 60 };

import { withAuthAndRateLimit, sanitizeForLLM, corsHeaders, withRequestId } from "./_shared";
import { captureServerEvent, distinctIdFrom } from "./_posthog";
import { callLLM, extractJSON } from "./_llm";
import { classifyCompanyTier, tierPromptSuffix } from "./_company-tier";
import { formatScoringRubric } from "../data/focus-question-recipes";
import { detectStarPresence } from "../src/_star-detection";
import {
  GROUNDING_DIRECTIVE,
  FAIRNESS_DIRECTIVE,
  LENGTH_TARGETS_DIRECTIVE,
  SELF_CHECK_DIRECTIVE,
  getRubricWeight,
} from "./_evaluate-session-prompts";
import {
  ROLE_SKILLS,
  DEFAULT_BANDS,
  applyBands,
  resolveCompanyProfile,
  computeCoreMetrics,
  computeAdvancedDelivery,
  filterGroundedItems,
  filterGroundedRedFlags,
  validateReportShape,
  computeBlendedOverall,
  normalizeThoughtBubble,
  normalizeScoreConfidence,
  normalizeStoryReuse,
  normalizeBlindSpots,
  normalizeReadiness,
  normalizeCrossSessionInsights,
  type WinOrFix as WinOrFixH,
  type RedFlag as RedFlagH,
} from "./_evaluate-session-helpers";

declare const process: { env: Record<string, string | undefined> };
const GROQ_KEY = process.env.GROQ_API_KEY || "";
const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Bump on any schema change to perQuestion/redFlags/etc. Old cached reports
// with a different version are auto-invalidated on next view.
const REPORT_VERSION = "mvp-6";

/**
 * Try to read a cached report for this session. Returns null on any failure
 * (cache miss, network error, version mismatch) so the caller re-evaluates.
 * We verify user_id matches the caller so one user can't retrieve another's
 * report via a guessed sessionId.
 */
async function loadCachedReport(sessionId: string, userId: string): Promise<SessionReport | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
  try {
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
    if (row.report_version !== REPORT_VERSION) return null; // schema upgrade invalidates cache
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
async function saveCachedReport(sessionId: string, userId: string, report: SessionReport): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return;
  try {
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
        report_version: REPORT_VERSION,
        report_generated_at: new Date().toISOString(),
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

async function loadPriorReports(currentSessionId: string, userId: string): Promise<PriorReportSummary[]> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return [];
  try {
    const q = `sessions?user_id=eq.${encodeURIComponent(userId)}&id=neq.${encodeURIComponent(currentSessionId)}&report_json=not.is.null&order=created_at.desc&limit=3&select=id,created_at,report_json`;
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
  starPresence: { S: boolean; T: boolean; A: boolean; R: boolean };
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
  version: "mvp-6";
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
  crossSessionInsights: CrossSessionInsight[];
  priorSessionCount: number;
  storyReuseFindings: StoryReuseFinding[];
  blindSpots: BlindSpot[];
  readiness: ReadinessForecast | null;
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
    if (transcript.length > 200) {
      return new Response(JSON.stringify({ error: "transcript too long" }), { status: 413, headers });
    }

    // Try cache first — report is deterministic for (sessionId, REPORT_VERSION).
    // Saves ~8-12s of LLM latency and ~2500 tokens per re-open of the same report.
    if (auth.userId) {
      const tCache0 = Date.now();
      const cached = await loadCachedReport(sessionId, auth.userId);
      const tCache = Date.now() - tCache0;
      if (cached) {
        const totalMs = Date.now() - t0;
        console.warn(`[evaluate-session] CACHE HIT session=${sessionId.slice(0, 8)} lookup=${tCache}ms total=${totalMs}ms`);
        headers["X-Timing"] = `cacheLookup=${tCache},total=${totalMs},cached=1`;
        return new Response(JSON.stringify({ report: cached, cached: true }), { status: 200, headers });
      }
    }

    const roleFamily = (meta?.roleFamily as keyof typeof ROLE_SKILLS) || "behavioral";
    const skillAxes = ROLE_SKILLS[roleFamily] || ROLE_SKILLS.behavioral;
    const durationSec = meta?.duration || 600;
    const coreMetrics = computeCoreMetrics(transcript, durationSec);
    const advancedDelivery = computeAdvancedDelivery(transcript, durationSec);

    // Resolve company calibration profile (falls back to default bands/weights).
    const companyProfile = resolveCompanyProfile(meta?.targetCompany);
    const bands = companyProfile?.bands ?? DEFAULT_BANDS;
    const companyLabel = companyProfile?.label ?? "Generic";
    const companyNote = companyProfile?.note ?? "Generic calibration — set a target company for role-specific scoring.";

    // Cross-session memory: fetch the user's last 3 reports (structured
    // coaching signal only — no transcripts) so the LLM can call out
    // improvements, regressions, and persistent issues.
    const priorReports = auth.userId ? await loadPriorReports(sessionId, auth.userId) : [];

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
    const focusRubric = meta?.type ? formatScoringRubric(meta.type) : "";
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
    deep-dive / dive deep → look at, walk through; navigate → handle, deal with;
    drive impact / drive results / drive value — replace with a concrete verb (ship, hit, raise, cut);
    stakeholder alignment / cross-functional alignment → working with X and Y; getting X and Y on the same page;
    seamless / robust / scalable / world-class / best-in-class — drop them unless the candidate actually used the word;
    ideate / ideation → think up, brainstorm; circle back → follow up;
    additionally / furthermore / moreover → and, also, plus.
  Also banned: "Importantly," / "Notably," / "It's worth noting" sentence-openers; bureaucratic hedges like "in terms of" / "with respect to" / "as it relates to".
  Aim for: contractions ("I'd", "we're", "didn't"), specific verbs, the kind of phrasing a real senior would say to a hiring manager. A top-performer answer should sound like a sharp engineer/PM telling a story, NOT like a press release. If a sentence reads like it was generated, rewrite it.
- Pair each interviewer question with the candidate answer that follows it. Skip pairs where the candidate didn't answer (use verdict="skipped", restructured=null, topPerformerAnswer=null).
- HARD RULE: if the candidate answer starts with the literal token "[SKIPPED" (case-sensitive), the candidate explicitly skipped that question. Force verdict="skipped", score=0, restructured=null. STILL emit a topPerformerAnswer (this is a coaching opportunity — show what a strong candidate would have said). Set explanation to a one-line note acknowledging the skip without judgment.
- TOO-SHORT-TO-EVALUATE RULE: if the candidate's answer is under 25 words, do NOT invent reasons it scored low ("not in English", "incomprehensible", "off-topic"). The answer is just short. Use verdict="weak", score in the 30-45 range, and explanation="Answer was too brief to evaluate fully — most weak-band scoring drivers (vagueness, no Action, no Result) can't be judged in 12 words. The top-performer example shows the structure to aim for next time." Be honest about the limits of evaluation; don't fabricate coherent-sounding critique from a fragment.
- LANGUAGE RULE: ONLY mark the answer as language-mismatched if it is GENUINELY in a non-English language (Hindi, regional, etc.). Twelve English words is NOT "not in English"; that's just a short English answer. Misclassifying short English answers as non-English destroys candidate trust in the report.
- Every skill score must be justified by transcript evidence.
- Restructured answer MUST NOT invent numbers, company names, or outcomes not present in the candidate's words. If quantification is missing, frame it as a gap ("you could add the exact % here") rather than making one up.
- TopPerformerAnswer IS allowed to invent realistic details — that's its purpose. The structure depends on the QUESTION TYPE: STAR for behavioral, trade-offs for technical, framework + reasoning for case-study, and FORMAT-MATCHED for salary-negotiation / HR / logistics (number + reasons for salary expectations, concrete duration for notice period, etc. — NOT STAR). Across all types: quantified where the question warrants it, first-person ownership, role-appropriate scope. Aim for what a strong L5/Senior would say at the target company.
- TOPIC LOCK: Re-read the question before composing the exemplar. The exemplar must answer THIS question — not a different topic that came up earlier in the session. If question 5 asks about notice period, the exemplar discusses notice period (e.g. "I'm on a 60-day notice. I can probably negotiate down to 30 if there's a buyout, otherwise I'd plan for end of [month]"). It does NOT discuss salary expectations, strengths, or why-this-company. Wrong-topic exemplars destroy candidate trust in the report.
- NON-HALLUCINATION ON CANDIDATE PROFILE: You MUST NOT reference any candidate-profile signal that is false in the provided state. If a signal is false, do not mention the underlying topic in your critique. Do not assert, do not claim, do not mention if not present — do not infer or imagine candidate context (career gap, layoff, pregnancy, disability, caste, mental health, PIP, equity sophistication, hot-domain premium, etc.) unless the transcript itself contains the disclosure. Hallucinating sensitive context in the report is the canonical worst-case failure here and it is grounds for the report being rejected.
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
- Return ONLY valid JSON — no markdown wrapping, no prose.${tierSuffix ? `\n\n${tierSuffix}` : ""}${rubricWeight ? `\n\nRUBRIC WEIGHTS FOR THIS INTERVIEW TYPE:\n${rubricWeight}` : ""}${focusRubric}

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
      (meta?.interviewerName || meta?.interviewerPersonality)
        ? `\nLive interviewer: ${sanitizeForLLM(meta?.interviewerName || "Coach", 60)}${meta?.interviewerPersonality ? ` (${sanitizeForLLM(meta.interviewerPersonality, 60)})` : ""} — model exemplar/restructured prose to match this voice.`
        : ""
    }

TRANSCRIPT (numbered turns):
"""
${transcriptBlock}
"""
${priorContextBlock}

RUBRIC — score each skill 0-100:
${skillAxes.map((s) => `- ${s}`).join("\n")}

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
      "starPresence": {"S": <bool>, "T": <bool>, "A": <bool>, "R": <bool>},
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
      "explanation": "<1-2 sentences on what worked/missed>"
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
  ]
}

Apply all the CRITICAL RULES above to every field. Return ONLY valid JSON — no markdown wrapping, no prose.`;

    const tLLM0 = Date.now();
    // maxTokens 5500 (down from 7500): real reports rarely exceed 5k; the
    // higher cap was pushing Groq past its 6s per-provider cap and forcing
    // a guaranteed Gemini failover. Total LLM budget 45s fits inside the
    // function's maxDuration:60 with margin for response handling.
    const result = await callLLM(
      { prompt, temperature: 0.25, maxTokens: 5500, jsonMode: true },
      45000,
      { userId: auth.userId, endpoint: "evaluate-session" },
    );
    const tLLM = Date.now() - tLLM0;

    const parsed = extractJSON<Partial<SessionReport>>(result.text);
    if (!parsed) {
      console.error(`[evaluate-session] JSON parse failed. Model: ${result.model}, len: ${result.text.length}, head: ${result.text.slice(0, 200)}`);
      return new Response(JSON.stringify({ error: "Failed to parse evaluation", retryable: true }), { status: 500, headers });
    }

    // Build final report — merge deterministic metrics with LLM output.
    // Apply company calibration: re-weight skills + use company-specific bands.
    const rawSkills = Array.isArray(parsed.skills) ? parsed.skills.slice(0, 8) : [];
    const skillWeights = companyProfile?.skillWeights ?? {};
    const llmOverall = typeof parsed.overallScore === "number" ? parsed.overallScore : 50;
    const { weightedSkills, overallScore } = computeBlendedOverall(rawSkills, skillWeights, llmOverall);
    const candidateCorpus = transcript.filter((t) => t.role === "candidate").map((t) => t.text).join("\n");

    const thoughtBubble = normalizeThoughtBubble((parsed as Record<string, unknown>).thoughtBubble);
    const scoreConfidence = normalizeScoreConfidence((parsed as Record<string, unknown>).scoreConfidence);
    const storyReuseFindings = normalizeStoryReuse((parsed as Record<string, unknown>).storyReuseFindings);

    const report: SessionReport = {
      version: "mvp-6",
      overallScore,
      scoreConfidence,
      band: applyBands(overallScore, bands),
      verdict: typeof parsed.verdict === "string" ? parsed.verdict.slice(0, 200) : "",
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
                 both surfaces to one detector keeps the story coherent. */
              const det = detectStarPresence(pq.answerText || "");
              const starPresence = { S: det.situation, T: det.task, A: det.action, R: det.result };
              return {
                ...pq,
                difficulty: diff,
                frequencyPct: freq,
                frequencyNote: typeof pq.frequencyNote === "string" ? pq.frequencyNote.slice(0, 80) : "",
                likelyFollowUp,
                lengthVerdict,
                starPresence,
              };
            })
        : [],
      thoughtBubble,
      calibration: { companyLabel, note: companyNote, bands },
      crossSessionInsights: normalizeCrossSessionInsights(
        (parsed as Record<string, unknown>).crossSessionInsights,
        priorReports.length,
      ),
      priorSessionCount: priorReports.length,
      storyReuseFindings,
      blindSpots: normalizeBlindSpots((parsed as Record<string, unknown>).blindSpots),
      readiness: normalizeReadiness((parsed as Record<string, unknown>).readiness),
      model: result.model,
    };

    if (!validateReportShape(report, transcript)) {
      console.warn(`[evaluate-session] validation failed for session=${sessionId.slice(0, 8)}; returning anyway with warning`);
    }

    // Persist to cache so re-opens are instant. Awaited so the edge isolate
    // doesn't terminate mid-write (same lesson as llm_usage in _llm.ts).
    // Cache failures are non-fatal — the user still gets their report.
    if (auth.userId) await saveCachedReport(sessionId, auth.userId, report);

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
    }, req);

    return new Response(JSON.stringify({ report, cached: false }), { status: 200, headers });
  } catch (err) {
    const totalMs = Date.now() - t0;
    const isTimeout = err instanceof Error && (err.name === "AbortError" || err.message.includes("abort"));
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[evaluate-session] FAILED after ${totalMs}ms (${isTimeout ? "timeout" : "error"}): ${msg.slice(0, 200)}`);
    return new Response(
      JSON.stringify({ error: isTimeout ? "Evaluation timed out — try again" : `Evaluation error: ${msg.slice(0, 100)}`, retryable: true }),
      { status: isTimeout ? 504 : 500, headers },
    );
  }
}
