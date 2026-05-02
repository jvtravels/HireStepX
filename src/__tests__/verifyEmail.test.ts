import { describe, it, expect } from "vitest";
import { createHmac, randomBytes } from "crypto";
import { validateToken, currentWindow } from "../../server-handlers/_email-verify-helpers";

/**
 * verify-email.ts — token validation
 *
 * The HMAC token contract has to stay byte-identical with the signer in
 * send-welcome.ts. These tests exercise both halves: we construct
 * tokens the way send-welcome.generateVerifyToken does, then assert
 * the verifier accepts / rejects them as designed.
 */

const TEST_SECRET = "x".repeat(32); // ≥16 chars; meets the strength check

/** Mirror send-welcome.ts's generateVerifyToken so we don't have to
 *  import that handler module (it pulls in dns/promises + Vercel deps). */
function issueToken(email: string, secret: string, expiry?: number): string {
  const exp = expiry ?? currentWindow();
  const nonce = randomBytes(8).toString("hex");
  const payload = `${email.toLowerCase().trim()}:${exp}:${nonce}`;
  const hmac = createHmac("sha256", secret).update(payload).digest("hex");
  return `${hmac}.${exp}.${nonce}`;
}

describe("validateToken — 3-part nonce format", () => {
  it("accepts a freshly issued token (round-trip)", () => {
    const token = issueToken("user@example.com", TEST_SECRET);
    expect(validateToken("user@example.com", token, TEST_SECRET)).toBe(true);
  });

  it("rejects when the email payload is tampered with", () => {
    // Issue for user@... but verify with attacker@... — HMAC must mismatch
    const token = issueToken("user@example.com", TEST_SECRET);
    expect(validateToken("attacker@example.com", token, TEST_SECRET)).toBe(false);
  });

  it("rejects an expired token (currentWindow - expiry > 1)", () => {
    const cw = currentWindow();
    const token = issueToken("user@example.com", TEST_SECRET, cw - 5);
    expect(validateToken("user@example.com", token, TEST_SECRET)).toBe(false);
  });

  it("accepts a token at the edge of the validity window (cw - 1)", () => {
    const cw = currentWindow();
    const token = issueToken("user@example.com", TEST_SECRET, cw - 1);
    expect(validateToken("user@example.com", token, TEST_SECRET)).toBe(true);
  });

  it("rejects a future-dated token (defensive against forged future expiry)", () => {
    const cw = currentWindow();
    const token = issueToken("user@example.com", TEST_SECRET, cw + 100);
    expect(validateToken("user@example.com", token, TEST_SECRET)).toBe(false);
  });

  it("rejects a token signed with the wrong secret (forgery attempt)", () => {
    const token = issueToken("user@example.com", "y".repeat(32));
    expect(validateToken("user@example.com", token, TEST_SECRET)).toBe(false);
  });

  it("is case-insensitive on the email", () => {
    const token = issueToken("User@Example.COM", TEST_SECRET);
    // Token was signed with lowercase email; verifier should also lowercase
    expect(validateToken("user@example.com", token, TEST_SECRET)).toBe(true);
    expect(validateToken("USER@EXAMPLE.COM", token, TEST_SECRET)).toBe(true);
  });

  it("tolerates surrounding whitespace on the email", () => {
    const token = issueToken("user@example.com", TEST_SECRET);
    expect(validateToken("  user@example.com  ", token, TEST_SECRET)).toBe(true);
  });
});

describe("validateToken — secret guards", () => {
  it("rejects every token when the secret is empty", () => {
    const token = issueToken("user@example.com", TEST_SECRET);
    expect(validateToken("user@example.com", token, "")).toBe(false);
  });

  it("rejects every token when the secret is too short (<16 chars)", () => {
    // Forged token signed with the short secret would otherwise validate;
    // ensure the strength gate fires first.
    const shortSecret = "shortkey";
    const token = issueToken("user@example.com", shortSecret);
    expect(validateToken("user@example.com", token, shortSecret)).toBe(false);
  });
});

describe("validateToken — invalid formats", () => {
  it("rejects an empty token", () => {
    expect(validateToken("user@example.com", "", TEST_SECRET)).toBe(false);
  });

  it("rejects a 4-part token (unknown format)", () => {
    expect(
      validateToken("user@example.com", "a.b.c.d", TEST_SECRET),
    ).toBe(false);
  });

  it("rejects a 3-part token with a non-numeric expiry", () => {
    const cw = currentWindow();
    const nonce = "deadbeef";
    const payload = `user@example.com:${cw}:${nonce}`;
    const hmac = createHmac("sha256", TEST_SECRET).update(payload).digest("hex");
    const bogus = `${hmac}.NOTANUMBER.${nonce}`;
    expect(validateToken("user@example.com", bogus, TEST_SECRET)).toBe(false);
  });

  it("rejects a 2-part token whose HMAC doesn't match", () => {
    const cw = currentWindow();
    expect(
      validateToken("user@example.com", `notarealhmac.${cw}`, TEST_SECRET),
    ).toBe(false);
  });

  it("rejects a bare-HMAC (1-part) token that doesn't match the legacy signature", () => {
    expect(
      validateToken("user@example.com", "deadbeef".repeat(8), TEST_SECRET),
    ).toBe(false);
  });

  it("accepts a legitimately constructed 1-part legacy token", () => {
    // Document the legacy behaviour — a bare HMAC with no expiry still
    // verifies if it was signed with the same secret.
    const legacy = createHmac("sha256", TEST_SECRET)
      .update("user@example.com")
      .digest("hex");
    expect(validateToken("user@example.com", legacy, TEST_SECRET)).toBe(true);
  });

  it("rejects non-string token / email defensively", () => {
    // @ts-expect-error testing defensive non-string input
    expect(validateToken(null, "tok", TEST_SECRET)).toBe(false);
    // @ts-expect-error
    expect(validateToken("user@x.com", null, TEST_SECRET)).toBe(false);
  });
});

describe("validateToken — interop with send-welcome's signer shape", () => {
  // The shape generateVerifyToken(send-welcome.ts) emits is:
  //   `${hmac}.${expiry}.${nonce}`  where expiry = floor(now / 86400000).
  // Re-construct that exact shape and confirm the verifier accepts it.
  it("round-trips a token built with the documented signer shape", () => {
    const email = "alice@gmail.com";
    const expiry = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
    const nonce = randomBytes(8).toString("hex");
    const payload = `${email.toLowerCase().trim()}:${expiry}:${nonce}`;
    const hmac = createHmac("sha256", TEST_SECRET).update(payload).digest("hex");
    const token = `${hmac}.${expiry}.${nonce}`;
    expect(validateToken(email, token, TEST_SECRET)).toBe(true);
  });
});
