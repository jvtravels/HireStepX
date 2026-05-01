/* HireStepX — Authentication / Forgot password (request)
   Step 1 of the password-reset flow. User enters their account email;
   the backend emails a tokenised reset link.
   Discipline rule: Indigo is interactive · Copper is editorial · Never mix. */
import React, { useEffect, useState } from "react";
import { tokens as t, fonts as f, shadows } from "../design-system/_tokens";
import { Field, Wordmark, Spinner } from "./_auth-fields";
import { AUTH_STYLES } from "./_auth-styles";
import { sanitizeEmail, validateEmail } from "./_auth-validation";

export interface ForgotPasswordProps {
  initialEmail?: string;
  loading?: boolean;
  error?: string | null;
  /** Variant tag for analytics A/B tracking */
  variant?: string;
}

const EMAIL_MAX_LENGTH = 320;

export default function ForgotPassword({
  initialEmail = "",
  loading = false,
  error = null,
}: ForgotPasswordProps = {}) {
  const [email, setEmail] = useState(initialEmail);
  const [emailTouched, setEmailTouched] = useState(false);

  const emailV = validateEmail(email);
  const canSubmit = emailV.valid && !loading;
  const emailError = emailTouched ? emailV.message : null;

  // Same anti-focus-stealing guard as Login: only focus on visible tab.
  const [shouldAutoFocus] = useState(() => {
    if (typeof document === "undefined") return false;
    return document.visibilityState === "visible";
  });

  useEffect(() => {
    // Production: trackAuth({ type: "forgot_password_viewed" })
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEmailTouched(true);
    if (!canSubmit) return;
    const cleanEmail = sanitizeEmail(email);
    void cleanEmail; // production: POST /api/password/forgot
  };

  return (
    <>
      <style>{AUTH_STYLES}</style>
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
        {/* Top bar — wordmark left, "Back to login" right (replaces the
            "Remembered it? Log in" prompt; cleaner, more direct). */}
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

        {/* Centered hero + form */}
        <main
          className="hsx-login-main"
          style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "clamp(24px, 4vh, 64px) 24px" }}
        >
          {/* Hero — friendlier subtitle, no period after the heading */}
          <div className="hsx-login-hero" style={{ width: "100%", textAlign: "center", marginBottom: 32 }}>
            <h1
              id="forgot-heading"
              style={{ fontFamily: f.serif, fontSize: "clamp(2.5rem, 6vw, 4.5rem)", lineHeight: 1.05, fontWeight: 400, letterSpacing: "-0.02em", whiteSpace: "nowrap", margin: 0, color: t.coal }}
            >
              Reset your{" "}
              <em style={{ fontStyle: "italic", fontWeight: 400, color: t.copper }}>
                password
              </em>
            </h1>
            <p
              className="hsx-login-subtitle"
              style={{ fontFamily: f.sans, fontSize: 16, lineHeight: 1.55, color: t.inkSoft, marginTop: 14, marginBottom: 0, textWrap: "balance" }}
            >
              No worries, we&apos;ll send you a link to reset your password.
            </p>
          </div>

          <div className="hsx-login-form" style={{ width: "100%", maxWidth: 440 }}>
            {/* Server error banner */}
            {error && (
              <div
                role="alert"
                id="forgot-error"
                className="hsx-error-banner"
                style={{ background: t.error100, border: `1px solid ${t.error}`, borderRadius: 10, padding: "12px 14px", marginBottom: 16, fontFamily: f.sans, fontSize: 13, color: t.error, lineHeight: 1.4 }}
              >
                {error}
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              aria-labelledby="forgot-heading"
              aria-describedby={error ? "forgot-error" : undefined}
              style={{ display: "flex", flexDirection: "column", gap: 14 }}
            >
              <Field
                label="Email Address"
                type="email"
                name="email"
                value={email}
                onChange={setEmail}
                onFocus={() => setEmailTouched(true)}
                onAutofill={() => setEmailTouched(true)}
                autoComplete="email"
                placeholder="Enter your email"
                autoFocus={shouldAutoFocus}
                inputMode="email"
                enterKeyHint="send"
                maxLength={EMAIL_MAX_LENGTH}
                invalid={!!error || (emailTouched && !!emailV.message)}
                errorMessage={emailError}
              />

              {/* Primary CTA — ghost treatment when disabled (matches Login):
                  cream bg + faint ink + visible border. Far more legible than
                  fading the indigo button below readable contrast. */}
              {(() => {
                const isGhost = !canSubmit && !loading;
                const tooltip = isGhost
                  ? !emailV.valid
                    ? "Enter a valid email to continue"
                    : "Complete the form to continue"
                  : undefined;
                return (
                  <button
                    type="submit"
                    disabled={!canSubmit}
                    aria-busy={loading || undefined}
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
                      cursor: canSubmit ? "pointer" : "not-allowed",
                      marginTop: 4,
                      boxShadow: isGhost ? "none" : shadows.cta,
                      letterSpacing: 0.1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 10,
                      opacity: loading ? 0.95 : 1,
                    }}
                  >
                    {loading ? (
                      <>
                        <Spinner />
                        Sending link…
                      </>
                    ) : (
                      <>
                        Send reset link
                        <svg className="hsx-login-cta-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <line x1="5" y1="12" x2="19" y2="12" />
                          <polyline points="12 5 19 12 12 19" />
                        </svg>
                      </>
                    )}
                  </button>
                );
              })()}

              {/* Inline security reassurance — shield icon + short note.
                  Replaces a heavier footer block with a single targeted line
                  that lives next to the action it qualifies. */}
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
            </form>
          </div>
        </main>

        {/* Footer — single, focused help affordance (headphones icon).
            Rate-limit copy moved into the inline shield row above; one place
            of trust messaging is calmer than two. */}
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
