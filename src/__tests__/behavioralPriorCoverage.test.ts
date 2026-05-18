/**
 * Phase-6.1 — behavioural auto-prebias regression tests.
 *
 * Pins the structural shape of the auto-prebias plumbing for the
 * BEHAVIOURAL focus so a future refactor can't silently drop the
 * cross-session learning loop. Same approach as
 * `groundingPromptStructure.test.ts` — read the source file directly
 * and pattern-match the directives. Cheap, deterministic, no LLM.
 *
 * What this protects:
 *   - The handler defines a BEHAVIORAL_PRIOR_FLAG_TO_DIMENSION map.
 *   - Every analyzer-emitted behavioural flag in the canonical set has
 *     a mapping entry — otherwise the next session silently misses the
 *     coaching priority.
 *   - The behavioural pre-coverage clause is actually wired into the
 *     prompt template (not just defined-and-unused).
 *   - The telemetry counters are emitted alongside the existing
 *     HR-prebias counters.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const HANDLER_FILE = join(__dirname, "../../server-handlers/generate-questions.ts");
const ENGINE_FILE = join(__dirname, "../useInterviewEngine.ts");
const SUPABASE_FILE = join(__dirname, "../supabase.ts");

const handlerSrc = readFileSync(HANDLER_FILE, "utf8");
const engineSrc = readFileSync(ENGINE_FILE, "utf8");
const supabaseSrc = readFileSync(SUPABASE_FILE, "utf8");

describe("Phase-6.1 — behavioural prebias plumbing", () => {
  it("handler defines BEHAVIORAL_PRIOR_FLAG_TO_DIMENSION", () => {
    expect(handlerSrc).toMatch(/BEHAVIORAL_PRIOR_FLAG_TO_DIMENSION/);
  });

  it("every canonical behavioural analyzer flag has a dimension mapping", () => {
    /* Mirror the flag set emitted by `analyzers/behavioral.ts`. If a
       new flag lands in the analyzer it MUST also land in the
       generator map — otherwise the next session can't pre-bias
       toward fixing it. Catching this at unit-test time is cheaper
       than discovering the silent regression in production. */
    const canonicalBehavioralFlags = [
      "weak_star_structure",
      "frequent_missing_result",
      "ai_accepts_missing_result",
      "we_attribution_heavy",
      "metric_without_baseline",
      "ai_accepted_unevidenced_metric",
      "ai_accepted_vague",
      "no_learning_reflection",
      "unquantified_answers",
    ];
    for (const f of canonicalBehavioralFlags) {
      // Match `f:` (object key) — must be present as a property name
      // in BEHAVIORAL_PRIOR_FLAG_TO_DIMENSION.
      const pattern = new RegExp(`\\b${f}\\b\\s*:`);
      expect(
        pattern.test(handlerSrc),
        `${f} missing from BEHAVIORAL_PRIOR_FLAG_TO_DIMENSION`,
      ).toBe(true);
    }
  });

  it("behavioural prebias clause is wired into the prompt template", () => {
    /* The block must actually appear in the assembled `prompt`
       string-template, not just defined-and-unused. */
    expect(handlerSrc).toMatch(/\$\{behavioralPriorCoverageContext/);
  });

  it("behavioural prebias clause is gated by interviewType === 'behavioral'", () => {
    /* Guard against accidental cross-firing: an HR-round caller that
       happens to send a behavioural-shaped flag in priorFlags must
       NOT trigger this clause. */
    expect(handlerSrc).toMatch(
      /isBehavioral\s*=\s*interviewType\s*===\s*["']behavioral["']/,
    );
  });

  it("emits behavioural prebias telemetry counters", () => {
    /* The dashboard A/B's prebias-applied vs not on subsequent-session
       STAR / evidence / learning metrics. Pinning the counter names
       here so a rename surfaces immediately. */
    expect(handlerSrc).toMatch(/behavioral_prior_coverage_hints/);
    expect(handlerSrc).toMatch(/behavioral_prior_coverage_applied/);
  });
});

describe("Phase-6.1 — engine-side prebias fetch", () => {
  it("auto-prebias fetch now runs for both hr-round AND behavioral focuses", () => {
    /* The set-based gate replaces the prior `=== 'hr-round'` check.
       Catching a future revert here keeps the autonomous loop on for
       behavioural sessions. */
    expect(engineSrc).toMatch(/prebiasFocuses\s*=\s*new\s+Set\(\[\s*["']hr-round["']\s*,\s*["']behavioral["']/);
    expect(engineSrc).toMatch(/prebiasFocuses\.has\(interviewFocus\)/);
  });

  it("engine passes the current interviewFocus through to getLatestSessionInsightFlags", () => {
    /* Without the focus filter, an intervening session of another
       focus drops the prebias for the run we actually care about. */
    expect(engineSrc).toMatch(
      /getLatestSessionInsightFlags\(\s*user\.id\s*,\s*interviewFocus\s*\)/,
    );
  });
});

describe("Phase-6.1 — supabase helper focus filter", () => {
  it("getLatestSessionInsightFlags accepts an optional focus argument", () => {
    /* Signature must include `focus?: string` — protects the HR-round
       caller (which omits it) while letting the behavioural caller
       narrow to same-focus rows. */
    expect(supabaseSrc).toMatch(
      /export\s+async\s+function\s+getLatestSessionInsightFlags\([\s\S]*?focus\?\s*:\s*string,?\s*\)\s*:\s*Promise<string\[\]>/,
    );
  });

  it("query applies .eq('focus', focus) when focus is provided", () => {
    expect(supabaseSrc).toMatch(/if\s*\(\s*focus\s*\)\s*\{[\s\S]*?\.eq\(\s*["']focus["']\s*,\s*focus\s*\)/);
  });
});
