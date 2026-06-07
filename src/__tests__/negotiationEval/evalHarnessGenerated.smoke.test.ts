/* SUBJECTIVE-1 smoke — guarantees the generated harness wires together
 * cleanly without making real LLM calls. Drives one short scenario
 * through runScenarioGenerated with a stub generator that returns
 * canned text; asserts the kernel state advanced, the scorecard
 * exists, and generatedTurns mirrors the input candidate sequence.
 *
 * This is NOT a behavioral test of LLM quality (the actual judging
 * happens in scripts/eval-negotiation.ts on the cron). It's the
 * regression net that catches "harness refactor accidentally broke
 * the integration". */

import { describe, it, expect } from "vitest";
import { runScenarioGenerated } from "./_evalHarnessGenerated";
import { EVAL_SCENARIOS } from "../../../data/negotiation-eval-scenarios";

describe("runScenarioGenerated — smoke", () => {
  it("drives a scenario with a stub generator and returns a scorecard + generated turns", async () => {
    const scenario = EVAL_SCENARIOS.find(
      (s) => s.id === "exploding-offer-from-competitor",
    );
    expect(scenario).toBeDefined();

    /* Stub generator: returns a short canned line. The kernel doesn't
     * read the text for routing — only for transcript bookkeeping. */
    const stub = async (_sys: string, _usr: string) => "Noted — let me come back to that.";
    const run = await runScenarioGenerated(scenario!, stub);

    expect(run.scenario.id).toBe(scenario!.id);
    expect(run.scorecard.scenarioId).toBe(scenario!.id);
    expect(run.scorecard.verdicts.length).toBeGreaterThan(0);
    expect(run.generatedTurns.length).toBe(scenario!.turns.length);
    /* Candidate text must round-trip verbatim. */
    for (let i = 0; i < scenario!.turns.length; i++) {
      expect(run.generatedTurns[i].candidate).toBe(scenario!.turns[i].candidate);
    }
    /* Final state must have advanced — turnIndex reflects every turn. */
    expect(run.finalState.turnIndex).toBeGreaterThanOrEqual(scenario!.turns.length - 1);
  });

  it("falls back to fixture aiText when the generator throws", async () => {
    const scenario = EVAL_SCENARIOS.find(
      (s) => s.id === "exploding-offer-from-competitor",
    );
    const thrower = async () => {
      throw new Error("simulated LLM outage");
    };
    const run = await runScenarioGenerated(scenario!, thrower);
    /* Every turn either kept the fixture aiText or stamped a
     * [generation failed: …] marker — neither path crashes. */
    expect(run.generatedTurns.length).toBe(scenario!.turns.length);
    for (const t of run.generatedTurns) {
      expect(typeof t.aiText).toBe("string");
      expect(t.aiText!.length).toBeGreaterThan(0);
    }
  });
});
