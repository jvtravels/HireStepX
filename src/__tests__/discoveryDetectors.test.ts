/* PDF #17 architectural fix (2026-05-15) — six discovery-flag
 * detectors on _candidate-profile.ts. */
import { describe, it, expect } from "vitest";
import {
  detectCurrentCtcDisclosed,
  detectFixedVariableSplitDisclosed,
  detectInHandSalaryDisclosed,
  detectNoticePeriodDisclosed,
  detectCompetingOffersDisclosed,
  detectValueProofProvided,
} from "../../server-handlers/_candidate-profile";

describe("discovery-flag detectors", () => {
  it("detectCurrentCtcDisclosed fires on explicit current-CTC phrasing", () => {
    expect(detectCurrentCtcDisclosed("My current CTC is ₹18 LPA")).toBe(true);
    expect(detectCurrentCtcDisclosed("I'm earning around 22 lakh")).toBe(true);
    expect(detectCurrentCtcDisclosed("Currently at 15L fixed")).toBe(true);
  });

  it("detectCurrentCtcDisclosed does NOT fire on target-only phrasing", () => {
    expect(detectCurrentCtcDisclosed("I'm looking for 30 LPA")).toBe(false);
    expect(detectCurrentCtcDisclosed("my target is ₹28L")).toBe(false);
    expect(detectCurrentCtcDisclosed("")).toBe(false);
  });

  it("detectFixedVariableSplitDisclosed fires on split descriptions", () => {
    expect(detectFixedVariableSplitDisclosed("70-30 split between fixed and variable")).toBe(true);
    expect(detectFixedVariableSplitDisclosed("fixed is ₹14L variable is ₹4L")).toBe(true);
    expect(detectFixedVariableSplitDisclosed("split is around 80")).toBe(true);
  });

  it("detectFixedVariableSplitDisclosed misses bare totals", () => {
    expect(detectFixedVariableSplitDisclosed("my total is ₹18L")).toBe(false);
    expect(detectFixedVariableSplitDisclosed("")).toBe(false);
  });

  it("detectInHandSalaryDisclosed fires on in-hand/take-home phrasing", () => {
    expect(detectInHandSalaryDisclosed("my in-hand is ₹1.2L per month")).toBe(true);
    expect(detectInHandSalaryDisclosed("take-home ₹95000 monthly")).toBe(true);
    expect(detectInHandSalaryDisclosed("monthly net 1,10,000")).toBe(true);
  });

  it("detectNoticePeriodDisclosed fires on notice-period mentions", () => {
    expect(detectNoticePeriodDisclosed("my notice period is 90 days")).toBe(true);
    expect(detectNoticePeriodDisclosed("I have a 60-day notice")).toBe(true);
    expect(detectNoticePeriodDisclosed("I can join in 2 weeks")).toBe(true);
    expect(detectNoticePeriodDisclosed("currently serving my notice")).toBe(true);
    expect(detectNoticePeriodDisclosed("")).toBe(false);
  });

  it("detectCompetingOffersDisclosed fires on positive and negative offer statements", () => {
    expect(detectCompetingOffersDisclosed("I have another offer in hand")).toBe(true);
    expect(detectCompetingOffersDisclosed("in process with Razorpay")).toBe(true);
    expect(detectCompetingOffersDisclosed("no other offers right now")).toBe(true);
    expect(detectCompetingOffersDisclosed("I don't have any other offers")).toBe(true);
    expect(detectCompetingOffersDisclosed("interviewing at Flipkart")).toBe(true);
  });

  it("detectCompetingOffersDisclosed ignores unrelated mentions", () => {
    expect(detectCompetingOffersDisclosed("I appreciate your offer")).toBe(false);
    expect(detectCompetingOffersDisclosed("")).toBe(false);
  });

  it("detectValueProofProvided fires for role-specific proofs", () => {
    expect(detectValueProofProvided("I manage a book of business of $5M ARR")).toBe(true);
    expect(detectValueProofProvided("hit 140% of quota last FY")).toBe(true);
    expect(detectValueProofProvided("net retention was 118%")).toBe(true);
    expect(
      detectValueProofProvided(
        "I architected a system handling 50k qps for our checkout pipeline",
      ),
    ).toBe(true);
    expect(detectValueProofProvided("I lead a team of 8 engineers")).toBe(true);
  });

  it("detectValueProofProvided ignores vague claims", () => {
    expect(detectValueProofProvided("I'm a strong contributor")).toBe(false);
    expect(detectValueProofProvided("")).toBe(false);
  });
});
