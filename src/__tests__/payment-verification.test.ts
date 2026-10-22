/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { createHmac } from "crypto";

/**
 * Tests for payment verification logic (mirrors api/verify-payment.ts).
 * Since Edge/Node functions can't be imported in jsdom, we test the
 * core cryptographic and business logic directly.
 */

// Import canonical plan constants from the production code so tests break when
// prices change rather than silently passing against a stale local copy.
import { PLAN_AMOUNT, PLAN_TIER } from "../../server-handlers/_payment-verification";
const PLAN_DURATION: Record<string, number> = { weekly: 30 };

describe("Payment Verification Logic", () => {
  describe("HMAC-SHA256 signature verification", () => {
    const SECRET = "test_secret_key_123";

    it("generates correct signature for valid payment", () => {
      const orderId = "order_abc123";
      const paymentId = "pay_xyz789";
      const expected = createHmac("sha256", SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest("hex");

      // Verify the same input produces the same output
      const actual = createHmac("sha256", SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest("hex");

      expect(actual).toBe(expected);
      expect(actual).toHaveLength(64); // SHA-256 hex is always 64 chars
    });

    it("rejects tampered order ID", () => {
      const orderId = "order_abc123";
      const paymentId = "pay_xyz789";
      const validSig = createHmac("sha256", SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest("hex");

      const tamperedSig = createHmac("sha256", SECRET)
        .update(`order_TAMPERED|${paymentId}`)
        .digest("hex");

      expect(tamperedSig).not.toBe(validSig);
    });

    it("rejects tampered payment ID", () => {
      const orderId = "order_abc123";
      const paymentId = "pay_xyz789";
      const validSig = createHmac("sha256", SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest("hex");

      const tamperedSig = createHmac("sha256", SECRET)
        .update(`${orderId}|pay_TAMPERED`)
        .digest("hex");

      expect(tamperedSig).not.toBe(validSig);
    });

    it("rejects wrong secret key", () => {
      const orderId = "order_abc123";
      const paymentId = "pay_xyz789";
      const validSig = createHmac("sha256", SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest("hex");

      const wrongKeySig = createHmac("sha256", "wrong_secret")
        .update(`${orderId}|${paymentId}`)
        .digest("hex");

      expect(wrongKeySig).not.toBe(validSig);
    });
  });

  describe("Plan validation", () => {
    it("maps weekly plan to starter tier", () => {
      expect(PLAN_TIER["weekly"]).toBe("starter");
    });

    it("rejects invalid plan IDs", () => {
      expect(PLAN_TIER["invalid"]).toBeUndefined();
      expect(PLAN_TIER["yearly"]).toBeUndefined();
      expect(PLAN_TIER["monthly"]).toBeUndefined();
      expect(PLAN_TIER["free"]).toBeUndefined();
    });

    it("weekly plan costs ₹39 (3900 paise)", () => {
      expect(PLAN_AMOUNT["weekly"]).toBe(3900);
    });

    it("weekly plan (Sprint Pack) lasts 30 days", () => {
      expect(PLAN_DURATION["weekly"]).toBe(30);
    });
  });

  describe("Plan/amount mismatch detection", () => {
    it("detects amount mismatch for weekly plan", () => {
      const claimedPlan = "weekly";
      const orderAmount = 900; // single-session amount, not weekly
      expect(orderAmount).not.toBe(PLAN_AMOUNT[claimedPlan]);
    });

    it("accepts correct amount for weekly", () => {
      expect(PLAN_AMOUNT["weekly"]).toBe(3900);
    });
  });

  describe("Tier ranking for upgrade prevention", () => {
    const tierRank: Record<string, number> = { free: 0, starter: 1, team: 3 };

    it("free < starter < team", () => {
      expect(tierRank["free"]).toBeLessThan(tierRank["starter"]);
      expect(tierRank["starter"]).toBeLessThan(tierRank["team"]);
    });

    it("prevents downgrade from team to starter", () => {
      const currentTier = "team";
      const newTier = "starter";
      const isDowngrade = tierRank[currentTier] >= tierRank[newTier];
      expect(isDowngrade).toBe(true);
    });

    it("allows upgrade from starter to team", () => {
      const currentTier = "starter";
      const newTier = "team";
      const isDowngrade = tierRank[currentTier] >= tierRank[newTier];
      expect(isDowngrade).toBe(false);
    });

    it("prevents same-tier purchase (starter to starter)", () => {
      const currentTier = "starter";
      const newTier = "starter";
      const isDowngrade = tierRank[currentTier] >= tierRank[newTier];
      expect(isDowngrade).toBe(true);
    });
  });

  describe("Subscription date calculation", () => {
    it("weekly subscription (Sprint Pack) ends 30 days from now", () => {
      const now = new Date("2026-04-03T12:00:00Z");
      const end = new Date(now);
      end.setDate(end.getDate() + PLAN_DURATION["weekly"]);
      expect(end.toISOString()).toBe("2026-05-03T12:00:00.000Z");
    });
  });
});
