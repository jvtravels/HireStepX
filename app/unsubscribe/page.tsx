import type { Metadata } from "next";
import { CATEGORY_LABEL, verifyUnsubscribeToken } from "../../server-handlers/_unsubscribe";
import UnsubscribeConfirm from "./UnsubscribeConfirm";

/* Public, no login. The token in the URL is the credential, so keep it out of
   Referer headers and search indexes. Rendering never changes state — the
   POST button in UnsubscribeConfirm does, which keeps email scanners that
   prefetch links from unsubscribing people. */
export const metadata: Metadata = {
  title: "Email preferences | HireStepX",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function Page({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const raw = (await searchParams).t;
  const token = typeof raw === "string" ? raw : "";
  const verified = token ? await verifyUnsubscribeToken(token) : null;
  return (
    <UnsubscribeConfirm
      token={verified?.ok ? token : null}
      label={verified?.ok ? CATEGORY_LABEL[verified.category] : null}
    />
  );
}
