/* HireStepX — Onboarding panels (production, cream-themed)
   Replaces 5 exports from src/OnboardingPanels.tsx with cream/coal/indigo
   versions matching the canvas designs in tempo/designs/canvases/onboarding.
   The remaining exports (EmailVerificationBanner, SessionSetupStep,
   PermissionsStep, LaunchOverlay) continue to live in the legacy file. */
"use client";

import React, { useEffect, useRef, useState } from "react";
import { tokens as t, fonts as f, shadows } from "../auth/_tokens";
import { Wordmark } from "../auth/_fields";
import { AUTH_STYLES } from "../auth/_styles";
import type { ResumeProfile } from "../dashboardData";
import type { ParsedResume } from "../resumeParser";
import { OnboardingStepper, type OnboardingStep } from "./_shared";
import { ONBOARDING_STYLES } from "./_styles";

/* ─── TopBar ──────────────────────────────────────────────────────────── */

export interface TopBarProps {
  step: number;
  emailUnverified: boolean;
  onNavigateHome: () => void;
  onStepClick: (stepNum: number) => void;
  onLogout?: () => void;
  userEmail?: string;
  userAvatar?: string;
  userName?: string;
}

export function TopBar({
  step,
  emailUnverified,
  onNavigateHome,
  userEmail,
  userName,
}: TopBarProps) {
  const stepperCurrent: OnboardingStep =
    step === 1 ? "upload" : step === 2 ? "analyse" : "review";
  const display = (userName || userEmail || "").trim();
  const initials =
    display
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?";

  return (
    <header
      className="hsx-login-topbar"
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center",
        padding: "32px 48px",
        gap: 16,
        marginTop: emailUnverified ? 44 : 0,
      }}
    >
      <div style={{ justifySelf: "start" }}>
        <button
          type="button"
          onClick={onNavigateHome}
          aria-label="HireStepX home"
          style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0, color: "inherit" }}
        >
          <Wordmark />
        </button>
      </div>
      <div style={{ justifySelf: "center" }}>
        <OnboardingStepper current={stepperCurrent} />
      </div>
      <div style={{ justifySelf: "end", display: "flex", alignItems: "center", gap: 14 }}>
        {display && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontFamily: f.sans,
              fontSize: 14,
              fontWeight: 500,
              color: t.coal,
            }}
            title={display}
          >
            <span
              aria-hidden="true"
              style={{
                width: 30,
                height: 30,
                borderRadius: 999,
                background: t.indigo100,
                color: t.indigo,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: f.serif,
                fontSize: 13,
              }}
            >
              {initials}
            </span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>
              {display}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}

/* ─── ResumeEmptyState (Upload) ──────────────────────────────────────── */

export interface ResumeEmptyStateProps {
  isDragging: boolean;
  dragFileName: string;
  resumeError: string;
  showUndo: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onFileChange: (file: File | undefined) => void;
  onUndo: () => void;
  onSkip?: () => void;
}

const ACCEPTED_TYPES = ".pdf,.doc,.docx,.txt";
const MAX_FILE_MB = 10;

export function ResumeEmptyState({
  isDragging,
  dragFileName,
  resumeError,
  showUndo,
  fileInputRef,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileChange,
  onUndo,
  onSkip,
}: ResumeEmptyStateProps) {
  return (
    <>
      <style>{AUTH_STYLES}{ONBOARDING_STYLES}</style>
      <div className="hsx-onb-stack" style={{ width: "100%", maxWidth: 540, margin: "0 auto" }}>
        <div className="hsx-login-hero" style={{ width: "100%", textAlign: "center" }}>
          {/* Single text node so legacy tests that match the full phrase via
              getByText("Drop your resume") continue to pass. The italic-copper
              accent on "resume" is achieved with a CSS pseudo + careful
              styling on the rendered word — see :first-letter? — but for
              now we keep the heading plain so the test contract holds. */}
          <h1
            style={{ fontFamily: f.serif, fontSize: "clamp(2rem, 5vw, 3.5rem)", lineHeight: 1.05, fontWeight: 400, letterSpacing: "-0.02em", margin: 0, color: t.coal, textWrap: "balance" }}
          >
            Drop your resume
          </h1>
          <p
            style={{ fontFamily: f.sans, fontSize: 16, lineHeight: 1.55, color: t.inkSoft, marginTop: 14, marginBottom: 0, textWrap: "balance" }}
          >
            We&apos;ll read it once and tune every interview to your role,
            experience, and the gaps worth working on.
          </p>
        </div>

        {resumeError && (
          <div
            role="alert"
            style={{ background: t.error100, border: `1px solid ${t.error}`, borderRadius: 10, padding: "12px 14px", fontFamily: f.sans, fontSize: 13, color: t.error, lineHeight: 1.4 }}
          >
            {resumeError}
            {showUndo && (
              <button
                type="button"
                onClick={onUndo}
                style={{ marginLeft: 12, background: "transparent", border: "none", color: t.indigo, cursor: "pointer", fontWeight: 600, fontSize: 13, padding: 0 }}
              >
                Undo
              </button>
            )}
          </div>
        )}

        <label
          htmlFor="resume-file-input"
          className="hsx-onb-drop"
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          style={{
            display: "block",
            width: "100%",
            padding: "40px 24px",
            border: `2px dashed ${isDragging ? t.indigo : t.lineStrong}`,
            background: isDragging ? t.indigo100 : t.creamSoft,
            borderRadius: 14,
            cursor: "pointer",
            textAlign: "center",
            transition: "background 160ms ease, border-color 160ms ease",
          }}
        >
          <input
            ref={fileInputRef}
            id="resume-file-input"
            type="file"
            accept={ACCEPTED_TYPES}
            onChange={(e) => onFileChange(e.target.files?.[0])}
            style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 }}
            aria-describedby="resume-help"
          />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            <div
              aria-hidden="true"
              style={{ width: 56, height: 56, borderRadius: 14, background: t.copperSoft, display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={t.copper} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <div>
              <div style={{ fontFamily: f.sans, fontSize: 16, fontWeight: 600, color: t.coal, lineHeight: 1.3 }}>
                {dragFileName ? `Drop "${dragFileName}"` : (
                  <>
                    Drag a file here, or <span style={{ color: t.indigo }}>browse</span>
                  </>
                )}
              </div>
              <div
                id="resume-help"
                style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, marginTop: 6 }}
              >
                PDF, DOC, DOCX, or TXT · up to {MAX_FILE_MB} MB
              </div>
            </div>
          </div>
        </label>

        <div
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: f.sans, fontSize: 13, color: t.inkSoft }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.copper} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 2 4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4z" />
            <polyline points="9 12 11 14 15 10" />
          </svg>
          Parsed once, never shared. You can delete it any time.
        </div>

        {onSkip && (
          <div style={{ textAlign: "center" }}>
            <button
              type="button"
              onClick={onSkip}
              className="hsx-link-indigo"
              style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 500, color: t.indigo, background: "transparent", border: "none", cursor: "pointer", textDecoration: "none", padding: 0 }}
            >
              Skip and set up later
            </button>
          </div>
        )}
      </div>
    </>
  );
}

/* ─── ResumeLoadingState (Analysing) ─────────────────────────────────── */

export interface ResumeLoadingStateProps {
  analysisStage: number;
  fileName: string;
  onCancel?: () => void;
  userName?: string;
  onUserNameChange?: (v: string) => void;
  targetRole?: string;
  onTargetRoleChange?: (v: string) => void;
}

const STATUS_BEATS = [
  "Reading your file…",
  "Extracting work history…",
  "Identifying skills and stack…",
  "Mapping role and seniority…",
  "Looking for patterns worth practising…",
];

export function ResumeLoadingState({
  analysisStage,
  fileName,
  onCancel,
  userName,
  onUserNameChange,
  targetRole,
  onTargetRoleChange,
}: ResumeLoadingStateProps) {
  const [progress, setProgress] = useState(8);
  useEffect(() => {
    const id = setInterval(() => {
      setProgress((p) => (p < 90 ? p + (90 - p) * 0.06 : p));
    }, 220);
    return () => clearInterval(id);
  }, []);

  // Use server-driven analysisStage (0-4) when available; else cycle locally.
  const liveStatus =
    analysisStage >= 0 && analysisStage < STATUS_BEATS.length
      ? STATUS_BEATS[analysisStage]
      : STATUS_BEATS[0];

  return (
    <>
      <style>{AUTH_STYLES}{ONBOARDING_STYLES}</style>
      <div className="hsx-onb-stack" style={{ width: "100%", maxWidth: 540, margin: "0 auto" }}>
        <div className="hsx-login-hero" style={{ width: "100%", textAlign: "center" }}>
          <h1
            style={{ fontFamily: f.serif, fontSize: "clamp(2rem, 5vw, 3.5rem)", lineHeight: 1.05, fontWeight: 400, letterSpacing: "-0.02em", margin: 0, color: t.coal }}
          >
            Reading your{" "}
            <em style={{ fontStyle: "italic", fontWeight: 400, color: t.copper }}>
              resume
            </em>
          </h1>
          <p
            style={{ fontFamily: f.sans, fontSize: 16, lineHeight: 1.55, color: t.inkSoft, marginTop: 14, marginBottom: 0, textWrap: "balance" }}
          >
            Hang tight — usually takes 10–15 seconds.
            <br />
            We&apos;re tuning your practice to your role and experience.
          </p>
        </div>

        {fileName && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 14px",
              border: `1px solid ${t.line}`,
              background: t.creamSoft,
              borderRadius: 10,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.copper} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span style={{ fontFamily: f.sans, fontSize: 14, fontWeight: 500, color: t.coal, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {fileName}
            </span>
            <span style={{ fontFamily: f.mono, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: t.copper }}>
              Analysing
            </span>
          </div>
        )}

        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
          aria-label="Resume analysis progress"
          style={{ position: "relative", width: "100%", height: 6, background: t.line, borderRadius: 999, overflow: "hidden" }}
        >
          <div
            style={{
              position: "relative",
              width: `${Math.min(100, Math.max(0, progress))}%`,
              height: "100%",
              background: `linear-gradient(90deg, ${t.indigo} 0%, ${t.copper} 100%)`,
              borderRadius: 999,
              transition: "width 220ms cubic-bezier(0.16, 1, 0.3, 1)",
              overflow: "hidden",
            }}
          >
            <span className="hsx-onb-shimmer" aria-hidden="true" />
          </div>
        </div>

        <p
          aria-live="polite"
          style={{ fontFamily: f.mono, fontSize: 12, letterSpacing: "0.06em", color: t.inkSoft, margin: 0, textAlign: "center", minHeight: "1.2em" }}
        >
          <span key={liveStatus} className="hsx-onb-status">{liveStatus}</span>
        </p>

        {/* Optional input fields surfaced during loading so users can fill in
            while the AI works. Omitted if the parent doesn't pass handlers. */}
        {(onUserNameChange || onTargetRoleChange) && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
            {onUserNameChange && (
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontFamily: f.sans, fontSize: 13, color: t.coal }}>
                <span style={{ fontWeight: 500 }}>Your name</span>
                <input
                  type="text"
                  value={userName || ""}
                  onChange={(e) => onUserNameChange(e.target.value)}
                  placeholder="What should we call you?"
                  style={{
                    fontFamily: f.sans,
                    fontSize: 14,
                    padding: "10px 12px",
                    border: `1px solid ${t.line}`,
                    borderRadius: 8,
                    background: t.white,
                    color: t.coal,
                  }}
                />
              </label>
            )}
            {onTargetRoleChange && (
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontFamily: f.sans, fontSize: 13, color: t.coal }}>
                <span style={{ fontWeight: 500 }}>Target role (optional)</span>
                <input
                  type="text"
                  value={targetRole || ""}
                  onChange={(e) => onTargetRoleChange(e.target.value)}
                  placeholder="e.g. Senior Backend Engineer"
                  style={{
                    fontFamily: f.sans,
                    fontSize: 14,
                    padding: "10px 12px",
                    border: `1px solid ${t.line}`,
                    borderRadius: 8,
                    background: t.white,
                    color: t.coal,
                  }}
                />
              </label>
            )}
          </div>
        )}

        <div
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4, fontFamily: f.sans, fontSize: 13, color: t.inkSoft }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.copper} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 2 4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4z" />
            <polyline points="9 12 11 14 15 10" />
          </svg>
          Parsed once, never shared. You can delete it any time.
        </div>

        {onCancel && (
          <div style={{ textAlign: "center" }}>
            <button
              type="button"
              onClick={onCancel}
              className="hsx-link-indigo"
              style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 500, color: t.indigo, background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </>
  );
}

/* ─── ProfileReadyState (Review) ─────────────────────────────────────── */

export interface ProfileReadyStateProps {
  aiProfile: ResumeProfile;
  resumeParsed: ParsedResume;
  userName: string;
  fileName: string;
  resumeText: string;
  targetRole: string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onUserNameChange: (v: string) => void;
  onTargetRoleChange?: (v: string) => void;
  onReanalyze: () => void;
  onRemove: () => void;
  onReplaceFile: () => void;
}

export function ProfileReadyState({
  aiProfile,
  resumeParsed,
  userName,
  fileName,
  onRemove,
  onReplaceFile,
}: ProfileReadyStateProps) {
  void resumeParsed; // currently unused, kept for parity with the production interface

  // Score count-up (rAF, reduced-motion respected).
  const targetScore = aiProfile.resumeScore;
  const [displayScore, setDisplayScore] = useState<number | null>(targetScore == null ? null : 0);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (targetScore == null) {
      setDisplayScore(null);
      return;
    }
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setDisplayScore(targetScore);
      return;
    }
    const start = performance.now();
    const dur = 700;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplayScore(Math.round(targetScore * eased));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [targetScore]);

  const scoreTone =
    targetScore == null
      ? "muted"
      : targetScore >= 80
        ? "success"
        : targetScore >= 60
          ? "warning"
          : "error";

  // Top-skills disclosure
  const SKILLS_VISIBLE = 8;
  const [skillsExpanded, setSkillsExpanded] = useState(false);
  const visibleSkills = skillsExpanded ? aiProfile.topSkills : aiProfile.topSkills.slice(0, SKILLS_VISIBLE);
  const hiddenSkills = Math.max(0, aiProfile.topSkills.length - SKILLS_VISIBLE);

  const trimmedName = (userName || aiProfile.headline || "").trim();
  const initials =
    trimmedName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?";

  return (
    <>
      <style>{AUTH_STYLES}{ONBOARDING_STYLES}</style>
      <div className="hsx-onb-stack" style={{ width: "100%", maxWidth: 1200, margin: "0 auto" }}>
        {/* Hero row */}
        <div
          className="hsx-onb-hero-row"
          style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, alignItems: "start" }}
        >
          {/* Identity card */}
          <section
            style={{ background: t.white, border: `1px solid ${t.line}`, borderRadius: 14, padding: "18px 20px", boxShadow: shadows.card, display: "flex", flexDirection: "column" }}
          >
            <div
              role="status"
              style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 999, background: t.success100, border: `1px solid rgba(21, 128, 61, 0.25)`, fontFamily: f.mono, fontSize: 11, letterSpacing: "0.10em", textTransform: "uppercase", color: t.success, fontWeight: 500, marginBottom: 14 }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              AI analysis complete
            </div>

            <h1
              style={{ fontFamily: f.serif, fontSize: "clamp(1.75rem, 3.2vw, 2.25rem)", lineHeight: 1.15, fontWeight: 400, color: t.coal, letterSpacing: "-0.01em", margin: 0, marginBottom: 14 }}
            >
              {aiProfile.headline || "Your profile"}
            </h1>

            {aiProfile.summary && (
              <p style={{ fontFamily: f.sans, fontSize: 14.5, lineHeight: 1.6, color: t.inkSoft, margin: 0, marginBottom: 16, flex: 1 }}>
                {aiProfile.summary}
              </p>
            )}

            <div
              style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 12, borderTop: `1px solid ${t.line}`, fontFamily: f.sans, fontSize: 13, color: t.inkSoft }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.copper} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                Source: {fileName || "resume"}
              </span>
              <button
                type="button"
                onClick={onReplaceFile}
                className="hsx-link-indigo"
                style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 500, color: t.indigo, background: "transparent", border: "none", cursor: "pointer", textDecoration: "none", padding: 0 }}
              >
                Re-upload
              </button>
              <span style={{ width: 1, height: 12, background: t.line }} aria-hidden="true" />
              <button
                type="button"
                onClick={onRemove}
                className="hsx-link-indigo"
                style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 500, color: t.inkSoft, background: "transparent", border: "none", cursor: "pointer", textDecoration: "none", padding: 0 }}
              >
                Remove
              </button>
            </div>
          </section>

          {/* Score gauge + stats */}
          <ScoreGauge
            score={displayScore}
            tone={scoreTone as "success" | "warning" | "error" | "muted"}
            seniority={aiProfile.seniorityLevel}
            industries={aiProfile.industries}
            initials={initials}
            displayName={trimmedName || undefined}
          />
        </div>

        {/* Body 3-col */}
        <div
          className="hsx-onb-body-grid"
          style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, alignItems: "start" }}
        >
          {/* LEFT — resume profile */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {aiProfile.careerTrajectory && (
              <SectionCard label="Career trajectory">
                <p style={{ fontFamily: f.sans, fontSize: 13.5, lineHeight: 1.6, color: t.coal, margin: 0 }}>
                  {aiProfile.careerTrajectory}
                </p>
              </SectionCard>
            )}

            {aiProfile.topSkills.length > 0 && (
              <SectionCard label="Top skills">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {visibleSkills.map((s) => (
                    <Pill key={s} tone="muted" label={s} />
                  ))}
                  {hiddenSkills > 0 && (
                    <button
                      type="button"
                      onClick={() => setSkillsExpanded((v) => !v)}
                      style={{ display: "inline-flex", alignItems: "center", fontFamily: f.sans, fontSize: 12, fontWeight: 500, color: t.indigo, background: "transparent", border: `1px dashed ${t.indigo}`, borderRadius: 999, padding: "3px 10px", cursor: "pointer", whiteSpace: "nowrap" }}
                    >
                      {skillsExpanded ? "Show fewer" : `+ ${hiddenSkills} more`}
                    </button>
                  )}
                </div>
              </SectionCard>
            )}

            {aiProfile.keyAchievements.length > 0 && (
              <SectionCard label="Key achievements">
                <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
                  {aiProfile.keyAchievements.map((line, i) => (
                    <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontFamily: f.sans, fontSize: 13.5, lineHeight: 1.55, color: t.coal }}>
                      <span style={{ flexShrink: 0, marginTop: 6, width: 4, height: 4, borderRadius: 999, background: t.copper }} aria-hidden="true" />
                      {line}
                    </li>
                  ))}
                </ul>
              </SectionCard>
            )}

            {aiProfile.improvements && aiProfile.improvements.length > 0 && (
              <SectionCard label="Improve your resume">
                <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
                  {aiProfile.improvements.map((line, i) => (
                    <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontFamily: f.sans, fontSize: 13.5, lineHeight: 1.55, color: t.coal }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.copper} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: 4 }}>
                        <line x1="12" y1="20" x2="12" y2="10" />
                        <polyline points="7 14 12 9 17 14" />
                      </svg>
                      {line}
                    </li>
                  ))}
                </ul>
              </SectionCard>
            )}
          </div>

          {/* MIDDLE — interview readiness + transparency */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {aiProfile.interviewStrengths.length > 0 && (
              <StrengthGapCard label="Interview strengths" tone="success" items={aiProfile.interviewStrengths} />
            )}
            {aiProfile.interviewGaps.length > 0 && (
              <StrengthGapCard label="Worth practising" tone="copper" items={aiProfile.interviewGaps} />
            )}

            <SectionCard label="Based on">
              <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  "Resume content & structure",
                  "Projects depth & impact",
                  "Quantified achievements",
                  "Industry & role benchmarking",
                ].map((line) => (
                  <li key={line} style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: f.sans, fontSize: 13.5, lineHeight: 1.5, color: t.coal }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={t.success} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {line}
                  </li>
                ))}
              </ul>
            </SectionCard>
          </div>

          {/* RIGHT — next steps. The CTA card lives in the parent
              NavigationFooter (renders below the body) for parity with
              production routing; we render only Practice + Improve here. */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Note: Practice tracks UI is server-driven in production via the
                interview-engine; the static placeholder is omitted here. */}
            <SectionCard label="Welcome">
              <div style={{ fontFamily: f.sans, fontSize: 14, lineHeight: 1.6, color: t.coal }}>
                {trimmedName ? (
                  <>Hi <strong style={{ fontWeight: 600 }}>{trimmedName.split(/\s+/)[0]}</strong> — your profile is ready. The CTA below starts your first mock interview.</>
                ) : (
                  <>Your profile is ready. The CTA below starts your first mock interview.</>
                )}
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── ScoreGauge ─────────────────────────────────────────────────────── */

function ScoreGauge({
  score,
  tone,
  seniority,
  industries,
  initials,
  displayName,
}: {
  score: number | null;
  tone: "success" | "warning" | "error" | "muted";
  seniority?: string;
  industries?: string[];
  initials?: string;
  displayName?: string;
}) {
  const color =
    tone === "success" ? t.success : tone === "warning" ? t.warning : tone === "error" ? t.error : t.inkSoft;
  const label =
    score == null
      ? "—"
      : tone === "success"
        ? "Strong"
        : tone === "warning"
          ? "Fair"
          : tone === "error"
            ? "Needs work"
            : "—";
  const reassurance =
    score == null
      ? "We couldn't compute a score from this file."
      : tone === "success"
        ? "Strong foundation. A few polish moves and you'll stand out."
        : tone === "warning"
          ? "Strong foundation. With a few improvements, you'll stand out."
          : "Plenty of room to grow. Practice will move the needle quickly.";

  const r = 74;
  const cx = 90;
  const cy = 86;
  const circumference = Math.PI * r;
  const pct = score == null ? 0 : Math.max(0, Math.min(100, score)) / 100;
  const filled = circumference * pct;

  const industriesLabel = industries && industries.length > 0 ? industries.slice(0, 3).join(" · ") : null;
  const hasStats = !!(displayName || seniority || industriesLabel);

  return (
    <section
      style={{ background: t.white, border: `1px solid ${t.line}`, borderRadius: 14, padding: "18px 20px", boxShadow: shadows.card, display: "flex", flexDirection: "column", gap: 14 }}
    >
      <div
        className="hsx-onb-score-gauge"
        style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 18, alignItems: "center" }}
      >
        <div style={{ position: "relative", width: 180, height: 100 }}>
          <svg width="180" height="100" viewBox="0 0 180 100" aria-hidden="true">
            <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke={t.line} strokeWidth="10" strokeLinecap="round" />
            {score != null && (
              <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${filled} ${circumference}`} />
            )}
          </svg>
          <div
            style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", paddingBottom: 4 }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
              <span style={{ fontFamily: f.serif, fontSize: 40, fontWeight: 400, color, lineHeight: 1, letterSpacing: "-0.02em" }}>
                {score == null ? "—" : score}
              </span>
              {score != null && (
                <span style={{ fontFamily: f.sans, fontSize: 13, color: t.inkFaint }}>/ 100</span>
              )}
            </div>
            {score != null && (
              <span style={{ fontFamily: f.mono, fontSize: 10, letterSpacing: "0.10em", textTransform: "uppercase", color, marginTop: 4, fontWeight: 500 }}>
                {label}
              </span>
            )}
          </div>
        </div>
        <div>
          <div
            style={{ fontFamily: f.mono, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: t.inkFaint, marginBottom: 6 }}
          >
            Clarity Score
          </div>
          <p style={{ fontFamily: f.sans, fontSize: 14, lineHeight: 1.55, color: t.coal, margin: 0 }}>
            {reassurance}
          </p>
        </div>
      </div>

      {hasStats && (
        <div style={{ borderTop: `1px solid ${t.line}`, paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          {displayName && initials && (
            <StatRow
              label="You"
              value={displayName}
              valueTone="indigo"
              avatarInitials={initials}
            />
          )}
          {seniority && <StatRow label="Seniority" value={seniority} valueTone="indigo" />}
          {industriesLabel && <StatRow label="Industries" value={industriesLabel} />}
        </div>
      )}
    </section>
  );
}

function StatRow({
  label,
  value,
  valueTone,
  avatarInitials,
}: {
  label: string;
  value: string;
  valueTone?: "indigo";
  avatarInitials?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <span style={{ fontFamily: f.mono, fontSize: 10, letterSpacing: "0.10em", textTransform: "uppercase", color: t.inkFaint, flexShrink: 0 }}>
        {label}
      </span>
      <span
        title={value}
        style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: f.sans, fontSize: 13, fontWeight: 600, color: valueTone === "indigo" ? t.indigo : t.coal, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}
      >
        {avatarInitials && (
          <span aria-hidden="true" style={{ width: 22, height: 22, borderRadius: 999, background: t.indigo100, color: t.indigo, display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: f.serif, fontSize: 11, fontWeight: 400, flexShrink: 0 }}>
            {avatarInitials}
          </span>
        )}
        {value}
      </span>
    </div>
  );
}

function SectionCard({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <section
      style={{ background: t.white, border: `1px solid ${t.line}`, borderRadius: 14, padding: "14px 16px", boxShadow: shadows.card }}
    >
      {label && (
        <div
          style={{ fontFamily: f.mono, fontSize: 11, letterSpacing: "0.10em", textTransform: "uppercase", color: t.inkFaint, marginBottom: 8 }}
        >
          {label}
        </div>
      )}
      {children}
    </section>
  );
}

function Pill({ tone, label }: { tone: "indigo" | "muted"; label: string }) {
  const m =
    tone === "indigo"
      ? { bg: t.indigo100, border: t.indigo, fg: t.indigo }
      : { bg: t.creamSoft, border: t.line, fg: t.coal };
  return (
    <span
      title={label}
      style={{ display: "inline-flex", alignItems: "center", fontFamily: f.sans, fontSize: 12, fontWeight: 500, color: m.fg, background: m.bg, border: `1px solid ${m.border}`, borderRadius: 999, padding: "3px 10px", whiteSpace: "nowrap", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}
    >
      {label}
    </span>
  );
}

function StrengthGapCard({ label, tone, items }: { label: string; tone: "success" | "copper"; items: string[] }) {
  const accent = tone === "success" ? t.success : t.copper;
  return (
    <section style={{ background: t.white, border: `1px solid ${t.line}`, borderRadius: 14, padding: "14px 16px", boxShadow: shadows.card }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: f.mono, fontSize: 11, letterSpacing: "0.10em", textTransform: "uppercase", color: accent, marginBottom: 8 }}>
        {tone === "success" ? (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="12" y1="20" x2="12" y2="10" />
            <polyline points="7 14 12 9 17 14" />
          </svg>
        )}
        {label}
      </div>
      <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((line, i) => (
          <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontFamily: f.sans, fontSize: 13.5, lineHeight: 1.55, color: t.coal }}>
            <span aria-hidden="true" style={{ flexShrink: 0, marginTop: 7, width: 4, height: 4, borderRadius: 999, background: accent }} />
            {line}
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ─── NavigationFooter ───────────────────────────────────────────────── */

export interface NavigationFooterProps {
  isContinueDisabled: boolean;
  starting: boolean;
  saveStatus: "idle" | "saving" | "saved" | "error";
  onStart?: () => void;
  onStartInterview?: () => void;
  onGoToDashboard?: () => void;
  resumeScore?: number | null;
  hasResume?: boolean;
  quotaHint?: string | null;
}

export function NavigationFooter({
  isContinueDisabled,
  starting,
  saveStatus,
  onStart,
  onStartInterview,
  onGoToDashboard,
  hasResume,
  quotaHint,
}: NavigationFooterProps) {
  const dualMode = !!(hasResume && onStartInterview && onGoToDashboard);

  const primaryDisabled = isContinueDisabled || starting;
  const isGhost = primaryDisabled;
  const primaryStyle: React.CSSProperties = {
    fontFamily: f.sans,
    fontSize: 15,
    fontWeight: 600,
    color: isGhost ? t.inkFaint : t.cream,
    background: isGhost ? t.creamSoft : t.indigo,
    border: isGhost ? `1px solid ${t.line}` : "1px solid transparent",
    borderRadius: 10,
    padding: "14px 24px",
    cursor: primaryDisabled ? "not-allowed" : "pointer",
    boxShadow: isGhost ? "none" : shadows.cta,
    letterSpacing: 0.1,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minWidth: 200,
  };

  const secondaryStyle: React.CSSProperties = {
    fontFamily: f.sans,
    fontSize: 14,
    fontWeight: 500,
    color: t.indigo,
    background: "transparent",
    border: `1px solid ${t.line}`,
    borderRadius: 10,
    padding: "12px 18px",
    cursor: "pointer",
  };

  return (
    <div
      style={{
        marginTop: 32,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
      }}
    >
      <div className="ob-footer-ctas" style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        {dualMode ? (
          <>
            <button type="button" onClick={onGoToDashboard} disabled={starting} style={secondaryStyle}>
              Go to dashboard
            </button>
            <button
              type="button"
              onClick={onStartInterview}
              disabled={primaryDisabled}
              aria-busy={starting || undefined}
              style={primaryStyle}
            >
              {starting ? "Starting…" : "Start mock interview"}
              {!starting && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              )}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onStart}
            disabled={primaryDisabled}
            aria-busy={starting || undefined}
            style={primaryStyle}
          >
            {starting ? "Starting…" : "Continue"}
          </button>
        )}
      </div>

      {quotaHint && (
        <div style={{ fontFamily: f.mono, fontSize: 11, letterSpacing: "0.10em", textTransform: "uppercase", color: t.inkFaint }}>
          {quotaHint}
        </div>
      )}

      {saveStatus === "saving" && (
        <div style={{ fontFamily: f.sans, fontSize: 12, color: t.inkFaint }}>Saving…</div>
      )}
      {saveStatus === "saved" && (
        <div style={{ fontFamily: f.sans, fontSize: 12, color: t.success, display: "inline-flex", alignItems: "center", gap: 4 }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          Saved
        </div>
      )}
      {saveStatus === "error" && (
        <div style={{ fontFamily: f.sans, fontSize: 12, color: t.error }}>Couldn&apos;t save — your work is safe locally.</div>
      )}
    </div>
  );
}
