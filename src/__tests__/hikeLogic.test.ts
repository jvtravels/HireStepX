/* PDF #17 architectural fix (2026-05-15) — hike-ratio probe logic. */
import { describe, it, expect } from "vitest";
import { computeHikeRatio } from "../../server-handlers/_discovery-stage";

describe("computeHikeRatio", () => {
  it("returns null signal when current is unknown", () => {
    expect(computeHikeRatio(null, 30).signal).toBeNull();
  });

  it("returns null signal when target is unknown", () => {
    expect(computeHikeRatio(20, null).signal).toBeNull();
  });

  it("flags ratio > 1.5 as high (probe-the-gap)", () => {
    const p = computeHikeRatio(20, 35);
    expect(p.signal).toBe("high");
    expect(p.ratio).toBeCloseTo(1.75, 2);
  });

  it("flags ratio < 1.15 as low (probe-the-undershoot)", () => {
    const p = computeHikeRatio(20, 21);
    expect(p.signal).toBe("low");
  });

  it("returns normal for a typical 30% hike", () => {
    const p = computeHikeRatio(20, 26);
    expect(p.signal).toBe("normal");
    expect(p.ratio).toBeCloseTo(1.3, 2);
  });

  it("rejects zero / negative current", () => {
    expect(computeHikeRatio(0, 25).signal).toBeNull();
    expect(computeHikeRatio(-5, 25).signal).toBeNull();
  });
});
