/* Audit fix 2026-05-21 — CTC-inflation cascade end-to-end integration.
 *
 * This test drives the REAL planner (no helper mocking) through a
 * subsequent-counter cascade and proves the lever actually fires in
 * production sequencing:
 *
 *   1. Discovery completes (currentCtc, target, etc. disclosed).
 *   2. Recruiter ships first counter-base (counter-offer phase entered,
 *      `counter-base` lands in leversUsed).
 *   3. Candidate re-anchors high (target >= 1.3x initialOffer).
 *   4. Planner returns `ctc-inflation-anchor` (the inflated headline).
 *   5. Kernel stamps `ctcInflationAnchorCtcLpa` and the lever lands in
 *      leversUsed.
 *   6. Candidate asks "what's the breakdown?" (detectInHandFollowup hit).
 *   7. Planner returns `ctc-inflation-truth` (same numbers, honest framing).
 *
 * The whole point of this test is to PROVE the gate revision lands the
 * lever in production cascade — not just in the unit-level helper test.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  applyAiMove,
  applyCandidateAnswer,
  type NegotiationBand,
  type NegotiationState,
} from "../../../server-handlers/_negotiation-kernel";
import {
  planNextAction,
  actionToLever,
} from "../../../server-handlers/_next-action-planner";
import { renderCanonicalProse } from "../../../server-handlers/_canonical-prose";

const BAND: NegotiationBand = {
  initialOffer: 20,
  maxStretch: 30,
  walkAway: 16,
  hasEquity: true,
};

/* Drive one bot turn end-to-end through the real planner. */
function botTurn(state: NegotiationState) {
  const action = planNextAction(state);
  const move = actionToLever(action, state);
  const canonical = renderCanonicalProse(action, state);
  const nextState = applyAiMove(state, move, canonical);
  return { state: nextState, action, canonical, move };
}

describe("CTC-inflation cascade — end-to-end planner integration", () => {
  it("anchor → counter-base → re-anchor → ctc-inflation-anchor → in-hand ask → ctc-inflation-truth", () => {
    /* ── Stage discovery + offer-presented state directly. The cascade
     * under test is the counter-offer side; we want the test focused on
     * the lever firing, not on driving the full discovery checklist
     * (covered separately in salaryNegE2eSmoke). */
    let state: NegotiationState = initState({
      sessionId: "ctc-inflation-cascade",
      role: "swe",
      company: "TestCo",
      band: BAND,
    });
    /* Force the session into counter-offer phase with a shipped
     * counter-base + candidate disclosures that the parser would have
     * established through normal discovery. This is honest-state
     * plumbing, not helper mocking — the planner still runs end-to-end
     * on whatever state it sees. */
    state = {
      ...state,
      phase: "counter-offer",
      highestOfferMade: 22,
      candidateCurrentCtc: 18,
      candidateTarget: 30,
      leversUsed: [...state.leversUsed, "counter-base"],
      counterRound: 1,
    };
    expect(state.candidateTarget).toBe(30);
    expect(state.candidateTarget! >= BAND.initialOffer * 1.3).toBe(true);

    /* ── Planner turn — expect ctc-inflation-anchor to fire. */
    const anchorTurn = botTurn(state);
    expect(anchorTurn.action.kind).toBe("ctc-inflation-anchor");
    if (anchorTurn.action.kind === "ctc-inflation-anchor") {
      expect(anchorTurn.action.ctcLpa).toBe(30);
      expect(anchorTurn.action.fixedLpa).toBeCloseTo(18, 1); // 60%
    }
    state = anchorTurn.state;

    /* Kernel stamps the headline CTC + lever lands in leversUsed. */
    expect(state.ctcInflationAnchorCtcLpa).toBe(30);
    expect(state.leversUsed).toContain("ctc-inflation-anchor");

    /* Single-fire: planner should NOT re-fire the inflation lever even
     * if the candidate keeps over-anchoring without asking the in-hand
     * question. */
    const replayState = {
      ...state,
      /* Pretend the candidate said something innocuous that doesn't
       * trigger the in-hand follow-up detector. */
    };
    const replay = botTurn(applyCandidateAnswer(replayState, "Okay, I hear you."));
    expect(replay.action.kind).not.toBe("ctc-inflation-anchor");

    /* ── Candidate asks for the in-hand breakdown. */
    state = applyCandidateAnswer(state, "Sure — but what's the in-hand on that? Can you give me the breakdown?");

    /* ── Planner turn — expect ctc-inflation-truth to fire. */
    const truthTurn = botTurn(state);
    expect(truthTurn.action.kind).toBe("ctc-inflation-truth");
    if (truthTurn.action.kind === "ctc-inflation-truth") {
      /* Same numbers as the original anchor (the lie was the framing). */
      expect(truthTurn.action.ctcLpa).toBe(30);
      expect(truthTurn.action.fixedLpa).toBeCloseTo(18, 1);
      expect(truthTurn.action.variableLpa).toBeCloseTo(5.4, 1); // 18% of 30
    }
  });
});
