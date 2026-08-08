import { headers } from "next/headers";
import ConsentGatedAnalytics from "./ConsentGatedAnalytics";

/* Reading headers() forces the segment that renders this dynamic — only
   mount it in route groups that are already per-request (app/auth/admin).
   Marketing routes must stay static/ISR, so they get MarketingAnalytics
   instead (hash-based, no live nonce). */
export default async function AnalyticsNonce() {
  const nonce = (await headers()).get("x-nonce") ?? "";
  return (
    <>
      <meta name="csp-nonce" content={nonce} />
      <ConsentGatedAnalytics nonce={nonce} />
    </>
  );
}
