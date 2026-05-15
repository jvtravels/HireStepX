/* PDF #18 root-cause (2026-05-15) — discovery gate must NOT fire
 * post-acceptance or in any terminal phase.
 *
 * Real session: bot kept asking discovery questions AFTER candidate
 * accepted the offer. Root cause: compactTurnBrief surfaced the
 * [CURRENT STAGE: discovery] + [NEXT REQUIRED ACTION: ...] block off
 * discoveryStage alone, never gating on phase. */
import { describe, expect, it } from "vitest";
import {
  initState,
  type NegotiationBand,
  type NegotiationState,
  type AiMove,
} from "../../server-handlers/_negotiation-kernel";
import { buildAiPrompt } from "../../server-handlers/_negotiate-turn-helpers";
import {
  EMPTY_DISCOVERY_CHECKLIST,
} from "../../server-handlers/_discovery-stage";

const BAND: NegotiationBand = { initialOffer: 28, maxStretch: 40, walkAway: 18, hasEquity: false };
const init = (overrides: Partial<NegotiationState> = {}): NegotiationState => ({
  ...initState({ sessionId: "s1", role: "qa-engineer", company: "jp morgan", band: BAND }),
  ...overrides,
});

describe("discovery gate post-acceptance suppression (PDF #18)", () => {
  it("accepted phase + incomplete discovery → no NEXT REQUIRED ACTION", () => {
    const state = init({
      phase: "accepted",
      acceptedAtTurn: 4,
      highestOfferMade: 28,
      discoveryStage: "discovery",
      discoveryChecklist: { ...EMPTY_DISCOVERY_CHECKLIST },
    });
    const move: AiMove = {
      lever: "terminal-restate",
      newTotalLpa: 28,
      rationale: "accepted",
    };
    const { user } = buildAiPrompt({ state, move, candidateAnswer: "Yes I accept." });
    expect(user).not.toMatch(/\[NEXT REQUIRED ACTION:/);
    expect(user).not.toMatch(/\[CURRENT STAGE:/);
  });

  it("walked-away phase + incomplete discovery → no discovery prompt", () => {
    const state = init({
      phase: "walked-away",
      walkedAwayAtTurn: 3,
      discoveryStage: "discovery",
      discoveryChecklist: { ...EMPTY_DISCOVERY_CHECKLIST },
    });
    const move: AiMove = {
      lever: "terminal-restate",
      newTotalLpa: null,
      rationale: "walked",
    };
    const { user } = buildAiPrompt({ state, move, candidateAnswer: "Not interested." });
    expect(user).not.toMatch(/\[NEXT REQUIRED ACTION:/);
    expect(user).not.toMatch(/\[CURRENT STAGE:/);
  });

  it("stalemate phase + incomplete discovery → no discovery prompt", () => {
    const state = init({
      phase: "stalemate",
      discoveryStage: "discovery",
      discoveryChecklist: { ...EMPTY_DISCOVERY_CHECKLIST },
    });
    const move: AiMove = {
      lever: "close-stalemate",
      newTotalLpa: null,
      rationale: "stalemate",
    };
    const { user } = buildAiPrompt({ state, move, candidateAnswer: "" });
    expect(user).not.toMatch(/\[NEXT REQUIRED ACTION:/);
    expect(user).not.toMatch(/\[CURRENT STAGE:/);
  });

  it("counter-offer phase + incomplete discovery → no NEXT REQUIRED ACTION (gate is past)", () => {
    const state = init({
      phase: "counter-offer",
      highestOfferMade: 28,
      candidateTarget: 32,
      discoveryStage: "discovery",
      discoveryChecklist: { ...EMPTY_DISCOVERY_CHECKLIST },
    });
    const move: AiMove = {
      lever: "counter-base",
      newTotalLpa: 30,
      rationale: "split",
    };
    const { user } = buildAiPrompt({ state, move, candidateAnswer: "I need 32L." });
    /* [CURRENT STAGE] banner is preserved in counter-offer for parity
     * with existing tests, but the NEXT REQUIRED ACTION prompt is
     * suppressed — bot must not re-open discovery mid-counter. */
    expect(user).not.toMatch(/\[NEXT REQUIRED ACTION:/);
  });

  it("opening phase + incomplete discovery + candidate spoke → NEXT REQUIRED ACTION fires (legacy preserved)", () => {
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
    expect(user).toMatch(/\[NEXT REQUIRED ACTION:/);
  });

  it("legacy session (no discoveryStage) in terminal phase emits no stage lines", () => {
    const state = init({
      phase: "accepted",
      acceptedAtTurn: 3,
      highestOfferMade: 28,
    });
    const move: AiMove = {
      lever: "terminal-restate",
      newTotalLpa: 28,
      rationale: "accepted",
    };
    const { user } = buildAiPrompt({ state, move, candidateAnswer: "Yes." });
    expect(user).not.toMatch(/\[CURRENT STAGE:/);
    expect(user).not.toMatch(/\[NEXT REQUIRED ACTION:/);
  });
});
