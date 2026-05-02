/* HireStepX — Interview canvas / composition
   Voice-first interview screen. One file, props-driven so a single
   component renders every state variant via TempoStoryboard.

   Discipline rule: Indigo is interactive · Copper is editorial · Never mix.

   Layout (1440×1024 canvas):
     ── topbar ───────────────────────────────────────────────
     wordmark   ProgressDots ・ StatusPill           Avatar
     ── stage (centered, vertical) ───────────────────────────
       EditorialHeading (italic copper accent word)
       QuestionText (plain serif elaboration)
       VoiceVisualizer + halo + concentric rings
       PersonaLabel (Maya · listening)
       KeycapButton + "or type" link
       HintBubble
     ── footer ───────────────────────────────────────────────
       MetaRow (elapsed · exchanges)            EndButton
*/

import React from "react";
import { tokens as t, fonts as f, shadows } from "../design-system/_tokens";
import { INTERVIEW_STYLES } from "./_styles";
import {
  Wordmark,
  StatusPill,
  ProgressDots,
  VoiceVisualizer,
  PersonaLabel,
  EditorialHeading,
  QuestionText,
  HintBubble,
  KeycapButton,
  TextLink,
  MetaRow,
  EndButton,
  Avatar,
  ContextChip,
  SkipLink,
  CameraToggle,
  SelfViewTile,
  RepeatButton,
  MuteToggle,
  PaceMeter,
  TranscriptPanel,
  SaveToast,
  InlineFeedbackChip,
  MicQuietBanner,
  type ConnectionStatus,
  type VisualizerState,
} from "./_atoms";

/* ─── Types ───────────────────────────────────────────────────────────── */

export type InterviewState =
  /** AI is delivering the question — user must wait. */
  | "ai-speaking"
  /** AI has finished — user may now answer. */
  | "your-turn"
  /** User is holding spacebar / mic is hot. */
  | "you-speaking"
  /** AI is processing the answer. */
  | "ai-thinking"
  /** Type-mode: keyboard fallback for users who can't / don't want to talk. */
  | "typing-mode"
  /** Session paused. */
  | "paused"
  /** Connection degraded — show a calm warning, not an error scream. */
  | "connection-warning"
  /** End-confirm overlay on top of the AI-speaking baseline. */
  | "end-confirm";

export interface InterviewQuestion {
  /** Plain text BEFORE the italic accent word. No trailing space. */
  before?: string;
  /** The italic, copper-accent word. One per question. */
  accent: string;
  /** Plain text AFTER the italic accent. No leading space. */
  after?: string;
  /** Optional secondary serif elaboration. */
  context?: string;
}

export interface InterviewProps {
  state: InterviewState;
  question: InterviewQuestion;
  /** The AI persona name. Indian-resonant by default. */
  persona?: string;
  /** Tip line — keep specific. e.g. "Lead with the result, then the story." */
  hint?: string;
  /** Live caption for what AI just said / user just said. */
  caption?: string;
  /** 1-indexed current question number. */
  current?: number;
  total?: number;
  elapsedSec?: number;
  exchanges?: number;
  status?: ConnectionStatus;
  /** Optional initials for the top-right avatar. */
  initials?: string;
  /** Show a thin "interview is being recorded for your review" trust line. */
  trustLine?: string;
  /** Pre-filled text in type-mode. */
  typedAnswer?: string;
  /** Target role + company + interview focus context. Always shown. */
  context?: { role: string; company: string; focus: string };
  /** Camera state — when true, shows the bottom-right self-view tile. */
  cameraOn?: boolean;
  /** Mic muted (temporarily, by user — separate from end interview). */
  muted?: boolean;
  /** Live user-speech transcript, only rendered when state = "you-speaking". */
  transcript?: { text: string; interim?: string };
  /** Show the pace meter underneath the transcript in you-speaking. */
  showPace?: boolean;
  /** Surface the "I'm having trouble hearing you" inline alert. */
  micQuiet?: boolean;
  /** Show "Answer saved" toast at bottom-left. */
  showSaveToast?: boolean;
  /** Show inline mini-feedback between questions (renders below action zone). */
  inlineFeedback?: { positives?: string[]; improvements?: string[] };
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

function visualizerStateFor(s: InterviewState): VisualizerState {
  switch (s) {
    case "ai-speaking":
    case "end-confirm":
      return "ai-speaking";
    case "ai-thinking":
      return "ai-thinking";
    case "you-speaking":
      return "user-speaking";
    case "connection-warning":
      return "warning";
    case "your-turn":
    case "typing-mode":
    case "paused":
    default:
      return "idle";
  }
}

function personaStateFor(s: InterviewState) {
  switch (s) {
    case "ai-speaking":
    case "end-confirm":
      return "speaking" as const;
    case "ai-thinking":
      return "thinking" as const;
    case "you-speaking":
      return "you-speaking" as const;
    case "typing-mode":
      return "you-typing" as const;
    case "paused":
      return "paused" as const;
    case "your-turn":
    case "connection-warning":
    default:
      return "your-turn" as const;
  }
}

function keycapStateFor(s: InterviewState) {
  switch (s) {
    case "your-turn":
      return "ready" as const;
    case "you-speaking":
      return "active" as const;
    case "ai-speaking":
    case "ai-thinking":
    case "end-confirm":
      return "disabled" as const;
    case "paused":
    case "typing-mode":
    case "connection-warning":
    default:
      return "disabled" as const;
  }
}

/* ─── Main composition ──────────────────────────────────────────────── */

export default function Interview({
  state,
  question,
  persona = "Maya",
  hint,
  caption,
  current = 3,
  total = 5,
  elapsedSec = 154,
  exchanges = 3,
  status = "good",
  initials = "RS",
  trustLine = "Recording for your review only · never shared",
  typedAnswer = "",
  context = { role: "Product Manager", company: "Flipkart", focus: "Behavioral" },
  cameraOn = false,
  muted = false,
  transcript,
  showPace = false,
  micQuiet = false,
  showSaveToast = false,
  inlineFeedback,
}: InterviewProps) {
  const vizState = visualizerStateFor(state);
  const personaState = personaStateFor(state);
  const keycapState = keycapStateFor(state);
  const isTyping = state === "typing-mode";
  const isPaused = state === "paused";
  const showRings = state === "you-speaking";
  const showOverlay = state === "end-confirm";

  return (
    <>
      <style>{INTERVIEW_STYLES}</style>
      <div
        style={{
          background: t.cream,
          width: "100%",
          minHeight: "100dvh",
          fontFamily: f.sans,
          color: t.coal,
          position: "relative",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* ─── Topbar ─── */}
        <header
          className="hsx-iv-topbar"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 32px",
            gap: 16,
            borderBottom: `1px solid ${t.line}`,
            background: t.cream,
          }}
        >
          {/* Left cluster — brand + what you're interviewing for */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 16 }}>
            <Wordmark />
            <span
              aria-hidden
              style={{
                width: 1,
                height: 18,
                background: t.line,
                display: "inline-block",
              }}
            />
            <ContextChip
              role={context.role}
              company={context.company}
              focus={context.focus}
            />
          </div>

          {/* Center — progress */}
          <ProgressDots current={current} total={total} />

          {/* Right cluster — connection · mic · camera · avatar */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <StatusPill status={status} />
            <MuteToggle muted={muted} />
            <CameraToggle on={cameraOn} />
            <Avatar initials={initials} />
          </div>
        </header>

        {/* ─── Stage ─── */}
        <main
          className="hsx-iv-stage"
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 18,
            padding: "44px 48px 32px",
            position: "relative",
          }}
        >
          {/* Question heading */}
          <div style={{ maxWidth: 620, width: "100%" }}>
            <EditorialHeading
              before={question.before}
              accent={question.accent}
              after={question.after}
            />
            {question.context && (
              <div style={{ marginTop: 12 }}>
                <QuestionText>{question.context}</QuestionText>
              </div>
            )}
          </div>

          {/* Visualizer stage — sits inside a soft card so it reads
              as a contained instrument, not a floating sphere. */}
          <div
            style={{
              position: "relative",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 220,
              height: 220,
              borderRadius: 999,
              background:
                "radial-gradient(closest-side, rgba(255,255,255,0.7), rgba(244,239,227,0.4) 70%, transparent 100%)",
            }}
          >
            <span className={`hsx-viz-halo hsx-viz-halo--${vizState}`} />
            {showRings && (
              <>
                <span className="hsx-iv-ring" />
                <span className="hsx-iv-ring hsx-iv-ring--delay" />
              </>
            )}
            <VoiceVisualizer state={vizState} size={150} />
          </div>

          {/* Persona label + caption */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              minHeight: 44,
            }}
          >
            <PersonaLabel name={persona} state={personaState} />
            {caption && (
              <p
                className="hsx-iv-caption"
                style={{
                  fontFamily: f.serif,
                  fontStyle: state === "you-speaking" ? "normal" : "italic",
                  fontSize: 13,
                  color: t.indigoGray,
                  margin: 0,
                  maxWidth: 560,
                  textAlign: "center",
                  lineHeight: 1.45,
                  textWrap: "balance",
                }}
              >
                {state === "you-speaking" ? `"${caption}"` : caption}
              </p>
            )}
          </div>

          {/* Action zone — composition depends on state */}
          {isTyping ? (
            <TypeModePanel value={typedAnswer} />
          ) : isPaused ? (
            <PausedNotice />
          ) : state === "connection-warning" ? (
            <ConnectionNotice />
          ) : state === "you-speaking" && transcript ? (
            /* Active answer — transcript + pace meter take precedence over caption */
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
                width: "100%",
              }}
            >
              <TranscriptPanel text={transcript.text} interim={transcript.interim} />
              {showPace && <PaceMeter seconds={Math.max(0, elapsedSec % 180)} />}
              {micQuiet && <MicQuietBanner />}
              <KeycapButton state={keycapState} />
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 10,
              }}
            >
              <KeycapButton state={keycapState} />
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                  justifyContent: "center",
                }}
              >
                {/* Repeat — only useful when AI just finished, before user starts */}
                {state === "your-turn" && <RepeatButton />}
                <TextLink variant="muted">or type your answer instead</TextLink>
                <span aria-hidden style={{ color: t.inkFaint }}>·</span>
                <SkipLink />
              </div>
            </div>
          )}

          {/* Inline mini-feedback — between questions */}
          {inlineFeedback && state === "your-turn" && (
            <InlineFeedbackChip
              positives={inlineFeedback.positives}
              improvements={inlineFeedback.improvements}
            />
          )}

          {/* Hint */}
          {hint && state !== "ai-speaking" && state !== "end-confirm" && !inlineFeedback && (
            <HintBubble>{hint}</HintBubble>
          )}
        </main>

        {/* ─── Footer ─── */}
        <footer
          className="hsx-iv-footer"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 32px",
            gap: 16,
            borderTop: `1px solid ${t.line}`,
            background: t.cream,
          }}
        >
          <MetaRow elapsedSec={elapsedSec} exchanges={exchanges} />
          <span
            className="hsx-iv-meta-mobile-hide"
            style={{
              fontFamily: f.sans,
              fontSize: 11,
              color: t.inkFaint,
              letterSpacing: 0.1,
            }}
          >
            {trustLine}
          </span>
          <span className="hsx-iv-endbtn-wrap">
            <EndButtonWithClass />
          </span>
        </footer>

        {/* ─── Self-view tile (camera on) ─── */}
        {cameraOn && !showOverlay && <SelfViewTile initials={initials} />}

        {/* ─── Save toast (auto-save confirmation) ─── */}
        {showSaveToast && !showOverlay && <SaveToast />}

        {/* ─── End-confirm overlay ─── */}
        {showOverlay && <EndConfirmOverlay />}
      </div>
    </>
  );
}

/* ─── Type-mode panel ────────────────────────────────────────────────── */

function TypeModePanel({ value }: { value: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        gap: 10,
        width: "100%",
        maxWidth: 620,
      }}
    >
      <textarea
        readOnly
        defaultValue={value}
        placeholder="Type your answer…  Press Enter for new line · Cmd-Enter to send"
        className="hsx-iv-type"
        style={{
          width: "100%",
          minHeight: 120,
          padding: "14px 16px",
          fontFamily: f.sans,
          fontSize: 15,
          lineHeight: 1.55,
          color: t.coal,
          background: t.white,
          border: `1px solid ${t.line}`,
          borderRadius: 14,
          resize: "vertical",
          boxShadow: shadows.card,
        }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontFamily: f.sans,
          fontSize: 12,
          color: t.inkSoft,
        }}
      >
        <TextLink variant="muted">switch back to voice</TextLink>
        <button
          type="button"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: t.indigo,
            color: t.cream,
            border: "none",
            borderRadius: 999,
            padding: "10px 18px",
            fontFamily: f.sans,
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            boxShadow: shadows.cta,
          }}
        >
          Send answer
          <span aria-hidden>→</span>
        </button>
      </div>
    </div>
  );
}

/* ─── Paused notice ──────────────────────────────────────────────────── */

function PausedNotice() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        padding: "18px 24px",
        background: t.white,
        border: `1px solid ${t.line}`,
        borderRadius: 16,
        boxShadow: shadows.card,
      }}
    >
      <span
        style={{
          fontFamily: f.mono,
          fontSize: 11,
          letterSpacing: 1.4,
          textTransform: "uppercase",
          color: t.copper,
        }}
      >
        Paused
      </span>
      <span style={{ fontFamily: f.serif, fontSize: 18, color: t.coal }}>
        Take your time. <em style={{ color: t.copper, fontStyle: "italic" }}>Resume</em> when you&rsquo;re ready.
      </span>
      <button
        type="button"
        style={{
          marginTop: 4,
          background: t.indigo,
          color: t.cream,
          border: "none",
          borderRadius: 999,
          padding: "10px 22px",
          fontFamily: f.sans,
          fontSize: 13,
          fontWeight: 500,
          cursor: "pointer",
          boxShadow: shadows.cta,
        }}
      >
        Resume interview
      </button>
    </div>
  );
}

/* ─── Connection notice ──────────────────────────────────────────────── */

function ConnectionNotice() {
  return (
    <div
      role="alert"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        maxWidth: 520,
        padding: "14px 16px",
        background: "rgba(161,98,7,0.08)",
        border: `1px solid rgba(161,98,7,0.25)`,
        borderRadius: 12,
      }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke={t.warning}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        style={{ flexShrink: 0, marginTop: 1 }}
      >
        <path d="M2 8.5A15.5 15.5 0 0 1 22 8.5" />
        <path d="M5 12a11 11 0 0 1 14 0" />
        <path d="M8.5 15.5a6 6 0 0 1 7 0" />
        <circle cx="12" cy="19" r="1" fill={t.warning} />
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span
          style={{
            fontFamily: f.sans,
            fontSize: 14,
            fontWeight: 500,
            color: t.coal,
          }}
        >
          Connection is unstable.
        </span>
        <span style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft }}>
          Your answers are being saved. The interview will resume automatically when the network recovers.
        </span>
      </div>
    </div>
  );
}

/* ─── End-confirm overlay ────────────────────────────────────────────── */

function EndConfirmOverlay() {
  return (
    <div
      className="hsx-iv-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="hsx-iv-end-title"
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(14,12,8,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        zIndex: 50,
        backdropFilter: "blur(6px)",
      }}
    >
      <div
        className="hsx-iv-overlay-card"
        style={{
          width: "100%",
          maxWidth: 460,
          background: t.cream,
          border: `1px solid ${t.line}`,
          borderRadius: 20,
          padding: "28px 28px 24px",
          boxShadow: shadows.modal,
        }}
      >
        <h2
          id="hsx-iv-end-title"
          style={{
            margin: 0,
            fontFamily: f.serif,
            fontSize: 26,
            fontWeight: 400,
            lineHeight: 1.2,
            color: t.coal,
            letterSpacing: -0.4,
          }}
        >
          End the interview <em style={{ color: t.copper, fontStyle: "italic" }}>now</em>?
        </h2>
        <p
          style={{
            margin: "10px 0 22px",
            fontFamily: f.sans,
            fontSize: 14,
            lineHeight: 1.55,
            color: t.inkSoft,
          }}
        >
          You&rsquo;ve answered <strong style={{ color: t.coal, fontWeight: 600 }}>3 of 5</strong> questions. We&rsquo;ll still score what you&rsquo;ve done so far &mdash; but a partial session won&rsquo;t reflect your full performance.
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 10,
          }}
        >
          <button
            type="button"
            style={{
              background: "transparent",
              color: t.coal,
              border: `1px solid ${t.line}`,
              borderRadius: 999,
              padding: "10px 18px",
              fontFamily: f.sans,
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Keep going
          </button>
          <button
            type="button"
            style={{
              background: t.copper,
              color: t.cream,
              border: "none",
              borderRadius: 999,
              padding: "10px 18px",
              fontFamily: f.sans,
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              boxShadow: "0 4px 12px -4px rgba(180,83,9,0.45)",
            }}
          >
            End and see report
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── EndButton with hover-class wrapper ─────────────────────────────── */

function EndButtonWithClass() {
  // Wrap EndButton to attach the .hsx-iv-endbtn class for hover styles.
  // (Atom keeps zero-knowledge of canvas-local class names.)
  return (
    <span className="hsx-iv-endbtn" style={{ display: "inline-block" }}>
      <EndButton />
    </span>
  );
}
