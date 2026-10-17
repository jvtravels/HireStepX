import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

const withAuthAndRateLimit = vi.fn();
const loadAuthIdentity = vi.fn();
const captureServerEvent = vi.fn();
const sendEmployerEmail = vi.fn();

vi.mock("../../server-handlers/_shared", () => ({
  withAuthAndRateLimit: (...a: unknown[]) => withAuthAndRateLimit(...a),
  corsHeaders: () => ({}),
  withRequestId: (h: Record<string, string>) => h,
  slog: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));
vi.mock("../../server-handlers/_entitlements", () => ({ loadAuthIdentity: (...a: unknown[]) => loadAuthIdentity(...a) }));
vi.mock("../../server-handlers/_posthog", () => ({ captureServerEvent: (...a: unknown[]) => captureServerEvent(...a) }));
vi.mock("../../server-handlers/_employer-emails", async (orig) => ({
  ...(await orig<typeof import("../../server-handlers/_employer-emails")>()),
  sendEmployerEmail: (...a: unknown[]) => sendEmployerEmail(...a),
}));

const { default: handler } = await import("../../server-handlers/employer-profile");

const post = (body: unknown) => new Request("https://x.test/api/employer-profile", { method: "POST", body: JSON.stringify(body) });
const row = { id: "emp-1", company_name: "Acme", website: "acme.com", logo_path: null, status: "approved", submitted_at: "t", approved_at: "t", verification_tier: "basic" };
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  withAuthAndRateLimit.mockReset().mockResolvedValue({ auth: { userId: "emp-1" }, headers: {} });
  loadAuthIdentity.mockReset().mockResolvedValue({ email: "priya@acme.com", emailConfirmed: true });
  captureServerEvent.mockReset();
  sendEmployerEmail.mockReset().mockResolvedValue(true);
});

describe("employer-profile POST analytics + welcome email", () => {
  it("first save: captures employer_profile_saved (first=true) and sends one idempotent welcome email", async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => [row] })
      .mockResolvedValue({ ok: true, json: async () => [] }) as unknown as typeof fetch;
    const res = await handler(post({ companyName: "Acme", website: "acme.com" }));
    await flush();
    expect(res.status).toBe(200);
    expect(captureServerEvent).toHaveBeenCalledWith("employer_profile_saved", "emp-1", expect.objectContaining({ first: true }), expect.anything());
    expect(sendEmployerEmail).toHaveBeenCalledTimes(1);
    expect(sendEmployerEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "priya@acme.com", idempotencyKey: "employer-welcome-emp-1" }));
  });

  it("later save: captures first=false and sends no email", async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [row] })
      .mockResolvedValueOnce({ ok: true, json: async () => [row] })
      .mockResolvedValue({ ok: true, json: async () => [] }) as unknown as typeof fetch;
    const res = await handler(post({ companyName: "Acme", website: "acme.com" }));
    await flush();
    expect(res.status).toBe(200);
    expect(captureServerEvent).toHaveBeenCalledWith("employer_profile_saved", "emp-1", expect.objectContaining({ first: false }), expect.anything());
    expect(sendEmployerEmail).not.toHaveBeenCalled();
  });

  it("a failed save emits neither the event nor the email", async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => "boom", json: async () => [] })
      .mockResolvedValue({ ok: true, json: async () => [] }) as unknown as typeof fetch;
    const res = await handler(post({ companyName: "Acme", website: "acme.com" }));
    await flush();
    expect(res.status).toBe(500);
    expect(captureServerEvent).not.toHaveBeenCalled();
    expect(sendEmployerEmail).not.toHaveBeenCalled();
  });

  it("a throwing email sender never fails the save", async () => {
    sendEmployerEmail.mockRejectedValue(new Error("resend down"));
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => [row] })
      .mockResolvedValue({ ok: true, json: async () => [] }) as unknown as typeof fetch;
    const res = await handler(post({ companyName: "Acme", website: "acme.com" }));
    await flush();
    expect(res.status).toBe(200);
  });
});
