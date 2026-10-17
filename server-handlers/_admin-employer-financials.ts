/* Founder view of the employer pay-as-you-go business: revenue by day, order
 * health, refunds owed, credit-ledger liability and top spenders. The builder
 * is pure (rows in, summary out) so it is unit-tested; getEmployerFinancials()
 * is the thin Supabase reader behind the admin `employer-financials` action.
 *
 * Amounts are paise throughout (employer_unlock_payments.amount, order.amount
 * and the credit ledger all store paise). Days are bucketed in IST — that is
 * the calendar the founder reads revenue in. */

import { fetchJSON, supa } from "./_admin-shared";

const IST_OFFSET_MS = 330 * 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const STUCK_AFTER_MS = HOUR_MS;
const IN_CHUNK = 80;
const TOP_N = 10;
const LIST_CAP = 20;

export interface PaymentRow {
  employer_id: string;
  amount: number | null;
  created_at: string;
  refunded_at?: string | null;
}

export interface OrderRow {
  razorpay_order_id: string;
  employer_id: string;
  status: string;
  amount: number | null;
  created_at: string;
  razorpay_payment_id?: string | null;
  /** Added by migration 0042; absent until applied. */
  refund_due_paise?: number | null;
}

export interface LedgerRow {
  employer_id: string;
  amount: number;
  kind: string;
}

export interface DayRevenue { date: string; paise: number; count: number }
export interface StuckOrder { orderId: string; employerId: string; status: string; amountPaise: number; ageHours: number; hasPayment: boolean }
export interface RefundDueOrder { orderId: string; employerId: string; status: string; refundDuePaise: number }
export interface TopEmployer { employerId: string; companyName: string; spendPaise: number; payments: number }

export interface EmployerFinancials {
  generatedAt: string;
  revenue: { lifetimePaise: number; last30dPaise: number; refundedPaise: number; paymentCount: number; byDay: DayRevenue[] };
  orders: { total: number; byStatus: Record<string, number> };
  stuckOrders: { count: number; rows: StuckOrder[] };
  refundDue: { count: number; totalPaise: number; rows: RefundDueOrder[]; tracked: boolean };
  credit: { grantedPaise: number; spentPaise: number; outstandingPaise: number; ledgerAvailable: boolean };
  topEmployers: TopEmployer[];
}

export interface BuildInput {
  payments: PaymentRow[];
  orders: OrderRow[];
  ledger: LedgerRow[] | null;
  names: ReadonlyMap<string, string>;
  refundDueTracked: boolean;
  now: number;
}

export function istDate(ms: number): string {
  return new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export function buildDailyRevenue(payments: readonly PaymentRow[], now: number, days = 30): DayRevenue[] {
  const buckets = new Map<string, DayRevenue>();
  for (let i = days - 1; i >= 0; i--) {
    const date = istDate(now - i * DAY_MS);
    buckets.set(date, { date, paise: 0, count: 0 });
  }
  for (const p of payments) {
    const amount = p.amount ?? 0;
    if (amount <= 0) continue;
    const b = buckets.get(istDate(new Date(p.created_at).getTime()));
    if (!b) continue;
    b.paise += amount;
    b.count += 1;
  }
  return [...buckets.values()];
}

export function findStuckOrders(orders: readonly OrderRow[], now: number): StuckOrder[] {
  const stuck: StuckOrder[] = [];
  for (const o of orders) {
    // 'paid' is included: money captured but fulfilment never completed.
    if (o.status !== "created" && o.status !== "failed" && o.status !== "paid") continue;
    const age = now - new Date(o.created_at).getTime();
    if (!(age > STUCK_AFTER_MS)) continue;
    stuck.push({
      orderId: o.razorpay_order_id,
      employerId: o.employer_id,
      status: o.status,
      amountPaise: o.amount ?? 0,
      ageHours: Math.floor(age / HOUR_MS),
      hasPayment: !!o.razorpay_payment_id,
    });
  }
  // Orders holding a captured payment first, then oldest.
  return stuck.sort((a, b) => Number(b.hasPayment) - Number(a.hasPayment) || b.ageHours - a.ageHours);
}

export function findRefundDue(orders: readonly OrderRow[]): RefundDueOrder[] {
  return orders
    .filter((o) => (o.refund_due_paise ?? 0) > 0)
    .map((o) => ({ orderId: o.razorpay_order_id, employerId: o.employer_id, status: o.status, refundDuePaise: o.refund_due_paise ?? 0 }));
}

export function summarizeLedger(ledger: readonly LedgerRow[]): { grantedPaise: number; spentPaise: number; outstandingPaise: number } {
  let granted = 0;
  let spent = 0;
  for (const r of ledger) {
    if (r.amount > 0) granted += r.amount;
    else spent += -r.amount;
  }
  return { grantedPaise: granted, spentPaise: spent, outstandingPaise: granted - spent };
}

export function rankTopEmployers(payments: readonly PaymentRow[], names: ReadonlyMap<string, string>, limit = TOP_N): TopEmployer[] {
  const by = new Map<string, { spend: number; payments: number }>();
  for (const p of payments) {
    const amount = p.amount ?? 0;
    if (amount <= 0 || p.refunded_at) continue;
    const cur = by.get(p.employer_id) ?? { spend: 0, payments: 0 };
    cur.spend += amount;
    cur.payments += 1;
    by.set(p.employer_id, cur);
  }
  return [...by.entries()]
    .map(([employerId, v]) => ({ employerId, companyName: names.get(employerId) ?? "(unknown)", spendPaise: v.spend, payments: v.payments }))
    .sort((a, b) => b.spendPaise - a.spendPaise)
    .slice(0, limit);
}

export function buildEmployerFinancials(input: BuildInput): EmployerFinancials {
  const { payments, orders, ledger, names, refundDueTracked, now } = input;
  const paid = payments.filter((p) => (p.amount ?? 0) > 0);
  const cutoff = now - 30 * DAY_MS;

  const byStatus: Record<string, number> = {};
  for (const o of orders) byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;

  const stuck = findStuckOrders(orders, now);
  const due = findRefundDue(orders);
  const ledgerTotals = summarizeLedger(ledger ?? []);

  return {
    generatedAt: new Date(now).toISOString(),
    revenue: {
      lifetimePaise: paid.reduce((s, p) => s + (p.amount ?? 0), 0),
      last30dPaise: paid.filter((p) => new Date(p.created_at).getTime() >= cutoff).reduce((s, p) => s + (p.amount ?? 0), 0),
      refundedPaise: paid.filter((p) => p.refunded_at).reduce((s, p) => s + (p.amount ?? 0), 0),
      paymentCount: paid.length,
      byDay: buildDailyRevenue(paid, now),
    },
    orders: { total: orders.length, byStatus },
    stuckOrders: { count: stuck.length, rows: stuck.slice(0, LIST_CAP) },
    refundDue: { count: due.length, totalPaise: due.reduce((s, o) => s + o.refundDuePaise, 0), rows: due.slice(0, LIST_CAP), tracked: refundDueTracked },
    credit: { ...ledgerTotals, ledgerAvailable: ledger !== null },
    topEmployers: rankTopEmployers(paid, names),
  };
}

/** Tolerant reader: null when the table/columns are not migrated yet. */
async function tryRows<T>(path: string): Promise<T[] | null> {
  try {
    const res = await supa(path);
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) ? (data as T[]) : null;
  } catch {
    return null;
  }
}

async function loadNames(ids: readonly string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const enc = ids.map(encodeURIComponent);
  for (let i = 0; i < enc.length; i += IN_CHUNK) {
    const rows = await fetchJSON<{ id: string; company_name: string | null }>(`employers?id=in.(${enc.slice(i, i + IN_CHUNK).join(",")})&select=id,company_name`);
    for (const r of rows) names.set(r.id, r.company_name || "(no name)");
  }
  return names;
}

export async function getEmployerFinancials(): Promise<EmployerFinancials> {
  const now = Date.now();
  const orderCols = "razorpay_order_id,employer_id,status,amount,created_at,razorpay_payment_id";
  const orderPath = (cols: string) => `employer_unlock_orders?select=${cols}&order=created_at.desc&limit=10000`;
  const payPath = (cols: string) => `employer_unlock_payments?select=${cols}&order=created_at.desc&limit=10000`;

  const [paymentsFull, ordersFull, ledger] = await Promise.all([
    tryRows<PaymentRow>(payPath("employer_id,amount,created_at,refunded_at")),
    tryRows<OrderRow>(orderPath(`${orderCols},refund_due_paise`)),
    tryRows<LedgerRow>("employer_credit_ledger?select=employer_id,amount,kind&limit=50000"),
  ]);
  // Fall back to the pre-0042 / pre-refunded_at column sets.
  const payments = paymentsFull ?? (await tryRows<PaymentRow>(payPath("employer_id,amount,created_at"))) ?? [];
  const orders = ordersFull ?? (await tryRows<OrderRow>(orderPath(orderCols))) ?? [];

  const topIds = rankTopEmployers(payments.filter((p) => (p.amount ?? 0) > 0), new Map()).map((t) => t.employerId);
  const names = await loadNames(topIds);
  return buildEmployerFinancials({ payments, orders, ledger, names, refundDueTracked: ordersFull !== null, now });
}
