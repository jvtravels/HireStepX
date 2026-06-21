"use client";

import { useEffect, useState } from "react";

const CONSENT_KEY = "hirestepx_cookie_consent";

/** Emits a custom event so analytics code can lazy-load after consent. */
function broadcast(accepted: boolean) {
  try {
    window.dispatchEvent(new CustomEvent("hirestepx:cookie-consent", { detail: { accepted } }));
  } catch { /* noop */ }
}

export function getCookieConsent(): "accepted" | "rejected" | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    if (v === "accepted" || v === "rejected") return v;
  } catch { /* noop */ }
  return null;
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const existing = getCookieConsent();
    if (existing) return;
    // Delay slightly so first paint isn't blocked by the banner
    const t = setTimeout(() => setVisible(true), 400);
    return () => clearTimeout(t);
  }, []);

  const setConsent = (accepted: boolean) => {
    try { localStorage.setItem(CONSENT_KEY, accepted ? "accepted" : "rejected"); } catch { /* noop */ }
    broadcast(accepted);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <>
      <style>{`
        @media (max-width: 640px) {
          .hsx-cookie-banner {
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            max-width: 100% !important;
            border-radius: 14px 14px 0 0 !important;
            padding: 14px 16px env(safe-area-inset-bottom, 16px) !important;
            gap: 10px !important;
          }
        }
      `}</style>
    <div
      role="dialog"
      aria-label="Cookie consent"
      aria-describedby="cookie-consent-desc"
      className="hsx-cookie-banner"
      style={{
        position: "fixed",
        bottom: 20, left: 20, right: 20,
        maxWidth: 640, marginLeft: "auto", marginRight: "auto",
        zIndex: 9999,
        background: "#FDFAF6",
        border: "1px solid #E8E2D9",
        borderRadius: 14,
        padding: "18px 20px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)",
        color: "#0E0C08",
        fontFamily: "'Satoshi', system-ui, sans-serif",
        display: "flex",
        gap: 16,
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <div id="cookie-consent-desc" style={{ flex: "1 1 260px", fontSize: 13, lineHeight: 1.55, color: "#4A4540" }}>
        We use essential cookies to run HireStepX. With your permission we'll also use
        analytics cookies to improve the experience.{" "}
        <a href="/privacy" style={{ color: "#9B6E2E", textDecoration: "underline" }}>
          Privacy policy
        </a>
        .
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => setConsent(false)}
          style={{
            fontFamily: "inherit", fontSize: 13, fontWeight: 500,
            color: "#4A4540",
            background: "transparent",
            border: "1px solid #C8C0B4",
            borderRadius: 8, padding: "8px 14px",
            cursor: "pointer",
          }}
        >
          Essential only
        </button>
        <button
          type="button"
          onClick={() => setConsent(true)}
          style={{
            fontFamily: "inherit", fontSize: 13, fontWeight: 600,
            color: "#FDFAF6",
            background: "#1A1814",
            border: "1px solid #1A1814",
            borderRadius: 8, padding: "8px 14px",
            cursor: "pointer",
          }}
        >
          Accept all
        </button>
      </div>
    </div>
    </>
  );
}
