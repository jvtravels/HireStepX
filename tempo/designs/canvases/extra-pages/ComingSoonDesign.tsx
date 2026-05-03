/* ─────────────────────────────────────────────────────────────────────────
   Coming Soon — editorial-brand design exploration (canvas-only)

   This file is NOT wired into production (`src/ComingSoon.tsx` is the
   shipped surface). It's a Tempo-canvas redesign of the pre-launch page
   on the cream / indigo / copper editorial system that powers auth,
   onboarding, the interview, and SessionSetup.

   Brand discipline (preserved from auth/_tokens):
   ─ Indigo is interactive · Copper is editorial · Never mix.

   Sections (top-down):
   1. Topbar — wordmark · LinkedIn link with icon
   2. Editorial hero — H1 ("Practice the skill. Land the offer.")
        + India-first AI-coach wedge chip
   3. Subtitle (mode-agnostic — voice now, video later)
   4. Live counter pill (avatar stack + real waitlist count) →
        contextual placement just above the form
   5. Email capture + spam-promise + aria-live status region
   6. Three tease cards — editorial hints at the experience
   7. Footnote band — Made in Mumbai · ₹ INR · privacy
   ─────────────────────────────────────────────────────────────────────── */

import React from "react";
import { tokens as T, fonts as F, shadows } from "../design-system/_tokens";
import { Wordmark } from "../authentication/_auth-fields";
import { AUTH_STYLES } from "../authentication/_auth-styles";

interface ComingSoonDesignProps {
  /** Compact / mobile preview width. */
  compact?: boolean;
  /** Real waitlist count — small badge above the form. Pre-launch
   *  social proof grows organically as people sign up; never fabricate. */
  waitlistCount?: number;
}

export default function ComingSoonDesign({
  compact = false,
  waitlistCount = 47,
}: ComingSoonDesignProps = {}) {
  return (
    <>
      <style>{AUTH_STYLES}</style>
      <style>{`
        @keyframes csLivePulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(21,128,61,0.45); }
          50% { box-shadow: 0 0 0 4px rgba(21,128,61,0); }
        }
        @keyframes csAccentIn {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .cs-hero h1 em { animation: csAccentIn 700ms 180ms cubic-bezier(.2,.7,.2,1) both; }
        .cs-status-dot { animation: csLivePulse 1.8s ease-in-out infinite; }
        .cs-input-wrap:focus-within {
          border-color: ${T.indigo} !important;
          box-shadow: 0 0 0 3px ${T.indigoRing};
        }
        .cs-cta {
          transition: transform 160ms ease, box-shadow 160ms ease, background 160ms ease;
        }
        .cs-cta:hover {
          transform: translateY(-1px);
          background: ${T.indigoDeep};
          box-shadow: 0 4px 12px -2px rgba(20,17,10,.18), 0 18px 36px -12px rgba(49,46,129,0.5);
        }
        .cs-feature-tile {
          transition: transform 220ms cubic-bezier(.2,.7,.2,1), box-shadow 220ms ease;
        }
        .cs-feature-tile:hover {
          transform: translateY(-3px);
          box-shadow: 0 1px 0 rgba(20,17,10,.04), 0 1px 2px rgba(20,17,10,.06), 0 24px 48px -22px rgba(20,17,10,.16);
        }
        /* ─── A11y: focus-visible rings on every interactive surface ──
           Default browser focus ring is inconsistent on the editorial
           cream surface — sometimes invisible. Custom indigo halo,
           matches the rest of the editorial system. */
        .cs-cta:focus-visible,
        .cs-footer-link:focus-visible,
        .hsx-link-indigo:focus-visible {
          outline: none;
          box-shadow: 0 0 0 3px ${T.indigoRing}, 0 1px 2px rgba(20,17,10,.04);
        }
        /* Skip-link — visually hidden until keyboard focus, then slides
           in top-left over the topbar. Standard a11y pattern. */
        .cs-skip-link {
          position: absolute;
          left: 12px;
          top: 12px;
          z-index: 100;
          padding: 8px 14px;
          border-radius: 8px;
          background: ${T.indigo};
          color: ${T.cream};
          font-family: ${F.sans};
          font-size: 13px;
          font-weight: 500;
          text-decoration: none;
          transform: translateY(-200%);
          transition: transform 160ms ease;
        }
        .cs-skip-link:focus { transform: translateY(0); outline: none; }
        /* Visually-hidden utility — for the email <label> we need
           semantic but hidden text. clip is the standard SR-only pattern. */
        .cs-sr-only {
          position: absolute;
          width: 1px; height: 1px;
          padding: 0; margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
        @media (prefers-reduced-motion: reduce) {
          .cs-hero h1 em, .cs-status-dot, .cs-cta, .cs-feature-tile {
            animation: none !important;
            transition-duration: 100ms !important;
          }
        }
      `}</style>

      {/* Skip-link — first focusable element on the page so keyboard
          users tab past the topbar straight into the email form. */}
      <a href="#cs-waitlist-form" className="cs-skip-link">
        Skip to waitlist form
      </a>

      <div
        style={{
          minHeight: "100dvh",
          background: T.cream,
          color: T.coal,
          fontFamily: F.sans,
          display: "flex",
          flexDirection: "column",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle paper-grain backdrop using two soft radial gradients —
            adds depth without breaking the editorial calm. */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              `radial-gradient(60% 50% at 18% 0%, ${T.indigo100} 0%, transparent 60%),` +
              `radial-gradient(50% 40% at 100% 100%, ${T.copper100} 0%, transparent 55%)`,
            opacity: 0.45,
            pointerEvents: "none",
          }}
        />

        {/* ─── 1. Topbar ───────────────────────────────────────────────── */}
        <header
          style={{ display: "flex", gridTemplateColumns: compact ? "1fr 1fr" : "1fr auto 1fr", alignItems: "center", padding: compact ? "20px 24px" : "32px 48px", gap: "150px", position: "relative", zIndex: 1, flexDirection: "row", justifyContent: "flex-start", overflowX: "hidden", overflowY: "hidden" }}
        >
          <div style={{ justifySelf: "start" }}>
            <Wordmark />
          </div>

          {/* Centre column intentionally empty — keeps the 3-col grid
              symmetric (wordmark left, action right) without imposing a
              "Building" status pill that competed with the wordmark. */}
          <div style={{ justifySelf: "center" }} />

          <div
            style={{
              justifySelf: "end",
              display: "inline-flex",
              alignItems: "center",
              gap: 14,
              fontFamily: F.sans,
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            <a
              href="https://linkedin.com/company/hirestepx"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="HireStepX on LinkedIn (opens in new tab)"
              className="hsx-link-indigo"
              style={{ color: T.inkSoft, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 6px", borderRadius: 6 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden focusable="false">
                <path d="M20.5 2h-17A1.5 1.5 0 0 0 2 3.5v17A1.5 1.5 0 0 0 3.5 22h17a1.5 1.5 0 0 0 1.5-1.5v-17A1.5 1.5 0 0 0 20.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 1 1 8.25 6.5 1.75 1.75 0 0 1 6.5 8.25zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0 0 13 14.19V19h-3v-9h2.9v1.3a3.11 3.11 0 0 1 2.7-1.4c1.55 0 3.36.86 3.36 3.66z"/>
              </svg>
              <span aria-hidden>LinkedIn</span>
            </a>
          </div>
        </header>

        {/* ─── 2. Hero + form column (centered) ────────────────────────── */}
        <main
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-start",
            padding: compact ? "32px 24px 56px" : "clamp(48px, 8vh, 96px) 24px 80px",
            position: "relative",
            zIndex: 1,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: compact ? "100%" : 720,
              textAlign: "center",
            }}
          >
            <div className="cs-hero">
              <h1
                style={{
                  fontFamily: F.serif,
                  fontSize: compact ? "clamp(1.75rem, 8vw, 2.4rem)" : "clamp(3rem, 6.4vw, 5rem)",
                  lineHeight: 1.04,
                  fontWeight: 400,
                  letterSpacing: "-0.022em",
                  color: T.coal,
                  margin: 0,
                  textWrap: "balance",
                }}
              >
                Practice the skill.{" "}
                <em style={{ fontStyle: "italic", color: T.copper, fontWeight: 400 }}>
                  Land the offer.
                </em>
              </h1>
            </div>

            {/* India-first wedge — the single biggest differentiator vs
                ChatGPT / Final Round AI / generic interview tools. Sits
                directly below the H1 so it can't be missed. */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                marginTop: compact ? 14 : 18,
                padding: "5px 12px",
                borderRadius: 999,
                background: T.copper100,
                color: T.copper,
                fontFamily: F.sans,
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: 0.2,
              }}
            >
              <span aria-hidden>🇮🇳</span>
              India&apos;s first AI interview coach
            </div>

            <p
              style={{
                fontFamily: F.sans,
                fontSize: compact ? 15 : 17,
                lineHeight: 1.55,
                color: T.inkSoft,
                marginTop: compact ? 16 : 22,
                marginBottom: 0,
                textWrap: "balance",
                maxWidth: 720,
                marginLeft: "auto",
                marginRight: "auto",
              }}
            >
              An AI coach that runs realistic mocks, hears your answers, and gives feedback that
              gets specific. Built for the way candidates in India actually interview.
            </p>

            {/* ─── Live counter — placed contextually, immediately above
                  the email form so it acts as the last frame of social
                  proof at the decision moment. Avatar stack + count
                  reads as "real people, you'd be one of them". The
                  number is real (passed by parent), never fabricated. */}
            <div
              style={{
                marginTop: compact ? 22 : 28,
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                padding: "5px 12px 5px 6px",
                borderRadius: 999,
                background: T.white,
                border: `1px solid ${T.line}`,
                boxShadow: shadows.card,
                fontFamily: F.sans,
                fontSize: 12,
                color: T.inkSoft,
              }}
            >
              <span aria-hidden style={{ display: "inline-flex", alignItems: "center" }}>
                {[T.indigo, T.copper, T.success].map((c, i) => (
                  <span
                    key={i}
                    style={{
                      width: 22, height: 22, borderRadius: 999,
                      background: c, color: T.cream,
                      border: `2px solid ${T.white}`,
                      marginLeft: i === 0 ? 0 : -8,
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      fontFamily: F.serif, fontSize: 10, fontWeight: 500,
                    }}
                  >
                    {["A", "S", "R"][i]}
                  </span>
                ))}
              </span>
              <span>
                <strong style={{ color: T.coal, fontFamily: F.serif, fontSize: 13, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
                  {waitlistCount.toLocaleString("en-IN")}
                </strong>
                {" "}already on the waitlist
              </span>
            </div>

            {/* ─── 3. Email capture ──────────────────────────────────── */}
            <form
              id="cs-waitlist-form"
              onSubmit={(e) => e.preventDefault()}
              aria-labelledby="cs-form-label"
              aria-describedby="cs-form-hint"
              style={{
                marginTop: 14,
                display: "flex",
                flexDirection: compact ? "column" : "row",
                gap: 10,
                maxWidth: 520,
                marginLeft: "auto",
                marginRight: "auto",
              }}
            >
              {/* Real <label> — visually hidden but exposed to screen
                  readers + form-tools. aria-label alone hides label
                  from autofill heuristics; <label htmlFor> is canonical. */}
              <label htmlFor="cs-email" className="cs-sr-only" id="cs-form-label">
                Email address — join the HireStepX waitlist
              </label>
              <div
                className="cs-input-wrap"
                style={{
                  /* flex: 1 (basis 0) so the input grows to fill the
                     remaining row width on desktop. Avoids the
                     "giant tall empty box" trap of using a flex-basis
                     in pixels — that becomes a vertical min-height
                     once the parent flips to column on mobile. */
                  flex: 1,
                  minWidth: 0,
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "14px 16px",
                  borderRadius: 12,
                  background: T.white,
                  border: `1px solid ${T.lineStrong}`,
                  transition: "border-color 160ms ease, box-shadow 160ms ease",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.inkFaint} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <polyline points="3 7 12 13 21 7" />
                </svg>
                <input
                  id="cs-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  inputMode="email"
                  placeholder="you@work.com"
                  aria-required="true"
                  aria-describedby="cs-form-hint"
                  style={{
                    flex: 1,
                    border: 0,
                    outline: "none",
                    background: "transparent",
                    fontFamily: F.sans,
                    fontSize: 14,
                    color: T.coal,
                  }}
                />
              </div>
              <button
                type="submit"
                className="cs-cta"
                aria-label="Submit email to join the HireStepX waitlist and get 3 free mocks"
                style={{
                  fontFamily: F.sans,
                  fontSize: 15,
                  fontWeight: 600,
                  padding: "14px 24px",
                  borderRadius: 12,
                  background: T.indigo,
                  color: T.cream,
                  border: 0,
                  cursor: "pointer",
                  letterSpacing: 0.1,
                  whiteSpace: "nowrap",
                  boxShadow: shadows.cta,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                Get 3 free mocks
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
                </svg>
              </button>
            </form>

            {/* Spam-promise — also serves as the input's
                aria-describedby target so screen readers announce
                "No spam. We'll email you once — when we launch."
                immediately after the email field role + name. */}
            <p
              id="cs-form-hint"
              style={{
                marginTop: 10,
                marginBottom: 0,
                fontFamily: F.sans,
                fontSize: 12,
                color: T.inkFaint,
                textAlign: "center",
              }}
            >
              No spam. We&apos;ll email you once — when we launch.
            </p>

            {/* Status region — empty by default. Wire to form submission
                state in production so SR users hear "You're on the list"
                or error copy without needing to refocus the input. */}
            <div role="status" aria-live="polite" className="cs-sr-only" />

          </div>



          {/* ─── 6. Three tease cards — hint at the experience without
                    revealing the actual product surface. Editorial copy,
                    cream/copper. Hover-lift identical to the production
                    SessionSetup focus chips so the brand grammar carries. */}
          <div
            style={{
              width: "100%",
              maxWidth: 1080,
              display: "grid",
              gridTemplateColumns: compact ? "1fr" : "repeat(3, 1fr)",
              gap: 14,
              marginTop: compact ? 56 : 96,
            }}
          >
            {[
              { eyebrow: "01", title: "Practice without judgment", body: "A calm space to rehearse, without the awkwardness of asking a friend to play recruiter." },
              { eyebrow: "02", title: "Feedback that gets specific", body: "Not generic tips. Specific lines, specific moments, specific wins to keep." },
              { eyebrow: "03", title: "Built for your context", body: "Not a Silicon Valley template. Designed around the rhythms candidates here actually face." },
            ].map((tile) => (
              <div
                key={tile.eyebrow}
                className="cs-feature-tile"
                style={{
                  padding: 22,
                  borderRadius: 14,
                  background: T.white,
                  border: `1px solid ${T.line}`,
                  boxShadow: shadows.card,
                  textAlign: "left",
                }}
              >
                <span
                  style={{
                    fontFamily: F.mono,
                    fontSize: 11,
                    letterSpacing: 1.2,
                    color: T.copper,
                    textTransform: "uppercase",
                    fontWeight: 600,
                  }}
                >
                  {tile.eyebrow}
                </span>
                <h3
                  style={{
                    fontFamily: F.serif,
                    fontSize: 22,
                    lineHeight: 1.2,
                    letterSpacing: "-0.012em",
                    color: T.coal,
                    margin: "8px 0 8px",
                    fontWeight: 500,
                  }}
                >
                  {tile.title}
                </h3>
                <p
                  style={{
                    fontFamily: F.sans,
                    fontSize: 14,
                    lineHeight: 1.55,
                    color: T.inkSoft,
                    margin: 0,
                  }}
                >
                  {tile.body}
                </p>
              </div>
            ))}
          </div>
        </main>

        {/* ─── 7. Footnote band ──────────────────────────────────── */}
        <footer
          style={{
            borderTop: `1px solid ${T.line}`,
            padding: compact ? "20px 24px" : "24px 48px",
            background: T.cream,
            position: "relative",
            zIndex: 1,
            display: "flex",
            flexDirection: compact ? "column" : "row",
            alignItems: compact ? "flex-start" : "center",
            justifyContent: "space-between",
            gap: compact ? 8 : 16,
            fontFamily: F.sans,
            fontSize: 12,
            color: T.inkFaint,
          }}
        >
          <span>
            Made in Mumbai 🇮🇳 · ₹ INR
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 18 }}>
            <a
              href="#privacy"
              className="cs-footer-link hsx-link-indigo"
              style={{ color: T.inkSoft, textDecoration: "none", padding: "4px 6px", borderRadius: 6 }}
            >
              Privacy
            </a>
            <a
              href="mailto:hello@hirestepx.com"
              aria-label="Email HireStepX at hello@hirestepx.com"
              className="cs-footer-link hsx-link-indigo"
              style={{ color: T.inkSoft, textDecoration: "none", padding: "4px 6px", borderRadius: 6 }}
            >
              hello@hirestepx.com
            </a>
          </span>
        </footer>
      </div>
    </>
  );
}
