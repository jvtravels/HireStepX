/* Pure helpers for fix-outcome measurement.
 *
 * For each resolved session insight, compares the rate of its flags
 * in the 7 days BEFORE the resolution timestamp vs the 7 days AFTER.
 * This is what converts the dashboard from "issues found" to "issues
 * actually fixed." Unit-testable without DB or LLM mocks.
 */

export interface FlagWindowCounts {
  /** sessions analyzed in the focus during this window (denominator) */
  totalSessions: number;
  /** sessions in this window that had the flag (numerator) */
  flaggedSessions: number;
}

export interface OutcomeInput {
  before: FlagWindowCounts;
  after: FlagWindowCounts;
  /** how many days have elapsed since resolution. <7 → not enough time. */
  daysSinceResolution: number;
}

export type OutcomeVerdict = "verified" | "partial" | "no_change" | "regressed" | "insufficient_data";

export interface OutcomeResult {
  verdict: OutcomeVerdict;
  before_rate: number;             // 0..1
  after_rate: number;              // 0..1
  delta: number;                   // before_rate - after_rate (positive = improvement)
  before_count: number;
  after_count: number;
  before_total: number;
  after_total: number;
  computed_at: string;
}

/** Decide a verdict given before/after counts. The thresholds are
 *  conservative — small samples → insufficient_data; otherwise
 *  measure relative drop.
 */
export function computeOutcome(input: OutcomeInput): OutcomeResult {
  const { before, after, daysSinceResolution } = input;
  const beforeRate = before.totalSessions > 0 ? before.flaggedSessions / before.totalSessions : 0;
  const afterRate = after.totalSessions > 0 ? after.flaggedSessions / after.totalSessions : 0;
  const delta = beforeRate - afterRate;

  let verdict: OutcomeVerdict;
  if (daysSinceResolution < 7 || (before.flaggedSessions < 3 && after.totalSessions < 5)) {
    verdict = "insufficient_data";
  } else if (afterRate > beforeRate * 1.2 && (afterRate - beforeRate) > 0.05) {
    verdict = "regressed";
  } else if (afterRate <= beforeRate * 0.5 && delta >= 0.03) {
    verdict = "verified";
  } else if (afterRate <= beforeRate * 0.8 && delta >= 0.02) {
    verdict = "partial";
  } else {
    verdict = "no_change";
  }

  return {
    verdict,
    before_rate: beforeRate,
    after_rate: afterRate,
    delta,
    before_count: before.flaggedSessions,
    after_count: after.flaggedSessions,
    before_total: before.totalSessions,
    after_total: after.totalSessions,
    computed_at: new Date().toISOString(),
  };
}

/** Aggregate per-flag counts within a window of insight rows. */
export function countFlagInWindow(
  insights: { flags: string[] | null; analyzed_at: string }[],
  flag: string,
  windowStartIso: string,
  windowEndIso: string,
): FlagWindowCounts {
  const startMs = new Date(windowStartIso).getTime();
  const endMs = new Date(windowEndIso).getTime();
  let total = 0;
  let flagged = 0;
  for (const row of insights) {
    const ts = new Date(row.analyzed_at).getTime();
    if (!Number.isFinite(ts) || ts < startMs || ts >= endMs) continue;
    total += 1;
    if ((row.flags || []).includes(flag)) flagged += 1;
  }
  return { totalSessions: total, flaggedSessions: flagged };
}

/** Pick the most-impactful flag from a resolved insight to use as the
 *  primary outcome metric. The first hallucination-class or rubric-gap
 *  flag wins; if none, the first flag in the list. Deterministic.
 */
export function primaryFlagFor(flags: string[]): string | null {
  if (!flags.length) return null;
  const priority = (f: string): number => {
    if (f.startsWith("implausible_") || f.includes("hallucinat") || f.includes("invented") || f.includes("fake_")) return 3;
    if (f.startsWith("ai_accept") || f.startsWith("ai_invent")) return 2;
    if (f === "duplicate_question" || f === "leaked_answer") return 2;
    if (f === "analyzer_error" || f === "empty_transcript" || f === "no_analyzer_for_focus") return 0;
    return 1;
  };
  return [...flags].sort((a, b) => priority(b) - priority(a))[0] || null;
}
