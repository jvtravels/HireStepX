"use client";

import { useEffect } from "react";
import { tokens as t, fonts } from "../../src/auth/_tokens";

/* Marketing error boundary. Catches uncaught render errors inside the
 * (marketing) route group and renders an on-brand fallback. Reset
 * triggers a re-render of the segment. Keep this in sync with the
 * cream/coal/copper palette so a runtime error doesn't expose users
 * to a stark dark-mode shell mid-browse. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        padding: 32,
        background: t.cream,
        fontFamily: fonts.sans,
        textAlign: "center",
      }}
    >
      <h2
        style={{
          fontFamily: fonts.serif,
          fontSize: 36,
          fontWeight: 400,
          letterSpacing: "-0.02em",
          color: t.coal,
          margin: 0,
          marginBottom: 10,
        }}
      >
        Something broke on our end.
      </h2>
      <p style={{ fontSize: 15, color: t.inkSoft, margin: 0, marginBottom: 28, maxWidth: 480 }}>
        {error.message || "Reload the page or head back home. If it keeps happening, write to hello@hirestepx.com."}
      </p>
      <div style={{ display: "flex", gap: 12 }}>
        <button
          onClick={reset}
          style={{
            padding: "12px 22px",
            fontSize: 15,
            fontWeight: 600,
            color: t.cream,
            background: t.coal,
            border: "none",
            borderRadius: 999,
            cursor: "pointer",
            fontFamily: fonts.sans,
          }}
        >
          Try again
        </button>
        <a
          href="/"
          style={{
            padding: "12px 22px",
            fontSize: 15,
            fontWeight: 600,
            color: t.coal,
            background: "transparent",
            border: `1px solid ${t.lineStrong}`,
            borderRadius: 999,
            textDecoration: "none",
            fontFamily: fonts.sans,
          }}
        >
          Go home
        </a>
      </div>
    </div>
  );
}
