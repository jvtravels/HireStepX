import { describe, it, expect } from "vitest";
import { sessionJitter } from "../../server-handlers/_session-jitter";

describe("sessionJitter", () => {
  it("returns 0 for null/undefined/empty sessionId (back-compat)", () => {
    expect(sessionJitter(null, "hike", 0.05)).toBe(0);
    expect(sessionJitter(undefined, "hike", 0.05)).toBe(0);
    expect(sessionJitter("", "hike", 0.05)).toBe(0);
  });

  it("is deterministic for a given (sessionId, salt)", () => {
    const a = sessionJitter("sess-A", "hike", 0.05);
    const b = sessionJitter("sess-A", "hike", 0.05);
    expect(a).toBe(b);
  });

  it("stays within [-range, +range]", () => {
    for (let i = 0; i < 200; i++) {
      const j = sessionJitter(`sess-${i}`, "variable", 5);
      expect(j).toBeGreaterThanOrEqual(-5);
      expect(j).toBeLessThanOrEqual(5);
    }
  });

  it("diverges across sessions (not all sessions hit the same jitter)", () => {
    const seen = new Set<number>();
    for (let i = 0; i < 50; i++) {
      seen.add(sessionJitter(`sess-${i}`, "hike", 0.05));
    }
    // Expect a healthy spread, not a near-constant.
    expect(seen.size).toBeGreaterThan(40);
  });

  it("decorrelates across salts (hike + variable axes don't co-vary)", () => {
    /* Sample distinct sessions; check Pearson-style: how often the sign
     * of hike-jitter matches the sign of variable-jitter. If they were
     * the same axis it'd be ~100%; we want roughly ~50% (uncorrelated). */
    let sameSign = 0;
    const N = 500;
    for (let i = 0; i < N; i++) {
      const h = sessionJitter(`s${i}`, "hike-justification", 0.05);
      const v = sessionJitter(`s${i}`, "variable-comfort", 5);
      if (Math.sign(h) === Math.sign(v)) sameSign++;
    }
    const ratio = sameSign / N;
    expect(ratio).toBeGreaterThan(0.35);
    expect(ratio).toBeLessThan(0.65);
  });

  it("approximates a centered distribution (mean near 0 across many sessions)", () => {
    let sum = 0;
    const N = 1000;
    for (let i = 0; i < N; i++) {
      sum += sessionJitter(`sess-${i}`, "hike", 1);
    }
    const mean = sum / N;
    /* Loose bound — 1000 samples, range ±1, want mean within ±0.1. */
    expect(Math.abs(mean)).toBeLessThan(0.1);
  });
});
