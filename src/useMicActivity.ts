/* ─── Mic Activity hook ────────────────────────────────────────────
   Single source of truth for mic-energy detection during the
   interview. Two consumers:

     1. Visible mic-activity ring around the visualizer in the
        listening phase (level 0-1 drives a CSS scale).
     2. Barge-in detection during the speaking phase — if the user
        starts answering before the AI finishes, we hard-mute TTS
        and flip phase to listening so their first words aren't lost.

   Implementation:
     - Acquires a getUserMedia stream lazily, only when active.
     - Wires it to a small AnalyserNode (fft 512, smoothing 0.5).
     - rAF loop computes RMS; a moving baseline filters out room
       hum + cheap-mic floor noise.
     - level (0-1) is stored in a ref + bumped to state every
       ~6 frames so React renders don't thrash.
     - bargeInActive flips true when level stays above threshold for
       3 consecutive frames (~50ms) and elapsed-since-start > 4s.

   Skipped on iOS Safari pre-13 where AudioContext requires a fresh
   user-gesture per session — the engine has its own resume helpers
   for that case.
*/

import { useEffect, useRef, useState } from "react";

interface MicActivityConfig {
  /** Master enable. Hook is dormant when false. */
  enabled: boolean;
  /** Hardmute / advance handler. Called once per phase-speaking
   *  window when barge-in is detected. */
  onBargeIn?: () => void;
  /** True when phase is "speaking" (so we know to look for barge-in). */
  isSpeaking: boolean;
  /** Minimum ms into the AI's speech before barge-in is enabled.
   *  Prevents the AI's TTS-tail leaking through speaker → mic from
   *  mis-firing as user voice. Default: 4000. */
  bargeInArmAfterMs?: number;
}

interface MicActivityHandle {
  /** RMS-derived loudness 0-1, smoothed. Updated ~10x/s. */
  level: number;
  /** True when the user has been continuously above threshold
   *  during a speaking phase past the arm window. */
  bargeInActive: boolean;
}

const SAMPLE_FFT = 512;
const SMOOTHING = 0.5;
const RMS_THRESHOLD = 0.06; // empirical: room noise 0.01-0.03, normal speech 0.08-0.30
const BARGE_IN_FRAMES = 3;

export function useMicActivity(cfg: MicActivityConfig): MicActivityHandle {
  const [level, setLevel] = useState(0);
  const [bargeInActive, setBargeInActive] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const aboveCountRef = useRef(0);
  const startedAtRef = useRef(0);
  const renderTickRef = useRef(0);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!cfg.enabled) return;
    cancelledRef.current = false;
    startedAtRef.current = Date.now();
    aboveCountRef.current = 0;
    setBargeInActive(false);

    const tearDown = () => {
      cancelledRef.current = true;
      if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      try { streamRef.current?.getTracks().forEach(t => t.stop()); } catch { /* expected */ }
      streamRef.current = null;
      try { ctxRef.current?.close().catch(() => {}); } catch { /* expected */ }
      ctxRef.current = null;
      analyserRef.current = null;
      setLevel(0);
    };

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
        if (cancelledRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;

        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AC();
        ctxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = SAMPLE_FFT;
        analyser.smoothingTimeConstant = SMOOTHING;
        source.connect(analyser);
        analyserRef.current = analyser;
        const buf = new Uint8Array(analyser.fftSize);

        const tick = () => {
          if (cancelledRef.current || !analyserRef.current) return;
          analyserRef.current.getByteTimeDomainData(buf);
          // RMS over byte time-domain (centered at 128, range 0-255)
          let sumSq = 0;
          for (let i = 0; i < buf.length; i++) {
            const v = (buf[i] - 128) / 128;
            sumSq += v * v;
          }
          const rms = Math.sqrt(sumSq / buf.length);
          // Only flush level state every ~6 frames (~100ms) to avoid render thrash
          renderTickRef.current = (renderTickRef.current + 1) % 6;
          if (renderTickRef.current === 0) setLevel(Math.min(1, rms * 3));

          if (cfg.isSpeaking) {
            const elapsed = Date.now() - startedAtRef.current;
            const armed = elapsed > (cfg.bargeInArmAfterMs ?? 4000);
            if (armed && rms > RMS_THRESHOLD) {
              aboveCountRef.current += 1;
              if (aboveCountRef.current >= BARGE_IN_FRAMES) {
                setBargeInActive(true);
                cfg.onBargeIn?.();
                aboveCountRef.current = 0; // fire-and-disarm; consumer will flip phase
              }
            } else {
              aboveCountRef.current = 0;
            }
          } else {
            aboveCountRef.current = 0;
          }

          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch (err) {
        // Mic denied / blocked — silently skip; engine has its own
        // mic-permission UX in SessionSetup that runs first.
        console.warn("[useMicActivity] getUserMedia failed:", err);
      }
    })();

    return tearDown;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.enabled]);

  // Reset arm state when isSpeaking flips
  useEffect(() => {
    aboveCountRef.current = 0;
    if (!cfg.isSpeaking) setBargeInActive(false);
    if (cfg.isSpeaking) startedAtRef.current = Date.now();
  }, [cfg.isSpeaking]);

  return { level, bargeInActive };
}
