/* Next.js Edge Middleware — Domain-based routing + pre-launch gate
 *
 * hirestepx.com         → marketing pages (/, /blog, /terms, /privacy, /page/*)
 * www.hirestepx.com     → marketing pages (currently pre-launch gated)
 * app.hirestepx.com     → product pages (currently pre-launch gated — same as www)
 * staging.hirestepx.com → full app (team / pre-prod, never gated)
 * admin.hirestepx.com   → admin panel
 *
 * Pre-launch behavior: PRE_LAUNCH_HOSTS get every non-allowed path rewritten
 * to / (Coming Soon). API routes, static assets, and a small allowlist of
 * legal/marketing pages still pass through.
 *
 * To launch publicly: clear PRE_LAUNCH_HOSTS (or set NEXT_PUBLIC_COMING_SOON=0
 * which the marketing page handler also respects).
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const APP_HOST = "app.hirestepx.com";
const MARKETING_HOST = "hirestepx.com";
const ADMIN_HOST = "admin.hirestepx.com";

const MARKETING_PATHS = new Set(["/", "/blog", "/terms", "/privacy", "/refund"]);
const MARKETING_PREFIXES = ["/blog/", "/page/", "/profile/"];

const APP_PREFIXES = [
  "/dashboard", "/sessions", "/calendar", "/analytics", "/resume", "/settings",
  "/session/", "/interview", "/onboarding", "/signup", "/login", "/reset-password",
  "/auth/callback",
  "/notebook",

];

/* Pre-launch gate constants removed 2026-05-30 when marketing v2 went live.
 * The gate was rewriting unknown paths to / and silently hiding /how-it-works,
 * /pricing, /about, /for-students, /contact, /compare/chatgpt. If you need to
 * re-gate, restore PRE_LAUNCH_HOSTS, GATE_ALLOWLIST_PATHS, and the
 * isAllowedOnGate() helper from git history. */

function isMarketingPath(pathname: string): boolean {
  if (MARKETING_PATHS.has(pathname)) return true;
  return MARKETING_PREFIXES.some(p => pathname.startsWith(p));
}

function isAppPath(pathname: string): boolean {
  return APP_PREFIXES.some(p => pathname.startsWith(p));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.nextUrl.hostname;

  // Skip in development
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return NextResponse.next();
  }

  // Admin subdomain — rewrite all requests to /admin path
  if (hostname === ADMIN_HOST) {
    // Allow API routes and auth callback through (admin needs auth + admin-data API)
    if (pathname.startsWith("/api/") || pathname.startsWith("/auth/")) {
      return NextResponse.next();
    }
    // Rewrite root and all paths to /admin
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
