/* Employer-side health signals for the daily health check: unlock orders that
 * took money but never completed, refunds owed, and silent crons. Pure
 * evaluators + one tolerant fetcher; all tolerate unapplied migrations. */

import { getCronHeartbeatAlerts } from "./_cron-heartbeat";

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

async function fetchOrders(base: string, headers: Record<string, string>, select: string): Promise<OpenOrderRow[] | null> {
  try {
    const res = await fetch(
      `${base}/rest/v1/employer_unlock_orders?status=in.(created,paid,failed,partial)&select=${select}&order=created_at.desc&limit=2000`,
      { headers, signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) ? (rows as OpenOrderRow[]) : null;
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
    const orders = (await fetchOrders(base, headers, `${base3},refund_due_paise`)) ?? (await fetchOrders(base, headers, base3));
    if (orders) alerts.push(...evaluateUnlockOrders(orders, now));
  }
  alerts.push(...(await getCronHeartbeatAlerts(now)));
  return alerts;
}
