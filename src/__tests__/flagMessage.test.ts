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

const { default: handler } = await import("../../server-handlers/flag-message");

const MSG = "22222222-2222-4222-8222-222222222222";

function installFetch(existingFlag: boolean) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/rest/v1/conversation_messages")) return { ok: true, json: async () => [{ id: MSG, conversation_id: "c1", employer_id: "emp-1", candidate_user_id: "cand-1" }] };
    if (u.includes("/rest/v1/message_flags") && init?.method === "POST") return { ok: true, text: async () => "" };
    if (u.includes("/rest/v1/message_flags")) return { ok: true, json: async () => (existingFlag ? [{ id: "f1" }] : []) };
    throw new Error(`unexpected fetch ${u}`);
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

const flag = () => handler(new Request("https://x.test/api/flag-message", { method: "POST", body: JSON.stringify({ messageId: MSG, reason: "spam" }) }));
const inserted = (f: ReturnType<typeof installFetch>) => f.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === "POST");

beforeEach(() => {
  withAuthAndRateLimit.mockReset();
  withAuthAndRateLimit.mockResolvedValue({ auth: { userId: "cand-1" }, headers: {} });
});

describe("flag-message idempotency", () => {
  it("inserts the first report from a reporter", async () => {
    const f = installFetch(false);
    const res = await flag();
    expect(res.status).toBe(201);
    expect(inserted(f)).toBe(true);
  });

  it("does not add a second flag when the same reporter reports the same message again", async () => {
    const f = installFetch(true);
    const res = await flag();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, duplicate: true });
    expect(inserted(f)).toBe(false);
  });

  it("only counts the reporter's own non-system flags as duplicates", async () => {
    const f = installFetch(false);
    await flag();
    const dupCall = f.mock.calls.map(([u]) => String(u)).find((u) => u.includes("message_flags?message_id="));
    expect(dupCall).toContain("flagged_by=eq.cand-1");
    expect(dupCall).toContain("flagged_by_role=neq.system");
  });

  it("403s a stranger before any flag is written", async () => {
    withAuthAndRateLimit.mockResolvedValue({ auth: { userId: "stranger" }, headers: {} });
    const f = installFetch(false);
    expect((await flag()).status).toBe(403);
    expect(inserted(f)).toBe(false);
  });
});
