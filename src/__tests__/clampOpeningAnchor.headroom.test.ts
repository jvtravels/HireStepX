/* #PRI-53 (2026-06-21, live staging) — OPENING anchor must leave concession
 * headroom below the band ceiling.
 *
 * Live repro (Flipkart "Engineering Manager", current CTC ₹48L, band
 * ₹32.7–₹53.2L): a "tough" manager's 25%-hike floor (₹60L) overshot the
 * ceiling, so clampAnchorAboveDisclosed pinned the OPENING offer at maxStretch
 * (₹53.2L) — the candidate had nowhere to negotiate up to. clampOpeningAnchor
 * backs the opening off below the ceiling while never opening below a real
 * raise over the disclosed CTC. Counters/closes still use the full band.
 */
import { describe, it, expect } from "vitest";
import {
  clampAnchorAboveDisclosed,
  clampOpeningAnchor,
} from "../../server-handlers/_next-action-planner";
import type { NegotiationState, NegotiationBand } from "../../server-handlers/_negotiation-kernel";

function mkState(
  band: NegotiationBand,
  disclosed: number | null,
  opts?: { yoe?: number; role?: string },
): NegotiationState {
  return {
    sessionId: "opening-anchor-test",
    role: opts?.role ?? "Engineering Manager",
    company: "flipkart",
    band,
    phase: "opening",
    turnIndex: 4,
    maxTurns: 16,
    candidateTarget: 65,
    lastCandidateCounterLpa: null,
    firstAnchoredTarget: null,
    candidateCurrentCtc: disclosed,
    competingOffer: null,
    candidateComponentBreakdown: {} as never,
    candidateAskedAsRange: false,
    highestOfferMade: 0,
    leversUsed: [],
    lastAiText: "",
    lastJoiningBonusOffered: null,
    conversationLog: [],
    finalOfferAssertedCount: 0,
    vossTacticsUsed: [],
    infoAsked: [],
    infoAskedInitiated: [],
    verbalAcceptanceTurn: null,
    postVerbalRenegotiationCount: 0,
    counterRound: 0,
    recentRecoveryActive: false,
    walkAwayReturned: false,
    hardBandCap: false,
    marketMode: "neutral",
    recruiterPersona: "consultative",
    acceptedAtTurn: null,
    walkedAwayAtTurn: null,
    hikePercent: null,
    rationale: null,
    noticeJoining: {} as never,
    equityVesting: {} as never,
    locationMode: {} as never,
    competingOfferDetail: {} as never,
    decisionDeadline: {} as never,
    candidateProfile: {} as never,
    miscSignals: {} as never,
    candidateStance: {} as never,
    salesOTE: {} as never,
    contractRate: {} as never,
    retentionCounter: {} as never,
    candidateTotalYoe: opts?.yoe ?? 10,
    candidateApplicableYoe: opts?.yoe ?? 10,
    candidatePrimaryDomain: null,
    freshGradDisclosed: false,
    recruiterFactsAlreadySaid: [],
    anchorLocked: false,
    lockedAnchorLpa: null,
    promptInjectionAttempts: [],
  } as NegotiationState;
}

const CEIL_BAND: NegotiationBand = {
  initialOffer: 32.7,
  maxStretch: 53.2,
  walkAway: 27.7,
  hasEquity: true,
};

describe("clampOpeningAnchor — headroom below the ceiling (#PRI-53)", () => {
  it("opens strictly BELOW maxStretch when the CTC-hike floor overshoots the ceiling", () => {
    const state = mkState(CEIL_BAND, 48);
    // The shared clamp pins the ceiling (no room to negotiate up)…
    expect(clampAnchorAboveDisclosed(32.7, 53.2, state)).toBe(53.2);
    // …the opening clamp leaves concession headroom below it.
    const opening = clampOpeningAnchor(32.7, 53.2, state);
    expect(opening).not.toBeNull();
    expect(opening!).toBeLessThan(53.2);
  });

  it("never opens below a real raise over the disclosed CTC (no pay-cut opening)", () => {
    const state = mkState(CEIL_BAND, 48);
    const opening = clampOpeningAnchor(32.7, 53.2, state)!;
    expect(opening).toBeGreaterThanOrEqual(48); // at/above current pay
  });

  it("leaves a floor-opening untouched when the band already has room (clean band)", () => {
    // Junior CTC well below the floor → opening sits at the band floor, which is
    // already far below the ceiling. No back-off should occur.
    const state = mkState(CEIL_BAND, 14, { yoe: 2, role: "Product Manager" });
    expect(clampOpeningAnchor(32.7, 53.2, state)).toBe(
      clampAnchorAboveDisclosed(32.7, 53.2, state),
    );
  });

  it("preserves the honest-defer null path (ceiling below disclosed CTC)", () => {
    const TIGHT: NegotiationBand = { initialOffer: 35, maxStretch: 38, walkAway: 30, hasEquity: false };
    const state = mkState(TIGHT, 40);
    expect(clampOpeningAnchor(35, 38, state)).toBeNull();
  });

  it("no-ops on a degenerate band (hi <= lo)", () => {
    const state = mkState(CEIL_BAND, 14);
    expect(clampOpeningAnchor(40, 40, state)).toBe(
      clampAnchorAboveDisclosed(40, 40, state),
    );
  });
});
