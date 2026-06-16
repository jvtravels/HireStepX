/* Pure pre-launch "Coming Soon" gate logic — extracted from middleware.ts so
 * it can be unit-tested without pulling in the Edge `next/server` runtime.
 *
 * The gate rewrites every non-allowed path on a PRE_LAUNCH host to `/`. The
 * allowlist below is the load-bearing part: anything missing from it gets the
 * homepage HTML instead of its real payload. That regression silently broke
 * the PWA manifest, robots.txt, sitemap.xml, favicons/app icons, the service
 * worker (sw.js) and the OpenGraph/Twitter share images — all of which serve
 * from root paths the catch-all was swallowing. These tests pin the allowlist
 * so a future edit can't re-break them. */

/** Marketing/legal pages reachable while gated. */
export const GATE_ALLOWLIST_PATHS = new Set(["/", "/blog", "/terms", "/privacy", "/refund"]);

/** Path prefixes reachable while gated (APIs, Next internals, shared views). */
export const GATE_ALLOWLIST_PREFIXES = ["/blog/", "/api/", "/_next/", "/page/", "/profile/", "/report/share/"];

/**
 * Static assets + SEO/PWA route handlers that must serve their REAL content
 * even while the gate is up. Without this they match the catch-all and get
 * rewritten to `/`, returning homepage HTML instead of their own payload.
 * These are public by nature, so exposing them pre-launch leaks nothing the
 * Coming Soon page doesn't already.
 */
export const GATE_ALLOWLIST_EXACT = new Set([
  "/robots.txt", "/sitemap.xml", "/manifest.json", "/sw.js",
  "/opengraph-image", "/twitter-image", "/favicon.ico",
]);

/** File-extension assets (icons, images, fonts, css, js chunks) served at root. */
export const STATIC_ASSET_RE = /\.(txt|xml|json|js|mjs|css|map|svg|png|jpe?g|gif|webp|avif|ico|webmanifest|woff2?|ttf|otf)$/i;

export function isAllowedOnGate(pathname: string): boolean {
  if (GATE_ALLOWLIST_PATHS.has(pathname)) return true;
  if (GATE_ALLOWLIST_EXACT.has(pathname)) return true;
  if (STATIC_ASSET_RE.test(pathname)) return true;
  return GATE_ALLOWLIST_PREFIXES.some(p => pathname.startsWith(p));
}
