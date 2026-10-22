"use client";

import ConsentGatedTelemetry from "./ConsentGatedTelemetry";

/* App/auth/admin counterpart (per-request CSP nonce). All gating logic lives
   in ConsentGatedTelemetry. */
export default function ConsentGatedAnalytics({ nonce, ga4 = true }: { nonce: string; ga4?: boolean }) {
  return <ConsentGatedTelemetry nonce={nonce} ga4={ga4} />;
}
