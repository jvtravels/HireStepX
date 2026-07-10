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
  it("volunteered notice period DAYS flips noticePeriodAnswered", () => {
    /* AUDIT-2 follow-up (2026-06-08): notice umbrella flag (joining-bonus,
     * buyout, LWD) no longer flips noticePeriodAnswered — only actual
     * stated days do. Production fix for "bot never asks notice". */
    const next = syncChecklistFromParsedFacts(EMPTY_DISCOVERY_CHECKLIST, {
      target: null,
      currentCtc: null,
      competing: null,
      signalsCompetingExistsWithoutNumber: false,
      competingOfferDetailHasAny: false,
      noticeJoiningHasAny: true,
      noticePeriodDays: 90,
      fixedVariableSplitHasBoth: false,
      valueProofSignal: false,
    });
    expect(next.noticePeriodAnswered).toBe(true);
    /* Untouched flags remain false. */
    expect(next.currentCtcAnswered).toBe(false);
    expect(next.targetAnswered).toBe(false);
  });

  it("notice umbrella signals WITHOUT days do NOT flip noticePeriodAnswered", () => {
    /* AUDIT-2 follow-up — the production bug. Joining-bonus ask alone
     * was satisfying the notice slot. Now it shouldn't. */
    const next = syncChecklistFromParsedFacts(EMPTY_DISCOVERY_CHECKLIST, {
      target: null,
      currentCtc: null,
      competing: null,
      signalsCompetingExistsWithoutNumber: false,
      competingOfferDetailHasAny: false,
      noticeJoiningHasAny: true,
      noticePeriodDays: null,
      fixedVariableSplitHasBoth: false,
      valueProofSignal: false,
    });
    expect(next.noticePeriodAnswered).toBe(false);
  });

  it("volunteered fixed+variable split flips fixedVariableSplitAnswered (umbrella flag)", () => {
    const next = syncChecklistFromParsedFacts(EMPTY_DISCOVERY_CHECKLIST, {
      target: null,
      currentCtc: 18,
      competing: null,
      signalsCompetingExistsWithoutNumber: false,
      competingOfferDetailHasAny: false,
      noticeJoiningHasAny: false,
      noticePeriodDays: null,
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
      noticePeriodDays: null,
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

  /* N-2 (2026-07-10, live staging — Senior Product Designer @ Lollypop Design
   * Studio) — a fixed-scoped anchor ("I'm looking for 46 LPA fixed") binds the
   * ask to candidateTargetFixed, leaving parsed.target null. The checklist
   * reconcile used to read only parsed.target, so targetAnswered stayed false
   * and the planner's anchor gate re-asked "what's your target?" AFTER the
   * candidate had already anchored. The reconcile now folds the persisted
   * candidateTarget / candidateTargetFixed in, so an in-hand ask is coherent
   * with targetAnswered regardless of the surface it was stated on. */
  it("fixed-scoped anchor with parsed.target null still flips targetAnswered", () => {
    const s0 = initState({
      sessionId: "s",
      role: "Senior Product Designer",
      company: "Lollypop Design Studio",
      band: BAND,
    });
    const s1 = applyCandidateAnswer(s0, "I'm looking for 46 LPA fixed.");
    // The ask landed on the fixed slot, NOT the soft-target slot...
    expect(s1.candidateTargetFixed).toBe(46);
    expect(s1.candidateTarget).toBeNull();
    // ...yet the checklist reconciles to targetAnswered — no stale re-ask.
    expect(s1.discoveryChecklist?.targetAnswered).toBe(true);
  });

  it("coherence invariant: an in-hand candidate ask never coexists with targetAnswered=false", () => {
    const s0 = initState({ sessionId: "s", role: "swe", company: "acme", band: BAND });
    const s1 = applyCandidateAnswer(s0, "My target is 46 fixed base.");
    const hasAsk = s1.candidateTarget != null || s1.candidateTargetFixed != null;
    if (hasAsk) expect(s1.discoveryChecklist?.targetAnswered).toBe(true);
  });
});
