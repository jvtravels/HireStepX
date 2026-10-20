import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const recordAdminAudit = vi.fn();
const revokeSession = vi.fn();
vi.mock("../../server-handlers/_admin-session-store", () => ({
  recordAdminAudit: (...a: unknown[]) => recordAdminAudit(...a),
  revokeSession: (...a: unknown[]) => revokeSession(...a),
  loadRevocationState: async () => ({ sidRevoked: false, revokedBeforeMs: null }),
  revokeAllSessions: async () => true,
}));
vi.mock("../../server-handlers/_shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../server-handlers/_shared")>()),
  isRateLimited: async () => false,
}));

async function load(env: Record<string, string>) {
  vi.resetModules();
  vi.stubEnv("ADMIN_PASSWORD", "pw");
  vi.stubEnv("ADMIN_SESSION_SECRET", "secret");
  vi.stubEnv("ADMIN_TOTP_SECRET", "");
  vi.stubEnv("ADMIN_REQUIRE_MFA", "");
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  return { login: await import("../../server-handlers/admin-login"), auth: await import("../../server-handlers/_admin-auth") };
}
const post = (body: unknown) => new Request("http://x/api/admin-login", { method: "POST", body: JSON.stringify(body), headers: { "x-real-ip": "5.5.5.5" } });
const tokenOf = (res: Response) => /admin_token=([^;]+)/.exec(res.headers.get("Set-Cookie") || "")?.[1] ?? "";

beforeEach(() => { recordAdminAudit.mockReset(); revokeSession.mockReset(); });
afterEach(() => vi.unstubAllEnvs());

describe("admin-login — sessions and MFA", () => {
  it("mints a token with a session id, no mfa claim, and audits the sign-in", async () => {
    const { login, auth } = await load({});
    const res = await login.default(post({ password: "pw" }));
    expect(res.status).toBe(200);
    const claims = auth.readAdminTokenClaims(tokenOf(res));
    expect(claims?.sid).toBeTruthy();
    expect(claims?.mfa).toBe(false);
    expect(recordAdminAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "login", outcome: "ok", session_id: claims?.sid, ip: "5.5.5.5" }));
  });

  it("audits a wrong password without recording the password", async () => {
    const { login } = await load({});
    const res = await login.default(post({ password: "nope" }));
    expect(res.status).toBe(401);
    expect(recordAdminAudit).toHaveBeenCalledWith(expect.objectContaining({ outcome: "bad_password" }));
    expect(JSON.stringify(recordAdminAudit.mock.calls)).not.toContain("nope");
  });

  it("ADMIN_REQUIRE_MFA=1 without ADMIN_TOTP_SECRET refuses sign-in with 403 mfa_required and sets no cookie", async () => {
    const { login } = await load({ ADMIN_REQUIRE_MFA: "1" });
    const res = await login.default(post({ password: "pw" }));
    expect(res.status).toBe(403);
    expect((await res.json() as { code: string }).code).toBe("mfa_required");
    expect(res.headers.get("Set-Cookie")).toBeNull();
  });

  it("with a TOTP secret configured the token carries mfa=true", async () => {
    const { login, auth } = await load({ ADMIN_TOTP_SECRET: "JBSWY3DPEHPK3PXP", ADMIN_REQUIRE_MFA: "1" });
    expect((await login.default(post({ password: "pw" }))).status).toBe(401);
    const { verifyAdminTotp } = await import("../../server-handlers/_admin-totp");
    const { createHmac } = await import("crypto");
    const base32 = "JBSWY3DPEHPK3PXP";
    const alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let bits = 0, buf = 0; const bytes: number[] = [];
    for (const ch of base32) { buf = (buf << 5) | alpha.indexOf(ch); bits += 5; if (bits >= 8) { bytes.push((buf >>> (bits - 8)) & 0xff); bits -= 8; } }
    const ctr = Buffer.alloc(8); ctr.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 1000 / 30)));
    const mac = createHmac("sha1", Buffer.from(bytes)).update(ctr).digest();
    const off = mac[19] & 0x0f;
    const code = String(((mac.readUInt32BE(off) & 0x7fffffff) % 1_000_000)).padStart(6, "0");
    expect(await verifyAdminTotp(code)).toBe(true);
    const ok = await login.default(post({ password: "pw", totp: code }));
    expect(ok.status).toBe(200);
    expect(auth.readAdminTokenClaims(tokenOf(ok))?.mfa).toBe(true);
  });

  it("logout revokes the presented session id and audits it", async () => {
    const { login, auth } = await load({});
    const token = tokenOf(await login.default(post({ password: "pw" })));
    const sid = auth.readAdminTokenClaims(token)!.sid;
    const res = await login.adminLogoutHandler(new Request("http://x", { method: "DELETE", headers: { cookie: `admin_token=${token}` } }));
    expect(res.status).toBe(200);
    expect(revokeSession).toHaveBeenCalledWith(sid);
    expect(recordAdminAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "logout", session_id: sid }));
  });
});
