/* Vercel Edge Function — Idempotent interview-turn ingest.
 *
 * POST /api/interview-turns { turns: InterviewTurn[] }
 *
 * The client writes every turn to a local outbox first and drains it here in
 * batches. Because a response can be lost after the row landed (the classic
 * lie-fi case), the same turn id may arrive many times: inserts use
 * ignore-duplicates so a replay is a no-op instead of a 409 that would loop
 * in the client queue forever.
 *
 * user_id is forced from the verified token, and every session_id must be a
 * session owned by the caller — the service role bypasses RLS, so we enforce
 * the same boundary here explicitly.
 *
 * Response: { ok, saved: string[], retry: string[], dropped: string[] }
 *   saved   — durably stored (or already were); remove from outbox
 *   retry   — session row not created yet; keep and try later
 *   dropped — malformed, can never succeed; remove from outbox
 */

export const config = { runtime: "edge" };

import { withAuthAndRateLimit, corsHeaders, withRequestId } from "./_shared";
import { MAX_TURNS_PER_REQUEST, partitionBySession, validateTurns } from "./_interview-turns-helpers";

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export default async function handler(req: Request, fetchImpl: typeof fetch = fetch): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), { status: 503, headers: withRequestId(corsHeaders(req)) });
  }

  const pre = await withAuthAndRateLimit(req, {
    endpoint: "interview-turns",
    ipLimit: 120,
    userLimit: 90,
    maxBytes: 600_000,
    checkQuota: false,
  });
  if (pre instanceof Response) return pre;
  const { headers, auth } = pre;
  if (!auth.userId || typeof auth.userId !== "string") {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  }

  let body: { turns?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers });
  }
  if (!Array.isArray(body.turns) || body.turns.length === 0 || body.turns.length > MAX_TURNS_PER_REQUEST) {
    return new Response(JSON.stringify({ error: `turns must be 1-${MAX_TURNS_PER_REQUEST} items` }), { status: 400, headers });
  }

  const { valid, invalid } = validateTurns(body.turns, auth.userId);
  const dropped = invalid.flatMap((i) => (i.id ? [i.id] : []));
  const svcHeaders = { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` };

  if (valid.length === 0) {
    return new Response(JSON.stringify({ ok: true, saved: [], retry: [], dropped }), { status: 200, headers });
  }

  try {
    const sessionIds = [...new Set(valid.map((t) => t.session_id))];
    const inList = sessionIds.map((s) => `"${s.replace(/["\\]/g, "")}"`).join(",");
    const ownedRes = await fetchImpl(
      `${SUPABASE_URL}/rest/v1/sessions?select=id&user_id=eq.${encodeURIComponent(auth.userId)}&id=in.(${encodeURIComponent(inList)})`,
      { headers: svcHeaders, signal: AbortSignal.timeout(8000) },
    );
    if (!ownedRes.ok) return new Response(JSON.stringify({ error: "Upstream error" }), { status: 502, headers });
    const owned = new Set(((await ownedRes.json()) as Array<{ id: string }>).map((r) => r.id));
    const { accepted, missingSession } = partitionBySession(valid, owned);

    if (accepted.length > 0) {
      const insertRes = await fetchImpl(`${SUPABASE_URL}/rest/v1/interview_turns?on_conflict=id`, {
        method: "POST",
        headers: { ...svcHeaders, "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=minimal" },
        body: JSON.stringify(accepted),
        signal: AbortSignal.timeout(8000),
      });
      if (!insertRes.ok) return new Response(JSON.stringify({ error: "Upstream error" }), { status: 502, headers });
    }

    return new Response(JSON.stringify({
      ok: true,
      saved: accepted.map((t) => t.id),
      retry: missingSession.map((t) => t.id),
      dropped,
    }), { status: 200, headers });
  } catch {
    return new Response(JSON.stringify({ error: "Upstream unavailable" }), { status: 502, headers });
  }
}
