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

/* Marketing-route counterpart to ConsentGatedAnalytics — no live per-request
   nonce (marketing pages are static/ISR, so there's no headers() call to mint
   one). Both the GTM loader and the ga4-init inline script are allowed via
   proxy.ts's 'unsafe-inline' + host allowlist for these routes (see the
   doc comment on buildGa4InitScript in _ga4-script.ts for why the earlier
   content-hash allowlist for this script was abandoned). */
export default function MarketingAnalytics() {
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    const isAccepted = getCookieConsent() === "accepted";
    setAccepted(isAccepted);
    void initPostHog(isAccepted ? "localStorage+cookie" : "memory");
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ accepted: boolean }>).detail;
      const nowAccepted = !!detail?.accepted;
      setAccepted(nowAccepted);
      if (nowAccepted) {
        void initPostHog("localStorage+cookie");
        upgradePostHogPersistence();
        updateGtagConsent(true);
      }
    };
    window.addEventListener("hirestepx:cookie-consent", handler);
    return () => window.removeEventListener("hirestepx:cookie-consent", handler);
  }, []);

  return (
    <>
      {accepted && <Analytics />}
      {accepted && <SpeedInsights />}
      {GA_ID && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
          <Script id="ga4-init" strategy="afterInteractive">{buildGa4InitScript(GA_ID)}</Script>
        </>
      )}
    </>
  );
}
