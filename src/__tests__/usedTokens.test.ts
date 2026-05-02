import { describe, it, expect, vi } from "vitest";
import {
  hashToken,
  consumeToken,
} from "../../server-handlers/_used-tokens";

const SUPABASE_URL = "https://example.supabase.co";
const SERVICE_KEY = "service-role-key";

function ok(status = 201): Response {
  return {
    ok: true,
    status,
    text: async () => "",
    json: async () => ({}),
  } as Response;
}

function notOk(status: number, body = ""): Response {
  return {
    ok: false,
    status,
    text: async () => body,
    json: async () => ({}),
  } as Response;
}

describe("hashToken", () => {
  it("returns 64-char lowercase hex SHA-256", () => {
    const h = hashToken("any-token");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it("identical tokens hash identically", () => {
    expect(hashToken("abc.123.nonce")).toBe(hashToken("abc.123.nonce"));
  });

  it("different tokens hash differently (collision-resistant)", () => {
    expect(hashToken("a.1.x")).not.toBe(hashToken("a.1.y"));
    expect(hashToken("a.1.x")).not.toBe(hashToken("b.1.x"));
  });

  it("does NOT leak the raw token in the hash", () => {
    const token = "supersecret";
    expect(hashToken(token)).not.toContain(token);
  });
});

describe("consumeToken", () => {
  it("returns config-missing when env is empty (fail-closed)", async () => {
    const r = await consumeToken("", "", "tok", "a@b.com");
    expect(r.ok).toBe(false);
    expect(r.status).toBe("config-missing");
  });

  it("returns 'consumed' on first-write (HTTP 201)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok(201));
    const r = await consumeToken(
      SUPABASE_URL,
      SERVICE_KEY,
      "tok",
      "a@b.com",
      fetchMock as unknown as typeof fetch,
    );
    expect(r).toEqual({ ok: true, status: "consumed" });
  });

  it("returns 'already-used' on PK conflict (HTTP 409)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(notOk(409, "duplicate key"));
    const r = await consumeToken(
      SUPABASE_URL,
      SERVICE_KEY,
      "tok",
      "a@b.com",
      fetchMock as unknown as typeof fetch,
    );
    expect(r).toEqual({ ok: true, status: "already-used" });
  });

  it("returns error (fail-closed) on 5xx", async () => {
    const fetchMock = vi.fn().mockResolvedValue(notOk(503, "Service unavailable"));
    const r = await consumeToken(
      SUPABASE_URL,
      SERVICE_KEY,
      "tok",
      "a@b.com",
      fetchMock as unknown as typeof fetch,
    );
    expect(r.ok).toBe(false);
    expect(r.status).toBe("error");
    if (!r.ok && r.status === "error") {
      expect(r.message).toContain("503");
    }
  });

  it("returns error (fail-closed) on 404 (table missing — migration not run)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(notOk(404, "relation does not exist"));
    const r = await consumeToken(
      SUPABASE_URL,
      SERVICE_KEY,
      "tok",
      "a@b.com",
      fetchMock as unknown as typeof fetch,
    );
    // Critical: a missing migration must NOT silently let replay
    // through. Handler should redirect to "verification-failed".
    expect(r.ok).toBe(false);
  });

  it("returns error on network exception", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    const r = await consumeToken(
      SUPABASE_URL,
      SERVICE_KEY,
      "tok",
      "a@b.com",
      fetchMock as unknown as typeof fetch,
    );
    expect(r.ok).toBe(false);
    if (!r.ok && r.status === "error") {
      expect(r.message).toBe("network down");
    }
  });

  it("posts the token HASH not the raw token (privacy)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok(201));
    await consumeToken(
      SUPABASE_URL,
      SERVICE_KEY,
      "supersecret-token",
      "a@b.com",
      fetchMock as unknown as typeof fetch,
    );
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.token_hash).toBe(hashToken("supersecret-token"));
    // Defensive: the raw token must never appear in the request.
    const requestStr = JSON.stringify(fetchMock.mock.calls[0]);
    expect(requestStr).not.toContain("supersecret-token");
  });

  it("normalizes email (lowercase + trim) before storing", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok(201));
    await consumeToken(
      SUPABASE_URL,
      SERVICE_KEY,
      "tok",
      "  Rahul@Gmail.com  ",
      fetchMock as unknown as typeof fetch,
    );
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.email).toBe("rahul@gmail.com");
  });

  it("hits the right endpoint with service-role auth headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok(201));
    await consumeToken(
      SUPABASE_URL,
      SERVICE_KEY,
      "tok",
      "a@b.com",
      fetchMock as unknown as typeof fetch,
    );
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toBe(`${SUPABASE_URL}/rest/v1/used_verification_tokens`);
    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers["apikey"]).toBe(SERVICE_KEY);
    expect(headers["Authorization"]).toBe(`Bearer ${SERVICE_KEY}`);
  });

  it("uses Prefer: return=minimal (so 409 surfaces, not silent ignore)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok(201));
    await consumeToken(
      SUPABASE_URL,
      SERVICE_KEY,
      "tok",
      "a@b.com",
      fetchMock as unknown as typeof fetch,
    );
    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers["Prefer"]).toBe("return=minimal");
    // Critical: must NOT contain resolution=ignore-duplicates which
    // would silently swallow a replay.
    expect(headers["Prefer"]).not.toContain("ignore-duplicates");
  });
});
