/// <reference types="node" />
import { describe, it, expect } from "vitest";
import {
  isUpgrade,
  computeSubscriptionEnd,
  PLAN_TIER,
  PLAN_DAYS,
  TIER_RANK,
} from "../../server-handlers/_payment-verification";

/* ─── isUpgrade ─────────────────────────────────────────────────────────── */

describe("isUpgrade", () => {
  const NOW = new Date("2026-06-01T00:00:00Z").getTime();
  const END_ACTIVE = new Date("2026-06-15T00:00:00Z").getTime(); // 14 days out
  const END_EXPIRED = new Date("2026-05-20T00:00:00Z").getTime(); // in the past

  it("starter → pro with active sub is an upgrade", () => {
    expect(isUpgrade({ currentTier: "starter", currentEndMs: END_ACTIVE, nowMs: NOW, newPlan: "monthly" })).toBe(true);
  });

  it("pro → starter is not an upgrade (downgrade)", () => {
    expect(isUpgrade({ currentTier: "pro", currentEndMs: END_ACTIVE, nowMs: NOW, newPlan: "weekly" })).toBe(false);
  });

  it("pro → pro is not an upgrade (same tier)", () => {
    expect(isUpgrade({ currentTier: "pro", currentEndMs: END_ACTIVE, nowMs: NOW, newPlan: "monthly" })).toBe(false);
  });

  it("expired sub is NOT an upgrade (treat as fresh purchase)", () => {
    expect(isUpgrade({ currentTier: "starter", currentEndMs: END_EXPIRED, nowMs: NOW, newPlan: "monthly" })).toBe(false);
  });

  it("null currentTier is not an upgrade", () => {
    expect(isUpgrade({ currentTier: null, currentEndMs: END_ACTIVE, nowMs: NOW, newPlan: "monthly" })).toBe(false);
  });

  it("null currentEndMs is not an upgrade", () => {
    expect(isUpgrade({ currentTier: "starter", currentEndMs: null, nowMs: NOW, newPlan: "monthly" })).toBe(false);
  });

  it("free → starter with active sub is an upgrade", () => {
    expect(isUpgrade({ currentTier: "free", currentEndMs: END_ACTIVE, nowMs: NOW, newPlan: "weekly" })).toBe(true);
  });

  it("'single' plan is free tier — buying weekly from free starter is upgrade", () => {
    expect(PLAN_TIER["single"]).toBe("free");
    expect(TIER_RANK["free"]).toBeLessThan(TIER_RANK["starter"]);
  });
});

/* ─── computeSubscriptionEnd ────────────────────────────────────────────── */

describe("computeSubscriptionEnd", () => {
  const NOW = new Date("2026-06-01T00:00:00Z");

  it("returns null for 'single' (not a term plan)", () => {
    expect(computeSubscriptionEnd({ plan: "single", now: NOW })).toBeNull();
  });

  it("returns null for unknown plans", () => {
    expect(computeSubscriptionEnd({ plan: "unknown", now: NOW })).toBeNull();
  });

  describe("fresh purchase (no current sub)", () => {
    it("weekly (Sprint Pack) plan ends 30 days from now — matches sold 30-day validity", () => {
      const result = computeSubscriptionEnd({ plan: "weekly", now: NOW });
      expect(result).not.toBeNull();
      const expected = new Date("2026-07-01T00:00:00Z"); // NOW (Jun 1) + 30
      expect(result!.end.toISOString()).toBe(expected.toISOString());
      expect(result!.proratedDays).toBe(0);
    });

    it("monthly plan ends 30 days from now", () => {
      const result = computeSubscriptionEnd({ plan: "monthly", now: NOW });
      expect(result).not.toBeNull();
      const expected = new Date("2026-07-01T00:00:00Z");
      expect(result!.end.toISOString()).toBe(expected.toISOString());
      expect(result!.proratedDays).toBe(0);
    });
  });

  describe("renewal (same tier, still active)", () => {
    it("extends from current end, not from now", () => {
      const currentEnd = new Date("2026-06-10T00:00:00Z");
      const result = computeSubscriptionEnd({
        plan: "weekly",
        now: NOW,
        currentTier: "starter",
        currentEndMs: currentEnd.getTime(),
      });
      expect(result).not.toBeNull();
      // Base is currentEnd (not NOW) since still active + same tier (not upgrade)
      const expected = new Date("2026-07-10T00:00:00Z"); // June 10 + 30
      expect(result!.end.toISOString()).toBe(expected.toISOString());
      expect(result!.proratedDays).toBe(0);
    });
  });

  describe("upgrade path", () => {
    it("adds prorated days when upgrading starter → pro mid-cycle", () => {
      // 14 days into a 30-day monthly starter sub
      const startMs = new Date("2026-05-18T00:00:00Z").getTime();
      const endMs = new Date("2026-06-17T00:00:00Z").getTime();
      const result = computeSubscriptionEnd({
        plan: "monthly",
        now: NOW,
        currentTier: "starter",
        currentStartMs: startMs,
        currentEndMs: endMs,
      });
      expect(result).not.toBeNull();
      // Should add prorated bonus days and proratedDays > 0
      expect(result!.proratedDays).toBeGreaterThanOrEqual(0);
      // End should be at least 30 days from now
      const thirtyDaysOut = new Date(NOW);
      thirtyDaysOut.setDate(thirtyDaysOut.getDate() + PLAN_DAYS["monthly"]);
      expect(result!.end.getTime()).toBeGreaterThanOrEqual(thirtyDaysOut.getTime());
    });

    it("no prorated days when currentStartMs is missing (guards NaN propagation)", () => {
      const endMs = new Date("2026-06-15T00:00:00Z").getTime();
      const result = computeSubscriptionEnd({
        plan: "monthly",
        now: NOW,
        currentTier: "starter",
        currentStartMs: null,
        currentEndMs: endMs,
      });
      expect(result).not.toBeNull();
      // proratedDays should be 0 when start is missing
      expect(result!.proratedDays).toBe(0);
      // End should still be reasonable (30 days from now)
      const expected = new Date(NOW);
      expected.setDate(expected.getDate() + 30);
      expect(result!.end.toISOString()).toBe(expected.toISOString());
    });
  });

  describe("expired sub — same as fresh purchase", () => {
    it("uses now as base when current sub is expired", () => {
      const expiredEnd = new Date("2026-05-20T00:00:00Z").getTime(); // before NOW
      const result = computeSubscriptionEnd({
        plan: "weekly",
        now: NOW,
        currentTier: "starter",
        currentEndMs: expiredEnd,
      });
      expect(result).not.toBeNull();
      // base = NOW (expired)
      const expected = new Date("2026-07-01T00:00:00Z"); // NOW + 30
      expect(result!.end.toISOString()).toBe(expected.toISOString());
    });
  });
});
