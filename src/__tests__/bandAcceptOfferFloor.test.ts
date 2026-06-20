/* #115 fast-follow (2026-06-20, live staging) — disclosed-CTC floor on the
 * kernel's accept-on-stated-band close path.
 *
 * Live defect: a Flipkart Engineering Manager who disclosed ₹48L current CTC
 * and asked ₹65L ACCEPTED the recruiter's stated band (no concrete point
 * offer voiced) and the kernel locked the close at the band floor — ₹27.8L
 * fixed / ₹32.7L total, a 42% pay CUT below current CTC. The planner's anchor
 * path honours the disclosed-CTC floor via clampAnchorAboveDisclosed, but the
 * kernel's band-accept path registered state.band.initialOffer raw.
 *
 * bandAcceptOfferFloor lifts the registered offer to the disclosed-CTC hike
 * floor (capped at maxStretch), mirroring the planner. These pin:
 *   (1) the registered offer never lands below the disclosed current CTC when
 *       the band can support it (no pay-cut close);
 *   (2) senior/manager roles get the 25% hike floor, capped at maxStretch;
 *   (3) undisclosed CTC leaves the band floor untouched (back-compat);
 *   (4) a structurally-tight band (ceil below CTC) caps at maxStretch rather
 *       than overshooting — the best the band allows, not a fabricated number.
 */
import { describe, it, expect } from "vitest";
import {
  bandAcceptOfferFloor,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";

/* Minimal state stub — bandAcceptOfferFloor only reads band.initialOffer,
 * band.maxStretch, candidateCurrentCtc, role, candidateApplicableYoe. */
function stateWith(opts: {
  initialOffer: number;
  maxStretch: number;
  currentCtc: number | null;
  role?: string;
  yoe?: number | null;
}): NegotiationState {
  return {
    band: { initialOffer: opts.initialOffer, maxStretch: opts.maxStretch },
    candidateCurrentCtc: opts.currentCtc,
    role: opts.role ?? "Engineering Manager",
    candidateApplicableYoe: opts.yoe ?? null,
  } as unknown as NegotiationState;
}

describe("#115 — bandAcceptOfferFloor (accept-on-band disclosed-CTC floor)", () => {
  it("lifts the live Flipkart EM defect above the disclosed current CTC", () => {
    /* The exact live numbers: band 32.7 / maxStretch 56 (post-#115 ceil),
     * candidate at ₹48L. The raw band floor (32.7) is a pay cut; the floored
     * offer must clear 48 and never land below it. */
    const s = stateWith({
      initialOffer: 32.7,
      maxStretch: 56,
      currentCtc: 48,
      role: "Engineering Manager",
    });
    const floored = bandAcceptOfferFloor(s);
    expect(floored).toBeGreaterThan(48); // no pay cut
    expect(floored).toBeGreaterThan(32.7); // strictly above the raw band floor
    /* 48 * 1.25 = 60, capped at maxStretch 56 → 56 (a real EM close). */
    expect(floored).toBe(56);
  });

  it("applies the 25% senior hike floor, capped at maxStretch", () => {
    /* maxStretch (70) leaves headroom; 48 * 1.25 = 60 < 70 → 60. */
    const s = stateWith({
      initialOffer: 32.7,
      maxStretch: 70,
      currentCtc: 48,
      role: "Engineering Manager",
    });
    expect(bandAcceptOfferFloor(s)).toBe(60);
  });

  it("leaves the band floor untouched when current CTC is undisclosed", () => {
    const s = stateWith({
      initialOffer: 32.7,
      maxStretch: 56,
      currentCtc: null,
      role: "Engineering Manager",
    });
    expect(bandAcceptOfferFloor(s)).toBe(32.7);
  });

  it("never lowers an already-healthy band floor", () => {
    /* Band floor (40) already above the hike floor (30*1.25=37.5) → unchanged. */
    const s = stateWith({
      initialOffer: 40,
      maxStretch: 60,
      currentCtc: 30,
      role: "Senior Software Engineer",
      yoe: 8,
    });
    expect(bandAcceptOfferFloor(s)).toBe(40);
  });

  it("caps at maxStretch when the band ceiling sits below the disclosed CTC", () => {
    /* Overqualified / down-level: candidate at ₹50L, band tops out at 38.
     * We cap at the ceiling (38) — the best the band allows — rather than
     * fabricating a number above it. (The walk-away decision lives elsewhere.) */
    const s = stateWith({
      initialOffer: 30,
      maxStretch: 38,
      currentCtc: 50,
      role: "Software Engineer",
      yoe: 2,
    });
    expect(bandAcceptOfferFloor(s)).toBe(38);
  });

  it("applies the 15% junior floor for non-senior roles with low YoE", () => {
    /* Junior role, 2 YoE → 15% floor. 20 * 1.15 = 23, below maxStretch 30. */
    const s = stateWith({
      initialOffer: 18,
      maxStretch: 30,
      currentCtc: 20,
      role: "Software Engineer",
      yoe: 2,
    });
    expect(bandAcceptOfferFloor(s)).toBe(23);
  });
});
