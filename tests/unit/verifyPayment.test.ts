import { describe, it, expect } from "vitest";
import { createHmac } from "crypto";
import {
  PLAN_TIER,
  PLAN_AMOUNT,
  PLAN_LABEL,
  PLAN_DAYS,
  TIER_RANK,
  buildSignaturePayload,
  verifyRazorpaySignature,
  isUpgrade,
  computeSubscriptionEnd,
} from "../../server-handlers/_payment-verification";

/**
 * These tests import the REAL verifier helpers used by verify-payment.ts.
 * Mutating a plan amount or the signature logic in the handler's helper makes
 * these fail — no inline copy to drift out of sync. (Previously this file
 * re-implemented the maps and even had single=1000 while the handler used 900.)
 */

/* ─── Plan catalog ─── */

describe("plan catalog", () => {
  it("single session costs 900 paise (₹9)", () => {
    expect(PLAN_AMOUNT["single"]).toBe(900);
  });

  it("weekly (Sprint Pack) costs 3900 paise (₹39)", () => {
    expect(PLAN_AMOUNT["weekly"]).toBe(3900);
  });

  it("monthly costs 14900 paise (₹149)", () => {
    expect(PLAN_AMOUNT["monthly"]).toBe(14900);
  });

  it("no annual SKUs remain in the catalog", () => {
    expect(PLAN_AMOUNT["yearly-starter"]).toBeUndefined();
    expect(PLAN_AMOUNT["yearly-pro"]).toBeUndefined();
    expect(PLAN_TIER["yearly-pro"]).toBeUndefined();
  });

  it("every priced plan maps to a tier", () => {
    for (const plan of Object.keys(PLAN_AMOUNT)) {
      expect(PLAN_TIER).toHaveProperty(plan);
    }
  });

  it("every term plan (non-single) has a label and a duration", () => {
    for (const plan of Object.keys(PLAN_DAYS)) {
      expect(typeof PLAN_DAYS[plan]).toBe("number");
      expect(PLAN_LABEL).toHaveProperty(plan);
    }
  });

  it("single is a free-tier credit top-up with no term", () => {
    expect(PLAN_TIER["single"]).toBe("free");
    expect(PLAN_DAYS["single"]).toBeUndefined();
  });
});

/* ─── Tier ranking ─── */

describe("tier ranking", () => {
  it("pro outranks starter outranks free", () => {
    expect(TIER_RANK["pro"]).toBeGreaterThan(TIER_RANK["starter"]);
    expect(TIER_RANK["starter"]).toBeGreaterThan(TIER_RANK["free"]);
  });
});

/* ─── Signature payload + verification ─── */

describe("buildSignaturePayload", () => {
  it("signs order_id|payment_id for one-time orders", () => {
    expect(buildSignaturePayload({ orderId: "order_X", paymentId: "pay_Y" })).toBe("order_X|pay_Y");
  });

  it("signs subscription_id|payment_id when a subscription id is present", () => {
    expect(
      buildSignaturePayload({ orderId: "order_X", subscriptionId: "sub_Z", paymentId: "pay_Y" }),
    ).toBe("sub_Z|pay_Y");
  });
});

describe("verifyRazorpaySignature", () => {
  const SECRET = "rzp_test_secret_key";
  const payload = "order_abc|pay_def";
  const sign = (p: string, secret = SECRET) => createHmac("sha256", secret).update(p).digest("hex");

  it("accepts a signature produced with the correct secret", () => {
    expect(verifyRazorpaySignature(payload, sign(payload), SECRET)).toBe(true);
  });

  it("rejects a signature for a different payload (tamper)", () => {
    const sig = sign(payload);
    expect(verifyRazorpaySignature("order_abc|pay_TAMPERED", sig, SECRET)).toBe(false);
  });

  it("rejects a signature forged with the wrong secret", () => {
    expect(verifyRazorpaySignature(payload, sign(payload, "attacker_secret"), SECRET)).toBe(false);
  });

  it("rejects an empty signature", () => {
    expect(verifyRazorpaySignature(payload, "", SECRET)).toBe(false);
  });

  it("rejects when the secret is empty", () => {
    expect(verifyRazorpaySignature(payload, sign(payload), "")).toBe(false);
  });
});

/* ─── isUpgrade ─── */

describe("isUpgrade", () => {
  const nowMs = new Date("2026-04-15T12:00:00Z").getTime();
  const futureMs = new Date("2026-04-20T12:00:00Z").getTime();
  const pastMs = new Date("2026-04-10T12:00:00Z").getTime();

  it("is true when an active starter buys monthly (pro)", () => {
    expect(isUpgrade({ currentTier: "starter", currentEndMs: futureMs, nowMs, newPlan: "monthly" })).toBe(true);
  });

  it("is false for a same-tier renewal", () => {
    expect(isUpgrade({ currentTier: "starter", currentEndMs: futureMs, nowMs, newPlan: "weekly" })).toBe(false);
  });

  it("is false when the current subscription has expired", () => {
    expect(isUpgrade({ currentTier: "starter", currentEndMs: pastMs, nowMs, newPlan: "monthly" })).toBe(false);
  });

  it("is false with no current subscription", () => {
    expect(isUpgrade({ currentTier: null, currentEndMs: null, nowMs, newPlan: "monthly" })).toBe(false);
  });
});

/* ─── computeSubscriptionEnd: day math ─── */

describe("computeSubscriptionEnd — term length", () => {
  const NOW = new Date("2026-04-15T12:00:00Z");

  it("weekly (Sprint Pack) adds 7 days from now for a fresh purchase", () => {
    const r = computeSubscriptionEnd({ plan: "weekly", now: NOW });
    expect(r?.end.toISOString()).toBe(new Date("2026-04-22T12:00:00Z").toISOString());
    expect(r?.proratedDays).toBe(0);
  });

  it("monthly adds 30 days from now for a fresh purchase", () => {
    const r = computeSubscriptionEnd({ plan: "monthly", now: NOW });
    expect(r?.end.toISOString()).toBe(new Date("2026-05-15T12:00:00Z").toISOString());
  });

  it("returns null for a plan with no term (single)", () => {
    expect(computeSubscriptionEnd({ plan: "single", now: NOW })).toBeNull();
  });

  it("returns null for an unknown plan (e.g. removed annual SKU)", () => {
    expect(computeSubscriptionEnd({ plan: "yearly-pro", now: NOW })).toBeNull();
  });
});

describe("computeSubscriptionEnd — renewal extends from current end", () => {
  const now = new Date("2026-04-15T12:00:00Z");

  it("extends from the current end when still active (Sprint Pack: +7 days)", () => {
    const currentEndMs = new Date("2026-04-20T12:00:00Z").getTime();
    const r = computeSubscriptionEnd({ plan: "weekly", now, currentEndMs, currentTier: "starter" });
    expect(r?.end.toISOString()).toBe(new Date("2026-04-27T12:00:00Z").toISOString());
  });

  it("starts from now when the current subscription has expired (Sprint Pack: +7 days)", () => {
    const currentEndMs = new Date("2026-04-10T12:00:00Z").getTime();
    const r = computeSubscriptionEnd({ plan: "weekly", now, currentEndMs, currentTier: "starter" });
    expect(r?.end.toISOString()).toBe(new Date("2026-04-22T12:00:00Z").toISOString());
  });
});

describe("computeSubscriptionEnd — mid-cycle upgrade proration", () => {
  it("grafts prorated bonus days when starter upgrades to monthly", () => {
    const now = new Date("2026-04-15T12:00:00Z");
    // Weekly starter started 3 days ago, 4 days remaining (measured ~7d).
    const currentStartMs = new Date("2026-04-12T12:00:00Z").getTime();
    const currentEndMs = new Date("2026-04-19T12:00:00Z").getTime();
    const r = computeSubscriptionEnd({
      plan: "monthly",
      now,
      currentStartMs,
      currentEndMs,
      currentTier: "starter",
    });
    // proration credits a few days on top of the 30-day term — never negative,
    // and strictly less than a full extra month.
    expect(r).not.toBeNull();
    expect(r!.proratedDays).toBeGreaterThan(0);
    expect(r!.proratedDays).toBeLessThan(30);
    const expected = new Date(now);
    expected.setDate(expected.getDate() + 30 + r!.proratedDays);
    expect(r!.end.toISOString()).toBe(expected.toISOString());
  });

  it("gives zero proration when the current plan just expired", () => {
    const now = new Date("2026-04-15T12:00:00Z");
    const currentStartMs = new Date("2026-04-08T12:00:00Z").getTime();
    const currentEndMs = now.getTime();
    const r = computeSubscriptionEnd({
      plan: "monthly",
      now,
      currentStartMs,
      currentEndMs,
      currentTier: "starter",
    });
    expect(r?.proratedDays).toBe(0);
    const expected = new Date(now);
    expected.setDate(expected.getDate() + 30);
    expect(r?.end.toISOString()).toBe(expected.toISOString());
  });
});

/* ─── Month-end edge cases (setDate avoids setMonth overflow) ─── */

describe("computeSubscriptionEnd — month-end edges", () => {
  it("Jan 31 + 30 days = March 2", () => {
    const r = computeSubscriptionEnd({ plan: "monthly", now: new Date("2026-01-31T12:00:00Z") });
    expect(r?.end.toISOString()).toBe(new Date("2026-03-02T12:00:00Z").toISOString());
  });

  it("Feb 28 + 7 days = March 7 (Sprint Pack validity)", () => {
    const r = computeSubscriptionEnd({ plan: "weekly", now: new Date("2026-02-28T12:00:00Z") });
    expect(r?.end.toISOString()).toBe(new Date("2026-03-07T12:00:00Z").toISOString());
  });

  it("Dec 25 + 30 days = Jan 24 next year", () => {
    const r = computeSubscriptionEnd({ plan: "monthly", now: new Date("2026-12-25T12:00:00Z") });
    expect(r?.end.toISOString()).toBe(new Date("2027-01-24T12:00:00Z").toISOString());
  });
});
