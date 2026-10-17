import { describe, it, expect } from "vitest";
import {
  buildDailyRevenue, findStuckOrders, findRefundDue, summarizeLedger, rankTopEmployers, buildEmployerFinancials, istDate,
  type OrderRow, type PaymentRow,
} from "../../server-handlers/_admin-employer-financials";

// 2026-10-17T10:00:00Z = 15:30 IST
const NOW = Date.UTC(2026, 9, 17, 10, 0, 0);
const HOUR = 3_600_000;
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();

const order = (o: Partial<OrderRow>): OrderRow => ({ razorpay_order_id: "o1", employer_id: "e1", status: "created", amount: 5_900, created_at: iso(3 * HOUR), ...o });

describe("buildDailyRevenue", () => {
  it("returns 30 zero-filled IST days ending today and buckets payments", () => {
    const days = buildDailyRevenue([
      { employer_id: "e1", amount: 5_900, created_at: iso(HOUR) },
      { employer_id: "e2", amount: 2_000, created_at: iso(2 * HOUR) },
      { employer_id: "e1", amount: 0, created_at: iso(HOUR) },
    ], NOW);
    expect(days).toHaveLength(30);
    expect(days[29].date).toBe(istDate(NOW));
    expect(days[29]).toMatchObject({ paise: 7_900, count: 2 });
    expect(days[0].paise).toBe(0);
  });

  it("puts a payment made after 18:30 UTC on the next IST day", () => {
    const late = Date.UTC(2026, 9, 16, 20, 0, 0); // 01:30 IST on the 17th
    expect(istDate(late)).toBe("2026-10-17");
    const days = buildDailyRevenue([{ employer_id: "e1", amount: 100, created_at: new Date(late).toISOString() }], NOW);
    expect(days[29].paise).toBe(100);
  });

  it("ignores payments older than the window", () => {
    const days = buildDailyRevenue([{ employer_id: "e1", amount: 100, created_at: iso(40 * 24 * HOUR) }], NOW);
    expect(days.reduce((s, d) => s + d.paise, 0)).toBe(0);
  });
});

describe("findStuckOrders", () => {
  it("flags created/failed/paid orders older than 1h and lists captured-payment orders first", () => {
    const stuck = findStuckOrders([
      order({ razorpay_order_id: "young", created_at: iso(30 * 60_000) }),
      order({ razorpay_order_id: "old-nopay", created_at: iso(10 * HOUR) }),
      order({ razorpay_order_id: "paid", status: "paid", razorpay_payment_id: "pay_1", created_at: iso(2 * HOUR) }),
      order({ razorpay_order_id: "done", status: "fulfilled", created_at: iso(50 * HOUR) }),
    ], NOW);
    expect(stuck.map((s) => s.orderId)).toEqual(["paid", "old-nopay"]);
    expect(stuck[0]).toMatchObject({ hasPayment: true, ageHours: 2 });
  });
});

describe("refunds, ledger and ranking", () => {
  it("findRefundDue keeps only orders with a positive refund_due_paise", () => {
    const due = findRefundDue([order({ refund_due_paise: 3_000 }), order({ razorpay_order_id: "o2", refund_due_paise: 0 }), order({ razorpay_order_id: "o3" })]);
    expect(due).toEqual([{ orderId: "o1", employerId: "e1", status: "created", refundDuePaise: 3_000 }]);
  });

  it("summarizeLedger treats positive rows as granted and negative as spent", () => {
    expect(summarizeLedger([
      { employer_id: "e1", amount: 5_000, kind: "refund" },
      { employer_id: "e1", amount: -2_000, kind: "spend" },
      { employer_id: "e1", amount: 500, kind: "release" },
    ])).toEqual({ grantedPaise: 5_500, spentPaise: 2_000, outstandingPaise: 3_500 });
  });

  it("rankTopEmployers sums per employer, skips refunded rows and names unknowns", () => {
    const payments: PaymentRow[] = [
      { employer_id: "e1", amount: 5_900, created_at: iso(HOUR) },
      { employer_id: "e1", amount: 5_900, created_at: iso(HOUR) },
      { employer_id: "e2", amount: 20_000, created_at: iso(HOUR) },
      { employer_id: "e2", amount: 99_000, created_at: iso(HOUR), refunded_at: iso(HOUR) },
    ];
    const top = rankTopEmployers(payments, new Map([["e1", "Acme"]]));
    expect(top).toEqual([
      { employerId: "e2", companyName: "(unknown)", spendPaise: 20_000, payments: 1 },
      { employerId: "e1", companyName: "Acme", spendPaise: 11_800, payments: 2 },
    ]);
  });
});

describe("buildEmployerFinancials", () => {
  it("assembles revenue, order health, refunds and credit, tolerating a missing ledger", () => {
    const f = buildEmployerFinancials({
      payments: [
        { employer_id: "e1", amount: 5_900, created_at: iso(HOUR) },
        { employer_id: "e1", amount: 10_000, created_at: iso(60 * 24 * HOUR) },
        { employer_id: "e1", amount: 1_000, created_at: iso(HOUR), refunded_at: iso(HOUR) },
      ],
      orders: [order({ status: "paid", razorpay_payment_id: "pay_1", refund_due_paise: 1_000 }), order({ razorpay_order_id: "o2", status: "fulfilled" })],
      ledger: null,
      names: new Map([["e1", "Acme"]]),
      refundDueTracked: true,
      now: NOW,
    });
    expect(f.revenue).toMatchObject({ lifetimePaise: 16_900, last30dPaise: 6_900, refundedPaise: 1_000, paymentCount: 3 });
    expect(f.orders).toEqual({ total: 2, byStatus: { paid: 1, fulfilled: 1 } });
    expect(f.stuckOrders.count).toBe(1);
    expect(f.refundDue).toMatchObject({ count: 1, totalPaise: 1_000, tracked: true });
    expect(f.credit).toMatchObject({ ledgerAvailable: false, outstandingPaise: 0 });
    expect(f.topEmployers[0].companyName).toBe("Acme");
    expect(f.generatedAt).toBe(new Date(NOW).toISOString());
  });
});
