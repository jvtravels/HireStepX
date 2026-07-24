/* S48-B8 (2026-07-24) — BATNA-pressure ("I need to let other conversations
 * progress") triggered "hold-firm" instead of a cash concession attempt.
 *
 * Root cause: the suppressed-walk-away branch in planNextAction returned
 * hold-firm whenever `state.highestOfferMade > 0` and `turnIndex < minTurns`,
 * regardless of whether the candidate was signalling BATNA pressure (competing
 * conversations/offers) vs a genuine disengagement.
 *
 * A candidate who says "I need to let the other conversations progress" is
 * signalling BATNA leverage — competing processes are moving forward — NOT
 * walking away from THIS negotiation. The correct recruiter move is a cash
 * concession attempt (half-step toward the ceiling) to stay competitive.
 * Hold-firm trains the candidate that BATNA pressure has zero leverage here.
 *
 * Fix: in the early-walk-suppressed branch, detect competing-offer/BATNA
 * language and route to counter-base (half-step concession) when there is
 * headroom between the current offer and maxStretch. If no headroom, fall
 * back to hold-firm.
 *
 * Test matrix:
 *   A. "I need to let the other conversations progress" → counter-base (has headroom)
 *   B. "I have another offer" → counter-base (has headroom)
 *   C. "Other opportunities are moving forward" → counter-base (has headroom)
 *   D. "I'm at ceiling, other conversations progress" → hold-firm (no headroom)
 *   E. "I'm not interested anymore" → hold-firm (genuine disengagement, not BATNA) */

import { describe, it, expect } from "vitest";
import {
  initState,
  applyAiMove,
  applyCandidateAnswer,
  type NegotiationBand,
} from "../../server-handlers/_negotiation-kernel";
import { planNextAction } from "../../server-handlers/_next-action-planner";

/* S48 band: initial ₹58.2L, ceiling ₹72L — candidate target ₹90L > 72 * 1.2 = 86.4,
 * so recommendWalkAway condition 1 fires after 3 turns. headroom = 72 - 60.2 = 11.8L. */
const BAND_WITH_HEADROOM: NegotiationBand = {
  initialOffer: 58.2,
  maxStretch: 72,
  walkAway: 45,
  hasEquity: true,
};

/* Band at ceiling (no headroom) — initialOffer already equals maxStretch.
 * Target ₹90L > 72 * 1.2 = 86.4L → walk fires, but no headroom to concede. */
const BAND_AT_CEILING: NegotiationBand = {
  initialOffer: 72,
  maxStretch: 72,
  walkAway: 55,
  hasEquity: true,
};

function stateWithOffer(band: NegotiationBand, candidateLastUtterance: string): ReturnType<typeof applyCandidateAnswer> {
  /* Simulates the real S48-B8 session flow.
   *
   * IMPORTANT: utterances use "90 LPA" / "55 LPA" format (not "₹90L") because
   * the offline fact parser's SALARY_UNIT_GROUP recognizes "lpa" reliably but
   * "₹NL" with an uppercase L without a unit suffix can fail to parse in the
   * regex path. The bug itself is about planner routing, not parser coverage.
   *
   *   1. Candidate discloses CTC (turn 1) → parser sets candidateCurrentCtc
   *   2. Recruiter opens with offer
   *   3. Candidate states high target ("90 LPA") → candidateTarget = 90
   *      (now target > 72 × 1.2 = 86.4 → walk condition 1 arms)
   *   4. Recruiter probes competing-credibility (marks as fired in ledger)
   *   5. Candidate is vague; recruiter counters
   *   6. Candidate re-asserts BATNA pressure → BATNA branch fires instead of hold-firm
   */
  let s = initState({ sessionId: "s48b8", role: "engineering-manager", company: "amazon", band });
  // Turn 1: CTC only — keeps candidateTarget null so opener fires cleanly
  s = applyCandidateAnswer(s, "My current CTC is 55 LPA.");
  s = applyAiMove(s, { lever: "open-with-offer", newTotalLpa: band.initialOffer, rationale: "open" }, `We can offer ${band.initialOffer} LPA.`);
  // Turn 2: target stated explicitly in "LPA" format → candidateTarget = 90
  s = applyCandidateAnswer(s, "My expectation is 90 LPA. I am also interviewing with another company.");
  // Fire the competing-credibility probe WITH the correct askedTopic so hasFired() returns true later
  s = applyAiMove(s, {
    lever: "probe",
    newTotalLpa: null,
    rationale: "competing-credibility probe",
    askedTopic: "competing-credibility",
    actionKind: "reactive-followup",
  } as Parameters<typeof applyAiMove>[1], "Which company is that with, and do you have a written offer?");
  // Turn 3: vague answer; recruiter counters
  s = applyCandidateAnswer(s, "I would rather not say, but they are further along in the process.");
  s = applyAiMove(s, { lever: "counter-base", newTotalLpa: band.initialOffer + 2, rationale: "counter" }, `We can go to ${band.initialOffer + 2} LPA.`);
  // Turn 4: candidate again signals BATNA pressure — competing-credibility already probed,
  // so the probe branch is suppressed; only the walk-away / BATNA-concession branch can fire.
  s = applyCandidateAnswer(s, candidateLastUtterance);
  return s;
}

describe("S48-B8 — BATNA pressure triggers cash concession attempt, not hold-firm", () => {
  it("A. 'I need to let the other conversations progress' → counter-base concession", () => {
    const s = stateWithOffer(BAND_WITH_HEADROOM, "I need to let the other conversations progress.");
    const action = planNextAction(s);
    // Must attempt concession (counter-base), not hold firm
    expect(action?._move?.lever).toBe("counter-base");
    // Concession must be above standing offer and at or below ceiling
    const offer = action?._move?.newTotalLpa ?? 0;
    expect(offer).toBeGreaterThan(s.highestOfferMade);
    expect(offer).toBeLessThanOrEqual(BAND_WITH_HEADROOM.maxStretch);
  });

  it("B. 'I have another offer on the table' → counter-base concession", () => {
    const s = stateWithOffer(BAND_WITH_HEADROOM, "I have another offer on the table that I need to respond to.");
    const action = planNextAction(s);
    expect(action?._move?.lever).toBe("counter-base");
    const offer = action?._move?.newTotalLpa ?? 0;
    expect(offer).toBeGreaterThan(s.highestOfferMade);
  });

  it("C. 'Other opportunities are moving forward' → counter-base concession", () => {
    const s = stateWithOffer(BAND_WITH_HEADROOM, "Other opportunities are moving forward and I need to decide.");
    const action = planNextAction(s);
    expect(action?._move?.lever).toBe("counter-base");
  });

  it("D. At ceiling with no headroom, BATNA → hold-firm (nothing to give)", () => {
    const s = stateWithOffer(BAND_AT_CEILING, "I need to let the other conversations progress.");
    const action = planNextAction(s);
    // Standing offer = maxStretch, no headroom — must hold firm
    // (The planner may also choose close-walkaway or another terminal if eligible)
    expect(action?._move?.lever).not.toBe("counter-base");
  });

  it("E. Genuine disengagement ('I'm not interested anymore') → hold-firm not concession", () => {
    // "I'm not interested" → DISENGAGEMENT_PREFIX_RE fires → BATNA_PRESSURE_RE not checked
    // (Actually, this goes through the explicit-decline / terminalIntent path, not the BATNA path)
    const s = stateWithOffer(BAND_WITH_HEADROOM, "I'm not interested in this role anymore.");
    const action = planNextAction(s);
    // This is genuine disengagement, NOT BATNA — should NOT concede
    expect(action?._move?.lever).not.toBe("counter-base");
  });
});
