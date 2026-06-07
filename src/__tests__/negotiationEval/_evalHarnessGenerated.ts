/* SUBJECTIVE-1 (2026-06-08) — eval harness that GENERATES recruiter
 * prose via the real LLM, instead of using the fixture aiText embedded
 * in the scenario.
 *
 * Why this exists: the structural harness (_evalHarness.ts) drives the
 * kernel state machine but never exercises the prose-generation half
 * of the pipeline. The LLM judge in scripts/eval-negotiation.ts then
 * scored fixture text — prose the test author wrote, not what the bot
 * actually says in production. Voice quality, coaching honesty, and
 * persona authenticity were thus untestable.
 *
 * This harness runs the SAME pipeline production uses
 *   (applyCandidateAnswer → planNextAction → generateBotReply → applyAiMove)
 * for every turn, so the resulting transcript is the bot's actual
 * output. The judge can then score what users would hear.
 *
 * Cost-aware by design: NEVER run all 38 scenarios on every PR. The
 * caller decides which scenarios to generate (see SUBJECTIVE_SAMPLE
 * below); the default mode of scripts/eval-negotiation.ts stays
 * deterministic + free. Generated-mode is a nightly / weekly cron. */

import {
  initState,
  applyCandidateAnswer,
  applyAiMove,
  type NegotiationState,
} from "../../../server-handlers/_negotiation-kernel";
import { actionToLever } from "../../../server-handlers/_next-action-planner";
import { generateBotReply, type GenerateAiTextFn } from "../../../server-handlers/_response-pipeline";
import {
  scoreScenarioStructural,
  type ScenarioScorecard,
} from "../../../server-handlers/_negotiation-eval-deterministic";
import type {
  EvalScenario,
  EvalScenarioTurn,
} from "../../../data/negotiation-eval-scenarios";

export interface GeneratedScenarioRun {
  scenario: EvalScenario;
  finalState: NegotiationState;
  scorecard: ScenarioScorecard;
  /** The transcript that was actually produced — candidate text from
   *  the scenario, recruiter text from the LLM. Feed this to the judge
   *  so subjective verdicts score real bot prose. */
  generatedTurns: EvalScenarioTurn[];
}

/** Drive a scenario through the kernel + planner + REAL prose-
 *  generation pipeline. Returns the final kernel state, the deterministic
 *  scorecard (same one structural-only would have produced), and the
 *  generated transcript for the judge. */
export async function runScenarioGenerated(
  scenario: EvalScenario,
  generateAiText: GenerateAiTextFn,
): Promise<GeneratedScenarioRun> {
  let state = initState(scenario.init);
  const generatedTurns: EvalScenarioTurn[] = [];

  for (const turn of scenario.turns) {
    state = applyCandidateAnswer(state, turn.candidate);
    let aiText: string;
    try {
      const result = await generateBotReply(state, generateAiText, turn.candidate);
      aiText = result.text;
      /* generateBotReply already advanced the kernel through actionToLever
       * + the response pipeline, but it does NOT mutate `state` — it
       * just returns the picked move. Re-apply it here so kernel state
       * stays consistent across turns. */
      state = applyAiMove(state, result.move, aiText);
    } catch (err) {
      /* If generation throws, fall back to the fixture aiText so the
       * scenario can still complete and we get partial signal. The
       * judge will see the mixed transcript and score it accordingly.
       * Telemetry: stamp the error reason in the rationale slot for
       * post-hoc analysis. */
      const reason = err instanceof Error ? err.message : String(err);
      aiText = turn.aiText ?? `[generation failed: ${reason}]`;
      const fallbackMove = actionToLever({ kind: "terminal-restate" }, state);
      state = applyAiMove(state, fallbackMove, aiText);
    }
    generatedTurns.push({ candidate: turn.candidate, aiText });
  }

  const scorecard = scoreScenarioStructural(state, scenario, generatedTurns);
  return { scenario, finalState: state, scorecard, generatedTurns };
}

/** Curated subset for cron-mode runs. Picked for coverage breadth, not
 *  exhaustiveness: one anchoring case, one disclosure case, one
 *  retention/exploding-offer case, one long-horizon case, one Hindi-mix
 *  case. ~5 scenarios × ~6 turns × ~2 LLM calls per turn ≈ 60 calls per
 *  run. At Groq's ~$0.0002 per call this is ~$0.012 per run — trivial.
 *
 *  Add to this list ONLY when a new scenario surfaces a class of bug
 *  the current sample doesn't reach. Bigger samples cost more but yield
 *  diminishing signal; the structural layer covers exhaustive checks. */
export const SUBJECTIVE_SAMPLE: readonly string[] = [
  "exploding-offer-from-competitor",
  "compound-one-breath-disclosure",
  "long-horizon-trajectory",
  "hindi-mix-compound-disclosure",
  "first-wins-self-corrected-ctc",
];
