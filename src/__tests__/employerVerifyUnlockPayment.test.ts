import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";

/* Handler-level tests for employer-verify-unlock-payment.ts — the endpoint
 * that turns a completed Razorpay checkout into an actual contact unlock.
 * Real HMAC signatures are generated the same way Razorpay would (mirroring
 * tests/unit/verifyPayment.test.ts), so signature verification runs against
 * the real crypto in _payment-verification.ts, not a stub. Only _shared.ts
 * (Supabase/CORS/rate-limit plumbing) and global.fetch are mocked — no real
 * Razorpay call or Supabase write ever happens, and no money moves. */

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
  // verifyEmployerAuthToken is left as the REAL implementation (it's pure
  // aside from calling global.fetch, which every test already mocks for the
  // "auth check" call via authOk() below) so existing tests keep driving
  // auth through fetch responses rather than needing their own mock.
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
    // notify()'s failure path (_notify.ts) logs via slog.warn when the
    // unmocked global.fetch calls below don't match its notifications
    // insert — stub it so that best-effort write never throws here.
    slog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
});

const { default: handler } = await import("../../server-handlers/employer-verify-unlock-payment");

const ORDER_ID = "order_ABCDEF123456";
const PAYMENT_ID = "pay_ABCDEF123456";

function sign(orderId: string, paymentId: string, secret = RAZORPAY_SECRET) {
  return createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
}

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

function authOk(employerId = "emp-1") {
  return { ok: true, json: async () => ({ id: employerId }) };
}

function razorpayOrderOk(notes: { employerId: string; mode: string; matchIds: string }, amount: number) {
  return { ok: true, json: async () => ({ amount, notes }) };
}

function validPaymentBody(orderId = ORDER_ID, paymentId = PAYMENT_ID) {
  return { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: sign(orderId, paymentId) };
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
  global.fetch = vi.fn();
});

describe("employer-verify-unlock-payment — request gating", () => {
  it("403s when the origin isn't allowed", async () => {
    applyCorsHeaders.mockReturnValue("");
    const res = mockRes();
    await handler(mockReq(validPaymentBody()), res);
    expect(res.statusCode).toBe(403);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("429s when rate limited", async () => {
    isRateLimited.mockResolvedValue(true);
    const res = mockRes();
    await handler(mockReq(validPaymentBody()), res);
    expect(res.statusCode).toBe(429);
  });

  it("401s when the Supabase auth lookup rejects the token", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false });
    const res = mockRes();
    await handler(mockReq(validPaymentBody()), res);
    expect(res.statusCode).toBe(401);
  });

  it("400s when payment fields are missing", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(authOk());
    const res = mockRes();
    await handler(mockReq({ razorpay_order_id: ORDER_ID }), res);
    expect(res.statusCode).toBe(400);
  });

  it("400s on malformed order/payment id format", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(authOk());
    const res = mockRes();
    await handler(mockReq({ razorpay_order_id: "x", razorpay_payment_id: "y", razorpay_signature: "z" }), res);
    expect(res.statusCode).toBe(400);
  });
});

describe("employer-verify-unlock-payment — signature verification (real HMAC)", () => {
  it("rejects a signature produced with the wrong secret — no unlock happens", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(authOk());
    const res = mockRes();
    const body = {
      razorpay_order_id: ORDER_ID,
      razorpay_payment_id: PAYMENT_ID,
      razorpay_signature: sign(ORDER_ID, PAYMENT_ID, "wrong_secret"),
    };
    await handler(mockReq(body), res);
    expect(res.statusCode).toBe(400);
    // Only the auth call happened — no Razorpay order fetch, no Supabase write.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects a tampered payment id even if it superficially matches format rules", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(authOk());
    const res = mockRes();
    const validSig = sign(ORDER_ID, PAYMENT_ID);
    await handler(mockReq({ razorpay_order_id: ORDER_ID, razorpay_payment_id: "pay_TAMPEREDID12", razorpay_signature: validSig }), res);
    expect(res.statusCode).toBe(400);
  });

  it("accepts a correctly signed payload and proceeds past signature verification", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(authOk())
      .mockResolvedValueOnce(razorpayOrderOk({ employerId: "emp-1", mode: "single", matchIds: "m1" }, 5900))
      .mockResolvedValueOnce({ ok: true, status: 201 }) // payment recorded
      .mockResolvedValueOnce({ ok: true, json: async () => [] }); // match lookup empty -> proves we got past signature check
    const res = mockRes();
    await handler(mockReq(validPaymentBody()), res);
    expect(res.statusCode).toBe(200);
    expect((res.body as { partial: boolean }).partial).toBe(true);
  });
});

describe("employer-verify-unlock-payment — order ownership & state", () => {
  it("403s when the order's noted employer doesn't match the caller", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(authOk("emp-1"))
      .mockResolvedValueOnce(razorpayOrderOk({ employerId: "some-other-employer", mode: "single", matchIds: "m1" }, 5900));
    const res = mockRes();
    await handler(mockReq(validPaymentBody()), res);
    expect(res.statusCode).toBe(403);
  });

  it("403s when the order carries no matchIds", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(authOk())
      .mockResolvedValueOnce(razorpayOrderOk({ employerId: "emp-1", mode: "single", matchIds: "" }, 5900));
    const res = mockRes();
    await handler(mockReq(validPaymentBody()), res);
    expect(res.statusCode).toBe(403);
  });

  it("still records the payment and reports a partial result when the matches referenced by the order no longer exist (C1 — payment already captured by Razorpay)", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(authOk())
      .mockResolvedValueOnce(razorpayOrderOk({ employerId: "emp-1", mode: "single", matchIds: "m1" }, 5900))
      .mockResolvedValueOnce({ ok: true, status: 201 })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });
    const res = mockRes();
    await handler(mockReq(validPaymentBody()), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ unlocked: [], partial: true });
    // The payment insert happened before the (failed) match lookup.
    const insertCall = fetchMock.mock.calls.find(([url]) => String(url).includes("employer_unlock_payments"));
    expect(insertCall).toBeDefined();
  });

  it("400s when matches span multiple requirements", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(authOk())
      .mockResolvedValueOnce(razorpayOrderOk({ employerId: "emp-1", mode: "batch", matchIds: "m1,m2" }, 29900))
      .mockResolvedValueOnce({ ok: true, status: 201 })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: "m1", requirement_id: "req-1", candidate_user_id: "cand-1", unlocked: false },
          { id: "m2", requirement_id: "req-2", candidate_user_id: "cand-2", unlocked: false },
        ],
      });
    const res = mockRes();
    await handler(mockReq(validPaymentBody()), res);
    expect(res.statusCode).toBe(400);
  });

  it("still unlocks even if the requirement has since been closed — a captured payment isn't undone by a later status change", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(authOk())
      .mockResolvedValueOnce(razorpayOrderOk({ employerId: "emp-1", mode: "single", matchIds: "m1" }, 5900))
      .mockResolvedValueOnce({ ok: true, status: 201 })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: "m1", requirement_id: "req-1", candidate_user_id: "cand-1", unlocked: false }],
      })
      .mockResolvedValueOnce({ ok: true, status: 200 }) // requirement_matches patch
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: "cand-1", name: "Priya Sharma", email: "priya@example.com" }] });
    const res = mockRes();
    await handler(mockReq(validPaymentBody()), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      unlocked: true,
      candidates: [{ matchId: "m1", name: "Priya Sharma", contact: { email: "priya@example.com" } }],
    });
  });
});

describe("employer-verify-unlock-payment — successful unlock", () => {
  it("unlocks a single candidate, records the payment, and returns their contact details", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(authOk())
      .mockResolvedValueOnce(razorpayOrderOk({ employerId: "emp-1", mode: "single", matchIds: "m1" }, 5900))
      .mockResolvedValueOnce({ ok: true, status: 201 }) // employer_unlock_payments insert
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: "m1", requirement_id: "req-1", candidate_user_id: "cand-1", unlocked: false }],
      })
      .mockResolvedValueOnce({ ok: true, status: 200 }) // requirement_matches patch
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: "cand-1", name: "Priya Sharma", email: "priya@example.com" }] });

    const res = mockRes();
    await handler(mockReq(validPaymentBody()), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      unlocked: true,
      candidates: [{ matchId: "m1", name: "Priya Sharma", contact: { email: "priya@example.com" } }],
    });

    const insertCall = fetchMock.mock.calls.find(([url]) => String(url).includes("employer_unlock_payments"));
    const insertBody = JSON.parse((insertCall![1] as RequestInit).body as string);
    expect(insertBody).toMatchObject({ match_id: "m1", employer_id: "emp-1", amount: 5900, currency: "INR" });

    const patchCall = fetchMock.mock.calls.find(([, opts]) => (opts as RequestInit | undefined)?.method === "PATCH");
    expect(patchCall).toBeDefined();
    expect(String(patchCall![0])).toContain("requirement_matches");
  });

  it("treats a 409 dedup response as an idempotent replay instead of erroring", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(authOk())
      .mockResolvedValueOnce(razorpayOrderOk({ employerId: "emp-1", mode: "single", matchIds: "m1" }, 5900))
      .mockResolvedValueOnce({ ok: false, status: 409 }) // already recorded — replayed verify call
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: "m1", requirement_id: "req-1", candidate_user_id: "cand-1", unlocked: true }],
      })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: "cand-1", name: "Priya Sharma", email: "priya@example.com" }] });

    const res = mockRes();
    await handler(mockReq(validPaymentBody()), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      unlocked: true,
      candidates: [{ matchId: "m1", name: "Priya Sharma", contact: { email: "priya@example.com" } }],
    });
    // Already unlocked — no PATCH call should have been issued.
    const patchCall = fetchMock.mock.calls.find(([, opts]) => (opts as RequestInit | undefined)?.method === "PATCH");
    expect(patchCall).toBeUndefined();
  });

  it("500s when the payment insert fails for a reason other than dedup", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(authOk())
      .mockResolvedValueOnce(razorpayOrderOk({ employerId: "emp-1", mode: "single", matchIds: "m1" }, 5900))
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => "db error" });

    const res = mockRes();
    await handler(mockReq(validPaymentBody()), res);
    expect(res.statusCode).toBe(500);
  });

  it("unlocks a full batch of candidates and charges/records ₹299 total", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    const matchIds = Array.from({ length: 10 }, (_, i) => `m${i}`);
    fetchMock
      .mockResolvedValueOnce(authOk())
      .mockResolvedValueOnce(razorpayOrderOk({ employerId: "emp-1", mode: "batch", matchIds: matchIds.join(",") }, 29900))
      .mockResolvedValueOnce({ ok: true, status: 201 })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => matchIds.map((id, i) => ({ id, requirement_id: "req-1", candidate_user_id: `cand-${i}`, unlocked: false })),
      })
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => matchIds.map((_, i) => ({ id: `cand-${i}`, name: `Candidate ${i}`, email: `c${i}@example.com` })),
      });

    const res = mockRes();
    const body = {
      razorpay_order_id: ORDER_ID,
      razorpay_payment_id: PAYMENT_ID,
      razorpay_signature: sign(ORDER_ID, PAYMENT_ID),
    };
    await handler(mockReq(body), res);

    expect(res.statusCode).toBe(200);
    expect((res.body as { candidates: unknown[] }).candidates).toHaveLength(10);

    const insertCall = fetchMock.mock.calls.find(([url]) => String(url).includes("employer_unlock_payments"));
    const insertBody = JSON.parse((insertCall![1] as RequestInit).body as string);
    expect(insertBody).toMatchObject({ match_ids: matchIds, amount: 29900, currency: "INR" });
    expect(insertBody.match_id).toBeUndefined();
  });
});
