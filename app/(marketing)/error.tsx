"use client";

import { useEffect } from "react";
import { tokens as t, fonts } from "../../src/auth/_tokens";
import { Button } from "@/components/ui/button";

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
        <Button onClick={reset} size="lg" style={{ fontFamily: fonts.sans }}>
          Try again
        </Button>
        <Button asChild variant="outline" size="lg" style={{ fontFamily: fonts.sans }}>
          <a href="/">Go home</a>
        </Button>
      </div>
    </div>
  );
}
