/* Negotiation-eval harness — drives an EvalScenario through the
 * kernel + planner and returns a structural scorecard.
 *
 * Thin shim over the existing pdfReplay harness — scenarios run
 * through the exact same pipeline (applyCandidateAnswer → pickAiMove
 * → applyAiMove) the live engine uses, then are scored by the
 * deterministic rubric. No LLM in the loop; safe for CI.
 *
 * The LLM-judged subjective layer is invoked by
 * scripts/eval-negotiation.ts, which reuses runScenarioStructural to
 * get the final state and then sends the transcript to the judge. */

import { replayTranscript, type ReplayInput } from "../pdfReplay/_replayHarness";
import {
  scoreScenarioStructural,
  type ScenarioScorecard,
} from "../../../server-handlers/_negotiation-eval-deterministic";
import type { EvalScenario } from "../../../data/negotiation-eval-scenarios";
import type { NegotiationState } from "../../../server-handlers/_negotiation-kernel";

export interface ScenarioRun {
  scenario: EvalScenario;
  finalState: NegotiationState;
  scorecard: ScenarioScorecard;
}

/** Run one scenario end-to-end and return the final state + the
 *  structural scorecard. Pure, deterministic, vitest-safe. */
export function runScenarioStructural(scenario: EvalScenario): ScenarioRun {
  const replayInput: ReplayInput = {
    init: scenario.init,
    turns: scenario.turns.map((t) => ({ candidate: t.candidate, aiText: t.aiText })),
  };
  const finalState = replayTranscript(replayInput);
  const scorecard = scoreScenarioStructural(finalState, scenario);
  return { scenario, finalState, scorecard };
}

export interface SuiteSummary {
  totalScenarios: number;
  fullyPassed: number;
  averageScore: number;
  worstScenario: ScenarioRun | null;
}

/** Aggregate a batch of scenario runs into one suite-level summary.
 *  This is what shows up in CI as "Negotiation eval: 17/20 scenarios
 *  fully passed, average 91/100". */
export function summarizeSuite(runs: readonly ScenarioRun[]): SuiteSummary {
  if (runs.length === 0) {
    return {
      totalScenarios: 0,
      fullyPassed: 0,
      averageScore: 0,
      worstScenario: null,
    };
  }
  const fullyPassed = runs.filter((r) => r.scorecard.allPassed).length;
  const averageScore = Math.round(
    runs.reduce((s, r) => s + r.scorecard.score, 0) / runs.length,
  );
  const worstScenario = [...runs].sort(
    (a, b) => a.scorecard.score - b.scorecard.score,
  )[0]!;
  return {
    totalScenarios: runs.length,
    fullyPassed,
    averageScore,
    worstScenario,
  };
}
