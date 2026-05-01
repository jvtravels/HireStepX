/* HireStepX — Authentication / Forgot password (sent confirmation)
   Step 2 of the password-reset flow. Confirms a reset email may have been
   dispatched (enumeration-resistant) and offers a resend with cooldown.
   Layout mirrors ForgotPassword: text-first hero, narrow form column,
   inline shield + headphones for trust + help. */
import React, { useEffect, useState } from "react";
import { tokens as t, fonts as f, shadows } from "../design-system/_tokens";
import { Wordmark, Spinner } from "./_auth-fields";
import { AUTH_STYLES } from "./_auth-styles";

export interface ForgotPasswordSentProps {
  /** The email the link was dispatched to. */
  email?: string;
  /** Show the loading state on the resend button */
  resending?: boolean;
}

// 60s matches Stripe / Linear / Notion cooldowns. Long enough to deter
// retry storms, short enough not to frustrate.
const RESEND_COOLDOWN_SEC = 60;

export default function ForgotPasswordSent({
  email = "rahul@example.com",
  resending = false,
}: ForgotPasswordSentProps = {}) {
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SEC);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const canResend = cooldown <= 0 && !resending;

  // Provider-aware webmail link so users land in the right inbox tab.
  const provider = (() => {
    const at = email.lastIndexOf("@");
    if (at < 0) return null;
    const domain = email.slice(at + 1).toLowerCase();
    if (domain.includes("gmail") || domain.includes("googlemail")) return { name: "Gmail", url: "https://mail.google.com" };
    if (domain.includes("outlook") || domain.includes("hotmail") || domain.includes("live")) return { name: "Outlook", url: "https://outlook.live.com" };
    if (domain.includes("yahoo")) return { name: "Yahoo", url: "https://mail.yahoo.com" };
    if (domain.includes("proton")) return { name: "Proton", url: "https://mail.proton.me" };
    return null;
  })();

  return (
    <>
      <style>{AUTH_STYLES}</style>
      <div
        style={{ background: t.cream, minHeight: "100dvh", fontFamily: f.sans, color: t.coal, position: "relative", display: "flex", flexDirection: "column" }}
      >
        <header
          className="hsx-login-topbar"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "32px 48px", gap: 16 }}
        >
          <Wordmark />
          <a
            href="#login"
            className="hsx-link-indigo"
            style={{ fontFamily: f.sans, fontSize: 14, fontWeight: 500, color: t.indigo, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Back to Log in
          </a>
        </header>

        <main
          className="hsx-login-main"
          style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "clamp(24px, 4vh, 64px) 24px" }}
        >
          {/* Text-first hero — no icon tile, matches Forgot screen */}
          <div className="hsx-login-hero" style={{ width: "100%", textAlign: "center", marginBottom: 32 }}>
            <h1
              id="sent-heading"
              style={{ fontFamily: f.serif, fontSize: "clamp(2.5rem, 6vw, 4.5rem)", lineHeight: 1.05, fontWeight: 400, letterSpacing: "-0.02em", whiteSpace: "nowrap", margin: 0, color: t.coal }}
            >
              Check your{" "}
              <em style={{ fontStyle: "italic", fontWeight: 400, color: t.copper }}>
                inbox
              </em>
            </h1>
            {/* Enumeration-resistant copy — Stripe/Apple/Auth0 pattern */}
            <p
              className="hsx-login-subtitle"
              style={{ fontFamily: f.sans, fontSize: 16, lineHeight: 1.55, color: t.inkSoft, marginTop: 14, marginBottom: 0, textWrap: "balance" }}
            >
              If an account exists for{" "}
              <strong style={{ color: t.coal, fontWeight: 600 }}>{email}</strong>,
              a reset link is on its way.
            </p>
          </div>

          <div className="hsx-login-form" style={{ width: "100%", maxWidth: 440, display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Open webmail (provider-aware) */}
            {provider && (
              <a
                href={provider.url}
                target="_blank"
                rel="noreferrer"
                className="hsx-login-cta"
                style={{ width: "100%", fontFamily: f.sans, fontSize: 15, fontWeight: 600, color: t.cream, background: t.indigo, border: "1px solid transparent", borderRadius: 10, padding: "16px 18px", cursor: "pointer", boxShadow: shadows.cta, letterSpacing: 0.1, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, textDecoration: "none" }}
              >
                Open {provider.name}
                <svg className="hsx-login-cta-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M7 17L17 7" />
                  <path d="M8 7h9v9" />
                </svg>
              </a>
            )}

            {/* Resend with cooldown — secondary tone. aria-live span lets
                screen readers announce the countdown without repeatedly
                re-reading the whole button label. */}
            <button
              type="button"
              disabled={!canResend}
              aria-busy={resending || undefined}
              style={{ width: "100%", fontFamily: f.sans, fontSize: 15, fontWeight: 500, color: t.coal, background: t.white, border: `1px solid ${t.line}`, borderRadius: 10, padding: "14px 18px", cursor: canResend ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: shadows.card, opacity: canResend ? 1 : 0.6 }}
            >
              {resending ? (
                <>
                  <Spinner />
                  Resending…
                </>
              ) : cooldown > 0 ? (
                <span aria-live="polite">Resend link in {cooldown}s</span>
              ) : (
                <span aria-live="polite">Resend link</span>
              )}
            </button>

            {/* "Wrong email?" — promoted to a button-tier action since typo
                recovery is the #1 actionable need on this screen (Linear,
                Stripe surface this prominently). */}
            <a
              href="#forgot"
              className="hsx-link-indigo"
              style={{ width: "100%", fontFamily: f.sans, fontSize: 14, fontWeight: 500, color: t.indigo, padding: "10px 14px", textAlign: "center", textDecoration: "none" }}
            >
              Wrong email? Try a different one
            </a>

            {/* Inline security row — copper shield, mirrors ForgotPassword */}
            <div
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 6, fontFamily: f.sans, fontSize: 13, color: t.inkSoft }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.copper} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2 4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4z" />
                <path d="M12 8v4" />
                <circle cx="12" cy="15" r="0.6" fill={t.copper} stroke="none" />
              </svg>
              For your security, the link will expire in 30 minutes.
            </div>

            {/* Spam-folder note — single calm reminder, no extra CTA */}
            <p
              style={{ fontFamily: f.sans, fontSize: 13, color: t.inkFaint, textAlign: "center", marginTop: 4, lineHeight: 1.55 }}
            >
              Don&apos;t see it? Check your spam folder.
            </p>
          </div>
        </main>

        {/* Single-line headphones footer — matches ForgotPassword */}
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
