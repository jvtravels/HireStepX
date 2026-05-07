import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { hashStable, redisGet, redisSetEx } from "../../server-handlers/_shared";

/* hashStable underpins every cache key (generate-questions response cache,
 * future memoization). Wrong determinism = silent cache misses; wrong hash
 * collision = silent wrong-result returns. Lock the contract here. */

describe("hashStable", () => {
  it("returns a 24-char hex string", async () => {
    const out = await hashStable("anything");
    expect(out).toMatch(/^[0-9a-f]{24}$/);
  });

  it("is deterministic for identical input", async () => {
    const a = await hashStable('{"role":"pm","focus":"behavioral"}');
    const b = await hashStable('{"role":"pm","focus":"behavioral"}');
    expect(a).toBe(b);
  });

  it("differs for different inputs (no collision on simple cases)", async () => {
    const a = await hashStable("foo");
    const b = await hashStable("bar");
    const c = await hashStable("foo ");
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });

  it("handles empty string and unicode without throwing", async () => {
    const empty = await hashStable("");
    const unicode = await hashStable("नमस्ते 👋 résumé");
    expect(empty).toMatch(/^[0-9a-f]{24}$/);
    expect(unicode).toMatch(/^[0-9a-f]{24}$/);
    expect(empty).not.toBe(unicode);
  });
});

/* redisGet / redisSetEx fall through to a no-op when env vars aren't set,
 * which is the local-dev / CI default. They must NEVER throw, regardless of
 * Redis state — generate-questions and other call sites depend on best-
 * effort cache semantics. */

describe("redisGet / redisSetEx without Upstash env", () => {
  // Save and clear env vars so we test the no-Redis branch.
  const savedUrl = process.env.UPSTASH_REDIS_REST_URL;
  const savedTok = process.env.UPSTASH_REDIS_REST_TOKEN;
  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });
  afterEach(() => {
    if (savedUrl !== undefined) process.env.UPSTASH_REDIS_REST_URL = savedUrl;
    if (savedTok !== undefined) process.env.UPSTASH_REDIS_REST_TOKEN = savedTok;
  });

  it("redisGet returns null when Redis isn't configured", async () => {
    const v = await redisGet("any-key");
    expect(v).toBeNull();
  });

  it("redisSetEx silently succeeds when Redis isn't configured", async () => {
    await expect(redisSetEx("k", 60, "v")).resolves.toBeUndefined();
  });
});

describe("redisGet / redisSetEx fail-open semantics", () => {
  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = "https://fake-redis.local";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
  });

  it("redisGet returns null when fetch throws", async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = vi.fn(() => Promise.reject(new Error("ECONNREFUSED"))) as unknown as typeof fetch;
    try {
      const v = await redisGet("any-key");
      expect(v).toBeNull();
    } finally {
      globalThis.fetch = orig;
    }
  });

  it("redisSetEx swallows fetch errors", async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = vi.fn(() => Promise.reject(new Error("ECONNREFUSED"))) as unknown as typeof fetch;
    try {
      // Must not throw — generate-questions call site uses void redisSetEx(...)
      await expect(redisSetEx("k", 60, "v")).resolves.toBeUndefined();
    } finally {
      globalThis.fetch = orig;
    }
  });
});
