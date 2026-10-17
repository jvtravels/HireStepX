import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../server-handlers/_health-alerts", () => ({
  getHealthAlerts: async () => ({ alerts: [], checkedAt: "t" }),
  isActionRequired: () => false,
  actionSubjectBits: () => [],
}));

const { default: handler } = await import("../../server-handlers/uptime-check");
const call = (auth?: string) => handler(new Request("https://x.test/api/uptime-check", { headers: auth ? { authorization: auth } : {} }));

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "healthy" }) }) as unknown as typeof fetch;
});

describe("uptime-check auth", () => {
  it("fails closed when CRON_SECRET is unset", async () => {
    process.env.CRON_SECRET = "";
    expect((await call()).status).toBe(401);
    expect((await call("Bearer ")).status).toBe(401);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("rejects a wrong secret and accepts the right one", async () => {
    process.env.CRON_SECRET = "s3cret";
    expect((await call("Bearer wrong")).status).toBe(401);
    expect((await call("Bearer s3cret")).status).toBe(200);
  });
});
