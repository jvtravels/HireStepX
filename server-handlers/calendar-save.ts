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

import { withAuthAndRateLimit, corsHeaders, withRequestId, getSubscriptionTier } from "./_shared";
import { normalizeCalendarEvent, type CalendarRow } from "./_calendar-helpers";
import { googleConfigured, shouldExportToGoogle } from "./_google-calendar";
import { getSyncRow, exportEventToGoogle } from "./_google-sync-runner";

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const PROTECTED_COLUMNS = new Set(["id", "user_id", "created_at"]);
// Columns present in every deployment (the original NOT NULL base table). If
// one of these reads as "missing" it's a real error, not an un-run migration,
// so we never strip it (that would silently insert a corrupt row) and fail loud
// instead. Only the additive PRI-35 columns are legitimately strippable.
const REQUIRED_COLUMNS = new Set(["title", "date"]);

function svcHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    "Content-Type": "application/json",
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    ...extra,
  };
}

/* Best-effort mirror of a saved event into the user's Google Calendar. Guarded
 * by googleConfigured() first so it costs nothing (no DB read, no Google call)
 * until the OAuth client env is provisioned. shouldExportToGoogle() then skips
 * google-origin echoes and non-real kinds (prep sessions stay app-only). Never
 * throws: a failed push must not fail the save. */
async function pushToGoogle(saved: Record<string, unknown> | null, userId: string): Promise<void> {
  if (!saved || !googleConfigured(process.env)) return;
  if (!shouldExportToGoogle({ source: saved.source as string | undefined, kind: saved.kind as string | undefined })) return;
  try {
    const sync = await getSyncRow(userId);
    if (!sync) return;
    await exportEventToGoogle(
      {
        id: String(saved.id),
        user_id: userId,
        title: String(saved.title || "Interview"),
        notes: (saved.notes as string) || "",
        location: (saved.location as string) || "",
        start_utc: (saved.start_utc as string) || null,
        end_utc: (saved.end_utc as string) || null,
        duration_minutes: (saved.duration_minutes as number) || 60,
        timezone: (saved.timezone as string) || "Asia/Kolkata",
        google_event_id: (saved.google_event_id as string) || null,
      },
      sync,
    );
  } catch (e) {
    console.error("[calendar-save] google export error:", e);
  }
}

/** Detect a missing-column error and return the column name, but only when the
 *  error is genuinely an undefined-column code (PostgREST PGRST204 schema-cache
 *  miss, or Postgres 42703 undefined_column). Gating on the code rather than
 *  free-text keeps an unrelated failure that merely mentions a column name (a
 *  CHECK violation, an RLS denial) from tricking the loop into stripping a
 *  column that's actually present and dropping its data. */
function missingColumn(errText: string): string | null {
  let code: string | undefined;
  try {
    const parsed = JSON.parse(errText) as { code?: unknown };
    if (typeof parsed.code === "string") code = parsed.code;
  } catch { /* non-JSON error body: treat as non-strippable */ }
  if (code !== "PGRST204" && code !== "42703") return null;
  return (
    errText.match(/Could not find the '(\w+)' column/)?.[1] ||
    errText.match(/column "(\w+)" of .* does not exist/i)?.[1] ||
    errText.match(/column calendar_events\.(\w+) does not exist/i)?.[1] ||
    null
  );
}

/** A column may be stripped only if it's an additive (non-required, non-PK)
 *  column actually present in the payload. */
function isStrippable(col: string, payload: Record<string, unknown>): boolean {
  return col in payload && !PROTECTED_COLUMNS.has(col) && !REQUIRED_COLUMNS.has(col);
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

  // Calendar is a Pro feature, enforced at the data layer (not just the client
  // ProGate). Reads/deletes of one's own rows stay open so a downgrade never
  // strands existing data, but creating/editing requires an active paid tier.
  const tier = await getSubscriptionTier(auth.userId);
  if (tier !== "pro" && tier !== "team") {
    return new Response(
      JSON.stringify({ error: "The interview calendar is a Pro feature. Upgrade to schedule interviews.", upgradeRequired: true }),
      { status: 403, headers },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers });
  }

  // Prep-session rows are server-generated by the prep-runway handler (they hang
  // off a real interview and drive the runway grouping). A client must not mint
  // one directly here, or it'd create an orphan that pollutes the rail; the
  // public save is for real interviews only.
  if (body.kind === "prep-session") {
    return new Response(JSON.stringify({ error: "Prep sessions are scheduled automatically, not created directly." }), { status: 400, headers });
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
      const event = Array.isArray(rows) ? rows[0] : null;
      await pushToGoogle(event, row.user_id);
      return new Response(JSON.stringify({ ok: true, event, strippedColumns: stripped }), {
        status: 200,
        headers,
      });
    }
    const errText = await res.text().catch(() => "");
    const col = missingColumn(errText);
    if (col && isStrippable(col, payload)) {
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
      await pushToGoogle(rows[0], userId);
      return new Response(JSON.stringify({ ok: true, event: rows[0], strippedColumns: stripped }), { status: 200, headers });
    }
    const errText = await res.text().catch(() => "");
    const col = missingColumn(errText);
    if (col && isStrippable(col, payload)) {
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
