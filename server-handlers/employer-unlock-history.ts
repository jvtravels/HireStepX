/* Vercel Edge Function — Employer Unlock History
 *
 * GET /api/employer-unlock-history
 * Returns every completed unlock purchase (single or batch) for the caller's
 * employer account, newest first — backs the "Unlock history" panel on the
 * opportunity detail page. Rows are written by
 * the shared unlock fulfilment (_unlock-fulfillment.ts); this is the first
 * read path against employer_unlock_payments. Not scoped to one requirement
 * server-side — the client filters by matchIds against the requirement's own
 * candidate list.
 *
 * Each purchase also carries invoiceNo, refundedAt, orderId/orderStatus and the
 * employer's gstin/billingName (all nullable, additive).
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
    const baseUrl = `${SUPABASE_URL}/rest/v1/employer_unlock_payments?employer_id=eq.${encodeURIComponent(auth.userId)}`;
    // Invoice/refund columns arrive with migration 0032; fall back to the
    // original column set so the list still loads on a database that hasn't
    // applied it yet.
    let res = await fetch(
      `${baseUrl}&select=id,match_id,match_ids,amount,currency,created_at,razorpay_order_id,invoice_no,refunded_at&order=created_at.desc&limit=100`,
      { headers: serviceHeaders() },
    );
    if (!res.ok) {
      res = await fetch(
        `${baseUrl}&select=id,match_id,match_ids,amount,currency,created_at&order=created_at.desc&limit=100`,
        { headers: serviceHeaders() },
      );
    }
    if (!res.ok) {
      // Include the PostgREST body: a missing column (unapplied migration)
      // otherwise logs as a bare status code with no hint of the cause.
      const detail = await res.text().catch(() => "");
      throw new Error(`unlock history read failed: ${res.status} ${detail.slice(0, 160)}`);
    }
    const rows = (await res.json().catch(() => [])) as Array<{
      id: string;
      match_id: string | null;
      match_ids: string[] | null;
      amount: number;
      currency: string;
      created_at: string;
      razorpay_order_id?: string | null;
      invoice_no?: string | null;
      refunded_at?: string | null;
    }>;

    // Snapshotted at unlock time (supabase-migrations/0026) so a candidate
    // later deleting their account — which cascades away the match row —
    // doesn't leave the employer with an unexplained charge and no name.
    const allMatchIds = Array.from(new Set(rows.flatMap((r) => (r.match_id ? [r.match_id] : r.match_ids || []))));
    const candidateByMatchId = new Map<string, { name: string | null; email: string | null }>();
    if (allMatchIds.length > 0) {
      const matchIdParam = allMatchIds.map((id) => encodeURIComponent(id)).join(",");
      const matchRes = await fetch(
        `${SUPABASE_URL}/rest/v1/requirement_matches?id=in.(${matchIdParam})&select=id,unlocked_candidate_name,unlocked_candidate_email`,
        { headers: serviceHeaders() },
      );
      // Soft-fail: this is a display enrichment, not the primary data. A
      // schema mismatch or transient PostgREST error here (e.g. an error
      // object instead of an array) must never 500 the purchase list itself —
      // candidates just fall back to null/"Candidate" below.
      if (matchRes.ok) {
        const matchRows = await matchRes.json().catch(() => null);
        if (Array.isArray(matchRows)) {
          for (const m of matchRows as Array<{
            id: string;
            unlocked_candidate_name: string | null;
            unlocked_candidate_email: string | null;
          }>) {
            candidateByMatchId.set(m.id, { name: m.unlocked_candidate_name, email: m.unlocked_candidate_email });
          }
        }
      } else {
        slog.error("employer-unlock-history candidate snapshot lookup failed", {
          code: "employer_unlock_history_match_lookup_failed",
          status: matchRes.status,
          userId: auth.userId,
        });
      }
    }

    // Order status + the employer's GST billing identity are additive display
    // data (invoice view); like the snapshot lookup above they soft-fail.
    const statusByOrderId = new Map<string, string>();
    const orderIds = Array.from(new Set(rows.map((r) => r.razorpay_order_id).filter((v): v is string => !!v)));
    if (orderIds.length > 0) {
      try {
        const ordRes = await fetch(
          `${SUPABASE_URL}/rest/v1/employer_unlock_orders?razorpay_order_id=in.(${orderIds.map(encodeURIComponent).join(",")})&select=razorpay_order_id,status`,
          { headers: serviceHeaders() },
        );
        const ordRows = ordRes.ok ? await ordRes.json().catch(() => null) : null;
        if (Array.isArray(ordRows)) {
          for (const o of ordRows as Array<{ razorpay_order_id: string; status: string }>) statusByOrderId.set(o.razorpay_order_id, o.status);
        }
      } catch { /* status is optional */ }
    }
    let gstin: string | null = null;
    let billingName: string | null = null;
    try {
      const empRes = await fetch(
        `${SUPABASE_URL}/rest/v1/employers?id=eq.${encodeURIComponent(auth.userId)}&select=gstin,billing_name`,
        { headers: serviceHeaders() },
      );
      const empRows = empRes.ok ? await empRes.json().catch(() => null) : null;
      if (Array.isArray(empRows) && empRows[0]) {
        gstin = empRows[0].gstin ?? null;
        billingName = empRows[0].billing_name ?? null;
      }
    } catch { /* billing identity is optional */ }

    const purchases = rows.map((r) => {
      const matchIds = r.match_id ? [r.match_id] : r.match_ids || [];
      return {
        id: r.id,
        matchIds,
        amount: r.amount,
        currency: r.currency,
        createdAt: r.created_at,
        invoiceNo: r.invoice_no ?? null,
        refundedAt: r.refunded_at ?? null,
        orderId: r.razorpay_order_id ?? null,
        orderStatus: (r.razorpay_order_id && statusByOrderId.get(r.razorpay_order_id)) || null,
        gstin,
        billingName,
        candidates: matchIds.map((id) => {
          const snapshot = candidateByMatchId.get(id);
          return { matchId: id, name: snapshot?.name || null, email: snapshot?.email || null };
        }),
      };
    });
    return new Response(JSON.stringify({ purchases }), { status: 200, headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    slog.error("employer-unlock-history GET threw", { code: "employer_unlock_history_unexpected_error", error: msg.slice(0, 200), userId: auth.userId });
    return new Response(JSON.stringify({ error: "Failed to load unlock history" }), { status: 500, headers });
  }
}
