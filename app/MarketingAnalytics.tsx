"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Script from "next/script";
import { getCookieConsent } from "./CookieConsent";
import { initPostHog, upgradePostHogPersistence } from "../src/posthogClient";
import { buildGa4InitScript } from "./_ga4-script";

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

// Dynamically imported only when user accepts — keeps ~20KB out of the default bundle
const Analytics = dynamic(() => import("@vercel/analytics/next").then(m => m.Analytics), { ssr: false });
const SpeedInsights = dynamic(() => import("@vercel/speed-insights/next").then(m => m.SpeedInsights), { ssr: false });

/* Marketing-route counterpart to ConsentGatedAnalytics — no live per-request
   nonce (marketing pages are static/ISR, so there's no headers() call to mint
   one). The GTM loader is allowlisted by host (proxy.ts drops 'strict-dynamic'
   for these routes so the host allowlist actually applies), and the ga4-init
   inline script is allowlisted by a build-time content hash instead
   (data/generated/jsonld-csp-hashes.json, key "__global__") since its content
   is deterministic — only NEXT_PUBLIC_GA_MEASUREMENT_ID varies, and that's a
   build-time env var, not per-request. */
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
      }
    };
    window.addEventListener("hirestepx:cookie-consent", handler);
    return () => window.removeEventListener("hirestepx:cookie-consent", handler);
  }, []);

  if (!accepted) return null;
  return (
    <>
      <Analytics />
      <SpeedInsights />
      {GA_ID && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
          <Script id="ga4-init" strategy="afterInteractive">{buildGa4InitScript(GA_ID)}</Script>
        </>
      )}
    </>
  );
}
