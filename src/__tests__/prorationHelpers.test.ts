import { describe, it, expect } from "vitest";
import {
  remainingDays,
  measuredDurationDays,
  currentPlanAmount,
  proratedBonusDays,
  computeProratedDays,
  PLAN_AMOUNT_PAISE,
} from "../../server-handlers/_proration-helpers";

const DAY = 86400000;
const NOW = Date.parse("2026-06-13T00:00:00Z");

describe("_proration · remainingDays", () => {
  it("ceils partial days and never goes negative", () => {
    expect(remainingDays(NOW + 5 * DAY, NOW)).toBe(5);
    expect(remainingDays(NOW + 4 * DAY + DAY / 2, NOW)).toBe(5); // ceil
    expect(remainingDays(NOW - 3 * DAY, NOW)).toBe(0); // already expired
  });
});

describe("_proration · measuredDurationDays", () => {
  it("measures real plan length from dates", () => {
    expect(measuredDurationDays(NOW, NOW + 30 * DAY)).toBe(30);
    expect(measuredDurationDays(NOW, NOW + 365 * DAY)).toBe(365);
  });
  it("returns NaN when start is missing or not before end", () => {
    expect(measuredDurationDays(NaN, NOW + 30 * DAY)).toBeNaN();
    expect(measuredDurationDays(NOW + DAY, NOW)).toBeNaN();
  });
});

describe("_proration · currentPlanAmount", () => {
  it("classifies yearly (≥180d) vs short plans", () => {
    expect(currentPlanAmount("starter", 365)).toBe(PLAN_AMOUNT_PAISE["yearly-starter"]);
    expect(currentPlanAmount("starter", 7)).toBe(PLAN_AMOUNT_PAISE.weekly);
  });
  it("falls back to the weekly price when duration is unknown", () => {
    expect(currentPlanAmount("starter", NaN)).toBe(PLAN_AMOUNT_PAISE.weekly);
  });
});

describe("_proration · proratedBonusDays", () => {
  it("credits proportional value, scaled by new plan length", () => {
    // half a monthly plan left, upgrading monthly→monthly-priced: 0.5 × 1 × 30 = 15
    expect(proratedBonusDays({
      remainingDays: 15, currentPlanDuration: 30,
      currentPlanAmount: 14900, newPlanAmount: 14900, newPlanDays: 30,
    })).toBe(15);
  });
  it("guards against divide-by-zero and negatives", () => {
    expect(proratedBonusDays({ remainingDays: 10, currentPlanDuration: 0, currentPlanAmount: 1, newPlanAmount: 1, newPlanDays: 30 })).toBe(0);
    expect(proratedBonusDays({ remainingDays: 10, currentPlanDuration: 30, currentPlanAmount: 1, newPlanAmount: 0, newPlanDays: 30 })).toBe(0);
    expect(proratedBonusDays({ remainingDays: 0, currentPlanDuration: 30, currentPlanAmount: 14900, newPlanAmount: 14900, newPlanDays: 30 })).toBe(0);
  });
});

describe("_proration · computeProratedDays (regression: yearly over-credit)", () => {
  it("yearly-starter → weekly no longer hands a wildly inflated credit", () => {
    // 180 days left on a 365-day yearly-starter (₹2039), upgrading to weekly Sprint Pack (₹39).
    // Correct: (180/365) × (203900/3900) × 30 ≈ 2551 bonus days.
    const start = NOW - 185 * DAY;
    const endMs = NOW + 180 * DAY;
    const days = computeProratedDays({
      nowMs: NOW, currentStartMs: start, currentEndMs: endMs, currentTier: "starter", newPlan: "weekly",
    });
    expect(days).toBe(Math.floor((180 / 365) * (203900 / 3900) * 30));
  });

  it("weekly → weekly renewal-as-upgrade credits the unused half correctly", () => {
    const start = NOW - 15 * DAY;
    const endMs = NOW + 15 * DAY; // 30-day plan, half used
    const days = computeProratedDays({
      nowMs: NOW, currentStartMs: start, currentEndMs: endMs, currentTier: "starter", newPlan: "weekly",
    });
    expect(days).toBe(15);
  });

  it("falls back to tier default when start date is missing", () => {
    const days = computeProratedDays({
      nowMs: NOW, currentStartMs: NaN, currentEndMs: NOW + 15 * DAY, currentTier: "starter", newPlan: "weekly",
    });
    // duration defaults to 30, amount to weekly: (15/30)×1×30 = 15
    expect(days).toBe(15);
  });

  it("returns 0 for an unknown new plan", () => {
    expect(computeProratedDays({
      nowMs: NOW, currentStartMs: NOW - 15 * DAY, currentEndMs: NOW + 15 * DAY, currentTier: "starter", newPlan: "bogus",
    })).toBe(0);
  });
});
