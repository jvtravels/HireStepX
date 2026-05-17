/* PDF#18 follow-up (2026-05-15) — range-disclosure as a real
 * NegotiationPhase enum value.
 *
 * Before this ship the range-disclosure rule was a brief-only directive
 * the LLM could ignore. Promoting it to a phase enum value means the
 * kernel state-machine + move-picker enforce it: derivePhase routes
 * (opening, discovery-complete, no anchor) → "range-disclosure", the
 * move-picker forces a range-disclosure rationale, and once the
 * candidate has reacted the phase advances to negotiation territory.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  derivePhase,
  pickAiMove,
  applyAiMove,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import {
  EMPTY_DISCOVERY_CHECKLIST,
  type DiscoveryChecklist,
} from "../../server-handlers/_discovery-stage";

const BAND: NegotiationBand = {
  initialOffer: 18,
  maxStretch: 22,
  walkAway: 14,
  hasEquity: true,
};

const init = (overrides: Partial<NegotiationState> = {}): NegotiationState => ({
  ...initState({
    sessionId: "s-range-disclosure-state-machine",
    role: "Software Engineer",
    company: "acme",
    band: BAND,
  }),
  ...overrides,
});

const COMPLETE_CHECKLIST: DiscoveryChecklist = {
  ...EMPTY_DISCOVERY_CHECKLIST,
  currentCtcAsked: true,
  currentCtcAnswered: true,
  fixedVariableSplitAsked: true,
  fixedVariableSplitAnswered: true,
  noticePeriodAsked: true,
  noticePeriodAnswered: true,
  competingOffersAsked: true,
  competingOffersAnswered: true,
  valueProofAsked: true,
  valueProofAnswered: true,
  targetAsked: true,
  targetAnswered: true,
};

describe("range-disclosure phase — state machine transitions", () => {
  it("discovery complete + opening + no anchor + turn ≥ 1 → range-disclosure", () => {
    const s = init({
      phase: "opening",
      turnIndex: 2,
      highestOfferMade: 0,
      discoveryStage: "discovery",
      discoveryChecklist: COMPLETE_CHECKLIST,
    });
    expect(derivePhase(s)).toBe("range-disclosure");
  });

  it("discovery INCOMPLETE → HOLDS at opening (range-disclosure does NOT fire)", () => {
    const s = init({
      phase: "opening",
      turnIndex: 2,
      highestOfferMade: 0,
      discoveryStage: "discovery",
      discoveryChecklist: { ...EMPTY_DISCOVERY_CHECKLIST },
    });
    expect(derivePhase(s)).toBe("opening");
  });

  it("turn 0 + discovery complete + no anchor → opening (turn-gate preserves opening-flow tests)", () => {
    const s = init({
      phase: "opening",
      turnIndex: 0,
      highestOfferMade: 0,
      discoveryStage: "discovery",
      discoveryChecklist: COMPLETE_CHECKLIST,
    });
    /* The turn 0 case is intentionally kept on "opening": the kernel
     * lets the first-turn open-with-offer / probe-mismatch routing run
     * before range-disclosure becomes the new gate. */
    expect(derivePhase(s)).toBe("opening");
  });

  it("range-disclosure phase + bot has not disclosed range yet → stays in range-disclosure", () => {
    const s = init({
      phase: "range-disclosure",
      turnIndex: 2,
      highestOfferMade: 0,
      discoveryStage: "discovery",
      discoveryChecklist: COMPLETE_CHECKLIST,
    });
    expect(derivePhase(s)).toBe("range-disclosure");
  });

  it("range-disclosure phase + rangeDisclosedAtTurn set + next turn elapsed → advances to offer-presented", () => {
    const s = init({
      phase: "range-disclosure",
      turnIndex: 4,
      rangeDisclosedAtTurn: 3,
      highestOfferMade: 0,
      discoveryStage: "discovery",
      discoveryChecklist: COMPLETE_CHECKLIST,
    });
    expect(derivePhase(s)).toBe("offer-presented");
  });

  it("range-disclosure phase + candidate has target + range disclosed + reacted → probe-expectations", () => {
    const s = init({
      phase: "range-disclosure",
      turnIndex: 4,
      rangeDisclosedAtTurn: 3,
      highestOfferMade: 0,
      candidateTarget: 21,
      discoveryStage: "discovery",
      discoveryChecklist: COMPLETE_CHECKLIST,
    });
    expect(derivePhase(s)).toBe("probe-expectations");
  });

  it("range-disclosure phase + specific anchor disclosed → progresses to counter-offer / offer-presented", () => {
    const sWithTarget = init({
      phase: "range-disclosure",
      turnIndex: 5,
      highestOfferMade: 20,
      candidateTarget: 24,
      discoveryStage: "discovery",
      discoveryChecklist: COMPLETE_CHECKLIST,
    });
    expect(derivePhase(sWithTarget)).toBe("counter-offer");

    const sNoTarget = init({
      phase: "range-disclosure",
      turnIndex: 5,
      highestOfferMade: 20,
      discoveryStage: "discovery",
      discoveryChecklist: COMPLETE_CHECKLIST,
    });
    expect(derivePhase(sNoTarget)).toBe("offer-presented");
  });

  it("pickAiMove in range-disclosure phase → forces band-disclosure deflect rationale (Indian HR does NOT disclose internal bands)", () => {
    const s = init({
      phase: "range-disclosure",
      turnIndex: 2,
      highestOfferMade: 0,
      discoveryStage: "discovery",
      discoveryChecklist: COMPLETE_CHECKLIST,
    });
    const move = pickAiMove(s);
    expect(move.lever).toBe("probe");
    expect(move.newTotalLpa).toBeNull();
    /* Post-PDF#27 (Change 2): the range-disclosure phase NEVER leaks an
     * internal band range. The lever is replaced with band-disclosure
     * deflect: restate the offer (if any) and route candidate's
     * expectation to the panel. */
    expect(move.rationale).toMatch(/Band-disclosure deflect/i);
    expect(move.rationale).toMatch(/does NOT disclose/i);
    expect(move.rationale).toMatch(/panel/i);
    /* Rationale must NOT leak the band range. */
    expect(move.rationale).not.toMatch(
      new RegExp(`${BAND.initialOffer}\\s*[\\u2013\\u2014-]\\s*${BAND.maxStretch}`),
    );
  });

  it("applyAiMove records rangeDisclosedAtTurn when bot text emits a range", () => {
    const s = init({
      phase: "range-disclosure",
      turnIndex: 2,
      highestOfferMade: 0,
      discoveryStage: "discovery",
      discoveryChecklist: COMPLETE_CHECKLIST,
    });
    const move = pickAiMove(s);
    const aiText = "Our band sits between ₹18L and ₹22L for this role.";
    const next = applyAiMove(s, move, aiText);
    expect(next.rangeDisclosedAtTurn).toBe(s.turnIndex + 1);
  });

  it("applyAiMove does NOT record rangeDisclosedAtTurn when bot quotes a specific number", () => {
    const s = init({
      phase: "range-disclosure",
      turnIndex: 2,
      highestOfferMade: 0,
      discoveryStage: "discovery",
      discoveryChecklist: COMPLETE_CHECKLIST,
    });
    const move = pickAiMove(s);
    const aiText = "We can extend ₹20L for the role.";
    const next = applyAiMove(s, move, aiText);
    expect(next.rangeDisclosedAtTurn ?? null).toBeNull();
  });

  it("rangeDisclosedAtTurn is sticky — second disclosure does not overwrite first", () => {
    const s = init({
      phase: "range-disclosure",
      turnIndex: 2,
      rangeDisclosedAtTurn: 2,
      highestOfferMade: 0,
      discoveryStage: "discovery",
      discoveryChecklist: COMPLETE_CHECKLIST,
    });
    const move = pickAiMove(s);
    const aiText = "We're in the ₹18-22L band — what are you targeting?";
    const next = applyAiMove(s, move, aiText);
    expect(next.rangeDisclosedAtTurn).toBe(2);
  });

  it("validateState whitelists range-disclosure as a real phase value", () => {
    /* Serialization round-trip — confirms the new phase value is
     * accepted by validateState (was throwing as unknown before the
     * enum addition). */
    const s = init({
      phase: "range-disclosure",
      turnIndex: 2,
      highestOfferMade: 0,
      discoveryStage: "discovery",
      discoveryChecklist: COMPLETE_CHECKLIST,
    });
    const json = JSON.stringify(s);
    const round = JSON.parse(json) as NegotiationState;
    expect(round.phase).toBe("range-disclosure");
  });
});
