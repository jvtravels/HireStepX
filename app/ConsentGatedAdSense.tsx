"use client";

import Script from "next/script";
import { useCookieConsent } from "../src/useCookieConsent";

const ADSENSE_SRC = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7810403590527236";

/* Loads Google AdSense only after the visitor accepts the cookie banner.
   Replaces the raw <Script> that used to sit on every public marketing page.
   If consent is withdrawn the script is not rendered on the next navigation
   (an already-executed script can't be unloaded within the same page view). */
export default function ConsentGatedAdSense() {
  const consent = useCookieConsent();
  if (consent !== "accepted") return null;
  return <Script async src={ADSENSE_SRC} crossOrigin="anonymous" strategy="lazyOnload" />;
}
