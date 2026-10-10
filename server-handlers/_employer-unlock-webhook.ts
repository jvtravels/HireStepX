/* Razorpay webhook handling for employer contact-unlock orders.
 *
 * Called from razorpay-webhook.ts BEFORE the candidate subscription / credit
 * branches. It only claims an event when the payment/order belongs to an
 * employer_unlock_orders row (or, for payment.captured, carries unlock notes
 * written by employer-create-unlock-order); everything else returns
 * { handled: false } and falls through to the existing branches untouched.
 *
 * Events:
 *   payment.captured / order.paid  -> fulfillUnlockOrder() (shared with the
 *                                      browser verify endpoint + reconciler)
 *   refund.created / refund.processed -> full refund: order 'refunded', ledger
 *                                      refunded_at, relock the matches THIS
 *                                      order unlocked
 *   payment.dispute.*               -> order 'disputed' + slog.error; no
 *                                      automatic relock (support decides)
 * Every step is idempotent so Razorpay retries are safe; `retry: true` tells
 * the caller to release its dedup key and answer 5xx so Razorpay redelivers.
 */

import { slog } from "./_shared";
import {
  backfillLegacyUnlockOrder,
  fulfillUnlockOrder,
  loadUnlockOrder,
  ORDER_SELECT,
  toCapturedPayment,
  type UnlockOrderRow,
} from "./_unlock-fulfillment";
import type { NotifyInput } from "./_notify";

export type UnlockWebhookOutcome =
  | { handled: false }
  | { handled: true; status: number; body: Record<string, unknown>; retry?: boolean };

export interface UnlockWebhookParams {
  eventType: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Razorpay webhook payload is dynamic external data
  event: any;
  supabaseUrl: string;
  headers: Record<string, string>;
  fetchImpl?: typeof fetch;
  notifyImpl?: (input: NotifyInput) => Promise<void>;
  now?: () => Date;
}

const done = (body: Record<string, unknown>, status = 200): UnlockWebhookOutcome => ({ handled: true, status, body });
const retry = (error: string): UnlockWebhookOutcome => ({ handled: true, status: 500, body: { error }, retry: true });

async function findOrderByPaymentId(
  supabaseUrl: string, headers: Record<string, string>, paymentId: string, f: typeof fetch,
): Promise<UnlockOrderRow | null | "error"> {
  const res = await f(
    `${supabaseUrl}/rest/v1/employer_unlock_orders?razorpay_payment_id=eq.${encodeURIComponent(paymentId)}&select=${ORDER_SELECT}`,
    { headers },
  );
  if (!res.ok) return "error";
  const rows = (await res.json().catch(() => [])) as UnlockOrderRow[];
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

async function setOrderStatus(
  supabaseUrl: string, headers: Record<string, string>, razorpayOrderId: string,
  from: string, to: string, f: typeof fetch, now: Date,
): Promise<boolean> {
  const res = await f(
    `${supabaseUrl}/rest/v1/employer_unlock_orders?razorpay_order_id=eq.${encodeURIComponent(razorpayOrderId)}&status=in.(${from})`,
    {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ status: to, updated_at: now.toISOString() }),
    },
  );
  return res.ok;
}

/** Relocks only matches this order unlocked (unlocked_at on/after the order
 *  was created) — a candidate the employer already had unlocked, or one
 *  unlocked by a different order, stays unlocked. */
async function relockOrderMatches(
  supabaseUrl: string, headers: Record<string, string>, order: UnlockOrderRow, f: typeof fetch,
): Promise<boolean> {
  if (order.match_ids.length === 0) return true;
  const url =
    `${supabaseUrl}/rest/v1/requirement_matches?id=in.(${order.match_ids.map(encodeURIComponent).join(",")})` +
    `&unlocked=eq.true&unlocked_at=gte.${encodeURIComponent(order.created_at)}`;
  const patchHeaders = { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" };
  const full = await f(url, {
    method: "PATCH",
    headers: patchHeaders,
    body: JSON.stringify({ unlocked: false, unlocked_at: null, unlocked_candidate_name: null, unlocked_candidate_email: null }),
  });
  if (full.ok) return true;
  // Snapshot columns may be missing on older schemas (migration 0026); the relock itself must still happen.
  const core = await f(url, { method: "PATCH", headers: patchHeaders, body: JSON.stringify({ unlocked: false, unlocked_at: null }) });
  return core.ok;
}

async function stampLedgerRefunded(
  supabaseUrl: string, headers: Record<string, string>, paymentId: string, f: typeof fetch, now: Date,
): Promise<boolean> {
  const res = await f(
    `${supabaseUrl}/rest/v1/employer_unlock_payments?razorpay_payment_id=eq.${encodeURIComponent(paymentId)}&refunded_at=is.null`,
    {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ refunded_at: now.toISOString() }),
    },
  );
  return res.ok;
}

export async function handleEmployerUnlockWebhook(p: UnlockWebhookParams): Promise<UnlockWebhookOutcome> {
  const f = p.fetchImpl ?? fetch;
  const now = (p.now ?? (() => new Date()))();
  const { eventType, event } = p;

  /* ── payment.captured / order.paid ── */
  if (eventType === "payment.captured" || eventType === "order.paid") {
    const entity = event?.payload?.payment?.entity;
    const payment = toCapturedPayment(entity);
    const orderId: string | undefined = payment?.orderId ?? event?.payload?.order?.entity?.id;
    if (!payment || !orderId) return { handled: false };

    let order = await loadUnlockOrder(p.supabaseUrl, p.headers, orderId, f);
    if (order === "error") return retry("order lookup failed");
    if (!order) {
      // Order created by the pre-ledger deploy: rebuild from the signed notes.
      const notes = (entity?.notes ?? {}) as Record<string, unknown>;
      const notedEmployer = typeof notes.employerId === "string" ? notes.employerId : "";
      if (!notedEmployer || (notes.mode !== "single" && notes.mode !== "batch")) return { handled: false };
      order = await backfillLegacyUnlockOrder({
        supabaseUrl: p.supabaseUrl, headers: p.headers, razorpayOrderId: orderId,
        amount: payment.amount, notes, employerId: notedEmployer, fetchImpl: f,
      });
      if (!order) {
        slog.error("captured employer unlock payment with no recoverable order row", {
          code: "unlock_webhook_order_missing", orderId, paymentId: payment.id,
        });
        return done({ received: true, skipped: "unlock_order_unrecoverable" });
      }
    }

    const result = await fulfillUnlockOrder({
      supabaseUrl: p.supabaseUrl, headers: p.headers, razorpayOrderId: orderId, payment,
      fetchImpl: f, notifyImpl: p.notifyImpl, now: () => now,
    });
    switch (result.kind) {
      case "fulfilled":
      case "partial":
        return done({ received: true, unlock: result.kind, unlocked: result.unlockedMatchIds.length, failed: result.failed.length });
      case "refunded":
      case "disputed":
        return done({ received: true, skipped: `unlock_order_${result.kind}` });
      case "not_captured":
        return done({ received: true, skipped: "not_captured" });
      case "not_found":
        return done({ received: true, skipped: "unlock_order_not_found" });
      case "error":
        if (result.code === "db_error") return retry("unlock fulfilment failed");
        // amount/order mismatch or duplicate payment: retrying cannot fix it; fulfilment already slog.error'd.
        return done({ received: true, skipped: `unlock_${result.code}` });
    }
  }

  /* ── refunds ── */
  if (eventType === "refund.created" || eventType === "refund.processed") {
    const refund = event?.payload?.refund?.entity;
    const paymentId: string | undefined = refund?.payment_id;
    if (!paymentId) return { handled: false };
    const order = await findOrderByPaymentId(p.supabaseUrl, p.headers, paymentId, f);
    if (order === "error") return retry("order lookup failed");
    if (!order) return { handled: false };

    const refundAmount = typeof refund?.amount === "number" ? refund.amount : 0;
    if (refundAmount < order.amount) {
      slog.warn("partial refund on employer unlock order — matches left unlocked, manual review", {
        code: "unlock_partial_refund", orderId: order.razorpay_order_id, paymentId, refundAmount, orderAmount: order.amount,
      });
      return done({ received: true, unlock_refund: "partial_ignored" });
    }

    // Relock + ledger first, status last: a failure in between is retried and
    // every step is a no-op the second time round.
    if (!(await relockOrderMatches(p.supabaseUrl, p.headers, order, f))) return retry("relock failed");
    if (!(await stampLedgerRefunded(p.supabaseUrl, p.headers, paymentId, f, now))) return retry("ledger update failed");
    if (order.status !== "refunded") {
      const ok = await setOrderStatus(p.supabaseUrl, p.headers, order.razorpay_order_id, "created,paid,fulfilled,partial,disputed,expired,failed", "refunded", f, now);
      if (!ok) return retry("order status update failed");
    }
    slog.warn("employer unlock order refunded — candidate contacts relocked", {
      code: "unlock_order_refunded", orderId: order.razorpay_order_id, paymentId, employerId: order.employer_id, matchCount: order.match_ids.length,
    });
    return done({ received: true, unlock_refund: eventType, relocked: order.match_ids.length });
  }

  /* ── disputes ── */
  if (eventType === "payment.dispute.created" || eventType === "payment.dispute.won" || eventType === "payment.dispute.lost") {
    const paymentId: string | undefined = event?.payload?.dispute?.entity?.payment_id;
    if (!paymentId) return { handled: false };
    const order = await findOrderByPaymentId(p.supabaseUrl, p.headers, paymentId, f);
    if (order === "error") return retry("order lookup failed");
    if (!order) return { handled: false };

    if (eventType === "payment.dispute.won") {
      // Contacts were never relocked, so winning just lifts the freeze.
      if (order.status === "disputed") {
        if (!(await setOrderStatus(p.supabaseUrl, p.headers, order.razorpay_order_id, "disputed", "fulfilled", f, now))) {
          return retry("order status update failed");
        }
      }
      slog.warn("employer unlock dispute won", { code: "unlock_dispute_won", orderId: order.razorpay_order_id, paymentId });
      return done({ received: true, unlock_dispute: eventType });
    }

    if (order.status !== "disputed" && order.status !== "refunded") {
      if (!(await setOrderStatus(p.supabaseUrl, p.headers, order.razorpay_order_id, "created,paid,fulfilled,partial", "disputed", f, now))) {
        return retry("order status update failed");
      }
    }
    slog.error(
      eventType === "payment.dispute.created"
        ? "chargeback filed on employer unlock payment — review and decide on relock manually"
        : "employer unlock dispute LOST — funds clawed back; decide on relock/suspension manually",
      { code: eventType === "payment.dispute.created" ? "unlock_dispute_created" : "unlock_dispute_lost",
        orderId: order.razorpay_order_id, paymentId, employerId: order.employer_id, amount: order.amount },
    );
    return done({ received: true, unlock_dispute: eventType });
  }

  return { handled: false };
}
