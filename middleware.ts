/* Next.js Middleware — runs at the edge before every request.
 *
 * Responsibilities:
 *   1. Generate a per-request cryptographic nonce.
 *   2. Inject it into the request headers (x-nonce) so RootLayout
 *      can attach it to every <script> tag it renders.
 *   3. Set Content-Security-Policy on the response with that nonce
 *      in script-src so only nonce-bearing scripts execute.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  // btoa(String.fromCharCode(...bytes)) is safe for 16 bytes; no Buffer needed.
  return btoa(String.fromCharCode(...Array.from(bytes)));
}

const SUPABASE_HOST = "esluwqkqoofmquqdevap.supabase.co";

function buildCSP(nonce: string): string {
  const parts: string[] = [
    `default-src 'self'`,

    // script-src: nonce for inline scripts Next.js emits; strict-dynamic lets
    // scripts loaded by trusted scripts run without their own nonce (handles
    // dynamic Next.js chunk injection). 'unsafe-inline' is ignored by CSP2+
    // browsers when a nonce is present; kept only as a CSP1 fallback.
    [
      "script-src",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      "'unsafe-inline'",
      "https:",
      "https://checkout.razorpay.com",
      "https://us-assets.i.posthog.com",
    ].join(" "),

    // style-src: Next.js and Tailwind both emit inline <style> blocks.
    "style-src 'self' 'unsafe-inline'",

    // connect-src: all XHR / fetch / WebSocket origins the client touches.
    [
      "connect-src",
      "'self'",
      `https://${SUPABASE_HOST}`,
      `wss://${SUPABASE_HOST}`,
      "https://api.groq.com",
      "https://generativelanguage.googleapis.com",
      "https://api.sarvam.ai",
      "https://api.cartesia.ai",
      "wss://api.cartesia.ai",
      "https://*.tts.speech.microsoft.com",
      "https://api.deepgram.com",
      "wss://api.deepgram.com",
      "https://api.razorpay.com",
      "https://checkout.razorpay.com",
      "https://us.i.posthog.com",
      "https://us-assets.i.posthog.com",
      "https://accounts.google.com",
    ].join(" "),

    // img-src: self + data URIs (avatars) + blob (camera preview) + CDN.
    [
      "img-src",
      "'self'",
      "data:",
      "blob:",
      "https://images.unsplash.com",
      `https://${SUPABASE_HOST}`,
    ].join(" "),

    "font-src 'self' data:",

    // media-src: interview TTS audio arrives as a Blob URL; session videos
    // may be streamed from Supabase Storage.
    `media-src 'self' blob: https://${SUPABASE_HOST}`,

    // frame-src: Razorpay checkout embeds an iframe.
    "frame-src https://checkout.razorpay.com https://api.razorpay.com",

    // Service worker runs on same origin; audio worklets use blob: URLs.
    "worker-src 'self' blob:",

    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];

  return parts.join("; ");
}

export function middleware(request: NextRequest) {
  const nonce = generateNonce();
  const csp = buildCSP(nonce);

  // Forward the nonce to the server component via a request header.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  // Set CSP on the response so the browser enforces it.
  response.headers.set("content-security-policy", csp);

  return response;
}

export const config = {
  matcher: [
    // Apply to every route except Next.js internals and static file extensions.
    // API routes are included — CSP on JSON responses is harmless.
    "/((?!_next/static|_next/image|favicon|manifest|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|otf|mp4|webm|mp3|ogg|pdf)).*)",
  ],
};
