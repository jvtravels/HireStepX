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

const { default: handler } = await import("../../server-handlers/employer-credit");

const get = (method = "GET") => handler(new Request("https://x.test/api/employer-credit", { method }));

beforeEach(() => {
  withAuthAndRateLimit.mockReset();
  withAuthAndRateLimit.mockResolvedValue({ auth: { userId: "emp-1" }, headers: {} });
});

describe("employer-credit GET", () => {
  it("returns the signed ledger sum as balancePaise with labelled events", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { amount: -2_000, kind: "spend", reason: null, match_id: null, order_ref: "o1", created_at: "2026-10-02T00:00:00Z" },
        { amount: 5_000, kind: "refund", reason: "declined", match_id: "m1", order_ref: null, created_at: "2026-10-01T00:00:00Z" },
      ],
    }) as unknown as typeof fetch;
    const res = await get();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.balancePaise).toBe(3_000);
    expect(body.events).toHaveLength(2);
    expect(body.events[0]).toMatchObject({ kind: "spend", amountPaise: -2_000, label: "Applied to an unlock" });
  });

  it("answers a zero balance, not an error, when the ledger table is not migrated", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }) as unknown as typeof fetch;
    const res = await get();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ balancePaise: 0, owedPaise: 0, events: [] });
  });

  it("clamps a negative balance (a clawback after the credit was spent) to 0 and reports what is owed", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { amount: -2_000, kind: "spend", reason: null, match_id: null, order_ref: "o1", created_at: "2026-10-03T00:00:00Z" },
        { amount: -3_000, kind: "clawback", reason: "payment_refunded", match_id: "m1", order_ref: "clawback:o0:m1", created_at: "2026-10-02T00:00:00Z" },
        { amount: 3_000, kind: "refund", reason: "declined", match_id: "m1", order_ref: "o0", created_at: "2026-10-01T00:00:00Z" },
      ],
    }) as unknown as typeof fetch;
    const body = await (await get()).json();
    expect(body.balancePaise).toBe(0);
    expect(body.owedPaise).toBe(2_000);
    expect(body.events[1]).toMatchObject({ kind: "clawback", label: "Reversed: Payment refunded" });
  });

  it("scopes the read to the caller and rejects non-GET and anonymous requests", async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    global.fetch = f as unknown as typeof fetch;
    await get();
    expect(String(f.mock.calls[0][0])).toContain("employer_id=eq.emp-1");
    expect((await get("POST")).status).toBe(405);
    withAuthAndRateLimit.mockResolvedValue({ auth: { userId: null }, headers: {} });
    expect((await get()).status).toBe(401);
  });
});
