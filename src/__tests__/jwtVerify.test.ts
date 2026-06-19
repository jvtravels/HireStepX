import { describe, it, expect } from "vitest";
import {
  base64UrlToBytes,
  decodeJwt,
  claimsValid,
  importEs256VerifyKey,
  verifyJwtLocally,
} from "../../server-handlers/_jwt-verify";

/* ── helpers ───────────────────────────────────────────────────────────── */

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function jsonToBase64Url(obj: unknown): string {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(obj)));
}

interface SignedToken {
  token: string;
  kid: string;
  publicJwk: JsonWebKey;
  sub: string;
}

/** Mint a real ES256 JWT using Web Crypto, mirroring Supabase's scheme. */
async function mintEs256Token(
  payloadOverrides: Record<string, unknown> = {},
  headerOverrides: Record<string, unknown> = {},
): Promise<SignedToken> {
  const kp = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const publicJwk = await crypto.subtle.exportKey("jwk", kp.publicKey);
  const kid = "test-kid-1";
  const sub = "user-uuid-123";
  const nowSec = Math.floor(Date.now() / 1000);

  const header = { alg: "ES256", typ: "JWT", kid, ...headerOverrides };
  const payload = {
    sub,
    iss: "https://proj.supabase.co/auth/v1",
    aud: "authenticated",
    exp: nowSec + 3600,
    iat: nowSec,
    ...payloadOverrides,
  };

  const signingInput = `${jsonToBase64Url(header)}.${jsonToBase64Url(payload)}`;
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    kp.privateKey,
    new TextEncoder().encode(signingInput),
  );
  const token = `${signingInput}.${bytesToBase64Url(new Uint8Array(sig))}`;
  return { token, kid, publicJwk, sub };
}

/* ── base64UrlToBytes ──────────────────────────────────────────────────── */

describe("base64UrlToBytes", () => {
  it("round-trips arbitrary bytes", () => {
    const original = new Uint8Array([0, 1, 2, 250, 255, 128, 64]);
    const decoded = base64UrlToBytes(bytesToBase64Url(original));
    expect(decoded).not.toBeNull();
    expect(Array.from(decoded!)).toEqual(Array.from(original));
  });

  it("decodes url-safe alphabet (- and _)", () => {
    // 0xFB 0xFF 0xBF encodes to base64 "+/+/"; url-safe form uses - and _.
    const decoded = base64UrlToBytes("-_-_");
    expect(decoded).not.toBeNull();
  });

  it("returns null on empty / non-string", () => {
    expect(base64UrlToBytes("")).toBeNull();
    // @ts-expect-error testing runtime guard
    expect(base64UrlToBytes(null)).toBeNull();
  });

  it("returns null on impossible base64 length (pad === 1)", () => {
    expect(base64UrlToBytes("abcde")).toBeNull();
  });
});

/* ── decodeJwt ─────────────────────────────────────────────────────────── */

describe("decodeJwt", () => {
  it("parses header, payload, signingInput, and signature", async () => {
    const { token } = await mintEs256Token();
    const decoded = decodeJwt(token);
    expect(decoded).not.toBeNull();
    expect(decoded!.header.alg).toBe("ES256");
    expect(decoded!.header.kid).toBe("test-kid-1");
    expect(decoded!.payload.sub).toBe("user-uuid-123");
    expect(decoded!.signingInput.split(".").length).toBe(2);
    expect(decoded!.signature.length).toBeGreaterThan(0);
  });

  it("returns null when not three segments", () => {
    expect(decodeJwt("a.b")).toBeNull();
    expect(decodeJwt("a.b.c.d")).toBeNull();
  });

  it("returns null on non-JSON header/payload", () => {
    const bad = `${bytesToBase64Url(new TextEncoder().encode("not json"))}.${jsonToBase64Url({ sub: "x" })}.AAAA`;
    expect(decodeJwt(bad)).toBeNull();
  });

  it("returns null on non-string input", () => {
    // @ts-expect-error testing runtime guard
    expect(decodeJwt(undefined)).toBeNull();
  });
});

/* ── claimsValid ───────────────────────────────────────────────────────── */

describe("claimsValid", () => {
  const now = 1_000_000;

  it("accepts an unexpired token with a sub", () => {
    expect(claimsValid({ sub: "u", exp: now + 100 }, { now })).toBe(true);
  });

  it("rejects an expired token (beyond skew)", () => {
    expect(claimsValid({ sub: "u", exp: now - 100 }, { now, clockSkewSec: 60 })).toBe(false);
  });

  it("tolerates expiry within clock skew", () => {
    expect(claimsValid({ sub: "u", exp: now - 30 }, { now, clockSkewSec: 60 })).toBe(true);
  });

  it("rejects a missing/invalid exp", () => {
    expect(claimsValid({ sub: "u" }, { now })).toBe(false);
    expect(claimsValid({ sub: "u", exp: Number.NaN }, { now })).toBe(false);
  });

  it("rejects nbf in the future (beyond skew)", () => {
    expect(claimsValid({ sub: "u", exp: now + 100, nbf: now + 1000 }, { now, clockSkewSec: 60 })).toBe(false);
  });

  it("rejects a mismatched issuer when one is required", () => {
    expect(claimsValid({ sub: "u", exp: now + 100, iss: "https://evil/auth/v1" }, { now, issuer: "https://good/auth/v1" })).toBe(false);
    expect(claimsValid({ sub: "u", exp: now + 100, iss: "https://good/auth/v1" }, { now, issuer: "https://good/auth/v1" })).toBe(true);
  });

  it("rejects a missing sub", () => {
    expect(claimsValid({ exp: now + 100 }, { now })).toBe(false);
    expect(claimsValid({ sub: "", exp: now + 100 }, { now })).toBe(false);
  });
});

/* ── importEs256VerifyKey ──────────────────────────────────────────────── */

describe("importEs256VerifyKey", () => {
  it("imports a real EC P-256 public JWK", async () => {
    const { publicJwk } = await mintEs256Token();
    const key = await importEs256VerifyKey(publicJwk);
    expect(key).not.toBeNull();
    expect(key!.type).toBe("public");
  });

  it("rejects a non-EC / wrong-curve JWK", async () => {
    expect(await importEs256VerifyKey({ kty: "RSA" } as JsonWebKey)).toBeNull();
    expect(await importEs256VerifyKey({ kty: "EC", crv: "P-384" } as JsonWebKey)).toBeNull();
  });
});

/* ── verifyJwtLocally (end-to-end with real crypto) ────────────────────── */

describe("verifyJwtLocally", () => {
  const now = () => Math.floor(Date.now() / 1000);

  async function keyResolverFor(t: SignedToken) {
    const key = await importEs256VerifyKey(t.publicJwk);
    return async (kid: string) => (kid === t.kid ? key : null);
  }

  it("returns ok + userId for a valid, correctly-signed token", async () => {
    const t = await mintEs256Token();
    const result = await verifyJwtLocally(t.token, {
      resolveKey: await keyResolverFor(t),
      now: now(),
      issuer: "https://proj.supabase.co/auth/v1",
    });
    expect(result).toEqual({ kind: "ok", userId: t.sub });
  });

  it("defers when the alg is not ES256", async () => {
    const t = await mintEs256Token({}, { alg: "HS256" });
    const result = await verifyJwtLocally(t.token, { resolveKey: await keyResolverFor(t), now: now() });
    expect(result.kind).toBe("defer");
  });

  it("defers when the kid is unknown (rotation / forged)", async () => {
    const t = await mintEs256Token();
    const result = await verifyJwtLocally(t.token, { resolveKey: async () => null, now: now() });
    expect(result.kind).toBe("defer");
  });

  it("defers when the signature does not match the key", async () => {
    const t = await mintEs256Token();
    const other = await mintEs256Token(); // different keypair
    const wrongKey = await importEs256VerifyKey(other.publicJwk);
    const result = await verifyJwtLocally(t.token, {
      resolveKey: async () => wrongKey,
      now: now(),
    });
    expect(result.kind).toBe("defer");
  });

  it("defers when the token is expired (network path will 401 it)", async () => {
    const t = await mintEs256Token({ exp: now() - 5000 });
    const result = await verifyJwtLocally(t.token, { resolveKey: await keyResolverFor(t), now: now() });
    expect(result.kind).toBe("defer");
  });

  it("defers when a tampered payload breaks the signature", async () => {
    const t = await mintEs256Token();
    const [h, , s] = t.token.split(".");
    const forged = `${h}.${jsonToBase64Url({ sub: "attacker", exp: now() + 3600 })}.${s}`;
    const result = await verifyJwtLocally(forged, { resolveKey: await keyResolverFor(t), now: now() });
    expect(result.kind).toBe("defer");
  });

  it("defers (does not throw) when resolveKey throws", async () => {
    const t = await mintEs256Token();
    const result = await verifyJwtLocally(t.token, {
      resolveKey: async () => { throw new Error("jwks down"); },
      now: now(),
    });
    expect(result.kind).toBe("defer");
  });

  it("defers on an unparseable token", async () => {
    const result = await verifyJwtLocally("garbage", { resolveKey: async () => null, now: now() });
    expect(result.kind).toBe("defer");
  });
});
