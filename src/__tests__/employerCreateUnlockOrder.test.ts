import { describe, it, expect, vi, beforeEach } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";

/* Handler-level tests for employer-create-unlock-order.ts — the money path
 * that decides what an employer gets charged (₹59 single / ₹299 batch) and
 * which candidates a batch order actually covers. _shared.ts is mocked so
 * these run without real Supabase/network config; Razorpay is a mocked
 * global.fetch so no real orders are ever created. */

process.env.RAZORPAY_KEY_ID = "rzp_test_key123";
process.env.RAZORPAY_KEY_SECRET = "test_secret_abc";

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
  // "auth check" call via authOk()/authFail() below) so existing tests keep
  // driving auth through fetch responses rather than needing their own mock.
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
  };
});

const { default: handler } = await import("../../server-handlers/employer-create-unlock-order");

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

describe("employer-create-unlock-order — request gating", () => {
  it("403s when the origin isn't allowed", async () => {
    applyCorsHeaders.mockReturnValue("");
    const res = mockRes();
    await handler(mockReq({ mode: "single", matchId: "m1" }), res);
    expect(res.statusCode).toBe(403);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("429s and sets Retry-After when rate limited", async () => {
    isRateLimited.mockResolvedValue(true);
    const res = mockRes();
    await handler(mockReq({ mode: "single", matchId: "m1" }), res);
    expect(res.statusCode).toBe(429);
    expect(res.headers["Retry-After"]).toBe("60");
  });

  it("401s with no Authorization header", async () => {
    const res = mockRes();
    await handler(mockReq({ mode: "single", matchId: "m1" }, { headers: { origin: "https://app.hirestepx.com" } }), res);
    expect(res.statusCode).toBe(401);
  });

  it("401s when the Supabase auth lookup rejects the token", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false });
    const res = mockRes();
    await handler(mockReq({ mode: "single", matchId: "m1" }), res);
    expect(res.statusCode).toBe(401);
  });

  it("400s when single mode is missing matchId", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(authOk());
    const res = mockRes();
    await handler(mockReq({ mode: "single" }), res);
    expect(res.statusCode).toBe(400);
  });

  it("400s when batch mode is missing requirementId", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(authOk());
    const res = mockRes();
    await handler(mockReq({ mode: "batch" }), res);
    expect(res.statusCode).toBe(400);
  });
});

describe("employer-create-unlock-order — single mode (₹59)", () => {
  it("404s when the match doesn't exist", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(authOk())
      .mockResolvedValueOnce({ ok: true, json: async () => [] });
    const res = mockRes();
    await handler(mockReq({ mode: "single", matchId: "missing" }), res);
    expect(res.statusCode).toBe(404);
  });

  it("409s when the candidate is already unlocked", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(authOk())
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: "m1", requirement_id: "req-1", candidate_user_id: "cand-1", match_score: 80, unlocked: true }],
      });
    const res = mockRes();
    await handler(mockReq({ mode: "single", matchId: "m1" }), res);
    expect(res.statusCode).toBe(409);
  });

  it("403s when the caller doesn't own the requirement", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(authOk())
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: "m1", requirement_id: "req-1", candidate_user_id: "cand-1", match_score: 80, unlocked: false }],
      })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });
    const res = mockRes();
    await handler(mockReq({ mode: "single", matchId: "m1" }), res);
    expect(res.statusCode).toBe(403);
  });

  it("409s when the requirement is closed", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(authOk())
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: "m1", requirement_id: "req-1", candidate_user_id: "cand-1", match_score: 80, unlocked: false }],
      })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: "req-1", status: "closed" }] });
    const res = mockRes();
    await handler(mockReq({ mode: "single", matchId: "m1" }), res);
    expect(res.statusCode).toBe(409);
  });

  it("502s when Razorpay order creation fails", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(authOk())
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: "m1", requirement_id: "req-1", candidate_user_id: "cand-1", match_score: 80, unlocked: false }],
      })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: "req-1", status: "open" }] })
      .mockResolvedValueOnce({ ok: false, status: 401, text: async () => "bad credentials" });
    const res = mockRes();
    await handler(mockReq({ mode: "single", matchId: "m1" }), res);
    expect(res.statusCode).toBe(502);
  });

  it("charges exactly ₹59 (5900 paise) for a single unlock and echoes the real key/order id", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(authOk())
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: "m1", requirement_id: "req-1", candidate_user_id: "cand-1", match_score: 80, unlocked: false }],
      })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: "req-1", status: "open" }] })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "order_single_1", amount: 5900, currency: "INR" }) });

    const res = mockRes();
    await handler(mockReq({ mode: "single", matchId: "m1" }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      orderId: "order_single_1",
      amount: 5900,
      currency: "INR",
      keyId: "rzp_test_key123",
      name: "Unlock candidate",
      description: "Employer contact unlock — HireStepX",
    });

    // The amount Razorpay is told to charge is server-derived, never from the request body.
    const razorpayCall = fetchMock.mock.calls.find(([url]) => String(url).includes("api.razorpay.com"));
    const sentBody = JSON.parse((razorpayCall![1] as RequestInit).body as string);
    expect(sentBody.amount).toBe(5900);
    expect(sentBody.notes).toEqual({ employerId: "emp-1", mode: "single", matchIds: "m1" });
  });
});

describe("employer-create-unlock-order — batch mode (₹299 / 10)", () => {
  it("409s when every candidate in the requirement is already unlocked", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    const allUnlocked = Array.from({ length: 10 }, (_, i) => ({ id: `m${i}`, unlocked: true }));
    fetchMock
      .mockResolvedValueOnce(authOk())
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: "req-1", status: "open" }] })
      .mockResolvedValueOnce({ ok: true, json: async () => allUnlocked });
    const res = mockRes();
    await handler(mockReq({ mode: "batch", requirementId: "req-1" }), res);
    expect(res.statusCode).toBe(409);
  });

  it("409s when the requirement is closed", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(authOk())
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: "req-1", status: "closed" }] });
    const res = mockRes();
    await handler(mockReq({ mode: "batch", requirementId: "req-1" }), res);
    expect(res.statusCode).toBe(409);
  });

  it("charges exactly ₹299 (29900 paise) for a full batch of 10", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    const matches = Array.from({ length: 10 }, (_, i) => ({ id: `m${i}`, unlocked: false }));
    fetchMock
      .mockResolvedValueOnce(authOk())
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: "req-1", status: "open" }] })
      .mockResolvedValueOnce({ ok: true, json: async () => matches })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "order_batch_1", amount: 29900, currency: "INR" }) });

    const res = mockRes();
    await handler(mockReq({ mode: "batch", requirementId: "req-1" }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ amount: 29900, name: "Unlock batch of 10" });

    const razorpayCall = fetchMock.mock.calls.find(([url]) => String(url).includes("api.razorpay.com"));
    const sentBody = JSON.parse((razorpayCall![1] as RequestInit).body as string);
    expect(sentBody.amount).toBe(29900);
    expect(sentBody.notes.matchIds.split(",").sort()).toHaveLength(10);
  });

  it("charges proportionally (not the full ₹299) for a partial remaining batch — fixes the C3 overcharge", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    // 15 candidates: batch 0 (rank 0-9) fully unlocked already, batch 1 (rank 10-14) not — batch 1 is next,
    // and only has 5 still-locked candidates left, so it should cost 5 * ₹29.90, not the full ₹299.
    const matches = [
      ...Array.from({ length: 10 }, (_, i) => ({ id: `batch0-${i}`, unlocked: true })),
      ...Array.from({ length: 5 }, (_, i) => ({ id: `batch1-${i}`, unlocked: false })),
    ];
    fetchMock
      .mockResolvedValueOnce(authOk())
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: "req-1", status: "open" }] })
      .mockResolvedValueOnce({ ok: true, json: async () => matches })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "order_batch_1", amount: 14950, currency: "INR" }) });

    const res = mockRes();
    await handler(mockReq({ mode: "batch", requirementId: "req-1" }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ amount: 14950, name: "Unlock 5 candidates" });

    const razorpayCall = fetchMock.mock.calls.find(([url]) => String(url).includes("api.razorpay.com"));
    const sentBody = JSON.parse((razorpayCall![1] as RequestInit).body as string);
    expect(sentBody.amount).toBe(14950);
    // Only the still-locked candidates in the next batch are targeted — never batch 0, already paid for.
    expect(sentBody.notes.matchIds.split(",").sort()).toEqual(["batch1-0", "batch1-1", "batch1-2", "batch1-3", "batch1-4"]);
  });
});
