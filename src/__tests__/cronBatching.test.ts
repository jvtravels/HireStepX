import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "srk";
process.env.RESEND_API_KEY = "re_test";
process.env.CRON_SECRET = "cron-secret";

const recordCronResult = vi.fn();
vi.mock("../../server-handlers/_cron-heartbeat", () => ({ recordCronResult: (...a: unknown[]) => recordCronResult(...a) }));
vi.mock("../../server-handlers/_posthog", () => ({ captureServerEvent: vi.fn() }));

const { default: renewal } = await import("../../server-handlers/send-renewal-reminders");
const { default: resetExpired } = await import("../../server-handlers/reset-expired-subscriptions");
const { default: reEngage } = await import("../../server-handlers/re-engage-users");

function mockRes() {
  const out: { status: number; body: Record<string, unknown> } = { status: 0, body: {} };
  const res = {
    status(code: number) { out.status = code; return res; },
    json(b: Record<string, unknown>) { out.body = b; return res; },
  };
  return { res, out };
}
const req = { headers: { authorization: "Bearer cron-secret" } };

const users = (n: number, from = 0) =>
  Array.from({ length: n }, (_, i) => ({
    id: `u${from + i}`, name: "N", email: `u${from + i}@x.test`, subscription_tier: "pro", subscription_end: new Date().toISOString(),
  }));

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  recordCronResult.mockReset();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("send-renewal-reminders pagination", () => {
  it("reads every page and emails every user, not just the first 200", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("api.resend.com")) return new Response("{}", { status: 200 });
      const offset = Number(/offset=(\d+)/.exec(url)?.[1] ?? 0);
      const rows = offset === 0 ? users(200) : offset === 200 ? users(50, 200) : [];
      return new Response(JSON.stringify(rows), { status: 200 });
    });
    const { res, out } = mockRes();
    await renewal(req as never, res as never);
    expect(out.status).toBe(200);
    expect(out.body).toMatchObject({ sent: 250, failed: 0, total: 250, complete: true });
    expect(recordCronResult).toHaveBeenCalledWith("send-renewal-reminders", { errors: 0 });
  });

  it("500s when the very first query fails", async () => {
    fetchMock.mockResolvedValue(new Response("boom", { status: 500 }));
    const { res, out } = mockRes();
    await renewal(req as never, res as never);
    expect(out.status).toBe(500);
  });

  it("still sends what it loaded and flags the run incomplete when a later page fails", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("api.resend.com")) return new Response("{}", { status: 200 });
      const offset = Number(/offset=(\d+)/.exec(url)?.[1] ?? 0);
      return offset === 0 ? new Response(JSON.stringify(users(200)), { status: 200 }) : new Response("x", { status: 503 });
    });
    const { res, out } = mockRes();
    await renewal(req as never, res as never);
    expect(out.status).toBe(200);
    expect(out.body).toMatchObject({ sent: 200, complete: false });
  });
});

describe("reset-expired-subscriptions batching", () => {
  it("downgrades every page of expired users and emails them", async () => {
    let remaining = 230;
    fetchMock.mockImplementation(async (url: string, init?: { method?: string }) => {
      if (url.includes("api.resend.com")) return new Response("{}", { status: 200 });
      if (init?.method === "PATCH") { remaining--; return new Response(null, { status: 204 }); }
      const rows = users(Math.min(200, remaining), 230 - remaining);
      return new Response(JSON.stringify(rows), { status: 200 });
    });
    const { res, out } = mockRes();
    await resetExpired(req as never, res as never);
    expect(out.status).toBe(200);
    expect(out.body).toMatchObject({ downgraded: 230, failed: 0, emailsSent: 230, total: 230, truncated: false });
  });

  it("does not spin forever on users whose downgrade keeps failing", async () => {
    let queries = 0;
    fetchMock.mockImplementation(async (url: string, init?: { method?: string }) => {
      if (init?.method === "PATCH") return new Response("nope", { status: 500 });
      if (url.includes("api.resend.com")) return new Response("{}", { status: 200 });
      queries++;
      return new Response(JSON.stringify(users(200)), { status: 200 });
    });
    const { res, out } = mockRes();
    await resetExpired(req as never, res as never);
    expect(out.status).toBe(200);
    expect(out.body).toMatchObject({ downgraded: 0, failed: 200 });
    expect(queries).toBe(2);
  });
});

describe("re-engage-users pagination", () => {
  it("scans beyond the first 1000 users instead of the same arbitrary slice", async () => {
    const profileOffsets: number[] = [];
    fetchMock.mockImplementation(async (url: string) => {
      const m = /rest\/v1\/profiles\?or=.*[&?]offset=(\d+)/.exec(url);
      if (m) {
        const offset = Number(m[1]);
        profileOffsets.push(offset);
        const rows = offset === 0 ? users(1000) : offset === 1000 ? users(500, 1000) : [];
        return new Response(JSON.stringify(rows), { status: 200 });
      }
      return new Response("[]", { status: 200 });
    });
    const { res, out } = mockRes();
    await reEngage(req as never, res as never);
    expect(out.status).toBe(200);
    expect(profileOffsets).toEqual([0, 1000]);
    expect(out.body).toMatchObject({ total: 1500, complete: true });
  });

  it("500s when the first page fails", async () => {
    fetchMock.mockResolvedValue(new Response("x", { status: 500 }));
    const { res, out } = mockRes();
    await reEngage(req as never, res as never);
    expect(out.status).toBe(500);
  });
});
