import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

const withAuthAndRateLimit = vi.fn();
const loadAuthIdentity = vi.fn();

vi.mock("../../server-handlers/_shared", () => ({
  withAuthAndRateLimit: (...args: unknown[]) => withAuthAndRateLimit(...args),
  corsHeaders: () => ({}),
  withRequestId: (h: Record<string, string>) => h,
  slog: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));
vi.mock("../../server-handlers/_entitlements", () => ({
  loadAuthIdentity: (...args: unknown[]) => loadAuthIdentity(...args),
}));

const { default: handler } = await import("../../server-handlers/employer-profile");

function post(body: unknown) {
  return new Request("https://x.test/api/employer-profile", { method: "POST", body: JSON.stringify(body) });
}

const existingRow = { id: "emp-1", company_name: "Acme", website: "", logo_path: null, status: "approved", submitted_at: "t", approved_at: "t", verification_tier: "basic" };

beforeEach(() => {
  vi.restoreAllMocks();
  withAuthAndRateLimit.mockResolvedValue({ auth: { userId: "emp-1" }, headers: {} });
});

describe("employer-profile POST work-email rule", () => {
  it("rejects a new company registered with a free-mail address", async () => {
    loadAuthIdentity.mockResolvedValue({ email: "someone@gmail.com", emailConfirmed: true });
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => [] });
    global.fetch = fetchMock;

    const res = await handler(post({ companyName: "Acme Pvt Ltd" }));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.code).toBe("work_email_required");
    expect(fetchMock).toHaveBeenCalledTimes(1); // only the existing-row lookup, no upsert
  });

  it("lets a new company with a company-domain email register", async () => {
    loadAuthIdentity.mockResolvedValue({ email: "priya@acme.com", emailConfirmed: true });
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ ...existingRow, company_name: "Acme Pvt Ltd", website: "acme.com" }] })
      .mockResolvedValue({ ok: true, json: async () => [] });

    const res = await handler(post({ companyName: "Acme Pvt Ltd", website: "acme.com" }));

    expect(res.status).toBe(200);
  });

  it("does not block an existing free-mail employer from editing their profile", async () => {
    loadAuthIdentity.mockResolvedValue({ email: "founder@gmail.com", emailConfirmed: true });
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [existingRow] })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ ...existingRow, company_name: "Acme 2" }] })
      .mockResolvedValue({ ok: true, json: async () => [] });

    const res = await handler(post({ companyName: "Acme 2" }));

    expect(res.status).toBe(200);
  });
});

describe("employer-profile POST billing identity", () => {
  const upsertBodies = () => (global.fetch as ReturnType<typeof vi.fn>).mock.calls
    .filter(([url]) => String(url).includes("on_conflict=id"))
    .map(([, init]) => JSON.parse((init as { body: string }).body)[0]);

  it("rejects a malformed GSTIN before touching the database", async () => {
    loadAuthIdentity.mockResolvedValue({ email: "priya@acme.com", emailConfirmed: true });
    global.fetch = vi.fn();
    const res = await handler(post({ companyName: "Acme Pvt Ltd", website: "acme.com", gstin: "27AAPFU0939F1ZA" }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("invalid_gstin");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("normalises and stores GSTIN and billing name, and returns them", async () => {
    loadAuthIdentity.mockResolvedValue({ email: "priya@acme.com", emailConfirmed: true });
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [existingRow] })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [{ ...existingRow, gstin: "27AAPFU0939F1ZV", billing_name: "Acme Pvt Ltd" }] })
      .mockResolvedValue({ ok: true, status: 200, json: async () => [] });
    const res = await handler(post({ companyName: "Acme", website: "acme.com", gstin: " 27aapfu0939f1zv ", billingName: " Acme  Pvt Ltd " }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(upsertBodies()[0]).toMatchObject({ gstin: "27AAPFU0939F1ZV", billing_name: "Acme Pvt Ltd" });
    expect(body).toMatchObject({ gstin: "27AAPFU0939F1ZV", billingName: "Acme Pvt Ltd" });
  });

  it("leaves stored billing fields alone when the request omits them, and clears on empty", async () => {
    loadAuthIdentity.mockResolvedValue({ email: "priya@acme.com", emailConfirmed: true });
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [existingRow] })
      .mockResolvedValue({ ok: true, status: 200, json: async () => [existingRow] });
    await handler(post({ companyName: "Acme", website: "acme.com" }));
    expect(upsertBodies()[0]).not.toHaveProperty("gstin");

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [existingRow] })
      .mockResolvedValue({ ok: true, status: 200, json: async () => [existingRow] });
    await handler(post({ companyName: "Acme", website: "acme.com", gstin: "" }));
    expect(upsertBodies()[0]).toMatchObject({ gstin: null });
  });

  it("still saves the profile when the billing columns are not migrated yet", async () => {
    loadAuthIdentity.mockResolvedValue({ email: "priya@acme.com", emailConfirmed: true });
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [existingRow] })
      .mockResolvedValueOnce({ ok: false, status: 400, text: async () => "column gstin does not exist", json: async () => ({}) })
      .mockResolvedValue({ ok: true, status: 200, json: async () => [existingRow] });
    const res = await handler(post({ companyName: "Acme", website: "acme.com", gstin: "27AAPFU0939F1ZV" }));
    expect(res.status).toBe(200);
    const bodies = upsertBodies();
    expect(bodies[0]).toHaveProperty("gstin");
    expect(bodies[1]).not.toHaveProperty("gstin");
  });
});
