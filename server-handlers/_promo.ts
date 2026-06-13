/* Pure promo-code logic, shared by validate-promo (preview), create-order
 * (apply the discount to the real Razorpay order) and verify-payment (consume
 * one use after a successful charge).
 *
 * Keeping validity + discount math here (and unit-tested) fixes a class of
 * bugs the inline copies had: validate-promo used to INCREMENT current_uses on
 * every validation (so previews and abandoned checkouts burned the code), and
 * the discount was never threaded into the order amount, so a "valid" promo
 * charged full price. Consumption now happens exactly once, at payment success.
 */

export interface PromoRow {
  id?: string;
  code?: string;
  discount_percent?: number;
  discount_amount?: number;
  valid_from?: string | null;
  valid_until?: string | null;
  max_uses?: number;
  current_uses?: number;
  applicable_plans?: string[] | null;
}

export interface PromoCheck {
  valid: boolean;
  error?: string;
}

/** Validity gate: active window, usage cap, and plan applicability. Read-only —
 *  it never mutates the row. `nowMs` is injected so tests are deterministic. */
export function checkPromoValidity(promo: PromoRow, plan: string, nowMs: number): PromoCheck {
  if (promo.valid_from && Date.parse(promo.valid_from) > nowMs) {
    return { valid: false, error: "Promo code not yet active" };
  }
  if (promo.valid_until && Date.parse(promo.valid_until) < nowMs) {
    return { valid: false, error: "Promo code has expired" };
  }
  const maxUses = promo.max_uses ?? 0;
  if (maxUses > 0 && (promo.current_uses ?? 0) >= maxUses) {
    return { valid: false, error: "Promo code usage limit reached" };
  }
  const plans = promo.applicable_plans;
  if (Array.isArray(plans) && plans.length > 0 && !plans.includes(plan)) {
    return { valid: false, error: `Code not valid for ${plan} plan` };
  }
  return { valid: true };
}

/** Discount in paise for a given base amount. Percent takes precedence over a
 *  flat amount; the result is clamped to [0, baseAmount] so a coupon can never
 *  produce a negative charge or exceed the plan price. */
export function computeDiscountAmount(promo: PromoRow, baseAmount: number): number {
  let discount = 0;
  if ((promo.discount_percent ?? 0) > 0) {
    discount = Math.round(baseAmount * (promo.discount_percent as number) / 100);
  } else if ((promo.discount_amount ?? 0) > 0) {
    discount = promo.discount_amount as number;
  }
  if (!Number.isFinite(discount) || discount < 0) return 0;
  return Math.min(discount, baseAmount);
}
