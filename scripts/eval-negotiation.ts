#!/usr/bin/env tsx
/**
 * Negotiation-eval entrypoint — runs every EvalScenario through the
 * deterministic scorer and prints a scorecard. Optionally invokes the
 * LLM judge for the subjective rubric layer (EVAL-2, not yet wired —
 * the hook below logs a single line indicating the judge would run).
 *
 * Run locally:
 *
 *   npx tsx scripts/eval-negotiation.ts              # all scenarios
 *   npx tsx scripts/eval-negotiation.ts exploding-offer-from-competitor
 *   npx tsx scripts/eval-negotiation.ts --json       # machine-readable
 *
 * Run via npm script:
 *
 *   npm run eval:negotiation
 *
 * Exit code:
 *   0 if every scenario fully passed the STRUCTURAL rubric
 *   1 if any structural criterion failed
 *
 * The structural layer is deterministic and free; the subjective
 * layer (LLM-judged tone / persona / coaching honesty) is gated
 * behind --judge so the default run is fast and zero-cost.
 *
 * Pattern follows scripts/eval-hallucination.ts: in CI we only run
 * the deterministic vitest spec (eval-structural.test.ts). This
 * script is for on-demand local + scheduled remote runs.
 */

import {
  EVAL_SCENARIOS,
  SCENARIO_BY_ID,
} from "../data/negotiation-eval-scenarios";
import { runScenarioStructural, summarizeSuite } from "../src/__tests__/negotiationEval/_evalHarness";
import { formatScorecard } from "../server-handlers/_negotiation-eval-deterministic";

const args = process.argv.slice(2);
const jsonMode = args.includes("--json");
const judgeMode = args.includes("--judge");
const idArg = args.find((a) => !a.startsWith("--"));

const scenarios = idArg
  ? [SCENARIO_BY_ID[idArg]].filter(Boolean)
  : EVAL_SCENARIOS;

if (idArg && scenarios.length === 0) {
  console.error(`Unknown scenario id: ${idArg}`);
  console.error(`Available: ${EVAL_SCENARIOS.map((s) => s.id).join(", ")}`);
  process.exit(2);
}

const runs = scenarios.map(runScenarioStructural);
const summary = summarizeSuite(runs);

if (jsonMode) {
  console.log(
    JSON.stringify(
      {
        summary,
        scenarios: runs.map((r) => ({
          id: r.scenario.id,
          label: r.scenario.label,
          score: r.scorecard.score,
          allPassed: r.scorecard.allPassed,
          verdicts: r.scorecard.verdicts,
        })),
      },
      null,
      2,
    ),
  );
} else {
  console.log("=== Negotiation eval — structural scorecard ===");
  for (const r of runs) console.log(formatScorecard(r.scorecard));
  console.log(
    `\nSuite: ${summary.fullyPassed}/${summary.totalScenarios} fully passed, average score ${summary.averageScore}/100`,
  );
  if (summary.worstScenario) {
    console.log(
      `Worst: ${summary.worstScenario.scenario.id} @ ${summary.worstScenario.scorecard.score}/100`,
    );
  }
}

if (judgeMode) {
  console.log(
    "\n[judge] subjective LLM judge layer is not wired in EVAL-1 — see EVAL-2 PR.",
  );
}

const anyFailed = runs.some((r) => !r.scorecard.allPassed);
process.exit(anyFailed ? 1 : 0);
