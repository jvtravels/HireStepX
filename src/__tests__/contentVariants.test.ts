import { describe, it, expect } from "vitest";
import { pickVariant } from "../../data/_content-variants";

describe("pickVariant", () => {
  it("is deterministic for the same seed", () => {
    const variants = ["a", "b", "c"] as const;
    const first = pickVariant("sarvam:software-engineer", variants);
    const second = pickVariant("sarvam:software-engineer", variants);
    expect(second).toBe(first);
  });

  it("always returns one of the supplied variants", () => {
    const variants = ["a", "b", "c", "d"] as const;
    for (const seed of ["tcs", "infosys", "wipro", "razorpay", ""]) {
      expect(variants).toContain(pickVariant(seed, variants));
    }
  });

  it("spreads across variants rather than collapsing to one", () => {
    const variants = [0, 1, 2] as const;
    const seeds = Array.from({ length: 30 }, (_, i) => `company-${i}`);
    const picked = new Set(seeds.map((s) => pickVariant(s, variants)));
    expect(picked.size).toBeGreaterThan(1);
  });

  it("handles a single-variant list", () => {
    expect(pickVariant("anything", ["only"] as const)).toBe("only");
  });
});
