/* Tests for the salary-negotiation canonical state kernel.
 * ─────────────────────────────────────────────────────────────────────
 * The kernel is pure — no LLM, no IO, no clock — so the test surface
 * is dense and deterministic. Each test pins one behaviour we expect
 * the legacy architecture's bug class to no longer have a place to
 * live.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  parseCandidateAnswer,
  applyCandidateAnswer,
  foldFactsIntoState,
  derivePhase,
  pickAiMove,
  applyAiMove,
  findOutOfBandNumber,
  isVerbatimRepeat,
  serializeState,
  deserializeState,
  isTerminalPhase,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import type { NegotiationFacts } from "../interviewEvaluation";

const BAND: NegotiationBand = { initialOffer: 20, maxStretch: 28, walkAway: 16, hasEquity: true };
const init = (overrides: Partial<NegotiationState> = {}): NegotiationState => ({
  ...initState({ sessionId: "s1", role: "swe", company: "acme", band: BAND }),
  ...overrides,
});

/* ─── parseCandidateAnswer ─────────────────────────────────────── */

describe("parseCandidateAnswer", () => {
  it("binds explicit target", () => {
    const p = parseCandidateAnswer("I'm looking for around 25 LPA.");
    expect(p.target).toBe(25);
    expect(p.currentCtc).toBeNull();
  });

  it("binds 'my current package is X' to currentCtc, NOT target", () => {
    /* The Bombay Design Centre regression. */
    const p = parseCandidateAnswer("It's on current package progression because my current package is around 8.5 LPA.");
    expect(p.currentCtc).toBe(8.5);
    expect(p.target).toBeNull();
  });

  it("binds 'currently earning X' to currentCtc", () => {
    const p = parseCandidateAnswer("I'm currently earning 18 LPA at my current company.");
    expect(p.currentCtc).toBe(18);
    expect(p.target).toBeNull();
  });

  it("binds 'in-hand offer of X' to competing, NOT target", () => {
    const p = parseCandidateAnswer("I already have an offer of 24 LPA in hand.");
    expect(p.competing).toBe(24);
    expect(p.target).toBeNull();
  });

  it("disambiguates when same number could match multiple categories", () => {
    /* Mentioning current 18 AND wanting 18 shouldn't double-bind. */
    const p = parseCandidateAnswer("I'm currently at 18 LPA and I'd like 18 LPA in the new role too.");
    expect(p.currentCtc).toBe(18);
    expect(p.target).toBeNull();
  });

  it("detects acceptance", () => {
    expect(parseCandidateAnswer("I accept the offer.").signalsAcceptance).toBe(true);
    expect(parseCandidateAnswer("Sounds good, let's go ahead.").signalsAcceptance).toBe(true);
  });

  it("rejects conditional acceptance", () => {
    expect(parseCandidateAnswer("I accept if you can add a joining bonus.").signalsAcceptance).toBe(false);
  });

  it("rejects 'I accept but I want more' as negotiation", () => {
    expect(parseCandidateAnswer("I'd accept but I want a bit more on base.").signalsAcceptance).toBe(false);
  });

  it("detects walk-away", () => {
    expect(parseCandidateAnswer("I'm going to have to pass.").signalsWalkAway).toBe(true);
    expect(parseCandidateAnswer("This won't work, I'll walk away.").signalsWalkAway).toBe(true);
  });

  it("handles empty input safely", () => {
    expect(parseCandidateAnswer("")).toEqual({
      target: null, currentCtc: null, competing: null,
      signalsAcceptance: false, signalsWalkAway: false,
    });
  });
});

/* ─── applyCandidateAnswer ────────────────────────────────────── */

describe("applyCandidateAnswer", () => {
  it("folds target into state and advances phase", () => {
    /* Need an offer made for counter-offer phase. */
    let s = init({ highestOfferMade: 20, phase: "offer-presented" });
    s = applyCandidateAnswer(s, "I'm looking for 26 LPA.");
    expect(s.candidateTarget).toBe(26);
    expect(s.phase).toBe("counter-offer");
  });

  it("does NOT bind current-package number to target", () => {
    let s = init({ highestOfferMade: 20, phase: "offer-presented" });
    s = applyCandidateAnswer(s, "My current package is around 18 LPA, that's my baseline.");
    expect(s.candidateCurrentCtc).toBe(18);
    expect(s.candidateTarget).toBeNull();
    expect(s.phase).toBe("probe-expectations");
  });

  it("transitions to accepted on acceptance signal", () => {
    let s = init({ highestOfferMade: 22, phase: "counter-offer" });
    s = applyCandidateAnswer(s, "OK, I accept.");
    expect(s.phase).toBe("accepted");
    expect(s.acceptedAtTurn).toBe(0);
  });

  it("transitions to walked-away on walk-away signal", () => {
    let s = init({ highestOfferMade: 22, phase: "counter-offer" });
    s = applyCandidateAnswer(s, "I'll have to pass on this one.");
    expect(s.phase).toBe("walked-away");
    expect(s.walkedAwayAtTurn).toBe(0);
  });

  it("terminal phases are sticky", () => {
    let s = init({ phase: "accepted", acceptedAtTurn: 3 });
    s = applyCandidateAnswer(s, "Actually let me reconsider, I want 30 LPA.");
    expect(s.phase).toBe("accepted");
    expect(s.candidateTarget).toBeNull();
  });

  it("does not mutate input state", () => {
    const s1 = init({ highestOfferMade: 20, phase: "offer-presented" });
    const s2 = applyCandidateAnswer(s1, "I want 25 LPA.");
    expect(s1.candidateTarget).toBeNull();
    expect(s2.candidateTarget).toBe(25);
  });

  it("revised target overwrites earlier target", () => {
    let s = init({ highestOfferMade: 20, phase: "offer-presented", candidateTarget: 30 });
    s = applyCandidateAnswer(s, "OK, I'd settle for 25 LPA actually.");
    expect(s.candidateTarget).toBe(25);
  });
});

/* ─── derivePhase ─────────────────────────────────────────────── */

describe("derivePhase", () => {
  it("opening when no offer made", () => {
    expect(derivePhase(init())).toBe("opening");
  });

  it("offer-presented when offer made, no candidate target", () => {
    expect(derivePhase(init({ highestOfferMade: 20 }))).toBe("offer-presented");
  });

  it("counter-offer when both offer and target exist", () => {
    expect(derivePhase(init({ highestOfferMade: 20, candidateTarget: 25 }))).toBe("counter-offer");
  });

  it("lever-explore when target above maxStretch and 2+ levers used", () => {
    expect(derivePhase(init({
      highestOfferMade: 28, candidateTarget: 35,
      leversUsed: ["open-with-offer", "counter-base"],
    }))).toBe("lever-explore");
  });

  it("stalemate when turn cap reached", () => {
    expect(derivePhase(init({ turnIndex: 8, maxTurns: 8 }))).toBe("stalemate");
  });

  it("terminal phases pass through unchanged", () => {
    expect(derivePhase(init({ phase: "accepted" }))).toBe("accepted");
    expect(derivePhase(init({ phase: "walked-away" }))).toBe("walked-away");
  });
});

/* ─── pickAiMove ──────────────────────────────────────────────── */

describe("pickAiMove", () => {
  it("opening → open-with-offer at band initial", () => {
    const m = pickAiMove(init());
    expect(m.lever).toBe("open-with-offer");
    expect(m.newTotalLpa).toBe(20);
  });

  it("offer-presented (no target) → probe", () => {
    const m = pickAiMove(init({ phase: "offer-presented", highestOfferMade: 20 }));
    expect(m.lever).toBe("probe");
    expect(m.newTotalLpa).toBeNull();
  });

  it("counter-offer splits floor → aspiration", () => {
    /* floor=20, target=26, ceiling=28 → split = 20 + (26-20)*0.5 = 23 */
    const m = pickAiMove(init({ phase: "counter-offer", highestOfferMade: 20, candidateTarget: 26 }));
    expect(m.lever).toBe("counter-base");
    expect(m.newTotalLpa).toBe(23);
  });

  it("counter-offer caps at maxStretch when target above ceiling", () => {
    /* target=40, ceiling=28 → aspiration=28, split = 20 + (28-20)*0.5 = 24 */
    const m = pickAiMove(init({ phase: "counter-offer", highestOfferMade: 20, candidateTarget: 40 }));
    expect(m.newTotalLpa).toBe(24);
  });

  it("counter-offer rotates to lever-explore when no headroom", () => {
    /* floor=28, target=30, ceiling=28 → aspiration=28, no headroom */
    const m = pickAiMove(init({
      phase: "counter-offer", highestOfferMade: 28, candidateTarget: 30,
    }));
    expect(m.lever).toBe("joining-bonus");
  });

  it("lever-explore: joining-bonus → equity → notice-buyout → benefits → hold-firm", () => {
    let state = init({ phase: "lever-explore", highestOfferMade: 28, candidateTarget: 35 });
    expect(pickAiMove(state).lever).toBe("joining-bonus");

    state = { ...state, leversUsed: ["joining-bonus"] };
    expect(pickAiMove(state).lever).toBe("equity-grant");

    state = { ...state, leversUsed: ["joining-bonus", "equity-grant"] };
    expect(pickAiMove(state).lever).toBe("notice-buyout");

    state = { ...state, leversUsed: ["joining-bonus", "equity-grant", "notice-buyout"] };
    expect(pickAiMove(state).lever).toBe("benefits-summary");

    state = { ...state, leversUsed: ["joining-bonus", "equity-grant", "notice-buyout", "benefits-summary"] };
    expect(pickAiMove(state).lever).toBe("hold-firm");
  });

  it("lever-explore skips equity-grant when band has no equity", () => {
    const noEquityBand = { ...BAND, hasEquity: false };
    const state: NegotiationState = {
      ...init({ phase: "lever-explore", highestOfferMade: 28, candidateTarget: 35, leversUsed: ["joining-bonus"] }),
      band: noEquityBand,
    };
    expect(pickAiMove(state).lever).toBe("notice-buyout");
  });

  it("accepted → close-acceptance with highest offer", () => {
    const m = pickAiMove(init({ phase: "accepted", highestOfferMade: 24 }));
    expect(m.lever).toBe("close-acceptance");
    expect(m.newTotalLpa).toBe(24);
  });

  it("walked-away → close-walkaway, no number", () => {
    const m = pickAiMove(init({ phase: "walked-away" }));
    expect(m.lever).toBe("close-walkaway");
    expect(m.newTotalLpa).toBeNull();
  });

  it("stalemate → close-stalemate", () => {
    const m = pickAiMove(init({ phase: "stalemate", highestOfferMade: 22 }));
    expect(m.lever).toBe("close-stalemate");
    expect(m.newTotalLpa).toBe(22);
  });
});

/* ─── applyAiMove ─────────────────────────────────────────────── */

describe("applyAiMove", () => {
  it("increments turn, appends lever, updates highestOfferMade", () => {
    let s = init();
    s = applyAiMove(s, { lever: "open-with-offer", newTotalLpa: 20, rationale: "" }, "Here's our offer: ₹20 LPA");
    expect(s.turnIndex).toBe(1);
    expect(s.leversUsed).toEqual(["open-with-offer"]);
    expect(s.highestOfferMade).toBe(20);
    expect(s.lastAiText).toContain("₹20 LPA");
  });

  it("doesn't lower highestOfferMade when new move is smaller", () => {
    let s = init({ highestOfferMade: 24 });
    s = applyAiMove(s, { lever: "hold-firm", newTotalLpa: 22, rationale: "" }, "Holding at our line.");
    expect(s.highestOfferMade).toBe(24);
  });

  it("preserves terminal phase across AI move", () => {
    let s = init({ phase: "accepted", acceptedAtTurn: 2 });
    s = applyAiMove(s, { lever: "close-acceptance", newTotalLpa: 22, rationale: "" }, "Welcome aboard.");
    expect(s.phase).toBe("accepted");
  });
});

/* ─── foldFactsIntoState ──────────────────────────────────────── */

describe("foldFactsIntoState", () => {
  const blankFacts: NegotiationFacts = {
    acceptedImmediately: false,
    rejectedOutright: false,
    candidateCounter: null,
    candidateAskTotal: null,
    candidateAskBase: null,
    candidateCurrentCTC: null,
    hasCompetingOffers: false,
    competingOfferAmount: null,
    topicsRaised: [],
    deflectedNumbers: false,
    askedForTime: false,
    usedTacticalSilence: false,
    mentionedBATNA: false,
    expressedSurprise: false,
  };

  it("imports candidateCounter as target", () => {
    const s = foldFactsIntoState(init(), { ...blankFacts, candidateCounter: "₹26 LPA" });
    expect(s.candidateTarget).toBe(26);
  });

  it("imports current CTC and competing separately", () => {
    const s = foldFactsIntoState(init(), {
      ...blankFacts,
      candidateCurrentCTC: "₹18 LPA",
      competingOfferAmount: "₹24 LPA",
    });
    expect(s.candidateCurrentCtc).toBe(18);
    expect(s.competingOffer).toBe(24);
  });

  it("acceptance flag transitions to terminal", () => {
    const s = foldFactsIntoState(init({ turnIndex: 4 }), { ...blankFacts, acceptedImmediately: true });
    expect(s.phase).toBe("accepted");
    expect(s.acceptedAtTurn).toBe(4);
  });
});

/* ─── findOutOfBandNumber ──────────────────────────────────────── */

describe("findOutOfBandNumber", () => {
  it("returns null when in-band", () => {
    expect(findOutOfBandNumber("Let me come back to you at ₹22 LPA total.", BAND)).toBeNull();
  });

  it("flags number above maxStretch", () => {
    expect(findOutOfBandNumber("I can go to ₹40 LPA on this.", BAND)).toBe(40);
  });

  it("flags number below walkAway", () => {
    expect(findOutOfBandNumber("Our floor is ₹10 LPA.", BAND)).toBe(10);
  });
});

/* ─── isVerbatimRepeat ─────────────────────────────────────────── */

describe("isVerbatimRepeat", () => {
  it("flags exact prefix match", () => {
    const s = init({
      lastAiText: "I appreciate you sharing that. What's most important to you in this package — is it the base number, the overall CTC, or are there specific benefits?",
    });
    const repeat = "I appreciate you sharing that. What's most important to you in this package — is it the base number, the overall CTC, or specific benefits that would move the needle?";
    expect(isVerbatimRepeat(repeat, s)).toBe(true);
  });

  it("doesn't flag genuinely different texts", () => {
    const s = init({ lastAiText: "Let me see what I can do on base." });
    expect(isVerbatimRepeat("How does the equity component look to you?", s)).toBe(false);
  });

  it("doesn't flag when no prior turn", () => {
    expect(isVerbatimRepeat("Anything goes here.", init())).toBe(false);
  });
});

/* ─── End-to-end integration: a full negotiation arc ───────────── */

describe("integration: full arc", () => {
  it("opening → offer → probe → counter → accept", () => {
    let state = init();

    /* T1: AI opens. */
    let move = pickAiMove(state);
    expect(move.lever).toBe("open-with-offer");
    state = applyAiMove(state, move, `Our offer is ₹${move.newTotalLpa} LPA.`);
    expect(state.phase).toBe("offer-presented");

    /* Candidate: I want 26. */
    state = applyCandidateAnswer(state, "I was hoping for around 26 LPA.");
    expect(state.candidateTarget).toBe(26);
    expect(state.phase).toBe("counter-offer");

    /* T2: AI counters. */
    move = pickAiMove(state);
    expect(move.lever).toBe("counter-base");
    expect(move.newTotalLpa).toBe(23);
    state = applyAiMove(state, move, `Let me stretch to ₹${move.newTotalLpa} LPA.`);
    expect(state.highestOfferMade).toBe(23);

    /* Candidate: accepts. */
    state = applyCandidateAnswer(state, "OK, I accept.");
    expect(state.phase).toBe("accepted");

    /* T3: AI closes. */
    move = pickAiMove(state);
    expect(move.lever).toBe("close-acceptance");
    expect(isTerminalPhase(state.phase)).toBe(true);
  });

  it("Bombay Design Centre regression scenario reaches sane state", () => {
    /* Initial offer 7.1, candidate states target 10, then mentions
       current package 8.5 — the legacy bug switched target to 8.5.
       The kernel must keep target=10 across both turns. */
    let state = init({ band: { initialOffer: 7.1, maxStretch: 9, walkAway: 5, hasEquity: false } });
    state = applyAiMove(state, pickAiMove(state), "Offer of ₹7.1 LPA.");
    state = applyCandidateAnswer(state, "I was hoping for around 10 LPA actually.");
    expect(state.candidateTarget).toBe(10);

    state = applyCandidateAnswer(state, "It's on current package progression because my current package is around 8.5 LPA.");
    expect(state.candidateCurrentCtc).toBe(8.5);
    /* The crucial assertion: target must NOT have been displaced. */
    expect(state.candidateTarget).toBe(10);
  });

  it("turn budget exhaustion → stalemate", () => {
    let state = init({ maxTurns: 3 });
    /* 3 AI turns consumed. */
    for (let i = 0; i < 3; i++) {
      state = applyAiMove(state, pickAiMove(state), `turn ${i}`);
    }
    expect(state.turnIndex).toBe(3);
    /* Next derive picks stalemate. */
    expect(derivePhase(state)).toBe("stalemate");
  });
});

/* ─── Serialization round-trip ─────────────────────────────────── */

describe("serialize/deserialize", () => {
  it("round-trips a non-trivial state", () => {
    const s = init({
      phase: "counter-offer",
      turnIndex: 3,
      candidateTarget: 26,
      candidateCurrentCtc: 18,
      highestOfferMade: 22,
      leversUsed: ["open-with-offer", "probe", "counter-base"],
      lastAiText: "Where I'd land that: bump base...",
    });
    const round = deserializeState(serializeState(s));
    expect(round).toEqual(s);
  });
});
