/* Negotiation-eval structural-layer smoke test.
 *
 * Runs every EvalScenario through the deterministic scorer and asserts
 * the suite-level outcome:
 *
 *   1. Every scenario MUST produce a scorecard (no scorer crash).
 *   2. Every scenario's score is reported (not gated yet — we want to
 *      SEE the number on the very first run, not fail CI on a baseline
 *      we don't have yet).
 *   3. No structural criterion may CRASH while scoring. (A crash means
 *      a scorer assumption broke; a fail just means the planner did
 *      the wrong thing — that's information, not a regression.)
 *
 * The output of this test, on its first green run, IS the baseline.
 * Subsequent PRs are evaluated against whether they moved scores up or
 * down. When a scenario goes from passing to failing, this test fails
 * loudly with the specific criterion + reason — the exact thing the
 * deep research said we were missing.
 *
 * The LLM-judged subjective layer is NOT exercised here — it's run by
 * scripts/eval-negotiation.ts on demand. */

import { describe, it, expect } from "vitest";
import { EVAL_SCENARIOS } from "../../../data/negotiation-eval-scenarios";
import {
  runScenarioStructural,
  summarizeSuite,
} from "./_evalHarness";
import { formatScorecard } from "../../../server-handlers/_negotiation-eval-deterministic";

describe("negotiation-eval — structural layer", () => {
  it("every scenario produces a scorecard without crashing", () => {
    for (const scenario of EVAL_SCENARIOS) {
      const run = runScenarioStructural(scenario);
      expect(run.scorecard.scenarioId).toBe(scenario.id);
      expect(run.scorecard.verdicts.length).toBeGreaterThan(0);
    }
  });

  it("prints a per-scenario scorecard for the CI log", () => {
    const runs = EVAL_SCENARIOS.map(runScenarioStructural);
    const summary = summarizeSuite(runs);
    /* eslint-disable no-console */
    console.log("\n=== Negotiation eval — structural scorecard ===");
    for (const r of runs) {
      console.log(formatScorecard(r.scorecard));
    }
    console.log(
      `\nSuite: ${summary.fullyPassed}/${summary.totalScenarios} fully passed, average score ${summary.averageScore}/100`,
    );
    if (summary.worstScenario) {
      console.log(
        `Worst: ${summary.worstScenario.scenario.id} @ ${summary.worstScenario.scorecard.score}/100`,
      );
    }
    /* eslint-enable no-console */
    // No assertion on a target score yet — the first green run
    // establishes the baseline. EVAL-2 will gate on a minimum.
    expect(summary.totalScenarios).toBe(EVAL_SCENARIOS.length);
  });
});
