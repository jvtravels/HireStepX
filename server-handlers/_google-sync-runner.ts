/* Google Calendar two-way sync (PRI-35) — server-side runner.
 *
 * The impure half: token refresh, incremental list sync, applying changes to
 * calendar_events, exporting our events to Google, and watch-channel lifecycle.
 * Shared by the callback, webhook, and poll handlers. All DB access uses the
 * service role; ownership is always scoped by user_id. Pure decision/mapping
 * logic lives in _google-calendar.ts and is unit-tested there.
 *
 * No Node-only APIs (fetch + crypto.subtle only) so it runs under the node
 * serverless handlers without surprises.
 */

import {
  isAccessTokenExpired,
  parseSyncResponse,
  rowToGoogleResource,
  type GoogleSyncAction,
} from "./_google-calendar";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";

const CAL = "https://www.googleapis.com/calendar/v3/calendars";

export interface SyncRow {
  user_id: string;
  refresh_token: string;
  access_token: string | null;
  token_expiry: string | null;
  sync_token: string | null;
  calendar_id: string;
  channel_id: string | null;
  resource_id: string | null;
  channel_expiry: string | null;
}

function svc(extra?: Record<string, string>): Record<string, string> {
  return { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, ...extra };
}

async function patchSyncRow(userId: string, patch: Record<string, unknown>): Promise<void> {
  await fetch(`${SUPABASE_URL}/rest/v1/google_calendar_sync?user_id=eq.${encodeURIComponent(userId)}`, {
    method: "PATCH",
    headers: svc({ "Content-Type": "application/json", Prefer: "return=minimal" }),
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
  }).catch(() => {});
}

/** Return a valid access token, refreshing (and persisting) if it has expired.
 *  Returns null when Google rejects the refresh token (revoked / expired) so
 *  the caller can surface a reconnect. */
export async function getValidAccessToken(row: SyncRow): Promise<string | null> {
  if (row.access_token && !isAccessTokenExpired(row.token_expiry, Date.now())) {
    return row.access_token;
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: row.refresh_token,
      grant_type: "refresh_token",
    }).toString(),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    console.error(`[google-sync] token refresh failed (${res.status}) for ${row.user_id}`);
    return null;
  }
  const data = await res.json().catch(() => null);
  if (!data?.access_token) return null;
  const expiry = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();
  await patchSyncRow(row.user_id, { access_token: data.access_token, token_expiry: expiry });
  return data.access_token;
}

/** Upsert one mapped Google event into calendar_events, keyed by
 *  (user_id, google_event_id). Returns true on success. */
async function upsertImported(userId: string, body: Record<string, unknown>): Promise<boolean> {
  const gid = body.google_event_id as string;
  const existing = await fetch(
    `${SUPABASE_URL}/rest/v1/calendar_events?user_id=eq.${encodeURIComponent(userId)}&google_event_id=eq.${encodeURIComponent(gid)}&select=id&limit=1`,
    { headers: svc() },
  ).then((r) => (r.ok ? r.json() : [])).catch(() => []);

  const now = new Date().toISOString();
  const start = body.start_utc as string | undefined;
  const common = {
    title: body.title,
    notes: body.notes ?? "",
    location: body.location ?? "",
    start_utc: start ?? null,
    end_utc: body.end_utc ?? null,
    duration_minutes: body.duration ?? 60,
    timezone: body.timezone ?? "Asia/Kolkata",
    date: start ? start.slice(0, 10) : "",
    status: "upcoming",
    source: "google",
    kind: "real",
    google_event_id: gid,
    updated_at: now,
  };

  if (Array.isArray(existing) && existing.length > 0) {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/calendar_events?id=eq.${encodeURIComponent(existing[0].id)}&user_id=eq.${encodeURIComponent(userId)}`,
      { method: "PATCH", headers: svc({ "Content-Type": "application/json", Prefer: "return=minimal" }), body: JSON.stringify(common) },
    );
    return r.ok;
  }
  const r = await fetch(`${SUPABASE_URL}/rest/v1/calendar_events`, {
    method: "POST",
    headers: svc({ "Content-Type": "application/json", Prefer: "return=minimal,resolution=merge-duplicates" }),
    body: JSON.stringify([{ id: crypto.randomUUID(), user_id: userId, created_at: now, ...common }]),
  });
  return r.ok;
}

async function deleteImported(userId: string, googleEventId: string): Promise<void> {
  await fetch(
    `${SUPABASE_URL}/rest/v1/calendar_events?user_id=eq.${encodeURIComponent(userId)}&google_event_id=eq.${encodeURIComponent(googleEventId)}`,
    { method: "DELETE", headers: svc({ Prefer: "return=minimal" }) },
  ).catch(() => {});
}

async function applyActions(userId: string, actions: GoogleSyncAction[]): Promise<{ upserts: number; deletes: number }> {
  let upserts = 0;
  let deletes = 0;
  for (const a of actions) {
    if (a.action === "upsert") {
      if (await upsertImported(userId, a.body)) upserts++;
    } else if (a.action === "delete") {
      await deleteImported(userId, a.googleEventId);
      deletes++;
    }
  }
  return { upserts, deletes };
}

/** Pull changes from Google into our store. Uses the stored syncToken for an
 *  incremental delta; on a 410 (token expired) it falls back to a bounded full
 *  resync. Persists the new syncToken for next time. */
export async function runIncrementalSync(row: SyncRow): Promise<{ ok: boolean; upserts: number; deletes: number; reconnect?: boolean }> {
  const token = await getValidAccessToken(row);
  if (!token) return { ok: false, upserts: 0, deletes: 0, reconnect: true };

  const ctx = { timezone: "Asia/Kolkata" };
  let upserts = 0;
  let deletes = 0;
  let syncToken = row.sync_token || "";
  let pageToken = "";
  let nextSyncToken: string | undefined;

  for (let page = 0; page < 20; page++) {
    const params = new URLSearchParams();
    if (syncToken) params.set("syncToken", syncToken);
    else {
      // Full (re)sync: only future-ish events, capped, to bound a cold start.
      params.set("timeMin", new Date(Date.now() - 7 * 86_400_000).toISOString());
      params.set("singleEvents", "true");
      params.set("maxResults", "250");
    }
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(`${CAL}/${encodeURIComponent(row.calendar_id)}/events?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    });
    const body = res.ok ? await res.json().catch(() => null) : null;
    const parsed = parseSyncResponse(res.status, body, ctx);

    if (parsed.gone) {
      // Stored token rejected — drop it and restart a full sync once.
      if (!syncToken) break; // already doing full sync; give up to avoid a loop
      syncToken = "";
      pageToken = "";
      await patchSyncRow(row.user_id, { sync_token: null });
      continue;
    }
    if (!res.ok) {
      console.error(`[google-sync] list failed (${res.status}) for ${row.user_id}`);
      return { ok: false, upserts, deletes };
    }

    const applied = await applyActions(row.user_id, parsed.actions);
    upserts += applied.upserts;
    deletes += applied.deletes;

    if (parsed.nextPageToken) {
      pageToken = parsed.nextPageToken;
      continue;
    }
    nextSyncToken = parsed.nextSyncToken;
    break;
  }

  if (nextSyncToken) await patchSyncRow(row.user_id, { sync_token: nextSyncToken });
  return { ok: true, upserts, deletes };
}

/* ── Export direction (app → Google) ── */

/** Create or update the Google event mirroring one of our rows. Stores the
 *  resulting google_event_id back on the row. Best-effort: never throws. */
export async function exportEventToGoogle(
  row: { id: string; user_id: string; title: string; notes?: string; location?: string; start_utc: string | null; end_utc: string | null; duration_minutes?: number; timezone?: string; google_event_id?: string | null },
  syncRow: SyncRow,
): Promise<void> {
  try {
    const token = await getValidAccessToken(syncRow);
    if (!token) return;
    const resource = rowToGoogleResource(row);
    const hasGid = !!row.google_event_id;
    const url = hasGid
      ? `${CAL}/${encodeURIComponent(syncRow.calendar_id)}/events/${encodeURIComponent(row.google_event_id as string)}`
      : `${CAL}/${encodeURIComponent(syncRow.calendar_id)}/events`;
    const res = await fetch(url, {
      method: hasGid ? "PATCH" : "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(resource),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error(`[google-sync] export failed (${res.status}) for row ${row.id}`);
      return;
    }
    if (!hasGid) {
      const created = await res.json().catch(() => null);
      if (created?.id) {
        await fetch(`${SUPABASE_URL}/rest/v1/calendar_events?id=eq.${encodeURIComponent(row.id)}&user_id=eq.${encodeURIComponent(row.user_id)}`, {
          method: "PATCH",
          headers: svc({ "Content-Type": "application/json", Prefer: "return=minimal" }),
          body: JSON.stringify({ google_event_id: created.id }),
        }).catch(() => {});
      }
    }
  } catch (e) {
    console.error(`[google-sync] export error for row ${row.id}:`, e);
  }
}

/** Delete the mirrored Google event when we delete one of ours. Best-effort. */
export async function deleteEventFromGoogle(googleEventId: string, syncRow: SyncRow): Promise<void> {
  try {
    const token = await getValidAccessToken(syncRow);
    if (!token) return;
    await fetch(`${CAL}/${encodeURIComponent(syncRow.calendar_id)}/events/${encodeURIComponent(googleEventId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    console.error("[google-sync] delete-from-google error:", e);
  }
}

/* ── Watch channel lifecycle ── */

/** Register (or re-register) a push channel so Google notifies our webhook on
 *  changes. Stores the channel/resource ids and expiry for renewal. */
export async function ensureWatchChannel(row: SyncRow, webhookUrl: string): Promise<void> {
  try {
    const token = await getValidAccessToken(row);
    if (!token) return;
    const channelId = crypto.randomUUID();
    const res = await fetch(`${CAL}/${encodeURIComponent(row.calendar_id)}/events/watch`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id: channelId, type: "web_hook", address: webhookUrl, token: row.user_id }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error(`[google-sync] watch failed (${res.status}) for ${row.user_id}`);
      return;
    }
    const ch = await res.json().catch(() => null);
    await patchSyncRow(row.user_id, {
      channel_id: channelId,
      resource_id: ch?.resourceId || null,
      channel_expiry: ch?.expiration ? new Date(Number(ch.expiration)).toISOString() : null,
    });
  } catch (e) {
    console.error("[google-sync] ensureWatchChannel error:", e);
  }
}

/** Look up the sync row for a user (service role). */
export async function getSyncRow(userId: string): Promise<SyncRow | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/google_calendar_sync?user_id=eq.${encodeURIComponent(userId)}&select=*&limit=1`,
    { headers: svc() },
  );
  if (!res.ok) return null;
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) && rows[0] ? (rows[0] as SyncRow) : null;
}

/** Look up the sync row by an inbound webhook's channel + resource id. */
export async function getSyncRowByChannel(channelId: string, resourceId: string): Promise<SyncRow | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/google_calendar_sync?channel_id=eq.${encodeURIComponent(channelId)}&resource_id=eq.${encodeURIComponent(resourceId)}&select=*&limit=1`,
    { headers: svc() },
  );
  if (!res.ok) return null;
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) && rows[0] ? (rows[0] as SyncRow) : null;
}
