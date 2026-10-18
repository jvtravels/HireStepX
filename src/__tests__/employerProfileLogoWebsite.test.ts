import { describe, it, expect, vi, beforeEach } from "vitest";
import { sniffLogoType } from "../../server-handlers/_employer-logo-helpers";

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

const post = (body: unknown) => new Request("https://x.test/api/employer-profile", { method: "POST", body: JSON.stringify(body) });
const existingRow = { id: "emp-1", company_name: "Acme", website: "", logo_path: null, status: "approved", submitted_at: "t", approved_at: "t", verification_tier: "basic" };
const b64 = (bytes: number[]) => Buffer.from(Uint8Array.from(bytes)).toString("base64");

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0];
const WEBP = [0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50];
const HTML = Array.from(new TextEncoder().encode("<html><script>alert(1)</script></html>"));
const SVG = Array.from(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'><script/></svg>"));

describe("sniffLogoType", () => {
  it("recognises PNG, JPEG and WebP by magic bytes", () => {
    expect(sniffLogoType(Uint8Array.from(PNG))).toBe("image/png");
    expect(sniffLogoType(Uint8Array.from(JPEG))).toBe("image/jpeg");
    expect(sniffLogoType(Uint8Array.from(WEBP))).toBe("image/webp");
  });
  it("rejects SVG, HTML, empty and truncated input", () => {
    expect(sniffLogoType(Uint8Array.from(SVG))).toBeNull();
    expect(sniffLogoType(Uint8Array.from(HTML))).toBeNull();
    expect(sniffLogoType(new Uint8Array())).toBeNull();
    expect(sniffLogoType(Uint8Array.from([0x89, 0x50]))).toBeNull();
    expect(sniffLogoType(Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x41, 0x56, 0x49, 0x20]))).toBeNull();
  });
});

beforeEach(() => {
  vi.restoreAllMocks();
  withAuthAndRateLimit.mockResolvedValue({ auth: { userId: "emp-1" }, headers: {} });
  loadAuthIdentity.mockResolvedValue({ email: "priya@acme.com", emailConfirmed: true });
});

describe("employer-profile POST logo content check", () => {
  it("rejects HTML declared as image/png without touching Storage", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: true, status: 200, json: async () => [existingRow] });
    const res = await handler(post({ companyName: "Acme", logoBase64: b64(HTML), logoContentType: "image/png" }));
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("logo_upload_failed");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("rejects SVG declared as image/webp", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: true, status: 200, json: async () => [existingRow] });
    const res = await handler(post({ companyName: "Acme", logoBase64: b64(SVG), logoContentType: "image/webp" }));
    expect(res.status).toBe(422);
  });

  it("rejects a real JPEG declared as image/png (mismatch)", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: true, status: 200, json: async () => [existingRow] });
    const res = await handler(post({ companyName: "Acme", logoBase64: b64(JPEG), logoContentType: "image/png" }));
    expect(res.status).toBe(422);
  });

  it("stores a genuine PNG", async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [existingRow] })
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => "" })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [{ ...existingRow, logo_path: "emp-1/logo-x.png" }] })
      .mockResolvedValue({ ok: true, status: 200, json: async () => [] });
    const res = await handler(post({ companyName: "Acme", logoBase64: b64(PNG), logoContentType: "image/png" }));
    expect(res.status).toBe(200);
    const storageCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.find(([u]) => String(u).includes("/storage/v1/object/employer-logos/emp-1/"));
    expect(storageCall).toBeTruthy();
  });
});

describe("employer-profile POST website validation", () => {
  it.each(["co.in", "https://www.co.in", "org.in", "ac.in", "com", "10.0.0.1"])("rejects %s as a company website", async (website) => {
    global.fetch = vi.fn();
    const res = await handler(post({ companyName: "Acme", website }));
    expect(res.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("accepts acme.co.in", async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [existingRow] })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [{ ...existingRow, website: "acme.co.in" }] })
      .mockResolvedValue({ ok: true, status: 200, json: async () => [] });
    const res = await handler(post({ companyName: "Acme", website: "acme.co.in" }));
    expect(res.status).toBe(200);
  });
});
