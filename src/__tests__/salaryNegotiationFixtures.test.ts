/* Phase-4 (4.1) — fixture-driven regression suite for the
 * salary-negotiation analyzer.
 *
 * Each fixture in `fixtures/salaryNegotiationTranscripts.ts` exposes:
 *   - the recruiter sector persona the analyzer should resolve to
 *   - the flag IDs the analyzer MUST emit (positive)
 *   - (optional) the flag IDs the analyzer MUST NOT emit (negative)
 *
 * This suite mirrors the campus-placement fixture pattern exactly —
 * same `toContain` strategy so adding NEW flags to a fixture won't
 * break the suite. The aggregate test at the bottom computes per-flag
 * precision / recall across the whole fixture set and gates at >=0.85
 * (the Phase-4 acceptance threshold from SCORE_IMPROVEMENT_PLAN.md).
 */

import { describe, it, expect } from "vitest";
import { salaryNegotiationAnalyzer } from "../../server-handlers/analyzers/salary-negotiation";
import type { SessionRowForAnalysis } from "../../server-handlers/analyzers/_types";
import { SALARY_NEGOTIATION_FIXTURES, type SalaryNegotiationFixture } from "./fixtures/salaryNegotiationTranscripts";

/* Deterministic created_at — no Date.now() per Phase-4 rule 3. */
const FIXTURE_CREATED_AT = "2026-05-18T00:00:00.000Z";

function asSession(f: SalaryNegotiationFixture): SessionRowForAnalysis {
  return {
    id: f.id,
    user_id: "u-fixture",
    type: "salary-negotiation",
    focus: "salary-negotiation",
    difficulty: f.difficulty,
    score: 70,
    questions: f.transcript.filter((t) => t.speaker === "ai").length,
    duration: 600,
    transcript: f.transcript,
    ai_feedback: "",
    skill_scores: null,
    job_description: null,
    jd_analysis: null,
    resume_version_id: null,
    created_at: FIXTURE_CREATED_AT,
    target_role: f.targetRole,
    target_company: f.targetCompany,
  };
}

describe("salary-negotiation fixture suite (Phase 4.1)", () => {
  for (const fixture of SALARY_NEGOTIATION_FIXTURES) {
    it(`${fixture.id} — resolves to ${fixture.expectedPersona} + emits expected flags`, async () => {
      const result = await salaryNegotiationAnalyzer.analyze({
        session: asSession(fixture),
        resume: null,
      });

      // Persona assertion — the analyzer always emits a persona (falls
      // through to "default" for unknown / unmapped tiers).
      expect(
        result.meta?.salaryNegotiation?.recruiterPersona,
        `${fixture.id}: expected persona ${fixture.expectedPersona}, got ${result.meta?.salaryNegotiation?.recruiterPersona}`,
      ).toBe(fixture.expectedPersona);

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

/* Aggregate per-flag precision / recall over the fixture set.
 *
 * For every flag mentioned by ANY fixture (positive or negative):
 *   - TP = fixtures with the flag in mustHaveFlags AND analyzer emits it
 *   - FP = fixtures with the flag in mustNotHaveFlags AND analyzer emits it
 *   - FN = fixtures with the flag in mustHaveFlags AND analyzer does NOT emit it
 *   - TN = fixtures with the flag in mustNotHaveFlags AND analyzer does NOT emit it
 *
 * Precision = TP / (TP + FP). Recall = TP / (TP + FN). Both gate at 0.85.
 * Flags with no positive fixture (e.g. some negative-only sanity checks)
 * are skipped from the precision/recall gate — they're still asserted
 * individually in the per-fixture loop above.
 */
describe("salary-negotiation analyzer — per-flag precision/recall gate", () => {
  it("each ai_* / cluster flag holds precision >= 0.85 AND recall >= 0.85", async () => {
    const allFlags = new Set<string>();
    for (const f of SALARY_NEGOTIATION_FIXTURES) {
      f.mustHaveFlags.forEach((x) => allFlags.add(x));
      f.mustNotHaveFlags?.forEach((x) => allFlags.add(x));
    }

    const results = await Promise.all(
      SALARY_NEGOTIATION_FIXTURES.map(async (f) => ({
        fixture: f,
        flags: new Set(
          (await salaryNegotiationAnalyzer.analyze({
            session: asSession(f),
            resume: null,
          })).flags,
        ),
      })),
    );

    const failures: string[] = [];
    for (const flag of allFlags) {
      let tp = 0, fp = 0, fn = 0;
      for (const { fixture, flags } of results) {
        const positive = fixture.mustHaveFlags.includes(flag);
        const negative = fixture.mustNotHaveFlags?.includes(flag) ?? false;
        const emitted = flags.has(flag);
        if (positive && emitted) tp++;
        else if (positive && !emitted) fn++;
        else if (negative && emitted) fp++;
      }
      if (tp + fn === 0) continue; // skip flags with no positive coverage
      const precision = tp / (tp + fp || 1);
      const recall = tp / (tp + fn || 1);
      if (precision < 0.85) failures.push(`${flag}: precision=${precision.toFixed(2)} (< 0.85), tp=${tp}, fp=${fp}`);
      if (recall < 0.85) failures.push(`${flag}: recall=${recall.toFixed(2)} (< 0.85), tp=${tp}, fn=${fn}`);
    }

    expect(failures, `per-flag gate failures:\n${failures.join("\n")}`).toEqual([]);
  });
});
