/* HireStepX — Authentication / Signup
   Mirrors the Login surface — same shell, same atoms — but tuned for
   first-time users: name field, password strength meter, free-tier
   value signal, signup-specific copy, marketing-consent checkbox.
   Discipline rule: Indigo is interactive · Copper is editorial · Never mix. */
import React, { useCallback, useEffect, useState } from "react";
import { tokens as t, fonts as f, shadows } from "../design-system/_tokens";
import {
  Field,
  Checkbox,
  Wordmark,
  GoogleIcon,
  Spinner,
  EyeIcon,
  PasswordStrengthMeter,
  PasswordChecklist,
} from "./_auth-fields";
import { AUTH_STYLES } from "./_auth-styles";
import {
  passwordHasEdgeWhitespace,
  sanitizeEmail,
  validateEmail,
  validateName,
  validateSignupPassword,
} from "./_auth-validation";
import { trackAuth, loginViewedEvent } from "./_auth-analytics";

const PASSWORD_VISIBLE_TIMEOUT_MS = 10_000;
const NAME_MAX_LENGTH = 64;
const EMAIL_MAX_LENGTH = 320;
const PASSWORD_MAX_LENGTH = 256;

export interface SignupProps {
  initialName?: string;
  initialEmail?: string;
  initialPassword?: string;
  /** Show the loading state on the primary CTA */
  loading?: boolean;
  /** Render an error banner above the form (server-side errors) */
  error?: string | null;
  /** Variant tag for analytics A/B tracking */
  variant?: string;
}

export default function Signup({
  initialName = "",
  initialEmail = "",
  initialPassword = "",
  loading = false,
  error = null,
}: SignupProps = {}) {
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState(initialPassword);
  const [showPassword, setShowPassword] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);

  const [nameTouched, setNameTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  // Validation
  const nameV = validateName(name);
  const emailV = validateEmail(email);
  const passwordV = validateSignupPassword(password);
  const canSubmit =
    nameV.valid && emailV.valid && passwordV.valid && !loading;

  const nameError = nameTouched ? nameV.message : null;
  const emailError = emailTouched ? emailV.message : null;
  const passwordError = passwordTouched
    ? passwordV.message ||
      (passwordHasEdgeWhitespace(password)
        ? "Password has leading or trailing spaces — check your paste."
        : null)
    : null;

  // Analytics: viewed once
  useEffect(() => {
    trackAuth(loginViewedEvent("signup"));
  }, []);

  // Auto-hide password timeout
  useEffect(() => {
    if (!showPassword) return;
    const id = setTimeout(
      () => setShowPassword(false),
      PASSWORD_VISIBLE_TIMEOUT_MS,
    );
    return () => clearTimeout(id);
  }, [showPassword]);

  const [shouldAutoFocus] = useState(() => {
    if (typeof document === "undefined") return false;
    return document.visibilityState === "visible";
  });

  const handleGoogle = useCallback(() => {
    if (loading) return;
    trackAuth({ type: "login_method_selected", method: "google" });
    trackAuth({ type: "login_submitted", method: "google" });
  }, [loading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setNameTouched(true);
    setEmailTouched(true);
    setPasswordTouched(true);
    if (!canSubmit) return;
    const cleanEmail = sanitizeEmail(email);
    void cleanEmail; // production wiring: pass to supabase.auth.signUp
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
              Already have an account?{" "}
            </span>
            <a
              href="#login"
              className="hsx-link-indigo"
              style={{
                color: t.indigo,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Log in
            </a>
          </div>
        </header>

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
          <div
            className="hsx-login-form"
            style={{ width: "100%", maxWidth: 540 }}
          >
            {/* Editorial headline — ONE copper italic moment */}
            <h1
              id="signup-heading"
              style={{
                fontFamily: f.serif,
                // Same scale as Login. The longer sentence needs more room than
                // the 540px form column, so we break out of the parent: position
                // relative + translateX(-50%) re-centers the heading on the
                // parent's centerline regardless of parent width, while the
                // explicit width pulls from the wider main area.
                // textWrap:balance keeps any wrap visually even on narrow screens.
                fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
                lineHeight: 1.05,
                fontWeight: 400,
                letterSpacing: "-0.02em",
                textAlign: "center",
                textWrap: "balance",
                margin: 0,
                position: "relative",
                left: "50%",
                transform: "translateX(-50%)",
                width: "max-content",
                maxWidth: "calc(100vw - 48px)",
                color: t.coal,
              }}
            >
              Practise like the{" "}
              <em
                style={{
                  fontStyle: "italic",
                  fontWeight: 400,
                  color: t.copper,
                }}
              >
                real thing
              </em>
              .
            </h1>
            <p
              className="hsx-login-subtitle"
              style={{
                fontFamily: f.sans,
                fontSize: 16,
                lineHeight: 1.55,
                color: t.inkSoft,
                textAlign: "center",
                marginTop: 18,
                marginBottom: 28,
                textWrap: "balance",
              }}
            >Start practising. Improve with every answer. One step closerto your next interview.</p>

            {/* Free tier signal — JetBrains Mono micro-cap, indigo accent */}

            <button
              type="button"
              className="hsx-login-google"
              onClick={handleGoogle}
              disabled={loading}
              style={{ width: "100%", fontFamily: f.sans, fontSize: 15, fontWeight: 500, color: t.coal, background: t.white, border: `1px solid ${t.line}`, borderRadius: 10, padding: "14px 18px", cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 12, boxShadow: shadows.card, opacity: loading ? 0.7 : 1, whiteSpace: "nowrap" }}
            >
              <GoogleIcon />
              Continue with Google
            </button>

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
              >or</span>
              <div style={{ flex: 1, height: 1, background: t.line }} />
            </div>

            {error && (
              <div
                role="alert"
                id="signup-error"
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

            <form
              onSubmit={handleSubmit}
              aria-labelledby="signup-heading"
              aria-describedby={error ? "signup-error" : undefined}
              className="hsx-login-form-fields"
              style={{ display: "flex", flexDirection: "column", gap: 18 }}
            >
              <Field
                label="Your name"
                type="text"
                name="name"
                value={name}
                onChange={(v) => setName(v)}
                onFocus={() => setNameTouched(true)}
                onAutofill={() => setNameTouched(true)}
                autoComplete="name"
                placeholder="Rahul Sharma"
                autoFocus={shouldAutoFocus}
                enterKeyHint="next"
                maxLength={NAME_MAX_LENGTH}
                invalid={!!error || (nameTouched && !!nameV.message)}
                errorMessage={nameError}
              />
              <Field
                label="Email Address"
                type="email"
                name="email"
                value={email}
                onChange={(v) => setEmail(v)}
                onFocus={() => setEmailTouched(true)}
                onAutofill={() => setEmailTouched(true)}
                autoComplete="email"
                placeholder="rahul@example.com"
                inputMode="email"
                enterKeyHint="next"
                maxLength={EMAIL_MAX_LENGTH}
                invalid={!!error || (emailTouched && !!emailV.message)}
                errorMessage={emailError}
              />
              <div>
                <Field
                  label="Password"
                  type={showPassword ? "text" : "password"}
                  name="new-password"
                  value={password}
                  onChange={(v) => setPassword(v)}
                  onFocus={() => setPasswordTouched(true)}
                  onAutofill={() => setPasswordTouched(true)}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  enterKeyHint="go"
                  maxLength={PASSWORD_MAX_LENGTH}
                  invalid={
                    !!error || (passwordTouched && !!passwordV.message)
                  }
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
                {password.length > 0 && (
                  <>
                    <PasswordStrengthMeter
                      score={passwordV.score}
                      label={passwordV.label}
                    />
                    <PasswordChecklist checks={passwordV.checks} />
                  </>
                )}
              </div>

              {/* Marketing consent — DPDP-compliant opt-in (unchecked default) */}
              <div style={{ marginTop: 4 }}>
                <Checkbox
                  checked={marketingOptIn}
                  onChange={setMarketingOptIn}
                  label="Send me interview tips and product updates"
                  description="Optional. We never share your email. Unsubscribe anytime."
                />
              </div>

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
                  marginTop: 8,
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
                    Creating your account…
                  </>
                ) : (
                  <>
                    Create your free account
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
          By creating an account you agree to our{" "}
          <a
            href="#terms"
            className="hsx-link-muted"
            style={{
              color: t.inkSoft,
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
              color: t.inkSoft,
              textDecoration: "underline",
              fontWeight: 500,
            }}
          >
            Privacy Policy
          </a>
          . Your data is encrypted and never sold.
        </footer>
      </div>
    </>
  );
}
