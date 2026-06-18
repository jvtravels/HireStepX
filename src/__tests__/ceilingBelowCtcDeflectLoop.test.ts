/* Deflect-loop terminator (2026-06-18, live-staging finding).
 *
 * When the server-derived band ceiling sits BELOW the candidate's
 * disclosed current CTC, the honest-defer branch (the AUDIT-W02
 * "don't anchor a pay cut" guard) correctly declines to anchor on the
 * FIRST range-disclosure turn — but it stamps `band-anchor-with-
 * rationale` while putting no number on the table. That flips
 * `anchorAlreadyDisclosed` true while `highestOfferMade` stays 0, so
 * every later range-disclosure turn skips the anchor gate and falls to
 * the bare band-disclosure-deflect. The live symptom: the recruiter
 * repeats "I'll have a firmer number once the panel signs off" forever,
 * never anchors, and (past the min-turns floor) can even walk away on
 * the candidate's own acceptance.
 *
 * The fix puts the honest CEILING number on the table once we've
 * deferred and the candidate has named a figure. These tests lock the
 * invariants: (1) a real number lands (highestOfferMade > 0) within a
 * few range-disclosure turns even when ceiling < CTC, and (2) the bot
 * does NOT terminate in walked-away when the candidate then accepts.
 * The single-turn honest-defer remains owned by
 * clampAnchorAboveDisclosed.belowMaxStretch.test.ts — unchanged here. */
import { describe, it, expect } from "vitest";
import {
  applyCandidateAnswer,
  applyAiMove,
  pickAiMove,
  initState,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import {
  planNextAction,
} from "../../server-handlers/_next-action-planner";
import { renderCanonicalProse } from "../../server-handlers/_canonical-prose";

/* Ceiling (13.8) is below the candidate's disclosed CTC (22–25) — the
 * exact shape that reproduced the live deflect sink. */
const LOW_BAND: NegotiationBand = {
  initialOffer: 10.4,
  maxStretch: 13.8,
  walkAway: 6.6,
  hasEquity: false,
};

function freshState(): NegotiationState {
  return initState({
    sessionId: "s-ceiling-below-ctc",
    role: "swe",
    company: "Acme",
    band: LOW_BAND,
  });
}

/* Faithful mirror of negotiate-turn's fallback path: apply the
 * candidate answer, pick the deterministic move, render canonical prose
 * for that planned action, then apply the AI move. */
function aiTurn(state: NegotiationState): NegotiationState {
  const move = pickAiMove(state);
  const action = planNextAction(state);
  const text = renderCanonicalProse(action, state);
  return applyAiMove(state, move, text);
}

function candidateTurn(state: NegotiationState, answer: string): NegotiationState {
  return applyCandidateAnswer(state, answer);
}

describe("ceiling-below-CTC deflect loop — a real number must land", () => {
  it("puts a concrete number on the table (highestOfferMade > 0) within the loop", () => {
    let s = freshState();

    /* Discovery: disclose CTC + split + notice + target, all above the
     * band ceiling so the honest-defer fires on first disclosure. */
    s = candidateTurn(s, "My current CTC is 24 LPA, fixed 20 and variable 4.");
    s = aiTurn(s);
    s = candidateTurn(s, "Notice period is 60 days, can be bought out.");
    s = aiTurn(s);
    s = candidateTurn(s, "I led the payments platform rewrite end to end last year.");
    s = aiTurn(s);
    s = candidateTurn(s, "I'm targeting around 30 LPA for this move.");
    s = aiTurn(s);

    /* Now the candidate keeps asking for the band. Without the loop
     * terminator the recruiter deflects forever and highestOfferMade
     * stays 0. With it, the honest ceiling lands within a few turns. */
    for (let i = 0; i < 6 && s.highestOfferMade === 0; i++) {
      s = candidateTurn(s, "What's the band for this role? I need a number.");
      s = aiTurn(s);
    }

    expect(s.highestOfferMade).toBeGreaterThan(0);
    expect(s.phase).not.toBe("walked-away");
  });

  it("does NOT walk away when the candidate accepts after the ceiling lands", () => {
    let s = freshState();
    s = candidateTurn(s, "My current CTC is 24 LPA, fixed 20 and variable 4.");
    s = aiTurn(s);
    s = candidateTurn(s, "Notice period is 60 days, can be bought out.");
    s = aiTurn(s);
    s = candidateTurn(s, "I led the payments platform rewrite end to end last year.");
    s = aiTurn(s);
    s = candidateTurn(s, "I'm targeting around 30 LPA for this move.");
    s = aiTurn(s);
    for (let i = 0; i < 8 && s.highestOfferMade === 0; i++) {
      s = candidateTurn(s, "What's the band for this role? I need a number.");
      s = aiTurn(s);
    }
    expect(s.highestOfferMade).toBeGreaterThan(0);

    /* Candidate accepts the concrete number — must close, not walk. */
    s = candidateTurn(s, "Okay, that works for me. I accept the offer.");
    s = aiTurn(s);
    expect(s.phase).not.toBe("walked-away");
  });
});
