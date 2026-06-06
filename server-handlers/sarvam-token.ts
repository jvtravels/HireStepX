/* Vercel Edge Function — Returns Sarvam AI API key for STT */
/* Never exposes the raw API key to the client without expiry */

export const config = { runtime: "edge" };

import { handleCorsPreflightOrMethod, corsHeaders, isRateLimited, getClientIp, rateLimitResponse, verifyAuth, unauthorizedResponse, validateOrigin, withRequestId, logServiceUsage, redisIncrByWithExpiry } from "./_shared";

declare const process: { env: Record<string, string | undefined> };
const SARVAM_API_KEY = process.env.SARVAM_API_KEY || "";

// See stt-token.ts for rationale. Sarvam doesn't offer public scoped-key
// minting either, so we bound blast radius the same way.
const SARVAM_TOKEN_DAILY_CAP = 30;
const SECONDS_PER_DAY = 86_400;

export default async function handler(req: Request): Promise<Response> {
  const earlyResponse = handleCorsPreflightOrMethod(req);
  if (earlyResponse) return earlyResponse;

  const headers = withRequestId(corsHeaders(req));

  if (!SARVAM_API_KEY) {
    return new Response(JSON.stringify({ error: "Sarvam STT not configured" }), { status: 503, headers });
  }

  if (!validateOrigin(req)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers });
  }

  const auth = await verifyAuth(req);
  if (!auth.authenticated) return unauthorizedResponse(headers);

  const ip = getClientIp(req);
  if (await isRateLimited(ip, "sarvam-token", 10, 60_000)) {
    return rateLimitResponse(headers);
  }

  const dayKey = `sarvam_token_issued:${auth.userId}:${new Date().toISOString().slice(0, 10)}`;
  const issued = await redisIncrByWithExpiry(dayKey, 1, SECONDS_PER_DAY);
  if (issued !== null && issued > SARVAM_TOKEN_DAILY_CAP) {
    return new Response(JSON.stringify({
      error: "Daily voice-input limit reached. Continue in text mode or try again tomorrow.",
      code: "sarvam_token_daily_cap",
    }), { status: 429, headers });
  }

  const expiresAt = Date.now() + 2 * 60 * 1000; // 2 minutes

  // Log each token request as a Sarvam STT session start
  logServiceUsage({ service: "sarvam_stt", endpoint: "token", userId: auth.userId, status: "success" });

  return new Response(JSON.stringify({
    apiKey: SARVAM_API_KEY,
    expiresAt,
  }), {
    status: 200,
    headers: { ...headers, "Cache-Control": "no-store, no-cache, max-age=0" },
  });
}
