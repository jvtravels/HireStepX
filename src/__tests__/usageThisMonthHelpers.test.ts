import { describe, it, expect } from "vitest";
import {
  capsForTier,
  countFromContentRange,
  monthWindow,
  PLAN_CAPS,
} from "../../server-handlers/_usage-this-month-helpers";

describe("monthWindow", () => {
  it("returns UTC month boundaries (mid-month input)", () => {
    const w = monthWindow(new Date(Date.UTC(2026, 5, 15, 12, 30, 0))); // 15 June 2026
    expect(w.periodStart).toBe("2026-06-01T00:00:00.000Z");
    expect(w.periodEnd).toBe("2026-07-01T00:00:00.000Z");
  });

  it("wraps year on December → January", () => {
    const w = monthWindow(new Date(Date.UTC(2025, 11, 31, 23, 59, 0))); // 31 Dec 2025 UTC
    expect(w.periodStart).toBe("2025-12-01T00:00:00.000Z");
    expect(w.periodEnd).toBe("2026-01-01T00:00:00.000Z");
  });

  it("anchors on UTC, not local time (matters for IST users on month-boundary nights)", () => {
    // 30 June 2026 22:00 UTC == 1 July 2026 03:30 IST. UTC anchor keeps this in June's window.
    const w = monthWindow(new Date(Date.UTC(2026, 5, 30, 22, 0, 0)));
    expect(w.periodStart).toBe("2026-06-01T00:00:00.000Z");
    expect(w.periodEnd).toBe("2026-07-01T00:00:00.000Z");
  });
});

describe("capsForTier", () => {
  it("returns the cap row for each known tier", () => {
    expect(capsForTier("free")).toEqual(PLAN_CAPS.free);
    expect(capsForTier("starter")).toEqual(PLAN_CAPS.starter);
    expect(capsForTier("pro")).toEqual(PLAN_CAPS.pro);
    expect(capsForTier("team")).toEqual(PLAN_CAPS.team);
  });

  it("falls back to free for unknown/garbage tier values", () => {
    expect(capsForTier("")).toEqual(PLAN_CAPS.free);
    expect(capsForTier("enterprise")).toEqual(PLAN_CAPS.free);
    expect(capsForTier("PRO")).toEqual(PLAN_CAPS.free); // case-sensitive on purpose
  });
});

describe("countFromContentRange", () => {
  it("parses the total from a well-formed range header", () => {
    expect(countFromContentRange("0-24/250")).toBe(250);
    expect(countFromContentRange("*/7")).toBe(7);
  });

  it("returns 0 for missing / malformed / unknown-total headers", () => {
    expect(countFromContentRange(null)).toBe(0);
    expect(countFromContentRange("")).toBe(0);
    expect(countFromContentRange("0-9/*")).toBe(0);
    expect(countFromContentRange("garbage")).toBe(0);
    expect(countFromContentRange("0-9/notanumber")).toBe(0);
  });
});
