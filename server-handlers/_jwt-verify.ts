/* Local Supabase JWT (ES256) verification.
 *
 * WHY THIS EXISTS
 * ---------------
 * verifyAuth() used to authenticate every API request by round-tripping to
 * Supabase `${SUPABASE_URL}/auth/v1/user`. An interview fires several authed
 * calls concurrently at session start (generate-questions + record-session-
 * start, then per-turn follow-up + interview_turns writes), and each one
 * independently introspected the SAME token over the network. Under that burst
 * the /auth/v1/user endpoint slows down / rate-limits, the 5s abort fires, and
 * verifyAuth surfaces the transient failure as `authenticated:false` — a
 * SPURIOUS 401. Observed live on staging: generate-questions [200] but
 * record-session-start [401] and follow-up [401] with the exact same valid
 * bearer token (durations ~6.5s, i.e. timeout + retry). That silently breaks
 * server-side session recording (the immutable lifetime counter / quota /
 * streak) and the dynamic follow-up.
 *
 * Supabase now issues asymmetric ES256 JWTs (note the `kid` + `alg:"ES256"`
 * header) with a published JWKS, so we can verify the signature + claims
 * locally with Web Crypto and skip the per-call round-trip entirely.
 *
 * SAFETY CONTRACT
 * ---------------
 * This module only ever produces a FAST POSITIVE. A cryptographically valid,
 * unexpired token signed by a current JWKS key returns {kind:"ok", userId}.
 * EVERYTHING else — unparseable token, non-ES256 alg, missing/unknown kid,
 * unresolved key, signature mismatch, failed/absent JWKS, expired or malformed
 * claims — returns {kind:"defer"}, and the caller falls back to the proven
 * network introspection path (which rejects forged/expired tokens with a real
 * 401). So there is no new way to grant access and no new lockout mode: the
 * worst case is we occasionally take the old (working) network path. */

export interface JwtHeader {
  alg?: string;
  kid?: string;
  typ?: string;
}

export interface JwtPayload {
  sub?: string;
  exp?: number;
  nbf?: number;
  iat?: number;
  iss?: string;
  aud?: string | string[];
}

export interface DecodedJwt {
  header: JwtHeader;
  payload: JwtPayload;
  /** The `${headerB64}.${payloadB64}` string that was signed (ASCII). */
  signingInput: string;
  /** Raw signature bytes (for ES256: the 64-byte r‖s concatenation). */
  signature: Uint8Array<ArrayBuffer>;
}

export type LocalVerifyResult = { kind: "ok"; userId: string } | { kind: "defer" };

/** Decode a base64url segment to bytes. Returns null on malformed input. */
export function base64UrlToBytes(seg: string): Uint8Array<ArrayBuffer> | null {
  if (typeof seg !== "string" || seg.length === 0) return null;
  // base64url → base64, then pad to a multiple of 4.
  let b64 = seg.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4;
  if (pad === 1) return null; // never a valid base64 length
  if (pad) b64 += "=".repeat(4 - pad);
  try {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/** Decode a base64url segment to a UTF-8 JSON object. Returns null on failure. */
function base64UrlToJson(seg: string): unknown {
  const bytes = base64UrlToBytes(seg);
  if (!bytes) return null;
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

/** Parse a compact JWS (`header.payload.signature`) without verifying it. */
export function decodeJwt(token: string): DecodedJwt | null {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const header = base64UrlToJson(h);
  const payload = base64UrlToJson(p);
  const signature = base64UrlToBytes(s);
  if (!header || typeof header !== "object") return null;
  if (!payload || typeof payload !== "object") return null;
  if (!signature) return null;
  return {
    header: header as JwtHeader,
    payload: payload as JwtPayload,
    signingInput: `${h}.${p}`,
    signature,
  };
}

/** Validate time + issuer claims. `now` and `clockSkewSec` are in seconds. */
export function claimsValid(
  payload: JwtPayload,
  opts: { now: number; issuer?: string; clockSkewSec?: number },
): boolean {
  const skew = opts.clockSkewSec ?? 60;
  if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) return false;
  if (opts.now > payload.exp + skew) return false; // expired
  if (typeof payload.nbf === "number" && Number.isFinite(payload.nbf)) {
    if (opts.now + skew < payload.nbf) return false; // not yet valid
  }
  if (opts.issuer && payload.iss && payload.iss !== opts.issuer) return false;
  if (typeof payload.sub !== "string" || payload.sub.length === 0) return false;
  return true;
}

/** Import a Supabase EC P-256 public JWK as a Web Crypto verify key. */
export async function importEs256VerifyKey(
  jwk: JsonWebKey,
  subtle: SubtleCrypto = crypto.subtle,
): Promise<CryptoKey | null> {
  try {
    if (jwk.kty !== "EC" || jwk.crv !== "P-256") return null;
    return await subtle.importKey(
      "jwk",
      jwk,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
  } catch {
    return null;
  }
}

/**
 * Verify a token locally. Returns {kind:"ok", userId} ONLY for a fully valid
 * ES256 token; otherwise {kind:"defer"} (see the SAFETY CONTRACT above).
 *
 * `resolveKey(kid)` returns the matching JWKS CryptoKey, or null when the key
 * is unknown / JWKS is unavailable — in which case we defer.
 */
export async function verifyJwtLocally(
  token: string,
  opts: {
    resolveKey: (kid: string) => Promise<CryptoKey | null>;
    now: number;
    issuer?: string;
    clockSkewSec?: number;
    subtle?: SubtleCrypto;
  },
): Promise<LocalVerifyResult> {
  const decoded = decodeJwt(token);
  if (!decoded) return { kind: "defer" };
  if (decoded.header.alg !== "ES256") return { kind: "defer" };
  if (!decoded.header.kid) return { kind: "defer" };

  let key: CryptoKey | null;
  try {
    key = await opts.resolveKey(decoded.header.kid);
  } catch {
    return { kind: "defer" };
  }
  if (!key) return { kind: "defer" };

  const subtle = opts.subtle ?? crypto.subtle;
  let signatureOk = false;
  try {
    signatureOk = await subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      decoded.signature,
      new TextEncoder().encode(decoded.signingInput),
    );
  } catch {
    return { kind: "defer" };
  }
  if (!signatureOk) return { kind: "defer" };

  if (!claimsValid(decoded.payload, { now: opts.now, issuer: opts.issuer, clockSkewSec: opts.clockSkewSec })) {
    return { kind: "defer" };
  }
  return { kind: "ok", userId: decoded.payload.sub as string };
}
