import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AdminAuditRow } from "../../server-handlers/_admin-session-helpers";

const row: AdminAuditRow = {
  admin_user_id: "shared-admin", session_id: "s", action: "overview", resource_type: null, resource_id: null, outcome: "ok", ip: "1.2.3.4", meta: {},
};
const fetchMock = vi.fn();

async function load() {
  vi.resetModules();
  return import("../../server-handlers/_admin-session-store");
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "svc");
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("recordAdminAudit", () => {
  it("posts the row to admin_audit_log with the service key", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 201 });
    const { recordAdminAudit } = await load();
    await recordAdminAudit(row);
    expect(fetchMock.mock.calls[0][0]).toBe("https://example.supabase.co/rest/v1/admin_audit_log");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(row);
  });
  it("swallows a missing table (migration not applied) and network errors", async () => {
    const { recordAdminAudit } = await load();
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });
    await expect(recordAdminAudit(row)).resolves.toBeUndefined();
    fetchMock.mockRejectedValueOnce(new Error("timeout"));
    await expect(recordAdminAudit(row)).resolves.toBeUndefined();
  });
});

describe("revocation store", () => {
  it("skips the lookup when Redis is not configured", async () => {
    const { loadRevocationState, revokeSession } = await load();
    expect(await loadRevocationState("sid")).toEqual({ sidRevoked: false, revokedBeforeMs: null });
    expect(await revokeSession("sid")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("reads revocation state and throws (fail closed) when Redis errors", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "t");
    const { loadRevocationState } = await load();
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => [{ result: "1" }, { result: null }] });
    expect(await loadRevocationState("sid")).toEqual({ sidRevoked: true, revokedBeforeMs: null });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)[0]).toEqual(["GET", "admin:revoked:sid"]);
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });
    await expect(loadRevocationState("sid")).rejects.toThrow();
    fetchMock.mockRejectedValueOnce(new Error("network"));
    await expect(loadRevocationState("sid")).rejects.toThrow();
  });
  it("writes the revocation key with a TTL", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "t");
    const { revokeSession, revokeAllSessions } = await load();
    fetchMock.mockResolvedValue({ ok: true, json: async () => [{ result: "OK" }] });
    expect(await revokeSession("sid")).toBe(true);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)[0].slice(0, 3)).toEqual(["SET", "admin:revoked:sid", "1"]);
    expect(await revokeAllSessions(123)).toBe(true);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)[0].slice(0, 3)).toEqual(["SET", "admin:revoked-before", "123"]);
  });
});
