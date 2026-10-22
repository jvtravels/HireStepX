import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

const withAuthAndRateLimit = vi.fn();
const loadAuthIdentity = vi.fn();
const warn = vi.hoisted(() => vi.fn());

vi.mock("../../server-handlers/_shared", () => ({
  withAuthAndRateLimit: (...args: unknown[]) => withAuthAndRateLimit(...args),
  corsHeaders: () => ({}),
  withRequestId: (h: Record<string, string>) => h,
  slog: { error: vi.fn(), warn, info: vi.fn() },
}));
vi.mock("../../server-handlers/_entitlements", () => ({
  loadAuthIdentity: (...args: unknown[]) => loadAuthIdentity(...args),
}));

const { default: handler } = await import("../../server-handlers/employer-profile");

const post = (body: unknown) => new Request("https://x.test/api/employer-profile", { method: "POST", body: JSON.stringify(body) });
const row = { id: "emp-1", company_name: "Acme", website: "acme.com", logo_path: "emp-1/logo.png", status: "approved", submitted_at: "t", approved_at: "t", verification_tier: "basic" };
const ok = (json: unknown) => ({ ok: true, status: 200, json: async () => json, text: async () => "" });

beforeEach(() => {
  vi.restoreAllMocks();
  warn.mockClear();
  withAuthAndRateLimit.mockResolvedValue({ auth: { userId: "emp-1" }, headers: {} });
  loadAuthIdentity.mockResolvedValue({ email: "priya@acme.com", emailConfirmed: true });
});

describe("employer-profile POST on a blocked account", () => {
  it("returns 403 account_suspended and never writes", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(ok([{ ...row, suspended_at: "2026-10-01T00:00:00Z", suspended_reason: "reported" }]));
    global.fetch = fetchMock;
    const res = await handler(post({ companyName: "Acme 2" }));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("account_suspended");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns account_deletion_pending for a soft-deleted employer", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(ok([{ ...row, suspended_at: "2026-10-01T00:00:00Z", suspended_reason: "account_deletion_pending" }]));
    const res = await handler(post({ companyName: "Acme 2" }));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("account_deletion_pending");
  });
});

describe("employer-profile POST logo removal", () => {
  const upsertBody = () => {
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.find(([u]) => String(u).includes("on_conflict=id"));
    return JSON.parse((call![1] as { body: string }).body)[0];
  };

  it("clears logo_path and deletes the stored object when removeLogo is true", async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(ok([row]))
      .mockResolvedValue(ok([{ ...row, logo_path: null }]));
    const res = await handler(post({ companyName: "Acme", removeLogo: true }));
    expect(res.status).toBe(200);
    expect(upsertBody().logo_path).toBeNull();
    const deletes = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === "DELETE");
    expect(deletes.length).toBeGreaterThan(0);
  });

  it("keeps the logo when removeLogo is absent", async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(ok([row]))
      .mockResolvedValue(ok([row]));
    await handler(post({ companyName: "Acme" }));
    expect(upsertBody().logo_path).toBe("emp-1/logo.png");
  });
});

describe("employer-profile company rename audit", () => {
  it("logs a warning when an existing company is renamed", async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(ok([row]))
      .mockResolvedValue(ok([{ ...row, company_name: "Globex" }]));
    await handler(post({ companyName: "Globex" }));
    expect(warn).toHaveBeenCalledWith("employer-profile company renamed", expect.objectContaining({
      code: "employer_profile_company_renamed", userId: "emp-1", from: "Acme", to: "Globex",
    }));
  });

  it("does not log for an unchanged name (case-insensitive) or a first-time profile", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(ok([row])).mockResolvedValue(ok([row]));
    await handler(post({ companyName: "ACME" }));
    global.fetch = vi.fn().mockResolvedValueOnce(ok([])).mockResolvedValue(ok([{ ...row, company_name: "NewCo" }]));
    await handler(post({ companyName: "NewCo", website: "acme.com" }));
    expect(warn).not.toHaveBeenCalled();
  });
});
