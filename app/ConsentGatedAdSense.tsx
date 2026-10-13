"use client";

import Script from "next/script";
import { useConsentCategory } from "../src/useCookieConsent";

const ADSENSE_SRC = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7810403590527236";

/* Loads Google AdSense only after the visitor allows advertising cookies in the cookie banner.
   Replaces the raw <Script> that used to sit on every public marketing page.
   If consent is withdrawn the script is not rendered on the next navigation
   (an already-executed script can't be unloaded within the same page view). */
export default function ConsentGatedAdSense() {
  const advertising = useConsentCategory("advertising");
  if (!advertising) return null;
  return <Script async src={ADSENSE_SRC} crossOrigin="anonymous" strategy="lazyOnload" />;
}
