/* Phase 31 (2026-05-14) — component-constraint validator tests.
 *
 * Before this phase, the kernel's NegotiationBand type declared
 * baseFloor / baseStretch / variableMax but only enforced one half of
 * the structural envelope (the ceiling — baseStretch + variableMax,
 * Phase 12b). baseFloor was declared and never read.
 *
 * validateComponentConstraints(band, totalLpa) centralises the check
 * and now enforces both directions. These tests pin the semantics so
 * future refactors can't silently relax either bound.
 */
import { describe, it, expect } from "vitest";
import {
  validateComponentConstraints,
  type NegotiationBand,
} from "../../server-handlers/_negotiation-kernel";

const FULL_BAND: NegotiationBand = {
  initialOffer: 30,
  maxStretch: 60,
  walkAway: 22,
  hasEquity: true,
  baseFloor: 24,
  baseStretch: 45,
  variableMax: 10,
};

describe("validateComponentConstraints", () => {
  it("ok when total sits inside [baseFloor, baseStretch + variableMax]", () => {
    expect(validateComponentConstraints(FULL_BAND, 30).ok).toBe(true);
    expect(validateComponentConstraints(FULL_BAND, 45).ok).toBe(true);
    expect(validateComponentConstraints(FULL_BAND, 24).ok).toBe(true);
    expect(validateComponentConstraints(FULL_BAND, 55).ok).toBe(true);
  });

  it("fails with reason='above-component-cap' when total exceeds baseStretch + variableMax", () => {
    const result = validateComponentConstraints(FULL_BAND, 56);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("above-component-cap");
  });

  it("fails with reason='below-base-floor' when total is below baseFloor", () => {
    const result = validateComponentConstraints(FULL_BAND, 20);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("below-base-floor");
  });

  it("variableMax defaults to 0 when absent — ceiling collapses to baseStretch", () => {
    const band: NegotiationBand = { ...FULL_BAND, variableMax: undefined };
    expect(validateComponentConstraints(band, 45).ok).toBe(true);
    const above = validateComponentConstraints(band, 46);
    expect(above.ok).toBe(false);
    expect(above.reason).toBe("above-component-cap");
  });

  it("baseFloor check skipped when baseFloor absent (legacy bands)", () => {
    const band: NegotiationBand = { ...FULL_BAND, baseFloor: undefined };
    expect(validateComponentConstraints(band, 10).ok).toBe(true);
    expect(validateComponentConstraints(band, 100).ok).toBe(false); // still caught by ceiling
  });

  it("baseStretch check skipped when baseStretch absent", () => {
    const band: NegotiationBand = { ...FULL_BAND, baseStretch: undefined, variableMax: undefined };
    expect(validateComponentConstraints(band, 1000).ok).toBe(true);
    expect(validateComponentConstraints(band, 20).ok).toBe(false); // floor still enforced
  });

  it("legacy band with NO component metadata always validates ok", () => {
    const legacy: NegotiationBand = { initialOffer: 20, maxStretch: 28, walkAway: 16, hasEquity: false };
    expect(validateComponentConstraints(legacy, 5).ok).toBe(true);
    expect(validateComponentConstraints(legacy, 500).ok).toBe(true);
  });

  it("0.01 LPA tolerance absorbs floating-point rounding at the boundary", () => {
    /* 45 + 10 = 55 cap. A value of 55.005 should still validate ok
     * (within the ±0.01 envelope used by the split-rounding logic in
     * pickAiMove). Anything past 55.02 should fail. */
    expect(validateComponentConstraints(FULL_BAND, 55.005).ok).toBe(true);
    expect(validateComponentConstraints(FULL_BAND, 55.02).ok).toBe(false);
  });

  it("symmetric tolerance at the floor — 23.995 validates ok against floor 24", () => {
    expect(validateComponentConstraints(FULL_BAND, 23.995).ok).toBe(true);
    expect(validateComponentConstraints(FULL_BAND, 23.98).ok).toBe(false);
  });
});
