"use client";

/* App-Router error boundary.
   Renders when an unhandled error escapes a server component or layout
   below `app/`. The previous behavior was a blank-page crash; this
   surface gives the user a retry, a path home, and a way to report.

   Next.js requires this file to be a client component — the `reset`
   prop is the framework's hook for re-rendering the segment that
   threw, so transient errors (network blips, race conditions) clear
   without a full reload. */

import { useEffect } from "react";
import Link from "next/link";
import { c, font } from "@/tokens";

const SUPPORT_EMAIL = "support@hirestepx.com";

export default function GlobalRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Best-effort error reporting — don't block the surface on it.
    // Sentry / errorReporter will pick it up if configured.
    try {
      console.error("[app/error] unhandled:", error.message, error.digest);
    } catch {
      /* noop */
    }
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: c.obsidian,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 40,
        textAlign: "center",
      }}
    >
      <span
        style={{
          fontFamily: font.display,
          fontSize: 80,
          fontWeight: 400,
          color: c.gilt,
          lineHeight: 1,
          marginBottom: 16,
        }}
      >
        500
      </span>
      <h1
        style={{
          fontFamily: font.ui,
          fontSize: 22,
          fontWeight: 600,
          color: c.ivory,
          marginBottom: 8,
        }}
      >
        Something went wrong
      </h1>
      <p
        style={{
          fontFamily: font.ui,
          fontSize: 14,
          color: c.stone,
          marginBottom: 24,
          maxWidth: 420,
          lineHeight: 1.6,
        }}
      >
        We hit an unexpected error. Try again — most of the time, this
        clears on its own. If it keeps happening, please get in touch.
      </p>
      {/* The digest is the only identifier the user can pass us to
          look up the failure in our logs — surface it discretely. */}
      {error.digest ? (
        <p
          style={{
            fontFamily: font.mono,
            fontSize: 11,
            color: c.stone,
            opacity: 0.7,
            marginBottom: 24,
            letterSpacing: 0.3,
          }}
        >
          Reference: {error.digest}
        </p>
      ) : null}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        <button
          type="button"
          onClick={reset}
          style={{
            fontFamily: font.ui,
            fontSize: 14,
            fontWeight: 500,
            color: c.obsidian,
            background: c.gilt,
            padding: "12px 28px",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
        <Link
          href="/"
          style={{
            fontFamily: font.ui,
            fontSize: 14,
            fontWeight: 500,
            color: c.ivory,
            background: "transparent",
            border: `1px solid ${c.stone}`,
            padding: "12px 28px",
            borderRadius: 8,
            textDecoration: "none",
          }}
        >
          Back home
        </Link>
        <a
          href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("HireStepX error")}${error.digest ? `&body=${encodeURIComponent(`Ref: ${error.digest}`)}` : ""}`}
          style={{
            fontFamily: font.ui,
            fontSize: 14,
            fontWeight: 500,
            color: c.ivory,
            background: "transparent",
            border: `1px solid ${c.stone}`,
            padding: "12px 28px",
            borderRadius: 8,
            textDecoration: "none",
          }}
        >
          Contact support
        </a>
      </div>
    </div>
  );
}
