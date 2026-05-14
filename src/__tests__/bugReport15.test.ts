/* Bug-report 15 (2026-05-14) — four converging defects surfaced in a
 * Business-Analyst @ Deloitte session:
 *
 *   A. Opener Structure C said "that's at the midpoint of our band
 *      for this city" — real HR never reveals internal band positioning.
 *   B. Candidate said "I was looking at ₹18 LPA" against an initial
 *      offer of ~₹15L; kernel jumped straight to counter-base ₹15.7L
 *      without first asking what was driving the ₹18L ask.
 *   C. The counter response emitted a headline total only, no base +
 *      variable split — forcing the candidate to ask for the breakdown
 *      on the next turn.
 *   D. The candidate then asked for total CTC / base + total / and
 *      finally said "Would like to accept this offer" — kernel emitted
 *      the SAME generic "75-85% base, rest variable" string for all
 *      three turns. Two compounding issues:
 *        D1. The acceptance-classifier required a leading "I" ("I would
 *            like to accept") — voice transcription drops it.
 *        D2. The compensation-summary fallback returned a generic
 *            structure tutorial regardless of whether real numbers
 *            were available on the state.
 *
 * This suite pins each fix as a structural guarantee so the same class
 * of regression can't reappear silently. */
import { describe, it, expect } from "vitest";
import { classifyAcceptance } from "../../server-handlers/_acceptance-classifier";
import { deterministicFallbackText } from "../../server-handlers/_negotiate-turn-helpers";
import type { NegotiationState, AiMove } from "../../server-handlers/_negotiation-kernel";

/* Minimal state factory — only fields read by deterministicFallbackText
 * + the move-picker tests below need to be present. Cast through unknown
 * to keep the fixture compact (the kernel's full state is ~400 fields). */
function makeState(over: Partial<NegotiationState> = {}): NegotiationState {
  const base = {
    sessionId: "test",
    role: "Business Analyst",
    company: "Deloitte",
    band: {
      initialOffer: 15,
      maxStretch: 20,
      walkAway: 12,
      hasEquity: false,
      baseFloor: 9,
      baseStretch: 13,
      variableMax: 7,
    },
    phase: "counter-offer",
    turnIndex: 2,
    highestOfferMade: 15,
    candidateTarget: 18,
    candidateCurrentCtc: null,
    lastJoiningBonusOffered: null,
    leversUsed: ["open-with-offer"],
    competingOfferDetail: { company: null, status: null, stage: null, letterShareOffered: false, onHold: false, hasAny: false },
    infoAsked: [],
    marketMode: "neutral",
    hardBandCap: false,
    walkAwayReturned: false,
    candidateAskedAsRange: false,
    vossTacticsUsed: [],
    recentRecoveryActive: false,
    lastCandidateCounterLpa: null,
    verbalAcceptanceTurn: null,
    postVerbalRenegotiationCount: 0,
    acceptedAtTurn: null,
    walkedAwayAtTurn: null,
    ...over,
  } as unknown as NegotiationState;
  return base;
}

/* ─── Fix D1 — acceptance regex tolerates dropped "I" ───────────────── */

describe("Bug-report 15 — Fix D1 — acceptance without leading 'I'", () => {
  const ctx = { phase: "counter-offer", offerOnTable: true };

  it("'Would like to accept this offer.' accepts (was missed before)", () => {
    const r = classifyAcceptance("Would like to accept this offer.", ctx);
    expect(r.accepted).toBe(true);
    expect(r.confidence).toBe("strong");
  });

  it("'Want to accept the package.' accepts", () => {
    const r = classifyAcceptance("Want to accept the package.", ctx);
    expect(r.accepted).toBe(true);
  });

  it("'Like to accept this offer.' accepts", () => {
    const r = classifyAcceptance("Like to accept this offer.", ctx);
    expect(r.accepted).toBe(true);
  });

  it("legacy 'I would like to accept' still accepts", () => {
    const r = classifyAcceptance("I would like to accept your offer.", ctx);
    expect(r.accepted).toBe(true);
    expect(r.confidence).toBe("strong");
  });

  it("does NOT false-positive on 'I'd never want to accept that.'", () => {
    /* Negation pattern should veto. */
    const r = classifyAcceptance("I would never want to accept that.", ctx);
    expect(r.accepted).toBe(false);
  });
});

/* ─── Fix C — counter-base fallback emits base+variable split ───────── */

describe("Bug-report 15 — Fix C — counter-base surfaces component split", () => {
  it("counter at ₹16.5L emits '₹13L base + ₹3.5L variable'", () => {
    const state = makeState();
    const move: AiMove = {
      lever: "counter-base",
      newTotalLpa: 16.5,
      rationale: "test",
    };
    const text = deterministicFallbackText(state, move);
    expect(text).toMatch(/₹16\.5 LPA/);
    expect(text).toMatch(/₹13L base/);
    expect(text).toMatch(/variable/);
  });

  it("counter restates any previously-offered joining bonus", () => {
    const state = makeState({ lastJoiningBonusOffered: 2 });
    const move: AiMove = { lever: "counter-base", newTotalLpa: 17, rationale: "test" };
    const text = deterministicFallbackText(state, move);
    expect(text).toMatch(/₹2L joining bonus/);
  });

  it("legacy band without component metadata falls back to headline-only", () => {
    const state = makeState({
      band: { initialOffer: 15, maxStretch: 20, walkAway: 12, hasEquity: false } as NegotiationState["band"],
    });
    const move: AiMove = { lever: "counter-base", newTotalLpa: 17, rationale: "test" };
    const text = deterministicFallbackText(state, move);
    expect(text).toMatch(/₹17 LPA total/);
    expect(text).not.toMatch(/base \+ /);
  });
});

/* ─── Fix D2 — compensation-summary emits real numbers ──────────────── */

describe("Bug-report 15 — Fix D2 — compensation-summary leads with actual numbers", () => {
  it("with offer + component metadata, returns base/variable breakdown of THIS offer", () => {
    const state = makeState({ highestOfferMade: 15.7 });
    const move: AiMove = { lever: "compensation-summary", newTotalLpa: 15.7, rationale: "test" };
    const text = deterministicFallbackText(state, move);
    /* Must contain actual numbers, NOT the generic-only tutorial. */
    expect(text).toMatch(/₹13L base/);
    expect(text).toMatch(/₹15\.7 LPA/);
  });

  it("with offer + JB, includes year-one cash calculation", () => {
    const state = makeState({ highestOfferMade: 15, lastJoiningBonusOffered: 1 });
    const move: AiMove = { lever: "compensation-summary", newTotalLpa: 15, rationale: "test" };
    const text = deterministicFallbackText(state, move);
    expect(text).toMatch(/₹1L one-time joining bonus/);
    expect(text).toMatch(/year-one cash/i);
  });

  it("without any offer (pre-open), keeps the generic structure tutorial", () => {
    const state = makeState({ highestOfferMade: 0 });
    const move: AiMove = { lever: "compensation-summary", newTotalLpa: null, rationale: "test" };
    const text = deterministicFallbackText(state, move);
    expect(text).toMatch(/Typical structure here is base/);
  });
});

/* ─── Fix #2 (follow-up) — lever-loop guard ─────────────────────────── */

import { pickAiMove } from "../../server-handlers/_kernel-move-picker";

describe("Bug-report 15 follow-up — lever-loop guard breaks 3rd-strike repeats", () => {
  it("third compensation-summary in a row force-routes to hold-firm", () => {
    const state = makeState({
      phase: "lever-explore" as NegotiationState["phase"],
      highestOfferMade: 15.7,
      leversUsed: ["open-with-offer", "counter-base", "compensation-summary", "compensation-summary"],
      infoAsked: ["compensation-breakdown"],
    });
    const move = pickAiMove(state);
    expect(move.lever).toBe("hold-firm");
    expect(move.newTotalLpa).toBe(15.7);
  });

  it("third benefits-summary in a row also force-routes to hold-firm", () => {
    const state = makeState({
      phase: "lever-explore" as NegotiationState["phase"],
      highestOfferMade: 15,
      leversUsed: ["open-with-offer", "benefits-summary", "benefits-summary"],
      infoAsked: ["benefits-overview"],
    });
    const move = pickAiMove(state);
    expect(move.lever).toBe("hold-firm");
  });

  it("only TWO consecutive info-lever fires does NOT trigger the guard", () => {
    /* Two-in-a-row is fine; the guard kicks in only on the 3rd-strike
     * (i.e. last two leversUsed are the same info lever AND we're about
     * to fire it again). */
    const state = makeState({
      phase: "lever-explore" as NegotiationState["phase"],
      highestOfferMade: 15,
      leversUsed: ["open-with-offer", "compensation-summary"],
      infoAsked: ["compensation-breakdown"],
    });
    const move = pickAiMove(state);
    expect(move.lever).toBe("compensation-summary");
  });

  it("two non-info lever repeats (e.g. counter-base twice) does NOT trip the guard", () => {
    /* The guard targets info-disclosure levers that produce identical
     * boilerplate; counter-base has built-in variation via the split
     * schedule, so a counter-base repeat is legitimate kernel behavior. */
    const state = makeState({
      phase: "counter-offer" as NegotiationState["phase"],
      highestOfferMade: 16,
      candidateTarget: 20,
      leversUsed: ["open-with-offer", "probe-justification", "counter-base", "counter-base"],
    });
    const move = pickAiMove(state);
    /* Should still be counter-base (or lever-explore if no headroom) —
     * NOT hold-firm-by-guard. */
    expect(move.lever).not.toBe("hold-firm");
  });

  it("guard does NOT fire in terminal phases (preserves close-acceptance, etc.)", () => {
    const state = makeState({
      phase: "accepted" as NegotiationState["phase"],
      highestOfferMade: 16,
      acceptedAtTurn: 5,
      turnIndex: 5,
      leversUsed: ["open-with-offer", "counter-base", "compensation-summary", "compensation-summary"],
    });
    const move = pickAiMove(state);
    /* Terminal path runs first; guard never sees this state. */
    expect(move.lever).toBe("close-acceptance");
  });
});

/* ─── Fix B — probe-justification fallback shape ────────────────────── */

describe("Bug-report 15 — Fix B — probe-justification fallback asks 'why?'", () => {
  it("references the candidate's target number and asks for the driver", () => {
    const state = makeState({ candidateTarget: 18 });
    const move: AiMove = { lever: "probe-justification", newTotalLpa: null, rationale: "test" };
    const text = deterministicFallbackText(state, move);
    expect(text).toMatch(/₹18 LPA/);
    expect(text).toMatch(/benchmark|competing|hike/i);
    expect(text).toMatch(/\?$/);
  });

  it("works without a target on state (degenerate path)", () => {
    const state = makeState({ candidateTarget: null });
    const move: AiMove = { lever: "probe-justification", newTotalLpa: null, rationale: "test" };
    const text = deterministicFallbackText(state, move);
    expect(text).toMatch(/\?$/);
    expect(text).toMatch(/benchmark|competing|hike/i);
  });
});
