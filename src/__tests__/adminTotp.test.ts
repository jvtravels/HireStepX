import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/* Helper: load a fresh module with a specific ADMIN_TOTP_SECRET env var. */
async function loadWith(secret: string | undefined) {
  vi.resetModules();
  if (secret === undefined) vi.stubEnv("ADMIN_TOTP_SECRET", "");
  else vi.stubEnv("ADMIN_TOTP_SECRET", secret);
  return import("../../server-handlers/_admin-totp");
}

/* Known-good TOTP vector from RFC 6238 appendix B, SHA-1.
 * Secret (ASCII "12345678901234567890") in base32 = GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ
 * T=1 (counter=1, i.e. unix time 30..59) → 287082 */
const RFC_SECRET_B32 = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

describe("_admin-totp", () => {
  beforeEach(() => vi.unstubAllEnvs());
  afterEach(() => vi.unstubAllEnvs());

  it("isTotpRequired returns false when env var is absent", async () => {
    const m = await loadWith(undefined);
    expect(m.isTotpRequired()).toBe(false);
  });

  it("isTotpRequired returns true when env var is set", async () => {
    const m = await loadWith(RFC_SECRET_B32);
    expect(m.isTotpRequired()).toBe(true);
  });

  it("verifyAdminTotp returns false when ADMIN_TOTP_SECRET is absent", async () => {
    const m = await loadWith(undefined);
    expect(await m.verifyAdminTotp("000000")).toBe(false);
  });

  it("verifyAdminTotp accepts the current window code", async () => {
    const m = await loadWith(RFC_SECRET_B32);
    // Compute what the current valid code should be by calling the function
    // under test with a known-good T, then verify the same code passes.
    // We do this by stubbing Date.now to T=1 (unix 30..59 seconds).
    vi.setSystemTime(30_000); // T = floor(30 / 30) = 1
    // RFC 6238 vector: T=1 → 287082
    expect(await m.verifyAdminTotp("287082")).toBe(true);
    vi.useRealTimers();
  });

  it("verifyAdminTotp rejects wrong codes", async () => {
    const m = await loadWith(RFC_SECRET_B32);
    vi.setSystemTime(30_000);
    expect(await m.verifyAdminTotp("000000")).toBe(false);
    expect(await m.verifyAdminTotp("123456")).toBe(false);
    vi.useRealTimers();
  });

  it("verifyAdminTotp rejects non-digit and short codes", async () => {
    const m = await loadWith(RFC_SECRET_B32);
    expect(await m.verifyAdminTotp("abc123")).toBe(false);
    expect(await m.verifyAdminTotp("12345")).toBe(false);
    expect(await m.verifyAdminTotp("")).toBe(false);
  });

  it("verifyAdminTotp accepts previous window (clock skew -1)", async () => {
    const m = await loadWith(RFC_SECRET_B32);
    // Set time to T=2 window (60..89 s), but present T=1 code (previous window)
    vi.setSystemTime(60_000); // T = 2
    // T=1 code is 287082 — should still pass with ±1 window tolerance
    expect(await m.verifyAdminTotp("287082")).toBe(true);
    vi.useRealTimers();
  });

  it("verifyAdminTotp rejects invalid base32 secret gracefully", async () => {
    const m = await loadWith("INVALID!!!");
    expect(await m.verifyAdminTotp("000000")).toBe(false);
  });
});
