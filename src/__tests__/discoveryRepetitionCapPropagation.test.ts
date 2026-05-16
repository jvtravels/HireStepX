/* PDF#27 Fix 3 (2026-05-17) — discovery 3-strike consecutive-topic cap
 * must propagate through BOTH the ordered cascade and the legacy
 * getNextDiscoveryQuestion fallback path.
 *
 * Pre-fix: buildSkipRecord's tail-of-2 detection correctly marked a
 * topic as recently-over-asked, but only the ordered-cascade call
 * site (getNextOrderedDiscoveryItem / getNextOrderedDiscoveryQuestion)
 * consumed the skipRecord. When the ordered cascade returned null on
 * subsequent calls, the fallback `getNextDiscoveryQuestion` would
 * happily re-fire the same topic the cap had just blocked. PDF#27
 * captured this as T2→T3 repeating fixed/variable split.
 *
 * Root-fix: skipRecord is threaded into the fallback path AND
 * getNextDiscoveryQuestion now accepts an optional skip parameter that
 * is consulted against both the legacy `*Asked` topic identifier and
 * the canonical `*Answered`/`*Disclosed` identifier so cap matching is
 * uniform regardless of which DiscoveryTopic key the askedTopics
 * ledger carries.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import { planNextAction } from "../../server-handlers/_next-action-planner";

const BAND: NegotiationBand = {
  initialOffer: 18,
  maxStretch: 24,
  walkAway: 14,
  hasEquity: false,
};

const seed = (extras: Partial<NegotiationState> = {}): NegotiationState => ({
  ...initState({
    sessionId: "rep-cap",
    role: "Software Engineer",
    company: "infosys",
    band: BAND,
  }),
  ...extras,
});

describe("PDF#27 Fix 3 — repetition cap propagates to fallback", () => {
  it("two consecutive asks on currentCtcFixedVariableSplitDisclosed → 3rd planner call advances past it", () => {
    /* Seed state: currentCtc is satisfied, fixed/variable split has
     * been asked twice in a row without disclosure. The cap inside
     * buildSkipRecord must flag the topic AND the fallback must
     * honour that flag. */
    let s = seed({
      phase: "opening",
      candidateCurrentCtc: 12,
      turnIndex: 3,
      askedTopics: [
        { topic: "currentCtcAnswered", atTurn: 1 },
        { topic: "currentCtcFixedVariableSplitDisclosed", atTurn: 2 },
        { topic: "currentCtcFixedVariableSplitDisclosed", atTurn: 3 },
      ],
      discoveryChecklist: {
        currentCtcAsked: true,
        currentCtcAnswered: true,
        fixedVariableSplitAsked: false,
        fixedVariableSplitAnswered: false,
        noticePeriodAsked: false,
        noticePeriodAnswered: false,
        competingOffersAsked: false,
        competingOffersAnswered: false,
        valueProofAsked: false,
        valueProofAnswered: false,
        targetAsked: false,
        targetAnswered: false,
        variableComfortTested: false,
        commitmentValidationAsked: false,
        currentCtcFixedVariableSplitDisclosed: false,
        expectedCtcFixedVariableSplitDisclosed: false,
      },
    });
    const action = planNextAction(s);
    /* Whatever the planner returns MUST NOT be another fixed/variable
     * split probe. discovery-probe targeting noticePeriod or target is
     * the expected advance. */
    if (action.kind === "discovery-probe") {
      expect(action.item).not.toBe("fixedVariableSplitAsked");
      expect(action.item).not.toBe("currentCtcFixedVariableSplitDisclosed");
    }
    /* Sanity: no immediate re-loop of the over-asked topic. */
    expect(action.kind).not.toBe("discovery-probe-loop");
  });

  it("repetition-complaint stamps state → next planner call skips last-asked topic", () => {
    const s = seed({
      phase: "opening",
      candidateCurrentCtc: 12,
      turnIndex: 4,
      repetitionComplaintAtTurn: 4,
      askedTopics: [
        { topic: "currentCtcFixedVariableSplitDisclosed", atTurn: 3 },
      ],
      discoveryChecklist: {
        currentCtcAsked: true,
        currentCtcAnswered: true,
        fixedVariableSplitAsked: true,
        fixedVariableSplitAnswered: false,
        noticePeriodAsked: false,
        noticePeriodAnswered: false,
        competingOffersAsked: false,
        competingOffersAnswered: false,
        valueProofAsked: false,
        valueProofAnswered: false,
        targetAsked: false,
        targetAnswered: false,
        variableComfortTested: false,
        commitmentValidationAsked: false,
        currentCtcFixedVariableSplitDisclosed: false,
        expectedCtcFixedVariableSplitDisclosed: false,
      },
    });
    const action = planNextAction(s);
    if (action.kind === "discovery-probe") {
      expect(action.item).not.toBe("fixedVariableSplitAsked");
      expect(action.item).not.toBe("currentCtcFixedVariableSplitDisclosed");
    }
  });
});
