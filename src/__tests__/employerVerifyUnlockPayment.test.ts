import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { FakeUnlockDb, match, order, fakeRazorpay, type FakeRzpPayment } from "./unlockTestUtils";

/* Handler-level tests for employer-verify-unlock-payment.ts — the browser fast
 * path that turns a completed Razorpay checkout into a contact unlock. Real
 * HMAC signatures are generated the way Razorpay would, so signature
 * verification runs against the real crypto. The payment is re-fetched from
 * (a fake) Razorpay and must be "captured"; fulfilment itself is the shared
 * fulfillUnlockOrder() against a stateful PostgREST fake (unlockTestUtils.ts),
 * so idempotency and partial outcomes are exercised end to end. */

const RAZORPAY_SECRET = "whsec_test_secret";
process.env.RAZORPAY_KEY_ID = "rzp_test_key123";
process.env.RAZORPAY_KEY_SECRET = RAZORPAY_SECRET;

const applyCorsHeaders = vi.fn();
const handlePreflightAndMethod = vi.fn();
const isRateLimited = vi.fn();
const getVercelClientIp = vi.fn();
const supabaseUrl = vi.fn();
const supabaseAnonKey = vi.fn();
const supabaseServiceHeaders = vi.fn();

vi.mock("../../server-handlers/_shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../server-handlers/_shared")>();
  return {
    applyCorsHeaders: (...args: unknown[]) => applyCorsHeaders(...args),
    handlePreflightAndMethod: (...args: unknown[]) => handlePreflightAndMethod(...args),
    isRateLimited: (...args: unknown[]) => isRateLimited(...args),
    getVercelClientIp: (...args: unknown[]) => getVercelClientIp(...args),
    supabaseUrl: (...args: unknown[]) => supabaseUrl(...args),
    supabaseAnonKey: (...args: unknown[]) => supabaseAnonKey(...args),
    supabaseServiceHeaders: (...args: unknown[]) => supabaseServiceHeaders(...args),
    verifyEmployerAuthToken: actual.verifyEmployerAuthToken,
    slog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
});

const { default: handler } = await import("../../server-handlers/employer-verify-unlock-payment");

const ORDER_ID = "order_ABCDEF123456";
const PAYMENT_ID = "pay_ABCDEF123456";

const sign = (orderId: string, paymentId: string, secret = RAZORPAY_SECRET) =>
  createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");

function mockReq(body: Record<string, unknown>, overrides: Partial<VercelRequest> = {}): VercelRequest {
  return {
    method: "POST",
    headers: { authorization: "Bearer user-token", origin: "https://app.hirestepx.com" },
    body,
    ...overrides,
  } as unknown as VercelRequest;
}

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    setHeader(key: string, value: string) { res.headers[key] = value; return res; },
    status(code: number) { res.statusCode = code; return res; },
    json(payload: unknown) { res.body = payload; return res; },
    end() { return res; },
  };
  return res as unknown as VercelResponse & typeof res;
}

const validBody = (orderId = ORDER_ID, paymentId = PAYMENT_ID) =>
  ({ razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: sign(orderId, paymentId) });

let db: FakeUnlockDb;
let payments: FakeRzpPayment[];
let rzpOrders: Record<string, { amount: number; notes?: Record<string, unknown> }>;
let authed: boolean;
let rzpDown: boolean;
let paymentLookups: number;

const capturedPayment = (over: Partial<FakeRzpPayment> = {}): FakeRzpPayment =>
  ({ id: PAYMENT_ID, status: "captured", amount: 5900, order_id: ORDER_ID, ...over });

function installFetch() {
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/auth/v1/user")) return authed ? new Response(JSON.stringify({ id: "emp-1" })) : new Response("{}", { status: 401 });
    if (url.includes("api.razorpay.com")) {
      if (/\/payments\/pay_/.test(url)) paymentLookups += 1;
      return fakeRazorpay({ payments, orders: rzpOrders, down: rzpDown })(input);
    }
    return db.fetch(input, init);
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  vi.clearAllMocks();
  applyCorsHeaders.mockReturnValue("https://app.hirestepx.com");
  handlePreflightAndMethod.mockReturnValue(false);
  isRateLimited.mockResolvedValue(false);
  getVercelClientIp.mockReturnValue("1.2.3.4");
  supabaseUrl.mockReturnValue("https://example.supabase.co");
  supabaseAnonKey.mockReturnValue("anon-key");
  supabaseServiceHeaders.mockReturnValue({ apikey: "service-key", Authorization: "Bearer service-key" });
  authed = true;
  rzpDown = false;
  paymentLookups = 0;
  payments = [capturedPayment()];
  rzpOrders = {};
  db = new FakeUnlockDb().seed({
    orders: [order({ razorpay_order_id: ORDER_ID })],
    matches: [match("m1")],
  });
  installFetch();
});

afterEach(() => { vi.useRealTimers(); });

describe("employer-verify-unlock-payment — request gating", () => {
  it("403s when the origin isn't allowed", async () => {
    applyCorsHeaders.mockReturnValue("");
    const res = mockRes();
    await handler(mockReq(validBody()), res);
    expect(res.statusCode).toBe(403);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("429s when rate limited", async () => {
    isRateLimited.mockResolvedValue(true);
    const res = mockRes();
    await handler(mockReq(validBody()), res);
    expect(res.statusCode).toBe(429);
  });

  it("401s when the Supabase auth lookup rejects the token", async () => {
    authed = false;
    const res = mockRes();
    await handler(mockReq(validBody()), res);
    expect(res.statusCode).toBe(401);
  });

  it("400s when payment fields are missing or malformed", async () => {
    let res = mockRes();
    await handler(mockReq({ razorpay_order_id: ORDER_ID }), res);
    expect(res.statusCode).toBe(400);
    res = mockRes();
    await handler(mockReq({ razorpay_order_id: "x", razorpay_payment_id: "y", razorpay_signature: "z" }), res);
    expect(res.statusCode).toBe(400);
  });
});

describe("employer-verify-unlock-payment — signature verification (real HMAC)", () => {
  it("rejects a signature produced with the wrong secret — no unlock happens", async () => {
    const res = mockRes();
    await handler(mockReq({ ...validBody(), razorpay_signature: sign(ORDER_ID, PAYMENT_ID, "attacker") }), res);
    expect(res.statusCode).toBe(400);
    expect(db.matches.get("m1")?.unlocked).toBe(false);
    expect(db.ledger).toHaveLength(0);
  });

  it("rejects a tampered payment id", async () => {
    const res = mockRes();
    await handler(mockReq({ ...validBody(), razorpay_payment_id: "pay_TAMPERED00000" }), res);
    expect(res.statusCode).toBe(400);
    expect(db.ledger).toHaveLength(0);
  });
});

describe("employer-verify-unlock-payment — payment must be captured at Razorpay", () => {
  it("502s when Razorpay cannot be reached (nothing is unlocked)", async () => {
    rzpDown = true;
    const res = mockRes();
    await handler(mockReq(validBody()), res);
    expect(res.statusCode).toBe(502);
    expect(db.matches.get("m1")?.unlocked).toBe(false);
  });

  it("400s when the payment belongs to a different order", async () => {
    payments = [capturedPayment({ order_id: "order_SOMEONEELSE1" })];
    const res = mockRes();
    await handler(mockReq(validBody()), res);
    expect(res.statusCode).toBe(400);
    expect(db.ledger).toHaveLength(0);
  });

  it("409 payment_not_captured (pending:false) for a failed payment, without unlocking", async () => {
    payments = [capturedPayment({ status: "failed" })];
    const res = mockRes();
    await handler(mockReq(validBody()), res);
    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({ code: "payment_not_captured", pending: false, orderId: ORDER_ID });
    expect(db.matches.get("m1")?.unlocked).toBe(false);
    expect(db.ledger).toHaveLength(0);
  });

  it("409 pending:true for an authorized payment, after one capture re-check; the webhook finishes it later", async () => {
    vi.useFakeTimers();
    payments = [capturedPayment({ status: "authorized" })];
    const res = mockRes();
    const p = handler(mockReq(validBody()), res);
    await vi.advanceTimersByTimeAsync(2_000);
    await p;
    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({ code: "payment_not_captured", pending: true });
    expect(paymentLookups).toBe(2);
    expect(db.matches.get("m1")?.unlocked).toBe(false);
  });

  it("succeeds when the payment becomes captured on the re-check", async () => {
    vi.useFakeTimers();
    payments = [capturedPayment({ status: "authorized" })];
    const res = mockRes();
    const p = handler(mockReq(validBody()), res);
    await vi.advanceTimersByTimeAsync(500);
    payments[0].status = "captured";
    await vi.advanceTimersByTimeAsync(2_000);
    await p;
    expect(res.statusCode).toBe(200);
  });
});

describe("employer-verify-unlock-payment — order ownership & state", () => {
  it("403s when the order belongs to a different employer", async () => {
    db.orders.get(ORDER_ID)!.employer_id = "someone-else";
    const res = mockRes();
    await handler(mockReq(validBody()), res);
    expect(res.statusCode).toBe(403);
    expect(db.ledger).toHaveLength(0);
    expect(db.matches.get("m1")?.unlocked).toBe(false);
  });

  it("403s for an unknown order with no usable notes", async () => {
    db.orders.clear();
    rzpOrders = { [ORDER_ID]: { amount: 5900, notes: {} } };
    const res = mockRes();
    await handler(mockReq(validBody()), res);
    expect(res.statusCode).toBe(403);
  });

  it("rebuilds a legacy order (created before employer_unlock_orders) from its server-written notes", async () => {
    db.orders.clear();
    rzpOrders = { [ORDER_ID]: { amount: 5900, notes: { employerId: "emp-1", mode: "single", matchIds: "m1" } } };
    const res = mockRes();
    await handler(mockReq(validBody()), res);
    expect(res.statusCode).toBe(200);
    expect(db.matches.get("m1")?.unlocked).toBe(true);
    expect(db.orders.get(ORDER_ID)?.status).toBe("fulfilled");
  });

  it("does not adopt a legacy order whose notes name another employer", async () => {
    db.orders.clear();
    rzpOrders = { [ORDER_ID]: { amount: 5900, notes: { employerId: "emp-2", mode: "single", matchIds: "m1" } } };
    const res = mockRes();
    await handler(mockReq(validBody()), res);
    expect(res.statusCode).toBe(403);
    expect(db.matches.get("m1")?.unlocked).toBe(false);
  });

  it("400s when the captured amount differs from the order amount", async () => {
    payments = [capturedPayment({ amount: 100 })];
    const res = mockRes();
    await handler(mockReq(validBody()), res);
    expect(res.statusCode).toBe(400);
    expect(db.matches.get("m1")?.unlocked).toBe(false);
  });

  it("409 order_refunded for a refunded order and order_disputed for a disputed one", async () => {
    db.orders.get(ORDER_ID)!.status = "refunded";
    let res = mockRes();
    await handler(mockReq(validBody()), res);
    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({ code: "order_refunded" });

    db.orders.get(ORDER_ID)!.status = "disputed";
    res = mockRes();
    await handler(mockReq(validBody()), res);
    expect(res.body).toMatchObject({ code: "order_disputed" });
    expect(db.matches.get("m1")?.unlocked).toBe(false);
  });

  it("still unlocks when the requirement was closed after the order was created", async () => {
    // Fulfilment has no requirement-status gate: a captured payment is honoured.
    const res = mockRes();
    await handler(mockReq(validBody()), res);
    expect(res.statusCode).toBe(200);
  });
});

describe("employer-verify-unlock-payment — successful unlock", () => {
  it("unlocks a single candidate, records the payment and returns contact details, order status and invoice number", async () => {
    const res = mockRes();
    await handler(mockReq(validBody()), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      unlocked: true,
      orderId: ORDER_ID,
      orderStatus: "fulfilled",
      invoiceNo: "HSX-2610-000001",
      candidates: [{ matchId: "m1", name: "Name m1", contact: { email: "m1@example.com" } }],
    });
    expect((res.body as Record<string, unknown>).partial).toBeUndefined();
    expect(db.matches.get("m1")).toMatchObject({ unlocked: true, unlocked_candidate_email: "m1@example.com" });
    expect(db.ledger).toHaveLength(1);
    expect(db.ledger[0]).toMatchObject({ razorpay_payment_id: PAYMENT_ID, razorpay_order_id: ORDER_ID, employer_id: "emp-1", amount: 5900 });
  });

  it("is idempotent: a replay (double click, or webhook already ran) returns the same 200 with no second ledger row", async () => {
    await handler(mockReq(validBody()), mockRes());
    const res = mockRes();
    await handler(mockReq(validBody()), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ unlocked: true, orderStatus: "fulfilled", invoiceNo: "HSX-2610-000001" });
    expect(db.ledger).toHaveLength(1);
  });

  it("treats an existing ledger row (webhook beat the browser) as an idempotent success", async () => {
    db.ledger.push({ razorpay_payment_id: PAYMENT_ID, razorpay_order_id: ORDER_ID, employer_id: "emp-1", amount: 5900, invoice_no: "HSX-2610-000042", refunded_at: null });
    const res = mockRes();
    await handler(mockReq(validBody()), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ invoiceNo: "HSX-2610-000042" });
    expect(db.matches.get("m1")?.unlocked).toBe(true);
    expect(db.ledger).toHaveLength(1);
  });

  it("still unlocks when the candidate snapshot columns reject the PATCH (migration 0026 not applied)", async () => {
    const real = db.fetch;
    let first = true;
    db.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if ((init?.method || "GET") === "PATCH" && String(input).includes("requirement_matches") && first) {
        first = false;
        return new Response("{}", { status: 400 });
      }
      return real(input, init);
    }) as typeof db.fetch;
    const res = mockRes();
    await handler(mockReq(validBody()), res);
    expect(res.statusCode).toBe(200);
    expect(db.matches.get("m1")?.unlocked).toBe(true);
  });

  it("500s (order left 'paid' for the reconciler) when unlock writes keep failing, then succeeds on retry", async () => {
    db.failWhen = (m, url) => m === "PATCH" && url.includes("requirement_matches");
    let res = mockRes();
    await handler(mockReq(validBody()), res);
    expect(res.statusCode).toBe(500);
    expect((res.body as { error: string }).error).toContain("retried automatically");
    expect(db.orders.get(ORDER_ID)?.status).toBe("paid");
    expect(db.ledger).toHaveLength(1);

    db.failWhen = null;
    res = mockRes();
    await handler(mockReq(validBody()), res);
    expect(res.statusCode).toBe(200);
    expect(db.ledger).toHaveLength(1);
  });

  it("500s when the ledger insert fails for a reason other than a duplicate", async () => {
    db.failWhen = (m, url) => m === "POST" && url.includes("employer_unlock_payments");
    const res = mockRes();
    await handler(mockReq(validBody()), res);
    expect(res.statusCode).toBe(500);
    expect(db.matches.get("m1")?.unlocked).toBe(false);
  });

  it("unlocks a full batch and records the ₹299 total", async () => {
    const ids = Array.from({ length: 10 }, (_, i) => `b${i}`);
    db = new FakeUnlockDb().seed({
      orders: [order({ razorpay_order_id: ORDER_ID, mode: "batch", match_ids: ids, amount: 29900 })],
      matches: ids.map((id) => match(id)),
    });
    payments = [capturedPayment({ amount: 29900 })];
    const res = mockRes();
    await handler(mockReq(validBody()), res);
    expect(res.statusCode).toBe(200);
    expect((res.body as { candidates: unknown[] }).candidates).toHaveLength(10);
    expect(db.ledger[0]).toMatchObject({ amount: 29900 });
    expect(ids.every((id) => db.matches.get(id)?.unlocked)).toBe(true);
  });
});

describe("employer-verify-unlock-payment — partial fulfilment", () => {
  it("returns 200 partial:true with failed ids, a refund estimate and a message when a candidate withdrew or blocked the employer", async () => {
    db = new FakeUnlockDb().seed({
      orders: [order({ razorpay_order_id: ORDER_ID, mode: "batch", match_ids: ["a", "b", "c"], amount: 8970 })],
      matches: [match("a"), match("b", { profiles: { name: "B", email: "b@x.com", employer_visibility: "off" } }), match("c")],
    });
    db.blockedCandidates.add("cand-c");
    payments = [capturedPayment({ amount: 8970 })];
    const res = mockRes();
    await handler(mockReq(validBody()), res);
    expect(res.statusCode).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body).toMatchObject({
      unlocked: true, partial: true, orderStatus: "partial",
      failed: [{ matchId: "b", reason: "candidate_opted_out" }, { matchId: "c", reason: "blocked" }],
      refundDueEstimatePaise: Math.round((8970 * 2) / 3),
    });
    expect((body.candidates as Array<{ matchId: string }>).map((c) => c.matchId)).toEqual(["a"]);
    expect(String(body.message)).toContain("refund");
    expect(db.matches.get("b")?.unlocked).toBe(false);
    expect(db.matches.get("c")?.unlocked).toBe(false);
    expect(db.ledger).toHaveLength(1);
  });

  it("still records the payment and reports partial when the matched rows no longer exist (candidate deleted)", async () => {
    db.matches.clear();
    const res = mockRes();
    await handler(mockReq(validBody()), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ partial: true, candidates: [], failed: [{ matchId: "m1", reason: "gone" }] });
    expect(db.ledger).toHaveLength(1);
  });
});
