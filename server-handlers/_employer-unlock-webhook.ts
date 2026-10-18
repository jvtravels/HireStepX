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
 *                                      order unlocked; credit the order generated is
 *                                      clawed back and credit spent on it released
 *                                      A partial refund leaves the order untouched and records
 *                                      partial_refund_paise on the ledger row (migration 0045) so
 *                                      the employer can download a credit note for it. Every
 *                                      refund (keyed on its own refund id, so two partial
 *                                      refunds are two notes) also gets a numbered row in
 *                                      employer_credit_notes (migration 0047).
 *                                      A refund that arrives before the capture (no payment id on
 *                                      the order yet) records the payment id and is processed.
 *   payment.dispute.*               -> order 'disputed' + slog.error; no
 *                                      automatic relock (support decides). A LOST
 *                                      dispute claws back the credit the order
 *                                      generated (the cash behind it is gone).
 *                                      Between created and lost the order is only
 *                                      marked disputed; credit isn't frozen.
 * Every step is idempotent so Razorpay retries are safe; `retry: true` tells
 * the caller to release its dedup key and answer 5xx so Razorpay redelivers.
 */

import { slog } from "./_shared";
import { clawbackOrderCredit, creditSpentOnOrders } from "./_employer-credit";
import {
  alertUnlockProblem,
  assignCreditNote,
  backfillLegacyUnlockOrder,
  fetchRazorpayPayment,
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

/** The slice of the Razorpay webhook body this handler reads; the rest is ignored. */
export interface UnlockWebhookEvent {
  payload?: {
    payment?: { entity?: Record<string, unknown> };
    order?: { entity?: { id?: string } };
    refund?: { entity?: { id?: string; payment_id?: string; amount?: number } };
    dispute?: { entity?: { payment_id?: string } };
  };
}

export interface UnlockWebhookParams {
  eventType: string;
  event: UnlockWebhookEvent | undefined;
  supabaseUrl: string;
  headers: Record<string, string>;
  /** When both are set, a captured payment is re-fetched from Razorpay before fulfilling, so an
   *  already-refunded payment (events can arrive out of order) is never fulfilled from stale payload data. */
  razorpayKeyId?: string;
  razorpayKeySecret?: string;
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

/** Raises partial_refund_paise to the cumulative refunded amount (never lowers it, so the
 *  refund.created + refund.processed pair is a no-op the second time). "unsupported" when
 *  migration 0045 is unapplied: the refund is then only logged for manual review. */
async function recordPartialRefund(
  supabaseUrl: string, headers: Record<string, string>, paymentId: string, refundedPaise: number, f: typeof fetch, now: Date,
): Promise<"recorded" | "unsupported" | "error"> {
  const res = await f(
    `${supabaseUrl}/rest/v1/employer_unlock_payments?razorpay_payment_id=eq.${encodeURIComponent(paymentId)}` +
      `&or=(partial_refund_paise.is.null,partial_refund_paise.lt.${refundedPaise})`,
    {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ partial_refund_paise: refundedPaise, partial_refund_at: now.toISOString() }),
    },
  );
  if (res.ok) return "recorded";
  const text = await res.text().catch(() => "");
  return res.status === 400 && /PGRST204|42703|column/i.test(text) ? "unsupported" : "error";
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

/** A refund event for a payment no order has recorded yet: look the order up by the payment's
 *  order id and, if it is ours and still unpaid, stamp the payment id (conditional on null so a
 *  racing capture wins). null when the order is not an unlock order or belongs to another payment. */
async function adoptPaymentForOrder(
  p: UnlockWebhookParams, paymentId: string, f: typeof fetch, now: Date,
): Promise<UnlockOrderRow | null | "error"> {
  const orderId = p.event?.payload?.payment?.entity?.order_id;
  if (typeof orderId !== "string" || !orderId) return null;
  const order = await loadUnlockOrder(p.supabaseUrl, p.headers, orderId, f);
  if (order === "error") return "error";
  if (!order) return null;
  if (order.razorpay_payment_id) return order.razorpay_payment_id === paymentId ? order : null;
  const res = await f(
    `${p.supabaseUrl}/rest/v1/employer_unlock_orders?razorpay_order_id=eq.${encodeURIComponent(orderId)}&razorpay_payment_id=is.null`,
    {
      method: "PATCH",
      headers: { ...p.headers, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ razorpay_payment_id: paymentId, updated_at: now.toISOString() }),
    },
  );
  if (!res.ok) return "error";
  return { ...order, razorpay_payment_id: paymentId };
}

export async function handleEmployerUnlockWebhook(p: UnlockWebhookParams): Promise<UnlockWebhookOutcome> {
  const f = p.fetchImpl ?? fetch;
  const now = (p.now ?? (() => new Date()))();
  const { eventType, event } = p;

  /* ── payment.captured / order.paid ── */
  if (eventType === "payment.captured" || eventType === "order.paid") {
    const entity = event?.payload?.payment?.entity;
    const payloadPayment = toCapturedPayment(entity);
    const orderId: string | undefined = payloadPayment?.orderId ?? event?.payload?.order?.entity?.id;
    if (!payloadPayment || !orderId) return { handled: false };
    let payment = payloadPayment;

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

    // The payload can be stale: a refund may already have landed. Fulfil from Razorpay's current view.
    if (p.razorpayKeyId && p.razorpayKeySecret) {
      const live = (await fetchRazorpayPayment(payment.id, p.razorpayKeyId, p.razorpayKeySecret, f))
        ?? (await fetchRazorpayPayment(payment.id, p.razorpayKeyId, p.razorpayKeySecret, f));
      if (!live) return retry("payment re-fetch failed");
      payment = { ...live, orderId: live.orderId ?? payment.orderId };
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
      case "converted_to_credit":
        return done({ received: true, unlock: "converted_to_credit", creditPaise: result.creditPaise });
      case "not_captured":
        return done({ received: true, skipped: "not_captured" });
      case "not_found":
        return done({ received: true, skipped: "unlock_order_not_found" });
      case "error":
        // Money was captured but the order is not fulfilled: tell ops now rather than via tomorrow's digest.
        await alertUnlockProblem({
          kind: "unlock_not_fulfilled", key: orderId,
          subject: "Payment captured but not fulfilled",
          detail: `Employer unlock order ${orderId} (payment ${payment.id}) was captured but fulfilment failed: ${result.code} (${result.message}). ${result.code === "db_error" ? "Razorpay will redeliver and the reconciler retries." : "Retrying cannot fix this; manual review or refund needed."}`,
          distinctId: order.employer_id,
        });
        if (result.code === "db_error") return retry("unlock fulfilment failed");
        // amount/currency/order mismatch or duplicate payment: retrying cannot fix it; fulfilment already slog.error'd.
        return done({ received: true, skipped: `unlock_${result.code}` });
    }
  }

  /* ── refunds ── */
  if (eventType === "refund.created" || eventType === "refund.processed") {
    const refund = event?.payload?.refund?.entity;
    const paymentId: string | undefined = refund?.payment_id;
    if (!paymentId) return { handled: false };
    let order = await findOrderByPaymentId(p.supabaseUrl, p.headers, paymentId, f);
    if (order === "error") return retry("order lookup failed");
    if (!order) {
      // A refund can beat the capture: the order has no payment id yet. Adopt the payment so the
      // refund is processed now (and the later capture finds the order already refunded).
      const claimed = await adoptPaymentForOrder(p, paymentId, f, now);
      if (claimed === "error") return retry("order lookup failed");
      if (!claimed) return { handled: false };
      order = claimed;
    }

    // The payment entity carries the running total, so the refund that completes a series of
    // partial refunds is recognised as the full refund it is.
    const paidEntity = event?.payload?.payment?.entity;
    const refundAmount = typeof refund?.amount === "number" ? refund.amount : 0;
    const refundedTotal = Math.max(refundAmount, typeof paidEntity?.amount_refunded === "number" ? paidEntity.amount_refunded : 0);
    const refundId = typeof refund?.id === "string" && refund.id ? refund.id : "";
    if (refundedTotal < order.amount) {
      const recorded = await recordPartialRefund(p.supabaseUrl, p.headers, paymentId, refundedTotal, f, now);
      if (recorded === "error") return retry("partial refund record failed");
      // One numbered credit note per refund (idempotent on the refund id). Best effort: without the table
      // the document falls back to the derived credit-note number.
      if (refundId && refundAmount > 0) {
        await assignCreditNote(p.supabaseUrl, p.headers, order.razorpay_order_id, refundId, refundAmount, f);
      }
      slog.warn("partial refund on employer unlock order — matches left unlocked, manual review", {
        code: "unlock_partial_refund", orderId: order.razorpay_order_id, paymentId, refundAmount, refundedTotal, orderAmount: order.amount, recordedOnLedger: recorded === "recorded",
      });
      return done({ received: true, unlock_refund: "partial_ignored", creditNote: recorded === "recorded" });
    }

    // Relock + ledger first, status last: a failure in between is retried and
    // every step is a no-op the second time round.
    if (!(await relockOrderMatches(p.supabaseUrl, p.headers, order, f))) return retry("relock failed");
    if (!(await stampLedgerRefunded(p.supabaseUrl, p.headers, paymentId, f, now))) return retry("ledger update failed");
    if (refundId) {
      // The refund that completes the order. Its note also covers the credit that was spent on the order and is
      // about to be released, so the spend is read BEFORE the clawback below nets it to zero. Idempotent on the
      // refund id, so a retry after a later failure keeps the first (correct) amount.
      const spent = (await creditSpentOnOrders(p.supabaseUrl, p.headers, order.employer_id, [order.razorpay_order_id], f))?.get(order.razorpay_order_id) ?? 0;
      await assignCreditNote(p.supabaseUrl, p.headers, order.razorpay_order_id, refundId, (refundAmount > 0 ? refundAmount : order.amount) + Math.max(0, spent), f);
    }
    // Cash went back to the card, so credit minted from it (candidate-decline refunds, a late-payment
    // conversion) is reversed and credit spent on the order is returned. May leave a negative balance.
    const clawback = await clawbackOrderCredit({
      base: p.supabaseUrl, headers: p.headers, order, reason: "payment_refunded", releaseSpent: true, fetchImpl: f,
    });
    if (!clawback.ok) return retry("credit clawback failed");
    if (order.status !== "refunded") {
      const ok = await setOrderStatus(p.supabaseUrl, p.headers, order.razorpay_order_id, "created,paid,fulfilled,partial,disputed,expired,failed", "refunded", f, now);
      if (!ok) return retry("order status update failed");
    }
    slog.warn("employer unlock order refunded — candidate contacts relocked", {
      code: "unlock_order_refunded", orderId: order.razorpay_order_id, paymentId, employerId: order.employer_id, matchCount: order.match_ids.length,
    });
    return done({ received: true, unlock_refund: eventType, relocked: order.match_ids.length, creditClawedBackPaise: clawback.clawedBackPaise });
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
    let clawedBackPaise = 0;
    if (eventType === "payment.dispute.lost") {
      // The cash is gone: credit minted from this order has no money behind it. Spent credit stays
      // spent (the employer keeps the contacts, which support may still relock).
      const clawback = await clawbackOrderCredit({
        base: p.supabaseUrl, headers: p.headers, order, reason: "payment_disputed", releaseSpent: false, fetchImpl: f,
      });
      if (!clawback.ok) return retry("credit clawback failed");
      clawedBackPaise = clawback.clawedBackPaise;
    }
    slog.error(
      eventType === "payment.dispute.created"
        ? "chargeback filed on employer unlock payment — review and decide on relock manually"
        : "employer unlock dispute LOST — funds clawed back; decide on relock/suspension manually",
      { code: eventType === "payment.dispute.created" ? "unlock_dispute_created" : "unlock_dispute_lost",
        orderId: order.razorpay_order_id, paymentId, employerId: order.employer_id, amount: order.amount },
    );
    return done({ received: true, unlock_dispute: eventType, creditClawedBackPaise: clawedBackPaise });
  }

  return { handled: false };
}
