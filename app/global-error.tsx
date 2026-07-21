"use client";

/* Global error boundary — catches errors in `app/layout.tsx` itself,
   which the regular `error.tsx` can't reach because the route boundary
   sits inside the layout. This file MUST render its own <html>/<body>
   since the layout has crashed and won't be applied.

   Keep the markup minimal and inline — any external dependency (fonts,
   tokens, providers) might be the thing that's broken. */

import { useEffect, useState } from "react";

const SUPPORT_EMAIL = "hello@hirestepx.com";

export default function GlobalLayoutError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [emailCopied, setEmailCopied] = useState(false);

  const copyEmail = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(SUPPORT_EMAIL).then(() => {
        setEmailCopied(true);
        setTimeout(() => setEmailCopied(false), 2000);
      }).catch(() => { /* silent */ });
    }
  };

  useEffect(() => {
    try {
      console.error("[app/global-error] layout crashed:", error.message, error.digest);
    } catch {
      /* noop */
    }
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#0E0C08",
          color: "#F5F2ED",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 40,
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: 24, fontWeight: 600, margin: "0 0 12px" }}>
          We can&apos;t load HireStepX right now
        </h1>
        <p
          style={{
            fontSize: 14,
            color: "#A39C8B",
            maxWidth: 420,
            lineHeight: 1.6,
            margin: "0 0 24px",
          }}
        >
          A core part of the app failed to start. Try refreshing — if it
          keeps happening, please reach out.
        </p>
        {error.digest ? (
          <p
            style={{
              fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
              fontSize: 11,
              opacity: 0.6,
              margin: "0 0 24px",
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
              fontSize: 14,
              fontWeight: 500,
              color: "#0E0C08",
              background: "#D4B37F",
              padding: "12px 28px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
            }}
          >
            Reload
          </button>
          <button
            type="button"
            onClick={copyEmail}
            title={emailCopied ? "Copied!" : `Click to copy ${SUPPORT_EMAIL}`}
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: "#F5F2ED",
              background: "transparent",
              border: "1px solid #6E6759",
              padding: "12px 28px",
              borderRadius: 8,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {emailCopied ? "Copied!" : "Contact support"}
          </button>
        </div>
      </body>
    </html>
  );
}
