import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/* The critique / evaluation pipeline runs through evaluate-session.ts.
 * The candidate-profile signals are computed and used by the negotiation
 * kernel but they do not enter the LLM evaluator prompt directly today.
 * The launch-blocker directive is added there as the closest existing
 * prose-critique surface that COULD reference these signals.
 *
 * TODO: when a dedicated candidate-profile-aware critique pipeline
 * lands, move this directive into that pipeline's system prompt and
 * point this test at its file. */

const EVAL_PATH = join(
  __dirname,
  "..",
  "..",
  "server-handlers",
  "evaluate-session.ts",
);

describe("critique-invariants — non-hallucination directive on candidate-profile signals", () => {
  const evalSrc = readFileSync(EVAL_PATH, "utf8");

  it("contains the literal 'MUST NOT reference any candidate-profile signal that is false' directive", () => {
    expect(evalSrc).toContain("MUST NOT reference any candidate-profile signal that is false");
  });

  it("explicitly forbids hallucinating sensitive context", () => {
    const guardPhrases = [
      /do not assert/i,
      /do not claim/i,
      /do not mention if not present/i,
    ];
    const hits = guardPhrases.filter((re) => re.test(evalSrc));
    expect(hits.length).toBeGreaterThanOrEqual(2);
  });

  it("names at least 3 sensitive candidate-profile topics in the guard", () => {
    /* The guard should give the LLM concrete examples of the kind of
       topic it must not invent — at minimum a handful of sensitive
       categories. */
    const topics = [
      /career gap/i,
      /layoff/i,
      /pregnan/i,
      /disabilit/i,
      /caste/i,
      /mental health/i,
      /pip/i,
    ];
    const hits = topics.filter((re) => re.test(evalSrc));
    expect(hits.length).toBeGreaterThanOrEqual(3);
  });
});
