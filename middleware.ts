/* Next.js Edge Middleware — Domain-based routing + pre-launch gate
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
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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
    const expectedSigBytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(dataStr));
    const expectedSigHex = Array.from(new Uint8Array(expectedSigBytes)).map(b => b.toString(16).padStart(2, "0")).join("");

    // Constant-time hex comparison
    if (sigHex.length !== expectedSigHex.length) return false;
    let diff = 0;
    for (let i = 0; i < sigHex.length; i++) diff |= sigHex.charCodeAt(i) ^ expectedSigHex.charCodeAt(i);
    if (diff !== 0) return false;

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
  "hirestepx.com",
  "www.hirestepx.com",
  "app.hirestepx.com",
]);

/**
 * Paths still reachable on a gated host. Everything else rewrites to `/`.
 * - "/" → renders Coming Soon page
 * - "/blog", "/terms", "/privacy", "/refund" → public marketing/legal
 * - "/api/" → waitlist + analytics endpoints stay reachable
 * - "/_next/", "/page/", "/profile/", "/report/share/" → static + shared views
 */
const GATE_ALLOWLIST_PATHS = new Set(["/", "/blog", "/terms", "/privacy", "/refund"]);
const GATE_ALLOWLIST_PREFIXES = ["/blog/", "/api/", "/_next/", "/page/", "/profile/", "/report/share/"];

function isAllowedOnGate(pathname: string): boolean {
  if (GATE_ALLOWLIST_PATHS.has(pathname)) return true;
  return GATE_ALLOWLIST_PREFIXES.some(p => pathname.startsWith(p));
}

function isMarketingPath(pathname: string): boolean {
  if (MARKETING_PATHS.has(pathname)) return true;
  return MARKETING_PREFIXES.some(p => pathname.startsWith(p));
}

function isAppPath(pathname: string): boolean {
  return APP_PREFIXES.some(p => pathname.startsWith(p));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.nextUrl.hostname;

  // Skip in development
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return NextResponse.next();
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
    return NextResponse.rewrite(url);
  }

  // Admin subdomain — gate page routes behind admin_token cookie, then rewrite
  if (hostname === ADMIN_HOST) {
    // API routes and auth callback carry their own auth (x-admin-token header);
    // don't add a cookie gate here — that would break the existing API flow.
    if (pathname.startsWith("/api/") || pathname.startsWith("/auth/")) {
      return NextResponse.next();
    }

    // /admin-login is the unauthenticated entry point — let it through always.
    if (pathname === "/admin-login") {
      return NextResponse.next();
    }

    // Verify the admin_token cookie.
    const tokenCookie = request.cookies.get("admin_token")?.value;
    const authed = tokenCookie ? await verifyAdminTokenCookie(tokenCookie) : false;

    if (!authed) {
      // Redirect to the login page (on the same subdomain).
      const url = request.nextUrl.clone();
      url.pathname = "/admin-login";
      return NextResponse.redirect(url);
    }

    // Authenticated — rewrite root and non-/admin paths to /admin.
    if (pathname === "/" || !pathname.startsWith("/admin")) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // On marketing domain → redirect app paths to app subdomain
  if (hostname === MARKETING_HOST || hostname === `www.${MARKETING_HOST}`) {
    if (isAppPath(pathname)) {
      const url = request.nextUrl.clone();
      url.hostname = APP_HOST;
      url.port = "";
      return NextResponse.redirect(url, 307);
    }
    // Redirect /admin to admin subdomain
    if (pathname.startsWith("/admin")) {
      const url = request.nextUrl.clone();
      url.hostname = ADMIN_HOST;
      url.pathname = "/";
      url.port = "";
      return NextResponse.redirect(url, 307);
    }
  }

  // On app subdomain → redirect marketing paths to root domain
  if (hostname === APP_HOST) {
    if (isMarketingPath(pathname)) {
      const url = request.nextUrl.clone();
      url.hostname = MARKETING_HOST;
      url.port = "";
      return NextResponse.redirect(url, 307);
    }
    // Redirect /admin to admin subdomain
    if (pathname.startsWith("/admin")) {
      const url = request.nextUrl.clone();
      url.hostname = ADMIN_HOST;
      url.pathname = "/";
      url.port = "";
      return NextResponse.redirect(url, 307);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|api/).*)"],
};
