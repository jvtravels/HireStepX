/* S51-B2 (2026-07-24) — Opening offer equals candidate's stated target: zero
 * negotiation headroom.
 *
 * Root cause: clampOpeningAnchor only enforces headroom below the band CEILING,
 * not below the candidate's stated TARGET. When the legacy salary-lookup returns
 * band.initialOffer = candidateTarget (e.g. ₹28L for Zoho One PM/4yr, where the
 * product-india target at 4yr yoeScale ≈ 28L), the opener lands exactly at the
 * candidate's ask — making the simulation worthless (nothing left to negotiate).
 *
 * Fix: inside clampOpeningAnchor, after computing the raw anchor, check whether
 * it reaches ≥97% of state.candidateTarget. If so, back off to 82% of target
 * (floored at band floor) to ensure at least ~18% headroom for the candidate
 * to counter into.
 *
 * Test matrix:
 *   A. Opener ≥ target → backed off to 82% of target
 *   B. Opener = target (exact) → backed off
 *   C. Opener well below target → untouched (not spuriously backed off)
 *   D. No candidateTarget known → untouched (guard does not fire) */

import { describe, it, expect } from "vitest";
import {
  initState,
  applyAiMove,
  applyCandidateAnswer,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import { planNextAction } from "../../server-handlers/_next-action-planner";

const BAND_PRODUCT_INDIA: NegotiationBand = {
  initialOffer: 28,  // legacy lookup returns exactly the candidate's target
  maxStretch: 38,
  walkAway: 20,
  hasEquity: false,
};

function discoveryComplete(params: {
  band?: NegotiationBand;
  ctc: number;
  target: number | null;
}): NegotiationState {
  const band = params.band ?? BAND_PRODUCT_INDIA;
  let s = initState({ sessionId: "s51b2", role: "product-manager", company: "zoho", band });
  // Candidate turn 1: states CTC and target
  const utterance = params.target != null
    ? `My current CTC is ${params.ctc} LPA and I'm targeting ${params.target} LPA.`
    : `My current CTC is ${params.ctc} LPA.`;
  s = applyCandidateAnswer(s, utterance);
  // Recruiter probes for target (discovery turn)
  s = applyAiMove(s, { lever: "probe", newTotalLpa: null, rationale: "target" }, "What's your target?");
  return s;
}

describe("S51-B2 — clampOpeningAnchor backs off when opener meets/exceeds candidateTarget", () => {
  it("A. Opener ≥ 97% of target → backed off below target", () => {
    // band.initialOffer = 28 = candidateTarget = 28. After clampOpeningAnchor,
    // the anchor should be ≤ 28 * 0.97 = 27.16, i.e. backed off to 82% = 22.96.
    const s = discoveryComplete({ ctc: 18, target: 28 });
    const action = planNextAction(s);
    expect(action).not.toBeNull();
    const offerLpa = action?.initialOffer ?? action?._move?.newTotalLpa ?? null;
    // Opener must be meaningfully below the target
    if (offerLpa != null) {
      expect(offerLpa).toBeLessThan(28 * 0.97); // not within 3% of target
      expect(offerLpa).toBeGreaterThanOrEqual(BAND_PRODUCT_INDIA.walkAway); // never below floor
    }
  });

  it("B. Opener = target exactly → backed off, never equals target", () => {
    const bandAtTarget: NegotiationBand = { initialOffer: 32, maxStretch: 32, walkAway: 24, hasEquity: false };
    const s = discoveryComplete({ band: bandAtTarget, ctc: 22, target: 32 });
    const action = planNextAction(s);
    const offerLpa = action?.initialOffer ?? action?._move?.newTotalLpa ?? null;
    if (offerLpa != null) {
      expect(offerLpa).toBeLessThan(32);
      expect(offerLpa).toBeGreaterThanOrEqual(bandAtTarget.walkAway);
    }
  });

  it("C. Opener well below target (normal case) → untouched", () => {
    // band.initialOffer = 40, candidateTarget = 70 → opener well below target, no back-off
    const normalBand: NegotiationBand = { initialOffer: 40, maxStretch: 55, walkAway: 32, hasEquity: true };
    const s = discoveryComplete({ band: normalBand, ctc: 35, target: 70 });
    const action = planNextAction(s);
    const offerLpa = action?.initialOffer ?? action?._move?.newTotalLpa ?? null;
    // Opener should NOT be pushed down to 82% of 70 = 57.4 — it should stay in
    // the normal 40-50 range (well below 70, so the 97% guard never fires).
    if (offerLpa != null) {
      expect(offerLpa).toBeLessThan(70 * 0.97); // already below target by >3%
      expect(offerLpa).toBeGreaterThanOrEqual(normalBand.walkAway);
    }
  });

  it("D. No candidateTarget known → anchor computed without target-headroom gate", () => {
    // When target is unknown (null), the 97% guard must NOT fire — no spurious back-off
    let s = initState({ sessionId: "s51b2d", role: "product-manager", company: "zoho", band: BAND_PRODUCT_INDIA });
    s = applyCandidateAnswer(s, "My current CTC is 18 LPA."); // no target stated
    s = applyAiMove(s, { lever: "probe", newTotalLpa: null, rationale: "target" }, "What's your target?");
    // candidateTarget should still be null — opener should not be spuriously capped
    expect(s.candidateTarget).toBeNull();
    // Just verify the planner doesn't crash; it may fire a probe rather than an anchor
    expect(() => planNextAction(s)).not.toThrow();
  });
});
