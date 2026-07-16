/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { createHmac } from "crypto";
import {
  PLAN_AMOUNT,
  PLAN_TIER,
  PLAN_DAYS,
  buildSignaturePayload,
  verifyRazorpaySignature,
  computeSubscriptionEnd,
} from "../../server-handlers/_payment-verification";

/* Tests for payment-verification helpers.
 *
 * These functions sit between Razorpay callbacks and our database — a bug
 * here means fraudulent payments get credited or legitimate ones get blocked.
 * Every branch of signature verification and subscription duration is pinned.
 */

const TEST_SECRET = "test_secret_key_12345";

describe("plan configuration", () => {
  it("has correct paise amounts (not rupees)", () => {
    expect(PLAN_AMOUNT.single).toBe(900);   // ₹9
    expect(PLAN_AMOUNT.weekly).toBe(3900);  // ₹39
    expect(PLAN_AMOUNT.monthly).toBe(14900); // ₹149
  });

  it("maps plans to correct tiers", () => {
    expect(PLAN_TIER.single).toBe("free");
    expect(PLAN_TIER.weekly).toBe("starter");
    expect(PLAN_TIER.monthly).toBe("pro");
  });

  it("weekly plan grants 30 days (not 7)", () => {
    // PLAN_DAYS.weekly = 30 — the product grants a 30-day sprint pack even
    // though it's called "weekly" in the checkout UI.
    expect(PLAN_DAYS.weekly).toBe(30);
    expect(PLAN_DAYS.monthly).toBe(30);
  });
});

describe("buildSignaturePayload", () => {
  it("builds orderId|paymentId for one-time payments", () => {
    expect(buildSignaturePayload({ orderId: "order_abc", paymentId: "pay_xyz" }))
      .toBe("order_abc|pay_xyz");
  });

  it("builds subscriptionId|paymentId when subscription is present", () => {
    expect(buildSignaturePayload({ subscriptionId: "sub_123", paymentId: "pay_xyz" }))
      .toBe("sub_123|pay_xyz");
  });

  it("prefers subscriptionId over orderId when both given", () => {
    expect(buildSignaturePayload({ orderId: "order_abc", subscriptionId: "sub_123", paymentId: "pay_xyz" }))
      .toBe("sub_123|pay_xyz");
  });
});

describe("verifyRazorpaySignature", () => {
  it("accepts a valid HMAC-SHA256 signature", () => {
    const payload = buildSignaturePayload({ orderId: "order_abc123", paymentId: "pay_xyz789" });
    const sig = createHmac("sha256", TEST_SECRET).update(payload).digest("hex");
    expect(verifyRazorpaySignature(payload, sig, TEST_SECRET)).toBe(true);
  });

  it("rejects a tampered signature", () => {
    const payload = buildSignaturePayload({ orderId: "order_abc", paymentId: "pay_xyz" });
    expect(verifyRazorpaySignature(payload, "deadbeef", TEST_SECRET)).toBe(false);
  });

  it("rejects when payload doesn't match what was signed (wrong orderId)", () => {
    const payloadSigned = buildSignaturePayload({ orderId: "order_real", paymentId: "pay_xyz" });
    const sig = createHmac("sha256", TEST_SECRET).update(payloadSigned).digest("hex");
    const payloadFake = buildSignaturePayload({ orderId: "order_TAMPERED", paymentId: "pay_xyz" });
    expect(verifyRazorpaySignature(payloadFake, sig, TEST_SECRET)).toBe(false);
  });

  it("rejects when payload doesn't match what was signed (wrong paymentId)", () => {
    const payloadSigned = buildSignaturePayload({ orderId: "order_abc", paymentId: "pay_real" });
    const sig = createHmac("sha256", TEST_SECRET).update(payloadSigned).digest("hex");
    const payloadFake = buildSignaturePayload({ orderId: "order_abc", paymentId: "pay_TAMPERED" });
    expect(verifyRazorpaySignature(payloadFake, sig, TEST_SECRET)).toBe(false);
  });

  it("rejects when secret is empty", () => {
    const payload = buildSignaturePayload({ orderId: "order_abc", paymentId: "pay_xyz" });
    const sig = createHmac("sha256", TEST_SECRET).update(payload).digest("hex");
    expect(verifyRazorpaySignature(payload, sig, "")).toBe(false);
  });

  it("rejects when signature is an empty string", () => {
    const payload = buildSignaturePayload({ orderId: "order_abc", paymentId: "pay_xyz" });
    expect(verifyRazorpaySignature(payload, "", TEST_SECRET)).toBe(false);
  });
});

describe("computeSubscriptionEnd", () => {
  const now = new Date("2026-04-01T10:00:00.000Z");

  it("returns null for plans with no term (single session)", () => {
    expect(computeSubscriptionEnd({ plan: "single", now })).toBeNull();
  });

  it("weekly plan (fresh subscription) expires 30 days from now", () => {
    const result = computeSubscriptionEnd({ plan: "weekly", now });
    expect(result).not.toBeNull();
    const expectedEnd = new Date("2026-05-01T10:00:00.000Z");
    expect(result!.end.toISOString()).toBe(expectedEnd.toISOString());
    expect(result!.proratedDays).toBe(0);
  });

  it("monthly plan (fresh subscription) expires 30 days from now", () => {
    const result = computeSubscriptionEnd({ plan: "monthly", now });
    expect(result).not.toBeNull();
    const expectedEnd = new Date("2026-05-01T10:00:00.000Z");
    expect(result!.end.toISOString()).toBe(expectedEnd.toISOString());
  });

  it("renewal (same tier) extends from the current end date, not from now", () => {
    // starter renewing to weekly (both = "starter") is NOT an upgrade.
    // Active sub ending in 5 days — renewal should stack from that future date.
    const currentEnd = new Date("2026-04-06T10:00:00.000Z"); // 5 days from now
    const result = computeSubscriptionEnd({
      plan: "weekly",
      now,
      currentTier: "starter", // same tier → not an upgrade → base = currentEnd
      currentEndMs: currentEnd.getTime(),
    });
    expect(result).not.toBeNull();
    // Base = currentEnd (still active) + 30 days
    const expected = new Date("2026-05-06T10:00:00.000Z");
    expect(result!.end.toISOString()).toBe(expected.toISOString());
  });

  it("expired sub extends from now (not from the past end)", () => {
    const expiredEnd = new Date("2026-03-01T10:00:00.000Z"); // already expired
    const result = computeSubscriptionEnd({
      plan: "weekly",
      now,
      currentTier: "free",
      currentEndMs: expiredEnd.getTime(),
    });
    expect(result).not.toBeNull();
    // Base = now (current end is in the past) + 30 days
    const expected = new Date("2026-05-01T10:00:00.000Z");
    expect(result!.end.toISOString()).toBe(expected.toISOString());
  });
});
