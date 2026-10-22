/* HireStepX — Authentication / Forgot password (sent confirmation)
   Step 2 of the password-reset flow. Confirms a reset email may have been
   dispatched (enumeration-resistant) and offers a resend with cooldown.
   Layout mirrors ForgotPassword: text-first hero, narrow form column,
   inline shield + headphones for trust + help.

   Rebuilt on shadcn/ui primitives (Button) + Tailwind theme tokens,
   matching Login's Phase-3 redesign: clean sans hierarchy + a restrained
   background glow in place of the retired serif headline and cream card
   surface. No italics per design system rule — emphasis is weight/color
   only. */
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "./_auth-fields";

export interface ForgotPasswordSentProps {
  /** The email the link was dispatched to. */
  email?: string;
  /** Show the loading state on the resend button */
  resending?: boolean;
}

// 60s matches Stripe / Linear / Notion cooldowns. Long enough to deter
// retry storms, short enough not to frustrate.
const RESEND_COOLDOWN_SEC = 60;

export default function ForgotPasswordSent({
  email = "rahul@example.com",
  resending = false,
}: ForgotPasswordSentProps = {}) {
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SEC);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const canResend = cooldown <= 0 && !resending;

  // Provider-aware webmail link so users land in the right inbox tab.
  const provider = (() => {
    const at = email.lastIndexOf("@");
    if (at < 0) return null;
    const domain = email.slice(at + 1).toLowerCase();
    if (domain.includes("gmail") || domain.includes("googlemail")) return { name: "Gmail", url: "https://mail.google.com" };
    if (domain.includes("outlook") || domain.includes("hotmail") || domain.includes("live")) return { name: "Outlook", url: "https://outlook.live.com" };
    if (domain.includes("yahoo")) return { name: "Yahoo", url: "https://mail.yahoo.com" };
    if (domain.includes("proton")) return { name: "Proton", url: "https://mail.proton.me" };
    return null;
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
        {/* Text-first hero — no icon tile, matches Forgot screen */}
        <div className="mb-11 w-full max-w-xl text-center">
          <h1
            id="sent-heading"
            className="text-5xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-7xl"
          >
            Check your <span className="text-primary">inbox</span>
          </h1>
          {/* Enumeration-resistant copy — Stripe/Apple/Auth0 pattern */}
          <p className="mt-4.5 text-base text-muted-foreground text-balance">
            If an account exists for{" "}
            <strong className="font-semibold text-foreground">{email}</strong>, a
            reset link is on its way.
          </p>
        </div>

        <div className="flex w-full max-w-[400px] flex-col gap-3.5">
          {/* Open webmail (provider-aware) */}
          {provider && (
            <Button asChild size="lg" className="h-12 w-full gap-2.5 text-[15px] font-semibold">
              <a href={provider.url} target="_blank" rel="noreferrer">
                Open {provider.name}
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
                  <path d="M7 17L17 7" />
                  <path d="M8 7h9v9" />
                </svg>
              </a>
            </Button>
          )}

          {/* Resend with cooldown — secondary tone. aria-live span lets
              screen readers announce the countdown without repeatedly
              re-reading the whole button label. */}
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={!canResend}
            aria-busy={resending || undefined}
            className="h-12 w-full gap-2.5 text-[15px] font-medium"
          >
            {resending ? (
              <>
                <Spinner />
                Resending…
              </>
            ) : cooldown > 0 ? (
              <span aria-live="polite">Resend link in {cooldown}s</span>
            ) : (
              <span aria-live="polite">Resend link</span>
            )}
          </Button>

          {/* "Wrong email?" — promoted to a button-tier action since typo
              recovery is the #1 actionable need on this screen (Linear,
              Stripe surface this prominently). */}
          <a
            href="#forgot"
            className="w-full py-2.5 text-center text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Wrong email? Try a different one
          </a>

          {/* Inline security row — mirrors ForgotPassword */}
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

          {/* Spam-folder note — single calm reminder, no extra CTA */}
          <p className="mt-1 text-center text-[13px] leading-relaxed text-muted-foreground/80">
            Don&apos;t see it? Check your spam folder.
          </p>
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
