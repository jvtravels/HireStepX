import { describe, it, expect, vi, beforeEach } from "vitest";

const slogError = vi.fn();
vi.mock("../../server-handlers/_shared", () => ({
  slog: { error: (...a: unknown[]) => slogError(...a), warn: vi.fn(), info: vi.fn() },
  supabaseUrl: () => "https://example.supabase.co",
  supabaseServiceHeaders: () => ({ apikey: "k" }),
}));
const sweep = vi.fn();
vi.mock("../../server-handlers/_employer-credit-sweep", () => ({ sweepUnreachableCredits: (...a: unknown[]) => sweep(...a) }));
const recordCronSuccess = vi.fn();
vi.mock("../../server-handlers/_cron-heartbeat", () => ({ recordCronSuccess: (...a: unknown[]) => recordCronSuccess(...a) }));

const { default: handler } = await import("../../server-handlers/cron-credit-no-response");

const call = (auth: string | null) => handler(new Request("https://x.test/api/cron-credit-no-response", { headers: auth ? { authorization: auth } : {} }));

beforeEach(() => {
  sweep.mockReset();
  recordCronSuccess.mockReset();
  slogError.mockReset();
  process.env.CRON_SECRET = "cron-secret";
});

describe("cron-credit-no-response", () => {
  it("fails closed with 401 when CRON_SECRET is unset, even for a bare 'Bearer ' header", async () => {
    process.env.CRON_SECRET = "";
    expect((await call("Bearer ")).status).toBe(401);
    expect((await call(null)).status).toBe(401);
    expect(sweep).not.toHaveBeenCalled();
  });

  it("401s on a wrong secret and does not sweep", async () => {
    expect((await call("Bearer nope")).status).toBe(401);
    expect(sweep).not.toHaveBeenCalled();
    expect(recordCronSuccess).not.toHaveBeenCalled();
  });

  it("runs the sweep, returns its summary and records the heartbeat", async () => {
    sweep.mockResolvedValue({ credited: 2, skipped: 1 });
    const res = await call("Bearer cron-secret");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, credited: 2, skipped: 1 });
    expect(sweep).toHaveBeenCalledWith({ base: "https://example.supabase.co", headers: { apikey: "k" } });
    expect(recordCronSuccess).toHaveBeenCalledWith("cron-credit-no-response");
  });

  it("500s and records NO heartbeat when the sweep throws", async () => {
    sweep.mockRejectedValue(new Error("db down"));
    const res = await call("Bearer cron-secret");
    expect(res.status).toBe(500);
    expect(recordCronSuccess).not.toHaveBeenCalled();
    expect(slogError).toHaveBeenCalled();
  });
});
