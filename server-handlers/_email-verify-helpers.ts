/* Pure helpers for email verification token validation.
   Extracted from verify-email.ts so the HMAC contract — which has to
   stay byte-identical with send-welcome.ts's signer — is unit-testable
   in isolation. The handler keeps reading the secret from env at module
   load time and passes it in here. */

import { createHmac, timingSafeEqual } from "crypto";

/** Current 24h-window number — exposed so tests can pin it. */
export function currentWindow(now: number = Date.now()): number {
  return Math.floor(now / (24 * 60 * 60 * 1000));
}

/** Validate a verification token. Supports three legacy formats:
 *   - 3-part "<hmac>.<expiryWindow>.<nonce>"   (current — send-welcome.ts issues this)
 *   - 2-part "<hmac>.<expiryWindow>"           (older deterministic format)
 *   - 1-part "<hmac>"                          (legacy bare HMAC, no expiry)
 *
 * Reject everything if the secret is missing / too short — accepting a
 * token signed against an empty key is trivially forgeable, so a
 * misconfigured production environment must fail closed. */
export function validateToken(email: string, token: string, secret: string): boolean {
  if (!secret || secret.length < 16) return false;
  if (typeof email !== "string" || typeof token !== "string") return false;

  const normalizedEmail = email.toLowerCase().trim();
  const parts = token.split(".");

  // 3-part nonce format
  if (parts.length === 3) {
    const [hmacStr, expiryStr, nonce] = parts;
    const expiry = parseInt(expiryStr, 10);
    if (isNaN(expiry)) return false;

    const cw = currentWindow();
    if (cw - expiry > 1) return false;
    // Defensive: a token from the future (clock skew or forgery) — reject.
    if (expiry > cw + 1) return false;

    const payload = `${normalizedEmail}:${expiry}:${nonce}`;
    const expected = createHmac("sha256", secret).update(payload).digest("hex");
    const expectedBuf = Buffer.from(expected);
    const tokenBuf = Buffer.from(hmacStr);
    if (expectedBuf.length !== tokenBuf.length) return false;
    return timingSafeEqual(expectedBuf, tokenBuf);
  }

  // 2-part legacy format
  if (parts.length === 2) {
    const expiryStr = parts[1];
    const expiry = parseInt(expiryStr, 10);
    if (isNaN(expiry)) return false;

    const cw = currentWindow();
    if (cw - expiry > 1) return false;
    if (expiry > cw + 1) return false;

    const expectedPayload = `${normalizedEmail}:${expiry}`;
    const expected =
      createHmac("sha256", secret).update(expectedPayload).digest("hex") + "." + expiry;
    const tokenBuf = Buffer.from(token);
    const expectedBuf = Buffer.from(expected);
    if (tokenBuf.length !== expectedBuf.length) return false;
    return timingSafeEqual(tokenBuf, expectedBuf);
  }

  // 1-part legacy bare HMAC
  if (parts.length === 1) {
    if (!parts[0]) return false;
    const legacyExpected = createHmac("sha256", secret).update(normalizedEmail).digest("hex");
    return token === legacyExpected;
  }

  return false;
}
