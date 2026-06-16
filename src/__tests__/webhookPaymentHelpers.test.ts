import { describe, it, expect } from "vitest";
import {
  resolveCapturedPayment,
  WEBHOOK_PLAN_AMOUNT,
  WEBHOOK_PLAN_TIER,
  WEBHOOK_PLAN_DURATION,
} from "../../server-handlers/_webhook-payment-helpers";

/**
 * The Razorpay webhook is the safety net for when the browser's verify-payment
 * callback never fires (UPI redirects routinely drop the return trip on Indian
 * mobile). The old flat `amount !== PLAN_AMOUNT[plan]` gate dropped two whole
 * product types on the floor — single-session credit buys and promo-discounted
 * subscriptions — leaving buyers charged but not served. resolveCapturedPayment
 * encodes the correct expected-amount math so the handler serves all three.
 */
describe("resolveCapturedPayment", () => {
  describe("single-session credit buys", () => {
    it("grants 1 credit for a ₹9 single capture", () => {
      const r = resolveCapturedPayment({ plan: "single", amount: 900, notes: {} });
      expect(r).toEqual({ kind: "credits", quantity: 1 });
    });

    it("multiplies the expected amount by quantity", () => {
      const r = resolveCapturedPayment({ plan: "single", amount: 4500, notes: { quantity: "5" } });
      expect(r).toEqual({ kind: "credits", quantity: 5 });
    });

    it("accepts a numeric quantity note", () => {
      const r = resolveCapturedPayment({ plan: "single", amount: 2700, notes: { quantity: 3 } });
      expect(r).toEqual({ kind: "credits", quantity: 3 });
    });

    it("clamps quantity to the 1–10 range used by create-order", () => {
      // amount must match the clamped quantity, not the raw note
      expect(resolveCapturedPayment({ plan: "single", amount: 9000, notes: { quantity: "50" } }))
        .toEqual({ kind: "credits", quantity: 10 });
      expect(resolveCapturedPayment({ plan: "single", amount: 900, notes: { quantity: "0" } }))
        .toEqual({ kind: "credits", quantity: 1 });
    });

    it("rejects a single capture whose amount doesn't match quantity×₹9", () => {
      const r = resolveCapturedPayment({ plan: "single", amount: 900, notes: { quantity: "5" } });
      expect(r).toEqual({ kind: "reject", reason: "amount_mismatch" });
    });

    it("ignores a stray discount note on single (promos never apply to single)", () => {
      const r = resolveCapturedPayment({ plan: "single", amount: 900, notes: { quantity: "1", discount: "500" } });
      expect(r).toEqual({ kind: "credits", quantity: 1 });
    });
  });

  describe("full-price subscriptions", () => {
    it("activates weekly at list price", () => {
      const r = resolveCapturedPayment({ plan: "weekly", amount: 4900, notes: {} });
      expect(r).toEqual({ kind: "subscription", tier: "starter", planDays: 7 });
    });

    it("activates monthly at list price", () => {
      const r = resolveCapturedPayment({ plan: "monthly", amount: 14900, notes: {} });
      expect(r).toEqual({ kind: "subscription", tier: "pro", planDays: 30 });
    });
  });

  describe("promo-discounted subscriptions", () => {
    it("accepts a discounted weekly amount when the discount note matches", () => {
      const r = resolveCapturedPayment({ plan: "weekly", amount: 3900, notes: { promo: "SAVE", discount: "1000" } });
      expect(r).toEqual({ kind: "subscription", tier: "starter", planDays: 7 });
    });

    it("accepts a fully-discounted (₹0) capture", () => {
      const r = resolveCapturedPayment({ plan: "monthly", amount: 0, notes: { discount: "14900" } });
      expect(r).toEqual({ kind: "subscription", tier: "pro", planDays: 30 });
    });

    it("never goes negative when discount exceeds price", () => {
      const r = resolveCapturedPayment({ plan: "weekly", amount: 0, notes: { discount: "999999" } });
      expect(r).toEqual({ kind: "subscription", tier: "starter", planDays: 7 });
    });

    it("rejects when the captured amount doesn't match price minus discount", () => {
      const r = resolveCapturedPayment({ plan: "monthly", amount: 100, notes: { discount: "1000" } });
      expect(r).toEqual({ kind: "reject", reason: "amount_mismatch" });
    });

    it("ignores a negative/garbage discount note (collapses to 0)", () => {
      expect(resolveCapturedPayment({ plan: "weekly", amount: 4900, notes: { discount: "-500" } }))
        .toEqual({ kind: "subscription", tier: "starter", planDays: 7 });
      expect(resolveCapturedPayment({ plan: "weekly", amount: 4900, notes: { discount: "abc" } }))
        .toEqual({ kind: "subscription", tier: "starter", planDays: 7 });
    });
  });

  describe("rejections", () => {
    it("rejects an unknown plan", () => {
      expect(resolveCapturedPayment({ plan: "enterprise", amount: 4900, notes: {} }))
        .toEqual({ kind: "reject", reason: "unknown_plan" });
    });

    it("rejects a missing/non-string plan", () => {
      expect(resolveCapturedPayment({ plan: undefined, amount: 4900, notes: {} }))
        .toEqual({ kind: "reject", reason: "unknown_plan" });
    });

    it("rejects a non-numeric amount", () => {
      expect(resolveCapturedPayment({ plan: "weekly", amount: "4900", notes: {} }))
        .toEqual({ kind: "reject", reason: "invalid_amount" });
      expect(resolveCapturedPayment({ plan: "weekly", amount: NaN, notes: {} }))
        .toEqual({ kind: "reject", reason: "invalid_amount" });
    });
  });

  describe("catalog constants stay in lockstep with create-order pricing", () => {
    it("amounts are ₹9 / ₹49 / ₹149 in paise", () => {
      expect(WEBHOOK_PLAN_AMOUNT).toEqual({ single: 900, weekly: 4900, monthly: 14900 });
    });
    it("tiers map single→free, weekly→starter, monthly→pro", () => {
      expect(WEBHOOK_PLAN_TIER).toEqual({ single: "free", weekly: "starter", monthly: "pro" });
    });
    it("durations are 7 / 30 days for the term plans", () => {
      expect(WEBHOOK_PLAN_DURATION).toEqual({ weekly: 7, monthly: 30 });
    });
  });
});
