/* Vercel Edge Function — Generate Prep Runway (PRI-35)
 *
 * Given a logged real interview, auto-schedule its adaptive countdown of
 * AI mock-prep sessions as child calendar events (kind="prep-session",
 * parent_interview_id = the interview, source="prep-runway").
 *
 * One-shot and idempotent: if the runway was already generated for this
 * interview, the existing children are returned unchanged rather than
 * duplicated. The scheduling math lives in the pure _prep-runway engine;
 * this handler only loads the parent, persists the plan, and enforces the
 * Pro gate (same tier rule as calendar-save).
 *
 * POST /api/calendar/prep-runway  { parentId: string }
 */

export const config = { runtime: "edge" };

import { withAuthAndRateLimit, corsHeaders, withRequestId, getSubscriptionTier } from "./_shared";
import { normalizeCalendarEvent, type CalendarRow } from "./_calendar-helpers";
import { buildPrepRunway, planToEventBody, type PrepRunwayParent } from "./_prep-runway";

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const PROTECTED_COLUMNS = new Set(["id", "user_id", "created_at"]);
// Base-table NOT NULL columns present in every deployment: never strip these
// (a "missing" one is a real error, not an un-run migration). See calendar-save.
const REQUIRED_COLUMNS = new Set(["title", "date"]);

function svcHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    "Content-Type": "application/json",
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    ...extra,
  };
}

/** Return a missing column name only when the error is a genuine undefined-column
 *  code (PostgREST PGRST204 schema-cache miss / Postgres 42703), so an unrelated
 *  failure mentioning a column can't trick the loop into stripping live data. */
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

export default async function handler(req: Request): Promise<Response> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 503,
      headers: withRequestId(corsHeaders(req)),
    });
  }

  const pre = await withAuthAndRateLimit(req, {
    endpoint: "calendar-prep-runway",
    ipLimit: 30,
    userLimit: 15,
    maxBytes: 4_000,
  });
  if (pre instanceof Response) return pre;
  const { headers, auth } = pre;
  if (!auth.userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  }

  const tier = await getSubscriptionTier(auth.userId);
  if (tier !== "pro" && tier !== "team") {
    return new Response(
      JSON.stringify({ error: "Prep Runway is a Pro feature. Upgrade to auto-schedule your prep.", upgradeRequired: true }),
      { status: 403, headers },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers });
  }
  const parentId = typeof body.parentId === "string" ? body.parentId.trim() : "";
  if (!parentId) {
    return new Response(JSON.stringify({ error: "parentId is required" }), { status: 400, headers });
  }

  // Load the parent interview, scoped to the caller (never trust the client to
  // assert ownership — the service role bypasses RLS).
  const parentRes = await fetch(
    `${SUPABASE_URL}/rest/v1/calendar_events?id=eq.${encodeURIComponent(parentId)}&user_id=eq.${encodeURIComponent(auth.userId)}&select=*&limit=1`,
    { headers: svcHeaders() },
  );
  if (!parentRes.ok) {
    const t = await parentRes.text().catch(() => "");
    console.error(`[prep-runway] parent fetch failed HTTP ${parentRes.status}: ${t.slice(0, 200)}`);
    return new Response(JSON.stringify({ error: "Could not load interview" }), { status: 502, headers });
  }
  const parentRows = await parentRes.json().catch(() => []);
  const parentRow = Array.isArray(parentRows) ? parentRows[0] : null;
  if (!parentRow) {
    return new Response(JSON.stringify({ error: "Interview not found" }), { status: 404, headers });
  }
  if (parentRow.kind === "prep-session") {
    return new Response(JSON.stringify({ error: "Cannot build a runway off a prep session" }), { status: 400, headers });
  }

  // Idempotency: if children already exist for this interview, return them
  // rather than scheduling a duplicate ladder.
  const childRes = await fetch(
    `${SUPABASE_URL}/rest/v1/calendar_events?parent_interview_id=eq.${encodeURIComponent(parentId)}&user_id=eq.${encodeURIComponent(auth.userId)}&select=*&order=start_utc.asc.nullslast`,
    { headers: svcHeaders() },
  );
  const existing = childRes.ok ? await childRes.json().catch(() => []) : [];
  if (Array.isArray(existing) && existing.length > 0) {
    return new Response(JSON.stringify({ ok: true, alreadyGenerated: true, created: [], events: existing }), {
      status: 200,
      headers,
    });
  }

  const parent: PrepRunwayParent = {
    id: parentRow.id,
    start_utc: parentRow.start_utc || null,
    company: parentRow.company || "",
    type: parentRow.type || "",
    timezone: parentRow.timezone || "Asia/Kolkata",
  };

  const now = new Date().toISOString();
  const plans = buildPrepRunway(parent, { now });
  if (plans.length === 0) {
    return new Response(JSON.stringify({ ok: true, alreadyGenerated: false, created: [], events: [] }), {
      status: 200,
      headers,
    });
  }

  // Normalize every plan into a clean DB row up front; a malformed one aborts
  // the whole batch rather than scheduling a partial runway.
  const rows: CalendarRow[] = [];
  for (const plan of plans) {
    // Deterministic id per (parent, ladder stage). Because this id is the table
    // PK, two runway-generation calls that race past the "already generated"
    // check above produce identical ids, so the second insert collides on the
    // PK instead of creating a duplicate ladder. Paired with the
    // ignore-duplicates insert below, the loser becomes a clean no-op.
    const norm = normalizeCalendarEvent(planToEventBody(plan, parent), {
      userId: auth.userId,
      id: `${parent.id}:prep:${plan.offsetLabel}`,
      updatedAt: now,
    });
    if (!norm.ok) {
      console.error(`[prep-runway] plan normalize failed: ${norm.error}`);
      return new Response(JSON.stringify({ error: "Could not build prep sessions" }), { status: 500, headers });
    }
    rows.push(norm.row);
  }

  const created = await insertRows(rows, headers);
  return created;
}

/** Bulk-insert with the same missing-column strip/retry as calendar-save, so
 *  the handler still works in an environment where the migration hasn't run. */
async function insertRows(rows: CalendarRow[], headers: Record<string, string>): Promise<Response> {
  const stripped: string[] = [];
  let payload: Record<string, unknown>[] = rows.map((r) => ({ ...r }));
  for (let attempt = 0; attempt < 12; attempt++) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/calendar_events`, {
      method: "POST",
      // ignore-duplicates: a deterministic-PK collision (the race loser, see the
      // id derivation above) is silently skipped rather than 409-ing the batch.
      headers: svcHeaders({ Prefer: "return=representation, resolution=ignore-duplicates" }),
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const inserted = await res.json().catch(() => []);
      const events = Array.isArray(inserted) ? inserted : [];
      return new Response(JSON.stringify({ ok: true, alreadyGenerated: false, created: events, events, strippedColumns: stripped }), {
        status: 200,
        headers,
      });
    }
    const errText = await res.text().catch(() => "");
    const col = missingColumn(errText);
    if (col && !PROTECTED_COLUMNS.has(col) && !REQUIRED_COLUMNS.has(col)) {
      stripped.push(col);
      payload = payload.map((p) => {
        const { [col]: _drop, ...rest } = p;
        return rest;
      });
      continue;
    }
    console.error(`[prep-runway] insert failed HTTP ${res.status}: ${errText.slice(0, 300)}`);
    return new Response(JSON.stringify({ error: "Could not save prep sessions", details: errText.slice(0, 200) }), {
      status: res.status >= 400 && res.status < 500 ? 400 : 502,
      headers,
    });
  }
  return new Response(JSON.stringify({ error: "Could not save prep sessions after retries" }), { status: 500, headers });
}
