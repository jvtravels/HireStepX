/* ─── Interview API Client: LLM calls, session persistence, offline retry ─── */

import type { InterviewStep } from "./interviewScripts";
import { decrementSessionCredit } from "./supabase";
import { apiFetch } from "./apiClient";
import { openIDB, loadFromIDB, deleteFromIDB } from "./interviewIDB";
import { checkRateLimit } from "./rateLimit";
import { extractAccentMarkup } from "./_accent-parser";
import { stripProsodyMarkup } from "./_prosody";
import { checkQuestionQuality } from "./_question-quality";

const RESULTS_KEY = "hirestepx_sessions";
const IDB_STORE = "drafts";

/* extractAccentMarkup moved to ./_accent-parser.ts so it's testable
   without going through the API client. Re-exported here for backwards
   compat with existing imports. */
export { extractAccentMarkup };

/** Tidy LLM-generated question punctuation. Models occasionally emit
 *  artifacts like "incomplete data., How did you..." — joining a
 *  period-terminated stem with a comma-leading suffix. Collapse the
 *  obvious cases to a single canonical separator. */
function sanitizeQuestionPunctuation(text: string): string {
  return text
    .replace(/([.!?])\s*,\s*/g, "$1 ")  // ".," / "?," / "!," → "."
    .replace(/,\s*([.!?])/g, "$1")       // ",." / ",?" → "."
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Validate the salary-neg INITIAL offer at script ingest. The LLM
 *  occasionally produces an offer whose component breakdown doesn't
 *  add up ("₹18 LPA — ₹14.5 base, 10% bonus, ₹1.5 ESOP" sums to
 *  ~17.45) or whose total falls outside the band we passed it. We
 *  detect both, then either: (a) recompose the components to a
 *  realistic 78/15/7 split that sums correctly, or (b) clamp the
 *  total back to the band's initialOffer if it's wildly outside.
 *  Returns the corrected text. */
function sanitizeInitialOffer(
  text: string,
  band?: { initialOffer: number; minOffer: number; maxStretch: number },
): string {
  if (!text || !band) return text;

  // Total CTC: "₹X LPA" appearing near "total" / "CTC" / "package" /
  // "all up" / "offer of" / "offer you" / "offer X" / "we'd like to
  // offer". Earlier version only matched "offer of"; missed the
  // production wording "offer you ₹22 LPA" — letting a wildly out-
  // of-band offer through unclamped.
  const totalRe = /(?:(?:we['']d like to |we are |we['']re )?(?:offer(?:ing)?(?:\s+(?:you|to))?|extend(?:ing)?(?:\s+an?)?\s+offer(?:\s+(?:of|to))?)|total(?:\s+ctc)?|package(?:\s+of)?|all in|all up|CTC of|comp of)\s*(?:you\s*)?₹?\s*(\d+(?:\.\d+)?)\s*(LPA|lpa|lakhs?)/i;
  const totalMatch = totalRe.exec(text);
  if (!totalMatch) return text;
  const total = parseFloat(totalMatch[1]);
  if (!Number.isFinite(total) || total <= 0) return text;

  // 1. Out-of-band guard. If the LLM offered way above maxStretch
  //    or way below minOffer, replace the number with band.initialOffer.
  const outsideBand = total > band.maxStretch * 1.15 || total < band.minOffer * 0.7;
  if (outsideBand) {
    const fixed = Math.round(band.initialOffer * 10) / 10;
    console.warn(`[questions] Initial offer out of band: ${total} LPA, band [${band.minOffer}, ${band.maxStretch}] — clamping to ${fixed}`);
    return text.replace(/₹?\s*\d+(?:\.\d+)?\s*(LPA|lpa|lakhs?)/, `₹${fixed} $1`);
  }

  // 2. Component-sum guard. Look for "base ... ₹A LPA", "variable ...
  //    ₹B LPA", "bonus ... ₹C LPA"-style components. If their sum is
  //    > 5% off from the total, recompose to 78/15/7.
  const compRe = /₹\s*(\d+(?:\.\d+)?)\s*(?:LPA|lpa|lakhs?)\s*(?:base|variable|bonus|esop|equity|joining)/gi;
  const components: number[] = [];
  let cm: RegExpExecArray | null;
  while ((cm = compRe.exec(text)) !== null) {
    const v = parseFloat(cm[1]);
    if (Number.isFinite(v) && v > 0) components.push(v);
  }
  if (components.length >= 2) {
    const sum = components.reduce((a, b) => a + b, 0);
    const off = Math.abs(sum - total);
    if (off > Math.max(0.5, total * 0.05)) {
      console.warn(`[questions] Initial-offer components don't sum (total=${total}, components=${components.join("+")}=${sum}) — recomposing to 78/15/7`);
      const newBase = Math.round(total * 0.78 * 10) / 10;
      const newVar = Math.round(total * 0.15 * 10) / 10;
      const newBonus = Math.round((total - newBase - newVar) * 10) / 10;
      // Best-effort substitution: replace the first three component
      // figures in order. Leaves the surrounding sentence intact.
      let i = 0;
      const newVals = [newBase, newVar, newBonus];
      return text.replace(
        /₹\s*(\d+(?:\.\d+)?)\s*(LPA|lpa|lakhs?)/g,
        (full: string, _amt: string, unit: string) => {
          // Skip the headline total — only replace component figures.
          if (i === 0 && _amt === totalMatch[1]) {
            i++;
            return full;
          }
          const v = newVals[i - 1];
          i++;
          return v !== undefined ? `₹${v} ${unit}` : full;
        },
      );
    }
  }
  return text;
}

/** Retry a function with exponential backoff. Returns null after all retries fail. */
async function withRetry<T>(
  fn: () => Promise<T>,
  { retries = 2, baseDelayMs = 1000, shouldRetry = (_err: unknown) => true }: {
    retries?: number; baseDelayMs?: number; shouldRetry?: (err: unknown) => boolean;
  } = {},
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i === retries || !shouldRetry(err)) throw err;
      // Exponential backoff: 1s, 2s, 4s...
      const delay = baseDelayMs * Math.pow(2, i) + Math.random() * 500;
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

export interface SessionResult {
  id: string;
  date: string;
  type: string;
  difficulty: string;
  focus: string;
  duration: number;
  score: number;
  questions: number;
  transcript?: { speaker: string; text: string; time: string }[];
  ai_feedback?: string;
  skill_scores?: Record<string, number> | null;
  ideal_answers?: { question: string; ideal: string; candidateSummary: string; rating?: string; starBreakdown?: Record<string, string>; workedWell?: string; toImprove?: string }[];
  starAnalysis?: { overall: number; breakdown: Record<string, number>; tip: string };
  strengths?: string[];
  improvements?: string[];
  nextSteps?: string[];
  resumeUsed?: boolean;
  /**
   * Resume v2 — UUID of the resume_versions row used to generate this
   * session's questions. Captured at session start (when the engine
   * fetches questions) and never re-bound, so scores stay reproducible
   * if the user re-uploads later. Sent to /api/sessions/save which
   * writes it into sessions.resume_version_id.
   */
  resumeVersionId?: string | null;
  jobDescription?: string;
  jdAnalysis?: {
    matchScore: number;
    matchLabel: string;
    matchedSkills: string[];
    missingSkills: string[];
    interviewTips: string[];
    suggestedFocus: string;
  } | null;
  /** Captured at session start so the admin can see what the candidate was practicing for. */
  targetRole?: string;
  targetCompany?: string;
  /** Kernel-aware negotiation quality metrics. Populated only for
   *  salary-negotiation sessions that ran through /api/negotiate-turn
   *  and accumulated a move history. Surfaced in the report's
   *  "Negotiation Quality" card. */
  negotiationMetrics?: {
    outcome: "accepted" | "walked-away" | "stalemate" | "in-progress";
    anchorTurn: number | null;
    leverDiversity: number;
    lpaGained: number;
    lpaPerTurn: number;
    bandTraversal: number | null;
    overBandViolation: boolean;
    totalTurns: number;
    score: number;
  };
}

export interface EvaluationResult {
  overallScore: number;
  skillScores: Record<string, number>;
  strengths: string[];
  improvements: string[];
  feedback: string;
  idealAnswers?: { question: string; ideal: string; candidateSummary: string; rating?: string; starBreakdown?: Record<string, string>; workedWell?: string; toImprove?: string }[];
  starAnalysis?: { overall: number; breakdown: Record<string, number>; tip: string };
  nextSteps?: string[];
}

/** Save session to localStorage + Supabase with fallback.
 *
 * Returns `streakReward` when the server recognised that this session bumped
 * the user to a new streak milestone (7/14/30 days) and granted them a bonus
 * session credit. The engine uses this to show a celebratory toast.
 */
export interface StreakReward { milestone: number; bonusCredits: number }
export async function saveSessionResult(result: SessionResult, userId?: string): Promise<{
  localOk: boolean;
  cloudOk: boolean;
  streakReward?: StreakReward | null;
}> {
  let localOk = false;
  let cloudOk = false;
  let streakReward: StreakReward | null = null;
  try {
    const raw = localStorage.getItem(RESULTS_KEY);
    let sessions: SessionResult[];
    try {
      sessions = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(sessions)) sessions = [];
    } catch {
      console.warn("[save] localStorage data corrupted, starting fresh");
      sessions = [];
    }
    sessions.unshift(result);
    // Prune to most recent 50 sessions to prevent localStorage overflow
    if (sessions.length > 50) sessions.length = 50;
    try {
      localStorage.setItem(RESULTS_KEY, JSON.stringify(sessions));
    } catch {
      // Quota exceeded — aggressively prune to 10 and retry
      console.warn("[save] localStorage quota hit, pruning to 10 sessions");
      sessions.length = Math.min(sessions.length, 10);
      try {
        localStorage.setItem(RESULTS_KEY, JSON.stringify(sessions));
      } catch {
        // Still failing — clear old sessions and save only current
        console.warn("[save] localStorage still full, saving only current session");
        try { localStorage.setItem(RESULTS_KEY, JSON.stringify([sessions[0]])); } catch { /* give up on localStorage */ }
      }
    }
    localOk = true;
  } catch (e) {
    console.error("[save] localStorage save failed:", e);
  }
  if (userId) {
    try {
      // Route through our own edge endpoint via XHR (apiFetch) rather than
      // supabase-js directly. supabase-js uses window.fetch, which extension-
      // based fetch wrappers (Loom, Jam.dev, Hotjar) hang on POST bodies
      // above ~64 KB — transcripts + jd_analysis routinely exceed that, so
      // users reported "session completed but dashboard shows nothing."
      // The /api/sessions/save handler also atomically appends to
      // practice_timestamps, so the dashboard's session counter updates in
      // the same round-trip.
      const res = await apiFetch<{ ok: boolean; practiceAppended?: boolean; strippedColumns?: string[]; streakReward?: StreakReward | null }>("/api/sessions/save", {
        id: result.id,
        date: result.date,
        type: result.type,
        difficulty: result.difficulty,
        focus: result.focus,
        duration: result.duration,
        score: result.score,
        questions: result.questions,
        transcript: result.transcript || [],
        ai_feedback: result.ai_feedback || "",
        skill_scores: result.skill_scores || null,
        job_description: result.jobDescription || null,
        jd_analysis: result.jdAnalysis || null,
        target_role: result.targetRole || null,
        target_company: result.targetCompany || null,
        negotiation_metrics: result.negotiationMetrics || null,
        // Pin the resume version captured at session start. Server
        // falls back to resolveActiveResumeVersionId if absent, but
        // sending the client-captured value closes the edge case where
        // a user re-uploads mid-interview — the server-side resolver
        // would pick the new version, which would silently rebind the
        // session. This way it's locked from the start.
        resume_version_id: result.resumeVersionId || null,
      });
      if (res.ok && res.data?.ok) {
        cloudOk = true;
        if (res.data.strippedColumns && res.data.strippedColumns.length > 0) {
          console.warn("[save] server stripped columns:", res.data.strippedColumns);
        }
        if (res.data.streakReward) streakReward = res.data.streakReward;
      } else {
        console.warn(`[save] /api/sessions/save failed (${res.status}): ${res.error || "unknown"}`);
      }
      // Decrement session credit for free-tier users who purchased credits
      try { await decrementSessionCredit(userId); } catch { /* best-effort */ }
    } catch (err) {
      console.warn("Failed to save session to Supabase:", err);
    }
  } else {
    cloudOk = true;
  }
  return { localOk, cloudOk, streakReward };
}

/**
 * Analyze recent sessions to identify weak skills and past question topics.
 * Used for spaced repetition / adaptive question selection.
 */
export function getAdaptiveHints(sessions: { skill_scores?: Record<string, unknown> | null; questions?: number; type?: string; date?: string }[], jdMissingSkills?: string[]): {
  weakSkills: string[];
  pastTopics: string[];
  suggestedFocus?: string;
} {
  if (!sessions || sessions.length === 0) return { weakSkills: [], pastTopics: [] };

  // Extract all skill scores from recent sessions (most recent first)
  const skillAgg: Record<string, { scores: number[]; lastSeen: number }> = {};
  const topicSet = new Set<string>();

  sessions.slice(0, 20).forEach((s, idx) => {
    if (s.type) topicSet.add(s.type);
    if (!s.skill_scores || typeof s.skill_scores !== "object") return;
    for (const [name, raw] of Object.entries(s.skill_scores)) {
      const score = typeof raw === "number" ? raw : typeof raw === "object" && raw !== null && "score" in raw ? (raw as { score: number }).score : 0;
      if (!skillAgg[name]) skillAgg[name] = { scores: [], lastSeen: idx };
      skillAgg[name].scores.push(score);
      if (idx < skillAgg[name].lastSeen) skillAgg[name].lastSeen = idx;
    }
  });

  // Find weak skills: low average score OR haven't been tested recently
  const weakSkills: { name: string; priority: number }[] = [];
  for (const [name, { scores, lastSeen }] of Object.entries(skillAgg)) {
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    // Priority = low score + recency penalty (skills not tested recently get boosted)
    const recencyBoost = Math.min(lastSeen * 5, 30); // up to 30 points for stale skills
    const priority = (100 - avg) + recencyBoost;
    if (avg < 70 || lastSeen > 5) {
      weakSkills.push({ name, priority });
    }
  }

  weakSkills.sort((a, b) => b.priority - a.priority);

  // Merge JD missing skills into weak skills so adaptive questions target JD-specific gaps
  const weakSkillNames = weakSkills.slice(0, 5).map(s => s.name);
  if (jdMissingSkills && jdMissingSkills.length > 0) {
    for (const skill of jdMissingSkills) {
      if (!weakSkillNames.includes(skill)) {
        weakSkillNames.push(skill);
      }
    }
  }

  const suggestedFocus = weakSkills.length > 0 ? weakSkills[0].name : (jdMissingSkills?.[0] ?? undefined);

  return {
    weakSkills: weakSkillNames,
    pastTopics: Array.from(topicSet).slice(0, 10),
    suggestedFocus,
  };
}

/** Negotiation band returned by generate-questions API */
export interface NegotiationBandData {
  initialOffer: number;
  minOffer: number;
  maxStretch: number;
  walkAway: number;
  joiningBonusRange: [number, number];
  hasEquity: boolean;
  equityRange: [number, number];
  bandContext: string;
}

/** Result from fetchLLMQuestions — includes questions + optional negotiation band */
export interface LLMQuestionsResult {
  questions: InterviewStep[];
  negotiationBand?: NegotiationBandData;
}

/** Fetch LLM-generated interview questions */
export async function fetchLLMQuestions(params: {
  type: string; focus?: string; difficulty: string; role: string;
  company?: string; currentCity?: string; jobCity?: string; industry?: string; resumeText?: string;
  pastTopics?: string[]; weakSkills?: string[]; jobDescription?: string;
  experienceLevel?: string; mini?: boolean;
  resumeStrengths?: string[]; resumeGaps?: string[]; resumeTopSkills?: string[];
  candidateName?: string;
  negotiationStyle?: string;
}): Promise<LLMQuestionsResult | null> {
  // Client-side rate limit: max 3 question generations per 60s
  if (!checkRateLimit("generate-questions", 3, 60_000)) {
    throw new Error("Too many requests. Please wait a moment and try again.");
  }
  const attempt = async (): Promise<LLMQuestionsResult | null> => {
    const { authHeaders: getAuthHeaders } = await import("./supabase");
    const headers = await getAuthHeaders();
    const res = await fetch("/api/generate-questions", {
      method: "POST",
      headers,
      body: JSON.stringify(params),
    });
    if (res.status === 429) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.retryAfter ? `Too many requests. Please wait ${data.retryAfter} seconds and try again.` : "Too many requests. Please wait a moment and try again.");
    }
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      const reason = res.status === 401 ? "auth" : res.status === 403 ? "limit" : res.status === 503 ? "not-configured" : `error-${res.status}`;
      console.warn(`[questions] generate-questions failed: ${res.status} (${reason})`, errBody.slice(0, 300));
      // Throw with reason so caller can show specific message instead of generic fallback
      throw new Error(`Question generation failed: ${reason === "auth" ? "not logged in" : reason === "limit" ? "session limit reached" : reason === "not-configured" ? "AI not configured on server" : `server error ${res.status}`}`);
    }
    const data = await res.json();
    if (!data.questions || !Array.isArray(data.questions)) {
      console.warn("[questions] generate-questions returned invalid data:", JSON.stringify(data).slice(0, 300));
      return null;
    }
    const isSalaryNeg = params.type === "salary-negotiation";
    const negBandForGuard = (data as { negotiationBand?: NegotiationBandData }).negotiationBand;
    const questions = data.questions
      .map((q: { type?: string; aiText?: string; text?: string; scoreNote?: string; persona?: string }, idx: number) => {
        let rawText = sanitizeQuestionPunctuation(q.aiText || q.text || "");
        // For salary-neg's initial offer, validate the offer's total
        // against the band and recompose components if they don't
        // sum to the total. The follow-up handler already does this
        // for downstream turns; this catches the script-time hallucinations.
        if (isSalaryNeg && idx === 1 && (q.type === "question" || q.type === "intro")) {
          rawText = sanitizeInitialOffer(rawText, negBandForGuard);
        }
        // Extract LLM-marked italic-copper accent: *word* → accentSplit.
        // Falls through to plain text if LLM didn't comply.
        const { cleaned, accentSplit } = extractAccentMarkup(rawText);
        // Compute speakingDuration from word count (~150 WPM for TTS, 1.5s padding)
        const wordCount = cleaned.split(/\s+/).length;
        const estimatedMs = Math.max(3000, Math.round((wordCount / 150) * 60 * 1000) + 1500);

        /* ─── Salary-negotiation safety net ───
           The script-generation prompt at server-handlers/generate-questions.ts
           explicitly tells the LLM "ONLY step 2 (initial offer) should
           contain ₹ numbers; steps 3-6 must NOT invent counter-offer
           numbers". The LLM doesn't always comply. The user-reported
           bug: closing step shipped with "agreed on ₹15.5 LPA total
           CTC" — a number that was BELOW the initial offer (₹16),
           lower than every offer made during the conversation, and
           pure invention.

           Fix: in salary-neg mode, for any step EXCEPT the initial
           offer (step index 1, the first "question" after intro),
           strip any ₹ amounts and replace with the safe template if
           the cleaned text contains a salary number. The initial
           offer (which legitimately needs numbers) is left untouched.
           A follow-up replacement at runtime can still inject real
           numbers based on actual conversation; this just blocks the
           script's hallucinated ones. */
        let safeAiText = cleaned;
        let safeDisplay = stripProsodyMarkup(cleaned);
        const stepType = q.type || "question";
        const isInitialOffer = isSalaryNeg && idx === 1 && (stepType === "question" || stepType === "intro");
        if (isSalaryNeg && !isInitialOffer && /₹\s*\d+(?:\.\d+)?\s*(?:LPA|lpa|lakh|lakhs|cr|crore|Cr)/.test(cleaned)) {
          console.warn(`[questions] salary-neg step ${idx} (${stepType}) contained an invented ₹ number — replacing with safe template:`, cleaned.slice(0, 100));
          if (stepType === "closing") {
            safeAiText = "I think we've had a really productive conversation. Let me put together the final numbers based on everything we've discussed and have HR send you the formal offer letter. What's your notice period situation?";
          } else {
            safeAiText = "Based on what you've shared, let me think about what makes sense here. What matters most to you in the overall package?";
          }
          safeDisplay = safeAiText;
        }
        return {
          type: stepType as InterviewStep["type"],
          // aiText keeps prosody markup ([pause], _word_) for TTS to render
          // as SSML breaks/emphasis; aiTextDisplay strips everything for UI.
          aiText: safeAiText,
          aiTextDisplay: safeDisplay,
          thinkingDuration: q.type === "intro" ? 500 : 600,
          speakingDuration: estimatedMs,
          waitForUser: q.type !== "closing",
          scoreNote: q.scoreNote || "",
          ...(q.persona ? { persona: q.persona } : {}),
          ...(accentSplit && safeAiText === cleaned ? { accentSplit } : {}),
        };
      })
      .filter((q: InterviewStep) => q.aiText.length >= 10)
      .map((q: InterviewStep) => q.type === "closing" ? { ...q, waitForUser: true } : q);

    /* Closing-turn safety net (Bug K fix). The user-reported "interview
       suddenly ended on its own" bug traced to this pipeline: when the
       LLM emitted a closing step with text <10 chars (or no closing
       step at all), the .filter() above silently dropped it. The
       resulting script was [intro, ...questions] with no closing — so
       after the user answered the last question, useInterviewEngine
       hit isLastStep=true and went straight to setPhase("done"),
       skipping any wrap-up turn. Now: if no closing survived the
       filter, append a generic one. waitForUser:true so the user has
       time to read it before the report renders. */
    {
      const hasClosing = questions.some((q: InterviewStep) => q.type === "closing");
      if (!hasClosing) {
        const fallbackClose = "Thanks for taking the time to talk through this. We'll review the conversation and follow up on next steps shortly. Best of luck.";
        const fallbackMs = Math.max(4500, Math.round((fallbackClose.split(/\s+/).length / 150) * 60 * 1000) + 1500);
        questions.push({
          type: "closing",
          aiText: fallbackClose,
          aiTextDisplay: fallbackClose,
          thinkingDuration: 400,
          speakingDuration: fallbackMs,
          waitForUser: true,
          scoreNote: "Closing — synthesized fallback (LLM omitted or produced too-short closing).",
        });
      }
    }

    /* Quality post-filter — see src/_question-quality.ts.
       Rejects sub-15-word questions, banned LLM-isms, late-position
       generic openers, and role-mismatched stems. Failed questions
       are downgraded to a focus-aware fallback (NOT removed — we
       still want a full session). Salary-neg is exempt because its
       "questions" are actually offer/counter steps with their own
       arc rules. */
    const focus = (params.focus || params.type || "behavioral").toLowerCase();
    const role = params.role || "";
    let downgradedCount = 0;
    const filteredQuestions = isSalaryNeg ? questions : questions.map((q: InterviewStep, idx: number) => {
      const result = checkQuestionQuality(
        { type: q.type, aiText: q.aiText, idx, total: questions.length },
        focus,
        role,
      );
      if (result.ok) return q;
      console.warn(`[questions] step ${idx} (${q.type}) failed quality check:`, result.issues.map((i) => `${i.rule}(${i.detail})`).join(", "), "→ falling back");
      downgradedCount++;
      return {
        ...q,
        aiText: result.fallback,
        aiTextDisplay: stripProsodyMarkup(result.fallback),
      };
    });
    if (downgradedCount > 0) {
      console.info(`[questions] quality-filter downgraded ${downgradedCount}/${questions.length} steps to safe fallbacks`);
    }
    return { questions: filteredQuestions, negotiationBand: data.negotiationBand || undefined };
  };
  for (let i = 0; i < 3; i++) {
    try {
      return await attempt();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[questions] attempt ${i + 1}/3 failed:`, msg);
      // Propagate actionable errors (auth, limit, rate limit) so user sees specific message
      if (err instanceof Error && (msg.includes("Too many requests") || msg.includes("Question generation failed"))) throw err;
      // Only retry network errors (TypeError) and server errors, not client errors
      const isRetryable = err instanceof TypeError || (err instanceof Error && msg.includes("500"));
      if (i === 2 || !isRetryable) throw new Error(msg || "Could not generate questions");
      // Exponential backoff: 1.5s, 3s
      await new Promise(r => setTimeout(r, 1500 * Math.pow(2, i)));
    }
  }
  return null;
}

/** Evaluate interview answers with LLM */
export async function fetchLLMEvaluation(params: {
  transcript: { speaker: string; text: string }[];
  type: string; difficulty: string; role: string; company?: string;
  questions?: string[];
  resumeText?: string;
  jobDescription?: string;
  previousScores?: { overall: number; skills: Record<string, number> } | null;
  negotiationContext?: {
    initialOffer?: number;
    maxStretch?: number;
    candidateTarget?: number;
    highestOfferMade?: number;
    negotiationStyle?: string;
  };
  /** Behavioural-only: the live interviewer's name + personality trait, so the
      evaluator's topPerformerAnswer matches the tone the candidate actually
      heard. Without this, the live coach can be a warm mentor while the
      report writes back in a clipped FAANG manager voice — same person,
      different vibe, candidate is confused. */
  interviewerName?: string;
  interviewerPersonality?: string;
}, timeoutMs = 14000): Promise<EvaluationResult | null> {
  // Client-side rate limit: max 5 evaluations per 60s
  if (!checkRateLimit("evaluate", 5, 60_000)) {
    throw new Error("Too many requests. Please wait a moment and try again.");
  }
  try {
    return await withRetry(async () => {
      const { authHeaders: getAuthHeaders } = await import("./supabase");
      const headers = await getAuthHeaders();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers,
        body: JSON.stringify(params),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.retryAfter ? `Too many requests. Please wait ${data.retryAfter} seconds and try again.` : "Too many requests. Please wait a moment and try again.");
      }
      if (res.status >= 500) throw new Error(`Evaluation server error: ${res.status}`);
      if (!res.ok) return null;
      const body = await res.json();
      if (!body || typeof body.overallScore !== "number" || typeof body.feedback !== "string") return null;
      return body;
    }, {
      // Zero retries here: the rich per-question evaluation runs via
      // /api/evaluate-session when the user opens the report, so this
      // quick eval is best-effort. Retrying would chain timeouts and
      // trap the user on "Analyzing…" for 30-40s. Fallback scores are
      // honest — let them land on the report fast.
      retries: 0,
      baseDelayMs: 0,
      shouldRetry: () => false,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Evaluation timed out. Using estimated score.");
    }
    throw err;
  }
}

/** Fetch a dynamic follow-up question based on the candidate's answer */
export async function fetchFollowUp(params: {
  question: string; answer: string; type: string; role: string;
  jobDescription?: string; company?: string;
  currentCity?: string; jobCity?: string;
  followUpDepth?: number;
  adaptiveDifficulty?: "escalate" | "ease" | "hold";
  negotiationPhase?: string; questionIndex?: number; totalQuestions?: number;
  previousFollowUps?: string[];
  persona?: string;
  conversationHistory?: string;
  resumeTopSkills?: string[];
  initialOfferText?: string;
  negotiationFacts?: {
    acceptedImmediately: boolean;
    rejectedOutright: boolean;
    candidateCounter: string | null;
    candidateCurrentCTC: string | null;
    hasCompetingOffers: boolean;
    topicsRaised: string[];
    deflectedNumbers: boolean;
    askedForTime: boolean;
    usedTacticalSilence: boolean;
    mentionedBATNA: boolean;
    expressedSurprise: boolean;
  };
  negotiationStyle?: string;
  negotiationBand?: NegotiationBandData;
  industry?: string;
  highestOfferMade?: number;
  candidateTarget?: number;
  negotiationScenario?: string;
  /** Emotional-state snapshot derived from the candidate's recent answers.
      The follow-up LLM uses this to modulate tone (warm vs neutral vs probing). */
  candidateState?: {
    stress: "low" | "medium" | "high";
    engagement: "engaged" | "fading" | "disengaged";
    fillerDensity: number;
    lengthTrend: "shortening" | "stable" | "growing";
  };
  /** Rolling buffer of noun-phrase mentions from past answers. The LLM
      uses these as explicit hooks for cross-question references
      ("Earlier you mentioned X — how does that connect to..."). */
  previousMentions?: string[];
  personaTrait?: string;
  candidateWalkAway?: number;
  candidateCompetingOffer?: number;
  /** Behavioural-only: which STAR component the engine has detected as
      missing on this answer. The follow-up LLM uses this hint to target
      a component-gap probe ("what specifically did *you* do?") instead
      of escalating depth on whatever it happened to latch onto. */
  starGap?: "action" | "result" | "situation-task";
}): Promise<{ needsFollowUp: boolean; followUpText: string; followUpType?: string } | null> {
  // Client-side rate limit: max 10 follow-ups per 60s
  if (!checkRateLimit("follow-up", 10, 60_000)) return null;
  try {
    return await withRetry(async () => {
      const { authHeaders: getAuthHeaders } = await import("./supabase");
      const headers = await getAuthHeaders();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 14_000);
      const res = await fetch("/api/follow-up", {
        method: "POST",
        headers,
        body: JSON.stringify(params),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        if (res.status >= 500) throw new Error(`Server error: ${res.status}`);
        return null as unknown as { needsFollowUp: boolean; followUpText: string; followUpType?: string };
      }
      return await res.json();
    }, {
      retries: 2,
      baseDelayMs: 1000,
      shouldRetry: (err) => err instanceof TypeError || (err instanceof Error && err.message.startsWith("Server error")),
    });
  } catch {
    return null;
  }
}

/* ─── Canonical Negotiation Kernel client (Ship 3) ────────────────────
 * Thin typed wrapper around /api/negotiate-turn. Used by the engine
 * when the feature flag is on (see _negotiation-kernel-flag.ts).
 * The endpoint is gated server-side too — flag off = 404.
 */

export interface NegotiationKernelBand {
  initialOffer: number;
  maxStretch: number;
  walkAway: number;
  hasEquity: boolean;
}

export interface NegotiationKernelMove {
  lever: string;
  newTotalLpa: number | null;
  rationale: string;
}

export interface NegotiationKernelResponse {
  ok: true;
  /** Serialized state — opaque to the client; pass back on next turn. */
  state: string;
  text: string;
  move: NegotiationKernelMove;
  source: "llm" | "llm-retry" | "fallback";
  terminal?: boolean;
}

export async function negotiationKernelInit(params: {
  sessionId: string;
  role: string;
  company: string;
  band: NegotiationKernelBand;
  maxTurns?: number;
}): Promise<NegotiationKernelResponse | null> {
  return postKernel({ action: "init", ...params });
}

export async function negotiationKernelTurn(params: {
  state: string;
  candidateAnswer: string;
}): Promise<NegotiationKernelResponse | null> {
  return postKernel({ action: "turn", ...params });
}

async function postKernel(body: Record<string, unknown>): Promise<NegotiationKernelResponse | null> {
  if (!checkRateLimit("negotiate-turn", 30, 60_000)) return null;
  try {
    const { authHeaders: getAuthHeaders } = await import("./supabase");
    const headers = await getAuthHeaders();
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 14_000);
    const res = await fetch("/api/negotiate-turn", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json() as NegotiationKernelResponse;
  } catch {
    return null;
  }
}

/** Retry queued offline evaluations */
export async function retryQueuedEvals(): Promise<void> {
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE, "readonly");
    const store = tx.objectStore(IDB_STORE);
    const req = store.getAllKeys();
    req.onsuccess = async () => {
      const keys = (req.result as string[]).filter(k => typeof k === "string" && k.startsWith("hirestepx_eval_retry_"));
      db.close();
      for (const key of keys) {
        try {
          const data = await loadFromIDB(key) as Record<string, unknown> | null;
          if (!data || Date.now() - (data.queuedAt as number) > 24 * 60 * 60 * 1000) {
            await deleteFromIDB(key);
            continue;
          }
          const result = await fetchLLMEvaluation({
            transcript: data.transcript as { speaker: string; text: string }[],
            type: data.type as string,
            difficulty: data.difficulty as string,
            role: data.role as string,
            company: data.company as string | undefined,
            questions: data.questions as string[] | undefined,
            resumeText: data.resumeText as string | undefined,
          });
          if (result) {
            try {
              const raw = localStorage.getItem(RESULTS_KEY);
              const sessions: SessionResult[] = raw ? JSON.parse(raw) : [];
              const idx = sessions.findIndex(s => s.id === data.sessionId);
              if (idx >= 0) {
                sessions[idx].score = Math.min(100, Math.max(0, result.overallScore));
                sessions[idx].ai_feedback = result.feedback;
                sessions[idx].skill_scores = result.skillScores && typeof result.skillScores === "object"
                  ? Object.fromEntries(Object.entries(result.skillScores).map(([k, v]) => [k, typeof v === "object" && v !== null && "score" in (v as Record<string, unknown>) ? (v as Record<string, unknown>).score as number : v]))
                  : result.skillScores;
                localStorage.setItem(RESULTS_KEY, JSON.stringify(sessions));
              }
            } catch { /* expected: localStorage update may fail */ }
            await deleteFromIDB(key);
          }
        } catch { /* expected: IDB cursor iteration may fail */ }
      }
    };
    req.onerror = () => db.close();
  } catch { /* expected: IndexedDB may be unavailable */ }
}
