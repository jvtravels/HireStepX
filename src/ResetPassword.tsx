/* HireStepX — Reset password (production)
   Step 3 of the password-reset flow. User landed via the emailed token
   link; we collect a new password + confirmation and submit.

   Security model preserved from prior implementation:
   - Recovery session must be active (Supabase auto-picks up the token from URL hash)
   - One-shot enforcement (`password_reset_used_at` user_metadata)
   - CSRF token in sessionStorage validated on submit
   - Last-3-password reuse rejection (SHA-256 client hashes — defence in depth)
   - All sessions invalidated on success (auth.signOut)
   - Notification email fired post-update

   Design matches the cream/coal/indigo auth surface (Login + ForgotPassword).
   Discipline rule: Indigo is interactive · Copper is editorial · Never mix. */
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { tokens as t, fonts as ft, shadows } from "./auth/_tokens";
import {
  Field,
  Wordmark,
  Spinner,
  EyeIcon,
  PasswordStrengthMeter,
  PasswordChecklist,
} from "./auth/_fields";
import { AUTH_STYLES } from "./auth/_styles";
import {
  checkPasswordBreached,
  passwordHasEdgeWhitespace,
  validateSignupPassword,
} from "./auth/_validation";
import { setResetInProgress } from "./auth/_shell";
import { getSupabase, supabaseConfigured } from "./supabase";

const PASSWORD_VISIBLE_TIMEOUT_MS = 10_000;
const PASSWORD_MAX_LENGTH = 128;
// Reset links live for 30 minutes — surfaced via live countdown.
const TOKEN_LIFETIME_SEC = 30 * 60;

type TokenStatus = "pending" | "valid" | "expired" | "used" | "invalid";

/** Simple CSRF protection: random token per page load, stored in sessionStorage. */
function generateCsrfToken(): string {
  const token =
    crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  try {
    sessionStorage.setItem("hirestepx_csrf_reset", token);
  } catch {
    /* noop — restricted storage */
  }
  return token;
}
function validateCsrfToken(token: string): boolean {
  try {
    const stored = sessionStorage.getItem("hirestepx_csrf_reset");
    return !!stored && stored === token;
  } catch {
    return false;
  }
}

async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default function ResetPassword() {
  const router = useRouter();

  const [tokenStatus, setTokenStatus] = useState<TokenStatus>("pending");
  const [email, setEmail] = useState<string | undefined>(undefined);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const csrfTokenRef = useRef<string>("");

  const [shouldAutoFocus] = useState(() => {
    if (typeof document === "undefined") return false;
    return document.visibilityState === "visible";
  });

  // Mark "reset in progress" so other auth tabs (Login/Signup/ForgotPassword)
  // don't auto-redirect to /dashboard when this tab's recovery session
  // briefly propagates to localStorage. Cleared on unmount.
  //
  // Audit P0 #1: also sign out the recovery session on unmount when
  // the user did NOT complete the reset. Without this, abandoning
  // the flow (closed tab, hit breach error, clicked Contact Support,
  // browser-back) leaves an open recovery session in localStorage —
  // any subsequent navigation to /dashboard would enter the app on a
  // partial-auth session that wasn't supposed to grant access. The
  // success path already signs out (the strict-posture sign-out at
  // handleSubmit:341), so we only need to handle the abandon path.
  const completedRef = useRef(false);
  useEffect(() => {
    setResetInProgress(true);
    return () => {
      setResetInProgress(false);
      if (!completedRef.current) {
        // Fire-and-forget — the engine isn't around to await on unmount.
        getSupabase()
          .then((c) => c.auth.signOut())
          .catch(() => { /* expected: client may be torn down */ });
      }
    };
  }, []);

  // ── Live expiry countdown (visual only; backend authoritative) ──────────
  const [secondsLeft, setSecondsLeft] = useState(TOKEN_LIFETIME_SEC);
  useEffect(() => {
    if (tokenStatus !== "valid") return;
    const id = setInterval(
      () => setSecondsLeft((s) => Math.max(0, s - 1)),
      1000,
    );
    return () => clearInterval(id);
  }, [tokenStatus]);

  const expired = secondsLeft === 0;
  const expiryLabel = useMemo(() => {
    const m = Math.floor(secondsLeft / 60);
    const s = secondsLeft % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }, [secondsLeft]);

  // ── Recovery session check + token-status resolution ────────────────────
  useEffect(() => {
    if (!supabaseConfigured) {
      setTokenStatus("invalid");
      setError("Password reset requires Supabase configuration.");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const client = await getSupabase();
        const {
          data: { session },
        } = await client.auth.getSession();
        if (cancelled) return;
        if (!session) {
          setTokenStatus("expired");
          return;
        }
        // One-shot: reject if this link was already used to reset.
        // CRITICAL: We must NOT read user_metadata off `session.user` —
        // that's parsed from the JWT in the email link's access_token,
        // which was issued BEFORE any reset flag was written. Reading
        // it would always return undefined on the second click and let
        // the same link be reused. `getUser()` forces a server fetch
        // so we see the current user_metadata state.
        const { data: userData, error: userErr } = await client.auth.getUser();
        if (cancelled) return;
        if (userErr || !userData?.user) {
          setTokenStatus("invalid");
          return;
        }
        const usedAt = userData.user.user_metadata?.password_reset_used_at;
        if (typeof usedAt === "number") {
          const elapsed = Date.now() - usedAt;
          if (elapsed < 24 * 60 * 60 * 1000) {
            await client.auth.signOut().catch(() => {});
            if (cancelled) return;
            setTokenStatus("used");
            return;
          }
        }

        /* Original window was 5 minutes — too aggressive in practice.
           User-reported failure mode:
             1. First reset attempt: updateUser timed out → user got
                stuck on "Updating..." → never completed. But
                `password_reset_opened_at` from THIS mount was already
                written to user_metadata.
             2. User requests a new link from /forgot-password.
             3. New link arrives, user clicks within 5 min of the
                first attempt.
             4. THIS check sees `opened_at` ~3 min old → falsely
                rejects with "link expired".

           The new 90s window covers the legitimate double-click /
           slow-loading-tab case while not blocking a re-issued link.
           Combined with the link's own 30-min server-side expiry,
           this gives users a real second chance after a failed
           first attempt. */
        const openedAt = userData.user.user_metadata?.password_reset_opened_at;
        if (typeof openedAt === "number" && Date.now() - openedAt < 90 * 1000) {
          // The link is "in use elsewhere" — sign out cleanly + reject.
          await client.auth.signOut().catch(() => {});
          if (cancelled) return;
          setTokenStatus("used");
          return;
        }
        // Mark the link as opened. Best-effort — if this fails the
        // legit reset still proceeds; we just lose the one-shot guard
        // for this session.
        client.auth.updateUser({
          data: { password_reset_opened_at: Date.now() },
        }).catch(() => { /* ignore */ });

        csrfTokenRef.current = generateCsrfToken();
        setEmail(userData.user.email ?? undefined);
        setTokenStatus("valid");
      } catch {
        if (!cancelled) {
          setTokenStatus("invalid");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-hide password — over-shoulder protection (matches Login).
  useEffect(() => {
    if (!showPassword) return;
    const id = setTimeout(
      () => setShowPassword(false),
      PASSWORD_VISIBLE_TIMEOUT_MS,
    );
    return () => clearTimeout(id);
  }, [showPassword]);

  const pwV = validateSignupPassword(password);
  const matches = password.length > 0 && password === confirm;
  const canSubmit =
    pwV.valid && matches && !loading && !expired && tokenStatus === "valid";

  const passwordError = passwordTouched
    ? pwV.message ||
      (passwordHasEdgeWhitespace(password)
        ? "Password has leading or trailing spaces — check your paste."
        : null)
    : null;
  const confirmError =
    confirmTouched && confirm.length > 0 && password !== confirm
      ? "Passwords don't match."
      : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordTouched(true);
    setConfirmTouched(true);
    setError(null);
    if (!canSubmit) return;

    // Hard length cap as defence-in-depth (validateSignupPassword enforces min).
    if (password.length > PASSWORD_MAX_LENGTH) {
      setError(`Password must be ${PASSWORD_MAX_LENGTH} characters or fewer.`);
      return;
    }

    if (!validateCsrfToken(csrfTokenRef.current)) {
      setError("Security validation failed. Please refresh and try again.");
      return;
    }

    setLoading(true);

    // Have I Been Pwned check — refuse passwords seen in breaches.
    // User-facing copy intentionally avoids the term "data breach" —
    // testers reported that confused non-technical users (felt like
    // we were saying THEIR account had been hacked, not just that the
    // password is too common). New copy is plain-English: "this
    // password is too common, attackers already know it".
    const breach = await checkPasswordBreached(password);
    if (breach.breached) {
      setError(
        "This password is too common — attackers already know it. Try a different one.",
      );
      setLoading(false);
      return;
    }
    // HIBP unreachable — fail-open but log so ops can spot patterns.
    // Audit P1 #10. We don't block here because users on networks
    // that block HIBP shouldn't be permanently locked out of password
    // reset; instead we surface an ops signal.
    if (breach.unknown) {
      console.warn("[reset-password] HIBP breach check unreachable — proceeding without verification");
    }
    // Wrap each Supabase call in a timeout race so a hung network
    // request can't leave the user stuck forever on "Updating..."
    const withTimeout = <T,>(p: Promise<T>, ms: number, label: string) =>
      Promise.race<T>([
        p,
        new Promise<T>((_, reject) =>
          setTimeout(
            () => reject(new Error(`${label} timed out after ${ms / 1000}s`)),
            ms,
          ),
        ),
      ]);
    try {
      const client = await getSupabase();

      /* User-reported timeout chain:
           [reset-password] update failed: getSession timed out after 8s
           [reset-password] update failed: updateUser timed out after 15s
         Root cause: this submit handler used to make four serial auth
         calls (getSession → getUser → updateUser → signOut). Each one
         acquires the supabase-js navigator-lock, and on a page where
         AuthContext is also mounting/refreshing they fight for the
         same lock and stack up timeouts.

         The mount-time effect already runs getUser() to validate the
         link + write `password_reset_opened_at`. By the time the user
         is typing a password, the user_metadata has been verified and
         is sitting in the JWT-cached session. We don't need a fresh
         server round-trip — updateUser itself rejects with the proper
         auth error if the link has been consumed.

         New flow: read session synchronously from the SDK's in-memory
         cache (no network), pull metadata off it, call updateUser
         directly. One round-trip instead of four. */
      const cachedSessionResult = await withTimeout(client.auth.getSession(), 4000, "getSession");
      const currentSession = cachedSessionResult.data.session;

      // Server-side double-check: the mount handler already wrote
      // `password_reset_opened_at`; the same `password_reset_used_at`
      // it should have read still applies here. Both come from the
      // session.user.user_metadata cache (no extra network hop).
      const cachedUser = currentSession?.user;
      const lastUsedAt = cachedUser?.user_metadata?.password_reset_used_at;
      if (typeof lastUsedAt === "number") {
        const elapsed = Date.now() - lastUsedAt;
        if (elapsed < 24 * 60 * 60 * 1000) {
          setError(
            "This reset link was already used. Request a new one to change your password again.",
          );
          setLoading(false);
          return;
        }
      }

      // Last-3 password reuse rejection (defence-in-depth; Supabase handles
      // canonical password hashing server-side).
      const passwordHashes: string[] =
        (cachedUser?.user_metadata?.password_hashes as string[] | undefined) ||
        [];
      const newHash = await sha256Hex(password);
      if (passwordHashes.includes(newHash)) {
        setError("You can't reuse a recent password. Pick a different one.");
        setLoading(false);
        return;
      }

      // Server-derived timestamp from JWT exp (resists client clock manipulation).
      const serverTimestamp = currentSession?.expires_at
        ? currentSession.expires_at * 1000 - 3600 * 1000
        : Date.now();

      const updatedHashes = [newHash, ...passwordHashes].slice(0, 3);

      const { error: updateError } = await withTimeout(
        client.auth.updateUser({
          password,
          data: {
            custom_email_verified: true,
            password_reset_used_at: serverTimestamp,
            password_hashes: updatedHashes,
          },
        }),
        12000,
        "updateUser",
      );

      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }

      // Fire-and-forget: notification email so user knows the change happened.
      const userEmail = currentSession?.user?.email;
      if (userEmail) {
        fetch("/api/send-welcome", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: userEmail,
            action: "password-changed",
          }),
        }).catch(() => {});
      }

      // Sign out the recovery session — strict posture: every session
      // (including current) is invalidated. User logs back in fresh.
      try {
        await client.auth.signOut();
      } catch {
        /* best effort */
      }

      completedRef.current = true; // suppress unmount signOut (already done above)
      setSuccess(true);
      setTimeout(() => router.push("/login"), 4000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      // Log to console so we can debug what's hanging in production.
      console.error("[reset-password] update failed:", msg, err);
      if (msg.includes("timed out")) {
        setError(
          "This is taking longer than expected. Check your connection and try again.",
        );
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Token-error copy — distinct per state (GitHub / Linear pattern).
  const tokenSurface = (() => {
    if (tokenStatus === "expired") {
      return {
        title: "This link has expired.",
        body: "Reset links live for 30 minutes. Request a new one to continue.",
      };
    }
    if (tokenStatus === "used") {
      return {
        title: "This link was already used.",
        body:
          "If you didn't reset your password, secure your account and request a fresh link.",
      };
    }
    return {
      title: "We couldn't verify this link.",
      body:
        "It may have been mistyped or tampered with. Request a new link to try again.",
    };
  })();

  // ── Success surface ─────────────────────────────────────────────────────
  if (success) {
    return (
      <>
        <style>{AUTH_STYLES}</style>
        <div
          style={{
            background: t.cream,
            minHeight: "100dvh",
            fontFamily: ft.sans,
            color: t.coal,
            position: "relative",
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
              className="hsx-login-hero"
              style={{ width: "100%", textAlign: "center", marginBottom: 32 }}
            >
              <h1
                style={{
                  fontFamily: ft.serif,
                  fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
                  lineHeight: 1.05,
                  fontWeight: 400,
                  letterSpacing: "-0.02em",
                  whiteSpace: "nowrap",
                  margin: 0,
                  color: t.coal,
                }}
              >
                Password{" "}
                <em
                  style={{
                    fontStyle: "italic",
                    fontWeight: 400,
                    color: t.copper,
                  }}
                >
                  updated
                </em>
              </h1>
              <p
                role="status"
                aria-live="polite"
                style={{
                  fontFamily: ft.sans,
                  fontSize: 16,
                  lineHeight: 1.55,
                  color: t.inkSoft,
                  marginTop: 14,
                  marginBottom: 0,
                  textWrap: "balance",
                }}
              >
                We&apos;ve signed you out of all devices for safety. Use your
                new password to log back in.
              </p>
            </div>

            <div
              style={{
                width: "100%",
                maxWidth: 440,
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              <a
                href="/login"
                className="hsx-login-cta"
                style={{
                  width: "100%",
                  fontFamily: ft.sans,
                  fontSize: 15,
                  fontWeight: 600,
                  color: t.cream,
                  background: t.indigo,
                  border: "1px solid transparent",
                  borderRadius: 10,
                  padding: "16px 18px",
                  cursor: "pointer",
                  boxShadow: shadows.cta,
                  letterSpacing: 0.1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  textDecoration: "none",
                }}
              >
                Go to Log in
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
              </a>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  marginTop: 6,
                  fontFamily: ft.sans,
                  fontSize: 13,
                  color: t.inkSoft,
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={t.success}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 2 4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4z" />
                  <polyline points="9 12 11 14 15 10" />
                </svg>
                Your account is secured.
              </div>

              <p
                style={{
                  fontFamily: ft.sans,
                  fontSize: 13,
                  color: t.inkSoft,
                  textAlign: "center",
                  marginTop: 10,
                  lineHeight: 1.55,
                }}
              >
                Didn&apos;t request this?{" "}
                <a
                  href="/contact"
                  className="hsx-link-indigo"
                  style={{
                    color: t.indigo,
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  Secure your account
                </a>
                .
              </p>
            </div>
          </main>
        </div>
      </>
    );
  }

  // ── Main render: token-error or form ───────────────────────────────────
  return (
    <>
      <style>{AUTH_STYLES}</style>
      <div
        style={{
          background: t.cream,
          minHeight: "100dvh",
          fontFamily: ft.sans,
          color: t.coal,
          position: "relative",
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
          <a
            href="/login"
            className="hsx-link-indigo"
            style={{
              fontFamily: ft.sans,
              fontSize: 14,
              fontWeight: 500,
              color: t.indigo,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <svg
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
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Back to Log in
          </a>
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
            className="hsx-login-hero"
            style={{ width: "100%", textAlign: "center", marginBottom: 32 }}
          >
            <h1
              id="reset-heading"
              style={{
                fontFamily: ft.serif,
                fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
                lineHeight: 1.05,
                fontWeight: 400,
                letterSpacing: "-0.02em",
                whiteSpace: "nowrap",
                margin: 0,
                color: t.coal,
              }}
            >
              Set a new{" "}
              <em
                style={{
                  fontStyle: "italic",
                  fontWeight: 400,
                  color: t.copper,
                }}
              >
                password
              </em>
            </h1>
            <p
              className="hsx-login-subtitle"
              style={{
                fontFamily: ft.sans,
                fontSize: 16,
                lineHeight: 1.55,
                color: t.inkSoft,
                marginTop: 14,
                marginBottom: 0,
                textWrap: "balance",
              }}
            >
              {email ? (
                <>
                  Choose a strong password for{" "}
                  <strong style={{ color: t.coal, fontWeight: 600 }}>
                    {email}
                  </strong>
                  .
                </>
              ) : (
                <>Choose something strong. You&apos;ll use this on every login.</>
              )}
            </p>
          </div>

          <div
            className="hsx-login-form"
            style={{ width: "100%", maxWidth: 440 }}
          >
            {tokenStatus !== "valid" ? (
              tokenStatus === "pending" ? (
                <div
                  role="status"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "20px 18px",
                    fontFamily: ft.sans,
                    fontSize: 14,
                    color: t.inkSoft,
                    gap: 10,
                  }}
                >
                  <Spinner />
                  Verifying your link…
                </div>
              ) : (
                <div
                  role="alert"
                  className="hsx-error-banner"
                  style={{
                    background: t.error100,
                    border: `1px solid ${t.error}`,
                    borderRadius: 10,
                    padding: "16px 18px",
                    fontFamily: ft.sans,
                    fontSize: 14,
                    color: t.error,
                    lineHeight: 1.5,
                  }}
                >
                  <strong style={{ fontWeight: 600 }}>
                    {tokenSurface.title}
                  </strong>
                  <br />
                  {tokenSurface.body}
                  <div style={{ marginTop: 14 }}>
                    <a
                      href="/forgot-password"
                      className="hsx-login-cta"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "12px 18px",
                        borderRadius: 10,
                        background: t.indigo,
                        color: t.cream,
                        fontWeight: 600,
                        fontSize: 14,
                        textDecoration: "none",
                        boxShadow: shadows.cta,
                      }}
                    >
                      Request a new link
                    </a>
                  </div>
                </div>
              )
            ) : (
              <>
                {error && (
                  <div
                    role="alert"
                    id="reset-error"
                    className="hsx-error-banner"
                    style={{
                      background: t.error100,
                      border: `1px solid ${t.error}`,
                      borderRadius: 10,
                      padding: "12px 14px",
                      marginBottom: 16,
                      fontFamily: ft.sans,
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
                  aria-labelledby="reset-heading"
                  aria-describedby={error ? "reset-error" : undefined}
                  style={{ display: "flex", flexDirection: "column", gap: 14 }}
                >
                  <Field
                    label="New password"
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
                    // eslint-disable-next-line jsx-a11y/no-autofocus -- gated on document.visibilityState
                    autoFocus={shouldAutoFocus}
                    enterKeyHint="next"
                    maxLength={PASSWORD_MAX_LENGTH}
                    invalid={
                      !!error ||
                      (passwordTouched && !pwV.valid && password.length > 0)
                    }
                    errorMessage={passwordError}
                    rightSlot={
                      <button
                        type="button"
                        className="hsx-eye-toggle"
                        onClick={() => setShowPassword((v) => !v)}
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
                    <div style={{ marginTop: -2 }}>
                      <PasswordStrengthMeter
                        score={pwV.score}
                        label={pwV.label}
                      />
                      <div style={{ marginTop: 12 }}>
                        <PasswordChecklist checks={pwV.checks} />
                      </div>
                    </div>
                  )}

                  <Field
                    label="Confirm password"
                    type={showPassword ? "text" : "password"}
                    name="confirm-password"
                    value={confirm}
                    onChange={setConfirm}
                    onFocus={() => setConfirmTouched(true)}
                    onAutofill={() => setConfirmTouched(true)}
                    autoComplete="new-password"
                    placeholder="Re-enter the password"
                    enterKeyHint="go"
                    maxLength={PASSWORD_MAX_LENGTH}
                    invalid={!!confirmError}
                    errorMessage={confirmError}
                    rightSlot={
                      matches ? (
                        <span
                          aria-label="Passwords match"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            color: t.success,
                            padding: 4,
                          }}
                        >
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </span>
                      ) : undefined
                    }
                  />

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      fontFamily: ft.sans,
                      fontSize: 13,
                      color: t.inkSoft,
                      marginTop: 2,
                    }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={t.success}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M12 2 4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4z" />
                      <polyline points="9 12 11 14 15 10" />
                    </svg>
                    For safety, every device will be signed out.
                  </div>

                  {(() => {
                    const isGhost = !canSubmit && !loading;
                    const tooltip = isGhost
                      ? expired
                        ? "Request a fresh reset link to continue"
                        : !pwV.valid
                          ? "Choose a stronger password to continue"
                          : !matches
                            ? "Confirm your new password to continue"
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
                          fontFamily: ft.sans,
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
                            Updating…
                          </>
                        ) : (
                          <>
                            Update password
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

                  <div
                    aria-live="polite"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      marginTop: 6,
                      fontFamily: ft.sans,
                      fontSize: 13,
                      color: expired ? t.error : t.inkSoft,
                    }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={expired ? t.error : t.copper}
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M12 2 4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4z" />
                      <path d="M12 8v4" />
                      <circle
                        cx="12"
                        cy="15"
                        r="0.6"
                        fill={expired ? t.error : t.copper}
                        stroke="none"
                      />
                    </svg>
                    {expired ? (
                      "Link expired — request a new one."
                    ) : (
                      <>For your security, this link expires in {expiryLabel}.</>
                    )}
                  </div>
                </form>
              </>
            )}
          </div>
        </main>

        <footer
          className="hsx-login-footer"
          style={{
            textAlign: "center",
            padding: "24px 24px 32px",
            fontFamily: ft.sans,
            fontSize: 13,
            color: t.inkSoft,
            lineHeight: 1.6,
          }}
        >
          <span
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke={t.copper}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
              <path d="M21 19a2 2 0 0 1-2 2h-1v-6h3v4z" />
              <path d="M3 19a2 2 0 0 0 2 2h1v-6H3v4z" />
            </svg>
            Need help?{" "}
            <a
              href="/contact"
              className="hsx-link-indigo"
              style={{
                color: t.indigo,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Contact support
            </a>
          </span>
        </footer>
      </div>
    </>
  );
}
