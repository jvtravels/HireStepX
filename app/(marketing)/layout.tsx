import MarketingShell from "./MarketingShell";
import { BetaBanner } from "../BetaBanner";
import MarketingAnalytics from "../MarketingAnalytics";
import { fetchLiveOpenings } from "../../server-handlers/_public-openings-fetch";
import { OpeningsFlagProvider } from "../../src/marketing-v2/openingsFlag";

/* Server component — passes through children to the client-side providers
   wrapper. Previously `ssr: false` skipped server rendering entirely, which
   blanked the marketing pages for crawlers and tanked LCP. MarketingShell is
   already "use client"; SSR emits its markup and hydration takes over.

   No headers() call here — that's the whole point. Marketing pages need to
   stay static/ISR so Google can actually crawl and index them; analytics
   gets a hash-allowlisted variant (MarketingAnalytics) instead of the live
   per-request nonce used in app/(app), app/(auth), and app/admin. */
export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const live = (await fetchLiveOpenings()).length > 0;
  return (
    <>
      <BetaBanner />
      <OpeningsFlagProvider live={live}>
        <MarketingShell>{children}</MarketingShell>
      </OpeningsFlagProvider>
      <MarketingAnalytics />
    </>
  );
}
