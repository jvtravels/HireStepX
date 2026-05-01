/* HireStepX — Onboarding / Resume review (AI result)
   Step 3 of 3. AI has parsed the resume; we show the full ResumeProfile
   the production app already produces (see src/dashboardData.ts) so the
   canvas is faithful to what users actually see today.

   Sections (in order):
     • Hero — headline + summary
     • Quick facts strip — seniority · years · industries · resume score
     • Top skills — chip cloud
     • Career trajectory — narrative paragraph
     • Key achievements — bulleted list
     • Strengths · Gaps — side-by-side columns (interview-prep angle)
     • Improvements — actionable list (only if present)
     • Practice tracks — toggleable, still derived locally for v1

   Discipline rule: Indigo is interactive · Copper is editorial · Never mix. */
import React, { useEffect, useRef, useState } from "react";
import { tokens as t, fonts as f, shadows } from "../design-system/_tokens";
import { Wordmark } from "../authentication/_auth-fields";
import { AUTH_STYLES } from "../authentication/_auth-styles";
import { OnboardingStepper } from "./_onboarding-shared";
import { ONBOARDING_STYLES } from "./_onboarding-styles";

/** Mirrors src/dashboardData.ts → ResumeProfile (the production shape).
    Keeping the field names identical means storyboards can be wired to
    real backend data without remapping. */
export interface ResumeProfile {
  headline: string;
  summary: string;
  yearsExperience: number | null;
  seniorityLevel: string;
  topSkills: string[];
  keyAchievements: string[];
  industries: string[];
  interviewStrengths: string[];
  interviewGaps: string[];
  careerTrajectory: string;
  resumeScore?: number;
  improvements?: string[];
}

export interface ResumeReviewProps {
  fileName?: string;
  /** Parsed from the resume (ParsedResume.name in production). Lives on a
      different shape than ResumeProfile, so it's a separate prop here. */
  userName?: string;
  profile?: ResumeProfile;
  /** AI flagged a low-confidence parse — show a soft warning above. */
  lowConfidence?: boolean;
  /** Parser couldn't extract anything usable — short-circuits to a manual-
      entry fallback CTA instead of the result card. */
  parseFailed?: boolean;
  /** Practice tracks for the user to opt in/out of before practising. */
  suggestedTracks?: string[];
}

const DEFAULT_PROFILE: ResumeProfile = {
  headline: "Backend Engineer with 4+ years scaling fintech APIs",
  summary:
    "Mid-career backend engineer with deep Python/Django + Postgres chops, " +
    "shipped at Razorpay and Swiggy. Strong on system design at small scale; " +
    "less battle-tested on cross-functional product calls. Aiming for senior " +
    "backend roles at consumer fintech / B2B SaaS.",
  yearsExperience: 4,
  seniorityLevel: "Mid",
  topSkills: [
    "Python",
    "PostgreSQL",
    "Django",
    "AWS",
    "Redis",
    "Docker",
    "REST APIs",
    "Kafka",
  ],
  keyAchievements: [
    "Cut p99 latency on the payouts API from 1.2s → 280ms by adding a Redis-backed read-through cache.",
    "Led the Postgres → CockroachDB migration for the wallet ledger; zero downtime, 11M+ rows.",
    "Mentored 2 junior engineers through their first on-call rotation.",
  ],
  industries: ["Fintech", "Food delivery", "B2B SaaS"],
  interviewStrengths: [
    "Concrete metrics on every project (latency, scale, $$ saved)",
    "Comfortable with system-design tradeoffs at the database layer",
    "Strong narrative arc on tenure — promotions show progression",
  ],
  interviewGaps: [
    "Behavioural answers tend to skip the conflict / disagreement beat",
    "Limited frontend exposure — vulnerable to full-stack curveballs",
    "Hasn't articulated leadership stories at scale (>3 people)",
  ],
  careerTrajectory:
    "Started at Freshworks as an SDE-1 on the support backend. Moved to Swiggy " +
    "after 18 months — promoted from SDE-2 to SDE-3 in the dispatch team within a " +
    "year. Now at Razorpay on the payouts platform team. Trajectory is consistent " +
    "with a senior IC track; first lead role likely 18-24 months out.",
  resumeScore: 78,
  improvements: [
    "Quantify the CockroachDB migration outcome (cost? reliability uptime?).",
    "Add a one-line summary of the team size + business impact at the top.",
    "Replace the generic 'Skills' list with a tiered breakdown (expert / working).",
  ],
};

const DEFAULT_TRACKS = [
  "Backend system design",
  "SQL performance",
  "Behavioural · ownership stories",
];

export default function ResumeReview({
  fileName = "Rahul_Sharma_Resume.pdf",
  userName = "Rahul Sharma",
  profile = DEFAULT_PROFILE,
  lowConfidence = false,
  parseFailed = false,
  suggestedTracks = DEFAULT_TRACKS,
}: ResumeReviewProps = {}) {
  const [selectedTracks, setSelectedTracks] = useState<Set<string>>(
    () => new Set(suggestedTracks),
  );
  // Re-sync if the parent passes a new suggestedTracks list after mount
  // (server round-trip update). Without this the Set stays at the mount-time
  // snapshot.
  useEffect(() => {
    setSelectedTracks(new Set(suggestedTracks));
  }, [suggestedTracks]);

  const toggleTrack = (track: string) => {
    setSelectedTracks((prev) => {
      const next = new Set(prev);
      if (next.has(track)) next.delete(track);
      else next.add(track);
      return next;
    });
  };

  // "+ N more" disclosure for densely-packed lists. Skills cap at 8 visible
  // (most resumes don't surface more) so the card has real presence;
  // practice tracks cap at 3 visible.
  const SKILLS_VISIBLE = 8;
  const TRACKS_VISIBLE = 3;
  const [skillsExpanded, setSkillsExpanded] = useState(false);
  const [tracksExpanded, setTracksExpanded] = useState(false);
  const visibleSkills = skillsExpanded ? profile.topSkills : profile.topSkills.slice(0, SKILLS_VISIBLE);
  const hiddenSkills = Math.max(0, profile.topSkills.length - SKILLS_VISIBLE);
  const visibleTracks = tracksExpanded ? suggestedTracks : suggestedTracks.slice(0, TRACKS_VISIBLE);
  const hiddenTracks = Math.max(0, suggestedTracks.length - TRACKS_VISIBLE);

  // Resume-score count-up — eases 0 → score over ~700ms on mount. Both the
  // numeral and the arc bind to `displayScore`, so they stay in lockstep
  // (no extra CSS transition on the arc — that would lag the rAF updates).
  // Skipped entirely when the user prefers reduced motion.
  const targetScore = profile.resumeScore;
  const [displayScore, setDisplayScore] = useState(targetScore == null ? null : 0);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (targetScore == null) {
      setDisplayScore(null);
      return;
    }
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
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

  const score = profile.resumeScore;
  const scoreTone =
    score == null
      ? "muted"
      : score >= 80
        ? "success"
        : score >= 60
          ? "warning"
          : "error";

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
            <OnboardingStepper current="review" />
          </div>
          <div style={{ justifySelf: "end", display: "flex", alignItems: "center", gap: 14 }}>
            {/* Identity chip — moved out of the hero card so it sits where
                users expect their account in any web app (top-right). */}
            {!parseFailed && userName && userName.trim() && (() => {
              const trimmed = userName.trim();
              const initials = trimmed
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((p) => p[0]?.toUpperCase())
                .join("");
              return (
                <div
                  style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: f.sans, fontSize: 14, fontWeight: 500, color: t.coal }}
                  title={trimmed}
                >
                  <span
                    aria-hidden="true"
                    className="hsx-onb-avatar"
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
                      fontWeight: 400,
                      flexShrink: 0,
                    }}
                  >
                    {initials || (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    )}
                  </span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>
                    {trimmed}
                  </span>
                </div>
              );
            })()}
            {!parseFailed && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {/* Re-analyse — re-runs the AI parse on the same file. */}
                <button
                  type="button"
                  aria-label="Re-analyse resume"
                  title="Re-analyse"
                  style={{
                    width: 34,
                    height: 34,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: t.white,
                    border: `1px solid ${t.line}`,
                    borderRadius: 8,
                    cursor: "pointer",
                    color: t.coal,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="23 4 23 10 17 10" />
                    <polyline points="1 20 1 14 7 14" />
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                  </svg>
                </button>
                {/* Download — exports the assessment as a PDF. */}
                <button
                  type="button"
                  aria-label="Download assessment"
                  title="Download"
                  style={{
                    width: 34,
                    height: 34,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: t.white,
                    border: `1px solid ${t.line}`,
                    borderRadius: 8,
                    cursor: "pointer",
                    color: t.coal,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </button>
              </div>
            )}
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
          style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: "clamp(24px, 4vh, 64px) 24px" }}
        >
          {/* Centered hero only renders for the parse-failed surface — the
              happy path embeds the heading inside the hero card to free
              vertical space. */}
          {parseFailed && (
            <div className="hsx-login-hero" style={{ width: "100%", textAlign: "center", marginBottom: 28 }}>
              <h1
                id="review-heading"
                style={{ fontFamily: f.serif, fontSize: "clamp(2.5rem, 6vw, 4.5rem)", lineHeight: 1.05, fontWeight: 400, letterSpacing: "-0.02em", whiteSpace: "nowrap", margin: 0, color: t.coal }}
              >
                Let&apos;s do this{" "}
                <em style={{ fontStyle: "italic", fontWeight: 400, color: t.copper }}>
                  manually
                </em>
              </h1>
              <p
                className="hsx-login-subtitle"
                style={{ fontFamily: f.sans, fontSize: 16, lineHeight: 1.55, color: t.inkSoft, marginTop: 14, marginBottom: 0, textWrap: "balance" }}
              >
                We couldn&apos;t pull enough from your file (often a scan or unusual layout). Tell us a few details and we&apos;ll tune your practice from there.
              </p>
            </div>
          )}

          <div className="hsx-onb-stack" style={{ width: "100%", maxWidth: parseFailed ? 540 : 1200 }}>
            {parseFailed ? (
              /* ── Manual-entry fallback ─────────────────────────────── */
              <>
                <FilePill fileName={fileName} />
                <a
                  href="#manual-entry"
                  className="hsx-login-cta"
                  style={ctaStyle}
                >
                  Tell us about yourself
                  <CtaArrow />
                </a>
                <TrustBeat>Takes about a minute. You can refine later.</TrustBeat>
              </>
            ) : (
              <>
                {lowConfidence && (
                  <div
                    role="alert"
                    style={{ background: t.warning100, border: `1px solid ${t.warning}`, borderRadius: 10, padding: "12px 14px", marginBottom: 16, fontFamily: f.sans, fontSize: 13, color: t.warning, lineHeight: 1.4 }}
                  >
                    <strong style={{ fontWeight: 600 }}>We&apos;re not fully sure about a few fields.</strong>
                    <br />
                    Worth double-checking before we tune your practice.
                  </div>
                )}

                {/* ── Hero row — identity (spans 2 of 3 cols) + score gauge
                    (1 col). Uses the same 3-col rail as the body and bottom
                    rows so all card edges align vertically. */}
                <div
                  className="hsx-onb-hero-row"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr",
                    gap: 16,
                    alignItems: "start",
                  }}
                >
                  <section
                    style={{
                      background: t.white,
                      border: `1px solid ${t.line}`,
                      borderRadius: 14,
                      padding: "18px 20px",
                      boxShadow: shadows.card,
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    {/* AI analysis complete pill — top of card */}
                    <div
                      role="status"
                      style={{
                        alignSelf: "flex-start",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "5px 11px",
                        borderRadius: 999,
                        background: t.success100,
                        border: `1px solid rgba(21, 128, 61, 0.25)`,
                        fontFamily: f.mono,
                        fontSize: 11,
                        letterSpacing: "0.10em",
                        textTransform: "uppercase",
                        color: t.success,
                        fontWeight: 500,
                        marginBottom: 14,
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      AI analysis complete
                    </div>

                    {/* Identity moved to topbar (top-right) where users expect
                        the account chip. The hero card now leads straight from
                        the success pill into the role headline. */}

                    {/* Page H1 — role headline at display size */}
                    <h1
                      id="review-heading"
                      style={{ fontFamily: f.serif, fontSize: "clamp(1.75rem, 3.2vw, 2.25rem)", lineHeight: 1.15, fontWeight: 400, color: t.coal, letterSpacing: "-0.01em", margin: 0, marginBottom: 12 }}
                    >
                      {profile.headline}
                    </h1>

                    {/* Role pills moved into the score-gauge stats card to
                        give the right column real density. The left card now
                        flows: pill → identity → H1 → summary → source. */}

                    {profile.summary && (
                      <p style={{ fontFamily: f.sans, fontSize: 14.5, lineHeight: 1.6, color: t.inkSoft, margin: 0, marginBottom: 16, flex: 1 }}>
                        {profile.summary}
                      </p>
                    )}

                    {/* Source file footer — replaces the separate FilePill row */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        paddingTop: 12,
                        borderTop: `1px solid ${t.line}`,
                        fontFamily: f.sans,
                        fontSize: 13,
                        color: t.inkSoft,
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.copper} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        Source: {fileName}
                      </span>
                      <a
                        href="#upload"
                        className="hsx-link-indigo"
                        style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 500, color: t.indigo, textDecoration: "none" }}
                      >
                        Re-upload
                      </a>
                    </div>
                  </section>

                  {/* Score gauge + key facts (single tall card) */}
                  <ScoreGauge
                    score={displayScore}
                    tone={score == null ? "muted" : scoreTone}
                    seniority={profile.seniorityLevel}
                    industries={profile.industries}
                  />
                </div>{/* /hero-row */}

                {/* ── Body — 3-col split, three reading lanes:
                    LEFT (Resume profile): Career trajectory + Top skills + Key achievements
                    MIDDLE (Interview readiness): Strengths + Worth practising
                    RIGHT (Next steps): Practice tracks + Improve your resume
                    Collapses to 1-col on < 900px via .hsx-onb-body-grid rule. */}
                <div
                  className="hsx-onb-body-grid"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 16,
                    alignItems: "start",
                  }}
                >
                  {/* LEFT column — Resume profile */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {profile.careerTrajectory && (
                      <SectionCard label="Career trajectory">
                        {/* Split on the first sentence boundary that contains
                            "Now ", "Trajectory ", or "Currently ". Falls back
                            to a single block when the AI returns short prose. */}
                        {(() => {
                          const text = profile.careerTrajectory;
                          const splitMatch = text.match(/(.+?\.\s)((?:Now\b|Trajectory\b|Currently\b|First lead\b)[\s\S]*)/);
                          if (splitMatch) {
                            return (
                              <>
                                <p style={{ fontFamily: f.sans, fontSize: 13.5, lineHeight: 1.6, color: t.coal, margin: 0, marginBottom: 10 }}>
                                  {splitMatch[1].trim()}
                                </p>
                                <p style={{ fontFamily: f.sans, fontSize: 13.5, lineHeight: 1.6, color: t.coal, margin: 0 }}>
                                  {splitMatch[2].trim()}
                                </p>
                              </>
                            );
                          }
                          return (
                            <p style={{ fontFamily: f.sans, fontSize: 13.5, lineHeight: 1.6, color: t.coal, margin: 0 }}>
                              {text}
                            </p>
                          );
                        })()}
                      </SectionCard>
                    )}

                    {profile.topSkills.length > 0 && (
                      <SectionCard label="Top skills">
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {visibleSkills.map((s) => (
                            <Pill key={s} tone="muted" label={s} />
                          ))}
                          {hiddenSkills > 0 && (
                            <button
                              type="button"
                              onClick={() => setSkillsExpanded((v) => !v)}
                              className="hsx-link-indigo"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                fontFamily: f.sans,
                                fontSize: 12,
                                fontWeight: 500,
                                color: t.indigo,
                                background: "transparent",
                                border: `1px dashed ${t.indigo}`,
                                borderRadius: 999,
                                padding: "3px 10px",
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {skillsExpanded ? "Show fewer" : `+ ${hiddenSkills} more`}
                            </button>
                          )}
                        </div>
                      </SectionCard>
                    )}

                    {profile.keyAchievements.length > 0 && (
                      <SectionCard label="Key achievements">
                        <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
                          {profile.keyAchievements.map((line, i) => (
                            <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontFamily: f.sans, fontSize: 13.5, lineHeight: 1.55, color: t.coal }}>
                              <span style={{ flexShrink: 0, marginTop: 6, width: 4, height: 4, borderRadius: 999, background: t.copper }} aria-hidden="true" />
                              {line}
                            </li>
                          ))}
                        </ul>
                      </SectionCard>
                    )}

                    {/* Improve your resume — moved into the LEFT (resume-profile)
                        lane so it sits next to the achievements it commentates
                        on, and to balance column heights. */}
                    {profile.improvements && profile.improvements.length > 0 && (
                      <SectionCard label="Improve your resume">
                        <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
                          {profile.improvements.map((line, i) => (
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

                  {/* MIDDLE column — Interview readiness + transparency */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {profile.interviewStrengths.length > 0 && (
                      <StrengthGapCard
                        label="Interview strengths"
                        tone="success"
                        items={profile.interviewStrengths}
                      />
                    )}
                    {profile.interviewGaps.length > 0 && (
                      <StrengthGapCard
                        label="Worth practising"
                        tone="copper"
                        items={profile.interviewGaps}
                      />
                    )}

                    {/* Based On — folded into the middle column to balance
                        column heights across the body grid. Stack the items
                        as a 1-col list since this column is narrower. */}
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
                      <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${t.line}` }}>
                        <a
                          href="#edit-profile"
                          className="hsx-link-indigo"
                          style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 500, color: t.indigo, textDecoration: "none" }}
                        >
                          Something off? Edit details
                        </a>
                      </div>
                    </SectionCard>
                  </div>

                  {/* RIGHT column — Next steps */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {/* Practice tracks (toggleable) */}
                    <SectionCard label="Practice tracks">
                  <div role="group" aria-label="Practice tracks" style={{ display: "flex", flexDirection: "column", gap: 2, width: "100%" }}>
                    {visibleTracks.map((track) => {
                      const checked = selectedTracks.has(track);
                      return (
                        <button
                          key={track}
                          type="button"
                          onClick={() => toggleTrack(track)}
                          aria-pressed={checked}
                          className="hsx-onb-track"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            fontFamily: f.sans,
                            fontSize: 14,
                            color: checked ? t.coal : t.inkSoft,
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            textAlign: "left",
                            width: "100%",
                          }}
                        >
                          <span
                            aria-hidden="true"
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: 5,
                              border: `1.5px solid ${checked ? t.indigo : t.lineStrong}`,
                              background: checked ? t.indigo : t.white,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            {checked && (
                              <svg className="hsx-onb-check" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </span>
                          {track}
                        </button>
                      );
                    })}
                  </div>
                  {hiddenTracks > 0 && (
                    <button
                      type="button"
                      onClick={() => setTracksExpanded((v) => !v)}
                      className="hsx-link-indigo"
                      style={{
                        background: "transparent",
                        border: "none",
                        padding: "6px 0 0",
                        marginTop: 4,
                        fontFamily: f.sans,
                        fontSize: 13,
                        fontWeight: 500,
                        color: t.indigo,
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      {tracksExpanded ? "Show fewer" : `Show ${hiddenTracks} more track${hiddenTracks === 1 ? "" : "s"}`}
                    </button>
                  )}
                  {/* Live count for screen readers + a soft visual nudge so
                      users know how their toggles map to practice scope. */}
                  <p
                    aria-live="polite"
                    style={{ fontFamily: f.mono, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: t.inkFaint, marginTop: 12, marginBottom: 0 }}
                  >
                    {selectedTracks.size} of {suggestedTracks.length} selected
                  </p>
                </SectionCard>

                    {/* "Ready to improve?" CTA card — folded into the right
                        column so the body grid's three columns end at roughly
                        the same height. CTA stays anchored to the right rail. */}
                    <section
                      style={{
                        background: t.indigo,
                        border: `1px solid ${t.indigo}`,
                        borderRadius: 14,
                        padding: "18px 20px",
                        boxShadow: shadows.cta,
                        color: t.cream,
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                      }}
                    >
                      <div
                        style={{
                          fontFamily: f.serif,
                          fontSize: 24,
                          fontWeight: 400,
                          lineHeight: 1.15,
                          letterSpacing: "-0.01em",
                        }}
                      >
                        Ready to{" "}
                        <em style={{ fontStyle: "italic", color: t.copper100 }}>
                          improve?
                        </em>
                      </div>
                      <p
                        style={{
                          fontFamily: f.sans,
                          fontSize: 13.5,
                          lineHeight: 1.55,
                          color: "rgba(250, 247, 240, 0.78)",
                          margin: 0,
                        }}
                      >
                        Personalised interview plan with role-specific questions and AI feedback.
                      </p>
                      <a
                        href="#start-interview"
                        className="hsx-login-cta"
                        style={{
                          width: "100%",
                          fontFamily: f.sans,
                          fontSize: 15,
                          fontWeight: 600,
                          color: t.indigo,
                          background: t.cream,
                          border: "1px solid transparent",
                          borderRadius: 10,
                          padding: "14px 18px",
                          cursor: "pointer",
                          letterSpacing: 0.1,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 10,
                          textDecoration: "none",
                          marginTop: 4,
                        }}
                      >
                        Start mock interview
                        <CtaArrow />
                      </a>
                      <ul
                        style={{
                          listStyle: "none",
                          margin: 0,
                          marginTop: 2,
                          padding: 0,
                          display: "flex",
                          flexWrap: "wrap",
                          justifyContent: "center",
                          alignItems: "center",
                          gap: 10,
                          fontFamily: f.mono,
                          fontSize: 10,
                          letterSpacing: "0.10em",
                          textTransform: "uppercase",
                          color: "rgba(250, 247, 240, 0.65)",
                        }}
                      >
                        {/* Compact text-only strip — icons dropped for visual
                            consistency. Dot separators carry the rhythm. */}
                        <li>~25 min</li>
                        <li aria-hidden="true" style={{ width: 2, height: 2, borderRadius: 999, background: "rgba(250,247,240,0.35)" }} />
                        <li>10 questions</li>
                        <li aria-hidden="true" style={{ width: 2, height: 2, borderRadius: 999, background: "rgba(250,247,240,0.35)" }} />
                        <li>Pause anytime</li>
                      </ul>
                    </section>
                  </div>{/* /right col */}
                </div>{/* /body-grid */}

                <TrustBeat>Parsed once, never shared. You can delete it any time.</TrustBeat>
              </>
            )}
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

/* ── Local atoms ──────────────────────────────────────────────────────── */

const ctaStyle: React.CSSProperties = {
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
  marginTop: 22,
  boxShadow: shadows.cta,
  letterSpacing: 0.1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  textDecoration: "none",
};

function CtaArrow() {
  return (
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
  );
}

function TrustBeat({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 14, fontFamily: f.sans, fontSize: 13, color: t.inkSoft }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.copper} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2 4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4z" />
        <polyline points="9 12 11 14 15 10" />
      </svg>
      {children}
    </div>
  );
}

function FilePill({ fileName }: { fileName: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        border: `1px solid ${t.line}`,
        background: t.creamSoft,
        borderRadius: 10,
        marginBottom: 16,
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
      <a
        href="#upload"
        className="hsx-link-indigo"
        style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 500, color: t.indigo, textDecoration: "none" }}
      >
        Re-upload
      </a>
    </div>
  );
}

/** A boxed section with optional mono-caps label. White surface + soft shadow,
    sits on the cream page. */
function SectionCard({
  label,
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        background: t.white,
        border: `1px solid ${t.line}`,
        borderRadius: 14,
        padding: "14px 16px",
        boxShadow: shadows.card,
      }}
    >
      {label && (
        <div
          style={{
            fontFamily: f.mono,
            fontSize: 11,
            letterSpacing: "0.10em",
            textTransform: "uppercase",
            color: t.inkFaint,
            marginBottom: 8,
          }}
        >
          {label}
        </div>
      )}
      {children}
    </section>
  );
}

/** Hero-sized score gauge with stat list beneath. Single tall card on the
    right of the hero row — the arc + reassurance up top, key quantitative
    facts (seniority / experience / industries) underneath, so the right
    column carries real density instead of a stretched void. */
function ScoreGauge({
  score,
  tone,
  seniority,
  industries,
}: {
  score: number | null;
  tone: "success" | "warning" | "error" | "muted";
  seniority?: string;
  industries?: string[];
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
  // Tone-aware reassurance copy. Strikes the same warm, second-person
  // tone the auth flow uses ("Off to practise" etc.).
  const reassurance =
    score == null
      ? "We couldn't compute a score from this file. Try a different upload."
      : tone === "success"
        ? "You've got a strong foundation. A few polish moves and you'll stand out."
        : tone === "warning"
          ? "You've got a strong foundation. With a few improvements, you'll stand out."
          : "Plenty of room to grow. Practice will move the needle quickly.";

  // Arc geometry — 180° semicircle. r=74 gives a viewBox-friendly footprint.
  const r = 74;
  const cx = 90;
  const cy = 86;
  const circumference = Math.PI * r;
  const pct = score == null ? 0 : Math.max(0, Math.min(100, score)) / 100;
  const filled = circumference * pct;

  // Note: yearsExperience intentionally omitted from the stat rows below —
  // the page H1 ("Backend Engineer with 4+ years…") already states years,
  // so a duplicate row is dead weight.
  const industriesLabel = industries && industries.length > 0 ? industries.slice(0, 3).join(" · ") : null;
  const hasStats = !!(seniority || industriesLabel);

  return (
    <section
      style={{
        background: t.white,
        border: `1px solid ${t.line}`,
        borderRadius: 14,
        padding: "18px 20px",
        boxShadow: shadows.card,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div
        className="hsx-onb-score-gauge"
        style={{
          display: "grid",
          gridTemplateColumns: "180px 1fr",
          gap: 18,
          alignItems: "center",
        }}
      >
      <div style={{ position: "relative", width: 180, height: 100 }}>
        <svg width="180" height="100" viewBox="0 0 180 100" aria-hidden="true">
          {/* Track */}
          <path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            fill="none"
            stroke={t.line}
            strokeWidth="10"
            strokeLinecap="round"
          />
          {/* Filled arc */}
          {score != null && (
            <path
              d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
              fill="none"
              stroke={color}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${filled} ${circumference}`}
            />
          )}
        </svg>
        {/* Centered score numeral inside the arc */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-end",
            paddingBottom: 4,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
            <span
              style={{
                fontFamily: f.serif,
                fontSize: 40,
                fontWeight: 400,
                color,
                lineHeight: 1,
                letterSpacing: "-0.02em",
              }}
            >
              {score == null ? "—" : score}
            </span>
            {score != null && (
              <span style={{ fontFamily: f.sans, fontSize: 13, color: t.inkFaint }}>/ 100</span>
            )}
          </div>
          {score != null && (
            <span
              style={{
                fontFamily: f.mono,
                fontSize: 10,
                letterSpacing: "0.10em",
                textTransform: "uppercase",
                color,
                marginTop: 4,
                fontWeight: 500,
              }}
            >
              {label}
            </span>
          )}
        </div>
      </div>
      <div>
        <div
          style={{
            fontFamily: f.mono,
            fontSize: 11,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: t.inkFaint,
            marginBottom: 6,
          }}
        >
          Clarity Score
        </div>
        <p style={{ fontFamily: f.sans, fontSize: 14, lineHeight: 1.55, color: t.coal, margin: 0 }}>
          {reassurance}
        </p>
      </div>
      </div>{/* /score-gauge inner grid */}

      {/* Stat rows below the gauge — divider + key facts. Mirrors the layout
          of a stat strip while keeping everything in one card. */}
      {hasStats && (
        <div style={{ borderTop: `1px solid ${t.line}`, paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          {seniority && (
            <StatRow label="Seniority" value={seniority} valueTone="indigo" />
          )}
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
}: {
  label: string;
  value: string;
  valueTone?: "indigo";
}) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
      <span style={{ fontFamily: f.mono, fontSize: 10, letterSpacing: "0.10em", textTransform: "uppercase", color: t.inkFaint, flexShrink: 0 }}>
        {label}
      </span>
      <span
        title={value}
        style={{
          fontFamily: f.sans,
          fontSize: 13,
          fontWeight: 600,
          color: valueTone === "indigo" ? t.indigo : t.coal,
          textAlign: "right",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          minWidth: 0,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function Pill({ tone, label }: { tone: "indigo" | "muted"; label: string }) {
  const colorMap =
    tone === "indigo"
      ? { bg: t.indigo100, border: t.indigo, fg: t.indigo }
      : { bg: t.creamSoft, border: t.line, fg: t.coal };
  return (
    <span
      title={label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontFamily: f.sans,
        fontSize: 12,
        fontWeight: 500,
        color: colorMap.fg,
        background: colorMap.bg,
        border: `1px solid ${colorMap.border}`,
        borderRadius: 999,
        padding: "3px 10px",
        whiteSpace: "nowrap",
        maxWidth: 200,
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
    >
      {label}
    </span>
  );
}

function StrengthGapCard({
  label,
  tone,
  items,
}: {
  label: string;
  tone: "success" | "copper";
  items: string[];
}) {
  const accent = tone === "success" ? t.success : t.copper;
  return (
    <section
      style={{
        background: t.white,
        border: `1px solid ${t.line}`,
        borderRadius: 14,
        padding: "14px 16px",
        boxShadow: shadows.card,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontFamily: f.mono,
          fontSize: 11,
          letterSpacing: "0.10em",
          textTransform: "uppercase",
          color: accent,
          marginBottom: 8,
        }}
      >
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
          <li
            key={i}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              fontFamily: f.sans,
              fontSize: 13.5,
              lineHeight: 1.55,
              color: t.coal,
            }}
          >
            <span
              aria-hidden="true"
              style={{ flexShrink: 0, marginTop: 7, width: 4, height: 4, borderRadius: 999, background: accent }}
            />
            {line}
          </li>
        ))}
      </ul>
    </section>
  );
}
