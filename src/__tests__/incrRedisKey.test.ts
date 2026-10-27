import { describe, it, expect, vi, afterEach } from "vitest";

vi.hoisted(() => {
  process.env.SUPABASE_URL = "https://s.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "svc";
  process.env.RESEND_API_KEY = "re_key";
  process.env.APP_URL = "https://app.test";
});

import { incrRedisKey } from "../../server-handlers/send-welcome";

describe("incrRedisKey", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("sets the TTL only on the first hit (EXPIRE NX) so the window cannot slide", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.test");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "tok");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([{ result: 3 }, { result: 0 }]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await incrRedisKey("signup:ip:1.2.3.4", 3600)).toBe(3);
    const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown[])[1] && ((fetchMock.mock.calls[0] as unknown[])[1] as RequestInit).body));
    expect(body).toEqual([["INCR", "signup:ip:1.2.3.4"], ["EXPIRE", "signup:ip:1.2.3.4", 3600, "NX"]]);
  });

  it("in-memory fallback keeps the original expiry across increments", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.useFakeTimers();
    vi.setSystemTime(0);
    expect(await incrRedisKey("k-fallback", 60)).toBe(1);
    vi.setSystemTime(40_000);
    expect(await incrRedisKey("k-fallback", 60)).toBe(2);
    vi.setSystemTime(61_000);
    expect(await incrRedisKey("k-fallback", 60)).toBe(1);
  });
});
