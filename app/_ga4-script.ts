/* Shared builder for the GA4 init snippet, used by both ConsentGatedAnalytics
   (app/auth/admin, nonced) and MarketingAnalytics (static marketing routes).
   Marketing routes carry no per-request nonce; proxy.ts's buildCsp() allows
   their inline scripts via 'unsafe-inline' + a host allowlist instead (a
   prior content-hash allowlist for this exact script, backed by
   data/generated/jsonld-csp-hashes.json's "__global__" key, caused the
   2026-08-10 outage when Next.js's own framework-injected inline scripts
   couldn't be covered by hashes — see proxy.ts for the full story). That
   manifest's generator still runs at prebuild but nothing reads its
   "__global__" entry for CSP enforcement anymore, so changes here don't
   require regenerating it.

   Always loads gtag.js (Consent Mode v2) instead of waiting for cookie
   consent — PostHog already switched to this "load always, gate storage"
   model after discovering the previous all-or-nothing consent gate meant
   only visitors who explicitly clicked Accept ever sent a hit, so GA4
   Realtime read near-zero even with real traffic. The script reads the
   consent decision straight out of localStorage at execution time (the
   source text here is still identical for every visitor, which is what
   the CSP hash actually requires — only the runtime branch differs), so
   Consent Mode starts in the right state immediately; ConsentGatedAnalytics/
   MarketingAnalytics call updateGtagConsent() to upgrade it live if the
   visitor accepts mid-session. */
export function buildGa4InitScript(gaId: string): string {
  return `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            var __hsxConsent = "denied";
            try {
              if (localStorage.getItem("hirestepx_cookie_consent") === "accepted") __hsxConsent = "granted";
            } catch (e) {}
            gtag('consent', 'default', { analytics_storage: __hsxConsent, ad_storage: 'denied' });
            gtag('js', new Date());
            gtag('config', '${gaId}', { anonymize_ip: true });
          `;
}
