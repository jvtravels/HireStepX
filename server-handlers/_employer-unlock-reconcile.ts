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
 * A second pass releases credit still held by recently 'failed' or 'expired' orders (a
 * release that failed at the time must not leave the employer's credit stuck).
 * Recently 'expired'/'failed' orders are also checked against Razorpay: a payment
 * captured after the order lapsed (the expiry race) is fulfilled or converted to
 * credit instead of being stranded. A last pass numbers fulfilled cash orders whose
 * invoice number assignment failed at the time (invoice back-fill).
 */

import { slog } from "./_shared";
import {
  assignCreditNote,
  assignInvoiceNo,
  fetchRazorpayRefunds,
  fulfillUnlockOrder,
  findCapturedPaymentForOrder,
  returnPartialOrderCredit,
  writeInvoiceSnapshot,
  ORDER_SELECT,
  type UnlockOrderRow,
} from "./_unlock-fulfillment";
import { releaseCredit, creditSpentOnOrders, creditReturnedOnOrder, loadOrderCreditApplied } from "./_employer-credit";
import { creditNoteAmountForCashRefund } from "./_unlock-ownership";
import { captureServerEvent } from "./_posthog";
import { isCreditOrderRef, settleCreditOrder } from "./_employer-credit-unlock";
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
  /** Failed/expired orders whose held credit was (re)released by the second pass. */
  creditSwept?: number;
  /** 'paid' orders for which Razorpay shows no live captured payment (needs a human; not an error). */
  paidWithoutCapture?: number;
  /** Fulfilled cash orders that got their missing invoice number this run. */
  invoicesBackfilled?: number;
  /** Back-fill attempts that failed (also counted in `errors`). */
  invoiceBackfillErrors?: number;
  /** Partial orders whose unreturned credit for undelivered matches was returned this run. */
  partialSwept?: number;
  /** Refunds that got their missing credit note this run. */
  creditNotesBackfilled?: number;
  /** Credit-note back-fill attempts that failed (also counted in `errors`). */
  creditNoteBackfillErrors?: number;
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

type Outcome = "fulfilled" | "partial" | "expired" | "pending" | "error" | "skipped" | "paid_without_capture" | "unchanged";

/** Credit-only orders have no Razorpay order: the credit ledger says whether
 *  the employer actually paid. Spent -> finish the unlock; never spent -> the
 *  request died before charging, so close it. */
async function reconcileCreditOrder(order: UnlockOrderRow, p: ReconcileParams, f: typeof fetch, now: Date): Promise<Outcome> {
  const settled = await settleCreditOrder({
    supabaseUrl: p.supabaseUrl, headers: p.headers, order, fetchImpl: f, notifyImpl: p.notifyImpl, now: () => now,
  });
  switch (settled.kind) {
    case "fulfilled": return "fulfilled";
    case "partial": return "partial";
    case "ledger_unavailable": return "error";
    case "no_credit": {
      try {
        const res = await f(
          `${p.supabaseUrl}/rest/v1/employer_unlock_orders?razorpay_order_id=eq.${encodeURIComponent(order.razorpay_order_id)}&status=eq.created`,
          {
            method: "PATCH",
            headers: { ...p.headers, "Content-Type": "application/json", Prefer: "return=minimal" },
            body: JSON.stringify({ status: "failed", updated_at: now.toISOString() }),
          },
        );
        if (res.ok) {
          void captureServerEvent("employer_unlock_abandoned", order.employer_id, {
            requirementId: order.requirement_id, orderId: order.razorpay_order_id, amountPaise: 0, mode: order.mode, creditOnly: true,
          });
        }
        return res.ok ? "expired" : "error";
      } catch {
        return "error";
      }
    }
    case "error": return settled.code === "db_error" ? "error" : "skipped";
    default: return "skipped";
  }
}

async function reconcileOne(order: UnlockOrderRow, p: ReconcileParams, f: typeof fetch, now: Date): Promise<Outcome> {
  if (isCreditOrderRef(order.razorpay_order_id)) {
    // Credit-only orders have no Razorpay payment to arrive late; only live ones are settled.
    return order.status === "created" || order.status === "paid" ? reconcileCreditOrder(order, p, f, now) : "unchanged";
  }
  const found = await findCapturedPaymentForOrder(order.razorpay_order_id, p.razorpayKeyId, p.razorpayKeySecret, f);
  if (found === "error") return "error";

  if (!found) {
    if (order.status === "paid") {
      // Marked paid but Razorpay shows no live captured payment (refunded out-of-band?). Needs a human, but it is a
      // standing condition rather than a fresh failure: a counted warning, not an error that pages every run.
      slog.warn("unlock order is 'paid' but Razorpay has no captured payment", {
        code: "unlock_reconcile_paid_without_capture", orderId: order.razorpay_order_id, paymentId: order.razorpay_payment_id,
      });
      return "paid_without_capture";
    }
    // Already expired/failed (late-capture check): nothing paid, nothing to do.
    if (order.status !== "created") return "unchanged";
    if (now.getTime() - new Date(order.created_at).getTime() < EXPIRE_AFTER_MS) return "pending";
    try {
      // return=representation: only the call whose CAS really moved the row releases the credit. A payment that
      // fulfilled the order between our Razorpay read and this PATCH leaves it 'paid'/'fulfilled', and releasing
      // the credit then would hand back credit the order consumed.
      const res = await f(
        `${p.supabaseUrl}/rest/v1/employer_unlock_orders?razorpay_order_id=eq.${encodeURIComponent(order.razorpay_order_id)}&status=eq.created`,
        {
          method: "PATCH",
          headers: { ...p.headers, "Content-Type": "application/json", Prefer: "return=representation" },
          body: JSON.stringify({ status: "expired", updated_at: now.toISOString() }),
        },
      );
      if (!res.ok) return "error";
      const moved: unknown = await res.json().catch(() => null);
      if (!Array.isArray(moved)) return "error";
      if (moved.length === 0) return "pending"; // lost the race to a payment; the next run reads the real state
      const released = await releaseCredit(p.supabaseUrl, p.headers, order.employer_id, order.razorpay_order_id, f);
      void captureServerEvent("employer_unlock_abandoned", order.employer_id, {
        requirementId: order.requirement_id, orderId: order.razorpay_order_id, amountPaise: order.amount, mode: order.mode,
      });
      // The order is already 'expired', so the credit sweep (which covers expired orders) retries a failed release.
      return released ? "expired" : "error";
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

async function sweepQuery(
  p: ReconcileParams, f: typeof fetch, cutoff: string, order: string, limit: number, statuses = "created,paid",
): Promise<UnlockOrderRow[]> {
  const res = await f(
    `${p.supabaseUrl}/rest/v1/employer_unlock_orders?status=in.(${statuses})&created_at=lt.${encodeURIComponent(cutoff)}` +
      `&select=${ORDER_SELECT}&order=${order}&limit=${limit}`,
    { headers: p.headers },
  );
  if (!res.ok) throw new Error(`order sweep query failed (${res.status})`);
  const rows = (await res.json().catch(() => null)) as UnlockOrderRow[] | null;
  if (!Array.isArray(rows)) throw new Error("order sweep returned a non-array body");
  return rows;
}

export async function reconcileUnlockOrders(p: ReconcileParams): Promise<ReconcileSummary> {
  const f = p.fetchImpl ?? fetch;
  const now = (p.now ?? (() => new Date()))();
  const summary: ReconcileSummary = { scanned: 0, fulfilled: 0, partial: 0, expired: 0, pending: 0, errors: 0, skipped: 0 };
  const cutoff = new Date(now.getTime() - STALE_AFTER_MS).toISOString();
  const limit = Math.max(1, Math.min(p.batchSize ?? DEFAULT_BATCH, 200));

  // Oldest-first alone starves new orders behind a backlog of orders that keep erroring
  // (they stay 'created'/'paid' and are always first in line). Take the oldest slice for
  // the backlog and the newest slice so a fresh paid-but-unfulfilled order is always reached.
  const newestCount = limit >= 5 ? Math.max(1, Math.floor(limit / 5)) : 0;
  const oldest = await sweepQuery(p, f, cutoff, "created_at.asc", limit - newestCount);
  const newest = newestCount > 0 ? await sweepQuery(p, f, cutoff, "created_at.desc", newestCount) : [];
  // Orders that lapsed ('expired'/'failed') in the last week whose payment may still have been captured.
  const lateCutoff = new Date(now.getTime() - LATE_CAPTURE_DAYS * 86_400_000).toISOString();
  const lapsed = await sweepClosedQuery(p, f, lateCutoff, LATE_CAPTURE_LIMIT);
  const seen = new Set<string>();
  const orders: UnlockOrderRow[] = [];
  for (const o of [...oldest, ...newest, ...lapsed]) {
    if (seen.has(o.razorpay_order_id)) continue;
    seen.add(o.razorpay_order_id);
    orders.push(o);
  }

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
      else if (o === "paid_without_capture") summary.paidWithoutCapture = (summary.paidWithoutCapture ?? 0) + 1;
      else if (o !== "unchanged") summary[o] += 1;
    }
  }

  summary.creditSwept = await sweepFailedOrderCredit(p, f, now);
  const backfill = await backfillMissingInvoices(p, f, now);
  summary.invoicesBackfilled = backfill.filled;
  summary.invoiceBackfillErrors = backfill.errors;
  summary.errors += backfill.errors;
  const notes = await backfillMissingCreditNotes(p, f, now);
  summary.creditNotesBackfilled = notes.filled;
  summary.creditNoteBackfillErrors = notes.errors;
  summary.errors += notes.errors;
  const partial = await sweepPartialOrderCredit(p, f, now);
  summary.partialSwept = partial.swept;
  summary.errors += partial.errors;
  return summary;
}

const CREDIT_NOTE_BACKFILL_DAYS = 30;
const CREDIT_NOTE_BACKFILL_LIMIT = 40;

/** Credit notes are best effort at refund time (the webhook answers 200 once the order is closed), so a failed
 *  assignment would otherwise never be retried. This pass lists recently refunded or partially refunded payments,
 *  asks Razorpay for their refunds and numbers any refund that has no credit note, with the same amount rules the
 *  webhook uses. Idempotent per refund id. A full refund's last note also covers the credit that was spent on the
 *  order (the order's stored credit_applied_paise stands in for the spend the webhook read before releasing it). */
async function backfillMissingCreditNotes(p: ReconcileParams, f: typeof fetch, now: Date): Promise<{ filled: number; errors: number }> {
  const out = { filled: 0, errors: 0 };
  try {
    const since = encodeURIComponent(new Date(now.getTime() - CREDIT_NOTE_BACKFILL_DAYS * 86_400_000).toISOString());
    const res = await f(
      `${p.supabaseUrl}/rest/v1/employer_unlock_payments?or=(refunded_at.gte.${since},partial_refund_at.gte.${since})&amount=gt.0` +
        `&select=razorpay_payment_id,razorpay_order_id,employer_id,amount,refunded_at&order=created_at.desc&limit=${CREDIT_NOTE_BACKFILL_LIMIT}`,
      { headers: p.headers },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 400 && /PGRST204|42703|column/i.test(text)) return out; // migration 0045 unapplied
      out.errors += 1;
      return out;
    }
    const rows = (await res.json().catch(() => null)) as Array<{
      razorpay_payment_id: string; razorpay_order_id: string | null; employer_id: string; amount: number; refunded_at: string | null;
    }> | null;
    if (!Array.isArray(rows) || rows.length === 0) return out;

    for (const r of rows) {
      if (!r.razorpay_order_id || r.razorpay_payment_id.startsWith("credit_pay_")) continue;
      const notesRes = await f(
        `${p.supabaseUrl}/rest/v1/employer_credit_notes?order_id=eq.${encodeURIComponent(r.razorpay_order_id)}&select=refund_id`,
        { headers: p.headers },
      );
      if (!notesRes.ok) {
        // Migration 0047 unapplied: nothing to back-fill into.
        if (notesRes.status !== 404) out.errors += 1;
        continue;
      }
      const have = (await notesRes.json().catch(() => null)) as Array<{ refund_id: string }> | null;
      if (!Array.isArray(have)) { out.errors += 1; continue; }
      const noted = new Set(have.map((h) => h.refund_id));

      const refunds = await fetchRazorpayRefunds(r.razorpay_payment_id, p.razorpayKeyId, p.razorpayKeySecret, f);
      if (!refunds) { out.errors += 1; continue; }
      const missing = refunds.filter((x) => !noted.has(x.id));
      if (missing.length === 0) continue;

      const spent = (await loadOrderCreditApplied(p.supabaseUrl, p.headers, r.razorpay_order_id, f)) ?? 0;
      const returned = await creditReturnedOnOrder(p.supabaseUrl, p.headers, r.razorpay_order_id, f);
      if (returned === null) { out.errors += 1; continue; }

      let before = 0;
      for (let i = 0; i < refunds.length; i++) {
        const refund = refunds[i];
        const wasBefore = before;
        before += refund.amount;
        if (noted.has(refund.id)) continue;
        const completesOrder = !!r.refunded_at && i === refunds.length - 1;
        const amount = creditNoteAmountForCashRefund({
          refundPaise: refund.amount + (completesOrder ? spent : 0), cashPaise: r.amount, creditSpentPaise: spent,
          cashRefundedBeforePaise: wasBefore, creditReturnedPaise: returned,
        });
        if (amount <= 0) continue;
        const note = await assignCreditNote(p.supabaseUrl, p.headers, r.razorpay_order_id, refund.id, amount, f);
        if (note) {
          out.filled += 1;
          slog.warn("back-filled a missing credit note", { code: "unlock_credit_note_backfilled", orderId: r.razorpay_order_id, refundId: refund.id });
        } else {
          out.errors += 1;
        }
      }
    }
  } catch (err) {
    out.errors += 1;
    slog.error("credit note back-fill sweep threw", { code: "unlock_credit_note_backfill_threw", err: err instanceof Error ? err.message : String(err) });
  }
  return out;
}

const PARTIAL_SWEEP_DAYS = 14;

/** A 'partial' order delivered some matches and owes credit for the rest. Fulfilment returns that credit right
 *  after closing the order, and a replay retries it, but if that call died and no replay came the credit would
 *  stay missing. This pass re-asks for every match of a recent partial order that is still locked; the ledger's
 *  unique (match, order) refund row makes it a no-op for anything already returned. */
async function sweepPartialOrderCredit(p: ReconcileParams, f: typeof fetch, now: Date): Promise<{ swept: number; errors: number }> {
  const out = { swept: 0, errors: 0 };
  try {
    const since = encodeURIComponent(new Date(now.getTime() - PARTIAL_SWEEP_DAYS * 86_400_000).toISOString());
    const res = await f(
      `${p.supabaseUrl}/rest/v1/employer_unlock_orders?status=eq.partial&updated_at=gte.${since}&select=${ORDER_SELECT}&order=updated_at.desc&limit=50`,
      { headers: p.headers },
    );
    if (!res.ok) { out.errors += 1; return out; }
    const orders = (await res.json().catch(() => null)) as UnlockOrderRow[] | null;
    if (!Array.isArray(orders)) { out.errors += 1; return out; }
    for (const order of orders) {
      if (order.match_ids.length === 0) continue;
      const mRes = await f(
        `${p.supabaseUrl}/rest/v1/requirement_matches?id=in.(${order.match_ids.map(encodeURIComponent).join(",")})&unlocked=eq.false&select=id`,
        { headers: p.headers },
      );
      if (!mRes.ok) { out.errors += 1; continue; }
      const locked = (await mRes.json().catch(() => null)) as Array<{ id: string }> | null;
      if (!Array.isArray(locked)) { out.errors += 1; continue; }
      if (locked.length === 0) continue;
      const back = await returnPartialOrderCredit({
        supabaseUrl: p.supabaseUrl, headers: p.headers, order, failedMatchIds: locked.map((m) => m.id), fetchImpl: f,
      });
      if (!back.ok) out.errors += 1;
      else if (back.returnedPaise > 0) out.swept += 1;
    }
  } catch (err) {
    out.errors += 1;
    slog.error("partial-order credit sweep threw", { code: "unlock_partial_credit_sweep_threw", err: err instanceof Error ? err.message : String(err) });
  }
  return out;
}

const LATE_CAPTURE_DAYS = 7;
const LATE_CAPTURE_LIMIT = 25;

/** Recently expired/failed orders, newest first. These are re-checked against Razorpay because a payment can be
 *  captured after the order lapsed; fulfilment then re-spends released credit or converts the cash to credit. */
async function sweepClosedQuery(p: ReconcileParams, f: typeof fetch, since: string, limit: number): Promise<UnlockOrderRow[]> {
  try {
    const res = await f(
      `${p.supabaseUrl}/rest/v1/employer_unlock_orders?status=in.(expired,failed)&updated_at=gte.${encodeURIComponent(since)}` +
        `&select=${ORDER_SELECT}&order=updated_at.desc&limit=${limit}`,
      { headers: p.headers },
    );
    if (!res.ok) return [];
    const rows = (await res.json().catch(() => null)) as UnlockOrderRow[] | null;
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

const BACKFILL_DAYS = 14;
const BACKFILL_LIMIT = 50;

/** Numbers fulfilled/partial cash and credit-only orders whose ledger row has no invoice_no (the assignment RPC failed when the order
 *  closed). A cash order that unlocked nobody legitimately has no invoice and is skipped. Soft-fails to
 *  nothing when the invoice columns are missing (migration 0032/0045 unapplied). */
async function backfillMissingInvoices(p: ReconcileParams, f: typeof fetch, now: Date): Promise<{ filled: number; errors: number }> {
  const out = { filled: 0, errors: 0 };
  try {
    const since = new Date(now.getTime() - BACKFILL_DAYS * 86_400_000).toISOString();
    const res = await f(
      `${p.supabaseUrl}/rest/v1/employer_unlock_payments?invoice_no=is.null&or=(amount.gt.0,razorpay_payment_id.like.credit_pay_*)&refunded_at=is.null` +
        `&created_at=gte.${encodeURIComponent(since)}&select=razorpay_payment_id,razorpay_order_id,employer_id&order=created_at.desc&limit=${BACKFILL_LIMIT}`,
      { headers: p.headers },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 400 && /PGRST204|42703|column/i.test(text)) return out;
      out.errors += 1;
      return out;
    }
    const rows = (await res.json().catch(() => null)) as Array<{ razorpay_payment_id: string; razorpay_order_id: string | null; employer_id: string }> | null;
    if (!Array.isArray(rows) || rows.length === 0) return out;

    const orderIds = Array.from(new Set(rows.map((r) => r.razorpay_order_id).filter((v): v is string => !!v)));
    if (orderIds.length === 0) return out;
    const ordRes = await f(
      `${p.supabaseUrl}/rest/v1/employer_unlock_orders?razorpay_order_id=in.(${orderIds.map(encodeURIComponent).join(",")})` +
        `&status=in.(fulfilled,partial)&select=${ORDER_SELECT}`,
      { headers: p.headers },
    );
    if (!ordRes.ok) { out.errors += 1; return out; }
    const orders = (await ordRes.json().catch(() => null)) as UnlockOrderRow[] | null;
    if (!Array.isArray(orders)) { out.errors += 1; return out; }
    const orderById = new Map(orders.map((o) => [o.razorpay_order_id, o]));

    const allMatchIds = Array.from(new Set(orders.flatMap((o) => o.match_ids)));
    const unlocked = new Set<string>();
    if (allMatchIds.length > 0) {
      const mRes = await f(
        `${p.supabaseUrl}/rest/v1/requirement_matches?id=in.(${allMatchIds.map(encodeURIComponent).join(",")})&unlocked=eq.true&select=id`,
        { headers: p.headers },
      );
      if (!mRes.ok) { out.errors += 1; return out; }
      const mRows = (await mRes.json().catch(() => null)) as Array<{ id: string }> | null;
      if (!Array.isArray(mRows)) { out.errors += 1; return out; }
      for (const m of mRows) unlocked.add(m.id);
    }

    for (const r of rows) {
      const order = r.razorpay_order_id ? orderById.get(r.razorpay_order_id) : undefined;
      if (!order || !order.match_ids.some((id) => unlocked.has(id))) continue;
      const no = await assignInvoiceNo(p.supabaseUrl, p.headers, r.razorpay_payment_id, f);
      if (!no) { out.errors += 1; continue; }
      out.filled += 1;
      const spent = await creditSpentOnOrders(p.supabaseUrl, p.headers, order.employer_id, [order.razorpay_order_id], f);
      if (spent) {
        await writeInvoiceSnapshot({
          supabaseUrl: p.supabaseUrl, headers: p.headers, order, paymentId: r.razorpay_payment_id,
          creditPaise: spent.get(order.razorpay_order_id) ?? 0, now, f,
        });
      }
      slog.warn("back-filled a missing unlock invoice number", { code: "unlock_invoice_backfilled", orderId: order.razorpay_order_id, invoiceNo: no });
    }
  } catch (err) {
    out.errors += 1;
    slog.error("invoice back-fill sweep threw", { code: "unlock_invoice_backfill_threw", err: err instanceof Error ? err.message : String(err) });
  }
  return out;
}

const FAILED_SWEEP_DAYS = 7;

/** Releases credit still attached to recently failed or expired orders. releaseCredit is
 *  idempotent (nets the ledger), so re-running it on an already-released order
 *  writes nothing. Expired orders leave a late re-spend alone (see releaseCredit).
 *  Never throws into the main sweep. */
async function sweepFailedOrderCredit(p: ReconcileParams, f: typeof fetch, now: Date): Promise<number> {
  try {
    const since = new Date(now.getTime() - FAILED_SWEEP_DAYS * 86_400_000).toISOString();
    const res = await f(
      `${p.supabaseUrl}/rest/v1/employer_unlock_orders?status=in.(failed,expired)&updated_at=gte.${encodeURIComponent(since)}` +
        `&select=razorpay_order_id,employer_id,status&order=updated_at.desc&limit=100`,
      { headers: p.headers },
    );
    if (!res.ok) return 0;
    const rows = (await res.json().catch(() => null)) as Array<{ razorpay_order_id: string; employer_id: string; status?: string }> | null;
    if (!Array.isArray(rows)) return 0;
    for (const r of rows) {
      await releaseCredit(p.supabaseUrl, p.headers, r.employer_id, r.razorpay_order_id, f, { includeLate: r.status !== "expired" });
    }
    return rows.length;
  } catch (err) {
    slog.error("failed-order credit sweep threw", { code: "unlock_failed_credit_sweep", err: err instanceof Error ? err.message : String(err) });
    return 0;
  }
}
