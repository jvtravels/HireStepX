/* Vercel Edge Function — Employer credit balance
 *
 * GET /api/employer-credit → { balancePaise, owedPaise, events }
 * Credit is the in-platform balance created when a paid candidate can't be
 * reached (see _employer-credit.ts). Before migration 0041 is applied this
 * answers a zero balance with no events rather than an error.
 */

export const config = { runtime: "edge" };

import { withAuthAndRateLimit, corsHeaders, withRequestId } from "./_shared";
import { loadCreditRows, toCreditEvents } from "./_employer-credit";

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

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
    endpoint: "employer-credit",
    ipLimit: 60,
    userLimit: 30,
    maxBytes: 0,
    checkQuota: false,
    allowGet: true,
  });
  if (pre instanceof Response) return pre;
  const headers = { ...pre.headers, ...corsHeaders(req, { allowGet: true }) };
  if (!pre.auth.userId) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  if (req.method !== "GET") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });

  const service = { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` };
  const rows = await loadCreditRows(SUPABASE_URL, service, pre.auth.userId);
  const list = rows ?? [];
  const net = list.reduce((s, r) => s + r.amount, 0);
  // A clawback after the credit was spent leaves a debt: show 0 spendable and the amount still owed.
  const balancePaise = Math.max(0, net);
  const owedPaise = Math.max(0, -net);
  return new Response(JSON.stringify({ balancePaise, owedPaise, events: toCreditEvents(list).slice(0, 50) }), { status: 200, headers });
}
