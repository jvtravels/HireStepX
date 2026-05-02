"use client";
import { useEffect, useRef, useState } from "react";
import { e, ef } from "./interviewTokens";
import {
  StatusToasts, PanelAvatarStage,
  UserAnswerArea, CompletionCard, MicroFeedbackPanel,
  TranscriptPanel, EndModal, EvaluatingOverlay,
  DealSummaryCard, AnnotatedReplayPanel, NegotiationLiveDashboard,
  SaveToast, RepeatButton, MicQuietBanner, ReconnectingOverlay,
  InterviewCoachmarks,
} from "./InterviewPanels";
import {
  CanvasWordmark, CanvasContextChip, CanvasProgressDots, CanvasStatusPill,
  CanvasMuteToggle, CanvasCameraToggle, CanvasAvatar,
  CanvasVoiceVisualizer, CanvasPersonaLabel, CanvasPlainHeading,
  CanvasQuestionText, CanvasHintBubble, CanvasTextLink,
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

/* Map engine phase → canvas visualizer state */
function vizState(phase: string): CanvasVizState {
  if (phase === "speaking") return "ai-speaking";
  if (phase === "thinking") return "ai-thinking";
  if (phase === "listening") return "user-speaking";
  return "idle";
}

/* Map engine phase → canvas persona-label state */
function personaState(phase: string): CanvasPersonaState {
  if (phase === "speaking") return "speaking";
  if (phase === "thinking") return "thinking";
  if (phase === "listening") return "listening";
  return "your-turn";
}

/* Map engine offline → canvas connection-status pill */
function mapConnectionStatus(isOffline: boolean): CanvasConnectionStatus {
  return isOffline ? "offline" : "good";
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
    interviewScript, saveWarning, liveMetrics,
    isSalaryNegotiation, negotiationBand, negotiationStyle,
    targetSalary, highestOffer, liveNegotiationState, voiceConfidence,

    setCurrentTranscript, setSpeechUnavailable, setIsMuted,
    setShowTranscript, setShowEndModal,
    setMicError, setEvalTimedOut, setUsedFallbackScore, setEvaluating,

    handleNextQuestion, skipSpeaking, handleEnd, navigate, replayQuestion,
    micQuiet, reconnecting, reconnectAttempt,

    transcriptRef, endModalTriggerRef, textareaRef, nextBtnRef,
    micStreamRef, noSpeechCountRef, ttsCancelRef, interviewEndedRef,
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
          <CanvasContextChip role={displayRole} company={displayCompany} focus={displayFocus} />
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
        {/* Question heading — italic-copper accent extraction comes via
            LLM markup in a follow-up; for now the full question renders
            in serif. The LiveCaptions wrapper preserves the existing
            TTS-synced typewriter cadence during phase=speaking. */}
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
            ) : (
              <CanvasPlainHeading>{step.aiText}</CanvasPlainHeading>
            )}
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
            <span className={`hsx-viz-halo hsx-viz-halo--${vizState(phase)}`} />
            {phase === "listening" && (
              <>
                <span className="hsx-iv-ring" />
                <span className="hsx-iv-ring hsx-iv-ring--delay" />
              </>
            )}
            <CanvasVoiceVisualizer state={vizState(phase)} size={150} />
          </div>
        )}

        {/* Persona name + state */}
        {phase !== "done" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, minHeight: 52 }}>
            <CanvasPersonaLabel
              name={isPanelInterview && activePersona ? activePersona : interviewerName}
              state={personaState(phase)}
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

        {/* Action zone — listening = answer panel + repeat/transcript links */}
        {phase === "listening" && (
          <div style={{ width: "100%", maxWidth: 620, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <UserAnswerArea
              currentTranscript={currentTranscript} setCurrentTranscript={setCurrentTranscript}
              speechUnavailable={speechUnavailable} setSpeechUnavailable={setSpeechUnavailable}
              isMuted={isMuted} micStreamRef={micStreamRef} noSpeechCountRef={noSpeechCountRef}
              setMicError={setMicError} handleNextQuestion={handleNextQuestion}
              textareaRef={textareaRef} nextBtnRef={nextBtnRef}
              currentStep={currentStep} interviewScriptLength={interviewScript.length}
              liveMetrics={liveMetrics}
            />
            {micQuiet && !speechUnavailable && !isMuted && (
              <MicQuietBanner onSwitchToText={() => textareaRef.current?.focus()} />
            )}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
              {step?.aiText && aiVoiceEnabled && <RepeatButton onClick={replayQuestion} />}
              <CanvasTextLink onClick={() => setShowTranscript(t => !t)}>
                {showTranscript ? "hide transcript" : "show transcript"}
              </CanvasTextLink>
            </div>
            {isCurrentFollowUp && (
              <CanvasHintBubble>This is a follow-up — be specific.</CanvasHintBubble>
            )}
          </div>
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
          exchanges={Math.max(0, Math.min(currentQuestionNum, baseQuestionCount || totalQuestions))}
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
