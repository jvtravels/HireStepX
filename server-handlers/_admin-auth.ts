/* Shared admin session-token auth for the admin dashboard handlers.
 *
 * One signing key, derived once, shared by the issuer (/api/admin-data, which
 * mints a token on password login) and every verifier (the admin-quality-*
 * handlers). Keeping the derivation in a single module is load-bearing: the
 * issuer and verifiers MUST agree on the key or every token is rejected.
 *
 * It also removes the old per-handler `process.env.ADMIN_PASSWORD ||
 * "fallback-secret"` default. That default meant a deploy with ADMIN_PASSWORD
 * unset signed and verified tokens with a publicly-known constant — anyone
 * could forge a valid admin token and read the entire database. We now fail
 * closed: with no key configured, verifyAdminToken() rejects everything.
 */
import { createHmac, timingSafeEqual } from "crypto";

const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || "").trim();

/** Token signing key. Prefer a dedicated ADMIN_SESSION_SECRET; otherwise
 *  derive it from ADMIN_PASSWORD via HMAC (never the literal password, never a
 *  predictable constant). Empty string when neither env var is set, which
 *  makes verifyAdminToken() reject everything — fail closed. */
export const ADMIN_TOKEN_SECRET =
  (process.env.ADMIN_SESSION_SECRET || "").trim() ||
  (ADMIN_PASSWORD
    ? createHmac("sha256", "hirestepx-admin-token-v1").update(ADMIN_PASSWORD).digest("hex")
    : "");

export const ADMIN_TOKEN_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

/** True when an admin signing key is configured. Handlers can use this to
 *  return 503 (rather than a confusing 401) when the deploy is misconfigured. */
export function adminAuthConfigured(): boolean {
  return ADMIN_TOKEN_SECRET.length > 0;
}

/** Mint a signed, expiring admin session token. */
export function createAdminToken(now: number = Date.now()): string {
  const data = JSON.stringify({ iat: now, exp: now + ADMIN_TOKEN_TTL_MS });
  const sig = createHmac("sha256", ADMIN_TOKEN_SECRET).update(data).digest("hex");
  return Buffer.from(data).toString("base64") + "." + sig;
}

/** Verify an admin session token. Fails closed when no signing key is
 *  configured, on malformed input, bad signatures, and expiry. */
export function verifyAdminToken(token: string): boolean {
  if (!ADMIN_TOKEN_SECRET) return false;
  try {
    const [dataB64, sig] = token.split(".");
    if (!dataB64 || !sig) return false;
    const data = Buffer.from(dataB64, "base64").toString();
    const expectedSig = createHmac("sha256", ADMIN_TOKEN_SECRET).update(data).digest("hex");
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length) return false;
    if (!timingSafeEqual(a, b)) return false;
    const payload = JSON.parse(data);
    if (typeof payload?.exp !== "number" || Date.now() > payload.exp) return false;
    return true;
  } catch {
    return false;
  }
}
