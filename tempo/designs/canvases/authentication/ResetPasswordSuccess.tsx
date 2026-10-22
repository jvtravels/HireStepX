/* HireStepX — Authentication / Reset password (success)
   Step 4 of the password-reset flow. Confirms the new password is live
   and routes the user back to practising.
   Layout mirrors ForgotPassword: text-first hero, narrow form column,
   single-line headphones footer.

   Rebuilt on shadcn/ui primitives (Button) + Tailwind theme tokens,
   matching Login's Phase-3 redesign: clean sans hierarchy + a restrained
   background glow in place of the retired serif headline and cream card
   surface. No italics per design system rule — emphasis is weight/color
   only. */
import React from "react";
import { Button } from "@/components/ui/button";

export interface ResetPasswordSuccessProps {
  /** Where the primary CTA points. */
  continueHref?: string;
}

export default function ResetPasswordSuccess({
  continueHref = "#login",
}: ResetPasswordSuccessProps = {}) {
  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-background text-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[620px]"
      >
        <div className="absolute top-[-220px] left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-primary/[0.14] blur-[110px]" />
      </div>

      {/* All sessions invalidated — user must sign back in. Wordmark only. */}
      <header className="flex items-center justify-between gap-4 px-6 py-6 sm:px-12">
        <div className="flex items-baseline gap-0 text-xl font-semibold tracking-tight">
          <span>HireStep</span>
          <span className="text-primary">X</span>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center px-6 pt-10 pb-16 sm:pt-20">
        {/* Text-first hero — no icon tile. Brand voice carries the moment. */}
        <div className="mb-11 w-full max-w-xl text-center">
          <h1
            id="success-heading"
            className="text-5xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-7xl"
          >
            Password <span className="text-primary">updated</span>
          </h1>
          <p className="mt-4.5 text-base text-muted-foreground text-balance">
            We&apos;ve signed you out of all devices for safety. Use your new
            password to log back in.
          </p>
        </div>

        <div className="flex w-full max-w-[400px] flex-col gap-3.5">
          <Button asChild size="lg" className="h-12 w-full gap-2.5 text-[15px] font-semibold">
            <a href={continueHref}>
              Go to Log in
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

          {/* Inline shield row — green check tone signals success.
              Same visual placement as the security note on prior screens. */}
          <div className="mt-1.5 flex items-center justify-center gap-2 text-[13px] text-muted-foreground">
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
            Your account is secured.
          </div>

          {/* Wasn't-me path — fast remediation if compromised */}
          <p className="mt-2.5 text-center text-[13px] leading-relaxed text-muted-foreground">
            Didn&apos;t request this?{" "}
            <a
              href="#secure-account"
              className="font-semibold text-primary underline-offset-4 hover:underline"
            >
              Secure your account
            </a>
            .
          </p>
        </div>
      </main>

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
