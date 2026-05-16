/* Response-validator tests — kernel-first survivors (2026-05-16).
 *
 * Most of the original validator stack policed an LLM authorship surface
 * that no longer exists. Only NUMBER DISCIPLINE survives because restyle
 * is still capable of introducing a stray number. validateNoFabricated-
 * Facts has its own test file (fabricatedFactsValidator.test.ts).
 */
import { describe, it, expect } from "vitest";
import { validateNumberDiscipline } from "../../server-handlers/_response-validators";
import type {
  NegotiationState,
  NegotiationBand,
} from "../../server-handlers/_negotiation-kernel";

const BAND: NegotiationBand = {
  initialOffer: 18,
  maxStretch: 24,
  walkAway: 14,
  hasEquity: false,
};

/** Minimal state stub — only the fields the validators read. The
 *  validators are deliberately narrow so we don't depend on the full
 *  kernel state shape here. */
function mkState(overrides: Partial<NegotiationState> = {}): NegotiationState {
  return {
    sessionId: "test",
    role: "Software Engineer",
    company: "infosys",
    band: BAND,
    phase: "counter-offer",
    turnIndex: 2,
    maxTurns: 8,
    candidateTarget: 22,
    lastCandidateCounterLpa: null,
    firstAnchoredTarget: 22,
    candidateCurrentCtc: 12,
    competingOffer: null,
    candidateComponentBreakdown: {} as never,
    candidateAskedAsRange: false,
    highestOfferMade: 18,
    leversUsed: [],
    lastAiText: "",
    lastJoiningBonusOffered: null,
    conversationLog: [],
    finalOfferAssertedCount: 0,
    vossTacticsUsed: [],
    infoAsked: [],
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
    candidateTotalYoe: null,
    candidateApplicableYoe: null,
    candidatePrimaryDomain: null,
    freshGradDisclosed: false,
    recruiterFactsAlreadySaid: [],
    anchorLocked: true,
    lockedAnchorLpa: 18,
    ...overrides,
  } as NegotiationState;
}

describe("validateNumberDiscipline", () => {
  it("emits number consistent with locked anchor → ok", () => {
    const r = validateNumberDiscipline("We can offer ₹18L for the role.", mkState());
    expect(r.ok).toBe(true);
  });

  it("emits number 20% below locked anchor → reject", () => {
    const r = validateNumberDiscipline("Looking at ₹14L on the table.", mkState());
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toMatch(/below locked anchor/);
    }
  });

  it("emits number above band ceiling → reject", () => {
    const r = validateNumberDiscipline("We can stretch to ₹26L.", mkState());
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toMatch(/band ceiling/);
    }
  });

  it("no numbers in reply → ok (nothing to validate)", () => {
    const r = validateNumberDiscipline("Let me check with the team and get back to you.", mkState());
    expect(r.ok).toBe(true);
  });

  it("locked anchor undefined → ok (nothing to check against)", () => {
    const r = validateNumberDiscipline(
      "₹14L is what we can do today.",
      mkState({ anchorLocked: false, lockedAnchorLpa: null }),
    );
    /* Still below band-walkAway-floor but no anchor lock means the
     * anchor-deviation check is silent. Number ₹14L is within band
     * (walkAway=14, ceiling=24) so band check also passes. */
    expect(r.ok).toBe(true);
  });
});

