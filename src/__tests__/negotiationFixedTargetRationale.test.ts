/* Fixed-scoped target must never surface "₹nullL" (live-staging finding,
 * 2026-06-18).
 *
 * The bug: when a candidate states ONLY a fixed-component target
 * ("I'm targeting ₹50L fixed"), `state.candidateTarget` (the TOTAL-scoped
 * field) stays null — the value lives on `candidateTargetFixed`. The
 * planner gates several branches on `effectiveTargetCtcLpa(state)` (which
 * folds the fixed ask into a CTC-equivalent), so those branches FIRE for a
 * fixed-scoped candidate — but the rationale/prose then interpolated the
 * RAW `state.candidateTarget`, rendering "₹nullL". The LLM restyle echoed
 * that literal back to the candidate.
 *
 * The fix reports the EFFECTIVE target everywhere the candidate's number is
 * surfaced. These tests lock it: with a fixed-scoped target,
 *   1. the comparative-anchoring prose carries the real number, not "null",
 *   2. no planner rationale for that state contains "null".
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  effectiveTargetCtcLpa,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import { planNextAction, actionToLever } from "../../server-handlers/_next-action-planner";
import { renderCanonicalProse } from "../../server-handlers/_canonical-prose";

const BAND: NegotiationBand = {
  initialOffer: 38.4,
  maxStretch: 48.8,
  walkAway: 29.5,
  hasEquity: true,
};

/** A candidate who stated a FIXED target only — candidateTarget (total)
 *  stays null, candidateTargetFixed holds the number. */
const fixedScoped = (overrides: Partial<NegotiationState> = {}): NegotiationState => ({
  ...initState({ sessionId: "fixed-target", role: "swe", company: "acme", band: BAND }),
  candidateTarget: null,
  candidateTargetFixed: 50,
  ...overrides,
});

describe("effectiveTargetCtcLpa folds a fixed-scoped ask", () => {
  it("returns a non-null CTC-equivalent even when candidateTarget is null", () => {
    const eff = effectiveTargetCtcLpa(fixedScoped());
    expect(eff).not.toBeNull();
    expect(eff).toBeGreaterThan(0);
  });
});

describe("comparative-anchoring prose never renders ₹nullL for a fixed-scoped target", () => {
  it("carries the effective number, not the literal 'null'", () => {
    const state = fixedScoped({ phase: "counter-offer", turnIndex: 4, highestOfferMade: 38.4 });
    const action = {
      kind: "comparative-anchoring",
      quartile: "top",
      satisfiesTopic: "comparative-anchoring",
      peerBandMedianLpa: (BAND.initialOffer + BAND.maxStretch) / 2,
      peerBandTopLpa: BAND.maxStretch,
    } as Parameters<typeof renderCanonicalProse>[0];
    const prose = renderCanonicalProse(action, state);
    expect(prose).not.toMatch(/null/i);
    // The effective fixed target (50 + variableMax(0)) should appear.
    expect(prose).toMatch(/₹50 LPA/);
  });
});

describe("planner rationale never embeds ₹nullL for a fixed-scoped target", () => {
  it("the probe-justification branch reports the effective target, not null", () => {
    /* Shape the state into the probe-justification gate (phase counter-offer,
       effective target >5% above initial, no currentCtc, no competing offer,
       lever unused). With a fixed target of 50 vs initial 38.4 the gate fires. */
    const state = fixedScoped({
      phase: "counter-offer",
      turnIndex: 3,
      highestOfferMade: 38.4,
      candidateCurrentCtc: null,
    });
    const action = planNextAction(state);
    const rationale = actionToLever(action, state).rationale ?? "";
    expect(rationale).not.toMatch(/null/i);
  });
});
