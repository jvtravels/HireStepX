"use client";

import React, { memo, useRef, useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { e, ef } from "./interviewTokens";
import {
  WaveformVisualizer, NetworkIndicator, DotGridVisualizer,
  LiveCaptions, ControlButton, formatTime,
} from "./InterviewComponents";
import type { PanelMember } from "./InterviewComponents";
// PaceMeter is used inside UserAnswerArea below; the rest are imported
// for re-export at the bottom of this file.
import { PaceMeter } from "./InterviewRobustness";
import { stripProsodyMarkup } from "./_prosody";
import { computeCampusReadiness, type CpChipState } from "./_campus-readiness";

/* Bridge aliases removed — all inline-style call sites now reference
   `e.*` and `ef.*` directly from interviewTokens.ts. The rebrand is
   complete; the dark/gold tokens (c.gilt, font.ui, etc.) no longer
   live in this file. */

// Re-export the salary-negotiation components from their own file so
// existing call sites (Interview.tsx) keep working unchanged. The split
// is documented in InterviewNegotiationPanels.tsx; this file now owns
// only the general-purpose interview chrome (status, avatars, cards,
// completion/controls/transcript/end-modal/eval-overlay).
export { NegotiationCoachingCard, DealSummaryCard, NegotiationLiveDashboard, AnnotatedReplayPanel } from "./InterviewNegotiationPanels";

/* ═══════════════════════════════════════════════
   Extracted presentational components from Interview.tsx
   ═══════════════════════════════════════════════ */

/* ─── Status Toasts (tab conflict, offline, mic error) ─── */
/* Styles hoisted to module scope so memo() on the wrapper actually works —
   otherwise each render creates new style object references and memo is useless. */

const stStackStyle: React.CSSProperties = { position: "fixed", top: "max(12px, env(safe-area-inset-top, 0px))", left: "50%", transform: "translateX(-50%)", zIndex: 100, display: "flex", flexDirection: "column", gap: 8, maxWidth: 500, width: "min(90%, calc(100vw - 32px))" };
const stTabToast: React.CSSProperties = { padding: "8px 16px", borderRadius: 10, background: "rgba(180,83,9,0.14)", border: "1px solid rgba(180,83,9,0.25)", display: "flex", alignItems: "center", gap: 8, backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" };
const stOfflineToast: React.CSSProperties = { padding: "8px 16px", borderRadius: 10, background: "rgba(185,28,28,0.18)", border: "1px solid rgba(185,28,28,0.30)", display: "flex", alignItems: "center", gap: 8, backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" };
const stGiltText: React.CSSProperties = { fontFamily: ef.sans, fontSize: 12, color: e.copper };
const stEmberText: React.CSSProperties = { fontFamily: ef.sans, fontSize: 12, color: e.error };
/* Persistent TTS-failed banner — distinct from the auto-clearing ttsError
   toast. Non-dismissable because the failure is permanent until page reload. */
const stTtsFailedBanner: React.CSSProperties = { padding: "10px 16px", borderRadius: 10, background: "rgba(185,28,28,0.22)", border: "1px solid rgba(185,28,28,0.40)", display: "flex", alignItems: "center", gap: 8, backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" };

/* StatusToasts now only shows tab-conflict (rare, must be visible) and
   genuine offline state. The mic-error path used to flash a top-fixed
   toast on every Next-Question transition (QA bug 21: "sudden element
   appears at top of screen"). The inline MicQuietBanner inside the
   action zone handles user-facing mic guidance now — calmer, contextual,
   not jarring. micError is preserved as a debug breadcrumb in the
   browser console rather than splashed across the topbar. */
export const StatusToasts = memo(function StatusToasts({ tabConflict, isOffline, micError, ttsError, ttsFailed }: {
  tabConflict: boolean; isOffline: boolean; micError: string; ttsError?: string; ttsFailed?: boolean;
}) {
  // Mirror micError to the console for debugging while suppressing the toast.
  useEffect(() => {
    if (micError) console.warn("[interview] mic notice:", micError);
  }, [micError]);
  const showTts = !!(ttsError && ttsError.length > 0);
  if (!tabConflict && !isOffline && !showTts && !ttsFailed) return null;
  return (
    <div style={stStackStyle}>
      {tabConflict && (
        <div role="alert" style={stTabToast}>
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={e.copper} strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <span style={stGiltText}>Interview is open in another tab</span>
        </div>
      )}
      {isOffline && (
        <div role="alert" style={stOfflineToast}>
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={e.error} strokeWidth="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
          <span style={stEmberText}>Offline — session saved locally</span>
        </div>
      )}
      {showTts && (
        <div role="status" style={stTabToast}>
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={e.copper} strokeWidth="2" strokeLinecap="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
          <span style={stGiltText}>{ttsError}</span>
        </div>
      )}
      {ttsFailed && (
        <div role="alert" aria-live="assertive" style={stTtsFailedBanner}>
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={e.error} strokeWidth="2" strokeLinecap="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
          <span style={stEmberText}>Audio unavailable — please read questions on screen and type your answers.</span>
        </div>
      )}
    </div>
  );
});

/* ─── Interview Header (top info bar) ─── */

// Negotiation phase labels mapped to question indices (excluding intro at 0)
const NEG_PHASES = ["Offer", "Expectations", "Counter", "Benefits", "Closing Pressure", "Close"];
function getNegPhaseLabel(questionNum: number): string {
  if (questionNum <= 0) return "Intro";
  const idx = questionNum - 1;
  return idx < NEG_PHASES.length ? NEG_PHASES[idx] : `Round ${questionNum}`;
}

export const InterviewHeader = memo(function InterviewHeader({ displayCompany, displayRole, displayFocus, llmLoading, currentStep, phase, elapsed, currentQuestionNum, totalQuestions, baseQuestionCount, isCurrentFollowUp, saveWarning, onRetry, isSalaryNegotiation, sessionId }: {
  displayCompany: string; displayRole: string; displayFocus: string;
  llmLoading: boolean; currentStep: number;
  phase: string; elapsed: number;
  currentQuestionNum: number; totalQuestions: number;
  baseQuestionCount?: number; isCurrentFollowUp?: boolean;
  saveWarning?: string; onRetry?: () => void;
  isSalaryNegotiation?: boolean;
  sessionId?: string | null;
}) {
  return (
    <header className="iv-info-bar" style={{
      display: "flex", flexDirection: "column",
      borderBottom: `1px solid ${e.line}`,
      background: e.cream,
      zIndex: 10, flexShrink: 0,
    }}>
      <div className="iv-info-bar-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 24px", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flexWrap: "wrap" }}>
          <Image src="/wordmark.png" alt="HireStepX" width={387} height={108} style={{ height: 20, width: "auto", flexShrink: 0 }} />
          <div style={{ width: 1, height: 16, background: "rgba(20,17,10,0.05)" }} />
          {displayCompany && (
            <>
              <span style={{ fontFamily: ef.sans, fontSize: 12, fontWeight: 500, color: e.coal }}>{displayCompany}</span>
              <span className="iv-hide-mobile" style={{ fontFamily: ef.sans, fontSize: 11, color: e.inkSoft }}>·</span>
            </>
          )}
          {/* Role + focus chips wrapped in iv-hide-mobile because at ≤480px
              the header was carrying 11 datapoints in 40px — wordmark +
              dot + company + dot + role + dot + focus + (right side) network
              + spinner + dot + timer. On a 360-wide phone that wrapped
              ungracefully. Company stays (it's the most identifying chip);
              role + focus drop out. Both still appear in the score report. */}
          <span className="iv-hide-mobile" style={{ fontFamily: ef.sans, fontSize: 12, fontWeight: 500, color: e.coal }}>{displayRole}</span>
          <span className="iv-hide-mobile" style={{ fontFamily: ef.sans, fontSize: 11, color: e.inkSoft }}>·</span>
          <span className="iv-hide-mobile" style={{ fontFamily: ef.sans, fontSize: 11, color: e.copper }}>{displayFocus}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <NetworkIndicator />
          {llmLoading && currentStep <= 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 10, height: 10, border: "1.5px solid rgba(180,83,9,0.30)", borderTopColor: e.copper, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              <span style={{ fontFamily: ef.sans, fontSize: 11, color: e.inkSoft }}>Personalizing questions...</span>
            </div>
          )}
          {!llmLoading && saveWarning && saveWarning.includes("retry") && currentStep <= 1 && onRetry && (
            <button
              onClick={onRetry}
              style={{
                fontFamily: ef.sans, fontSize: 10, fontWeight: 600,
                color: e.copper, background: "rgba(180,83,9,0.16)",
                border: "1px solid rgba(180,83,9,0.25)", borderRadius: 6,
                padding: "4px 10px", cursor: "pointer",
                transition: "background 0.2s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(180,83,9,0.24)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(180,83,9,0.16)")}
            >
              Retry personalized
            </button>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: phase === "done" ? e.inkSoft : e.success, animation: phase !== "done" ? "recordPulse 1.5s ease-in-out infinite" : "none" }} />
            <span style={{ fontFamily: ef.mono, fontSize: 12, fontWeight: 500, color: e.coal }}>{formatTime(elapsed)}</span>
          </div>
        </div>
      </div>
      {phase !== "done" && (
        <div style={{ padding: "0 24px 10px" }}>
          <div style={{ marginBottom: 4 }}>
            {/* The numeric "X%" indicator that lived here was redundant with
                the visible pip fill below — pure visual noise. The pips ARE
                the percentage; reading both takes longer than reading either. */}
            <span style={{ fontFamily: ef.sans, fontSize: isSalaryNegotiation ? 13 : 12, fontWeight: 600, color: isCurrentFollowUp ? e.copper : e.coal }}>
              {isSalaryNegotiation
                ? `${getNegPhaseLabel(currentQuestionNum)} · Round ${Math.min(currentQuestionNum, baseQuestionCount || totalQuestions)} of ${baseQuestionCount || totalQuestions}`
                : isCurrentFollowUp
                ? `Follow-up · Question ${Math.min(currentQuestionNum, baseQuestionCount || totalQuestions)} of ${baseQuestionCount || totalQuestions}`
                : `Question ${currentQuestionNum} of ${baseQuestionCount || totalQuestions}`}
            </span>
          </div>
          <div style={{ display: "flex", gap: 3, height: 3 }}>
            {Array.from({ length: baseQuestionCount || totalQuestions }).map((_, i) => (
              <div key={i} style={{
                flex: 1, borderRadius: 2, height: 3,
                background: i < Math.min(currentQuestionNum, baseQuestionCount || totalQuestions)
                  ? e.copper
                  : i === Math.min(currentQuestionNum, baseQuestionCount || totalQuestions)
                    ? "rgba(180,83,9,0.40)"
                    : "rgba(20,17,10,0.05)",
                /* Animate just `background` — the only thing that actually changes
                   between fill states. `transition: all` would force the browser to
                   interpolate every property on every render, including layout-
                   triggering ones like `flex`. */
                transition: "background 0.4s ease",
              }} />
            ))}
          </div>
        </div>
      )}
      {phase === 'done' && (
        <div style={{ padding: '0 24px 10px', display: 'flex', justifyContent: 'flex-end' }}>
          <a
            href={typeof sessionId !== 'undefined' && sessionId ? `/session/${sessionId}` : '/dashboard'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 18px',
              background: e.indigo,
              color: e.white,
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            View your report →
          </a>
        </div>
      )}
    </header>
  );
});

/* ─── AI Avatar + Question Card ─── */

export const AvatarStage = memo(function AvatarStage({ phase, interviewerName, isMuted, speechUnavailable, skipSpeaking }: {
  phase: string; interviewerName: string; isMuted: boolean; speechUnavailable: boolean;
  skipSpeaking: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "20px 0" }}>
      <div style={{
        width: 160, height: 160, borderRadius: "50%",
        background: phase === "speaking"
          ? "radial-gradient(closest-side, rgba(255,255,255,0.85), rgba(244,239,227,0.4) 70%, transparent 100%)"
          : phase === "listening"
          ? "radial-gradient(closest-side, rgba(229,226,242,0.6), rgba(255,255,255,0.3) 70%, transparent 100%)"
          : "radial-gradient(closest-side, rgba(255,255,255,0.7), rgba(244,239,227,0.3) 70%, transparent 100%)",
        border: `1px solid ${phase === "speaking" ? "rgba(180,83,9,0.20)" : phase === "listening" ? e.indigoRing : e.line}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        /* Avatar halo cross-fades between phases — animate the visual properties
           that actually change (background, border, shadow) and let layout
           settle without `all`-induced re-interpolation. */
        transition: "background 0.4s ease, border-color 0.4s ease, box-shadow 0.4s ease",
        boxShadow: phase === "speaking"
          ? "0 0 32px -8px rgba(180,83,9,0.18)"
          : phase === "listening"
          ? "0 0 32px -8px rgba(49,46,129,0.18)"
          : "none",
      }}>
        <DotGridVisualizer active={phase === "speaking"} thinking={phase === "thinking"} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
        <span style={{ fontFamily: ef.serif, fontSize: 18, fontWeight: 500, color: e.coal, letterSpacing: "-0.01em" }}>{interviewerName}</span>
        <span aria-live="polite" aria-atomic="true" role="status" style={{
          fontFamily: ef.sans, fontSize: 12, fontWeight: 500,
          color: phase === "speaking" ? e.copper : phase === "listening" ? e.indigo : e.inkSoft,
        }}>
          {/* Active-voice labels with the interviewer's first name —
              "Priya is preparing…" reads as a person doing work, not
              a system label. Falls back to "AI" if the name isn't
              available (defensive — getInterviewerName always returns
              a name in practice). The "Your turn" branch is the only
              one addressed to the user, so it stays as-is. */}
          {(() => {
            const firstName = interviewerName?.split(" ")[0] || "AI";
            if (phase === "thinking") return `${firstName} is preparing…`;
            if (phase === "speaking") return `${firstName} is speaking…`;
            if (phase === "listening") return "Your turn — speak now";
            return "Complete";
          })()}
        </span>
      </div>
      {phase === "listening" && !isMuted && !speechUnavailable && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6, padding: "4px 12px",
          borderRadius: 100, background: "rgba(21,128,61,0.13)", border: "1px solid rgba(21,128,61,0.18)",
          animation: "fadeUp 0.3s ease",
        }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: e.success, animation: "recordPulse 1s ease-in-out infinite" }} />
          <span role="status" aria-live="polite" style={{ fontFamily: ef.sans, fontSize: 10, fontWeight: 600, color: e.success, letterSpacing: "0.05em", textTransform: "uppercase" }}>Listening</span>
        </div>
      )}
      {phase === "speaking" && (
        <button onClick={skipSpeaking} style={{
          fontFamily: ef.sans, fontSize: 12, fontWeight: 500, color: e.coal,
          background: "rgba(20,17,10,0.04)", border: `1px solid ${e.line}`,
          // min-height enforces WCAG 2.5.5 Level AAA (44px) on touch; was 28px
          // before, too small for reliable tap on mobile.
          borderRadius: 8, padding: "10px 18px", cursor: "pointer", minHeight: 44,
          display: "inline-flex", alignItems: "center", gap: 6,
          transition: "background 0.2s ease, border-color 0.2s ease, color 0.2s ease, opacity 0.2s ease", marginTop: 4,
        }}
        onMouseEnter={e => { e.currentTarget.style.background = "rgba(20,17,10,0.06)"; e.currentTarget.style.borderColor = "rgba(20,17,10,0.10)"; }}
        onMouseLeave={ev => { ev.currentTarget.style.background = "rgba(20,17,10,0.04)"; ev.currentTarget.style.borderColor = e.line; }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
          Continue · Enter
        </button>
      )}
    </div>
  );
});

/* ─── Panel Interview: 3 Avatars ─── */

export const PanelAvatarStage = memo(function PanelAvatarStage({ phase, panelMembers, activePersona, isMuted, speechUnavailable, skipSpeaking }: {
  phase: string;
  panelMembers: PanelMember[];
  activePersona: string; // title of the currently speaking panelist
  isMuted: boolean;
  speechUnavailable: boolean;
  skipSpeaking: () => void;
}) {
  const activeIdx = panelMembers.findIndex(m => m.title === activePersona);
  const activeMember = activeIdx >= 0 ? panelMembers[activeIdx] : panelMembers[0];

  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 600px)").matches);
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 600px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "20px 0" }}>
      {/* Three avatars in a row */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: isMobile ? 8 : 12 }}>
        {panelMembers.map((member) => {
          const isActive = member.title === activeMember.title;
          const isActiveSpeaking = isActive && phase === "speaking";
          const size = isActive ? (isMobile ? 72 : 100) : (isMobile ? 44 : 64);

          return (
            <div key={member.title} role="img" aria-label={`${member.name}, ${member.title}${isActive ? (phase === "speaking" ? ", currently speaking" : phase === "thinking" ? ", preparing question" : "") : ""}`} style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
              transition: "opacity 0.4s ease, transform 0.4s ease",
              opacity: isActive ? 1 : 0.5,
              transform: isActive ? "translateY(-4px)" : "translateY(0)",
            }}>
              <div style={{
                width: size, height: size, borderRadius: "50%",
                background: isActiveSpeaking
                  ? `radial-gradient(closest-side, rgba(255,255,255,0.85), ${member.color}1A 70%, transparent 100%)`
                  : isActive
                  ? "radial-gradient(closest-side, rgba(255,255,255,0.7), rgba(244,239,227,0.3) 70%, transparent 100%)"
                  : e.white,
                border: `1px solid ${isActive ? `${member.color}40` : e.line}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background 0.4s ease, border-color 0.4s ease, box-shadow 0.4s ease",
                boxShadow: isActiveSpeaking
                  ? `0 0 32px -8px ${member.color}33`
                  : isActive
                  ? "0 1px 0 rgba(20,17,10,.04), 0 1px 2px rgba(20,17,10,.04)"
                  : "none",
                position: "relative",
              }}>
                {isActive ? (
                  <DotGridVisualizer active={phase === "speaking"} thinking={phase === "thinking"} />
                ) : (
                  /* Initials for inactive panelists */
                  <span style={{
                    fontFamily: ef.serif, fontSize: size * 0.28, fontWeight: 600,
                    color: `${member.color}80`,
                    letterSpacing: "0.02em",
                  }}>
                    {member.name.split(" ").map(n => n[0]).join("")}
                  </span>
                )}
                {/* "Speaking" badge on active avatar */}
                {isActiveSpeaking && (
                  <div style={{
                    position: "absolute", bottom: -2, left: "50%", transform: "translateX(-50%)",
                    padding: "1px 8px", borderRadius: 10,
                    background: member.color, fontSize: 8, fontFamily: ef.sans,
                    fontWeight: 700, color: e.white, letterSpacing: "0.04em",
                    textTransform: "uppercase", whiteSpace: "nowrap",
                  }}>
                    Speaking
                  </div>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                <span style={{
                  fontFamily: isActive ? ef.serif : ef.sans,
                  fontSize: isActive ? (isMobile ? 13 : 15) : (isMobile ? 10 : 11),
                  fontWeight: isActive ? 500 : 500,
                  letterSpacing: isActive ? "-0.01em" : 0,
                  color: isActive ? e.coal : e.inkSoft,
                  transition: "color 0.3s ease, font-size 0.3s ease",
                  whiteSpace: "nowrap",
                }}>
                  {member.name}
                </span>
                <span style={{
                  fontFamily: ef.sans, fontSize: isActive ? (isMobile ? 9 : 10) : (isMobile ? 8 : 9), fontWeight: 500,
                  color: member.color, opacity: isActive ? 0.8 : 0.5,
                  whiteSpace: "nowrap",
                }}>
                  {member.title}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Status line for active panelist */}
      <span aria-live="polite" aria-atomic="true" role="status" style={{
        fontFamily: ef.sans, fontSize: 11, fontWeight: 500,
        color: phase === "speaking" ? activeMember.color : phase === "listening" ? e.success : e.inkSoft,
        marginTop: 4,
      }}>
        {phase === "thinking" ? `${activeMember.name} is preparing...`
          : phase === "speaking" ? `${activeMember.name} is speaking...`
          : phase === "listening" ? "Listening"
          : "Complete"}
      </span>

      {/* Recording indicator */}
      {phase === "listening" && !isMuted && !speechUnavailable && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6, padding: "4px 12px",
          borderRadius: 100, background: "rgba(21,128,61,0.13)", border: "1px solid rgba(21,128,61,0.18)",
          animation: "fadeUp 0.3s ease",
        }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: e.success, animation: "recordPulse 1s ease-in-out infinite" }} />
          <span role="status" aria-live="polite" style={{ fontFamily: ef.sans, fontSize: 10, fontWeight: 600, color: e.success, letterSpacing: "0.05em", textTransform: "uppercase" }}>Listening</span>
        </div>
      )}

      {/* Skip button */}
      {phase === "speaking" && (
        <button onClick={skipSpeaking} style={{
          fontFamily: ef.sans, fontSize: 12, fontWeight: 500, color: e.coal,
          background: "rgba(20,17,10,0.04)", border: `1px solid ${e.line}`,
          // min-height enforces WCAG 2.5.5 Level AAA (44px) on touch; was 28px
          // before, too small for reliable tap on mobile.
          borderRadius: 8, padding: "10px 18px", cursor: "pointer", minHeight: 44,
          display: "inline-flex", alignItems: "center", gap: 6,
          transition: "background 0.2s ease, border-color 0.2s ease, color 0.2s ease, opacity 0.2s ease", marginTop: 4,
        }}
        onMouseEnter={e => { e.currentTarget.style.background = "rgba(20,17,10,0.06)"; e.currentTarget.style.borderColor = "rgba(20,17,10,0.10)"; }}
        onMouseLeave={ev => { ev.currentTarget.style.background = "rgba(20,17,10,0.04)"; ev.currentTarget.style.borderColor = e.line; }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
          Continue · Enter
        </button>
      )}
    </div>
  );
});

/* ─── Question Card with timer ─── */

export const QuestionCard = memo(function QuestionCard({ step, phase, showCaptions, timeRemaining, timePercent, panelPersona, actualDuration, speechEnded, isSalaryNegotiation }: {
  step: { aiText: string; aiTextDisplay?: string; scoreNote?: string; speakingDuration: number } | undefined;
  phase: string; showCaptions: boolean;
  timeRemaining: number; timePercent: number;
  panelPersona?: { name: string; title: string; color: string } | null;
  /** Real TTS audio duration in ms — drives typewriter sync. */
  actualDuration?: number;
  /** True when TTS playback finishes — flushes typewriter to full text. */
  speechEnded?: boolean;
  isSalaryNegotiation?: boolean;
}) {
  return (
    /* aria-live="polite" + aria-atomic="true" means each phase change
       (thinking → speaking → listening) re-announces the full card. The
       child LiveCaptions is aria-hidden so the typing animation doesn't
       race the announce. aria-relevant="text" so DOM additions inside
       (timer pip etc.) don't trigger a re-announce — only text content
       changes do. */
    <div aria-live="polite" aria-atomic="true" aria-relevant="text" style={{
      width: "100%", background: e.white, borderRadius: 16,
      border: `1px solid ${phase === "speaking" && panelPersona ? `${panelPersona.color}25` : phase === "speaking" ? "rgba(180,83,9,0.22)" : e.line}`,
      /* The card cross-fades its border tint between phases (cream → copper
         when AI speaks, copper → cream when listening). Animate only the
         specific properties that change — `transition: all` would trigger
         repaints on every styled child too. */
      padding: "22px 26px", transition: "border-color 0.4s ease, opacity 0.4s ease",
      boxShadow: "0 1px 0 rgba(20,17,10,.03), 0 1px 2px rgba(20,17,10,.04), 0 12px 32px -16px rgba(20,17,10,.10)",
    }}>
      {panelPersona && (phase === "speaking" || phase === "listening") && (
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "3px 10px", borderRadius: 100, marginBottom: 10,
          background: `${panelPersona.color}10`, border: `1px solid ${panelPersona.color}20`,
        }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: panelPersona.color }} />
          <span style={{ fontFamily: ef.sans, fontSize: 10, fontWeight: 600, color: panelPersona.color }}>
            {panelPersona.name} · {panelPersona.title}
          </span>
        </div>
      )}
      {/* scoreNote is internal evaluator metadata — "Tests X competency" /
          "Dynamic follow-up based on candidate's answer". It's used by
          the evaluator and the post-session report; it must not surface
          during the live interview because it telegraphs what's being
          assessed and exposes plumbing. Kept on the step object for
          downstream use; just not rendered here. */}
      {/* Question text rendering:
            speaking → typewriter typed in sync with TTS audio
            thinking → "Preparing next question…"
            listening → static text (typewriter completed)
          The flicker that previously appeared between currentStep increment
          and phase=speaking is fixed at the engine level — handleNextQuestion
          batches setPhase("thinking") with setCurrentStep so the new step
          never renders against the old listening phase. */}
      {phase === "speaking" ? (
        <LiveCaptions text={step?.aiText || ""} isTyping={true} speakingDuration={step?.speakingDuration} actualDuration={actualDuration} speechEnded={speechEnded} />
      ) : phase === "thinking" ? (
        <p style={{ fontFamily: ef.sans, fontSize: 13, color: e.inkSoft, lineHeight: 1.6, margin: 0, fontStyle: "italic" }}>Preparing next question…</p>
      ) : step?.aiText ? (
        <p style={{
          fontFamily: ef.serif, fontSize: 22, color: e.coal,
          lineHeight: 1.35, margin: 0, letterSpacing: "-0.01em", textWrap: "balance",
          opacity: phase === "listening" && !showCaptions ? 0.62 : 1,
          transition: "opacity 0.3s ease",
        }}>{stripProsodyMarkup(step.aiTextDisplay ?? step.aiText)}</p>
      ) : null}
      {phase !== "done" && !(isSalaryNegotiation && timeRemaining > 30) && (
        <div role="timer" aria-label={`${formatTime(timeRemaining)} remaining for this question`} style={{ marginTop: 16, opacity: isSalaryNegotiation ? 0.7 : 1, transition: "opacity 0.3s ease" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontFamily: ef.sans, fontSize: 11, color: timeRemaining <= 15 ? e.error : timeRemaining <= 30 ? e.copper : e.inkSoft }}>
              {isSalaryNegotiation
                ? timeRemaining <= 15 ? "Wrapping up..." : "Take your time"
                : timeRemaining <= 15 ? "Wrapping up..." : timeRemaining <= 30 ? "30s remaining" : "Time remaining"}
            </span>
            <span style={{
              fontFamily: ef.mono, fontSize: 11, fontWeight: 600,
              color: timeRemaining <= 15 ? e.error : timeRemaining <= 30 ? e.copper : e.coal,
            }}>{formatTime(timeRemaining)}</span>
          </div>
          {/* transform:scaleX instead of width so the browser composites on the
              GPU rather than triggering a full layout reflow every tick.
              origin:left means the bar shrinks from the right edge. */}
          <div style={{ width: "100%", height: 3, borderRadius: 2, background: "rgba(20,17,10,0.04)", overflow: "hidden" }}>
            <div style={{
              height: "100%", width: "100%", borderRadius: 2,
              background: timePercent >= 87.5 ? e.error : timePercent >= 75 ? e.copper : e.success,
              transform: `scaleX(${(100 - timePercent) / 100})`,
              transformOrigin: "left center",
              transition: "transform 1s linear, background 0.5s ease",
            }} />
          </div>
        </div>
      )}
    </div>
  );
});

/* ─── User Answer Area (speech or text input) ─── */

export const UserAnswerArea = memo(function UserAnswerArea({ currentTranscript, setCurrentTranscript, speechUnavailable, setSpeechUnavailable, isMuted, micStreamRef, noSpeechCountRef, setMicError, handleNextQuestion, textareaRef, nextBtnRef, currentStep, interviewScriptLength, liveMetrics }: {
  currentTranscript: string; setCurrentTranscript: (v: string) => void;
  speechUnavailable: boolean; setSpeechUnavailable: (v: boolean) => void;
  isMuted: boolean; micStreamRef: React.MutableRefObject<MediaStream | null>;
  noSpeechCountRef: React.MutableRefObject<number>;
  setMicError: (v: string) => void;
  handleNextQuestion: () => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  nextBtnRef: React.RefObject<HTMLButtonElement | null>;
  currentStep: number; interviewScriptLength: number;
  liveMetrics: { wordCount: number; wpm: number; fillerCount: number; lengthGuidance: string | null; ownership?: "i-led" | "balanced" | "we-heavy" | null; specificityHits?: number; specificityHint?: string | null } | null;
}) {
  const [isEditingTranscript, setIsEditingTranscript] = useState(false);
  const hintDismissed = useRef(false);
  const [showHint, setShowHint] = useState(false);

  /* ── Per-answer elapsed counter ────────────────────────────────────
     UserAnswerArea is mounted only while phase === "listening", so a
     local timer measures exactly "how long has the user been answering
     this question". Used by the PaceMeter to surface the sweet-spot
     guidance without coupling to engine-internal answerTimer state. */
  const [answerSeconds, setAnswerSeconds] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => setAnswerSeconds(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  // Show hint once when transcript exceeds 20 chars in speech mode
  useEffect(() => {
    if (!hintDismissed.current && !speechUnavailable && currentTranscript.length > 20) {
      setShowHint(true);
    }
  }, [currentTranscript, speechUnavailable]);

  return (
    <div style={{
      width: "100%", borderRadius: 16,
      background: "rgba(21,128,61,0.07)",
      border: "1px solid rgba(21,128,61,0.14)",
      padding: "18px 24px", animation: "fadeUp 0.3s ease",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: isMuted ? e.error : e.success, animation: isMuted ? "none" : "recordPulse 1s ease-in-out infinite" }} />
          <span style={{ fontFamily: ef.sans, fontSize: 12, fontWeight: 600, color: e.success }}>
            {speechUnavailable ? "Type your answer" : isMuted ? "Muted" : "Your answer"}
          </span>
        </div>
        <WaveformVisualizer active={!isMuted && !speechUnavailable} color={e.success} barCount={14} stream={micStreamRef.current} />
      </div>
      {showHint && !hintDismissed.current && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "5px 10px", marginBottom: 8, borderRadius: 8,
          background: "rgba(21,128,61,0.10)", border: "1px solid rgba(21,128,61,0.13)",
        }}>
          <span style={{ fontFamily: ef.sans, fontSize: 11, color: e.inkSoft, fontStyle: "italic" }}>
            Tip: If speech recognition misses a word, tap &lsquo;Edit&rsquo; to correct it before moving on.
          </span>
          <button
            onClick={() => { hintDismissed.current = true; setShowHint(false); }}
            aria-label="Dismiss tip"
            style={{
              fontFamily: ef.sans, fontSize: 12, color: e.inkSoft, background: "transparent",
              border: "none", cursor: "pointer", padding: "0 4px", lineHeight: 1,
            }}
          >&times;</button>
        </div>
      )}
      {/* role="log" already implies aria-live="polite" — explicitly
          setting both was causing double-announcement on some screen
          readers. aria-relevant="additions" so SR only reads NEW text
          (the user's incremental words), not full text replacements. */}
      <div role="log" aria-relevant="additions" aria-label="Your speech transcript" style={{ minHeight: 60, marginBottom: 10 }}>
        {speechUnavailable ? (
          <>
            <textarea
              ref={textareaRef}
              value={currentTranscript}
              onChange={(e) => setCurrentTranscript(e.target.value)}
              placeholder="Type your answer here..."
              maxLength={3000}
              // eslint-disable-next-line jsx-a11y/no-autofocus -- user-initiated: text input mode activated by user
              autoFocus
              style={{
                width: "100%", minHeight: 70, fontFamily: ef.sans, fontSize: 13, color: e.coal,
                lineHeight: 1.7, background: "transparent", border: "none", outline: "none",
                resize: "none", padding: 0, margin: 0,
              }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleNextQuestion(); } }}
            />
            <button onClick={() => { setSpeechUnavailable(false); setMicError(""); noSpeechCountRef.current = 0; }}
              aria-label="Switch to speaking"
              style={{
                fontFamily: ef.sans, fontSize: 11, fontWeight: 500, color: e.success,
                background: "rgba(21,128,61,0.10)", border: "1px solid rgba(21,128,61,0.18)",
                borderRadius: 10, padding: "4px 12px", cursor: "pointer", marginTop: 4,
                display: "inline-flex", alignItems: "center", gap: 5, transition: "background 0.2s ease, border-color 0.2s ease, color 0.2s ease, opacity 0.2s ease",
              }}>
              <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>
              Switch to speaking
            </button>
          </>
        ) : (
          <>
            {currentTranscript ? (
              isEditingTranscript ? (
                <>
                  <textarea
                    value={currentTranscript}
                    onChange={(e) => setCurrentTranscript(e.target.value)}
                    // eslint-disable-next-line jsx-a11y/no-autofocus -- user-initiated: edit mode activated by user
                    autoFocus
                    style={{
                      width: "100%", minHeight: 70, fontFamily: ef.sans, fontSize: 13, color: e.coal,
                      lineHeight: 1.7, background: "transparent", border: "none", outline: "none",
                      resize: "none", padding: 0, margin: 0,
                    }}
                  />
                  <button
                    onClick={() => setIsEditingTranscript(false)}
                    style={{
                      fontFamily: ef.sans, fontSize: 11, fontWeight: 500, color: e.success,
                      background: "rgba(21,128,61,0.10)", border: "1px solid rgba(21,128,61,0.18)",
                      borderRadius: 10, padding: "4px 12px", cursor: "pointer", marginTop: 4,
                      display: "inline-flex", alignItems: "center", gap: 5, transition: "background 0.2s ease, border-color 0.2s ease, color 0.2s ease, opacity 0.2s ease",
                    }}>
                    Done editing
                  </button>
                </>
              ) : (
                <p style={{ fontFamily: ef.sans, fontSize: 13, color: e.coal, lineHeight: 1.7, margin: 0, opacity: 0.9 }}>
                  {currentTranscript}
                  <span style={{ display: "inline-block", width: 2, height: 14, background: e.success, marginLeft: 2, verticalAlign: "text-bottom", animation: "blink 0.8s ease-in-out infinite" }} />
                </p>
              )
            ) : (
              <p style={{ fontFamily: ef.sans, fontSize: 13, color: e.inkSoft, lineHeight: 1.7, margin: 0, fontStyle: "italic" }}>
                Start speaking — your answer will appear here...
              </p>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
              <button onClick={() => { setSpeechUnavailable(true); setMicError(""); }}
                aria-label="Type instead"
                style={{
                  fontFamily: ef.sans, fontSize: 11, fontWeight: 500, color: e.inkSoft,
                  background: "transparent", border: "none", padding: "4px 0", cursor: "pointer",
                  display: "inline-flex", alignItems: "center", gap: 5, transition: "color 0.2s",
                }}
                onMouseEnter={(ev) => { ev.currentTarget.style.color = e.coal; }}
                onMouseLeave={(ev) => { ev.currentTarget.style.color = e.inkSoft; }}>
                <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01"/><path d="M10 8h.01"/><path d="M14 8h.01"/><path d="M18 8h.01"/><path d="M6 12h.01"/><path d="M18 12h.01"/><path d="M8 16h8"/></svg>
                Prefer typing? Switch to text
              </button>
              {currentTranscript && !isEditingTranscript && (
                <button
                  onClick={() => setIsEditingTranscript(true)}
                  aria-label="Edit transcript"
                  style={{
                    fontFamily: ef.sans, fontSize: 11, fontWeight: 500, color: e.inkSoft,
                    background: "transparent", border: "none", padding: "4px 0", cursor: "pointer",
                    display: "inline-flex", alignItems: "center", gap: 5, transition: "color 0.2s",
                  }}
                  onMouseEnter={(ev) => { ev.currentTarget.style.color = e.coal; }}
                  onMouseLeave={(ev) => { ev.currentTarget.style.color = e.inkSoft; }}>
                  <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Edit
                </button>
              )}
            </div>
          </>
        )}
      </div>
      {liveMetrics && (
        <div style={{
          display: "flex", alignItems: "center", gap: 16, padding: "8px 12px",
          borderRadius: 8, background: "rgba(20,17,10,0.07)",
          border: "1px solid rgba(20,17,10,0.04)", marginTop: 8,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontFamily: ef.mono, fontSize: 11, fontWeight: 600, color: liveMetrics.wpm > 180 ? e.error : liveMetrics.wpm < 100 ? e.copper : e.success }}>
              {liveMetrics.wpm}
            </span>
            <span style={{ fontFamily: ef.sans, fontSize: 10, color: e.inkSoft }}>WPM</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontFamily: ef.mono, fontSize: 11, fontWeight: 600, color: liveMetrics.fillerCount > 5 ? e.error : liveMetrics.fillerCount > 2 ? e.copper : e.success }}>
              {liveMetrics.fillerCount}
            </span>
            <span style={{ fontFamily: ef.sans, fontSize: 10, color: e.inkSoft }}>fillers</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontFamily: ef.mono, fontSize: 11, fontWeight: 600, color: e.coal }}>
              {liveMetrics.wordCount}
            </span>
            <span style={{ fontFamily: ef.sans, fontSize: 10, color: e.inkSoft }}>words</span>
          </div>
          {liveMetrics.ownership && (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{
                fontFamily: ef.mono, fontSize: 11, fontWeight: 600,
                color: liveMetrics.ownership === "we-heavy" ? e.error : liveMetrics.ownership === "i-led" ? e.success : e.copper,
              }}>
                {liveMetrics.ownership === "we-heavy" ? "we" : liveMetrics.ownership === "i-led" ? "I" : "I/we"}
              </span>
              <span style={{ fontFamily: ef.sans, fontSize: 10, color: e.inkSoft }}>voice</span>
            </div>
          )}
          {typeof liveMetrics.specificityHits === "number" && (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{
                fontFamily: ef.mono, fontSize: 11, fontWeight: 600,
                color: liveMetrics.specificityHits > 0 ? e.success : (liveMetrics.wordCount >= 40 ? e.error : e.inkSoft),
              }}>
                {liveMetrics.specificityHits}
              </span>
              <span style={{ fontFamily: ef.sans, fontSize: 10, color: e.inkSoft }}>metrics</span>
            </div>
          )}
          {liveMetrics.specificityHint && (
            <>
              <div style={{ width: 1, height: 12, background: "rgba(20,17,10,0.05)" }} />
              <span style={{ fontFamily: ef.sans, fontSize: 10, color: e.error, fontStyle: "italic" }}>
                {liveMetrics.specificityHint}
              </span>
            </>
          )}
          {/* lengthGuidance was previously rendered here. Removed because
              the PaceMeter below conveys the same information ("Wrap it
              up" / "Take your time…") with a visual sweet-spot bar — the
              text-only chip duplicated what the bar shows. */}
        </div>
      )}
      {/* Pace meter — supersedes the old lengthGuidance text chip. Sweet
          spot 60-90s for most behavioral questions; the ceiling at 150s
          nudges users to wrap up before the existing timeRemaining hits
          zero. The bar + zone label combine "how long" with "is that
          ok?" in one glance. */}
      <div style={{ marginTop: 10 }}>
        <PaceMeter seconds={answerSeconds} />
      </div>
      <button
        ref={nextBtnRef}
        onClick={handleNextQuestion}
        style={{
          fontFamily: ef.sans, fontSize: 13, fontWeight: 600, width: "100%",
          padding: "12px 24px", borderRadius: 10, marginTop: 8,
          background: `linear-gradient(135deg, ${e.copper}, ${"#92400E"})`,
          border: "none", color: e.cream, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
          transition: "all 0.2s ease",
          boxShadow: "0 4px 16px rgba(180,83,9,0.24)",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(180,83,9,0.30)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(180,83,9,0.24)"; }}
      >
        {currentStep < interviewScriptLength - 1 ? "Next Question" : "Finish"}
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    </div>
  );
});


/* ─── Completion Card (done state) ─── */

export const CompletionCard = memo(function CompletionCard({ currentQuestionNum, elapsed, usedFallbackScore, evalTimedOut, evaluating, handleEnd, videoURL, isSalaryNegotiation }: {
  currentQuestionNum: number; elapsed: number;
  usedFallbackScore: boolean; evalTimedOut: boolean;
  evaluating: boolean; handleEnd: () => void;
  videoURL?: string | null;
  isSalaryNegotiation?: boolean;
}) {
  return (
    <div style={{
      // Cream editorial card — replaces the auto-translated green tint.
      // Soft success ring on the icon disc carries the "complete" signal
      // without flooding the whole card with green.
      width: "100%", borderRadius: 20,
      background: e.cream,
      border: `1px solid ${e.line}`,
      padding: "28px", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 14,
      boxShadow: "0 1px 0 rgba(20,17,10,.03), 0 1px 2px rgba(20,17,10,.04), 0 12px 32px -16px rgba(20,17,10,.10)",
      animation: "slideUp 0.5s ease",
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 999,
        background: e.success100, border: `1px solid rgba(21,128,61,0.22)`,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        marginBottom: 4,
      }}>
        <svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={e.success} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      </div>
      <h2 style={{
        margin: 0, fontFamily: ef.serif, fontSize: 28, fontWeight: 400,
        lineHeight: 1.2, color: e.coal, letterSpacing: "-0.015em",
      }}>
        Session <em style={{ color: e.copper, fontStyle: "italic" }}>complete</em>.
      </h2>
      <p style={{
        fontFamily: ef.sans, fontSize: 13, color: e.inkSoft, margin: 0,
      }}>
        <strong style={{ color: e.coal, fontWeight: 600 }}>{currentQuestionNum}</strong> {isSalaryNegotiation ? "negotiation rounds" : "questions answered"} · {formatTime(elapsed)}
      </p>
      {(usedFallbackScore || evalTimedOut) && (
        <p style={{
          fontFamily: ef.sans, fontSize: 12, color: e.copper, margin: 0,
          padding: "6px 12px", borderRadius: 999,
          background: e.copperSoft, border: `1px solid rgba(180,83,9,0.20)`,
        }}>
          {evalTimedOut ? "AI evaluation timed out" : "AI evaluation unavailable"} — score is estimated from session metrics
        </p>
      )}
      {videoURL && (
        <div style={{ width: "100%", marginTop: 8 }}>
          <p style={{ fontFamily: ef.mono, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.4, color: e.inkSoft, marginBottom: 6 }}>Your recording</p>
          <video
            src={videoURL}
            controls
            playsInline
            style={{ width: "100%", borderRadius: 10, border: `1px solid ${e.line}`, boxShadow: "0 1px 2px rgba(20,17,10,.04)" }}
          >
            <track kind="captions" />
          </video>
        </div>
      )}
      <button
        onClick={handleEnd}
        disabled={evaluating}
        aria-label={evaluating ? "Loading your feedback" : "View your interview feedback"}
        style={{
          // Use editorial indigo CTA so it reads unambiguously as the
          // primary action — copper would clash with the editorial
          // "copper-is-accent-not-CTA" rule.
          fontFamily: ef.sans, fontSize: 14, fontWeight: 500, width: "100%",
          padding: "13px 24px", borderRadius: 999, marginTop: 12,
          background: evaluating ? e.lineStrong : e.indigo,
          border: "none", color: e.cream,
          cursor: evaluating ? "wait" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          transition: "transform 180ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 180ms cubic-bezier(0.16, 1, 0.3, 1), background 180ms ease",
          // Strong shadow so the button reads as elevated and clickable —
          // QA bug 33 reported it looked flat / non-interactive.
          boxShadow: evaluating
            ? "none"
            : "0 1px 2px rgba(20,17,10,.18), 0 8px 20px -4px rgba(49,46,129,.42)",
        }}
        onMouseEnter={(ev) => {
          if (evaluating) return;
          ev.currentTarget.style.transform = "translateY(-1px)";
          ev.currentTarget.style.boxShadow = "0 1px 2px rgba(20,17,10,.20), 0 12px 28px -4px rgba(49,46,129,.55)";
        }}
        onMouseLeave={(ev) => {
          if (evaluating) return;
          ev.currentTarget.style.transform = "translateY(0)";
          ev.currentTarget.style.boxShadow = "0 1px 2px rgba(20,17,10,.18), 0 8px 20px -4px rgba(49,46,129,.42)";
        }}
        onMouseDown={(ev) => {
          if (evaluating) return;
          ev.currentTarget.style.transform = "translateY(0)";
          ev.currentTarget.style.boxShadow = "0 1px 2px rgba(20,17,10,.20) inset";
        }}
        onFocus={(ev) => {
          ev.currentTarget.style.boxShadow = `0 0 0 4px ${e.indigoRing}, 0 8px 20px -4px rgba(49,46,129,.42)`;
        }}
        onBlur={(ev) => {
          if (evaluating) { ev.currentTarget.style.boxShadow = "none"; return; }
          ev.currentTarget.style.boxShadow = "0 1px 2px rgba(20,17,10,.18), 0 8px 20px -4px rgba(49,46,129,.42)";
        }}
      >
        {evaluating ? (
          <>
            <span style={{ width: 14, height: 14, border: `2px solid rgba(250,247,240,0.30)`, borderTopColor: e.cream, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            Generating your report…
          </>
        ) : (
          <>
            View feedback
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "transform 180ms cubic-bezier(0.16, 1, 0.3, 1)" }}>
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </>
        )}
      </button>
    </div>
  );
});

/* ─── Micro-feedback on last answer ─── */

/* MicroFeedbackPanel — editorial recap of the last user answer + a
   tiny strength/improvement chip. Cream card, mono caps label, no
   green tints (those felt "alert-y" against the editorial palette). */
export const MicroFeedbackPanel = memo(function MicroFeedbackPanel({ transcript, microFeedback }: {
  transcript: { speaker: string; text: string }[];
  microFeedback: string | null;
}) {
  const lastUserMsg = [...transcript].reverse().find(t => t.speaker === "user");
  if (!lastUserMsg) return null;
  // Render SKIPPED sentinels as a friendly chip instead of leaking the
  // raw "[SKIPPED — reason: too_hard]" engineering token to the user.
  // The reason maps to a short human label.
  const skipMatch = lastUserMsg.text.trim().match(/^\[SKIPPED\s*[—–-]\s*reason:\s*([^\]]*)\]\s*$/i);
  const skipReasonLabel: string | null = skipMatch ? (() => {
    const raw = skipMatch[1].trim().toLowerCase();
    if (raw === "too_hard") return "Skipped — too hard";
    if (raw === "blank_mind" || raw === "blank") return "Skipped — drew a blank";
    if (raw === "off_topic" || raw === "off-topic") return "Skipped — off-topic";
    if (raw === "no_experience") return "Skipped — no experience";
    if (raw === "no_reason" || raw === "") return "Skipped";
    return `Skipped — ${raw.replace(/_/g, " ")}`;
  })() : null;
  // Dedupe immediate STT echo: collapse repeated word and short-phrase
  // stutters ("where where", "to it is very difficult to it is very
  // difficult to") that come from speech-recognition partials being
  // re-committed. Scoring/eval keeps the raw transcript; this is a
  // display-only clean-up so the candidate isn't stared at by their
  // own dictation noise. Case-insensitive single-word collapse + a
  // 2–4 word phrase pass.
  const displayText = (() => {
    let t = lastUserMsg.text;
    // word-level: "the the" → "the"
    t = t.replace(/\b(\w+)(\s+\1\b)+/gi, "$1");
    // 2–4 word phrase: "to it is very difficult to it is very difficult to"
    t = t.replace(/\b((?:\w+\s+){1,3}\w+)\s+\1\b/gi, "$1");
    return t.replace(/\s{2,}/g, " ");
  })();
  const isStrong = microFeedback?.includes("Strong") ?? false;
  return (
    <div style={{
      width: "100%", borderRadius: 14, padding: "12px 16px",
      background: e.white, border: `1px solid ${e.line}`,
      boxShadow: "0 1px 0 rgba(20,17,10,.03), 0 1px 2px rgba(20,17,10,.04)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{
          fontFamily: ef.mono, fontSize: 10, textTransform: "uppercase",
          letterSpacing: 1.4, color: e.copper,
        }}>
          Your last answer
        </span>
      </div>
      {skipReasonLabel ? (
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "4px 10px", borderRadius: 999,
          background: "rgba(180,83,9,0.10)",
          border: `1px solid rgba(180,83,9,0.20)`,
          fontFamily: ef.sans, fontSize: 11, fontWeight: 500, color: e.copper,
        }}>
          <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={e.copper} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 4 15 12 5 20 5 4" />
            <line x1="19" y1="5" x2="19" y2="19" />
          </svg>
          {skipReasonLabel}
        </div>
      ) : (
        <p style={{
          fontFamily: ef.serif, fontSize: 13, color: e.indigoGray,
          lineHeight: 1.55, margin: 0, fontStyle: "italic",
          overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical" as const,
        }}>
          &ldquo;{displayText}&rdquo;
        </p>
      )}
      {!skipReasonLabel && microFeedback && (
        /* role="status" + aria-live="polite" so screen-reader users hear
           the coaching tip when it lands. polite (not assertive) because
           the tip is advisory — it should yield to active speech (TTS
           question playback, candidate's own STT readback). aria-atomic
           ensures the whole tip is announced as one phrase, not chunked.
           Labelled so it's distinguishable from the surrounding answer
           card on screen-reader tab-out. */
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          aria-label="Live coaching tip"
          style={{
            marginTop: 8, padding: "5px 10px", borderRadius: 999,
            display: "inline-flex", alignItems: "center", gap: 6,
            background: isStrong ? "rgba(21,128,61,0.10)" : "rgba(180,83,9,0.10)",
            border: `1px solid ${isStrong ? "rgba(21,128,61,0.20)" : "rgba(180,83,9,0.20)"}`,
          }}>
          <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={isStrong ? e.success : e.copper} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            {isStrong ? <polyline points="20 6 9 17 4 12" /> : <><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>}
          </svg>
          <span style={{
            fontFamily: ef.sans, fontSize: 11, fontWeight: 500,
            color: isStrong ? e.success : e.copper,
          }}>
            {microFeedback}
          </span>
        </div>
      )}
    </div>
  );
});

/* ─── Campus-placement readiness chips ─── *
 * Fresher-specific micro-coach surface. Renders next to MicroFeedbackPanel
 * when interviewType === "campus-placement".
 *
 * Pure detection logic lives in src/_campus-readiness.ts (unit-tested,
 * regexes mirror server-handlers/analyzers/campus-placement.ts v2). This
 * component is render-only. Three baseline chips (project, research,
 * logistics) + optional internship chip + a red-flag alert row that only
 * appears when the candidate trips a costly framing error (badmouth /
 * volunteered deficit / implausible team) + a live filler counter.
 *
 * Why a separate red-flag row: the regret-class mistakes are rare-fire,
 * high-cost. Inlining them with the always-on baseline chips would dilute
 * the alarm. Surfacing them in a distinct red strip below the row makes
 * them noticeable without screaming at every candidate. */
function chipColors(state: CpChipState) {
  if (state === "pass") return { bg: "rgba(21,128,61,0.10)", border: "rgba(21,128,61,0.20)", fg: e.success };
  if (state === "warn") return { bg: "rgba(180,83,9,0.10)", border: "rgba(180,83,9,0.20)", fg: e.copper };
  if (state === "alert") return { bg: "rgba(185,28,28,0.10)", border: "rgba(185,28,28,0.25)", fg: "#b91c1c" };
  return { bg: e.creamSoft, border: e.line, fg: e.inkFaint };
}

function ChipIcon({ state, fg }: { state: CpChipState; fg: string }) {
  return (
    <svg aria-hidden="true" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={fg} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      {state === "pass" ? <polyline points="20 6 9 17 4 12" />
        : state === "warn" ? <><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>
        : state === "alert" ? <><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>
        : <circle cx="12" cy="12" r="9" />}
    </svg>
  );
}

function ReadinessChip({ label, state }: { label: string; state: CpChipState }) {
  const col = chipColors(state);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "4px 10px", borderRadius: 999,
      background: col.bg, border: `1px solid ${col.border}`,
      fontFamily: ef.sans, fontSize: 11, fontWeight: 500, color: col.fg,
    }}>
      <ChipIcon state={state} fg={col.fg} />
      {label}
    </span>
  );
}

export const CampusReadinessChips = memo(function CampusReadinessChips({ transcript }: {
  transcript: { speaker: string; text: string }[];
}) {
  // Memoize on the joined user-text identity — transcript array changes
  // every render via setState but the meaningful slice only changes on
  // new user turns. useMemo + transcript length keeps the cost flat.
  const readiness = useMemo(
    () => computeCampusReadiness(transcript),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transcript.length, transcript.map(t => t.text).join("|").length],
  );
  if (!readiness) return null;

  const baselineChips = [
    readiness.project,
    readiness.research,
    readiness.logistics,
    ...(readiness.internship ? [readiness.internship] : []),
  ];
  const alertChips = [readiness.deficit, readiness.badmouth, readiness.team].filter(
    (c): c is { state: CpChipState; label: string } => c !== null,
  );
  const { count, wordCount, per100, warn: fillerWarn } = readiness.filler;

  return (
    <div style={{
      width: "100%", borderRadius: 14, padding: "12px 16px",
      background: e.white, border: `1px solid ${e.line}`,
      boxShadow: "0 1px 0 rgba(20,17,10,.03), 0 1px 2px rgba(20,17,10,.04)",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{
          fontFamily: ef.mono, fontSize: 10, textTransform: "uppercase",
          letterSpacing: 1.4, color: e.copper,
        }}>
          Campus readiness
        </span>
        {wordCount >= 50 && (
          <span style={{
            fontFamily: ef.mono, fontSize: 10, color: fillerWarn ? e.copper : e.inkFaint,
          }}>
            fillers {count}{wordCount >= 100 ? ` (${per100.toFixed(1)}/100w)` : ""}
          </span>
        )}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {baselineChips.map((c, i) => (
          <ReadinessChip key={`b-${i}`} label={c.label} state={c.state} />
        ))}
      </div>
      {alertChips.length > 0 && (
        <div style={{
          marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${e.line}`,
          display: "flex", flexWrap: "wrap", gap: 6,
        }}>
          {alertChips.map((c, i) => (
            <ReadinessChip key={`a-${i}`} label={c.label} state={c.state} />
          ))}
        </div>
      )}
    </div>
  );
});

/* ─── Bottom Controls Bar ─── */

export const ControlsBar = memo(function ControlsBar({ isMuted, setIsMuted, aiVoiceEnabled, setAiVoiceEnabled, showTranscript, setShowTranscript, phase, ttsCancelRef, setShowEndModal, endModalTriggerRef, videoEnabled, onToggleVideo }: {
  isMuted: boolean; setIsMuted: (fn: (m: boolean) => boolean) => void;
  aiVoiceEnabled: boolean; setAiVoiceEnabled: (fn: (v: boolean) => boolean) => void;
  showTranscript: boolean; setShowTranscript: (fn: (t: boolean) => boolean) => void;
  phase: string;
  ttsCancelRef: React.MutableRefObject<(() => void) | null>;
  setShowEndModal: (v: boolean) => void;
  endModalTriggerRef: React.RefObject<HTMLSpanElement | null>;
  videoEnabled: boolean; onToggleVideo: () => void;
}) {
  return (
    <footer className="iv-controls" style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      // Bottom padding uses the max of 10px and env(safe-area-inset-bottom)
      // so the iOS home indicator can't overlap the mute/end buttons. Users
      // on iPhone 12+ were hitting this — the home bar covered ~34px of the
      // control strip at the default 10px padding.
      padding: "10px 24px max(10px, env(safe-area-inset-bottom, 10px))", gap: 12,
      borderTop: `1px solid ${e.line}`,
      background: e.cream,
      flexShrink: 0, zIndex: 10,
    }}>
      <ControlButton
        icon={isMuted ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.12 1.5-.35 2.18"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
        )}
        label={isMuted ? "Unmute (Alt+M)" : "Mute (Alt+M)"}
        active={!isMuted}
        danger={isMuted}
        onClick={() => setIsMuted(m => !m)}
      />
      <ControlButton
        icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            {aiVoiceEnabled && <><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></>}
            {!aiVoiceEnabled && <line x1="23" y1="9" x2="17" y2="15"/>}
            {!aiVoiceEnabled && <line x1="17" y1="9" x2="23" y2="15"/>}
          </svg>
        }
        label={aiVoiceEnabled ? "Mute AI voice (Alt+V)" : "Enable AI voice (Alt+V)"}
        active={aiVoiceEnabled}
        onClick={() => { if (aiVoiceEnabled) ttsCancelRef.current?.(); setAiVoiceEnabled(v => !v); }}
      />
      <ControlButton
        icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
        }
        label={showTranscript ? "Hide transcript (Alt+T)" : "Show transcript (Alt+T)"}
        active={showTranscript}
        onClick={() => setShowTranscript(t => !t)}
      />
      <ControlButton
        icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {videoEnabled ? (
              <>
                <polygon points="23 7 16 12 23 17 23 7"/>
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
              </>
            ) : (
              <>
                <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </>
            )}
          </svg>
        }
        label={videoEnabled ? "Stop camera" : "Start camera"}
        active={videoEnabled}
        onClick={onToggleVideo}
      />
      {phase !== "done" && (
        <>
          <div className="iv-hide-mobile" style={{ width: 1, height: 24, background: "rgba(20,17,10,0.05)", margin: "0 4px" }} />
          <span ref={endModalTriggerRef} style={{ display: "inline-flex" }}>
            <ControlButton
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>}
              label="End interview"
              danger
              onClick={() => { ttsCancelRef.current?.(); ttsCancelRef.current = null; setShowEndModal(true); }}
            />
          </span>
        </>
      )}
    </footer>
  );
});

/* ─── Transcript Filter Buttons (panel mode) ─── */
const TranscriptFilters = memo(function TranscriptFilters({ panelMembers, activeFilter, setActiveFilter }: {
  panelMembers: PanelMember[]; activeFilter: string; setActiveFilter: (v: string) => void;
}) {
  const filters = [{ label: "All", value: "all", color: e.coal }, ...panelMembers.map(m => ({ label: m.name.split(" ")[0], value: m.title, color: m.color }))];
  return (
    <div style={{ display: "flex", gap: 6, padding: "10px 20px", borderBottom: `1px solid ${e.line}`, overflow: "auto" }}>
      {filters.map(f => {
        const isActive = activeFilter === f.value;
        return (
          <button key={f.value} onClick={() => setActiveFilter(f.value)} style={{
            fontFamily: ef.sans, fontSize: 11, fontWeight: 500,
            padding: "4px 12px", borderRadius: 999,
            border: `1px solid ${isActive ? `${f.color}55` : e.line}`,
            background: isActive ? `${f.color}14` : e.white,
            color: isActive ? f.color : e.inkSoft,
            cursor: "pointer", whiteSpace: "nowrap",
            transition: "all 160ms ease",
          }}>
            {f.label}
          </button>
        );
      })}
    </div>
  );
});

/* ─── Transcript Slide-Over Panel ─── */

export const TranscriptPanel = memo(function TranscriptPanel({ transcript, interviewerName, setShowTranscript, transcriptRef, panelMembers }: {
  transcript: { speaker: "ai" | "user"; text: string; time: string }[];
  interviewerName: string;
  setShowTranscript: (v: boolean) => void;
  transcriptRef: React.RefObject<HTMLDivElement | null>;
  panelMembers?: PanelMember[];
}) {
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 600px)").matches);
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 600px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // Panel transcript filter
  const [transcriptFilter, setTranscriptFilter] = useState("all");
  const filteredTranscript = transcriptFilter === "all" ? transcript : transcript.filter(msg => {
    if (msg.speaker === "user") return true; // always show user answers
    const match = msg.text.match(/^\[(.+?)\]/);
    return match ? match[1].toLowerCase() === transcriptFilter.toLowerCase() : true;
  });

  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- modal backdrop dismissal */}
      <div
        onClick={() => setShowTranscript(false)}
        style={{
          position: "fixed", inset: 0, zIndex: 49,
          background: isMobile ? "transparent" : "rgba(14,12,8,0.50)",
          backdropFilter: isMobile ? "none" : "blur(2px)",
          WebkitBackdropFilter: isMobile ? "none" : "blur(2px)",
          animation: "fadeUp 0.15s ease",
        }}
      />
      <div className="iv-transcript-panel" style={isMobile ? {
        position: "fixed", bottom: 0, left: 0, right: 0,
        maxHeight: "60vh",
        background: e.cream,
        borderTop: `1px solid ${e.line}`,
        borderRadius: "20px 20px 0 0",
        display: "flex", flexDirection: "column",
        zIndex: 50, animation: "slideUpSheet 0.25s ease",
        boxShadow: "0 -8px 32px rgba(20,17,10,.18)",
      } : {
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: 400, maxWidth: "100vw",
        background: e.cream,
        borderLeft: `1px solid ${e.line}`,
        display: "flex", flexDirection: "column",
        zIndex: 50, animation: "slideInRight 0.25s ease",
        boxShadow: "-8px 0 32px rgba(20,17,10,.18)",
      }}>
        {/* Drag handle (mobile only, decorative) */}
        {isMobile && (
          <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 0" }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: e.lineStrong }} />
          </div>
        )}
        <div style={{
          padding: "16px 20px", borderBottom: `1px solid ${e.line}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <span style={{ fontFamily: ef.serif, fontSize: 18, fontWeight: 500, color: e.coal, letterSpacing: "-0.01em", display: "block" }}>
              Transcript
            </span>
            <span style={{ fontFamily: ef.mono, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.4, color: e.inkSoft, marginTop: 2, display: "block" }}>
              Live transcript · audio is never recorded
            </span>
          </div>
          <button
            onClick={() => setShowTranscript(false)}
            aria-label="Close transcript"
            style={{
              background: e.white, border: `1px solid ${e.line}`,
              borderRadius: 999, width: 32, height: 32,
              color: e.inkSoft, cursor: "pointer",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              transition: "background 160ms ease, color 160ms ease",
            }}
            onMouseEnter={(ev) => { ev.currentTarget.style.background = e.creamSoft; ev.currentTarget.style.color = e.coal; }}
            onMouseLeave={(ev) => { ev.currentTarget.style.background = e.white; ev.currentTarget.style.color = e.inkSoft; }}
          >
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        {/* Panel filter buttons */}
        {panelMembers && panelMembers.length > 0 && (
          <TranscriptFilters panelMembers={panelMembers} activeFilter={transcriptFilter} setActiveFilter={setTranscriptFilter} />
        )}
        {/* role="log" implies polite live-region; we override aria-relevant
            to "additions" so SR only announces NEW transcript entries, not
            the full panel re-render when filters change. The transcript can
            grow long — without this, every backchannel ("Mm-hmm") fired
            would force a re-read of the whole conversation. */}
        <div ref={transcriptRef} role="log" aria-relevant="additions" aria-label="Interview transcript" style={{ flex: 1, overflow: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          {transcript.length === 0 && (
            <p style={{ fontFamily: ef.serif, fontSize: 14, fontStyle: "italic", color: e.inkSoft, textAlign: "center", padding: "40px 0" }}>
              The conversation will appear here as you talk.
            </p>
          )}
          {filteredTranscript.map((msg, i) => {
            const isAi = msg.speaker === "ai";
            // Resolve panel persona color/name once per message
            const panelMatch = panelMembers && isAi ? msg.text.match(/^\[(.+?)\]/) : null;
            const panelMember = panelMatch
              ? panelMembers!.find(m => m.title.toLowerCase() === panelMatch[1].toLowerCase())
              : null;
            const speakerColor = isAi ? (panelMember?.color ?? e.copper) : e.indigo;
            const speakerName = isAi ? (panelMember?.name ?? interviewerName) : "You";
            // Strip the leading [Title] panel-tag for AI rows in panel mode
            // before rendering. Then strip prosody markup ([pause], _emph_)
            // from any AI text — those are TTS hints, never visible.
            const rawText = panelMembers && isAi ? msg.text.replace(/^\[.+?\]\s*/, "") : msg.text;
            const displayText = isAi ? stripProsodyMarkup(rawText) : rawText;
            return (
              <article
                key={`${msg.speaker}-${msg.time}-${i}`}
                aria-label={isAi ? `${speakerName} (recruiter) at ${msg.time}` : `You at ${msg.time}`}
                style={{ display: "flex", gap: 10 }}
              >
                <div style={{
                  width: 24, height: 24, borderRadius: "50%", flexShrink: 0, marginTop: 1,
                  background: isAi ? `${speakerColor}1A` : "rgba(49,46,129,0.12)",
                  border: `1px solid ${isAi ? `${speakerColor}33` : "rgba(49,46,129,0.20)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {isAi ? (
                    <svg aria-hidden="true" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={speakerColor} strokeWidth="2.4" strokeLinecap="round"><circle cx="12" cy="12" r="3" fill={speakerColor} /></svg>
                  ) : (
                    <svg aria-hidden="true" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={speakerColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <span style={{
                      fontFamily: ef.sans, fontSize: 11, fontWeight: 600,
                      color: speakerColor,
                    }}>
                      {speakerName}
                    </span>
                    <span style={{ fontFamily: ef.mono, fontSize: 10, color: e.inkFaint }}>{msg.time}</span>
                  </div>
                  <p style={{
                    fontFamily: isAi ? ef.serif : ef.sans,
                    fontSize: 13.5, color: e.coal, lineHeight: 1.55,
                    margin: 0, wordBreak: "break-word", overflowWrap: "break-word",
                  }}>
                    {displayText}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </>
  );
});

/* ─── End Interview Modal ─── */

export const EndModal = memo(function EndModal({ currentQuestionNum, totalQuestions, baseQuestionCount, isOffline, handleEnd, setShowEndModal, endModalTriggerRef }: {
  currentQuestionNum: number; totalQuestions: number; baseQuestionCount?: number; isOffline: boolean;
  handleEnd: () => void; setShowEndModal: (v: boolean) => void;
  endModalTriggerRef: React.RefObject<HTMLSpanElement | null>;
}) {
  // Denominator must share the numerator's basis. currentQuestionNum is a
  // BASE-question position (capped at baseQuestionCount, follow-ups counted
  // under their parent question), so the total must be baseQuestionCount —
  // NOT totalQuestions, which inflates by every inserted follow-up and made
  // a fully-answered 5-question session read "5 of 8". Fall back to
  // totalQuestions only in the degenerate baseQuestionCount===0 case.
  const questionTotal = baseQuestionCount || totalQuestions;
  const closeFocus = () => { setShowEndModal(false); endModalTriggerRef.current?.querySelector("button")?.focus(); };
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- dialog needs click/keyboard handlers for dismissal and focus trap
    <div
      role="dialog" aria-modal="true" aria-labelledby="end-modal-title" tabIndex={-1}
      onClick={(e) => { if (e.target === e.currentTarget) { e.stopPropagation(); closeFocus(); } }}
      onKeyDown={(e) => {
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeFocus(); return; }
        if (e.key === "Tab") {
          const modal = e.currentTarget.querySelector("[data-modal-content]") as HTMLElement;
          if (!modal) return;
          const focusable = modal.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])");
          if (focusable.length === 0) return;
          const first = focusable[0]; const last = focusable[focusable.length - 1];
          if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
          else { if (document.activeElement === last) { e.preventDefault(); first.focus(); } }
        }
      }}
      ref={(el) => { if (el) { const btn = el.querySelector("button"); if (btn) btn.focus(); } }}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(14,12,8,0.70)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
        animation: "fadeUp 0.15s ease",
      }}>
      <div data-modal-content className="hsx-end-modal" style={{
        background: e.cream, borderRadius: 20, border: `1px solid ${e.line}`,
        padding: "28px 28px 24px", maxWidth: 460, width: "92%",
        boxShadow: "0 2px 4px rgba(20,17,10,.06), 0 32px 64px -16px rgba(20,17,10,.24)",
      }}>
        <style>{`
          /* Narrow-viewport rescue: under 380px the two side-by-side modal
             buttons overflow the cream card. Stack vertically and pull
             padding in so the modal still breathes on a 320-360px phone. */
          @media (max-width: 380px) {
            .hsx-end-modal { padding: 16px !important; }
            .hsx-end-modal .hsx-end-modal-actions { flex-direction: column-reverse !important; }
            .hsx-end-modal .hsx-end-modal-actions button { width: 100% !important; }
          }
        `}</style>
        <h3 id="end-modal-title" style={{
          margin: 0, fontFamily: ef.serif, fontSize: 28, fontWeight: 400,
          lineHeight: 1.2, color: e.coal, letterSpacing: "-0.015em",
        }}>
          End the interview <em style={{ color: e.copper, fontStyle: "italic" }}>now</em>?
        </h3>
        <p style={{
          margin: "10px 0 22px", fontFamily: ef.sans, fontSize: 14,
          lineHeight: 1.55, color: e.inkSoft,
        }}>
          You&rsquo;ve answered <strong style={{ color: e.coal, fontWeight: 600 }}>{Math.min(currentQuestionNum, questionTotal)} of {questionTotal}</strong> questions. We&rsquo;ll still score what you&rsquo;ve done so far &mdash; but a partial session won&rsquo;t reflect your full performance.
        </p>
        {isOffline && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, background: "rgba(185,28,28,0.08)", border: "1px solid rgba(185,28,28,0.20)", marginBottom: 16 }}>
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={e.error} strokeWidth="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/></svg>
            <span style={{ fontFamily: ef.sans, fontSize: 12, color: e.error }}>You&rsquo;re offline — AI evaluation may fail. Your answers will be saved locally.</span>
          </div>
        )}
        <div className="hsx-end-modal-actions" style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={closeFocus}
            style={{
              fontFamily: ef.sans, fontSize: 13, fontWeight: 500, color: e.coal,
              background: "transparent", border: `1px solid ${e.line}`,
              borderRadius: 999, padding: "10px 18px", cursor: "pointer",
            }}
            onMouseEnter={(ev) => { ev.currentTarget.style.background = e.creamSoft; }}
            onMouseLeave={(ev) => { ev.currentTarget.style.background = "transparent"; }}
          >
            Keep going
          </button>
          <button onClick={handleEnd}
            style={{
              fontFamily: ef.sans, fontSize: 13, fontWeight: 500, color: e.cream,
              background: e.copper, border: "none",
              borderRadius: 999, padding: "10px 18px", cursor: "pointer",
              boxShadow: "0 4px 12px -4px rgba(180,83,9,0.45)",
            }}
            onMouseEnter={(ev) => { ev.currentTarget.style.filter = "brightness(1.10)"; }}
            onMouseLeave={(ev) => { ev.currentTarget.style.filter = "brightness(1)"; }}
          >
            End and see report
          </button>
        </div>
      </div>
    </div>
  );
});

/* ─── Evaluating Overlay ─── */

export const EvaluatingOverlay = memo(function EvaluatingOverlay({ usedFallbackScore, evalTimedOut, evalElapsed, saveWarning, setEvalTimedOut, setUsedFallbackScore, setEvaluating, interviewEndedRef, handleEnd, lastSessionId, navigate }: {
  usedFallbackScore: boolean; evalTimedOut: boolean; evalElapsed: number; saveWarning: string;
  setEvalTimedOut: (v: boolean) => void; setUsedFallbackScore: (v: boolean) => void;
  setEvaluating: (v: boolean) => void;
  interviewEndedRef: React.MutableRefObject<boolean>;
  handleEnd: () => void;
  lastSessionId: string | null;
  navigate: { push: (path: string) => void };
}) {
  const retryCountRef = useRef(0);
  const maxRetries = 2;
  const canRetry = retryCountRef.current < maxRetries;
  return (
    <div role="status" aria-live="polite" aria-label="Evaluating your interview" style={{
      position: "fixed", inset: 0, zIndex: 200,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      // Cream surface — matches the SessionReport view that loads next so
      // the user doesn't see a dark→cream flash. Slight backdrop blur
      // keeps a sense of overlay depth without the dark wash.
      background: "rgba(250,247,240,0.96)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
    }}>
      {!(usedFallbackScore || evalTimedOut) ? (
        <>
          <div style={{ width: 48, height: 48, border: `3px solid ${e.line}`, borderTopColor: "#312E81", borderRadius: "50%", animation: "spin 0.8s linear infinite", marginBottom: 24 }} />
          <h3 style={{ fontFamily: ef.serif, fontSize: 28, fontWeight: 400, color: e.coal, marginBottom: 8, letterSpacing: "-0.01em" }}>Coaching your report</h3>
          <p style={{ fontFamily: ef.sans, fontSize: 14, color: e.inkSoft }}>Reading your transcript and drafting per-question coach notes…</p>
          <p style={{ fontFamily: ef.sans, fontSize: 12, color: e.inkSoft, opacity: 0.7, marginTop: 4 }}>
            {evalElapsed < 10 ? "This usually takes 10\u201330 seconds." : evalElapsed < 25 ? `Almost there… (${evalElapsed}s)` : `Taking longer than usual… (${evalElapsed}s)`}
          </p>
          <div style={{ width: 200, height: 3, borderRadius: 2, background: e.line, marginTop: 16, overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 2, background: e.copper, transition: "width 1s ease", width: `${Math.min(95, (evalElapsed / 30) * 100)}%` }} />
          </div>
          {/* Escape hatch surfaced at 10s (was 20s) so users with a
              flaky LLM provider don't sit staring at an indeterminate
              spinner. The AI eval has its own 18s abort timer, but
              giving the user manual control earlier is the kinder
              floor — clicking flips to the "AI evaluation unavailable"
              panel which lands them on results immediately. */}
          {evalElapsed >= 10 && (
            <div style={{ marginTop: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <button
                type="button"
                onClick={() => { setUsedFallbackScore(true); }}
                style={{
                  fontFamily: ef.sans, fontSize: 12, fontWeight: 500, color: e.coal,
                  background: "transparent", border: `1px solid ${e.line}`,
                  borderRadius: 999, padding: "7px 16px", cursor: "pointer",
                  transition: "background 160ms ease, border-color 160ms ease",
                }}
                onMouseEnter={(ev) => { ev.currentTarget.style.background = "rgba(14,12,8,0.06)"; ev.currentTarget.style.borderColor = e.lineStrong; }}
                onMouseLeave={(ev) => { ev.currentTarget.style.background = "transparent"; ev.currentTarget.style.borderColor = e.line; }}
              >
                Skip and use estimated score
              </button>
              <span style={{ fontFamily: ef.sans, fontSize: 11, color: e.inkSoft, opacity: 0.7 }}>
                You&rsquo;ll get a basic score now. Detailed AI feedback can take longer on slow connections.
              </span>
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: "rgba(180,83,9,0.10)", border: "1px solid rgba(180,83,9,0.18)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
            <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={e.copper} strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <h3 style={{ fontFamily: ef.sans, fontSize: 18, fontWeight: 600, color: e.coal, marginBottom: 8 }}>
            {evalTimedOut ? "Evaluation timed out" : "AI evaluation unavailable"}
          </h3>
          <p style={{ fontFamily: ef.sans, fontSize: 13, color: e.inkSoft, marginBottom: 20, textAlign: "center", maxWidth: 360 }}>
            {canRetry
              ? "Your session has been saved with an estimated score. You can retry the AI evaluation or continue to your results."
              : "AI evaluation failed after multiple attempts. Your session is saved with an estimated score based on session metrics."}
          </p>
          <div style={{ display: "flex", gap: 12 }}>
            {canRetry && (
            <button
              onClick={() => { retryCountRef.current++; setEvalTimedOut(false); setUsedFallbackScore(false); setEvaluating(false); interviewEndedRef.current = false; handleEnd(); }}
              style={{
                fontFamily: ef.sans, fontSize: 13, fontWeight: 500, color: e.coal,
                background: "rgba(180,83,9,0.16)", border: "1px solid rgba(180,83,9,0.24)",
                borderRadius: 10, padding: "10px 20px", cursor: "pointer", transition: "background 0.2s ease, border-color 0.2s ease, color 0.2s ease, opacity 0.2s ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(180,83,9,0.24)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(180,83,9,0.16)"; }}
            >
              Retry Evaluation{retryCountRef.current > 0 ? ` (${maxRetries - retryCountRef.current} left)` : ""}
            </button>
            )}
            <button
              onClick={() => { setEvaluating(false); if (lastSessionId) navigate.push(`/session/${lastSessionId}`); else navigate.push("/dashboard"); }}
              style={{
                fontFamily: ef.sans, fontSize: 13, fontWeight: 600, color: e.cream,
                background: `linear-gradient(135deg, ${e.copper}, ${"#92400E"})`,
                border: "none", borderRadius: 10, padding: "10px 24px", cursor: "pointer",
                boxShadow: "0 4px 16px rgba(180,83,9,0.24)", transition: "background 0.2s ease, border-color 0.2s ease, color 0.2s ease, opacity 0.2s ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
            >
              View Results
            </button>
          </div>
        </>
      )}
      {saveWarning && !(usedFallbackScore || evalTimedOut) && (
        <div role="alert" style={{ marginTop: 12, padding: "12px 20px", borderRadius: 10, background: "rgba(185,28,28,0.16)", border: "1px solid rgba(185,28,28,0.24)", maxWidth: 400 }}>
          <p style={{ fontFamily: ef.sans, fontSize: 12, color: e.error, margin: 0 }}>{saveWarning}</p>
        </div>
      )}
    </div>
  );
});

/* ═══════════════════════════════════════════════
   Robustness primitives (PaceMeter, RepeatButton, SaveToast,
   MicQuietBanner, ReconnectingOverlay, InterviewCoachmarks)
   moved to ./InterviewRobustness.tsx. Re-exported here so existing
   import paths from Interview.tsx and tests keep working unchanged.
   ═══════════════════════════════════════════════ */
export {
  PaceMeter,
  RepeatButton,
  SaveToast,
  MicQuietBanner,
  ReconnectingOverlay,
  InterviewCoachmarks,
} from "./InterviewRobustness";
