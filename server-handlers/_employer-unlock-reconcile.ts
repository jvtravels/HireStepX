/* Reconciliation sweep for employer contact-unlock orders.
 *
 * The Razorpay webhook is the primary fulfilment path and the browser verify
 * call the fast path; this sweep is the backstop for both failing (webhook not
 * delivered / handler error, buyer closed the tab). For every order still
 * 'created' or 'paid' after STALE_AFTER_MS it asks Razorpay what happened:
 *   - a captured payment exists  -> fulfillUnlockOrder() (same function as the
 *                                    webhook; safe to race with it)
 *   - nothing paid, > 24h old    -> 'expired' (frees the single-order slot and
 *                                    the daily-limit accounting)
 *   - Razorpay unreachable       -> left untouched, retried next run
 * 'paid' orders are the retry case: payment recorded but unlock writes failed.
 */

import { slog } from "./_shared";
import {
  fulfillUnlockOrder,
  findCapturedPaymentForOrder,
  ORDER_SELECT,
  type UnlockOrderRow,
} from "./_unlock-fulfillment";
import type { NotifyInput } from "./_notify";

export const STALE_AFTER_MS = 10 * 60 * 1000;
export const EXPIRE_AFTER_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_BATCH = 50;
const CONCURRENCY = 5;

export interface ReconcileSummary {
  scanned: number;
  fulfilled: number;
  partial: number;
  expired: number;
  /** Not paid yet and not old enough to expire. */
  pending: number;
  /** Fulfilment/Razorpay/db errors — retried on the next run. */
  errors: number;
  /** Orders that were already refunded/disputed or had payment mismatches. */
  skipped: number;
}

export interface ReconcileParams {
  supabaseUrl: string;
  headers: Record<string, string>;
  razorpayKeyId: string;
  razorpayKeySecret: string;
  batchSize?: number;
  fetchImpl?: typeof fetch;
  notifyImpl?: (input: NotifyInput) => Promise<void>;
  now?: () => Date;
}

type Outcome = "fulfilled" | "partial" | "expired" | "pending" | "error" | "skipped";

async function reconcileOne(order: UnlockOrderRow, p: ReconcileParams, f: typeof fetch, now: Date): Promise<Outcome> {
  const found = await findCapturedPaymentForOrder(order.razorpay_order_id, p.razorpayKeyId, p.razorpayKeySecret, f);
  if (found === "error") return "error";

  if (!found) {
    if (order.status === "paid") {
      // Marked paid but Razorpay shows no live captured payment (refunded out-of-band?). Needs a human.
      slog.error("unlock order is 'paid' but Razorpay has no captured payment", {
        code: "unlock_reconcile_paid_without_capture", orderId: order.razorpay_order_id, paymentId: order.razorpay_payment_id,
      });
      return "skipped";
    }
    if (now.getTime() - new Date(order.created_at).getTime() < EXPIRE_AFTER_MS) return "pending";
    try {
      const res = await f(
        `${p.supabaseUrl}/rest/v1/employer_unlock_orders?razorpay_order_id=eq.${encodeURIComponent(order.razorpay_order_id)}&status=eq.created`,
        {
          method: "PATCH",
          headers: { ...p.headers, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ status: "expired", updated_at: now.toISOString() }),
        },
      );
      return res.ok ? "expired" : "error";
    } catch {
      return "error";
    }
  }

  const result = await fulfillUnlockOrder({
    supabaseUrl: p.supabaseUrl, headers: p.headers, razorpayOrderId: order.razorpay_order_id, payment: found,
    fetchImpl: f, notifyImpl: p.notifyImpl, now: () => now,
  });
  switch (result.kind) {
    case "fulfilled": return "fulfilled";
    case "partial": return "partial";
    case "error": return result.code === "db_error" ? "error" : "skipped";
    default: return "skipped";
  }
}

export async function reconcileUnlockOrders(p: ReconcileParams): Promise<ReconcileSummary> {
  const f = p.fetchImpl ?? fetch;
  const now = (p.now ?? (() => new Date()))();
  const summary: ReconcileSummary = { scanned: 0, fulfilled: 0, partial: 0, expired: 0, pending: 0, errors: 0, skipped: 0 };
  const cutoff = new Date(now.getTime() - STALE_AFTER_MS).toISOString();
  const limit = Math.max(1, Math.min(p.batchSize ?? DEFAULT_BATCH, 200));

  const res = await f(
    `${p.supabaseUrl}/rest/v1/employer_unlock_orders?status=in.(created,paid)&created_at=lt.${encodeURIComponent(cutoff)}` +
      `&select=${ORDER_SELECT}&order=created_at.asc&limit=${limit}`,
    { headers: p.headers },
  );
  if (!res.ok) throw new Error(`order sweep query failed (${res.status})`);
  const orders = (await res.json().catch(() => null)) as UnlockOrderRow[] | null;
  if (!Array.isArray(orders)) throw new Error("order sweep returned a non-array body");

  summary.scanned = orders.length;
  for (let i = 0; i < orders.length; i += CONCURRENCY) {
    const outcomes = await Promise.all(
      orders.slice(i, i + CONCURRENCY).map((o) =>
        reconcileOne(o, p, f, now).catch((err): Outcome => {
          slog.error("unlock reconcile threw", { code: "unlock_reconcile_threw", orderId: o.razorpay_order_id, err: err instanceof Error ? err.message : String(err) });
          return "error";
        }),
      ),
    );
    for (const o of outcomes) {
      if (o === "error") summary.errors += 1;
      else summary[o] += 1;
    }
  }
  return summary;
}
