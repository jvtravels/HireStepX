/* PDF #18 root-cause (2026-05-15) — target-role band clamp.
 *
 * Real session: QA Engineer at JPMC, resume = Senior Product Designer
 * (5 YoE). Bot anchored ₹54 LPA against a ₹12-25 LPA market.
 *
 * Root cause: QA-testing isn't a distinct family in
 * _company-band-tiers.ts; classifyRoleFamily defaults to "engineering",
 * inheriting the engineering reference table. clampBandToTargetRoleMarket
 * applies a per-target-role compressor AFTER the family-tier-yoe lookup. */
import { describe, expect, it } from "vitest";
import { clampBandToTargetRoleMarket } from "../../server-handlers/_band-target-clamp";
import { resolveServerBand } from "../../server-handlers/_band-resolver";
import type { NegotiationBand } from "../../server-handlers/_negotiation-kernel";

const ENG_BAND: NegotiationBand = {
  initialOffer: 28,
  maxStretch: 38,
  walkAway: 22,
  hasEquity: false,
};

describe("clampBandToTargetRoleMarket — direct", () => {
  it("QA Engineer target compresses band by 0.65", () => {
    const out = clampBandToTargetRoleMarket(ENG_BAND, "QA Engineer");
    expect(out.meta.clamped).toBe(true);
    expect(out.meta.label).toBe("qa-testing");
    expect(out.meta.factor).toBe(0.65);
    expect(out.band.initialOffer).toBeCloseTo(18.2, 1);
    expect(out.band.maxStretch).toBeCloseTo(24.7, 1);
    expect(out.band.walkAway).toBeCloseTo(14.3, 1);
  });

  it("SDET target compresses (alias of qa-testing)", () => {
    const out = clampBandToTargetRoleMarket(ENG_BAND, "SDET");
    expect(out.meta.clamped).toBe(true);
    expect(out.meta.label).toBe("qa-testing");
  });

  it("Test Engineer target compresses", () => {
    const out = clampBandToTargetRoleMarket(ENG_BAND, "Test Engineer");
    expect(out.meta.clamped).toBe(true);
    expect(out.meta.label).toBe("qa-testing");
  });

  it("Software Engineer target does NOT compress", () => {
    const out = clampBandToTargetRoleMarket(ENG_BAND, "Software Engineer");
    expect(out.meta.clamped).toBe(false);
    expect(out.band).toEqual(ENG_BAND);
  });

  it("Support Engineer target compresses by 0.55", () => {
    const out = clampBandToTargetRoleMarket(ENG_BAND, "Production Support Engineer");
    expect(out.meta.clamped).toBe(true);
    expect(out.meta.label).toBe("support");
    expect(out.meta.factor).toBe(0.55);
  });

  it("null target → no clamp", () => {
    const out = clampBandToTargetRoleMarket(ENG_BAND, null);
    expect(out.meta.clamped).toBe(false);
    expect(out.band).toEqual(ENG_BAND);
  });

  it("empty string target → no clamp", () => {
    const out = clampBandToTargetRoleMarket(ENG_BAND, "");
    expect(out.meta.clamped).toBe(false);
  });

  it("clamp is pure — original band is not mutated", () => {
    const original = { ...ENG_BAND };
    clampBandToTargetRoleMarket(original, "QA Engineer");
    expect(original).toEqual(ENG_BAND);
  });
});

describe("clampBandToTargetRoleMarket — wired into resolveServerBand", () => {
  it("PDF #18: QA Engineer at JP Morgan resolves to a QA-clamped band", () => {
    /* Resume said 5 YoE Senior Product Designer; target is QA Engineer.
     * Pre-clamp the resolver would produce a senior-engineering band
     * (~₹28L target). With the clamp, the band is compressed into the
     * QA market range (~₹12-25 LPA). */
    const qa = resolveServerBand("QA Engineer", "jp morgan", "senior", 5);
    const swe = resolveServerBand("Software Engineer", "jp morgan", "senior", 5);
    /* QA must be materially below SWE for the same company × YoE. */
    expect(qa.initialOffer).toBeLessThan(swe.initialOffer);
    expect(qa.maxStretch).toBeLessThan(swe.maxStretch);
  });
});
