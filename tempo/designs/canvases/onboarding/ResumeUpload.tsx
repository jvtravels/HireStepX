/* HireStepX — Onboarding / Resume upload
   First-run screen after signup. Asks for the user's resume so the rest of
   the product (interviewer questions, role match, evaluation rubric) is
   personalised from question one.
   Discipline rule: Indigo is interactive · Copper is editorial · Never mix. */
import React, { useEffect, useRef, useState } from "react";
import { tokens as t, fonts as f, shadows } from "../design-system/_tokens";
import { Wordmark } from "../authentication/_auth-fields";
import { AUTH_STYLES } from "../authentication/_auth-styles";
import { OnboardingStepper } from "./_onboarding-shared";
import { ONBOARDING_STYLES } from "./_onboarding-styles";

export interface ResumeUploadProps {
  /** The user's first name — drives the personalised welcome line. */
  name?: string;
  /** Pre-supplied file (drives the "selected" state for canvas review). */
  initialFile?: { name: string; sizeKb: number };
  /** Maps to "uploading…" CTA + spinner. */
  uploading?: boolean;
  /** Server-side error banner (e.g. parsing failed, file too large). */
  error?: string | null;
}

const ACCEPTED_TYPES = ".pdf,.doc,.docx";
const MAX_FILE_MB = 10;

function formatSize(kb: number): string {
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`;
  return `${Math.round(kb)} KB`;
}

export default function ResumeUpload({
  name,
  initialFile,
  uploading = false,
  error = null,
}: ResumeUploadProps = {}) {
  const [file, setFile] = useState<{ name: string; sizeKb: number } | null>(
    initialFile ?? null,
  );
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // No-ops in canvas; production wiring would live in the page that hosts this.
  useEffect(() => {
    /* analytics: trackOnboarding({ type: "resume_upload_viewed" }) */
  }, []);

  const canContinue = !!file && !uploading;

  const pickFile = (f: File | null | undefined) => {
    if (!f) return;
    setFile({ name: f.name, sizeKb: Math.max(1, Math.round(f.size / 1024)) });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    pickFile(e.target.files?.[0]);
  };
  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragOver(false);
    pickFile(e.dataTransfer.files?.[0]);
  };

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
        {/* Top bar — Wordmark + step indicator. Skip lives on the right;
            the brand promise is "everything is optional," so a soft skip
            preserves trust. */}
        {/* 3-col grid topbar — Wordmark left, stepper centred, utilities right.
            Using grid (not flex) so the stepper is centered on the page,
            not pushed off-centre by uneven left/right cluster widths. */}
        <header
          className="hsx-login-topbar"
          style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", padding: "32px 48px", gap: 16 }}
        >
          <div style={{ justifySelf: "start" }}><Wordmark /></div>
          <div style={{ justifySelf: "center" }}>
            <OnboardingStepper current="upload" />
          </div>
          <div style={{ justifySelf: "end", display: "flex", alignItems: "center", gap: 16 }}>
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
          {/* Hero — same editorial pattern as auth: serif h1 with one-word
              copper italic accent. No period (matches the new auth voice). */}
          <div className="hsx-login-hero" style={{ width: "100%", textAlign: "center", marginBottom: 32 }}>
            <h1
              id="resume-heading"
              style={{ fontFamily: f.serif, fontSize: "clamp(2.5rem, 6vw, 4.5rem)", lineHeight: 1.05, fontWeight: 400, letterSpacing: "-0.02em", whiteSpace: "nowrap", margin: 0, color: t.coal }}
            >
              {name ? <>Hi {name}, drop your{" "}</> : <>Drop your{" "}</>}
              <em style={{ fontStyle: "italic", fontWeight: 400, color: t.copper }}>
                resume
              </em>
            </h1>
            <p
              className="hsx-login-subtitle"
              style={{ fontFamily: f.sans, fontSize: 16, lineHeight: 1.55, color: t.inkSoft, marginTop: 14, marginBottom: 0, textWrap: "balance" }}
            >
              We&apos;ll read it once and tune every interview to your role,
              experience, and the gaps worth working on.
            </p>
          </div>

          <div className="hsx-login-form" style={{ width: "100%", maxWidth: 540 }}>
            {error && (
              <div
                role="alert"
                id="resume-error"
                className="hsx-error-banner"
                style={{ background: t.error100, border: `1px solid ${t.error}`, borderRadius: 10, padding: "12px 14px", marginBottom: 16, fontFamily: f.sans, fontSize: 13, color: t.error, lineHeight: 1.4 }}
              >
                {error}
              </div>
            )}

            {/* Drop zone — clickable label wraps a visually-hidden file input.
                Large clickable area + obvious dashed boundary + iconography
                signals "drag here OR click to choose." */}
            <label
              htmlFor="resume-file-input"
              className="hsx-onb-drop"
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              style={{
                display: "block",
                width: "100%",
                padding: "40px 24px",
                border: `2px dashed ${dragOver ? t.indigo : (file ? t.success : t.lineStrong)}`,
                background: dragOver ? t.indigo100 : (file ? t.success100 : t.creamSoft),
                borderRadius: 14,
                cursor: "pointer",
                textAlign: "center",
                transition: "background 160ms ease, border-color 160ms ease",
              }}
            >
              <input
                ref={inputRef}
                id="resume-file-input"
                type="file"
                accept={ACCEPTED_TYPES}
                onChange={handleInputChange}
                style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 }}
                aria-describedby="resume-help"
              />

              {file ? (
                /* Selected state — green check tile + filename + replace link */
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                  <div
                    aria-hidden="true"
                    style={{ width: 56, height: 56, borderRadius: 14, background: "rgba(21,128,61,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={t.success} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontFamily: f.sans, fontSize: 15, fontWeight: 600, color: t.coal, lineHeight: 1.3 }}>
                      {file.name}
                    </div>
                    <div style={{ fontFamily: f.mono, fontSize: 12, color: t.inkSoft, marginTop: 4, letterSpacing: "0.04em" }}>
                      {formatSize(file.sizeKb)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); setFile(null); inputRef.current?.click(); }}
                    className="hsx-link-indigo"
                    style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 500, color: t.indigo, background: "transparent", border: "none", cursor: "pointer", padding: 0, textDecoration: "none" }}
                  >
                    Replace file
                  </button>
                </div>
              ) : (
                /* Empty state — copper upload icon + drag/click prompt */
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
                      Drag a file here, or{" "}
                      <span style={{ color: t.indigo }}>browse</span>
                    </div>
                    <div
                      id="resume-help"
                      style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, marginTop: 6 }}
                    >
                      PDF, DOC, or DOCX · up to {MAX_FILE_MB} MB
                    </div>
                  </div>
                </div>
              )}
            </label>

            {/* Primary CTA — ghost when no file selected (matches Login). */}
            {(() => {
              const isGhost = !canContinue && !uploading;
              const tooltip = isGhost ? "Add your resume to continue" : undefined;
              return (
                <button
                  type="button"
                  disabled={!canContinue}
                  aria-busy={uploading || undefined}
                  title={tooltip}
                  className="hsx-login-cta"
                  style={{
                    width: "100%",
                    fontFamily: f.sans,
                    fontSize: 15,
                    fontWeight: 600,
                    color: isGhost ? t.inkFaint : t.cream,
                    background: isGhost ? t.creamSoft : t.indigo,
                    border: isGhost ? `1px solid ${t.line}` : "1px solid transparent",
                    borderRadius: 10,
                    padding: "16px 18px",
                    cursor: canContinue ? "pointer" : "not-allowed",
                    marginTop: 18,
                    boxShadow: isGhost ? "none" : shadows.cta,
                    letterSpacing: 0.1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    opacity: uploading ? 0.95 : 1,
                  }}
                >
                  {uploading ? (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                        <path d="M21 12a9 9 0 1 1-6.2-8.55" opacity="0.4" />
                        <path d="M21 12a9 9 0 0 0-9-9" />
                      </svg>
                      Reading your resume…
                    </>
                  ) : (
                    <>
                      Continue
                      <svg
                        className="hsx-login-cta-arrow"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </>
                  )}
                </button>
              );
            })()}

            {/* Trust beat — calms the "what happens to my data" question */}
            <div
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 14, fontFamily: f.sans, fontSize: 13, color: t.inkSoft }}
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
