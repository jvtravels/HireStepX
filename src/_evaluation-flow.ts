/* HireStepX — End-of-session evaluation flow
 *
 * The "score this session" pipeline that runs when the candidate
 * finishes. Lives outside useInterviewEngine.ts because:
 *
 *   1. It's pure async logic — no React, no DOM. The engine collected
 *      the inputs; this module just runs the race + merges the result.
 *
 *   2. It's the single biggest source of complexity in handleEnd().
 *      Lifting it out keeps the engine focused on phase transitions
 *      and React lifecycle, while this module owns the LLM race,
 *      timeout handling, fallback merge, and offline-retry queueing.
 *
 *   3. The behaviour matters: the user is staring at a "scoring…"
 *      spinner here. Every branch in this module is something we
 *      promised would never strand them. Tests have a single point
 *      to assert against.
 *
 * The function returns a fully-resolved EvaluationOutcome — the engine
 * applies the side-effect signals (setUsedFallbackScore, setEvalTimedOut,
 * setSaveWarning, toast) and proceeds to the save step. We do NOT call
 * setState from inside this module so it stays unit-testable.
 */

import {
  computeFallbackScores,
  loadPreviousScores,
  processLLMEvaluation,
  type TranscriptEntry,
} from "./interviewEvaluation";
import { fetchLLMEvaluation, type EvaluationResult } from "./interviewAPI";
import { saveToIDB } from "./interviewIDB";

/* ─── Types ──────────────────────────────────────────────────────── */

export interface IdealAnswer {
  question: string;
  ideal: string;
  candidateSummary: string;
  rating?: string;
  starBreakdown?: Record<string, string>;
  workedWell?: string;
  toImprove?: string;
}

export interface NegotiationBandSnapshot {
  initialOffer?: number;
  maxStretch?: number;
}

export interface EvaluationFlowInput {
  /* Score-the-transcript inputs (mirror computeFallbackScores). */
  evalTranscript: TranscriptEntry[];
  currentStep: number;
  scriptLength: number;
  difficulty: string;
  elapsed: number;
  interviewType: string;

  /* LLM-call inputs. */
  originalQuestions: string[];
  role: string;
  company?: string;
  resumeText?: string;
  jobDescription?: string;

  /* Salary-negotiation extras. */
  negotiationBand?: NegotiationBandSnapshot | null;
  targetSalary?: number | null;
  highestOfferMade?: number;
  negotiationStyle?: string;

  /* Race control. */
  evalAbort: AbortController;
  sessionId: string;

  /* Test seam: defaults pull the live network helpers. */
  fetchEvaluation?: typeof fetchLLMEvaluation;
  saveOfflineRetry?: typeof saveToIDB;
}

export interface EvaluationOutcome {
  score: number;
  aiFeedback: string;
  skillScores: Record<string, number>;
  idealAnswers: IdealAnswer[];
  starAnalysis?: { overall: number; breakdown: Record<string, number>; tip: string };
  strengths?: string[];
  improvements?: string[];
  nextSteps?: string[];
  /* Side-effect signals — engine applies these via setState. */
  usedFallback: boolean;
  evalTimedOut: boolean;
  saveWarning?: string;
  /* User-facing toast the engine should surface, if any. */
  toastMessage?: string;
}

/* ─── Implementation ─────────────────────────────────────────────── */

const FALLBACK_NO_ANSWERS =
  "No answers were recorded in this session. Try speaking clearly into your microphone, or use the text input option.";
const FALLBACK_GENERIC =
  "Evaluation unavailable — score estimated from session metrics. Your estimated score is based on answer count, length, structure, and specificity. Practice again for a full AI evaluation.";
const FALLBACK_AFTER_ERROR =
  "Evaluation unavailable — score estimated from session metrics. Your score reflects answer count, length, and structure. Try again for full AI analysis.";
const TIMEOUT_TOAST = "Evaluation took too long — using estimated scores.";

function isTimeoutError(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("timed out") || m.includes("timeout");
}

function isNetworkError(msg: string): boolean {
  const m = msg.toLowerCase();
  return !navigator.onLine || m.includes("network") || m.includes("fetch");
}

/** Race the LLM evaluation against the abort signal. Returns null on abort. */
function raceWithAbort<T>(promise: Promise<T>, evalAbort: AbortController): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      if (evalAbort.signal.aborted) {
        reject(new Error("Evaluation timed out after 18 seconds."));
        return;
      }
      const onAbort = () => reject(new Error("Evaluation timed out after 18 seconds."));
      evalAbort.signal.addEventListener("abort", onAbort, { once: true });
    }),
  ]);
}

/** Run the full end-of-session evaluation. Always resolves — never throws. */
export async function runEvaluationFlow(input: EvaluationFlowInput): Promise<EvaluationOutcome> {
  const fetchEval = input.fetchEvaluation ?? fetchLLMEvaluation;
  const saveRetry = input.saveOfflineRetry ?? saveToIDB;

  const fallback = computeFallbackScores({
    transcript: input.evalTranscript,
    currentStep: input.currentStep,
    scriptLength: input.scriptLength,
    difficulty: input.difficulty,
    elapsed: input.elapsed,
    interviewType: input.interviewType,
  });

  const out: EvaluationOutcome = {
    score: fallback.score,
    aiFeedback: "",
    skillScores: {},
    idealAnswers: [],
    usedFallback: false,
    evalTimedOut: false,
  };

  /* No answers: short-circuit with the no-answers fallback message. */
  if (!fallback.hasAnyAnswers) {
    out.usedFallback = true;
    out.skillScores = fallback.skillScores;
    out.aiFeedback = FALLBACK_NO_ANSWERS;
    return out;
  }

  try {
    const previousScores = loadPreviousScores();

    const evaluation = await raceWithAbort<EvaluationResult | null>(
      fetchEval({
        transcript: input.evalTranscript,
        type: input.interviewType,
        difficulty: input.difficulty,
        role: input.role,
        company: input.company,
        questions: input.originalQuestions,
        resumeText: input.resumeText,
        jobDescription: input.jobDescription || undefined,
        previousScores,
        negotiationContext: input.interviewType === "salary-negotiation" ? {
          initialOffer: input.negotiationBand?.initialOffer,
          maxStretch: input.negotiationBand?.maxStretch,
          candidateTarget: input.targetSalary || undefined,
          highestOfferMade: input.highestOfferMade && input.highestOfferMade > 0 ? input.highestOfferMade : undefined,
          negotiationStyle: input.negotiationStyle || undefined,
        } : undefined,
      }),
      input.evalAbort,
    );

    if (evaluation) {
      /* Spread to plain object so TS accepts it as Record<string, unknown>
         — interface types don't satisfy index signatures directly, but the
         spread preserves the runtime shape. */
      const processed = processLLMEvaluation({ ...evaluation }, fallback.score);
      out.score = processed.score;
      out.aiFeedback = processed.feedback;
      out.skillScores = processed.skillScores;
      out.idealAnswers = processed.idealAnswers as IdealAnswer[];
      if (processed.starAnalysis) out.starAnalysis = processed.starAnalysis;
      if (processed.strengths) out.strengths = processed.strengths;
      if (processed.improvements) out.improvements = processed.improvements;
      if (processed.nextSteps) out.nextSteps = processed.nextSteps;
    } else {
      out.usedFallback = true;
      out.skillScores = fallback.skillScores;
      out.aiFeedback = FALLBACK_GENERIC;
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Could not get AI feedback. Using estimated score.";
    if (isTimeoutError(errMsg)) {
      out.evalTimedOut = true;
      out.toastMessage = TIMEOUT_TOAST;
    } else {
      out.usedFallback = true;
    }
    out.skillScores = fallback.skillScores;
    out.aiFeedback = out.aiFeedback || FALLBACK_AFTER_ERROR;
    out.saveWarning = errMsg;

    /* Network failures: queue for offline retry so the score isn't lost. */
    if (isNetworkError(errMsg)) {
      try {
        const retryKey = `hirestepx_eval_retry_${input.sessionId}`;
        await saveRetry(retryKey, {
          transcript: input.evalTranscript,
          type: input.interviewType,
          difficulty: input.difficulty,
          role: input.role,
          company: input.company,
          questions: input.originalQuestions,
          sessionId: input.sessionId,
          queuedAt: Date.now(),
        });
      } catch { /* IDB save is best-effort */ }
    }
  }

  return out;
}
