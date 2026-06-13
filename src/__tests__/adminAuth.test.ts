import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/* _admin-auth derives its signing key from env at module load, so each test
 * stubs the env it wants, then imports a fresh copy of the module. */
async function loadWith(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) vi.stubEnv(k, "");
    else vi.stubEnv(k, v);
  }
  return import("../../server-handlers/_admin-auth");
}

describe("_admin-auth", () => {
  beforeEach(() => vi.unstubAllEnvs());
  afterEach(() => vi.unstubAllEnvs());

  it("round-trips a freshly minted token", async () => {
    const m = await loadWith({ ADMIN_PASSWORD: "hunter2", ADMIN_SESSION_SECRET: undefined });
    expect(m.adminAuthConfigured()).toBe(true);
    expect(m.verifyAdminToken(m.createAdminToken())).toBe(true);
  });

  it("fails closed when no signing key is configured", async () => {
    const m = await loadWith({ ADMIN_PASSWORD: undefined, ADMIN_SESSION_SECRET: undefined });
    expect(m.adminAuthConfigured()).toBe(false);
    // A token minted with NO key must not verify — this is the forgery guard.
    expect(m.verifyAdminToken(m.createAdminToken())).toBe(false);
    expect(m.verifyAdminToken("anything.atall")).toBe(false);
  });

  it("does not accept a token forged with the old literal 'fallback-secret'", async () => {
    // Reproduce the pre-fix attack: sign a never-expiring token with the
    // public constant that used to be the default key.
    const { createHmac } = await import("crypto");
    const data = JSON.stringify({ iat: 0, exp: Date.now() + 1_000_000 });
    const sig = createHmac("sha256", "fallback-secret").update(data).digest("hex");
    const forged = Buffer.from(data).toString("base64") + "." + sig;

    const m = await loadWith({ ADMIN_PASSWORD: "real-password", ADMIN_SESSION_SECRET: undefined });
    expect(m.verifyAdminToken(forged)).toBe(false);
  });

  it("rejects expired tokens", async () => {
    const m = await loadWith({ ADMIN_PASSWORD: "hunter2", ADMIN_SESSION_SECRET: undefined });
    const expired = m.createAdminToken(Date.now() - m.ADMIN_TOKEN_TTL_MS - 1000);
    expect(m.verifyAdminToken(expired)).toBe(false);
  });

  it("rejects tampered payloads and malformed tokens", async () => {
    const m = await loadWith({ ADMIN_PASSWORD: "hunter2", ADMIN_SESSION_SECRET: undefined });
    const good = m.createAdminToken();
    const [, sig] = good.split(".");
    const tamperedPayload = Buffer.from(JSON.stringify({ iat: 0, exp: Date.now() + 1e9 })).toString("base64");
    expect(m.verifyAdminToken(`${tamperedPayload}.${sig}`)).toBe(false);
    expect(m.verifyAdminToken("")).toBe(false);
    expect(m.verifyAdminToken("no-dot")).toBe(false);
    expect(m.verifyAdminToken("a.b.c")).toBe(false);
  });

  it("issuer and verifier agree when ADMIN_SESSION_SECRET is set", async () => {
    // Same env → same derived key → interop. This is the property the
    // admin-data issuer and admin-quality verifiers rely on.
    const env = { ADMIN_PASSWORD: "pw", ADMIN_SESSION_SECRET: "dedicated-secret" };
    const issuer = await loadWith(env);
    const token = issuer.createAdminToken();
    const verifier = await loadWith(env);
    expect(verifier.verifyAdminToken(token)).toBe(true);
  });
});
