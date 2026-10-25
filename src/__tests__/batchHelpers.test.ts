import { describe, it, expect } from "vitest";
import { mapPool, timeBudget } from "../../server-handlers/_batch";

describe("mapPool", () => {
  it("processes every item", async () => {
    const seen: number[] = [];
    await mapPool([1, 2, 3, 4, 5], 2, async n => { seen.push(n); });
    expect(seen.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("never exceeds the concurrency limit", async () => {
    let inFlight = 0, peak = 0;
    await mapPool(Array.from({ length: 12 }, (_, i) => i), 3, async () => {
      inFlight++; peak = Math.max(peak, inFlight);
      await new Promise(r => setTimeout(r, 5));
      inFlight--;
    });
    expect(peak).toBeLessThanOrEqual(3);
    expect(peak).toBeGreaterThan(1);
  });

  it("keeps going when one item throws", async () => {
    const done: number[] = [];
    await mapPool([1, 2, 3], 1, async n => { if (n === 2) throw new Error("boom"); done.push(n); });
    expect(done).toEqual([1, 3]);
  });

  it("handles an empty list", async () => {
    await expect(mapPool([], 4, async () => {})).resolves.toBeUndefined();
  });
});

describe("timeBudget", () => {
  it("expires once the deadline passes", () => {
    let t = 1_000;
    const b = timeBudget(500, () => t);
    expect(b.expired()).toBe(false);
    t = 1_499;
    expect(b.expired()).toBe(false);
    t = 1_500;
    expect(b.expired()).toBe(true);
  });
});
