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
/* app.hirestepx.com is the signed-in product (signup, onboarding, interviews,
   checkout, employer console); leaving it off meant GA4 only ever saw the
   marketing site. The _ga cookie is set on hirestepx.com, so one visitor
   keeps one client id across both hosts. */
/* staging.hirestepx.com is an alias of the production deployment, so it ships
   the same GA measurement ID; without a host check its traffic lands in the
   production property. Allowlist (not a staging blocklist) so previews and
   localhost stay out too. */
const GA4_HOSTS = new Set(["hirestepx.com", "www.hirestepx.com", "app.hirestepx.com"]);

export function isGa4Host(hostname: string): boolean {
  return GA4_HOSTS.has(hostname.toLowerCase());
}

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
