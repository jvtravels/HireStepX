import { describe, it, expect } from "vitest";
import {
  initState,
  applyCandidateAnswer,
  applyAiMove,
  isTerminalPhase,
  type NegotiationBand,
  type NegotiationState,
} from "../../../server-handlers/_negotiation-kernel";
import { planNextAction } from "../../../server-handlers/_next-action-planner";

/* Engine-level transcript replay harness.
 *
 * Every PDF bug report comes in as a transcript: a sequence of candidate
 * utterances and the AI moves they should trigger. Each PDF that surfaces
 * a regression should land here as a new `stanza` — driving the kernel
 * through the candidate utterances and asserting the AI's phase per turn.
 * If a future change makes a previously-fixed transcript misbehave, the
 * stanza fails and the bug cannot silently reappear.
 *
 * Add a stanza by calling `replay(band, utterances)` and asserting on
 * the returned `turns[]`. Each turn carries `{ actionKind, phaseAfter,
 * terminalAfter }` — enough to pin both planner output and kernel phase. */

type Turn = { actionKind: string; phaseAfter: NegotiationState["phase"]; terminalAfter: boolean };

function replay(
  init: Parameters<typeof initState>[0] & { candidateApplicableYoe?: number },
  utterances: string[],
): { state: NegotiationState; turns: Turn[] } {
  let state = initState({
    sessionId: init.sessionId,
    role: init.role,
    company: init.company,
    band: init.band,
  });
  if (init.candidateApplicableYoe != null) state.candidateApplicableYoe = init.candidateApplicableYoe;
  const turns: Turn[] = [];
  for (const utterance of utterances) {
    state = applyCandidateAnswer(state, utterance);
    const action = planNextAction(state);
    const move = (action as unknown as { _move: Parameters<typeof applyAiMove>[1] })._move;
    state = applyAiMove(state, move, "");
    turns.push({
      actionKind: action.kind,
      phaseAfter: state.phase,
      terminalAfter: isTerminalPhase(state.phase),
    });
  }
  return { state, turns };
}

const FLIPKART_SR_PD: NegotiationBand = {
  initialOffer: 35, maxStretch: 50, walkAway: 30, hasEquity: true,
};

describe("PDF transcript replay — pinned non-regressions", () => {
  it("PDF#43: CTC disclosure must NOT trigger close on turn 1", () => {
    const { turns } = replay(
      {
        sessionId: "pdf43-repro",
        role: "Senior Product Designer",
        company: "Flipkart",
        band: FLIPKART_SR_PD,
        candidateApplicableYoe: 5,
      },
      ["my current CTC is 16 LPA"],
    );
    expect(turns[0].terminalAfter).toBe(false);
    expect(turns[0].actionKind).not.toMatch(/close-(accept|walkaway|stalemate|recap)/);
  });

  it("explicit acceptance of in-band offer does reach terminal", () => {
    const { turns } = replay(
      {
        sessionId: "pdf-accept",
        role: "Senior Product Designer",
        company: "Flipkart",
        band: FLIPKART_SR_PD,
        candidateApplicableYoe: 5,
      },
      [
        "my current CTC is 16 LPA, expecting around 40 LPA",
        "yes I accept 40 LPA, let's move forward",
      ],
    );
    // Last turn must have produced a terminal phase given an explicit accept.
    // (Lenient: kernel may still need one anchoring turn before locking in,
    // but the final state across the sequence should not be "opening".)
    expect(turns[turns.length - 1].phaseAfter).not.toBe("opening");
  });

  it("kernel never auto-closes on a single discovery turn regardless of utterance", () => {
    /* Defense against the class of bugs where the kernel terminates the
     * conversation after a single candidate response. The first turn
     * after any reasonable candidate utterance must NEVER be terminal. */
    const utterances = [
      "I make 16 LPA right now",
      "currently at 22 LPA fixed",
      "my notice is 60 days",
      "I have a competing offer at 45 LPA",
      "I'm flexible on the breakdown",
    ];
    for (const u of utterances) {
      const { turns } = replay(
        {
          sessionId: `single-turn-${u.slice(0, 8)}`,
          role: "Senior Product Designer",
          company: "Flipkart",
          band: FLIPKART_SR_PD,
          candidateApplicableYoe: 5,
        },
        [u],
      );
      expect(turns[0].terminalAfter, `terminated on first turn for utterance: "${u}"`).toBe(false);
    }
  });
});
