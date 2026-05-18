/* Phase-4 (4.1) — fixture-driven regression suite for the
 * campus-placement analyzer.
 *
 * Each fixture in `fixtures/campusPlacementTranscripts.ts` exposes:
 *   - the expected archetype the classifier should resolve to
 *   - the flag IDs the analyzer MUST emit
 *   - (optional) the flag IDs the analyzer MUST NOT emit
 *
 * This suite is the regression net for the whole rubric — when we
 * tune a flag regex / threshold, this test tells us which archetype's
 * outcome shifted, with a one-line failure that names the fixture.
 *
 * Failure-message strategy: we assert per-fixture with `toContain`
 * (not equality) so adding NEW flags to an existing fixture won't
 * break the suite. Negative assertions catch regressions where a
 * tightened flag starts firing on a clean baseline.
 */

import { describe, it, expect } from "vitest";
import { campusPlacementAnalyzer } from "../../server-handlers/analyzers/campus-placement";
import type { SessionRowForAnalysis } from "../../server-handlers/analyzers/_types";
import { CAMPUS_PLACEMENT_FIXTURES } from "./fixtures/campusPlacementTranscripts";

function asSession(f: typeof CAMPUS_PLACEMENT_FIXTURES[number]): SessionRowForAnalysis {
  return {
    id: f.id,
    user_id: "u-fixture",
    type: "campus-placement",
    focus: "campus-placement",
    difficulty: "medium",
    score: 70,
    questions: f.transcript.filter((t) => t.speaker === "ai").length,
    duration: 600,
    transcript: f.transcript,
    ai_feedback: "",
    skill_scores: null,
    job_description: null,
    jd_analysis: null,
    resume_version_id: null,
    created_at: new Date().toISOString(),
    target_company: f.targetCompany,
  };
}

describe("campus-placement fixture suite (Phase 4.1)", () => {
  for (const fixture of CAMPUS_PLACEMENT_FIXTURES) {
    it(`${fixture.id} — resolves to expected archetype + emits expected flags`, async () => {
      const result = await campusPlacementAnalyzer.analyze({
        session: asSession(fixture),
        resume: null,
      });

      // Archetype assertion — the classifier output is the rubric pivot.
      expect(
        result.meta?.campusPlacement?.archetype,
        `${fixture.id}: expected archetype ${fixture.expectedArchetype}, got ${result.meta?.campusPlacement?.archetype}`,
      ).toBe(fixture.expectedArchetype);

      // Positive flag assertions.
      for (const flag of fixture.mustHaveFlags) {
        expect(
          result.flags,
          `${fixture.id}: expected flag "${flag}" to fire — actual flags: ${result.flags.join(", ")}`,
        ).toContain(flag);
      }

      // Negative flag assertions (regression-guard).
      if (fixture.mustNotHaveFlags) {
        for (const flag of fixture.mustNotHaveFlags) {
          expect(
            result.flags,
            `${fixture.id}: expected flag "${flag}" NOT to fire — actual flags: ${result.flags.join(", ")}`,
          ).not.toContain(flag);
        }
      }
    });
  }
});
