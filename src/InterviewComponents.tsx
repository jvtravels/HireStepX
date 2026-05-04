import React, { useState, useEffect, useRef } from "react";
import { e, ef } from "./interviewTokens";

/* Bridge aliases removed — call sites use e/ef directly. */

declare global {
  interface Navigator {
    connection?: { effectiveType?: string; downlink?: number; rtt?: number; addEventListener?: (event: string, cb: () => void) => void; removeEventListener?: (event: string, cb: () => void) => void };
  }
}

/* ─── Real Mic-Level Waveform Visualizer ─── */
export const WaveformVisualizer = React.memo(function WaveformVisualizer({ active, color, barCount = 16, stream }: { active: boolean; color: string; barCount?: number; stream?: MediaStream | null }) {
  const [bars, setBars] = useState<number[]>(Array(barCount).fill(0.1));
  const analyserRef = useRef<AnalyserNode | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!active || !stream) { setBars(Array(barCount).fill(0.1)); return; }
    let cancelled = false;
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    const source = ctx.createMediaStreamSource(stream);
    source.connect(analyser);
    ctxRef.current = ctx;
    analyserRef.current = analyser;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const update = () => {
      if (cancelled) return;
      analyser.getByteFrequencyData(dataArray);
      const newBars: number[] = [];
      const step = Math.floor(dataArray.length / barCount);
      for (let i = 0; i < barCount; i++) {
        const idx = Math.min(i * step, dataArray.length - 1);
        newBars.push(0.08 + (dataArray[idx] / 255) * 0.92);
      }
      setBars(newBars);
      requestAnimationFrame(update);
    };
    requestAnimationFrame(update);

    return () => {
      cancelled = true;
      source.disconnect();
      ctx.close().catch(() => {});
      analyserRef.current = null;
      ctxRef.current = null;
    };
  }, [active, stream, barCount]);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3, height: 40 }}>
      {bars.map((h, i) => (
        <div key={i} style={{
          width: 3, borderRadius: 2, height: `${h * 100}%`, background: color,
          opacity: active ? 0.8 : 0.15,
          transition: active ? "height 0.06s ease" : "height 0.5s ease, opacity 0.5s ease",
        }} />
      ))}
    </div>
  );
});

/* ─── Interviewer Names (deterministic per session) ─── */
export const INTERVIEWER_NAMES = [
  "Arjun Mehta", "Priya Sharma", "Rohan Kapoor", "Ananya Patel", "Vikram Desai",
  "Kavya Nair", "Siddharth Joshi", "Neha Gupta", "Aditya Rao", "Deepika Iyer",
  "Karthik Nair", "Aisha Rahman", "Rajesh Iyer", "Meera Reddy", "Tanvi Kulkarni",
];
export function getInterviewerName(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  return INTERVIEWER_NAMES[Math.abs(hash) % INTERVIEWER_NAMES.length];
}

const FEMALE_FIRST_NAMES = new Set(["Priya", "Ananya", "Kavya", "Neha", "Deepika", "Aisha", "Meera", "Tanvi"]);
/** Determine gender from interviewer name */
export function getInterviewerGender(name: string): "male" | "female" {
  const firstName = name.split(" ")[0];
  return FEMALE_FIRST_NAMES.has(firstName) ? "female" : "male";
}

/* ─── Panel Interview Members ─── */
export interface PanelMember {
  name: string;
  title: string;          // "Hiring Manager", "Technical Lead", "HR Partner"
  gender: "male" | "female";
  color: string;          // accent color for UI distinction
}

/** Deterministically pick 3 panelists (Hiring Manager, Technical Lead, HR Partner)
 *  with gender-matched names. Same seed → same panel every time. */
const MALE_NAMES = ["Arjun Mehta", "Rohan Kapoor", "Vikram Desai", "Siddharth Joshi", "Aditya Rao", "Karthik Nair", "Rajesh Iyer"];
const FEMALE_NAMES = ["Priya Sharma", "Ananya Patel", "Kavya Nair", "Neha Gupta", "Deepika Iyer", "Meera Reddy", "Aisha Rahman"];

function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

export function getPanelMembers(seed: string): PanelMember[] {
  const h = hashString(seed);
  // Roles with assigned accent colors — editorial palette so the panel
  // avatars cohere with the cream/copper/indigo design system. Each role
  // gets a distinct tint while staying on-brand:
  //   Hiring Manager → copper (editorial accent — the "lead" voice)
  //   Technical Lead → indigo (interactive — the "challenger" voice)
  //   HR Partner     → success (warm green — the "supportive" voice)
  const roles: { title: string; color: string }[] = [
    { title: "Hiring Manager", color: "#B45309" },   // copper
    { title: "Technical Lead", color: "#312E81" },   // indigo
    { title: "HR Partner",     color: "#15803D" },   // success green
  ];
  // Distribute genders: use hash bits to decide. At least 1 male, 1 female.
  // Bit 0 → role[0] gender, bit 1 → role[1] gender, but clamp so we get mix
  const genderBits = h % 6; // 6 combos with at least 1M and 1F
  const genderPatterns: ("male" | "female")[][] = [
    ["male", "female", "female"],
    ["female", "male", "female"],
    ["female", "female", "male"],
    ["male", "male", "female"],
    ["male", "female", "male"],
    ["female", "male", "male"],
  ];
  const genders = genderPatterns[genderBits];

  const usedMale = new Set<number>();
  const usedFemale = new Set<number>();

  return roles.map((role, i) => {
    const gender = genders[i];
    const pool = gender === "male" ? MALE_NAMES : FEMALE_NAMES;
    const used = gender === "male" ? usedMale : usedFemale;
    // Pick a name from the pool using hash + index, avoiding duplicates
    let idx = (h + i * 7 + i) % pool.length;
    while (used.has(idx)) idx = (idx + 1) % pool.length;
    used.add(idx);
    return { name: pool[idx], title: role.title, gender, color: role.color };
  });
}

/* ─── Network Indicator ─── */
export const NetworkIndicator = React.memo(function NetworkIndicator() {
  const [quality, setQuality] = useState<"excellent" | "good" | "poor">("excellent");
  useEffect(() => {
    const check = () => {
      const conn = navigator.connection;
      if (conn) {
        const dl = conn.downlink ?? 10;
        const rtt = conn.rtt ?? 0;
        if (dl >= 5 && rtt < 100) setQuality("excellent");
        else if (dl >= 1 && rtt < 300) setQuality("good");
        else setQuality("poor");
      } else {
        setQuality(navigator.onLine ? "excellent" : "poor");
      }
    };
    check();
    const conn = navigator.connection;
    conn?.addEventListener?.("change", check);
    window.addEventListener("online", check);
    window.addEventListener("offline", check);
    const id = setInterval(check, 10_000);
    return () => {
      conn?.removeEventListener?.("change", check);
      window.removeEventListener("online", check);
      window.removeEventListener("offline", check);
      clearInterval(id);
    };
  }, []);
  const colors = { excellent: e.success, good: e.copper, poor: e.error };
  const labels = { excellent: "Excellent", good: "Good", poor: "Poor" };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 100, background: "rgba(20,17,10,0.10)", border: `1px solid ${colors[quality]}30` }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: colors[quality], boxShadow: `0 0 6px ${colors[quality]}60` }} />
      <span style={{ fontFamily: ef.sans, fontSize: 10, fontWeight: 500, color: colors[quality] }}>{labels[quality]}</span>
    </div>
  );
});

/* ─── Dot Grid Visualizer (AI speaking) ─── */
const DOT_GRID_SIZE = 7;
const DOT_COUNT = DOT_GRID_SIZE * DOT_GRID_SIZE;
export const DotGridVisualizer = React.memo(function DotGridVisualizer({ active, thinking }: { active: boolean; thinking?: boolean }) {
  const [dots, setDots] = useState<number[]>(Array(DOT_COUNT).fill(0.15));
  // Pre-compute distance-from-center to avoid recalculating every frame
  const distRef = useRef<number[]>([]);
  if (distRef.current.length === 0) {
    distRef.current = Array.from({ length: DOT_COUNT }, (_, i) => {
      const row = Math.floor(i / DOT_GRID_SIZE);
      const col = i % DOT_GRID_SIZE;
      return Math.sqrt((row - 3) ** 2 + (col - 3) ** 2);
    });
  }

  useEffect(() => {
    if (!active && !thinking) { setDots(Array(DOT_COUNT).fill(0.15)); return; }
    const dist = distRef.current;
    const interval = active ? 80 : 200;
    // Reuse a single buffer instead of allocating new arrays each tick
    const buffer = new Array(DOT_COUNT);
    const id = setInterval(() => {
      const now = Date.now();
      for (let i = 0; i < DOT_COUNT; i++) {
        const d = dist[i];
        if (thinking && !active) {
          const breath = Math.sin(now / 800 + d * 0.4) * 0.3 + 0.5;
          buffer[i] = 0.1 + breath * 0.3 * (1 - d / 6);
        } else {
          const wave = Math.sin(now / 300 + d * 0.8) * 0.5 + 0.5;
          buffer[i] = 0.15 + wave * 0.85 * (1 - d / 5) + Math.random() * 0.15;
        }
      }
      setDots(buffer.slice()); // slice() to trigger React render with new reference
    }, interval);
    return () => clearInterval(id);
  }, [active, thinking]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${DOT_GRID_SIZE}, 1fr)`, gap: 5, width: 100, height: 100 }}>
      {dots.map((scale, i) => (
        <div key={i} style={{
          width: 8, height: 8, borderRadius: "50%",
          background: e.copper,
          opacity: active ? Math.min(0.9, scale) : thinking ? Math.min(0.4, scale + 0.05) : 0.1,
          transform: `scale(${active ? 0.5 + scale * 0.5 : thinking ? 0.5 + scale * 0.3 : 0.6})`,
          transition: active ? "all 0.1s ease" : "all 0.3s ease",
        }} />
      ))}
    </div>
  );
});

/* ─── Question Progress Bar ─── */
export const QuestionProgressBar = React.memo(function QuestionProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div style={{ width: "100%", maxWidth: 480 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontFamily: ef.sans, fontSize: 12, fontWeight: 600, color: e.coal }}>
          Question {current} of {total}
        </span>
        <span style={{ fontFamily: ef.mono, fontSize: 11, color: e.inkSoft }}>
          {Math.round((current / total) * 100)}%
        </span>
      </div>
      <div style={{ display: "flex", gap: 3, height: 4 }}>
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} style={{
            flex: 1, borderRadius: 2, height: 4,
            background: i < current ? e.copper : i === current ? "rgba(180,83,9,0.40)" : "rgba(20,17,10,0.13)",
            transition: "all 0.4s ease",
          }} />
        ))}
      </div>
    </div>
  );
});

/* ─── Live Captions (synced to TTS voice playback) ─── */
export const LiveCaptions = React.memo(function LiveCaptions({ text, isTyping, speakingDuration, actualDuration, speechEnded, variant = "card" }: {
  text: string; isTyping: boolean; speakingDuration?: number;
  /** Real TTS audio duration in ms — reported by TTS provider after audio loads */
  actualDuration?: number;
  /** Set to true when TTS voice finishes — triggers fast-complete of remaining text */
  speechEnded?: boolean;
  /** "card" stamps its own serif/22px (legacy panel layout). "inherit"
      defers to the parent — used inside CanvasPlainHeading where the
      h1's clamp() font controls typography. Mismatched type between
      typewriter and final heading is what caused the visible "jerk"
      when speaking → listening swapped the renderer. */
  variant?: "card" | "inherit";
}) {
  const [displayText, setDisplayText] = useState("");
  const [charIndex, setCharIndex] = useState(0);

  useEffect(() => {
    setDisplayText("");
    setCharIndex(0);
  }, [text]);

  // When speech ends, instantly show all remaining text (no gradual flush)
  useEffect(() => {
    if (!speechEnded || charIndex >= text.length) return;
    setDisplayText(text);
    setCharIndex(text.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speechEnded]);

  useEffect(() => {
    if (!isTyping || charIndex >= text.length || speechEnded) return;
    // Use actualDuration from TTS if available, else fall back to speakingDuration estimate
    const duration = actualDuration || speakingDuration || Math.max(2500, (text.split(/\s+/).length / 175) * 60 * 1000);
    // Calculate per-char delay to finish typing in sync with voice
    // Leave a small buffer (200ms) so typing finishes just before voice ends
    const remainingChars = text.length - charIndex;
    const elapsedRatio = charIndex / text.length;
    const remainingDuration = duration * (1 - elapsedRatio) - 200;
    const msPerChar = Math.max(12, remainingDuration / remainingChars);
    const delay = Math.max(12, Math.min(70, msPerChar + (Math.random() * 4 - 2)));
    const timer = setTimeout(() => {
      setDisplayText(text.slice(0, charIndex + 1));
      setCharIndex(charIndex + 1);
    }, delay);
    return () => clearTimeout(timer);
  }, [charIndex, text, isTyping, speakingDuration, actualDuration, speechEnded]);

  if (!isTyping && !displayText) return null;

  /* The typing animation streams text char-by-char. We INTENTIONALLY mark
     this region aria-hidden so screen readers don't replay every keystroke
     update — the parent QuestionCard is already aria-live="polite"
     aria-atomic="true" which announces the full question once per phase
     transition. The visible animation is purely sighted-user candy. */
  return (
    <div style={{ width: "100%" }} aria-hidden="true">
      <p style={
        variant === "inherit"
          ? {
              // Inherit parent's font/size/spacing/color so we don't fight
              // the surrounding heading. Only structural styles stay local.
              font: "inherit", color: "inherit",
              lineHeight: "inherit", letterSpacing: "inherit",
              margin: 0, textWrap: "balance",
            }
          : {
              fontFamily: ef.serif, fontSize: 22, color: e.coal,
              lineHeight: 1.35, margin: 0, minHeight: 30,
              letterSpacing: "-0.01em", textWrap: "balance",
            }
      }>
        {displayText}
        {isTyping && charIndex < text.length && (
          <span style={{ display: "inline-block", width: 2, height: 20, background: e.copper, marginLeft: 2, verticalAlign: "text-bottom", animation: "blink 0.8s ease-in-out infinite" }} />
        )}
      </p>
    </div>
  );
});

/* ─── Timer ─── */
export function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/* ─── Control Button ─── */
export const ControlButton = React.memo(function ControlButton({ icon, label, active, danger, onClick }: {
  icon: React.ReactNode; label: string; active?: boolean; danger?: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      style={{
        width: 48, height: 48, borderRadius: "50%",
        background: danger ? e.copperSoft : active ? e.indigo100 : e.white,
        border: `1px solid ${danger ? "rgba(180,83,9,0.30)" : active ? e.indigoRing : e.line}`,
        color: danger ? e.copper : active ? e.indigo : e.inkSoft,
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.2s ease", outline: "none",
        boxShadow: "0 1px 0 rgba(20,17,10,.04), 0 1px 2px rgba(20,17,10,.04)",
      }}
      onFocus={(ev) => ev.currentTarget.style.boxShadow = `0 0 0 4px ${danger ? "rgba(180,83,9,0.20)" : e.indigoRing}`}
      onBlur={(ev) => ev.currentTarget.style.boxShadow = "0 1px 0 rgba(20,17,10,.04), 0 1px 2px rgba(20,17,10,.04)"}
      onMouseEnter={(ev) => {
        ev.currentTarget.style.background = danger ? "rgba(180,83,9,0.18)" : active ? e.indigo100 : e.creamSoft;
        ev.currentTarget.style.transform = "scale(1.05)";
      }}
      onMouseLeave={(ev) => {
        ev.currentTarget.style.background = danger ? e.copperSoft : active ? e.indigo100 : e.white;
        ev.currentTarget.style.transform = "scale(1)";
      }}
    >
      {icon}
    </button>
  );
});
