/* HireStepX — Signup (production)
   Wires real Supabase signup via useAuth().signup, redirect handling,
   plan param preservation, error mapping. */
"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth, storePendingReferralCode } from "../AuthContext";
import { tokens as t, fonts as f, shadows } from "./_tokens";
import {
  Field,
  Checkbox,
  Wordmark,
  GoogleIcon,
  Spinner,
  EyeIcon,
  PasswordStrengthMeter,
  PasswordChecklist,
} from "./_fields";
import { AUTH_STYLES } from "./_styles";
import {
  checkPasswordBreached,
  isDisposableEmail,
  passwordHasEdgeWhitespace,
  sanitizeEmail,
  validateEmail,
  validateName,
  validateSignupPassword,
} from "./_validation";
import { trackAuth, loginViewedEvent } from "./_analytics";
import {
  buildAuthLink,
  computeAuthRedirect,
  detectEmailProvider,
  isResetInProgress,
  mapAuthError,
  suggestEmailCorrection,
  useIsMounted,
} from "./_shell";

const PASSWORD_VISIBLE_TIMEOUT_MS = 10_000;
// Matches the server-side max in AuthContext.signup() so the input
// can't even hold an over-length name (avoids "looks valid until submit").
// Lengths capped tighter than RFC permits because:
//   • NAME 40 chars: real names rarely exceed this; the visual overflow
//     past field width was making signup forms look broken.
//   • EMAIL 254 chars: RFC 5321 hard ceiling. The previous 320 was based
//     on RFC 5322 (longest theoretically possible address) but no real
//     mail server accepts addresses above 254.
//   • PASSWORD 128: bcrypt input cap is 72 bytes; anything longer is
//     effectively truncated. Trimming visible cap to 128 prevents the
//     misleading "I set a 200-char password" UX.
const NAME_MAX_LENGTH = 40;
const EMAIL_MAX_LENGTH = 254;
const PASSWORD_MAX_LENGTH = 128;

export default function Signup() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signup, loginWithGoogle, isLoggedIn, user } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsAttempted, setTermsAttempted] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleInFlight, setGoogleInFlight] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signupSent, setSignupSent] = useState(false);
  // Honeypot — bots fill any input they see; humans don't see this one
  // (visually + screen-reader hidden, tabIndex -1). If it has a value at
  // submit, we silently no-op the request.
  const [honeypot, setHoneypot] = useState("");
  // (Turnstile removed — relying on email-link verification, server-side
  // rate limits, honeypot, and disposable-email blocklist instead. The
  // JS challenge approach was blocked by ~5% of users via ad blockers
  // for ~zero spam reduction we couldn't already achieve cheaper.)
  const isMounted = useIsMounted();
  // Suggest typo correction (e.g. "rahul@gmial.com" → "rahul@gmail.com").
  // Only computed when the user has touched the field and value is non-empty.
  const emailSuggestion = emailTouched ? suggestEmailCorrection(email) : null;

  // Resend-verification state on the success screen.
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(
      () => setResendCooldown((s) => Math.max(0, s - 1)),
      1000,
    );
    return () => clearInterval(id);
  }, [resendCooldown]);

  const handleResendVerification = useCallback(async () => {
    if (resendCooldown > 0 || resending) return;
    setResending(true);
    setResendError(null);
    try {
      const cleanEmail = sanitizeEmail(email);
      const res = await fetch("/api/send-welcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, name: name.trim() }),
      });
      if (!isMounted.current) return;
      if (res.status === 429) {
        setResendError(
          "Too many requests. Try again in a few minutes.",
        );
      } else if (!res.ok) {
        setResendError("Couldn't send the email. Try again in a moment.");
      } else {
        setResendCooldown(60);
      }
    } catch {
      if (!isMounted.current) return;
      setResendError("Couldn't reach our servers. Check your connection.");
    } finally {
      if (isMounted.current) setResending(false);
    }
  }, [resendCooldown, resending, email, name, isMounted]);

  // Validation
  const nameV = validateName(name);
  const emailV = validateEmail(email);
  const passwordV = validateSignupPassword(password);
  const canSubmit =
    nameV.valid &&
    emailV.valid &&
    passwordV.valid &&
    termsAccepted &&
    !loading;

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

  const computeRedirect = useCallback(
    () =>
      computeAuthRedirect({
        next: nextParam,
        plan: planParam,
        hasCompletedOnboarding: !!user?.hasCompletedOnboarding,
      }),
    [nextParam, planParam, user],
  );

  // Already-logged-in: bounce to destination — UNLESS another tab is
  // mid password-reset (recovery session leaks across tabs).
  useEffect(() => {
    if (isLoggedIn && user && !isResetInProgress()) {
      router.replace(computeRedirect());
    }
  }, [isLoggedIn, user, router, computeRedirect]);

  useEffect(() => {
    trackAuth(loginViewedEvent("signup"));
  }, []);

  // Capture a referral code from the signup link (/signup?ref=HSX-XXXXXX) so it
  // can be applied once the account is verified and signed in. Stored, not
  // applied here — the user has no session yet.
  useEffect(() => {
    storePendingReferralCode(searchParams?.get("ref") ?? null);
  }, [searchParams]);

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

    const fallback = setTimeout(() => {
      if (isMounted.current) setGoogleInFlight(false);
    }, 8000);

    const start = Date.now();
    try {
      const result = await loginWithGoogle(computeRedirect());
      if (!isMounted.current) return;
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
        return;
      }
    } catch (e) {
      if (!isMounted.current) return;
      setError(mapAuthError(e instanceof Error ? e.message : undefined));
      trackAuth({ type: "login_failed", method: "google", reason: "unknown" });
    } finally {
      clearTimeout(fallback);
    }
    if (isMounted.current) setGoogleInFlight(false);
  }, [googleInFlight, loading, loginWithGoogle, computeRedirect, isMounted]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setNameTouched(true);
      setEmailTouched(true);
      setPasswordTouched(true);
      setTermsAttempted(true);
      // Honeypot trip — silently no-op + fake success so bots get nothing
      // useful back. Don't even fire analytics — these aren't real submits.
      if (honeypot) {
        setSignupSent(true);
        return;
      }
      if (!canSubmit) return;

      setError(null);

      // Disposable / throwaway-email block — runs before any network
      // call so attackers farming free-tier credits via mailinator etc.
      // hit a fast clean reject. Curated domain list; legitimate users
      // never have one of these.
      const cleanForDispoCheck = sanitizeEmail(email);
      if (isDisposableEmail(cleanForDispoCheck)) {
        setError(
          "Please use a permanent email address — temporary inboxes aren't supported.",
        );
        return;
      }

      setLoading(true);

      // Have I Been Pwned check — k-anonymous, only first 5 SHA-1 chars
      // leave the browser. Fails open if HIBP is unreachable.
      const breach = await checkPasswordBreached(password);
      if (!isMounted.current) return;
      if (breach.breached) {
        setError(
          "This password is too common — attackers already know it. Try a different one.",
        );
        setLoading(false);
        return;
      }
      // HIBP unreachable — surface soft warning instead of failing
      // silently. We still proceed (fail-open) so users on networks
      // that block HIBP aren't permanently blocked from signing up,
      // but they get told we couldn't check and can pick a stronger
      // one if they want. Audit P1 #10.
      if (breach.unknown) {
        // Non-blocking — log it for ops + surface as a console hint
        // (we don't want to spam the form with a network-failure
        // banner that gates submit).
        console.warn("[signup] HIBP breach check unreachable — proceeding without verification");
      }

      // No client-side bot check. Bot prevention now lives on
      // the server: rate limits, honeypot field, email-link verification
      // (account can't be activated without clicking the link), and
      // disposable-email blocklist.

      const cleanEmail = sanitizeEmail(email);
      trackAuth({ type: "login_method_selected", method: "email" });
      trackAuth({ type: "login_submitted", method: "email" });
      const start = Date.now();
      try {
        const result = await signup(cleanEmail, name.trim(), password);
        if (!isMounted.current) return;
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
        if (!isMounted.current) return;
        const msg = err instanceof Error ? err.message : undefined;
        setError(mapAuthError(msg));
        trackAuth({ type: "login_failed", method: "email", reason: "network" });
      } finally {
        if (isMounted.current) setLoading(false);
      }
    },
    [canSubmit, email, name, password, signup, honeypot, isMounted],
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
            <a
              href="/"
              aria-label="HireStepX home"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <Wordmark />
            </a>
          </header>
          <main
            // role=status + aria-live ensures SR users hear the transition
            // from form → confirmation as a single coherent announcement.
            role="status"
            aria-live="polite"
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

              {/* Action row: webmail deep link + change email + try again. */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  marginTop: 32,
                  alignItems: "center",
                }}
              >
                {(() => {
                  const provider = detectEmailProvider(email);
                  if (!provider) return null;
                  return (
                    <a
                      href={provider.url}
                      target="_blank"
                      rel="noopener"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        fontFamily: f.sans,
                        fontSize: 14,
                        fontWeight: 600,
                        color: t.cream,
                        background: t.indigo,
                        border: "1px solid transparent",
                        borderRadius: 10,
                        padding: "12px 20px",
                        textDecoration: "none",
                        boxShadow: shadows.cta,
                        minWidth: 200,
                      }}
                    >
                      Open {provider.name}
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M7 17L17 7" />
                        <polyline points="7 7 17 7 17 17" />
                      </svg>
                    </a>
                  );
                })()}

                {/* Resend verification email — styled to match the white
                    "Resend link" button on /forgot-password (sent state)
                    so the two transactional-email flows feel consistent.
                    60s cooldown matches the server rate limit. */}
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={resendCooldown > 0 || resending}
                  aria-busy={resending || undefined}
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
                      resendCooldown > 0 || resending
                        ? "not-allowed"
                        : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    boxShadow: shadows.card,
                    opacity: resendCooldown > 0 || resending ? 0.6 : 1,
                  }}
                >
                  {resending ? (
                    <>
                      <Spinner />
                      Resending…
                    </>
                  ) : resendCooldown > 0 ? (
                    <span aria-live="polite">
                      Resend in {resendCooldown}s
                    </span>
                  ) : (
                    <span aria-live="polite">Resend verification email</span>
                  )}
                </button>
                {resendError && (
                  <p
                    role="alert"
                    style={{
                      fontFamily: f.sans,
                      fontSize: 12,
                      color: t.error,
                      margin: 0,
                      textAlign: "center",
                    }}
                  >
                    {resendError}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => setSignupSent(false)}
                  style={{
                    fontFamily: f.sans,
                    fontSize: 14,
                    fontWeight: 500,
                    color: t.indigo,
                    background: "transparent",
                    border: "none",
                    textDecoration: "none",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  <span className="hsx-link-indigo">
                    Wrong email? Change it
                  </span>
                </button>
                <p
                  style={{
                    fontFamily: f.mono,
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    color: t.inkFaint,
                    margin: 0,
                  }}
                >
                  Didn't see it? Check spam folder.
                </p>
              </div>
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
          <a
            href="/"
            aria-label="HireStepX home"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <Wordmark />
          </a>
          <div
            className="hsx-login-signup-prompt"
            style={{ fontFamily: f.sans, fontSize: 14, color: t.inkSoft }}
          >
            <span className="hsx-login-signup-text">
              Already have an account?{" "}
            </span>
            <a
              href={buildAuthLink("/login", searchParams)}
              className="hsx-link-indigo"
              style={{
                color: t.indigo,
                fontWeight: 600,
                textDecoration: "none",
                /* 44px min touch target (WCAG 2.5.5) without visual bloat */
                display: "inline-flex",
                alignItems: "center",
                minHeight: 44,
                padding: "0 2px",
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
          {/* Hero — full-width container with one-line headline at desktop.
              CSS @media in _styles re-enables wrapping below 760px viewport. */}
          <div
            className="hsx-login-hero"
            style={{
              width: "100%",
              textAlign: "center",
              marginBottom: 36,
            }}
          >
            <h1
              id="signup-heading"
              style={{
                fontFamily: f.serif,
                fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
                lineHeight: 1.05,
                fontWeight: 400,
                letterSpacing: "-0.02em",
                whiteSpace: "nowrap",
                margin: 0,
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
                marginTop: 18,
                marginBottom: 0,
                textWrap: "balance",
              }}
            >
              Start practising. Improve with every answer. One step closer to
              your next interview.
            </p>
          </div>

          <div
            className="hsx-login-form"
            style={{ width: "100%", maxWidth: 540 }}
          >
            <button
              type="button"
              className="hsx-login-google"
              onClick={handleGoogle}
              disabled={googleInFlight || loading}
              aria-busy={googleInFlight ? "true" : "false"}
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
                // eslint-disable-next-line jsx-a11y/no-autofocus
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

              {/* Email typo suggestion — shown when domain is within
                  edit-distance 1-2 of a common provider. Click to apply. */}
              {emailSuggestion && !emailV.valid && (
                <p
                  style={{
                    fontFamily: f.sans,
                    fontSize: 13,
                    color: t.inkSoft,
                    margin: "-6px 2px 0",
                    lineHeight: 1.4,
                  }}
                >
                  Did you mean{" "}
                  <button
                    type="button"
                    onClick={() => setEmail(emailSuggestion)}
                    className="hsx-link-indigo"
                    style={{
                      background: "transparent",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      color: t.indigo,
                      fontWeight: 600,
                      fontFamily: f.sans,
                      fontSize: 13,
                    }}
                  >
                    {emailSuggestion}
                  </button>
                  ?
                </p>
              )}

              {/* Honeypot field — visually + SR-hidden, off the tab order.
                  Bots fill any input they see; humans never see this one. */}
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  width: 1,
                  height: 1,
                  padding: 0,
                  margin: -1,
                  overflow: "hidden",
                  clip: "rect(0,0,0,0)",
                  whiteSpace: "nowrap",
                  border: 0,
                }}
              >
                <label htmlFor="hsx-referral-display-name">
                  Referral display name (leave blank)
                </label>
                <input
                  id="hsx-referral-display-name"
                  type="text"
                  // Avoid the well-known "website"/"url" honeypot field
                  // names that sophisticated bots specifically skip.
                  name="referral_display_name"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                />
              </div>

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
                  <>
                    <PasswordStrengthMeter
                      score={passwordV.score}
                      label={passwordV.label}
                    />
                    <PasswordChecklist checks={passwordV.checks} />
                  </>
                )}
              </div>

              {/* Required: Terms acknowledgement (DPDP-friendly explicit consent) */}
              <div style={{ marginTop: 4 }}>
                <Checkbox
                  checked={termsAccepted}
                  onChange={(v) => {
                    setTermsAccepted(v);
                    if (v && termsAttempted) setTermsAttempted(false);
                  }}
                  label="I agree to the Terms of Use and Privacy Policy"
                  description="Required. You can review them in the footer."
                />
                {termsAttempted && !termsAccepted && (
                  <p
                    role="alert"
                    style={{
                      fontFamily: f.sans,
                      fontSize: 12,
                      color: t.error,
                      margin: "6px 26px 0",
                      lineHeight: 1.4,
                    }}
                  >
                    Please accept the Terms to continue.
                  </p>
                )}
              </div>


              {(() => {
                // Three states: enabled CTA, in-flight (loading), or
                // ghost-disabled (something incomplete). The ghost treatment
                // signals "no action available" without looking dimmed-active.
                const isGhost = !canSubmit && !loading;
                const tooltip = isGhost
                  ? !nameV.valid
                    ? "Enter your name to continue"
                    : !emailV.valid
                      ? "Enter a valid email to continue"
                      : !passwordV.valid
                        ? "Choose a password that meets the requirements"
                        : !termsAccepted
                          ? "Accept the Terms to continue"
                          : "Complete the form to continue"
                  : undefined;
                return (
                  <button
                    type="submit"
                    disabled={!canSubmit}
                    aria-busy={loading ? "true" : "false"}
                    title={tooltip}
                    className="hsx-login-cta"
                    style={{
                      width: "100%",
                      fontFamily: f.sans,
                      fontSize: 15,
                      fontWeight: 600,
                      color: isGhost ? t.inkFaint : t.cream,
                      background: isGhost ? t.creamSoft : t.indigo,
                      border: isGhost
                        ? `1px solid ${t.line}`
                        : "1px solid transparent",
                      borderRadius: 10,
                      padding: "16px 18px",
                      cursor: canSubmit ? "pointer" : "not-allowed",
                      marginTop: 8,
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
                        <Spinner color={t.cream} />
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
                );
              })()}
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
            /* 2.0 line-height → 24px per line = WCAG 2.2 AA 2.5.8 minimum tap height */
            lineHeight: 2.0,
            maxWidth: 480,
            margin: "0 auto",
          }}
        >
          By creating an account you agree to our{" "}
          <a
            href="/terms"
            target="_blank"
            rel="noopener"
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
            target="_blank"
            rel="noopener"
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
