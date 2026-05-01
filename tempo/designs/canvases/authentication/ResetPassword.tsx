/* HireStepX — Authentication / Reset password (set new)
   Step 3 of the password-reset flow. User landed via the emailed token
   link; we collect a new password + confirmation and submit.
   Layout mirrors ForgotPassword: text-first hero, narrow form column,
   inline shield + headphones for trust + help.
   Discipline rule: Indigo is interactive · Copper is editorial · Never mix. */
import React, { useEffect, useMemo, useState } from "react";
import { tokens as t, fonts as f, shadows } from "../design-system/_tokens";
import {
  Field,
  Wordmark,
  Spinner,
  EyeIcon,
  PasswordStrengthMeter,
  PasswordChecklist,
} from "./_auth-fields";
import { AUTH_STYLES } from "./_auth-styles";
import { passwordHasEdgeWhitespace, validateSignupPassword } from "./_auth-validation";

/** Discriminated token state. Different copy for each — best-in-class
    products (GitHub, Linear) distinguish so users self-diagnose. */
export type TokenStatus = "valid" | "expired" | "used" | "invalid";

export interface ResetPasswordProps {
  /** Pre-filled if the backend resolved the token to a known account. */
  email?: string;
  loading?: boolean;
  error?: string | null;
  /** Token state. "valid" renders the form; others short-circuit to a
      remediation surface. Backwards-compatible: passing tokenInvalid=true
      maps to "invalid". */
  tokenStatus?: TokenStatus;
  /** Legacy prop — kept for the existing storyboard. */
  tokenInvalid?: boolean;
  /** Minutes until the token expires (for the live countdown). */
  expiryMinutes?: number;
}

const PASSWORD_VISIBLE_TIMEOUT_MS = 10_000;
const PASSWORD_MAX_LENGTH = 256;

export default function ResetPassword({
  email,
  loading = false,
  error = null,
  tokenStatus,
  tokenInvalid = false,
  expiryMinutes = 30,
}: ResetPasswordProps = {}) {
  const status: TokenStatus = tokenStatus ?? (tokenInvalid ? "invalid" : "valid");
  const isFormVisible = status === "valid";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);

  // Visibility-aware autofocus — same anti-focus-stealing guard as Login
  // and ForgotPassword. Avoids stealing focus from a backgrounded tab.
  const [shouldAutoFocus] = useState(() => {
    if (typeof document === "undefined") return false;
    return document.visibilityState === "visible";
  });

  // Expiry countdown — surface how much time the user has left on the
  // emailed link.
  const [secondsLeft, setSecondsLeft] = useState(expiryMinutes * 60);
  useEffect(() => {
    if (!isFormVisible) return;
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [isFormVisible]);

  const expired = secondsLeft === 0;
  const expiryLabel = useMemo(() => {
    const m = Math.floor(secondsLeft / 60);
    const s = secondsLeft % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }, [secondsLeft]);

  const pwV = validateSignupPassword(password);
  const matches = password.length > 0 && password === confirm;
  const canSubmit = pwV.valid && matches && !loading && !expired;

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

  // Auto-hide password after a beat — same over-shoulder protection as Login.
  useEffect(() => {
    if (!showPassword) return;
    const id = setTimeout(() => setShowPassword(false), PASSWORD_VISIBLE_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [showPassword]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordTouched(true);
    setConfirmTouched(true);
    if (!canSubmit) return;
    // production: POST /api/password/reset { token, password }
    // Backend always invalidates ALL sessions (including this one) — strict
    // industry posture. User is routed to Login, not Dashboard.
  };

  // Token-error copy varies by status. Each surface has its own remediation.
  const tokenSurface = (() => {
    if (status === "expired") {
      return {
        title: "This link has expired.",
        body: "Reset links live for 30 minutes. Request a new one to continue.",
      };
    }
    if (status === "used") {
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
          {/* Text-first hero — matches ForgotPassword. No icon tile. */}
          <div className="hsx-login-hero" style={{ width: "100%", textAlign: "center", marginBottom: 32 }}>
            <h1
              id="reset-heading"
              style={{ fontFamily: f.serif, fontSize: "clamp(2.5rem, 6vw, 4.5rem)", lineHeight: 1.05, fontWeight: 400, letterSpacing: "-0.02em", whiteSpace: "nowrap", margin: 0, color: t.coal }}
            >
              Set a new{" "}
              <em style={{ fontStyle: "italic", fontWeight: 400, color: t.copper }}>
                password
              </em>
            </h1>
            <p
              className="hsx-login-subtitle"
              style={{ fontFamily: f.sans, fontSize: 16, lineHeight: 1.55, color: t.inkSoft, marginTop: 14, marginBottom: 0, textWrap: "balance" }}
            >
              {email
                ? <>Choose a strong password for <strong style={{ color: t.coal, fontWeight: 600 }}>{email}</strong>.</>
                : <>Choose something strong. You&apos;ll use this on every login.</>}
            </p>
          </div>

          <div className="hsx-login-form" style={{ width: "100%", maxWidth: 440 }}>
            {/* Token-error surface short-circuits the form */}
            {!isFormVisible ? (
              <div
                role="alert"
                className="hsx-error-banner"
                style={{ background: t.error100, border: `1px solid ${t.error}`, borderRadius: 10, padding: "16px 18px", fontFamily: f.sans, fontSize: 14, color: t.error, lineHeight: 1.5 }}
              >
                <strong style={{ fontWeight: 600 }}>{tokenSurface.title}</strong>
                <br />
                {tokenSurface.body}
                <div style={{ marginTop: 14 }}>
                  <a
                    href="#forgot"
                    className="hsx-login-cta"
                    style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "12px 18px", borderRadius: 10, background: t.indigo, color: "#fff", fontWeight: 600, fontSize: 14, textDecoration: "none", boxShadow: shadows.cta }}
                  >
                    Request a new link
                  </a>
                </div>
              </div>
            ) : (
              <>
                {error && (
                  <div
                    role="alert"
                    id="reset-error"
                    className="hsx-error-banner"
                    style={{ background: t.error100, border: `1px solid ${t.error}`, borderRadius: 10, padding: "12px 14px", marginBottom: 16, fontFamily: f.sans, fontSize: 13, color: t.error, lineHeight: 1.4 }}
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
                    onChange={setPassword}
                    onFocus={() => setPasswordTouched(true)}
                    onAutofill={() => setPasswordTouched(true)}
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    autoFocus={shouldAutoFocus}
                    enterKeyHint="next"
                    maxLength={PASSWORD_MAX_LENGTH}
                    invalid={!!error || (passwordTouched && !pwV.valid && password.length > 0)}
                    errorMessage={passwordError}
                    rightSlot={
                      <button
                        type="button"
                        className="hsx-eye-toggle"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        aria-pressed={showPassword}
                        style={{ background: "transparent", border: "none", color: t.inkSoft, cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}
                      >
                        <EyeIcon open={showPassword} />
                      </button>
                    }
                  />

                  {password.length > 0 && (
                    <div style={{ marginTop: -2 }}>
                      <PasswordStrengthMeter score={pwV.score} label={pwV.label} />
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
                          style={{ display: "flex", alignItems: "center", color: t.success, padding: 4 }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </span>
                      ) : undefined
                    }
                  />

                  {/* Trust beat — surfaces the always-on security posture so
                      users understand why every device gets signed out. */}
                  <div
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: f.sans, fontSize: 13, color: t.inkSoft, marginTop: 2 }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.success} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 2 4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4z" />
                      <polyline points="9 12 11 14 15 10" />
                    </svg>
                    For safety, every device will be signed out.
                  </div>

                  {/* Ghost-when-disabled treatment matches Login + Forgot. */}
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
                            Updating…
                          </>
                        ) : (
                          <>
                            Update password
                            <svg className="hsx-login-cta-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <line x1="5" y1="12" x2="19" y2="12" />
                              <polyline points="12 5 19 12 12 19" />
                            </svg>
                          </>
                        )}
                      </button>
                    );
                  })()}

                  {/* Inline shield row: live countdown when valid, red when
                      expired. Same visual treatment as ForgotPassword's
                      "expires in 30 minutes" line — kept consistent. */}
                  <div
                    aria-live="polite"
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 6, fontFamily: f.sans, fontSize: 13, color: expired ? t.error : t.inkSoft }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={expired ? t.error : t.copper} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 2 4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4z" />
                      <path d="M12 8v4" />
                      <circle cx="12" cy="15" r="0.6" fill={expired ? t.error : t.copper} stroke="none" />
                    </svg>
                    {expired ? "Link expired — request a new one." : <>For your security, this link expires in {expiryLabel}.</>}
                  </div>
                </form>
              </>
            )}
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
