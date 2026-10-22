/* HireStepX — Authentication / Forgot password (request)
   Step 1 of the password-reset flow. User enters their account email;
   the backend emails a tokenised reset link.

   Rebuilt on shadcn/ui primitives (Button, Input, Label, Alert) +
   Tailwind theme tokens, matching Login's Phase-3 redesign: clean sans
   hierarchy + a restrained background glow in place of the retired serif
   headline and cream card surface. No italics per design system rule —
   emphasis is weight/color only. */
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "./_auth-fields";
import { sanitizeEmail, validateEmail } from "./_auth-validation";

export interface ForgotPasswordProps {
  initialEmail?: string;
  loading?: boolean;
  error?: string | null;
  /** Variant tag for analytics A/B tracking */
  variant?: string;
}

const EMAIL_MAX_LENGTH = 320;

export default function ForgotPassword({
  initialEmail = "",
  loading = false,
  error = null,
}: ForgotPasswordProps = {}) {
  const [email, setEmail] = useState(initialEmail);
  const [emailTouched, setEmailTouched] = useState(false);

  const emailV = validateEmail(email);
  const canSubmit = emailV.valid && !loading;
  const emailError = emailTouched ? emailV.message : null;

  // Same anti-focus-stealing guard as Login: only focus on visible tab.
  const [shouldAutoFocus] = useState(() => {
    if (typeof document === "undefined") return false;
    return document.visibilityState === "visible";
  });

  useEffect(() => {
    // Production: trackAuth({ type: "forgot_password_viewed" })
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEmailTouched(true);
    if (!canSubmit) return;
    const cleanEmail = sanitizeEmail(email);
    void cleanEmail; // production: POST /api/password/forgot
  };

  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-background text-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[620px]"
      >
        <div className="absolute top-[-220px] left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-primary/[0.14] blur-[110px]" />
      </div>

      {/* Top bar — wordmark left, "Back to login" right */}
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

      {/* Hero + form, anchored near the top rather than dead-centered */}
      <main className="flex flex-1 flex-col items-center px-6 pt-10 pb-16 sm:pt-20">
        <div className="mb-11 w-full max-w-xl text-center">
          <h1
            id="forgot-heading"
            className="text-5xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-7xl"
          >
            Reset your <span className="text-primary">password</span>
          </h1>
          <p className="mt-4.5 text-base text-muted-foreground text-balance">
            No worries, we&apos;ll send you a link to reset your password.
          </p>
        </div>

        <div className="w-full max-w-[400px]">
          {/* Server error banner */}
          {error && (
            <Alert variant="destructive" id="forgot-error" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form
            onSubmit={handleSubmit}
            aria-labelledby="forgot-heading"
            aria-describedby={error ? "forgot-error" : undefined}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="forgot-email">Email Address</Label>
              <Input
                id="forgot-email"
                type="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setEmailTouched(true)}
                autoComplete="email"
                placeholder="Enter your email"
                autoFocus={shouldAutoFocus}
                inputMode="email"
                enterKeyHint="send"
                maxLength={EMAIL_MAX_LENGTH}
                aria-invalid={!!error || (emailTouched && !!emailV.message)}
                className="h-12 px-4 text-[15px]"
              />
              {emailError && (
                <p className="mt-0.5 text-xs text-destructive">{emailError}</p>
              )}
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={loading}
              aria-busy={loading || undefined}
              className="mt-1 h-12 gap-2 text-[15px] font-semibold"
            >
              {loading ? (
                <>
                  <Spinner />
                  Sending link…
                </>
              ) : (
                <>
                  Send reset link
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

            {/* Inline security reassurance — shield icon + short note. */}
            <div className="mt-1.5 flex items-center justify-center gap-2 text-[13px] text-muted-foreground">
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
                <path d="M12 2 4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4z" />
                <path d="M12 8v4" />
                <circle cx="12" cy="15" r="0.6" fill="currentColor" stroke="none" />
              </svg>
              For your security, the link will expire in 30 minutes.
            </div>
          </form>
        </div>
      </main>

      {/* Footer — single, focused help affordance (headphones icon). */}
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
