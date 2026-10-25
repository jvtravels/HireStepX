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

import { fetchAllPages } from "../../server-handlers/_batch";

describe("fetchAllPages", () => {
  const source = (n: number) => async (offset: number, limit: number) =>
    Array.from({ length: Math.max(0, Math.min(limit, n - offset)) }, (_, i) => offset + i);

  it("walks pages until a short page and reports complete", async () => {
    const { rows, complete } = await fetchAllPages(source(450), 200, 10);
    expect(rows).toHaveLength(450);
    expect(complete).toBe(true);
  });

  it("treats an exact multiple as complete once an empty page arrives", async () => {
    const { rows, complete } = await fetchAllPages(source(400), 200, 10);
    expect(rows).toHaveLength(400);
    expect(complete).toBe(true);
  });

  it("reports incomplete when maxPages is hit", async () => {
    const { rows, complete } = await fetchAllPages(source(1000), 100, 3);
    expect(rows).toHaveLength(300);
    expect(complete).toBe(false);
  });

  it("keeps rows already read and reports incomplete when a page fails", async () => {
    let calls = 0;
    const { rows, complete } = await fetchAllPages(async (o, l) => (++calls === 2 ? null : source(1000)(o, l)), 100, 10);
    expect(rows).toHaveLength(100);
    expect(complete).toBe(false);
  });
});
