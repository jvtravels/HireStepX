"use client";

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", padding: 32, background: "#FAF7F0", fontFamily: "var(--font-ui, system-ui, sans-serif)" }}>
      <h2 style={{ fontSize: 24, fontWeight: 600, color: "#0E0C08", marginBottom: 8 }}>Something went wrong</h2>
      <p style={{ fontSize: 14, color: "#5c574e", marginBottom: 24 }}>An unexpected error occurred. Please try again.</p>
      <button
        onClick={reset}
        style={{ padding: "10px 24px", fontSize: 14, fontWeight: 500, color: "#FAF7F0", background: "#B45309", border: "none", borderRadius: 8, cursor: "pointer" }}
      >
        Try again
      </button>
    </div>
  );
}
