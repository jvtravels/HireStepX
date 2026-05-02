/* HireStepX — Resume rubric score helpers
   Pulled out of analyze-resume.ts so the score-derivation logic can be
   unit-tested without spinning up the LLM call.

   The rubric: 6 weighted criteria, total 100 points.
     • quantifiedAchievements (0-20)
     • relevantSkills         (0-20)
     • formattingStructure    (0-15)
     • experienceProgression  (0-20)
     • educationCerts         (0-10)
     • summaryClarity         (0-15)

   The LLM emits each subscore independently. Server sums them
   deterministically — the score becomes a pure function of the
   subscores, eliminating the "model does mental arithmetic" failure
   mode that produced ±5pt drift between runs of nearly-identical
   inputs. */

export interface ScoreBreakdown {
  quantifiedAchievements: number;
  relevantSkills: number;
  formattingStructure: number;
  experienceProgression: number;
  educationCerts: number;
  summaryClarity: number;
  total: number;
}

const CRITERIA: Array<{ key: keyof Omit<ScoreBreakdown, "total">; max: number }> = [
  { key: "quantifiedAchievements", max: 20 },
  { key: "relevantSkills", max: 20 },
  { key: "formattingStructure", max: 15 },
  { key: "experienceProgression", max: 20 },
  { key: "educationCerts", max: 10 },
  { key: "summaryClarity", max: 15 },
];

/** Coerce an unknown value to an integer in [0, max]. Returns null if
    the value isn't a finite number (so callers can detect "LLM didn't
    emit this subscore" vs "LLM emitted a zero"). */
function clampSubscore(v: unknown, max: number): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const rounded = Math.round(v);
  if (rounded < 0) return 0;
  if (rounded > max) return max;
  return rounded;
}

/** Extract a structured score breakdown from an LLM-emitted profile.
    Returns null if the LLM didn't emit a `scoreBreakdown` object at
    all — caller should fall back to whatever resumeScore the LLM put
    in the top-level field, or surface "unavailable".

    Tolerant of partial output: missing subscores default to 0 (the
    floor of their range). The total is always the deterministic sum
    of the clamped subscores. */
export function computeScoreBreakdown(
  profile: Record<string, unknown>,
): ScoreBreakdown | null {
  const raw = profile.scoreBreakdown;
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  // Require at least one valid subscore — if the LLM emitted an empty
  // object or one with no numeric values, treat it as a no-op so we
  // fall back to resumeScore.
  let anyValid = false;
  const result = { total: 0 } as ScoreBreakdown;
  for (const { key, max } of CRITERIA) {
    const v = clampSubscore(obj[key], max);
    if (v !== null) anyValid = true;
    result[key] = v ?? 0;
    result.total += result[key];
  }
  if (!anyValid) return null;

  // Clamp the total to [0, 100] as a final safety belt — should be
  // mathematically impossible to exceed if the per-criterion clamps
  // worked, but cheap insurance.
  if (result.total < 0) result.total = 0;
  if (result.total > 100) result.total = 100;
  return result;
}
