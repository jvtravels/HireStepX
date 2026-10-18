import { describe, it, expect, vi, afterEach } from "vitest";
import { evaluateCronHeartbeats, recordCronResult, CRON_MAX_SILENCE_MS } from "../../server-handlers/_cron-heartbeat";
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

  it("raises a critical when a cron's last success is older than 25h", () => {
    const alerts = evaluateCronHeartbeats({ ...fresh, "cron-credit-no-response": ago(26) }, NOW);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ severity: "critical", code: "cron_stale" });
    expect(alerts[0].message).toContain("cron-credit-no-response");
  });

  it("only warns when a cron has never recorded a heartbeat (fresh deploy)", () => {
    const alerts = evaluateCronHeartbeats({ ...fresh, "cron-rematch-requirements": null }, NOW);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ severity: "warning", code: "cron_heartbeat_missing" });
  });

  it("covers every employer cron plus the subscription/erasure crons with a 25h limit", () => {
    expect(Object.keys(CRON_MAX_SILENCE_MS).sort()).toEqual([
      "cleanup-deleted-accounts", "cron-credit-no-response", "cron-reconcile-unlock-orders", "cron-rematch-requirements",
      "reset-expired-subscriptions", "send-employer-nudges", "send-employer-winback", "send-renewal-reminders",
    ]);
    for (const ms of Object.values(CRON_MAX_SILENCE_MS)) expect(ms).toBe(25 * HOUR);
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
