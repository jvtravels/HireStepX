/* Negotiation-eval LLM-judge parser tests.
 *
 * The LLM-judge call itself is NOT exercised here (it'd be slow,
 * flaky, cost money in CI). What we DO test deterministically:
 *
 *   - The prompt builder produces a well-formed prompt that includes
 *     every subjective criterion and renders the full transcript.
 *   - The response parser handles: clean JSON, code-fence-wrapped
 *     JSON, malformed JSON, missing fields, extra fields, wrong types.
 *   - verdictsFromJudgeResponse always returns one CriterionVerdict
 *     per subjective rubric line, even when the LLM skipped some.
 *   - judgeScenario degrades gracefully when no API key is set.
 *
 * These tests are the safety net for the prompt + parser contract.
 * If the LLM drifts in production, this file's assumptions tell us
 * exactly where the drift broke us. */

import { describe, it, expect } from "vitest";
import {
  buildJudgePrompt,
  parseJudgeResponse,
  verdictsFromJudgeResponse,
  judgeScenario,
  renderTranscript,
} from "../../../server-handlers/_negotiation-eval-judge";
import { EVAL_SCENARIOS } from "../../../data/negotiation-eval-scenarios";
import { SUBJECTIVE_RUBRIC } from "../../../server-handlers/_negotiation-eval-rubric";
import { runScenarioStructural } from "./_evalHarness";

const SCENARIO = EVAL_SCENARIOS[0]!;
const STATE = runScenarioStructural(SCENARIO).finalState;

describe("negotiation-eval — judge prompt builder", () => {
  it("renders every turn into the transcript block", () => {
    const rendered = renderTranscript(SCENARIO.turns);
    for (let i = 0; i < SCENARIO.turns.length; i++) {
      expect(rendered).toContain(`Turn ${i + 1}`);
      expect(rendered).toContain(SCENARIO.turns[i]!.candidate);
    }
  });

  it("includes every subjective criterion id in the prompt", () => {
    const prompt = buildJudgePrompt(SCENARIO, STATE);
    for (const c of SUBJECTIVE_RUBRIC) {
      expect(prompt).toContain(c.id);
    }
  });

  it("instructs the model to return JSON", () => {
    const prompt = buildJudgePrompt(SCENARIO, STATE);
    expect(prompt).toMatch(/JSON/);
    expect(prompt).toContain('"verdicts"');
  });
});

describe("negotiation-eval — judge response parser", () => {
  it("parses well-formed JSON", () => {
    const raw = JSON.stringify({
      verdicts: [
        { id: "recruiter-persona-authentic", verdict: "pass", reason: "Turn 2 uses LPA naturally." },
        { id: "coaching-grounded-in-session", verdict: "fail", reason: "No coaching shown in transcript." },
      ],
    });
    const parsed = parseJudgeResponse(raw);
    expect(parsed).not.toBeNull();
    expect(parsed!.verdicts).toHaveLength(2);
    expect(parsed!.verdicts[0]!.verdict).toBe("pass");
  });

  it("strips code-fence wrapping some models add", () => {
    const raw = '```json\n{"verdicts":[{"id":"x","verdict":"pass","reason":"r"}]}\n```';
    const parsed = parseJudgeResponse(raw);
    expect(parsed).not.toBeNull();
    expect(parsed!.verdicts).toHaveLength(1);
  });

  it("returns null on truly malformed JSON", () => {
    expect(parseJudgeResponse("not json at all")).toBeNull();
    expect(parseJudgeResponse("")).toBeNull();
    expect(parseJudgeResponse("{ broken")).toBeNull();
  });

  it("returns null when shape is wrong", () => {
    expect(parseJudgeResponse('{"verdicts": "not-an-array"}')).toBeNull();
    expect(parseJudgeResponse("[]")).toBeNull();
    expect(parseJudgeResponse("null")).toBeNull();
  });

  it("drops verdicts with missing id or invalid verdict value", () => {
    const raw = JSON.stringify({
      verdicts: [
        { id: "good", verdict: "pass", reason: "ok" },
        { verdict: "pass", reason: "no id" },
        { id: "bad-verdict", verdict: "maybe", reason: "invalid" },
      ],
    });
    const parsed = parseJudgeResponse(raw);
    expect(parsed!.verdicts.map((v) => v.id)).toEqual(["good"]);
  });
});

describe("negotiation-eval — verdictsFromJudgeResponse", () => {
  it("always returns one verdict per subjective criterion", () => {
    const out = verdictsFromJudgeResponse(null, "test reason");
    expect(out.map((v) => v.criterionId).sort()).toEqual(
      SUBJECTIVE_RUBRIC.map((c) => c.id).sort(),
    );
  });

  it("marks missing criteria as n/a with a clear reason", () => {
    const parsed = parseJudgeResponse(
      JSON.stringify({
        verdicts: [
          {
            id: "recruiter-persona-authentic",
            verdict: "pass",
            reason: "Turn 2 fine.",
          },
        ],
      }),
    );
    const out = verdictsFromJudgeResponse(parsed);
    const missing = out.filter((v) => v.criterionId !== "recruiter-persona-authentic");
    for (const m of missing) {
      expect(m.verdict).toBe("n/a");
      expect(m.reason).toMatch(/judge did not return/);
    }
  });

  it("propagates the LLM-provided reason when verdict is decided", () => {
    const parsed = parseJudgeResponse(
      JSON.stringify({
        verdicts: SUBJECTIVE_RUBRIC.map((c) => ({
          id: c.id,
          verdict: "fail",
          reason: `concrete failure citing turn ${c.id}`,
        })),
      }),
    );
    const out = verdictsFromJudgeResponse(parsed);
    for (const v of out) {
      expect(v.verdict).toBe("fail");
      expect(v.reason).toMatch(/concrete failure/);
    }
  });
});

describe("negotiation-eval — judgeScenario graceful degradation", () => {
  it("returns n/a verdicts when no API key is configured (does not call LLM)", async () => {
    const llmStub = async () => {
      throw new Error("LLM should not be called when hasAnyApiKey is false");
    };
    const verdicts = await judgeScenario(SCENARIO, STATE, llmStub, false);
    expect(verdicts).toHaveLength(SUBJECTIVE_RUBRIC.length);
    for (const v of verdicts) {
      expect(v.verdict).toBe("n/a");
      expect(v.reason).toMatch(/no LLM API key/);
    }
  });

  it("returns n/a verdicts on LLM error rather than throwing", async () => {
    const llmStub = async () => {
      throw new Error("network down");
    };
    const verdicts = await judgeScenario(SCENARIO, STATE, llmStub, true);
    for (const v of verdicts) {
      expect(v.verdict).toBe("n/a");
      expect(v.reason).toMatch(/LLM call failed/);
    }
  });

  it("returns parsed verdicts on a clean LLM response", async () => {
    const fakeResponse = JSON.stringify({
      verdicts: SUBJECTIVE_RUBRIC.map((c) => ({
        id: c.id,
        verdict: "pass",
        reason: `Turn 1 — ${c.id}`,
      })),
    });
    const llmStub = async () => ({ text: fakeResponse });
    const verdicts = await judgeScenario(SCENARIO, STATE, llmStub, true);
    for (const v of verdicts) {
      expect(v.verdict).toBe("pass");
    }
  });
});
