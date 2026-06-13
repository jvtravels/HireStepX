import { describe, it, expect } from "vitest";
import { checkPromoValidity, computeDiscountAmount, type PromoRow } from "../../server-handlers/_promo";

const NOW = Date.parse("2026-06-13T00:00:00Z");

describe("_promo · checkPromoValidity", () => {
  it("accepts a code inside its window, under cap, applicable to the plan", () => {
    const promo: PromoRow = {
      valid_from: "2026-01-01", valid_until: "2026-12-31",
      max_uses: 100, current_uses: 5, applicable_plans: ["monthly", "weekly"],
    };
    expect(checkPromoValidity(promo, "monthly", NOW)).toEqual({ valid: true });
  });

  it("rejects a not-yet-active code", () => {
    expect(checkPromoValidity({ valid_from: "2026-07-01" }, "monthly", NOW))
      .toEqual({ valid: false, error: "Promo code not yet active" });
  });

  it("rejects an expired code", () => {
    expect(checkPromoValidity({ valid_until: "2026-06-01" }, "monthly", NOW))
      .toEqual({ valid: false, error: "Promo code has expired" });
  });

  it("rejects a code at its usage cap (but unlimited when max_uses is 0)", () => {
    expect(checkPromoValidity({ max_uses: 10, current_uses: 10 }, "monthly", NOW).valid).toBe(false);
    expect(checkPromoValidity({ max_uses: 0, current_uses: 9999 }, "monthly", NOW).valid).toBe(true);
  });

  it("enforces applicable_plans only when the list is non-empty", () => {
    expect(checkPromoValidity({ applicable_plans: ["weekly"] }, "monthly", NOW).valid).toBe(false);
    expect(checkPromoValidity({ applicable_plans: [] }, "monthly", NOW).valid).toBe(true);
    expect(checkPromoValidity({ applicable_plans: null }, "monthly", NOW).valid).toBe(true);
  });
});

describe("_promo · computeDiscountAmount", () => {
  it("computes a percentage discount, rounded", () => {
    expect(computeDiscountAmount({ discount_percent: 20 }, 14900)).toBe(2980);
    expect(computeDiscountAmount({ discount_percent: 33 }, 4900)).toBe(1617);
  });

  it("uses a flat discount when no percent is set", () => {
    expect(computeDiscountAmount({ discount_amount: 5000 }, 14900)).toBe(5000);
  });

  it("prefers percent over flat when both are present", () => {
    expect(computeDiscountAmount({ discount_percent: 10, discount_amount: 9999 }, 14900)).toBe(1490);
  });

  it("never exceeds the base amount or goes negative", () => {
    expect(computeDiscountAmount({ discount_amount: 99999 }, 4900)).toBe(4900);
    expect(computeDiscountAmount({ discount_percent: 150 }, 4900)).toBe(4900);
    expect(computeDiscountAmount({ discount_amount: -100 }, 4900)).toBe(0);
    expect(computeDiscountAmount({}, 4900)).toBe(0);
  });
});
