/* Vercel Edge Function — Flag/report a chat message
 *
 * POST /api/flag-message { messageId, reason, note? }
 *
 * Either party on a conversation can flag any message in it (their own or
 * the other side's) for admin review — product decision: no auto-blocking,
 * just a human-reviewable queue (see admin-data.ts's "messaging" section).
 *
 * Ownership: the message's conversation row carries employer_id and
 * candidate_user_id directly (denormalized, see supabase-schema.sql), so a
 * single lookup both confirms the message exists and resolves the caller's
 * role without a second round trip.
 */

export const config = { runtime: "edge" };

import { withAuthAndRateLimit, corsHeaders, withRequestId, slog, isRateLimited, rateLimitResponse } from "./_shared";
import { asFlagReason, asFlagNote, resolveRole, MESSAGE_ID_RE } from "./_messages-helpers";

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const DAILY_FLAG_CAP = 40;

function serviceHeaders(): Record<string, string> {
  return { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` };
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 503, headers: withRequestId(corsHeaders(req)),
    });
  }

  const pre = await withAuthAndRateLimit(req, {
    endpoint: "flag-message",
    ipLimit: 30,
    userLimit: 15,
    maxBytes: 5_000,
    checkQuota: false,
  });
  if (pre instanceof Response) return pre;
  const { auth } = pre;
  const headers = { ...pre.headers, ...corsHeaders(req) };

  if (!auth.userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  let body: { messageId?: unknown; reason?: unknown; note?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers });
  }

  const messageId = typeof body.messageId === "string" ? body.messageId : "";
  const reason = asFlagReason(body.reason);
  const note = asFlagNote(body.note);
  if (!MESSAGE_ID_RE.test(messageId)) {
    return new Response(JSON.stringify({ error: "Invalid messageId" }), { status: 400, headers });
  }
  if (!reason) {
    return new Response(JSON.stringify({ error: "A reason is required" }), { status: 400, headers });
  }

  try {
    const msgRes = await fetch(
      `${SUPABASE_URL}/rest/v1/conversation_messages?id=eq.${encodeURIComponent(messageId)}` +
        `&select=id,conversation_id,employer_id,candidate_user_id`,
      { headers: serviceHeaders() },
    );
    const msgRows = (await msgRes.json().catch(() => [])) as Array<{
      id: string; conversation_id: string; employer_id: string; candidate_user_id: string;
    }>;
    if (!msgRes.ok || !msgRows[0]) {
      return new Response(JSON.stringify({ error: "Message not found" }), { status: 404, headers });
    }
    const message = msgRows[0];
    const role = resolveRole(auth.userId, message.employer_id, message.candidate_user_id);
    // Same answer as a missing row, so a stranger cannot probe which ids exist.
    if (!role) {
      return new Response(JSON.stringify({ error: "Message not found" }), { status: 404, headers });
    }

    // Idempotent per reporter: a repeat report of the same message by the same
    // person must not add a second open flag (the admin queue and any strike
    // counting key off flag rows). Their own auto-flag (role "system") does not
    // count as a report. The check is the fast path; uq_message_flags_reporter
    // (migration 0051) closes the race between two concurrent requests.
    const dupRes = await fetch(
      `${SUPABASE_URL}/rest/v1/message_flags?message_id=eq.${encodeURIComponent(message.id)}` +
        `&flagged_by=eq.${encodeURIComponent(auth.userId)}&flagged_by_role=neq.system&select=id&limit=1`,
      { headers: serviceHeaders() },
    ).catch(() => null);
    if (dupRes && dupRes.ok) {
      const dups = (await dupRes.json().catch(() => [])) as unknown[];
      if (dups.length > 0) {
        return new Response(JSON.stringify({ ok: true, duplicate: true }), { status: 200, headers });
      }
    }

    // The review queue is read by a human: cap new reports per person per day so one account cannot bury it.
    if (await isRateLimited(auth.userId, "flag-message-day", DAILY_FLAG_CAP, 24 * 60 * 60_000)) {
      return rateLimitResponse(headers, 3600);
    }

    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/message_flags`, {
      method: "POST",
      headers: { ...serviceHeaders(), "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({
        message_id: message.id,
        conversation_id: message.conversation_id,
        flagged_by: auth.userId,
        flagged_by_role: role,
        reason,
        note,
      }),
    });
    if (insertRes.status === 409) {
      // Unique violation: the same reporter won a race against themselves.
      return new Response(JSON.stringify({ ok: true, duplicate: true }), { status: 200, headers });
    }
    if (!insertRes.ok) {
      const t = await insertRes.text().catch(() => "");
      slog.error("flag-message insert failed", { code: "flag_message_insert_failed", httpStatus: insertRes.status, body: t.slice(0, 200), userId: auth.userId });
      return new Response(JSON.stringify({ error: "Failed to flag message" }), { status: 500, headers });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 201, headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    slog.error("flag-message threw", { code: "flag_message_unexpected_error", error: msg.slice(0, 200), userId: auth.userId });
    return new Response(JSON.stringify({ error: "Failed to flag message" }), { status: 500, headers });
  }
}
