import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { evaluateCronHeartbeats, recordCronResult, CRON_MAX_SILENCE_MS, CRON_PATH_HEARTBEAT } from "../../server-handlers/_cron-heartbeat";
import { evaluateUnlockOrders, type OpenOrderRow } from "../../server-handlers/_employer-health-signals";

const NOW = Date.UTC(2026, 9, 17, 10, 0, 0);
const HOUR = 3_600_000;
const ago = (h: number) => new Date(NOW - h * HOUR).toISOString();
const codes = (a: { code: string }[]) => a.map((x) => x.code);

describe("evaluateCronHeartbeats", () => {
  const fresh = Object.fromEntries(Object.keys(CRON_MAX_SILENCE_MS).map((n) => [n, ago(2)]));

  it("is quiet when every cron succeeded within its window", () => {
    expect(evaluateCronHeartbeats(fresh, NOW)).toEqual([]);
  });

  it("raises a critical when a cron's last success is older than its limit", () => {
    const alerts = evaluateCronHeartbeats({ ...fresh, "cron-credit-no-response": ago(27) }, NOW);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ severity: "critical", code: "cron_stale" });
    expect(alerts[0].message).toContain("cron-credit-no-response");
  });

  it("only warns when a cron has never recorded a heartbeat (fresh deploy)", () => {
    const alerts = evaluateCronHeartbeats({ ...fresh, "cron-rematch-requirements": null }, NOW);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ severity: "warning", code: "cron_heartbeat_missing" });
  });

  it("is critical (not a warning) when a money-path cron has never recorded a heartbeat", () => {
    for (const name of ["cron-reconcile-unlock-orders", "cron-credit-no-response"]) {
      const alerts = evaluateCronHeartbeats({ ...fresh, [name]: null }, NOW);
      expect(alerts).toHaveLength(1);
      expect(alerts[0]).toMatchObject({ severity: "critical", code: "cron_heartbeat_missing" });
    }
  });
});

describe("vercel.json cron coverage", () => {
  const root = join(__dirname, "..", "..");
  const crons = (JSON.parse(readFileSync(join(root, "vercel.json"), "utf8")) as { crons: { path: string; schedule: string }[] }).crons;

  it("maps every vercel.json cron path to a heartbeat (or an explicit null) and has no stale mapping", () => {
    const missing = crons.map((c) => c.path).filter((p) => !(p in CRON_PATH_HEARTBEAT));
    expect(missing, `cron paths with no CRON_PATH_HEARTBEAT entry: ${missing.join(", ")}`).toEqual([]);
    const stale = Object.keys(CRON_PATH_HEARTBEAT).filter((p) => !crons.some((c) => c.path === p));
    expect(stale, `CRON_PATH_HEARTBEAT paths no longer in vercel.json: ${stale.join(", ")}`).toEqual([]);
  });

  it("has a silence limit for every mapped heartbeat and no orphan limits", () => {
    const names = Object.values(CRON_PATH_HEARTBEAT).filter((n): n is string => n !== null);
    expect(names.filter((n) => !(n in CRON_MAX_SILENCE_MS))).toEqual([]);
    expect(Object.keys(CRON_MAX_SILENCE_MS).filter((n) => !names.includes(n))).toEqual([]);
  });

  it("sizes each limit to its schedule: daily crons 25-36h, weekly crons 7-9 days", () => {
    for (const c of crons) {
      const name = CRON_PATH_HEARTBEAT[c.path];
      if (!name) continue;
      const weekly = /^\d+$/.test(c.schedule.split(" ")[4]);
      const hours = CRON_MAX_SILENCE_MS[name] / HOUR;
      if (weekly) expect(hours, name).toBeGreaterThanOrEqual(7 * 24);
      else {
        expect(hours, name).toBeGreaterThanOrEqual(25);
        expect(hours, name).toBeLessThanOrEqual(36);
      }
      if (weekly) expect(hours, name).toBeLessThanOrEqual(9 * 24);
    }
  });

  it("every heartbeat name is actually recorded by its handler (else it would alert forever)", () => {
    for (const name of Object.keys(CRON_MAX_SILENCE_MS)) {
      const src = readFileSync(join(root, "server-handlers", `${name}.ts`), "utf8");
      expect(src, `${name}.ts must call recordCronResult("${name}", ...)`).toContain(`recordCronResult("${name}"`);
    }
  });
});

describe("recordCronResult", () => {
  afterEach(() => { vi.unstubAllGlobals(); delete process.env.UPSTASH_REDIS_REST_URL; delete process.env.UPSTASH_REDIS_REST_TOKEN; });

  it("records a heartbeat only for an error-free run", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.test";
    process.env.UPSTASH_REDIS_REST_TOKEN = "t";
    const f = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
    vi.stubGlobal("fetch", f);
    expect(await recordCronResult("send-employer-nudges", { errors: 0 }, NOW)).toBe(true);
    expect(await recordCronResult("send-employer-nudges", {}, NOW)).toBe(true);
    expect(f).toHaveBeenCalledTimes(2);
    expect(String((f.mock.calls[0] as unknown[])[1] && ((f.mock.calls[0] as unknown[])[1] as { body: string }).body)).toContain("cron_hb:send-employer-nudges");
  });

  it("skips the heartbeat when any error was counted, so the cron goes stale and alerts", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.test";
    process.env.UPSTASH_REDIS_REST_TOKEN = "t";
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    expect(await recordCronResult("send-employer-nudges", { errors: 3 }, NOW)).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });
});

describe("evaluateUnlockOrders", () => {
  const o = (x: Partial<OpenOrderRow>): OpenOrderRow => ({ status: "created", created_at: ago(3), razorpay_payment_id: null, ...x });

  it("is quiet for young or unpaid-and-recent orders", () => {
    expect(evaluateUnlockOrders([o({ created_at: ago(0.2) }), o({ status: "failed", created_at: ago(1) })], NOW)).toEqual([]);
  });

  it("raises critical when money was captured but the order is stuck", () => {
    expect(codes(evaluateUnlockOrders([o({ status: "paid", razorpay_payment_id: "pay_1" })], NOW))).toEqual(["unlock_order_stuck_paid"]);
  });

  it("warns on failed/paid orders with no payment after 2h and on partial orders", () => {
    const alerts = evaluateUnlockOrders([o({ status: "failed", created_at: ago(5) }), o({ status: "partial" })], NOW);
    expect(codes(alerts)).toEqual(["unlock_order_stuck", "unlock_order_partial"]);
  });

  it("raises critical with a rupee total when refunds are owed", () => {
    const alerts = evaluateUnlockOrders([o({ status: "partial", refund_due_paise: 250_000 }), o({ status: "partial", refund_due_paise: 50_000 })], NOW);
    const due = alerts.find((a) => a.code === "unlock_refund_due");
    expect(due?.severity).toBe("critical");
    expect(due?.message).toContain("₹3000");
  });
});
