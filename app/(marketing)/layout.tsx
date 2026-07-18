import MarketingShell from "./MarketingShell";
import { BetaBanner } from "../BetaBanner";

/* Server component — passes through children to the client-side providers
   wrapper. Previously `ssr: false` skipped server rendering entirely, which
   blanked the marketing pages for crawlers and tanked LCP. MarketingShell is
   already "use client"; SSR emits its markup and hydration takes over. */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BetaBanner />
      <MarketingShell>{children}</MarketingShell>
    </>
  );
}
