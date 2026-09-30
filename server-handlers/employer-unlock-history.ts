/* Vercel Edge Function — Employer Unlock History
 *
 * GET /api/employer-unlock-history
 * Returns every completed unlock purchase (single or batch) for the caller's
 * employer account, newest first — backs the "Unlock history" panel on the
 * opportunity detail page. Rows are written by
 * employer-verify-unlock-payment.ts; this is the first read path against
 * employer_unlock_payments. Not scoped to one requirement server-side (the
 * table has no requirement_id column) — the client filters by matchIds
 * against the requirement's own candidate list.
 */

export const config = { runtime: "edge" };

import { withAuthAndRateLimit, corsHeaders, withRequestId, slog } from "./_shared";

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function serviceHeaders(): Record<string, string> {
  return { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` };
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req, { allowGet: true }) });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 503, headers: withRequestId(corsHeaders(req, { allowGet: true })),
    });
  }

  const pre = await withAuthAndRateLimit(req, {
    endpoint: "employer-unlock-history",
    ipLimit: 40,
    userLimit: 20,
    maxBytes: 0,
    checkQuota: false,
    allowGet: true,
  });
  if (pre instanceof Response) return pre;
  const { auth } = pre;
  const headers = { ...pre.headers, ...corsHeaders(req, { allowGet: true }) };

  if (!auth.userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  }
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/employer_unlock_payments?employer_id=eq.${encodeURIComponent(auth.userId)}&select=id,match_id,match_ids,amount,currency,created_at&order=created_at.desc&limit=100`,
      { headers: serviceHeaders() },
    );
    if (!res.ok) throw new Error(`unlock history read failed: ${res.status}`);
    const rows = (await res.json().catch(() => [])) as Array<{
      id: string;
      match_id: string | null;
      match_ids: string[] | null;
      amount: number;
      currency: string;
      created_at: string;
    }>;

    const purchases = rows.map((r) => ({
      id: r.id,
      matchIds: r.match_id ? [r.match_id] : r.match_ids || [],
      amount: r.amount,
      currency: r.currency,
      createdAt: r.created_at,
    }));
    return new Response(JSON.stringify({ purchases }), { status: 200, headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    slog.error("employer-unlock-history GET threw", { code: "employer_unlock_history_unexpected_error", error: msg.slice(0, 200), userId: auth.userId });
    return new Response(JSON.stringify({ error: "Failed to load unlock history" }), { status: 500, headers });
  }
}
