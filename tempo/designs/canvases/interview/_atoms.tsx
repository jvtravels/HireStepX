/* HireStepX — Interview canvas / shared atoms
   Voice-first interview UI primitives. Reuses design-system tokens
   (cream + coal + indigo + copper + Instrument Serif + Satoshi). */
import React from "react";
import { tokens as t, fonts as f, shadows } from "../design-system/_tokens";

/* ─── Wordmark ─────────────────────────────────────────────────────────── */

export function Wordmark({ size = 18 }: { size?: number }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: 0,
        fontFamily: f.serif,
        fontSize: size,
        fontWeight: 600,
        color: t.coal,
        letterSpacing: -0.4,
      }}
    >
      <span>HireStep</span>
      <span style={{ fontStyle: "italic", color: t.copper }}>X</span>
    </span>
  );
}

/* ─── StatusPill ───────────────────────────────────────────────────────── */

export type ConnectionStatus = "good" | "fair" | "poor" | "offline";

export function StatusPill({ status }: { status: ConnectionStatus }) {
  const map: Record<
    ConnectionStatus,
    { color: string; bg: string; label: string }
  > = {
    good: { color: t.success, bg: "rgba(21, 128, 61, 0.08)", label: "Connection good" },
    fair: { color: t.warning, bg: "rgba(161, 98, 7, 0.10)", label: "Connection fair" },
    poor: { color: t.error, bg: "rgba(185, 28, 28, 0.08)", label: "Connection poor" },
    offline: { color: t.error, bg: "rgba(185, 28, 28, 0.10)", label: "You're offline" },
  };
  const { color, bg, label } = map[status];
  return (
    <span
      role="status"
      aria-live="polite"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontFamily: f.sans,
        fontSize: 12,
        fontWeight: 500,
        color,
        background: bg,
        padding: "5px 12px 5px 10px",
        borderRadius: 999,
        letterSpacing: 0.1,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: color,
          opacity: 0.95,
        }}
      />
      {label}
    </span>
  );
}

/* ─── ProgressDots — "Question 3 of 5" ────────────────────────────────── */

export function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current}
      aria-valuetext={`Question ${current} of ${total}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      <span
        style={{
          fontFamily: f.mono,
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: 1.4,
          color: t.inkSoft,
        }}
      >
        Question {current} of {total}
      </span>
      <span style={{ display: "inline-flex", gap: 6 }}>
        {Array.from({ length: total }).map((_, i) => {
          const filled = i < current;
          const isCurrent = i === current - 1;
          return (
            <span
              key={i}
              style={{
                width: isCurrent ? 14 : 6,
                height: 6,
                borderRadius: 999,
                background: filled
                  ? isCurrent
                    ? t.coal
                    : t.indigo
                  : t.lineStrong,
                transition: "all 220ms cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            />
          );
        })}
      </span>
    </div>
  );
}

/* ─── VoiceVisualizer — dotted sphere ──────────────────────────────────── */

export type VisualizerState =
  | "idle"
  | "ai-speaking"
  | "ai-thinking"
  | "user-speaking"
  | "warning";

export interface VoiceVisualizerProps {
  state: VisualizerState;
  /** Pixel diameter — defaults to 240. */
  size?: number;
}

/**
 * Dotted sphere visualizer. Renders an evenly-distributed grid of dots
 * inside a circle. Color + animation behavior changes per state.
 *
 * Visual language:
 *   idle           → faded coal dots, no animation
 *   ai-speaking    → coal dots, gentle outward pulse (2.4s)
 *   ai-thinking    → copper dots, slow ripple (3.6s)
 *   user-speaking  → indigo dots, faster pulse (1.4s)
 *   warning        → amber dots, no animation
 */
export function VoiceVisualizer({ state, size = 180 }: VoiceVisualizerProps) {
  const dotColor = (() => {
    switch (state) {
      case "idle":
        return t.inkFaint;
      case "ai-speaking":
        return t.coal;
      case "ai-thinking":
        return t.copper;
      case "user-speaking":
        return t.indigo;
      case "warning":
        return t.warning;
    }
  })();

  // Generate a hex-grid of dots inside a circle.
  // Step is the hex spacing; smaller = denser sphere.
  const step = size / 22;
  const radius = size / 2;
  const dots: { cx: number; cy: number; r: number; opacity: number }[] = [];
  for (let yi = -12; yi <= 12; yi++) {
    const y = yi * step * 0.866; // hex row spacing
    if (Math.abs(y) > radius) continue;
    const offset = (yi % 2 === 0 ? 0 : step / 2);
    for (let xi = -12; xi <= 12; xi++) {
      const x = xi * step + offset;
      const dist = Math.sqrt(x * x + y * y);
      if (dist > radius - step / 2) continue;
      // Fade dots towards the edge for a soft sphere look.
      const edgeFade = Math.max(0, 1 - dist / radius);
      dots.push({
        cx: radius + x,
        cy: radius + y,
        r: 1.4,
        opacity: 0.35 + edgeFade * 0.6,
      });
    }
  }

  // CSS class drives the animation per state. Keyframes are in _styles.
  const animClass = `hsx-viz-${state}`;

  return (
    <div
      role="presentation"
      aria-label={
        state === "ai-speaking"
          ? "Interviewer is speaking"
          : state === "ai-thinking"
            ? "Interviewer is thinking"
            : state === "user-speaking"
              ? "You are speaking"
              : state === "warning"
                ? "Connection warning"
                : "Quiet"
      }
      className={`hsx-viz ${animClass}`}
      style={{
        width: size,
        height: size,
        position: "relative",
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {dots.map((d, i) => (
          <circle
            key={i}
            cx={d.cx}
            cy={d.cy}
            r={d.r}
            fill={dotColor}
            opacity={d.opacity}
          />
        ))}
      </svg>
    </div>
  );
}

/* ─── PersonaLabel — "Maya · listening" ────────────────────────────────── */

export interface PersonaLabelProps {
  name: string;
  state:
    | "listening"
    | "speaking"
    | "thinking"
    | "paused"
    | "your-turn"
    | "you-speaking"
    | "you-typing";
}

export function PersonaLabel({ name, state }: PersonaLabelProps) {
  const stateLabel = (() => {
    switch (state) {
      case "listening":
        return "listening to you";
      case "speaking":
        return "speaking";
      case "thinking":
        return "thinking…";
      case "paused":
        return "paused";
      case "your-turn":
        return "ready when you are";
      case "you-speaking":
        return "is hearing you now";
      case "you-typing":
        return "is reading your answer";
    }
  })();
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
      }}
    >
      <span
        style={{
          fontFamily: f.serif,
          fontSize: 17,
          fontWeight: 500,
          color: t.coal,
          letterSpacing: -0.2,
        }}
      >
        {name}
      </span>
      <span
        style={{
          fontFamily: f.sans,
          fontSize: 12,
          color: t.inkSoft,
          letterSpacing: 0.05,
        }}
      >
        {stateLabel}
      </span>
    </div>
  );
}

/* ─── EditorialHeading — single italic-copper accent word ─────────────── */

export interface EditorialHeadingProps {
  /** Text BEFORE the italic accent (no trailing space). */
  before?: string;
  /** The italic, copper-accent word. */
  accent: string;
  /** Text AFTER the italic accent (no leading space). */
  after?: string;
  /** Trailing punctuation (rendered NON-italic). Defaults to ".". */
  trailing?: string;
}

export function EditorialHeading({
  before = "",
  accent,
  after = "",
  trailing = ".",
}: EditorialHeadingProps) {
  return (
    <h1
      style={{
        fontFamily: f.serif,
        fontSize: "clamp(1.5rem, 2.4vw, 2rem)",
        lineHeight: 1.18,
        fontWeight: 400,
        letterSpacing: "-0.015em",
        color: t.coal,
        textAlign: "center",
        margin: 0,
        textWrap: "balance",
      }}
    >
      {before && <>{before} </>}
      <em
        style={{
          fontStyle: "italic",
          fontWeight: 400,
          color: t.copper,
        }}
      >
        {accent}
      </em>
      {after && <> {after}</>}
      {trailing}
    </h1>
  );
}

/* ─── QuestionText — secondary serif, auto-fade ────────────────────────── */

export function QuestionText({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: f.serif,
        fontSize: 15,
        fontStyle: "normal",
        fontWeight: 400,
        lineHeight: 1.5,
        color: t.indigoGray,
        textAlign: "center",
        textWrap: "balance",
        maxWidth: 540,
        margin: "0 auto",
        letterSpacing: -0.05,
      }}
    >
      {children}
    </p>
  );
}

/* ─── HintBubble — lightbulb tip ───────────────────────────────────────── */

export function HintBubble({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontFamily: f.sans,
        fontSize: 12,
        color: t.inkSoft,
        margin: 0,
        background: "transparent",
        padding: 0,
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M9 18h6" />
        <path d="M10 22h4" />
        <path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.2 1 2v1.3h6v-1.3c0-.8.4-1.5 1-2A7 7 0 0 0 12 2z" />
      </svg>
      <span>{children}</span>
    </p>
  );
}

/* ─── KeycapButton — Hold Spacebar ─────────────────────────────────────── */

export interface KeycapButtonProps {
  state:
    | "ready" /* default — invitation */
    | "active" /* user is currently holding */
    | "disabled" /* AI is speaking */
    | "submitting"; /* releasing — sending */
  label?: string;
  hint?: string;
  onMouseDown?: () => void;
  onMouseUp?: () => void;
}

export function KeycapButton({
  state,
  label,
  hint,
  onMouseDown,
  onMouseUp,
}: KeycapButtonProps) {
  const labels: Record<KeycapButtonProps["state"], string> = {
    ready: "Hold Spacebar to answer",
    active: "Release to send",
    disabled: "Wait for the question to finish",
    submitting: "Sending…",
  };
  const finalLabel = label ?? labels[state];
  const isInteractive = state === "ready" || state === "active";
  const bg = state === "active" ? t.indigo : t.white;
  const color = state === "active" ? t.cream : t.coal;
  const border = state === "active" ? t.indigo : t.line;
  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
      }}
    >
      <button
        type="button"
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        disabled={!isInteractive}
        aria-pressed={state === "active"}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 12,
          fontFamily: f.sans,
          fontSize: 13,
          fontWeight: 500,
          color,
          background: bg,
          border: `1px solid ${border}`,
          borderRadius: 999,
          padding: "10px 18px 10px 12px",
          cursor: isInteractive ? "pointer" : "not-allowed",
          opacity: state === "disabled" ? 0.55 : 1,
          transition:
            "transform 180ms cubic-bezier(0.16, 1, 0.3, 1), background 180ms ease, color 180ms ease, border-color 180ms ease, box-shadow 180ms ease",
          transform: state === "active" ? "scale(1.02)" : "scale(1)",
          boxShadow:
            state === "active"
              ? "0 6px 20px -6px rgba(49, 46, 129, 0.4)"
              : "0 1px 0 rgba(20,17,10,.04), 0 1px 2px rgba(20,17,10,.04)",
        }}
      >
        <kbd
          aria-hidden
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 56,
            height: 24,
            padding: "0 8px",
            background:
              state === "active" ? "rgba(250,247,240,0.20)" : t.creamSoft,
            border: `1px solid ${state === "active" ? "rgba(250,247,240,0.30)" : t.line}`,
            borderRadius: 6,
            fontFamily: f.mono,
            fontSize: 11,
            fontWeight: 500,
            color: state === "active" ? t.cream : t.inkSoft,
            letterSpacing: 0.6,
          }}
        >
          Space
        </kbd>
        <span>{finalLabel}</span>
      </button>
      {hint && (
        <span
          style={{
            fontFamily: f.sans,
            fontSize: 12,
            color: t.inkFaint,
          }}
        >
          {hint}
        </span>
      )}
    </div>
  );
}

/* ─── TextLink — type fallback / skip etc ──────────────────────────────── */

export function TextLink({
  children,
  onClick,
  variant = "indigo",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "indigo" | "muted";
}) {
  const color = variant === "indigo" ? t.indigo : t.inkSoft;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: "transparent",
        border: "none",
        padding: 0,
        cursor: "pointer",
        fontFamily: f.sans,
        fontSize: 13,
        fontWeight: 500,
        color,
        textDecoration: "none",
      }}
    >
      <span className="hsx-link-indigo" style={{ color }}>
        {children}
      </span>
    </button>
  );
}

/* ─── MetaRow — elapsed time + exchange count ─────────────────────────── */

export function MetaRow({
  elapsedSec,
  exchanges,
}: {
  elapsedSec: number;
  exchanges: number;
}) {
  const m = Math.floor(elapsedSec / 60);
  const s = elapsedSec % 60;
  const time = `${m}:${s.toString().padStart(2, "0")}`;
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 14,
        fontFamily: f.mono,
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: 1.4,
        color: t.inkSoft,
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        {time}
      </span>
      <span style={{ color: t.inkFaint }}>·</span>
      <span>
        {exchanges} {exchanges === 1 ? "exchange" : "exchanges"}
      </span>
    </div>
  );
}

/* ─── EndButton ────────────────────────────────────────────────────────── */

export function EndButton({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontFamily: f.sans,
        fontSize: 13,
        fontWeight: 500,
        color: t.copper,
        background: "transparent",
        border: `1px solid ${t.line}`,
        borderRadius: 999,
        padding: "8px 14px",
        cursor: "pointer",
        transition: "all 160ms ease",
      }}
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
      End interview
    </button>
  );
}

/* ─── ContextChip — "PM · Flipkart · Behavioral" ─────────────────────── */

export interface ContextChipProps {
  role: string;
  company: string;
  focus: string;
}

export function ContextChip({ role, company, focus }: ContextChipProps) {
  return (
    <span
      aria-label={`Interviewing for ${role} at ${company}, focus: ${focus}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontFamily: f.mono,
        fontSize: 10.5,
        fontWeight: 500,
        textTransform: "uppercase",
        letterSpacing: 1.4,
        color: t.inkSoft,
        background: t.creamSoft,
        border: `1px solid ${t.line}`,
        padding: "5px 10px",
        borderRadius: 6,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ color: t.coal, fontWeight: 600 }}>{role}</span>
      <span aria-hidden style={{ color: t.inkFaint }}>·</span>
      <span>{company}</span>
      <span aria-hidden style={{ color: t.inkFaint }}>·</span>
      <span style={{ color: t.copper }}>{focus}</span>
    </span>
  );
}

/* ─── SkipLink — copper-tinted, signals "this costs you a question" ──── */

export function SkipLink({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: "transparent",
        border: "none",
        padding: "4px 6px",
        cursor: "pointer",
        fontFamily: f.sans,
        fontSize: 12,
        fontWeight: 500,
        color: t.copper,
        opacity: 0.85,
        transition: "opacity 160ms ease",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
      onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.85")}
      aria-label="Skip this question"
    >
      <span>Skip question</span>
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <polyline points="13 17 18 12 13 7" />
        <polyline points="6 17 11 12 6 7" />
      </svg>
    </button>
  );
}

/* ─── CameraToggle — pill button with cam-on / cam-off icon ─────────── */

export function CameraToggle({
  on = false,
  onClick,
}: {
  on?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={on ? "Turn camera off" : "Turn camera on"}
      title={on ? "Camera on — click to turn off" : "Camera off — click to turn on"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        height: 34,
        padding: "0 12px",
        background: on ? t.indigo100 : t.white,
        border: `1px solid ${on ? "rgba(49,46,129,0.30)" : t.line}`,
        borderRadius: 999,
        cursor: "pointer",
        fontFamily: f.sans,
        fontSize: 12,
        fontWeight: 500,
        color: on ? t.indigo : t.inkSoft,
        transition: "all 160ms ease",
      }}
    >
      {on ? (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <polygon points="23 7 16 12 23 17 23 7" />
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
        </svg>
      ) : (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" />
          <path d="M22 8 16 12l6 4Z" opacity="0.6" />
          <line x1="2" y1="2" x2="22" y2="22" />
        </svg>
      )}
      <span>{on ? "Camera on" : "Camera off"}</span>
    </button>
  );
}

/* ─── SelfViewTile — small webcam preview when camera is on ─────────── */

export function SelfViewTile({ initials = "RS" }: { initials?: string }) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const [streamReady, setStreamReady] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    let stream: MediaStream | null = null;
    const start = async () => {
      try {
        if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return;
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: "user" },
          audio: false,
        });
        if (!active) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
          setStreamReady(true);
        }
      } catch {
        // Permission denied or no camera — silhouette fallback stays visible.
      }
    };
    start();
    return () => {
      active = false;
      if (stream) stream.getTracks().forEach((tr) => tr.stop());
    };
  }, []);

  return (
    <div
      aria-label="Your camera preview"
      style={{
        position: "absolute",
        right: 24,
        top: 80,
        width: 148,
        height: 96,
        borderRadius: 12,
        overflow: "hidden",
        background: `linear-gradient(140deg, ${t.indigoDeep} 0%, #2A2747 60%, #4B4880 100%)`,
        border: `1px solid rgba(255,255,255,0.10)`,
        boxShadow:
          "0 1px 0 rgba(20,17,10,.04), 0 8px 24px -10px rgba(20,17,10,.30)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        padding: 8,
        zIndex: 5,
      }}
    >
      {/* Live camera feed — getUserMedia request fires on mount. */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: "scaleX(-1)",
          opacity: streamReady ? 1 : 0,
          transition: "opacity 280ms ease",
        }}
      />
      {/* Silhouette fallback — visible until stream is ready or on permission denied. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: streamReady ? 0 : 1,
          transition: "opacity 280ms ease",
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 999,
            background: "rgba(255,255,255,0.18)",
            color: t.cream,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: f.serif,
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          {initials}
        </div>
      </div>
      {/* Recording dot */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 8,
          left: 8,
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontFamily: f.mono,
          fontSize: 9,
          textTransform: "uppercase",
          letterSpacing: 1,
          color: t.cream,
          opacity: 0.85,
        }}
      >
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: 999,
            background: "#EF4444",
          }}
        />
        Live
      </span>
      <span
        aria-hidden
        style={{
          fontFamily: f.sans,
          fontSize: 10,
          color: "rgba(250,247,240,0.7)",
          letterSpacing: 0.2,
          position: "relative",
          zIndex: 1,
        }}
      >
        You
      </span>
    </div>
  );
}

/* ─── Avatar (top right) ───────────────────────────────────────────────── */

export function Avatar({ initials = "RS" }: { initials?: string }) {
  return (
    <span
      aria-label="Account"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 34,
        height: 34,
        borderRadius: 999,
        background: t.indigo100,
        color: t.indigo,
        fontFamily: f.serif,
        fontSize: 13,
        fontWeight: 500,
      }}
    >
      {initials}
    </span>
  );
}

/* ─── RepeatButton — small ghost · "↻ Repeat the question" ─────────── */

export function RepeatButton({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Repeat the question"
      title="Repeat the question (Press R)"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: t.white,
        border: `1px solid ${t.line}`,
        borderRadius: 999,
        padding: "6px 12px",
        cursor: "pointer",
        fontFamily: f.sans,
        fontSize: 12,
        fontWeight: 500,
        color: t.inkSoft,
        transition: "all 160ms ease",
      }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <polyline points="1 4 1 10 7 10" />
        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
      </svg>
      Repeat
    </button>
  );
}

/* ─── MuteToggle — small ghost mic toggle (separate from camera) ───── */

export function MuteToggle({ muted = false, onClick }: { muted?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={muted}
      aria-label={muted ? "Unmute microphone" : "Mute microphone temporarily"}
      title={muted ? "Muted — click to unmute" : "Mute (cough / sip water)"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        height: 34,
        padding: "0 12px",
        background: muted ? "rgba(180,83,9,0.10)" : t.white,
        border: `1px solid ${muted ? "rgba(180,83,9,0.30)" : t.line}`,
        borderRadius: 999,
        cursor: "pointer",
        fontFamily: f.sans,
        fontSize: 12,
        fontWeight: 500,
        color: muted ? t.copper : t.inkSoft,
        transition: "all 160ms ease",
      }}
    >
      {muted ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <line x1="2" y1="2" x2="22" y2="22" />
          <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
          <path d="M5 10v2a7 7 0 0 0 12 5" />
          <path d="M15 9.34V5a3 3 0 0 0-5.94-.6" />
          <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
        </svg>
      )}
      <span>{muted ? "Muted" : "Mic on"}</span>
    </button>
  );
}

/* ─── PaceMeter — slim bar showing answer length vs sweet spot ─────── */

export interface PaceMeterProps {
  /** Seconds spoken so far. */
  seconds: number;
  /** Sweet spot range — tuned per question type. Default 60–90s. */
  ideal?: { min: number; max: number };
  /** Hard ceiling — beyond this is "too long". */
  ceiling?: number;
}

export function PaceMeter({ seconds, ideal = { min: 60, max: 90 }, ceiling = 150 }: PaceMeterProps) {
  const pct = Math.min(100, (seconds / ceiling) * 100);
  const idealStartPct = (ideal.min / ceiling) * 100;
  const idealEndPct = (ideal.max / ceiling) * 100;
  const zone =
    seconds < ideal.min ? "early" : seconds <= ideal.max ? "ideal" : seconds <= ceiling ? "late" : "over";
  const labelMap = {
    early: "Take your time…",
    ideal: "Good pace",
    late: "Wrap it up",
    over: "Cut it short",
  } as const;
  const tint =
    zone === "ideal" ? t.success : zone === "early" ? t.inkSoft : zone === "late" ? t.warning : t.error;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, width: 280 }}>
      <div
        style={{
          position: "relative",
          height: 6,
          background: t.line,
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        {/* Sweet-spot range marker */}
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: `${idealStartPct}%`,
            width: `${idealEndPct - idealStartPct}%`,
            top: 0,
            bottom: 0,
            background: "rgba(21,128,61,0.18)",
          }}
        />
        {/* Filled progress */}
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: `${pct}%`,
            background: tint,
            opacity: 0.85,
            transition: "width 240ms ease, background 240ms ease",
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontFamily: f.mono,
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: 1.2,
          color: t.inkSoft,
        }}
      >
        <span>{Math.floor(seconds)}s spoken</span>
        <span style={{ color: tint }}>{labelMap[zone]}</span>
      </div>
    </div>
  );
}

/* ─── TranscriptPanel — scrolling user-speech text ─────────────────── */

export interface TranscriptPanelProps {
  /** Confirmed transcript so far. */
  text: string;
  /** Tentative tail (the "interim" tokens still being decided). */
  interim?: string;
}

export function TranscriptPanel({ text, interim = "" }: TranscriptPanelProps) {
  return (
    <div
      role="log"
      aria-live="polite"
      aria-label="Live transcript of your answer"
      style={{
        width: "100%",
        maxWidth: 620,
        background: t.white,
        border: `1px solid ${t.line}`,
        borderRadius: 14,
        padding: "14px 16px",
        fontFamily: f.sans,
        fontSize: 15,
        lineHeight: 1.55,
        color: t.coal,
        minHeight: 72,
        maxHeight: 120,
        overflowY: "auto",
        textAlign: "left",
        boxShadow: shadows.card,
      }}
    >
      <span style={{ fontFamily: f.mono, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.4, color: t.copper, display: "block", marginBottom: 6 }}>
        Live transcript
      </span>
      <span>{text}</span>
      {interim && (
        <span style={{ color: t.inkSoft, opacity: 0.7 }}>{` ${interim}`}</span>
      )}
      <span aria-hidden style={{ display: "inline-block", width: 2, height: 16, background: t.indigo, marginLeft: 2, verticalAlign: "middle", animation: "hsx-blink 1.1s steps(2) infinite" }} />
    </div>
  );
}

/* ─── SaveToast — bottom-corner "Answer saved" pulse ───────────────── */

export function SaveToast({ message = "Answer saved" }: { message?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="hsx-iv-toast"
      style={{
        position: "absolute",
        left: 24,
        bottom: 24,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        background: t.coal,
        color: t.cream,
        padding: "8px 14px",
        borderRadius: 999,
        fontFamily: f.sans,
        fontSize: 12,
        fontWeight: 500,
        boxShadow: shadows.cta,
        zIndex: 6,
      }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <polyline points="20 6 9 17 4 12" />
      </svg>
      {message}
    </div>
  );
}

/* ─── InlineFeedbackChip — micro-coaching shown between questions ──── */

export interface InlineFeedbackChipProps {
  positives?: string[];
  improvements?: string[];
}

export function InlineFeedbackChip({ positives = [], improvements = [] }: InlineFeedbackChipProps) {
  return (
    <div
      role="region"
      aria-label="Quick feedback on your last answer"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        width: "100%",
        maxWidth: 540,
        padding: "14px 16px",
        background: t.white,
        border: `1px solid ${t.line}`,
        borderRadius: 14,
        boxShadow: shadows.card,
      }}
    >
      <span style={{ fontFamily: f.mono, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.4, color: t.inkSoft }}>
        Quick read on your last answer
      </span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {positives.map((p, i) => (
          <span
            key={`pos-${i}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontFamily: f.sans,
              fontSize: 12,
              color: t.success,
              background: "rgba(21,128,61,0.08)",
              padding: "4px 10px",
              borderRadius: 999,
            }}
          >
            <span aria-hidden>+</span>
            {p}
          </span>
        ))}
        {improvements.map((c, i) => (
          <span
            key={`imp-${i}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontFamily: f.sans,
              fontSize: 12,
              color: t.copper,
              background: "rgba(180,83,9,0.08)",
              padding: "4px 10px",
              borderRadius: 999,
            }}
          >
            <span aria-hidden>·</span>
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─── MicQuietBanner — "I'm having trouble hearing you" ────────────── */

export function MicQuietBanner() {
  return (
    <div
      role="alert"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        background: "rgba(161,98,7,0.08)",
        border: `1px solid rgba(161,98,7,0.25)`,
        borderRadius: 12,
        maxWidth: 460,
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.warning} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
      </svg>
      <span style={{ fontFamily: f.sans, fontSize: 13, color: t.coal }}>
        Having trouble hearing you. Move closer to your mic, or
        <button
          type="button"
          className="hsx-link-indigo"
          style={{ background: "transparent", border: "none", padding: 0, marginLeft: 4, color: t.indigo, fontWeight: 500, cursor: "pointer", fontFamily: f.sans, fontSize: 13 }}
        >
          switch to typing
        </button>
        .
      </span>
    </div>
  );
}

