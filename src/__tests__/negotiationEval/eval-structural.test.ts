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
    expect(summary.totalScenarios).toBe(EVAL_SCENARIOS.length);
  });

  /* EVAL-3 gate.
   *
   * The baseline was established by the first green run after
   * QUALITY-1: 20/20 scenarios fully passing, average 100/100. Any
   * future PR that drops a scenario below fully-passing (or drags
   * the suite average) fails CI here with the specific scenario id
   * + the failing criteria — exactly the regression detector the
   * deep research said we were missing.
   *
   * To intentionally LOWER the baseline (e.g. you added a tougher
   * scenario you know we don't yet handle), update MIN_FULLY_PASSED /
   * MIN_AVERAGE_SCORE in the same PR and explain in the commit why.
   * Silent drops are the failure mode this guard exists to prevent. */
  const MIN_FULLY_PASSED = 32;
  const MIN_AVERAGE_SCORE = 100;

  it("suite holds the EVAL-3 baseline (no regression)", () => {
    const runs = EVAL_SCENARIOS.map(runScenarioStructural);
    const summary = summarizeSuite(runs);

    const failing = runs
      .filter((r) => !r.scorecard.allPassed)
      .map((r) => {
        const failedIds = r.scorecard.verdicts
          .filter((v) => v.verdict === "fail")
          .map((v) => `${v.criterionId} (${v.reason})`)
          .join("; ");
        return `${r.scenario.id} @ ${r.scorecard.score}/100 — ${failedIds || "no failed verdicts but allPassed=false"}`;
      });

    expect(
      summary.fullyPassed,
      `Expected ≥ ${MIN_FULLY_PASSED} scenarios fully passing, got ${summary.fullyPassed}.\nFailing:\n  ${failing.join("\n  ")}`,
    ).toBeGreaterThanOrEqual(MIN_FULLY_PASSED);

    expect(
      summary.averageScore,
      `Suite average dropped to ${summary.averageScore}/100 (baseline: ${MIN_AVERAGE_SCORE}).`,
    ).toBeGreaterThanOrEqual(MIN_AVERAGE_SCORE);
  });
});
