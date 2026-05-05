/* HireStepX — Listening-phase interjections
 *
 * Four conversational behaviours that fire while the engine is in the
 * "listening" phase — i.e. waiting for the candidate to answer:
 *
 *   1. Silence nudge (~25s) — "Take your time…" if the candidate hasn't
 *      said anything yet. Suppressed if they're typing in the textarea.
 *   2. Hard-cap stall (60s) — auto-advance with an empty answer if STT
 *      silently failed or the candidate walked away. The interview must
 *      never get stuck forever.
 *   3. Rambling interject (90s + 40 words) — "what was the outcome?".
 *      Hard wrap-it-up signal.
 *   4. Soft tracking (60s + 25 words) — "Mm, I'm with you." Gentle
 *      acknowledgement that the AI is still engaged. Suppressed if
 *      rambling already fired (would feel inconsistent).
 *
 * All four were inline `useEffect`s in useInterviewEngine.ts. Lifted out
 * because (a) the engine was over its 1500 LOC cap, and (b) these four
 * behaviours conceptually belong together — they're the "what the AI
 * does while waiting" cluster, separate from STT, scoring, persistence.
 *
 * The hook owns its timer/fired refs internally and returns the firing
 * refs the backchannel hook needs to coordinate with, plus a reset
 * function the engine calls when starting a new listening phase.
 */

import { useEffect, useRef, type RefObject } from "react";
import { pickRandom, REACTIONS, SILENCE_NUDGES } from "./_interview-engine-helpers";

type Phase = "thinking" | "speaking" | "listening" | "done";
type TranscriptEntry = { speaker: "ai" | "user"; text: string; time: string };
/* Match tts.speak / useToast.toast exactly so we can be passed the engine's
   handles directly without adapter shims. We don't import the concrete types
   because we want this helper to stay decoupled from the TTS module — the
   engine call site is the single integration point. */
type Speak = (
  text: string,
  onEnd: () => void,
  onError: () => void,
  gender?: "male" | "female",
  onDurationKnown?: (ms: number) => void,
) => Promise<{ cancel: () => void }>;
type ToastType = "success" | "error" | "info";
type Toast = (msg: string, kind?: ToastType) => void;
type FormatTime = (s: number) => string;

export interface ListeningInterjectionsConfig {
  phase: Phase;
  aiVoiceEnabled: boolean;
  currentStep: number;
  currentTranscript: string;
  elapsed: number;
  interviewerGender: "male" | "female";
  interviewEndedRef: RefObject<boolean>;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  /** Engine's handleNext (kept in a ref so we don't recreate the effect on every render). */
  handleNextRef: RefObject<(() => void) | null>;
  setTranscript: (updater: (prev: TranscriptEntry[]) => TranscriptEntry[]) => void;
  speak: Speak;
  toast: Toast;
  formatTime: FormatTime;
  /** Optional barge-in ref. The engine creates and owns this so it can
   *  also wrap its STT setter to read the same ref — the hook just
   *  toggles it on/off around the rambling speak() call. */
  bargeInActiveRef?: RefObject<boolean>;
}

export interface ListeningInterjectionsHandle {
  /** Re-arm the silence-nudge guard when the engine enters a fresh listening phase. */
  resetSilenceNudge: () => void;
  /** Backchannel coordination — backchannel hook reads these to avoid stacking. */
  ramblingFiredRef: RefObject<boolean>;
  softTrackFiredRef: RefObject<boolean>;
  /** TRUE while the AI is actively talking over the candidate (mid-answer
   *  interrupt for the rambling cut-off). The engine wraps its STT result
   *  setter to check this ref and discard transcript updates while it's
   *  on, so the AI's own voice doesn't get transcribed back into the
   *  candidate's answer. Goes false again when the interjection finishes
   *  speaking or errors out — never gets stuck on. */
  bargeInActiveRef: RefObject<boolean>;
}

const SILENCE_NUDGE_MS = 25_000;
const STALL_MS = 60_000;
const RAMBLING_MS = 90_000;
const SOFT_TRACK_MS = 60_000;

export function useListeningInterjections(cfg: ListeningInterjectionsConfig): ListeningInterjectionsHandle {
  const {
    phase, aiVoiceEnabled, currentStep, currentTranscript, elapsed,
    interviewerGender, interviewEndedRef, textareaRef, handleNextRef,
    setTranscript, speak, toast, formatTime,
  } = cfg;

  const silenceNudgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceNudgeFiredRef = useRef(false);
  const ramblingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ramblingFiredRef = useRef(false);
  const softTrackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const softTrackFiredRef = useRef(false);
  const lastTranscriptChangeRef = useRef(0);
  /* The engine owns the canonical barge-in ref (so it can also wrap its
     STT setter against it). If not provided, we fall back to a local ref
     so the hook still works in isolation / in tests. */
  const localBargeInRef = useRef(false);
  const bargeInActiveRef = cfg.bargeInActiveRef ?? localBargeInRef;

  /* ── 1. Silence nudge ──────────────────────────────────────────── */
  useEffect(() => {
    if (phase !== "listening" || !aiVoiceEnabled) {
      if (silenceNudgeTimerRef.current) { clearTimeout(silenceNudgeTimerRef.current); silenceNudgeTimerRef.current = null; }
      return;
    }
    silenceNudgeFiredRef.current = false;
    lastTranscriptChangeRef.current = Date.now();
    /* Silence nudge bumped 15s → 25s. The 15s threshold fired too
       aggressively in real conditions — many candidates take 10-15s to
       gather their first thought, and getting nudged at 15s reads as
       "you're being slow", which spikes anxiety. 25s is closer to the
       point where silence becomes genuinely awkward without rushing
       thinkers. The "smart skip" check below additionally suppresses
       the nudge if the user is actively typing in the textarea — they
       aren't silent, they're choosing the keyboard. */
    const startNudgeTimer = () => {
      if (silenceNudgeTimerRef.current) clearTimeout(silenceNudgeTimerRef.current);
      silenceNudgeTimerRef.current = setTimeout(() => {
        if (silenceNudgeFiredRef.current || interviewEndedRef.current) return;
        // Smart skip — user is composing in the textarea, not silent
        const ta = textareaRef.current;
        if (ta && document.activeElement === ta && ta.value.trim().length > 0) {
          startNudgeTimer();
          return;
        }
        // Only nudge if user has been actually silent (no transcript change)
        const silenceDuration = Date.now() - lastTranscriptChangeRef.current;
        if (silenceDuration < SILENCE_NUDGE_MS - 1000) {
          startNudgeTimer();
          return;
        }
        silenceNudgeFiredRef.current = true;
        const nudge = pickRandom(SILENCE_NUDGES);
        setTranscript(prev => [...prev, { speaker: "ai", text: `[${nudge}]`, time: formatTime(elapsed) }]);
        speak(nudge, () => {}, () => {}, interviewerGender).catch(() => {});
      }, SILENCE_NUDGE_MS);
    };
    startNudgeTimer();
    return () => {
      if (silenceNudgeTimerRef.current) { clearTimeout(silenceNudgeTimerRef.current); silenceNudgeTimerRef.current = null; }
    };
    // The nudge fires from a timeout at 25s; we read the latest `elapsed` and `interviewerGender` inside the timeout callback. Adding them as deps would reset the silence timer every second.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, aiVoiceEnabled, currentStep]);

  /* ── 1b. Reset silence nudge when user starts speaking ─────────── */
  useEffect(() => {
    if (phase !== "listening" || !aiVoiceEnabled || !currentTranscript) return;
    lastTranscriptChangeRef.current = Date.now();
    if (silenceNudgeTimerRef.current) { clearTimeout(silenceNudgeTimerRef.current); silenceNudgeTimerRef.current = null; }
    silenceNudgeFiredRef.current = true; // Don't nudge once they've started
  }, [currentTranscript, phase, aiVoiceEnabled]);

  /* ── 2. Hard-cap on dead silence (60s) ─────────────────────────── */
  useEffect(() => {
    if (phase !== "listening") return;
    const stallTimer = setTimeout(() => {
      if (interviewEndedRef.current) return;
      const silenceDuration = Date.now() - lastTranscriptChangeRef.current;
      if (silenceDuration >= STALL_MS && !currentTranscript) {
        console.warn("[interview] listening phase stalled 60s — auto-advancing");
        if (handleNextRef.current) handleNextRef.current();
      }
    }, STALL_MS);
    return () => clearTimeout(stallTimer);
    // handleNextRef is a ref — never changes identity, excluded intentionally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentStep, currentTranscript]);

  /* ── 3. Rambling interject (90s + 40 words) — talks OVER the candidate
        ──────────────────────────────────────────────────────────────────
     Real interviewers cut you off when you've been going for 90 seconds
     with no end in sight. We do the same: speak the interjection on top
     of the candidate's voice, and flip `bargeInActiveRef` so the engine
     discards STT input for the duration — otherwise the AI's own voice
     gets transcribed back into the answer through the speaker→mic loop.
     The flag is always cleared in a finally so it can never get stuck on. */
  useEffect(() => {
    if (phase !== "listening" || !aiVoiceEnabled) {
      if (ramblingTimerRef.current) { clearTimeout(ramblingTimerRef.current); ramblingTimerRef.current = null; }
      ramblingFiredRef.current = false;
      return;
    }
    ramblingFiredRef.current = false;
    ramblingTimerRef.current = setTimeout(() => {
      if (ramblingFiredRef.current || interviewEndedRef.current) return;
      if (!currentTranscript || currentTranscript.trim().split(/\s+/).length < 40) return;
      ramblingFiredRef.current = true;
      const interjection = pickRandom(REACTIONS.ramblingInterject);
      setTranscript(prev => [...prev, { speaker: "ai", text: `[${interjection}]`, time: formatTime(elapsed) }]);
      toast("Tip: Keep answers under 90 seconds for best impact.", "info");

      bargeInActiveRef.current = true;
      const finishBargeIn = () => { bargeInActiveRef.current = false; };
      speak(interjection, finishBargeIn, finishBargeIn, interviewerGender)
        .catch(() => { bargeInActiveRef.current = false; });
    }, RAMBLING_MS);
    return () => {
      if (ramblingTimerRef.current) { clearTimeout(ramblingTimerRef.current); ramblingTimerRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, aiVoiceEnabled, currentStep]);

  /* ── 4b. End-of-turn auto-submit ────────────────────────────────────
     Real interviewers detect end-of-turn from prosody + silence and
     start responding without waiting for the candidate to consciously
     "submit". Forcing the user to remember to press Space breaks the
     conversational illusion (it's an app pattern, not a conversation
     pattern).

     Heuristic:
       • User has produced a meaningful answer (≥ 10 words)
       • Transcript hasn't changed for 1.8 seconds
       • Phase is still "listening"
       • Rambling/soft-track haven't already preempted us
     Then call handleNextRef.current() to submit the turn.

     1.8s is the sweet spot from VAD literature — long enough that a
     thinking-pause ("hmm... well...") doesn't false-trigger, short
     enough that the AI doesn't feel slow to respond. Users who pause
     longer to think can re-trigger STT by speaking again; the timer
     resets on every transcript change. */
  const autoSubmitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSubmitFiredRef = useRef(false);
  useEffect(() => { autoSubmitFiredRef.current = false; }, [currentStep]);
  useEffect(() => {
    if (phase !== "listening") {
      if (autoSubmitTimerRef.current) { clearTimeout(autoSubmitTimerRef.current); autoSubmitTimerRef.current = null; }
      return;
    }
    if (autoSubmitFiredRef.current) return;
    if (autoSubmitTimerRef.current) clearTimeout(autoSubmitTimerRef.current);
    const wordCount = currentTranscript.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount < 10) return;
    autoSubmitTimerRef.current = setTimeout(() => {
      if (autoSubmitFiredRef.current || interviewEndedRef.current) return;
      // Re-check at fire-time: if user resumed talking inside the
      // 1.8s window, the deps changed and a new timer was scheduled
      // — this old one will only fire if it survived.
      const ta = textareaRef.current;
      if (ta && document.activeElement === ta) return; // user typing — don't auto-submit
      const finalWordCount = currentTranscript.trim().split(/\s+/).filter(Boolean).length;
      if (finalWordCount < 10) return;
      autoSubmitFiredRef.current = true;
      console.info(`[interview] auto-submit on 1.8s silence (${finalWordCount} words)`);
      handleNextRef.current?.();
    }, 1800);
    return () => {
      if (autoSubmitTimerRef.current) { clearTimeout(autoSubmitTimerRef.current); autoSubmitTimerRef.current = null; }
    };
    // handleNextRef + textareaRef are refs — stable identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentStep, currentTranscript]);

  /* ── 4. Soft tracking (60s + 25 words) ─────────────────────────── */
  useEffect(() => {
    if (phase !== "listening" || !aiVoiceEnabled) {
      if (softTrackTimerRef.current) { clearTimeout(softTrackTimerRef.current); softTrackTimerRef.current = null; }
      softTrackFiredRef.current = false;
      return;
    }
    softTrackFiredRef.current = false;
    softTrackTimerRef.current = setTimeout(() => {
      if (softTrackFiredRef.current || ramblingFiredRef.current || interviewEndedRef.current) return;
      if (!currentTranscript || currentTranscript.trim().split(/\s+/).length < 25) return;
      softTrackFiredRef.current = true;
      const tracking = pickRandom(REACTIONS.softTracking);
      setTranscript(prev => [...prev, { speaker: "ai", text: `[${tracking}]`, time: formatTime(elapsed) }]);
      speak(tracking, () => {}, () => {}, interviewerGender).catch(() => {});
    }, SOFT_TRACK_MS);
    return () => {
      if (softTrackTimerRef.current) { clearTimeout(softTrackTimerRef.current); softTrackTimerRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, aiVoiceEnabled, currentStep]);

  return {
    resetSilenceNudge: () => { silenceNudgeFiredRef.current = false; },
    ramblingFiredRef,
    softTrackFiredRef,
    bargeInActiveRef,
  };
}
