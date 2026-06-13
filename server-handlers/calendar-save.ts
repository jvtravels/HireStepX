/* Vercel Edge Function — Save Calendar Event (PRI-35)
 *
 * Single authoritative write path for calendar events. Replaces the old
 * client-direct supabase-js writes from DashboardCalendar, which both
 * violated the codebase rule (no client-direct mutations) and hung behind
 * fetch-wrapping extensions on larger bodies. Routes through the XHR-based
 * apiClient on the front end.
 *
 * Ownership is enforced server-side, not trusted from the client:
 *   - create (no id): server mints a UUID, inserts with user_id = the caller
 *   - update (id present): PATCH is filtered by id AND user_id, so a caller
 *     can never overwrite or re-own another user's row even with the service
 *     role bypassing RLS.
 *
 * Column-stripping retry mirrors save-session.ts so the handler still works
 * in an environment where the calendar migration hasn't been applied yet.
 */

export const config = { runtime: "edge" };

import { withAuthAndRateLimit, corsHeaders, withRequestId } from "./_shared";
import { normalizeCalendarEvent, type CalendarRow } from "./_calendar-helpers";

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const PROTECTED_COLUMNS = new Set(["id", "user_id", "created_at"]);

function svcHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    "Content-Type": "application/json",
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    ...extra,
  };
}

/** Detect a missing-column PostgREST error and return the column name. */
function missingColumn(errText: string): string | null {
  return (
    errText.match(/Could not find the '(\w+)' column/)?.[1] ||
    errText.match(/column "(\w+)" of .* does not exist/i)?.[1] ||
    errText.match(/column calendar_events\.(\w+) does not exist/i)?.[1] ||
    null
  );
}

export default async function handler(req: Request): Promise<Response> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 503,
      headers: withRequestId(corsHeaders(req)),
    });
  }

  const pre = await withAuthAndRateLimit(req, {
    endpoint: "calendar-save",
    ipLimit: 60,
    userLimit: 30,
    maxBytes: 32_000,
  });
  if (pre instanceof Response) return pre;
  const { headers, auth } = pre;
  if (!auth.userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers });
  }

  const clientId = typeof body.id === "string" ? body.id.trim() : "";
  const isUpdate = clientId.length > 0;
  const id = isUpdate ? clientId : crypto.randomUUID();
  const updatedAt = new Date().toISOString();

  const norm = normalizeCalendarEvent(body, { userId: auth.userId, id, updatedAt });
  if (!norm.ok) {
    return new Response(JSON.stringify({ error: norm.error }), { status: 400, headers });
  }

  if (isUpdate) {
    return updateEvent(norm.row, auth.userId, headers);
  }
  return insertEvent(norm.row, headers);
}

async function insertEvent(row: CalendarRow, headers: Record<string, string>): Promise<Response> {
  const stripped: string[] = [];
  const payload: Record<string, unknown> = { ...row };
  for (let attempt = 0; attempt < 8; attempt++) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/calendar_events`, {
      method: "POST",
      headers: svcHeaders({ Prefer: "return=representation" }),
      body: JSON.stringify([payload]),
    });
    if (res.ok) {
      const rows = await res.json().catch(() => []);
      return new Response(JSON.stringify({ ok: true, event: Array.isArray(rows) ? rows[0] : null, strippedColumns: stripped }), {
        status: 200,
        headers,
      });
    }
    const errText = await res.text().catch(() => "");
    const col = missingColumn(errText);
    if (col && col in payload && !PROTECTED_COLUMNS.has(col)) {
      stripped.push(col);
      delete payload[col];
      continue;
    }
    console.error(`[calendar-save] insert failed HTTP ${res.status}: ${errText.slice(0, 300)}`);
    return new Response(JSON.stringify({ error: "Could not save event", details: errText.slice(0, 200) }), {
      status: res.status >= 400 && res.status < 500 ? 400 : 502,
      headers,
    });
  }
  return new Response(JSON.stringify({ error: "Could not save event after retries" }), { status: 500, headers });
}

async function updateEvent(row: CalendarRow, userId: string, headers: Record<string, string>): Promise<Response> {
  // Never change ownership/identity/creation on update.
  const payload: Record<string, unknown> = { ...row };
  for (const col of PROTECTED_COLUMNS) delete payload[col];

  const stripped: string[] = [];
  const filter = `id=eq.${encodeURIComponent(row.id)}&user_id=eq.${encodeURIComponent(userId)}`;
  for (let attempt = 0; attempt < 8; attempt++) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/calendar_events?${filter}`, {
      method: "PATCH",
      headers: svcHeaders({ Prefer: "return=representation" }),
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const rows = await res.json().catch(() => []);
      if (!Array.isArray(rows) || rows.length === 0) {
        // Filter matched nothing: either the id doesn't exist or it isn't ours.
        return new Response(JSON.stringify({ error: "Event not found" }), { status: 404, headers });
      }
      return new Response(JSON.stringify({ ok: true, event: rows[0], strippedColumns: stripped }), { status: 200, headers });
    }
    const errText = await res.text().catch(() => "");
    const col = missingColumn(errText);
    if (col && col in payload && !PROTECTED_COLUMNS.has(col)) {
      stripped.push(col);
      delete payload[col];
      continue;
    }
    console.error(`[calendar-save] update failed HTTP ${res.status}: ${errText.slice(0, 300)}`);
    return new Response(JSON.stringify({ error: "Could not update event", details: errText.slice(0, 200) }), {
      status: res.status >= 400 && res.status < 500 ? 400 : 502,
      headers,
    });
  }
  return new Response(JSON.stringify({ error: "Could not update event after retries" }), { status: 500, headers });
}
