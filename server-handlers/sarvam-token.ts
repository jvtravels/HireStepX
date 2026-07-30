/* Vercel Edge Function — Returns Sarvam AI API key for STT */
/* Never exposes the raw API key to the client without expiry */

export const config = { runtime: "edge" };

import { handleCorsPreflightOrMethod, corsHeaders, isRateLimited, getClientIp, rateLimitResponse, verifyAuth, unauthorizedResponse, validateOrigin, withRequestId, logServiceUsage, redisIncrByWithExpiry, getSubscriptionTier } from "./_shared";
import { recordSttSpendAndCheckCap } from "./_sarvam-credit-guard";

declare const process: { env: Record<string, string | undefined> };
const SARVAM_API_KEY = process.env.SARVAM_API_KEY || "";
// Sarvam offers NO scoped/temporary-key API, so the only way to serve its STT
// client-side is to hand out the master key — which a captured client can then
// reuse direct-to-vendor indefinitely. We refuse to do that by default. Sarvam
// STT is only a *fallback* (Deepgram is primary, and Deepgram now mints scoped
// keys), and voice is text-only for the MVP, so leaving this disabled costs
// nothing. An operator who accepts the risk can opt in explicitly.
const SARVAM_ALLOW_CLIENT_KEY = (process.env.SARVAM_ALLOW_CLIENT_KEY || "").trim() === "true";
const SARVAM_TOKEN_DAILY_CAP = 30;
const SECONDS_PER_DAY = 86_400;

/* Paid STT is a paying-tier benefit by default — free users fall back to the
 * browser Web Speech API (zero cost). Open it to free users with
 * FUNDED_VOICE_FREE_TIER=1 — separate from VOICE_FREE_TIER (Cartesia/Azure),
 * which we don't have a prepaid credit grant for. */
const VOICE_FREE_TIER = process.env.FUNDED_VOICE_FREE_TIER === "1";

export default async function handler(req: Request): Promise<Response> {
  const earlyResponse = handleCorsPreflightOrMethod(req);
  if (earlyResponse) return earlyResponse;

  const headers = withRequestId(corsHeaders(req));

  if (!SARVAM_API_KEY || !SARVAM_ALLOW_CLIENT_KEY) {
    // Refuse rather than leak the master key (Sarvam has no scoped-key API).
    // Set SARVAM_ALLOW_CLIENT_KEY=true to opt into client-side Sarvam STT.
    return new Response(JSON.stringify({ error: "Sarvam STT not configured" }), { status: 503, headers });
  }

  if (!validateOrigin(req)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers });
  }

  const auth = await verifyAuth(req);
  if (!auth.authenticated) return unauthorizedResponse(headers);

  // Paid STT is a paying-tier benefit by default — free users get a 503 and the
  // client falls back to the browser Web Speech API (zero cost).
  if (!VOICE_FREE_TIER && (await getSubscriptionTier(auth.userId!)) === "free") {
    return new Response(JSON.stringify({ error: "Premium voice input is a paid feature", code: "stt_paid_only" }), { status: 503, headers });
  }

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

  // Program-wide credit guardrail — a token issuance is our best proxy for
  // one Sarvam STT session. Once the monthly startup-program grant is nearly
  // spent, fail over the same way the free-tier gate above does (503 →
  // client falls back to the browser Web Speech API).
  if (await recordSttSpendAndCheckCap()) {
    logServiceUsage({ service: "sarvam_stt", endpoint: "token", userId: auth.userId, status: "error", errorMessage: "Monthly Sarvam credit pool exhausted" });
    return new Response(JSON.stringify({ error: "Sarvam voice credits exhausted for this month", code: "sarvam_credit_cap" }), { status: 503, headers });
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
