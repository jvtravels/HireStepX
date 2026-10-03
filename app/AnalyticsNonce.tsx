import { headers } from "next/headers";
import ConsentGatedAnalytics from "./ConsentGatedAnalytics";

/* Reading headers() forces the segment that renders this dynamic — only
   mount it in route groups that are already per-request (app/auth/admin).
   Marketing routes must stay static/ISR, so they get MarketingAnalytics
   instead (hash-based, no live nonce).

   ga4=false (admin/admin-login) keeps this dynamic-rendering + nonce-meta
   role but drops the GA4 script tags: admin staff pageviews aren't
   candidate traffic and were skewing GA4's pageview/user counts. PostHog
   stays on for admin (internal usage analytics, separate product). */
export default async function AnalyticsNonce({ ga4 = true }: { ga4?: boolean } = {}) {
  const nonce = (await headers()).get("x-nonce") ?? "";
  return (
    <>
      <meta name="csp-nonce" content={nonce} />
      <ConsentGatedAnalytics nonce={nonce} ga4={ga4} />
    </>
  );
}
