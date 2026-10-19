import { describe, it, expect, vi } from "vitest";
import { safeSearchTerm } from "../../server-handlers/_admin-activity";

describe("safeSearchTerm", () => {
  it("removes the characters that can add PostgREST filters", () => {
    const out = safeSearchTerm("x*,role.eq.admin),(email.ilike.*");
    expect(out).not.toMatch(/[,()*]/);
  });
  it("keeps what a name or email fragment needs", () => {
    expect(safeSearchTerm("  priya.s+tag@acme.in ")).toBe("priya.s+tag@acme.in");
    expect(safeSearchTerm("Ana María")).toBe("Ana María");
  });
  it("caps the length and tolerates undefined", () => {
    expect(safeSearchTerm("a".repeat(500))).toHaveLength(100);
    expect(safeSearchTerm(undefined)).toBe("");
  });
});

describe("getCronHeartbeatAlerts without Redis", () => {
  it("says monitoring is off instead of staying silent", async () => {
    vi.resetModules();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    const { getCronHeartbeatAlerts } = await import("../../server-handlers/_cron-heartbeat");
    const alerts = await getCronHeartbeatAlerts();
    expect(alerts.map((a) => a.code)).toEqual(["cron_heartbeat_unconfigured"]);
  });
});
