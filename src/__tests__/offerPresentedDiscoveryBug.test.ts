/**
 * S75 — "offer-presented + no-CTC" discovery-probe should not fire when
 * an offer is already on the table and the candidate is discussing
 * component structure, not stonewalling.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  applyCandidateAnswer,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import { planNextAction } from "../../server-handlers/_next-action-planner";

const band: NegotiationBand = {
  initialOffer: 24,
  maxStretch: 32,
  walkAway: 20,
  hasEquity: true,
};

function offerPresentedState(answer: string): NegotiationState {
  let s = initState({
    sessionId: "test-s75",
    role: "Senior Engineer",
    company: "TestCo",
    band,
    recruiterSectorPersona: "indian-unicorn",
  });
  /* Simulate offer already on table. In a real session, applyAiMove (for the
   * recruiter's anchor turn) advances discoveryStage "discovery" → "anchor"
   * because offer-presented is in ANCHORING_PHASES. Force both fields so the
   * synthetic state matches what a real session would hold at this point. */
  s = {
    ...s,
    phase: "offer-presented" as const,
    highestOfferMade: 28,
    discoveryStage: "anchor" as const,
  };
  return applyCandidateAnswer(s, answer);
}

describe("S75 — offer-presented phase must not return discovery-probe when offer is on table", () => {
  it("fixed-component demand: 'I want 35 total but at least 34 fixed' — must NOT return discovery-probe", () => {
    const s = offerPresentedState("I want 35 total but at least 34 fixed.");
    const action = planNextAction(s);
    expect(action.kind).not.toBe("discovery-probe");
  });

  it("title vs comp comment — must NOT return discovery-probe", () => {
    const s = offerPresentedState(
      "The title is valuable, but compensation should reflect the responsibility."
    );
    const action = planNextAction(s);
    expect(action.kind).not.toBe("discovery-probe");
  });

  it("'full structure before deciding' — must NOT return discovery-probe", () => {
    const s = offerPresentedState(
      "The total number sounds okay, but I need the full structure before deciding."
    );
    const action = planNextAction(s);
    expect(action.kind).not.toBe("discovery-probe");
  });

  it("no-variable preference — must NOT return discovery-probe", () => {
    const s = offerPresentedState("I prefer no variable at all if possible.");
    const action = planNextAction(s);
    expect(action.kind).not.toBe("discovery-probe");
  });

  it("retention-bonus clawback mention — must NOT return discovery-probe", () => {
    const s = offerPresentedState(
      "If I leave, I may have to repay a retention bonus."
    );
    const action = planNextAction(s);
    expect(action.kind).not.toBe("discovery-probe");
  });
});
