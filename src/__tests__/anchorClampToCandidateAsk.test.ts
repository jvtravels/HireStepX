/* Fix 1 (PDF #17 follow-up, 2026-05-15) — anchor clamp against
 * candidate ask. Tightened in PDF #18 audit (2026-05-15) — unified
 * rule: min(anchor, max(ask × 1.10, bandFloor)).
 *
 * Real bug: candidate asked ₹16L, recruiter anchored ₹24L. Real
 * recruiters never volunteer money the candidate didn't ask for. */
import { describe, expect, it } from "vitest";
import { clampAnchorAgainstCandidateAsk } from "../../server-handlers/_negotiation-kernel";

describe("clampAnchorAgainstCandidateAsk", () => {
  it("candidate asks ₹16L, band target ₹24L → anchor = ₹17.6L (ask × 1.10)", () => {
    const out = clampAnchorAgainstCandidateAsk(24, 16, 12);
    expect(out).toBeCloseTo(17.6, 5);
  });

  it("candidate asks ₹8L (below floor ₹12L) → anchor = ₹12L (floor wins)", () => {
    /* PDF #18 unified rule: max(8 × 1.10, 12) = 12, then min(24, 12) = 12. */
    expect(clampAnchorAgainstCandidateAsk(24, 8, 12)).toBe(12);
  });

  it("candidate asks ₹30L, band target ₹24L → anchor = ₹24L (unchanged)", () => {
    expect(clampAnchorAgainstCandidateAsk(24, 30, 12)).toBe(24);
  });

  it("no candidate ask (null) → anchor unchanged", () => {
    expect(clampAnchorAgainstCandidateAsk(24, null, 12)).toBe(24);
  });

  it("candidate asks at band target ₹24L → anchor = ₹24L (min wins, 24×1.10=26.4)", () => {
    expect(clampAnchorAgainstCandidateAsk(24, 24, 12)).toBe(24);
  });

  it("candidate asks ₹20L below ₹24L anchor → anchor = ₹22L (ask × 1.10)", () => {
    expect(clampAnchorAgainstCandidateAsk(24, 20, 12)).toBeCloseTo(22, 5);
  });

  it("candidate asks ₹16L at floor ₹16L → anchor = ₹17.6L (ask × 1.10 > floor)", () => {
    expect(clampAnchorAgainstCandidateAsk(24, 16, 16)).toBeCloseTo(17.6, 5);
  });

  it("invalid candidateAsk (NaN) → unchanged", () => {
    expect(clampAnchorAgainstCandidateAsk(24, Number.NaN, 12)).toBe(24);
  });

  it("zero candidateAsk → unchanged (treated as no signal)", () => {
    expect(clampAnchorAgainstCandidateAsk(24, 0, 12)).toBe(24);
  });

  it("PDF #18 case: candidate asks ₹23L, anchor ₹28L → anchor capped at ₹25.3L", () => {
    /* Real PDF #18 numbers: stated CTC implied ask ~₹23L; recruiter stayed at ₹28L
     * which is above the unified cap of max(23×1.10, floor) = 25.3 LPA. */
    const out = clampAnchorAgainstCandidateAsk(28, 23, 14);
    expect(out).toBeCloseTo(25.3, 5);
    expect(out).toBeLessThan(28);
  });
});
