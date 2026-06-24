/**
 * Next.js Edge Middleware — CSP Nonce Injection
 *
 * Generates a cryptographically random nonce on every request and:
 *   1. Adds it to `x-nonce` REQUEST header so server components can read it
 *      via `import { headers } from 'next/headers'`.
 *   2. Emits a Content-Security-Policy RESPONSE header that includes
 *      `'nonce-{nonce}'` in script-src. In browsers that implement CSP Level 2+
 *      the nonce takes precedence and `'unsafe-inline'` is silently ignored,
 *      giving nonce-only enforcement on all modern browsers. Older browsers
 *      fall back to 'unsafe-inline' (existing behaviour — no regression).
 *
 * Why middleware and not next.config.js headers()?
 *   next.config.js headers() is evaluated at build time with a static string.
 *   A nonce must be unique per response, which requires per-request generation.
 *   Static + dynamic CSP headers would conflict; middleware wins the race to
 *   set the response header, so we move the full CSP here and strip it from
 *   next.config.js. The other security headers (X-Frame-Options, HSTS, etc.)
 *   stay in next.config.js because they're static and don't need a nonce.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Build the CSP string with a per-request nonce injected into script-src. */
function buildCsp(nonce: string): string {
  // Keep 'unsafe-inline' alongside the nonce during the transition period.
  // CSP L2+ ignores 'unsafe-inline' when a nonce or hash is present, so modern
  // browsers get nonce-enforced protection. Legacy browsers (CSP L1) fall back
  // to 'unsafe-inline' — same as before. Once we've confirmed nonce propagation
  // across all surfaces on staging, remove 'unsafe-inline' from script-src.
  const n = `'nonce-${nonce}'`;

  return [
    "default-src 'self'",

    // script-src: nonce covers all our own scripts. External vendors are
    // allowlisted by host. 'unsafe-inline' is kept as L1 fallback only.
    `script-src 'self' ${n} 'unsafe-inline' blob: https://checkout.razorpay.com https://*.razorpay.com https://va.vercel-scripts.com https://*.vercel-scripts.com`,
    `script-src-elem 'self' ${n} 'unsafe-inline' blob: https://checkout.razorpay.com https://*.razorpay.com https://va.vercel-scripts.com https://*.vercel-scripts.com https://us-assets.i.posthog.com`,

    // Styles remain 'unsafe-inline' — inline styles are used extensively
    // throughout the codebase (CLAUDE.md: "inline style={{ … }} on components").
    // Moving to style nonces would require touching every component.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.razorpay.com https://api.fontshare.com",
    "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.razorpay.com https://api.fontshare.com",

    "font-src 'self' https://fonts.gstatic.com https://api.fontshare.com https://cdn.fontshare.com",

    "img-src 'self' data: blob: https://images.unsplash.com https://*.supabase.co https://*.razorpay.com https://cdn.simpleicons.org",

    // connect-src: all API/WS origins the client touches.
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.groq.com https://generativelanguage.googleapis.com https://www.googleapis.com https://accounts.google.com https://oauth2.googleapis.com https://*.razorpay.com https://lumberjack.razorpay.com https://*.upstash.io https://vitals.vercel-insights.com https://va.vercel-scripts.com wss://api.cartesia.ai https://api.cartesia.ai wss://api.deepgram.com https://api.deepgram.com wss://api.sarvam.ai https://api.sarvam.ai https://*.tts.speech.microsoft.com https://api.resend.com https://*.sentry.io https://us.i.posthog.com https://us-assets.i.posthog.com https://*.i.posthog.com https://api.pwnedpasswords.com",

    "frame-src https://api.razorpay.com https://checkout.razorpay.com",
    "media-src 'self' blob: data:",
    "worker-src 'self' blob:",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export function middleware(request: NextRequest): NextResponse {
  // crypto.randomUUID() is available on all WinterCG-compliant runtimes
  // (Node.js 14.17+, V8/Chrome, Deno, Cloudflare Workers, Vercel Edge).
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  // Forward the nonce to server components via a request header so layout.tsx
  // can read it with `headers().get('x-nonce')` without another round-trip.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Set per-request CSP on the response.
  response.headers.set("Content-Security-Policy", buildCsp(nonce));

  return response;
}

// Run on every page route. Exclude Next.js internals and static assets so
// we don't add header overhead to font/image/chunk requests that browsers
// already cache and never re-evaluate for CSP compliance.
export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     *  - _next/static (static files)
     *  - _next/image  (image optimisation)
     *  - favicon.ico  (browser icon request)
     *  - Public files (manifest, robots, sitemap, etc.)
     */
    {
      source: "/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|robots\\.txt|sitemap.*\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?|ico)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
