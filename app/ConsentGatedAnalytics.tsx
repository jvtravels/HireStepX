"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Script from "next/script";
import { getCookieConsent } from "./CookieConsent";
import { initPostHog, upgradePostHogPersistence } from "../src/posthogClient";
import { updateGtagConsent } from "../src/_browser-api-guards";
import { buildGa4InitScript } from "./_ga4-script";

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

// Dynamically imported only when user accepts — keeps ~20KB out of the default bundle
const Analytics = dynamic(() => import("@vercel/analytics/next").then(m => m.Analytics), { ssr: false });
const SpeedInsights = dynamic(() => import("@vercel/speed-insights/next").then(m => m.SpeedInsights), { ssr: false });

export default function ConsentGatedAnalytics({ nonce, ga4 = true }: { nonce: string; ga4?: boolean }) {
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    const isAccepted = getCookieConsent() === "accepted";
    setAccepted(isAccepted);
    // Init PostHog immediately either way. Accepted → persistent (cookie).
    // Not-yet-decided or rejected → cookieless "memory" mode so anonymous
    // pageviews are still counted (GDPR-safe, no id written). This closes the
    // visibility gap where DAU read near-zero because only consented visitors
    // ever loaded the SDK.
    // Deferred to idle so the SDK's import/init stays off the critical path;
    // posthogClient buffers events captured before it's ready, so nothing is lost.
    const startPostHog = () => { void initPostHog(isAccepted ? "localStorage+cookie" : "memory"); };
    const idleApi: Partial<Pick<Window, "requestIdleCallback" | "cancelIdleCallback">> = window;
    const idleHandle = idleApi.requestIdleCallback
      ? idleApi.requestIdleCallback(startPostHog, { timeout: 3000 })
      : window.setTimeout(startPostHog, 1500);
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ accepted: boolean }>).detail;
      const nowAccepted = !!detail?.accepted;
      setAccepted(nowAccepted);
      // Upgrade the already-running cookieless instance to persistent storage
      // (or init it if the key loaded late). No SDK reload needed.
      if (nowAccepted) {
        void initPostHog("localStorage+cookie");
        upgradePostHogPersistence();
        updateGtagConsent(true);
      }
    };
    window.addEventListener("hirestepx:cookie-consent", handler);
    return () => {
      window.removeEventListener("hirestepx:cookie-consent", handler);
      if (idleApi.requestIdleCallback && idleApi.cancelIdleCallback) idleApi.cancelIdleCallback(idleHandle);
      else window.clearTimeout(idleHandle);
    };
  }, []);

  return (
    <>
      {accepted && <Analytics />}
      {/* Speed Insights reports anonymized, aggregate Core Web Vitals (no
       * cookies, no per-user identity) — not gated behind cookie consent like
       * Analytics/GA4/PostHog, which do persist per-visitor identifiers. Most
       * India mobile visitors don't accept the cookie banner, which was
       * leaving Web Vitals blind for the bulk of real-world traffic. */}
      <SpeedInsights />
      {ga4 && GA_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="lazyOnload"
            nonce={nonce}
          />
          <Script id="ga4-init" strategy="lazyOnload" nonce={nonce}>{buildGa4InitScript(GA_ID)}</Script>
        </>
      )}
    </>
  );
}
