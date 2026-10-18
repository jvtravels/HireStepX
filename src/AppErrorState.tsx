"use client";

import { useEffect } from "react";
import Link from "next/link";
import { tokens as t, fonts as f } from "./auth/_tokens";
import { captureClientEvent } from "./posthogClient";

const CHUNK_RE = /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i;
const RELOAD_KEY = "hx_chunk_reload_at";

export default function AppErrorState({
  error,
  reset,
  homeHref = "/dashboard",
  homeLabel = "Back to dashboard",
}: {
  error: Error & { digest?: string };
  reset: () => void;
  homeHref?: string;
  homeLabel?: string;
}) {
  const isChunkError = CHUNK_RE.test(`${error.name} ${error.message}`);

  useEffect(() => {
    try {
      console.error("[route error]", error.message, error.digest);
      captureClientEvent("route_error", { digest: error.digest ?? null, path: window.location.pathname, chunk: isChunkError });
    } catch { /* reporting is best effort */ }
    // A stale deploy leaves old chunk URLs 404ing; one hard reload picks up the new build.
    if (isChunkError) {
      try {
        const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
        if (Date.now() - last > 60_000) {
          sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
          window.location.reload();
        }
      } catch { /* sessionStorage unavailable: fall through to the manual button */ }
    }
  }, [error, isChunkError]);

  const btn = { fontFamily: f.sans, fontSize: 14, fontWeight: 500, padding: "10px 20px", borderRadius: 8, cursor: "pointer", textDecoration: "none", minHeight: 44, display: "inline-flex", alignItems: "center" } as const;

  return (
    <div role="alert" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", padding: 32, textAlign: "center", background: t.pageBg, color: t.coal, fontFamily: f.sans }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, margin: "0 0 8px" }}>
        {isChunkError ? "A new version is available" : "Something went wrong"}
      </h1>
      <p style={{ fontSize: 14, color: t.inkSoft, margin: "0 0 24px", maxWidth: 420, lineHeight: 1.6 }}>
        {isChunkError
          ? "HireStepX was just updated. Reload to continue; your progress is saved."
          : "This page hit an unexpected error. Try again; if it keeps happening, your sessions and progress are safe and you can head back to the dashboard."}
      </p>
      {error.digest && (
        <p style={{ fontFamily: f.mono, fontSize: 11, color: t.inkFaint, margin: "0 0 20px" }}>Reference: {error.digest}</p>
      )}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        <button type="button" onClick={isChunkError ? () => window.location.reload() : reset} style={{ ...btn, color: t.white, background: t.indigo, border: "none" }}>
          {isChunkError ? "Reload" : "Try again"}
        </button>
        <Link href={homeHref} style={{ ...btn, color: t.coal, background: t.white, border: `1px solid ${t.line}` }}>
          {homeLabel}
        </Link>
        <a href="mailto:hello@hirestepx.com" style={{ ...btn, color: t.inkSoft, background: "transparent", border: "none" }}>
          Contact support
        </a>
      </div>
    </div>
  );
}
