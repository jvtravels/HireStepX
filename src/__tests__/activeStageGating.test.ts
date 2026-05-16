/* PDF #17 architectural fix follow-up (2026-05-15) — active stage
 * gating + brief stage injection.
 *
 * c54102d shipped the discovery-first kernel (state machine types,
 * checklist progression, trial-close detectors, candidate-profile flags,
 * system-prompt rule blocks). Two deferred items remained:
 *
 *   1. Wire discoveryStage transitions into the move-picker so the
 *      kernel itself prefers discovery questions while incomplete
 *      and routes probe-mismatch as the first move on hard resume↔
 *      role mismatch.
 *
 *   2. Inject [CURRENT STAGE: X] + [NEXT REQUIRED ACTION: ...] into
 *      compactTurnBrief so the LLM gets explicit per-turn cues (same
 *      bracketed shape as OPEN PROMISES TO HONOR).
 *
 * These tests pin the wiring. Soft preference design (lever stays
 * `probe`; only rationale + brief carry the discovery item) keeps
 * the existing ~4525-test surface green.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  pickAiMove,
  type NegotiationBand,
  type NegotiationState,
  type AiMove,
} from "../../server-handlers/_negotiation-kernel";
import { buildAiPrompt } from "../../server-handlers/_negotiate-turn-helpers";
import {
  EMPTY_DISCOVERY_CHECKLIST,
  type DiscoveryChecklist,
} from "../../server-handlers/_discovery-stage";

const BAND: NegotiationBand = {
  initialOffer: 20,
  maxStretch: 28,
  walkAway: 16,
  hasEquity: true,
};

const init = (
  overrides: Partial<NegotiationState> = {},
): NegotiationState => ({
  ...initState({
    sessionId: "s-active-gating",
    role: "Software Engineer",
    company: "acme",
    band: BAND,
  }),
  ...overrides,
});

describe("active discovery-stage gating in pickAiMove", () => {
  it("probe-expectations + discovery incomplete → probe with discovery-question rationale", () => {
    const m = pickAiMove(
      init({
        phase: "probe-expectations",
        highestOfferMade: 20,
        discoveryStage: "discovery",
        discoveryChecklist: { ...EMPTY_DISCOVERY_CHECKLIST },
      }),
    );
    expect(m.lever).toBe("probe"); // back-compat: lever is unchanged
    expect(m.rationale.toLowerCase()).toMatch(/discovery incomplete/);
    expect(m.rationale.toLowerCase()).toMatch(/current\s+ctc/);
  });

  it("offer-presented + discovery incomplete → probe with NEXT discovery item", () => {
    /* Discovery already captured currentCtc + currentCtcFixedVariableSplit;
     * per DISCOVERY_SEQUENCE the next ordered item is targetAnswered
     * (defect 1 fix — offer-presented branch now routes through
     * getNextOrderedDiscoveryQuestion, same as the opening branch, so
     * skipRecord is honoured and ordering matches the rest of the planner). */
    const partial: DiscoveryChecklist = {
      ...EMPTY_DISCOVERY_CHECKLIST,
      currentCtcAsked: true,
      currentCtcAnswered: true,
      fixedVariableSplitAsked: true,
      fixedVariableSplitAnswered: true,
    };
    const m = pickAiMove(
      init({
        phase: "offer-presented",
        highestOfferMade: 20,
        discoveryStage: "discovery",
        discoveryChecklist: partial,
      }),
    );
    expect(m.lever).toBe("probe");
    expect(m.rationale).toMatch(/target/i);
  });

  it("probe-expectations + discovery complete → generic probe (no discovery rationale)", () => {
    const complete: DiscoveryChecklist = {
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
    const m = pickAiMove(
      init({
        phase: "probe-expectations",
        highestOfferMade: 20,
        discoveryStage: "discovery",
        discoveryChecklist: complete,
      }),
    );
    expect(m.lever).toBe("probe");
    expect(m.rationale).toMatch(/Probe candidate's expectation/i);
  });

  it("discoveryStage='probe-mismatch' on opening → probe with domain-switch rationale", () => {
    const m = pickAiMove(
      init({
        phase: "opening",
        discoveryStage: "probe-mismatch",
      }),
    );
    expect(m.lever).toBe("probe");
    expect(m.rationale.toLowerCase()).toMatch(/probe-mismatch|domain switch|resume/);
    expect(m.newTotalLpa).toBeNull();
  });

  it("legacy session without discoveryStage / discoveryChecklist → behavior unchanged", () => {
    /* Back-compat path: a session that predates discovery tracking
     * must continue to route through the legacy generic probe. */
    const legacy = init({
      phase: "probe-expectations",
      highestOfferMade: 20,
    });
    // Force the optional discovery fields off to simulate an in-flight legacy session.
    const stripped: NegotiationState = {
      ...legacy,
      discoveryStage: undefined,
      discoveryChecklist: undefined,
    };
    const m = pickAiMove(stripped);
    expect(m.lever).toBe("probe");
    expect(m.rationale).toMatch(/Probe candidate's expectation/i);
  });

  it("counter-offer phase is NOT short-circuited by discovery (no regression)", () => {
    /* The discovery preference fires only in probe-expectations /
     * offer-presented / opening. counter-offer still routes through
     * the regular counter-base math even when discoveryChecklist is
     * empty — otherwise the kernel split would never run. */
    const m = pickAiMove(
      init({
        phase: "counter-offer",
        highestOfferMade: 20,
        candidateTarget: 26,
        candidateCurrentCtc: 18, // satisfies probe-justification skip-condition
        discoveryStage: "discovery",
        discoveryChecklist: { ...EMPTY_DISCOVERY_CHECKLIST },
      }),
    );
    expect(m.lever).toBe("counter-base");
  });
});

describe("compactTurnBrief — discovery-stage injection", () => {
  it("[CURRENT STAGE: discovery] surfaces in the brief when discovery stage is set", () => {
    const state = init({
      phase: "probe-expectations",
      highestOfferMade: 20,
      discoveryStage: "discovery",
      discoveryChecklist: { ...EMPTY_DISCOVERY_CHECKLIST },
    });
    const move: AiMove = {
      lever: "probe",
      newTotalLpa: null,
      rationale: "discovery probe",
    };
    const { user } = buildAiPrompt({ state, move, candidateAnswer: "" });
    expect(user).toContain("[CURRENT STAGE: discovery]");
  });

  it("[NEXT REQUIRED ACTION: ...] surfaces the next open discovery question", () => {
    const state = init({
      phase: "probe-expectations",
      highestOfferMade: 20,
      discoveryStage: "discovery",
      discoveryChecklist: { ...EMPTY_DISCOVERY_CHECKLIST },
    });
    const move: AiMove = {
      lever: "probe",
      newTotalLpa: null,
      rationale: "discovery probe",
    };
    const { user } = buildAiPrompt({ state, move, candidateAnswer: "" });
    expect(user).toMatch(/\[NEXT REQUIRED ACTION:[^\]]*current\s+CTC/i);
  });

  it("NEXT REQUIRED ACTION is omitted once discovery is complete", () => {
    const complete: DiscoveryChecklist = {
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
    const state = init({
      phase: "counter-offer",
      highestOfferMade: 22,
      candidateTarget: 26,
      discoveryStage: "discovery",
      discoveryChecklist: complete,
    });
    const move: AiMove = {
      lever: "counter-base",
      newTotalLpa: 23,
      rationale: "split",
    };
    const { user } = buildAiPrompt({ state, move, candidateAnswer: "" });
    expect(user).toContain("[CURRENT STAGE: discovery]");
    expect(user).not.toMatch(/\[NEXT REQUIRED ACTION:/);
  });

  it("[CURRENT STAGE: probe-mismatch] surfaces on probe-mismatch stage", () => {
    const state = init({
      phase: "opening",
      discoveryStage: "probe-mismatch",
    });
    const move: AiMove = {
      lever: "probe",
      newTotalLpa: null,
      rationale: "domain probe",
    };
    const { user } = buildAiPrompt({ state, move, candidateAnswer: "" });
    expect(user).toContain("[CURRENT STAGE: probe-mismatch]");
    /* probe-mismatch is not the discovery stage; no NEXT REQUIRED
     * ACTION line should fire (that's discovery-specific). */
    expect(user).not.toMatch(/\[NEXT REQUIRED ACTION:/);
  });

  it("legacy session without discoveryStage emits NO stage lines", () => {
    const legacy = init({
      phase: "probe-expectations",
      highestOfferMade: 20,
    });
    const state: NegotiationState = {
      ...legacy,
      discoveryStage: undefined,
      discoveryChecklist: undefined,
    };
    const move: AiMove = {
      lever: "probe",
      newTotalLpa: null,
      rationale: "legacy probe",
    };
    const { user } = buildAiPrompt({ state, move, candidateAnswer: "" });
    expect(user).not.toMatch(/\[CURRENT STAGE:/);
    expect(user).not.toMatch(/\[NEXT REQUIRED ACTION:/);
  });
});
