import { describe, it, expect, vi } from "vitest";
import { acquireEvalLock, releaseEvalLock, waitForResult } from "../../server-handlers/_eval-lock";

describe("acquireEvalLock", () => {
  it("owns the lock when SET NX succeeds", async () => {
    const redis = vi.fn().mockResolvedValue([{ result: "OK" }]);
    expect(await acquireEvalLock("s1", { redis })).toBe(true);
    expect(redis.mock.calls[0][0][0]).toEqual(["SET", "eval-lock:s1", "1", "NX", "EX", 110]);
  });
  it("does not own it when another invocation holds it", async () => {
    expect(await acquireEvalLock("s1", { redis: vi.fn().mockResolvedValue([{ result: null }]) })).toBe(false);
  });
  it("fails open when Redis is unavailable", async () => {
    expect(await acquireEvalLock("s1", { redis: vi.fn().mockResolvedValue(null) })).toBe(true);
  });
});

describe("releaseEvalLock", () => {
  it("deletes the session's lock key", async () => {
    const redis = vi.fn().mockResolvedValue([{ result: 1 }]);
    await releaseEvalLock("s1", { redis });
    expect(redis).toHaveBeenCalledWith([["DEL", "eval-lock:s1"]]);
  });
});

describe("waitForResult", () => {
  const sleep = () => Promise.resolve();
  it("returns as soon as the holder's result appears", async () => {
    const poll = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce("report");
    expect(await waitForResult(poll, { intervalMs: 3000, maxMs: 45000, sleep })).toBe("report");
    expect(poll).toHaveBeenCalledTimes(2);
  });
  it("gives up after maxMs so the caller can grade itself", async () => {
    const poll = vi.fn().mockResolvedValue(null);
    expect(await waitForResult(poll, { intervalMs: 3000, maxMs: 9000, sleep })).toBeNull();
    expect(poll).toHaveBeenCalledTimes(3);
  });
});
