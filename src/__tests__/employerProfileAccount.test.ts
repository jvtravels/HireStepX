import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

const withAuthAndRateLimit = vi.fn();
const loadAuthIdentity = vi.fn();
const warn = vi.hoisted(() => vi.fn());

const resolveCtx = vi.hoisted(() => vi.fn());
vi.mock("../../server-handlers/_employer-team-helpers", async (orig) => ({
  ...(await orig<typeof import("../../server-handlers/_employer-team-helpers")>()),
  resolveEmployerContext: (...args: unknown[]) => resolveCtx(...args),
}));
const teamsOn = vi.hoisted(() => vi.fn());
vi.mock("../../server-handlers/_employer-team-gate", () => ({ teamsEnabledFor: (...args: unknown[]) => teamsOn(...args) }));
const ownerCtx = { employerId: "emp-1", userId: "emp-1", role: "owner", email: "priya@acme.com", name: null };

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
  resolveCtx.mockResolvedValue(ownerCtx);
  teamsOn.mockResolvedValue(false);
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
    resolveCtx.mockResolvedValue(null);
    global.fetch = vi.fn().mockResolvedValueOnce(ok([])).mockResolvedValue(ok([{ ...row, company_name: "NewCo" }]));
    await handler(post({ companyName: "NewCo", website: "acme.com" }));
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("employer-profile team context", () => {
  const get = () => new Request("https://x.test/api/employer-profile", { method: "GET" });
  const memberCtx = (role: string) => ({ employerId: "co-1", userId: "emp-1", role, email: "sam@acme.com", name: null });
  const companyRow = { ...row, id: "co-1" };
  const calls = () => (global.fetch as ReturnType<typeof vi.fn>).mock.calls;

  it("GET returns the company id, the caller's role, its permissions and the teams flag", async () => {
    resolveCtx.mockResolvedValue(memberCtx("viewer"));
    teamsOn.mockResolvedValue(true);
    global.fetch = vi.fn().mockResolvedValue(ok([companyRow]));
    const body = await (await handler(get())).json();
    expect(body).toMatchObject({ status: "approved", companyId: "co-1", role: "viewer", features: { teams: true } });
    expect(body.permissions).toContain("jobs.read");
    expect(body.permissions).not.toContain("company.edit");
    expect(String(calls()[0][0])).toContain("employers?id=eq.co-1");
    expect(teamsOn).toHaveBeenCalledWith("co-1");
  });

  it("GET reports status none, and creates nothing, for an account with no company", async () => {
    resolveCtx.mockResolvedValue(null);
    global.fetch = vi.fn();
    const body = await (await handler(get())).json();
    expect(body).toEqual({ status: "none" });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("POST is forbidden for a role without company.edit and writes nothing", async () => {
    resolveCtx.mockResolvedValue(memberCtx("member"));
    global.fetch = vi.fn();
    const res = await handler(post({ companyName: "Acme 2" }));
    expect(res.status).toBe(403);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("POST by an admin edits the company row (not the admin's own id) and audits who changed what", async () => {
    resolveCtx.mockResolvedValue(memberCtx("admin"));
    global.fetch = vi.fn()
      .mockResolvedValueOnce(ok([companyRow]))
      .mockResolvedValue(ok([{ ...companyRow, company_name: "Acme 2" }]));
    const res = await handler(post({ companyName: "Acme 2" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ companyId: "co-1", role: "admin" });
    const upsert = calls().find(([u]) => String(u).includes("employers?on_conflict=id"));
    expect(JSON.parse((upsert![1] as { body: string }).body)[0]).toMatchObject({ id: "co-1", company_name: "Acme 2" });
    const audit = calls().find(([u]) => String(u).includes("/rest/v1/employer_audit_log"));
    expect(JSON.parse((audit![1] as { body: string }).body)).toMatchObject({
      employer_id: "co-1", actor_user_id: "emp-1", action: "company.profile_updated", meta: { changed: ["name"] },
    });
  });

  it("POST does not audit a save that changes nothing", async () => {
    resolveCtx.mockResolvedValue(memberCtx("owner"));
    global.fetch = vi.fn().mockResolvedValue(ok([companyRow]));
    await handler(post({ companyName: "Acme", website: "acme.com" }));
    expect(calls().some(([u]) => String(u).includes("employer_audit_log"))).toBe(false);
  });

  it("a first-time save makes the caller the owner member of the new company", async () => {
    resolveCtx.mockResolvedValue(null);
    global.fetch = vi.fn().mockResolvedValueOnce(ok([])).mockResolvedValue(ok([{ ...row, company_name: "NewCo" }]));
    const res = await handler(post({ companyName: "NewCo", website: "acme.com" }));
    expect(await res.json()).toMatchObject({ companyId: "emp-1", role: "owner" });
    const member = calls().find(([u]) => String(u).includes("/rest/v1/employer_members"));
    expect(JSON.parse((member![1] as { body: string }).body)[0]).toMatchObject({ employer_id: "emp-1", user_id: "emp-1", role: "owner" });
  });
});
