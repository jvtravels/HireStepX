import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

const withAuthAndRateLimit = vi.fn();
vi.mock("../../server-handlers/_shared", () => ({
  withAuthAndRateLimit: (...a: unknown[]) => withAuthAndRateLimit(...a),
  corsHeaders: () => ({}),
  withRequestId: (h: Record<string, string>) => h,
}));

const { default: handler } = await import("../../server-handlers/interview-turns");

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const t = (n: number, session = "s1") => ({ id: id(n), session_id: session, turn_index: n, turn_type: "answer", speaker: "user", content: "a", metadata: null });
const post = (body: unknown) => new Request("https://x.test/api/interview-turns", { method: "POST", body: JSON.stringify(body) });

beforeEach(() => {
  withAuthAndRateLimit.mockResolvedValue({ auth: { userId: "u1" }, headers: {} });
});

describe("interview-turns handler", () => {
  it("401s without a user", async () => {
    withAuthAndRateLimit.mockResolvedValue({ auth: { userId: null }, headers: {} });
    expect((await handler(post({ turns: [t(1)] }), vi.fn())).status).toBe(401);
  });

  it("400s on empty or missing turns", async () => {
    expect((await handler(post({ turns: [] }), vi.fn())).status).toBe(400);
    expect((await handler(post({}), vi.fn())).status).toBe(400);
  });

  it("inserts with ignore-duplicates, forces user_id, and reports saved/retry/dropped", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: "s1" }] })
      .mockResolvedValueOnce({ ok: true });
    const res = await handler(post({ turns: [t(1), t(2, "ghost"), { id: id(3), bad: true }] }), fetchImpl);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, saved: [id(1)], retry: [id(2)], dropped: [id(3)] });

    const [url, init] = fetchImpl.mock.calls[1];
    expect(String(url)).toContain("on_conflict=id");
    expect(init.headers.Prefer).toContain("ignore-duplicates");
    expect(JSON.parse(init.body)).toEqual([expect.objectContaining({ id: id(1), user_id: "u1" })]);
    expect(String(fetchImpl.mock.calls[0][0])).toContain("user_id=eq.u1");
  });

  it("returns 502 (so the client keeps the turns) when the insert fails", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: "s1" }] })
      .mockResolvedValueOnce({ ok: false });
    expect((await handler(post({ turns: [t(1)] }), fetchImpl)).status).toBe(502);
  });

  it("returns 502 when fetch throws", async () => {
    expect((await handler(post({ turns: [t(1)] }), vi.fn().mockRejectedValue(new Error("x")))).status).toBe(502);
  });
});
