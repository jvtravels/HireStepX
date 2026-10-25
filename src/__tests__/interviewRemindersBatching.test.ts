import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "srk";
process.env.RESEND_API_KEY = "re_test";
process.env.CRON_SECRET = "cron-secret";

const recordCronResult = vi.fn();
vi.mock("../../server-handlers/_cron-heartbeat", () => ({ recordCronResult: (...a: unknown[]) => recordCronResult(...a) }));

const { default: handler } = await import("../../server-handlers/send-interview-reminders");

function mockRes() {
  const out: { status: number; body: Record<string, unknown> } = { status: 0, body: {} };
  const res = {
    status(code: number) { out.status = code; return res; },
    json(b: Record<string, unknown>) { out.body = b; return res; },
  };
  return { res, out };
}
const req = { headers: { authorization: "Bearer cron-secret" } };

const events = (n: number, from = 0) =>
  Array.from({ length: n }, (_, i) => ({
    id: `e${from + i}`, user_id: `u${from + i}`, title: "Interview", company: "Acme",
    start_utc: new Date(Date.now() + 24 * 3_600_000).toISOString(), timezone: "Asia/Kolkata",
    status: "upcoming", reminders: [{ channel: "email", minutesBefore: 1440 }],
  }));

let fetchMock: ReturnType<typeof vi.fn>;
let lookupUrls: string[];
beforeEach(() => {
  recordCronResult.mockReset();
  lookupUrls = [];
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("send-interview-reminders batching", () => {
  it("reads all event pages, chunks lookups and emails every due reminder", async () => {
    fetchMock.mockImplementation(async (url: string, init?: { method?: string }) => {
      if (url.includes("api.resend.com")) return new Response("{}", { status: 200 });
      if (init?.method === "POST") return new Response(null, { status: 201 });
      if (url.includes("/calendar_events")) {
        const offset = Number(/offset=(\d+)/.exec(url)?.[1] ?? 0);
        const rows = offset === 0 ? events(500) : offset === 500 ? events(60, 500) : [];
        return new Response(JSON.stringify(rows), { status: 200 });
      }
      if (url.includes("/calendar_reminder_log")) { lookupUrls.push(url); return new Response("[]", { status: 200 }); }
      if (url.includes("/profiles")) {
        lookupUrls.push(url);
        const ids = /in\.\(([^)]*)\)/.exec(url)![1].split(",");
        return new Response(JSON.stringify(ids.map((id) => ({ id, email: `${id}@x.test`, name: "N" }))), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    });
    const { res, out } = mockRes();
    await handler(req as never, res as never);
    expect(out.status).toBe(200);
    expect(out.body).toMatchObject({ sent: 560, failed: 0, scanned: 560, complete: true });
    expect(Math.max(...lookupUrls.map((u) => u.length))).toBeLessThan(2500);
    expect(lookupUrls.length).toBe(Math.ceil(560 / 50) * 2);
  });

  it("500s when the first events page fails", async () => {
    fetchMock.mockResolvedValue(new Response("boom", { status: 500 }));
    const { res, out } = mockRes();
    await handler(req as never, res as never);
    expect(out.status).toBe(500);
  });
});
