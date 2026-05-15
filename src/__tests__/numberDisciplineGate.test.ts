/* Sprint B.2 (2026-05-15) — canDiscloseSpecificNumber + brief gate. */
import { describe, it, expect } from "vitest";
import {
  initState,
  canDiscloseSpecificNumber,
  type NegotiationBand,
  type NegotiationState,
  type AiMove,
} from "../../server-handlers/_negotiation-kernel";
import { buildAiPrompt } from "../../server-handlers/_negotiate-turn-helpers";
import { EMPTY_DISCOVERY_CHECKLIST } from "../../server-handlers/_discovery-stage";

const BAND: NegotiationBand = { initialOffer: 15, maxStretch: 22, walkAway: 12, hasEquity: false };
function makeState(overrides: Partial<NegotiationState> = {}): NegotiationState {
  return { ...initState({ sessionId: "s", role: "swe", company: "acme", band: BAND }), ...overrides };
}

describe("Sprint B.2 — canDiscloseSpecificNumber", () => {
  it("candidate has anchored → true", () => {
    const s = makeState({ candidateTarget: 20 });
    expect(canDiscloseSpecificNumber(s)).toBe(true);
  });

  it("no anchor + 0 refusals → false", () => {
    const s = makeState();
    expect(canDiscloseSpecificNumber(s)).toBe(false);
  });

  it("no anchor + 1 refusal → false", () => {
    const s = makeState({ probeRefusalCount: 1 });
    expect(canDiscloseSpecificNumber(s)).toBe(false);
  });

  it("no anchor + 2 refusals + discovery incomplete → false", () => {
    const s = makeState({
      probeRefusalCount: 2,
      discoveryChecklist: { ...EMPTY_DISCOVERY_CHECKLIST },
    });
    expect(canDiscloseSpecificNumber(s)).toBe(false);
  });

  it("no anchor + 2 refusals + discovery complete → true", () => {
    const s = makeState({
      probeRefusalCount: 2,
      discoveryChecklist: {
        ...EMPTY_DISCOVERY_CHECKLIST,
        currentCtcAnswered: true,
        fixedVariableSplitAnswered: true,
        noticePeriodAnswered: true,
        valueProofAnswered: true,
        targetAnswered: true,
      },
    });
    expect(canDiscloseSpecificNumber(s)).toBe(true);
  });

  it("brief surfaces NUMBER DISCIPLINE advisory when gate blocks", () => {
    const s = makeState({ phase: "opening" });
    const move: AiMove = { lever: "probe", newTotalLpa: null, rationale: "x" };
    const { user } = buildAiPrompt({ state: s, move, candidateAnswer: "Hello." });
    expect(user).toMatch(/NUMBER DISCIPLINE/);
  });

  it("brief omits NUMBER DISCIPLINE once candidate anchors", () => {
    const s = makeState({ phase: "counter-offer", candidateTarget: 20, highestOfferMade: 15 });
    const move: AiMove = { lever: "counter-base", newTotalLpa: 17, rationale: "x" };
    const { user } = buildAiPrompt({ state: s, move, candidateAnswer: "I'm targeting 20L." });
    expect(user).not.toMatch(/NUMBER DISCIPLINE/);
  });
});
