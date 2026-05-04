/* HireStepX — Production canvas atoms
   Port of tempo/designs/canvases/interview/_atoms.tsx into production.
   Used by Interview.tsx to render the editorial cream/copper interview
   surface with the exact composition designed in Tempo:

     ── topbar ───────────────────────────────────────────────
     Wordmark · ContextChip       ProgressDots · StatusPill ·
                                  MuteToggle · CameraToggle ·
                                  Avatar
     ── stage ────────────────────────────────────────────────
     EditorialHeading (italic-copper accent)
     QuestionText
     VoiceVisualizer (dotted hex sphere in soft disc)
     PersonaLabel (Maya · listening)
     KeycapButton + "or type" + Skip
     HintBubble
     ── footer ───────────────────────────────────────────────
     MetaRow            trustLine            EndButton
*/
import React from "react";
import { e, ef } from "./interviewTokens";

/* ─── Wordmark — split spans for the italic X, but exposes a single
     "HireStepX" accessible name so screen readers don't say "Hire Step X"
     and so tests can query it as one text node. */
export function CanvasWordmark({ size = 18 }: { size?: number }) {
  return (
    <span
      aria-label="HireStepX"
      style={{
        display: "inline-flex", alignItems: "baseline", gap: 0,
        fontFamily: ef.serif, fontSize: size, fontWeight: 600,
        color: e.coal, letterSpacing: -0.4,
      }}
    >
      <span aria-hidden>HireStep</span>
      <span aria-hidden style={{ fontStyle: "italic", color: e.copper }}>X</span>
    </span>
  );
}

/* ─── StatusPill ─── */
export type CanvasConnectionStatus = "good" | "fair" | "poor" | "offline";
export function CanvasStatusPill({ status }: { status: CanvasConnectionStatus }) {
  const map: Record<CanvasConnectionStatus, { color: string; bg: string; label: string }> = {
    good:    { color: e.success, bg: "rgba(21, 128, 61, 0.08)", label: "Connection good" },
    fair:    { color: e.warning, bg: "rgba(161, 98, 7, 0.10)",  label: "Connection fair" },
    poor:    { color: e.error,   bg: "rgba(185, 28, 28, 0.08)", label: "Connection poor" },
    offline: { color: e.error,   bg: "rgba(185, 28, 28, 0.10)", label: "You're offline" },
  };
  const { color, bg, label } = map[status];
  return (
    <span role="status" aria-live="polite" style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      fontFamily: ef.sans, fontSize: 12, fontWeight: 500,
      color, background: bg, padding: "5px 12px 5px 10px",
      borderRadius: 999, letterSpacing: 0.1,
    }}>
      <span aria-hidden style={{ width: 6, height: 6, borderRadius: 999, background: color, opacity: 0.95 }} />
      {label}
    </span>
  );
}

/* ─── ProgressDots ─── removed.
   Real interviews are time-bounded, not question-bounded. The session
   elapsed clock already lives in the footer's CanvasMetaRow, so the
   topbar slot is now empty rather than carrying a duplicate. */

/* ─── ContextChip ─── */
/* Truncate long role/company strings so the chip doesn't overflow on
   phone-portrait widths. Full string lives in the aria-label, so screen
   readers + accessibility tools always get the unabbreviated value. */
function truncateChip(s: string, max: number): string {
  if (!s || s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}
export function CanvasContextChip({ role, company, focus }: { role: string; company: string; focus: string }) {
  // Each segment max ~14 chars on display; full strings stay in aria-label.
  const roleShort = truncateChip(role, 16);
  const companyShort = truncateChip(company, 14);
  const focusShort = truncateChip(focus, 14);
  return (
    <span
      aria-label={`Interviewing for ${role}${company ? " at " + company : ""}, focus: ${focus}`}
      title={`${role}${company ? " · " + company : ""} · ${focus}`}
      className="iv-canvas-contextchip"
      style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        fontFamily: ef.mono, fontSize: 10.5, fontWeight: 500,
        textTransform: "uppercase", letterSpacing: 1.4, color: e.inkSoft,
        background: e.creamSoft, border: `1px solid ${e.line}`,
        padding: "5px 10px", borderRadius: 6,
        // Allow wrapping at the segment boundaries on narrow screens.
        // The CSS in index.css further tightens spacing under 480px so
        // the chip stays one visual unit instead of three orphan pills.
        whiteSpace: "nowrap",
        maxWidth: "100%",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
    >
      <span style={{ color: e.coal, fontWeight: 600 }}>{roleShort}</span>
      {companyShort && (<><span aria-hidden style={{ color: e.inkFaint }}>·</span><span>{companyShort}</span></>)}
      <span aria-hidden style={{ color: e.inkFaint }}>·</span>
      <span style={{ color: e.copper }}>{focusShort}</span>
    </span>
  );
}

/* ─── Avatar ─── */
export function CanvasAvatar({ initials = "RS" }: { initials?: string }) {
  return (
    <span aria-label="Account" style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 34, height: 34, borderRadius: 999,
      background: e.indigo100, color: e.indigo,
      fontFamily: ef.serif, fontSize: 13, fontWeight: 500,
    }}>
      {initials}
    </span>
  );
}

/* ─── MuteToggle (topbar) ─── */
export function CanvasMuteToggle({ muted, onClick }: { muted: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      aria-pressed={muted}
      aria-label={muted ? "Unmute (Alt+M)" : "Mute (Alt+M)"}
      title={muted ? "Muted — click to unmute (Alt+M)" : "Mute (Alt+M)"}
      style={{
        display: "inline-flex", alignItems: "center", gap: 8, height: 34, padding: "0 12px",
        background: muted ? "rgba(180,83,9,0.10)" : e.white,
        border: `1px solid ${muted ? "rgba(180,83,9,0.30)" : e.line}`,
        borderRadius: 999, cursor: "pointer",
        fontFamily: ef.sans, fontSize: 12, fontWeight: 500,
        color: muted ? e.copper : e.inkSoft, transition: "all 160ms ease",
      }}>
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

/* ─── CameraToggle (topbar) ─── */
export function CanvasCameraToggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      aria-pressed={on}
      aria-label={on ? "Turn camera off" : "Turn camera on"}
      title={on ? "Camera on — click to turn off" : "Camera off — click to turn on"}
      style={{
        display: "inline-flex", alignItems: "center", gap: 8, height: 34, padding: "0 12px",
        background: on ? e.indigo100 : e.white,
        border: `1px solid ${on ? "rgba(49,46,129,0.30)" : e.line}`,
        borderRadius: 999, cursor: "pointer",
        fontFamily: ef.sans, fontSize: 12, fontWeight: 500,
        color: on ? e.indigo : e.inkSoft, transition: "all 160ms ease",
      }}>
      {on ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <polygon points="23 7 16 12 23 17 23 7" />
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" />
          <path d="M22 8 16 12l6 4Z" opacity="0.6" />
          <line x1="2" y1="2" x2="22" y2="22" />
        </svg>
      )}
      <span>{on ? "Camera on" : "Camera off"}</span>
    </button>
  );
}

/* ─── VoiceVisualizer (dotted hex sphere) ─── */
export type CanvasVizState = "idle" | "ai-speaking" | "ai-thinking" | "user-speaking" | "warning";
export function CanvasVoiceVisualizer({ state, size = 150 }: { state: CanvasVizState; size?: number }) {
  const dotColor = (() => {
    switch (state) {
      case "idle":          return e.inkFaint;
      case "ai-speaking":   return e.coal;
      case "ai-thinking":   return e.copper;
      case "user-speaking": return e.indigo;
      case "warning":       return e.warning;
    }
  })();
  const step = size / 22;
  const radius = size / 2;
  const dots: { cx: number; cy: number; r: number; opacity: number }[] = [];
  for (let yi = -12; yi <= 12; yi++) {
    const y = yi * step * 0.866;
    if (Math.abs(y) > radius) continue;
    const offset = (yi % 2 === 0 ? 0 : step / 2);
    for (let xi = -12; xi <= 12; xi++) {
      const x = xi * step + offset;
      const dist = Math.sqrt(x * x + y * y);
      if (dist > radius - step / 2) continue;
      const edgeFade = Math.max(0, 1 - dist / radius);
      dots.push({ cx: radius + x, cy: radius + y, r: 1.4, opacity: 0.35 + edgeFade * 0.6 });
    }
  }
  return (
    <div role="presentation" className={`hsx-viz hsx-viz-${state}`}
      aria-label={
        state === "ai-speaking" ? "Interviewer is speaking"
        : state === "ai-thinking" ? "Interviewer is thinking"
        : state === "user-speaking" ? "You are speaking"
        : state === "warning" ? "Connection warning"
        : "Quiet"
      }
      style={{ width: size, height: size, position: "relative" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {dots.map((d, i) => (
          <circle key={i} cx={d.cx} cy={d.cy} r={d.r} fill={dotColor} opacity={d.opacity} />
        ))}
      </svg>
    </div>
  );
}

/* ─── PersonaLabel ─── */
export type CanvasPersonaState = "listening" | "speaking" | "thinking" | "paused" | "your-turn" | "you-speaking" | "you-typing";
export function CanvasPersonaLabel({ name, state }: { name: string; state: CanvasPersonaState }) {
  const stateLabel = (() => {
    switch (state) {
      case "listening":     return "listening to you";
      case "speaking":      return "speaking";
      case "thinking":      return "thinking…";
      case "paused":        return "paused";
      case "your-turn":     return "ready when you are";
      case "you-speaking":  return "is hearing you now";
      case "you-typing":    return "is reading your answer";
    }
  })();
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <span style={{ fontFamily: ef.serif, fontSize: 17, fontWeight: 500, color: e.coal, letterSpacing: -0.2 }}>
        {name}
      </span>
      <span style={{ fontFamily: ef.sans, fontSize: 12, color: e.inkSoft, letterSpacing: 0.05 }}>
        {stateLabel}
      </span>
    </div>
  );
}

/* ─── EditorialHeading ─── */
export function CanvasEditorialHeading({ before = "", accent, after = "", trailing = "." }: {
  before?: string; accent: string; after?: string; trailing?: string;
}) {
  return (
    <h1 style={{
      fontFamily: ef.serif, fontSize: "clamp(1.5rem, 2.4vw, 2rem)",
      lineHeight: 1.18, fontWeight: 400, letterSpacing: "-0.015em",
      color: e.coal, textAlign: "center", margin: 0, textWrap: "balance",
    }}>
      {before && <>{before} </>}
      <em style={{ fontStyle: "italic", fontWeight: 400, color: e.copper }}>{accent}</em>
      {after && <> {after}</>}
      {trailing}
    </h1>
  );
}

/* ─── PlainHeading — fallback when we don't have an accent split ─── */
export function CanvasPlainHeading({ children }: { children: React.ReactNode }) {
  return (
    <h1 style={{
      fontFamily: ef.serif, fontSize: "clamp(1.5rem, 2.4vw, 2rem)",
      lineHeight: 1.25, fontWeight: 400, letterSpacing: "-0.015em",
      color: e.coal, textAlign: "center", margin: 0, textWrap: "balance",
    }}>
      {children}
    </h1>
  );
}

/* ─── QuestionText ─── */
export function CanvasQuestionText({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontFamily: ef.serif, fontSize: 15, fontStyle: "normal", fontWeight: 400,
      lineHeight: 1.5, color: e.indigoGray, textAlign: "center", textWrap: "balance",
      maxWidth: 540, margin: "0 auto", letterSpacing: -0.05,
    }}>
      {children}
    </p>
  );
}

/* ─── HintBubble ─── */
export function CanvasHintBubble({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      fontFamily: ef.sans, fontSize: 12, color: e.inkSoft,
      margin: 0, background: "transparent", padding: 0,
    }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M9 18h6" />
        <path d="M10 22h4" />
        <path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.2 1 2v1.3h6v-1.3c0-.8.4-1.5 1-2A7 7 0 0 0 12 2z" />
      </svg>
      <span>{children}</span>
    </p>
  );
}

/* ─── KeycapButton — primary CTA in stage action zone ─── */
export type CanvasKeycapState = "ready" | "active" | "disabled" | "submitting";
export function CanvasKeycapButton({ state, label, hint, onClick, kbd = "Space" }: {
  state: CanvasKeycapState;
  label?: string;
  hint?: string;
  onClick?: () => void;
  kbd?: string;
}) {
  const labels: Record<CanvasKeycapState, string> = {
    ready:      "Hold Spacebar to answer",
    active:     "Release to send",
    disabled:   "Wait for the question to finish",
    submitting: "Sending…",
  };
  const finalLabel = label ?? labels[state];
  const isInteractive = state === "ready" || state === "active";
  const bg = state === "active" ? e.indigo : e.white;
  const color = state === "active" ? e.cream : e.coal;
  const border = state === "active" ? e.indigo : e.line;
  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <button
        type="button"
        onClick={onClick}
        disabled={!isInteractive}
        aria-pressed={state === "active"}
        className="hsx-iv-keycap"
        data-state={state}
        style={{
          display: "inline-flex", alignItems: "center", gap: 12,
          fontFamily: ef.sans, fontSize: 13, fontWeight: 500,
          color, background: bg, border: `1px solid ${border}`,
          borderRadius: 999, padding: "10px 18px 10px 12px",
          cursor: isInteractive ? "pointer" : "not-allowed",
          opacity: state === "disabled" ? 0.55 : 1,
          transition: "transform 180ms cubic-bezier(0.16, 1, 0.3, 1), background 180ms ease, color 180ms ease, border-color 180ms ease, box-shadow 180ms ease",
          transform: state === "active" ? "scale(1.02)" : "scale(1)",
          boxShadow: state === "active"
            ? "0 6px 20px -6px rgba(49, 46, 129, 0.4)"
            : "0 1px 0 rgba(20,17,10,.04), 0 1px 2px rgba(20,17,10,.04)",
        }}
      >
        <kbd aria-hidden style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          minWidth: 56, height: 24, padding: "0 8px",
          background: state === "active" ? "rgba(250,247,240,0.20)" : e.creamSoft,
          border: `1px solid ${state === "active" ? "rgba(250,247,240,0.30)" : e.line}`,
          borderRadius: 6, fontFamily: ef.mono, fontSize: 11, fontWeight: 500,
          color: state === "active" ? e.cream : e.inkSoft, letterSpacing: 0.6,
        }}>
          {kbd}
        </kbd>
        <span>{finalLabel}</span>
      </button>
      {hint && <span style={{ fontFamily: ef.sans, fontSize: 12, color: e.inkFaint }}>{hint}</span>}
    </div>
  );
}

/* ─── TextLink ─── */
export function CanvasTextLink({ children, onClick, variant = "muted" }: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "indigo" | "muted";
}) {
  const color = variant === "indigo" ? e.indigo : e.inkSoft;
  return (
    <button type="button" onClick={onClick}
      style={{
        background: "transparent", border: "none", padding: 0, cursor: "pointer",
        fontFamily: ef.sans, fontSize: 13, fontWeight: 500, color,
        textDecoration: "none",
      }}>
      <span className="hsx-link-indigo" style={{ color }}>{children}</span>
    </button>
  );
}

/* ─── SkipLink ─── */
export function CanvasSkipLink({ onClick }: { onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick}
      aria-label="Skip this question"
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        background: "transparent", border: "none", padding: "4px 6px", cursor: "pointer",
        fontFamily: ef.sans, fontSize: 12, fontWeight: 500, color: e.copper,
        opacity: 0.85, transition: "opacity 160ms ease",
      }}
      onMouseEnter={(ev) => (ev.currentTarget.style.opacity = "1")}
      onMouseLeave={(ev) => (ev.currentTarget.style.opacity = "0.85")}
    >
      <span>Skip question</span>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <polyline points="13 17 18 12 13 7" />
        <polyline points="6 17 11 12 6 7" />
      </svg>
    </button>
  );
}

/* ─── MetaRow (footer left) ─── */
export function CanvasMetaRow({ elapsedSec, exchanges }: { elapsedSec: number; exchanges: number }) {
  // Pad both minutes and seconds so the elapsed reads as "00:00" — matches
  // the production formatTime() convention and a few existing tests that
  // assert on the exact string.
  const m = Math.floor(elapsedSec / 60);
  const s = elapsedSec % 60;
  const time = `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 14,
      fontFamily: ef.mono, fontSize: 11, textTransform: "uppercase",
      letterSpacing: 1.4, color: e.inkSoft,
    }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        {time}
      </span>
      <span style={{ color: e.inkFaint }}>·</span>
      <span>{exchanges} {exchanges === 1 ? "exchange" : "exchanges"}</span>
    </div>
  );
}

/* ─── EndButton (footer right) ─── */
export function CanvasEndButton({ onClick }: { onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick}
      aria-label="End interview"
      className="iv-canvas-endbtn"
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        fontFamily: ef.sans, fontSize: 13, fontWeight: 500, color: e.copper,
        background: "transparent", border: `1px solid ${e.line}`,
        borderRadius: 999, padding: "8px 14px", cursor: "pointer",
        transition: "all 160ms ease",
      }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
      End interview
    </button>
  );
}

/* ─── SelfViewTile (camera-on overlay) ─── */
export function CanvasSelfViewTile({ videoRef, initials = "RS" }: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  initials?: string;
}) {
  return (
    <div aria-label="Your camera preview" className="iv-canvas-selfview" style={{
      // Sits above the footer (~64-72px tall + safe-area). bottom:84
      // clears the footer rule on every supported viewport, including
      // iOS safe-area home-indicator phones. zIndex 11 wins over the
      // footer's zIndex 10 so the tile is never clipped behind it.
      position: "absolute", right: 24, bottom: 84,
      width: 148, height: 96, borderRadius: 12, overflow: "hidden",
      // Cream-friendly framing: white border + warm shadow so the tile
      // reads as a "card on cream" not "hole in the page". The dark
      // gradient inside is the placeholder when the camera stream
      // hasn't connected yet (real video fills it once available).
      background: e.creamSoft,
      border: `2px solid ${e.white}`,
      boxShadow: "0 1px 0 rgba(20,17,10,.04), 0 8px 24px -10px rgba(20,17,10,.30), 0 0 0 1px rgba(20,17,10,.06)",
      zIndex: 11,
    }}>
      <video
        ref={videoRef}
        autoPlay muted playsInline
        style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }}
        aria-hidden
      >
        <track kind="captions" />
      </video>
      <div aria-hidden style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
        <span style={{
          width: 36, height: 36, borderRadius: 999, background: "rgba(255,255,255,0.18)",
          color: e.cream, display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: ef.serif, fontSize: 14, fontWeight: 500, opacity: 0.0,
        }}>{initials}</span>
      </div>
      {/* Recording badge — high-contrast against either the dark
          gradient placeholder OR the live video frame. */}
      <span aria-hidden style={{
        position: "absolute", top: 8, left: 8, display: "inline-flex", alignItems: "center", gap: 4,
        padding: "2px 6px", borderRadius: 4,
        background: "rgba(14,12,8,0.65)",
        fontFamily: ef.mono, fontSize: 9, textTransform: "uppercase", letterSpacing: 1,
        color: e.cream,
      }}>
        <span style={{ width: 5, height: 5, borderRadius: 999, background: "#EF4444" }} />
        Live
      </span>
    </div>
  );
}
