"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Script from "next/script";
import { getCookieConsent } from "./CookieConsent";
import { initPostHog, upgradePostHogPersistence } from "../src/posthogClient";

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

// Dynamically imported only when user accepts — keeps ~20KB out of the default bundle
const Analytics = dynamic(() => import("@vercel/analytics/next").then(m => m.Analytics), { ssr: false });
const SpeedInsights = dynamic(() => import("@vercel/speed-insights/next").then(m => m.SpeedInsights), { ssr: false });

export default function ConsentGatedAnalytics() {
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    const isAccepted = getCookieConsent() === "accepted";
    setAccepted(isAccepted);
    // Init PostHog immediately either way. Accepted → persistent (cookie).
    // Not-yet-decided or rejected → cookieless "memory" mode so anonymous
    // pageviews are still counted (GDPR-safe, no id written). This closes the
    // visibility gap where DAU read near-zero because only consented visitors
    // ever loaded the SDK.
    void initPostHog(isAccepted ? "localStorage+cookie" : "memory");
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ accepted: boolean }>).detail;
      const nowAccepted = !!detail?.accepted;
      setAccepted(nowAccepted);
      // Upgrade the already-running cookieless instance to persistent storage
      // (or init it if the key loaded late). No SDK reload needed.
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
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">{`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_ID}', { anonymize_ip: true });
          `}</Script>
        </>
      )}
    </>
  );
}
