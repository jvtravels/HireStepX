import { describe, it, expect } from "vitest";
import {
  detectGratuityCliffAsk,
  computeGratuityEquivalent,
} from "../../server-handlers/_gratuity-cliff";

describe("_gratuity-cliff — detection", () => {
  it("'gratuity cliff' fires", () => {
    expect(detectGratuityCliffAsk("worried about the gratuity cliff")).toBe(true);
  });
  it("'I'll lose my gratuity' fires", () => {
    expect(detectGratuityCliffAsk("I'll lose my gratuity if I move now")).toBe(true);
  });
  it("'not yet 5 years' fires", () => {
    expect(detectGratuityCliffAsk("I'm not yet 5 years at current")).toBe(true);
  });
  it("'completion of 5 years of service' fires", () => {
    expect(detectGratuityCliffAsk("waiting on completion of 5 years of service")).toBe(true);
  });
  it("'short 6 months for gratuity' fires", () => {
    expect(detectGratuityCliffAsk("I'm short 6 months for gratuity")).toBe(true);
  });
  it("unrelated text → false", () => {
    expect(detectGratuityCliffAsk("I want more base salary")).toBe(false);
  });
});

describe("_gratuity-cliff — computeGratuityEquivalent", () => {
  it("statutory formula: 100K basic × 5 yrs ≈ ₹2.88L", () => {
    const v = computeGratuityEquivalent(100000, 60);
    // 100000 * 15/26 * 5 = 288461.5
    expect(v).toBeCloseTo(288462, -2);
  });
  it("0 basic → 0", () => {
    expect(computeGratuityEquivalent(0, 60)).toBe(0);
  });
  it("0 months → 0", () => {
    expect(computeGratuityEquivalent(100000, 0)).toBe(0);
  });
  it("partial year rounds (54 months → 5 years)", () => {
    const v = computeGratuityEquivalent(100000, 54);
    expect(v).toBeGreaterThan(280000);
  });
});
