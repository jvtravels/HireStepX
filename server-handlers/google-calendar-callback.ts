/* Vercel Edge Function — Google Calendar OAuth callback (PRI-35)
 *
 * GET /api/calendar/google/callback?code=...&state=...
 *
 * Unauthenticated redirect target (Google sends the browser here). Trust comes
 * entirely from the HMAC-signed `state`, which we minted in google-calendar-connect
 * and which carries the HireStepX user id. We exchange the auth code for tokens,
 * persist the refresh token server-side (the model the old sessionStorage hack
 * never supported), then best-effort register a push channel and run the first
 * incremental sync before redirecting back to the calendar.
 *
 * Always redirects (never returns JSON) so the user lands somewhere sensible
 * regardless of outcome; the query flag drives the toast on the client.
 */

export const config = { runtime: "edge" };

import { googleConfigured, verifyState } from "./_google-calendar";
import { ensureWatchChannel, runIncrementalSync, type SyncRow } from "./_google-sync-runner";

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const APP_URL = (process.env.APP_URL || "https://hirestepx.vercel.app").replace(/\/$/, "");
const STATE_SECRET = process.env.GOOGLE_STATE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function redirect(flag: string): Response {
  return new Response(null, { status: 302, headers: { Location: `${APP_URL}/calendar?google=${flag}` } });
}

export default async function handler(req: Request): Promise<Response> {
  if (!googleConfigured(process.env) || !SUPABASE_URL || !SERVICE_KEY) {
    return redirect("unavailable");
  }

  const url = new URL(req.url);
  if (url.searchParams.get("error")) return redirect("denied");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return redirect("error");

  const parsed = await verifyState(STATE_SECRET, state);
  if (!parsed) return redirect("error");
  const userId = parsed.userId;

  // Exchange the auth code for tokens.
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      redirect_uri: `${APP_URL}/api/calendar/google/callback`,
      grant_type: "authorization_code",
    }).toString(),
    signal: AbortSignal.timeout(10_000),
  });
  if (!tokenRes.ok) {
    console.error(`[google-callback] token exchange failed (${tokenRes.status}) for ${userId}`);
    return redirect("error");
  }
  const tok = await tokenRes.json().catch(() => null);
  if (!tok?.refresh_token) {
    // No refresh token means a re-consent that didn't force offline access, or
    // a previously-granted grant. prompt=consent should prevent this; if it
    // happens, send the user back to retry rather than store a dead row.
    console.error(`[google-callback] no refresh_token returned for ${userId}`);
    return redirect("retry");
  }

  const now = new Date();
  const expiry = new Date(now.getTime() + (tok.expires_in || 3600) * 1000).toISOString();
  const row: SyncRow = {
    user_id: userId,
    refresh_token: tok.refresh_token,
    access_token: tok.access_token || null,
    token_expiry: expiry,
    sync_token: null,
    calendar_id: "primary",
    channel_id: null,
    resource_id: null,
    channel_expiry: null,
  };

  // Upsert the connection (primary key = user_id), preserving created_at on
  // reconnect via merge-duplicates.
  const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/google_calendar_sync`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      user_id: userId,
      refresh_token: row.refresh_token,
      access_token: row.access_token,
      token_expiry: row.token_expiry,
      calendar_id: "primary",
      sync_token: null,
      updated_at: now.toISOString(),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!upsertRes.ok) {
    console.error(`[google-callback] sync row upsert failed (${upsertRes.status}) for ${userId}`);
    return redirect("error");
  }

  // Best-effort: register the push channel and pull the initial delta. Failures
  // here don't break the connection; the poll cron is the safety net.
  try {
    await ensureWatchChannel(row, `${APP_URL}/api/calendar/google/webhook`);
    await runIncrementalSync(row);
  } catch (e) {
    console.error(`[google-callback] post-connect sync error for ${userId}:`, e);
  }

  return redirect("connected");
}
