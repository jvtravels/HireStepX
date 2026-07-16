import { describe, it, expect } from "vitest";
import {
  detectInHandFraming,
  backComputeCtcFromInHand,
} from "../../server-handlers/_in-hand-vs-ctc";

describe("detectInHandFraming", () => {
  it("detects 'in hand' variants", () => {
    expect(detectInHandFraming("I need 20L in hand")).toBe(true);
    expect(detectInHandFraming("18 in-hand is my ask")).toBe(true);
    expect(detectInHandFraming("looking for 15L in hand")).toBe(true);
  });

  it("detects 'take home' variants", () => {
    expect(detectInHandFraming("My take home should be 18L")).toBe(true);
    expect(detectInHandFraming("I want take-home of 20 lakhs")).toBe(true);
  });

  it("detects 'after tax' and 'post tax' phrasing", () => {
    expect(detectInHandFraming("15L after tax is what I need")).toBe(true);
    expect(detectInHandFraming("post tax expectation is 20L")).toBe(true);
  });

  it("detects 'per month' phrasing (colloquially take-home)", () => {
    expect(detectInHandFraming("I want 2 lakhs per month")).toBe(true);
  });

  it("returns false for CTC-framed statements", () => {
    expect(detectInHandFraming("My expected CTC is 25L")).toBe(false);
    expect(detectInHandFraming("I am looking for 30 LPA")).toBe(false);
    expect(detectInHandFraming("current package is 18 lakhs")).toBe(false);
  });

  it("handles null, undefined, and empty string safely", () => {
    expect(detectInHandFraming(null)).toBe(false);
    expect(detectInHandFraming(undefined)).toBe(false);
    expect(detectInHandFraming("")).toBe(false);
  });
});

describe("backComputeCtcFromInHand", () => {
  it("returns null for invalid inputs", () => {
    expect(backComputeCtcFromInHand(0)).toBeNull();
    expect(backComputeCtcFromInHand(-5)).toBeNull();
    expect(backComputeCtcFromInHand(NaN)).toBeNull();
    expect(backComputeCtcFromInHand(Infinity)).toBeNull();
  });

  it("fast path: in-hand ≤ 11L returns ~1.15× CTC", () => {
    const result = backComputeCtcFromInHand(10);
    expect(result).not.toBeNull();
    // 10 × 1.15 = 11.5
    expect(result).toBeCloseTo(11.5, 0);
  });

  it("fast path: low in-hand produces CTC above it", () => {
    const result = backComputeCtcFromInHand(6);
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThan(6);
  });

  it("iterative path: in-hand > 11L produces CTC above in-hand", () => {
    const result = backComputeCtcFromInHand(20);
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThan(20);
    // Tax wedge on higher income is ~20-30% so CTC should be meaningfully above
    expect(result!).toBeGreaterThan(22);
  });

  it("higher in-hand yields proportionally higher CTC", () => {
    const low = backComputeCtcFromInHand(15)!;
    const high = backComputeCtcFromInHand(30)!;
    expect(high).toBeGreaterThan(low);
  });

  it("result is rounded to 1 decimal", () => {
    const result = backComputeCtcFromInHand(18);
    expect(result).not.toBeNull();
    const decimal = (result! * 10) % 1;
    expect(decimal).toBeCloseTo(0, 5);
  });
});
