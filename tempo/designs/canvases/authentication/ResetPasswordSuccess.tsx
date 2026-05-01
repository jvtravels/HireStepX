/* HireStepX — Authentication / Reset password (success)
   Step 4 of the password-reset flow. Confirms the new password is live
   and routes the user back to practising.
   Layout mirrors ForgotPassword: text-first hero, narrow form column,
   single-line headphones footer. */
import React from "react";
import { tokens as t, fonts as f, shadows } from "../design-system/_tokens";
import { Wordmark } from "./_auth-fields";
import { AUTH_STYLES } from "./_auth-styles";

export interface ResetPasswordSuccessProps {
  /** Where the primary CTA points. */
  continueHref?: string;
}

export default function ResetPasswordSuccess({
  continueHref = "#login",
}: ResetPasswordSuccessProps = {}) {
  return (
    <>
      <style>{AUTH_STYLES}</style>
      <div
        style={{ background: t.cream, minHeight: "100dvh", fontFamily: f.sans, color: t.coal, position: "relative", display: "flex", flexDirection: "column" }}
      >
        {/* All sessions invalidated — user must sign back in. Wordmark only. */}
        <header
          className="hsx-login-topbar"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "32px 48px", gap: 16 }}
        >
          <Wordmark />
        </header>

        <main
          className="hsx-login-main"
          style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "clamp(24px, 4vh, 64px) 24px" }}
        >
          {/* Text-first hero — no icon tile. Brand voice carries the moment. */}
          <div className="hsx-login-hero" style={{ width: "100%", textAlign: "center", marginBottom: 32 }}>
            <h1
              id="success-heading"
              style={{ fontFamily: f.serif, fontSize: "clamp(2.5rem, 6vw, 4.5rem)", lineHeight: 1.05, fontWeight: 400, letterSpacing: "-0.02em", whiteSpace: "nowrap", margin: 0, color: t.coal }}
            >
              Password{" "}
              <em style={{ fontStyle: "italic", fontWeight: 400, color: t.copper }}>
                updated
              </em>
            </h1>
            <p
              className="hsx-login-subtitle"
              style={{ fontFamily: f.sans, fontSize: 16, lineHeight: 1.55, color: t.inkSoft, marginTop: 14, marginBottom: 0, textWrap: "balance" }}
            >
              We&apos;ve signed you out of all devices for safety. Use your new
              password to log back in.
            </p>
          </div>

          <div className="hsx-login-form" style={{ width: "100%", maxWidth: 440, display: "flex", flexDirection: "column", gap: 14 }}>
            <a
              href={continueHref}
              className="hsx-login-cta"
              style={{ width: "100%", fontFamily: f.sans, fontSize: 15, fontWeight: 600, color: t.cream, background: t.indigo, border: "1px solid transparent", borderRadius: 10, padding: "16px 18px", cursor: "pointer", boxShadow: shadows.cta, letterSpacing: 0.1, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, textDecoration: "none" }}
            >
              Go to Log in
              <svg className="hsx-login-cta-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </a>

            {/* Inline shield row — green check tone signals success.
                Same visual placement as the security note on prior screens. */}
            <div
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 6, fontFamily: f.sans, fontSize: 13, color: t.inkSoft }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.success} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2 4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4z" />
                <polyline points="9 12 11 14 15 10" />
              </svg>
              Your account is secured.
            </div>

            {/* Wasn't-me path — fast remediation if compromised */}
            <p
              style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, textAlign: "center", marginTop: 10, lineHeight: 1.55 }}
            >
              Didn&apos;t request this?{" "}
              <a href="#secure-account" className="hsx-link-indigo" style={{ color: t.indigo, fontWeight: 600, textDecoration: "none" }}>
                Secure your account
              </a>
              .
            </p>
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
