/* Next.js Edge Proxy (the `proxy` convention that replaced `middleware` in
 * Next.js 16) — Domain-based routing + pre-launch gate + CSP nonce injection
 *
 * hirestepx.com         → marketing pages (/, /blog, /terms, /privacy, /page/*)
 * www.hirestepx.com     → marketing pages (currently pre-launch gated)
 * app.hirestepx.com     → product pages (currently pre-launch gated — same as www)
 * staging.hirestepx.com → full app (team / pre-prod, never gated)
 * admin.hirestepx.com   → admin panel (server-side token-cookie gate)
 *
 * Pre-launch behavior: PRE_LAUNCH_HOSTS get every non-allowed path rewritten
 * to / (Coming Soon). API routes, static assets, and a small allowlist of
 * legal/marketing pages still pass through.
 *
 * To launch publicly: clear PRE_LAUNCH_HOSTS (or set NEXT_PUBLIC_COMING_SOON=0
 * which the marketing page handler also respects).
 *
 * Admin gate: admin.hirestepx.com checks for a valid `admin_token` cookie
 * (HMAC-signed via _admin-auth.ts). Unauthenticated requests are redirected
 * to /admin-login. API routes under /api/ are exempt (they carry their own
 * x-admin-token header auth).
 *
 * CSP nonce: a cryptographically random nonce is generated per request and
 * injected into both the x-nonce request header (read by app/layout.tsx via
 * `headers()`) and the Content-Security-Policy response header. CSP Level 2+
 * browsers enforce the nonce and silently ignore 'unsafe-inline'; Level 1
 * browsers fall back to 'unsafe-inline' (existing behaviour, no regression).
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isAllowedOnGate } from "./src/middlewareGate";

/* ── Per-request CSP nonce ──────────────────────────────────────────────────
 *
 * 'strict-dynamic' + nonce: CSP L2+ ignores 'unsafe-inline' when a nonce is
 * present, and 'strict-dynamic' allows scripts dynamically injected by a
 * trusted (nonced) script — covering Razorpay and PostHog loaders. The host
 * allowlist is kept as a CSP L1/L2 fallback for browsers that don't support
 * 'strict-dynamic' (they ignore it and fall back to the host list). No
 * 'unsafe-inline': inline scripts must carry the nonce from app/layout.tsx.
 */
function buildCsp(nonce: string): string {
  const n = `'nonce-${nonce}'`;
  return [
    "default-src 'self'",
    `script-src 'self' ${n} 'strict-dynamic' blob: https://checkout.razorpay.com https://*.razorpay.com https://va.vercel-scripts.com https://*.vercel-scripts.com https://www.googletagmanager.com`,
    `script-src-elem 'self' ${n} 'strict-dynamic' blob: https://checkout.razorpay.com https://*.razorpay.com https://va.vercel-scripts.com https://*.vercel-scripts.com https://us-assets.i.posthog.com https://www.googletagmanager.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.razorpay.com https://api.fontshare.com",
    "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.razorpay.com https://api.fontshare.com",
    "font-src 'self' https://fonts.gstatic.com https://api.fontshare.com https://cdn.fontshare.com",
    "img-src 'self' data: blob: https://images.unsplash.com https://*.supabase.co https://*.razorpay.com https://cdn.simpleicons.org https://t2.gstatic.com",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.groq.com https://generativelanguage.googleapis.com https://www.googleapis.com https://accounts.google.com https://oauth2.googleapis.com https://*.razorpay.com https://lumberjack.razorpay.com https://*.upstash.io https://vitals.vercel-insights.com https://va.vercel-scripts.com wss://api.cartesia.ai https://api.cartesia.ai wss://api.deepgram.com https://api.deepgram.com wss://api.sarvam.ai https://api.sarvam.ai https://*.tts.speech.microsoft.com https://api.resend.com https://*.sentry.io https://us.i.posthog.com https://us-assets.i.posthog.com https://*.i.posthog.com https://api.pwnedpasswords.com https://www.googletagmanager.com https://www.google-analytics.com https://analytics.google.com",
    "frame-src https://api.razorpay.com https://checkout.razorpay.com",
    "media-src 'self' blob: data:",
    "worker-src 'self' blob:",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
  ].join("; ");
}

const APP_HOST = "app.hirestepx.com";
const MARKETING_HOST = "hirestepx.com";
const ADMIN_HOST = "admin.hirestepx.com";

/* ── Admin token verification (Edge-compatible Web Crypto) ──────────────────
 *
 * Mirrors the Node crypto logic in server-handlers/_admin-auth.ts but using
 * SubtleCrypto so it runs in the V8 Edge runtime. Must stay in sync with the
 * signing scheme there: HMAC-SHA256, base64(JSON).sig format.
 *
 * The signing key is derived the same way: prefer ADMIN_SESSION_SECRET; fall
 * back to HMAC("hirestepx-admin-token-v1", ADMIN_PASSWORD). Empty key → reject
 * everything (fail-closed when env vars are missing).
 */

const ADMIN_TOKEN_DERIVATION_LABEL = "hirestepx-admin-token-v1";

async function deriveAdminSigningKey(): Promise<CryptoKey | null> {
  const secret = (process.env.ADMIN_SESSION_SECRET || "").trim();
  const password = (process.env.ADMIN_PASSWORD || "").trim();
  if (!secret && !password) return null;

  let rawKeyMaterial: string;
  if (secret) {
    rawKeyMaterial = secret;
  } else {
    // Replicate: createHmac("sha256", label).update(password).digest("hex")
    const labelBytes = new TextEncoder().encode(ADMIN_TOKEN_DERIVATION_LABEL);
    const pwBytes = new TextEncoder().encode(password);
    const baseKey = await crypto.subtle.importKey("raw", labelBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const derived = await crypto.subtle.sign("HMAC", baseKey, pwBytes);
    rawKeyMaterial = Array.from(new Uint8Array(derived)).map(b => b.toString(16).padStart(2, "0")).join("");
  }

  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(rawKeyMaterial),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
}

async function verifyAdminTokenCookie(token: string): Promise<boolean> {
  try {
    const dotIdx = token.indexOf(".");
    if (dotIdx === -1) return false;
    const dataB64 = token.slice(0, dotIdx);
    const sigHex = token.slice(dotIdx + 1);
    if (!dataB64 || !sigHex) return false;

    const key = await deriveAdminSigningKey();
    if (!key) return false;

    const dataStr = atob(dataB64);

    // Convert hex signature to bytes and use crypto.subtle.verify() — this is
    // the correct usage for a key imported with ["verify"]. The previous code
    // called crypto.subtle.sign() on a ["verify"] key, which throws a
    // NotSupportedError caught silently, causing every valid cookie to be rejected.
    if (sigHex.length % 2 !== 0) return false;
    const sigBytes = new Uint8Array(sigHex.match(/.{2}/g)!.map(b => parseInt(b, 16)));
    const valid = await crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(dataStr));
    if (!valid) return false;

    const payload = JSON.parse(dataStr) as { exp?: unknown };
    if (typeof payload.exp !== "number" || Date.now() > payload.exp) return false;

    return true;
  } catch {
    return false;
  }
}

const MARKETING_PATHS = new Set(["/", "/blog", "/terms", "/privacy", "/refund"]);
const MARKETING_PREFIXES = ["/blog/", "/page/", "/profile/"];

const APP_PREFIXES = [
  "/dashboard", "/sessions", "/calendar", "/analytics", "/resume", "/settings",
  "/session/", "/interview", "/onboarding", "/signup", "/login", "/reset-password",
  "/auth/callback",
];

/**
 * Pre-launch "Coming Soon" gate (restored 2026-06-16).
 *
 * Hosts that show ONLY the Coming Soon shell + the tiny allowlist below.
 * Everything else gets rewritten to `/` so the gate can't be bypassed by
 * typing /dashboard, /login, /admin, etc. directly.
 *
 * staging.hirestepx.com is intentionally EXCLUDED so the team can keep
 * working with the full app while the public hosts are still gated.
 *
 * Manual override: NEXT_PUBLIC_COMING_SOON=0 disables the gate everywhere
 * (single-env-var public launch). The marketing page handler respects the
 * same flag so the two stay in sync.
 */
const PRE_LAUNCH_HOSTS = new Set<string>([
  // Cleared for public launch — gate disabled on all hosts.
]);

// Gate allowlist logic (which paths stay reachable while gated) lives in
// src/middlewareGate.ts — pure and unit-tested. Allowed: marketing/legal
// pages, /api, /_next, shared views, plus all static + SEO/PWA assets.

function isMarketingPath(pathname: string): boolean {
  if (MARKETING_PATHS.has(pathname)) return true;
  return MARKETING_PREFIXES.some(p => pathname.startsWith(p));
}

function isAppPath(pathname: string): boolean {
  return APP_PREFIXES.some(p => pathname.startsWith(p));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.nextUrl.hostname;

  // Generate a per-request nonce and forward it to server components via
  // x-nonce so app/layout.tsx can attach it to JSON-LD <script> tags.
  // crypto.randomUUID() is available on all WinterCG-compliant runtimes.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  // Helper: attach nonce to request headers so server components can read it,
  // and set the CSP + hardening response headers on the final response.
  function withCsp(response: NextResponse): NextResponse {
    response.headers.set("Content-Security-Policy", csp);
    // Cross-origin isolation: prevent cross-origin window.opener access and
    // restrict how this page can be embedded by other origins.
    response.headers.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
    // Restrict what browser features can be used; deny mic/camera/geolocation
    // except on same-origin (payment and interview pages request mic via JS).
    response.headers.set(
      "Permissions-Policy",
      "camera=(), geolocation=(), payment=(self), microphone=(self), usb=(), bluetooth=()",
    );
    // Prevent MIME-type sniffing on responses.
    response.headers.set("X-Content-Type-Options", "nosniff");
    return response;
  }
  function nextWithNonce(): NextResponse {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nonce", nonce);
    return withCsp(NextResponse.next({ request: { headers: requestHeaders } }));
  }

  // Skip routing logic in development — still inject CSP so local dev matches prod.
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return nextWithNonce();
  }

  // ─── Pre-launch gate ─────────────────────────────────────────────
  // Manual override: NEXT_PUBLIC_COMING_SOON=0 disables the gate everywhere
  // so the team can do a public launch by flipping a single env var.
  // The admin subdomain is exempt so the team can still reach the panel.
  const gateDisabled = process.env.NEXT_PUBLIC_COMING_SOON === "0";
  if (!gateDisabled && hostname !== ADMIN_HOST && PRE_LAUNCH_HOSTS.has(hostname) && !isAllowedOnGate(pathname)) {
    // Rewrite (not redirect) so the URL stays clean and the user lands on
    // the Coming Soon page rendered by app/(marketing)/page.tsx.
    const url = request.nextUrl.clone();
    url.pathname = "/";
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nonce", nonce);
    return withCsp(NextResponse.rewrite(url, { request: { headers: requestHeaders } }));
  }

  // Admin subdomain — gate page routes behind admin_token cookie, then rewrite
  if (hostname === ADMIN_HOST) {
    // API routes and auth callback carry their own auth (x-admin-token header);
    // don't add a cookie gate here — that would break the existing API flow.
    if (pathname.startsWith("/api/") || pathname.startsWith("/auth/")) {
      return nextWithNonce();
    }

    // /admin-login is the unauthenticated entry point — let it through always.
    if (pathname === "/admin-login") {
      return nextWithNonce();
    }

    // The service worker script must be served directly — browsers reject SW
    // registration when the script URL returns a redirect, even on authed subdomains.
    if (pathname === "/sw.js") {
      return nextWithNonce();
    }

    // Verify the admin_token cookie.
    const tokenCookie = request.cookies.get("admin_token")?.value;
    const authed = tokenCookie ? await verifyAdminTokenCookie(tokenCookie) : false;

    if (!authed) {
      // Redirect to the login page (on the same subdomain).
      const url = request.nextUrl.clone();
      url.pathname = "/admin-login";
      return withCsp(NextResponse.redirect(url));
    }

    // Authenticated — rewrite root and non-/admin paths to /admin.
    if (pathname === "/" || !pathname.startsWith("/admin")) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-nonce", nonce);
      return withCsp(NextResponse.rewrite(url, { request: { headers: requestHeaders } }));
    }
    return nextWithNonce();
  }

  // On marketing domain → redirect app paths to app subdomain
  if (hostname === MARKETING_HOST || hostname === `www.${MARKETING_HOST}`) {
    if (isAppPath(pathname)) {
      const url = request.nextUrl.clone();
      url.hostname = APP_HOST;
      url.port = "";
      return withCsp(NextResponse.redirect(url, 307));
    }
    // Redirect /admin to admin subdomain
    if (pathname.startsWith("/admin")) {
      const url = request.nextUrl.clone();
      url.hostname = ADMIN_HOST;
      url.pathname = "/";
      url.port = "";
      return withCsp(NextResponse.redirect(url, 307));
    }
  }

  // On app subdomain → redirect marketing paths to root domain
  if (hostname === APP_HOST) {
    if (isMarketingPath(pathname)) {
      const url = request.nextUrl.clone();
      url.hostname = MARKETING_HOST;
      url.port = "";
      return withCsp(NextResponse.redirect(url, 307));
    }
    // Redirect /admin to admin subdomain
    if (pathname.startsWith("/admin")) {
      const url = request.nextUrl.clone();
      url.hostname = ADMIN_HOST;
      url.pathname = "/";
      url.port = "";
      return withCsp(NextResponse.redirect(url, 307));
    }
  }

  return nextWithNonce();
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|robots\\.txt|sitemap.*\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?|ico)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
