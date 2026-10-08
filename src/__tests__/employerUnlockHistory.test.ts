import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

const withAuthAndRateLimit = vi.fn();
const slogError = vi.fn();

vi.mock("../../server-handlers/_shared", () => ({
  withAuthAndRateLimit: (...args: unknown[]) => withAuthAndRateLimit(...args),
  corsHeaders: () => ({}),
  withRequestId: (h: Record<string, string>) => h,
  slog: { error: (...args: unknown[]) => slogError(...args) },
}));

const { default: handler } = await import("../../server-handlers/employer-unlock-history");

function req() {
  return new Request("https://x.test/api/employer-unlock-history", { method: "GET" });
}

beforeEach(() => {
  vi.restoreAllMocks();
  withAuthAndRateLimit.mockResolvedValue({ auth: { userId: "emp-1" }, headers: {} });
});

describe("employer-unlock-history handler", () => {
  it("returns 401 when unauthenticated", async () => {
    withAuthAndRateLimit.mockResolvedValue({ auth: { userId: null }, headers: {} });
    const res = await handler(req());
    expect(res.status).toBe(401);
  });

  it("returns purchases with candidate snapshots on the happy path", async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: "p1", match_id: "m1", match_ids: null, amount: 5900, currency: "INR", created_at: "2026-10-01T00:00:00Z" }],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: "m1", unlocked_candidate_name: "Priya Sharma", unlocked_candidate_email: "priya@example.com" }],
      });

    const res = await handler(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.purchases).toEqual([
      {
        id: "p1",
        matchIds: ["m1"],
        amount: 5900,
        currency: "INR",
        createdAt: "2026-10-01T00:00:00Z",
        candidates: [{ matchId: "m1", name: "Priya Sharma", email: "priya@example.com" }],
      },
    ]);
  });

  it("still returns the purchase list when the candidate-snapshot columns don't exist yet (supabase-migrations/0026 not applied) instead of 500ing", async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: "p1", match_id: "m1", match_ids: null, amount: 5900, currency: "INR", created_at: "2026-10-01T00:00:00Z" }],
      })
      // PostgREST rejects the unknown-column select with a 400 + a JSON
      // error BODY (not an array) — the historical bug iterated this object
      // directly and threw "not iterable", turning a cosmetic lookup failure
      // into a full 500 for the whole endpoint.
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ code: "42703", message: 'column "unlocked_candidate_name" does not exist' }),
      });

    const res = await handler(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.purchases).toEqual([
      {
        id: "p1",
        matchIds: ["m1"],
        amount: 5900,
        currency: "INR",
        createdAt: "2026-10-01T00:00:00Z",
        candidates: [{ matchId: "m1", name: null, email: null }],
      },
    ]);
    expect(slogError).toHaveBeenCalledWith(
      "employer-unlock-history candidate snapshot lookup failed",
      expect.objectContaining({ status: 400 }),
    );
  });

  it("500s when the primary purchase list query itself fails", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 500 });
    const res = await handler(req());
    expect(res.status).toBe(500);
  });
});
