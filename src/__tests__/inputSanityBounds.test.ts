import { describe, it, expect } from "vitest";
import {
  clampInr,
  clampNoticeDays,
  clampGapMonths,
  MAX_INR_LPA,
  MAX_NOTICE_DAYS,
  MAX_GAP_MONTHS,
} from "../../server-handlers/_negotiation-kernel";

describe("clampInr — INR LPA-denominated bounds", () => {
  it("returns null for null input", () => {
    expect(clampInr(null)).toBeNull();
  });
  it("returns null for NaN", () => {
    expect(clampInr(Number.NaN)).toBeNull();
  });
  it("returns null for Infinity", () => {
    expect(clampInr(Number.POSITIVE_INFINITY)).toBeNull();
    expect(clampInr(Number.NEGATIVE_INFINITY)).toBeNull();
  });
  it("returns null for negative numbers", () => {
    expect(clampInr(-1)).toBeNull();
    expect(clampInr(-0.0001)).toBeNull();
  });
  it("accepts zero (fresher with no prior salary)", () => {
    expect(clampInr(0)).toBe(0);
  });
  it("accepts realistic values", () => {
    expect(clampInr(15.7)).toBe(15.7);
    expect(clampInr(MAX_INR_LPA - 1)).toBe(MAX_INR_LPA - 1);
  });
  it("accepts at the max bound", () => {
    expect(clampInr(MAX_INR_LPA)).toBe(MAX_INR_LPA);
  });
  it("rejects just above the max bound", () => {
    expect(clampInr(MAX_INR_LPA + 1)).toBeNull();
    expect(clampInr(MAX_INR_LPA * 100)).toBeNull();
  });
});

describe("clampNoticeDays — notice-period bounds", () => {
  it("returns null for null / NaN / Infinity", () => {
    expect(clampNoticeDays(null)).toBeNull();
    expect(clampNoticeDays(Number.NaN)).toBeNull();
    expect(clampNoticeDays(Number.POSITIVE_INFINITY)).toBeNull();
  });
  it("returns null for non-positive values (zero & negative)", () => {
    expect(clampNoticeDays(0)).toBeNull();
    expect(clampNoticeDays(-30)).toBeNull();
  });
  it("accepts realistic values", () => {
    expect(clampNoticeDays(30)).toBe(30);
    expect(clampNoticeDays(60)).toBe(60);
    expect(clampNoticeDays(90)).toBe(90);
    expect(clampNoticeDays(MAX_NOTICE_DAYS)).toBe(MAX_NOTICE_DAYS);
  });
  it("rejects just above the max bound", () => {
    expect(clampNoticeDays(MAX_NOTICE_DAYS + 1)).toBeNull();
    expect(clampNoticeDays(10000)).toBeNull();
  });
});

describe("clampGapMonths — career-gap bounds", () => {
  it("returns null for null / NaN / Infinity / non-positive", () => {
    expect(clampGapMonths(null)).toBeNull();
    expect(clampGapMonths(Number.NaN)).toBeNull();
    expect(clampGapMonths(Number.POSITIVE_INFINITY)).toBeNull();
    expect(clampGapMonths(0)).toBeNull();
    expect(clampGapMonths(-1)).toBeNull();
  });
  it("accepts realistic values up to the max bound", () => {
    expect(clampGapMonths(1)).toBe(1);
    expect(clampGapMonths(12)).toBe(12);
    expect(clampGapMonths(MAX_GAP_MONTHS)).toBe(MAX_GAP_MONTHS);
  });
  it("rejects just above the max bound", () => {
    expect(clampGapMonths(MAX_GAP_MONTHS + 1)).toBeNull();
    expect(clampGapMonths(120)).toBeNull();
  });
});
