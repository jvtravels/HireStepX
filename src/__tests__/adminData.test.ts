import { describe, it, expect, vi, beforeEach } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";

/* Handler-level tests for admin-data.ts — the admin dashboard API. This is
 * the highest privilege-escalation-risk surface in the codebase (it can ban/
 * delete any user, extend subscriptions for free, grant credits, and issue
 * Razorpay refunds) and had zero direct unit tests before this file.
 *
 * Env vars are set before the (static) import below because admin-data.ts
 * reads ADMIN_PASSWORD / SUPABASE_URL / RAZORPAY_* at module load time —
 * mirroring the pattern in adminAuth.test.ts and
 * employerVerifyUnlockPayment.test.ts. isRateLimited / getClientIp from
 * _shared are mocked so tests don't depend on real rate-limit state; the
 * real _admin-auth module is used as-is (createAdminToken/verifyAdminToken)
 * so tests mint and verify real tokens, the same way admin-data and the
 * admin dashboard client actually interoperate. */

process.env.ADMIN_PASSWORD = "correct-horse-battery-staple";
process.env.ADMIN_SESSION_SECRET = "test-admin-session-secret";
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
process.env.RAZORPAY_KEY_ID = "rzp_test_id";
process.env.RAZORPAY_KEY_SECRET = "rzp_test_secret";
process.env.RESEND_API_KEY = "resend-key";

const isRateLimited = vi.fn();
const getClientIp = vi.fn();

vi.mock("../../server-handlers/_shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../server-handlers/_shared")>();
  return {
    ...actual,
    isRateLimited: (...args: unknown[]) => isRateLimited(...(args as Parameters<typeof actual.isRateLimited>)),
    getClientIp: (...args: unknown[]) => getClientIp(...(args as Parameters<typeof actual.getClientIp>)),
  };
});

const { default: handler } = await import("../../server-handlers/admin-data");
const { createAdminToken } = await import("../../server-handlers/_admin-auth");
const { razorpayBasicAuth } = await import("../../server-handlers/_razorpay-auth");

function mockReq(body: Record<string, unknown>, headers: Record<string, string> = {}): VercelRequest {
  return {
    method: "POST",
    headers,
    body,
  } as unknown as VercelRequest;
}

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    ended: false,
    setHeader(key: string, value: string) { res.headers[key] = value; return res; },
    status(code: number) { res.statusCode = code; return res; },
    json(payload: unknown) { res.body = payload; return res; },
    end() { res.ended = true; return res; },
  };
  return res as unknown as VercelResponse & typeof res;
}

const VALID_TOKEN = createAdminToken();

function authedReq(body: Record<string, unknown>) {
  return mockReq(body, { "x-admin-token": VALID_TOKEN });
}

beforeEach(() => {
  vi.clearAllMocks();
  isRateLimited.mockResolvedValue(false);
  getClientIp.mockReturnValue("1.2.3.4");
  global.fetch = vi.fn();
});

describe("admin-data — auth gate", () => {
  it("204s on OPTIONS preflight without checking auth", async () => {
    const res = mockRes();
    await handler({ method: "OPTIONS", headers: {}, body: {} } as unknown as VercelRequest, res);
    expect(res.statusCode).toBe(204);
    expect(res.ended).toBe(true);
  });

  it("401s with no token, no cookie, and no key", async () => {
    const res = mockRes();
    await handler(mockReq({ section: "overview" }), res);
    expect(res.statusCode).toBe(401);
  });

  it("401s on a wrong x-admin-key and does not mint a token", async () => {
    const res = mockRes();
    await handler(mockReq({ section: "overview" }, { "x-admin-key": "nope" }), res);
    expect(res.statusCode).toBe(401);
  });

  it("401s once the admin-login bucket is rate-limited", async () => {
    isRateLimited.mockResolvedValue(true);
    const res = mockRes();
    await handler(mockReq({ section: "overview" }, { "x-admin-key": "correct-horse-battery-staple" }), res);
    expect(res.statusCode).toBe(401);
  });

  it("401s on a forged/garbage token", async () => {
    const res = mockRes();
    await handler(mockReq({ section: "overview" }, { "x-admin-token": "garbage.token" }), res);
    expect(res.statusCode).toBe(401);
  });

  it("accepts a valid x-admin-token and proceeds to validation logic", async () => {
    const res = mockRes();
    // ban-user with no userId — proves auth passed (400, not 401) without
    // needing to mock any Supabase calls.
    await handler(authedReq({ action: "ban-user" }), res);
    expect(res.statusCode).toBe(400);
  });

  it("accepts a valid admin_token cookie as a fallback to the header", async () => {
    const res = mockRes();
    await handler(mockReq({ action: "ban-user" }, { cookie: `admin_token=${VALID_TOKEN}` }), res);
    expect(res.statusCode).toBe(400);
  });

  it("every successful response includes a fresh _token", async () => {
    const res = mockRes();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => "",
    });
    await handler(authedReq({ action: "unban-user", userId: "u1" }), res);
    expect(res.statusCode).toBe(200);
    expect(typeof (res.body as { _token: string })._token).toBe("string");
  });
});

describe("admin-data — input validation", () => {
  // All client-input validation failures throw ValidationError and map to
  // 400 Bad request. Previously the catch-all classified by string-matching
  // the error message for "required"/"Unknown", which misclassified several
  // of these (format/range validation) as 500 Internal server error — fixed
  // by introducing a dedicated ValidationError type (see admin-data.ts).
  const badRequestCases: Array<[string, Record<string, unknown>]> = [
    ["user-detail missing userId", { action: "user-detail" }],
    ["session-detail missing sessionId", { action: "session-detail" }],
    ["update-support-status missing id", { action: "update-support-status" }],
    ["extend-subscription missing userId", { action: "extend-subscription" }],
    ["grant-credits missing userId", { action: "grant-credits" }],
    ["ban-user missing userId", { action: "ban-user" }],
    ["unban-user missing userId", { action: "unban-user" }],
    ["delete-user missing userId", { action: "delete-user" }],
    ["approve-employer missing id", { action: "approve-employer" }],
    ["reject-employer missing id", { action: "reject-employer" }],
    ["refund-payment missing paymentId", { action: "refund-payment" }],
    ["send-email missing fields", { action: "send-email", userId: "u1" }],
    ["save-cost-reconciliation bad month format", { action: "save-cost-reconciliation", month: "2026", actualInvoiceInr: 100 }],
    ["unknown section", { action: "not-a-real-section" }],
    ["update-support-status bad status", { action: "update-support-status", id: "s1", status: "bogus" }],
    ["extend-subscription bad tier", { action: "extend-subscription", userId: "u1", tier: "pro" }],
    ["extend-subscription bad days", { action: "extend-subscription", userId: "u1", tier: "starter", days: 999 }],
    ["grant-credits bad qty", { action: "grant-credits", userId: "u1", qty: 0 }],
    ["grant-credits qty too large", { action: "grant-credits", userId: "u1", qty: 101 }],
    ["refund-payment bad amountPaise (too small)", { action: "refund-payment", paymentId: "pay_1", amountPaise: 50 }],
    ["refund-payment bad amountPaise (non-integer)", { action: "refund-payment", paymentId: "pay_1", amountPaise: 100.5 }],
    ["save-cost-reconciliation negative invoice", { action: "save-cost-reconciliation", month: "2026-07", actualInvoiceInr: -5 }],
  ];

  it.each(badRequestCases)("%s -> 400 Bad request", async (_label, body) => {
    const res = mockRes();
    await handler(authedReq(body), res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: "Bad request" });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe("admin-data — not configured", () => {
  it("503s when Supabase env is missing, even with valid auth", async () => {
    vi.resetModules();
    vi.stubEnv("SUPABASE_URL", "");
    const { default: freshHandler } = await import("../../server-handlers/admin-data");
    const res = mockRes();
    await freshHandler(authedReq({ action: "ban-user", userId: "u1" }), res);
    expect(res.statusCode).toBe(503);
    vi.unstubAllEnvs();
  });
});

describe("admin-data — ban-user / unban-user", () => {
  it("bans a user", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, json: async () => ({}) });
    const res = mockRes();
    await handler(authedReq({ action: "ban-user", userId: "u1" }), res);
    expect(res.statusCode).toBe(200);
    expect((res.body as { ok: boolean }).ok).toBe(true);
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(call[0])).toContain("/auth/v1/admin/users/u1");
    expect(JSON.parse((call[1] as RequestInit).body as string)).toEqual({ ban_duration: "876000h" });
  });

  it("reports failure when the auth ban call rejects", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 500, text: async () => "" });
    const res = mockRes();
    await handler(authedReq({ action: "ban-user", userId: "u1" }), res);
    expect(res.statusCode).toBe(200); // still 200 — the handler returns ok:false in the body
    expect((res.body as { ok: boolean }).ok).toBe(false);
  });

  it("unbans a user with ban_duration none", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, json: async () => ({}) });
    const res = mockRes();
    await handler(authedReq({ action: "unban-user", userId: "u1" }), res);
    expect((res.body as { ok: boolean }).ok).toBe(true);
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse((call[1] as RequestInit).body as string)).toEqual({ ban_duration: "none" });
  });
});

describe("admin-data — delete-user", () => {
  it("clears service_usage references then hard-deletes the auth user", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce({ ok: true }) // PATCH service_usage
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) }); // DELETE auth user
    const res = mockRes();
    await handler(authedReq({ action: "delete-user", userId: "u1" }), res);
    expect((res.body as { ok: boolean }).ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain("service_usage?user_id=eq.u1");
    expect(String(fetchMock.mock.calls[1][0])).toContain("/auth/v1/admin/users/u1");
  });

  it("stops and reports failure if clearing service_usage fails (never attempts the auth delete)", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce({ ok: false, status: 409, text: async () => "fk violation" });
    const res = mockRes();
    await handler(authedReq({ action: "delete-user", userId: "u1" }), res);
    expect((res.body as { ok: boolean; error: string }).ok).toBe(false);
    expect((res.body as { error: string }).error).toContain("service_usage");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports failure when the auth-user delete itself fails", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => "boom" });
    const res = mockRes();
    await handler(authedReq({ action: "delete-user", userId: "u1" }), res);
    expect((res.body as { ok: boolean; error: string }).ok).toBe(false);
    expect((res.body as { error: string }).error).toContain("Delete failed");
  });
});

describe("admin-data — refund-payment (Razorpay)", () => {
  it("signs the refund request with razorpayBasicAuth(KEY_ID, KEY_SECRET)", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: "rfnd_1", amount: 5000, status: "processed" }),
    });
    const res = mockRes();
    await handler(authedReq({ action: "refund-payment", paymentId: "pay_1" }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ ok: true, refundId: "rfnd_1", amount: 5000, status: "processed" });
    const call = fetchMock.mock.calls[0];
    expect(String(call[0])).toBe("https://api.razorpay.com/v1/payments/pay_1/refund");
    const expectedAuth = `Basic ${razorpayBasicAuth("rzp_test_id", "rzp_test_secret")}`;
    expect((call[1] as RequestInit & { headers: Record<string, string> }).headers.Authorization).toBe(expectedAuth);
  });

  it("passes a partial refund amount through in the request body", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: "rfnd_2" }) });
    const res = mockRes();
    await handler(authedReq({ action: "refund-payment", paymentId: "pay_1", amountPaise: 2500 }), res);
    const call = fetchMock.mock.calls[0];
    expect(JSON.parse((call[1] as RequestInit).body as string)).toEqual({ amount: 2500 });
  });

  it("surfaces a non-2xx Razorpay response as ok:false with the HTTP status", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue({ ok: false, status: 402, text: async () => "already refunded" });
    const res = mockRes();
    await handler(authedReq({ action: "refund-payment", paymentId: "pay_1" }), res);
    expect((res.body as { ok: boolean; error: string }).ok).toBe(false);
    expect((res.body as { error: string }).error).toContain("402");
  });

  it("refuses to call Razorpay at all when keys aren't configured", async () => {
    vi.resetModules();
    vi.stubEnv("RAZORPAY_KEY_ID", "");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "");
    const { default: freshHandler } = await import("../../server-handlers/admin-data");
    const res = mockRes();
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    await freshHandler(authedReq({ action: "refund-payment", paymentId: "pay_1" }), res);
    expect((res.body as { ok: boolean; error: string }).ok).toBe(false);
    expect((res.body as { error: string }).error).toContain("not configured");
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
});

describe("admin-data — extend-subscription", () => {
  it("extends a starter subscription and resets subscription_start (session-limit window)", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue({ ok: true });
    const res = mockRes();
    await handler(authedReq({ action: "extend-subscription", userId: "u1", tier: "starter", days: 30 }), res);
    expect((res.body as { ok: boolean }).ok).toBe(true);
    const call = fetchMock.mock.calls[0];
    const patch = JSON.parse((call[1] as RequestInit).body as string);
    expect(patch.subscription_tier).toBe("starter");
    expect(patch.subscription_start).toBeDefined();
    expect(patch.subscription_end).toBeDefined();
  });

  it("does not reset subscription_start when downgrading to free", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue({ ok: true });
    const res = mockRes();
    await handler(authedReq({ action: "extend-subscription", userId: "u1", tier: "free", days: 30 }), res);
    const call = fetchMock.mock.calls[0];
    const patch = JSON.parse((call[1] as RequestInit).body as string);
    expect(patch.subscription_start).toBeUndefined();
  });

  it("reports the Supabase PATCH failure instead of silently succeeding", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue({ ok: false, status: 500, text: async () => "db down" });
    const res = mockRes();
    await handler(authedReq({ action: "extend-subscription", userId: "u1", tier: "starter", days: 30 }), res);
    expect((res.body as { ok: boolean }).ok).toBe(false);
  });
});

describe("admin-data — grant-credits", () => {
  it("calls the grant_session_credits RPC and returns the new balance", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue({ ok: true, json: async () => 7 });
    const res = mockRes();
    await handler(authedReq({ action: "grant-credits", userId: "u1", qty: 3, note: "goodwill" }), res);
    expect(res.body).toMatchObject({ ok: true, qty: 3, note: "goodwill", newBalance: 7 });
    const call = fetchMock.mock.calls[0];
    expect(String(call[0])).toContain("/rpc/grant_session_credits");
    expect(JSON.parse((call[1] as RequestInit).body as string)).toEqual({ p_user_id: "u1", p_qty: 3, p_note: "goodwill" });
  });

  it("reports RPC failure", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue({ ok: false, status: 400, text: async () => "bad rpc" });
    const res = mockRes();
    await handler(authedReq({ action: "grant-credits", userId: "u1", qty: 3 }), res);
    expect((res.body as { ok: boolean }).ok).toBe(false);
  });
});

describe("admin-data — send-email", () => {
  it("looks up the user's email then sends via Resend", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [{ email: "user@example.com" }] })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "email_1" }) });
    const res = mockRes();
    await handler(authedReq({ action: "send-email", userId: "u1", subject: "Hi", htmlBody: "<p>hi</p>" }), res);
    expect(res.body).toMatchObject({ ok: true, emailId: "email_1", to: "user@example.com" });
  });

  it("fails when the user has no email on file", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => [] });
    const res = mockRes();
    await handler(authedReq({ action: "send-email", userId: "u1", subject: "Hi", htmlBody: "<p>hi</p>" }), res);
    expect((res.body as { ok: boolean; error: string }).error).toContain("email not found");
  });
});
