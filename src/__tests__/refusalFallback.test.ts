/* PDF#18 follow-up P4 (2026-05-15) — refusal-fallback path.
 *
 * When the candidate refuses a discovery item twice
 * (probeRefusalCount ≥ 2 with the same lastDiscoveryItemAsked), the
 * kernel skips that item via getNextOrderedDiscoveryItem's `refused`
 * map and asks the next incomplete item in sequence. The move-picker
 * surfaces a [ITEM REFUSED — SKIPPED] hint in the rationale so the
 * brief / LLM acknowledges the skip naturally rather than re-asking.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  applyCandidateAnswer,
  pickAiMove,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import {
  EMPTY_DISCOVERY_CHECKLIST,
  getNextOrderedDiscoveryItem,
} from "../../server-handlers/_discovery-stage";

const BAND: NegotiationBand = {
  initialOffer: 18,
  maxStretch: 24,
  walkAway: 14,
  hasEquity: true,
};

const init = (overrides: Partial<NegotiationState> = {}): NegotiationState => ({
  ...initState({
    sessionId: "s-refusal-fallback",
    role: "Software Engineer",
    company: "acme",
    band: BAND,
  }),
  ...overrides,
});

describe("refusal-fallback — discovery skips refused items", () => {
  it("getNextOrderedDiscoveryItem skips a refused item and returns the next", () => {
    const checklist = { ...EMPTY_DISCOVERY_CHECKLIST };
    const next = getNextOrderedDiscoveryItem(checklist, "engineering", {
      currentCtcAnswered: true,
    });
    /* currentCtcAnswered is refused → next un-refused un-satisfied item
     * in the sequence is currentCtcFixedVariableSplitDisclosed BUT it's
     * gated on currentCtcAnswered (which is false), so it's satisfied
     * vacuously. The next REAL un-satisfied item is targetAnswered. */
    expect(next).toBe("targetAnswered");
  });

  it("getNextOrderedDiscoveryItem returns null when ALL non-refused items satisfied", () => {
    const checklist = {
      ...EMPTY_DISCOVERY_CHECKLIST,
      noticePeriodAnswered: true,
      competingOffersAnswered: true,
    };
    const next = getNextOrderedDiscoveryItem(checklist, "ops", {
      currentCtcAnswered: true,
      targetAnswered: true,
    });
    expect(next).toBeNull();
  });

  it("applyCandidateAnswer marks item refused after 2 refusals on the same item", () => {
    let s = init({
      lastDiscoveryItemAsked: "currentCtcAnswered",
      probeRefusalCount: 0,
    });
    s = applyCandidateAnswer(s, "I'd prefer not to share that right now.");
    expect(s.probeRefusalCount).toBe(1);
    expect(s.discoveryRefusedItems?.currentCtcAnswered).toBeFalsy();
    /* second refusal → mark item */
    const s2: NegotiationState = { ...s, lastDiscoveryItemAsked: "currentCtcAnswered" };
    const s3 = applyCandidateAnswer(s2, "Rather not say.");
    expect(s3.probeRefusalCount).toBe(2);
    expect(s3.discoveryRefusedItems?.currentCtcAnswered).toBe(true);
  });

  it("non-refusal utterance does NOT increment probeRefusalCount", () => {
    const s = init({
      lastDiscoveryItemAsked: "currentCtcAnswered",
      probeRefusalCount: 0,
    });
    const next = applyCandidateAnswer(s, "My current package is 14L.");
    expect(next.probeRefusalCount ?? 0).toBe(0);
    expect(next.discoveryRefusedItems?.currentCtcAnswered).toBeFalsy();
  });

  it("move-picker rationale carries [ITEM REFUSED — SKIPPED] hint when refused-map is non-empty", () => {
    const s = init({
      phase: "opening",
      turnIndex: 2,
      highestOfferMade: 0,
      discoveryStage: "discovery",
      discoveryChecklist: { ...EMPTY_DISCOVERY_CHECKLIST },
      discoveryRefusedItems: { currentCtcAnswered: true },
    });
    const move = pickAiMove(s);
    expect(move.lever).toBe("probe");
    expect(move.rationale).toMatch(/ITEM REFUSED — SKIPPED/);
    expect(move.rationale).toContain("currentCtcAnswered");
  });

  it("end-to-end: 2 refusals of current CTC → next probe asks expected target", () => {
    let s = init({
      phase: "opening",
      turnIndex: 1,
      highestOfferMade: 0,
      discoveryStage: "discovery",
      discoveryChecklist: { ...EMPTY_DISCOVERY_CHECKLIST },
      lastDiscoveryItemAsked: "currentCtcAnswered",
    });
    s = applyCandidateAnswer(s, "I'd prefer not to share my current.");
    s = { ...s, lastDiscoveryItemAsked: "currentCtcAnswered" };
    s = applyCandidateAnswer(s, "Rather not say on that one.");
    expect(s.discoveryRefusedItems?.currentCtcAnswered).toBe(true);
    /* Now the move-picker should skip currentCtcAnswered and route to
     * the next ordered item — targetAnswered. */
    const move = pickAiMove(s);
    expect(move.lever).toBe("probe");
    expect(move.rationale).toMatch(/Discovery incomplete \(next: targetAnswered\)/);
  });

  it("candidate refuses everything → eventually exits discovery (no probe to emit)", () => {
    /* All ordered items refused → getNextOrderedDiscoveryItem returns
     * null → discovery is treated as effectively complete for routing. */
    const refused: Record<string, boolean> = {
      currentCtcAnswered: true,
      targetAnswered: true,
      noticePeriodAnswered: true,
      competingOffersAnswered: true,
      valueProofAnswered: true,
    };
    const next = getNextOrderedDiscoveryItem(
      { ...EMPTY_DISCOVERY_CHECKLIST },
      "engineering",
      refused,
    );
    expect(next).toBeNull();
  });

  it("refused map is monotone-up — clearing an item is NOT automatic", () => {
    let s = init({
      lastDiscoveryItemAsked: "noticePeriodAnswered",
      probeRefusalCount: 1,
      discoveryRefusedItems: { noticePeriodAnswered: true },
    });
    /* A non-refusal utterance doesn't clear the prior refusal. */
    s = applyCandidateAnswer(s, "I'm flexible on timing.");
    expect(s.discoveryRefusedItems?.noticePeriodAnswered).toBe(true);
  });
});
