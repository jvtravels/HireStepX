/* HireStepX — Login (production)
   Wires real Supabase auth via useAuth(), redirect handling,
   plan param preservation, login lockout, error mapping. */
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
} from "./_fields";
import { AUTH_STYLES } from "./_styles";
import {
  passwordHasEdgeWhitespace,
  sanitizeEmail,
  validateEmail,
  validatePassword,
} from "./_validation";
import { trackAuth, loginViewedEvent } from "./_analytics";

// Auto-hide password if visible for this long (over-shoulder protection)
const PASSWORD_VISIBLE_TIMEOUT_MS = 10_000;
const EMAIL_MAX_LENGTH = 320;
const PASSWORD_MAX_LENGTH = 256;

// Login lockout — share key with the existing SignUp.tsx so the two
// surfaces don't diverge on lockout state.
const LOCKOUT_STORAGE_KEY = "hirestepx_login_lockout";
const FAILED_ATTEMPTS_KEY = "hirestepx_login_failures";
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000;

function readLockoutSeconds(): number {
  try {
    const until = parseInt(
      localStorage.getItem(LOCKOUT_STORAGE_KEY) || "0",
      10,
    );
    if (until && Date.now() < until) {
      return Math.ceil((until - Date.now()) / 1000);
    }
  } catch {
    /* localStorage may be blocked (incognito, ITP) */
  }
  return 0;
}

function recordFailedAttempt() {
  try {
    const n =
      parseInt(localStorage.getItem(FAILED_ATTEMPTS_KEY) || "0", 10) + 1;
    localStorage.setItem(FAILED_ATTEMPTS_KEY, String(n));
    if (n >= MAX_FAILED_ATTEMPTS) {
      localStorage.setItem(
        LOCKOUT_STORAGE_KEY,
        String(Date.now() + LOCKOUT_DURATION_MS),
      );
      localStorage.removeItem(FAILED_ATTEMPTS_KEY);
    }
  } catch {
    /* ignore */
  }
}

function clearFailedAttempts() {
  try {
    localStorage.removeItem(FAILED_ATTEMPTS_KEY);
    localStorage.removeItem(LOCKOUT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Map Supabase auth errors to user-facing copy. Keep messages short
    and actionable; never leak which field was wrong (security). */
function mapAuthError(raw: string | undefined): string {
  if (!raw) return "Something went wrong. Try again.";
  const msg = raw.toLowerCase();
  if (
    msg.includes("invalid login credentials") ||
    msg.includes("invalid_credentials")
  ) {
    return "Email or password is incorrect. Try again, or reset your password.";
  }
  if (msg.includes("email not confirmed")) {
    return "Please verify your email first. Check your inbox for the confirmation link.";
  }
  if (msg.includes("rate limit") || msg.includes("too many requests")) {
    return "Too many attempts. Try again in a few minutes.";
  }
  if (msg.includes("network") || msg.includes("failed to fetch")) {
    return "Couldn't reach our servers. Check your connection and try again.";
  }
  return raw;
}

export default function Login() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, loginWithGoogle, isLoggedIn, user } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [staySignedIn, setStaySignedIn] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleInFlight, setGoogleInFlight] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockoutSeconds, setLockoutSeconds] = useState(() =>
    readLockoutSeconds(),
  );

  // Validation
  const emailV = validateEmail(email);
  const passwordV = validatePassword(password);
  const isLocked = lockoutSeconds > 0;
  const canSubmit = emailV.valid && passwordV.valid && !loading && !isLocked;

  const emailError = emailTouched ? emailV.message : null;
  const passwordError = passwordTouched
    ? passwordV.message ||
      (passwordHasEdgeWhitespace(password)
        ? "Password has leading or trailing spaces — check your paste."
        : null)
    : null;

  // Plan + redirect param preservation (matches existing SignUp behavior)
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

  // Analytics: viewed once
  useEffect(() => {
    trackAuth(loginViewedEvent());
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

  // Lockout countdown
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const id = setInterval(() => setLockoutSeconds(readLockoutSeconds()), 1000);
    return () => clearInterval(id);
  }, [lockoutSeconds]);

  // autoFocus only if tab is active at mount
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
        return; // OAuth redirect will navigate away
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
        const result = await login(cleanEmail, password);
        if (!result.success) {
          recordFailedAttempt();
          setLockoutSeconds(readLockoutSeconds());
          setError(mapAuthError(result.error));
          trackAuth({
            type: "login_failed",
            method: "email",
            reason: result.error?.toLowerCase().includes("rate")
              ? "rate_limited"
              : "invalid_credentials",
          });
        } else {
          clearFailedAttempts();
          trackAuth({
            type: "login_succeeded",
            method: "email",
            timeMs: Date.now() - start,
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : undefined;
        setError(mapAuthError(msg));
        trackAuth({ type: "login_failed", method: "email", reason: "network" });
      } finally {
        setLoading(false);
      }
    },
    [canSubmit, email, password, login],
  );

  const handlePasswordVisibility = () => {
    setShowPassword((v) => {
      trackAuth({ type: "login_password_visibility_toggled", visible: !v });
      return !v;
    });
  };

  const displayError = isLocked
    ? `Account temporarily locked after too many attempts. Try again in ${Math.ceil(lockoutSeconds / 60)} minute${lockoutSeconds > 60 ? "s" : ""}.`
    : error;

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
              href={planParam ? `/signup?plan=${planParam}` : "/signup"}
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
              id="login-heading"
              style={{
                fontFamily: f.serif,
                fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
                lineHeight: 1.05,
                fontWeight: 400,
                letterSpacing: "-0.02em",
                textAlign: "center",
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
              className="hsx-login-subtitle"
              style={{
                fontFamily: f.sans,
                fontSize: 16,
                lineHeight: 1.55,
                color: t.inkSoft,
                textAlign: "center",
                marginTop: 18,
                marginBottom: 44,
                textWrap: "balance",
              }}
            >
              Practise interviews. Improve how you think under pressure. One
              answer at a time.
            </p>

            <button
              type="button"
              className="hsx-login-google"
              onClick={handleGoogle}
              disabled={googleInFlight || loading || isLocked}
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
                  googleInFlight || loading || isLocked
                    ? "not-allowed"
                    : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                boxShadow: shadows.card,
                opacity: googleInFlight || loading || isLocked ? 0.7 : 1,
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

            {displayError && (
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
                {displayError}
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              aria-labelledby="login-heading"
              aria-describedby={displayError ? "login-error" : undefined}
              className="hsx-login-form-fields"
              style={{ display: "flex", flexDirection: "column", gap: 18 }}
            >
              <Field
                label="Email Address"
                type="email"
                name="email"
                value={email}
                onChange={(v) => {
                  setEmail(v);
                  if (error) setError(null);
                }}
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
                onChange={(v) => {
                  setPassword(v);
                  if (error) setError(null);
                }}
                onFocus={() => {
                  if (!passwordTouched) {
                    trackAuth({
                      type: "login_field_focused",
                      field: "password",
                    });
                  }
                  setPasswordTouched(true);
                }}
                onAutofill={() => setPasswordTouched(true)}
                autoComplete="current-password"
                placeholder="Enter your password"
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
                  href="/reset-password"
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
          By clicking "Log in with Google" or "Continue with email" you agree to
          our{" "}
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
        </footer>
      </div>
    </>
  );
}
