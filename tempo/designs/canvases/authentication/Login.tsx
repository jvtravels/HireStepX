/* HireStepX — Authentication / Login
   Page composition. Atoms in _auth-fields, styles in _auth-styles,
   validation in _auth-validation, analytics in _auth-analytics.
   Discipline rule: Indigo is interactive · Copper is editorial · Never mix. */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { tokens as t, fonts as f, shadows } from "../design-system/_tokens";
import {
  Field,
  Checkbox,
  Wordmark,
  GoogleIcon,
  Spinner,
  EyeIcon,
} from "./_auth-fields";
import { AUTH_STYLES } from "./_auth-styles";
import {
  passwordHasEdgeWhitespace,
  sanitizeEmail,
  validateEmail,
  validatePassword,
} from "./_auth-validation";
import { trackAuth, loginViewedEvent } from "./_auth-analytics";

export interface LoginProps {
  initialEmail?: string;
  initialPassword?: string;
  /** Show the loading state on the primary CTA */
  loading?: boolean;
  /** Render an error banner above the form (server-side errors) */
  error?: string | null;
  /** Variant tag for analytics A/B tracking */
  variant?: string;
}

// Auto-hide password if it's been visible for this long (over-shoulder
// protection). Industry pattern: 8–10s.
const PASSWORD_VISIBLE_TIMEOUT_MS = 10_000;

// Hard input caps — RFC 5321 says 320 chars max for an address; bcrypt
// inputs above ~256 are nonsense.
const EMAIL_MAX_LENGTH = 320;
const PASSWORD_MAX_LENGTH = 256;

export default function Login({
  initialEmail = "",
  initialPassword = "",
  loading = false,
  error = null,
  variant,
}: LoginProps = {}) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState(initialPassword);
  const [showPassword, setShowPassword] = useState(false);
  const [staySignedIn, setStaySignedIn] = useState(false);
  /** Track whether user has interacted with each field — only show
      validation errors after blur, not while typing fresh. */
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  /** Anti-double-submit guard for Google OAuth (no loading prop for it). */
  const [googleInFlight, setGoogleInFlight] = useState(false);

  // Validation — uses trimmed value internally so leading/trailing
  // whitespace doesn't slip through to the server.
  const emailV = validateEmail(email);
  const passwordV = validatePassword(password);
  const canSubmit = emailV.valid && passwordV.valid && !loading;

  // Show inline error only after the user has touched (focused) the field
  // AND their value is invalid. Prevents the "yelling at me before I've typed"
  // anti-pattern.
  const emailError = emailTouched ? emailV.message : null;
  const passwordError = passwordTouched
    ? passwordV.message ||
      (passwordHasEdgeWhitespace(password)
        ? "Password has leading or trailing spaces — check your paste."
        : null)
    : null;

  // Analytics: fire login_viewed exactly once on mount, even if `variant`
  // prop changes mid-session. Capture variant via ref to avoid the
  // "[variant]" dep firing the event twice.
  const variantRef = useRef(variant);
  variantRef.current = variant;
  useEffect(() => {
    trackAuth(loginViewedEvent(variantRef.current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-hide password after timeout — over-shoulder protection.
  useEffect(() => {
    if (!showPassword) return;
    const id = setTimeout(
      () => setShowPassword(false),
      PASSWORD_VISIBLE_TIMEOUT_MS,
    );
    return () => clearTimeout(id);
  }, [showPassword]);

  // autoFocus only on initial mount + only if the page is the active tab.
  // Prevents focus-stealing if the user opens this in a background tab.
  const [shouldAutoFocus] = useState(() => {
    if (typeof document === "undefined") return false;
    return document.visibilityState === "visible";
  });

  const handleGoogle = useCallback(() => {
    if (googleInFlight || loading) return;
    setGoogleInFlight(true);
    trackAuth({ type: "login_method_selected", method: "google" });
    trackAuth({ type: "login_submitted", method: "google" });
    // Re-enable after a beat in case OAuth flow is cancelled
    setTimeout(() => setGoogleInFlight(false), 2000);
  }, [googleInFlight, loading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Mark both fields touched so per-field errors surface even if the
    // user pressed Enter without ever focusing (e.g., from autofill).
    setEmailTouched(true);
    setPasswordTouched(true);
    if (!canSubmit) return;
    // Sanitize before any downstream consumer (analytics + API). The state
    // value remains the user's raw input so the field doesn't repaint
    // mid-submit; the sanitized form is what we send to the server.
    const cleanEmail = sanitizeEmail(email);
    void cleanEmail; // production wiring: pass to supabase.auth.signInWithPassword
    trackAuth({ type: "login_method_selected", method: "email" });
    trackAuth({ type: "login_submitted", method: "email" });
  };

  const handlePasswordVisibility = () => {
    setShowPassword((v) => {
      trackAuth({ type: "login_password_visibility_toggled", visible: !v });
      return !v;
    });
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
        {/* Top bar */}
        <header
          className="hsx-login-topbar"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "32px 48px",
            gap: 16,
          }}
        >
          <Wordmark />
          <div
            className="hsx-login-signup-prompt"
            style={{ fontFamily: f.sans, fontSize: 14, color: t.inkSoft }}
          >
            <span className="hsx-login-signup-text">
              Don't have an account?{" "}
            </span>
            <a
              href="#signup"
              className="hsx-link-indigo"
              onClick={() => trackAuth({ type: "login_signup_clicked" })}
              style={{
                color: t.indigo,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Sign up
            </a>
          </div>
        </header>

        {/* Centered hero + form */}
        <main
          className="hsx-login-main"
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "clamp(24px, 4vh, 64px) 24px",
          }}
        >
          <div className="hsx-login-form" style={{ width: "100%", maxWidth: 540 }}>
            {/* Editorial headline — copper italic accent on ONE word.
                Instrument Serif ships only at weight 400; do not bump. */}
            <h1
              id="login-heading"
              style={{
                fontFamily: f.serif,
                fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
                lineHeight: 1.05,
                fontWeight: 400,
                letterSpacing: "-0.02em",
                textAlign: "center",
                textWrap: "balance",
                margin: 0,
                color: t.coal,
              }}
            >
              Clarity{" "}
              <em
                style={{
                  fontStyle: "italic",
                  fontWeight: 400,
                  color: t.copper,
                }}
              >
                wins
              </em>{" "}
              interviews
            </h1>
            <p
              className="hsx-login-subtitle h-[50px]"
              style={{ fontFamily: f.sans, fontSize: 16, lineHeight: 1.55, color: t.inkSoft, textAlign: "center", marginTop: 18, marginBottom: 44, textWrap: "balance" }}
            >
              Practise interviews. Improve how you think under pressure. One
              answer at a time.
            </p>

            {/* Google CTA */}
            <button
              type="button"
              className="hsx-login-google"
              onClick={handleGoogle}
              disabled={googleInFlight || loading}
              aria-busy={googleInFlight || undefined}
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
                cursor:
                  googleInFlight || loading ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                boxShadow: shadows.card,
                opacity: googleInFlight || loading ? 0.7 : 1,
              }}
            >
              <GoogleIcon />
              {googleInFlight ? "Opening Google…" : "Continue with Google"}
            </button>

            {/* Divider */}
            <div
              className="hsx-login-divider"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                margin: "20px 0",
              }}
            >
              <div style={{ flex: 1, height: 1, background: t.line }} />
              <span
                style={{ fontFamily: f.sans, fontSize: 13, color: t.inkFaint }}
              >
                or
              </span>
              <div style={{ flex: 1, height: 1, background: t.line }} />
            </div>

            {/* Server error banner */}
            {error && (
              <div
                role="alert"
                id="login-error"
                className="hsx-error-banner"
                style={{
                  background: t.error100,
                  border: `1px solid ${t.error}`,
                  borderRadius: 10,
                  padding: "12px 14px",
                  marginBottom: 16,
                  fontFamily: f.sans,
                  fontSize: 13,
                  color: t.error,
                  lineHeight: 1.4,
                }}
              >
                {error}
              </div>
            )}

            {/* Form */}
            <form
              onSubmit={handleSubmit}
              aria-labelledby="login-heading"
              aria-describedby={error ? "login-error" : undefined}
              className="hsx-login-form-fields"
              style={{ display: "flex", flexDirection: "column", gap: 18 }}
            >
              <Field
                label="Email Address"
                type="email"
                name="email"
                value={email}
                onChange={(v) => setEmail(v)}
                onFocus={() => {
                  if (!emailTouched) {
                    trackAuth({ type: "login_field_focused", field: "email" });
                  }
                  setEmailTouched(true);
                }}
                onAutofill={() => setEmailTouched(true)}
                autoComplete="email"
                placeholder="rahul@example.com"
                autoFocus={shouldAutoFocus}
                inputMode="email"
                enterKeyHint="next"
                maxLength={EMAIL_MAX_LENGTH}
                invalid={!!error || (emailTouched && !!emailV.message)}
                errorMessage={emailError}
              />
              <Field
                label="Password"
                type={showPassword ? "text" : "password"}
                name="password"
                value={password}
                onChange={(v) => setPassword(v)}
                onFocus={() => {
                  if (!passwordTouched) {
                    trackAuth({ type: "login_field_focused", field: "password" });
                  }
                  setPasswordTouched(true);
                }}
                onAutofill={() => setPasswordTouched(true)}
                autoComplete="current-password"
                placeholder="Enter your password"
                enterKeyHint="go"
                maxLength={PASSWORD_MAX_LENGTH}
                invalid={!!error || (passwordTouched && !!passwordV.message)}
                errorMessage={passwordError}
                rightSlot={
                  <button
                    type="button"
                    className="hsx-eye-toggle"
                    onClick={handlePasswordVisibility}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    aria-pressed={showPassword}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: t.inkSoft,
                      cursor: "pointer",
                      padding: 4,
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <EyeIcon open={showPassword} />
                  </button>
                }
              />

              {/* Inline row: stay signed in + forgot password */}
              <div
                className="hsx-login-meta-row"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: 2,
                }}
              >
                <Checkbox
                  checked={staySignedIn}
                  onChange={setStaySignedIn}
                  label="Stay signed in on this device"
                  description="Keeps you signed in for 30 days on this device. Don't enable on shared computers."
                />
                <a
                  href="#forgot"
                  className="hsx-link-indigo"
                  onClick={() =>
                    trackAuth({ type: "login_forgot_password_clicked" })
                  }
                  style={{
                    fontFamily: f.sans,
                    fontSize: 13,
                    fontWeight: 500,
                    color: t.indigo,
                    textDecoration: "none",
                  }}
                >
                  Forgot password
                </a>
              </div>

              {/* Primary CTA */}
              <button
                type="submit"
                disabled={!canSubmit}
                aria-busy={loading || undefined}
                className="hsx-login-cta"
                style={{
                  width: "100%",
                  fontFamily: f.sans,
                  fontSize: 15,
                  fontWeight: 600,
                  color: t.cream,
                  background: canSubmit ? t.indigo : t.indigoGray,
                  border: "none",
                  borderRadius: 10,
                  padding: "16px 18px",
                  cursor: canSubmit ? "pointer" : "not-allowed",
                  marginTop: 14,
                  boxShadow: canSubmit ? shadows.cta : "none",
                  letterSpacing: 0.1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  opacity: loading ? 0.85 : 1,
                }}
              >
                {loading ? (
                  <>
                    <Spinner />
                    Signing in…
                  </>
                ) : (
                  <>
                    Continue to practise
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
            </form>
          </div>
        </main>

        {/* Footer legal microcopy */}
        <footer
          className="hsx-login-footer"
          style={{
            textAlign: "center",
            padding: "20px 24px 28px",
            fontFamily: f.sans,
            fontSize: 12,
            color: t.inkFaint,
            lineHeight: 1.6,
            maxWidth: 480,
            margin: "0 auto",
          }}
        >
          By clicking &ldquo;Log in with Google&rdquo; or &ldquo;Continue with email&rdquo;
          <br />
          you agree to our{" "}
          <a
            href="#terms"
            className="hsx-link-muted"
            style={{
              color: t.indigo,
              textDecoration: "underline",
              fontWeight: 500,
            }}
          >
            Terms of Use
          </a>{" "}
          and{" "}
          <a
            href="#privacy"
            className="hsx-link-muted"
            style={{
              color: t.indigo,
              textDecoration: "underline",
              fontWeight: 500,
            }}
          >
            Privacy Policy
          </a>
        </footer>
      </div>
    </>
  );
}
