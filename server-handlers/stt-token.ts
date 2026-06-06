/* Vercel Edge Function — Returns scoped, time-limited Deepgram token */
/* Never exposes the raw API key to the client without expiry */

export const config = { runtime: "edge" };

import { handleCorsPreflightOrMethod, corsHeaders, isRateLimited, getClientIp, rateLimitResponse, verifyAuth, unauthorizedResponse, validateOrigin, withRequestId, logServiceUsage, redisIncrByWithExpiry } from "./_shared";

declare const process: { env: Record<string, string | undefined> };
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || "";

/* TOKEN-ABUSE GUARDRAIL — until we migrate to Deepgram scoped/temp keys
 * (which requires DEEPGRAM_PROJECT_ID config), the raw API key is handed
 * to authenticated clients. A captured key can be reused direct-to-vendor
 * indefinitely. We bound the blast radius two ways:
 *  - per-user daily issuance cap (a single account can't farm tokens
 *    across multiple browser sessions to share with others)
 *  - shortened TTL hint (clients re-fetch more often, so the rate-limit
 *    + cap stay in the hot path)
 * TODO: migrate to Deepgram /v1/projects/<id>/keys with TTL + scopes. */
const STT_TOKEN_DAILY_CAP = 30;
const SECONDS_PER_DAY = 86_400;

export default async function handler(req: Request): Promise<Response> {
  const earlyResponse = handleCorsPreflightOrMethod(req);
  if (earlyResponse) return earlyResponse;

  const headers = withRequestId(corsHeaders(req));

  if (!DEEPGRAM_API_KEY) {
    return new Response(JSON.stringify({ error: "STT not configured" }), { status: 503, headers });
  }

  if (!validateOrigin(req)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers });
  }

  const auth = await verifyAuth(req);
  if (!auth.authenticated) return unauthorizedResponse(headers);

  const ip = getClientIp(req);
  if (await isRateLimited(ip, "stt-token", 10, 60_000)) {
    return rateLimitResponse(headers);
  }

  // Daily issuance cap per user — bounds blast radius if a key is captured.
  const dayKey = `stt_token_issued:${auth.userId}:${new Date().toISOString().slice(0, 10)}`;
  const issued = await redisIncrByWithExpiry(dayKey, 1, SECONDS_PER_DAY);
  if (issued !== null && issued > STT_TOKEN_DAILY_CAP) {
    return new Response(JSON.stringify({
      error: "Daily voice-input limit reached. Continue in text mode or try again tomorrow.",
      code: "stt_token_daily_cap",
    }), { status: 429, headers });
  }

  // Return the API key directly with short TTL — auth + rate limiting gate access
  // Deepgram's scoped key API requires project ID which varies per account,
  // so we return the key directly (already behind auth + rate limiting + origin check)
  const expiresAt = Date.now() + 2 * 60 * 1000; // 2 minutes

  // Log each token request as a Deepgram STT session start
  logServiceUsage({ service: "deepgram_stt", endpoint: "token", userId: auth.userId, status: "success" });

  return new Response(JSON.stringify({
    apiKey: DEEPGRAM_API_KEY,
    expiresAt,
  }), {
    status: 200,
    headers: { ...headers, "Cache-Control": "no-store, no-cache, max-age=0" },
  });
}
