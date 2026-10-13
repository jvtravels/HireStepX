import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
process.env.CONSENT_IP_HASH_SALT = "salt";

const withAuthAndRateLimit = vi.fn();

vi.mock("../../server-handlers/_shared", () => ({
  withAuthAndRateLimit: (...args: unknown[]) => withAuthAndRateLimit(...args),
  getClientIp: () => "203.0.113.9",
  slog: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

const { default: handler } = await import("../../server-handlers/record-consent");
const { validateConsentBody, hashIp, buildConsentRow, isMissingTableError } = await import("../../server-handlers/_record-consent-helpers");
const { TERMS_PRIVACY_CONSENT_VERSION } = await import("../../data/legal-versions");

function post(body: unknown) {
  return new Request("https://x.test/api/record-consent", { method: "POST", body: JSON.stringify(body), headers: { "user-agent": "vitest-agent" } });
}
const good = { purpose: "terms_privacy", version: TERMS_PRIVACY_CONSENT_VERSION };

beforeEach(() => {
  vi.restoreAllMocks();
  withAuthAndRateLimit.mockResolvedValue({ auth: { authenticated: true, userId: "user-1" }, headers: {} });
});

describe("validateConsentBody", () => {
  it("accepts the current purpose + version only", () => {
    expect(validateConsentBody(good)).toEqual({ ok: true, ...good });
    expect(validateConsentBody({ purpose: "terms_privacy", version: "1999-01-01" })).toEqual({ ok: false, error: "unknown_version" });
    expect(validateConsentBody({ purpose: "marketing", version: TERMS_PRIVACY_CONSENT_VERSION })).toEqual({ ok: false, error: "unknown_purpose" });
    expect(validateConsentBody(null)).toEqual({ ok: false, error: "invalid_body" });
  });
});

describe("helpers", () => {
  it("hashIp is salted, stable, and null without a salt", async () => {
    const a = await hashIp("1.2.3.4", "s");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashIp("1.2.3.4", "s")).toBe(a);
    expect(await hashIp("1.2.3.4", "other")).not.toBe(a);
    expect(await hashIp("1.2.3.4", undefined)).toBeNull();
  });
  it("buildConsentRow truncates the user agent", () => {
    expect(buildConsentRow({ userId: "u", purpose: "p", version: "v", ipHash: null, userAgent: "x".repeat(500) }).user_agent).toHaveLength(300);
  });
  it("detects a missing-table PostgREST error", () => {
    expect(isMissingTableError(404, "")).toBe(true);
    expect(isMissingTableError(400, '{"code":"PGRST205"}')).toBe(true);
    expect(isMissingTableError(400, "other")).toBe(false);
  });
});

describe("record-consent handler", () => {
  it("returns the preamble response when auth/rate-limit fails", async () => {
    withAuthAndRateLimit.mockResolvedValue(new Response("no", { status: 401 }));
    expect((await handler(post(good))).status).toBe(401);
  });

  it("rejects an unknown version with 400 and never touches the DB", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock;
    const res = await handler(post({ purpose: "terms_privacy", version: "bogus" }));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("inserts one row for the authenticated user with a hashed IP, idempotently", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, text: async () => "" });
    global.fetch = fetchMock;
    const res = await handler(post(good));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ recorded: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/rest/v1/user_consents?on_conflict=user_id,purpose,version");
    expect((init as RequestInit).headers).toMatchObject({ Prefer: "resolution=ignore-duplicates,return=minimal" });
    const row = JSON.parse((init as RequestInit).body as string);
    expect(row).toMatchObject({ user_id: "user-1", purpose: "terms_privacy", version: TERMS_PRIVACY_CONSENT_VERSION, user_agent: "vitest-agent" });
    expect(row.ip_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(row)).not.toContain("203.0.113.9");
  });

  it("degrades to 202 retry (not 500) when the table is not migrated yet", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404, text: async () => '{"code":"PGRST205"}' });
    const res = await handler(post(good));
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ recorded: false, retry: true });
  });

  it("degrades to 202 retry when the DB call throws", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("net"));
    expect((await handler(post(good))).status).toBe(202);
  });
});
