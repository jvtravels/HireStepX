/* Shared builder for the GA4 init snippet so ConsentGatedAnalytics (nonced,
   for app/auth/admin) and MarketingAnalytics (hash-allowlisted, for static
   marketing routes) render byte-identical content — the CSP hash in
   data/generated/jsonld-csp-hashes.json (key "__global__") is computed from
   this same function, so any change here must be followed by
   `npm run generate:jsonld-hashes`. */
export function buildGa4InitScript(gaId: string): string {
  return `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${gaId}', { anonymize_ip: true });
          `;
}
