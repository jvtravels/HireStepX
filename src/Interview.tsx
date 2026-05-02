"use client";
import { useEffect, useRef, useState } from "react";
import { e, ef } from "./interviewTokens";
import {
  StatusToasts, PanelAvatarStage,
  CompletionCard, MicroFeedbackPanel,
  TranscriptPanel, EndModal, EvaluatingOverlay,
  DealSummaryCard, AnnotatedReplayPanel, NegotiationLiveDashboard,
  SaveToast, RepeatButton, MicQuietBanner, ReconnectingOverlay,
  PaceMeter, InterviewCoachmarks,
} from "./InterviewPanels";
import {
  CanvasWordmark, CanvasContextChip, CanvasProgressDots, CanvasStatusPill,
  CanvasMuteToggle, CanvasCameraToggle, CanvasAvatar,
  CanvasVoiceVisualizer, CanvasPersonaLabel, CanvasPlainHeading,
  CanvasEditorialHeading,
  CanvasQuestionText, CanvasHintBubble, CanvasTextLink,
  CanvasSkipLink,
  CanvasMetaRow, CanvasEndButton, CanvasSelfViewTile,
  type CanvasVizState, type CanvasPersonaState, type CanvasConnectionStatus,
} from "./InterviewCanvasAtoms";
import { LiveCaptions } from "./InterviewComponents";
import { useInterviewEngine } from "./useInterviewEngine";
import { useVideoRecorder } from "./useVideoRecorder";
import { InterviewProvider } from "./InterviewContext";
import ErrorBoundary from "./ErrorBoundary";
import { captureClientEvent } from "./posthogClient";

/* ═══════════════════════════════════════════════
   INTERVIEW SCREEN
   Wraps with InterviewProvider so any child component
   can call useInterview() instead of receiving props.
   ═══════════════════════════════════════════════ */
/**
 * Preconnect to the TTS + STT providers the moment the user lands on /interview.
 * Previously these hints lived in app/layout.tsx and fired on every page load,
 * wasting a TCP+TLS handshake per tab for routes that never touch audio.
 * Now they fire exactly once per interview session, right before the APIs are
 * hit — which saves ~50-150ms on the first TTS playback.
 */
function addInterviewPreconnects() {
  if (typeof document === "undefined") return;
  const hosts = ["https://api.cartesia.ai", "https://api.deepgram.com"];
  for (const href of hosts) {
    if (document.querySelector(`link[rel="preconnect"][href="${href}"]`)) continue;
    const link = document.createElement("link");
    link.rel = "preconnect";
    link.href = href;
    link.crossOrigin = "anonymous";
    document.head.appendChild(link);
  }
}

/**
 * Top-level wrapper: any unhandled throw from the interview engine, TTS, STT,
 * evaluator, or a render-time null-deref propagates into this boundary instead
 * of unmounting the page with a blank screen. The boundary's fallback UI gives
 * the user a "Start over / Go to dashboard" path, and logs the error to
 * /api/log-error so we see these in production.
 */
export default function Interview() {
  return (
    <ErrorBoundary>
      <InterviewInner />
    </ErrorBoundary>
  );
}

/**
 * Mobile resilience: resume any suspended AudioContexts when the tab comes
 * back to foreground or the device rotates. iOS Safari routinely suspends
 * AudioContext on backgrounding / orientation change, which silently breaks
 * TTS playback mid-interview without any visible error. Walking the global
 * set is ugly but there's no clean way to enumerate them; we tag the ones
 * we create and resume those.
 */
function useMobileAudioResilience() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const resumeSuspended = () => {
      // tts.ts stashes its AudioContext on window.__hirestepxAudioCtx when
      // available. If that pattern isn't in place yet, this is a no-op —
      // cheap and safe. The real fix is in tts.ts itself but this covers
      // the rotation-kills-voice case without refactoring the audio path.
      const globalCtx = (window as unknown as { __hirestepxAudioCtx?: AudioContext }).__hirestepxAudioCtx;
      if (globalCtx && globalCtx.state === "suspended") {
        globalCtx.resume().catch(() => { /* expected: resume may fail if user gesture required */ });
      }
    };

    const onVisibility = () => { if (document.visibilityState === "visible") resumeSuspended(); };
    const onOrientation = () => { setTimeout(resumeSuspended, 200); };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("orientationchange", onOrientation);
    // Modern API replacement for orientationchange; not all browsers support it
    const screenOrientation = (screen as Screen & { orientation?: { addEventListener: typeof addEventListener; removeEventListener: typeof removeEventListener } }).orientation;
    screenOrientation?.addEventListener?.("change", onOrientation);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("orientationchange", onOrientation);
      screenOrientation?.removeEventListener?.("change", onOrientation);
    };
  }, []);
}

/* Map engine phase → canvas visualizer state.
   Listening only flips to user-speaking once the user actually starts
   talking (currentTranscript has content). Empty listening = idle =
   gray dots, matching the canvas "your-turn" baseline. */
function vizState(phase: string, hasTranscript: boolean): CanvasVizState {
  if (phase === "speaking") return "ai-speaking";
  if (phase === "thinking") return "ai-thinking";
  if (phase === "listening") return hasTranscript ? "user-speaking" : "idle";
  return "idle";
}

/* Map engine phase → canvas persona-label state. Same gating as
   vizState — "your-turn" before the user speaks, "you-speaking" after. */
function personaState(phase: string, hasTranscript: boolean): CanvasPersonaState {
  if (phase === "speaking") return "speaking";
  if (phase === "thinking") return "thinking";
  if (phase === "listening") return hasTranscript ? "you-speaking" : "your-turn";
  return "your-turn";
}

/* Map engine offline → canvas connection-status pill */
function mapConnectionStatus(isOffline: boolean): CanvasConnectionStatus {
  return isOffline ? "offline" : "good";
}

/* ── Italic-copper accent extraction ──────────────────────────────
   The canvas heading is "<plain> <italic-copper> <plain>." with one
   accent word picked from the question. Without LLM cooperation we
   pick a heuristic: the first noun/verb-shaped non-stopword that's
   ≥4 chars, preferring known editorial words. Falls back to the
   plain heading if no good candidate is found. */
const ACCENT_PRIORITY = new Set([
  "time", "decision", "challenge", "conflict", "mistake", "failure", "success",
  "leader", "leadership", "led", "convince", "persuade", "negotiate", "rate-limiter",
  "design", "build", "ship", "deliver", "fix", "solve", "improve", "scale",
  "regret", "proud", "learned", "taught", "changed", "impact",
  "why", "how", "when", "what", "where",
  "easy", "hard", "tough", "specific", "team", "project", "story", "example",
  "ready", "workable", "size", "reason",
]);
const STOPWORDS = new Set([
  "a","an","the","of","to","in","on","at","by","for","with","from","is","are",
  "was","were","be","been","being","have","has","had","do","does","did","and",
  "or","but","not","that","this","it","its","i","you","we","they","he","she",
  "tell","me","about","walk","through","describe","share","talk","discuss",
  "your","yours","mine","my","our","ours","their","theirs","his","her","hers",
  "can","could","would","should","will","may","might","just","only","also",
]);
function pickAccent(text: string): { before: string; accent: string; after: string } | null {
  if (!text) return null;
  // Strip a leading bracketed persona tag like "[HR Partner] " before scanning
  const cleaned = text.replace(/^\[[^\]]+\]\s*/, "");
  // Tokenize with positions so we can rebuild with exact spacing
  const tokenRegex = /[\p{L}\p{N}][\p{L}\p{N}'-]*/gu;
  const tokens: { word: string; start: number; end: number }[] = [];
  for (const match of cleaned.matchAll(tokenRegex)) {
    if (typeof match.index !== "number") continue;
    tokens.push({ word: match[0], start: match.index, end: match.index + match[0].length });
  }
  if (tokens.length < 3) return null;
  // First pass: prefer words from ACCENT_PRIORITY
  let chosen = tokens.find(t => ACCENT_PRIORITY.has(t.word.toLowerCase()));
  // Second pass: longest non-stopword ≥ 4 chars, skipping the first token
  if (!chosen) {
    const candidates = tokens.slice(1).filter(t => t.word.length >= 4 && !STOPWORDS.has(t.word.toLowerCase()));
    if (candidates.length === 0) return null;
    chosen = candidates.reduce((a, b) => (b.word.length > a.word.length ? b : a));
  }
  if (!chosen) return null;
  const before = cleaned.slice(0, chosen.start).replace(/\s+$/, "");
  const after = cleaned.slice(chosen.end).replace(/^\s+/, "").replace(/[.!?]+\s*$/, "");
  // Don't bother if accent is the only word or both before/after are empty
  if (!before && !after) return null;
  return { before, accent: chosen.word, after };
}

/* Count actual back-and-forth exchanges (AI question + user answer pairs)
   from the engine's transcript array — not the question number. */
function countExchanges(transcript: Array<{ speaker: string }>): number {
  if (!transcript || transcript.length === 0) return 0;
  // An "exchange" = one user reply. Count user messages.
  return transcript.filter(m => m.speaker === "user").length;
}

/* LiveCaptions wrapped to render inside the editorial heading slot.
   Reuses the existing TTS-synced typewriter logic but inherits the
   parent <h1>'s serif typography. */
function LiveCaptionsAsHeading({ text, ttsDurationMs, speakingDuration, speechEnded }: {
  text: string;
  ttsDurationMs?: number;
  speakingDuration?: number;
  speechEnded?: boolean;
}) {
  return (
    <span style={{ display: "inline" }}>
      <LiveCaptions
        text={text}
        isTyping
        speakingDuration={speakingDuration}
        actualDuration={ttsDurationMs}
        speechEnded={speechEnded}
      />
    </span>
  );
}

/* CanvasListeningActionZone — production action zone matching the canvas:
   live transcript card → KeycapButton CTA → "or type / Skip" links →
   HintBubble. Replaces the old green-tinted UserAnswerArea card.

   Press-Space-when-done UX: engine still auto-listens via STT, so the
   keycap is a "send" affordance rather than true push-to-talk. Pressing
   Space (when not focused on the textarea) calls handleNextQuestion. */
function CanvasListeningActionZone({
  currentTranscript, setCurrentTranscript,
  speechUnavailable, setSpeechUnavailable,
  handleNextQuestion, textareaRef, nextBtnRef,
  isMuted, micQuiet, isCurrentFollowUp,
  replayQuestion, aiVoiceEnabled, hasQuestion,
}: {
  currentTranscript: string;
  setCurrentTranscript: (v: string) => void;
  speechUnavailable: boolean;
  setSpeechUnavailable: (v: boolean) => void;
  handleNextQuestion: () => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  nextBtnRef: React.RefObject<HTMLButtonElement | null>;
  isMuted: boolean;
  micQuiet: boolean;
  isCurrentFollowUp?: boolean;
  replayQuestion: () => void;
  aiVoiceEnabled: boolean;
  hasQuestion: boolean;
}) {
  const [typing, setTyping] = useState(speechUnavailable);
  // Per-answer timer for the PaceMeter — local, resets when remounts
  const [answerSeconds, setAnswerSeconds] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => setAnswerSeconds(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  // Press Space (outside textarea) to send the answer — matches the
  // canvas KeycapButton affordance even though STT is auto-listening.
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.code !== "Space") return;
      const target = ev.target as HTMLElement | null;
      if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT" || (target as HTMLElement).isContentEditable)) return;
      if (!currentTranscript.trim()) return;
      ev.preventDefault();
      handleNextQuestion();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentTranscript, handleNextQuestion]);
  const canSend = currentTranscript.trim().length > 0;
  const showTyping = typing || speechUnavailable;
  return (
    <div style={{ width: "100%", maxWidth: 620, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      {/* Live transcript card — only if we have something */}
      {currentTranscript && !showTyping && (
        <div role="log" aria-live="polite" aria-label="Live transcript of your answer" style={{
          width: "100%", background: e.white, border: `1px solid ${e.line}`,
          borderRadius: 14, padding: "14px 16px",
          fontFamily: ef.serif, fontSize: 15, lineHeight: 1.55, color: e.coal,
          minHeight: 72, maxHeight: 160, overflowY: "auto", textAlign: "left",
          boxShadow: "0 1px 0 rgba(20,17,10,.03), 0 1px 2px rgba(20,17,10,.04), 0 12px 32px -16px rgba(20,17,10,.10)",
        }}>
          <span style={{ fontFamily: ef.mono, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.4, color: e.copper, display: "block", marginBottom: 6 }}>
            Live transcript
          </span>
          <span>{currentTranscript}</span>
        </div>
      )}

      {/* Type-mode textarea fallback */}
      {showTyping && (
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
          <textarea
            ref={textareaRef}
            value={currentTranscript}
            onChange={(ev) => setCurrentTranscript(ev.target.value)}
            placeholder="Type your answer…"
            maxLength={3000}
            style={{
              width: "100%", minHeight: 120, padding: "14px 16px",
              fontFamily: ef.sans, fontSize: 15, lineHeight: 1.55, color: e.coal,
              background: e.white, border: `1px solid ${e.line}`, borderRadius: 14,
              resize: "vertical", outline: "none",
              boxShadow: "0 1px 0 rgba(20,17,10,.03), 0 1px 2px rgba(20,17,10,.04)",
            }}
          />
          {!speechUnavailable && (
            <CanvasTextLink onClick={() => { setTyping(false); }}>
              switch back to voice
            </CanvasTextLink>
          )}
        </div>
      )}

      {/* Pace meter — only when actually answering */}
      {currentTranscript.trim().length > 0 && (
        <div style={{ width: "100%", maxWidth: 280 }}>
          <PaceMeter seconds={answerSeconds} />
        </div>
      )}

      {/* Mic-quiet banner */}
      {micQuiet && !speechUnavailable && !isMuted && !showTyping && (
        <MicQuietBanner onSwitchToText={() => { setTyping(true); setSpeechUnavailable(true); textareaRef.current?.focus(); }} />
      )}

      {/* Primary CTA — keycap button matching the canvas */}
      <button
        ref={nextBtnRef}
        type="button"
        onClick={handleNextQuestion}
        disabled={!canSend}
        aria-label="Send answer (or press Space)"
        className="hsx-iv-keycap"
        data-state={canSend ? "ready" : "disabled"}
        style={{
          display: "inline-flex", alignItems: "center", gap: 12,
          fontFamily: ef.sans, fontSize: 13, fontWeight: 500,
          color: canSend ? e.cream : e.coal,
          background: canSend ? e.indigo : e.white,
          border: `1px solid ${canSend ? e.indigo : e.line}`,
          borderRadius: 999, padding: "10px 18px 10px 12px",
          cursor: canSend ? "pointer" : "not-allowed",
          opacity: canSend ? 1 : 0.7,
          transition: "all 180ms cubic-bezier(0.16, 1, 0.3, 1)",
          boxShadow: canSend
            ? "0 6px 20px -6px rgba(49,46,129,0.40)"
            : "0 1px 0 rgba(20,17,10,.04), 0 1px 2px rgba(20,17,10,.04)",
        }}
      >
        <kbd aria-hidden style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          minWidth: 56, height: 24, padding: "0 8px",
          background: canSend ? "rgba(250,247,240,0.20)" : e.creamSoft,
          border: `1px solid ${canSend ? "rgba(250,247,240,0.30)" : e.line}`,
          borderRadius: 6, fontFamily: ef.mono, fontSize: 11, fontWeight: 500,
          color: canSend ? e.cream : e.inkSoft, letterSpacing: 0.6,
        }}>
          Space
        </kbd>
        <span>{canSend ? "Press Space when done" : "Start speaking…"}</span>
      </button>

      {/* Secondary action row — type / repeat / skip */}
      <div style={{ display: "inline-flex", alignItems: "center", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
        {!showTyping && (
          <>
            <CanvasTextLink onClick={() => { setTyping(true); textareaRef.current?.focus(); }}>
              or type your answer instead
            </CanvasTextLink>
            <span aria-hidden style={{ color: e.inkFaint }}>·</span>
          </>
        )}
        {hasQuestion && aiVoiceEnabled && (
          <>
            <RepeatButton onClick={replayQuestion} />
            <span aria-hidden style={{ color: e.inkFaint }}>·</span>
          </>
        )}
        <CanvasSkipLink onClick={handleNextQuestion} />
      </div>

      {/* Hint */}
      {isCurrentFollowUp && (
        <CanvasHintBubble>This is a follow-up — be specific.</CanvasHintBubble>
      )}
    </div>
  );
}

function InterviewInner() {
  useEffect(() => { addInterviewPreconnects(); }, []);
  useMobileAudioResilience();
  const engine = useInterviewEngine();
  const video = useVideoRecorder();

  const {
    phase, step, currentStep, llmLoading, elapsed,
    speechUnavailable, isMuted, showTranscript, transcript,
    showEndModal, tabConflict, isOffline, micError,
    usedFallbackScore, evalTimedOut, lastSessionId,
    evaluating, evalElapsed, aiVoiceEnabled,
    currentTranscript, microFeedback,
    totalQuestions, baseQuestionCount, currentQuestionNum, isCurrentFollowUp,
    displayRole, displayCompany, displayFocus, interviewerName,
    isPanelInterview, panelMembers, activePersona,
    ttsDurationMs, speechEnded,
    saveWarning,
    isSalaryNegotiation, negotiationBand, negotiationStyle,
    targetSalary, highestOffer, liveNegotiationState, voiceConfidence,

    setCurrentTranscript, setSpeechUnavailable, setIsMuted,
    setShowTranscript, setShowEndModal,
    setEvalTimedOut, setUsedFallbackScore, setEvaluating,

    handleNextQuestion, skipSpeaking, handleEnd, navigate, replayQuestion,
    micQuiet, reconnecting, reconnectAttempt,

    transcriptRef, endModalTriggerRef, textareaRef, nextBtnRef,
    ttsCancelRef, interviewEndedRef,
  } = engine;


  // Track interview abandonment — fires when user leaves before handleEnd runs
  useEffect(() => {
    const onUnload = () => {
      if (!interviewEndedRef.current && phase !== "done" && currentStep > 0) {
        captureClientEvent("interview_abandoned", {
          questions_answered: currentStep,
          total_questions: totalQuestions,
          elapsed_seconds: elapsed,
          phase,
        });
      }
    };
    window.addEventListener("pagehide", onUnload);
    return () => {
      window.removeEventListener("pagehide", onUnload);
      onUnload();
    };
  }, [phase, currentStep, totalQuestions, elapsed, interviewEndedRef]);

  // Stop video recording when interview ends
  const { isRecording: videoIsRecording, stopRecording: videoStopRecording } = video;
  useEffect(() => {
    if (engine.phase === "done" && videoIsRecording) {
      videoStopRecording();
    }
  }, [engine.phase, videoIsRecording, videoStopRecording]);

  /* ── Auto-save toast ─────────────────────────────────────────────
     Fires a 2.5s "Answer saved" pulse each time a new answer is
     captured (detected via currentStep advancement after listening).
     Pure visual feedback — the engine already persists via IDB.

     Capped at SAVE_TOAST_MAX_SHOWS to avoid notification fatigue:
     after the user has seen the same toast 3 times they understand
     the pattern; further toasts are noise. */
  const SAVE_TOAST_MAX_SHOWS = 3;
  const [showSaveToast, setShowSaveToast] = useState(false);
  const lastSavedStepRef = useRef<number>(-1);
  const saveToastShownCountRef = useRef<number>(0);
  const prevPhaseRef = useRef<string>(phase);
  useEffect(() => {
    // Trigger when phase moves out of "listening" with a new step count
    const justSaved = prevPhaseRef.current === "listening" && phase !== "listening" && currentStep !== lastSavedStepRef.current && currentStep > 0;
    prevPhaseRef.current = phase;
    if (!justSaved) return;
    lastSavedStepRef.current = currentStep;
    if (saveToastShownCountRef.current >= SAVE_TOAST_MAX_SHOWS) return;
    saveToastShownCountRef.current += 1;
    setShowSaveToast(true);
    const timeout = setTimeout(() => setShowSaveToast(false), 2500);
    return () => clearTimeout(timeout);
  }, [phase, currentStep]);

  return (
    <InterviewProvider value={engine}>
    <div style={{
      width: "100vw", height: "100vh", background: e.cream,
      display: "flex", flexDirection: "column", overflow: "hidden",
      fontFamily: ef.sans, color: e.coal,
    }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes recordPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @media (max-width: 600px) {
          .iv-info-bar { flex-wrap: wrap; gap: 8px !important; padding: 10px 16px !important; }
          .iv-center { padding: 16px !important; }
          .iv-controls { padding: 8px 12px !important; gap: 6px !important; }
          .iv-controls button { min-width: 48px !important; min-height: 48px !important; }
          .iv-controls .iv-hide-mobile { display: none !important; }
          .iv-transcript-panel { width: 100% !important; max-width: none !important; position: fixed !important; bottom: 0 !important; top: auto !important; right: 0 !important; left: 0 !important; height: 60vh !important; border-radius: 20px 20px 0 0 !important; animation: slideUpSheet 0.35s cubic-bezier(0.16, 1, 0.3, 1) both !important; }
          /* Video preview default is 160×120 — 43% of a 375px viewport.
             Shrinks to ~90px to stay out of the way of the main stage. */
          .iv-video-preview { width: 90px !important; height: 68px !important; top: 64px !important; right: 8px !important; }
        }
        @keyframes slideUpSheet { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @media (hover: none) and (pointer: coarse) {
          .iv-controls button { -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
        }
      `}</style>

      {/* First-time onboarding — three quick callouts, then never again */}
      <InterviewCoachmarks />

      <StatusToasts tabConflict={tabConflict} isOffline={isOffline} micError={micError} />

      {/* ═════════════════════════════════════════════════════════════
          TOPBAR — canvas composition
          Wordmark · ContextChip   ProgressDots   StatusPill ·
                                                  Mute · Camera · Avatar
          ═════════════════════════════════════════════════════════════ */}
      <header className="iv-canvas-topbar" style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "18px 32px", gap: 16,
        borderBottom: `1px solid ${e.line}`, background: e.cream,
        flexShrink: 0, zIndex: 10,
      }}>
        <div className="iv-canvas-topbar-left" style={{ display: "inline-flex", alignItems: "center", gap: 16 }}>
          <CanvasWordmark />
          <span aria-hidden style={{ width: 1, height: 18, background: e.line, display: "inline-block" }} />
          <CanvasContextChip
            role={displayRole || "Interview practice"}
            company={displayCompany || ""}
            focus={displayFocus || (isSalaryNegotiation ? "Negotiation" : isPanelInterview ? "Panel" : "General")}
          />
        </div>
        <div className="iv-canvas-mobile-hide">
          <CanvasProgressDots
            current={Math.max(1, Math.min(currentQuestionNum, baseQuestionCount || totalQuestions))}
            total={baseQuestionCount || totalQuestions}
          />
        </div>
        <div className="iv-canvas-topbar-right" style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          <div className="iv-canvas-mobile-hide">
            <CanvasStatusPill status={mapConnectionStatus(isOffline)} />
          </div>
          <CanvasMuteToggle muted={isMuted} onClick={() => setIsMuted(m => !m)} />
          <CanvasCameraToggle on={video.videoEnabled} onClick={video.toggleVideo} />
          <CanvasAvatar />
        </div>
      </header>

      {/* ═════════════════════════════════════════════════════════════
          STAGE — canvas composition
          ═════════════════════════════════════════════════════════════ */}
      <main className="iv-canvas-stage" style={{
        flex: 1,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "flex-start",
        gap: 22, padding: "32px 48px",
        position: "relative", overflow: "auto",
      }}>
        {/* Question heading — heuristic-driven italic-copper accent.
            During phase=speaking we render plain serif because the
            LiveCaptions typewriter would fight with the inline accent
            mid-stream. Once speech ends and we're listening, the accent
            renders. */}
        {step?.aiText && phase !== "done" && (
          <div style={{ maxWidth: 620, width: "100%" }}>
            {phase === "speaking" ? (
              <CanvasPlainHeading>
                <LiveCaptionsAsHeading
                  text={step.aiText}
                  ttsDurationMs={ttsDurationMs}
                  speakingDuration={step.speakingDuration}
                  speechEnded={speechEnded}
                />
              </CanvasPlainHeading>
            ) : (() => {
              const accent = pickAccent(step.aiText);
              return accent ? (
                <CanvasEditorialHeading
                  before={accent.before}
                  accent={accent.accent}
                  after={accent.after}
                />
              ) : (
                <CanvasPlainHeading>{step.aiText}</CanvasPlainHeading>
              );
            })()}
            {step?.scoreNote && phase !== "thinking" && (
              <div style={{ marginTop: 12 }}>
                <CanvasQuestionText>{step.scoreNote}</CanvasQuestionText>
              </div>
            )}
          </div>
        )}

        {/* Visualizer in its soft disc + halo + voice rings while listening */}
        {phase !== "done" && (
          <div style={{
            position: "relative",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 220, height: 220, borderRadius: 999,
            background: "radial-gradient(closest-side, rgba(255,255,255,0.7), rgba(244,239,227,0.4) 70%, transparent 100%)",
          }}>
            <span className={`hsx-viz-halo hsx-viz-halo--${vizState(phase, currentTranscript.trim().length > 0)}`} />
            {phase === "listening" && (
              <>
                <span className="hsx-iv-ring" />
                <span className="hsx-iv-ring hsx-iv-ring--delay" />
              </>
            )}
            <CanvasVoiceVisualizer state={vizState(phase, currentTranscript.trim().length > 0)} size={150} />
          </div>
        )}

        {/* Persona name + state */}
        {phase !== "done" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, minHeight: 52 }}>
            <CanvasPersonaLabel
              name={isPanelInterview && activePersona ? activePersona : interviewerName}
              state={personaState(phase, currentTranscript.trim().length > 0)}
            />
          </div>
        )}

        {/* Salary-negotiation live dashboard slots above the action zone */}
        {isSalaryNegotiation && liveNegotiationState && phase !== "done" && (
          <NegotiationLiveDashboard
            liveState={liveNegotiationState}
            negotiationBand={negotiationBand}
            highestOffer={highestOffer}
            targetSalary={targetSalary}
            voiceConfidence={voiceConfidence}
            negotiationStyle={negotiationStyle}
          />
        )}

        {/* Action zone — listening: canvas composition.
            Renders the live STT transcript card, type-mode textarea
            fallback, KeycapButton CTA (Press Space when done), and
            "or type" / Skip links. Engine wiring preserved via
            currentTranscript / setCurrentTranscript / textareaRef /
            handleNextQuestion / setSpeechUnavailable. */}
        {phase === "listening" && (
          <CanvasListeningActionZone
            currentTranscript={currentTranscript}
            setCurrentTranscript={setCurrentTranscript}
            speechUnavailable={speechUnavailable}
            setSpeechUnavailable={setSpeechUnavailable}
            handleNextQuestion={handleNextQuestion}
            textareaRef={textareaRef}
            nextBtnRef={nextBtnRef}
            isMuted={isMuted}
            micQuiet={micQuiet}
            isCurrentFollowUp={isCurrentFollowUp}
            replayQuestion={replayQuestion}
            aiVoiceEnabled={aiVoiceEnabled}
            hasQuestion={!!step?.aiText}
          />
        )}

        {phase === "speaking" && (
          <button
            type="button"
            onClick={skipSpeaking}
            style={{
              fontFamily: ef.sans, fontSize: 12, fontWeight: 500, color: e.inkSoft,
              background: e.white, border: `1px solid ${e.line}`,
              borderRadius: 999, padding: "8px 16px", minHeight: 36,
              cursor: "pointer", transition: "all 160ms ease",
              display: "inline-flex", alignItems: "center", gap: 6,
            }}
            onMouseEnter={(ev) => { ev.currentTarget.style.background = e.creamSoft; }}
            onMouseLeave={(ev) => { ev.currentTarget.style.background = e.white; }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <polygon points="5 4 15 12 5 20 5 4" />
              <line x1="19" y1="5" x2="19" y2="19" />
            </svg>
            Skip — Enter
          </button>
        )}

        {(phase === "thinking" || phase === "speaking") && (
          <MicroFeedbackPanel transcript={transcript} microFeedback={microFeedback} />
        )}

        {phase === "done" && (
          <div style={{ width: "100%", maxWidth: 620, display: "flex", flexDirection: "column", gap: 16 }}>
            {isSalaryNegotiation && (
              <DealSummaryCard
                transcript={transcript}
                negotiationBand={negotiationBand}
                negotiationStyle={negotiationStyle}
                onReplay={(style) => {
                  const params = new URLSearchParams(window.location.search);
                  params.set("negotiationStyle", style);
                  navigate.push(`/interview?${params.toString()}`);
                  window.location.reload();
                }}
              />
            )}
            {isSalaryNegotiation && transcript.length > 2 && (
              <AnnotatedReplayPanel transcript={transcript} negotiationBand={negotiationBand} />
            )}
            <CompletionCard
              currentQuestionNum={currentQuestionNum} elapsed={elapsed}
              usedFallbackScore={usedFallbackScore} evalTimedOut={evalTimedOut}
              evaluating={evaluating} handleEnd={handleEnd}
              videoURL={video.videoURL}
              isSalaryNegotiation={isSalaryNegotiation}
            />
          </div>
        )}

        {/* Panel-interview persona indicator floats top-center on desktop */}
        {isPanelInterview && panelMembers && phase !== "done" && (
          <div className="iv-canvas-mobile-hide" style={{
            position: "absolute", top: 22, left: "50%", transform: "translateX(-50%)",
          }}>
            <PanelAvatarStage
              phase={phase} panelMembers={panelMembers} activePersona={activePersona}
              isMuted={isMuted} speechUnavailable={speechUnavailable} skipSpeaking={skipSpeaking}
            />
          </div>
        )}

        {llmLoading && currentStep <= 1 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 10, height: 10, border: `1.5px solid ${e.line}`, borderTopColor: e.copper, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <span style={{ fontFamily: ef.sans, fontSize: 11, color: e.inkSoft }}>Personalizing questions…</span>
          </div>
        )}
      </main>

      {/* ═════════════════════════════════════════════════════════════
          FOOTER — canvas composition
          MetaRow            trustLine            EndButton
          ═════════════════════════════════════════════════════════════ */}
      <footer className="iv-canvas-footer" style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 32px max(14px, env(safe-area-inset-bottom, 14px))",
        gap: 16, borderTop: `1px solid ${e.line}`, background: e.cream,
        flexShrink: 0, zIndex: 10,
      }}>
        <CanvasMetaRow
          elapsedSec={elapsed}
          exchanges={countExchanges(transcript)}
        />
        <span className="iv-canvas-mobile-hide" style={{
          fontFamily: ef.sans, fontSize: 11, color: e.inkFaint, letterSpacing: 0.1,
        }}>
          Recording for your review only · never shared
        </span>
        {phase !== "done" && (
          <span ref={endModalTriggerRef as React.Ref<HTMLSpanElement>} style={{ display: "inline-flex" }}>
            <CanvasEndButton onClick={() => { ttsCancelRef.current?.(); ttsCancelRef.current = null; setShowEndModal(true); }} />
          </span>
        )}
      </footer>

      {/* Self-view tile (camera-on overlay, bottom-right) */}
      {video.videoEnabled && phase !== "done" && (
        <CanvasSelfViewTile videoRef={video.videoPreviewRef} />
      )}

      {showTranscript && (
        <TranscriptPanel
          transcript={transcript} interviewerName={interviewerName}
          setShowTranscript={setShowTranscript} transcriptRef={transcriptRef}
          panelMembers={panelMembers ?? undefined}
        />
      )}

      {showEndModal && (
        <EndModal
          currentQuestionNum={currentQuestionNum} totalQuestions={totalQuestions}
          isOffline={isOffline} handleEnd={handleEnd}
          setShowEndModal={setShowEndModal} endModalTriggerRef={endModalTriggerRef}
        />
      )}

      {showSaveToast && phase !== "done" && !evaluating && !reconnecting && <SaveToast />}

      {reconnecting && (
        <ReconnectingOverlay
          attempt={reconnectAttempt}
          currentQuestion={currentQuestionNum}
          totalQuestions={totalQuestions}
        />
      )}

      {evaluating && (
        <EvaluatingOverlay
          usedFallbackScore={usedFallbackScore} evalTimedOut={evalTimedOut}
          evalElapsed={evalElapsed} saveWarning={saveWarning}
          setEvalTimedOut={setEvalTimedOut} setUsedFallbackScore={setUsedFallbackScore}
          setEvaluating={setEvaluating} interviewEndedRef={interviewEndedRef}
          handleEnd={handleEnd} lastSessionId={lastSessionId} navigate={navigate}
        />
      )}
    </div>
    </InterviewProvider>
  );
}
