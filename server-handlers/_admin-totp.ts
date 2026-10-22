/* Admin TOTP (RFC 6238) — second factor for admin login.
 *
 * Pure Web Crypto: works in both Edge and Node runtimes without any npm deps.
 * HOTP = HMAC-SHA1(secret, T) truncated to 6 digits.
 * TOTP wraps HOTP with T = floor(unix / 30).
 * Accepts ±1 window (90-second tolerance for clock skew).
 *
 * Gated by ADMIN_TOTP_SECRET env var. When the var is absent, every caller
 * returns false from isTotpRequired(), so admin-login falls through to
 * password-only auth without breaking anything. Set ADMIN_TOTP_SECRET to a
 * base32-encoded TOTP secret (generate with e.g. `oathtool --totp -b`).
 */

declare const process: { env: Record<string, string | undefined> };

export function isTotpRequired(): boolean {
  return Boolean((process.env.ADMIN_TOTP_SECRET || "").trim());
}

/** RFC 4648 base32 decode (no padding required, spaces/hyphens stripped). */
function base32Decode(raw: string): Uint8Array<ArrayBuffer> {
  const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const s = raw.toUpperCase().replace(/[\s=-]/g, "");
  const out: number[] = [];
  let buf = 0, bits = 0;
  for (const ch of s) {
    const v = ALPHA.indexOf(ch);
    if (v === -1) throw new Error(`Invalid base32 char: ${ch}`);
    buf = (buf << 5) | v;
    bits += 5;
    if (bits >= 8) {
      out.push((buf >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out) as Uint8Array<ArrayBuffer>;
}

/** Counter as 8-byte big-endian (HOTP spec). */
function counterBytes(n: number): Uint8Array<ArrayBuffer> {
  const high = Math.floor(n / 0x100000000) >>> 0;
  const low = n >>> 0;
  const buf = new Uint8Array(8);
  buf[0] = (high >>> 24) & 0xff; buf[1] = (high >>> 16) & 0xff;
  buf[2] = (high >>> 8)  & 0xff; buf[3] =  high         & 0xff;
  buf[4] = (low  >>> 24) & 0xff; buf[5] = (low  >>> 16) & 0xff;
  buf[6] = (low  >>> 8)  & 0xff; buf[7] =  low          & 0xff;
  return buf as Uint8Array<ArrayBuffer>;
}

/** Compute the 6-digit HOTP code for a given HMAC-SHA1 key and counter. */
async function hotp(keyBytes: Uint8Array<ArrayBuffer>, counter: number): Promise<string> {
  const algo: HmacImportParams = { name: "HMAC", hash: "SHA-1" };
  const key = await crypto.subtle.importKey("raw", keyBytes, algo, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, counterBytes(counter)));
  const offset = mac[19] & 0x0f;
  const code =
    ((mac[offset] & 0x7f) << 24) |
    ((mac[offset + 1] & 0xff) << 16) |
    ((mac[offset + 2] & 0xff) << 8) |
    (mac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}

/**
 * Verify a 6-digit TOTP code against the ADMIN_TOTP_SECRET env var.
 * Checks the current, previous, and next 30-second windows (±1).
 * Returns false if secret is not configured or code format is wrong.
 */
export async function verifyAdminTotp(code: string): Promise<boolean> {
  const secret = (process.env.ADMIN_TOTP_SECRET || "").trim();
  if (!secret) return false;
  if (!/^\d{6}$/.test(code)) return false;
  let keyBytes: Uint8Array<ArrayBuffer>;
  try {
    keyBytes = base32Decode(secret);
  } catch {
    return false;
  }
  const T = Math.floor(Date.now() / 1000 / 30);
  for (const offset of [-1, 0, 1]) {
    if ((await hotp(keyBytes, T + offset)) === code) return true;
  }
  return false;
}
