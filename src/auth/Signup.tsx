/* HireStepX — Signup (production)
   Wires real Supabase signup via useAuth().signup, redirect handling,
   plan param preservation, error mapping. */
"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../AuthContext";
import { tokens as t, fonts as f, shadows } from "./_tokens";
import {
  Field,
  Checkbox,
  Wordmark,
  GoogleIcon,
  Spinner,
  EyeIcon,
  PasswordStrengthMeter,
} from "./_fields";
import { AUTH_STYLES } from "./_styles";
import {
  passwordHasEdgeWhitespace,
  sanitizeEmail,
  validateEmail,
  validateName,
  validateSignupPassword,
} from "./_validation";
import { trackAuth, loginViewedEvent } from "./_analytics";

const PASSWORD_VISIBLE_TIMEOUT_MS = 10_000;
const NAME_MAX_LENGTH = 64;
const EMAIL_MAX_LENGTH = 320;
const PASSWORD_MAX_LENGTH = 256;

/** Map Supabase signup errors to user-facing copy. */
function mapAuthError(raw: string | undefined): string {
  if (!raw) return "Something went wrong. Try again.";
  const msg = raw.toLowerCase();
  if (
    msg.includes("already registered") ||
    msg.includes("already exists") ||
    msg.includes("user already")
  ) {
    return "An account with this email already exists. Try logging in instead.";
  }
  if (msg.includes("rate limit") || msg.includes("too many requests")) {
    return "Too many signups from this network. Try again in a few minutes.";
  }
  if (msg.includes("network") || msg.includes("failed to fetch")) {
    return "Couldn't reach our servers. Check your connection and try again.";
  }
  if (msg.includes("password")) {
    // Server-side password rejection — usually echoes our client copy.
    return raw;
  }
  return raw;
}

export default function Signup() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signup, loginWithGoogle, isLoggedIn, user } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleInFlight, setGoogleInFlight] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signupSent, setSignupSent] = useState(false);

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

  // Plan + redirect param preservation
  const planParam = searchParams?.get("plan") ?? null;
  const nextParam = searchParams?.get("next") ?? null;

  const computeRedirect = useCallback(() => {
    if (nextParam && nextParam.startsWith("/")) return nextParam;
    const base = user?.hasCompletedOnboarding ? "/dashboard" : "/onboarding";
    return planParam ? `${base}?plan=${planParam}` : base;
  }, [nextParam, planParam, user]);

  // Already-logged-in: bounce to destination
  useEffect(() => {
    if (isLoggedIn && user) router.replace(computeRedirect());
  }, [isLoggedIn, user, router, computeRedirect]);

  useEffect(() => {
    trackAuth(loginViewedEvent("signup"));
  }, []);

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

  const handleGoogle = useCallback(async () => {
    if (googleInFlight || loading) return;
    setGoogleInFlight(true);
    setError(null);
    trackAuth({ type: "login_method_selected", method: "google" });
    trackAuth({ type: "login_submitted", method: "google" });
    const start = Date.now();
    try {
      const result = await loginWithGoogle(computeRedirect());
      if (!result.success) {
        setError(mapAuthError(result.error));
        trackAuth({
          type: "login_failed",
          method: "google",
          reason: "unknown",
        });
      } else {
        trackAuth({
          type: "login_succeeded",
          method: "google",
          timeMs: Date.now() - start,
        });
        return; // OAuth flow navigates away
      }
    } catch (e) {
      setError(mapAuthError(e instanceof Error ? e.message : undefined));
      trackAuth({ type: "login_failed", method: "google", reason: "unknown" });
    }
    setGoogleInFlight(false);
  }, [googleInFlight, loading, loginWithGoogle, computeRedirect]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setNameTouched(true);
      setEmailTouched(true);
      setPasswordTouched(true);
      if (!canSubmit) return;

      setError(null);
      setLoading(true);
      const cleanEmail = sanitizeEmail(email);
      trackAuth({ type: "login_method_selected", method: "email" });
      trackAuth({ type: "login_submitted", method: "email" });
      const start = Date.now();
      try {
        const result = await signup(cleanEmail, name.trim(), password);
        if (!result.success) {
          setError(mapAuthError(result.error));
          trackAuth({
            type: "login_failed",
            method: "email",
            reason: "invalid_credentials",
          });
        } else {
          trackAuth({
            type: "login_succeeded",
            method: "email",
            timeMs: Date.now() - start,
          });
          // Supabase email-confirm flow returns success but doesn't sign in
          // until the user clicks the verification link. Show the
          // "check your email" state.
          setSignupSent(true);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : undefined;
        setError(mapAuthError(msg));
        trackAuth({ type: "login_failed", method: "email", reason: "network" });
      } finally {
        setLoading(false);
      }
    },
    [canSubmit, email, name, password, signup],
  );

  const handlePasswordVisibility = () => {
    setShowPassword((v) => {
      trackAuth({ type: "login_password_visibility_toggled", visible: !v });
      return !v;
    });
  };

  // Post-signup state: "Check your email" instead of the form
  if (signupSent) {
    return (
      <>
        <style>{AUTH_STYLES}</style>
        <div
          style={{
            background: t.cream,
            minHeight: "100dvh",
            fontFamily: f.sans,
            color: t.coal,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <header
            className="hsx-login-topbar"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "32px 48px",
            }}
          >
            <Wordmark />
          </header>
          <main
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "clamp(24px, 4vh, 64px) 24px",
              textAlign: "center",
            }}
          >
            <div style={{ maxWidth: 480 }}>
              <h1
                style={{
                  fontFamily: f.serif,
                  fontSize: "clamp(2rem, 4.4vw, 3.5rem)",
                  fontWeight: 400,
                  letterSpacing: "-0.02em",
                  margin: 0,
                  color: t.coal,
                }}
              >
                Check your{" "}
                <em style={{ fontStyle: "italic", color: t.copper }}>
                  email
                </em>
                .
              </h1>
              <p
                style={{
                  fontFamily: f.sans,
                  fontSize: 16,
                  lineHeight: 1.55,
                  color: t.inkSoft,
                  marginTop: 18,
                  textWrap: "balance",
                }}
              >
                We sent a verification link to{" "}
                <strong style={{ color: t.coal }}>{sanitizeEmail(email)}</strong>.
                Click it to finish creating your account.
              </p>
              <p
                style={{
                  fontFamily: f.mono,
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  color: t.inkFaint,
                  marginTop: 36,
                }}
              >
                Didn't see it? Check spam, or{" "}
                <a
                  href="/signup"
                  className="hsx-link-indigo"
                  style={{
                    color: t.indigo,
                    textDecoration: "none",
                    fontWeight: 600,
                  }}
                >
                  try again
                </a>
                .
              </p>
            </div>
          </main>
        </div>
      </>
    );
  }

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
              href={planParam ? `/login?plan=${planParam}` : "/login"}
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
            <h1
              id="signup-heading"
              style={{
                fontFamily: f.serif,
                fontSize: "72px",
                lineHeight: 1.05,
                fontWeight: 400,
                letterSpacing: "-0.02em",
                textAlign: "center",
                margin: 0,
                color: t.coal,
                whiteSpace: "nowrap",
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
            >
              Start practising. Improve with every answer. One step closer to
              your next interview.
            </p>

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
                whiteSpace: "nowrap",
              }}
            >
              <GoogleIcon />
              {googleInFlight ? "Opening Google…" : "Continue with Google"}
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
              >
                or
              </span>
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
                onChange={(v) => {
                  setName(v);
                  if (error) setError(null);
                }}
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
                onChange={(v) => {
                  setEmail(v);
                  if (error) setError(null);
                }}
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
                  onChange={(v) => {
                    setPassword(v);
                    if (error) setError(null);
                  }}
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
                  <PasswordStrengthMeter
                    score={passwordV.score}
                    label={passwordV.label}
                  />
                )}
              </div>

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
            href="/terms"
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
            href="/privacy"
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
