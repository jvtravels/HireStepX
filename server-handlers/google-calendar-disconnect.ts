/* Vercel Edge Function — Disconnect Google Calendar (PRI-35)
 *
 * POST /api/calendar/google/disconnect  ->  { ok }
 *
 * Tears down the connection: stops the push channel so Google stops calling our
 * webhook, revokes the refresh token at Google so the grant is fully released,
 * then deletes the sync row. Revoke/stop are best-effort (the user clicked
 * disconnect; we never block them on a Google round-trip), but the row delete
 * is the authoritative end state. Imported google-origin events are left in
 * place so a disconnect doesn't silently wipe the user's calendar.
 */

export const config = { runtime: "edge" };

import { withAuthAndRateLimit } from "./_shared";
import { googleConfigured } from "./_google-calendar";
import { getSyncRow, getValidAccessToken } from "./_google-sync-runner";

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export default async function handler(req: Request): Promise<Response> {
  const pre = await withAuthAndRateLimit(req, {
    endpoint: "google-calendar-disconnect",
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
    return new Response(JSON.stringify({ ok: true, alreadyDisconnected: true }), { status: 200, headers });
  }

  const row = await getSyncRow(auth.userId);
  if (!row) {
    return new Response(JSON.stringify({ ok: true, alreadyDisconnected: true }), { status: 200, headers });
  }

  const token = await getValidAccessToken(row);

  // Stop the push channel (best-effort).
  if (token && row.channel_id && row.resource_id) {
    await fetch("https://www.googleapis.com/calendar/v3/channels/stop", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.channel_id, resourceId: row.resource_id }),
      signal: AbortSignal.timeout(10_000),
    }).catch((e) => console.error(`[google-disconnect] channel stop failed for ${auth.userId}:`, e));
  }

  // Revoke the grant at Google (best-effort).
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(row.refresh_token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    signal: AbortSignal.timeout(10_000),
  }).catch((e) => console.error(`[google-disconnect] revoke failed for ${auth.userId}:`, e));

  // Authoritative end state: drop the row.
  const del = await fetch(
    `${SUPABASE_URL}/rest/v1/google_calendar_sync?user_id=eq.${encodeURIComponent(auth.userId)}`,
    {
      method: "DELETE",
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: "return=minimal" },
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!del.ok) {
    console.error(`[google-disconnect] row delete failed (${del.status}) for ${auth.userId}`);
    return new Response(JSON.stringify({ error: "Could not disconnect" }), { status: 502, headers });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
