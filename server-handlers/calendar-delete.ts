/* Vercel Edge Function — Delete Calendar Event (PRI-35)
 *
 * POST /api/calendar/delete  { id }
 *
 * Uses POST (not HTTP DELETE) to stay on the shared POST/OPTIONS preamble and
 * the XHR apiClient transport. The delete is filtered by id AND user_id so a
 * caller can only ever remove their own row, even though the service role
 * bypasses RLS. Deleting a real interview cascades to its prep-session
 * children so the runway never outlives the interview it prepared for.
 */

export const config = { runtime: "edge" };

import { withAuthAndRateLimit, corsHeaders, withRequestId } from "./_shared";
import { googleConfigured } from "./_google-calendar";
import { getSyncRow, deleteEventFromGoogle } from "./_google-sync-runner";

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function svcHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    "Content-Type": "application/json",
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    ...extra,
  };
}

export default async function handler(req: Request): Promise<Response> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 503,
      headers: withRequestId(corsHeaders(req)),
    });
  }

  const pre = await withAuthAndRateLimit(req, {
    endpoint: "calendar-delete",
    ipLimit: 60,
    userLimit: 30,
    maxBytes: 4_000,
  });
  if (pre instanceof Response) return pre;
  const { headers, auth } = pre;
  if (!auth.userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  }

  let body: { id?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) {
    return new Response(JSON.stringify({ error: "Missing event id" }), { status: 400, headers });
  }

  const userFilter = `user_id=eq.${encodeURIComponent(auth.userId)}`;

  // Best-effort: remove any prep-session children first so we don't orphan
  // them. Not transactional, but a child without its parent is harmless and
  // the next list call won't surface it under any interview.
  await fetch(
    `${SUPABASE_URL}/rest/v1/calendar_events?${userFilter}&parent_interview_id=eq.${encodeURIComponent(id)}`,
    { method: "DELETE", headers: svcHeaders({ Prefer: "return=minimal" }) },
  ).catch(() => {});

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/calendar_events?${userFilter}&id=eq.${encodeURIComponent(id)}`,
    { method: "DELETE", headers: svcHeaders({ Prefer: "return=representation" }) },
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error(`[calendar-delete] failed HTTP ${res.status}: ${errText.slice(0, 200)}`);
    return new Response(JSON.stringify({ error: "Could not delete event" }), { status: 502, headers });
  }

  const rows = await res.json().catch(() => []);
  const deleted = Array.isArray(rows) ? rows.length : 0;
  if (deleted === 0) {
    return new Response(JSON.stringify({ error: "Event not found" }), { status: 404, headers });
  }

  // Best-effort: remove the mirrored event from Google too, so a delete here
  // doesn't leave a ghost on the connected calendar. Guarded by
  // googleConfigured() so it's a no-op until the OAuth client env is set.
  const googleEventId = Array.isArray(rows) ? (rows[0]?.google_event_id as string | undefined) : undefined;
  if (googleEventId && googleConfigured(process.env)) {
    try {
      const sync = await getSyncRow(auth.userId);
      if (sync) await deleteEventFromGoogle(googleEventId, sync);
    } catch (e) {
      console.error("[calendar-delete] google delete error:", e);
    }
  }

  return new Response(JSON.stringify({ ok: true, id, deleted }), { status: 200, headers });
}
