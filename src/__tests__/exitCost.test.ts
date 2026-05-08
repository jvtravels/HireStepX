import { describe, it, expect } from "vitest";
import { computeExitCost } from "../_exit-cost";

describe("computeExitCost", () => {
  it("zero buyout days = zero notice cost", () => {
    const r = computeExitCost({ currentCompanyKey: "razorpay", currentBaseLpa: 30, daysToBuyout: 0 });
    expect(r.noticeBuyoutLpa).toBe(0);
  });

  it("typical 30-day buyout on ₹30L base ≈ ₹2.5L", () => {
    const r = computeExitCost({ currentCompanyKey: "razorpay", currentBaseLpa: 30, daysToBuyout: 30 });
    // 30/365 × 30 ≈ 2.47 LPA
    expect(r.noticeBuyoutLpa).toBeCloseTo(2.5, 1);
  });

  it("TCS-like bond surfaces in penalty (META lookup)", () => {
    const r = computeExitCost({
      currentCompanyKey: "tcs",
      currentBaseLpa: 8,
      daysToBuyout: 0,
      bondYearsRemaining: 1,
    });
    // TCS bondPenaltyLpa = 0.5 in COMPANY_META; 1yr remaining = full.
    expect(r.bondPenaltyLpa).toBeCloseTo(0.5, 1);
    expect(r.metaSource).toBe("company");
  });

  it("unknown company falls back to default 60-day notice + zero bond", () => {
    const r = computeExitCost({
      currentCompanyKey: "unknown-startup-xyz",
      currentBaseLpa: 20,
      daysToBuyout: 60,
    });
    expect(r.metaSource).toBe("default");
    expect(r.bondPenaltyLpa).toBe(0);
    expect(r.noticeBuyoutLpa).toBeGreaterThan(0);
  });

  it("ESOP forfeit feeds totalCost", () => {
    const r = computeExitCost({
      currentCompanyKey: "razorpay",
      currentBaseLpa: 30,
      daysToBuyout: 30,
      esopForfeitLpa: 8,
    });
    expect(r.esopForfeitLpa).toBeCloseTo(8, 1);
    expect(r.totalCostLpa).toBeGreaterThanOrEqual(r.noticeBuyoutLpa + 8);
  });

  it("recommendedJoiningBonusLpa = 1.75x total exit cost", () => {
    const r = computeExitCost({
      currentCompanyKey: "razorpay",
      currentBaseLpa: 30,
      daysToBuyout: 30,
      esopForfeitLpa: 5,
    });
    expect(r.recommendedJoiningBonusLpa).toBeCloseTo(r.totalCostLpa * 1.75, 1);
  });

  it("clamps daysToBuyout to noticeDays for the company", () => {
    // Razorpay COMPANY_META has noticePeriodDays: 60. Asking for 90-day
    // buyout should clamp to 60.
    const r = computeExitCost({ currentCompanyKey: "razorpay", currentBaseLpa: 30, daysToBuyout: 90 });
    // 60/365 × 30 ≈ 4.93 → round1 = 4.9.
    expect(r.noticeBuyoutLpa).toBeCloseTo(4.9, 1);
  });

  it("explanation includes per-component breakdown", () => {
    const r = computeExitCost({
      currentCompanyKey: "tcs",
      currentBaseLpa: 8,
      daysToBuyout: 30,
      bondYearsRemaining: 1,
      esopForfeitLpa: 0,
    });
    expect(r.explanation).toMatch(/Notice buyout/i);
    expect(r.explanation).toMatch(/Bond penalty/i);
  });

  it("zero-cost case shows the friendly explanation", () => {
    const r = computeExitCost({
      currentCompanyKey: "razorpay",
      currentBaseLpa: 30,
      daysToBuyout: 0,
      bondYearsRemaining: 0,
      esopForfeitLpa: 0,
    });
    expect(r.explanation).toMatch(/[Nn]o early-exit cost/);
  });
});
