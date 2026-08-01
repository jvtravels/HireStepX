"use client";
import { tokens as t, fonts } from "../auth/_tokens";
import { captureClientEvent } from "../posthogClient";

/* Isolated client island: the hero body/H1/subhead render server-side in
   Hero.tsx, but a native <a> can't carry an onClick handler outside a
   client boundary — this is the one piece of the CTA row that needs it. */
export function HeroCta() {
  return (
    <div
      className="mv2-hero-cta-row mv2-cascade mv2-cascade-4"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        marginTop: 40,
        flexWrap: "wrap",
        justifyContent: "center",
      }}
    >
      <a
        href="/signup"
        className="mv2-tap-44 mv2-cta-primary"
        onClick={() => captureClientEvent("hero_cta_clicked", { cta: "start_free", surface: "hero" })}
        style={{
          fontFamily: fonts.sans,
          fontSize: 16,
          fontWeight: 600,
          color: t.cream,
          background: t.indigo,
          padding: "15px 28px",
          borderRadius: 999,
          textDecoration: "none",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          whiteSpace: "nowrap",
          boxShadow: "0 4px 20px rgba(49,46,129,0.28)",
        }}
      >
        Start free session
        <span aria-hidden className="mv2-cta-arrow" style={{ fontSize: 17 }}>→</span>
      </a>
    </div>
  );
}
