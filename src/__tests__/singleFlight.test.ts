import { describe, it, expect, vi } from "vitest";
import { singleFlight } from "../../server-handlers/_single-flight";

describe("singleFlight", () => {
  it("coalesces concurrent calls with the same key into one execution", async () => {
    const fn = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 10));
      return 42;
    });
    const [a, b, c] = await Promise.all([singleFlight("k", fn), singleFlight("k", fn), singleFlight("k", fn)]);
    expect([a, b, c]).toEqual([42, 42, 42]);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("runs again after the first call settles", async () => {
    const fn = vi.fn(async () => 1);
    await singleFlight("again", fn);
    await singleFlight("again", fn);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not coalesce different keys", async () => {
    const fn = vi.fn(async () => 1);
    await Promise.all([singleFlight("x", fn), singleFlight("y", fn)]);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("clears the slot after a rejection so the next call retries", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce("ok");
    await expect(singleFlight("r", fn)).rejects.toThrow("boom");
    await expect(singleFlight("r", fn)).resolves.toBe("ok");
  });
});
