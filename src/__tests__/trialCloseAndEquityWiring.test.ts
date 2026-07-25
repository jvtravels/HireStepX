/* ITEM 3 — Wire detectTrialCloseAsked and analyzeEquityClarity.
 *
 * Tests that:
 *   1. applyCandidateAnswer sets candidateSignaledClose=true when the
 *      last bot reply contained a trial-close ask.
 *   2. applyCandidateAnswer pushes "candidate-trial-close" onto
 *      state.reactiveFollowupsFired when candidateSignaledClose fires.
 *   3. planNextAction emits a close-confirmation reactive-followup when
 *      candidateSignaledClose=true and closeFired=false.
 *   4. analyzeEquityClarity === "unclear" adds equity-clarification probe
 *      to reactive followups when equity is part of the offer.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  applyCandidateAnswer,
  pickAiMove,
  type NegotiationState,
  type NegotiationBand,
} from "../../server-handlers/_negotiation-kernel";

const BAND: NegotiationBand = {
  initialOffer: 20,
  maxStretch: 28,
  walkAway: 16,
  hasEquity: true,
};

const baseState = (overrides: Partial<NegotiationState> = {}): NegotiationState => ({
  ...initState({ sessionId: "s-item3", role: "swe", company: "acme", band: BAND }),
  ...overrides,
});

describe("ITEM 3 — detectTrialCloseAsked wiring in applyCandidateAnswer", () => {
  it("sets candidateSignaledClose=true when bot last said a trial-close phrase and candidate replies", () => {
    /* Bot ran a trial-close last turn. Candidate replies positively. */
    const state = baseState({
      phase: "counter-offer",
      highestOfferMade: 22,
      lastAiText: "If we land at ₹22 LPA, would you accept this offer today?",
    });
    const next = applyCandidateAnswer(state, "Yes, that works for me.");
    expect((next as NegotiationState & { candidateSignaledClose?: boolean }).candidateSignaledClose).toBe(true);
  });

  it("pushes 'candidate-trial-close' onto reactiveFollowupsFired when trial-close fires", () => {
    const state = baseState({
      phase: "counter-offer",
      highestOfferMade: 22,
      lastAiText: "Would you accept this offer today?",
    });
    const next = applyCandidateAnswer(state, "Sounds good, I accept.");
    const fired = (next as NegotiationState & { reactiveFollowupsFired?: string[] }).reactiveFollowupsFired ?? [];
    expect(fired).toContain("candidate-trial-close");
  });

  it("does NOT set candidateSignaledClose when bot did NOT ask a trial-close", () => {
    const state = baseState({
      phase: "counter-offer",
      highestOfferMade: 22,
      lastAiText: "We can stretch to ₹22 LPA. How does that land?",
    });
    const next = applyCandidateAnswer(state, "Yes, that works for me.");
    /* candidateSignaledClose should be absent or false */
    const signaled = (next as NegotiationState & { candidateSignaledClose?: boolean }).candidateSignaledClose;
    expect(!signaled).toBe(true);
  });
});

describe("ITEM 3 — planNextAction: close-confirmation when candidateSignaledClose=true", () => {
  it("S73-B1: pickAiMove fires counter-base (NOT close-acceptance) when candidateSignaledClose=true", () => {
    /* S73-B1 (2026-07-25) — candidateSignaledClose previously fired close-acceptance
     * immediately, which stamped phase=accepted before the candidate could confirm.
     * The fix: emit counter-base at the candidate's ask so the recruiter says
     * "₹22L — confirmed?" and the candidate gets one more turn to explicitly say yes. */
    const state = baseState({
      phase: "counter-offer",
      highestOfferMade: 22,
      candidateTarget: 22,
      lastAiText: "If we land at ₹22 LPA, would you accept this offer today?",
    } as Partial<NegotiationState> & { candidateSignaledClose?: boolean });

    const stateWithSignal = {
      ...state,
      candidateSignaledClose: true,
      reactiveFollowupsFired: ["candidate-trial-close"],
    } as NegotiationState & { candidateSignaledClose?: boolean };

    const move = pickAiMove(stateWithSignal as NegotiationState);
    expect(move.lever).toBe("counter-base");
    expect(move.lever).not.toBe("close-acceptance");
    expect(move.newTotalLpa).toBeGreaterThanOrEqual(22);
  });
});

describe("ITEM 3 — analyzeEquityClarity probe wiring", () => {
  it("equity-clarification probe fires when candidate has confirmed equity AND bot reply is unclear", () => {
    /* PDF#33 (2026-05-18) — equity-clarity gate flipped from
     * `equityExists !== false` to `equityExists === true`. The probe
     * now requires the candidate to have explicitly confirmed equity
     * in their current package — otherwise we risk narrating vesting
     * details to a cash-only candidate (Meesho Sr PD T7 repro). This
     * test pins the new positive-path behavior. */
    const state = baseState({
      phase: "counter-offer",
      highestOfferMade: 22,
      lastAiText: "We can offer some equity for senior roles.",
      equityVesting: {
        vestingYears: null,
        cliffMonths: null,
        preference: null,
        familiarity: null,
        strikePriceDiscussed: false,
        valuationDiscussed: false,
        liquidityDiscussed: false,
        equityExists: true,
        hasAny: true,
      },
    });
    const next = applyCandidateAnswer(state, "What does the equity look like?");
    const fired = (next as NegotiationState & { reactiveFollowupsFired?: string[] }).reactiveFollowupsFired ?? [];
    const move = pickAiMove(next);
    const equityProbeTriggered =
      fired.includes("equity-clarity") ||
      (move.lever === "probe" && (move.rationale ?? "").toLowerCase().includes("equity")) ||
      move.lever === "equity-grant";
    expect(equityProbeTriggered).toBe(true);
  });
});
