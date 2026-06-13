/* Vercel Edge Function — Returns scoped, time-limited Cartesia token */
/* Never exposes the raw API key to the client */

export const config = { runtime: "edge" };

import { handleCorsPreflightOrMethod, corsHeaders, isRateLimited, getClientIp, rateLimitResponse, verifyAuth, unauthorizedResponse, validateOrigin, withRequestId, redisIncrByWithExpiry } from "./_shared";

declare const process: { env: Record<string, string | undefined> };
const CARTESIA_API_KEY = process.env.CARTESIA_API_KEY || "";

// Cartesia supports server-minted Access Tokens: we exchange the master key
// for a short-lived, tts-scoped token and hand THAT to the client for its
// WebSocket. The master key never leaves the server. A captured token expires
// in seconds and only grants TTS, so the blast radius is minimal. Daily
// issuance cap + IP rate limit still bound abuse.
const CARTESIA_TOKEN_DAILY_CAP = 30;
const SECONDS_PER_DAY = 86_400;
const CARTESIA_TOKEN_TTL_SECONDS = 120;
const CARTESIA_VERSION = "2024-11-13";

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

  // Exchange the master key for a short-lived, tts-scoped Access Token. Only
  // the token is returned to the client — never the master key.
  let accessToken = "";
  try {
    const mintRes = await fetch("https://api.cartesia.ai/access-token", {
      method: "POST",
      headers: {
        "X-API-Key": CARTESIA_API_KEY,
        "Cartesia-Version": CARTESIA_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grants: { tts: true },
        expires_in: CARTESIA_TOKEN_TTL_SECONDS,
      }),
    });
    if (!mintRes.ok) {
      console.error("[tts-token] Cartesia access-token mint failed:", mintRes.status);
      return new Response(JSON.stringify({ error: "Could not issue voice token" }), { status: 502, headers });
    }
    const mintData = await mintRes.json();
    accessToken = typeof mintData?.token === "string" ? mintData.token : "";
  } catch (err) {
    console.error("[tts-token] Cartesia access-token mint threw:", err);
    return new Response(JSON.stringify({ error: "Could not issue voice token" }), { status: 502, headers });
  }

  if (!accessToken) {
    return new Response(JSON.stringify({ error: "Could not issue voice token" }), { status: 502, headers });
  }

  const expiry = Date.now() + CARTESIA_TOKEN_TTL_SECONDS * 1000;
  return new Response(JSON.stringify({
    token: accessToken,
    expiresAt: expiry,
    ttl: CARTESIA_TOKEN_TTL_SECONDS,
  }), {
    status: 200,
    headers: { ...headers, "Cache-Control": "no-store, no-cache, max-age=0" },
  });
}
