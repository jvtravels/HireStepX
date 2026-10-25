import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "srk";
process.env.RESEND_API_KEY = "re_test";
process.env.CRON_SECRET = "cron-secret";
process.env.UPSTASH_REDIS_REST_URL = "https://redis.example.test";
process.env.UPSTASH_REDIS_REST_TOKEN = "tok";

const recordCronResult = vi.fn();
vi.mock("../../server-handlers/_cron-heartbeat", () => ({ recordCronResult: (...a: unknown[]) => recordCronResult(...a) }));
vi.mock("../../server-handlers/_unsubscribe", () => ({
  filterSuppressed: async (_d: unknown, rows: unknown[]) => rows,
  marketingEmailParts: async () => ({ footer: undefined }),
  preferenceDepsFromEnv: () => ({}),
}));

const { default: winback } = await import("../../server-handlers/send-winback-emails");

function mockRes() {
  const out: { status: number; body: Record<string, unknown> } = { status: 0, body: {} };
  const res = {
    status(code: number) { out.status = code; return res; },
    json(b: Record<string, unknown>) { out.body = b; return res; },
  };
  return { res, out };
}
const req = { headers: { authorization: "Bearer cron-secret" } };

const profiles = (n: number, from = 0) =>
  Array.from({ length: n }, (_, i) => ({
    id: `u${from + i}`, name: "N", email: `u${from + i}@x.test`, subscription_tier: "free",
    subscription_end: new Date().toISOString(), target_role: "SDE", session_credits: 0,
  }));

let fetchMock: ReturnType<typeof vi.fn>;
let sessionUrls: string[];
beforeEach(() => {
  recordCronResult.mockReset();
  sessionUrls = [];
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

function route(opts: { alreadySent?: Set<string> } = {}) {
  fetchMock.mockImplementation(async (url: string) => {
    if (url.includes("api.resend.com")) return new Response("{}", { status: 200 });
    if (url.includes("redis.example.test/mget/")) {
      const keys = url.split("/mget/")[1].split("/").map(decodeURIComponent);
      return new Response(JSON.stringify({ result: keys.map((k) => (opts.alreadySent?.has(k) ? "1" : null)) }), { status: 200 });
    }
    if (url.includes("redis.example.test")) return new Response("{}", { status: 200 });
    if (url.includes("/rest/v1/sessions")) {
      sessionUrls.push(url);
      const ids = /in\.\(([^)]*)\)/.exec(url)![1].split(",");
      return new Response(JSON.stringify(ids.map((id) => ({ user_id: id, score: 60, created_at: "2026-01-01" }))), { status: 200 });
    }
    if (url.includes("/rest/v1/profiles")) {
      const offset = Number(/offset=(\d+)/.exec(url)?.[1] ?? 0);
      const rows = offset === 0 ? profiles(500) : offset === 500 ? profiles(40, 500) : [];
      return new Response(JSON.stringify(rows), { status: 200 });
    }
    return new Response("{}", { status: 200 });
  });
}

describe("send-winback-emails batching", () => {
  it("pages through every candidate, chunks session lookups and emails all of them", async () => {
    route();
    const { res, out } = mockRes();
    await winback(req as never, res as never);
    expect(out.status).toBe(200);
    expect(out.body).toMatchObject({ sent: 540, total: 540, complete: true });
    expect(sessionUrls.length).toBe(Math.ceil(540 / 25));
    expect(Math.max(...sessionUrls.map((u) => u.length))).toBeLessThan(2000);
  });

  it("skips users already marked sent without looking up their sessions", async () => {
    const sentSet = new Set(profiles(540).slice(0, 500).map((p) => `winback:${p.id}`));
    route({ alreadySent: sentSet });
    const { res, out } = mockRes();
    await winback(req as never, res as never);
    expect(out.body).toMatchObject({ sent: 40, skipped: 500 });
    expect(sessionUrls.length).toBe(2);
  });

  it("500s when the first profiles page fails", async () => {
    fetchMock.mockResolvedValue(new Response("boom", { status: 500 }));
    const { res, out } = mockRes();
    await winback(req as never, res as never);
    expect(out.status).toBe(500);
  });
});
