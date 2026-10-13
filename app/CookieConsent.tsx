"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { captureClientEvent } from "../src/posthogClient";
import {
  OPEN_SETTINGS_EVENT,
  getCookieConsent,
  setCookieConsent,
  type ConsentChoice,
} from "../src/consent";

// Re-exported so existing importers keep working; the store lives in src/consent.ts.
export { getCookieConsent };

const choiceButtonStyle = {
  fontFamily: "inherit", fontSize: 13, fontWeight: 600,
  color: "#FDFAF6",
  background: "#1A1814",
  border: "1px solid #1A1814",
  padding: "8px 14px",
} as const;

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState<ConsentChoice | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    // First visit, or the banner version changed (parseStoredConsent returns
    // null for a stale version) -> ask. Delay slightly so first paint isn't
    // blocked by the banner. No analytics event here: nothing may be sent
    // before the visitor opts in.
    let t: ReturnType<typeof setTimeout> | undefined;
    if (!getCookieConsent()) t = setTimeout(() => setVisible(true), 400);
    // Footer / account-menu "Cookie settings" link: reopen so a previous
    // choice can be changed as easily as it was given.
    const reopen = () => { setCurrent(getCookieConsent()); setExpanded(true); setVisible(true); };
    window.addEventListener(OPEN_SETTINGS_EVENT, reopen);
    return () => {
      if (t) clearTimeout(t);
      window.removeEventListener(OPEN_SETTINGS_EVENT, reopen);
    };
  }, []);

  const choose = (accepted: boolean) => {
    setCookieConsent(accepted ? "accepted" : "rejected");
    // Only a consented visitor's PostHog is running; for a rejection (or a
    // withdrawal) this is dropped by the client, so nothing is sent.
    if (accepted) captureClientEvent("cookie_consent_accepted");
    setCurrent(accepted ? "accepted" : "rejected");
    setVisible(false);
    setExpanded(false);
  };

  if (!visible) return null;

  // Ads only run on the public marketing host; the signed-in app host has none.
  const showAdsNote = !window.location.hostname.startsWith("app.");

  return (
    <>
      <style>{`
        .hsx-cookie-toggle { font: inherit; color: #8A5F22; text-decoration: underline; background: none; border: 0; padding: 0 4px; cursor: pointer; }
        @media (max-width: 640px) {
          .hsx-cookie-banner {
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            max-width: 100% !important;
            border-radius: 14px 14px 0 0 !important;
            padding: 12px 16px max(12px, env(safe-area-inset-bottom, 0px)) !important;
            gap: 10px !important;
          }
          .hsx-cookie-banner > div:first-child { flex: 1 1 100% !important; font-size: 12.5px !important; line-height: 1.5 !important; }
          .hsx-cookie-actions { width: 100% !important; flex-wrap: nowrap !important; }
          .hsx-cookie-actions > button { flex: 1 1 0 !important; }
          .hsx-cookie-toggle { min-height: 44px; padding: 0 8px; }
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
        fontFamily: "'Geist Sans', system-ui, sans-serif",
        display: "flex",
        gap: 16,
        alignItems: "center",
        flexWrap: "wrap",
        maxHeight: "85dvh",
        overflowY: "auto",
      }}
    >
      <div id="cookie-consent-desc" style={{ flex: "1 1 260px", fontSize: 13, lineHeight: 1.55, color: "#4A4540" }}>
        <strong style={{ color: "#0E0C08" }}>Your cookie choices.</strong>{" "}
        {current && <>You currently have <strong>{current === "accepted" ? "Accept all" : "Essential only"}</strong> selected. </>}
        {expanded
          ? <>Nothing below loads unless you choose &ldquo;Accept all&rdquo;.</>
          : <>Essential cookies keep you signed in. Analytics{showAdsNote ? " and advertising" : ""} cookies only load if you choose &ldquo;Accept all&rdquo;.</>}{" "}
        <button
          type="button"
          className="hsx-cookie-toggle"
          aria-expanded={expanded}
          aria-controls="cookie-consent-details"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Hide details" : "Details"}
        </button>
        {expanded && <div id="cookie-consent-details">
        <ul style={{ margin: "8px 0 8px", paddingLeft: 18 }}>
          <li><strong>Essential (always on):</strong> sign-in, security, and remembering this choice.</li>
          <li>
            <strong>Analytics (optional):</strong> Google Analytics 4 (pages visited and usage, sets cookies);
            PostHog (product events such as sessions started, linked to your account ID, never your email; no
            session recording); Vercel Web Analytics and Speed Insights (page views and load speed).
          </li>
          {showAdsNote && (
            <li><strong>Advertising (optional):</strong> Google AdSense on public blog, questions and salary pages may set advertising cookies to show ads.</li>
          )}
        </ul>
        You can change this any time from &ldquo;Cookie settings&rdquo; in the footer or account menu.{" "}
        <a href="/privacy" style={{ color: "#8A5F22", textDecoration: "underline", display: "inline-block", padding: "12px 4px", margin: "-12px -4px" }}>
          Privacy policy
        </a>
        .
        </div>}
      </div>
      <div className="hsx-cookie-actions" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {/* Equal prominence: identical size, weight and fill for both choices. */}
        <Button type="button" variant="default" size="sm" onClick={() => choose(false)} style={choiceButtonStyle}>
          Essential only
        </Button>
        <Button type="button" variant="default" size="sm" onClick={() => choose(true)} style={choiceButtonStyle}>
          Accept all
        </Button>
      </div>
    </div>
    </>
  );
}
