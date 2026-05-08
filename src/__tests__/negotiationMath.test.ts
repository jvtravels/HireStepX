import { describe, it, expect } from "vitest";
import {
  landingZone,
  batnaStrength,
  askPositioning,
  tierFlexibility,
} from "../_negotiation-math";

describe("tierFlexibility", () => {
  it("listed big tech is the tightest", () => {
    expect(tierFlexibility("listed_big_tech")).toBeLessThan(tierFlexibility("mature_unicorn"));
  });

  it("growth startups are the most flexible", () => {
    const grow = tierFlexibility("growth_startup");
    expect(grow).toBeGreaterThan(tierFlexibility("listed_unicorn"));
    expect(grow).toBeGreaterThan(tierFlexibility("mature_unicorn"));
  });

  it("PSU is effectively zero-flex", () => {
    expect(tierFlexibility("psu")).toBeLessThan(0.10);
  });

  it("falls back to a sensible default for unknown tier", () => {
    expect(tierFlexibility(undefined)).toBeGreaterThan(0);
    expect(tierFlexibility(undefined)).toBeLessThan(1);
  });
});

describe("landingZone", () => {
  it("growth startup with 20→30 LPA gap lands roughly 24-26", () => {
    const zone = landingZone(20, 30, "growth_startup");
    expect(zone.midLpa).toBeCloseTo(25.5, 0);
    expect(zone.lowLpa).toBeGreaterThanOrEqual(20);
    expect(zone.highLpa).toBeLessThanOrEqual(30);
  });

  it("listed big tech moves only ~20% of the gap", () => {
    const zone = landingZone(50, 70, "listed_big_tech");
    // 20% of 20 = 4 LPA gain, expected mid ~54.
    expect(zone.midLpa).toBeCloseTo(54, 0);
  });

  it("never returns a midpoint below the initial offer", () => {
    const zone = landingZone(40, 35, "mature_unicorn");
    // Ask < initial — clamp ask to initial; gap=0; mid=initial.
    expect(zone.midLpa).toBeGreaterThanOrEqual(40);
  });

  it("never returns a midpoint above the ask", () => {
    const zone = landingZone(20, 25, "growth_startup");
    expect(zone.midLpa).toBeLessThanOrEqual(25);
  });

  it("PSU lands almost exactly at initial offer", () => {
    const zone = landingZone(10, 15, "psu");
    expect(Math.abs(zone.midLpa - 10)).toBeLessThan(0.5);
  });
});

describe("batnaStrength", () => {
  it("returns 'none' with empty input", () => {
    const b = batnaStrength([]);
    expect(b.label).toBe("none");
    expect(b.score).toBe(0);
  });

  it("written peer-tier fresh offer scores 'strong'", () => {
    const b = batnaStrength([
      { totalCtcLpa: 35, inWriting: true, peerTier: true, ageDays: 10 },
      { totalCtcLpa: 32, inWriting: true, peerTier: true, ageDays: 5 },
    ]);
    expect(b.label).toBe("strong");
    expect(b.score).toBeGreaterThan(0.5);
  });

  it("verbal-only offers score 'weak' or 'moderate'", () => {
    const b = batnaStrength([
      { totalCtcLpa: 30, inWriting: false, peerTier: false, ageDays: 20 },
    ]);
    expect(b.score).toBeLessThan(0.40);
  });

  it("stale offers (>90 days) lose credibility", () => {
    const fresh = batnaStrength([{ totalCtcLpa: 30, inWriting: true, peerTier: true, ageDays: 10 }]);
    const stale = batnaStrength([{ totalCtcLpa: 30, inWriting: true, peerTier: true, ageDays: 180 }]);
    expect(stale.score).toBeLessThan(fresh.score);
  });

  it("rationale text reflects label", () => {
    const strong = batnaStrength([
      { totalCtcLpa: 35, inWriting: true, peerTier: true, ageDays: 10 },
      { totalCtcLpa: 32, inWriting: true, peerTier: true, ageDays: 5 },
    ]);
    expect(strong.rationale).toMatch(/strong|anchor/i);
  });
});

describe("askPositioning", () => {
  const band = { totalMin: 25, totalMax: 50 };

  it("below band-min flagged 'below_band'", () => {
    expect(askPositioning(20, band).position).toBe("below_band");
  });

  it("comfortably inside band flagged 'in_band'", () => {
    expect(askPositioning(35, band).position).toBe("in_band");
  });

  it("near-top of band flagged 'stretch'", () => {
    expect(askPositioning(48, band).position).toBe("stretch");
  });

  it("clearly above band flagged 'moonshot'", () => {
    expect(askPositioning(60, band).position).toBe("moonshot");
  });

  it("provides actionable advice for each position", () => {
    expect(askPositioning(20, band).advice).toMatch(/below|leaving money/i);
    expect(askPositioning(60, band).advice).toMatch(/above|BATNA|justification/i);
  });

  it("handles degenerate band (0 max)", () => {
    const r = askPositioning(20, { totalMin: 0, totalMax: 0 });
    expect(r.position).toBe("in_band");
  });
});
