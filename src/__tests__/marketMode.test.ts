import { describe, it, expect } from "vitest";
import {
  getConcessionMultiplier,
  getWalkAwayThresholdMultiplier,
  inferMarketMode,
} from "../../server-handlers/_market-mode";

describe("_market-mode — concession multiplier", () => {
  it("soft = 0.85×", () => {
    expect(getConcessionMultiplier("soft")).toBe(0.85);
  });
  it("neutral = 1.0× (legacy default)", () => {
    expect(getConcessionMultiplier("neutral")).toBe(1.0);
  });
  it("hot = 1.10×", () => {
    expect(getConcessionMultiplier("hot")).toBe(1.10);
  });
  it("undefined / null fall back to neutral 1.0×", () => {
    expect(getConcessionMultiplier(undefined)).toBe(1.0);
    expect(getConcessionMultiplier(null)).toBe(1.0);
  });
});

describe("_market-mode — walk-away threshold multiplier", () => {
  it("soft pulls walk-away up (1.05×)", () => {
    expect(getWalkAwayThresholdMultiplier("soft")).toBe(1.05);
  });
  it("hot pushes walk-away down (0.95×)", () => {
    expect(getWalkAwayThresholdMultiplier("hot")).toBe(0.95);
  });
  it("neutral = 1.0×", () => {
    expect(getWalkAwayThresholdMultiplier("neutral")).toBe(1.0);
  });
});

describe("_market-mode — inferMarketMode", () => {
  it("engineering + IT-services → soft", () => {
    expect(inferMarketMode({ roleFamily: "engineering", sector: "it-services" })).toBe("soft");
  });

  it("engineering + GCC → neutral", () => {
    expect(inferMarketMode({ roleFamily: "engineering", sector: "gcc" })).toBe("neutral");
  });

  it("AI/ML role forces hot regardless of sector", () => {
    expect(inferMarketMode({ roleFamily: "engineering", sector: "it-services", role: "Senior ML Engineer" })).toBe("hot");
    expect(inferMarketMode({ role: "Data Scientist" })).toBe("hot");
    expect(inferMarketMode({ role: "Generative AI Engineer", sector: "startup" })).toBe("hot");
  });

  it("data role-family forces hot", () => {
    expect(inferMarketMode({ roleFamily: "data", sector: "bfsi" })).toBe("hot");
  });

  it("sales + early-stage / startup → soft (funding winter)", () => {
    expect(inferMarketMode({ roleFamily: "sales", sector: "startup" })).toBe("soft");
    expect(inferMarketMode({ roleFamily: "sales", sector: "seed-stage" })).toBe("soft");
  });

  it("unknown sector falls back to neutral", () => {
    expect(inferMarketMode({ roleFamily: "marketing", sector: "unknown" })).toBe("neutral");
    expect(inferMarketMode({})).toBe("neutral");
  });

  it("yearMonth is accepted but does not break defaults", () => {
    expect(inferMarketMode({ yearMonth: "2026-05" })).toBe("neutral");
  });
});
