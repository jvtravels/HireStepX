/* PDF#29 Bug 7 (2026-05-18) — frustration detector as live lever.
 *
 * Symptom: candidate says "I already told you my CTC is 18" three
 * times; the bot keeps probing the same topic. Root cause: the
 * USER_CONFUSION_RE existed in the post-session analyzer but was
 * never consumed by the live planner. The kernel now folds the
 * frustration signal into state.lastUserFrustrated, the planner
 * promotes acknowledge-and-recover as the highest-priority lever,
 * and the move is one-shot (cleared in applyAiMove).
 *
 * fixture from PDF 29 manual replay session (2026-05-18) — phrasing per
 * kernel diagnostic.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  applyCandidateAnswer,
  applyAiMove,
  type NegotiationBand,
} from "../../../server-handlers/_negotiation-kernel";
import { planNextAction, actionToLever } from "../../../server-handlers/_next-action-planner";
import { renderCanonicalProse } from "../../../server-handlers/_canonical-prose";

const BAND: NegotiationBand = {
  initialOffer: 23,
  maxStretch: 32,
  walkAway: 20,
  hasEquity: false,
};

const seed = () => initState({
  sessionId: "pdf29-frustration",
  role: "Senior PM",
  company: "Razorpay",
  band: BAND,
});

describe("PDF#29 Bug 7 — frustration detector live lever", () => {
  it("3 candidate turns saying 'I already told you my CTC is 18' → 3rd bot turn is acknowledge-and-recover with apology", () => {
    let state = seed();
    let lastAction: ReturnType<typeof planNextAction> | null = null;
    for (let turn = 0; turn < 3; turn++) {
      state = applyCandidateAnswer(state, "I already told you my CTC is 18");
      expect(state.lastUserFrustrated).toBe(true);
      lastAction = planNextAction(state);
      const move = actionToLever(lastAction, state);
      const prose = renderCanonicalProse(lastAction, state);
      state = applyAiMove(state, move, prose);
      /* one-shot clear after the AI turn so subsequent turns can re-fire
       * only if the candidate keeps signalling frustration. */
      expect(state.lastUserFrustrated).toBe(false);
    }
    expect(lastAction!.kind).toBe("acknowledge-and-recover");
    const finalProse = renderCanonicalProse(lastAction!, state);
    expect(finalProse.toLowerCase()).toMatch(/apolog/);
  });

  it("'you keep asking' cue also fires the lever", () => {
    let state = seed();
    state = applyCandidateAnswer(state, "you keep asking the same thing");
    expect(state.lastUserFrustrated).toBe(true);
    const action = planNextAction(state);
    expect(action.kind).toBe("acknowledge-and-recover");
  });

  it("'we covered this' cue also fires the lever", () => {
    let state = seed();
    state = applyCandidateAnswer(state, "we covered this earlier");
    const action = planNextAction(state);
    expect(action.kind).toBe("acknowledge-and-recover");
  });

  it("a neutral utterance does NOT fire the lever", () => {
    let state = seed();
    state = applyCandidateAnswer(state, "My current CTC is 18 LPA");
    expect(state.lastUserFrustrated).toBe(false);
    const action = planNextAction(state);
    expect(action.kind).not.toBe("acknowledge-and-recover");
  });
});
