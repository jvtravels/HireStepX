import { describe, it, expect } from "vitest";
import { PLAN_AMOUNT_PAISE, SOLD_PLAN_AMOUNT, formatRupees } from "../../data/plans";
import { PLAN_AMOUNT } from "../../server-handlers/_payment-verification";
import { WEBHOOK_PLAN_AMOUNT } from "../../server-handlers/_webhook-payment-helpers";
import { PLAN_AMOUNT_PAISE as PRORATION_AMOUNT } from "../../server-handlers/_proration-helpers";

describe("plan prices have a single source", () => {
  it("every server module reads the shared constants", () => {
    expect(PLAN_AMOUNT).toBe(SOLD_PLAN_AMOUNT);
    expect(WEBHOOK_PLAN_AMOUNT).toBe(SOLD_PLAN_AMOUNT);
    expect(PRORATION_AMOUNT).toBe(PLAN_AMOUNT_PAISE);
  });
  it("sold plans are single and weekly only", () => {
    expect(Object.keys(SOLD_PLAN_AMOUNT).sort()).toEqual(["single", "weekly"]);
  });
  it("formats rupees for the UI", () => {
    expect(formatRupees(PLAN_AMOUNT_PAISE.single)).toBe("₹9");
    expect(formatRupees(PLAN_AMOUNT_PAISE.weekly)).toBe("₹39");
  });
});
