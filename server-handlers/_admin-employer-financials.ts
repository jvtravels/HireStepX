/* Founder view of the employer pay-as-you-go business: revenue by day, order
 * health, refunds owed, credit-ledger liability and top spenders. The builder
 * is pure (rows in, summary out) so it is unit-tested; getEmployerFinancials()
 * is the thin Supabase reader behind the admin `employer-financials` action.
 *
 * Amounts are paise throughout (employer_unlock_payments.amount, order.amount
 * and the credit ledger all store paise). Days are bucketed in IST — that is
 * the calendar the founder reads revenue in. */

import { supa } from "./_admin-shared";
import { readAllPagesOrMissing, readPage, type RestGet } from "./_paged-fetch";

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
  /** True when any source failed to read: the numbers above are incomplete, not zero. */
  degraded: boolean;
  /** Which sources failed (payments / orders / credit ledger / employer names). */
  readErrors: string[];
  /** True when a source hit the row cap, so totals may undercount. */
  truncated: boolean;
  truncatedSources: string[];
}

export interface BuildInput {
  payments: PaymentRow[];
  orders: OrderRow[];
  ledger: LedgerRow[] | null;
  names: ReadonlyMap<string, string>;
  refundDueTracked: boolean;
  now: number;
  readErrors?: readonly string[];
  truncatedSources?: readonly string[];
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
  const readErrors = input.readErrors ?? [];
  const truncatedSources = input.truncatedSources ?? [];
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
    degraded: readErrors.length > 0,
    readErrors: [...readErrors],
    truncated: truncatedSources.length > 0,
    truncatedSources: [...truncatedSources],
  };
}

async function loadNames(get: RestGet, ids: readonly string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const enc = ids.map(encodeURIComponent);
  for (let i = 0; i < enc.length; i += IN_CHUNK) {
    const rows = await readPage<{ id: string; company_name: string | null }>(get, `employers?id=in.(${enc.slice(i, i + IN_CHUNK).join(",")})&select=id,company_name`);
    for (const r of rows) names.set(r.id, r.company_name || "(no name)");
  }
  return names;
}

interface Source<T> { rows: T[]; truncated: boolean; failed: boolean; missing: boolean }

/** Never throws: a real read failure is reported as `failed` (the dashboard shows a
    warning) and a not-yet-migrated table as `missing`; both yield no rows. */
async function loadSource<T>(read: () => Promise<{ rows: T[]; truncated: boolean } | null>): Promise<Source<T>> {
  try {
    const r = await read();
    return r ? { ...r, failed: false, missing: false } : { rows: [], truncated: false, failed: false, missing: true };
  } catch {
    return { rows: [], truncated: false, failed: true, missing: false };
  }
}

export async function getEmployerFinancials(get: RestGet = supa): Promise<EmployerFinancials> {
  const now = Date.now();
  const orderCols = "razorpay_order_id,employer_id,status,amount,created_at,razorpay_payment_id";
  // Unique tiebreaker so offset paging is stable when rows share a created_at.
  const orderPath = (cols: string) => `employer_unlock_orders?select=${cols}&order=created_at.desc,razorpay_order_id.desc`;
  const payPath = (cols: string) => `employer_unlock_payments?select=${cols}&order=created_at.desc,id.desc`;

  let refundColumn = false;
  const [payments, orders, ledger] = await Promise.all([
    // Fall back to the pre-refunded_at column set (missing schema only, never a real failure).
    loadSource<PaymentRow>(async () =>
      (await readAllPagesOrMissing<PaymentRow>(get, payPath("employer_id,amount,created_at,refunded_at")))
      ?? (await readAllPagesOrMissing<PaymentRow>(get, payPath("employer_id,amount,created_at")))),
    // refund_due_paise arrives with migration 0042.
    loadSource<OrderRow>(async () => {
      const full = await readAllPagesOrMissing<OrderRow>(get, orderPath(`${orderCols},refund_due_paise`));
      if (full) { refundColumn = true; return full; }
      return readAllPagesOrMissing<OrderRow>(get, orderPath(orderCols));
    }),
    loadSource<LedgerRow>(() => readAllPagesOrMissing<LedgerRow>(get, "employer_credit_ledger?select=employer_id,amount,kind&order=id.asc")),
  ]);

  const readErrors: string[] = [];
  const truncatedSources: string[] = [];
  for (const [name, src] of [["payments", payments], ["orders", orders], ["credit ledger", ledger]] as const) {
    if (src.failed) readErrors.push(name);
    if (src.truncated) truncatedSources.push(name);
  }

  const topIds = rankTopEmployers(payments.rows.filter((p) => (p.amount ?? 0) > 0), new Map()).map((t) => t.employerId);
  let names = new Map<string, string>();
  try {
    names = await loadNames(get, topIds);
  } catch {
    readErrors.push("employer names");
  }

  // Tracked = the refund column exists. After a failed read it is unknowable, so
  // report true and let the degraded warning speak instead of "not migrated".
  const refundDueTracked = orders.failed || refundColumn;
  return buildEmployerFinancials({
    payments: payments.rows,
    orders: orders.rows,
    ledger: ledger.missing || ledger.failed ? null : ledger.rows,
    names,
    refundDueTracked,
    now,
    readErrors,
    truncatedSources,
  });
}
