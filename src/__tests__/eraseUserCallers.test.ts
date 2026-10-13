import { describe, it, expect, vi, beforeEach } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";

/* Both erasure entry points must delegate to the ONE shared routine, so the immediate path
 * and the 7-day cron can never drift apart again. */

process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
process.env.CRON_SECRET = "cron-secret";

const eraseUserData = vi.fn();
vi.mock("../../server-handlers/_erase-user", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../server-handlers/_erase-user")>();
  return { ...actual, eraseUserData: (...a: unknown[]) => eraseUserData(...a) };
});
vi.mock("../../server-handlers/_posthog", () => ({ captureServerEvent: vi.fn() }));

const withNodeAuthAndRateLimit = vi.fn();
vi.mock("../../server-handlers/_shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../server-handlers/_shared")>();
  return {
    ...actual,
    withNodeAuthAndRateLimit: (...a: unknown[]) => withNodeAuthAndRateLimit(...a),
    supabaseUrl: () => "https://proj.supabase.co",
    supabaseAnonKey: () => "anon",
  };
});

const { default: deleteAccount } = await import("../../server-handlers/delete-account");
const { default: cleanup } = await import("../../server-handlers/cleanup-deleted-accounts");

function mockRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    setHeader() { return res; },
    status(c: number) { res.statusCode = c; return res; },
    json(p: unknown) { res.body = p; return res; },
  };
  return res as unknown as VercelResponse & typeof res;
}

const okResult = { ok: true, failedSteps: [], retainedFinancialRecords: false, auth: "deleted", counts: {}, processors: { posthog: "skipped", google: "none" } };

beforeEach(() => {
  eraseUserData.mockReset();
  eraseUserData.mockResolvedValue(okResult);
  withNodeAuthAndRateLimit.mockReset();
});

describe("erasure entry points share eraseUserData", () => {
  it("delete-account (hard) calls it with trigger user_hard and the caller's id", async () => {
    withNodeAuthAndRateLimit.mockResolvedValue({ handled: false, userId: "u-1", userEmail: "a@b.c", userData: { app_metadata: { provider: "google", providers: ["google"] } } });
    const res = mockRes();
    await deleteAccount({ method: "POST", headers: {}, body: { hard: true } } as unknown as VercelRequest, res);
    expect(res.statusCode).toBe(200);
    expect(eraseUserData).toHaveBeenCalledTimes(1);
    expect(eraseUserData.mock.calls[0][0]).toMatchObject({ trigger: "user_hard", supabaseUrl: "https://proj.supabase.co" });
    expect(eraseUserData.mock.calls[0][1]).toBe("u-1");
  });

  it("the cron calls it once per due account with trigger scheduled", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify([{ id: "u-1" }, { id: "u-2" }]), { status: 200 })) as unknown as typeof fetch;
    const res = mockRes();
    await cleanup({ method: "GET", headers: { authorization: "Bearer cron-secret" } } as unknown as VercelRequest, res);
    expect(res.statusCode).toBe(200);
    expect(eraseUserData.mock.calls.map((c) => c[1])).toEqual(["u-1", "u-2"]);
    expect(eraseUserData.mock.calls.every((c) => c[0].trigger === "scheduled")).toBe(true);
    expect(res.body).toEqual({ deleted: 2, retained: 0, failed: 0 });
  });

  it("the cron keeps going after a failed account and reports it (retried next run)", async () => {
    eraseUserData.mockResolvedValueOnce({ ...okResult, ok: false, failedSteps: ["sessions"], auth: "not_attempted" });
    global.fetch = vi.fn(async () => new Response(JSON.stringify([{ id: "u-1" }, { id: "u-2" }]), { status: 200 })) as unknown as typeof fetch;
    const res = mockRes();
    await cleanup({ method: "GET", headers: { authorization: "Bearer cron-secret" } } as unknown as VercelRequest, res);
    expect(eraseUserData).toHaveBeenCalledTimes(2);
    expect(res.body).toEqual({ deleted: 1, retained: 0, failed: 1 });
  });

  it("the cron rejects callers without the secret and never erases", async () => {
    const res = mockRes();
    await cleanup({ method: "GET", headers: {} } as unknown as VercelRequest, res);
    expect(res.statusCode).toBe(401);
    expect(eraseUserData).not.toHaveBeenCalled();
  });
});
