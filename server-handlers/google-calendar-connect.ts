/* Vercel Edge Function — Begin Google Calendar connection (PRI-35)
 *
 * POST /api/calendar/google/connect  ->  { ok, url } | { error }
 *
 * Returns the Google consent URL with an HMAC-signed `state` that binds the
 * flow to the authenticated caller. The callback is an unauthenticated redirect
 * from Google, so the user id has to survive the round-trip in `state`; signing
 * it stops a caller forging a state that attaches their Google account to
 * someone else's HireStepX account.
 *
 * Inert until configured: if GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are unset
 * the handler returns 501 and the client hides the connect affordance. No DB
 * read, no Google call happens in that state.
 */

export const config = { runtime: "edge" };

import { withAuthAndRateLimit, getSubscriptionTier } from "./_shared";
import { googleConfigured, buildAuthUrl, signState } from "./_google-calendar";

declare const process: { env: Record<string, string | undefined> };
const APP_URL = (process.env.APP_URL || "https://hirestepx.vercel.app").replace(/\/$/, "");
const STATE_SECRET = process.env.GOOGLE_STATE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export default async function handler(req: Request): Promise<Response> {
  const pre = await withAuthAndRateLimit(req, {
    endpoint: "google-calendar-connect",
    ipLimit: 20,
    userLimit: 10,
    maxBytes: 2_000,
  });
  if (pre instanceof Response) return pre;
  const { headers, auth } = pre;
  if (!auth.userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  }

  if (!googleConfigured(process.env)) {
    return new Response(JSON.stringify({ error: "Google Calendar sync is not configured.", unavailable: true }), {
      status: 501,
      headers,
    });
  }

  const tier = await getSubscriptionTier(auth.userId);
  if (tier !== "pro" && tier !== "team") {
    return new Response(
      JSON.stringify({ error: "Google Calendar sync is a Pro feature. Upgrade to connect your calendar.", upgradeRequired: true }),
      { status: 403, headers },
    );
  }

  const state = await signState(STATE_SECRET, { userId: auth.userId, nonce: crypto.randomUUID() });
  const url = buildAuthUrl({
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    redirectUri: `${APP_URL}/api/calendar/google/callback`,
    state,
  });

  return new Response(JSON.stringify({ ok: true, url }), { status: 200, headers });
}
