/* Fix 1 (PDF #17 follow-up, 2026-05-15) — anchor clamp against
 * candidate ask.
 *
 * Real bug: candidate asked ₹16L, recruiter anchored ₹24L. Real
 * recruiters never volunteer money the candidate didn't ask for. */
import { describe, expect, it } from "vitest";
import { clampAnchorAgainstCandidateAsk } from "../../server-handlers/_negotiation-kernel";

describe("clampAnchorAgainstCandidateAsk", () => {
  it("candidate asks ₹16L, band target ₹24L → anchor ≤ ₹16.8L (ask * 1.05)", () => {
    const out = clampAnchorAgainstCandidateAsk(24, 16, 12);
    expect(out).toBeLessThanOrEqual(16.8);
    expect(out).toBeGreaterThan(16);
  });

  it("candidate asks ₹8L (below floor ₹12L), band → anchor = ₹12L (band floor)", () => {
    expect(clampAnchorAgainstCandidateAsk(24, 8, 12)).toBe(12);
  });

  it("candidate asks ₹30L, band target ₹24L → anchor = ₹24L (unchanged)", () => {
    expect(clampAnchorAgainstCandidateAsk(24, 30, 12)).toBe(24);
  });

  it("no candidate ask (null) → anchor unchanged", () => {
    expect(clampAnchorAgainstCandidateAsk(24, null, 12)).toBe(24);
  });

  it("candidate asks exactly at band target ₹24L → anchor = ₹24L (unchanged)", () => {
    expect(clampAnchorAgainstCandidateAsk(24, 24, 12)).toBe(24);
  });

  it("candidate asks ₹20L below ₹24L anchor → anchor = ₹21L (ask × 1.05)", () => {
    expect(clampAnchorAgainstCandidateAsk(24, 20, 12)).toBeCloseTo(21, 5);
  });

  it("candidate asks ₹16L exactly at floor ₹16L → anchor = 16.8 (ask × 1.05)", () => {
    expect(clampAnchorAgainstCandidateAsk(24, 16, 16)).toBeCloseTo(16.8, 5);
  });

  it("invalid candidateAsk (NaN) → unchanged", () => {
    expect(clampAnchorAgainstCandidateAsk(24, Number.NaN, 12)).toBe(24);
  });

  it("zero candidateAsk → unchanged (treated as no signal)", () => {
    expect(clampAnchorAgainstCandidateAsk(24, 0, 12)).toBe(24);
  });
});
