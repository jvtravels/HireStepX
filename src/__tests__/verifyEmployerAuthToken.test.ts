// _shared.ts captures SUPABASE_URL / SUPABASE_ANON_KEY at module load time,
// so we must set them BEFORE importing (mirrors verifyAuthTransient.test.ts).
import { vi } from "vitest";
vi.hoisted(() => {
  process.env.SUPABASE_URL = "https://fake-supabase.local";
  process.env.SUPABASE_ANON_KEY = "fake-anon-key";
});

import { describe, it, expect, afterEach } from "vitest";
import { verifyEmployerAuthToken } from "../../server-handlers/_shared";

/* S8: the Node-runtime employer-unlock handlers (employer-create-unlock-order.ts,
 * employer-verify-unlock-payment.ts) can't use the edge verifyAuth()/
 * withAuthAndRateLimit() preamble, but they should still ride out a
 * transient Supabase Auth blip (5xx/network) instead of bouncing an
 * employer mid-payment with a bare 401 on the first hiccup. */

describe("verifyEmployerAuthToken", () => {
  const origFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = origFetch; });

  it("returns ok with the employer id on a valid token", async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ id: "employer_123" }), { status: 200 })) as unknown as typeof fetch;
    const result = await verifyEmployerAuthToken("tok", "https://fake-supabase.local", "fake-anon-key");
    expect(result).toEqual({ kind: "ok", employerId: "employer_123" });
  });

  it("returns auth-fail on 401 with no retry", async () => {
    let calls = 0;
    globalThis.fetch = vi.fn(async () => { calls++; return new Response("", { status: 401 }); }) as unknown as typeof fetch;
    const result = await verifyEmployerAuthToken("tok", "https://fake-supabase.local", "fake-anon-key");
    expect(result).toEqual({ kind: "auth-fail" });
    expect(calls).toBe(1);
  });

  it("retries once on 5xx before giving up", async () => {
    let calls = 0;
    globalThis.fetch = vi.fn(async () => { calls++; return new Response("", { status: 503 }); }) as unknown as typeof fetch;
    const result = await verifyEmployerAuthToken("tok", "https://fake-supabase.local", "fake-anon-key");
    expect(result).toEqual({ kind: "transient" });
    expect(calls).toBe(2);
  });

  it("recovers when the retry succeeds", async () => {
    let calls = 0;
    globalThis.fetch = vi.fn(async () => {
      calls++;
      if (calls === 1) throw new Error("ECONNRESET");
      return new Response(JSON.stringify({ id: "employer_456" }), { status: 200 });
    }) as unknown as typeof fetch;
    const result = await verifyEmployerAuthToken("tok", "https://fake-supabase.local", "fake-anon-key");
    expect(result).toEqual({ kind: "ok", employerId: "employer_456" });
    expect(calls).toBe(2);
  });

  it("treats a 200 with no id as auth-fail", async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ name: "no-id" }), { status: 200 })) as unknown as typeof fetch;
    const result = await verifyEmployerAuthToken("tok", "https://fake-supabase.local", "fake-anon-key");
    expect(result).toEqual({ kind: "auth-fail" });
  });
});
