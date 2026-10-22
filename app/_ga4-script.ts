import { CONSENT_KEY } from "../src/consent";

/* Builder for the GA4 init snippet. It is only ever rendered AFTER the visitor
   accepts analytics cookies (see ConsentGatedTelemetry.tsx) — before that,
   neither gtag.js nor this snippet is on the page.

   Consent Mode v2 order matters: `default` (all four signals denied) must run
   before gtag.js processes the config, then `update` flips them to granted
   analytics_storage (this script only exists post-opt-in). The ad_* signals
   follow the separate advertising choice, read from the consent record at run
   time so the text stays identical for every visitor. Later changes and
   withdrawal go through updateGtagConsent in src/_browser-api-guards.ts.

   The text is identical for every visitor (no per-user values), which keeps it
   compatible with proxy.ts's inline-script allowance on the marketing routes. */
export function buildGa4InitScript(gaId: string): string {
  return `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            window['ga-disable-${gaId}'] = false;
            gtag('consent', 'default', { ad_storage: 'denied', analytics_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
            var hsxAds = 'denied';
            try { hsxAds = JSON.parse(localStorage.getItem('${CONSENT_KEY}') || '{}').advertising === true ? 'granted' : 'denied'; } catch (e) {}
            gtag('consent', 'update', { analytics_storage: 'granted', ad_storage: hsxAds, ad_user_data: hsxAds, ad_personalization: hsxAds });
            gtag('js', new Date());
            gtag('config', '${gaId}', { anonymize_ip: true });
          `;
}
