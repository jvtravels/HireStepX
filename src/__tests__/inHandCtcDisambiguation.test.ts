/* Sprint B.3 (2026-05-15) — in-hand vs CTC anchor disambiguation. */
import { describe, it, expect } from "vitest";
import {
  initState,
  applyCandidateAnswer,
  type NegotiationBand,
  type NegotiationState,
  type AiMove,
} from "../../server-handlers/_negotiation-kernel";
import { buildAiPrompt } from "../../server-handlers/_negotiate-turn-helpers";
import {
  detectInHandFraming,
  backComputeCtcFromInHand,
} from "../../server-handlers/_in-hand-vs-ctc";

const BAND: NegotiationBand = { initialOffer: 15, maxStretch: 30, walkAway: 12, hasEquity: false };
function makeState(overrides: Partial<NegotiationState> = {}): NegotiationState {
  return { ...initState({ sessionId: "s", role: "swe", company: "acme", band: BAND }), ...overrides };
}

describe("Sprint B.3 — detectInHandFraming", () => {
  it("'in-hand' fires", () => {
    expect(detectInHandFraming("I want 16L in-hand")).toBe(true);
  });
  it("'take-home' fires", () => {
    expect(detectInHandFraming("I need 1.5 lakh take-home per month")).toBe(true);
  });
  it("'after tax' fires", () => {
    expect(detectInHandFraming("16L after tax")).toBe(true);
  });
  it("'per month' fires", () => {
    expect(detectInHandFraming("1.5 lakh per month is what I need")).toBe(true);
  });
  it("plain CTC phrasing does NOT fire", () => {
    expect(detectInHandFraming("I'm targeting 22 LPA CTC")).toBe(false);
  });
});

describe("Sprint B.3 — backComputeCtcFromInHand", () => {
  it("returns null on non-positive input", () => {
    expect(backComputeCtcFromInHand(0)).toBeNull();
    expect(backComputeCtcFromInHand(-5)).toBeNull();
  });
  it("₹10L in-hand → ~₹11.5L CTC (fast path under rebate)", () => {
    const ctc = backComputeCtcFromInHand(10);
    expect(ctc).toBeGreaterThan(11);
    expect(ctc).toBeLessThan(12);
  });
  it("₹16L in-hand → meaningfully higher CTC (iterated)", () => {
    const ctc = backComputeCtcFromInHand(16);
    expect(ctc).toBeGreaterThan(16);
    expect(ctc).toBeLessThan(25);
  });
});

describe("Sprint B.3 — applyCandidateAnswer threads in-hand flag", () => {
  it("'16L in-hand' sets candidateTargetIsInHand + CTC equiv", () => {
    let s = makeState();
    s = applyCandidateAnswer(s, "I'm expecting 16 LPA in hand.");
    expect(s.candidateTarget).toBe(16);
    expect(s.candidateTargetIsInHand).toBe(true);
    expect(s.candidateTargetCtcEquivalentLpa).toBeTruthy();
    expect((s.candidateTargetCtcEquivalentLpa ?? 0)).toBeGreaterThan(16);
  });

  it("plain CTC anchor does not set the in-hand flag", () => {
    let s = makeState();
    s = applyCandidateAnswer(s, "I'm targeting 22 LPA CTC.");
    expect(s.candidateTargetIsInHand).toBeFalsy();
  });
});

describe("Sprint B.3 — brief surfaces CANDIDATE ANCHOR in-hand line", () => {
  it("in-hand anchor → brief has [CANDIDATE ANCHOR: in-hand ... → CTC equiv ...]", () => {
    let s = makeState();
    s = applyCandidateAnswer(s, "I'm expecting 16 LPA in hand.");
    const move: AiMove = { lever: "probe", newTotalLpa: null, rationale: "x" };
    const { user } = buildAiPrompt({ state: s, move, candidateAnswer: "I'm expecting 16 LPA in hand." });
    expect(user).toMatch(/CANDIDATE ANCHOR: in-hand/);
    expect(user).toMatch(/CTC equiv/);
  });
});
