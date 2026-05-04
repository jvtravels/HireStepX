"use client";
/* HireStepX — Coming Soon (production)
   Editorial cream / indigo / copper system. Same design system as auth,
   onboarding, SessionSetup, and the interview surface.

   Discipline rule: Indigo is interactive · Copper is editorial · Never mix.

   Sections (top-down):
   1. Topbar — Wordmark · LinkedIn link with icon
   2. Editorial hero — H1 ("Practice the skill. Land the offer.")
        + India-first AI-coach wedge chip
   3. Subtitle (mode-agnostic — voice now, video later)
   4. Live counter pill (real Supabase waitlist count) above the form
   5. Email capture + spam-promise + aria-live status region
   6. Three editorial tease cards
   7. Footnote band — Made in Mumbai · ₹ INR · privacy

   Backend wiring preserved from previous version:
   - Supabase `waitlist` table (email + created_at, upsert on conflict)
   - Vercel analytics: track("waitlist_signup", { email, source }) */

import React, { useState, useEffect, useRef } from "react";
import { track } from "@vercel/analytics";
import { tokens as T, fonts as F, shadows } from "./auth/_tokens";
import { Wordmark } from "./auth/_fields";
import { AUTH_STYLES } from "./auth/_styles";
import { getSupabase, supabaseConfigured } from "./supabase";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* PII-safe analytics — Vercel Analytics is third-party, so we never
   send raw email. Hash via SubtleCrypto + send domain only.
   Domain is enough for funnel analysis ("which TLDs convert") without
   exposing the user. Falls back to "hashed" string if SubtleCrypto
   isn't available (very old browsers, non-secure contexts). */
async function hashEmail(email: string): Promise<string> {
  try {
    if (typeof crypto?.subtle?.digest !== "function") return "unavailable";
    const enc = new TextEncoder().encode(email.toLowerCase());
    const buf = await crypto.subtle.digest("SHA-256", enc);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 16); // first 64 bits — enough to count unique submissions, not enough to reverse
  } catch {
    return "unavailable";
  }
}

/* Bot-protection thresholds.
   - HONEYPOT_FIELD: hidden input that real users never fill, bots almost always do.
   - MIN_SUBMIT_MS: time between page-load and submit. Anything faster than
     this is a bot — humans need ~1.5-3 seconds minimum to type an email. */
const HONEYPOT_FIELD = "cs_company_url";
const MIN_SUBMIT_MS = 1500;

export default function ComingSoon() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [count, setCount] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  // Submission lock — prevents double-fires from rapid clicks /
  // bot loops, independent of React's async state.
  const submittingRef = useRef(false);
  // Mount timestamp for the "submitted too fast" bot heuristic.
  const mountedAtRef = useRef<number>(Date.now());
  // Honeypot value — kept in a ref so it doesn't trigger re-renders.
  const honeypotRef = useRef<HTMLInputElement | null>(null);
  // Success-card focus target so keyboard + SR users land cleanly
  // when the form unmounts.
  const successRef = useRef<HTMLDivElement | null>(null);

  /* Fetch live waitlist count — deferred to idle so it never blocks
     LCP. Re-runs when status flips to "done" so the count is fresh
     for any future surface that reads it (currently the success
     card hides the counter, but state is still useful). */
  useEffect(() => {
    if (!supabaseConfigured) return;
    let cancelled = false;
    const load = async () => {
      try {
        const client = await getSupabase();
        const { count: c } = await client
          .from("waitlist")
          .select("*", { count: "exact", head: true });
        if (!cancelled && c !== null) setCount(c);
      } catch {
        /* ignore — count is purely social-proof, not load-blocking */
      }
    };
    if (status === "done") {
      load();
    } else if (typeof requestIdleCallback !== "undefined") {
      const id = requestIdleCallback(() => load());
      return () => {
        cancelled = true;
        cancelIdleCallback(id);
      };
    } else {
      const id = setTimeout(load, 4000);
      return () => {
        cancelled = true;
        clearTimeout(id);
      };
    }
    return () => { cancelled = true; };
  }, [status]);

  /* Move focus to the success card when status flips to "done" so
     keyboard + SR users land on the confirmation rather than losing
     focus to <body>. */
  useEffect(() => {
    if (status === "done" && successRef.current) {
      successRef.current.focus();
    }
  }, [status]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Concurrency lock — block double submits even if React state
    // hasn't propagated yet.
    if (submittingRef.current) return;

    // Bot heuristic 1: honeypot. Real users can't see this input;
    // bots that auto-fill every field will populate it. We log the
    // attempt and silently flip to "done" so the bot thinks it won.
    const honeypotValue = honeypotRef.current?.value ?? "";
    if (honeypotValue.trim() !== "") {
      track("waitlist_signup_blocked", { reason: "honeypot" });
      setStatus("done"); // silent decoy — keeps the bot from retrying
      return;
    }

    // Bot heuristic 2: too-fast submission (<1.5s after mount).
    if (Date.now() - mountedAtRef.current < MIN_SUBMIT_MS) {
      track("waitlist_signup_blocked", { reason: "too_fast" });
      setStatus("done"); // silent decoy
      return;
    }

    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setErrorMsg("Please enter a valid email address.");
      setStatus("error");
      return;
    }

    setErrorMsg("");
    setStatus("sending");
    submittingRef.current = true;

    // Pre-compute PII-safe analytics payload — hash + domain only.
    const emailHash = await hashEmail(trimmed);
    const domain = trimmed.split("@")[1] ?? "";

    try {
      if (supabaseConfigured) {
        const client = await getSupabase();
        const { error } = await client.from("waitlist").upsert(
          { email: trimmed, created_at: new Date().toISOString() },
          { onConflict: "email" },
        );
        // Surface real Supabase errors instead of fake-success.
        if (error) throw error;
      }
      track("waitlist_signup", { email_hash: emailHash, domain, source: "coming_soon" });
      setStatus("done");
    } catch (err) {
      // Real error state — user sees retry copy, NOT fake confirmation.
      const reason = (err as { message?: string })?.message ?? "unknown";
      track("waitlist_signup_failed", { domain, reason: reason.slice(0, 80), source: "coming_soon" });
      setErrorMsg("We couldn't save your email. Please try again — or email hello@hirestepx.com.");
      setStatus("error");
    } finally {
      submittingRef.current = false;
    }
  };

  const isSending = status === "sending";
  const isDone = status === "done";
  const ariaLiveMessage = isDone
    ? "You're on the list. We'll email you when we launch."
    : status === "error"
      ? errorMsg
      : "";

  return (
    <>
      <style>{AUTH_STYLES}</style>
      <style>{`
        @keyframes csAccentIn {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .cs-hero h1 em { animation: csAccentIn 700ms 180ms cubic-bezier(.2,.7,.2,1) both; }
        .cs-input-wrap:focus-within {
          border-color: ${T.indigo} !important;
          box-shadow: 0 0 0 3px ${T.indigoRing};
        }
        .cs-input-wrap.is-error {
          border-color: ${T.error} !important;
          box-shadow: 0 0 0 3px rgba(185,28,28,0.18);
        }
        .cs-cta {
          transition: transform 180ms cubic-bezier(0.16, 1, 0.3, 1),
                      box-shadow 180ms cubic-bezier(0.16, 1, 0.3, 1),
                      background 180ms ease, opacity 160ms ease;
        }
        /* Inline style sets background:indigo, so hover/active need !important
           to win specificity. Same pattern as hsx-onb-cta-primary. */
        .cs-cta:not(:disabled):hover {
          transform: translateY(-1px);
          background: ${T.indigoDeep} !important;
          box-shadow: 0 4px 12px -2px rgba(20,17,10,.18), 0 18px 36px -12px rgba(49,46,129,0.5);
        }
        .cs-cta:not(:disabled):hover svg { transform: translateX(3px); }
        .cs-cta:not(:disabled):active { transform: translateY(0); }
        .cs-cta svg { transition: transform 180ms cubic-bezier(0.16, 1, 0.3, 1); }
        .cs-cta:disabled { cursor: not-allowed; opacity: 0.6; }
        .cs-feature-tile {
          transition: transform 220ms cubic-bezier(.2,.7,.2,1), box-shadow 220ms ease;
        }
        .cs-feature-tile:hover {
          transform: translateY(-3px);
          box-shadow: 0 1px 0 rgba(20,17,10,.04), 0 1px 2px rgba(20,17,10,.06), 0 24px 48px -22px rgba(20,17,10,.16);
        }
        .cs-cta:focus-visible,
        .cs-footer-link:focus-visible,
        .hsx-link-indigo:focus-visible {
          outline: none;
          box-shadow: 0 0 0 3px ${T.indigoRing}, 0 1px 2px rgba(20,17,10,.04);
        }
        .cs-skip-link {
          position: absolute; left: 12px; top: 12px; z-index: 100;
          padding: 8px 14px; border-radius: 8px;
          background: ${T.indigo}; color: ${T.cream};
          font-family: ${F.sans}; font-size: 13px; font-weight: 500;
          text-decoration: none;
          transform: translateY(-200%);
          transition: transform 160ms ease;
        }
        .cs-skip-link:focus { transform: translateY(0); outline: none; }
        .cs-sr-only {
          position: absolute; width: 1px; height: 1px;
          padding: 0; margin: -1px; overflow: hidden;
          clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
        }
        @keyframes csSpin { to { transform: rotate(360deg); } }
        .cs-spin { animation: csSpin 1s linear infinite; }

        /* Responsive — one set of breakpoints, no compact-prop dance. */
        .cs-topbar { padding: 32px 48px; }
        .cs-main { padding: clamp(48px, 8vh, 96px) 24px 80px; }
        .cs-hero h1 { font-size: clamp(3rem, 6.4vw, 5rem); }
        .cs-subtitle { font-size: 17px; }
        .cs-form { flex-direction: row; }
        .cs-features { grid-template-columns: repeat(3, 1fr); }
        .cs-footer { flex-direction: row; align-items: center; }

        @media (max-width: 760px) {
          .cs-hero h1 { font-size: clamp(1.75rem, 8vw, 2.4rem); white-space: normal; text-wrap: balance; }
          .cs-subtitle { font-size: 15px; }
          .cs-main { padding: 32px 24px 40px; }
          .cs-topbar { padding: 20px 24px; }
          /* Tighten the gap between the hero microcopy and the
             feature tiles — the desktop 96px gap reads as a dead zone
             on phones where the eye doesn't have to travel as far. */
          .cs-features { margin-top: 40px !important; }
          /* Footer was 24px 48px which left enormous whitespace under
             "Made in Mumbai 🇮🇳" / "Privacy" on phones. Bring it in. */
          .cs-footer { padding: 16px 20px !important; }
        }
        @media (max-width: 600px) {
          .cs-form { flex-direction: column; }
          .cs-features { grid-template-columns: 1fr; gap: 12px; margin-top: 32px !important; }
          .cs-footer { flex-direction: row; justify-content: space-between; align-items: center; gap: 12px; padding: 14px 18px !important; }
        }

        @media (prefers-reduced-motion: reduce) {
          .cs-hero h1 em, .cs-cta, .cs-feature-tile, .cs-spin {
            animation: none !important;
            transition-duration: 100ms !important;
          }
        }
      `}</style>

      {/* Skip-link — first focusable element. */}
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
        {/* Subtle paper-grain backdrop — two soft radial gradients. */}
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

        {/* ─── 1. Topbar ─────────────────────────────────────────────── */}
        <header
          className="cs-topbar"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            position: "relative",
            zIndex: 1,
          }}
        >
          <Wordmark />

          <a
            href="https://linkedin.com/company/hirestepx"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="HireStepX on LinkedIn (opens in new tab)"
            className="hsx-link-indigo"
            style={{
              color: T.inkSoft,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 6px",
              borderRadius: 6,
              fontFamily: F.sans,
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden focusable="false">
              <path d="M20.5 2h-17A1.5 1.5 0 0 0 2 3.5v17A1.5 1.5 0 0 0 3.5 22h17a1.5 1.5 0 0 0 1.5-1.5v-17A1.5 1.5 0 0 0 20.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 1 1 8.25 6.5 1.75 1.75 0 0 1 6.5 8.25zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0 0 13 14.19V19h-3v-9h2.9v1.3a3.11 3.11 0 0 1 2.7-1.4c1.55 0 3.36.86 3.36 3.66z"/>
            </svg>
            <span aria-hidden>LinkedIn</span>
          </a>
        </header>

        {/* ─── 2. Hero + form (centered) ─────────────────────────────── */}
        <main
          className="cs-main"
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-start",
            position: "relative",
            zIndex: 1,
          }}
        >
          <div style={{ width: "100%", maxWidth: 720, textAlign: "center" }}>
            <div className="cs-hero">
              <h1
                style={{
                  fontFamily: F.serif,
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

            {/* India-first wedge */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                marginTop: 18,
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
              className="cs-subtitle"
              style={{
                fontFamily: F.sans,
                lineHeight: 1.55,
                color: T.inkSoft,
                marginTop: 22,
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

            {/* Live counter — only renders when we have a real number from
                Supabase. No fabrication. Hidden until the data loads. */}
            {count !== null && count > 0 && (
              <div
                style={{
                  marginTop: 28,
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
                    {count.toLocaleString("en-IN")}
                  </strong>
                  {" "}already on the waitlist
                </span>
              </div>
            )}

            {/* ─── 3. Email capture / success ────────────────────────── */}
            {/* Wrapper carries the skip-link id so it survives the
                form-to-success swap. Whichever child renders, the
                skip-link target stays valid. */}
            <div id="cs-waitlist-form">
            {isDone ? (
              <div
                ref={successRef}
                role="status"
                aria-live="polite"
                tabIndex={-1}
                style={{
                  marginTop: count !== null && count > 0 ? 14 : 36,
                  maxWidth: 520,
                  marginLeft: "auto",
                  marginRight: "auto",
                  padding: "20px 22px",
                  borderRadius: 14,
                  background: `linear-gradient(180deg, ${T.success100}, ${T.white})`,
                  border: `1px solid ${T.success}`,
                  boxShadow: shadows.card,
                  textAlign: "center",
                  outline: "none",
                }}
              >
                <div
                  aria-hidden
                  style={{
                    width: 36, height: 36, borderRadius: 999,
                    background: T.success, color: T.cream,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    marginBottom: 10,
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" focusable="false">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div
                  style={{
                    fontFamily: F.serif,
                    fontSize: 20,
                    fontWeight: 500,
                    color: T.coal,
                    letterSpacing: "-0.012em",
                  }}
                >
                  You&apos;re on the list.
                </div>
                <p
                  style={{
                    margin: "6px 0 0",
                    fontFamily: F.sans,
                    fontSize: 13,
                    color: T.inkSoft,
                    lineHeight: 1.5,
                  }}
                >
                  We&apos;ll email <strong style={{ color: T.coal, fontWeight: 500 }}>{email}</strong> the moment we launch.
                </p>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                aria-labelledby="cs-form-label"
                aria-describedby="cs-form-hint"
                style={{
                  marginTop: count !== null && count > 0 ? 14 : 36,
                  display: "flex",
                  gap: 10,
                  maxWidth: 520,
                  marginLeft: "auto",
                  marginRight: "auto",
                }}
                className="cs-form"
                noValidate
              >
                <label htmlFor="cs-email" className="cs-sr-only" id="cs-form-label">
                  Email address — join the HireStepX waitlist
                </label>
                {/* Honeypot — visually hidden from sighted users + SR users
                    (aria-hidden + tabIndex=-1), but auto-fillers grab it.
                    A non-empty value on submit silently flips us to the
                    "done" decoy so the bot thinks it succeeded. */}
                <input
                  ref={honeypotRef}
                  type="text"
                  name={HONEYPOT_FIELD}
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  defaultValue=""
                  style={{
                    position: "absolute",
                    left: -10000,
                    width: 1,
                    height: 1,
                    opacity: 0,
                    pointerEvents: "none",
                  }}
                />
                <div
                  className={`cs-input-wrap${status === "error" ? " is-error" : ""}`}
                  style={{
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
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.inkFaint} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
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
                    placeholder="you@email.com"
                    aria-required="true"
                    aria-invalid={status === "error"}
                    aria-describedby="cs-form-hint"
                    value={email}
                    disabled={isSending}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (status === "error") {
                        setStatus("idle");
                        setErrorMsg("");
                      }
                    }}
                    style={{
                      flex: 1,
                      border: 0,
                      outline: "none",
                      background: "transparent",
                      fontFamily: F.sans,
                      fontSize: 14,
                      color: T.coal,
                      width: "100%",
                    }}
                  />
                </div>
                <button
                  type="submit"
                  className="cs-cta"
                  disabled={isSending}
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
                    cursor: isSending ? "not-allowed" : "pointer",
                    letterSpacing: 0.1,
                    whiteSpace: "nowrap",
                    boxShadow: shadows.cta,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    minHeight: 48,
                  }}
                >
                  {isSending ? (
                    <>
                      <span
                        aria-hidden
                        className="cs-spin"
                        style={{
                          width: 14, height: 14,
                          border: `2px solid ${T.indigoRing}`,
                          borderTopColor: T.cream,
                          borderRadius: "50%",
                          display: "inline-block",
                        }}
                      />
                      Joining…
                    </>
                  ) : (
                    <>
                      Get 3 free mocks
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
                        <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
                      </svg>
                    </>
                  )}
                </button>
              </form>
            )}

            {!isDone && (
              <p
                id="cs-form-hint"
                style={{
                  marginTop: 10,
                  marginBottom: 0,
                  fontFamily: F.sans,
                  fontSize: 12,
                  color: status === "error" ? T.error : T.inkFaint,
                  textAlign: "center",
                }}
              >
                {status === "error"
                  ? errorMsg
                  : "No spam. We'll email you once — when we launch."}
              </p>
            )}

            {/* SR-only live region — production version mirrors form state. */}
            <div role="status" aria-live="polite" className="cs-sr-only">
              {ariaLiveMessage}
            </div>
            </div>
          </div>

          {/* ─── 4. Three editorial tease cards ─────────────────────── */}
          <div
            className="cs-features"
            style={{
              width: "100%",
              maxWidth: 1080,
              display: "grid",
              gap: 14,
              marginTop: 96,
            }}
          >
            {[
              {
                eyebrow: "01",
                title: "Practice without judgment",
                body: "A calm space to rehearse, without the awkwardness of asking a friend to play recruiter.",
              },
              {
                eyebrow: "02",
                title: "Feedback that gets specific",
                body: "Not generic tips. Specific lines, specific moments, specific wins to keep.",
              },
              {
                eyebrow: "03",
                title: "Built for your context",
                body: "Not a Silicon Valley template. Designed around the rhythms candidates here actually face.",
              },
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

        {/* ─── 5. Footnote band ──────────────────────────────────────── */}
        <footer
          className="cs-footer"
          style={{
            borderTop: `1px solid ${T.line}`,
            padding: "24px 48px",
            background: T.cream,
            position: "relative",
            zIndex: 1,
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            fontFamily: F.sans,
            fontSize: 12,
            color: T.inkFaint,
          }}
        >
          <span>
            Made in Mumbai 🇮🇳
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 18 }}>
            <a
              href="/privacy"
              className="cs-footer-link hsx-link-indigo"
              style={{ color: T.inkSoft, textDecoration: "none", padding: "4px 6px", borderRadius: 6 }}
            >
              Privacy
            </a>
          </span>
        </footer>
      </div>
    </>
  );
}
