/* Vercel Edge Function — Returns scoped, time-limited Deepgram token */
/* Never exposes the raw API key to the client without expiry */

export const config = { runtime: "edge" };

import { handleCorsPreflightOrMethod, corsHeaders, isRateLimited, getClientIp, rateLimitResponse, verifyAuth, unauthorizedResponse, validateOrigin, withRequestId, logServiceUsage, redisIncrByWithExpiry, getSubscriptionTier } from "./_shared";
import { recordDeepgramSpendAndCheckCap } from "./_deepgram-credit-guard";

declare const process: { env: Record<string, string | undefined> };
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || "";
const DEEPGRAM_PROJECT_ID = (process.env.DEEPGRAM_PROJECT_ID || "").trim();

/* TOKEN-ABUSE GUARDRAIL.
 * We mint a SCOPED, short-lived Deepgram key per request via the project keys
 * API and hand THAT to the client — never the master key. A captured temp key
 * expires in seconds and only carries usage:write, so the blast radius is tiny.
 * This requires DEEPGRAM_PROJECT_ID to be configured; if it isn't, we refuse
 * to issue anything rather than leaking the master key (the previous behavior).
 * Voice is text-only for the MVP, so a 503 here is acceptable until the project
 * ID is set. We still bound issuance with a per-user daily cap + IP rate limit. */
const STT_TOKEN_DAILY_CAP = 30;
const SECONDS_PER_DAY = 86_400;
const STT_TOKEN_TTL_SECONDS = 60;

/* Paid STT (Deepgram, billed per request) is a paying-tier benefit by default.
 * Free users fall back to the browser Web Speech API (zero cost) on a 503.
 * Open it to free users with FUNDED_VOICE_FREE_TIER=1 — separate from
 * VOICE_FREE_TIER (Cartesia/Azure), which we don't have a prepaid credit
 * grant for; Deepgram does (startup credits), same as Sarvam. */
const VOICE_FREE_TIER = process.env.FUNDED_VOICE_FREE_TIER === "1";

export default async function handler(req: Request): Promise<Response> {
  const earlyResponse = handleCorsPreflightOrMethod(req);
  if (earlyResponse) return earlyResponse;

  const headers = withRequestId(corsHeaders(req));

  if (!DEEPGRAM_API_KEY || !DEEPGRAM_PROJECT_ID) {
    // No project ID means we can't mint a scoped key — refuse rather than leak
    // the master key. (Set DEEPGRAM_PROJECT_ID to enable secure voice tokens.)
    return new Response(JSON.stringify({ error: "STT not configured" }), { status: 503, headers });
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

  // Program-wide credit guardrail — a token issuance is our best proxy for
  // one Deepgram STT session. Once the $200 startup-credit grant is nearly
  // spent, fail over the same way the free-tier gate above does (503 →
  // client falls back to the browser Web Speech API).
  if (await recordDeepgramSpendAndCheckCap()) {
    logServiceUsage({ service: "deepgram_stt", endpoint: "token", userId: auth.userId, status: "error", errorMessage: "Monthly Deepgram credit grant exhausted" });
    return new Response(JSON.stringify({ error: "Deepgram voice credits exhausted for this month", code: "deepgram_credit_cap" }), { status: 503, headers });
  }

  // Mint a scoped, short-lived key via Deepgram's project keys API. The temp
  // key is returned exactly once and carries only usage:write, expiring in
  // STT_TOKEN_TTL_SECONDS — so a captured token is near-worthless.
  let tempKey = "";
  try {
    const mintRes = await fetch(
      `https://api.deepgram.com/v1/projects/${encodeURIComponent(DEEPGRAM_PROJECT_ID)}/keys`,
      {
        method: "POST",
        headers: { Authorization: `Token ${DEEPGRAM_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          comment: `hsx-stt-${(auth.userId ?? "anon").slice(0, 8)}`,
          scopes: ["usage:write"],
          time_to_live_in_seconds: STT_TOKEN_TTL_SECONDS,
        }),
      },
    );
    if (!mintRes.ok) {
      console.error("[stt-token] Deepgram key mint failed:", mintRes.status);
      logServiceUsage({ service: "deepgram_stt", endpoint: "token", userId: auth.userId, status: "error" });
      return new Response(JSON.stringify({ error: "Could not issue voice token" }), { status: 502, headers });
    }
    const mintData = await mintRes.json();
    tempKey = typeof mintData?.key === "string" ? mintData.key : "";
  } catch (err) {
    console.error("[stt-token] Deepgram key mint threw:", err);
    logServiceUsage({ service: "deepgram_stt", endpoint: "token", userId: auth.userId, status: "error" });
    return new Response(JSON.stringify({ error: "Could not issue voice token" }), { status: 502, headers });
  }

  if (!tempKey) {
    return new Response(JSON.stringify({ error: "Could not issue voice token" }), { status: 502, headers });
  }

  const expiresAt = Date.now() + STT_TOKEN_TTL_SECONDS * 1000;

  // Log each token request as a Deepgram STT session start
  logServiceUsage({ service: "deepgram_stt", endpoint: "token", userId: auth.userId, status: "success" });

  return new Response(JSON.stringify({
    apiKey: tempKey,
    expiresAt,
  }), {
    status: 200,
    headers: { ...headers, "Cache-Control": "no-store, no-cache, max-age=0" },
  });
}
