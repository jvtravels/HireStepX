/* Employer-side health signals for the daily health check: unlock orders that
 * took money but never completed, refunds owed, and silent crons. Pure
 * evaluators + one tolerant fetcher; all tolerate unapplied migrations. */

import { getCronHeartbeatAlerts } from "./_cron-heartbeat";
import { readAllPagesOrMissing, type RestGet } from "./_paged-fetch";

declare const process: { env: Record<string, string | undefined> };

const HOUR_MS = 3_600_000;

export interface EmployerHealthAlert {
  severity: "critical" | "warning";
  code: string;
  message: string;
  action: string;
}

export interface OpenOrderRow {
  status: string;
  created_at: string;
  razorpay_payment_id?: string | null;
  refund_due_paise?: number | null;
}

/** Pure. `orders` = orders in created/paid/failed/partial (any age). */
export function evaluateUnlockOrders(orders: readonly OpenOrderRow[], now: number): EmployerHealthAlert[] {
  const alerts: EmployerHealthAlert[] = [];
  const age = (o: OpenOrderRow) => now - new Date(o.created_at).getTime();

  // Money captured (payment id present) but the order never reached
  // fulfilled/partial/refunded: the employer paid and got nothing.
  const paidNotDone = orders.filter(
    (o) => (o.status === "created" || o.status === "failed" || o.status === "paid") && !!o.razorpay_payment_id && age(o) > HOUR_MS,
  );
  if (paidNotDone.length > 0) {
    alerts.push({
      severity: "critical",
      code: "unlock_order_stuck_paid",
      message: `${paidNotDone.length} unlock order(s) hold a captured payment but are not fulfilled after >1h.`,
      action: "Admin > Financials > Employers lists them. Run the reconcile cron manually or fulfil/refund in Razorpay.",
    });
  }

  const failedStale = orders.filter((o) => (o.status === "failed" || o.status === "paid") && !o.razorpay_payment_id && age(o) > 2 * HOUR_MS);
  if (failedStale.length > 0) {
    alerts.push({
      severity: "warning",
      code: "unlock_order_stuck",
      message: `${failedStale.length} unlock order(s) stuck in failed/paid for >2h.`,
      action: "Check the reconcile cron logs and the Razorpay dashboard for these orders.",
    });
  }

  const partial = orders.filter((o) => o.status === "partial");
  if (partial.length > 0) {
    alerts.push({
      severity: "warning",
      code: "unlock_order_partial",
      message: `${partial.length} unlock order(s) are partial: paid but only some candidates unlocked.`,
      action: "Refund or credit the unfulfilled candidates (Admin > Employers).",
    });
  }

  const due = orders.filter((o) => (o.refund_due_paise ?? 0) > 0);
  if (due.length > 0) {
    const total = due.reduce((s, o) => s + (o.refund_due_paise ?? 0), 0);
    alerts.push({
      severity: "critical",
      code: "unlock_refund_due",
      message: `${due.length} order(s) have a refund owed to employers totalling ₹${Math.round(total / 100)}.`,
      action: "Issue the refunds in Razorpay and clear refund_due_paise.",
    });
  }
  return alerts;
}

/** Pages through every open order: a refund owed or a stuck paid order past the
    first 1000 rows must still alert. Returns "missing" only when a selected column
    or the table is not migrated yet, and null on any real read failure (the caller
    turns that into a critical alert instead of silently dropping the refund signal). */
async function fetchOrders(base: string, headers: Record<string, string>, select: string): Promise<{ rows: OpenOrderRow[]; truncated: boolean } | "missing" | null> {
  const get: RestGet = (path) => fetch(`${base}/rest/v1/${path}`, { headers, signal: AbortSignal.timeout(8000) });
  try {
    return (await readAllPagesOrMissing<OpenOrderRow>(
      get,
      `employer_unlock_orders?status=in.(created,paid,failed,partial)&select=razorpay_order_id,${select}`,
      { maxRows: 10_000, keyset: "razorpay_order_id" },
    )) ?? "missing";
  } catch {
    return null;
  }
}

export async function getEmployerHealthAlerts(now = Date.now()): Promise<EmployerHealthAlert[]> {
  const base = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const alerts: EmployerHealthAlert[] = [];
  if (base && key) {
    const headers = { apikey: key, Authorization: `Bearer ${key}` };
    const base3 = "status,created_at,razorpay_payment_id";
    // refund_due_paise arrives with migration 0042; fall back without it.
    // Fall back ONLY when the column is genuinely missing; a timeout or 5xx
    // must not drop refund_due_paise and hide a refund alert.
    let orders = await fetchOrders(base, headers, `${base3},refund_due_paise`);
    if (orders === "missing") orders = await fetchOrders(base, headers, base3);
    if (orders && orders !== "missing") {
      alerts.push(...evaluateUnlockOrders(orders.rows, now));
      if (orders.truncated) {
        alerts.push({
          severity: "warning",
          code: "unlock_orders_truncated",
          message: `More than ${orders.rows.length} unlock orders are open (created/paid/failed/partial); alert counts may undercount.`,
          action: "Clear the backlog of stuck orders (run the reconcile cron) so the health check sees all of them.",
        });
      }
    } else {
      // Silence here would read as "no stuck orders, no refunds owed".
      alerts.push({
        severity: "critical",
        code: "employer_health_unreadable",
        message: "The unlock-order health check could not read employer_unlock_orders, so stuck orders and owed refunds are unchecked.",
        action: "Check Supabase status and the service-role key, then re-run /api/uptime-check.",
      });
    }
  }
  alerts.push(...(await getCronHeartbeatAlerts(now)));
  return alerts;
}
