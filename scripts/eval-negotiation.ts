#!/usr/bin/env tsx
/**
 * Negotiation-eval entrypoint — runs every EvalScenario through the
 * deterministic scorer and prints a scorecard. With --judge, ALSO
 * invokes the LLM judge for the subjective rubric layer (tone,
 * persona authenticity, coaching honesty).
 *
 * Run locally:
 *
 *   npx tsx scripts/eval-negotiation.ts                       # structural only
 *   npx tsx scripts/eval-negotiation.ts exploding-offer-...   # single scenario
 *   npx tsx scripts/eval-negotiation.ts --json                # machine-readable
 *   GROQ_API_KEY=... npx tsx scripts/eval-negotiation.ts --judge   # + LLM judge
 *
 * Run via npm script:
 *
 *   npm run eval:negotiation              # structural only
 *   npm run eval:negotiation -- --judge   # + LLM judge (needs API key)
 *
 * Exit code:
 *   0 if every scored criterion passed
 *   1 if any criterion failed (structural OR, with --judge, subjective)
 *
 * The structural layer is deterministic and free; the subjective
 * layer (LLM-judged tone / persona / coaching honesty) is gated
 * behind --judge so the default run is fast and zero-cost.
 *
 * Pattern follows scripts/eval-hallucination.ts: in CI we only run
 * the deterministic vitest spec. This script is for on-demand local
 * + scheduled remote runs.
 */

import {
  EVAL_SCENARIOS,
  SCENARIO_BY_ID,
} from "../data/negotiation-eval-scenarios";
import { runScenarioStructural, summarizeSuite } from "../src/__tests__/negotiationEval/_evalHarness";
import {
  formatScorecard,
  type CriterionVerdict,
  type ScenarioScorecard,
} from "../server-handlers/_negotiation-eval-deterministic";
import { judgeScenario } from "../server-handlers/_negotiation-eval-judge";

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

/* ------------------------------------------------------------------ *
 * Merge a scorecard with subjective verdicts from the LLM judge.     *
 * Recomputes score + allPassed across the combined verdict list so   *
 * the suite summary reflects both layers.                            *
 * ------------------------------------------------------------------ */
function mergeSubjective(
  card: ScenarioScorecard,
  subjective: readonly CriterionVerdict[],
): ScenarioScorecard {
  const verdicts: CriterionVerdict[] = [...card.verdicts, ...subjective];
  const scored = verdicts.filter((v) => v.verdict !== "n/a");
  const earnedWeight = scored
    .filter((v) => v.verdict === "pass")
    .reduce((s, v) => s + v.weight, 0);
  const totalWeight = scored.reduce((s, v) => s + v.weight, 0);
  const score = totalWeight === 0 ? 100 : Math.round((earnedWeight / totalWeight) * 100);
  const allPassed = scored.every((v) => v.verdict === "pass");
  return { ...card, verdicts, score, allPassed };
}

async function main() {
  const structuralRuns = scenarios.map(runScenarioStructural);

  let runs = structuralRuns;
  if (judgeMode) {
    // Late, dynamic import so the script doesn't require LLM env
    // vars to be present for non-judge runs. _llm.ts logs a warning
    // on module load when SUPABASE_* are missing, but does not
    // crash, so the import is safe.
    const { callLLM } = await import("../server-handlers/_llm");
    const hasAnyApiKey = !!(
      process.env.GROQ_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.CEREBRAS_API_KEY
    );
    console.error(
      hasAnyApiKey
        ? "[judge] LLM key detected — running subjective layer"
        : "[judge] no LLM key — subjective verdicts will be n/a",
    );
    runs = await Promise.all(
      structuralRuns.map(async (r) => {
        const subjective = await judgeScenario(
          r.scenario,
          r.finalState,
          (opts) => callLLM(opts),
          hasAnyApiKey,
        );
        return { ...r, scorecard: mergeSubjective(r.scorecard, subjective) };
      }),
    );
  }

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
    const header = judgeMode
      ? "=== Negotiation eval — structural + LLM-judged ==="
      : "=== Negotiation eval — structural scorecard ===";
    console.log(header);
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

  const anyFailed = runs.some((r) => !r.scorecard.allPassed);
  process.exit(anyFailed ? 1 : 0);
}

main().catch((err) => {
  console.error("eval-negotiation: unexpected error", err);
  process.exit(2);
});
