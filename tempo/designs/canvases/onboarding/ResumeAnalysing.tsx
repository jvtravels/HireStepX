/* HireStepX — Onboarding / Resume analysing
   Step 2 of 3. The user has just uploaded their resume; the AI is parsing
   it. Pure waiting state with no primary CTA in the happy path; on error
   we surface "Try again" + "Re-upload" so users aren't trapped here.

   In production, `initialStatus` + `initialProgress` should be driven from
   real server events (SSE / polling). The auto-cycle below is canvas-only
   pacing for review — it never runs when either prop is supplied.
   Discipline rule: Indigo is interactive · Copper is editorial · Never mix. */
import React, { useEffect, useState } from "react";
import { tokens as t, fonts as f, shadows } from "../design-system/_tokens";
import { Wordmark } from "../authentication/_auth-fields";
import { AUTH_STYLES } from "../authentication/_auth-styles";
import { OnboardingStepper } from "./_onboarding-shared";
import { ONBOARDING_STYLES } from "./_onboarding-styles";

export interface ResumeAnalysingProps {
  /** The filename being parsed — shown for confidence ("yes, my file") */
  fileName?: string;
  /** Override the live status string (canvas storyboard variants).
      Production: pass the latest server-event message here. */
  initialStatus?: string;
  /** Override the progress percent (0-100).
      Production: pass server-driven progress here. */
  initialProgress?: number;
  /** Server-side parse error. Renders the error surface with retry + re-upload
      so users aren't stuck on a hung loader. */
  error?: string | null;
}

const STATUS_BEATS = [
  "Reading your file…",
  "Extracting work history…",
  "Identifying skills and stack…",
  "Mapping role and seniority…",
  "Looking for patterns worth practising…",
];

export default function ResumeAnalysing({
  fileName = "Rahul_Sharma_Resume.pdf",
  initialStatus,
  initialProgress,
  error = null,
}: ResumeAnalysingProps = {}) {
  const [statusIdx, setStatusIdx] = useState(0);
  const [progress, setProgress] = useState(initialProgress ?? 8);
  const hasError = !!error;

  // Cycle status messages — canvas pacing only (skipped when overridden by
  // a server-driven `initialStatus` or when an error has occurred).
  useEffect(() => {
    if (initialStatus !== undefined || hasError) return;
    const id = setInterval(
      () => setStatusIdx((i) => Math.min(STATUS_BEATS.length - 1, i + 1)),
      2400,
    );
    return () => clearInterval(id);
  }, [initialStatus, hasError]);

  // Soft progress easing — also paused on error so the bar freezes where it
  // failed rather than racing onwards.
  useEffect(() => {
    if (initialProgress !== undefined || hasError) return;
    const id = setInterval(() => {
      setProgress((p) => (p < 90 ? p + (90 - p) * 0.06 : p));
    }, 220);
    return () => clearInterval(id);
  }, [initialProgress, hasError]);

  const liveStatus = initialStatus ?? STATUS_BEATS[statusIdx];

  return (
    <>
      <style>{AUTH_STYLES}{ONBOARDING_STYLES}</style>
      <div
        style={{
          background: t.cream,
          minHeight: "100dvh",
          fontFamily: f.sans,
          color: t.coal,
          position: "relative",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* 3-col grid topbar — Wordmark left, stepper centred, utilities right. */}
        <header
          className="hsx-login-topbar"
          style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", padding: "32px 48px", gap: 16 }}
        >
          <div style={{ justifySelf: "start" }}><Wordmark /></div>
          <div style={{ justifySelf: "center" }}>
            <OnboardingStepper current="analyse" />
          </div>
          <div style={{ justifySelf: "end" }}>
            <a
              href="#dashboard"
              className="hsx-link-indigo"
              style={{ fontFamily: f.sans, fontSize: 14, fontWeight: 500, color: t.indigo, textDecoration: "none" }}
            >
              Skip for now
            </a>
          </div>
        </header>

        <main
          className="hsx-login-main"
          style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "clamp(24px, 4vh, 64px) 24px" }}
        >
          <div className="hsx-login-hero" style={{ width: "100%", textAlign: "center", marginBottom: 32 }}>
            <h1
              id="analyse-heading"
              style={{ fontFamily: f.serif, fontSize: "clamp(2.5rem, 6vw, 4.5rem)", lineHeight: 1.05, fontWeight: 400, letterSpacing: "-0.02em", whiteSpace: "nowrap", margin: 0, color: t.coal }}
            >
              {hasError ? (
                <>
                  Couldn&apos;t read your{" "}
                  <em style={{ fontStyle: "italic", fontWeight: 400, color: t.copper }}>
                    resume
                  </em>
                </>
              ) : (
                <>
                  Reading your{" "}
                  <em style={{ fontStyle: "italic", fontWeight: 400, color: t.copper }}>
                    resume
                  </em>
                </>
              )}
            </h1>
            <p
              className="hsx-login-subtitle"
              style={{ fontFamily: f.sans, fontSize: 16, lineHeight: 1.55, color: t.inkSoft, marginTop: 14, marginBottom: 0, textWrap: "balance" }}
            >
              {hasError
                ? <>{error}</>
                : <>
                    Hang tight — usually takes 10–15 seconds.
                    <br />
                    We&apos;re tuning your practice to your role and experience.
                  </>}
            </p>
          </div>

          <div className="hsx-login-form" style={{ width: "100%", maxWidth: 540 }}>
            {/* File context — small chip so the user knows which file is
                being parsed. Copper paper-icon ties to the upload screen. */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 14px",
                border: `1px solid ${t.line}`,
                background: t.creamSoft,
                borderRadius: 10,
                marginBottom: 20,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.copper} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="8" y1="13" x2="16" y2="13" />
                <line x1="8" y1="17" x2="13" y2="17" />
              </svg>
              <span style={{ fontFamily: f.sans, fontSize: 14, fontWeight: 500, color: t.coal, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {fileName}
              </span>
              <span style={{ fontFamily: f.mono, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: hasError ? t.error : t.copper }}>
                {hasError ? "Failed" : "Analysing"}
              </span>
            </div>

            {hasError ? (
              /* Error surface — recovery CTAs, no progress bar. The user
                 isn't stuck: Try again retries the parse server-side; Re-upload
                 sends them back to step 1 with a fresh file. */
              <div role="alert" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => { /* production: re-trigger parse */ }}
                  className="hsx-login-cta"
                  style={{
                    width: "100%",
                    fontFamily: f.sans,
                    fontSize: 15,
                    fontWeight: 600,
                    color: t.cream,
                    background: t.indigo,
                    border: "1px solid transparent",
                    borderRadius: 10,
                    padding: "16px 18px",
                    cursor: "pointer",
                    boxShadow: shadows.cta,
                    letterSpacing: 0.1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="23 4 23 10 17 10" />
                    <polyline points="1 20 1 14 7 14" />
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                  </svg>
                  Try again
                </button>
                <a
                  href="#upload"
                  style={{
                    width: "100%",
                    fontFamily: f.sans,
                    fontSize: 15,
                    fontWeight: 500,
                    color: t.coal,
                    background: t.white,
                    border: `1px solid ${t.line}`,
                    borderRadius: 10,
                    padding: "14px 18px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    boxShadow: shadows.card,
                    textDecoration: "none",
                  }}
                >
                  Re-upload a different file
                </a>
                <a
                  href="#manual-entry"
                  className="hsx-link-indigo"
                  style={{
                    width: "100%",
                    fontFamily: f.sans,
                    fontSize: 13,
                    fontWeight: 500,
                    color: t.indigo,
                    textAlign: "center",
                    padding: "8px 14px",
                    textDecoration: "none",
                    marginTop: 2,
                  }}
                >
                  Or tell us about yourself instead
                </a>
              </div>
            ) : (
              <>
                {/* Indeterminate-feeling progress bar with soft easing.
                    Shimmer overlay communicates "still working" even when
                    progress is paused at 90%. */}
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

                {/* Live status line — aria-live polite so screen readers
                    announce changes. The keyed inner span re-mounts on each
                    cycle so the fade-up animation re-runs (instead of an
                    instant text swap). */}
                <p
                  aria-live="polite"
                  style={{ fontFamily: f.mono, fontSize: 12, letterSpacing: "0.06em", color: t.inkSoft, marginTop: 14, marginBottom: 0, textAlign: "center", minHeight: "1.2em" }}
                >
                  <span key={liveStatus} className="hsx-onb-status">
                    {liveStatus}
                  </span>
                </p>
              </>
            )}

            {/* Trust beat — same pattern as upload screen */}
            <div
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 28, fontFamily: f.sans, fontSize: 13, color: t.inkSoft }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.copper} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2 4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4z" />
                <polyline points="9 12 11 14 15 10" />
              </svg>
              Parsed once, never shared. You can delete it any time.
            </div>
          </div>
        </main>

        <footer
          className="hsx-login-footer"
          style={{ textAlign: "center", padding: "24px 24px 32px", fontFamily: f.sans, fontSize: 13, color: t.inkSoft, lineHeight: 1.6 }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.copper} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
              <path d="M21 19a2 2 0 0 1-2 2h-1v-6h3v4z" />
              <path d="M3 19a2 2 0 0 0 2 2h1v-6H3v4z" />
            </svg>
            Need help?{" "}
            <a href="#contact" className="hsx-link-indigo" style={{ color: t.indigo, fontWeight: 600, textDecoration: "none" }}>
              Contact support
            </a>
          </span>
        </footer>
      </div>
    </>
  );
}
