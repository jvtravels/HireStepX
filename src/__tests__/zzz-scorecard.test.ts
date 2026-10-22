/* Offline scorecard harness (loop instrumentation, not a shipped test).
 * Drives a full realistic Flipkart-EM negotiation through the REAL kernel +
 * planner + prose, capturing kernel-truth moves, then runs the app's own
 * computeNegotiationMetrics → scoreNegotiationBehaviourDetailed → scoreLabel
 * pipeline and writes the score + rating to /tmp/neg-scorecard.txt so each
 * loop iteration can surface "score & rating" for the exercised scenario. */
import { describe, it } from "vitest";
import { writeFileSync } from "node:fs";
import {
  initState,
  pickAiMove,
  applyAiMove,
  applyCandidateAnswer,
  isTerminalPhase,
  type NegotiationBand,
  type NegotiationState,
  type AiMove,
} from "../../server-handlers/_negotiation-kernel";
import { planNextAction } from "../../server-handlers/_next-action-planner";
import { renderCanonicalProse } from "../../server-handlers/_canonical-prose";
import {
  computeNegotiationMetrics,
  scoreNegotiationBehaviourDetailed,
  type KernelTurnSummary,
} from "../../server-handlers/_negotiation-metrics";
import { scoreLabel } from "../SessionDetailPanels";

const band: NegotiationBand = {
  initialOffer: 40,
  maxStretch: 52,
  walkAway: 34,
  hasEquity: true,
  variableMax: 8,
};

function drive(turns: string[]): { finalState: NegotiationState; moves: KernelTurnSummary[] } {
  let state = initState({ sessionId: "scorecard", role: "engineering", company: "Flipkart", band });
  const moves: KernelTurnSummary[] = [];
  let idx = 0;
  const ship = () => {
    const move: AiMove = pickAiMove(state);
    const text = renderCanonicalProse(planNextAction(state), state);
    state = applyAiMove(state, move, text);
    moves.push({
      lever: move.lever,
      newTotalLpa: move.newTotalLpa,
      turnIndex: idx++,
      candidateTargetAtTurn: state.candidateTarget ?? null,
    });
  };
  ship(); // opening
  for (const ans of turns) {
    state = applyCandidateAnswer(state, ans);
    ship();
    if (isTerminalPhase(state.phase)) break;
  }
  return { finalState: state, moves };
}

describe("zzz negotiation scorecard", () => {
  it("scores a full Flipkart-EM session ending in a PRI-68 conditional bump", () => {
    // A realistic EM run: anchor early, work levers, close on a deliverable
    // conditional cash bump ("+2L") — the PRI-68 path.
    const { finalState, moves } = drive([
      "My current CTC is 38 LPA.",
      "I'm targeting 50 LPA given the scope of this role.",
      "That opening is light for a lead brief — the market for this is closer to 48.",
      "Can you also add a joining bonus and move the base up?",
      "Appreciate that. I'll accept if you bump the fixed by another 2L.",
    ]);
    const metrics = computeNegotiationMetrics({ finalState, moves });
    const scored = scoreNegotiationBehaviourDetailed(metrics);
    const rating = scoreLabel(scored.score);
    const lines = [
      "NEGOTIATION SCORECARD — PRI-68 exercised scenario (Flipkart EM)",
      `SCORE: ${scored.score}/100   RATING: ${rating}`,
      `Outcome: ${metrics.outcome}  |  Final offer: ₹${metrics.finalOfferLpa}L (opened ₹${metrics.initialOfferLpa}L)  |  Ask: ₹${metrics.candidateAskLpa ?? "—"}L`,
      `Band traversal: ${metrics.bandTraversal == null ? "—" : Math.round(metrics.bandTraversal * 100) + "%"}  |  Levers: ${metrics.leverDiversity}  |  Anchor turn: ${metrics.anchorTurn ?? "never"}  |  Turns: ${metrics.totalTurns}`,
      "Breakdown:",
      ...scored.breakdown.map((b) => `  • ${b.label}: ${b.points}/${b.max}`),
    ];
    writeFileSync("/tmp/neg-scorecard.txt", lines.join("\n") + "\n");
  });
});
