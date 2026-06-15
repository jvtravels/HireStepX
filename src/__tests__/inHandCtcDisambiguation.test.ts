/* Sprint B.3 (2026-05-15) — in-hand vs CTC anchor disambiguation. */
import { describe, it, expect } from "vitest";
import {
  initState,
  applyCandidateAnswer,
  statedTotalTargetCtcLpa,
  totalScopedCounter,
  type NegotiationBand,
  type NegotiationState,
  type AiMove,
} from "../../server-handlers/_negotiation-kernel";
import { buildAiPrompt } from "../../server-handlers/_negotiate-turn-helpers";
import {
  detectInHandFraming,
  backComputeCtcFromInHand,
} from "../../server-handlers/_in-hand-vs-ctc";
import { classifyNumberRoles } from "../../server-handlers/_number-role-classifier";

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

/* Per-month framing (2026-06-15, unbiased-review HIGH). A monthly figure
 * stored as raw LPA under-counts by ~12× and silently false-accepts any real
 * offer. Periodicity is normalized at the SOURCE (_number-role-classifier.ts)
 * PER SPAN, by each number's own trailing context — so a mixed utterance
 * annualizes only the per-month figure. These pin that behaviour. */
describe("Per-month framing — classifier annualizes per span", () => {
  it("'2.4 lakh per month' target → 28.8 LPA", () => {
    expect(classifyNumberRoles("I want 2.4 lakh per month").target).toBe(28.8);
  });
  it("explicit-LPA figure is NOT annualized", () => {
    expect(classifyNumberRoles("I want 24 LPA total").target).toBe(24);
  });
  it("MIXED utterance — only the per-month span annualizes (reviewer repro)", () => {
    /* "I make 18 LPA now, I want 2.4 lakh per month": the whole-utterance
     * guard mis-fired here (annual marker 'LPA' on the CURRENT figure
     * suppressed annualizing the per-month TARGET, re-opening the
     * false-accept). Per-span attribution fixes it: current stays 18,
     * target becomes 28.8. */
    const r = classifyNumberRoles("I make 18 LPA now, I want 2.4 lakh per month");
    expect(r.currentCtc).toBe(18);
    expect(r.target).toBe(28.8);
  });
  it("does not over-annualize 'in a month or two' (no salary span involved)", () => {
    const r = classifyNumberRoles("I can join in a month, targeting 24 LPA");
    expect(r.target).toBe(24);
  });
  it("an explicit annual unit WINS even with no whitespace + contradictory 'per month' (24LPA → 24, not 288)", () => {
    /* LPA_NUM_RE supports the no-space form "24LPA"; the annual-unit guard
     * must still recognize it as annual so a stray "per month" can't ×12 it.
     * Covers the STT family too ("24LPE"). */
    expect(classifyNumberRoles("I want 24LPA per month").target).toBe(24);
    expect(classifyNumberRoles("I want 24LPE per month").target).toBe(24);
  });
});

describe("Per-month framing — kernel + auto-accept safety", () => {
  it("'2.4 lakh per month in hand' → target 28.8 LPA, in-hand, CTC-equiv well above 28.8 (not raw 2.4)", () => {
    let s = makeState();
    s = applyCandidateAnswer(s, "I'm expecting 2.4 lakh per month in hand.");
    expect(s.candidateTarget).toBe(28.8);
    expect(s.candidateTargetIsInHand).toBe(true);
    expect(statedTotalTargetCtcLpa(s)).toBeGreaterThan(30);
  });
  it("a per-month total counter compares a CTC-equivalent, never the ~2.4 raw figure (no false-accept)", () => {
    let s = makeState();
    s = applyCandidateAnswer(s, "My target is 2.4 lakh per month total.");
    expect(totalScopedCounter(s)).toBeGreaterThan(30);
  });
  it("the mixed utterance no longer under-counts the target through the kernel", () => {
    let s = makeState();
    s = applyCandidateAnswer(s, "I make 18 LPA now, I want 2.4 lakh per month");
    expect(s.candidateTarget).toBe(28.8);
    expect(statedTotalTargetCtcLpa(s)).toBeGreaterThan(28.8);
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
