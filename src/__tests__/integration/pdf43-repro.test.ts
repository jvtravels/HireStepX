import { describe, it, expect } from "vitest";
import {
  initState,
  applyCandidateAnswer,
  applyAiMove,
  isTerminalPhase,
  type NegotiationBand,
} from "../../../server-handlers/_negotiation-kernel";
import { planNextAction } from "../../../server-handlers/_next-action-planner";

const FLIPKART_SR_PD: NegotiationBand = {
  initialOffer: 35, maxStretch: 50, walkAway: 30, hasEquity: true,
};

/* PDF#43 transcript:
 *   T1 (bot)  : "Thanks for making the time. Let's get straight into it —
 *                what's your current CTC — total annual?"   (kernel turn 0)
 *   T2 (cand) : "my current CTC is 16 LPA"
 *   T3 (bot)  : "Thanks for the conversation today, Jay. We'll be in touch
 *                with the next steps soon."                  (STATIC CLOSING — BUG)
 *
 * Expected T3 was a kernel-generated discovery probe (base / target /
 * notice / equity). The static closing should NEVER play while the kernel
 * is still in a non-terminal phase. */
describe("pdf43-repro — kernel turn-2 must stay non-terminal after CTC disclosure", () => {
  it("planner returns a non-terminal action after candidate discloses current CTC", () => {
    let state = initState({
      sessionId: "pdf43-repro",
      role: "Senior Product Designer",
      company: "Flipkart",
      band: FLIPKART_SR_PD,
    });
    state.candidateApplicableYoe = 5;
    state = applyCandidateAnswer(state, "my current CTC is 16 LPA");
    const action = planNextAction(state);
    expect(action.kind).not.toMatch(/walkaway|walk-away|close-recap|close-accept|close-stalemate|terminal/);
    expect(action.kind).toMatch(/probe|discovery|component/);
  });

  it("after applyAiMove the kernel phase is non-terminal (isTerminalPhase=false)", () => {
    let state = initState({
      sessionId: "pdf43-repro",
      role: "Senior Product Designer",
      company: "Flipkart",
      band: FLIPKART_SR_PD,
    });
    state.candidateApplicableYoe = 5;
    state = applyCandidateAnswer(state, "my current CTC is 16 LPA");
    const action = planNextAction(state);
    const move = (action as unknown as { _move: Parameters<typeof applyAiMove>[1] })._move;
    state = applyAiMove(state, move, "what's your base component?");
    expect(isTerminalPhase(state.phase)).toBe(false);
    expect(state.phase).not.toBe("accepted");
    expect(state.phase).not.toBe("walked-away");
    expect(state.phase).not.toBe("stalemate");
  });
});
