/* Vercel Edge Function — List Calendar Events (PRI-35)
 *
 * Authoritative read path. The DB is the single source of truth; the client
 * keeps only a localStorage cache for offline/optimistic rendering. Returns
 * the caller's own events, newest interview first, capped to a sane window.
 *
 * GET /api/calendar/list  (auth via Authorization header; no body)
 */

export const config = { runtime: "edge" };

import { withAuthAndRateLimit, corsHeaders, withRequestId } from "./_shared";

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const MAX_ROWS = 500;

export default async function handler(req: Request): Promise<Response> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 503,
      headers: withRequestId(corsHeaders(req)),
    });
  }

  const pre = await withAuthAndRateLimit(req, {
    endpoint: "calendar-list",
    ipLimit: 120,
    userLimit: 60,
    allowGet: true,
  });
  if (pre instanceof Response) return pre;
  const { headers, auth } = pre;
  if (!auth.userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  }

  // Order by start_utc when present, falling back to the legacy date column so
  // rows written before the migration still sort. PostgREST nullslast keeps
  // un-migrated rows from floating to the top.
  const query =
    `user_id=eq.${encodeURIComponent(auth.userId)}` +
    `&select=*&order=start_utc.desc.nullslast,date.desc&limit=${MAX_ROWS}`;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/calendar_events?${query}`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error(`[calendar-list] fetch failed HTTP ${res.status}: ${errText.slice(0, 200)}`);
    return new Response(JSON.stringify({ error: "Could not load events" }), { status: 502, headers });
  }

  const events = await res.json().catch(() => []);
  return new Response(JSON.stringify({ ok: true, events: Array.isArray(events) ? events : [] }), {
    status: 200,
    headers,
  });
}
