/* syncChecklistFromParsedFacts — negotiation-flow redesign commit 2
 * (2026-05-15).
 *
 * Audit D5 fix: parsed facts → *Answered flag writes were asymmetric.
 * This helper unifies the writeback so volunteered facts immediately
 * flip their checklist flag, killing redundant re-asks.
 */
import { describe, it, expect } from "vitest";
import {
  EMPTY_DISCOVERY_CHECKLIST,
  syncChecklistFromParsedFacts,
} from "../../server-handlers/_discovery-stage";
import {
  initState,
  applyCandidateAnswer,
  type NegotiationBand,
} from "../../server-handlers/_negotiation-kernel";

const BAND: NegotiationBand = { initialOffer: 20, maxStretch: 28, walkAway: 16, hasEquity: true };

describe("syncChecklistFromParsedFacts (unit)", () => {
  it("volunteered notice period flips noticePeriodAnswered", () => {
    const next = syncChecklistFromParsedFacts(EMPTY_DISCOVERY_CHECKLIST, {
      target: null,
      currentCtc: null,
      competing: null,
      signalsCompetingExistsWithoutNumber: false,
      competingOfferDetailHasAny: false,
      noticeJoiningHasAny: true,
      fixedVariableSplitHasBoth: false,
      valueProofSignal: false,
    });
    expect(next.noticePeriodAnswered).toBe(true);
    /* Untouched flags remain false. */
    expect(next.currentCtcAnswered).toBe(false);
    expect(next.targetAnswered).toBe(false);
  });

  it("volunteered fixed+variable split flips fixedVariableSplitAnswered (umbrella flag)", () => {
    const next = syncChecklistFromParsedFacts(EMPTY_DISCOVERY_CHECKLIST, {
      target: null,
      currentCtc: 18,
      competing: null,
      signalsCompetingExistsWithoutNumber: false,
      competingOfferDetailHasAny: false,
      noticeJoiningHasAny: false,
      fixedVariableSplitHasBoth: true,
      valueProofSignal: false,
    });
    expect(next.fixedVariableSplitAnswered).toBe(true);
    /* currentCtc disclosed at the same time → currentCtcAnswered also flips. */
    expect(next.currentCtcAnswered).toBe(true);
  });

  it("ambiguous mention (no parsed signals) does NOT flip any flag", () => {
    const next = syncChecklistFromParsedFacts(EMPTY_DISCOVERY_CHECKLIST, {
      target: null,
      currentCtc: null,
      competing: null,
      signalsCompetingExistsWithoutNumber: false,
      competingOfferDetailHasAny: false,
      noticeJoiningHasAny: false,
      fixedVariableSplitHasBoth: false,
      valueProofSignal: false,
    });
    /* Identity-preserving on no-op for cheap reference equality downstream. */
    expect(next).toBe(EMPTY_DISCOVERY_CHECKLIST);
  });
});

describe("syncChecklistFromParsedFacts (integration via applyCandidateAnswer)", () => {
  it("kills the volunteered-notice re-ask: candidate states '90 days notice' → noticePeriodAnswered=true", () => {
    const s0 = initState({ sessionId: "s", role: "swe", company: "acme", band: BAND });
    const s1 = applyCandidateAnswer(s0, "I have a 90 days notice period at my current company.");
    expect(s1.discoveryChecklist?.noticePeriodAnswered).toBe(true);
  });
});
