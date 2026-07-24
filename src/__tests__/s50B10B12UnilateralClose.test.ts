/* S50-B10 / S50-B12 (2026-07-24) — unilateral close without gap validation.
 *
 * Session 50 scenario:
 *   Offer: ₹23.6L  Candidate ask: ₹28L  Gap: ₹4.4L / 19%
 *   Recruiter fires: "We're in the same range, then, let's lock it at ₹23.6L."
 *
 * Root cause chain:
 *   - S53-B5 (already fixed 2026-07-24) — candidateSignaledClose was stamped
 *     even when candidate's fresh counter / known target exceeded the near-offer
 *     gap (max(₹2L, 6% of offer)).
 *   - applyAiMove with lever="close-acceptance" immediately sets phase="accepted",
 *     so S50-B12 (no candidate response turn) was a symptom of S50-B10.
 *   - S53-B6 (session terminates on SPACE during mid-stream close speech) is
 *     also a symptom: phase="accepted" was already in kernel state; SPACE →
 *     skipSpeaking() → engine sees accepted phase → UI transitions to "done".
 *
 * Verification: with the S53-B5 veto in place:
 *   (a) candidateSignaledClose stays unset when gap > nearGap
 *   (b) planner does NOT produce a close action in that state
 *   (c) close IS correctly fired when candidate genuinely concedes to offer price
 *
 * Note: lastCandidateCounterLpa is CLEARED to null by applyAiMove (line 7164 in
 * _negotiation-kernel.ts) after each AI turn. So on the trial-close reply turn:
 *   - freshCounter = null (cleared by preceding applyAiMove call)
 *   - S53-B5 falls back to knownTarget check: aboveGap(28) = 4.4 > 2 → VETO
 */

import { describe, it, expect } from "vitest";
import {
  initState,
  applyAiMove,
  applyCandidateAnswer,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import { planNextAction } from "../../server-handlers/_next-action-planner";

const BAND: NegotiationBand = {
  initialOffer: 22,
  maxStretch: 30,
  walkAway: 17,
  hasEquity: false,
};

/* Trial-close text matching detectTrialCloseAsked pattern 1 */
const TRIAL_CLOSE_TEXT = "If we land at ₹23.6L, would you be ready to sign today?";

/** Build the exact S50-B10 kernel state:
 *  - offer = 23.6L (highest offered)
 *  - candidateTarget = 28 (last stated ask)
 *  - lastAiText = trial-close ask
 *  - lastCandidateCounterLpa = null (cleared by applyAiMove, as happens in real sessions)
 */
function buildS50State(): NegotiationState {
  let s = initState({ sessionId: "s50b10", role: "software-engineer", company: "hdfc", band: BAND });
  s = applyCandidateAnswer(s, "My current CTC is 19 LPA and I'm looking for 28 LPA.");
  s = applyAiMove(
    s,
    { lever: "open-with-offer", newTotalLpa: 23.6, rationale: "open" },
    TRIAL_CLOSE_TEXT,
  );
  // After applyAiMove, lastCandidateCounterLpa is cleared to null — this is the
  // exact state before the candidate replies to the trial close.
  return s;
}

describe("S50-B10/B12 — close must not fire with 19% gap (₹23.6L offer vs ₹28L ask)", () => {
  it("A. lastCandidateCounterLpa is null after applyAiMove (one-shot clear)", () => {
    const s = buildS50State();
    expect(s.lastCandidateCounterLpa).toBeNull();
  });

  it("B. candidateSignaledClose NOT stamped when candidate says accepting phrase with 19% gap", () => {
    /* "We're in the same range, that sounds fair." — ambiguously accepting,
     * but the known target (₹28L) is 4.4L above offer (> nearGap of 2L).
     * S53-B5 veto: freshCounter=null → fall back to knownTarget=28, aboveGap(28)=true → VETO. */
    const base = buildS50State();
    const s = applyCandidateAnswer(base, "We're in the same range, that sounds fair.");
    expect((s as NegotiationState & { candidateSignaledClose?: boolean }).candidateSignaledClose).not.toBe(true);
  });

  it("C. planner does NOT produce close action after ambiguous-accept with 19% gap", () => {
    const base = buildS50State();
    const s = applyCandidateAnswer(base, "We're in the same range, that sounds fair.");
    const action = planNextAction(s);
    expect(action?.kind).not.toBe("close");
    expect(action?.kind).not.toBe("auto-accept");
  });

  it("D. candidateSignaledClose IS stamped when candidate says pure 'yes' with target already within nearGap", () => {
    /* When the candidate's KNOWN target is within nearGap of offer (e.g. target=24.5
     * vs offer=23.6, gap=0.9 < 2L), a pure accept response with no competing
     * counter should set candidateSignaledClose.
     * freshCounter=null (cleared by applyAiMove), knownTarget=24.5,
     * aboveGap(24.5)=24.5-23.6=0.9 > 2? NO → veto does NOT fire → close stamps. */
    let base = initState({ sessionId: "s50b10d", role: "software-engineer", company: "hdfc", band: BAND });
    base = applyCandidateAnswer(base, "My current CTC is 19 LPA and I'm looking for 24.5 LPA.");
    base = applyAiMove(
      base,
      { lever: "open-with-offer", newTotalLpa: 23.6, rationale: "open" },
      TRIAL_CLOSE_TEXT,
    );
    const s = applyCandidateAnswer(base, "yes that works for me");
    expect((s as NegotiationState & { candidateSignaledClose?: boolean }).candidateSignaledClose).toBe(true);
  });

  it("E. candidateSignaledClose IS stamped when candidate gives clean 'yes' with target at offer", () => {
    /* Candidate's target is at the offer price (target=23.6 = offer), fresh reply "yes".
     * freshCounter=null (no number this turn), knownTarget=23.6,
     * aboveGap(23.6)=23.6>23.6? NO → no veto → close stamps.
     * Represents a session where candidate previously accepted the offered number. */
    let base = initState({ sessionId: "s50b10e", role: "software-engineer", company: "hdfc", band: BAND });
    base = applyCandidateAnswer(base, "My current CTC is 19 LPA and I'm looking for 23.6 LPA.");
    base = applyAiMove(
      base,
      { lever: "open-with-offer", newTotalLpa: 23.6, rationale: "open" },
      TRIAL_CLOSE_TEXT,
    );
    const s = applyCandidateAnswer(base, "yes");
    expect((s as NegotiationState & { candidateSignaledClose?: boolean }).candidateSignaledClose).toBe(true);
  });
});
