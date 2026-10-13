/* Builder for the GA4 init snippet. It is only ever rendered AFTER the visitor
   accepts analytics cookies (see ConsentGatedTelemetry.tsx) — before that,
   neither gtag.js nor this snippet is on the page.

   Consent Mode v2 order matters: `default` (all four signals denied) must run
   before gtag.js processes the config, then `update` flips them to granted
   because this script only exists post-opt-in. Withdrawal goes back through
   updateGtagConsent(false) in src/_browser-api-guards.ts.

   The text is identical for every visitor (no per-user values), which keeps it
   compatible with proxy.ts's inline-script allowance on the marketing routes. */
export function buildGa4InitScript(gaId: string): string {
  return `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            window['ga-disable-${gaId}'] = false;
            gtag('consent', 'default', { ad_storage: 'denied', analytics_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
            gtag('consent', 'update', { ad_storage: 'granted', analytics_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted' });
            gtag('js', new Date());
            gtag('config', '${gaId}', { anonymize_ip: true });
          `;
}
