/* F1 (live-staging, 2026-06-18) — open-phrasing salary push must drive
 * the concession / lever engine, never the generic candidate-question
 * filler.
 *
 * Live symptom (reproduced twice on staging): a candidate pushing for
 * cash with an OPEN phrasing that carries no fresh number —
 *   • total-target band {28,40}, target 36, offer on table → "Can you
 *     move closer to 36?"  (should COUNTER toward 36)
 *   • aggressive band {28.4,38.8}, target 55 (out-of-band) → "Fine, what
 *     can you actually do?"  (should HOLD FIRM with a reason)
 * set `askedQuestion` but no `lastCandidateCounterLpa`, so the planner's
 * `planReactiveFollowup` answer-direct branch pre-empted the counter-
 * offer engine and shipped the content-free "Coming back to the
 * structure — … let me come back to where we were." deflection.
 *
 * Structural fix: `isSalaryPush` (in _question-router.ts) is consulted
 * as a sibling skip to the numeric `liveCounterPending` gate, so a push
 * against a standing offer defers answer-direct and the negotiation
 * engine owns the turn. These tests lock the END-TO-END behavior at the
 * planner level (kernel-derived state → planNextAction action kind).
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  pickAiMove,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import { planNextAction } from "../../server-handlers/_next-action-planner";

/* Build a realistic mid-negotiation state at counter-offer phase with an
 * offer already on the table and the candidate's latest utterance being a
 * salary push. We seed conversationLog (the planner reads the latest
 * candidate utterance from it) and lastTurnDelta.askedQuestion (the push
 * is phrased as a question), mirroring what applyCandidateAnswer folds. */
function pushState(
  band: NegotiationBand,
  pushText: string,
  overrides: Partial<NegotiationState> = {},
): NegotiationState {
  const base = initState({ sessionId: "f1", role: "Software Engineer", company: "Acme", band });
  return {
    ...base,
    phase: "counter-offer",
    turnIndex: 5,
    highestOfferMade: band.initialOffer + 2,
    conversationLog: [
      { speaker: "candidate", text: pushText },
    ],
    lastTurnDelta: {
      ...(base.lastTurnDelta ?? {}),
      askedQuestion: true,
    } as NegotiationState["lastTurnDelta"],
    ...overrides,
  };
}

function isFiller(kind: string): boolean {
  // The generic candidate-question deflection ships as answer-direct or
  // reactive-followup with the "answer-direct" topic.
  return kind === "answer-direct" || kind === "reactive-followup";
}

describe("salary push does not ship the generic candidate-question filler", () => {
  it("in-band target + headroom → counters (counter-base), not filler", () => {
    const band: NegotiationBand = { initialOffer: 28, maxStretch: 40, walkAway: 22, hasEquity: true };
    const s = pushState(band, "Can you move closer to 36?", {
      candidateTarget: 36,
      candidateCurrentCtc: 28,
      highestOfferMade: 35,
    });
    const action = planNextAction(s);
    expect(isFiller(action.kind)).toBe(false);
    // The concession engine should own the turn — a cash counter with
    // headroom remaining toward the 36 target (bounded by the band).
    const move = pickAiMove(s);
    expect(move.lever).toBe("counter-base");
    expect(move.newTotalLpa as number).toBeGreaterThan(35);
  });

  it("out-of-band target → holds firm with a reason, not filler", () => {
    const band: NegotiationBand = { initialOffer: 28.4, maxStretch: 38.8, walkAway: 23, hasEquity: true };
    const s = pushState(band, "Fine, what can you actually do?", {
      candidateTarget: 55, // out-of-band
      candidateCurrentCtc: 30,
      highestOfferMade: 36,
    });
    const action = planNextAction(s);
    expect(isFiller(action.kind)).toBe(false);
    // Whatever the engine chooses (hold-firm defense / lever-explore /
    // a bounded counter), it must be a negotiation move, never the
    // content-free candidate-question deflection.
    const move = pickAiMove(s);
    expect(move.lever).not.toBe("probe");
  });
});

/* Structural invariant (2026-06-18) — the prior fix detected salary
 * pushes via a regex (`isSalaryPush`) and skipped the filler for matches;
 * any phrasing the regex missed re-broke. The structural replacement
 * gates the filler on a single fact — `highestOfferMade > 0` — so it is
 * phrasing-INDEPENDENT: over a standing offer the content-free deflection
 * can never ship, no matter how the candidate words the turn. These tests
 * deliberately use utterances NO push regex would catch, to prove the
 * invariant holds without enumeration. The third test guards the inverse:
 * pre-offer (no negotiation to advance yet) the acknowledgement is still
 * legitimate, so the gate must NOT over-fire and swallow the opening. */
describe("standing-offer invariant: filler forbidden once an offer is on the table (phrasing-independent)", () => {
  const band: NegotiationBand = { initialOffer: 28, maxStretch: 40, walkAway: 22, hasEquity: true };

  it("defers a novel push no regex would match → negotiation move, not filler", () => {
    const s = pushState(band, "So where does that leave us?", {
      candidateTarget: 36,
      candidateCurrentCtc: 28,
      highestOfferMade: 35,
    });
    expect(isFiller(planNextAction(s).kind)).toBe(false);
    expect(pickAiMove(s).lever).not.toBe("probe");
  });

  it("engages a non-topical open-direct question over a standing offer (never deflects)", () => {
    // "confirm by Friday" routes to open-direct — NOT a curated topic and
    // NOT a wired-profile topic — so pre-fix it fell straight to the
    // content-free filler. Over a standing offer that deflection is now
    // forbidden; the engine owns the turn (in production the LLM prose can
    // still address the timeline question while negotiating).
    const s = pushState(band, "Can you confirm that by Friday?", {
      candidateTarget: 36,
      candidateCurrentCtc: 28,
      highestOfferMade: 35,
    });
    expect(isFiller(planNextAction(s).kind)).toBe(false);
  });

  it("STILL ships the acknowledgement pre-offer (gate must not over-fire)", () => {
    // Opening, no offer on the table yet → there is genuinely no
    // negotiation move to advance, so the answer-direct acknowledgement
    // remains the correct, legitimate response. The invariant is
    // post-offer only; this proves it doesn't swallow the opening turn.
    const base = initState({ sessionId: "f1b", role: "Software Engineer", company: "Acme", band });
    const s: NegotiationState = {
      ...base,
      phase: "opening",
      turnIndex: 1,
      highestOfferMade: 0,
      conversationLog: [{ speaker: "candidate", text: "So where does that leave us?" }],
      lastTurnDelta: {
        ...(base.lastTurnDelta ?? {}),
        askedQuestion: true,
      } as NegotiationState["lastTurnDelta"],
    };
    expect(isFiller(planNextAction(s).kind)).toBe(true);
  });
});
