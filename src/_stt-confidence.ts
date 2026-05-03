/* HireStepX — STT confidence tracker

   Pure helper that tracks per-turn STT confidence. Indian English on
   Deepgram Nova-3 lands around 85-92% mean accuracy; chunks below
   ~0.65 confidence are the ones where the LLM is most likely grading
   misheard text. We surface that signal so the UI can:

     • Show a "speak clearly" hint mid-turn when confidence is dropping
     • Log low-confidence answers to service_usage for tuning
     • Eventually (V1.1): pause before grading and prompt the user to
       review/edit the transcript

   The tracker is a simple state machine that aggregates confidence
   readings into per-turn totals. New turn starts with reset(); each
   chunk's confidence flows through update(); query() returns running
   stats.

   Pure logic — no React, no DOM, no fetch. Unit-testable in isolation. */

/** Threshold below which a chunk is "low confidence" — the LLM is at
 *  meaningful risk of grading wrong text. Tuned for Indian English on
 *  Deepgram Nova-3; if we change STT providers this should be re-tuned. */
export const LOW_CONFIDENCE_THRESHOLD = 0.65;

export interface SttConfidenceState {
  /** Number of finalized chunks observed in the current turn. */
  totalChunks: number;
  /** Chunks below LOW_CONFIDENCE_THRESHOLD. */
  lowChunks: number;
  /** Lowest confidence seen in the turn (0-1). null if no chunks yet. */
  minConfidence: number | null;
  /** Running sum, kept for mean calculation. */
  sumConfidence: number;
}

export function createSttConfidenceState(): SttConfidenceState {
  return {
    totalChunks: 0,
    lowChunks: 0,
    minConfidence: null,
    sumConfidence: 0,
  };
}

/** Record a finalized chunk's confidence. Returns the updated state.
 *  Mutates the input state object — caller can keep a single instance
 *  per turn without churning allocations. Out-of-range values are
 *  clamped (Deepgram has been known to emit slight overshoots like
 *  1.0001 due to float rounding). */
export function updateSttConfidence(
  state: SttConfidenceState,
  rawConfidence: number,
): SttConfidenceState {
  if (typeof rawConfidence !== "number" || !Number.isFinite(rawConfidence)) {
    return state;
  }
  const conf = Math.max(0, Math.min(1, rawConfidence));
  state.totalChunks += 1;
  state.sumConfidence += conf;
  if (conf < LOW_CONFIDENCE_THRESHOLD) state.lowChunks += 1;
  if (state.minConfidence === null || conf < state.minConfidence) {
    state.minConfidence = conf;
  }
  return state;
}

/** Reset the state in place — call at the start of each new turn. */
export function resetSttConfidence(state: SttConfidenceState): void {
  state.totalChunks = 0;
  state.lowChunks = 0;
  state.minConfidence = null;
  state.sumConfidence = 0;
}

export interface SttConfidenceSnapshot {
  /** Mean confidence across all chunks (0-1). 1.0 if no chunks observed. */
  mean: number;
  /** Lowest single-chunk confidence (0-1). 1.0 if no chunks observed. */
  min: number;
  /** Fraction of chunks below threshold (0-1). */
  lowFraction: number;
  /** True if the turn-level signal warrants surfacing a hint to the
   *  user. We require both: at least 2 chunks (avoid one-off blips)
   *  AND either ≥30% low-confidence chunks OR mean below the threshold. */
  shouldHint: boolean;
}

export function snapshotSttConfidence(
  state: SttConfidenceState,
): SttConfidenceSnapshot {
  if (state.totalChunks === 0) {
    return { mean: 1, min: 1, lowFraction: 0, shouldHint: false };
  }
  const mean = state.sumConfidence / state.totalChunks;
  const min = state.minConfidence ?? 1;
  const lowFraction = state.lowChunks / state.totalChunks;
  const shouldHint =
    state.totalChunks >= 2 &&
    (lowFraction >= 0.3 || mean < LOW_CONFIDENCE_THRESHOLD);
  return { mean, min, lowFraction, shouldHint };
}
