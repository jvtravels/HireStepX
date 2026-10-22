import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

const withAuthAndRateLimit = vi.fn();
vi.mock("../../server-handlers/_shared", () => ({
  withAuthAndRateLimit: (...a: unknown[]) => withAuthAndRateLimit(...a),
  corsHeaders: () => ({}),
  withRequestId: (h: Record<string, string>) => h,
  slog: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

const { default: handler } = await import("../../server-handlers/employer-requirement-activity");

const get = (qs = "?id=req-1", method = "GET") => handler(new Request(`https://x.test/api/employer-requirement-activity${qs}`, { method }));
const json = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => body });

beforeEach(() => {
  withAuthAndRateLimit.mockReset();
  withAuthAndRateLimit.mockResolvedValue({ auth: { userId: "emp-1" }, headers: {} });
});

describe("employer-requirement-activity GET", () => {
  it("returns the owner's activity mapped to camelCase, scoped by employer_id", async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(json([{ id: "req-1" }]))
      .mockResolvedValueOnce(json([{ id: "a1", action: "created", detail: null, created_at: "2026-10-01T00:00:00Z" }]));
    global.fetch = f as unknown as typeof fetch;
    const res = await get();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ activity: [{ id: "a1", action: "created", detail: null, createdAt: "2026-10-01T00:00:00Z" }] });
    expect(String(f.mock.calls[0][0])).toContain("employer_id=eq.emp-1");
  });

  it("404s for a requirement the caller does not own and never reads the log", async () => {
    const f = vi.fn().mockResolvedValueOnce(json([]));
    global.fetch = f as unknown as typeof fetch;
    expect((await get()).status).toBe(404);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("400s without an id, 405s on POST and 401s unauthenticated", async () => {
    global.fetch = vi.fn() as unknown as typeof fetch;
    expect((await get("")).status).toBe(400);
    expect((await get("?id=req-1", "POST")).status).toBe(405);
    withAuthAndRateLimit.mockResolvedValue({ auth: { userId: null }, headers: {} });
    expect((await get()).status).toBe(401);
  });

  it("500s when the activity read fails", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(json([{ id: "req-1" }])).mockResolvedValueOnce(json({}, false)) as unknown as typeof fetch;
    expect((await get()).status).toBe(500);
  });
});
