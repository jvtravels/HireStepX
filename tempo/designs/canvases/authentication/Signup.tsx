/* HireStepX — Authentication / Signup
   Mirrors the Login surface — same shell, same atoms — but tuned for
   first-time users: name field, password strength meter, free-tier
   value signal, signup-specific copy.

   Rebuilt on shadcn/ui primitives (Button, Input, Label, Alert) +
   Tailwind theme tokens, matching Login's Phase-3 redesign: clean sans
   hierarchy + a restrained background glow in place of the retired serif
   headline and cream card surface. No italics per design system rule —
   emphasis is weight/color only. PasswordStrengthMeter/PasswordChecklist
   have no shadcn equivalent and stay as bespoke atoms from _auth-fields. */
import React, { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  GoogleIcon,
  Spinner,
  EyeIcon,
  PasswordStrengthMeter,
  PasswordChecklist,
} from "./_auth-fields";
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
    <div className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-background text-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[620px]"
      >
        <div className="absolute top-[-220px] left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-primary/[0.14] blur-[110px]" />
      </div>

      {/* Top bar */}
      <header className="flex items-center justify-between gap-4 px-6 py-6 sm:px-12">
        <div className="flex items-baseline gap-0 text-xl font-semibold tracking-tight">
          <span>HireStep</span>
          <span className="text-primary">X</span>
        </div>
        <div className="text-sm text-muted-foreground">
          <span>Already have an account? </span>
          <a
            href="#login"
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            Log in
          </a>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center px-6 pt-10 pb-16 sm:pt-20">
        <div className="mb-11 w-full max-w-xl text-center">
          <h1
            id="signup-heading"
            className="text-5xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-7xl"
          >
            Practise like the <span className="text-primary">real thing</span>.
          </h1>
          <p className="mt-4.5 text-base text-muted-foreground text-balance">
            Start practising. Improve with every answer. One step closer to
            your next interview.
          </p>
        </div>

        <div className="w-full max-w-[480px]">
          {/* Google CTA */}
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={handleGoogle}
            disabled={loading}
            className="h-12 w-full gap-3 text-[15px] font-medium"
          >
            <GoogleIcon />
            Continue with Google
          </Button>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3.5">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {error && (
            <Alert variant="destructive" id="signup-error" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form
            onSubmit={handleSubmit}
            aria-labelledby="signup-heading"
            aria-describedby={error ? "signup-error" : undefined}
            className="flex flex-col gap-4.5"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="signup-name">Your name</Label>
              <Input
                id="signup-name"
                type="text"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onFocus={() => setNameTouched(true)}
                autoComplete="name"
                placeholder="Rahul Sharma"
                autoFocus={shouldAutoFocus}
                enterKeyHint="next"
                maxLength={NAME_MAX_LENGTH}
                aria-invalid={!!error || (nameTouched && !!nameV.message)}
                className="h-12 px-4 text-[15px]"
              />
              {nameError && (
                <p className="mt-0.5 text-xs text-destructive">{nameError}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="signup-email">Email Address</Label>
              <Input
                id="signup-email"
                type="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setEmailTouched(true)}
                autoComplete="email"
                placeholder="rahul@example.com"
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
              <Label htmlFor="signup-password">Password</Label>
              <div className="relative">
                <Input
                  id="signup-password"
                  type={showPassword ? "text" : "password"}
                  name="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setPasswordTouched(true)}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
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

            <Button
              type="submit"
              size="lg"
              disabled={loading}
              aria-busy={loading || undefined}
              className="mt-2 h-12 gap-2 text-[15px] font-semibold"
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

      <footer className="mx-auto max-w-md px-6 pt-5 pb-7 text-center text-xs leading-relaxed text-muted-foreground">
        By creating an account you agree to our{" "}
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
        . Your data is encrypted and never sold.
      </footer>
    </div>
  );
}
