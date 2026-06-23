/**
 * Structural regression armor for the gap-classified follow-up
 * directives in `server-handlers/follow-up.ts`.
 *
 * Same approach as `behavioralPriorCoverage.test.ts` /
 * `groundingPromptStructure.test.ts` — read the source file directly
 * and pattern-match for each directive's load-bearing phrasing. No
 * LLM call, no fixtures, no transcript synthesis. Cheap, deterministic,
 * and will catch a silent rename / accidental deletion the moment it
 * happens.
 *
 * What this protects: every analyzer-side flag has a "within-turn
 * recovery" prompt directive — drop the directive and the candidate
 * loses the real-time push. Catching that here is cheaper than
 * discovering it in production.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const FOLLOW_UP_FILE = join(__dirname, "../../server-handlers/follow-up.ts");
const src = readFileSync(FOLLOW_UP_FILE, "utf8");

describe("follow-up directive structure", () => {
  it("imports all the per-turn answer-shape helpers", () => {
    /* Drop one of these imports and the corresponding directive goes
       dead silently — TypeScript wouldn't flag it because the
       directive lookup is by helper-name, and the const reference
       below uses `detectRehearsedOpener(answer)` / etc. */
    expect(src).toMatch(/detectRehearsedOpener/);
    expect(src).toMatch(/isLowConvictionDelivery/);
    expect(src).toMatch(/isConflictQuestion/);
    expect(src).toMatch(/hasCounterpartyPov/);
    expect(src).toMatch(/isFailureQuestion/);
    expect(src).toMatch(/hasConcreteFailureMiss/);
    expect(src).toMatch(/classifyFailureResponse/);
  });

  it("METRIC_NAKED directive block exists with the anchor-probe phrasing", () => {
    expect(src).toMatch(/ANSWER-SHAPE PROBE — METRIC_NAKED/);
    expect(src).toMatch(/baseline/i);
  });

  it("REHEARSED directive block exists with the bypass-stock-template phrasing", () => {
    expect(src).toMatch(/ANSWER-SHAPE PROBE — REHEARSED/);
    expect(src).toMatch(/memorised|memorized|stock template/i);
  });

  it("LOW_CONVICTION directive block exists with the decisive-line phrasing", () => {
    expect(src).toMatch(/ANSWER-SHAPE PROBE — LOW_CONVICTION/);
    expect(src).toMatch(/hedge|hedging/i);
    expect(src).toMatch(/decisive line/i);
  });

  it("RAMBLING_EMPTY directive block exists with the compression phrasing", () => {
    expect(src).toMatch(/ANSWER-SHAPE PROBE — RAMBLING_EMPTY/);
    expect(src).toMatch(/compress/i);
  });

  it("COUNTERPARTY-POV directive block exists and is gated on isConflictQuestion + !hasCounterpartyPov", () => {
    expect(src).toMatch(/COUNTERPARTY-POV PROBE/);
    /* Gate: must reference BOTH helpers in the same expression block
       so we catch a future revert that drops one or the other. */
    expect(src).toMatch(/isConflictQuestion\([^)]*\)[\s\S]{0,200}!hasCounterpartyPov/);
  });

  it("FAILURE-SPECIFICITY directive block exists and is gated on isFailureQuestion + owns + !hasConcreteFailureMiss", () => {
    expect(src).toMatch(/FAILURE-SPECIFICITY PROBE/);
    expect(src).toMatch(/isFailureQuestion\([^)]*\)[\s\S]{0,300}classifyFailureResponse[\s\S]{0,200}!hasConcreteFailureMiss/);
  });

  it("all 6 directives are concatenated into the assembled prompt", () => {
    /* The prompt-assembly line interpolates each directive variable in
       order. If any directive is created but not wired into the prompt
       string, the analyzer detects the gap but the LLM never sees it.
       This test pins the wiring. */
    expect(src).toMatch(/\$\{answerShapeDirective\}/);
    expect(src).toMatch(/\$\{conflictGapDirective\}/);
    expect(src).toMatch(/\$\{failureSpecificityDirective\}/);
  });

  it("answer-shape classifier precedence is metric_naked → rehearsed → low_conviction → rambling", () => {
    /* The precedence comment AND the if/else-if chain order matter —
       metric_naked must be checked first because it's the highest-
       leverage probe; rehearsed beats low_conviction because stock
       openers ARE the confidence mask. A refactor that reorders these
       silently changes which probe a layered answer receives. */
    const metricIdx = src.indexOf('answerShape = "metric_naked"');
    const rehearsedIdx = src.indexOf('answerShape = "rehearsed"');
    const lowConvIdx = src.indexOf('answerShape = "low_conviction"');
    const ramblingIdx = src.indexOf('answerShape = "rambling_empty"');
    expect(metricIdx).toBeGreaterThan(-1);
    expect(rehearsedIdx).toBeGreaterThan(metricIdx);
    expect(lowConvIdx).toBeGreaterThan(rehearsedIdx);
    expect(ramblingIdx).toBeGreaterThan(lowConvIdx);
  });
});

describe("discipline fence + focus tilt wiring (W1 + W2)", () => {
  /* W1: the follow-up fence must come from the SHARED builder, not a
     second hand-written copy. The old inline fence (SEO-writer / SWE /
     designer hardcoded examples) must be gone, replaced by the shared
     buildFollowUpDisciplineFence import. */
  it("imports the shared fence builder and does not re-hardcode the old example fence", () => {
    expect(src).toMatch(/import \{ buildFollowUpDisciplineFence \} from "\.\/_generate-questions-helpers"/);
    expect(src).toMatch(/buildFollowUpDisciplineFence\(/);
    // The old divergent copy is gone — these illustrative lines must not
    // re-appear inline (they now live, unified, in the shared builder).
    expect(src).not.toMatch(/An SEO Content Writer is NOT graded on user-research metrics/);
  });

  it("suppresses the craft fence on salary-negotiation turns (hiring-manager persona owns its own)", () => {
    expect(src).toMatch(/followUpDisciplineFence = type === "salary-negotiation"\s*\n?\s*\?\s*""/);
  });

  it("W2: threads a focus tilt that fires only for a narrower, non-generic focus", () => {
    expect(src).toMatch(/const focusTilt =/);
    expect(src).toMatch(/cleanFocus !== "general"/);
    expect(src).toMatch(/cleanFocus !== type/);
    expect(src).toMatch(/FOCUS TILT:/);
  });

  it("destructures focus from the request body", () => {
    expect(src).toMatch(/const \{ question, answer, type, focus,/);
  });
});
