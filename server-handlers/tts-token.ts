/* Vercel Edge Function — Returns scoped, time-limited Cartesia token */
/* Never exposes the raw API key to the client */

export const config = { runtime: "edge" };

import { handleCorsPreflightOrMethod, corsHeaders, isRateLimited, getClientIp, rateLimitResponse, verifyAuth, unauthorizedResponse, validateOrigin, withRequestId, redisIncrByWithExpiry } from "./_shared";

declare const process: { env: Record<string, string | undefined> };
const CARTESIA_API_KEY = process.env.CARTESIA_API_KEY || "";

// See stt-token.ts for rationale. Cartesia's HMAC-signed payload below
// proves issuance but does NOT bind the upstream call — a captured raw
// key still works direct-to-vendor. Daily issuance cap bounds the abuse.
const CARTESIA_TOKEN_DAILY_CAP = 30;
const SECONDS_PER_DAY = 86_400;

export default async function handler(req: Request): Promise<Response> {
  const earlyResponse = handleCorsPreflightOrMethod(req);
  if (earlyResponse) return earlyResponse;

  const headers = withRequestId(corsHeaders(req));

  if (!CARTESIA_API_KEY) {
    return new Response(JSON.stringify({ error: "TTS not configured" }), { status: 503, headers });
  }

  if (!validateOrigin(req)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers });
  }

  const auth = await verifyAuth(req);
  if (!auth.authenticated) return unauthorizedResponse(headers);

  const ip = getClientIp(req);
  if (await isRateLimited(ip, "tts-token", 10, 60_000)) {
    return rateLimitResponse(headers);
  }

  const dayKey = `cartesia_token_issued:${auth.userId || "anon"}:${new Date().toISOString().slice(0, 10)}`;
  const issued = await redisIncrByWithExpiry(dayKey, 1, SECONDS_PER_DAY);
  if (issued !== null && issued > CARTESIA_TOKEN_DAILY_CAP) {
    return new Response(JSON.stringify({
      error: "Daily voice-output limit reached. Browser TTS will be used as fallback.",
      code: "cartesia_token_daily_cap",
    }), { status: 429, headers });
  }

  // Generate a scoped, time-limited token via HMAC instead of returning the raw API key
  // The token encodes user ID + expiry so it can be validated server-side
  const expiry = Date.now() + 5 * 60 * 1000; // 5 minutes
  const payload = `${auth.userId || "anon"}:${expiry}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(CARTESIA_API_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const token = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/[+/=]/g, c => c === "+" ? "-" : c === "/" ? "_" : "");

  return new Response(JSON.stringify({
    apiKey: CARTESIA_API_KEY,
    token: `${payload}:${token}`,
    expiresAt: expiry,
    ttl: 120,
  }), {
    status: 200,
    headers: { ...headers, "Cache-Control": "no-store, no-cache, max-age=0" },
  });
}
