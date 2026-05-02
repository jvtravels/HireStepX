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
   accent word picked from the question.

   Strategy (in order):
     1. Match against known interview-question patterns and take the
        emphasis word at the captured position. Catches ~80% of common
        forms cleanly: "Tell me about a TIME you led", "Walk me through
        a PROJECT where…", "Why X", "How would you SIZE the market…".
     2. Fall back to a heuristic that prefers action verbs over nouns,
        skips proper nouns (mid-sentence capitalized words like
        company names), and prefers the priority editorial set.
     3. Return null if no decent candidate found — caller renders
        the plain heading instead. Better no accent than a bad one. */

/** Words we love as accents — verbs of doing + emotionally-loaded nouns. */
const ACCENT_PRIORITY = new Set([
  // editorial nouns
  "time", "decision", "challenge", "conflict", "mistake", "failure", "success",
  "moment", "story", "example", "experience", "situation", "incident", "regret",
  "lesson", "learning", "win", "loss", "tradeoff", "trade-off", "weakness",
  // verbs of doing
  "led", "convince", "persuade", "negotiate", "design", "build", "ship",
  "deliver", "fix", "solve", "improve", "scale", "drive", "launch", "cut",
  "rebuild", "rewrite", "migrate", "untangle", "refactor", "size", "estimate",
  "prioritize", "decide", "balance", "handle", "manage", "lead", "mentor",
  "coach", "influence", "align", "challenge", "push", "advocate",
  // emotion / quality
  "proud", "regret", "learned", "taught", "changed", "impact", "biggest",
  "hardest", "toughest", "ready", "workable", "specific", "honest",
  // question heads
  "why", "how", "when", "what", "where",
]);

/** Stopwords excluded from heuristic fallback. */
const STOPWORDS = new Set([
  "a","an","the","of","to","in","on","at","by","for","with","from","is","are",
  "was","were","be","been","being","have","has","had","do","does","did","and",
  "or","but","not","that","this","these","those","it","its","i","you","we",
  "they","he","she","tell","me","about","walk","through","describe","share",
  "talk","discuss","share","explain","give","take","let","know","think",
  "your","yours","mine","my","our","ours","their","theirs","his","her","hers",
  "can","could","would","should","will","may","might","just","only","also",
  "very","really","quite","most","more","much","some","any","all","every",
  "now","then","here","there","please","thank","thanks","sure",
]);

/** Action verbs that work especially well as accents. */
const ACTION_VERBS = new Set([
  "led","convince","persuade","negotiate","design","build","ship","deliver",
  "fix","solve","improve","scale","drive","launch","cut","rebuild","rewrite",
  "migrate","untangle","refactor","size","estimate","prioritize","decide",
  "balance","handle","manage","mentor","coach","influence","align","push",
  "advocate","ask","tell","teach","learn","grow","change","start","end",
  "stop","run","write","review","approve","reject","pick","choose","accept",
]);

/**
 * Patterns: capture-group 1 must be the emphasis word. Tested against
 * common question shapes — order matters (more specific first).
 *
 * Aim: cover ~95% of behavioral/HR/case/technical/salary/management
 * question stems without a LLM round-trip. Each pattern was hand-picked
 * from the actual question banks the engine ships.
 */
const QUESTION_PATTERNS: RegExp[] = [
  /* ─── Behavioral STAR-style ─── */
  // "Tell me about a TIME (when/you) ..."
  /\btell\s+me\s+about\s+(?:a|an)\s+(time|moment|situation|story|example|experience|incident|decision|challenge|mistake|conflict|win|loss|project|tradeoff|trade-off|lesson|weakness|failure|success)\b/i,
  // "Tell me about your LAST ..." / "Tell me about your BIGGEST ..."
  /\btell\s+me\s+about\s+your\s+(last|first|biggest|hardest|proudest|toughest|favorite|worst)\b/i,
  // "Walk me through a PROJECT where ..."
  /\bwalk\s+me\s+through\s+(?:a|an|your)\s+(project|situation|story|decision|moment|migration|launch|rewrite|negotiation|conflict|problem|approach|process|day|week)\b/i,
  // "Describe a CHALLENGE ..."
  /\b(?:describe|share|recall|recount)\s+(?:a|an|your)\s+(time|moment|situation|story|example|experience|incident|decision|challenge|mistake|conflict|win|loss|project|tradeoff|trade-off|lesson|weakness|approach|strength|failure)\b/i,
  // "Give me an EXAMPLE of ..."
  /\bgive\s+(?:me|us)\s+(?:a|an)\s+(example|instance|case|story|scenario)\b/i,
  // "Think of a TIME ..."
  /\bthink\s+of\s+(?:a|an)\s+(time|moment|situation|story|example|experience|project)\b/i,

  /* ─── Self-reflective ─── */
  // "What's the BIGGEST ..." / "What was your TOUGHEST ..."
  /\bwhat(?:'s| is| was|'ve| has)\s+(?:the\s+|your\s+|been\s+)?(biggest|hardest|toughest|smallest|best|worst|proudest|most|least|favorite|riskiest|costliest|fastest|slowest|hardest)\b/i,
  // "What's your BIGGEST weakness" — emphasize "weakness"
  /\bwhat(?:'s| is)\s+your\s+(?:biggest\s+|greatest\s+)?(weakness|strength|fear|regret|gap|blind\s*spot|edge|advantage)\b/i,
  // "How do you HANDLE ..." / "How do you APPROACH ..."
  /\bhow\s+do\s+you\s+(handle|approach|manage|deal|tackle|prioritize|decide|measure|track|prepare|recover|stay|keep|grow|learn)\b/i,
  // "How would you SIZE the market"
  /\bhow\s+would\s+you\s+(\w+)\b/i,
  // "Why X and why Y" — accent the first "why"
  /^\s*(why)\b/i,
  // "What motivates / drives / energizes you"
  /\bwhat\s+(motivates|drives|energizes|excites|inspires|frustrates|scares)\s+you\b/i,

  /* ─── Future / aspirational ─── */
  // "Where do you see yourself ..."
  /\bwhere\s+do\s+you\s+(see|want|hope|expect)\b/i,
  // "What are your GOALS / PLANS"
  /\bwhat\s+(?:are|is)\s+your\s+(goals|plans|aspirations|priorities|objectives|hopes|dreams|ambitions)\b/i,

  /* ─── Technical / case ─── */
  // "Design a RATE-LIMITER for ..."
  /\b(?:design|build|architect|sketch|model|prototype|spec)\s+(?:a|an)\s+([a-z][a-z0-9-]+)\b/i,
  // "How would you SCALE / OPTIMIZE / DEBUG ..."
  /\bhow\s+would\s+you\s+(scale|optimize|debug|refactor|test|validate|measure|monitor|secure|migrate)\b/i,
  // "Estimate the NUMBER of ..."
  /\bestimate\s+(?:the\s+)?(number|size|cost|revenue|impact|reach|share|adoption|growth)\b/i,
  // "Walk me through your APPROACH ..."
  /\bwalk\s+me\s+through\s+your\s+(approach|process|thinking|reasoning|design|architecture)\b/i,

  /* ─── Salary negotiation ─── */
  // "Is X workable / acceptable / reasonable for you"
  /\bis\s+(?:that|this|₹?[\d.,]+\s*(?:lpa|k|cr)?)\s+(workable|acceptable|reasonable|fair|comfortable|doable)\b/i,
  // "What's your EXPECTATION / RANGE / NUMBER"
  /\bwhat(?:'s| is| are)\s+your\s+(expectations?|range|number|target|ask|requirement|floor|ceiling|bottom\s*line)\b/i,
  // "Help me UNDERSTAND ..."
  /\bhelp\s+me\s+(understand|see|figure|work|think)\b/i,

  /* ─── Open-ended / conversational ─── */
  // "Last one — WHY this company"
  /(?:^|—\s*|-\s*)(why|describe|tell|walk|share|explain|how|what|when|where|consider|imagine)\b/i,
  // "Now — DESCRIBE ..."
  /^now\s*[—-]\s*(\w+)\b/i,
  // "Let's start EASY" / "Let's start with ..."
  /\blet(?:'s| us)\s+start\s+(?:with\s+|by\s+)?(easy|simple|small|big|hard|tough|warm|fresh|over)\b/i,
];

/** Returns true if `word` looks like a proper noun mid-sentence
 * (capitalized but not the first token) — skip these so accents like
 * "Flipkart" don't dominate. */
function isLikelyProperNoun(word: string, isFirstToken: boolean): boolean {
  if (isFirstToken) return false;
  return /^[A-Z][a-z]/.test(word);
}

function pickAccent(text: string): { before: string; accent: string; after: string } | null {
  if (!text) return null;
  // Strip a leading bracketed persona tag like "[HR Partner] " before scanning
  const cleaned = text.replace(/^\[[^\]]+\]\s*/, "").trim();
  if (!cleaned) return null;

  // Strategy 1 — known interview-question patterns
  for (const pattern of QUESTION_PATTERNS) {
    const m = cleaned.match(pattern);
    if (!m || typeof m.index !== "number") continue;
    const accent = m[1];
    if (!accent || accent.length < 2) continue;
    // Find the accent's exact location within the cleaned text
    const accentStart = m.index + m[0].toLowerCase().lastIndexOf(accent.toLowerCase());
    const accentEnd = accentStart + accent.length;
    const before = cleaned.slice(0, accentStart).replace(/\s+$/, "");
    const after = cleaned.slice(accentEnd).replace(/^\s+/, "").replace(/[.!?]+\s*$/, "");
    if (!before && !after) continue;
    return { before, accent, after };
  }

  // Strategy 2 — heuristic over tokens
  const tokenRegex = /[\p{L}\p{N}][\p{L}\p{N}'-]*/gu;
  const tokens: { word: string; start: number; end: number; idx: number }[] = [];
  let i = 0;
  for (const match of cleaned.matchAll(tokenRegex)) {
    if (typeof match.index !== "number") continue;
    tokens.push({ word: match[0], start: match.index, end: match.index + match[0].length, idx: i++ });
  }
  if (tokens.length < 3) return null;

  // Score every token, pick the highest. Skip proper nouns and stopwords.
  type Scored = { tok: typeof tokens[0]; score: number };
  const scored: Scored[] = tokens
    .map((tok) => {
      const lower = tok.word.toLowerCase();
      if (STOPWORDS.has(lower)) return { tok, score: -1 };
      if (isLikelyProperNoun(tok.word, tok.idx === 0)) return { tok, score: -1 };
      if (tok.word.length < 3) return { tok, score: -1 };
      let score = tok.word.length; // length as a baseline
      if (ACCENT_PRIORITY.has(lower)) score += 30;
      if (ACTION_VERBS.has(lower)) score += 20;
      // Earlier action verbs feel more like the question's "core verb"
      if (ACTION_VERBS.has(lower) && tok.idx <= 6) score += 8;
      // Penalize the very first token slightly — feels weak as an accent
      if (tok.idx === 0) score -= 4;
      return { tok, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return null;
  const chosen = scored[0].tok;
  const before = cleaned.slice(0, chosen.start).replace(/\s+$/, "");
  const after = cleaned.slice(chosen.end).replace(/^\s+/, "").replace(/[.!?]+\s*$/, "");
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

/* SkipWithReason — replaces CanvasSkipLink in production. Click reveals
   a tiny popover with 4 reasons (industry standard for question-quality
   feedback loops). Selection fires posthog "interview_skip" + advances.
   "Just skip" lets users skip without committing to a reason. */
function SkipWithReason({ onConfirm }: { onConfirm: (reason: string) => void }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
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
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
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

/* CanvasListeningActionZone — production action zone matching the canvas:
   live transcript card → KeycapButton CTA → "or type / Skip" links →
   HintBubble. Replaces the old green-tinted UserAnswerArea card.

   Press-Space-when-done UX: engine still auto-listens via STT, so the
   keycap is a "send" affordance rather than true push-to-talk. Pressing
   Space (when not focused on the textarea) calls handleNextQuestion. */
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
    <div role="status" aria-live="polite" aria-label="Live answer metrics" style={{
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

function CanvasListeningActionZone({
  currentTranscript, setCurrentTranscript,
  speechUnavailable, setSpeechUnavailable,
  handleNextQuestion, textareaRef, nextBtnRef,
  isMuted, micQuiet, isCurrentFollowUp,
  replayQuestion, aiVoiceEnabled, hasQuestion,
  liveMetrics, interviewType,
  timeRemaining, timePercent,
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
  liveMetrics: {
    wordCount: number; wpm: number; fillerCount: number;
    lengthGuidance: string | null;
    ownership?: "i-led" | "balanced" | "we-heavy" | null;
    specificityHits?: number; specificityHint?: string | null;
  } | null;
  interviewType?: string | null;
  timeRemaining: number;
  timePercent: number;
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

      {/* Per-question countdown — always visible during listening so
          users see the budget. Stays muted when budget is large; warms
          and turns urgent in the last 30/15 seconds. */}
      <CountdownPill secondsRemaining={timeRemaining} percent={timePercent} />

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
          onConfirm={(reason) => {
            captureClientEvent("interview_skip", { reason });
            handleNextQuestion();
          }}
        />
      </div>

      {/* Hint */}
      {isCurrentFollowUp && (
        <CanvasHintBubble>This is a follow-up — be specific.</CanvasHintBubble>
      )}

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
    timeRemaining, timePercent,
    displayRole, displayCompany, displayFocus, interviewerName,
    isPanelInterview, panelMembers, activePersona,
    ttsDurationMs, speechEnded,
    saveWarning, liveMetrics,
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
            liveMetrics={liveMetrics}
            interviewType={typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("type") : null}
            timeRemaining={timeRemaining}
            timePercent={timePercent}
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
