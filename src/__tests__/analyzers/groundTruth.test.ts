/* Ground-truth accuracy gate for per-focus analyzers.
 *
 * Discovers fixtures under tests/fixtures/analyzer-ground-truth/<focus>/,
 * runs each focus's registered analyzer against them, and asserts:
 *   1. Every fixture's `must_include` flags actually appear (recall).
 *   2. Every fixture's `must_not_include` flags do not appear (false-positive guard).
 *   3. Aggregated precision and recall meet per-focus thresholds.
 *
 * If a rubric change drops accuracy on the calibration set, this test
 * fails before the regression hits prod. As the fixture set grows,
 * raise THRESHOLDS upward.
 */

import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { pickAnalyzer, registeredFocuses } from "../../../server-handlers/analyzers/_dispatch";
import type { SessionRowForAnalysis, TranscriptTurn } from "../../../server-handlers/analyzers/_types";

interface Fixture {
  name: string;
  notes?: string;
  session: { type: string; transcript: TranscriptTurn[]; target_role?: string; target_company?: string; difficulty?: string };
  expected: {
    must_include?: string[];
    must_not_include?: string[];
    expect_hallucination_types?: string[];
  };
}

const FIXTURES_ROOT = path.resolve(__dirname, "../../../tests/fixtures/analyzer-ground-truth");

interface Threshold {
  precision: number;
  recall: number;
  minFixtures: number;
}

// Conservative v1 thresholds. Raise once each focus has ≥15 fixtures.
// New focuses bootstrap with minFixtures: 1 so the gate exists from day one;
// raise as the fixture set grows.
const THRESHOLDS: Record<string, Threshold> = {
  behavioral: { precision: 0.7, recall: 0.7, minFixtures: 3 },
  "salary-negotiation": { precision: 0.7, recall: 0.7, minFixtures: 3 },
  technical: { precision: 0.7, recall: 0.7, minFixtures: 2 },
  "system-design": { precision: 0.7, recall: 0.7, minFixtures: 2 },
  "hr-round": { precision: 0.7, recall: 0.7, minFixtures: 2 },
  strategic: { precision: 0.7, recall: 0.7, minFixtures: 2 },
  panel: { precision: 0.7, recall: 0.7, minFixtures: 2 },
  "case-study": { precision: 0.7, recall: 0.7, minFixtures: 2 },
  "campus-placement": { precision: 0.7, recall: 0.7, minFixtures: 2 },
  management: { precision: 0.7, recall: 0.7, minFixtures: 2 },
  "government-psu": { precision: 0.7, recall: 0.7, minFixtures: 2 },
};

function loadFixtures(focus: string): { file: string; fx: Fixture }[] {
  const dir = path.join(FIXTURES_ROOT, focus);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((file) => ({
      file,
      fx: JSON.parse(fs.readFileSync(path.join(dir, file), "utf-8")) as Fixture,
    }));
}

function buildSession(fx: Fixture): SessionRowForAnalysis {
  return {
    id: `fixture_${fx.name}`,
    user_id: "fixture_user",
    type: fx.session.type,
    focus: fx.session.type,
    difficulty: fx.session.difficulty || "mid",
    target_role: fx.session.target_role || null,
    target_company: fx.session.target_company || null,
    score: 70,
    questions: fx.session.transcript.filter((t) => (t.speaker || "").toLowerCase().startsWith("a")).length,
    duration: 1800,
    transcript: fx.session.transcript,
    ai_feedback: "",
    skill_scores: null,
    job_description: null,
    jd_analysis: null,
    resume_version_id: null,
    created_at: new Date().toISOString(),
  };
}

for (const focus of registeredFocuses()) {
  const fixtures = loadFixtures(focus);
  const threshold = THRESHOLDS[focus];

  describe(`ground-truth: ${focus}`, () => {
    if (!threshold) {
      it.skip(`no threshold configured for ${focus}`, () => {});
      return;
    }

    it(`has at least ${threshold.minFixtures} fixtures`, () => {
      expect(fixtures.length).toBeGreaterThanOrEqual(threshold.minFixtures);
    });

    if (fixtures.length === 0) return;

    let truePositives = 0;
    let falseNegatives = 0;
    let falsePositives = 0;

    for (const { file, fx } of fixtures) {
      it(`${file}: ${fx.name}`, async () => {
        const analyzer = pickAnalyzer(fx.session.type);
        expect(analyzer.focus, `dispatch should route ${fx.session.type} to a real analyzer`).not.toBe("unknown");

        const result = await analyzer.analyze({ session: buildSession(fx) });
        const flagSet = new Set(result.flags);

        for (const flag of fx.expected.must_include || []) {
          if (flagSet.has(flag)) truePositives += 1;
          else falseNegatives += 1;
          expect(flagSet.has(flag), `${file}: expected flag "${flag}" was not produced`).toBe(true);
        }

        for (const flag of fx.expected.must_not_include || []) {
          if (flagSet.has(flag)) falsePositives += 1;
          expect(flagSet.has(flag), `${file}: forbidden flag "${flag}" was produced`).toBe(false);
        }

        if (fx.expected.expect_hallucination_types) {
          const types = new Set(result.hallucinations.map((h) => h.type));
          for (const t of fx.expected.expect_hallucination_types) {
            expect(types.has(t), `${file}: expected hallucination type "${t}" missing`).toBe(true);
          }
        }
      });
    }

    it(`aggregate precision/recall meets threshold`, () => {
      const recall = truePositives / Math.max(truePositives + falseNegatives, 1);
      const precision = truePositives / Math.max(truePositives + falsePositives, 1);
      expect(recall, `recall ${recall.toFixed(2)} below threshold ${threshold.recall}`).toBeGreaterThanOrEqual(threshold.recall);
      expect(precision, `precision ${precision.toFixed(2)} below threshold ${threshold.precision}`).toBeGreaterThanOrEqual(threshold.precision);
    });
  });
}
