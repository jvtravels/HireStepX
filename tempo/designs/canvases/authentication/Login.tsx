/* HireStepX — Authentication / Login
   Page composition. Atoms in _auth-fields, styles in _auth-styles,
   validation in _auth-validation, analytics in _auth-analytics.

   Phase-2 redesign: rebuilt on shadcn/ui primitives (Button, Input, Label,
   Checkbox, Alert) + Tailwind theme tokens instead of the legacy _tokens.ts
   palette, with the AF Sobremesa display font on the headline (loaded from
   tempo/public/fonts/af-sobremesa.css — canvas-host only, never wired into
   the production app). Scoped to this screen only; Signup/ForgotPassword/
   ResetPassword are untouched. */
import React, { useCallback, useEffect, useRef, useState } from "react";
import "../../../public/fonts/af-sobremesa.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { GoogleIcon, Spinner, EyeIcon } from "./_auth-fields";
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

  const emailV = validateEmail(email);
  const passwordV = validatePassword(password);
  const canSubmit = emailV.valid && passwordV.valid && !loading;

  const emailError = emailTouched ? emailV.message : null;
  const passwordError = passwordTouched
    ? passwordV.message ||
      (passwordHasEdgeWhitespace(password)
        ? "Password has leading or trailing spaces — check your paste."
        : null)
    : null;

  const variantRef = useRef(variant);
  variantRef.current = variant;
  useEffect(() => {
    trackAuth(loginViewedEvent(variantRef.current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleGoogle = useCallback(() => {
    if (googleInFlight || loading) return;
    setGoogleInFlight(true);
    trackAuth({ type: "login_method_selected", method: "google" });
    trackAuth({ type: "login_submitted", method: "google" });
    setTimeout(() => setGoogleInFlight(false), 2000);
  }, [googleInFlight, loading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEmailTouched(true);
    setPasswordTouched(true);
    if (!canSubmit) return;
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

  const isGhost = !canSubmit && !loading;

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      {/* Top bar */}
      <header className="flex items-center justify-between gap-4 px-6 py-8 sm:px-12">
        <div className="flex items-baseline gap-0 text-xl font-semibold tracking-tight">
          <span>HireStep</span>
          <span className="text-primary italic">X</span>
        </div>
        <div className="text-sm text-muted-foreground">
          <span>Don&apos;t have an account? </span>
          <a
            href="#signup"
            onClick={() => trackAuth({ type: "login_signup_clicked" })}
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            Sign up
          </a>
        </div>
      </header>

      {/* Centered hero + form */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-8 sm:py-16">
        <div className="mb-9 w-full max-w-xl text-center">
          <h1
            id="login-heading"
            className="text-4xl leading-[1.05] font-normal tracking-tight text-balance sm:text-6xl"
            style={{ fontFamily: "'AF Sobremesa', serif" }}
          >
            Clarity <em className="text-primary">wins</em> interviews
          </h1>
          <p className="mt-4 text-base text-muted-foreground text-balance">
            Practise interviews. Improve how you think under pressure. One
            answer at a time.
          </p>
        </div>

        <div className="w-full max-w-[420px]">
          {/* Google CTA */}
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={handleGoogle}
            disabled={googleInFlight || loading}
            aria-busy={googleInFlight || undefined}
            className="h-12 w-full gap-3 text-[15px] font-medium"
          >
            <GoogleIcon />
            {googleInFlight ? "Opening Google…" : "Continue with Google"}
          </Button>

          {/* Divider */}
          <div className="my-5 flex items-center gap-3.5">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Server error banner */}
          {error && (
            <Alert variant="destructive" id="login-error" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            aria-labelledby="login-heading"
            aria-describedby={error ? "login-error" : undefined}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="login-email">Email Address</Label>
              <Input
                id="login-email"
                type="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => {
                  if (!emailTouched) {
                    trackAuth({ type: "login_field_focused", field: "email" });
                  }
                  setEmailTouched(true);
                }}
                autoComplete="email"
                placeholder="rahul@example.com"
                autoFocus={shouldAutoFocus}
                inputMode="email"
                enterKeyHint="next"
                maxLength={EMAIL_MAX_LENGTH}
                aria-invalid={!!error || (emailTouched && !!emailV.message)}
                className="h-12 px-4 text-[15px]"
              />
              {emailError && (
                <p className="mt-0.5 text-xs text-destructive">{emailError}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="login-password">Password</Label>
              <div className="relative">
                <Input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => {
                    if (!passwordTouched) {
                      trackAuth({
                        type: "login_field_focused",
                        field: "password",
                      });
                    }
                    setPasswordTouched(true);
                  }}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  enterKeyHint="go"
                  maxLength={PASSWORD_MAX_LENGTH}
                  aria-invalid={
                    !!error || (passwordTouched && !!passwordV.message)
                  }
                  className="h-12 px-4 pr-11 text-[15px]"
                />
                <button
                  type="button"
                  onClick={handlePasswordVisibility}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
              {passwordError && (
                <p className="mt-0.5 text-xs text-destructive">
                  {passwordError}
                </p>
              )}
            </div>

            {/* Inline row: stay signed in + forgot password */}
            <div className="mt-0.5 flex items-center justify-between">
              <Label className="gap-2 text-[13px] font-normal text-muted-foreground">
                <Checkbox
                  checked={staySignedIn}
                  onCheckedChange={(v) => setStaySignedIn(v === true)}
                  title="Keeps you signed in for 30 days on this device. Don't enable on shared computers."
                />
                Stay signed in
              </Label>
              <a
                href="#forgot"
                onClick={() =>
                  trackAuth({ type: "login_forgot_password_clicked" })
                }
                className="text-[13px] font-medium text-primary underline-offset-4 hover:underline"
              >
                Forgot password
              </a>
            </div>

            {/* Primary CTA */}
            <Button
              type="submit"
              size="lg"
              disabled={!canSubmit}
              aria-busy={loading || undefined}
              title={
                isGhost
                  ? !emailV.valid
                    ? "Enter a valid email to continue"
                    : !passwordV.valid
                      ? "Enter your password to continue"
                      : "Complete the form to continue"
                  : undefined
              }
              className="mt-2 h-12 gap-2 text-[15px] font-semibold"
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
          </form>
        </div>
      </main>

      {/* Footer legal microcopy */}
      <footer className="mx-auto max-w-md px-6 pt-5 pb-7 text-center text-xs leading-relaxed text-muted-foreground">
        By clicking &ldquo;Log in with Google&rdquo; or &ldquo;Continue with email&rdquo;
        <br />
        you agree to our{" "}
        <a
          href="#terms"
          className="font-medium text-primary underline underline-offset-2"
        >
          Terms of Use
        </a>{" "}
        and{" "}
        <a
          href="#privacy"
          className="font-medium text-primary underline underline-offset-2"
        >
          Privacy Policy
        </a>
      </footer>
    </div>
  );
}
