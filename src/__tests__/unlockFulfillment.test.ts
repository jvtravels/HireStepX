import { describe, it, expect, vi, beforeEach } from "vitest";
import { FakeUnlockDb, HEADERS, SUPABASE, match, order, fakeRazorpay, combineFetch } from "./unlockTestUtils";
import type { NotifyInput } from "../../server-handlers/_notify";

vi.mock("../../server-handlers/_shared", () => ({
  slog: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
  supabaseUrl: () => "https://example.supabase.co",
  supabaseServiceHeaders: () => ({ apikey: "service-key", Authorization: "Bearer service-key" }),
}));

const { fulfillUnlockOrder, backfillLegacyUnlockOrder, findCapturedPaymentForOrder, toCapturedPayment } =
  await import("../../server-handlers/_unlock-fulfillment");
const { handleEmployerUnlockWebhook } = await import("../../server-handlers/_employer-unlock-webhook");
import type { UnlockWebhookEvent } from "../../server-handlers/_employer-unlock-webhook";

const PAY = { id: "pay_1", status: "captured", amount: 5900, orderId: "order_1" };

function run(db: FakeUnlockDb, over: Partial<Parameters<typeof fulfillUnlockOrder>[0]> = {}) {
  const notifyImpl = vi.fn(async (_input: NotifyInput) => {});
  const p = fulfillUnlockOrder({
    supabaseUrl: SUPABASE, headers: HEADERS, razorpayOrderId: "order_1", payment: PAY,
    fetchImpl: db.fetch as typeof fetch, notifyImpl, now: () => new Date("2026-10-10T09:00:00.000Z"), ...over,
  });
  return { p, notifyImpl };
}

let db: FakeUnlockDb;
beforeEach(() => {
  db = new FakeUnlockDb().seed({ orders: [order()], matches: [match("m1")] });
});

describe("fulfillUnlockOrder — happy path", () => {
  it("marks paid, records the ledger row, unlocks the match, closes the order and notifies once", async () => {
    const { p, notifyImpl } = run(db);
    const r = await p;
    expect(r.kind).toBe("fulfilled");
    if (r.kind !== "fulfilled") return;
    expect(r.unlockedMatchIds).toEqual(["m1"]);
    expect(r.candidates[0]).toMatchObject({ matchId: "m1", name: "Name m1", email: "m1@example.com" });
    expect(r.invoiceNo).toBe("HSX-2610-000001");
    expect(db.orders.get("order_1")).toMatchObject({ status: "fulfilled", razorpay_payment_id: "pay_1" });
    expect(db.matches.get("m1")).toMatchObject({ unlocked: true, unlocked_candidate_email: "m1@example.com" });
    expect(db.ledger).toHaveLength(1);
    expect(notifyImpl).toHaveBeenCalledTimes(1);
    expect(notifyImpl.mock.calls[0]?.[0]).toMatchObject({ userId: "emp-1", type: "unlock_confirmed" });
  });

  it("is idempotent: a second call re-reports the result, writes nothing and does not notify again", async () => {
    const first = run(db);
    await first.p;
    const writesBefore = db.calls.filter((c) => c.method !== "GET").length;
    const second = run(db);
    const r = await second.p;
    expect(r.kind).toBe("fulfilled");
    if (r.kind === "fulfilled") {
      expect(r.firstFulfilment).toBe(false);
      expect(r.invoiceNo).toBe("HSX-2610-000001");
    }
    expect(db.calls.filter((c) => c.method !== "GET").length).toBe(writesBefore);
    expect(db.ledger).toHaveLength(1);
    expect(second.notifyImpl).not.toHaveBeenCalled();
  });

  it("two concurrent calls (webhook + browser) end with one ledger row and one notification", async () => {
    const a = run(db);
    const b = run(db);
    const [ra, rb] = await Promise.all([a.p, b.p]);
    expect([ra.kind, rb.kind].every((k) => k === "fulfilled")).toBe(true);
    expect(db.ledger).toHaveLength(1);
    expect(a.notifyImpl.mock.calls.length + b.notifyImpl.mock.calls.length).toBe(1);
    expect(db.matches.get("m1")?.unlocked).toBe(true);
    expect(db.orders.get("order_1")?.status).toBe("fulfilled");
  });

  it("treats an existing ledger row (409) as success and still completes the unlock", async () => {
    db.ledger.push({ razorpay_payment_id: "pay_1", razorpay_order_id: "order_1", employer_id: "emp-1", amount: 5900, invoice_no: "HSX-2610-000099", refunded_at: null });
    const { p, notifyImpl } = run(db);
    const r = await p;
    expect(r.kind).toBe("fulfilled");
    if (r.kind === "fulfilled") expect(r.invoiceNo).toBe("HSX-2610-000099");
    expect(db.matches.get("m1")?.unlocked).toBe(true);
    expect(notifyImpl).not.toHaveBeenCalled();
  });
});

describe("fulfillUnlockOrder — partial fulfilment", () => {
  beforeEach(() => {
    db = new FakeUnlockDb().seed({
      orders: [order({ mode: "batch", match_ids: ["m1", "m2", "m3", "m4"], amount: 11960 })],
      matches: [
        match("m1"),
        match("m2", { profiles: { name: "B", email: "b@x.com", employer_visibility: "off" } }),
        match("m3"),
        // m4 is gone (candidate deleted account -> row cascaded away)
      ],
    });
    db.blockedCandidates.add("cand-m3");
  });

  it("does not unlock opted-out, blocked or deleted candidates; marks the order partial and reports them", async () => {
    const { p, notifyImpl } = run(db, { payment: { ...PAY, amount: 11960 } });
    const r = await p;
    expect(r.kind).toBe("partial");
    if (r.kind !== "partial") return;
    expect(r.unlockedMatchIds).toEqual(["m1"]);
    expect(r.failed).toEqual([
      { matchId: "m2", reason: "candidate_opted_out" },
      { matchId: "m3", reason: "blocked" },
      { matchId: "m4", reason: "gone" },
    ]);
    expect(r.refundDueEstimatePaise).toBe(Math.round((11960 * 3) / 4));
    expect(db.orders.get("order_1")?.status).toBe("partial");
    expect(db.matches.get("m2")?.unlocked).toBe(false);
    expect(db.matches.get("m3")?.unlocked).toBe(false);
    expect(db.ledger).toHaveLength(1);
    expect(notifyImpl.mock.calls[0]?.[0].body).toContain("3 candidates are no longer available");
  });

  it("when nothing can be unlocked the payment is still recorded and the buyer is told a refund is coming", async () => {
    db = new FakeUnlockDb().seed({
      orders: [order()],
      matches: [match("m1", { profiles: { name: "A", email: "a@x.com", employer_visibility: "off" } })],
    });
    const { p, notifyImpl } = run(db);
    const r = await p;
    expect(r.kind).toBe("partial");
    if (r.kind === "partial") expect(r.unlockedMatchIds).toEqual([]);
    expect(notifyImpl.mock.calls[0]?.[0].body).toContain("will refund");
  });
});

describe("fulfillUnlockOrder — refusals and failure handling", () => {
  it("refuses a payment that is not captured", async () => {
    const r = await run(db, { payment: { ...PAY, status: "authorized" } }).p;
    expect(r).toEqual({ kind: "not_captured", paymentStatus: "authorized" });
    expect(db.ledger).toHaveLength(0);
  });

  it("refuses an amount that differs from the order", async () => {
    const r = await run(db, { payment: { ...PAY, amount: 100 } }).p;
    expect(r).toMatchObject({ kind: "error", code: "amount_mismatch" });
    expect(db.matches.get("m1")?.unlocked).toBe(false);
  });

  it("refuses a payment that belongs to a different order", async () => {
    const r = await run(db, { payment: { ...PAY, orderId: "order_other" } }).p;
    expect(r).toMatchObject({ kind: "error", code: "order_mismatch" });
  });

  it("refuses when the authenticated employer does not own the order", async () => {
    const r = await run(db, { expectEmployerId: "someone-else" }).p;
    expect(r).toMatchObject({ kind: "error", code: "forbidden" });
    expect(db.ledger).toHaveLength(0);
  });

  it("refuses a second, different payment on an already-paid order", async () => {
    await run(db).p;
    const r = await run(db, { payment: { ...PAY, id: "pay_2" } }).p;
    expect(r).toMatchObject({ kind: "error", code: "duplicate_payment" });
    expect(db.ledger).toHaveLength(1);
  });

  it("returns not_found for an unknown order", async () => {
    const r = await run(db, { razorpayOrderId: "order_nope", payment: { ...PAY, orderId: "order_nope" } }).p;
    expect(r.kind).toBe("not_found");
  });

  it("short-circuits refunded and disputed orders without unlocking", async () => {
    db.orders.get("order_1")!.status = "refunded";
    expect((await run(db).p).kind).toBe("refunded");
    db.orders.get("order_1")!.status = "disputed";
    expect((await run(db).p).kind).toBe("disputed");
    expect(db.matches.get("m1")?.unlocked).toBe(false);
  });

  it("leaves the order 'paid' (for the reconciler) when the unlock write fails, and a retry then succeeds", async () => {
    db.failWhen = (method, url) => method === "PATCH" && url.includes("requirement_matches");
    const r = await run(db).p;
    expect(r).toMatchObject({ kind: "error", code: "db_error" });
    expect(db.orders.get("order_1")?.status).toBe("paid");
    expect(db.ledger).toHaveLength(1);

    db.failWhen = null;
    const retry = run(db);
    const r2 = await retry.p;
    expect(r2.kind).toBe("fulfilled");
    expect(db.matches.get("m1")?.unlocked).toBe(true);
    expect(db.ledger).toHaveLength(1);
    // The first attempt already inserted the ledger row, so the retry does not double-notify.
    expect(retry.notifyImpl).not.toHaveBeenCalled();
  });

  it("returns db_error when the ledger insert fails for a reason other than a duplicate", async () => {
    db.failWhen = (method, url) => method === "POST" && url.includes("employer_unlock_payments");
    const r = await run(db).p;
    expect(r).toMatchObject({ kind: "error", code: "db_error" });
    expect(db.matches.get("m1")?.unlocked).toBe(false);
  });
});

describe("razorpay reads", () => {
  it("toCapturedPayment parses entities and rejects malformed ones", () => {
    expect(toCapturedPayment({ id: "pay_1", status: "captured", amount: 5900, order_id: "order_1" })).toEqual(PAY);
    expect(toCapturedPayment({ id: "pay_1" })).toBeNull();
    expect(toCapturedPayment(null)).toBeNull();
  });

  it("findCapturedPaymentForOrder ignores fully refunded payments and surfaces Razorpay errors", async () => {
    const f = fakeRazorpay({ payments: [
      { id: "pay_a", status: "captured", amount: 5900, order_id: "order_1", refund_status: "full" },
      { id: "pay_b", status: "failed", amount: 5900, order_id: "order_1" },
    ] }) as unknown as typeof fetch;
    expect(await findCapturedPaymentForOrder("order_1", "k", "s", f)).toBeNull();
    const down = fakeRazorpay({ down: true }) as unknown as typeof fetch;
    expect(await findCapturedPaymentForOrder("order_1", "k", "s", down)).toBe("error");
  });
});

describe("backfillLegacyUnlockOrder", () => {
  it("rebuilds an order row from server-written notes, only for the noted employer", async () => {
    db = new FakeUnlockDb().seed({ matches: [match("m1")] });
    const row = await backfillLegacyUnlockOrder({
      supabaseUrl: SUPABASE, headers: HEADERS, razorpayOrderId: "order_old", amount: 5900,
      notes: { employerId: "emp-1", mode: "single", matchIds: "m1" }, employerId: "emp-1", fetchImpl: db.fetch as typeof fetch,
    });
    expect(row).toMatchObject({ razorpay_order_id: "order_old", employer_id: "emp-1", match_ids: ["m1"], status: "created" });
    const other = await backfillLegacyUnlockOrder({
      supabaseUrl: SUPABASE, headers: HEADERS, razorpayOrderId: "order_old2", amount: 5900,
      notes: { employerId: "emp-2", mode: "single", matchIds: "m1" }, employerId: "emp-1", fetchImpl: db.fetch as typeof fetch,
    });
    expect(other).toBeNull();
  });
});

/* ── webhook branches ── */

function hook(eventType: string, event: UnlockWebhookEvent | undefined, d = db, extra: Record<string, unknown> = {}) {
  const notifyImpl = vi.fn(async (_input: NotifyInput) => {});
  return {
    notifyImpl,
    p: handleEmployerUnlockWebhook({
      eventType, event, supabaseUrl: SUPABASE, headers: HEADERS, fetchImpl: d.fetch as typeof fetch, notifyImpl,
      now: () => new Date("2026-10-10T10:00:00.000Z"), ...extra,
    }),
  };
}
const capturedEvent = (eventType: string) => ({
  event: eventType,
  payload: { payment: { entity: { id: "pay_1", status: "captured", amount: 5900, order_id: "order_1", notes: {} } } },
});
const refundEvent = (amount: number) => ({ payload: { refund: { entity: { id: "rfnd_1", payment_id: "pay_1", amount } } } });
const disputeEvent = { payload: { dispute: { entity: { id: "disp_1", payment_id: "pay_1" } } } };

describe("webhook — payment.captured / order.paid", () => {
  it.each(["payment.captured", "order.paid"])("%s fulfils an employer unlock order", async (eventType) => {
    const r = await hook(eventType, capturedEvent(eventType)).p;
    expect(r).toMatchObject({ handled: true, status: 200, body: { unlock: "fulfilled", unlocked: 1 } });
    expect(db.matches.get("m1")?.unlocked).toBe(true);
  });

  it("does not claim a payment that is not an unlock order (subscription/credits fall through)", async () => {
    const ev = capturedEvent("payment.captured");
    ev.payload.payment.entity.order_id = "order_subscription";
    expect(await hook("payment.captured", ev).p).toEqual({ handled: false });
  });

  it("a redelivery after fulfilment is a harmless 200", async () => {
    await hook("payment.captured", capturedEvent("payment.captured")).p;
    const again = hook("payment.captured", capturedEvent("payment.captured"));
    expect(await again.p).toMatchObject({ handled: true, status: 200 });
    expect(again.notifyImpl).not.toHaveBeenCalled();
    expect(db.ledger).toHaveLength(1);
  });

  it("asks Razorpay to redeliver (retry) when fulfilment hits a database error", async () => {
    db.failWhen = (m, url) => m === "PATCH" && url.includes("requirement_matches");
    const r = await hook("payment.captured", capturedEvent("payment.captured")).p;
    expect(r).toMatchObject({ handled: true, status: 500, retry: true });
  });

  it("asks Razorpay to redeliver when the order lookup itself fails", async () => {
    db.failWhen = (_m, url) => url.includes("employer_unlock_orders");
    expect(await hook("payment.captured", capturedEvent("payment.captured")).p).toMatchObject({ status: 500, retry: true });
  });

  it("recovers a pre-ledger order from the signed payment notes", async () => {
    db = new FakeUnlockDb().seed({ matches: [match("m1")] });
    const ev = capturedEvent("payment.captured");
    ev.payload.payment.entity.notes = { employerId: "emp-1", mode: "single", matchIds: "m1" };
    const r = await hook("payment.captured", ev, db).p;
    expect(r).toMatchObject({ handled: true, status: 200, body: { unlock: "fulfilled" } });
    expect(db.orders.get("order_1")?.status).toBe("fulfilled");
  });

  it("does not retry on an amount mismatch (retrying cannot fix it)", async () => {
    const ev = capturedEvent("payment.captured");
    ev.payload.payment.entity.amount = 1;
    expect(await hook("payment.captured", ev).p).toMatchObject({ handled: true, status: 200, body: { skipped: "unlock_amount_mismatch" } });
  });
});

describe("webhook — refunds", () => {
  beforeEach(async () => {
    await hook("payment.captured", capturedEvent("payment.captured")).p;
    // another, older unlock that must survive the refund
    db.matches.set("m-old", match("m-old", { unlocked: true, unlocked_at: "2026-09-01T00:00:00.000Z" }));
  });

  it.each(["refund.created", "refund.processed"])("%s on a full refund marks the order refunded, stamps the ledger and relocks the order's matches", async (eventType) => {
    const r = await hook(eventType, refundEvent(5900)).p;
    expect(r).toMatchObject({ handled: true, status: 200, body: { unlock_refund: eventType, relocked: 1 } });
    expect(db.orders.get("order_1")?.status).toBe("refunded");
    expect(db.ledger[0].refunded_at).toBe("2026-10-10T10:00:00.000Z");
    expect(db.matches.get("m1")).toMatchObject({ unlocked: false, unlocked_at: null });
    expect(db.matches.get("m-old")?.unlocked).toBe(true);
  });

  it("only relocks matches unlocked by THIS order, not ones already unlocked before it", async () => {
    db.orders.get("order_1")!.match_ids = ["m1", "m-old"];
    await hook("refund.processed", refundEvent(5900)).p;
    expect(db.matches.get("m1")?.unlocked).toBe(false);
    expect(db.matches.get("m-old")?.unlocked).toBe(true);
  });

  it("is idempotent across refund.created then refund.processed", async () => {
    await hook("refund.created", refundEvent(5900)).p;
    const r = await hook("refund.processed", refundEvent(5900)).p;
    expect(r).toMatchObject({ status: 200 });
    expect(db.orders.get("order_1")?.status).toBe("refunded");
  });

  it("a partial refund leaves the matches unlocked and the order status alone", async () => {
    const r = await hook("refund.processed", refundEvent(1000)).p;
    expect(r).toMatchObject({ handled: true, body: { unlock_refund: "partial_ignored" } });
    expect(db.matches.get("m1")?.unlocked).toBe(true);
    expect(db.orders.get("order_1")?.status).toBe("fulfilled");
  });

  it("falls through for a refund on a non-unlock payment", async () => {
    const ev = { payload: { refund: { entity: { id: "rfnd_9", payment_id: "pay_other", amount: 100 } } } };
    expect(await hook("refund.processed", ev).p).toEqual({ handled: false });
  });

  it("a later fulfilment attempt cannot re-unlock a refunded order", async () => {
    await hook("refund.processed", refundEvent(5900)).p;
    const r = await run(db).p;
    expect(r.kind).toBe("refunded");
    expect(db.matches.get("m1")?.unlocked).toBe(false);
  });

  it("asks for redelivery when the relock fails, without marking the order refunded", async () => {
    db.failWhen = (m, url) => m === "PATCH" && url.includes("requirement_matches");
    const r = await hook("refund.processed", refundEvent(5900)).p;
    expect(r).toMatchObject({ status: 500, retry: true });
    expect(db.orders.get("order_1")?.status).toBe("fulfilled");
  });
});

describe("webhook — disputes", () => {
  beforeEach(async () => {
    await hook("payment.captured", capturedEvent("payment.captured")).p;
  });

  it("dispute.created flags the order 'disputed' without relocking", async () => {
    const r = await hook("payment.dispute.created", disputeEvent).p;
    expect(r).toMatchObject({ handled: true, status: 200 });
    expect(db.orders.get("order_1")?.status).toBe("disputed");
    expect(db.matches.get("m1")?.unlocked).toBe(true);
  });

  it("dispute.lost keeps it disputed and logs for manual action", async () => {
    await hook("payment.dispute.created", disputeEvent).p;
    await hook("payment.dispute.lost", disputeEvent).p;
    const { slog } = await import("../../server-handlers/_shared");
    expect(db.orders.get("order_1")?.status).toBe("disputed");
    expect(slog.error).toHaveBeenCalledWith(expect.stringContaining("LOST"), expect.objectContaining({ code: "unlock_dispute_lost" }));
  });

  it("dispute.won lifts the freeze", async () => {
    await hook("payment.dispute.created", disputeEvent).p;
    await hook("payment.dispute.won", disputeEvent).p;
    expect(db.orders.get("order_1")?.status).toBe("fulfilled");
  });

  it("falls through for a dispute on a non-unlock payment", async () => {
    const ev = { payload: { dispute: { entity: { id: "d", payment_id: "pay_sub" } } } };
    expect(await hook("payment.dispute.created", ev).p).toEqual({ handled: false });
  });
});

// keep combineFetch exercised for the reconcile tests that import it
void combineFetch;
