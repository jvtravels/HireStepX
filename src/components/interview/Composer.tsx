"use client";
import { useEffect, useRef, useState } from "react";
import { e, ef } from "../../interviewTokens";
import {
  CanvasHintBubble, CanvasTextLink,
} from "../../InterviewCanvasAtoms";
import { RepeatButton, MicQuietBanner, PaceMeter } from "../../InterviewPanels";
import { detectNegotiationTactic } from "../../_negotiation-tactics";
import { captureClientEvent } from "../../posthogClient";

/* ─── Interview Composer ───────────────────────────────────────────────
   Action zone for the listening phase: live transcript card → keycap CTA
   → secondary actions (type/repeat/start-over/skip) → contextual hints.

   Previously inlined inside Interview.tsx as `CanvasListeningActionZone`
   (~420 lines wedged between the engine wiring). Extracted verbatim — no
   className, style, ref, or behavior changed; all props are preserved
   identically. Helpers that only this component used (`SkipWithReason`,
   `CountdownPill`, `paceRangeFor`, `CanvasLiveMetricsRow`) came along so
   the move was self-contained.

   Engine wiring stays in the parent (Interview.tsx) and is forwarded
   through props — this component is purely a render layer. */

/* SkipWithReason — replaces CanvasSkipLink in production. Click reveals
   a tiny popover with 4 reasons (industry standard for question-quality
   feedback loops). Selection fires posthog "interview_skip" + advances.
   "Just skip" lets users skip without committing to a reason. */
function SkipWithReason({
  onConfirm,
  canSkip,
  skipsUsed,
  skipBudget,
}: {
  onConfirm: (reason: string) => void;
  canSkip: boolean;
  skipsUsed: number;
  skipBudget: number;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Soft-disable: button still rendered for affordance/discoverability
  // but click is a no-op + tooltip explains why. The handler-side
  // toast (in handleSkipQuestion) backs this up if a click slips through.
  const remaining = Math.max(0, skipBudget - skipsUsed);
  const tooltip =
    skipBudget === 0
      ? "Skips aren't allowed in this interview type — every turn matters."
      : !canSkip
        ? `You've used your ${skipBudget} skip${skipBudget === 1 ? "" : "s"}. Work through this one, even partially.`
        : `${remaining} skip${remaining === 1 ? "" : "s"} left`;
  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onDoc = (ev: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(ev.target as Node)) setOpen(false);
    };
    const onEsc = (ev: KeyboardEvent) => { if (ev.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);
  const reasons: { label: string; value: string }[] = [
    { label: "Too easy",      value: "too_easy" },
    { label: "Too hard",      value: "too_hard" },
    { label: "Not relevant",  value: "not_relevant" },
    { label: "Already answered", value: "already_answered" },
  ];
  return (
    <div ref={containerRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={() => { if (canSkip) setOpen((v) => !v); }}
        disabled={!canSkip}
        title={tooltip}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={canSkip ? `Skip this question (${remaining} left)` : "Skip not available"}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "transparent", border: "none", padding: "4px 6px",
          cursor: canSkip ? "pointer" : "not-allowed",
          fontFamily: ef.sans, fontSize: 12, fontWeight: 500,
          color: canSkip ? e.copper : e.inkFaint,
          opacity: canSkip ? 0.85 : 0.5, transition: "opacity 160ms ease",
        }}
        onMouseEnter={(ev) => { if (canSkip) ev.currentTarget.style.opacity = "1"; }}
        onMouseLeave={(ev) => { ev.currentTarget.style.opacity = canSkip ? "0.85" : "0.5"; }}
      >
        <span>Skip question{canSkip && skipBudget > 0 ? ` · ${remaining} left` : ""}</span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <polyline points="13 17 18 12 13 7" />
          <polyline points="6 17 11 12 6 7" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Skip reason"
          style={{
            position: "absolute", bottom: "calc(100% + 8px)", right: 0,
            minWidth: 220, background: e.cream, border: `1px solid ${e.line}`,
            borderRadius: 14, boxShadow: "0 2px 4px rgba(20,17,10,.06), 0 16px 32px -8px rgba(20,17,10,.18)",
            padding: 8, zIndex: 30,
            display: "flex", flexDirection: "column", gap: 2,
          }}
        >
          <span style={{
            fontFamily: ef.mono, fontSize: 10, textTransform: "uppercase",
            letterSpacing: 1.4, color: e.inkSoft, padding: "6px 10px 4px",
          }}>
            Why are you skipping?
          </span>
          {reasons.map((r) => (
            <button
              key={r.value}
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); onConfirm(r.value); }}
              style={{
                display: "block", textAlign: "left", width: "100%",
                background: "transparent", border: "none",
                padding: "8px 10px", borderRadius: 8, cursor: "pointer",
                fontFamily: ef.sans, fontSize: 13, color: e.coal,
                transition: "background 120ms ease",
              }}
              onMouseEnter={(ev) => (ev.currentTarget.style.background = e.creamSoft)}
              onMouseLeave={(ev) => (ev.currentTarget.style.background = "transparent")}
            >
              {r.label}
            </button>
          ))}
          <div style={{ height: 1, background: e.line, margin: "4px 8px" }} />
          <button
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); onConfirm("no_reason"); }}
            style={{
              display: "block", textAlign: "left", width: "100%",
              background: "transparent", border: "none",
              padding: "8px 10px", borderRadius: 8, cursor: "pointer",
              fontFamily: ef.sans, fontSize: 12, color: e.inkSoft,
              fontStyle: "italic",
            }}
            onMouseEnter={(ev) => (ev.currentTarget.style.background = e.creamSoft)}
            onMouseLeave={(ev) => (ev.currentTarget.style.background = "transparent")}
          >
            Just skip — no reason
          </button>
        </div>
      )}
    </div>
  );
}

/* CountdownPill — subtle per-question time-remaining indicator.
   Engine already counts down per-question and auto-advances at zero.
   This surfaces it visually so users see the limit. Stays muted until
   < 30s remaining, then warms; urgent red < 15s. Hidden when there's
   no meaningful budget to show (e.g., remaining > 10 minutes). */
function CountdownPill({ secondsRemaining, percent }: { secondsRemaining: number; percent: number }) {
  // Don't render at all when budget is very large or negative — avoids
  // shoving "9:42 left" into a soft conversational round.
  if (secondsRemaining > 600 || secondsRemaining <= 0) return null;
  const m = Math.floor(secondsRemaining / 60);
  const s = secondsRemaining % 60;
  const time = `${m}:${s.toString().padStart(2, "0")}`;
  const urgent = secondsRemaining <= 15;
  const warning = !urgent && secondsRemaining <= 30;
  const tint = urgent ? e.error : warning ? e.warning : e.inkSoft;
  const bg = urgent
    ? "rgba(185,28,28,0.08)"
    : warning
    ? "rgba(161,98,7,0.08)"
    : e.creamSoft;
  const border = urgent
    ? "rgba(185,28,28,0.25)"
    : warning
    ? "rgba(161,98,7,0.25)"
    : e.line;
  return (
    <div role="timer" aria-label={`${time} remaining for this question`} aria-live={urgent ? "assertive" : "off"} style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      padding: "5px 12px 5px 10px", borderRadius: 999,
      background: bg, border: `1px solid ${border}`,
      fontFamily: ef.mono, fontSize: 11, fontWeight: 500,
      color: tint, letterSpacing: 0.4,
    }}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
      <span>{time}</span>
      {/* Thin progress bar inside the pill — drains as time passes */}
      <span aria-hidden style={{
        width: 28, height: 3, borderRadius: 2,
        background: urgent ? "rgba(185,28,28,0.20)" : "rgba(20,17,10,0.10)",
        overflow: "hidden", marginLeft: 2,
      }}>
        <span style={{
          display: "block", height: "100%", borderRadius: 2,
          background: tint, width: `${Math.max(0, 100 - percent)}%`,
          transition: "width 1s linear, background 0.5s ease",
        }} />
      </span>
    </div>
  );
}

/* Per-interview-type pace sweet spots (seconds spoken).
   Different rounds reward different answer lengths — generic 60-90s
   was always wrong for fresher campus (too long) and technical/case
   (too short). The interview type comes from the URL ?type= param. */
function paceRangeFor(interviewType?: string | null): { min: number; max: number; ceiling: number } {
  const t = (interviewType || "").toLowerCase();
  if (t.includes("technical") || t.includes("system-design") || t.includes("case") || t.includes("strategic")) {
    return { min: 90, max: 180, ceiling: 240 };
  }
  if (t.includes("campus") || t.includes("hr") || t.includes("salary") || t.includes("negotiation")) {
    return { min: 30, max: 60, ceiling: 120 };
  }
  if (t.includes("management") || t.includes("panel")) {
    return { min: 75, max: 120, ceiling: 180 };
  }
  // behavioral default
  return { min: 60, max: 90, ceiling: 150 };
}

/* Compact one-line live metrics — restores the WPM/filler/words signal
   that the canvas refactor dropped from view. Stays subtle (mono caps,
   stone color) so it doesn't compete with the editorial heading. */
function CanvasLiveMetricsRow({ metrics }: {
  metrics: {
    wordCount: number;
    wpm: number;
    fillerCount: number;
    ownership?: "i-led" | "balanced" | "we-heavy" | null;
    specificityHits?: number;
  } | null;
}) {
  if (!metrics || metrics.wordCount < 4) return null;
  const wpmTint = metrics.wpm > 180 ? e.error : metrics.wpm < 100 ? e.warning : e.success;
  const fillerTint = metrics.fillerCount > 5 ? e.error : metrics.fillerCount > 2 ? e.warning : e.inkSoft;
  const voiceLabel = metrics.ownership === "we-heavy" ? "we" : metrics.ownership === "i-led" ? "I" : "I/we";
  const voiceTint = metrics.ownership === "we-heavy" ? e.warning : metrics.ownership === "i-led" ? e.success : e.inkSoft;
  return (
    /* The metrics tick every second (word count, pace, ownership). Live-
       announcing every tick would spam screen-reader users — they'd hear
       "47 words" / "48 words" / "49 words" continuously while answering.
       aria-live="off" suppresses live updates; the role="status" still
       lets a SR user navigate to it on demand and read the current values. */
    <div role="status" aria-live="off" aria-label="Live answer metrics" style={{
      display: "inline-flex", alignItems: "center", gap: 14,
      fontFamily: ef.mono, fontSize: 10, textTransform: "uppercase",
      letterSpacing: 1.2, color: e.inkSoft,
    }}>
      <span><strong style={{ color: e.coal, fontWeight: 600 }}>{metrics.wordCount}</strong> words</span>
      <span aria-hidden style={{ color: e.inkFaint }}>·</span>
      <span><strong style={{ color: wpmTint, fontWeight: 600 }}>{metrics.wpm}</strong> wpm</span>
      <span aria-hidden style={{ color: e.inkFaint }}>·</span>
      <span><strong style={{ color: fillerTint, fontWeight: 600 }}>{metrics.fillerCount}</strong> fillers</span>
      {metrics.ownership && (
        <>
          <span aria-hidden style={{ color: e.inkFaint }}>·</span>
          <span><strong style={{ color: voiceTint, fontWeight: 600 }}>{voiceLabel}</strong> voice</span>
        </>
      )}
      {typeof metrics.specificityHits === "number" && metrics.specificityHits > 0 && (
        <>
          <span aria-hidden style={{ color: e.inkFaint }}>·</span>
          <span><strong style={{ color: e.success, fontWeight: 600 }}>{metrics.specificityHits}</strong> metrics</span>
        </>
      )}
    </div>
  );
}

/* Composer — production action zone matching the canvas:
   live transcript card → KeycapButton CTA → "or type / Skip" links →
   HintBubble. Replaces the old green-tinted UserAnswerArea card.

   Press-Space-when-done UX: engine still auto-listens via STT, so the
   keycap is a "send" affordance rather than true push-to-talk. Pressing
   Space (when not focused on the textarea) calls handleNextQuestion. */
export function Composer({
  currentTranscript, setCurrentTranscript,
  speechUnavailable, setSpeechUnavailable,
  handleNextQuestion, handleSkipQuestion, restartListening, textareaRef, nextBtnRef,
  isMuted, micQuiet, isCurrentFollowUp,
  replayQuestion, aiVoiceEnabled, hasQuestion,
  liveMetrics, interviewType,
  timeRemaining, timePercent,
  skipsUsed, skipBudget, canSkip,
  awaitingSpeechStart,
  isLastStep, isClosingStep, onViewResult,
  currentQuestionText,
}: {
  currentTranscript: string;
  setCurrentTranscript: (v: string) => void;
  speechUnavailable: boolean;
  setSpeechUnavailable: (v: boolean) => void;
  handleNextQuestion: () => void;
  handleSkipQuestion: (reason: string) => void;
  /** Explicit user-initiated STT restart. When the answer area is empty,
   *  the primary button is wired to this so the user has a clear "Tap
   *  to start speaking" affordance + Space shortcut. */
  restartListening: () => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  nextBtnRef: React.RefObject<HTMLButtonElement | null>;
  isMuted: boolean;
  micQuiet: boolean;
  isCurrentFollowUp?: boolean;
  replayQuestion: () => void;
  aiVoiceEnabled: boolean;
  hasQuestion: boolean;
  liveMetrics: {
    wordCount: number; wpm: number; fillerCount: number;
    lengthGuidance: string | null;
    ownership?: "i-led" | "balanced" | "we-heavy" | null;
    specificityHits?: number; specificityHint?: string | null;
  } | null;
  interviewType?: string | null;
  timeRemaining: number;
  timePercent: number;
  skipsUsed: number;
  skipBudget: number;
  canSkip: boolean;
  awaitingSpeechStart: boolean;
  isLastStep: boolean;
  /** True when the current step is a "closing" wrap-up (no answer
   *  expected). Distinct from isLastStep — the final scripted turn
   *  in a salary-negotiation may still be a real question (e.g.
   *  notice period), in which case the mic must remain visible. */
  isClosingStep: boolean;
  onViewResult: () => void;
  /** The full text of the AI's current question — used to detect
   *  CTC-probes and surface a deflection coaching tip. */
  currentQuestionText: string;
}) {
  const [typing, setTyping] = useState(speechUnavailable);
  // Per-answer timer for the PaceMeter — local, resets when remounts
  const [answerSeconds, setAnswerSeconds] = useState(0);
  const paceRange = paceRangeFor(interviewType);
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => setAnswerSeconds(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  // Keyboard shortcuts:
  //   Space (outside textarea) → send answer
  //   R                        → repeat the question
  //   T                        → switch to typing mode
  //   Esc (in textarea)        → blur textarea
  // Skipped when focus is in an editable element (textarea/input/contenteditable).
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const target = ev.target as HTMLElement | null;
      const inEditable = target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT" || (target as HTMLElement).isContentEditable);
      // Esc inside textarea → blur (lets Space be a Send shortcut after)
      if (ev.key === "Escape" && inEditable) {
        (target as HTMLElement).blur();
        return;
      }
      if (inEditable) return;
      if (ev.code === "Space" && currentTranscript.trim()) {
        ev.preventDefault();
        handleNextQuestion();
        return;
      }
      if ((ev.key === "r" || ev.key === "R") && hasQuestion && aiVoiceEnabled) {
        ev.preventDefault();
        replayQuestion();
        return;
      }
      if (ev.key === "t" || ev.key === "T") {
        ev.preventDefault();
        setTyping(true);
        // small delay so React mounts the textarea before focus
        setTimeout(() => textareaRef.current?.focus(), 0);
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentTranscript, handleNextQuestion, hasQuestion, aiVoiceEnabled, replayQuestion, textareaRef]);
  const canSend = currentTranscript.trim().length > 0;
  const showTyping = typing || speechUnavailable;
  // isLastStep retained for future "final" affordances (kept in props
  // so the parent's wiring doesn't shift); intentionally not referenced
  // in the current render path.
  void isLastStep;
  return (
    <div className="iv-stage-wrap" style={{ width: "100%", maxWidth: 880, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      {/* Live transcript card — only if we have something */}
      {currentTranscript && !showTyping && (
        /* role="log" implies polite; aria-relevant="additions" so SR only
           reads new words as the user speaks, not the full accumulated
           transcript on every interim STT update. Without this, NVDA would
           re-announce "I led a team of six" on every word while the user
           is mid-sentence — aggressively confusing. */
        <div role="log" aria-live="polite" aria-relevant="additions" aria-label="Live transcript of your answer" style={{
          width: "100%", background: e.white, border: `1px solid ${e.line}`,
          borderRadius: 14, padding: "14px 16px",
          fontFamily: ef.sans, fontSize: 15, lineHeight: 1.55, color: e.coal,
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
            id="composer"
            aria-label="Type your answer to the interviewer's question"
            value={currentTranscript}
            onChange={(ev) => setCurrentTranscript(ev.target.value)}
            // Enter sends, Shift+Enter inserts a newline. Mirrors the
            // legacy textarea + every chat UI the user has muscle memory
            // for. Without this, users had no keyboard path to send
            // while focused in the textarea.
            onKeyDown={(ev) => {
              if (ev.key === "Enter" && !ev.shiftKey && currentTranscript.trim()) {
                ev.preventDefault();
                handleNextQuestion();
              }
            }}
            placeholder="Type your answer…"
            maxLength={3000}
            style={{
              width: "100%", minHeight: 120, padding: "14px 16px",
              // Sans-serif (Satoshi/Inter) for the user's answer — typed
              // text reads cleaner in sans, and it visually separates the
              // candidate's voice from the AI's serif question.
              fontFamily: ef.sans, fontSize: 15, lineHeight: 1.55, color: e.coal,
              background: e.white, border: `1px solid ${e.line}`, borderRadius: 14,
              resize: "vertical", outline: "none",
              boxShadow: "0 1px 0 rgba(20,17,10,.03), 0 1px 2px rgba(20,17,10,.04)",
            }}
          />
          {/* Always available — including after the safety-timeout flipped
              speechUnavailable=true. Resetting both flags here lets the
              engine re-attempt STT, otherwise the user is permanently
              locked into typing once a single mic-quiet window fires. */}
          <CanvasTextLink onClick={() => {
            setTyping(false);
            setSpeechUnavailable(false);
          }}>
            switch back to voice
          </CanvasTextLink>
        </div>
      )}

      {/* Per-question countdown — always visible during listening so
          users see the budget. Stays muted when budget is large; warms
          and turns urgent in the last 30/15 seconds. Hidden while we're
          awaiting the "Start speaking" tap so a frozen 100% bar doesn't
          mislead the user into thinking time is already counting. */}
      {!awaitingSpeechStart && (
        <CountdownPill secondsRemaining={timeRemaining} percent={timePercent} />
      )}

      {/* Live metrics + pace meter — only when actually answering */}
      {currentTranscript.trim().length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, width: "100%", maxWidth: 320 }}>
          <CanvasLiveMetricsRow metrics={liveMetrics} />
          <div style={{ width: "100%", maxWidth: 280 }}>
            <PaceMeter seconds={answerSeconds} ideal={{ min: paceRange.min, max: paceRange.max }} ceiling={paceRange.ceiling} />
          </div>
        </div>
      )}

      {/* Mic-quiet banner */}
      {micQuiet && !speechUnavailable && !isMuted && !showTyping && (
        <MicQuietBanner onSwitchToText={() => { setTyping(true); setSpeechUnavailable(true); textareaRef.current?.focus(); }} />
      )}

      {/* Primary CTA — keycap button matching the canvas.
          State machine:
            • voice mode + awaiting start → clean "Start speaking" pill
              (no keycap chip — the Space keycap was confusing users into
              thinking they had to press it; the click target is now
              just the labelled button. Space shortcut still works.)
            • voice mode + has transcript → "Press Space when done"
            • typing mode + empty → disabled placeholder
            • typing mode + filled → "Press Enter to send" submits */}
      {!showTyping && !canSend ? (
        isClosingStep ? (
          /* Closing wrap-up reached — no answer expected from the
             candidate. Show "View result" instead of the mic so the
             user can trigger the report directly.
             NOTE: this used to gate on isLastStep alone, which broke
             the final question of salary-negotiation interviews
             (e.g. "What's your notice period?") — that's the last
             scripted turn but still a real question. Gating on
             isClosingStep means the mic stays visible until the
             engine has actually scheduled a closing/wrap-up turn. */
          <button
            ref={nextBtnRef}
            type="button"
            onClick={() => onViewResult()}
            aria-label="View result"
            className="hsx-iv-keycap"
            data-state="ready"
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10,
              fontFamily: ef.sans, fontSize: 14, fontWeight: 500,
              color: e.cream, background: e.indigo,
              border: `1px solid ${e.indigo}`,
              borderRadius: 999, padding: "12px 26px",
              cursor: "pointer",
              transition: "all 180ms cubic-bezier(0.16, 1, 0.3, 1)",
              boxShadow: "0 6px 20px -6px rgba(49,46,129,0.40)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
            <span>View result</span>
          </button>
        ) : (
        <button
          ref={nextBtnRef}
          type="button"
          onClick={() => restartListening()}
          aria-label="Start speaking"
          className="hsx-iv-keycap"
          data-state="ready"
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10,
            fontFamily: ef.sans, fontSize: 14, fontWeight: 500,
            color: e.cream, background: e.indigo,
            border: `1px solid ${e.indigo}`,
            borderRadius: 999, padding: "12px 26px",
            cursor: "pointer",
            transition: "all 180ms cubic-bezier(0.16, 1, 0.3, 1)",
            boxShadow: "0 6px 20px -6px rgba(49,46,129,0.40)",
          }}
        >
          {/* simple mic glyph — no keycap */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="9" y="3" width="6" height="12" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0" />
            <line x1="12" y1="18" x2="12" y2="22" />
          </svg>
          <span>Start speaking</span>
        </button>
        )
      ) : (
        <button
          ref={nextBtnRef}
          type="button"
          onClick={() => handleNextQuestion()}
          disabled={showTyping && !canSend}
          aria-label={
            showTyping
              ? "Send answer"
              : "Send answer (or press Space)"
          }
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
            {showTyping ? "Enter" : "Space"}
          </kbd>
          <span>
            {showTyping
              ? (canSend ? "Press Enter to send" : "Type your answer…")
              : "Press Space when done"}
          </span>
        </button>
      )}

      {/* Secondary action row — type / repeat / start-over / skip.
          Keyboard hints: each text link includes its hotkey for power
          users (R for repeat, T for type). */}
      <div style={{ display: "inline-flex", alignItems: "center", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
        {!showTyping && (
          <>
            <CanvasTextLink onClick={() => { setTyping(true); textareaRef.current?.focus(); }}>
              or type your answer (T)
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
        {/* Mid-answer start-over — only useful once the user has actually
            said/typed something. Wipes the transcript and keeps the same
            question active so they can re-answer cleanly. */}
        {canSend && (
          <>
            <button
              type="button"
              onClick={() => {
                setCurrentTranscript("");
                captureClientEvent("interview_answer_restart", {});
                if (showTyping) textareaRef.current?.focus();
              }}
              aria-label="Start this answer over"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "transparent", border: "none",
                padding: "4px 6px", cursor: "pointer",
                fontFamily: ef.sans, fontSize: 12, fontWeight: 500,
                color: e.inkSoft, transition: "color 160ms ease",
              }}
              onMouseEnter={(ev) => (ev.currentTarget.style.color = e.coal)}
              onMouseLeave={(ev) => (ev.currentTarget.style.color = e.inkSoft)}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                <polyline points="3 3 3 8 8 8" />
              </svg>
              Start over
            </button>
            <span aria-hidden style={{ color: e.inkFaint }}>·</span>
          </>
        )}
        <SkipWithReason
          canSkip={canSkip}
          skipsUsed={skipsUsed}
          skipBudget={skipBudget}
          onConfirm={(reason) => {
            captureClientEvent("interview_skip", { reason });
            handleSkipQuestion(reason);
          }}
        />
      </div>

      {/* Hint */}
      {isCurrentFollowUp && (
        <CanvasHintBubble>This is a follow-up — be specific.</CanvasHintBubble>
      )}
      {/* Salary-neg tactic recognition. Run the AI question through
          the tactic detector and surface the coaching note for the
          first match. The current-CTC tip is just one of ~8 tactics
          this catches (anchors, flinches, deadlines, fake-empathy,
          split-authority, package-redirect, loss-framing). One bubble
          per turn — pure pattern match, no LLM. */}
      {interviewType === "salary-negotiation" && (() => {
        const tactic = detectNegotiationTactic(currentQuestionText);
        if (!tactic) return null;
        return (
          <CanvasHintBubble>
            <div>
              <strong style={{ color: e.copper, marginRight: 6 }}>{tactic.label}:</strong>
              {tactic.coaching}
            </div>
            {tactic.counterScripts.length > 0 && (
              <details style={{ marginTop: 6 }}>
                <summary style={{ cursor: "pointer", fontSize: 11, color: e.inkFaint, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  {tactic.counterScripts.length} counter-scripts
                </summary>
                <ul style={{ margin: "4px 0 0 0", paddingLeft: 18, fontSize: 12, lineHeight: 1.5 }}>
                  {tactic.counterScripts.map((s, i) => (
                    <li key={i} style={{ marginBottom: 4 }}>"{s}"</li>
                  ))}
                </ul>
              </details>
            )}
          </CanvasHintBubble>
        );
      })()}

      {/* Subtle keyboard-shortcuts discoverability hint */}
      <span aria-hidden style={{
        fontFamily: ef.mono, fontSize: 9, textTransform: "uppercase",
        letterSpacing: 1, color: e.inkFaint, marginTop: 2,
      }}>
        Space · send  ·  R · repeat  ·  T · type  ·  Esc · unfocus
      </span>
    </div>
  );
}

export default Composer;
