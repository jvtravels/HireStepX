/* HireStepX — Authentication / Reset password (set new)
   Step 3 of the password-reset flow. User landed via the emailed token
   link; we collect a new password + confirmation and submit.
   Layout mirrors ForgotPassword: text-first hero, narrow form column,
   inline shield + headphones for trust + help.

   Rebuilt on shadcn/ui primitives (Button, Input, Label, Alert) +
   Tailwind theme tokens, matching Login's Phase-3 redesign: clean sans
   hierarchy + a restrained background glow in place of the retired serif
   headline and cream card surface. No italics per design system rule —
   emphasis is weight/color only. PasswordStrengthMeter/PasswordChecklist
   have no shadcn equivalent and stay as bespoke atoms from _auth-fields. */
import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Spinner,
  EyeIcon,
  PasswordStrengthMeter,
  PasswordChecklist,
} from "./_auth-fields";
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
    <div className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-background text-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[620px]"
      >
        <div className="absolute top-[-220px] left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-primary/[0.14] blur-[110px]" />
      </div>

      <header className="flex items-center justify-between gap-4 px-6 py-6 sm:px-12">
        <div className="flex items-baseline gap-0 text-xl font-semibold tracking-tight">
          <span>HireStep</span>
          <span className="text-primary">X</span>
        </div>
        <a
          href="#login"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
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

      <main className="flex flex-1 flex-col items-center px-6 pt-10 pb-16 sm:pt-20">
        {/* Text-first hero — matches ForgotPassword. No icon tile. */}
        <div className="mb-11 w-full max-w-xl text-center">
          <h1
            id="reset-heading"
            className="text-5xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-7xl"
          >
            Set a new <span className="text-primary">password</span>
          </h1>
          <p className="mt-4.5 text-base text-muted-foreground text-balance">
            {email ? (
              <>
                Choose a strong password for{" "}
                <strong className="font-semibold text-foreground">{email}</strong>.
              </>
            ) : (
              <>Choose something strong. You&apos;ll use this on every login.</>
            )}
          </p>
        </div>

        <div className="w-full max-w-[400px]">
          {/* Token-error surface short-circuits the form */}
          {!isFormVisible ? (
            <div className="flex flex-col gap-4">
              <Alert variant="destructive">
                <AlertTitle>{tokenSurface.title}</AlertTitle>
                <AlertDescription>{tokenSurface.body}</AlertDescription>
              </Alert>
              <Button asChild size="lg" className="h-12 gap-2 text-[15px] font-semibold">
                <a href="#forgot">
                  Request a new link
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
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </a>
              </Button>
            </div>
          ) : (
            <>
              {error && (
                <Alert variant="destructive" id="reset-error" className="mb-4">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <form
                onSubmit={handleSubmit}
                aria-labelledby="reset-heading"
                aria-describedby={error ? "reset-error" : undefined}
                className="flex flex-col gap-4"
              >
                <div className="flex flex-col gap-2">
                  <Label htmlFor="reset-password">New password</Label>
                  <div className="relative">
                    <Input
                      id="reset-password"
                      type={showPassword ? "text" : "password"}
                      name="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setPasswordTouched(true)}
                      autoComplete="new-password"
                      placeholder="At least 8 characters"
                      autoFocus={shouldAutoFocus}
                      enterKeyHint="next"
                      maxLength={PASSWORD_MAX_LENGTH}
                      aria-invalid={
                        !!error || (passwordTouched && !pwV.valid && password.length > 0)
                      }
                      className="h-12 px-4 pr-11 text-[15px]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      aria-pressed={showPassword}
                      className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <EyeIcon open={showPassword} />
                    </button>
                  </div>
                  {passwordError && (
                    <p className="mt-0.5 text-xs text-destructive">{passwordError}</p>
                  )}
                  {password.length > 0 && (
                    <div className="-mt-0.5">
                      <PasswordStrengthMeter score={pwV.score} label={pwV.label} />
                      <div className="mt-3">
                        <PasswordChecklist checks={pwV.checks} />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="reset-confirm">Confirm password</Label>
                  <div className="relative">
                    <Input
                      id="reset-confirm"
                      type={showPassword ? "text" : "password"}
                      name="confirm-password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      onFocus={() => setConfirmTouched(true)}
                      autoComplete="new-password"
                      placeholder="Re-enter the password"
                      enterKeyHint="go"
                      maxLength={PASSWORD_MAX_LENGTH}
                      aria-invalid={!!confirmError}
                      className="h-12 px-4 pr-11 text-[15px]"
                    />
                    {matches && (
                      <span
                        aria-label="Passwords match"
                        className="absolute top-1/2 right-3 -translate-y-1/2 text-green-600 dark:text-green-500"
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
                    )}
                  </div>
                  {confirmError && (
                    <p className="mt-0.5 text-xs text-destructive">{confirmError}</p>
                  )}
                </div>

                {/* Trust beat — surfaces the always-on security posture so
                    users understand why every device gets signed out. */}
                <div className="flex items-center justify-center gap-2 text-[13px] text-muted-foreground">
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
                    className="text-green-600 dark:text-green-500"
                  >
                    <path d="M12 2 4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4z" />
                    <polyline points="9 12 11 14 15 10" />
                  </svg>
                  For safety, every device will be signed out.
                </div>

                <Button
                  type="submit"
                  size="lg"
                  disabled={loading || expired}
                  aria-busy={loading || undefined}
                  className="mt-1 h-12 gap-2 text-[15px] font-semibold"
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
                </Button>

                {/* Inline shield row: live countdown when valid, destructive
                    tone when expired. Same visual treatment as
                    ForgotPassword's "expires in 30 minutes" line. */}
                <div
                  aria-live="polite"
                  className={`flex items-center justify-center gap-2 text-[13px] ${
                    expired ? "text-destructive" : "text-muted-foreground"
                  }`}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    className={expired ? "text-destructive" : "text-primary"}
                  >
                    <path d="M12 2 4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4z" />
                    <path d="M12 8v4" />
                    <circle cx="12" cy="15" r="0.6" fill="currentColor" stroke="none" />
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

      {/* Single-line headphones footer — matches ForgotPassword */}
      <footer className="mx-auto px-6 pt-5 pb-8 text-center text-[13px] leading-relaxed text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="text-primary"
          >
            <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
            <path d="M21 19a2 2 0 0 1-2 2h-1v-6h3v4z" />
            <path d="M3 19a2 2 0 0 0 2 2h1v-6H3v4z" />
          </svg>
          Need help?{" "}
          <a
            href="#contact"
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            Contact support
          </a>
        </span>
      </footer>
    </div>
  );
}
