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
import { createHmac, timingSafeEqual, randomUUID } from "crypto";
import { evaluateSession, NO_REVOCATIONS, parseAdminClaims, tokenExpiry, type AdminClaims } from "./_admin-session-helpers";

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

export interface MintOptions {
  /** Reuse the session id on refresh; a new one is generated at sign-in. */
  sid?: string;
  /** Original sign-in time. Refreshes pass it through so the session cap can't be extended. */
  authTime?: number;
  /** A TOTP code was verified at sign-in. */
  mfa?: boolean;
}

/** Mint a signed, expiring admin session token. */
export function createAdminToken(now: number = Date.now(), opts: MintOptions = {}): string {
  const authTime = opts.authTime ?? now;
  const data = JSON.stringify({
    iat: now,
    exp: tokenExpiry(now, authTime, ADMIN_TOKEN_TTL_MS),
    ast: authTime,
    sid: opts.sid ?? randomUUID(),
    mfa: opts.mfa === true,
  });
  const sig = createHmac("sha256", ADMIN_TOKEN_SECRET).update(data).digest("hex");
  return Buffer.from(data).toString("base64") + "." + sig;
}

/** Signature-checked claims of an admin token, or null. Expiry, revocation and MFA are
 *  NOT judged here so callers can tell "expired" from "forged" (see evaluateSession). */
export function readAdminTokenClaims(token: string): AdminClaims | null {
  if (!ADMIN_TOKEN_SECRET) return null;
  try {
    const [dataB64, sig] = token.split(".");
    if (!dataB64 || !sig) return null;
    const data = Buffer.from(dataB64, "base64").toString();
    const expectedSig = createHmac("sha256", ADMIN_TOKEN_SECRET).update(data).digest("hex");
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length) return null;
    if (!timingSafeEqual(a, b)) return null;
    return parseAdminClaims(JSON.parse(data));
  } catch (err) {
    // A malformed admin token (bad base64/JSON) on an admin-only surface is
    // worth a trace — it's either a tampering attempt or a client bug.
    console.warn("[admin-auth] readAdminTokenClaims rejected a malformed token:", err);
    return null;
  }
}

/** Signature + expiry + session-cap check only (no revocation lookup, no MFA policy). */
export function verifyAdminToken(token: string): boolean {
  const claims = readAdminTokenClaims(token);
  return claims !== null && evaluateSession(claims, { now: Date.now(), requireMfa: false, ...NO_REVOCATIONS }).ok;
}
