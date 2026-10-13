"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import Script from "next/script";
import { useConsentCategory } from "../src/useCookieConsent";
import { initPostHog, shutdownPostHog } from "../src/posthogClient";
import { updateGtagConsent } from "../src/_browser-api-guards";
import { buildGa4InitScript } from "./_ga4-script";

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

// Dynamically imported only after opt-in — keeps ~20KB out of the default bundle
const Analytics = dynamic(() => import("@vercel/analytics/next").then(m => m.Analytics), { ssr: false });
const SpeedInsights = dynamic(() => import("@vercel/speed-insights/next").then(m => m.SpeedInsights), { ssr: false });

/* Single consent gate for every non-essential measurement tool: GA4 (gtag.js),
   PostHog, Vercel Web Analytics and Vercel Speed Insights. All of them need the
   "analytics" choice; the advertising choice only drives GA4's ad_* signals
   (AdSense itself is gated in ConsentGatedAdSense). Nothing is loaded,
   initialised or stored until the visitor allows analytics; on withdrawal GA4 is put
   back to denied/disabled and PostHog is opted out immediately, and none of
   the scripts render on the next navigation.

   nonce: app/auth/admin routes pass the per-request CSP nonce; marketing
   routes are static/ISR and pass none (proxy.ts allows their inline script). */
export default function ConsentGatedTelemetry({ nonce, ga4 = true }: { nonce?: string; ga4?: boolean }) {
  const accepted = useConsentCategory("analytics");
  const advertising = useConsentCategory("advertising");

  useEffect(() => {
    if (!accepted) {
      // Covers withdrawal mid-session; harmless no-ops when nothing was ever started.
      updateGtagConsent(false, GA_ID);
      shutdownPostHog();
      return;
    }
    // Deferred to idle so SDK import/init stays off the critical path;
    // posthogClient buffers events captured before it's ready.
    const start = () => { void initPostHog(); };
    const idleApi: Partial<Pick<Window, "requestIdleCallback" | "cancelIdleCallback">> = window;
    const handle = idleApi.requestIdleCallback
      ? idleApi.requestIdleCallback(start, { timeout: 3000 })
      : window.setTimeout(start, 1500);
    updateGtagConsent(true, GA_ID, advertising);
    return () => {
      if (idleApi.requestIdleCallback && idleApi.cancelIdleCallback) idleApi.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
    };
  }, [accepted, advertising]);

  if (!accepted) return null;

  return (
    <>
      <Analytics />
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
