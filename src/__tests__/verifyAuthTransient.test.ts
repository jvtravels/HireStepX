// _shared.ts captures SUPABASE_URL / SUPABASE_ANON_KEY at module load time,
// so we must set them BEFORE importing verifyAuth. vi.hoisted runs before
// any import statements in the file regardless of declaration order.
import { vi } from "vitest";
vi.hoisted(() => {
  process.env.SUPABASE_URL = "https://fake-supabase.local";
  process.env.SUPABASE_ANON_KEY = "fake-anon-key";
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { verifyAuth } from "../../server-handlers/_shared";

/* verifyAuth must distinguish three classes:
 *   - 401/403 / invalid token → permanent auth-fail (return false, no retry)
 *   - 5xx / network / timeout → transient (retry once with backoff)
 *   - 200 + valid user → ok
 *
 * The audit flagged that swallowing transient errors as auth-fail bounces
 * users mid-interview during Supabase incidents. These tests lock the new
 * classification so a regression doesn't slip in. */

function buildReq(token: string | null = "valid-token"): Request {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  return new Request("https://app.example.com/api/x", { headers });
}

describe("verifyAuth classification", () => {
  const origFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = origFetch; });
  beforeEach(() => { /* fetch reset above */ });

  it("returns authenticated:false with no Bearer token", async () => {
    const result = await verifyAuth(buildReq(null));
    expect(result.authenticated).toBe(false);
    expect(result.userId).toBeUndefined();
  });

  it("returns authenticated:false on 401 (invalid token)", async () => {
    let calls = 0;
    globalThis.fetch = vi.fn(async () => {
      calls++;
      return new Response("", { status: 401 });
    }) as unknown as typeof fetch;
    const result = await verifyAuth(buildReq());
    expect(result.authenticated).toBe(false);
    // No retry on permanent auth fail.
    expect(calls).toBe(1);
  });

  it("retries once on 5xx (transient) before giving up", async () => {
    let calls = 0;
    globalThis.fetch = vi.fn(async () => {
      calls++;
      return new Response("", { status: 503 });
    }) as unknown as typeof fetch;
    const result = await verifyAuth(buildReq());
    expect(result.authenticated).toBe(false);
    expect(calls).toBe(2); // initial + 1 retry
  });

  it("retries on network error and recovers when second call succeeds", async () => {
    let calls = 0;
    globalThis.fetch = vi.fn(async () => {
      calls++;
      if (calls === 1) throw new Error("ECONNRESET");
      return new Response(JSON.stringify({ id: "user_abc123" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as unknown as typeof fetch;
    const result = await verifyAuth(buildReq());
    expect(result.authenticated).toBe(true);
    expect(result.userId).toBe("user_abc123");
    expect(calls).toBe(2);
  });

  it("returns authenticated:true with valid user response", async () => {
    let calls = 0;
    globalThis.fetch = vi.fn(async () => {
      calls++;
      return new Response(JSON.stringify({ id: "user_xyz789" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as unknown as typeof fetch;
    const result = await verifyAuth(buildReq());
    expect(result.authenticated).toBe(true);
    expect(result.userId).toBe("user_xyz789");
    // No retry needed on first-call success.
    expect(calls).toBe(1);
  });

  it("rejects 200 response without an id field", async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ name: "no-id-here" }), { status: 200 })) as unknown as typeof fetch;
    const result = await verifyAuth(buildReq());
    expect(result.authenticated).toBe(false);
  });
});
