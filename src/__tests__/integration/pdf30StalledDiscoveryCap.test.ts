/* PDF#30 architectural pass (2026-05-18) — stalled-discovery cap.
 *
 * Symptom: bot emits the same probe family for 4+ consecutive turns
 * because the candidate's replies aren't parseable enough to bind a
 * discovery topic. PDF#30 T18/T20/T22 was the canonical replay — the
 * bot asked "what's your current CTC?" three times before the
 * candidate finally pushed back.
 *
 * Fix: planner watches state.leversUsed; when the last 4 entries are
 * all probe-family, promote acknowledge-and-recover as the next move
 * BEFORE the candidate has to complain. Self-suppressing — once
 * acknowledge-and-recover fires, the next leversUsed entry breaks
 * the all-probes streak.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  type NegotiationBand,
  type NegotiationState,
  type NegotiationLever,
} from "../../../server-handlers/_negotiation-kernel";
import { planNextAction } from "../../../server-handlers/_next-action-planner";

const BAND: NegotiationBand = {
  initialOffer: 23,
  maxStretch: 32,
  walkAway: 20,
  hasEquity: false,
};

const seed = () => initState({
  sessionId: "pdf30-stalled-cap",
  role: "Senior PM",
  company: "Razorpay",
  band: BAND,
});

/** Splice a synthetic leversUsed tail onto state for guard testing.
 *  The cap reads only the tail, so the prefix doesn't matter. */
function withLeverTail(state: NegotiationState, tail: NegotiationLever[]): NegotiationState {
  return { ...state, leversUsed: [...state.leversUsed, ...tail] };
}

describe("PDF#30 — stalled-discovery cap", () => {
  it("4 consecutive probes → promotes acknowledge-and-recover", () => {
    const state = withLeverTail(seed(), ["probe", "probe", "probe", "probe"]);
    const action = planNextAction(state);
    expect(action.kind).toBe("acknowledge-and-recover");
  });

  it("4 consecutive probe-justifications → promotes acknowledge-and-recover", () => {
    const state = withLeverTail(seed(), [
      "probe-justification",
      "probe-justification",
      "probe-justification",
      "probe-justification",
    ]);
    const action = planNextAction(state);
    expect(action.kind).toBe("acknowledge-and-recover");
  });

  it("mixed probe + probe-justification (all probe-family) → promotes acknowledge-and-recover", () => {
    const state = withLeverTail(seed(), [
      "probe",
      "probe-justification",
      "probe",
      "probe-justification",
    ]);
    const action = planNextAction(state);
    expect(action.kind).toBe("acknowledge-and-recover");
  });

  it("3 probes (under threshold) → does NOT promote", () => {
    const state = withLeverTail(seed(), ["probe", "probe", "probe"]);
    const action = planNextAction(state);
    expect(action.kind).not.toBe("acknowledge-and-recover");
  });

  it("3 probes + 1 non-probe → does NOT promote (streak broken)", () => {
    const state = withLeverTail(seed(), ["probe", "probe", "probe", "counter-base"]);
    const action = planNextAction(state);
    expect(action.kind).not.toBe("acknowledge-and-recover");
  });

  it("self-suppressing: after acknowledge-and-recover lands in leversUsed, cap does not re-fire", () => {
    const state = withLeverTail(seed(), [
      "probe",
      "probe",
      "probe",
      "acknowledge-and-recover",
    ]);
    const action = planNextAction(state);
    expect(action.kind).not.toBe("acknowledge-and-recover");
  });

  it("4 probes BUT candidate has disclosed currentCtc → does NOT promote (probes are progressing)", () => {
    const base = withLeverTail(seed(), ["probe", "probe", "probe", "probe"]);
    const state: NegotiationState = { ...base, candidateCurrentCtc: 18 };
    const action = planNextAction(state);
    expect(action.kind).not.toBe("acknowledge-and-recover");
  });

  it("4 probes BUT candidate has disclosed target → does NOT promote", () => {
    const base = withLeverTail(seed(), ["probe", "probe", "probe", "probe"]);
    const state: NegotiationState = { ...base, candidateTarget: 30 };
    const action = planNextAction(state);
    expect(action.kind).not.toBe("acknowledge-and-recover");
  });
});
