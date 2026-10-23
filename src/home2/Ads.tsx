import Script from "next/script";

/* Staging is an alias of the production deployment, so ads stay off until these routes replace the real ones; flip at promotion. */
const SHOW_ADS = false;

export function Ads({ thin }: { thin: boolean }) {
  if (!SHOW_ADS || thin) return null;
  return (
    <Script
      async
      src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7810403590527236"
      crossOrigin="anonymous"
      strategy="lazyOnload"
    />
  );
}
