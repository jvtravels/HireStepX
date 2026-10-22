"use client";

import ConsentGatedTelemetry from "./ConsentGatedTelemetry";

/* Marketing-route counterpart — no live per-request nonce (marketing pages are
   static/ISR, so there's no headers() call to mint one; proxy.ts allows the
   inline GA init for these routes via 'unsafe-inline' + a host allowlist).
   All gating logic lives in ConsentGatedTelemetry. */
export default function MarketingAnalytics() {
  return <ConsentGatedTelemetry />;
}
