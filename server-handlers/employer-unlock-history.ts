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
 * employer's gstin/billingName (all nullable, additive), plus creditAppliedPaise
 * (the part of the price paid from account credit; amount is the cash part).
 *
 * invoiceSnapshot (migration 0045) is the frozen supplier/buyer/tax data written
 * at fulfilment; the client renders documents from it so a later profile or env
 * change cannot rewrite them. null for older rows (the client falls back to the
 * live gstin/billingName). partialRefundPaise/partialRefundAt back the credit
 * note for a partial refund. creditNotes lists the credit notes issued for the
 * order (employer_credit_notes, migration 0047; empty when that table is absent,
 * in which case the client derives a number from the invoice number).
 *
 * A paid unlock buys a snapshot, not a standing right to reach someone who has
 * since withdrawn, declined, blocked the employer, or been refunded, or while
 * the employer is suspended: those candidates come back with a masked name and
 * no email, the same rule the fulfilment replay applies.
 */

export const config = { runtime: "edge" };

import { withAuthAndRateLimit, corsHeaders, withRequestId, slog } from "./_shared";
import { creditSpentOnOrders } from "./_employer-credit";
import { parseInvoiceSnapshot } from "./_unlock-tax";
import { maskedCandidateName } from "./_employer-trust";

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
    // Invoice/refund columns arrive with migration 0032 and the snapshot /
    // partial-refund columns with 0045; fall back one level at a time so the
    // list still loads on a database that hasn't applied them yet.
    const core = "id,match_id,match_ids,amount,currency,created_at";
    const withInvoice = `${core},razorpay_order_id,invoice_no,refunded_at,requirement_id`;
    const selects = [`${withInvoice},invoice_snapshot,partial_refund_paise,partial_refund_at`, withInvoice, core];
    let res = await fetch(`${baseUrl}&select=${selects[0]}&order=created_at.desc&limit=100`, { headers: serviceHeaders() });
    for (let i = 1; !res.ok && i < selects.length; i++) {
      res = await fetch(`${baseUrl}&select=${selects[i]}&order=created_at.desc&limit=100`, { headers: serviceHeaders() });
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
      requirement_id?: string | null;
      invoice_snapshot?: unknown;
      partial_refund_paise?: number | null;
      partial_refund_at?: string | null;
    }>;

    // Snapshotted at unlock time (supabase-migrations/0026) so a candidate
    // later deleting their account — which cascades away the match row —
    // doesn't leave the employer with an unexplained charge and no name.
    const allMatchIds = Array.from(new Set(rows.flatMap((r) => (r.match_id ? [r.match_id] : r.match_ids || []))));
    const candidateByMatchId = new Map<string, { name: string | null; email: string | null; candidateId: string | null; optedOut: boolean }>();
    if (allMatchIds.length > 0) {
      const matchIdParam = allMatchIds.map((id) => encodeURIComponent(id)).join(",");
      const matchRes = await fetch(
        `${SUPABASE_URL}/rest/v1/requirement_matches?id=in.(${matchIdParam})&select=id,candidate_user_id,candidate_response,unlocked_candidate_name,unlocked_candidate_email,profiles(employer_visibility)`,
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
            candidate_user_id?: string | null;
            candidate_response?: string | null;
            unlocked_candidate_name: string | null;
            unlocked_candidate_email: string | null;
            profiles?: { employer_visibility?: string | null } | null;
          }>) {
            candidateByMatchId.set(m.id, {
              name: m.unlocked_candidate_name,
              email: m.unlocked_candidate_email,
              candidateId: m.candidate_user_id ?? null,
              optedOut: m.profiles?.employer_visibility === "off" || m.candidate_response === "declined",
            });
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
    // Credit applied to each purchase (migration 0041); soft-fails to none.
    const creditByOrderId = orderIds.length > 0
      ? (await creditSpentOnOrders(SUPABASE_URL, serviceHeaders(), auth.userId, orderIds)) ?? new Map<string, number>()
      : new Map<string, number>();
    // Credit notes, one row per refund (migration 0047). Soft-fails to none.
    const creditNotesByOrderId = new Map<string, Array<{ no: string; amountPaise: number; issuedAt: string }>>();
    if (orderIds.length > 0) {
      try {
        const cnRes = await fetch(
          `${SUPABASE_URL}/rest/v1/employer_credit_notes?order_id=in.(${orderIds.map(encodeURIComponent).join(",")})` +
            `&select=order_id,amount_paise,credit_note_no,created_at&order=created_at.asc`,
          { headers: serviceHeaders() },
        );
        const cnRows = cnRes.ok ? await cnRes.json().catch(() => null) : null;
        if (Array.isArray(cnRows)) {
          for (const c of cnRows as Array<{ order_id: string; amount_paise: number; credit_note_no: string; created_at: string }>) {
            const list = creditNotesByOrderId.get(c.order_id) ?? [];
            list.push({ no: c.credit_note_no, amountPaise: c.amount_paise, issuedAt: c.created_at });
            creditNotesByOrderId.set(c.order_id, list);
          }
        }
      } catch { /* credit notes fall back to the derived number */ }
    }
    // Candidates who blocked this employer, and whether the employer is suspended: both withhold contact.
    const blockedCandidateIds = new Set<string>();
    const candidateIds = Array.from(new Set(Array.from(candidateByMatchId.values()).map((c) => c.candidateId).filter((v): v is string => !!v)));
    if (candidateIds.length > 0) {
      try {
        const bRes = await fetch(
          `${SUPABASE_URL}/rest/v1/employer_blocks?employer_id=eq.${encodeURIComponent(auth.userId)}&candidate_user_id=in.(${candidateIds.map(encodeURIComponent).join(",")})&select=candidate_user_id`,
          { headers: serviceHeaders() },
        );
        const bRows = bRes.ok ? await bRes.json().catch(() => null) : null;
        if (Array.isArray(bRows)) for (const b of bRows as Array<{ candidate_user_id: string }>) blockedCandidateIds.add(b.candidate_user_id);
      } catch { /* block state is best effort */ }
    }
    let employerSuspended = false;
    try {
      const sRes = await fetch(`${SUPABASE_URL}/rest/v1/employers?id=eq.${encodeURIComponent(auth.userId)}&select=suspended_at`, { headers: serviceHeaders() });
      const sRows = sRes.ok ? await sRes.json().catch(() => null) : null;
      if (Array.isArray(sRows) && sRows[0]) employerSuspended = !!sRows[0].suspended_at;
    } catch { /* column absent: not suspended */ }
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
      const orderStatus = (r.razorpay_order_id && statusByOrderId.get(r.razorpay_order_id)) || null;
      const refunded = !!r.refunded_at || orderStatus === "refunded";
      return {
        id: r.id,
        matchIds,
        amount: r.amount,
        currency: r.currency,
        createdAt: r.created_at,
        invoiceNo: r.invoice_no ?? null,
        refundedAt: r.refunded_at ?? null,
        requirementId: r.requirement_id ?? null,
        orderId: r.razorpay_order_id ?? null,
        orderStatus,
        creditAppliedPaise: (r.razorpay_order_id && creditByOrderId.get(r.razorpay_order_id)) || 0,
        invoiceSnapshot: parseInvoiceSnapshot(r.invoice_snapshot),
        partialRefundPaise: r.partial_refund_paise ?? 0,
        partialRefundAt: r.partial_refund_at ?? null,
        creditNotes: (r.razorpay_order_id && creditNotesByOrderId.get(r.razorpay_order_id)) || [],
        gstin,
        billingName,
        candidates: matchIds.map((id) => {
          const snapshot = candidateByMatchId.get(id);
          const withheld = employerSuspended || refunded || !!snapshot?.optedOut || (!!snapshot?.candidateId && blockedCandidateIds.has(snapshot.candidateId));
          if (withheld) return { matchId: id, name: maskedCandidateName(id), email: null };
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
