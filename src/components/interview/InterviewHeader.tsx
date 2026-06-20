"use client";
import { e } from "../../interviewTokens";
import {
  CanvasWordmark, CanvasContextChip, CanvasStatusPill,
  CanvasMuteToggle, CanvasCameraToggle, CanvasAvatar,
} from "../../InterviewCanvasAtoms";

/* ─── Interview topbar ─────────────────────────────────────────────────
   Wordmark · ContextChip   <spacer>   StatusPill ·
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
        {/* The static/cached "Practice mode" badge was removed: this is a
            mock-interview product, so the entire session is practice by
            design. Flagging a silent server-side fallback as "Practice
            mode" misled candidates into thinking the rest wasn't — and the
            label leaked an internal provider detail with no user action. */}
        <CanvasMuteToggle muted={isMuted} onClick={onToggleMute} />
        <CanvasCameraToggle on={videoEnabled} onClick={onToggleVideo} />
        <CanvasAvatar initials={myInitials} />
      </div>
    </header>
  );
}

export default InterviewHeader;
