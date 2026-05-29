/* Recruiter-power-dynamics feature (2026-05-29) — tests.
 *
 * Vertical slice covers:
 *   - State default + computeRecruiterPower sums + clamp
 *   - Mid-session competing-process disclosure triggers recompute
 *   - Concession headroom: high power tightens split, low power widens it
 *   - Outcome surface: powerContext absent without signals, posture maps
 *
 * Mood-cool gate, surprise threshold, paraphrase rate, prose overlay, and
 * CounterpartyPanel posture rendering are deferred to a follow-up slice.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  applyCandidateAnswer,
  computeRecruiterPower,
  type NegotiationBand,
  type NegotiationState,
  type PowerSignals,
} from "../../server-handlers/_negotiation-kernel";
import { planNextAction } from "../../server-handlers/_next-action-planner";
import { buildPowerContext } from "../../server-handlers/_negotiation-metrics";

const BAND: NegotiationBand = {
  initialOffer: 20,
  maxStretch: 28,
  walkAway: 16,
  hasEquity: true,
};

const init = (
  overrides: Partial<NegotiationState> = {},
  powerSignals?: PowerSignals,
): NegotiationState => ({
  ...initState({
    sessionId: "pw-1",
    role: "swe",
    company: "acme",
    band: BAND,
    powerSignals,
  }),
  ...overrides,
});

describe("computeRecruiterPower — pure helper", () => {
  it("returns 0 for empty signals (default behavior)", () => {
    expect(computeRecruiterPower({})).toBe(0);
  });

  it("openReqMonths >= 6 contributes -2; >= 3 contributes -1; <= 1 contributes 0", () => {
    expect(computeRecruiterPower({ openReqMonths: 6 })).toBe(-2);
    expect(computeRecruiterPower({ openReqMonths: 9 })).toBe(-2);
    expect(computeRecruiterPower({ openReqMonths: 3 })).toBe(-1);
    expect(computeRecruiterPower({ openReqMonths: 5 })).toBe(-1);
    expect(computeRecruiterPower({ openReqMonths: 1 })).toBe(0);
    expect(computeRecruiterPower({ openReqMonths: 0 })).toBe(0);
  });

  it("pipelineDepth >= 4 contributes +2; >= 2 contributes +1; === 0 contributes -1", () => {
    expect(computeRecruiterPower({ pipelineDepth: 4 })).toBe(2);
    expect(computeRecruiterPower({ pipelineDepth: 10 })).toBe(2);
    expect(computeRecruiterPower({ pipelineDepth: 2 })).toBe(1);
    expect(computeRecruiterPower({ pipelineDepth: 3 })).toBe(1);
    expect(computeRecruiterPower({ pipelineDepth: 0 })).toBe(-1);
    expect(computeRecruiterPower({ pipelineDepth: 1 })).toBe(0);
  });

  it("quarterTiming maps fresh-quarter→+1, quarter-end→-1, annual-sprint→-2", () => {
    expect(computeRecruiterPower({ quarterTiming: "fresh-quarter" })).toBe(1);
    expect(computeRecruiterPower({ quarterTiming: "mid-quarter" })).toBe(0);
    expect(computeRecruiterPower({ quarterTiming: "quarter-end" })).toBe(-1);
    expect(computeRecruiterPower({ quarterTiming: "annual-sprint" })).toBe(-2);
  });

  it("candidateHasCompetingProcess===true contributes -1", () => {
    expect(computeRecruiterPower({ candidateHasCompetingProcess: true })).toBe(-1);
    expect(computeRecruiterPower({ candidateHasCompetingProcess: false })).toBe(0);
  });

  it("clamps to [-3, +3] under extreme combinations", () => {
    /* All-negative: -2 (req aged) + -1 (no pipeline) + -2 (sprint) + -1 (competing) = -6 → -3 */
    const all_neg = computeRecruiterPower({
      openReqMonths: 9,
      pipelineDepth: 0,
      quarterTiming: "annual-sprint",
      candidateHasCompetingProcess: true,
    });
    expect(all_neg).toBe(-3);
    /* All-positive: +2 (deep pipeline) + +1 (fresh quarter) = +3 → +3 */
    const all_pos = computeRecruiterPower({
      openReqMonths: 1,
      pipelineDepth: 10,
      quarterTiming: "fresh-quarter",
    });
    expect(all_pos).toBe(3);
  });
});

describe("kernel state — init wires recruiterPower from signals", () => {
  it("defaults recruiterPower=0 and powerSignals={} when no input given", () => {
    const s = init();
    expect(s.recruiterPower).toBe(0);
    expect(s.powerSignals).toEqual({});
  });

  it("init computes power from supplied signal bundle once", () => {
    const s = init({}, { openReqMonths: 7, pipelineDepth: 0 });
    /* -2 (req aged ≥6) + -1 (pipelineDepth===0) = -3 */
    expect(s.recruiterPower).toBe(-3);
    expect(s.powerSignals).toEqual({ openReqMonths: 7, pipelineDepth: 0 });
  });
});

describe("mid-session competing-process disclosure", () => {
  it("flips candidateHasCompetingProcess + recomputes power on regex hit", () => {
    /* Start with mid-strong recruiter (deep pipeline → +2). Candidate then
     * discloses a competing offer in their reply, dropping power by 1. */
    const s0 = init({}, { pipelineDepth: 4 });
    expect(s0.recruiterPower).toBe(2);
    expect(s0.powerSignals?.candidateHasCompetingProcess).toBeUndefined();

    const s1 = applyCandidateAnswer(
      s0,
      "Honestly, I have an offer from Phonepe already, so I need to move fast.",
    );
    expect(s1.powerSignals?.candidateHasCompetingProcess).toBe(true);
    expect(s1.recruiterPower).toBe(1);
  });

  it("idempotent — replying again does not double-apply the penalty", () => {
    const s0 = init({}, { pipelineDepth: 4 });
    const s1 = applyCandidateAnswer(
      s0,
      "I am in the final rounds at another shop too.",
    );
    expect(s1.recruiterPower).toBe(1);
    const s2 = applyCandidateAnswer(
      s1,
      "Again, my competing offer is real.",
    );
    expect(s2.powerSignals?.candidateHasCompetingProcess).toBe(true);
    expect(s2.recruiterPower).toBe(1);
  });

  it("non-matching utterance leaves power untouched", () => {
    const s0 = init({}, { pipelineDepth: 4 });
    const s1 = applyCandidateAnswer(s0, "Tell me about your equity structure.");
    expect(s1.powerSignals?.candidateHasCompetingProcess).toBeUndefined();
    expect(s1.recruiterPower).toBe(2);
  });
});

describe("concession headroom — power inverse modulates counter-offer split", () => {
  const counterArm = (recruiterPower: number): NegotiationState => ({
    ...init({ sessionId: `pw-headroom-${recruiterPower}` }),
    phase: "counter-offer",
    highestOfferMade: 22,
    candidateTarget: 30,
    lastCandidateCounterLpa: 30,
    firstAnchoredTarget: 30,
    candidateCurrentCtc: 18,
    counterRound: 0,
    turnIndex: 4,
    recruiterPower,
  });

  it("high power (+3) tightens split: counterTotal at +3 ≤ counterTotal at 0", () => {
    const a0 = planNextAction(counterArm(0));
    const aPos = planNextAction(counterArm(3));
    const n0 = a0.kind === "counter-offer" ? a0.counterTotalLpa : null;
    const nPos = aPos.kind === "counter-offer" ? aPos.counterTotalLpa : null;
    expect(n0).not.toBeNull();
    expect(nPos).not.toBeNull();
    expect(nPos!).toBeLessThanOrEqual(n0!);
  });

  it("low power (-3) widens split: counterTotal at -3 ≥ counterTotal at 0", () => {
    const a0 = planNextAction(counterArm(0));
    const aNeg = planNextAction(counterArm(-3));
    const n0 = a0.kind === "counter-offer" ? a0.counterTotalLpa : null;
    const nNeg = aNeg.kind === "counter-offer" ? aNeg.counterTotalLpa : null;
    expect(n0).not.toBeNull();
    expect(nNeg).not.toBeNull();
    expect(nNeg!).toBeGreaterThanOrEqual(n0!);
  });
});

describe("outcome surface — buildPowerContext", () => {
  it("returns undefined when no signals supplied", () => {
    const s = init();
    expect(buildPowerContext(s)).toBeUndefined();
  });

  it("posture==='strong' when recruiterPower >= +2", () => {
    const s = init({}, { pipelineDepth: 4 });
    const ctx = buildPowerContext(s);
    expect(ctx).toBeDefined();
    expect(ctx!.recruiterPower).toBe(2);
    expect(ctx!.posture).toBe("strong");
    expect(ctx!.candidateLeverage).toBe("low");
  });

  it("posture==='hungry' when recruiterPower <= -2", () => {
    const s = init({}, { openReqMonths: 9 });
    const ctx = buildPowerContext(s);
    expect(ctx).toBeDefined();
    expect(ctx!.recruiterPower).toBe(-2);
    expect(ctx!.posture).toBe("hungry");
    expect(ctx!.candidateLeverage).toBe("high");
  });

  it("posture==='neutral' between -1 and +1", () => {
    const s = init({}, { openReqMonths: 3 });
    const ctx = buildPowerContext(s);
    expect(ctx).toBeDefined();
    expect(ctx!.recruiterPower).toBe(-1);
    expect(ctx!.posture).toBe("neutral");
    expect(ctx!.candidateLeverage).toBe("neutral");
  });

  it("surface emerges after mid-session disclosure on an otherwise empty bundle", () => {
    /* Bundle starts empty so initially undefined; the regex-flip populates
     * a meaningful signal and the surface becomes defined. */
    const s0 = init();
    expect(buildPowerContext(s0)).toBeUndefined();
    const s1 = applyCandidateAnswer(
      s0,
      "I have a competing offer that closes tomorrow.",
    );
    const ctx = buildPowerContext(s1);
    expect(ctx).toBeDefined();
    expect(ctx!.signals.candidateHasCompetingProcess).toBe(true);
  });
});
