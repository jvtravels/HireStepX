"use client";
import { e } from "../../interviewTokens";
import {
  CanvasWordmark, CanvasContextChip, CanvasStatusPill,
  CanvasMuteToggle, CanvasCameraToggle, CanvasAvatar,
} from "../../InterviewCanvasAtoms";

/* ─── Interview topbar ─────────────────────────────────────────────────
   Wordmark · ContextChip   <spacer>   StatusPill · PracticeBadge ·
   Mute · Camera · Avatar.

   Extracted from Interview.tsx's inline <header>. All classNames, styles,
   svgs, aria-labels, and the connection-status / fallback-source plumbing
   are preserved verbatim. Engine state arrives via props so this stays a
   pure render component (no useInterview() coupling). */

import type { CanvasConnectionStatus } from "../../InterviewCanvasAtoms";

export interface InterviewHeaderProps {
  displayRole: string;
  displayCompany: string;
  displayFocus: string;
  isSalaryNegotiation: boolean;
  isPanelInterview: boolean;
  connectionStatus: CanvasConnectionStatus;
  questionFallbackSource: "cached" | "static" | null | undefined;
  isMuted: boolean;
  onToggleMute: () => void;
  videoEnabled: boolean;
  onToggleVideo: () => void;
  myInitials: string;
}

export function InterviewHeader({
  displayRole, displayCompany, displayFocus,
  isSalaryNegotiation, isPanelInterview,
  connectionStatus,
  questionFallbackSource,
  isMuted, onToggleMute,
  videoEnabled, onToggleVideo,
  myInitials,
}: InterviewHeaderProps) {
  return (
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
      {/* Topbar middle was a question-count stepper which lied (real
          interviews are time-bounded, not question-bounded). The session
          elapsed clock already lives in the footer's CanvasMetaRow, so
          this slot stays empty rather than duplicating the same number. */}
      <div className="iv-canvas-topbar-right" style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
        <div className="iv-canvas-mobile-hide">
          <CanvasStatusPill status={connectionStatus} />
        </div>
        {/* Practice-mode badge — surfaces when the server fell back
            to the static question bank (`_fallback: "static"`) or
            the LLM call returned null entirely. Honest disclosure:
            the candidate is answering canned questions, not fresh
            LLM ones. Cached responses are treated as "Practice mode"
            too because they're still pre-generated content. */}
        {questionFallbackSource && (
          <span
            role="status"
            aria-label={
              questionFallbackSource === "cached"
                ? "Practice mode — replaying recent cached questions"
                : "Practice mode — using the static question bank because live AI generation didn't return"
            }
            title={
              questionFallbackSource === "cached"
                ? "Recently cached — these questions came from a 300s response cache, not a fresh AI call."
                : "Static bank — the AI question generator didn't respond in time. You're practicing from the hand-curated fallback set."
            }
            className="iv-canvas-mobile-hide"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              borderRadius: 999,
              border: `1px solid ${e.line}`,
              background: "rgba(217, 168, 92, 0.12)",
              color: e.coal,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 0.3,
              textTransform: "uppercase",
            }}
          >
            <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: "#d9a85c" }} />
            Practice mode
          </span>
        )}
        <CanvasMuteToggle muted={isMuted} onClick={onToggleMute} />
        <CanvasCameraToggle on={videoEnabled} onClick={onToggleVideo} />
        <CanvasAvatar initials={myInitials} />
      </div>
    </header>
  );
}

export default InterviewHeader;
