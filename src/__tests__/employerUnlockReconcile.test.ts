import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FakeUnlockDb, HEADERS, SUPABASE, match, order, fakeRazorpay, combineFetch } from "./unlockTestUtils";

vi.mock("../../server-handlers/_shared", () => ({
  slog: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
  supabaseUrl: () => "https://example.supabase.co",
  supabaseServiceHeaders: () => ({ apikey: "service-key", Authorization: "Bearer service-key" }),
}));

const { reconcileUnlockOrders, STALE_AFTER_MS, EXPIRE_AFTER_MS } = await import("../../server-handlers/_employer-unlock-reconcile");
const cron = (await import("../../server-handlers/cron-reconcile-unlock-orders")).default;
const { slog } = await import("../../server-handlers/_shared");

const NOW = new Date("2026-10-10T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;

let db: FakeUnlockDb;
const notifyImpl = vi.fn(async () => {});

function sweep(rzp: Parameters<typeof fakeRazorpay>[0], extra: { batchSize?: number } = {}) {
  return reconcileUnlockOrders({
    supabaseUrl: SUPABASE, headers: HEADERS, razorpayKeyId: "k", razorpayKeySecret: "s",
    fetchImpl: combineFetch(db, fakeRazorpay(rzp)), notifyImpl, now: () => NOW, ...extra,
  });
}
const pay = (orderId: string, id = "pay_1", amount = 5900) => ({ id, status: "captured", amount, order_id: orderId });

beforeEach(() => {
  db = new FakeUnlockDb();
  notifyImpl.mockClear();
  vi.mocked(slog.error).mockClear();
});

describe("reconcileUnlockOrders", () => {
  it("fulfils a 'created' order whose payment was captured but never reached us (webhook missed, tab closed)", async () => {
    db.seed({ orders: [order({ created_at: ago(30 * MIN) })], matches: [match("m1")] });
    const s = await sweep({ payments: [pay("order_1")] });
    expect(s).toMatchObject({ scanned: 1, fulfilled: 1, errors: 0 });
    expect(db.orders.get("order_1")?.status).toBe("fulfilled");
    expect(db.matches.get("m1")?.unlocked).toBe(true);
    expect(notifyImpl).toHaveBeenCalledTimes(1);
  });

  it("retries an order left 'paid' by a failed fulfilment", async () => {
    db.seed({
      orders: [order({ status: "paid", razorpay_payment_id: "pay_1", created_at: ago(HOUR) })],
      matches: [match("m1")],
    });
    db.ledger.push({ razorpay_payment_id: "pay_1", razorpay_order_id: "order_1", employer_id: "emp-1", amount: 5900, invoice_no: "HSX-1", refunded_at: null });
    const s = await sweep({ payments: [pay("order_1")] });
    expect(s.fulfilled).toBe(1);
    expect(db.matches.get("m1")?.unlocked).toBe(true);
    expect(db.ledger).toHaveLength(1);
  });

  it("counts a partially fulfilled order as partial", async () => {
    db.seed({
      orders: [order({ mode: "batch", match_ids: ["m1", "m2"], amount: 11800, created_at: ago(HOUR) })],
      matches: [match("m1"), match("m2", { profiles: { name: "x", email: "x@x.com", employer_visibility: "off" } })],
    });
    const s = await sweep({ payments: [pay("order_1", "pay_1", 11800)] });
    expect(s).toMatchObject({ scanned: 1, partial: 1, fulfilled: 0 });
  });

  it("leaves a young unpaid order pending and expires one older than 24h", async () => {
    db.seed({
      orders: [
        order({ razorpay_order_id: "order_young", match_ids: ["m1"], created_at: ago(2 * HOUR) }),
        order({ razorpay_order_id: "order_old", id: "r2", match_ids: ["m2"], created_at: ago(EXPIRE_AFTER_MS + HOUR) }),
      ],
    });
    const s = await sweep({});
    expect(s).toMatchObject({ scanned: 2, pending: 1, expired: 1 });
    expect(db.orders.get("order_young")?.status).toBe("created");
    expect(db.orders.get("order_old")?.status).toBe("expired");
  });

  it("ignores orders newer than the stale threshold (the browser is probably still completing them)", async () => {
    db.seed({ orders: [order({ created_at: ago(STALE_AFTER_MS - MIN) })], matches: [match("m1")] });
    const s = await sweep({ payments: [pay("order_1")] });
    expect(s.scanned).toBe(0);
    expect(db.orders.get("order_1")?.status).toBe("created");
  });

  it("never expires an order Razorpay reports as captured, even when older than 24h", async () => {
    db.seed({ orders: [order({ created_at: ago(EXPIRE_AFTER_MS + 5 * HOUR) })], matches: [match("m1")] });
    const s = await sweep({ payments: [pay("order_1")] });
    expect(s).toMatchObject({ fulfilled: 1, expired: 0 });
  });

  it("does nothing destructive when Razorpay is unreachable — counts an error and retries next run", async () => {
    db.seed({ orders: [order({ created_at: ago(EXPIRE_AFTER_MS + HOUR) })] });
    const s = await sweep({ down: true });
    expect(s).toMatchObject({ scanned: 1, errors: 1, expired: 0 });
    expect(db.orders.get("order_1")?.status).toBe("created");
  });

  it("flags a 'paid' order with no live captured payment for a human and does not touch it", async () => {
    db.seed({ orders: [order({ status: "paid", razorpay_payment_id: "pay_1", created_at: ago(HOUR) })] });
    const s = await sweep({ payments: [] });
    expect(s.skipped).toBe(1);
    expect(db.orders.get("order_1")?.status).toBe("paid");
    expect(slog.error).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ code: "unlock_reconcile_paid_without_capture" }));
  });

  it("counts a database failure during fulfilment as an error and keeps the order open", async () => {
    db.seed({ orders: [order({ created_at: ago(HOUR) })], matches: [match("m1")] });
    const realFetch = combineFetch(db, fakeRazorpay({ payments: [pay("order_1")] }));
    db.failWhen = (m, url) => m === "PATCH" && url.includes("requirement_matches");
    const s = await reconcileUnlockOrders({
      supabaseUrl: SUPABASE, headers: HEADERS, razorpayKeyId: "k", razorpayKeySecret: "s", fetchImpl: realFetch, notifyImpl, now: () => NOW,
    });
    expect(s.errors).toBe(1);
    expect(db.orders.get("order_1")?.status).toBe("paid");
  });

  it("bounds the batch by batchSize, oldest first, and leaves the rest for the next run", async () => {
    const orders = Array.from({ length: 5 }, (_, i) =>
      order({ razorpay_order_id: `order_${i}`, id: `r${i}`, match_ids: [`m${i}`], created_at: ago((10 - i) * HOUR) }));
    db.seed({ orders });
    const s = await sweep({}, { batchSize: 2 });
    expect(s.scanned).toBe(2);
    const get = db.calls.find((c) => c.method === "GET" && c.url.includes("status=in.(created,paid)"));
    expect(get?.url).toContain("limit=2");
    expect(get?.url).toContain("order=created_at.asc");
  });

  it("is idempotent: a second run over the same data fulfils nothing new", async () => {
    db.seed({ orders: [order({ created_at: ago(HOUR) })], matches: [match("m1")] });
    await sweep({ payments: [pay("order_1")] });
    const s2 = await sweep({ payments: [pay("order_1")] });
    expect(s2.scanned).toBe(0);
    expect(notifyImpl).toHaveBeenCalledTimes(1);
  });

  it("throws when the order query itself fails so the cron reports 500", async () => {
    db.failWhen = () => true;
    await expect(sweep({})).rejects.toThrow(/sweep query failed/);
  });
});

describe("cron-reconcile-unlock-orders handler", () => {
  const ORIGINAL_ENV = { ...process.env };
  afterEach(() => { process.env = { ...ORIGINAL_ENV }; });
  const req = (auth?: string) => new Request("https://x.test/api/cron-reconcile-unlock-orders", { headers: auth ? { authorization: auth } : {} });

  it("fails closed with 401 when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;
    expect((await cron(req("Bearer "))).status).toBe(401);
    expect((await cron(req())).status).toBe(401);
  });

  it("rejects a wrong secret", async () => {
    process.env.CRON_SECRET = "s3cret";
    expect((await cron(req("Bearer nope"))).status).toBe(401);
  });

  it("returns 503 when Razorpay credentials are missing", async () => {
    process.env.CRON_SECRET = "s3cret";
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    expect((await cron(req("Bearer s3cret"))).status).toBe(503);
  });

  it("runs the sweep with a valid secret and returns the summary", async () => {
    process.env.CRON_SECRET = "s3cret";
    process.env.RAZORPAY_KEY_ID = "k";
    process.env.RAZORPAY_KEY_SECRET = "s";
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation((async () => new Response("[]", { status: 200 })) as typeof fetch);
    const res = await cron(req("Bearer s3cret"));
    spy.mockRestore();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, scanned: 0, fulfilled: 0 });
  });

  it("returns 500 when the sweep query fails", async () => {
    process.env.CRON_SECRET = "s3cret";
    process.env.RAZORPAY_KEY_ID = "k";
    process.env.RAZORPAY_KEY_SECRET = "s";
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation((async () => new Response("{}", { status: 500 })) as typeof fetch);
    const res = await cron(req("Bearer s3cret"));
    spy.mockRestore();
    expect(res.status).toBe(500);
  });
});
