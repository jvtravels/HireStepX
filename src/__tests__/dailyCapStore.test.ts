import { describe, it, expect, beforeEach } from "vitest";
import {
  getTurnsToday,
  incrementTurnsToday,
  ymd,
  __resetDailyCapStoreForTests,
  __setRedisClientForTests,
} from "../../server-handlers/_daily-cap-store";

beforeEach(() => {
  __resetDailyCapStoreForTests();
});

describe("daily-cap-store — ymd", () => {
  it("returns YYYY-MM-DD shape", () => {
    expect(ymd(0)).toBe("1970-01-01");
    expect(ymd(Date.UTC(2026, 4, 14))).toBe("2026-05-14");
  });
});

describe("daily-cap-store — getTurnsToday / incrementTurnsToday", () => {
  it("starts at 0 for a fresh user", async () => {
    expect(await getTurnsToday("u1")).toBe(0);
  });

  it("increment returns the new count", async () => {
    const a = await incrementTurnsToday("u1");
    const b = await incrementTurnsToday("u1");
    const c = await incrementTurnsToday("u1");
    expect(a).toBe(1);
    expect(b).toBe(2);
    expect(c).toBe(3);
  });

  it("getTurnsToday reads the latest count", async () => {
    await incrementTurnsToday("u2");
    await incrementTurnsToday("u2");
    expect(await getTurnsToday("u2")).toBe(2);
  });

  it("anonymous traffic (null / undefined) shares the 'anon' bucket", async () => {
    await incrementTurnsToday(null);
    await incrementTurnsToday(undefined);
    expect(await getTurnsToday(null)).toBe(2);
    expect(await getTurnsToday(undefined)).toBe(2);
  });

  it("separate user IDs do not share counts", async () => {
    await incrementTurnsToday("alice");
    await incrementTurnsToday("alice");
    await incrementTurnsToday("bob");
    expect(await getTurnsToday("alice")).toBe(2);
    expect(await getTurnsToday("bob")).toBe(1);
  });

  it("date rollover resets the stored counter", async () => {
    /* Seed an entry from "yesterday" by reaching into the store via
     * incrementTurnsToday then mocking Date.now to bump the day. We use
     * a one-shot Date.now spy. */
    const realNow = Date.now;
    try {
      await incrementTurnsToday("c1");
      await incrementTurnsToday("c1");
      const tomorrow = Date.UTC(2099, 0, 1);
      Date.now = () => tomorrow;
      expect(await getTurnsToday("c1")).toBe(0);
      expect(await incrementTurnsToday("c1")).toBe(1);
    } finally {
      Date.now = realNow;
    }
  });

  it("__resetDailyCapStoreForTests clears state", async () => {
    await incrementTurnsToday("x");
    expect(await getTurnsToday("x")).toBe(1);
    __resetDailyCapStoreForTests();
    expect(await getTurnsToday("x")).toBe(0);
  });

  it("getTurnsToday is async / returns a Promise", async () => {
    const p = getTurnsToday("z");
    expect(p).toBeInstanceOf(Promise);
    await p;
  });
});

describe("daily-cap-store — Redis backing path", () => {
  it("routes reads/writes through the injected Redis client when present", async () => {
    const fake = {
      store: new Map<string, number>(),
      ttls: new Map<string, number>(),
      async get(key: string) {
        const v = this.store.get(key);
        return v == null ? null : String(v);
      },
      async set(_k: string, _v: string, _m: string, _t: number) { return "OK"; },
      async incr(key: string) {
        const next = (this.store.get(key) ?? 0) + 1;
        this.store.set(key, next);
        return next;
      },
      async expire(key: string, ttlSec: number) {
        this.ttls.set(key, ttlSec);
        return 1;
      },
    };
    __setRedisClientForTests(fake as unknown as Parameters<typeof __setRedisClientForTests>[0]);
    try {
      expect(await getTurnsToday("redisUser")).toBe(0);
      const a = await incrementTurnsToday("redisUser");
      const b = await incrementTurnsToday("redisUser");
      expect(a).toBe(1);
      expect(b).toBe(2);
      expect(await getTurnsToday("redisUser")).toBe(2);
      /* TTL set on first-write only. */
      const today = ymd();
      const k = `hsx:daily-cap:redisUser:${today}`;
      expect(fake.ttls.get(k)).toBe(36 * 60 * 60);
    } finally {
      __setRedisClientForTests(null);
      __resetDailyCapStoreForTests();
    }
  });

  it("falls back to in-memory when Redis throws", async () => {
    const broken = {
      async get() { throw new Error("redis down"); },
      async set() { throw new Error("redis down"); },
      async incr() { throw new Error("redis down"); },
      async expire() { throw new Error("redis down"); },
    };
    __setRedisClientForTests(broken as unknown as Parameters<typeof __setRedisClientForTests>[0]);
    try {
      const a = await incrementTurnsToday("u-fallback");
      expect(a).toBe(1);
      expect(await getTurnsToday("u-fallback")).toBe(1);
    } finally {
      __setRedisClientForTests(null);
      __resetDailyCapStoreForTests();
    }
  });
});
