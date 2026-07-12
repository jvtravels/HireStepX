/* Vercel Edge Function — Salary Offer Self-Report
 *
 * Captures user-reported salary offers (post-interview ground truth).
 * Per-user, RLS-scoped. Aggregation across users is gated on
 * may_share_aggregate=true and a k≥5 floor at read time (NOT here).
 *
 * GET  /api/salary-offer        → { offers: SalaryOfferRow[] }
 * POST /api/salary-offer        → insert one offer; returns the row
 *
 * Schema in supabase-schema.sql §21 (salary_offers).
 */

export const config = { runtime: "edge" };

import { withAuthAndRateLimit, corsHeaders, withRequestId } from "./_shared";
import { normalizeSalaryOffer } from "./_salary-offer-helpers";

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

async function supa(path: string, opts?: RequestInit): Promise<Response> {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(opts?.headers || {}),
    },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: withRequestId(corsHeaders(req)),
    });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "Not configured" }), {
      status: 503,
      headers: withRequestId(corsHeaders(req)),
    });
  }

  const pre = await withAuthAndRateLimit(req, {
    endpoint: "salary-offer",
    ipLimit: 30,
    userLimit: 20,
    checkQuota: false,
    maxBytes: 8_000,
    allowGet: true,
  });
  if (pre instanceof Response) return pre;
  const { headers, auth } = pre;
  const userId = auth.userId!;

  if (req.method === "GET") {
    const res = await supa(
      `salary_offers?user_id=eq.${encodeURIComponent(userId)}&order=reported_at.desc&limit=50`,
    );
    if (!res.ok) {
      return new Response(JSON.stringify({ offers: [] }), { status: 200, headers });
    }
    const rows = (await res.json()) as Array<Record<string, unknown>>;
    return new Response(JSON.stringify({ offers: rows }), { status: 200, headers });
  }

  // POST = insert
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const result = normalizeSalaryOffer(userId, body);
    if (!result.ok) {
      return new Response(JSON.stringify({ error: result.error }), { status: 400, headers });
    }

    const res = await supa(`salary_offers`, {
      method: "POST",
      body: JSON.stringify(result.row),
      headers: { Prefer: "return=representation" },
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      console.error(`[salary-offer] insert failed HTTP ${res.status}: ${err.slice(0, 200)}`);
      return new Response(JSON.stringify({ error: "Failed to save offer" }), { status: 500, headers });
    }
    const inserted = (await res.json()) as Array<Record<string, unknown>>;
    return new Response(JSON.stringify({ ok: true, offer: inserted[0] ?? null }), {
      status: 200,
      headers,
    });
  } catch (err) {
    console.error("[salary-offer] error:", err instanceof Error ? err.message : String(err));
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers });
  }
}
