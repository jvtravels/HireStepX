import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createUnconfirmedUser,
  isExistingUserResponse,
  validateSignupFields,
} from "../../server-handlers/_signup-account";

const input = {
  supabaseUrl: "https://x.supabase.co",
  serviceKey: "svc",
  email: "a@gmail.com",
  password: "StrongP@ss1",
  name: "  Asha  ",
  consentKey: "consent_terms_privacy_version",
  consentVersion: "2026-01",
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("validateSignupFields", () => {
  it("accepts a valid name and password", () => {
    expect(validateSignupFields("Asha", "StrongP@ss1")).toBeNull();
  });
  it("rejects weak passwords with the policy message", () => {
    expect(validateSignupFields("Asha", "short")).toMatch(/at least 8/);
    expect(validateSignupFields("Asha", "alllower1!")).toMatch(/uppercase/);
    expect(validateSignupFields("Asha", undefined)).toMatch(/at least 8/);
  });
  it("rejects blank, oversized and non-string names", () => {
    expect(validateSignupFields("   ", "StrongP@ss1")).toMatch(/Name is required/);
    expect(validateSignupFields("x".repeat(49), "StrongP@ss1")).toMatch(/Name is required/);
    expect(validateSignupFields(42, "StrongP@ss1")).toMatch(/Name is required/);
  });
});

describe("isExistingUserResponse", () => {
  it("recognises GoTrue's email_exists codes", () => {
    expect(isExistingUserResponse(422, { error_code: "email_exists" })).toBe(true);
    expect(isExistingUserResponse(422, { error_code: "user_already_exists" })).toBe(true);
  });
  it("falls back to message matching", () => {
    expect(isExistingUserResponse(422, { msg: "A user with this email address has already been registered" })).toBe(true);
  });
  it("does not treat other failures as existing", () => {
    expect(isExistingUserResponse(500, { error_code: "email_exists" })).toBe(false);
    expect(isExistingUserResponse(422, { error_code: "weak_password", msg: "Password too weak" })).toBe(false);
    expect(isExistingUserResponse(400, null)).toBe(false);
  });
});

describe("createUnconfirmedUser", () => {
  it("creates the user unconfirmed, with metadata and consent, and returns the id", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { id: "uid-1" }));
    const r = await createUnconfirmedUser(input, fetchImpl as unknown as typeof fetch);
    expect(r).toEqual({ kind: "created", id: "uid-1" });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://x.supabase.co/auth/v1/admin/users");
    expect(init.method).toBe("POST");
    const sent = JSON.parse(String(init.body));
    expect(sent.email_confirm).toBe(false);
    expect(sent.user_metadata).toEqual({
      name: "Asha",
      custom_email_verified: false,
      consent_terms_privacy_version: "2026-01",
    });
  });
  it("maps an already-registered email to kind exists", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(422, { error_code: "email_exists", msg: "exists" }));
    expect(await createUnconfirmedUser(input, fetchImpl as unknown as typeof fetch)).toEqual({ kind: "exists" });
  });
  it("surfaces other failures with their status", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(503, { msg: "down" }));
    expect(await createUnconfirmedUser(input, fetchImpl as unknown as typeof fetch)).toEqual({ kind: "error", status: 503 });
  });
  it("treats a 200 without an id as an error", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, {}));
    expect(await createUnconfirmedUser(input, fetchImpl as unknown as typeof fetch)).toEqual({ kind: "error", status: 502 });
  });
});

describe("send-welcome create-account action", () => {
  type Captured = { status: number; body: unknown };
  const calls: { url: string; body: Record<string, unknown> | null }[] = [];

  function makeRes() {
    const out: Captured = { status: 200, body: undefined };
    const res = {
      setHeader() { return res; },
      status(c: number) { out.status = c; return res; },
      json(b: unknown) { out.body = b; return res; },
      end() { return res; },
    };
    return { res, out };
  }

  async function run(body: Record<string, unknown>, opts: { origin?: string; createStatus?: number; createBody?: unknown; env?: Record<string, string> } = {}) {
    vi.resetModules();
    vi.stubEnv("SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "svc");
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("EMAIL_VERIFICATION_SECRET", "s".repeat(48));
    vi.stubEnv("APP_URL", "https://hirestepx.com");
    for (const [k, v] of Object.entries(opts.env ?? {})) vi.stubEnv(k, v);
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
      if (url.includes("/auth/v1/admin/users")) {
        return jsonResponse(opts.createStatus ?? 200, opts.createBody ?? { id: "uid-9" });
      }
      return jsonResponse(200, { id: "mail-1" });
    }));
    const mod = await import("../../server-handlers/send-welcome");
    const { res, out } = makeRes();
    const origin = opts.origin ?? "https://hirestepx.com";
    const req = {
      method: "POST",
      headers: { origin, "x-forwarded-for": `10.0.0.${Math.floor(Math.random() * 250)}` },
      body: { action: "create-account", email: `u${Math.random().toString(36).slice(2)}@gmail.com`, name: "Asha", password: "StrongP@ss1", ...body },
    };
    // @ts-expect-error minimal Vercel req/res doubles
    await mod.default(req, res);
    return out;
  }

  beforeEach(() => { calls.length = 0; });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  const mails = () => calls.filter(c => c.url === "https://api.resend.com/emails");
  const creates = () => calls.filter(c => c.url.includes("/auth/v1/admin/users"));

  it("creates the account unconfirmed and sends exactly one Resend verification email", async () => {
    const out = await run({ ref: "HSX-ABC123" });
    expect(out).toEqual({ status: 200, body: { ok: true } });
    expect(creates()).toHaveLength(1);
    expect(creates()[0].body?.email_confirm).toBe(false);
    expect(mails()).toHaveLength(1);
    expect(mails()[0].body?.subject).toBe("Verify your email to get started");
    expect(String(mails()[0].body?.html)).toContain("ref=HSX-ABC123");
  });

  it("answers identically for an existing email but sends the already-have-an-account mail", async () => {
    const out = await run({}, { createStatus: 422, createBody: { error_code: "email_exists" } });
    expect(out).toEqual({ status: 200, body: { ok: true } });
    expect(mails()).toHaveLength(1);
    expect(mails()[0].body?.subject).toBe("You already have an account");
  });

  it("rejects a weak password before touching Supabase", async () => {
    const out = await run({ password: "weak" });
    expect(out.status).toBe(400);
    expect(creates()).toHaveLength(0);
    expect(mails()).toHaveLength(0);
  });

  it("requires an allowed Origin", async () => {
    const out = await run({}, { origin: "https://evil.example" });
    expect(out.status).toBe(403);
    expect(creates()).toHaveLength(0);
  });

  it("rejects disposable email addresses", async () => {
    const out = await run({ email: "x@mailinator.com" });
    expect(out.status).toBe(400);
    expect(creates()).toHaveLength(0);
  });

  it("creates no account in production when email cannot be sent", async () => {
    const out = await run({}, { env: { VERCEL_ENV: "production", RESEND_API_KEY: "" } });
    expect(out.status).toBe(500);
    expect(creates()).toHaveLength(0);
  });

  it("surfaces an upstream creation failure without sending mail", async () => {
    const out = await run({}, { createStatus: 503, createBody: { msg: "down" } });
    expect(out.status).toBe(502);
    expect(mails()).toHaveLength(0);
  });
});
