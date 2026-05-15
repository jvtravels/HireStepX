/* F6 (2026-05-15) — probeRefusalCount increment on refusal utterances.
 *
 * The kernel's number-discipline gate watches probeRefusalCount to
 * escalate from soft probe → structural probe → close-walkaway when
 * the candidate keeps dodging the expectation question. Without this
 * counter that gate is dead code.
 */
import { describe, it, expect } from "vitest";
import {
  applyCandidateAnswer,
  initState,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";

const BAND: NegotiationBand = { initialOffer: 15, maxStretch: 22, walkAway: 12, hasEquity: false };

function makeState(overrides: Partial<NegotiationState> = {}): NegotiationState {
  return {
    ...initState({ sessionId: "s", role: "swe", company: "Acme", band: BAND }),
    phase: "probe-expectations",
    turnIndex: 1,
    ...overrides,
  };
}

describe("F6 — applyCandidateAnswer increments probeRefusalCount on refusals", () => {
  it("'I'd prefer not to share' increments the counter", () => {
    const s = makeState();
    const next = applyCandidateAnswer(s, "I'd prefer not to share my current CTC.");
    expect(next.probeRefusalCount).toBe(1);
  });

  it("'not comfortable sharing' increments", () => {
    const next = applyCandidateAnswer(makeState(), "I'm not comfortable sharing those numbers right now.");
    expect(next.probeRefusalCount).toBe(1);
  });

  it("'let's come back to that' increments", () => {
    const next = applyCandidateAnswer(makeState(), "Let's come back to that later — can we discuss the role first?");
    expect(next.probeRefusalCount).toBe(1);
  });

  it("'rather not say' increments", () => {
    const next = applyCandidateAnswer(makeState(), "I'd rather not say at this stage.");
    expect(next.probeRefusalCount).toBe(1);
  });

  it("'that's personal' increments", () => {
    const next = applyCandidateAnswer(makeState(), "Honestly, that's personal.");
    expect(next.probeRefusalCount).toBe(1);
  });

  it("'won't disclose' increments", () => {
    const next = applyCandidateAnswer(makeState(), "I won't disclose that until you share your band.");
    expect(next.probeRefusalCount).toBe(1);
  });

  it("benign answer does NOT increment", () => {
    const next = applyCandidateAnswer(makeState(), "Sure, my current CTC is 18 LPA and I'm looking at 24.");
    expect(next.probeRefusalCount ?? 0).toBe(0);
  });

  it("counter increments across multiple refusal turns (monotone)", () => {
    let s = makeState();
    s = applyCandidateAnswer(s, "I'd prefer not to share.");
    s = applyCandidateAnswer(s, "Let's come back to that.");
    expect(s.probeRefusalCount).toBe(2);
  });
});
