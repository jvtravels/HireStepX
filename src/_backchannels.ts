/* HireStepX — Real-time backchannels (conservative MVP)
 *
 * Real interviewers say "mm-hmm" / "right" while you're talking — at
 * thought-completion boundaries, not at random times. This hook
 * approximates that with strict guards so we don't talk over the user
 * or trigger feedback loops with the mic.
 *
 * GUARDS (all must hold to fire):
 *
 *   1. Feature opt-in: localStorage["hsx-backchannels"] === "on".
 *      Default OFF until we've live-tested for mic feedback.
 *
 *   2. Phase = "listening" + AI voice enabled.
 *
 *   3. User has spoken ≥30 seconds AND ≥40 words this answer.
 *      Avoids firing on a 5-second "yes" or on a brief opener.
 *
 *   4. Detected ≥1.5s of transcript stillness (no new chars in
 *      currentTranscript). That's the "thought-completion" proxy.
 *
 *   5. AT MOST ONE backchannel per question. The softTracking +
 *      ramblingInterject systems handle longer-arc coaching; this
 *      hook is just a single human-feeling acknowledgement.
 *
 *   6. Skip if rambling/softTracking already fired (those are louder
 *      signals; doubling up is noise).
 *
 *   7. Reset on every new question (currentStep change).
 *
 * SAFETY:
 *
 *   - Backchannel lines are ≤2 syllables ("Mm-hmm", "Right.") so
 *     audio playback finishes in <500ms — well under any plausible
 *     pause-resume window.
 *
 *   - We fire after 1.5s stillness, so even if our own audio leaks
 *     into the mic, the STT engine has settled by then.
 *
 *   - If the user resumes typing/speaking within the 1.5s window,
 *     the timer resets — no firing.
 *
 * Default OFF behind a localStorage flag so production users don't
 * see this until we've validated it on real mics in real conditions.
 * To enable for testing:
 *
 *   localStorage.setItem("hsx-backchannels", "on")
 */

import { useEffect, useRef } from "react";

export interface BackchannelHookConfig {
  phase: string;
  aiVoiceEnabled: boolean;
  currentStep: number;
  currentTranscript: string;
  /** Caller (engine) provides the actual TTS speak function so we
      don't import tts.ts directly here — keeps this file pure-ish. */
  speak: (text: string) => Promise<unknown>;
  /** Picked at fire-time from REACTIONS.backchannels. */
  pickLine: () => string;
  /** Refs from existing engine flow — we suppress firing if either
      already fired this question. */
  ramblingFiredRef: React.MutableRefObject<boolean>;
  softTrackFiredRef: React.MutableRefObject<boolean>;
}

const FEATURE_FLAG_KEY = "hsx-backchannels";
const MIN_SECONDS_INTO_ANSWER = 30;
const MIN_WORDS_INTO_ANSWER = 40;
const STILLNESS_MS = 1500;

function isFeatureEnabled(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(FEATURE_FLAG_KEY) === "on";
  } catch {
    return false;
  }
}

export function useBackchannels(cfg: BackchannelHookConfig): void {
  const lastTranscriptChangeRef = useRef(Date.now());
  const lastTranscriptRef = useRef("");
  const firedThisQuestionRef = useRef(false);
  const startedAtRef = useRef(0);
  const checkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset firing state when the question changes
  useEffect(() => {
    firedThisQuestionRef.current = false;
    startedAtRef.current = Date.now();
    lastTranscriptChangeRef.current = Date.now();
    lastTranscriptRef.current = "";
  }, [cfg.currentStep]);

  // Track transcript change times for stillness detection
  useEffect(() => {
    if (cfg.currentTranscript !== lastTranscriptRef.current) {
      lastTranscriptRef.current = cfg.currentTranscript;
      lastTranscriptChangeRef.current = Date.now();
    }
  }, [cfg.currentTranscript]);

  // Main loop — only runs while listening + voice on + feature enabled
  useEffect(() => {
    if (cfg.phase !== "listening" || !cfg.aiVoiceEnabled) {
      if (checkTimerRef.current) { clearInterval(checkTimerRef.current); checkTimerRef.current = null; }
      return;
    }
    if (!isFeatureEnabled()) return;

    checkTimerRef.current = setInterval(() => {
      if (firedThisQuestionRef.current) return;
      if (cfg.ramblingFiredRef.current || cfg.softTrackFiredRef.current) return;

      const secondsIntoAnswer = (Date.now() - startedAtRef.current) / 1000;
      if (secondsIntoAnswer < MIN_SECONDS_INTO_ANSWER) return;

      const wordCount = cfg.currentTranscript.trim().split(/\s+/).filter(Boolean).length;
      if (wordCount < MIN_WORDS_INTO_ANSWER) return;

      const stillness = Date.now() - lastTranscriptChangeRef.current;
      if (stillness < STILLNESS_MS) return;

      // All guards pass — fire ONE backchannel and lock for this question
      firedThisQuestionRef.current = true;
      const line = cfg.pickLine();
      cfg.speak(line).catch(() => { /* fail-silent — not worth surfacing */ });
    }, 500);

    return () => {
      if (checkTimerRef.current) { clearInterval(checkTimerRef.current); checkTimerRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.phase, cfg.aiVoiceEnabled, cfg.currentStep]);
}

/** Exported for tests / DevTools — manually flip the feature flag. */
export function setBackchannelsEnabled(enabled: boolean): void {
  try {
    if (enabled) localStorage.setItem(FEATURE_FLAG_KEY, "on");
    else localStorage.removeItem(FEATURE_FLAG_KEY);
  } catch { /* expected: localStorage may be blocked */ }
}
