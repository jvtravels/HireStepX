import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

process.env.SUPABASE_URL = "https://proj.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "svc-key";
process.env.RESEND_API_KEY = "re_key";
process.env.CRON_SECRET = "cron-secret";

const recordCronResult = vi.fn();
vi.mock("../../server-handlers/_cron-heartbeat", async (orig) => ({
  ...(await orig<typeof import("../../server-handlers/_cron-heartbeat")>()),
  recordCronResult: (...a: unknown[]) => recordCronResult(...a),
}));

const { CRON_MAX_SILENCE_MS } = await import("../../server-handlers/_cron-heartbeat");

const vercel = JSON.parse(readFileSync(resolve(__dirname, "../../vercel.json"), "utf8")) as { crons: Array<{ path: string; schedule: string }> };

describe("heartbeat registry", () => {
  it("only watches crons that are actually scheduled in vercel.json (a watched cron that never runs alerts forever)", () => {
    // Heartbeat names are the path after /api with slashes as dashes (/api/cron/rematch-requirements -> cron-rematch-requirements).
    const scheduled = new Set(vercel.crons.map((c) => c.path.replace(/^\/api\//, "").replace(/\//g, "-")));
    for (const name of Object.keys(CRON_MAX_SILENCE_MS)) expect(scheduled.has(name), `${name} is not in vercel.json`).toBe(true);
  });

  it("watches renewal reminders, subscription resets and account erasure with a 25h limit", () => {
    for (const name of ["send-renewal-reminders", "reset-expired-subscriptions", "cleanup-deleted-accounts"]) {
      expect(CRON_MAX_SILENCE_MS[name]).toBe(25 * 3_600_000);
    }
  });
});

function nodeRes() {
  const out: { status: number; body: unknown } = { status: 0, body: null };
  const res = {
    status(c: number) { out.status = c; return res; },
    json(b: unknown) { out.body = b; return res; },
    setHeader() { return res; },
    end() { return res; },
  };
  return { res, out };
}
const authed = { method: "GET", headers: { authorization: "Bearer cron-secret" } };

beforeEach(() => {
  recordCronResult.mockReset().mockResolvedValue(true);
});

describe.each([
  ["send-renewal-reminders", "../../server-handlers/send-renewal-reminders"],
  ["reset-expired-subscriptions", "../../server-handlers/reset-expired-subscriptions"],
  ["cleanup-deleted-accounts", "../../server-handlers/cleanup-deleted-accounts"],
])("%s heartbeat", (name, mod) => {
  const run = async () => {
    const { default: handler } = await import(/* @vite-ignore */ mod);
    const { res, out } = nodeRes();
    await handler(authed, res);
    return out;
  };

  it("records a clean heartbeat on an empty run", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] }) as unknown as typeof fetch;
    const out = await run();
    expect(out.status).toBe(200);
    expect(recordCronResult).toHaveBeenCalledWith(name, { errors: 0 });
  });

  it("withholds the heartbeat when the main query fails, so the staleness alert fires", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}), text: async () => "" }) as unknown as typeof fetch;
    const out = await run();
    expect(out.status).toBe(500);
    expect(recordCronResult).not.toHaveBeenCalled();
  });
});
